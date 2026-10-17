import { Hono } from "hono";
import { CROSS_DOMAIN_BY_VENUE } from "../../shared/constants/vocabulary";
import { BaselineRequest, LlmBaselineRequest, ResearchRequest, VenueBridgeRequest, type ResearchEvent } from "../../shared/schemas/evidence";
import { settings } from "../env";
import { type AppContext, type AppEnv, apiError, clientAddress, readJson } from "../http";
import { QlooClient, QlooError, type QlooTransport } from "../integrations/qloo/client";
import { FixtureTransport } from "../integrations/qloo/fixture-transport";
import { runBaseline, runVenueBridge } from "../orchestration/followups";
import { PlannerCallError, proposeAction } from "../integrations/gemini/planner";
import { LLM_BASELINE_SCHEMA, LLM_BASELINE_SYSTEM, interpretLlmBaseline, llmBaselinePrompt } from "../orchestration/llm-baseline";
import { DETERMINISTIC_ONLY, type PlannerSetup } from "../orchestration/planner";
import { runResearch } from "../orchestration/research";
import { limiterFor } from "../persistence/limits";
import { clientKey, randomToken } from "../security/crypto";

export const research = new Hono<AppEnv>();

const PUBLIC_MESSAGES: Partial<Record<QlooError["code"], string>> = {
  NOT_CONFIGURED: "Live cultural research is not configured on this server.",
  AUTH: "Live access to Qloo is not authorized for this deployment right now: the credential was rejected, for example because it expired or was revoked.",
  RATE_LIMITED: "The cultural data service is busy. Please wait a minute and try again.",
  UPSTREAM_UNAVAILABLE: "The cultural data service is temporarily unavailable. Please try again shortly.",
  BUDGET_EXHAUSTED: "This research run reached its call limit before finishing.",
  QUOTA_EXHAUSTED: "This deployment's monthly allowance of live Qloo calls is used up.",
  UNTRUSTED_BASE_URL: "Live cultural research is misconfigured on this server.",
};

/**
 * Streams newline-delimited JSON events so the browser can show each research step as it
 * actually completes: the plan, then one event per finished step, then the result or an error.
 */
