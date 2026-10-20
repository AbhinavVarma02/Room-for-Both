import type { ArrangementOption, ConstraintId, ScenarioEvaluation } from "./types";

export interface BlockerSummary {
  id: ConstraintId;
  label: string;
  /** How many no-go options this check blocks. */
  count: number;
  /** One option's own explanation, so the reason is concrete. */
  example: string;
}

/** The checks that block the most no-go options, most common first. */
export function blockerSummary(e: ScenarioEvaluation, limit = 2): BlockerSummary[] {
  const by = new Map<ConstraintId, BlockerSummary>();
  for (const o of e.options.filter((x) => x.status === "no_go")) {
    for (const c of o.constraints.filter((x) => x.status === "fail")) {
      const prev = by.get(c.id);
      by.set(c.id, prev ? { ...prev, count: prev.count + 1 } : { id: c.id, label: c.label, count: 1, example: c.explanation });
    }
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

/**
 * The blocked option with the cheapest verified change, which the engine already ranks first. We prefer
 * one whose format has nothing feasible or conditional yet: unblocking a variant of a format that already
 * works only lands where that format already is, so it opens no new ground.
 */
export function closestToWorking(e: ScenarioEvaluation): { option: ArrangementOption; changes: string[]; statusAfter: string } | null {
  const open = new Set(e.options.filter((o) => o.status !== "no_go").map((o) => o.format));
  const verified = e.reversals.flatMap((r) => {
    const option = e.options.find((o) => o.id === r.optionId);
    return option && r.minimalChange?.verified ? [{ option, minimal: r.minimalChange }] : [];
  });
  const pick = verified.find((v) => !open.has(v.option.format)) ?? verified[0];
  return pick ? { option: pick.option, changes: pick.minimal.changes.map((c) => c.description), statusAfter: pick.minimal.statusAfter } : null;
}
