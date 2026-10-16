import type { Context } from "hono";
import type { z } from "zod";
import type { Env } from "./env";
import type { Logger } from "./telemetry/log";

export type AppEnv = {
  Bindings: Env;
  Variables: { requestId: string; log: Logger; startedAt: number; upstreamFetch: typeof fetch | undefined };
};
export type AppContext = Context<AppEnv>;

export function apiError(c: AppContext, status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 501 | 502 | 503, code: string, message: string) {
  return c.json({ error: { code, message, requestId: c.get("requestId") } }, status);
}

/**
 * Parses and validates a JSON body. Validation messages name the offending field paths but
 * never echo submitted values back, so error responses cannot reflect injected content.
 */
export async function readJson<S extends z.ZodType>(
  c: AppContext,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  const type = c.req.header("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: apiError(c, 415, "unsupported_media_type", "Send a JSON body with Content-Type: application/json.") };
  }
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, response: apiError(c, 400, "invalid_json", "The request body is not valid JSON.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(body)"))].slice(0, 8);
    return { ok: false, response: apiError(c, 400, "validation_failed", `Check these fields: ${fields.join(", ")}.`) };
  }
  return { ok: true, data: parsed.data };
}

export function clientAddress(c: AppContext): string | null {
  return c.req.header("cf-connecting-ip") ?? null;
}