research.post("/research", async (c) => {
  const body = await readJson(c, ResearchRequest);
  if (!body.ok) return body.response;
  const s = settings(c.env);
  const log = c.get("log");
  const now = Date.now();
  const limiter = limiterFor(c.env.DB);
  // Visitors can always choose the fictional demonstration; it makes no upstream call.
  const mode = s.qlooConfigured && body.data.demo !== true ? "live" : "fixture";

  try {
    const who = await clientKey(clientAddress(c), c.env.CLIENT_KEY_SALT, now);
    const hit = await limiter.hit(`research:${who}`, s.runsPerHour, 3600, now);
    if (!hit.allowed) {
      log.warn("research_throttled", { mode });
      return apiError(c, 429, "rate_limited", "You have run several searches recently. Please wait before starting another.");
    }
    if (mode === "live") {
      const used = await limiter.usage(new Date(now).toISOString().slice(0, 10), "qloo_calls");
      if (used + s.callBudget > s.dailyCeiling) {
        log.warn("research_quota_exhausted", { used, ceiling: s.dailyCeiling });
        return apiError(c, 503, "quota_exhausted", "Today's cultural research allowance is used up. You can still evaluate a host you choose yourself.");
      }
    }
  } catch {
    // Without a working counter we cannot bound upstream spend, so live research fails closed.
    log.error("limiter_unavailable", { mode });
    if (mode === "live") return apiError(c, 503, "limiter_unavailable", "Research is temporarily unavailable. Please try again shortly.");
  }

  const planner = plannerSetup(c, body.data, limiter, new Date(now).toISOString().slice(0, 10));

  let transport: QlooTransport;
  try {
    transport =
      mode === "live"
        ? new QlooClient({
            apiKey: c.env.QLOO_API_KEY,
            baseUrl: c.env.QLOO_BASE_URL,
            timeoutMs: s.timeoutMs,
            callBudget: s.callBudget,
            ...(c.get("upstreamFetch") ? { fetchImpl: c.get("upstreamFetch"), sleep: async () => {} } : {}),
          })
        : new FixtureTransport(s.callBudget);
  } catch (error) {
    const code = error instanceof QlooError ? error.code : "UPSTREAM";
    log.error("research_misconfigured", { code });
    return apiError(c, 503, "research_unavailable", PUBLIC_MESSAGES[code] ?? "Research is unavailable.");
  }

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const send = async (event: ResearchEvent) => {
    await writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
  };

  const runId = randomToken(12);
  const work = (async () => {
    const t0 = Date.now();
    try {
      const run = await runResearch(body.data, { transport, mode, callBudget: s.callBudget, runId, emit: send, planner });
      await send({ type: "result", run });
      log.info("research_complete", {
        mode,
        qlooCalls: transport.callsUsed,
        planner: run.planner?.requested,
        modelCalls: run.planner?.modelCalls ?? 0,
        modelAccepted: run.planner?.decisions.filter((d) => d.planner === "model").length ?? 0,
        fallbacks: run.planner?.decisions.filter((d) => d.fallback).length ?? 0,
        steps: run.steps.length,
        candidates: run.candidates.length,
        themes: run.themes.length,
        ms: Date.now() - t0,
      });
    } catch (error) {
      const code = error instanceof QlooError ? error.code : "INTERNAL";
      const retryable = error instanceof QlooError ? error.retryable : true;
      log.error("research_failed", { mode, errorClass: code, qlooCalls: transport.callsUsed, ms: Date.now() - t0 });
      await send({
        type: "error",
        code: code.toLowerCase(),
        message: (error instanceof QlooError && PUBLIC_MESSAGES[error.code]) || "Research could not be completed. You can retry, or continue without cultural evidence.",
        retryable,
      });
    } finally {
      if (mode === "live") {
        try {
          await limiter.addUsage(new Date(now).toISOString().slice(0, 10), "qloo_calls", transport.callsUsed);
        } catch {
          log.error("usage_record_failed", { qlooCalls: transport.callsUsed });
        }
      }
      await writer.close();
    }
  })();
  c.executionCtx.waitUntil(work);

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": c.get("requestId"),
    },
  });
});

/**
 * The model planner is used only when the visitor asked for it, consented to sending references and
 * the venue category to the provider, and the server has a model configured. Every model call is
 * reserved against the same daily allowance as summaries; when none is left, the run falls back.
 */
function plannerSetup(c: AppContext, request: ResearchRequest, limiter: ReturnType<typeof limiterFor>, day: string): PlannerSetup {
  const s = settings(c.env);
  if (request.planner !== "model") return DETERMINISTIC_ONLY("The deterministic planner was requested.");
  const base = { requested: "model" as const, maxDecisions: s.plannerMaxDecisions };
  if (request.plannerConsent !== true) return { ...base, port: null, availability: "Not asked: consent to send the references and venue category to the model provider was not given." };
  if (!s.geminiConfigured) return { ...base, port: null, availability: "Not asked: no model is configured on this server." };
  if (s.plannerMaxDecisions === 0) return { ...base, port: null, availability: "Not asked: model decisions are switched off on this server." };
  const fetchImpl = c.get("upstreamFetch");
  return {
    ...base,
    availability: "Asked, with the visitor's consent.",
    port: {
      model: (c.env.GEMINI_MODEL ?? "").trim().slice(0, 80),
      propose: (prompt, schema) => proposeAction(prompt, schema, { apiKey: c.env.GEMINI_API_KEY, model: c.env.GEMINI_MODEL, timeoutMs: s.plannerTimeoutMs, ...(fetchImpl ? { fetchImpl } : {}) }),
      reserveCall: async () => {
        try {
          if ((await limiter.usage(day, "gemini_calls")) >= s.geminiDailyCeiling) return false;
          await limiter.addUsage(day, "gemini_calls", 1);
          return true;
        } catch {
          // Without a working counter we cannot bound model spend, so the run uses the deterministic planner.
          return false;
        }
      },
    },
  };
}

