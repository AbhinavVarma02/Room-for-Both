import type { PartnershipCandidate } from "../schemas/evidence";

export interface ComparisonRow {
  id: string;
  name: string;
  tasteRank: number | null;
  baselineRank: number | null;
}

export type ComparisonOutcome = "different_venues" | "reordered" | "no_material_change" | "insufficient";

/**
 * Taste-informed discovery against category-only discovery for the same category and location. It
 * reports what each method returned and where the lists differ; it never claims one list is better,
 * because neither ranking is evidence of a good partnership.
 */
export interface DiscoveryComparison {
  rows: ComparisonRow[];
  tasteCount: number;
  baselineCount: number;
  baselineDepth: number;
  inBoth: number;
  onlyWithTaste: number;
  onlyCategory: number;
  sameTop: boolean;
  outcome: ComparisonOutcome;
  findings: string[];
  onlyWithSignals: string[];
}

export function compareDiscovery(taste: PartnershipCandidate[], baseline: PartnershipCandidate[], depth: number): DiscoveryComparison {
  const baseRank = new Map(baseline.map((c) => [c.venue.id, c.rank]));
  const tasteIds = new Set(taste.map((c) => c.venue.id));
  const rows: ComparisonRow[] = [
    ...taste.map((c) => ({ id: c.venue.id, name: c.venue.name, tasteRank: c.rank, baselineRank: baseRank.get(c.venue.id) ?? null })),
    ...baseline.filter((c) => !tasteIds.has(c.venue.id)).map((c) => ({ id: c.venue.id, name: c.venue.name, tasteRank: null, baselineRank: c.rank })),
  ];
  const inBoth = rows.filter((r) => r.tasteRank !== null && r.baselineRank !== null).length;
  const onlyWithTaste = rows.filter((r) => r.tasteRank !== null && r.baselineRank === null).length;
  const onlyCategory = rows.filter((r) => r.tasteRank === null).length;
  const top = taste[0];
  const sameTop = top !== undefined && baseline[0]?.venue.id === top.venue.id;
  // Compare the taste list with the category-only list cut to the same length.
  const head = baseline.slice(0, taste.length).map((c) => c.venue.id);
  const sameOrder = taste.length > 0 && taste.every((c, i) => head[i] === c.venue.id);

  const findings: string[] = [];
  let outcome: ComparisonOutcome;
  if (taste.length === 0 || baseline.length === 0) {
    outcome = "insufficient";
    findings.push(taste.length === 0 ? "The taste-informed search returned no venues, so there is nothing to compare." : "The category-only search returned no venues, so there is nothing to compare.");
  } else if (sameOrder) {
    outcome = "no_material_change";
    findings.push(
      `Both methods returned the same ${taste.length} venue${taste.length === 1 ? "" : "s"} in the same order. Here the cultural signal did not change which venues to approach; what it adds is the explanation and the theme below.`,
    );
  } else {
    const swapped = taste.filter((c) => !head.includes(c.venue.id)).length;
    outcome = swapped > 0 ? "different_venues" : "reordered";
    findings.push(
      swapped > 0
        ? `${swapped} of the ${taste.length} taste-ranked venues ${swapped === 1 ? "is" : "are"} not in the category-only top ${taste.length}.`
        : `The same ${taste.length} venues appear in both top ${taste.length} lists, in a different order.`,
    );
    if (top) {
      const r = baseRank.get(top.venue.id);
      findings.push(
        sameTop
          ? `Both methods put ${top.venue.name} first.`
          : r
            ? `The taste-ranked first choice, ${top.venue.name}, is #${r} in the category-only list.`
            : `The taste-ranked first choice, ${top.venue.name}, is not in the category-only top ${depth}.`,
      );
    }
    if (onlyWithTaste > 0) {
      findings.push(`${onlyWithTaste} taste-ranked venue${onlyWithTaste === 1 ? " does" : "s do"} not appear anywhere in the category-only top ${depth}.`);
    }
  }

  const explained = taste.filter((c) => c.contributions.length > 0).length;
  const scored = taste.filter((c) => c.venue.affinity !== null).length;
  const withTags = taste.filter((c) => c.sharedTags.length > 0).length;
  const onlyWithSignals = [
    `Affinity to the guest's references: ${scored} of ${taste.length} taste-ranked venues; none in the category-only list, which has no reference to score against.`,
    `Per-reference explanation ("most influenced by"): ${explained} of ${taste.length}; none without signals.`,
    `Taste tags shared with the cultural bridge: ${withTags} of ${taste.length}; the category-only search has no bridge to share them with.`,
    "A cultural theme for the collaboration needs at least one matched reference, so category-only discovery cannot suggest one.",
  ];

  return {
    rows,
    tasteCount: taste.length,
    baselineCount: baseline.length,
    baselineDepth: depth,
    inBoth,
    onlyWithTaste,
    onlyCategory,
    sameTop,
    outcome,
    findings,
    onlyWithSignals,
  };
}
