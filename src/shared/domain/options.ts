import type { Scenario } from "../schemas/profiles";
import { ARRANGEMENT_TEMPLATES, type ArrangementTemplate, optionId } from "./arrangements";
import { evaluateConstraints } from "./constraints";
import type { ArrangementOption, ConstraintResult, OptionStatus, TwoSidedStatus } from "./types";

export function statusOf(constraints: ConstraintResult[]): OptionStatus {
  if (constraints.some((c) => c.status === "fail")) return "no_go";
  if (constraints.some((c) => c.status === "unknown")) return "conditional";
  return "feasible";
}

export function buildOption(scenario: Scenario, t: ArrangementTemplate, variant: number): ArrangementOption {
  const { constraints, slot, metrics } = evaluateConstraints(scenario, t, variant);
  return {
    id: optionId(t.format, variant),
    format: t.format,
    variant,
    unit: t.unit,
    label: t.label(variant),
    status: statusOf(constraints),
    constraints,
    metrics,
    slot,
    assumptions: t.assumptions,
  };
}

/** Enumerates every template × duration variant. The set is small and fixed (nine options), so
 * evaluation stays well inside a Worker's CPU budget and is cheap enough to rerun on every edit. */
export function enumerateOptions(scenario: Scenario): ArrangementOption[] {
  return ARRANGEMENT_TEMPLATES.flatMap((t) => t.variants.map((v) => buildOption(scenario, t, v)));
}

export function twoSidedStatus(scenario: Scenario): { status: TwoSidedStatus; explanation: string } {
  switch (scenario.host.source) {
    case "host_response_link":
      return {
        status: "two_sided",
        explanation: "Host values were entered by the host through a private response link; guest values by the guest.",
      };
    case "fictional_example":
      return {
        status: "fictional_two_sided",
        explanation:
          scenario.guest.origin === "synthetic_demo"
            ? "Both profiles are fictional examples written to demonstrate the method. They describe no real business."
            : "The host profile is a fictional example. Replace it with the host's own inputs before relying on the result.",
      };
    case "hypothetical_scenario":
      return {
        status: "hypothetical_host",
        explanation: `${scenario.host.venueName} is a venue suggested by cultural research, but every host term here is a fictional placeholder for exploration. The venue has not seen, stated, or agreed to any of them.`,
      };
    case "entered_by_guest":
      return {
        status: "one_sided",
        explanation: "Host values were typed in by the guest and have not been confirmed by the host.",
      };
  }
}
