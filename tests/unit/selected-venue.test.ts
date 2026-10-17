import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../../src/shared/domain";
import { activationConcept } from "../../src/shared/domain/activation";
import { compareBridge } from "../../src/shared/domain/bridge";
import { buildBrief, linkedSelection } from "../../src/shared/domain/brief";
import { compareDiscovery } from "../../src/shared/domain/comparison";
import { hostProvenance } from "../../src/shared/domain/provenance";
import { selectionFrom } from "../../src/shared/domain/selection";
import { EXAMPLE_GUEST, EXAMPLE_HOST } from "../../src/shared/fixtures/example-scenario";
import { hypotheticalHostFor, unknownHostFor } from "../../src/shared/fixtures/hypothetical";
import type { CulturalTheme, PartnershipCandidate, ResearchRun, ThemeItem, VenueBridge } from "../../src/shared/schemas/evidence";
import type { VenueSelection } from "../../src/shared/schemas/selection";
import { reducer, type WorkspaceState } from "../../src/client/app/workspace-state";
import { guest, scenario } from "../fixtures/builders";

const prov = { kind: "qloo_observed" as const, endpoint: "/v2/insights", request: "synthetic request", retrievedAt: "2026-01-01T00:00:00.000Z" };

function candidate(id: string, rank: number, opts: Partial<PartnershipCandidate> = {}): PartnershipCandidate {
  return {
    venue: { id, name: `Synthetic Venue ${id}`, type: "urn:entity:place", popularity: 0.5, affinity: 0.9 - rank / 100, tags: [], address: null, location: null },
    category: "bookstore",
    rank,
    strength: "strong",
    contributions: [{ seed: "Reference A", score: 0.6 }],
    sharedTags: [],
    provenance: prov,
    ...opts,
  };
}

const item = (id: string, tags: string[] = []): ThemeItem => ({ id, name: `Title ${id}`, type: "urn:entity:book", affinity: 0.8, strength: "moderate", tags });

const guestTheme: CulturalTheme = {
  id: "cross-domain",
  title: "Co-curated reading list",
  basis: "cross_domain",
  rationale: "synthetic",
  items: [item("B1", ["Nature Writing"]), item("B2", ["Essays"]), item("B3", ["Memoir"])],
  provenance: prov,
  interpretation: "derived_rule",
};

function venueBridge(items: ThemeItem[], domain = "urn:entity:book"): VenueBridge {
  return { mode: "live", venueId: "V1", venueName: "Synthetic Venue V1", domain, title: "Co-curated reading list", noun: "books", items, provenance: prov, callsUsed: 1, limitations: [] };
}

function run(candidates: PartnershipCandidate[], runId = "run-1"): ResearchRun {
  return {
    runId,
    mode: "live",
    request: { seeds: [{ label: "Reference A", kind: "brand" }], city: "Testville", venueCategory: "bookstore", guestCategories: ["skincare"], maxCandidates: 5 },
    steps: [],
    seeds: [{ input: { label: "Reference A", kind: "brand" }, status: "exact", entity: { id: "E1", name: "Reference A", type: "urn:entity:brand" }, alternatives: [], provenance: prov }],
    categoryTag: { id: "urn:tag:category:place:bookstore", name: "Bookstore", status: "exact", provenance: prov },
    candidates,
    themes: [guestTheme],
    limitations: [],
    callsUsed: 4,
    callBudget: 7,
    durationMs: 10,
    venueSearch: { location: "Testville", categoryTagId: "urn:tag:category:place:bookstore", categoryName: "Bookstore", take: 5 },
    bridgeDomain: "urn:entity:book",
  };
}

describe("category-only comparison", () => {
  it("reports no material change when both methods return the same venues in the same order", () => {
    const taste = [candidate("A", 1), candidate("B", 2)];
    const cmp = compareDiscovery(taste, [candidate("A", 1), candidate("B", 2), candidate("C", 3)], 10);
    expect(cmp.outcome).toBe("no_material_change");
    expect(cmp.findings[0]).toMatch(/did not change which venues/);
  });

  it("reports a reorder without inventing new venues", () => {
    const cmp = compareDiscovery([candidate("A", 1), candidate("B", 2)], [candidate("B", 1), candidate("A", 2)], 10);
    expect(cmp.outcome).toBe("reordered");
    expect(cmp.findings).toContain("The taste-ranked first choice, Synthetic Venue A, is #2 in the category-only list.");
  });

  it("reports venues that only the taste signal surfaced", () => {
    const cmp = compareDiscovery([candidate("A", 1), candidate("X", 2)], [candidate("B", 1), candidate("A", 2)], 10);
    expect(cmp.outcome).toBe("different_venues");
    expect(cmp.onlyWithTaste).toBe(1);
    expect(cmp.rows.find((r) => r.id === "X")?.baselineRank).toBeNull();
    expect(cmp.onlyCategory).toBe(1);
  });

  it("refuses to compare when a side is empty", () => {
    expect(compareDiscovery([], [candidate("A", 1)], 10).outcome).toBe("insufficient");
  });
});

