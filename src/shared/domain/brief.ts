import { DAY_LABELS, FORMAT_LABELS, HOST_GOAL_LABELS, OBJECTIVE_LABELS, PRODUCT_CATEGORY_LABELS } from "../constants/vocabulary";
import type { CulturalTheme, ResearchRun } from "../schemas/evidence";
import type { NarrativeFacts } from "../schemas/narrative";
import type { ProvenanceKind } from "../schemas/common";
import type { GuestProfile, HostProfile, HostSource, Scenario } from "../schemas/profiles";
import type { VenueSelection } from "../schemas/selection";
import { type ActivationConcept, activationConcept } from "./activation";
import { affinityLabel, affinityText, influenceText } from "./affinity";
import { compareBridge, crossDomainTheme } from "./bridge";
import { compareDiscovery } from "./comparison";
import { clock, hours, money, weeks, windowLabel } from "./format";
import { guestProvenance, hostProvenance } from "./provenance";
import type { ArrangementOption, OptionStatus, ScenarioEvaluation } from "./types";

export interface BriefInput {
  party: "guest" | "host";
  label: string;
  value: string;
  provenance: ProvenanceKind;
  /** Set when a what-if brief changed this value: the party has not stated it, so it needs their confirmation. */
  proposedChange?: { from: string; confirmBy: "guest" | "host" };
}

