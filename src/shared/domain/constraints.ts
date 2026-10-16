import { DAY_LABELS, FORMAT_LABELS, PRODUCT_CATEGORY_LABELS } from "../constants/vocabulary";
import type { GuestProfile, HostProfile, Scenario } from "../schemas/profiles";
import { type ArrangementTemplate, guestSpaceValue, hostSpaceValue } from "./arrangements";
import { list, money, windowLabel } from "./format";
import { guestInput, hostInput } from "./provenance";
import { daysOf, findOverlap } from "./schedule";
import type { ConstraintResult, OptionMetrics, Requirement, Slot } from "./types";

type HostFeeField = "popupFeePerDayUsd" | "shelfFeePerWeekUsd" | "eventFeePerHourUsd";

function feeField(t: ArrangementTemplate): HostFeeField {
  if (t.format === "popup") return "popupFeePerDayUsd";
  if (t.format === "shelf") return "shelfFeePerWeekUsd";
  return "eventFeePerHourUsd";
}

/** Units the host's rate is multiplied by: one day for a pop-up, otherwise the variant length. */
export function billedUnits(t: ArrangementTemplate, variant: number): number {
  return t.format === "popup" ? 1 : variant;
}

function feeUnitLabel(t: ArrangementTemplate): string {
  if (t.format === "popup") return "day rate";
  if (t.format === "shelf") return "weekly shelf fee";
  return "hourly event fee";
}

function guestFormat(guest: GuestProfile, t: ArrangementTemplate): ConstraintResult {
  const ok = guest.acceptableFormats.includes(t.format);
  return {
    id: "guest_format",
    label: "Guest accepts this format",
    status: ok ? "pass" : "fail",
    explanation: ok
      ? `${guest.businessName} lists ${FORMAT_LABELS[t.format].toLowerCase()} as acceptable.`
      : `${guest.businessName} has not listed ${FORMAT_LABELS[t.format].toLowerCase()} as an acceptable format.`,
    inputs: [guestInput(guest, "acceptableFormats")],
    missing: [],
  };
}

function hostFormat(host: HostProfile, t: ArrangementTemplate): ConstraintResult {
  const base = {
    id: "host_format" as const,
    label: "Host allows this format",
    inputs: [hostInput(host, "allowedFormats")],
  };
  if (host.allowedFormats === null) {
    return {
      ...base,
      status: "unknown",
      explanation: `${host.venueName} has not said which formats it hosts.`,
      missing: [{ party: "host", field: "allowedFormats" }],
      requirement: {
        party: "host",
        field: "allowedFormats",
        comparator: "includes",
        value: t.format,
        text: `${host.venueName} must be willing to host a ${FORMAT_LABELS[t.format].toLowerCase()}.`,
      },
    };
  }
  const ok = host.allowedFormats.includes(t.format);
  return {
    ...base,
    status: ok ? "pass" : "fail",
    explanation: ok
      ? `${host.venueName} hosts ${FORMAT_LABELS[t.format].toLowerCase()}s.`
      : `${host.venueName} does not host ${FORMAT_LABELS[t.format].toLowerCase()}s.`,
    missing: [],
  };
}

/** When exactly one budget input is missing, state the value it would need for the check to pass. */
function budgetRequirement(
  t: ArrangementTemplate,
  field: HostFeeField,
  fee: number | null,
  own: number | null,
  cap: number | null,
  units: number,
): { requirement?: Requirement } {
  if (fee === null && own !== null && cap !== null) {
    const maxRate = Math.floor((cap - own) / units);
    return {
      requirement: {
        party: "host",
        field,
        comparator: "at_most",
        value: maxRate,
        text: `The host's ${feeUnitLabel(t)} must be at most ${money(maxRate)} to fit a ${money(cap)} budget.`,
      },
    };
  }
  if (cap === null && fee !== null && own !== null) {
    return {
      requirement: {
        party: "guest",
        field: "maxOutlayUsd",
        comparator: "at_least",
        value: fee + own,
        text: `The guest's budget must be at least ${money(fee + own)}.`,
      },
    };
  }
  if (own === null && fee !== null && cap !== null) {
    return {
      requirement: {
        party: "guest",
        field: "ownCostPerActivationUsd",
        comparator: "at_most",
        value: cap - fee,
        text: `The guest's own costs must stay at or below ${money(cap - fee)}.`,
      },
    };
  }
  return {};
}

