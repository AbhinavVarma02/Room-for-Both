import { DAY_LABELS, FORMAT_LABELS, GUEST_DEALBREAKER_LABELS, PRODUCT_CATEGORY_LABELS } from "../constants/vocabulary";
import type { TimeWindow } from "../schemas/common";
import type { GuestField, GuestProfile, HostField, HostProfile, Scenario } from "../schemas/profiles";
import { type ArrangementTemplate, templateFor } from "./arrangements";
import { billedUnits } from "./constraints";
import { clock, list, money, windowLabel } from "./format";
import { buildOption } from "./options";
import { addWindow, findOverlap, replaceWindow, sortWindows } from "./schedule";
import type { ArrangementOption, Change, ConstraintId, ConstraintResult, OptionReversal } from "./types";

const relative = (from: number, to: number) => Math.abs(to - from) / Math.max(Math.abs(from), 1);

function guestChange(
  guest: GuestProfile,
  field: GuestField,
  kind: Change["kind"],
  to: unknown,
  cost: number,
  description: string,
): Change {
  return { party: "guest", field, kind, from: guest[field], to, cost, negotiable: !guest.fixedFields.includes(field), description };
}

function hostChange(
  host: HostProfile,
  field: HostField,
  kind: Change["kind"],
  to: unknown,
  cost: number,
  description: string,
): Change {
  return { party: "host", field, kind, from: host[field], to, cost, negotiable: !host.fixedFields.includes(field), description };
}

function budgetChanges(scenario: Scenario, t: ArrangementTemplate, variant: number): Change[] {
  const { guest, host } = scenario;
  const fee = t.hostFee(host, variant);
  const own = guest.ownCostPerActivationUsd;
  const cap = guest.maxOutlayUsd;
  const changes: Change[] = [];
  if (cap === null) return changes;
  if (fee !== null && own !== null) {
    changes.push(
      guestChange(guest, "maxOutlayUsd", "set_number", fee + own, relative(cap, fee + own), `Raise the guest's budget from ${money(cap)} to ${money(fee + own)}.`),
    );
  }
  if (fee !== null && own !== null && cap - fee >= 0) {
    changes.push(
      guestChange(
        guest,
        "ownCostPerActivationUsd",
        "set_number",
        cap - fee,
        relative(own, cap - fee),
        `Cut the guest's own costs from ${money(own)} to ${money(cap - fee)}.`,
      ),
    );
  }
  if (fee !== null && own !== null && cap - own >= 0) {
    const units = billedUnits(t, variant);
    const field = t.format === "popup" ? "popupFeePerDayUsd" : t.format === "shelf" ? "shelfFeePerWeekUsd" : "eventFeePerHourUsd";
    const currentRate = host[field];
    const maxRate = Math.floor((cap - own) / units);
    if (currentRate !== null && maxRate < currentRate) {
      const unit = t.format === "popup" ? "day" : t.format === "shelf" ? "week" : "hour";
      changes.push(
        hostChange(host, field, "set_number", maxRate, relative(currentRate, maxRate), `Lower the host's rate from ${money(currentRate)} to ${money(maxRate)} per ${unit}.`),
      );
    }
  }
  return changes;
}

function termChanges(host: HostProfile, t: ArrangementTemplate, variant: number): Change[] {
  const term = t.minimumTerm(host);
  if (!term || term.value === null) return [];
  const unit = t.unit === "weeks" ? "week" : "hour";
  return [
    hostChange(host, term.field, "set_number", variant, relative(term.value, variant), `Lower the host's minimum from ${term.value} to ${variant} ${unit}${variant === 1 ? "" : "s"}.`),
  ];
}

