import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EXAMPLE_SCENARIO } from "../../src/shared/fixtures/example-scenario";
import { type Harness, jsonInit, startHarness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.dispose();
});
beforeEach(async () => {
  await h.reset();
});

describe("meta routes", () => {
  it("reports health without exposing configuration values", async () => {
    const res = await h.request("/api/health", {}, { QLOO_API_KEY: "test-secret-value-123" });
    expect(res.status).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", research: { mode: "live" }, storage: { bound: true } });
    expect(res.text).not.toContain("test-secret-value-123");
    expect(res.headers.get("x-request-id")).toMatch(/[0-9a-f-]{36}/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("falls back to fixture mode when no Qloo key is configured", async () => {
    const res = await h.request("/api/config");
    expect(res.json()).toMatchObject({ researchMode: "fixture", narrativeEnabled: false, hostLinksEnabled: true });
  });

  it("returns JSON 404s for unknown API routes", async () => {
    const res = await h.request("/api/nope");
    expect(res.status).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: "not_found" } });
  });
});

describe("POST /api/evaluate", () => {
  it("evaluates a valid scenario deterministically", async () => {
    const a = await h.request("/api/evaluate", jsonInit("POST", { scenario: EXAMPLE_SCENARIO }));
    const b = await h.request("/api/evaluate", jsonInit("POST", { scenario: EXAMPLE_SCENARIO }));
    expect(a.status).toBe(200);
    const body = a.json() as { evaluation: { options: unknown[]; counts: Record<string, number> } };
    expect(body.evaluation.options).toHaveLength(9);
    expect(body.evaluation.counts).toEqual({ feasible: 0, conditional: 2, no_go: 7 });
    expect(a.text).toEqual(b.text);
  });

  it("rejects invalid input without echoing submitted values", async () => {
    const bad = { scenario: { ...EXAMPLE_SCENARIO, guest: { ...EXAMPLE_SCENARIO.guest, businessName: "<img src=x onerror=alert(1)>".padEnd(120, "x") } } };
    const res = await h.request("/api/evaluate", jsonInit("POST", bad));
    expect(res.status).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: "validation_failed" } });
    expect(res.text).not.toContain("onerror");
  });

  it("rejects unknown fields", async () => {
    const res = await h.request("/api/evaluate", jsonInit("POST", { scenario: EXAMPLE_SCENARIO, debug: true }));
    expect(res.status).toBe(400);
  });

  it("requires a JSON content type", async () => {
    const res = await h.request("/api/evaluate", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
    expect(res.status).toBe(415);
  });

  it("rejects malformed JSON", async () => {
    const res = await h.request("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
    expect(res.status).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: "invalid_json" } });
  });

  it("rejects oversized bodies", async () => {
    const res = await h.request("/api/evaluate", jsonInit("POST", { scenario: EXAMPLE_SCENARIO, pad: "x".repeat(40_000) }));
    expect(res.status).toBe(413);
  });

  it("refuses cross-origin writes", async () => {
    const res = await h.request("/api/evaluate", jsonInit("POST", { scenario: EXAMPLE_SCENARIO }, { Origin: "https://attacker.example" }));
    expect(res.status).toBe(403);
    const same = await h.request("/api/evaluate", jsonInit("POST", { scenario: EXAMPLE_SCENARIO }, { Origin: "http://localhost" }));
    expect(same.status).toBe(200);
  });
});