function budget(scenario: Scenario, t: ArrangementTemplate, variant: number): ConstraintResult {
  const { guest, host } = scenario;
  const field = feeField(t);
  const fee = t.hostFee(host, variant);
  const own = guest.ownCostPerActivationUsd;
  const cap = guest.maxOutlayUsd;
  const units = billedUnits(t, variant);
  const inputs = [guestInput(guest, "maxOutlayUsd"), guestInput(guest, "ownCostPerActivationUsd"), hostInput(host, field)];
  const base = { id: "budget" as const, label: "Fits the guest's total budget", inputs };

  // Some combinations fail even with values missing: if own costs alone exceed the cap,
  // no host fee (which is never negative) can make the option affordable.
  if (cap !== null && own !== null && own > cap) {
    return {
      ...base,
      status: "fail",
      explanation: `Own costs of ${money(own)} already exceed the ${money(cap)} budget before any partner fee.`,
      missing: [],
    };
  }

  // Likewise, a partner fee above the cap fails whatever the guest's own costs turn out to be.
  if (cap !== null && fee !== null && fee > cap) {
    return {
      ...base,
      status: "fail",
      explanation: `The partner fee alone (${t.feeExplanation(host, variant)} = ${money(fee)}) exceeds the ${money(cap)} budget.`,
      missing: [],
    };
  }

  if (fee === null || own === null || cap === null) {
    const missing = [
      ...(cap === null ? [{ party: "guest" as const, field: "maxOutlayUsd" as const }] : []),
      ...(own === null ? [{ party: "guest" as const, field: "ownCostPerActivationUsd" as const }] : []),
      ...(fee === null ? [{ party: "host" as const, field }] : []),
    ];
    const names = missing.map((m) =>
      m.party === "host" ? `the host's ${feeUnitLabel(t)}` : m.field === "maxOutlayUsd" ? "the guest's budget" : "the guest's own costs",
    );
    return {
      ...base,
      status: "unknown",
      explanation: `Cannot check the budget yet: ${list(names)} ${missing.length === 1 ? "is" : "are"} missing.`,
      missing,
      ...budgetRequirement(t, field, fee, own, cap, units),
    };
  }

  const total = fee + own;
  const ok = total <= cap;
  return {
    ...base,
    status: ok ? "pass" : "fail",
    explanation: `Partner fee ${money(fee)} (${t.feeExplanation(host, variant)}) plus own costs ${money(own)} = ${money(total)}, ${
      ok ? `within the ${money(cap)} budget` : `${money(total - cap)} over the ${money(cap)} budget`
    }.`,
    missing: [],
  };
}

function minimumTerm(host: HostProfile, t: ArrangementTemplate, variant: number): ConstraintResult | null {
  const term = t.minimumTerm(host);
  if (term === null) return null;
  const unit = t.unit === "weeks" ? "week" : "hour";
  const base = { id: "minimum_term" as const, label: "Meets the host's minimum length", inputs: [hostInput(host, term.field)] };
  if (term.value === null) {
    return {
      ...base,
      status: "unknown",
      explanation: `${host.venueName} has not stated a minimum ${unit} count.`,
      missing: [{ party: "host", field: term.field }],
      requirement: {
        party: "host",
        field: term.field,
        comparator: "at_most",
        value: variant,
        text: `The host's minimum must be ${variant} ${unit}${variant === 1 ? "" : "s"} or fewer.`,
      },
    };
  }
  const ok = variant >= term.value;
  return {
    ...base,
    status: ok ? "pass" : "fail",
    explanation: ok
      ? `${variant} ${unit}${variant === 1 ? "" : "s"} meets the host's ${term.value}-${unit} minimum.`
      : `${variant} ${unit}${variant === 1 ? " is" : "s are"} below the host's ${term.value}-${unit} minimum.`,
    missing: [],
  };
}

