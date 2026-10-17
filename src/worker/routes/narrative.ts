import { Hono } from "hono";
import { NarrativeRequest } from "../../shared/schemas/narrative";
import { settings } from "../env";
import { type AppEnv, apiError, clientAddress, readJson } from "../http";
import { NarrativeError, draftNarrative } from "../integrations/gemini/client";
import { limiterFor } from "../persistence/limits";
import { clientKey } from "../security/crypto";

export const narrative = new Hono<AppEnv>();

narrative.post("/narrative", async (c) => {
  const s = settings(c.env);
  if (!s.geminiConfigured) return apiError(c, 501, "not_configured", "Narrative drafting is not enabled on this server.");
  const body = await readJson(c, NarrativeRequest);
  if (!body.ok) return body.response;

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const limiter = limiterFor(c.env.DB);
  try {
    const who = await clientKey(clientAddress(c), c.env.CLIENT_KEY_SALT, now);
    if (!(await limiter.hit(`narrative:${who}`, 20, 3600, now)).allowed) {
      return apiError(c, 429, "rate_limited", "Too many summaries requested. Please wait before trying again.");
    }
    if ((await limiter.usage(day, "gemini_calls")) >= s.geminiDailyCeiling) {
      return apiError(c, 503, "quota_exhausted", "Today's summary allowance is used up. The structured brief is unaffected.");
    }
    await limiter.addUsage(day, "gemini_calls", 1);
  } catch {
    return apiError(c, 503, "limiter_unavailable", "Summaries are temporarily unavailable.");
  }

  const log = c.get("log");
  const t0 = Date.now();
  try {
    const result = await draftNarrative(body.data.facts, {
      apiKey: c.env.GEMINI_API_KEY,
      model: c.env.GEMINI_MODEL,
      ...(c.get("upstreamFetch") ? { fetchImpl: c.get("upstreamFetch") } : {}),
    });
    log.info("narrative_drafted", { ms: Date.now() - t0 });
    return c.json({ summary: result.summary, provenance: "llm_interpretation", model: result.model });
  } catch (error) {
    const code = error instanceof NarrativeError ? error.code : "upstream";
    log.warn("narrative_failed", { errorClass: code, ms: Date.now() - t0 });
    if (code === "rejected_output") return apiError(c, 502, "rejected_output", error instanceof Error ? error.message : "Draft rejected.");
    return apiError(c, 502, "narrative_unavailable", "The summary could not be drafted. The structured brief is unaffected.");
  }
});
