import type { LlmBaselineResult, PartnershipCandidate } from "../schemas/evidence";

export interface LlmVenueCheck {
  name: string;
  reason: string;
  /** Rank in the taste-informed Qloo list, when the same venue name appears there. */
  tasteRank: number | null;
  /** Rank in the category-only Qloo list, when the same venue name appears there. */
  categoryRank: number | null;
}

// Generic words differ between sources ("Books Are Magic" against "Books Are Magic Bookstore"), so
// names are compared without them. A match by name is a hint, not proof that it is the same place.
const GENERIC = /\b(the|and|books?|bookstores?|bookshops?|cafes?|coffee|records?|shops?|stores?|gallery|studio|bar)\b/g;
export function venueKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(fictional\)/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(GENERIC, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameVenue(a: string, b: string): boolean {
  const x = venueKey(a);
  const y = venueKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 5 && long.startsWith(short);
}

/** Compares a model's venue names with the Qloo lists on the page. It never calls any service. */
export function checkLlmVenues(llm: LlmBaselineResult, taste: PartnershipCandidate[], category: PartnershipCandidate[]): LlmVenueCheck[] {
  return llm.venues.map((v) => ({
    name: v.name,
    reason: v.reason,
    tasteRank: taste.find((c) => sameVenue(c.venue.name, v.name))?.rank ?? null,
    categoryRank: category.find((c) => sameVenue(c.venue.name, v.name))?.rank ?? null,
  }));
}