function scheduleChanges(scenario: Scenario, variant: number): Change[] {
  const { guest, host } = scenario;
  if (guest.availability === null || host.availability === null) return [];
  const changes: Change[] = [];
  const overlap = findOverlap(guest.availability, host.availability, variant);

  // Smallest numeric move first: stretch an existing shared window just enough.
  if (overlap.longest && overlap.longestOverlap < variant) {
    const need = variant - overlap.longestOverlap;
    const { day, guest: g, host: h } = overlap.longest;
    const stretch = (own: TimeWindow, other: TimeWindow): TimeWindow | null => {
      const later = Math.max(0, other.end - own.end);
      const earlier = Math.max(0, own.start - other.start);
      const addEnd = Math.min(need, later);
      const addStart = need - addEnd;
      if (addStart > earlier) return null;
      return { day, start: own.start - addStart, end: own.end + addEnd };
    };
    const hostWindow = stretch(h, g);
    if (hostWindow) {
      changes.push(
        hostChange(
          host,
          "availability",
          "extend_window",
          replaceWindow(host.availability, h, hostWindow),
          need / (h.end - h.start),
          `Extend the host's ${DAY_LABELS[day]} hours to ${clock(hostWindow.start)}–${clock(hostWindow.end)}.`,
        ),
      );
    }
    const guestWindow = stretch(g, h);
    if (guestWindow) {
      changes.push(
        guestChange(
          guest,
          "availability",
          "extend_window",
          replaceWindow(guest.availability, g, guestWindow),
          need / (g.end - g.start),
          `Extend the guest's ${DAY_LABELS[day]} hours to ${clock(guestWindow.start)}–${clock(guestWindow.end)}.`,
        ),
      );
    }
  }

  // Categorical move: open a new window on a day the other party already offers.
  const firstFit = (windows: TimeWindow[]) => sortWindows(windows).find((w) => w.end - w.start >= variant);
  const g = firstFit(guest.availability);
  if (g) {
    const add: TimeWindow = { day: g.day, start: g.start, end: g.start + variant };
    changes.push(
      hostChange(host, "availability", "add_window", addWindow(host.availability, add), 1, `Host opens ${windowLabel(add.day, add.start, add.end)}, when the guest is free.`),
    );
  }
  const h = firstFit(host.availability);
  if (h) {
    const add: TimeWindow = { day: h.day, start: h.start, end: h.start + variant };
    changes.push(
      guestChange(guest, "availability", "add_window", addWindow(guest.availability, add), 1, `Guest becomes available ${windowLabel(add.day, add.start, add.end)}, when the host is free.`),
    );
  }
  return changes;
}

function spaceChanges(scenario: Scenario, t: ArrangementTemplate): Change[] {
  const { guest, host } = scenario;
  const { guestField, hostField, unitLabel } = t.space;
  const need = guest[guestField];
  const have = host[hostField];
  if (need === null || have === null || need <= have) return [];
  const guestVerb = t.format === "cohosted_event" ? "Lower the guest's minimum audience" : "Shrink the guest's setup";
  const hostVerb = t.format === "cohosted_event" ? "Raise the host's capacity" : "Increase the host's space";
  return [
    guestChange(guest, guestField, "set_number", have, relative(need, have), `${guestVerb} from ${need} to ${have} ${unitLabel}.`),
    hostChange(host, hostField, "set_number", need, relative(have, need), `${hostVerb} from ${have} to ${need} ${unitLabel}.`),
  ];
}

function changesFor(scenario: Scenario, option: ArrangementOption, constraint: ConstraintResult): Change[] {
  const { guest, host } = scenario;
  const t = templateFor(option.format);
  const variant = option.variant;
  switch (constraint.id) {
    case "guest_format":
      return [
        guestChange(guest, "acceptableFormats", "add_format", [...guest.acceptableFormats, t.format], 1, `Guest accepts a ${FORMAT_LABELS[t.format].toLowerCase()}.`),
      ];
    case "host_format":
      return host.allowedFormats === null
        ? []
        : [hostChange(host, "allowedFormats", "add_format", [...host.allowedFormats, t.format], 1, `Host agrees to a ${FORMAT_LABELS[t.format].toLowerCase()}.`)];
    case "budget":
      return budgetChanges(scenario, t, variant);
    case "minimum_term":
      return termChanges(host, t, variant);
    case "schedule":
      return scheduleChanges(scenario, variant);
    case "space":
      return spaceChanges(scenario, t);
    case "host_staffing": {
      const need = t.hostStaffHours(variant);
      const have = host.staffHoursPerActivation;
      return have === null
        ? []
        : [hostChange(host, "staffHoursPerActivation", "set_number", need, relative(have, need), `Host provides ${need} staff hours instead of ${have}.`)];
    }
    case "guest_staffing":
      return [guestChange(guest, "staffCount", "set_number", t.guestStaffRequired, 1, "Guest sends one team member.")];
    case "category_exclusion": {
      const excluded = host.excludedCategories ?? [];
      const conflicts = guest.productCategories.filter((c) => excluded.includes(c));
      return [
        hostChange(
          host,
          "excludedCategories",
          "remove_category",
          excluded.filter((c) => !conflicts.includes(c)),
          1,
          `Host lifts its exclusion of ${list(conflicts.map((c) => PRODUCT_CATEGORY_LABELS[c].toLowerCase()))}.`,
        ),
      ];
    }
    case "sampling":
      return [
        guestChange(guest, "wantsSampling", "set_boolean", false, 1, "Guest drops in-person sampling."),
        hostChange(host, "samplingAllowed", "set_boolean", true, 1, "Host allows product sampling."),
      ];
    case "dealbreaker_alcohol":
    case "dealbreaker_exclusivity": {
      const key = constraint.id === "dealbreaker_alcohol" ? "alcohol_on_premises" : "exclusivity_required";
      const field = constraint.id === "dealbreaker_alcohol" ? "alcoholOnPremises" : "requiresExclusivity";
      return [
        guestChange(
          guest,
          "dealbreakers",
          "remove_dealbreaker",
          guest.dealbreakers.filter((d) => d !== key),
          1,
          `Guest drops the condition: ${GUEST_DEALBREAKER_LABELS[key].toLowerCase()}.`,
        ),
        hostChange(
          host,
          field,
          "set_boolean",
          false,
          1,
          constraint.id === "dealbreaker_alcohol" ? "Host pauses alcohol service during the activation." : "Host waives exclusivity.",
        ),
      ];
    }
  }
}

