import type { Party } from "../schemas/common";
import type { ArrangementOption, FieldRef, ProfileField, Question } from "./types";

const QUESTION_TEXT: Partial<Record<`${Party}.${ProfileField}`, string>> = {
  "host.allowedFormats": "Which collaboration formats will you host?",
  "host.availability": "Which days and hours could you host a partner?",
  "host.popupFeePerDayUsd": "What is your day rate for a partner pop-up?",
  "host.shelfFeePerWeekUsd": "What do you charge per week for a curated shelf placement?",
  "host.shelfMinWeeks": "What is the minimum length for a shelf placement?",
  "host.eventFeePerHourUsd": "What is your hourly fee for a co-hosted event?",
  "host.eventMinHours": "What is the minimum length for a co-hosted event?",
  "host.guestFloorSqFt": "How much floor space can a pop-up partner use?",
  "host.shelfLinearFt": "How much shelf space could you offer?",
  "host.eventCapacity": "How many people can your event space hold?",
  "host.staffHoursPerActivation": "How many staff hours can you dedicate to a partner activation?",
  "host.excludedCategories": "Are there product categories you will not carry or host?",
  "host.samplingAllowed": "Can a partner hand out product samples on site?",
  "host.alcoholOnPremises": "Is alcohol served on site during partner activations?",
  "host.requiresExclusivity": "Do your partnerships require exclusivity?",
  "guest.maxOutlayUsd": "What is the most you can spend on this activation in total?",
  "guest.ownCostPerActivationUsd": "What will your own materials, samples, and travel cost?",
  "guest.availability": "Which days and hours can your team attend?",
  "guest.popupFootprintSqFt": "How much floor space does your pop-up setup need?",
  "guest.shelfLinearFt": "How much shelf space does your product range need?",
  "guest.staffCount": "How many team members can attend?",
};

const keyOf = (f: FieldRef) => `${f.party}.${f.field}` as const;

/**
 * Ranks missing inputs by how much they move the decision: first those that are the only gap
 * standing between a conditional option and a clear answer, then by how many options depend on
 * them. This is a count of observable dependencies, not a probability or value-of-information estimate.
 */
export function rankQuestions(ranked: ArrangementOption[]): Question[] {
  const byField = new Map<string, Question>();
  for (const option of ranked) {
    if (option.status !== "conditional") continue;
    const unknowns = option.constraints.filter((c) => c.status === "unknown");
    const missing = new Map<string, FieldRef>();
    for (const c of unknowns) for (const m of c.missing) missing.set(keyOf(m), m);
    for (const [key, ref] of missing) {
      let q = byField.get(key);
      if (!q) {
        const firstRequirement = unknowns.find((c) => c.requirement && keyOf(c.requirement) === key)?.requirement;
        const neededFor = unknowns.filter((c) => c.missing.some((m) => keyOf(m) === key)).map((c) => c.label.toLowerCase());
        q = {
          ...ref,
          text: QUESTION_TEXT[keyOf(ref)] ?? `Confirm ${ref.party} ${ref.field}.`,
          detail: firstRequirement
            ? `For “${option.label}”: ${firstRequirement.text}`
            : `Needed to check: ${neededFor.join(", ")}.`,
          decisiveFor: [],
          involvedIn: [],
        };
        byField.set(key, q);
      }
      q.involvedIn.push(option.id);
      if (missing.size === 1) q.decisiveFor.push(option.id);
    }
  }
  const firstIndex = (q: Question) => ranked.findIndex((o) => q.involvedIn.includes(o.id));
  return [...byField.values()].sort(
    (a, b) =>
      b.decisiveFor.length - a.decisiveFor.length ||
      b.involvedIn.length - a.involvedIn.length ||
      firstIndex(a) - firstIndex(b) ||
      keyOf(a).localeCompare(keyOf(b)),
  );
}
