import { DAY_LABELS, FORMAT_LABELS, HOST_GOAL_LABELS, OBJECTIVE_LABELS, PRODUCT_CATEGORY_LABELS } from "../constants/vocabulary";
import type { ResearchRun } from "../schemas/evidence";
import type { NarrativeFacts } from "../schemas/narrative";
import type { ProvenanceKind } from "../schemas/common";
import type { GuestProfile, HostProfile, Scenario } from "../schemas/profiles";
import { clock, hours, money, weeks, windowLabel } from "./format";
import { guestProvenance, hostProvenance } from "./provenance";
import type { ArrangementOption, OptionStatus, ScenarioEvaluation } from "./types";

export interface BriefInput {
  party: "guest" | "host";
  label: string;
  value: string;
  provenance: ProvenanceKind;
}

export interface DecisionBrief {
  title: string;
  generatedAt: string;
  engineVersion: string;
  fictional: boolean;
  hypothetical: boolean;
  twoSided: ScenarioEvaluation["twoSided"];
  summary: string;
  proposal: {
    optionId: string;
    label: string;
    status: Exclude<OptionStatus, "no_go">;
    guestOutlayUsd: number | null;
    hostFeeUsd: number | null;
    when: string;
    assumptions: string[];
  } | null;
  guestValue: string[];
  hostValue: string[];
  options: { label: string; status: OptionStatus; guestOutlayUsd: number | null; hostFeeUsd: number | null; onFrontier: boolean; note: string }[];
  closestBlocked: { label: string; reasons: string[]; changes: string[]; nonNegotiable: string[] }[];
  cultural: {
    mode: ResearchRun["mode"];
    themes: { title: string; items: string[]; source: string; provenance: ProvenanceKind }[];
    selectedVenue: { name: string; strength: string; affinity: number | null; source: string } | null;
    limitations: string[];
  } | null;
  inputs: BriefInput[];
  unresolved: string[];
  questions: { text: string; detail: string }[];
  method: string;
  limitations: string[];
}

const fmtNum = (v: number | null, f: (n: number) => string) => (v === null ? "Not provided" : f(v));
const fmtBool = (v: boolean | null, yes: string, no: string) => (v === null ? "Not provided" : v ? yes : no);
const fmtAvail = (a: GuestProfile["availability"]) =>
  a === null ? "Not provided" : a.length === 0 ? "None" : a.map((w) => `${DAY_LABELS[w.day]} ${clock(w.start)}–${clock(w.end)}`).join("; ");

function guestInputs(g: GuestProfile): BriefInput[] {
  const p = (v: unknown) => guestProvenance(g, v);
  return [
    { party: "guest", label: "Total budget", value: fmtNum(g.maxOutlayUsd, money), provenance: p(g.maxOutlayUsd) },
    { party: "guest", label: "Own costs per activation", value: fmtNum(g.ownCostPerActivationUsd, money), provenance: p(g.ownCostPerActivationUsd) },
    { party: "guest", label: "Availability", value: fmtAvail(g.availability), provenance: p(g.availability) },
    { party: "guest", label: "Pop-up footprint", value: fmtNum(g.popupFootprintSqFt, (n) => `${n} sq ft`), provenance: p(g.popupFootprintSqFt) },
    { party: "guest", label: "Shelf space needed", value: fmtNum(g.shelfLinearFt, (n) => `${n} linear ft`), provenance: p(g.shelfLinearFt) },
    { party: "guest", label: "Team members", value: fmtNum(g.staffCount, String), provenance: p(g.staffCount) },
    { party: "guest", label: "Product categories", value: g.productCategories.map((c) => PRODUCT_CATEGORY_LABELS[c]).join(", "), provenance: p(g.productCategories) },
    { party: "guest", label: "In-person sampling", value: g.wantsSampling ? "Planned" : "Not planned", provenance: p(g.wantsSampling) },
  ];
}

