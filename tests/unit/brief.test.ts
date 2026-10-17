import { describe, expect, it } from "vitest";
import { applyChanges, evaluateScenario } from "../../src/shared/domain";
import { STRENGTH_LABELS, affinityLabel, strengthOf } from "../../src/shared/domain/affinity";
import { buildBrief } from "../../src/shared/domain/brief";
import { selectionFrom } from "../../src/shared/domain/selection";
import { EXAMPLE_GUEST, EXAMPLE_HOST } from "../../src/shared/fixtures/example-scenario";
import { hypotheticalHostFor } from "../../src/shared/fixtures/hypothetical";
import type { PartnershipCandidate, ResearchRun } from "../../src/shared/schemas/evidence";
import type { VenueSelection } from "../../src/shared/schemas/selection";
import { scenario } from "../fixtures/builders";

const prov = { kind: "qloo_observed" as const, endpoint: "/v2/insights", request: "synthetic request", retrievedAt: "2026-01-01T00:00:00.000Z" };

function candidate(affinity: number | null): PartnershipCandidate {
  return {
    venue: { id: "V1", name: "Synthetic Venue V1", type: "urn:entity:place", popularity: 0.5, affinity, tags: [], address: null, location: null },
    category: "bookstore",
    rank: 1,
    strength: strengthOf(affinity),
    contributions: [],
    sharedTags: [],
    provenance: prov,
  };
}

function run(c: PartnershipCandidate): ResearchRun {
  return {
    runId: "run-1",
    mode: "live",
    request: { seeds: [{ label: "Reference A", kind: "brand" }], city: "Testville", venueCategory: "bookstore", guestCategories: ["skincare"], maxCandidates: 5 },
    steps: [],
    seeds: [],
    categoryTag: null,
    candidates: [c],
    themes: [],
    limitations: [],
    callsUsed: 3,
    callBudget: 7,
    durationMs: 1,
  } as unknown as ResearchRun;
}

describe("affinity wording", () => {
  it("follows Qloo's published bands", () => {
    expect(strengthOf(0.81)).toBe("strong");
    expect(strengthOf(0.8)).toBe("moderate");
    expect(strengthOf(0.6)).toBe("moderate");
    expect(strengthOf(0.59)).toBe("weak");
    expect(strengthOf(null)).toBe("unscored");
  });

  it("never shows a number next to the unscored band", () => {
    expect(affinityLabel("unscored", 0.7)).toBe(STRENGTH_LABELS.unscored);
    expect(affinityLabel("moderate", 0.78)).toBe("High affinity · 0.78");
  });

  it("gives the brief and its JSON export the same words as discovery", () => {
    const r = run(candidate(0.78));
    const selection = selectionFrom(r, "V1", new Date(0)) as VenueSelection;
    const s = { guest: EXAMPLE_GUEST, host: hypotheticalHostFor({ id: "V1", name: "Synthetic Venue V1", category: "bookstore" }) };
    const brief = buildBrief(s, evaluateScenario(s), r, { hypothetical: false, selection, now: new Date(0) });
    expect(brief.venue?.affinityLabel).toBe("High affinity · 0.78");
    expect(brief.cultural?.selectedVenue?.affinityLabel).toBe("High affinity · 0.78");
    const json = JSON.stringify(brief);
    expect(json).not.toMatch(/"moderate"/);
  });
});

describe("what-if brief as a counterproposal", () => {
  const stated = scenario({}, { eventFeePerHourUsd: 900 });
  const statedEval = evaluateScenario(stated);

  it("lists each edited value as a proposal the owning party must confirm, never as their statement", () => {
    const whatIf = { ...stated, host: { ...stated.host, eventFeePerHourUsd: 400 } };
    const brief = buildBrief(whatIf, evaluateScenario(whatIf), null, { hypothetical: true, selection: null, now: new Date(0), stated: { scenario: stated, evaluation: statedEval } });
    expect(brief.counterproposal?.changes).toEqual([{ party: "host", label: "Event fee per hour", from: "$900", to: "$400" }]);
    const fee = brief.inputs.find((i) => i.label === "Event fee per hour");
    expect(fee?.provenance).toBe("unknown");
    expect(fee?.proposedChange).toEqual({ from: "$900", confirmBy: "host" });
    // Values nobody touched keep the party's own provenance.
    expect(brief.inputs.find((i) => i.label === "Pop-up day rate")?.provenance).toBe("party_supplied");
    expect(brief.summary).toMatch(/If the proposed changes listed below are accepted/);
  });

  it("reports the status changes the edits cause, from the same rules", () => {
    const blocked = { guest: EXAMPLE_GUEST, host: EXAMPLE_HOST };
    const e = evaluateScenario(blocked);
    const reversal = e.reversals.find((r) => r.minimalChange?.verified);
    expect(reversal).toBeDefined();
    const whatIf = applyChanges(blocked, reversal?.minimalChange?.changes ?? []);
    const brief = buildBrief(whatIf, evaluateScenario(whatIf), null, { hypothetical: true, selection: null, now: new Date(0), stated: { scenario: blocked, evaluation: e } });
    expect(brief.counterproposal?.changes.length).toBeGreaterThan(0);
    expect(brief.counterproposal?.effects.some((x) => /no-go → (conditional|feasible)/.test(x))).toBe(true);
  });

  it("has no counterproposal when built from the stated terms", () => {
    const brief = buildBrief(stated, statedEval, null, { hypothetical: false, selection: null, now: new Date(0), stated: { scenario: stated, evaluation: statedEval } });
    expect(brief.counterproposal).toBeNull();
  });
});
