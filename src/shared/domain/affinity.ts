import type { Strength } from "../schemas/evidence";

/**
 * Qloo's documented interpretation: above 0.8 is very high, 0.6–0.8 high, around 0.5 medium,
 * below that low, and scores are relative to the query that produced them. We fold medium and low
 * into one "lower" band because the distinction around 0.5 is not documented precisely.
 */
export function strengthOf(affinity: number | null): Strength {
  if (affinity === null) return "unscored";
  if (affinity > 0.8) return "strong";
  if (affinity >= 0.6) return "moderate";
  return "weak";
}

/** The one wording for each band, shared by discovery, the brief, and the JSON export. */
export const STRENGTH_LABELS: Record<Strength, string> = {
  strong: "Very high affinity",
  moderate: "High affinity",
  weak: "Lower affinity",
  unscored: "No affinity score",
};

export function affinityText(affinity: number | null): string {
  return affinity === null ? "" : affinity.toFixed(2);
}

/** "High affinity · 0.78", or the band alone when the venue carries no score to show. */
export function affinityLabel(strength: Strength, affinity: number | null): string {
  const label = STRENGTH_LABELS[strength];
  return affinity === null || strength === "unscored" ? label : `${label} · ${affinityText(affinity)}`;
}

/** Qloo's per-reference explainability, for example "Aesop (0.62), Patagonia (0.41)". */
export function influenceText(contributions: { seed: string; score: number }[]): string[] {
  return contributions.map((x) => `${x.seed} (${x.score.toFixed(2)})`);
}
