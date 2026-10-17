import { describe, expect, it } from "vitest";
import { checkLlmVenues, venueKey } from "../../src/shared/domain/llm-match";
import type { PartnershipCandidate } from "../../src/shared/schemas/evidence";

const prov = { kind: "qloo_observed" as const, request: "synthetic", retrievedAt: "2026-01-01T00:00:00.000Z" };
const c = (name: string, rank: number): PartnershipCandidate => ({
  venue: { id: name, name, type: "urn:entity:place", popularity: null, affinity: null, tags: [], address: null, location: null },
  category: "bookstore",
  rank,
  strength: "unscored",
  contributions: [],
  sharedTags: [],
  provenance: prov,
});
const llm = (names: string[]) => ({ model: "m", venues: names.map((name) => ({ name, reason: "r" })), discarded: 0, provenance: "llm_interpretation" as const, limitations: [] });

describe("language-model venue names against Qloo results", () => {
  it("ignores generic words and punctuation when comparing names", () => {
    expect(venueKey("The Synthetic Page Bookstore")).toBe(venueKey("Synthetic Page Books"));
  });

  it("reports where each named venue appears, and nothing more", () => {
    const out = checkLlmVenues(llm(["Synthetic Page Books", "Lantern Hall", "Nowhere Reading Room"]), [c("The Synthetic Page Bookstore", 2)], [c("Lantern Hall Books", 4)]);
    expect(out.map((o) => [o.tasteRank, o.categoryRank])).toEqual([
      [2, null],
      [null, 4],
      [null, null],
    ]);
  });

  it("does not treat a short shared word as the same venue", () => {
    expect(checkLlmVenues(llm(["Moss"]), [c("Moss and Margin Books", 1)], [])[0]?.tasteRank).toBeNull();
  });
});
