import type { QlooEntity, QlooTag } from "../../../shared/schemas/evidence";

/**
 * Upstream payloads are untrusted input. We validate item by item, keep only the fields we
 * display, cap string lengths and list sizes, and drop anything malformed instead of failing
 * the whole run. We read fields with direct type checks rather than a schema library: one live
 * run carries about 30 entities with 1,500 nested tags, and validating each through a schema cost
 * more CPU than the Workers Free allowance on a fresh isolate. Fields of the wrong type count as absent. Field names follow Qloo's documented responses: results may be an array
 * (search) or an object keyed by `entities` / `tags` (insights), entities carry `entity_id`,
 * tags carry `id` or `tag_id`, and scores live under `query.affinity` when present.
 */

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Live names arrive HTML-escaped (for example "Motorcycles &amp; Sweetgrass"). We decode the few
// entities we have seen plus numeric ones; React escapes the result again when it renders.
const NAMED_ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", "#39": "'", lt: "<", gt: ">", nbsp: " " };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]+|#39);/gi, (match, code: string) => {
    const named = NAMED_ENTITIES[code.toLowerCase()];
    if (named !== undefined) return named;
    const n = code.startsWith("#x") || code.startsWith("#X") ? Number.parseInt(code.slice(2), 16) : code.startsWith("#") ? Number.parseInt(code.slice(1), 10) : Number.NaN;
    return Number.isFinite(n) && n > 31 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
  });
}

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
  const t = obj(raw);
  const name = str(t?.name);
  const id = str(t?.id) ?? str(t?.tag_id);
  if (!t || name === undefined || !id) return null;
  const type = str(t.type) ?? str(t.subtype);
  return {
    id: clip(id, 200),
    name: clip(decodeEntities(name), 120),
    ...(type ? { type: clip(type, 120) } : {}),
    affinity: finite01(num(t.affinity) ?? num(obj(t.query)?.affinity)),
  };
}

function finite01(value: number | null | undefined): number | null {
  if (value === undefined || value === null || !Number.isFinite(value)) return null;
  // Affinity and popularity are documented on a 0–1 scale in API responses.
  return value >= 0 && value <= 1 ? value : null;
}

function coordinates(loc: Obj | null): { lat: number; lon: number } | null {
  if (!loc) return null;
  const lat = num(loc.lat) ?? num(loc.latitude);
  const lon = num(loc.lon) ?? num(loc.longitude);
  if (lat === undefined || lon === undefined) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

export interface NormalizedEntity extends QlooEntity {
  explainability: unknown;
  /** Qloo marks some places as closed; we surface that rather than recommend them. */
  closed: boolean;
}

export function normalizeEntity(raw: unknown): NormalizedEntity | null {
  const e = obj(raw);
  const name = str(e?.name);
  const id = str(e?.entity_id) ?? str(e?.id);
  if (!e || name === undefined || !id) return null;
  // Live entities carry 80+ tags; we stop once we have a bounded set of thematic ones.
  const tags: QlooTag[] = [];
  if (Array.isArray(e.tags)) {
    for (const rawTag of e.tags) {
      if (tags.length >= 12) break;
      const tag = normalizeTag(rawTag);
      if (tag && isThematicTag(tag)) tags.push({ id: tag.id, name: tag.name, ...(tag.type ? { type: tag.type } : {}) });
    }
  }
  const properties = obj(e.properties);
  const query = obj(e.query);
  const types = Array.isArray(e.types) ? str(e.types[0]) : undefined;
  const address = str(properties?.address);
  return {
    id: clip(id, 80),
    name: clip(decodeEntities(name), 200),
    type: clip(str(e.subtype) ?? str(e.type) ?? types ?? "urn:entity", 80),
    popularity: finite01(num(e.popularity)),
    affinity: finite01(num(e.affinity) ?? num(query?.affinity)),
    tags,
    address: address ? clip(address, 240) : null,
    location: coordinates(obj(e.location)),
    explainability: query?.explainability,
    closed: properties?.is_closed === true,
  };
}

export function normalizeEntities(payload: unknown, limit: number): NormalizedEntity[] {
  const out: NormalizedEntity[] = [];
  for (const item of resultItems(payload, "entities")) {
    if (out.length >= limit) break;
    const entity = normalizeEntity(item);
    if (entity) out.push(entity);
  }
  return out;
}

// Live entity tags mix themes with formats, age brackets, narrative voice, and payment or price
// metadata. Those say nothing about shared taste, so we never count them as a cultural overlap.
const NON_THEMATIC_TYPE = /(age_range|demographic|audience|gender|format|media_type|narrative|time_period|credit_card|price|cost|hours|rating|parking|accessib)/;
const NON_THEMATIC_NAME = /^(audiobook|e-?book|hardcover|paperback|print|digital|non-?fiction|fiction)$/i;

export function isThematicTag(tag: { name: string; type?: string | undefined }): boolean {
  if (tag.type && NON_THEMATIC_TYPE.test(tag.type)) return false;
  const name = tag.name.trim();
  return !NON_THEMATIC_NAME.test(name) && !/^\d+\s*(-\s*\d+|\+)?$/.test(name);
}

/** The locality Qloo resolved `filter.location.query` to, when the response reports it. */
export function resolvedLocality(payload: unknown): string | null {
  const filter = (payload as { query?: { localities?: { filter?: unknown } } } | null)?.query?.localities?.filter;
  const first: unknown = Array.isArray(filter) ? filter[0] : undefined;
  const name = first && typeof first === "object" ? (first as { name?: unknown }).name : undefined;
  return typeof name === "string" && name.trim() !== "" ? clip(decodeEntities(name.trim()), 120) : null;
}

export function normalizeTags(payload: unknown, limit: number): (QlooTag & { affinity: number | null })[] {
  const out: (QlooTag & { affinity: number | null })[] = [];
  for (const item of resultItems(payload, "tags")) {
    if (out.length >= limit) break;
    const tag = normalizeTag(item);
    if (tag) out.push(tag);
  }
  return out;
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