describe("two-sided bridge", () => {
  it("matches items by entity ID and tags by name, never combining scores", () => {
    const b = compareBridge(guestTheme, venueBridge([item("B2", ["Essays"]), item("V9", ["Nature Writing"])]), "urn:entity:book");
    expect(b?.comparable).toBe(true);
    expect(b?.shared.map((s) => s.id)).toEqual(["B2"]);
    expect(b?.sharedTags).toEqual(["Essays", "Nature Writing"]);
    expect(b?.venueOnly.map((i) => i.id)).toEqual(["V9"]);
    expect(JSON.stringify(b)).not.toMatch(/%/);
  });

  it("does not match across different kinds of results", () => {
    const b = compareBridge(guestTheme, venueBridge([item("B2")], "urn:entity:artist"), "urn:entity:book");
    expect(b?.comparable).toBe(false);
    expect(b?.shared).toEqual([]);
  });
});

describe("activation concept", () => {
  const base = {
    format: "cohosted_event" as const,
    guestName: "Test Guest Co",
    guestProducts: ["skincare" as const],
    host: { venueName: "Synthetic Venue V1", source: "hypothetical_scenario" as const },
    themes: [guestTheme],
    bridgeDomain: "urn:entity:book",
    signals: ["Reference A"],
    evidenceMode: "live" as const,
  };

  it("prefers items found on both sides and says what remains unverified", () => {
    const a = activationConcept({ ...base, venueBridge: venueBridge([item("B3"), item("B1")]) });
    expect(a?.basis).toBe("shared");
    expect(a?.items).toEqual(["Title B1", "Title B3"]);
    expect(a?.title).toBe("Reading-list evening");
    expect(a?.unverified.join(" ")).toMatch(/hypothetical/);
    expect(a?.unverified.join(" ")).toMatch(/wants to host this theme/);
    expect(a?.sources).toEqual(["qloo_observed", "derived_rule"]);
  });

  it("falls back to the guest side when the venue's list shares nothing", () => {
    const a = activationConcept({ ...base, venueBridge: venueBridge([item("V8")]) });
    expect(a?.basis).toBe("guest");
    expect(a?.why.join(" ")).toMatch(/guest's side only/);
  });

  it("uses the venue's own stated interests when no research is available", () => {
    const a = activationConcept({ ...base, themes: [], venueBridge: null, host: { venueName: "Synthetic Venue V1", source: "host_response_link", programmingInterests: "poetry nights" } });
    expect(a?.basis).toBe("host_interests");
    expect(a?.sources).toEqual(["party_supplied", "derived_rule"]);
  });

  it("is never offered without any cultural input", () => {
    expect(activationConcept({ ...base, themes: [], venueBridge: null })).toBeNull();
  });

  it("does not claim outcomes", () => {
    const a = activationConcept({ ...base, venueBridge: venueBridge([item("B1")]) });
    const text = [a?.pitch, ...(a?.why ?? []), ...(a?.unverified ?? [])].join(" ");
    expect(text).not.toMatch(/\b(will|would) (increase|boost|grow|attract)\b|guarantee|\d+\s?%/i);
  });
});

describe("hypothetical host terms", () => {
  const venue = { id: "V1", name: "Synthetic Venue V1", category: "bookstore" as const };

  it("copies only the example's terms, never its notes or goals, and labels them fictional", () => {
    const h = hypotheticalHostFor(venue);
    expect(h.source).toBe("hypothetical_scenario");
    expect(h.eventFeePerHourUsd).toBe(EXAMPLE_HOST.eventFeePerHourUsd);
    expect(h.goals).toEqual([]);
    expect(h.notes).toMatch(/Not stated by the venue/);
    expect(h.programmingInterests).toBeUndefined();
    expect(hostProvenance(h, h.eventFeePerHourUsd)).toBe("synthetic_demo");
  });

  it("starts a newly chosen venue with every term unknown", () => {
    const h = unknownHostFor(venue);
    const e = evaluateScenario({ guest: guest(), host: h });
    expect(e.counts.feasible).toBe(0);
    expect(hostProvenance(h, h.popupFeePerDayUsd)).toBe("unknown");
  });

  it("is reported as hypothetical, not two-sided", () => {
    const e = evaluateScenario({ guest: EXAMPLE_GUEST, host: hypotheticalHostFor(venue) });
    expect(e.twoSided.status).toBe("hypothetical_host");
    expect(e.twoSided.explanation).toMatch(/has not seen, stated, or agreed/);
  });

  it("gives the same decisions as the fictional example host, because only the name differs", () => {
    const a = evaluateScenario({ guest: EXAMPLE_GUEST, host: EXAMPLE_HOST });
    const b = evaluateScenario({ guest: EXAMPLE_GUEST, host: { ...hypotheticalHostFor(venue), goals: EXAMPLE_HOST.goals } });
    expect(b.options.map((o) => [o.id, o.status])).toEqual(a.options.map((o) => [o.id, o.status]));
  });
});

describe("selected venue in the brief", () => {
  const r = run([candidate("V1", 1), candidate("V2", 2)]);
  const selection: VenueSelection = { ...(selectionFrom(r, "V1", new Date(0)) as VenueSelection), venueBridge: venueBridge([item("B2")]) };
  const venue = { id: "V1", name: "Synthetic Venue V1", category: "bookstore" as const };

  it("carries the venue, its evidence, the bridge, and a hypothetical disclaimer", () => {
    const s = { guest: EXAMPLE_GUEST, host: hypotheticalHostFor(venue) };
    const brief = buildBrief(s, evaluateScenario(s), r, { hypothetical: false, selection, now: new Date(0) });
    expect(brief.title).toBe("Fernleaf Botanics (fictional) × Synthetic Venue V1 (hypothetical terms)");
    expect(brief.venue?.qlooEntityId).toBe("V1");
    expect(brief.venue?.retrievedAt).toBe(prov.retrievedAt);
    expect(brief.hostTerms.disclaimer).toMatch(/has not seen, stated, or agreed/);
    expect(brief.bridge?.shared).toEqual(["Title B2"]);
    expect(brief.activation?.items).toEqual(["Title B2"]);
    expect(brief.fictional).toBe(true);
  });

  it("drops the venue's evidence when the host no longer refers to that venue", () => {
    const s = scenario({}, { venueName: "Another Venue" });
    expect(linkedSelection(s.host, selection)).toBeNull();
    const brief = buildBrief(s, evaluateScenario(s), r, { hypothetical: false, selection, now: new Date(0) });
    expect(brief.venue).toBeNull();
  });

  it("keeps decisions identical with or without the selection", () => {
    const s = { guest: EXAMPLE_GUEST, host: hypotheticalHostFor(venue) };
    const e = evaluateScenario(s);
    const plain = buildBrief(s, e, null, { hypothetical: false, selection: null, now: new Date(0) });
    const withVenue = buildBrief(s, e, r, { hypothetical: false, selection, now: new Date(0) });
    expect(withVenue.options).toEqual(plain.options);
    expect(withVenue.proposal).toEqual(plain.proposal);
  });
});

describe("workspace selection state", () => {
  const empty: WorkspaceState = { guest: EXAMPLE_GUEST, host: EXAMPLE_HOST, research: null, selection: null, baseline: null, hostLink: null, whatIf: null, trace: [], isExample: true, guided: false };
  const r1 = run([candidate("V1", 1), candidate("V2", 2)]);

  it("selecting a venue resets terms that belonged to the fictional host", () => {
    const s = reducer({ ...empty, research: r1 }, { type: "select_venue", selection: selectionFrom(r1, "V1") as VenueSelection });
    expect(s.host?.venueName).toBe("Synthetic Venue V1");
    expect(s.host?.qlooEntityId).toBe("V1");
    expect(s.host?.eventFeePerHourUsd).toBeNull();
  });

  it("selecting another venue updates every dependant and keeps hypothetical terms hypothetical", () => {
    let s = reducer({ ...empty, research: r1 }, { type: "select_venue", selection: selectionFrom(r1, "V1") as VenueSelection, hypothetical: true });
    s = reducer(s, { type: "set_venue_bridge", venueId: "V1", bridge: venueBridge([item("B1")]) });
    s = reducer(s, { type: "push_trace", entry: { seq: 1, change: { party: "host", field: "x", from: 1, to: 2 }, flips: [] } });
    s = reducer(s, { type: "select_venue", selection: selectionFrom(r1, "V2") as VenueSelection });
    expect(s.selection?.candidate.venue.id).toBe("V2");
    expect(s.selection?.venueBridge).toBeNull();
    expect(s.host?.source).toBe("hypothetical_scenario");
    expect(s.host?.venueName).toBe("Synthetic Venue V2");
    expect(s.trace).toEqual([]);
  });

  it("ignores a late venue-side answer for a venue that is no longer selected", () => {
    let s = reducer({ ...empty, research: r1 }, { type: "select_venue", selection: selectionFrom(r1, "V2") as VenueSelection });
    s = reducer(s, { type: "set_venue_bridge", venueId: "V1", bridge: venueBridge([item("B1")]) });
    expect(s.selection?.venueBridge).toBeNull();
  });

  it("a new research run keeps the frozen selection and clears the old comparison", () => {
    let s = reducer({ ...empty, research: r1 }, { type: "select_venue", selection: selectionFrom(r1, "V1") as VenueSelection });
    s = reducer(s, { type: "set_baseline", runId: "run-1", baseline: { mode: "live", request: { categoryTagId: "urn:tag:x", categoryName: "Bookstore", location: "Testville", venueCategory: "bookstore" }, candidates: [], depth: 10, provenance: prov, callsUsed: 1, limitations: [] } });
    expect(s.selection?.baseline).not.toBeNull();
    s = reducer(s, { type: "set_research", research: run([candidate("V9", 1)], "run-2") });
    expect(s.baseline).toBeNull();
    expect(s.selection?.runId).toBe("run-1");
    expect(s.selection?.candidate.venue.id).toBe("V1");
  });
});