function schedule(scenario: Scenario, t: ArrangementTemplate, variant: number): { result: ConstraintResult; slot: Slot | null } {
  const { guest, host } = scenario;
  const inputs = [guestInput(guest, "availability"), hostInput(host, "availability")];
  const base = { id: "schedule" as const, label: "Shared time available", inputs };
  if (!t.needsScheduleOverlap) {
    return {
      result: {
        ...base,
        status: "not_applicable",
        explanation: "Shelf placement runs during the host's normal opening hours; drop-off timing is arranged directly.",
        missing: [],
      },
      slot: null,
    };
  }
  if (guest.availability === null || host.availability === null) {
    const missing = [
      ...(guest.availability === null ? [{ party: "guest" as const, field: "availability" as const }] : []),
      ...(host.availability === null ? [{ party: "host" as const, field: "availability" as const }] : []),
    ];
    const guestDays = guest.availability ? daysOf(guest.availability.filter((w) => w.end - w.start >= variant)) : [];
    return {
      result: {
        ...base,
        status: "unknown",
        explanation: `Cannot check timing yet: ${missing.map((m) => (m.party === "guest" ? "guest" : "host")).join(" and ")} availability is missing.`,
        missing,
        ...(host.availability === null && guest.availability !== null
          ? {
              requirement: {
                party: "host" as const,
                field: "availability" as const,
                comparator: "covers" as const,
                value: variant,
                text:
                  guestDays.length > 0
                    ? `The host must be free for ${variant} consecutive hours on ${list(guestDays.map((d) => DAY_LABELS[d]))} within the guest's hours.`
                    : `The guest has no window of ${variant} hours, so the host's availability cannot help.`,
              },
            }
          : {}),
      },
      slot: null,
    };
  }
  const overlap = findOverlap(guest.availability, host.availability, variant);
  if (overlap.slot) {
    return {
      result: {
        ...base,
        status: "pass",
        explanation: `Both parties are free ${windowLabel(overlap.slot.day, overlap.slot.start, overlap.slot.end)}.`,
        missing: [],
      },
      slot: overlap.slot,
    };
  }
  const explanation =
    overlap.longest !== null
      ? `The longest shared window is ${overlap.longestOverlap} hour${overlap.longestOverlap === 1 ? "" : "s"} (${windowLabel(
          overlap.longest.day,
          overlap.longest.start,
          overlap.longest.end,
        )}); this option needs ${variant}.`
      : `No shared day: the guest is available ${list(daysOf(guest.availability).map((d) => DAY_LABELS[d])) || "on no days"} and the host ${
          list(daysOf(host.availability).map((d) => DAY_LABELS[d])) || "on no days"
        }.`;
  return { result: { ...base, status: "fail", explanation, missing: [] }, slot: null };
}

function space(scenario: Scenario, t: ArrangementTemplate): ConstraintResult {
  const { guest, host } = scenario;
  const { guestField, hostField, unitLabel, guestOptional } = t.space;
  const need = guestSpaceValue(guest, guestField);
  const have = hostSpaceValue(host, hostField);
  const label = t.format === "cohosted_event" ? "Room holds the guest's minimum audience" : "Space fits the guest's setup";
  const base = { id: "space" as const, label, inputs: [guestInput(guest, guestField), hostInput(host, hostField)] };
  if (need === null && guestOptional) {
    return { ...base, status: "not_applicable", explanation: "The guest set no minimum audience.", missing: [] };
  }
  if (need === null || have === null) {
    const missing = [
      ...(need === null ? [{ party: "guest" as const, field: guestField }] : []),
      ...(have === null ? [{ party: "host" as const, field: hostField }] : []),
    ];
    return {
      ...base,
      status: "unknown",
      explanation: `Cannot compare space yet: ${missing.map((m) => (m.party === "guest" ? "the guest's need" : "the host's capacity")).join(" and ")} ${missing.length === 1 ? "is" : "are"} missing.`,
      missing,
      ...(need !== null && have === null
        ? {
            requirement: {
              party: "host" as const,
              field: hostField,
              comparator: "at_least" as const,
              value: need,
              text: `The host must offer at least ${need} ${unitLabel}.`,
            },
          }
        : {}),
    };
  }
  const ok = need <= have;
  return {
    ...base,
    status: ok ? "pass" : "fail",
    explanation: ok
      ? `Needs ${need} ${unitLabel}; the host offers ${have}.`
      : `Needs ${need} ${unitLabel} but the host offers ${have} (${need - have} short).`,
    missing: [],
  };
}

