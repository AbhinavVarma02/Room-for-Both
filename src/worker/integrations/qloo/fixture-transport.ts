import { QlooError, type QlooPath, type QlooTransport, type QueryValue } from "./client";

/**
 * Fixture transport used when no Qloo credential is configured, and by offline tests.
 * Every name, score, and tag below is invented for this project and labelled "(fictional)"
 * or prefixed `fixture`, so it can never be mistaken for a Qloo observation. Payloads mimic the
 * documented response shapes so the same normalisation code runs in both modes. It returns no
 * addresses or coordinates, because we do not fabricate locations.
 */

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "item";

const VENUE_STEMS = ["Larkspur & Lamp", "Marginalia", "The Quiet Page", "Fern & Folio", "Second Story", "Lantern Row"];
// Without a taste signal the fictional list leads with two broadly popular venues and reverses the rest,
// so the demonstration's category-only comparison has visible differences, as live lists can.
const POPULAR_STEMS = ["Corner Chapter", "Atlas Annex"];
const VENUE_SCORES = [0.91, 0.86, 0.79, 0.72, 0.64, 0.53];
const TASTE_TAGS = ["Slow living", "Nature writing", "Refill culture", "Botanical design", "Local makers", "Quiet hobbies", "Zero waste", "Poetry nights"];
const TASTE_SCORES = [0.88, 0.84, 0.77, 0.73, 0.69, 0.61, 0.57, 0.49];
const CROSS_DOMAIN: Record<string, string[]> = {
  "urn:entity:book": ["Small Mornings", "A Field Guide to Patience", "The Refill Year", "Moss and Margin", "Notes from a Window Garden", "Salt, Soap, and Stone"],
  "urn:entity:artist": ["The Quiet Hours", "Fernlight", "Low Tide Choir", "Paper Lanterns", "Willow Static", "North Window"],
  "urn:entity:podcast": ["Slow Made", "The Maker's Table", "Field Notes Radio", "Small Batch Hour", "Green Room Talks", "Window Box"],
};
const CROSS_SCORES = [0.9, 0.83, 0.8, 0.74, 0.66, 0.58];
const VENUE_SIDE: Record<string, string[]> = {
  "urn:entity:book": ["Letters to a Young Gardener", "The Borrowed Lamp", "City of Small Hours", "Ink on the Riverbank"],
  "urn:entity:artist": ["Harbour Lights Trio", "Cassette Weather", "The Late Bloomers", "Velvet Almanac"],
  "urn:entity:podcast": ["Shelf Life Radio", "Neighbourhood Hours", "The Long Table", "Open Studio"],
};

function str(v: QueryValue): string {
  if (v === undefined) return "";
  return Array.isArray(v) ? v.join(",") : String(v);
}

export class FixtureTransport implements QlooTransport {
  #calls = 0;
  constructor(
    private readonly budget: number,
    private readonly failWith?: QlooError,
  ) {}

  get callsUsed(): number {
    return this.#calls;
  }