function hostInputs(h: HostProfile): BriefInput[] {
  const p = (v: unknown) => hostProvenance(h, v);
  return [
    { party: "host", label: "Formats hosted", value: h.allowedFormats === null ? "Not provided" : h.allowedFormats.map((f) => FORMAT_LABELS[f]).join(", ") || "None", provenance: p(h.allowedFormats) },
    { party: "host", label: "Availability", value: fmtAvail(h.availability), provenance: p(h.availability) },
    { party: "host", label: "Pop-up day rate", value: fmtNum(h.popupFeePerDayUsd, money), provenance: p(h.popupFeePerDayUsd) },
    { party: "host", label: "Shelf fee per week", value: fmtNum(h.shelfFeePerWeekUsd, money), provenance: p(h.shelfFeePerWeekUsd) },
    { party: "host", label: "Minimum shelf term", value: fmtNum(h.shelfMinWeeks, weeks), provenance: p(h.shelfMinWeeks) },
    { party: "host", label: "Event fee per hour", value: fmtNum(h.eventFeePerHourUsd, money), provenance: p(h.eventFeePerHourUsd) },
    { party: "host", label: "Minimum event length", value: fmtNum(h.eventMinHours, hours), provenance: p(h.eventMinHours) },
    { party: "host", label: "Floor space for a pop-up", value: fmtNum(h.guestFloorSqFt, (n) => `${n} sq ft`), provenance: p(h.guestFloorSqFt) },
    { party: "host", label: "Shelf space", value: fmtNum(h.shelfLinearFt, (n) => `${n} linear ft`), provenance: p(h.shelfLinearFt) },
    { party: "host", label: "Event capacity", value: fmtNum(h.eventCapacity, (n) => `${n} people`), provenance: p(h.eventCapacity) },
    { party: "host", label: "Staff hours per activation", value: fmtNum(h.staffHoursPerActivation, hours), provenance: p(h.staffHoursPerActivation) },
    {
      party: "host",
      label: "Excluded categories",
      value: h.excludedCategories === null ? "Not provided" : h.excludedCategories.map((c) => PRODUCT_CATEGORY_LABELS[c]).join(", ") || "None",
      provenance: p(h.excludedCategories),
    },
    { party: "host", label: "Sampling allowed", value: fmtBool(h.samplingAllowed, "Yes", "No"), provenance: p(h.samplingAllowed) },
    { party: "host", label: "Requires exclusivity", value: fmtBool(h.requiresExclusivity, "Yes", "No"), provenance: p(h.requiresExclusivity) },
  ];
}

function when(o: ArrangementOption): string {
  if (o.slot) return windowLabel(o.slot.day, o.slot.start, o.slot.end);
  return o.format === "shelf" ? `${weeks(o.variant)} during normal opening hours` : "No shared time yet";
}

/** Value statements are hypotheses tied to what each party said it wants. They are not forecasts. */
function guestValue(g: GuestProfile, o: ArrangementOption, research: ResearchRun | null): string[] {
  const live = o.format !== "shelf";
  const theme = research?.themes[0]?.title;
  return g.objectives.map((obj) => {
    const head = OBJECTIVE_LABELS[obj];
    switch (obj) {
      case "new_customers":
        return `${head}: ${live ? `meets the host's visitors in person for ${hours(o.variant)}.` : `puts the range in front of the host's customers for ${weeks(o.variant)} without staff on site.`}`;
      case "cultural_relevance":
        return `${head}: ${
          theme
            ? `can be framed around “${theme}”, which ${research?.mode === "live" ? "Qloo associates" : "the fictional fixture data associates"} with the guest's references.`
            : "a cultural theme still needs to be agreed."
        }`;
      case "product_trial":
        return `${head}: ${live ? (g.wantsSampling ? "in-person sampling, if the host allows it." : "people can see the products in person.") : "depends on shelf presentation; no sampling."}`;
      case "community_building":
        return `${head}: ${o.format === "cohosted_event" ? "a co-hosted event gathers people around a shared interest." : "a lighter touch than an event; community effect is indirect."}`;
      case "content_creation":
        return `${head}: ${live ? "an in-person moment both businesses could document, with permission." : "a styled shelf both businesses could photograph, with permission."}`;
      case "wholesale_lead":
        return `${head}: ${o.format === "shelf" ? "tests whether the host's customers buy the range, a step toward a wholesale conversation." : "a relationship that could lead to a wholesale conversation."}`;
    }
  });
}

function hostValue(h: HostProfile, o: ArrangementOption): string[] {
  return h.goals.map((goal) => {
    const head = HOST_GOAL_LABELS[goal];
    switch (goal) {
      case "partner_fee_income":
        return `${head}: ${o.metrics.hostFeeUsd === null ? "fee to be confirmed." : `${money(o.metrics.hostFeeUsd)} at the host's stated rate.`}`;
      case "foot_traffic":
        return `${head}: ${o.format === "shelf" ? "something new on the shelves for regulars; no traffic effect is estimated." : `a reason to visit ${o.slot ? `on ${DAY_LABELS[o.slot.day]}` : "during the activation"}; no visitor numbers are estimated.`}`;
      case "community_programming":
        return `${head}: ${o.format === "cohosted_event" ? "adds a programmed evening to the calendar." : "a partner presence without programming work."}`;
      case "new_audience":
        return `${head}: introduces the guest's audience to the venue; no audience size is estimated.`;
      case "fresh_assortment":
        return `${head}: ${o.format === "shelf" ? `a curated product line for ${weeks(o.variant)}.` : "a temporary product presence."}`;
    }
  });
}

