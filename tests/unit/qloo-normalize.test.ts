import { describe, expect, it } from "vitest";
import { contributions, decodeEntities, normalizeEntities, normalizeTags, resolvedLocality } from "../../src/worker/integrations/qloo/normalize";
import { sameName } from "../../src/worker/orchestration/research";

/**
 * Payloads here are synthetic. Their structure mirrors field names and nesting observed in
 * authenticated responses (recorded as field lists, never values) so the normaliser is tested
 * against the shape it really receives.
 */

const livePlacePayload = {
  success: true,
  results: {
    entities: [
      {
        name: "Synthetic Books &amp; Coffee",
        entity_id: "SYN-PLACE-1",
        type: "urn:entity",
        subtype: "urn:entity:place",
        popularity: 0.91,
        properties: { address: "1 Synthetic Ave", is_closed: false, neighborhood: null, price_level: null, hours: { monday: [{}] } },
        location: { lat: 40.72, lon: -73.95, geohash: "dr5rs" },
        tags: [{ id: "urn:tag:synthetic:place:readings", name: "Readings", type: "urn:tag:synthetic:place", weight: null }],
        query: {
          affinity: 0.82,
          distance: 0,
          measurements: { audience_growth: 0 },
          explainability: {
            "signal.interests.entities": [
              { entity_id: "SYN-BOOK-1", score: 0.52 },
              { entity_id: "SYN-BRAND-1", score: 0.48 },
            ],
          },
        },
      },
      {
        name: "Synthetic Closed Shop",
        entity_id: "SYN-PLACE-2",
        subtype: "urn:entity:place",
        popularity: null,
        properties: { address: null, is_closed: true },
        location: null,
        tags: null,
        query: { affinity: 0.7 },
      },
    ],
  },
  query: { localities: { filter: [{ entity_id: "SYN-LOC-1", name: "Synthetic Borough", subtype: "urn:entity:locality" }] } },
};

describe("Qloo normaliser against observed live shapes", () => {
  it("parses place results with null optional fields instead of dropping them", () => {
    const venues = normalizeEntities(livePlacePayload, 5);
    expect(venues).toHaveLength(2);
    expect(venues[0]).toMatchObject({ id: "SYN-PLACE-1", name: "Synthetic Books & Coffee", affinity: 0.82, address: "1 Synthetic Ave", closed: false });
    expect(venues[0]?.location).toEqual({ lat: 40.72, lon: -73.95 });
    expect(venues[1]).toMatchObject({ id: "SYN-PLACE-2", popularity: null, address: null, location: null, tags: [], closed: true });
  });

  it("reads per-reference explainability from the list form returned live", () => {
    const [venue] = normalizeEntities(livePlacePayload, 1);
    const seeds = new Map([
      ["syn-book-1", "A Book"],
      ["syn-brand-1", "A Brand"],
    ]);
    expect(contributions(venue?.explainability, seeds)).toEqual([
      { seed: "A Book", score: 0.52 },
      { seed: "A Brand", score: 0.48 },
    ]);
  });

  it("reports the locality Qloo resolved a location query to", () => {
    expect(resolvedLocality(livePlacePayload)).toBe("Synthetic Borough");
    expect(resolvedLocality({ results: {} })).toBeNull();
    expect(resolvedLocality(null)).toBeNull();
  });

  it("reads taste tags that carry tag_id and subtype", () => {
    const tags = normalizeTags({ results: { tags: [{ tag_id: "urn:tag:synthetic:qloo:calm", name: "Calm", subtype: "urn:tag:synthetic:qloo", query: { affinity: 0.98 } }] } }, 8);
    expect(tags).toEqual([{ id: "urn:tag:synthetic:qloo:calm", name: "Calm", type: "urn:tag:synthetic:qloo", affinity: 0.98 }]);
  });

  it("decodes HTML entities in names without inventing characters", () => {
    expect(decodeEntities("Motors &amp; Grass")).toBe("Motors & Grass");
    expect(decodeEntities("It&#39;s &quot;fine&quot; &#x2014; ok")).toBe(`It's "fine" — ok`);
    expect(decodeEntities("&unknown; &#0; plain")).toBe("&unknown; &#0; plain");
  });
});

describe("reference name matching", () => {
  it("treats a main title before a subtitle as an exact match", () => {
    expect(sameName("Braiding Sweetgrass: Indigenous Wisdom, Scientific Knowledge", "Braiding Sweetgrass")).toBe(true);
    expect(sameName("Aesop", "aesop")).toBe(true);
    expect(sameName("Book store", "Bookstore")).toBe(true);
  });

  it("keeps partial and look-alike names approximate", () => {
    expect(sameName("The Spirit of Sweetgrass", "Sweetgrass")).toBe(false);
    expect(sameName("Sweetgrass Collected Edition", "Sweetgrass")).toBe(false);
    expect(sameName("Braiding Sweetgrass: Young Adult Edition", "Braiding Sweetgrass: Indigenous Wisdom")).toBe(false);
    expect(sameName("", "Aesop")).toBe(false);
  });
});

describe("thematic tag filter", () => {
  it("keeps themes and drops formats, age brackets, and narrative voice", async () => {
    const { isThematicTag } = await import("../../src/worker/integrations/qloo/normalize");
    expect(isThematicTag({ name: "Nature Writing", type: "urn:tag:keyword:qloo" })).toBe(true);
    expect(isThematicTag({ name: "Sustainability", type: "urn:tag:theme:qloo" })).toBe(true);
    expect(isThematicTag({ name: "25-29", type: "urn:tag:age_ranges:qloo" })).toBe(false);
    expect(isThematicTag({ name: "Paperback", type: "urn:tag:book_format:qloo" })).toBe(false);
    expect(isThematicTag({ name: "first person", type: "urn:tag:narrative:qloo" })).toBe(false);
    expect(isThematicTag({ name: "Audiobook", type: "urn:tag:genre:media" })).toBe(false);
    expect(isThematicTag({ name: "55+" })).toBe(false);
  });
});
