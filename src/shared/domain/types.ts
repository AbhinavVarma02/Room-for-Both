import type { Day, Format } from "../constants/vocabulary";
import type { Party, ProvenanceKind } from "../schemas/common";
import type { GuestField, HostField } from "../schemas/profiles";

export const ENGINE_VERSION = "1.0.0";

export type ConstraintId =
  | "guest_format"
  | "host_format"
  | "budget"
  | "minimum_term"
  | "schedule"
  | "space"
  | "host_staffing"
  | "guest_staffing"
  | "category_exclusion"
  | "sampling"
  | "dealbreaker_alcohol"
  | "dealbreaker_exclusivity";

export type ConstraintStatus = "pass" | "fail" | "unknown" | "not_applicable";

export type OptionStatus = "feasible" | "conditional" | "no_go";

export type ProfileField = GuestField | HostField | "productCategories";

export interface FieldRef {
  party: Party;
  field: ProfileField;
}

export interface InputUse extends FieldRef {
  value: unknown;
  provenance: ProvenanceKind;
}

export interface ConstraintResult {
  id: ConstraintId;
  label: string;
  status: ConstraintStatus;
  /** Deterministic, human-readable reason built only from the inputs listed below. */
  explanation: string;
  inputs: InputUse[];
  /** Inputs whose absence made the result `unknown`. */
  missing: FieldRef[];
  /** For `unknown` results: what a missing value would need to be for this check to pass. */
  requirement?: Requirement;
}

export interface Requirement extends FieldRef {
  comparator: "at_most" | "at_least" | "equals" | "includes" | "excludes" | "covers";
  value: unknown;
  text: string;
}

export interface Slot {
  day: Day;
  start: number;
  end: number;
}

export interface OptionMetrics {
  hostFeeUsd: number | null;
  guestOutlayUsd: number | null;
  guestStaffHours: number;
  hostStaffHours: number;
  customerFacingHours: number;
}

export interface ArrangementOption {
  id: string;
  format: Format;
  variant: number;
  unit: "hours" | "weeks";
  label: string;
  status: OptionStatus;
  constraints: ConstraintResult[];
  metrics: OptionMetrics;
  slot: Slot | null;
  assumptions: string[];
}

export type ChangeKind =
  | "set_number"
  | "add_window"
  | "extend_window"
  | "add_format"
  | "remove_category"
  | "set_boolean"
  | "remove_dealbreaker";

export interface Change {
  party: Party;
  field: GuestField | HostField;
  kind: ChangeKind;
  from: unknown;
  to: unknown;
  /** Normalised size of the change used only for ranking: relative change for numbers, 1 for categorical. */
  cost: number;
  negotiable: boolean;
  description: string;
}

export interface OptionReversal {
  optionId: string;
  statusBefore: OptionStatus;
  blockingConstraints: ConstraintId[];
  candidates: { constraint: ConstraintId; changes: Change[] }[];
  minimalChange: {
    changes: Change[];
    statusAfter: OptionStatus;
    verified: boolean;
  } | null;
  nonNegotiableBlockers: ConstraintId[];
}

export interface Question extends FieldRef {
  text: string;
  detail: string;
  /** Options for which this is the only missing input. */
  decisiveFor: string[];
  /** Options whose outcome depends on this input. */
  involvedIn: string[];
}

export type FrontierMethod = "non_dominated_on_stated_priorities" | "no_priorities_stated";

export interface FrontierSummary {
  method: FrontierMethod;
  criteria: { guest: string[]; host: string[] };
  nonDominatedIds: string[];
  note: string;
}

export type TwoSidedStatus = "two_sided" | "fictional_two_sided" | "hypothetical_host" | "one_sided";

export interface ScenarioEvaluation {
  engineVersion: string;
  twoSided: { status: TwoSidedStatus; explanation: string };
  options: ArrangementOption[];
  frontier: FrontierSummary;
  reversals: OptionReversal[];
  questions: Question[];
  counts: Record<OptionStatus, number>;
}

export interface TraceFlip {
  optionId: string;
  label: string;
  before: OptionStatus;
  after: OptionStatus;
  reason: string;
}

export interface TraceEntry {
  seq: number;
  change: { party: Party; field: string; from: unknown; to: unknown };
  flips: TraceFlip[];
}
