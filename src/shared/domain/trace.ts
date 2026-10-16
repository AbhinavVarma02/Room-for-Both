import type { Party } from "../schemas/common";
import type { ArrangementOption, ScenarioEvaluation, TraceEntry, TraceFlip } from "./types";

function reasonFor(before: ArrangementOption, after: ArrangementOption): string {
  if (after.status === "no_go") {
    const failed = after.constraints.find((c) => c.status === "fail");
    return failed ? `Now blocked: ${failed.explanation}` : "Now blocked.";
  }
  if (before.status === "no_go") {
    const resolved = before.constraints.filter(
      (c) => c.status === "fail" && after.constraints.find((a) => a.id === c.id)?.status !== "fail",
    );
    const resolvedText = resolved.map((c) => c.label.toLowerCase()).join(", ");
    return after.status === "feasible"
      ? `Resolved ${resolvedText}; every check now passes.`
      : `Resolved ${resolvedText}; still waiting on missing inputs.`;
  }
  if (after.status === "feasible") return "The last missing input arrived and every check passes.";
  const unknown = after.constraints.find((c) => c.status === "unknown");
  return unknown ? `Still open: ${unknown.explanation}` : "Status changed.";
}

/** Records which options changed status after a single input edit, and why. */
export function diffEvaluations(
  before: ScenarioEvaluation,
  after: ScenarioEvaluation,
  change: { party: Party; field: string; from: unknown; to: unknown },
  seq: number,
): TraceEntry {
  const flips: TraceFlip[] = [];
  for (const a of after.options) {
    const b = before.options.find((o) => o.id === a.id);
    if (b && b.status !== a.status) {
      flips.push({ optionId: a.id, label: a.label, before: b.status, after: a.status, reason: reasonFor(b, a) });
    }
  }
  return { seq, change, flips };
}