function hostStaffing(host: HostProfile, t: ArrangementTemplate, variant: number): ConstraintResult {
  const need = t.hostStaffHours(variant);
  const base = {
    id: "host_staffing" as const,
    label: "Host staff time available",
    inputs: [hostInput(host, "staffHoursPerActivation")],
  };
  if (need === 0) {
    return { ...base, status: "not_applicable", explanation: "This format needs no dedicated host staff time.", missing: [] };
  }
  if (host.staffHoursPerActivation === null) {
    return {
      ...base,
      status: "unknown",
      explanation: `${host.venueName} has not said how much staff time it can give an activation.`,
      missing: [{ party: "host", field: "staffHoursPerActivation" }],
      requirement: {
        party: "host",
        field: "staffHoursPerActivation",
        comparator: "at_least",
        value: need,
        text: `The host must be able to staff ${need} hour${need === 1 ? "" : "s"}.`,
      },
    };
  }
  const ok = need <= host.staffHoursPerActivation;
  return {
    ...base,
    status: ok ? "pass" : "fail",
    explanation: ok
      ? `Needs ${need} host staff hour${need === 1 ? "" : "s"}; ${host.staffHoursPerActivation} available.`
      : `Needs ${need} host staff hours; only ${host.staffHoursPerActivation} available.`,
    missing: [],
  };
}

function guestStaffing(guest: GuestProfile, t: ArrangementTemplate): ConstraintResult {
  const base = { id: "guest_staffing" as const, label: "Guest can staff it", inputs: [guestInput(guest, "staffCount")] };
  if (t.guestStaffRequired === 0) {
    return { ...base, status: "not_applicable", explanation: "No guest staff on site.", missing: [] };
  }
  if (guest.staffCount === null) {
    return {
      ...base,
      status: "unknown",
      explanation: "The guest has not said how many people can attend.",
      missing: [{ party: "guest", field: "staffCount" }],
    };
  }
  const ok = guest.staffCount >= t.guestStaffRequired;
  return {
    ...base,
    status: ok ? "pass" : "fail",
    explanation: ok
      ? `${guest.staffCount} guest team member${guest.staffCount === 1 ? "" : "s"} available.`
      : "No guest team member is available to attend.",
    missing: [],
  };
}

function categoryExclusion(scenario: Scenario): ConstraintResult {
  const { guest, host } = scenario;
  const base = {
    id: "category_exclusion" as const,
    label: "Product category permitted",
    inputs: [guestInput(guest, "productCategories"), hostInput(host, "excludedCategories")],
  };
  if (host.excludedCategories === null) {
    return {
      ...base,
      status: "unknown",
      explanation: `${host.venueName} has not stated which product categories it excludes.`,
      missing: [{ party: "host", field: "excludedCategories" }],
      requirement: {
        party: "host",
        field: "excludedCategories",
        comparator: "excludes",
        value: guest.productCategories,
        text: `The host must accept ${list(guest.productCategories.map((c) => PRODUCT_CATEGORY_LABELS[c].toLowerCase()))}.`,
      },
    };
  }
  const conflicts = guest.productCategories.filter((c) => host.excludedCategories?.includes(c));
  return {
    ...base,
    status: conflicts.length === 0 ? "pass" : "fail",
    explanation:
      conflicts.length === 0
        ? "None of the guest's product categories are excluded by the host."
        : `${host.venueName} excludes ${list(conflicts.map((c) => PRODUCT_CATEGORY_LABELS[c].toLowerCase()))}.`,
    missing: [],
  };
}

