import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetQlooCircuitBreaker } from "../../src/worker/integrations/qloo/client";
import { clearCategoryCache } from "../../src/worker/orchestration/research";
import type { ResearchRun } from "../../src/shared/schemas/evidence";
import { createQlooFake } from "../fixtures/qloo-fake";
import { type Harness, jsonInit, ndjson, startHarness } from "./harness";

const KEY = "synthetic-test-key-0000000000";
const request = {
  seeds: [
    { label: "Aesop", kind: "brand" },
    { label: "Braiding Sweetgrass", kind: "book" },
  ],
  city: "Brooklyn",
  neighborhood: "Greenpoint",
  venueCategory: "bookstore",
  guestCategories: ["skincare"],
  maxCandidates: 4,
};

let fake = createQlooFake();
let h: Harness;
beforeAll(async () => {
  // The harness routes upstream calls through whichever fake the current test installed.
  h = await startHarness({ upstreamFetch: ((input: RequestInfo | URL, init?: RequestInit) => fake.fetchImpl(input, init)) as typeof fetch });
});
afterAll(async () => {
  await h.dispose();
});
beforeEach(async () => {
  await h.reset();
  fake = createQlooFake();
  resetQlooCircuitBreaker();
  clearCategoryCache();
});

function result(text: string): ResearchRun {
  const event = ndjson(text).find((e) => e.type === "result") as { run: ResearchRun } | undefined;
  if (!event) throw new Error(`no result event in: ${text.slice(0, 300)}`);
  return event.run;
}

describe("fixture mode (no credentials)", () => {
  it("streams plan, steps, and a labelled fictional result", async () => {
    const res = await h.request("/api/research", jsonInit("POST", request));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = ndjson(res.text);
    expect(events[0]?.type).toBe("plan");
    expect(events.filter((e) => e.type === "step").length).toBeGreaterThanOrEqual(4);
    const run = result(res.text);
    expect(run.mode).toBe("fixture");
    expect(run.limitations[0]).toMatch(/Fixture mode/);
    expect(run.candidates.length).toBeGreaterThan(0);
    for (const c of run.candidates) {
      expect(c.venue.name).toMatch(/\(fictional\)/);
      expect(c.provenance.kind).toBe("synthetic_demo");
      expect(c.venue.location).toBeNull();
    }
    expect(fake.calls).toHaveLength(0);
  });

  it("throttles repeated runs from the same client", async () => {
    const env = { RESEARCH_RUNS_PER_HOUR_PER_CLIENT: "2" };
    expect((await h.request("/api/research", jsonInit("POST", request), env)).status).toBe(200);
    expect((await h.request("/api/research", jsonInit("POST", request), env)).status).toBe(200);
    const third = await h.request("/api/research", jsonInit("POST", request), env);
    expect(third.status).toBe(429);
  });

  it("validates the research request", async () => {
    const res = await h.request("/api/research", jsonInit("POST", { ...request, venueCategory: "casino" }));
    expect(res.status).toBe(400);
  });
});

