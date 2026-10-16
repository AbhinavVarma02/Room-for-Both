import type { Scenario } from "../schemas/profiles";
import { computeFrontier, rankOptions } from "./frontier";
import { enumerateOptions, twoSidedStatus } from "./options";
import { rankQuestions } from "./questions";
import { reverseAll } from "./reversal";
import { ENGINE_VERSION, type OptionStatus, type ScenarioEvaluation } from "./types";

/**
 * Runs the full deterministic pipeline. The same function powers the browser's instant
 * what-if edits and the Worker's `/api/evaluate`, so a given scenario always produces the
 * same options, explanations, and suggested changes wherever it runs.
 */
export function evaluateScenario(scenario: Scenario): ScenarioEvaluation {
  const options = enumerateOptions(scenario);
  const frontier = computeFrontier(options, scenario.guest, scenario.host);
  const ranked = rankOptions(options, frontier);
  const counts: Record<OptionStatus, number> = { feasible: 0, conditional: 0, no_go: 0 };
  for (const o of ranked) counts[o.status] += 1;
  return {
    engineVersion: ENGINE_VERSION,
    twoSided: twoSidedStatus(scenario),
    options: ranked,
    frontier,
    reversals: reverseAll(scenario, ranked),
    questions: rankQuestions(ranked),
    counts,
  };
}

export * from "./types";
export { ARRANGEMENT_TEMPLATES, templateFor } from "./arrangements";
export { applyChanges, reverseOption } from "./reversal";
export { diffEvaluations } from "./trace";
export { dominates } from "./frontier";