// A follow-up makes one upstream call; the second slot only covers a single retry after a 429 or 5xx.
const FOLLOWUP_BUDGET = 2;

/**
 * Shared gate for the single-call follow-ups: same per-visitor limit family as research, the same
 * daily ceiling, and the same fail-closed rule when the counter is unavailable.
 */
async function followupGate(c: AppContext, demo: boolean, kind: string): Promise<{ ok: false; response: Response } | { ok: true; mode: "live" | "fixture"; transport: QlooTransport; finish: () => Promise<void> }> {
  const s = settings(c.env);
  const log = c.get("log");
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const limiter = limiterFor(c.env.DB);
  const mode = s.qlooConfigured && !demo ? "live" : "fixture";
  try {
    const who = await clientKey(clientAddress(c), c.env.CLIENT_KEY_SALT, now);
    // Two follow-ups per research run at most (comparison and venue side), so twice the run limit.
    if (!(await limiter.hit(`followup:${who}`, s.runsPerHour * 2, 3600, now)).allowed) {
      log.warn("followup_throttled", { kind, mode });
      return { ok: false, response: apiError(c, 429, "rate_limited", "You have run several lookups recently. Please wait before starting another.") };
    }
    if (mode === "live" && (await limiter.usage(day, "qloo_calls")) + FOLLOWUP_BUDGET > s.dailyCeiling) {
      log.warn("followup_quota_exhausted", { kind });
      return { ok: false, response: apiError(c, 503, "quota_exhausted", "Today's cultural research allowance is used up. Everything else keeps working.") };
    }
  } catch {
    log.error("limiter_unavailable", { kind, mode });
    if (mode === "live") return { ok: false, response: apiError(c, 503, "limiter_unavailable", "This lookup is temporarily unavailable. Please try again shortly.") };
  }
  let transport: QlooTransport;
  try {
    transport =
      mode === "live"
        ? new QlooClient({
            apiKey: c.env.QLOO_API_KEY,
            baseUrl: c.env.QLOO_BASE_URL,
            timeoutMs: s.timeoutMs,
            callBudget: FOLLOWUP_BUDGET,
            ...(c.get("upstreamFetch") ? { fetchImpl: c.get("upstreamFetch"), sleep: async () => {} } : {}),
          })
        : new FixtureTransport(FOLLOWUP_BUDGET);
  } catch (error) {
    const code = error instanceof QlooError ? error.code : "UPSTREAM";
    return { ok: false, response: apiError(c, 503, "research_unavailable", PUBLIC_MESSAGES[code] ?? "Research is unavailable.") };
  }
  const finish = async () => {
    if (mode !== "live") return;
    try {
      await limiter.addUsage(day, "qloo_calls", transport.callsUsed);
    } catch {
      log.error("usage_record_failed", { qlooCalls: transport.callsUsed });
    }
  };
  return { ok: true, mode, transport, finish };
}

function upstreamFailure(c: AppContext, error: unknown) {
  const code = error instanceof QlooError ? error.code : "INTERNAL";
  c.get("log").error("followup_failed", { errorClass: code });
  const status = code === "AUTH" || code === "NOT_CONFIGURED" ? 503 : 502;
  return apiError(c, status, code.toLowerCase(), (error instanceof QlooError && PUBLIC_MESSAGES[error.code]) || "The lookup could not be completed. Everything else keeps working.");
}

/** Identifiers must belong to the same mode as the run that produced them, so fictional and Qloo data never mix. */
const fictionalId = (id: string) => id.startsWith("fixture");

