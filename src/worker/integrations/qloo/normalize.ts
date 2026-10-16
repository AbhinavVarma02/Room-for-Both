import { z } from "zod";
import type { QlooEntity, QlooTag, Strength } from "../../../shared/schemas/evidence";

/**
 * Upstream payloads are untrusted input. We validate item by item, keep only the fields we
 * display, cap string lengths and list sizes, and drop anything malformed instead of failing
 * the whole run. Field names follow Qloo's documented responses: results may be an array
 * (search) or an object keyed by `entities` / `tags` (insights), entities carry `entity_id`,
 * tags carry `id` or `tag_id`, and scores live under `query.affinity` when present.
 */

const RawTag = z.object({
  id: z.string().optional(),
  tag_id: z.string().optional(),
  name: z.string(),
  type: z.string().optional(),
  subtype: z.string().optional(),
  query: z.object({ affinity: z.number().optional() }).passthrough().optional(),
  affinity: z.number().optional(),
}).passthrough();

const RawLocation = z
  .object({
    lat: z.number().optional(),
    lon: z.number().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .passthrough();

const RawEntity = z
  .object({
    entity_id: z.string().optional(),
    id: z.string().optional(),
    name: z.string(),
    type: z.string().optional(),
    subtype: z.string().optional(),
    types: z.array(z.string()).optional(),
    popularity: z.number().optional(),
    affinity: z.number().optional(),
    properties: z
      .object({
        address: z.string().optional(),
      })
      .passthrough()
      .optional(),
    location: RawLocation.optional(),
    tags: z.array(z.unknown()).optional(),
    query: z
      .object({
        affinity: z.number().optional(),
        explainability: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function resultItems(payload: unknown, key: "entities" | "tags"): unknown[] {
  if (typeof payload !== "object" || payload === null) return [];
  const results = (payload as { results?: unknown }).results;
  if (Array.isArray(results)) return results;
  if (typeof results === "object" && results !== null) {
    const inner = (results as Record<string, unknown>)[key];
    return Array.isArray(inner) ? inner : [];
  }
  return [];
}

export function normalizeTag(raw: unknown): (QlooTag & { affinity: number | null }) | null {
  const parsed = RawTag.safeParse(raw);
  if (!parsed.success) return null;
  const t = parsed.data;
  const id = t.id ?? t.tag_id;
  if (!id) return null;
  return {
    id: clip(id, 200),
    name: clip(t.name, 120),
    ...(t.type ?? t.subtype ? { type: clip((t.type ?? t.subtype) as string, 120) } : {}),
    affinity: finite01(t.affinity ?? t.query?.affinity),
  };
}

function finite01(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  // Affinity and popularity are documented on a 0–1 scale in API responses.
  return value >= 0 && value <= 1 ? value : null;
}

function coordinates(loc: z.infer<typeof RawLocation> | undefined): { lat: number; lon: number } | null {
  if (!loc) return null;
  const lat = loc.lat ?? loc.latitude;
  const lon = loc.lon ?? loc.longitude;
  if (lat === undefined || lon === undefined) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

export interface NormalizedEntity extends QlooEntity {
  explainability: unknown;
}

export function normalizeEntity(raw: unknown): NormalizedEntity | null {
  const parsed = RawEntity.safeParse(raw);
  if (!parsed.success) return null;
  const e = parsed.data;
  const id = e.entity_id ?? e.id;
  if (!id) return null;
  const tags = (e.tags ?? [])
    .map(normalizeTag)
    .filter((t): t is NonNullable<ReturnType<typeof normalizeTag>> => t !== null)
    .slice(0, 12)
    .map(({ affinity: _affinity, ...tag }) => tag);
  return {
    id: clip(id, 80),
    name: clip(e.name, 200),
    type: clip(e.subtype ?? e.type ?? e.types?.[0] ?? "urn:entity", 80),
    popularity: finite01(e.popularity),
    affinity: finite01(e.affinity ?? e.query?.affinity),
    tags,
    address: e.properties?.address ? clip(e.properties.address, 240) : null,
    location: coordinates(e.location),
    explainability: e.query?.explainability,
  };
}

export function normalizeEntities(payload: unknown, limit: number): NormalizedEntity[] {
  return resultItems(payload, "entities")
    .map(normalizeEntity)
    .filter((e): e is NormalizedEntity => e !== null)
    .slice(0, limit);
}

export function normalizeTags(payload: unknown, limit: number): (QlooTag & { affinity: number | null })[] {
  return resultItems(payload, "tags")
    .map(normalizeTag)
    .filter((t): t is NonNullable<ReturnType<typeof normalizeTag>> => t !== null)
    .slice(0, limit);
}

/**
 * Qloo's documented interpretation: above 0.8 is very high, 0.6–0.8 high, around 0.5 medium,
 * below that low, and scores are relative to the query that produced them.
 */
export function strengthOf(affinity: number | null): Strength {
  if (affinity === null) return "unscored";
  if (affinity > 0.8) return "strong";
  if (affinity >= 0.6) return "moderate";
  return "weak";
}

/**
 * Explainability is documented as normalised 0–1 contributions of each input entity. We accept
 * either an object keyed by entity ID or a list of `{entity_id|id, score}` records, and ignore
 * any other shape rather than guessing at it.
 */
export function contributions(explainability: unknown, seedNames: Map<string, string>): { seed: string; score: number }[] {
  const out: { seed: string; score: number }[] = [];
  const push = (id: unknown, score: unknown) => {
    if (typeof id !== "string" || typeof score !== "number" || !Number.isFinite(score)) return;
    const name = seedNames.get(id.toLowerCase());
    if (name && score >= 0 && score <= 1) out.push({ seed: name, score });
  };
  const visit = (node: unknown, depth: number) => {
    if (depth > 3 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 20)) {
        if (item && typeof item === "object") {
          const r = item as Record<string, unknown>;
          push(r.entity_id ?? r.id, r.score ?? r.value);
          visit(item, depth + 1);
        }
      }
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>).slice(0, 40)) {
      if (typeof v === "number") push(k, v);
      else visit(v, depth + 1);
    }
  };
  visit(explainability, 0);
  const best = new Map<string, number>();
  for (const c of out) best.set(c.seed, Math.max(best.get(c.seed) ?? 0, c.score));
  return [...best.entries()].map(([seed, score]) => ({ seed, score })).sort((a, b) => b.score - a.score).slice(0, 5);
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
