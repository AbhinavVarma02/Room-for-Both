import { CROSS_DOMAIN_BY_VENUE, PRODUCT_CATEGORY_LABELS, type Format, type ProductCategory } from "../constants/vocabulary";
import type { ProvenanceKind } from "../schemas/common";
import type { CulturalTheme, VenueBridge } from "../schemas/evidence";
import type { HostProfile } from "../schemas/profiles";
import { compareBridge, crossDomainTheme } from "./bridge";

/**
 * A concrete idea for what the two businesses could propose, built from cultural evidence. It is
 * creative framing only: it never enters a constraint, fee, schedule, or feasibility check, and it
 * lists what the evidence cannot tell either party.
 */
export interface ActivationConcept {
  format: Format;
  title: string;
  pitch: string;
  items: string[];
  basis: "shared" | "guest" | "tags" | "host_interests";
  why: string[];
  unverified: string[];
  sources: ProvenanceKind[];
}

export interface ActivationInput {
  format: Format;
  guestName: string;
  guestProducts: ProductCategory[];
  host: Pick<HostProfile, "venueName" | "source" | "programmingInterests">;
  themes: CulturalTheme[];
  bridgeDomain: string | null;
  venueBridge: VenueBridge | null;
  signals: string[];
  evidenceMode: "live" | "fixture" | null;
}

export type Nouns = "books" | "music artists" | "podcasts" | "tags";

export const TITLES: Record<Nouns, Record<Format, string>> = {
  books: { cohosted_event: "Reading-list evening", shelf: "Reading-list shelf pairing", popup: "Pop-up beside a themed book table" },
  "music artists": { cohosted_event: "Listening evening", shelf: "Listening-corner shelf pairing", popup: "Pop-up with a listening theme" },
  podcasts: { cohosted_event: "Conversation evening", shelf: "Shelf pairing with a conversation theme", popup: "Pop-up with a conversation theme" },
  tags: { cohosted_event: "Theme night", shelf: "Themed shelf pairing", popup: "Themed pop-up" },
};

// Live book titles carry long subtitles; the main title is enough in a sentence.
const short = (name: string) => {
  const colon = name.indexOf(": ");
  return colon > 3 ? name.slice(0, colon) : name;
};

export function quotedList(names: string[]): string {
  const quoted = names.map((n) => `“${short(n)}”`);
  if (quoted.length <= 1) return quoted.join("");
  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
}

export function pitchFor(noun: Nouns, format: Format, venue: string, guest: string, products: string, items: string[]): string {
  const named = quotedList(items);
  if (noun === "tags") {
    const themes = items.map((i) => i.toLowerCase()).join(", ");
    if (format === "cohosted_event") return `A co-hosted evening at ${venue} on the theme of ${themes}, with ${guest}'s ${products} as part of it.`;
    if (format === "shelf") return `A shelf at ${venue} that presents ${guest}'s ${products} under the theme of ${themes}.`;
    return `A one-day ${guest} pop-up at ${venue} styled around ${themes}.`;
  }
  const work = noun === "books" ? "the books" : noun === "music artists" ? "the music" : "the conversations these shows are known for";
  if (format === "cohosted_event") {
    return noun === "books"
      ? `A co-hosted evening at ${venue} built around ${named}, with ${guest}'s ${products} alongside the reading list.`
      : noun === "music artists"
        ? `A co-hosted evening at ${venue} with a playlist drawn from ${named}, with ${guest}'s ${products} as part of the setting.`
        : `A co-hosted conversation evening at ${venue} on themes from ${named}, with ${guest}'s ${products} as part of the setting.`;
  }
  if (format === "shelf") return `A shelf at ${venue} that pairs ${guest}'s ${products} with ${work}: ${named}.`;
  return `A one-day ${guest} pop-up at ${venue} with a display drawn from ${named}.`;
}

/**
 * Picks the items the concept is built around: those Qloo returned for both the guest's references
 * and the venue itself first, then the guest-side bridge, then taste tags.
 */
