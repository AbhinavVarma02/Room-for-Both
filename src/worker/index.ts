import { createApp } from "./app";
import type { Env } from "./env";
import { cleanupExpired } from "./persistence/limits";
import { createLogger } from "./telemetry/log";

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(_controller, env, ctx) {
    if (!env.DB) return;
    const log = createLogger(crypto.randomUUID());
    ctx.waitUntil(
      cleanupExpired(env.DB, Date.now())
        .then((removed) => log.info("cleanup", removed))
        .catch(() => log.error("cleanup_failed", {})),
    );
  },
} satisfies ExportedHandler<Env>;
