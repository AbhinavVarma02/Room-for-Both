import { Hono } from "hono";
import { CreateHostRequest, HostAnswerRequest } from "../../shared/schemas/api";
import { type AppContext, type AppEnv, apiError, clientAddress, readJson } from "../http";
import { HostRequestStore } from "../persistence/host-requests";
import { limiterFor } from "../persistence/limits";
import { ID_PATTERN, bearerToken, clientKey } from "../security/crypto";

export const hostRequests = new Hono<AppEnv>();

const NOT_FOUND = "This link is invalid, expired, or has been withdrawn.";

const requireStorage = async (c: AppContext, next: () => Promise<void>) => {
  if (!c.env.DB) return apiError(c, 503, "storage_unavailable", "Host response links are not available on this server.");
  await next();
};
hostRequests.use("/host-requests", requireStorage);
hostRequests.use("/host-requests/*", requireStorage);

async function throttle(c: AppContext, bucket: string, limit: number) {
  const now = Date.now();
  const who = await clientKey(clientAddress(c), c.env.CLIENT_KEY_SALT, now);
  const hit = await limiterFor(c.env.DB).hit(`${bucket}:${who}`, limit, 3600, now);
  return hit.allowed;
}

hostRequests.post("/host-requests", async (c) => {
  const body = await readJson(c, CreateHostRequest);
  if (!body.ok) return body.response;
  if (!(await throttle(c, "host-link-create", 10))) {
    return apiError(c, 429, "rate_limited", "Too many links created recently. Please wait before creating another.");
  }
  const created = await new HostRequestStore(c.env.DB as D1Database).create(body.data.summary, Date.now());
  c.get("log").info("host_request_created", { formats: body.data.summary.proposedFormats.length });
  return c.json(created, 201);
});

hostRequests.get("/host-requests/respond", async (c) => {
  const token = bearerToken(c.req.header("authorization"));
  if (!token) return apiError(c, 401, "missing_token", "A response link token is required.");
  if (!(await throttle(c, "host-link-read", 60))) return apiError(c, 429, "rate_limited", "Too many requests. Please wait a moment.");
  const found = await new HostRequestStore(c.env.DB as D1Database).findForHost(token, Date.now());
  if (!found) return apiError(c, 404, "not_found", NOT_FOUND);
  return c.json(found.view);
});

hostRequests.put("/host-requests/respond", async (c) => {
  const token = bearerToken(c.req.header("authorization"));
  if (!token) return apiError(c, 401, "missing_token", "A response link token is required.");
  if (!(await throttle(c, "host-link-write", 20))) return apiError(c, 429, "rate_limited", "Too many requests. Please wait a moment.");
  const body = await readJson(c, HostAnswerRequest);
  if (!body.ok) return body.response;
  const store = new HostRequestStore(c.env.DB as D1Database);
  const now = Date.now();
  const found = await store.findForHost(token, now);
  if (!found) return apiError(c, 404, "not_found", NOT_FOUND);
  if (found.row.edits_remaining <= 0) return apiError(c, 409, "edits_exhausted", "This link has no edits remaining.");
  const result = await store.submit(found.row, { ...body.data.host, source: "host_response_link" }, now);
  if (!result) return apiError(c, 409, "edits_exhausted", "This link can no longer be edited.");
  c.get("log").info("host_request_submitted", { editsRemaining: result.editsRemaining });
  return c.json({ status: "submitted", editsRemaining: result.editsRemaining });
});

hostRequests.get("/host-requests/:id", async (c) => {
  const id = c.req.param("id");
  const token = bearerToken(c.req.header("authorization"));
  if (!token || !ID_PATTERN.test(id)) return apiError(c, 404, "not_found", NOT_FOUND);
  if (!(await throttle(c, "host-link-owner", 120))) return apiError(c, 429, "rate_limited", "Too many requests. Please wait a moment.");
  const view = await new HostRequestStore(c.env.DB as D1Database).findForOwner(id, token, Date.now());
  if (!view) return apiError(c, 404, "not_found", NOT_FOUND);
  return c.json(view);
});

hostRequests.delete("/host-requests/:id", async (c) => {
  const id = c.req.param("id");
  const token = bearerToken(c.req.header("authorization"));
  if (!token || !ID_PATTERN.test(id)) return apiError(c, 404, "not_found", NOT_FOUND);
  const ok = await new HostRequestStore(c.env.DB as D1Database).revoke(id, token, Date.now());
  if (!ok) return apiError(c, 404, "not_found", NOT_FOUND);
  c.get("log").info("host_request_revoked", {});
  return c.json({ status: "revoked" });
});
