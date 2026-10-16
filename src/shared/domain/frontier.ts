import { CRITERION_LABELS, type GuestCriterion, type HostCriterion } from "../constants/vocabulary";
import type { GuestProfile, HostProfile } from "../schemas/profiles";
import type { ArrangementOption, FrontierSummary, OptionMetrics, OptionStatus } from "./types";

type Criterion = GuestCriterion | HostCriterion;

const CRITERIA: Record<Criterion, { metric: keyof OptionMetrics; better: "lower" | "higher" }> = {
  lower_outlay: { metric: "guestOutlayUsd", better: "lower" },
  fewer_guest_staff_hours: { metric: "guestStaffHours", better: "lower" },
  more_customer_facing_hours: { metric: "customerFacingHours", better: "higher" },
  higher_fee: { metric: "hostFeeUsd", better: "higher" },
  fewer_host_staff_hours: { metric: "hostStaffHours", better: "lower" },
};

/** +1 if a is better than b on the criterion, -1 if worse, 0 if equal, null if either value is unknown. */
function compare(a: ArrangementOption, b: ArrangementOption, c: Criterion): number | null {
  const { metric, better } = CRITERIA[c];
  const va = a.metrics[metric];
  const vb = b.metrics[metric];
  if (va === null || vb === null) return null;
  if (va === vb) return 0;
  const aBetter = better === "lower" ? va < vb : va > vb;
  return aBetter ? 1 : -1;
}

/**
 * Pareto-style dominance over the criteria the parties themselves ranked. We only compare
 * ordinal "better or worse" per criterion; nothing here weighs one party's gain against the
 * other's, so we never claim economic optimality. Unknown metrics make a pair incomparable.
 */
export function dominates(a: ArrangementOption, b: ArrangementOption, criteria: Criterion[]): boolean {
  let strictlyBetter = false;
  for (const c of criteria) {
    const r = compare(a, b, c);
    if (r === null || r < 0) return false;
    if (r > 0) strictlyBetter = true;
  }
  return strictlyBetter;
}

export function computeFrontier(options: ArrangementOption[], guest: GuestProfile, host: HostProfile): FrontierSummary {
  const criteria: Criterion[] = [...new Set<Criterion>([...guest.priorities, ...host.priorities])];
  const viable = options.filter((o) => o.status !== "no_go");
  const labels = {
    guest: guest.priorities.map((c) => CRITERION_LABELS[c]),
    host: host.priorities.map((c) => CRITERION_LABELS[c]),
  };
  if (criteria.length === 0) {
    return {
      method: "no_priorities_stated",
      criteria: labels,
      nonDominatedIds: viable.map((o) => o.id),
      note: "Neither party ranked priorities, so viable options are listed without comparing trade-offs.",
    };
  }
  const nonDominated = viable.filter((o) => !viable.some((other) => other.id !== o.id && dominates(other, o, criteria)));
  const who =
    guest.priorities.length > 0 && host.priorities.length > 0
      ? "both parties'"
      : guest.priorities.length > 0
        ? "the guest's"
        : "the host's";
  return {
    method: "non_dominated_on_stated_priorities",
    criteria: labels,
    nonDominatedIds: nonDominated.map((o) => o.id),
    note: `Highlighted options are not beaten on every one of ${who} stated priorities by another viable option. This compares rankings only; it does not weigh one party's gain against the other's.`,
  };
}

const STATUS_RANK: Record<OptionStatus, number> = { feasible: 0, conditional: 1, no_go: 2 };

export function rankOptions(options: ArrangementOption[], frontier: FrontierSummary): ArrangementOption[] {
  const index = new Map(options.map((o, i) => [o.id, i]));
  const nonDominated = new Set(frontier.nonDominatedIds);
  const count = (o: ArrangementOption, s: "fail" | "unknown") => o.constraints.filter((c) => c.status === s).length;
  return [...options].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      Number(nonDominated.has(b.id)) - Number(nonDominated.has(a.id)) ||
      count(a, "fail") - count(b, "fail") ||
      count(a, "unknown") - count(b, "unknown") ||
      (a.metrics.guestOutlayUsd ?? Number.POSITIVE_INFINITY) - (b.metrics.guestOutlayUsd ?? Number.POSITIVE_INFINITY) ||
      (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0),
  );
}
