import type { PartnershipCandidate, SensitivityResult } from "../schemas/evidence";

export type ReferenceEffect = "changes_top" | "changes_list" | "reorders" | "no_change" | "failed";

export interface ReferenceSensitivity {
  omitted: string;
  effect: ReferenceEffect;
  /** Where the original first choice lands without this reference, or null when it drops out of the list. */
  topRankWithout: number | null;
  newTop: string | null;
  entered: string[];
  left: string[];
  finding: string;
}

export interface SensitivitySummary {
  references: ReferenceSensitivity[];
  findings: string[];
}

const ids = (list: PartnershipCandidate[]) => list.map((c) => c.venue.id);

/**
 * Compares the original taste-informed list with each leave-one-out variant. Every statement is a
 * count or a position read off the two lists; nothing is weighted, scored, or extrapolated.
 */
export function compareSensitivity(original: PartnershipCandidate[], result: SensitivityResult): SensitivitySummary {
  const top = original[0];
  const before = ids(original);
  const references = result.variants.map((v): ReferenceSensitivity => {
    if (v.status === "failed" || !top) {
      return { omitted: v.omitted, effect: "failed", topRankWithout: null, newTop: null, entered: [], left: [], finding: "The search could not be repeated, so nothing is claimed." };
    }
    const after = ids(v.candidates);
    const entered = v.candidates.filter((c) => !before.includes(c.venue.id)).map((c) => c.venue.name);
    const left = original.filter((c) => !after.includes(c.venue.id)).map((c) => c.venue.name);
    const rank = after.indexOf(top.venue.id);
    const topRankWithout = rank >= 0 ? rank + 1 : null;
    const newTop = v.candidates[0]?.venue.name ?? null;
    const sameOrder = before.length === after.length && before.every((id, i) => after[i] === id);
    let effect: ReferenceEffect;
    let finding: string;
    if (v.candidates.length === 0) {
      effect = "changes_top";
      finding = "No venues came back, so the list depends on it entirely.";
    } else if (after[0] !== top.venue.id) {
      effect = "changes_top";
      finding = `${newTop} leads instead, and ${top.venue.name} ${topRankWithout ? `drops to #${topRankWithout}` : "leaves the list"}.`;
    } else if (entered.length > 0 || left.length > 0) {
      effect = "changes_list";
      finding = `${top.venue.name} still leads, but ${entered.length} venue${entered.length === 1 ? "" : "s"} enter${entered.length === 1 ? "s" : ""} the list and ${left.length} leave${left.length === 1 ? "s" : ""}.`;
    } else if (!sameOrder) {
      effect = "reorders";
      finding = `The same venues come back in a different order; ${top.venue.name} still leads.`;
    } else {
      effect = "no_change";
      finding = "The same venues in the same order.";
    }
    return { omitted: v.omitted, effect, topRankWithout, newTop, entered, left, finding };
  });

  const findings: string[] = [];
  const done = references.filter((r) => r.effect !== "failed");
  const decisive = done.filter((r) => r.effect === "changes_top").map((r) => `“${r.omitted}”`);
  const inert = done.filter((r) => r.effect === "no_change").map((r) => `“${r.omitted}”`);
  if (done.length === 0) findings.push("No variant could be repeated, so there is no sensitivity result.");
  else if (decisive.length === done.length) findings.push("Every reference changes which venue leads, so the first choice rests on all of them together.");
  else if (decisive.length > 0) findings.push(`The first choice depends on ${decisive.join(" and ")}: leaving ${decisive.length === 1 ? "it" : "either"} out changes which venue leads.`);
  else findings.push(`${top?.venue.name ?? "The first choice"} leads with any one reference left out, so it does not rest on a single reference.`);
  if (inert.length > 0) findings.push(`Leaving out ${inert.join(" or ")} changes nothing in this list.`);

  // Qloo's explainability names the reference that contributed most to the first choice; say so when
  // the removal test points elsewhere, because then the explanation alone would mislead.
  const strongest = top?.contributions.slice().sort((a, b) => b.score - a.score)[0];
  const strongestEffect = strongest && done.find((r) => r.omitted === strongest.seed);
  if (strongest && strongestEffect && strongestEffect.effect === "no_change" && decisive.length > 0) {
    findings.push(`Qloo's explanation credits “${strongest.seed}” most for ${top?.venue.name}, yet leaving it out changes nothing here while another reference does. Read the explanation as a contribution score, not a cause.`);
  }
  const [a, b] = original;
  const aScore = a?.venue.affinity ?? null;
  const bScore = b?.venue.affinity ?? null;
  if (a && b && aScore !== null && bScore !== null && Math.abs(aScore - bScore) < 0.02) {
    findings.push(`${a.venue.name} and ${b.venue.name} are within 0.02 affinity of each other, so treat the top two as tied.`);
  }
  return { references, findings };
}