export function buildBrief(
  scenario: Scenario,
  evaluation: ScenarioEvaluation,
  research: ResearchRun | null,
  options: { hypothetical: boolean; selectedCandidateId: string | null; now?: Date },
): DecisionBrief {
  const { guest, host } = scenario;
  const nd = new Set(evaluation.frontier.nonDominatedIds);
  const top = evaluation.options[0];
  const proposalOption = top && top.status !== "no_go" ? top : null;
  const closest = evaluation.reversals.slice(0, 3).map((r) => {
    const o = evaluation.options.find((x) => x.id === r.optionId);
    return {
      label: o?.label ?? r.optionId,
      reasons: o?.constraints.filter((c) => c.status === "fail").map((c) => c.explanation) ?? [],
      changes: r.minimalChange?.verified ? r.minimalChange.changes.map((c) => c.description) : [],
      nonNegotiable: r.nonNegotiableBlockers.map((b) => b.replace(/_/g, " ")),
    };
  });

  const unresolved = proposalOption
    ? [...new Set(proposalOption.constraints.filter((c) => c.status === "unknown").map((c) => c.requirement?.text ?? c.explanation))]
    : [];

  const questions = evaluation.questions.slice(0, 3).map((q) => ({ text: q.text, detail: q.detail }));
  const confirmations = [
    ...(proposalOption?.assumptions ?? []).map((a) => ({ text: `Do both sides agree with this assumption? ${a}`, detail: "A template assumption, not something either party stated." })),
    { text: "Which specific date would work, and what happens if it has to move?", detail: "Availability is weekly windows; specific dates are agreed directly." },
    { text: "How will payment, restocking, and unsold stock be handled?", detail: "These terms are outside what Room for Both models." },
  ];
  while (questions.length < 3 && confirmations.length > 0) {
    const next = confirmations.shift();
    if (next) questions.push(next);
  }

  const selected = research?.candidates.find((c) => c.venue.id === options.selectedCandidateId) ?? null;
  const c = evaluation.counts;
  const lead = `Of ${evaluation.options.length} arrangements checked, ${c.feasible} ${c.feasible === 1 ? "is" : "are"} feasible on stated requirements, ${c.conditional} conditional, and ${c.no_go} no-go.`;
  const proposalText = proposalOption
    ? ` The suggested starting point is ${proposalOption.label} (${proposalOption.status}): guest outlay ${proposalOption.metrics.guestOutlayUsd === null ? "unknown" : money(proposalOption.metrics.guestOutlayUsd)}, host fee ${proposalOption.metrics.hostFeeUsd === null ? "unknown" : money(proposalOption.metrics.hostFeeUsd)}.${unresolved.length ? ` It still depends on: ${unresolved.join(" ")}` : ""}`
    : " No option is currently feasible or conditional.";
  const closestText = closest[0] && closest[0].changes.length ? ` The closest blocked option, ${closest[0].label}, would need: ${closest[0].changes.join(" ")}` : "";

  return {
    title: `${guest.businessName} × ${host.venueName}`,
    generatedAt: (options.now ?? new Date()).toISOString(),
    engineVersion: evaluation.engineVersion,
    fictional: guest.origin === "synthetic_demo" || host.source === "fictional_example",
    hypothetical: options.hypothetical,
    twoSided: evaluation.twoSided,
    summary: `${lead}${proposalText}${closestText}`,
    proposal: proposalOption
      ? {
          optionId: proposalOption.id,
          label: proposalOption.label,
          status: proposalOption.status as Exclude<OptionStatus, "no_go">,
          guestOutlayUsd: proposalOption.metrics.guestOutlayUsd,
          hostFeeUsd: proposalOption.metrics.hostFeeUsd,
          when: when(proposalOption),
          assumptions: proposalOption.assumptions,
        }
      : null,
    guestValue: proposalOption ? guestValue(guest, proposalOption, research) : [],
    hostValue: proposalOption ? hostValue(host, proposalOption) : [],
    options: evaluation.options.map((o) => ({
      label: o.label,
      status: o.status,
      guestOutlayUsd: o.metrics.guestOutlayUsd,
      hostFeeUsd: o.metrics.hostFeeUsd,
      onFrontier: nd.has(o.id) && o.status !== "no_go",
      note:
        o.status === "no_go"
          ? (o.constraints.find((x) => x.status === "fail")?.explanation ?? "")
          : o.status === "conditional"
            ? (o.constraints.find((x) => x.status === "unknown")?.requirement?.text ?? "Waiting on an input.")
            : "All checks pass.",
    })),
    closestBlocked: closest,
    cultural: research
      ? {
          mode: research.mode,
          themes: research.themes.map((t) => ({
            title: t.title,
            items: t.items.map((i) => (i.affinity === null ? i.name : `${i.name} (${i.affinity.toFixed(2)})`)),
            source: `${t.provenance.request}, ${t.provenance.retrievedAt}`,
            provenance: t.provenance.kind,
          })),
          selectedVenue: selected
            ? {
                name: selected.venue.name,
                strength: selected.strength,
                affinity: selected.venue.affinity,
                source: `${selected.provenance.request}, ${selected.provenance.retrievedAt}`,
              }
            : null,
          limitations: research.limitations,
        }
      : null,
    inputs: [...guestInputs(guest), ...hostInputs(host)],
    unresolved,
    questions,
    method:
      "Deterministic constraint checks over three arrangement templates; Agreement Frontier by dominance over the parties' own ranked priorities; minimal changes verified by re-evaluation. No revenue, traffic, or demand forecasts.",
    limitations: [
      "Feasible means feasible on the stated requirements only. Nothing here is an agreement until both businesses confirm it.",
      "Insurance, liability, payment terms, restocking, and contracts are not modelled.",
      "Availability uses weekly windows in whole hours; specific dates must be agreed directly.",
    ],
  };
}

export function narrativeFacts(brief: DecisionBrief, guestName: string, hostName: string): NarrativeFacts {
  return {
    guestName: guestName.slice(0, 80),
    hostName: hostName.slice(0, 80),
    twoSidedStatus: brief.twoSided.status,
    proposed: brief.proposal
      ? { label: brief.proposal.label.slice(0, 80), status: brief.proposal.status, guestOutlayUsd: brief.proposal.guestOutlayUsd, hostFeeUsd: brief.proposal.hostFeeUsd }
      : null,
    blocked: brief.closestBlocked.slice(0, 4).map((b) => ({ label: b.label.slice(0, 80), reasons: b.reasons.slice(0, 4).map((r) => r.slice(0, 200)) })),
    minimalChanges: (brief.closestBlocked[0]?.changes ?? []).slice(0, 4).map((x) => x.slice(0, 200)),
    openQuestions: brief.questions.slice(0, 3).map((q) => q.text.slice(0, 200)),
    themeTitles: (brief.cultural?.themes ?? []).slice(0, 3).map((t) => t.title.slice(0, 80)),
  };
}