  async get(path: QlooPath, query: Record<string, QueryValue>): Promise<unknown> {
    if (this.#calls >= this.budget) {
      throw new QlooError("BUDGET_EXHAUSTED", `This research run reached its limit of ${this.budget} Qloo calls.`);
    }
    this.#calls += 1;
    if (this.failWith) throw this.failWith;

    if (path === "/search") {
      const q = str(query.query).trim();
      if (q.toLowerCase().includes("unknown")) return { results: [] };
      return { results: [{ entity_id: `fixture-seed-${slug(q)}`, name: q, types: [str(query.types) || "urn:entity:brand"], popularity: 0.5 }] };
    }

    if (path === "/v2/tags") {
      const q = str(query["filter.query"]).trim();
      return { results: { tags: [{ id: `fixture:tag:${slug(q)}`, name: q, type: "fixture:tag:place" }] } };
    }

    if (path === "/v2/insights") {
      const type = str(query["filter.type"]);
      const take = Math.min(Number(str(query.take) || 5), 10);
      const seeds = str(query["signal.interests.entities"]).split(",").filter(Boolean);
      if (type === "urn:entity:place") {
        const category = str(query["filter.tags"]).split(":").pop()?.replace(/-/g, " ") ?? "venue";
        const label = category.replace(/\b\w/g, (c) => c.toUpperCase());
        const location = str(query["filter.location.query"]).toLowerCase();
        if (location.includes("nowhere")) return { results: { entities: [] } };
        const tasteOrder = VENUE_STEMS.map((stem, i) => ({ stem, i }));
        // A fictional dependence, so the reference-sensitivity check can show both outcomes: the list
        // reorders whenever its first reference is not the alphabetically first one sent. For the
        // example's references, only leaving out the first one changes the order.
        const reordered = seeds.length >= 2 && seeds[0] !== [...seeds].sort()[0];
        const ordered =
          seeds.length === 0
            ? [...POPULAR_STEMS.map((stem, j) => ({ stem, i: VENUE_STEMS.length + j })), ...VENUE_STEMS.map((stem, i) => ({ stem, i })).reverse()]
            : reordered
              ? [tasteOrder[2], tasteOrder[3], tasteOrder[0], tasteOrder[1], ...tasteOrder.slice(4)].filter((v) => v !== undefined)
              : tasteOrder;
        return {
          success: true,
          results: {
            entities: ordered.slice(0, take).map(({ stem, i }, position) => ({
              entity_id: `fixture-venue-${i + 1}`,
              name: `${stem} ${label} (fictional)`,
              type: "urn:entity",
              subtype: "urn:entity:place",
              popularity: 0.4 + i * 0.05,
              tags: [TASTE_TAGS[(i + 1) % TASTE_TAGS.length], TASTE_TAGS[(i + 3) % TASTE_TAGS.length], "Community events"].map((name) => ({
                id: `fixture:tag:${slug(name ?? "")}`,
                name,
                type: "fixture:tag",
              })),
              query: {
                affinity: seeds.length > 0 ? VENUE_SCORES[position] : undefined,
                explainability: Object.fromEntries(seeds.map((id, j) => [id, Math.max(0.1, 0.8 - 0.2 * j - 0.05 * i)])),
              },
            })),
          },
        };
      }
      if (type === "urn:tag") {
        return {
          success: true,
          results: {
            tags: TASTE_TAGS.slice(0, take).map((name, i) => ({
              tag_id: `fixture:tag:${slug(name)}`,
              name,
              subtype: "fixture:tag",
              query: { affinity: TASTE_SCORES[i] },
            })),
          },
        };
      }
      const names = CROSS_DOMAIN[type];
      if (names && seeds.some((id) => id.startsWith("fixture-venue-"))) {
        // A venue used as the signal: two titles overlap with the guest-side list, the rest are its own.
        const own = (VENUE_SIDE[type] ?? []).map((name, i) => ({ name, id: `fixture-venue-side-${slug(type)}-${i + 1}`, tag: TASTE_TAGS[(i + 4) % TASTE_TAGS.length] }));
        const shared = [1, 3].map((i) => ({ name: names[i] ?? "", id: `fixture-${slug(type)}-${i + 1}`, tag: TASTE_TAGS[i] }));
        return {
          success: true,
          results: {
            entities: [shared[0], ...own.slice(0, 2), shared[1], ...own.slice(2)].slice(0, take).map((item, i) => ({
              entity_id: item?.id,
              name: `${item?.name ?? ""} (fictional)`,
              subtype: type,
              popularity: 0.5,
              tags: [{ id: `fixture:tag:${slug(item?.tag ?? "")}`, name: item?.tag, type: "fixture:tag" }],
              query: { affinity: CROSS_SCORES[i] },
            })),
          },
        };
      }
      if (names) {
        return {
          success: true,
          results: {
            entities: names.slice(0, take).map((name, i) => ({
              entity_id: `fixture-${slug(type)}-${i + 1}`,
              name: `${name} (fictional)`,
              subtype: type,
              popularity: 0.5,
              tags: [{ id: `fixture:tag:${slug(TASTE_TAGS[i] ?? "")}`, name: TASTE_TAGS[i], type: "fixture:tag" }],
              query: { affinity: CROSS_SCORES[i] },
            })),
          },
        };
      }
    }
    return { results: [] };
  }
}
