import { beforeEach, describe, expect, it } from "vitest";
import { QlooClient, QlooError, resetQlooCircuitBreaker } from "../../src/worker/integrations/qloo/client";

const KEY = "synthetic-test-key-0000000000";
const ok = () => new Response(JSON.stringify({ results: [] }), { status: 200 });
const limited = (headers: Record<string, string>) => new Response("{}", { status: 429, headers });

function client(responses: (() => Response)[], sleeps: number[], minIntervalMs?: number) {
  let i = 0;
  return new QlooClient({
    apiKey: KEY,
    baseUrl: "https://api.qloo.com",
    callBudget: 10,
    ...(minIntervalMs !== undefined ? { minIntervalMs } : {}),
    fetchImpl: (async () => (responses[Math.min(i++, responses.length - 1)] as () => Response)()) as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
}

beforeEach(() => resetQlooCircuitBreaker());

describe("Qloo client rate-limit handling", () => {
  it("spaces consecutive calls instead of bursting past the per-second limit", async () => {
    const sleeps: number[] = [];
    const c = client([ok], sleeps, 250);
    await c.get("/search", { query: "a" });
    await c.get("/search", { query: "b" });
    await c.get("/search", { query: "c" });
    expect(sleeps).toHaveLength(2);
    for (const ms of sleeps) expect(ms).toBeGreaterThan(200);
  });

  it("waits for Qloo's per-second reset before its single retry", async () => {
    const sleeps: number[] = [];
    const c = client([() => limited({ "x-second-ratelimit-reset": "0.6", "x-month-ratelimit-remaining": "9000" }), ok], sleeps, 0);
    await expect(c.get("/search", { query: "a" })).resolves.toEqual({ results: [] });
    expect(sleeps).toEqual([600]);
    expect(c.callsUsed).toBe(2);
  });

  it("stops without retrying when the monthly allowance is spent", async () => {
    const sleeps: number[] = [];
    const c = client([() => limited({ "x-month-ratelimit-remaining": "0" }), ok], sleeps, 0);
    const error = await c.get("/search", { query: "a" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QlooError);
    expect((error as QlooError).code).toBe("QUOTA_EXHAUSTED");
    expect(c.callsUsed).toBe(1);
  });

  it("reports a persistent 429 as rate limited after one bounded retry", async () => {
    const sleeps: number[] = [];
    const c = client([() => limited({})], sleeps, 0);
    const error = (await c.get("/search", { query: "a" }).catch((e: unknown) => e)) as QlooError;
    expect(error.code).toBe("RATE_LIMITED");
    expect(sleeps).toEqual([1000]);
    expect(c.callsUsed).toBe(2);
  });
});
