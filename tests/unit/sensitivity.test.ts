import { describe, expect, it } from "vitest";
import { compareSensitivity } from "../../src/shared/domain/sensitivity";
import type { PartnershipCandidate, ResearchRun, SensitivityResult } from "../../src/shared/schemas/evidence";
import { EMPTY, reducer } from "../../src/client/app/workspace-state";

const prov = { kind: "qloo_observed" as const, endpoint: "/v2/insights", request: "synthetic request", retrievedAt: "2026-01-01T00:00:00.000Z" };

function c(id: string, rank: number, affinity = 0.9 - rank / 10, contributions: { seed: string; score: number }[] = []): PartnershipCandidate {
  return {
    venue: { id, name: `Venue ${id}`, type: "urn:entity:place", popularity: 0.5, affinity, tags: [], address: null, location: null },
    category: "bookstore",
    rank,
    strength: "strong",
    contributions,
    sharedTags: [],
    provenance: prov,
  };
}

function result(variants: { omitted: string; ids: string[] | null }[]): SensitivityResult {
  return {
    mode: "live",
    request: {
      categoryTagId: "t",
      categoryName: "Bookstore",
      location: "Testville",
      venueCategory: "bookstore",
      signals: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
      ],
      take: 3,
    },
    variants: variants.map((v) => ({ omitted: v.omitted, status: v.ids ? "done" : "failed", candidates: (v.ids ?? []).map((id, i) => c(id, i + 1)), provenance: prov })),
    callsUsed: variants.length,
    limitations: [],
  };
}

const original = [
  c("V1", 1, 0.9, [
    { seed: "A", score: 0.7 },
    { seed: "B", score: 0.3 },
  ]),
  c("V2", 2, 0.8),
  c("V3", 3, 0.7),
];

describe("reference sensitivity", () => {
  it("reports only what the lists show, per reference", () => {
    const s = compareSensitivity(
      original,
      result([
        { omitted: "A", ids: ["V1", "V2", "V3"] },
        { omitted: "B", ids: ["V2", "V4", "V1"] },
      ]),
    );
    expect(s.references.map((r) => r.effect)).toEqual(["no_change", "changes_top"]);
    expect(s.references[1]).toMatchObject({ topRankWithout: 3, newTop: "Venue V2", entered: ["Venue V4"], left: ["Venue V3"] });
    expect(s.findings[0]).toMatch(/depends on “B”/);
    expect(s.findings).toContain("Leaving out “A” changes nothing in this list.");
  });

  it("flags when Qloo's explanation and the removal test disagree", () => {
    const s = compareSensitivity(
      original,
      result([
        { omitted: "A", ids: ["V1", "V2", "V3"] },
        { omitted: "B", ids: ["V2", "V1", "V3"] },
      ]),
    );
    expect(s.findings.some((f) => /credits “A” most/.test(f))).toBe(true);
  });

  it("separates a reorder and a membership change from a new first choice", () => {
    const s = compareSensitivity(
      original,
      result([
        { omitted: "A", ids: ["V1", "V3", "V2"] },
        { omitted: "B", ids: ["V1", "V2", "V9"] },
      ]),
    );
    expect(s.references.map((r) => r.effect)).toEqual(["reorders", "changes_list"]);
    expect(s.findings[0]).toMatch(/does not rest on a single reference/);
  });

  it("claims nothing for a failed variant", () => {
    const s = compareSensitivity(
      original,
      result([
        { omitted: "A", ids: null },
        { omitted: "B", ids: null },
      ]),
    );
    expect(s.references.every((r) => r.effect === "failed")).toBe(true);
    expect(s.findings).toEqual(["No variant could be repeated, so there is no sensitivity result."]);
  });

  it("calls near-equal first and second choices a tie", () => {
    const tied = [c("V1", 1, 0.81), c("V2", 2, 0.8)];
    const s = compareSensitivity(
      tied,
      result([
        { omitted: "A", ids: ["V1", "V2"] },
        { omitted: "B", ids: ["V1", "V2"] },
      ]),
    );
    expect(s.findings.some((f) => /treat the top two as tied/.test(f))).toBe(true);
  });

  it("is cleared by a new research run and ignored for another run", () => {
    const run = { runId: "r1" } as ResearchRun;
    const withRun = reducer({ ...EMPTY, research: run }, { type: "set_sensitivity", runId: "r1", result: result([]) });
    expect(withRun.sensitivity?.runId).toBe("r1");
    expect(reducer(withRun, { type: "set_sensitivity", runId: "other", result: result([]) }).sensitivity?.runId).toBe("r1");
    expect(reducer(withRun, { type: "set_research", research: { runId: "r2" } as ResearchRun }).sensitivity).toBeNull();
  });
});
