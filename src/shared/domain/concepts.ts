import { FORMAT_LABELS, PRODUCT_CATEGORY_LABELS, type Format, type ProductCategory } from "../constants/vocabulary";
import type { ProvenanceKind } from "../schemas/common";
import type { CulturalTheme, VenueBridge } from "../schemas/evidence";
import type { HostProfile } from "../schemas/profiles";
import { type Nouns, TITLES, nounFor, pitchFor, quotedList } from "./activation";
import { compareBridge, crossDomainTheme } from "./bridge";
import type { ArrangementOption, OptionStatus, ScenarioEvaluation } from "./types";

/**
 * Proposal concepts: distinct collaboration ideas, each built from a different slice of the cultural
 * evidence and paired with what the rules engine says about the formats it suits. The evidence picks
 * the idea; only the parties' stated terms decide whether a format works. Nothing here is a score.
 */

export type ConceptBasis = "shared" | "venue_side" | "guest_side" | "taste_tags" | "host_interests";

export interface ConceptFormat {
  format: Format;
  optionId: string;
  label: string;
  status: OptionStatus;
  /** Why the best option in this format has its status, in the engine's own words. */
  note: string;
}

export interface ProposalConcept {
  basis: ConceptBasis;
  /**
   * How directly the evidence connects both parties: 3 titles linked to both, 2 a shared taste tag, 1 one side
   * only, 0 nothing that ties it to the guest. Ideas are ordered by it; a 0 is never marked to discuss first.
   */
  linkage: 0 | 1 | 2 | 3;
  title: string;
  /** The lead format's name for this theme, for example "Reading-list shelf pairing". */
  formatTitle: string;
  /** What the evidence is, and whose side it describes. */
  angle: string;
  items: string[];
  observed: string[];
  interpretation: string;
  formats: ConceptFormat[];
  /** The format to propose first: the best status among the formats this concept suits. */
  lead: ConceptFormat | null;
  pitch: string;
  hostConfirmations: string[];
  unverified: string[];
  mightNotSuit: string[];
  sources: ProvenanceKind[];
}

export interface ConceptInput {
  guestName: string;
  guestProducts: ProductCategory[];
  host: Pick<HostProfile, "venueName" | "source" | "programmingInterests">;
  themes: CulturalTheme[];
  bridgeDomain: string | null;
  venueBridge: VenueBridge | null;
  signals: string[];
  evidenceMode: "live" | "fixture" | null;
}

/**
 * Which formats each kind of evidence suits, as a stated rule: titles both audiences share fit a
 * shared evening or a shelf pairing; the venue's own favourites fit the guest joining the venue's
 * world (shelf, pop-up); the guest's favourites fit the guest bringing its audience (event, pop-up);
 * taste tags are a mood for styling (pop-up, shelf); stated programming interests fit an event.
 */
const FITS: Record<ConceptBasis, Format[]> = {
  shared: ["cohosted_event", "shelf"],
  venue_side: ["shelf", "popup"],
  guest_side: ["cohosted_event", "popup"],
  taste_tags: ["popup", "shelf"],
  host_interests: ["cohosted_event"],
};

const ANGLES: Record<ConceptBasis, string> = {
  shared: "Both sides: titles linked to the guest's references and to the venue itself",
  venue_side: "The venue's side: what its own profile is linked to",
  guest_side: "The guest's side: what its references are linked to",
  taste_tags: "A shared mood: taste tags rather than specific titles",
  host_interests: "The venue's own words: its stated programming interests",
};

const WORK: Record<Nouns, string> = { books: "reading list", "music artists": "playlist", podcasts: "listening list", tags: "theme" };

function titleFor(basis: ConceptBasis, n: Nouns, items: string[]): string {
  switch (basis) {
    case "shared":
      return `A ${WORK[n]} both audiences share`;
    case "venue_side":
      return `Start from the venue's own ${n === "tags" ? "themes" : n}`;
    case "guest_side":
      return `The brand's ${WORK[n]}`;
    case "taste_tags":
      return `A mood: ${items.map((i) => i.toLowerCase()).join(", ")}`.slice(0, 80);
    case "host_interests":
      return `The venue's interests: ${items[0] ?? ""}`.slice(0, 80);
  }
}