function sampling(scenario: Scenario, t: ArrangementTemplate): ConstraintResult {
  const { guest, host } = scenario;
  const base = {
    id: "sampling" as const,
    label: "In-person sampling permitted",
    inputs: [guestInput(guest, "wantsSampling"), hostInput(host, "samplingAllowed")],
  };
  if (!t.involvesSampling || !guest.wantsSampling) {
    return {
      ...base,
      status: "not_applicable",
      explanation: t.involvesSampling ? "The guest does not plan to offer samples." : "No in-person sampling in this format.",
      missing: [],
    };
  }
  if (host.samplingAllowed === null) {
    return {
      ...base,
      status: "unknown",
      explanation: `${host.venueName} has not said whether product sampling is allowed.`,
      missing: [{ party: "host", field: "samplingAllowed" }],
      requirement: {
        party: "host",
        field: "samplingAllowed",
        comparator: "equals",
        value: true,
        text: "The host must allow product samples on site.",
      },
    };
  }
  return {
    ...base,
    status: host.samplingAllowed ? "pass" : "fail",
    explanation: host.samplingAllowed ? "The host allows product sampling." : "The host does not allow product sampling.",
    missing: [],
  };
}

function dealbreaker(
  scenario: Scenario,
  id: "dealbreaker_alcohol" | "dealbreaker_exclusivity",
): ConstraintResult {
  const { guest, host } = scenario;
  const isAlcohol = id === "dealbreaker_alcohol";
  const key = isAlcohol ? "alcohol_on_premises" : "exclusivity_required";
  const field = isAlcohol ? "alcoholOnPremises" : "requiresExclusivity";
  const value = host[field];
  const base = {
    id,
    label: isAlcohol ? "No alcohol on premises (guest condition)" : "No exclusivity clause (guest condition)",
    inputs: [guestInput(guest, "dealbreakers"), hostInput(host, field)],
  };
  if (!guest.dealbreakers.includes(key)) {
    return { ...base, status: "not_applicable", explanation: "Not a condition for this guest.", missing: [] };
  }
  if (value === null) {
    return {
      ...base,
      status: "unknown",
      explanation: isAlcohol
        ? `${host.venueName} has not said whether alcohol is served on site.`
        : `${host.venueName} has not said whether it requires exclusivity.`,
      missing: [{ party: "host", field }],
      requirement: {
        party: "host",
        field,
        comparator: "equals",
        value: false,
        text: isAlcohol ? "The host must not serve alcohol during the activation." : "The host must not require exclusivity.",
      },
    };
  }
  return {
    ...base,
    status: value ? "fail" : "pass",
    explanation: isAlcohol
      ? value
        ? "The host serves alcohol on site, which the guest has ruled out."
        : "The host does not serve alcohol on site."
      : value
        ? "The host requires exclusivity, which the guest has ruled out."
        : "The host does not require exclusivity.",
    missing: [],
  };
}

export function evaluateConstraints(
  scenario: Scenario,
  t: ArrangementTemplate,
  variant: number,
): { constraints: ConstraintResult[]; slot: Slot | null; metrics: OptionMetrics } {
  const sched = schedule(scenario, t, variant);
  const term = minimumTerm(scenario.host, t, variant);
  const constraints: ConstraintResult[] = [
    guestFormat(scenario.guest, t),
    hostFormat(scenario.host, t),
    budget(scenario, t, variant),
    ...(term ? [term] : []),
    sched.result,
    space(scenario, t),
    hostStaffing(scenario.host, t, variant),
    guestStaffing(scenario.guest, t),
    categoryExclusion(scenario),
    sampling(scenario, t),
    dealbreaker(scenario, "dealbreaker_alcohol"),
    dealbreaker(scenario, "dealbreaker_exclusivity"),
  ];
  const fee = t.hostFee(scenario.host, variant);
  const own = scenario.guest.ownCostPerActivationUsd;
  const metrics: OptionMetrics = {
    hostFeeUsd: fee,
    guestOutlayUsd: fee !== null && own !== null ? fee + own : null,
    guestStaffHours: t.guestStaffRequired > 0 && t.unit === "hours" ? variant * t.guestStaffRequired : 0,
    hostStaffHours: t.hostStaffHours(variant),
    customerFacingHours: t.unit === "hours" ? variant : 0,
  };
  return { constraints, slot: sched.slot, metrics };
}