/** A what-if value set against what the party actually stated. */
export interface ProposedChange {
  party: "guest" | "host";
  label: string;
  from: string;
  to: string;
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
    selectedVenue: { name: string; affinityLabel: string; affinity: number | null; source: string } | null;
    limitations: string[];
  } | null;
  /** How the host's terms were obtained. A hypothetical scenario always carries a disclaimer. */
  hostTerms: { source: HostSource; label: string; disclaimer: string | null };
  /** The venue chosen from research, with the evidence that led to it. */
  venue: {
    name: string;
    qlooEntityId: string;
    rank: number;
    /** Same wording as discovery, for example "High affinity · 0.78". */
    affinityLabel: string;
    affinity: number | null;
    address: string | null;
    influencedBy: string[];
    evidence: ProvenanceKind;
    request: string;
    retrievedAt: string;
    runId: string;
  } | null;
  /** A concrete idea for the proposal, from cultural evidence. Never part of any check. */
  activation: (ActivationConcept & { forOption: string }) | null;
  bridge: {
    guestSide: { title: string; items: string[]; source: string } | null;
    venueSide: { title: string; items: string[]; source: string } | null;
    shared: string[];
    sharedTags: string[];
    method: string;
    evidence: ProvenanceKind;
  } | null;
  discoveryComparison: { outcome: string; findings: string[]; onlyWithSignals: string[]; source: string } | null;
  /** What each kind of evidence can and cannot decide. */
  decides: { opportunity: string; feasibility: string; commercial: string };
  inputs: BriefInput[];
  /**
   * Present only when the brief was built from what-if values: each change still needs the named
   * party's confirmation, and `effects` lists the status changes the edits cause together.
   */
  counterproposal: { changes: ProposedChange[]; effects: string[] } | null;
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
function guestValue(g: GuestProfile, o: ArrangementOption, themes: CulturalTheme[], mode: ResearchRun["mode"] | null, activation: ActivationConcept | null): string[] {
  const live = o.format !== "shelf";
  const theme = themes[0]?.title;
  const named = activation?.items.map((i) => `“${i}”`).join(" and ");
  return g.objectives.map((obj) => {
    const head = OBJECTIVE_LABELS[obj];
    switch (obj) {
      case "new_customers":
        return `${head}: ${live ? `meets the host's visitors in person for ${hours(o.variant)}.` : `puts the range in front of the host's customers for ${weeks(o.variant)} without staff on site.`}`;
      case "cultural_relevance":
        return `${head}: ${
          activation && named
            ? `can be framed as a ${activation.title.toLowerCase()} built on ${named}, which ${mode === "live" ? "Qloo associates" : "the fictional fixture data associates"} with the guest's references.`
            : theme
            ? `can be framed around “${theme}”, which ${mode === "live" ? "Qloo associates" : "the fictional fixture data associates"} with the guest's references.`
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

const HOST_TERMS_LABEL: Record<HostSource, string> = {
  fictional_example: "Fictional example host",
  host_response_link: "Answered by the host through a private link",
  entered_by_guest: "Entered by the guest on the host's behalf, unconfirmed",
  hypothetical_scenario: "Hypothetical terms for exploration",
};

/** A selection describes this brief's venue only while the host still refers to that Qloo entity. */
export function linkedSelection(host: HostProfile, selection: VenueSelection | null): VenueSelection | null {
  return selection && host.qlooEntityId !== undefined && host.qlooEntityId === selection.candidate.venue.id.slice(0, 64) ? selection : null;
}

export function buildBrief(
  scenario: Scenario,
  evaluation: ScenarioEvaluation,
  research: ResearchRun | null,
  options: { hypothetical: boolean; selection: VenueSelection | null; now?: Date; stated?: { scenario: Scenario; evaluation: ScenarioEvaluation } },
): DecisionBrief {
  const { guest, host } = scenario;
  const selection = linkedSelection(host, options.selection);
  // The brief cites the run the venue was chosen from; without a linked venue, the latest run.
  const themes = selection ? selection.guestThemes : (research?.themes ?? []);
  const evidenceMode = selection ? selection.mode : (research?.mode ?? null);
  const evidenceKind: ProvenanceKind = evidenceMode === "fixture" ? "synthetic_demo" : "qloo_observed";
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

  const selected = selection?.candidate ?? null;
  // The concept is offered for the proposed option, or for the closest blocked one when nothing passes yet.
  const activationOption = proposalOption ?? evaluation.options.find((o) => o.id === evaluation.reversals[0]?.optionId) ?? null;
  const concept =
    activationOption && (themes.length > 0 || host.programmingInterests)
      ? activationConcept({
          format: activationOption.format,
          guestName: guest.businessName,
          guestProducts: guest.productCategories,
          host,
          themes,
          bridgeDomain: selection?.bridgeDomain ?? research?.bridgeDomain ?? null,
          venueBridge: selection?.venueBridge ?? null,
          signals: selection?.signals ?? (research?.seeds.filter((x) => x.status === "exact").map((x) => x.input.label) ?? []),
          evidenceMode,
        })
      : null;
  const cross = crossDomainTheme(themes);
  const bridgeCmp = selection ? compareBridge(cross, selection.venueBridge, selection.bridgeDomain) : null;
  const cmp =
    selection?.baseline && research?.runId === selection.runId ? compareDiscovery(research.candidates, selection.baseline.candidates, selection.baseline.depth) : null;
  const hypotheticalHost = host.source === "hypothetical_scenario";
  const { inputs, counterproposal } = withProposals(scenario, evaluation, options.hypothetical ? options.stated : undefined);
  const c = evaluation.counts;
  const lead = `Of ${evaluation.options.length} arrangements checked, ${c.feasible} ${c.feasible === 1 ? "is" : "are"} feasible on stated requirements, ${c.conditional} conditional, and ${c.no_go} no-go.`;
  const ifAccepted = counterproposal ? " If the proposed changes listed below are accepted," : "";
  const proposalText = proposalOption
    ? `${ifAccepted} The suggested starting point is ${proposalOption.label} (${proposalOption.status}): guest outlay ${proposalOption.metrics.guestOutlayUsd === null ? "unknown" : money(proposalOption.metrics.guestOutlayUsd)}, host fee ${proposalOption.metrics.hostFeeUsd === null ? "unknown" : money(proposalOption.metrics.hostFeeUsd)}.${unresolved.length ? ` It still depends on: ${unresolved.join(" ")}` : ""}`
    : " No option is currently feasible or conditional.";
  const closestText = closest[0] && closest[0].changes.length ? ` The closest blocked option, ${closest[0].label}, would need: ${closest[0].changes.join(" ")}` : "";

  return {
    title: `${guest.businessName} × ${host.venueName}${hypotheticalHost ? " (hypothetical terms)" : ""}`,
    generatedAt: (options.now ?? new Date()).toISOString(),
    engineVersion: evaluation.engineVersion,
    fictional: guest.origin === "synthetic_demo" || host.source === "fictional_example" || hypotheticalHost,
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
    guestValue: proposalOption ? guestValue(guest, proposalOption, themes, evidenceMode, concept?.format === proposalOption.format ? concept : null) : [],
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
    cultural:
      research || selection
      ? {
          mode: evidenceMode ?? "fixture",
          themes: themes.map((t) => ({
            title: t.title,
            items: t.items.map((i) => (i.affinity === null ? i.name : `${i.name} (${affinityText(i.affinity)})`)),
            source: `${t.provenance.request}, ${t.provenance.retrievedAt}`,
            provenance: t.provenance.kind,
          })),
          selectedVenue: selected
            ? {
                name: selected.venue.name,
                affinityLabel: affinityLabel(selected.strength, selected.venue.affinity),
                affinity: selected.venue.affinity,
                source: `${selected.provenance.request}, ${selected.provenance.retrievedAt}`,
              }
            : null,
          limitations:
            selection && research?.runId !== selection.runId
              ? [`The venue and its evidence come from an earlier research run, retrieved ${selection.candidate.provenance.retrievedAt}.`]
              : (research?.limitations ?? []),
        }
      : null,
    hostTerms: {
      source: host.source,
      label: HOST_TERMS_LABEL[host.source],
      disclaimer: hypotheticalHost
        ? `${host.venueName} has not seen, stated, or agreed to any term in this brief. Every host value is a fictional placeholder used to explore the method. The venue was suggested by cultural research, which says nothing about its fees, schedule, or interest in partnering.`
        : null,
    },
    venue:
      selected && selection
        ? {
            name: selected.venue.name,
            qlooEntityId: selected.venue.id,
            rank: selected.rank,
            affinityLabel: affinityLabel(selected.strength, selected.venue.affinity),
            affinity: selected.venue.affinity,
            address: selected.venue.address,
            influencedBy: influenceText(selected.contributions),
            evidence: selected.provenance.kind,
            request: selected.provenance.request,
            retrievedAt: selected.provenance.retrievedAt,
            runId: selection.runId,
          }
        : null,
    activation: concept && activationOption ? { ...concept, forOption: activationOption.label } : null,
    bridge:
      cross || bridgeCmp
        ? {
            guestSide: cross ? { title: cross.title, items: cross.items.map((i) => i.name), source: `${cross.provenance.request}, ${cross.provenance.retrievedAt}` } : null,
            venueSide: selection?.venueBridge
              ? {
                  title: `${selection.venueBridge.noun} linked to ${selection.venueBridge.venueName}`,
                  items: selection.venueBridge.items.map((i) => i.name),
                  source: `${selection.venueBridge.provenance.request}, ${selection.venueBridge.provenance.retrievedAt}`,
                }
              : null,
            shared: bridgeCmp?.shared.map((x) => x.name) ?? [],
            sharedTags: bridgeCmp?.sharedTags ?? [],
            method: bridgeCmp?.method ?? "Guest-side bridge only: no venue-side evidence was retrieved for this brief.",
            evidence: evidenceKind,
          }
        : null,
    discoveryComparison:
      cmp && selection?.baseline
        ? { outcome: cmp.outcome, findings: cmp.findings, onlyWithSignals: cmp.onlyWithSignals, source: `${selection.baseline.provenance.request}, ${selection.baseline.provenance.retrievedAt}` }
        : null,
    decides: {
      opportunity: "Cultural opportunity, what might be worth trying: suggested by cultural evidence, which picks the venue to approach and the theme to propose.",
      feasibility: "Operational feasibility, what the stated terms permit: decided only by deterministic checks of both parties' stated terms. Cultural evidence never enters these checks.",
      commercial: "Commercial success, whether it pays off: unknown. Nothing here forecasts revenue, traffic, or demand.",
    },
    inputs,
    counterproposal,
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

/**
 * Compares what-if values with the parties' stated ones. A changed value is a proposal, not a
 * statement, so its provenance becomes unknown until the party that owns it confirms it.
 */
function withProposals(
  scenario: Scenario,
  evaluation: ScenarioEvaluation,
  stated: { scenario: Scenario; evaluation: ScenarioEvaluation } | undefined,
): { inputs: BriefInput[]; counterproposal: DecisionBrief["counterproposal"] } {
  const current = [...guestInputs(scenario.guest), ...hostInputs(scenario.host)];
  if (!stated) return { inputs: current, counterproposal: null };
  const before = new Map([...guestInputs(stated.scenario.guest), ...hostInputs(stated.scenario.host)].map((i) => [`${i.party}.${i.label}`, i]));
  const effects = evaluation.options.flatMap((a) => {
    const b = stated.evaluation.options.find((o) => o.id === a.id);
    return b && b.status !== a.status ? [`${a.label}: ${STATUS_WORDS[b.status]} → ${STATUS_WORDS[a.status]}`] : [];
  });
  const proposedChanges: ProposedChange[] = [];
  const inputs = current.map((i) => {
    const was = before.get(`${i.party}.${i.label}`);
    if (!was || was.value === i.value) return i;
    proposedChanges.push({ party: i.party, label: i.label, from: was.value, to: i.value });
    return { ...i, provenance: "unknown" as const, proposedChange: { from: was.value, confirmBy: i.party } };
  });
  return { inputs, counterproposal: proposedChanges.length ? { changes: proposedChanges, effects } : null };
}

const STATUS_WORDS: Record<OptionStatus, string> = { feasible: "feasible", conditional: "conditional", no_go: "no-go" };

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

