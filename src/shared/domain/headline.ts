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
 * The arrangement a first conversation would usually start from: a co-hosted event, the format a
 * cultural theme suits best, choosing the length that fails the fewest checks. Used only to explain
 * results, never to rank them.
 */
export function featuredOption(e: ScenarioEvaluation): ArrangementOption | null {
  const fails = (o: ArrangementOption) => o.constraints.filter((c) => c.status === "fail").length;
  const events = e.options.filter((o) => o.format === "cohosted_event").sort((a, b) => fails(a) - fails(b) || a.variant - b.variant);
  return events.find((o) => o.status === "no_go") ?? events[0] ?? e.options[0] ?? null;
}

/** The blocked option with the cheapest verified change, which the engine already ranks first. */
export function closestToWorking(e: ScenarioEvaluation): { option: ArrangementOption; changes: string[]; statusAfter: string } | null {
  for (const r of e.reversals) {
    const option = e.options.find((o) => o.id === r.optionId);
    if (option && r.minimalChange?.verified) return { option, changes: r.minimalChange.changes.map((c) => c.description), statusAfter: r.minimalChange.statusAfter };
  }
  return null;
}