export function applyChanges(scenario: Scenario, changes: Change[]): Scenario {
  let guest = scenario.guest;
  let host = scenario.host;
  for (const c of changes) {
    if (c.party === "guest") guest = { ...guest, [c.field]: c.to };
    else host = { ...host, [c.field]: c.to };
  }
  return { guest, host };
}

const byCost = (a: Change, b: Change) =>
  a.cost - b.cost || (a.party === b.party ? 0 : a.party === "guest" ? -1 : 1) || a.field.localeCompare(b.field);

/**
 * For a no-go option, find the smallest negotiable change per failed check, apply them together,
 * and re-run the same deterministic evaluation to confirm the option is no longer blocked.
 * We report only verified combinations, so a suggestion is never a guess about the engine.
 */
export function reverseOption(scenario: Scenario, option: ArrangementOption): OptionReversal {
  const failing = option.constraints.filter((c) => c.status === "fail");
  const candidates = failing.map((c) => ({ constraint: c.id, changes: changesFor(scenario, option, c).sort(byCost) }));
  const nonNegotiableBlockers: ConstraintId[] = candidates
    .filter((c) => !c.changes.some((ch) => ch.negotiable))
    .map((c) => c.constraint);

  let minimalChange: OptionReversal["minimalChange"] = null;
  if (failing.length > 0 && nonNegotiableBlockers.length === 0) {
    // Each change replaces its field's whole value, so two picks on one field (both guest dealbreakers,
    // say) would undo each other. We prefer the next negotiable change on a field not yet changed.
    const touched = new Set<string>();
    const chosen: Change[] = [];
    for (const c of candidates) {
      const negotiable = c.changes.filter((ch) => ch.negotiable);
      const pick = negotiable.find((ch) => !touched.has(`${ch.party}.${ch.field}`)) ?? negotiable[0];
      if (!pick) continue;
      touched.add(`${pick.party}.${pick.field}`);
      chosen.push(pick);
    }
    const after = buildOption(applyChanges(scenario, chosen), templateFor(option.format), option.variant);
    minimalChange = { changes: chosen, statusAfter: after.status, verified: after.status !== "no_go" };
  }
  return {
    optionId: option.id,
    statusBefore: option.status,
    blockingConstraints: failing.map((c) => c.id),
    candidates,
    minimalChange,
    nonNegotiableBlockers,
  };
}

export function reverseAll(scenario: Scenario, ranked: ArrangementOption[]): OptionReversal[] {
  const order = new Map(ranked.map((o, i) => [o.id, i]));
  const totalCost = (r: OptionReversal) => r.minimalChange?.changes.reduce((s, c) => s + c.cost, 0) ?? Number.POSITIVE_INFINITY;
  return ranked
    .filter((o) => o.status === "no_go")
    .map((o) => reverseOption(scenario, o))
    .sort(
      (a, b) =>
        Number(b.minimalChange?.verified ?? false) - Number(a.minimalChange?.verified ?? false) ||
        (a.minimalChange?.changes.length ?? 99) - (b.minimalChange?.changes.length ?? 99) ||
        totalCost(a) - totalCost(b) ||
        (order.get(a.optionId) ?? 0) - (order.get(b.optionId) ?? 0),
    );
}
