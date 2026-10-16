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
const VENUE_SCORES = [0.91, 0.86, 0.79, 0.72, 0.64, 0.53];
const TASTE_TAGS = ["Slow living", "Nature writing", "Refill culture", "Botanical design", "Local makers", "Quiet hobbies", "Zero waste", "Poetry nights"];
const TASTE_SCORES = [0.88, 0.84, 0.77, 0.73, 0.69, 0.61, 0.57, 0.49];
const CROSS_DOMAIN: Record<string, string[]> = {
  "urn:entity:book": ["Small Mornings", "A Field Guide to Patience", "The Refill Year", "Moss and Margin", "Notes from a Window Garden", "Salt, Soap, and Stone"],
  "urn:entity:artist": ["The Quiet Hours", "Fernlight", "Low Tide Choir", "Paper Lanterns", "Willow Static", "North Window"],
  "urn:entity:podcast": ["Slow Made", "The Maker's Table", "Field Notes Radio", "Small Batch Hour", "Green Room Talks", "Window Box"],
};
const CROSS_SCORES = [0.9, 0.83, 0.8, 0.74, 0.66, 0.58];

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
        return {
          success: true,
          results: {
            entities: VENUE_STEMS.slice(0, take).map((stem, i) => ({
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
                affinity: seeds.length > 0 ? VENUE_SCORES[i] : undefined,
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
