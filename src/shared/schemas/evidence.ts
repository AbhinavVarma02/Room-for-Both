import { z } from "zod";
import { ShortText } from "./common";
import { CulturalSeed, ProductCategory, VenueCategory } from "./profiles";

export const EvidenceProvenance = z.object({
  kind: z.enum(["qloo_observed", "synthetic_demo", "derived_rule"]),
  /** Upstream route the value came from, never the full URL or credentials. */
  endpoint: z.string().max(40).optional(),
  /** Human-readable description of the request that produced the value. */
  request: z.string().max(300),
  retrievedAt: z.string().max(40),
  note: z.string().max(300).optional(),
});
export type EvidenceProvenance = z.infer<typeof EvidenceProvenance>;

export const Strength = z.enum(["strong", "moderate", "weak", "unscored"]);
export type Strength = z.infer<typeof Strength>;

export const QlooTag = z.object({
  id: z.string().max(200),
  name: z.string().max(120),
  type: z.string().max(120).optional(),
});
export type QlooTag = z.infer<typeof QlooTag>;

export const QlooEntity = z.object({
  id: z.string().max(80),
  name: z.string().max(200),
  type: z.string().max(80),
  popularity: z.number().nullable(),
  affinity: z.number().nullable(),
  tags: z.array(QlooTag).max(12),
  address: z.string().max(240).nullable(),
  location: z.object({ lat: z.number(), lon: z.number() }).nullable(),
});
export type QlooEntity = z.infer<typeof QlooEntity>;

export const ResolvedSeed = z.object({
  input: CulturalSeed,
  status: z.enum(["exact", "uncertain", "unresolved"]),
  entity: z.object({ id: z.string(), name: z.string(), type: z.string() }).nullable(),
  alternatives: z.array(z.object({ id: z.string(), name: z.string() })).max(4),
  provenance: EvidenceProvenance,
});
export type ResolvedSeed = z.infer<typeof ResolvedSeed>;

export const SeedContribution = z.object({ seed: z.string(), score: z.number() });

export const PartnershipCandidate = z.object({
  venue: QlooEntity,
  category: VenueCategory,
  rank: z.number().int().min(1),
  strength: Strength,
  contributions: z.array(SeedContribution).max(5),
  sharedTags: z.array(z.string()).max(8),
  provenance: EvidenceProvenance,
});
export type PartnershipCandidate = z.infer<typeof PartnershipCandidate>;

export const ThemeItem = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  affinity: z.number().nullable(),
  strength: Strength,
});

export const CulturalTheme = z.object({
  id: z.string(),
  title: z.string(),
  basis: z.enum(["taste_tags", "cross_domain"]),
  rationale: z.string(),
  items: z.array(ThemeItem).max(10),
  provenance: EvidenceProvenance,
  interpretation: z.literal("derived_rule"),
});
export type CulturalTheme = z.infer<typeof CulturalTheme>;

export const ResearchStepId = z.enum([
  "resolve_seeds",
  "resolve_category",
  "find_venues",
  "broaden_location",
  "cultural_bridge",
]);
export type ResearchStepId = z.infer<typeof ResearchStepId>;

export const ResearchStep = z.object({
  id: ResearchStepId,
  tool: z.string(),
  status: z.enum(["done", "skipped", "failed"]),
  calls: z.number().int().min(0),
  summary: z.string(),
  durationMs: z.number().min(0),
});
export type ResearchStep = z.infer<typeof ResearchStep>;

export const ResearchRequest = z.strictObject({
  seeds: z.array(CulturalSeed).max(5),
  city: ShortText,
  neighborhood: z.string().trim().max(60).optional(),
  venueCategory: VenueCategory,
  guestCategories: z.array(ProductCategory).min(1).max(5),
  maxCandidates: z.number().int().min(1).max(8).default(5),
});
export type ResearchRequest = z.infer<typeof ResearchRequest>;

export const ResearchRun = z.object({
  runId: z.string(),
  mode: z.enum(["live", "fixture"]),
  request: ResearchRequest,
  steps: z.array(ResearchStep),
  seeds: z.array(ResolvedSeed),
  categoryTag: z
    .object({ id: z.string(), name: z.string(), status: z.enum(["exact", "uncertain"]), provenance: EvidenceProvenance })
    .nullable(),
  candidates: z.array(PartnershipCandidate),
  themes: z.array(CulturalTheme),
  limitations: z.array(z.string()),
  callsUsed: z.number().int(),
  callBudget: z.number().int(),
  durationMs: z.number(),
});
export type ResearchRun = z.infer<typeof ResearchRun>;

export const ResearchEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("plan"), mode: z.enum(["live", "fixture"]), steps: z.array(z.object({ id: ResearchStepId, label: z.string() })) }),
  z.object({ type: z.literal("step"), step: ResearchStep }),
  z.object({ type: z.literal("result"), run: ResearchRun }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string(), retryable: z.boolean() }),
]);
export type ResearchEvent = z.infer<typeof ResearchEvent>;

