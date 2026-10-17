import type { CulturalTheme, ThemeItem, VenueBridge } from "../schemas/evidence";

export interface SharedItem {
  id: string;
  name: string;
  guestAffinity: number | null;
  venueAffinity: number | null;
}

/**
 * The two directions of the cultural bridge, side by side: what Qloo associates with the guest's
 * references and what it associates with the venue itself, in the same domain. Items are matched by
 * Qloo entity ID only. Each side's affinity is relative to its own request, so the two are shown
 * separately and never combined into a match percentage.
 */
export interface BridgeComparison {
  /** True only when both sides came from the same request type, so item-by-item comparison is meaningful. */
  comparable: boolean;
  noun: string;
  shared: SharedItem[];
  sharedTags: string[];
  guestOnly: ThemeItem[];
  venueOnly: ThemeItem[];
  method: string;
}

const key = (s: string) => s.trim().toLowerCase();

/** The guest-side theme that a venue-side lookup can be compared with: the cross-domain list. */
export function crossDomainTheme(themes: CulturalTheme[]): CulturalTheme | null {
  return themes.find((t) => t.basis === "cross_domain") ?? null;
}

export function compareBridge(guest: CulturalTheme | null, venue: VenueBridge | null, guestDomain: string | null): BridgeComparison | null {
  if (!venue) return null;
  const comparable = guest !== null && guestDomain !== null && guestDomain === venue.domain;
  const guestItems = comparable && guest ? guest.items : [];
  const venueIds = new Map(venue.items.map((i) => [i.id, i]));
  const shared: SharedItem[] = guestItems
    .filter((g) => venueIds.has(g.id))
    .map((g) => ({ id: g.id, name: g.name, guestAffinity: g.affinity, venueAffinity: venueIds.get(g.id)?.affinity ?? null }));
  const sharedIds = new Set(shared.map((s) => s.id));

  const guestTags = new Map<string, string>();
  for (const item of guestItems) for (const t of item.tags ?? []) guestTags.set(key(t), t);
  const sharedTags: string[] = [];
  for (const item of venue.items) {
    for (const t of item.tags ?? []) {
      const name = guestTags.get(key(t));
      if (name && !sharedTags.includes(name)) sharedTags.push(name);
    }
  }

  return {
    comparable,
    noun: venue.noun,
    shared,
    sharedTags: sharedTags.slice(0, 8),
    guestOnly: guestItems.filter((i) => !sharedIds.has(i.id)),
    venueOnly: venue.items.filter((i) => !sharedIds.has(i.id)),
    method: comparable
      ? `Both lists are ${venue.noun} from the same kind of request, one signalled by the guest's references and one by the venue's own entity. Items are matched by entity ID; tags are matched by name. Scores stay with their own list.`
      : `The guest-side bridge used a different kind of result, so the venue's ${venue.noun} are shown on their own and not matched item by item.`,
  };
}
