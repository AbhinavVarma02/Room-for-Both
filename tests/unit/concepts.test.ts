import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../../src/shared/domain";
import { type ConceptInput, mostPromising, proposalConcepts } from "../../src/shared/domain/concepts";
import { EXAMPLE_GUEST, EXAMPLE_HOST } from "../../src/shared/fixtures/example-scenario";
import type { CulturalTheme, ThemeItem, VenueBridge } from "../../src/shared/schemas/evidence";
import { scenario } from "../fixtures/builders";

const prov = { kind: "qloo_observed" as const, endpoint: "/v2/insights", request: "synthetic request", retrievedAt: "2026-01-01T00:00:00.000Z" };
const item = (id: string, tags: string[] = []): ThemeItem => ({ id, name: `Title ${id}`, type: "urn:entity:book", affinity: 0.8, strength: "moderate", tags });

const cross: CulturalTheme = {
  id: "cross-domain",
  title: "Co-curated reading list",
  basis: "cross_domain",
  rationale: "synthetic",
  items: [item("B1", ["Nature Writing"]), item("B2", ["Essays"]), item("B3"), item("B4")],
  provenance: prov,
  interpretation: "derived_rule",
};
const tags: CulturalTheme = { ...cross, id: "taste-tags", title: "Shared tastes", basis: "taste_tags", items: [item("T1"), item("T2")] };
const venueSide: VenueBridge = {
  mode: "live",
  venueId: "V1",
  venueName: "Synthetic Venue",
  domain: "urn:entity:book",
  title: "Co-curated reading list",
  noun: "books",
  items: [item("B2"), item("V7", ["Nature Writing"]), item("V8")],
  provenance: prov,
  callsUsed: 1,
  limitations: [],
};

function input(overrides: Partial<ConceptInput> = {}): ConceptInput {
  return {
    guestName: "Test Guest Co",
    guestProducts: ["skincare"],
    host: { venueName: "Synthetic Venue", source: "host_response_link", programmingInterests: null },
    themes: [cross, tags],
    bridgeDomain: "urn:entity:book",
    venueBridge: venueSide,
    signals: ["Reference A"],
    evidenceMode: "live",
    ...overrides,
  };
}

describe("proposal concepts", () => {
  const s = scenario();
  const e = evaluateScenario(s);

  it("builds each idea from a different slice of evidence, never the same items renamed", () => {
    const concepts = proposalConcepts(input(), e);
    expect(concepts.map((c) => c.basis)).toEqual(["shared", "venue_side", "guest_side", "taste_tags"]);
    const byBasis = Object.fromEntries(concepts.map((c) => [c.basis, c.items]));
    expect(byBasis.shared).toEqual(["Title B2"]);
    expect(byBasis.venue_side).toEqual(["Title V7", "Title V8"]);
    expect(byBasis.guest_side).toEqual(["Title B1", "Title B3", "Title B4"]);
    expect(byBasis.taste_tags).toEqual(["Nature Writing"]);
    expect(new Set(concepts.map((c) => c.title)).size).toBe(concepts.length);
  });

  it("offers no two-sided idea without the venue's own evidence", () => {
    const concepts = proposalConcepts(input({ venueBridge: null }), e);
    expect(concepts.map((c) => c.basis)).toEqual(["guest_side", "taste_tags"]);
    expect(concepts[0]?.mightNotSuit.join(" ")).toMatch(/venue's own side was not looked up/);
  });

  it("takes every status from the rules engine, and the evidence never changes the evaluation", () => {
    const concepts = proposalConcepts(input(), e);
    for (const c of concepts) {
      for (const f of c.formats) expect(e.options.find((o) => o.id === f.optionId)?.status).toBe(f.status);
    }
    expect(evaluateScenario(s)).toEqual(e);
  });

  it("marks the first idea with a workable format, and says when every suited format is blocked", () => {
    const blocked = { guest: EXAMPLE_GUEST, host: EXAMPLE_HOST };
    const be = evaluateScenario(blocked);
    const concepts = proposalConcepts(input({ host: { venueName: "Synthetic Venue", source: "fictional_example", programmingInterests: null } }), be);
    const promising = mostPromising(concepts);
    expect(promising?.lead?.status).not.toBe("no_go");
    const guestSide = concepts.find((c) => c.basis === "guest_side");
    // The example's event and pop-up are blocked by schedule, so the guest-side idea is blocked today.
    expect(guestSide?.lead?.status).toBe("no_go");
    expect(guestSide?.mightNotSuit.join(" ")).toMatch(/Every format this idea suits is no-go/);
  });

  it("falls back to the venue's own words, labelled as the venue's", () => {
    const concepts = proposalConcepts(input({ themes: [], venueBridge: null, host: { venueName: "Synthetic Venue", source: "host_response_link", programmingInterests: "poetry nights" } }), e);
    expect(concepts).toHaveLength(1);
    expect(concepts[0]?.basis).toBe("host_interests");
    expect(concepts[0]?.sources).toContain("party_supplied");
    expect(concepts[0]?.mightNotSuit.join(" ")).toMatch(/venue's words alone/);
  });

  it("labels fictional evidence and never claims outcomes", () => {
    const concepts = proposalConcepts(input({ evidenceMode: "fixture" }), e);
    for (const c of concepts) {
      expect(c.sources).toContain("synthetic_demo");
      expect(c.mightNotSuit.join(" ")).toMatch(/fictional demonstration data/);
      expect(`${c.pitch} ${c.observed.join(" ")}`).not.toMatch(/revenue|sales will|guarantee|will attract/i);
    }
  });
});