export function activationConcept(input: ActivationInput): ActivationConcept | null {
  const { format, host } = input;
  const venue = host.venueName;
  const products = input.guestProducts.map((c) => PRODUCT_CATEGORY_LABELS[c].toLowerCase()).join(" and ") || "products";
  const cross = crossDomainTheme(input.themes);
  const bridge = compareBridge(cross, input.venueBridge, input.bridgeDomain);
  const fixture = input.evidenceMode === "fixture";
  const observedBy = fixture ? "In this fictional demonstration, the data associates" : "Qloo associates";
  const signals = input.signals.length ? quotedList(input.signals) : "the guest's references";

  let noun: Nouns;
  let items: string[];
  let basis: ActivationConcept["basis"];
  const why: string[] = [];

  if (cross && bridge && bridge.shared.length > 0) {
    noun = nounFor(input.bridgeDomain, cross.title);
    items = bridge.shared.slice(0, 3).map((s) => s.name);
    basis = "shared";
    why.push(
      `${quotedList(items)} appear in both directions: ${fixture ? "the fictional data associates them" : "Qloo associates them"} with ${signals} and with ${venue} itself (same kind of request, matched by entity ID).`,
    );
  } else if (cross && cross.items.length > 0) {
    noun = nounFor(input.bridgeDomain, cross.title);
    items = cross.items.slice(0, 3).map((i) => i.name);
    basis = "guest";
    why.push(`${observedBy} ${signals} with ${quotedList(items)}.`);
    if (bridge?.comparable) {
      why.push(
        bridge.sharedTags.length
          ? `None of these titles came back for ${venue} itself, but both lists share the taste tags ${quotedList(bridge.sharedTags.slice(0, 4))}.`
          : `None of them came back in Qloo's results for ${venue} itself, so this theme reflects the guest's side only.`,
      );
    }
  } else {
    const tags = input.themes.find((t) => t.basis === "taste_tags");
    if (tags && tags.items.length > 0) {
      noun = "tags";
      items = tags.items.slice(0, 3).map((i) => i.name);
      basis = "tags";
      why.push(`${observedBy} ${signals} with the taste tags ${quotedList(items)}.`);
    } else if (host.programmingInterests) {
      noun = "tags";
      items = [host.programmingInterests.slice(0, 60)];
      basis = "host_interests";
    } else {
      return null;
    }
  }

  if (host.programmingInterests && basis !== "host_interests") {
    why.push(
      `${host.source === "host_response_link" ? "The venue says" : "The venue's stated interests (entered on its behalf) say"} it wants programming around: “${host.programmingInterests}”.`,
    );
  } else if (basis === "host_interests") {
    why.push(`Built from the venue's own stated programming interests: “${host.programmingInterests}”. No cultural research result was available for this venue category.`);
  }
  why.push("A fixed rule turns the strongest associated items into a theme for this format. It never changes a fee, a schedule, or whether an option passes.");

  const unverified = [
    `Whether ${venue} wants to host this theme.`,
    "Whether either business's customers would come or buy: affinity describes aggregate taste, not demand.",
  ];
  if (noun === "books" && format !== "popup") unverified.push(`Whether ${venue} stocks or would order these titles.`);
  if (noun !== "tags") unverified.push("Any author, artist, or show is used as a theme only; featuring them would need their own agreement.");
  if (host.source === "hypothetical_scenario") unverified.push(`The host terms this format was checked against are hypothetical, not ${venue}'s.`);

  const hostKind: ProvenanceKind = host.source === "fictional_example" || host.source === "hypothetical_scenario" ? "synthetic_demo" : "party_supplied";
  const sources: ProvenanceKind[] = [];
  if (basis !== "host_interests") sources.push(fixture ? "synthetic_demo" : "qloo_observed");
  if (host.programmingInterests) sources.push(hostKind);
  sources.push("derived_rule");

  return {
    format,
    title: TITLES[noun][format],
    pitch: pitchFor(noun, format, venue, input.guestName, products, items),
    items,
    basis,
    why,
    unverified,
    sources: [...new Set(sources)],
  };
}

const NOUN_BY_TYPE = new Map<string, string>(Object.values(CROSS_DOMAIN_BY_VENUE).map((d) => [d.type, d.noun]));
const NOUN_BY_TITLE = new Map<string, string>(Object.values(CROSS_DOMAIN_BY_VENUE).map((d) => [d.title, d.noun]));

/** Runs saved before the bridge recorded its domain carry only the theme title, so we accept either. */
export function nounFor(domain: string | null, title: string): Nouns {
  const noun = (domain ? NOUN_BY_TYPE.get(domain) : undefined) ?? NOUN_BY_TITLE.get(title);
  return noun && noun in TITLES ? (noun as Nouns) : "tags";
}