research.post("/research/baseline", async (c) => {
  const body = await readJson(c, BaselineRequest);
  if (!body.ok) return body.response;
  const gate = await followupGate(c, body.data.demo === true, "baseline");
  if (!gate.ok) return gate.response;
  if (fictionalId(body.data.categoryTagId) !== (gate.mode === "fixture")) {
    return apiError(c, 409, "mode_mismatch", "This comparison belongs to a research run in a different mode. Run research again first.");
  }
  try {
    const result = await runBaseline(body.data, { transport: gate.transport, mode: gate.mode });
    c.get("log").info("baseline_complete", { mode: gate.mode, qlooCalls: gate.transport.callsUsed, venues: result.candidates.length });
    return c.json(result);
  } catch (error) {
    return upstreamFailure(c, error);
  } finally {
    await gate.finish();
  }
});

research.post("/research/venue-bridge", async (c) => {
  const body = await readJson(c, VenueBridgeRequest);
  if (!body.ok) return body.response;
  if (!body.data.domain && !CROSS_DOMAIN_BY_VENUE[body.data.venueCategory]) {
    return apiError(c, 400, "no_venue_domain", "Venue-side cultural evidence is available for bookstores, record stores, and cafes. Add the venue's own programming interests instead.");
  }
  const gate = await followupGate(c, body.data.demo === true, "venue_bridge");
  if (!gate.ok) return gate.response;
  if (fictionalId(body.data.venueId) !== (gate.mode === "fixture")) {
    return apiError(c, 409, "mode_mismatch", "This venue belongs to a research run in a different mode. Run research again first.");
  }
  try {
    const result = await runVenueBridge(body.data, { transport: gate.transport, mode: gate.mode });
    c.get("log").info("venue_bridge_complete", { mode: gate.mode, qlooCalls: gate.transport.callsUsed, items: result.items.length });
    return c.json(result);
  } catch (error) {
    return upstreamFailure(c, error);
  } finally {
    await gate.finish();
  }
});

research.post("/research/llm-baseline", async (c) => {
  const s = settings(c.env);
  if (!s.geminiConfigured) return apiError(c, 501, "not_configured", "No language model is configured on this server.");
  const body = await readJson(c, LlmBaselineRequest);
  if (!body.ok) return body.response;
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const limiter = limiterFor(c.env.DB);
  try {
    const who = await clientKey(clientAddress(c), c.env.CLIENT_KEY_SALT, now);
    if (!(await limiter.hit(`llm-baseline:${who}`, 6, 3600, now)).allowed) {
      return apiError(c, 429, "rate_limited", "You have asked the language model several times recently. Please wait before asking again.");
    }
    if ((await limiter.usage(day, "gemini_calls")) >= s.geminiDailyCeiling) {
      return apiError(c, 503, "quota_exhausted", "Today's language-model allowance is used up. Everything else keeps working.");
    }
    await limiter.addUsage(day, "gemini_calls", 1);
  } catch {
    return apiError(c, 503, "limiter_unavailable", "The language-model comparison is temporarily unavailable.");
  }
  const fetchImpl = c.get("upstreamFetch");
  const model = (c.env.GEMINI_MODEL ?? "").trim();
  try {
    const raw = await proposeAction(llmBaselinePrompt(body.data), LLM_BASELINE_SCHEMA, {
      apiKey: c.env.GEMINI_API_KEY,
      model,
      timeoutMs: 10_000,
      system: LLM_BASELINE_SYSTEM,
      maxOutputTokens: 600,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
    const result = interpretLlmBaseline(raw, model);
    c.get("log").info("llm_baseline_complete", { venues: result.venues.length, discarded: result.discarded });
    return c.json(result);
  } catch (error) {
    const code = error instanceof PlannerCallError ? error.code : "malformed";
    c.get("log").warn("llm_baseline_failed", { errorClass: code });
    return apiError(c, 502, "llm_unavailable", "The language model could not answer just now. The Qloo results are unaffected.");
  }
});
