import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { type AppEnv, apiError } from "./http";
import { evaluate } from "./routes/evaluate";
import { hostRequests } from "./routes/host-requests";
import { meta } from "./routes/meta";
import { narrative } from "./routes/narrative";
import { research } from "./routes/research";
import { createLogger } from "./telemetry/log";

export const MAX_BODY_BYTES = 32 * 1024;

function isSameOrigin(origin: string, requestUrl: string): boolean {
  try {
    return new URL(origin).host === new URL(requestUrl).host;
  } catch {
    return false;
  }
}

export interface AppOptions {
  /** Injected in tests so upstream calls can be simulated without touching the network. */
  upstreamFetch?: typeof fetch;
}

export function createApp(options: AppOptions = {}) {
  const app = new Hono<AppEnv>();

  app.use("/api/*", async (c, next) => {
    const requestId = crypto.randomUUID();
    const log = createLogger(requestId);
    c.set("requestId", requestId);
    c.set("log", log);
    c.set("startedAt", Date.now());
    c.set("upstreamFetch", options.upstreamFetch);

    // Bearer tokens, not cookies, authorise every private route, so cross-site forms cannot
    // ride on ambient credentials. We still refuse cross-origin writes as defence in depth.
    const origin = c.req.header("origin");
    if (origin && c.req.method !== "GET" && c.req.method !== "HEAD") {
      if (!isSameOrigin(origin, c.req.url)) return apiError(c, 403, "cross_origin", "Cross-origin requests are not accepted.");
    }

    await next();

    c.header("X-Request-Id", requestId);
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Cross-Origin-Resource-Policy", "same-origin");
    log.info("request", {
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
      ms: Date.now() - c.get("startedAt"),
    });
  });

  app.use(
    "/api/*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => apiError(c, 413, "payload_too_large", "The request body is too large."),
    }),
  );

  app.route("/api", meta);
  app.route("/api", evaluate);
  app.route("/api", research);
  app.route("/api", hostRequests);
  app.route("/api", narrative);

  app.notFound((c) => apiError(c, 404, "not_found", "No such API route."));
  app.onError((error, c) => {
    c.get("log")?.error("unhandled", { errorClass: error.name });
    return apiError(c, 500, "internal_error", "Something went wrong on our side. Please try again.");
  });
  return app;
}