const RANK: Record<OptionStatus, number> = { feasible: 0, conditional: 1, no_go: 2 };

function noteFor(o: ArrangementOption, evaluation: ScenarioEvaluation): string {
  if (o.status === "feasible") return "Feasible on both parties' stated terms.";
  if (o.status === "conditional") {
    const waiting = [...new Set(o.constraints.filter((c) => c.status === "unknown").map((c) => c.requirement?.text ?? c.explanation))];
    return `Waiting on: ${waiting.join(" ")}`;
  }
  const reason = o.constraints.find((c) => c.status === "fail")?.explanation ?? "Blocked on current terms.";
  const change = evaluation.reversals.find((r) => r.optionId === o.id)?.minimalChange;
  return change?.verified ? `${reason} Smallest verified change: ${change.changes.map((c) => c.description).join(" ")}` : reason;
}

function formatsFor(basis: ConceptBasis, evaluation: ScenarioEvaluation): ConceptFormat[] {
  return FITS[basis].flatMap((format) => {
    // Options arrive ranked, so the first of the best status is the one the frontier would lead with.
    const best = evaluation.options.filter((o) => o.format === format).sort((a, b) => RANK[a.status] - RANK[b.status])[0];
    return best ? [{ format, optionId: best.id, label: best.label, status: best.status, note: noteFor(best, evaluation) }] : [];
  });
}

function hostWaits(lead: ConceptFormat | null, evaluation: ScenarioEvaluation): string[] {
  const o = lead && evaluation.options.find((x) => x.id === lead.optionId);
  if (!o) return [];
  return [...new Set(o.constraints.filter((c) => c.status === "unknown" && c.requirement?.party === "host").map((c) => c.requirement?.text ?? c.explanation))];
}

