import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { createApp } from "../../src/worker/app";
import type { Env } from "../../src/worker/env";

/**
 * Runs the real Hono app against a real local D1 database (Miniflare, in memory). We never
 * spread the proxy's variables into the test environment, so a developer's local `.dev.vars`
 * credentials can never leak into, or be spent by, the offline test suite.
 */
export async function startHarness(options: { upstreamFetch?: typeof fetch } = {}) {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "wrangler.jsonc", persist: false });
  const db = proxy.env.DB;
  for (const file of readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join("db/migrations", file), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
      await db.prepare(statement).run();
    }
  }
  const app = createApp(options);

  async function request(path: string, init: RequestInit = {}, envOverrides: Partial<Env> = {}) {
    const pending: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => pending.push(p),
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext;
    const env: Env = { DB: db, APP_ENV: "test", ...envOverrides };
    const res = await app.request(`http://localhost${path}`, init, env, ctx);
    const text = await res.text();
    await Promise.all(pending);
    return { status: res.status, headers: res.headers, text, json: () => JSON.parse(text) as unknown };
  }

  async function reset() {
    await db.batch([db.prepare("DELETE FROM host_requests"), db.prepare("DELETE FROM rate_limits"), db.prepare("DELETE FROM usage_counters")]);
  }

  return { db, request, reset, dispose: () => proxy.dispose() };
}

export type Harness = Awaited<ReturnType<typeof startHarness>>;

export const jsonInit = (method: string, body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

export function ndjson(text: string): { type: string; [k: string]: unknown }[] {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string });
}
