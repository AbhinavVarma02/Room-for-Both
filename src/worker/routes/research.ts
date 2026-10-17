import { Hono } from "hono";
import { ResearchRequest, type ResearchEvent } from "../../shared/schemas/evidence";
import { settings } from "../env";
import { type AppEnv, apiError, clientAddress, readJson } from "../http";
import { QlooClient, QlooError, type QlooTransport } from "../integrations/qloo/client";
import { FixtureTransport } from "../integrations/qloo/fixture-transport";
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
      const run = await runResearch(body.data, { transport, mode, callBudget: s.callBudget, runId, emit: send });
      await send({ type: "result", run });
      log.info("research_complete", {
        mode,
        qlooCalls: transport.callsUsed,
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