export function proposalConcepts(input: ConceptInput, evaluation: ScenarioEvaluation): ProposalConcept[] {
  const venue = input.host.venueName;
  const products = input.guestProducts.map((c) => PRODUCT_CATEGORY_LABELS[c].toLowerCase()).join(" and ") || "products";
  const fixture = input.evidenceMode === "fixture";
  const data = fixture ? "The fictional demonstration data" : "Qloo";
  const evidenceKind: ProvenanceKind = fixture ? "synthetic_demo" : "qloo_observed";
  const signals = input.signals.length ? quotedList(input.signals) : "the guest's references";
  const cross = crossDomainTheme(input.themes);
  const bridge = compareBridge(cross, input.venueBridge, input.bridgeDomain);
  const noun: Nouns = cross ? nounFor(input.bridgeDomain, cross.title) : "tags";
  const tagsTheme = input.themes.find((t) => t.basis === "taste_tags");
  const out: ProposalConcept[] = [];

  const add = (basis: ConceptBasis, linkage: ProposalConcept["linkage"], n: Nouns, items: string[], observed: string[], mightNotSuit: string[], sources: ProvenanceKind[]) => {
    const formats = formatsFor(basis, evaluation);
    const lead = [...formats].sort((a, b) => RANK[a.status] - RANK[b.status])[0] ?? null;
    const format = lead?.format ?? FITS[basis][0] ?? "cohosted_event";
    const unverified = ["Whether either business's customers would come or buy: affinity describes aggregate taste, not demand."];
    if (n === "books" && format !== "popup") unverified.push(`Whether ${venue} stocks or would order these titles.`);
    if (n !== "tags") unverified.push("Any author, artist, or show is a theme only; featuring them would need their own agreement.");
    if (input.host.source === "hypothetical_scenario") unverified.push(`The host terms behind these statuses are hypothetical, not ${venue}'s.`);
    const blocked = formats.length > 0 && formats.every((f) => f.status === "no_go");
    out.push({
      basis,
      linkage,
      title: titleFor(basis, n, items),
      formatTitle: TITLES[n][format],
      angle: ANGLES[basis],
      items,
      observed,
      interpretation: `A fixed rule turns these items into a theme and matches it to ${FITS[basis].map((f) => FORMAT_LABELS[f].toLowerCase()).join(" or ")}. Which format works is decided only by the parties' stated terms.`,
      formats,
      lead,
      pitch: pitchFor(n, format, venue, input.guestName, products, items),
      hostConfirmations: [`Whether ${venue} wants to host this theme.`, ...hostWaits(lead, evaluation)],
      unverified,
      mightNotSuit: [
        ...mightNotSuit,
        ...(blocked ? [`Every format this idea suits is no-go on current terms. ${lead?.note ?? ""}`.trim()] : []),
        ...(fixture ? ["Built from fictional demonstration data, not Qloo results."] : []),
      ],
      sources: [...new Set([...sources, "derived_rule" as const])],
    });
  };

  if (cross && bridge && bridge.shared.length > 0) {
    const items = bridge.shared.slice(0, 3).map((s) => s.name);
    add(
      "shared",
      3,
      noun,
      items,
      [`${data} links ${quotedList(items)} both to ${signals} and to ${venue} itself (same kind of request, matched by entity ID).`],
      bridge.shared.length === 1 ? ["Rests on a single title found on both sides."] : [],
      [evidenceKind],
    );
  }

  if (cross && bridge?.comparable && bridge.venueOnly.length > 0) {
    const items = bridge.venueOnly.slice(0, 3).map((i) => i.name);
    add(
      "venue_side",
      bridge.sharedTags.length ? 2 : 0,
      noun,
      items,
      [`${data} links ${quotedList(items)} to ${venue} itself.`],
      [
        bridge.sharedTags.length
          ? `These did not come back for the guest's references; the link to the guest is only the shared taste tags ${quotedList(bridge.sharedTags.slice(0, 3))}.`
          : "These did not come back for the guest's references, so nothing in the evidence ties them to the guest's audience.",
      ],
      [evidenceKind],
    );
  }

  const guestItems = (bridge?.comparable ? bridge.guestOnly : (cross?.items ?? [])).slice(0, 3).map((i) => i.name);
  if (cross && guestItems.length > 0) {
    add(
      "guest_side",
      1,
      noun,
      guestItems,
      [`${data} links ${signals} with ${quotedList(guestItems)}.`],
      [
        !input.venueBridge
          ? "The venue's own side was not looked up, so this reflects the guest's audience only."
          : bridge?.comparable
            ? `None of these came back for ${venue} itself.`
            : "The venue's side used a different kind of result, so it cannot confirm or contradict these titles.",
      ],
      [evidenceKind],
    );
  }

  const tagItems = (bridge?.sharedTags.length ? bridge.sharedTags : (tagsTheme?.items.map((i) => i.name) ?? [])).slice(0, 3);
  if (tagItems.length > 0) {
    const twoSided = Boolean(bridge?.sharedTags.length);
    add(
      "taste_tags",
      twoSided ? 2 : 1,
      "tags",
      tagItems,
      [twoSided ? `Taste tags on titles from both sides: ${quotedList(tagItems)}.` : `${data} links ${signals} with the taste tags ${quotedList(tagItems)}.`],
      ["Taste tags name a broad mood, not specific programming, so the theme still has to be made concrete with the venue."],
      [evidenceKind],
    );
  }

  if (input.host.programmingInterests) {
    const hostKind: ProvenanceKind = input.host.source === "fictional_example" || input.host.source === "hypothetical_scenario" ? "synthetic_demo" : "party_supplied";
    add(
      "host_interests",
      1,
      "tags",
      [input.host.programmingInterests.slice(0, 60)],
      [`${input.host.source === "host_response_link" ? "The venue says" : "The venue's interests, entered on its behalf, say"} it wants programming around “${input.host.programmingInterests}”.`],
      out.length > 0 ? [] : ["No cultural research result supports it; it rests on the venue's words alone."],
      [hostKind],
    );
  }

  // Stable sort: the strongest two-sided link first, construction order within the same strength.
  return out.map((c, i) => ({ c, i })).sort((a, b) => b.c.linkage - a.c.linkage || a.i - b.i).map(({ c }) => c);
}

/**
 * The first idea with a workable format and some evidence tied to the guest, so the screen can say what to
 * discuss first. An idea resting only on the venue's own associations is shown but never recommended first.
 */
export function mostPromising(concepts: ProposalConcept[]): ProposalConcept | null {
  return concepts.find((c) => c.linkage > 0 && c.lead && c.lead.status !== "no_go") ?? null;
}