describe("live mode against a synthetic upstream", () => {
  const live = { QLOO_API_KEY: KEY };

  it("authenticates server-side, records provenance, and never echoes the key", async () => {
    const res = await h.request("/api/research", jsonInit("POST", request), live);
    const run = result(res.text);
    expect(run.mode).toBe("live");
    expect(res.text).not.toContain(KEY);
    expect(fake.calls.every((c) => c.apiKey === KEY && c.url.origin === "https://api.qloo.com")).toBe(true);
    expect(run.seeds.map((s) => s.status)).toEqual(["exact", "exact"]);
    expect(run.categoryTag?.id).toContain(":place:");
    expect(run.candidates[0]?.provenance.kind).toBe("qloo_observed");
    expect(run.candidates[0]?.strength).toBe("strong");
    expect(run.candidates[0]?.contributions[0]).toEqual({ seed: "Aesop", score: 0.7 });
    expect(run.candidates[0]?.sharedTags).toContain("Nature Writing");
    expect(run.themes[0]?.title).toBe("Co-curated reading list");
    expect(run.callsUsed).toBeLessThanOrEqual(run.callBudget);
    expect(run.callsUsed).toBe(fake.calls.length);
  });

  it("passes only exact references as signals and discloses approximate matches", async () => {
    fake = createQlooFake({ fuzzySearch: ["Braiding Sweetgrass"] });
    const run = result((await h.request("/api/research", jsonInit("POST", request), live)).text);
    expect(run.seeds.map((s) => s.status)).toEqual(["exact", "uncertain"]);
    const venueCall = fake.calls.find((c) => c.url.searchParams.get("filter.type") === "urn:entity:place");
    expect(venueCall?.url.searchParams.get("signal.interests.entities")).toBe("SYN-AESOP-1");
    expect(run.limitations.some((l) => l.includes("matched only approximately"))).toBe(true);
  });

  it("broadens from neighbourhood to city when the first search is empty", async () => {
    fake = createQlooFake({ emptyVenuesFor: ["Greenpoint"] });
    const run = result((await h.request("/api/research", jsonInit("POST", request), live)).text);
    expect(run.steps.map((s) => s.id)).toContain("broaden_location");
    expect(run.candidates.length).toBeGreaterThan(0);
  });

  it("skips venue discovery rather than guessing when no tag matches the category", async () => {
    fake = createQlooFake({ noCategoryTag: true });
    const run = result((await h.request("/api/research", jsonInit("POST", request), live)).text);
    expect(run.candidates).toEqual([]);
    expect(run.steps.find((s) => s.id === "find_venues")?.status).toBe("skipped");
  });

  it("ranks without a taste signal, and says so, when no reference resolves", async () => {
    fake = createQlooFake({ searchMisses: ["Aesop", "Braiding Sweetgrass"] });
    const run = result((await h.request("/api/research", jsonInit("POST", request), live)).text);
    expect(run.candidates.every((c) => c.strength === "unscored")).toBe(true);
    expect(run.themes).toEqual([]);
    expect(run.limitations.some((l) => l.includes("without a taste signal"))).toBe(true);
  });

  it("reports authentication failures generically", async () => {
    fake = createQlooFake({ statusFor: { "/search": 401 } });
    const res = await h.request("/api/research", jsonInit("POST", request), live);
    const err = ndjson(res.text).find((e) => e.type === "error");
    expect(err).toMatchObject({ code: "auth", retryable: false });
    expect(res.text).not.toContain(KEY);
  });

  it("retries a transient upstream error once", async () => {
    fake = createQlooFake({ flaky: { status: 503, times: 1 } });
    const run = result((await h.request("/api/research", jsonInit("POST", request), live)).text);
    expect(run.seeds[0]?.status).toBe("exact");
  });

  it("stops at the per-run call budget and keeps partial results", async () => {
    const res = await h.request("/api/research", jsonInit("POST", request), { ...live, QLOO_MAX_CALLS_PER_RUN: "2" });
    const run = result(res.text);
    expect(fake.calls.length).toBe(2);
    expect(run.seeds.map((s) => s.status)).toEqual(["exact", "exact"]);
    expect(run.steps.filter((s) => s.summary.includes("call budget")).map((s) => s.id)).toEqual(["resolve_category", "find_venues", "cultural_bridge"]);
    expect(run.limitations.some((l) => l.includes("results are partial"))).toBe(true);
  });

  it("completes the worst case (three references and a widened search) within the default budget", async () => {
    fake = createQlooFake({ emptyVenuesFor: ["Greenpoint"] });
    const three = { ...request, seeds: [...request.seeds, { label: "Patagonia", kind: "brand" }] };
    const run = result((await h.request("/api/research", jsonInit("POST", three), live)).text);
    expect(run.callsUsed).toBe(7);
    expect(run.callBudget).toBe(7);
    expect(run.themes.length).toBeGreaterThan(0);
    expect(run.limitations.some((l) => l.includes("results are partial"))).toBe(false);
  });

  it("refuses to run when the daily ceiling would be exceeded", async () => {
    const res = await h.request("/api/research", jsonInit("POST", request), { ...live, QLOO_DAILY_CALL_CEILING: "3" });
    expect(res.status).toBe(503);
    expect(fake.calls).toHaveLength(0);
  });

  it("records upstream usage against the daily ceiling", async () => {
    await h.request("/api/research", jsonInit("POST", request), live);
    const row = await h.db.prepare("SELECT count FROM usage_counters WHERE name = 'qloo_calls'").first<{ count: number }>();
    expect(row?.count).toBe(fake.calls.length);
  });

  it("will not send the key to a non-Qloo host", async () => {
    const res = await h.request("/api/research", jsonInit("POST", request), { ...live, QLOO_BASE_URL: "https://example.com" });
    expect(res.status).toBe(503);
    expect(fake.calls).toHaveLength(0);
  });

  it("runs the labelled fictional demonstration on request, without calling Qloo", async () => {
    const run = result((await h.request("/api/research", jsonInit("POST", { ...request, demo: true }), live)).text);
    expect(run.mode).toBe("fixture");
    expect(run.candidates.every((c) => c.provenance.kind === "synthetic_demo")).toBe(true);
    expect(fake.calls).toHaveLength(0);
  });

  it("explains a rejected credential without exposing it", async () => {
    fake = createQlooFake({ statusFor: { "/search": 401 } });
    const res = await h.request("/api/research", jsonInit("POST", request), live);
    const error = ndjson(res.text).find((e) => e.type === "error") as { code: string; message: string } | undefined;
    expect(error?.code).toBe("auth");
    expect(error?.message).toMatch(/not authorized/);
    expect(res.text).not.toContain(KEY);
  });

  it("matches a book's main title and falls back to scoped taste tags when the cross-domain lookup is rejected", async () => {
    fake = createQlooFake({ subtitledBooks: true, rejectCrossDomain: true });
    const run = result((await h.request("/api/research", jsonInit("POST", { ...request, neighborhood: undefined }), live)).text);
    expect(run.seeds.map((s) => s.status)).toEqual(["exact", "exact"]);
    expect(run.themes.map((t) => t.id)).toEqual(["taste-tags"]);
    expect(run.limitations.some((l) => /no books linked/.test(l))).toBe(true);
    const tagCall = fake.calls.find((c) => c.url.searchParams.get("filter.type") === "urn:tag");
    expect(tagCall?.url.searchParams.get("filter.parents.types")).toBe("urn:entity:brand,urn:entity:book");
    expect(run.steps.find((s) => s.id === "cultural_bridge")).toMatchObject({ status: "done", tool: "taste_tags", calls: 2 });
    expect(run.callsUsed).toBeLessThanOrEqual(run.callBudget);
  });

  it("leaves out venues Qloo marks as closed and says so", async () => {
    fake = createQlooFake({ closedVenues: 1 });
    const run = result((await h.request("/api/research", jsonInit("POST", request), live)).text);
    expect(run.candidates.map((c) => c.venue.id)).not.toContain("SYN-VENUE-1");
    expect(run.candidates.map((c) => c.rank)).toEqual([1, 2, 3]);
    expect(run.limitations).toContain("1 venue that Qloo marks as closed was left out.");
  });

  it("reuses the venue-category tag within an isolate", async () => {
    await h.request("/api/research", jsonInit("POST", request), live);
    const first = fake.calls.filter((c) => c.url.pathname === "/v2/tags").length;
    await h.request("/api/research", jsonInit("POST", request), live);
    expect(fake.calls.filter((c) => c.url.pathname === "/v2/tags").length).toBe(first);
  });
});
