import { z } from "zod";
import { ShortText } from "./common";
import { BRIDGE_DOMAIN_TYPES } from "../constants/vocabulary";
import { PlannerDecision, PlannerTrace } from "./planner";
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
  /** Thematic tag names Qloo returned on the item; used to find shared themes, never as a score. */
  tags: z.array(z.string().max(120)).max(6).optional(),
});
export type ThemeItem = z.infer<typeof ThemeItem>;

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
  /** Run the labelled fictional demonstration even when live access is configured. */
  demo: z.literal(true).optional(),
  /** Ask the model planner to propose decisions. Honoured only with explicit consent below. */
  planner: z.enum(["deterministic", "model"]).optional(),
  /** The visitor agreed to send references and the venue category to the model provider. */
  plannerConsent: z.literal(true).optional(),
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
  /** The venue search that produced the candidates, so a category-only comparison can repeat it exactly. */
  venueSearch: z.object({ location: z.string(), categoryTagId: z.string(), categoryName: z.string(), take: z.number().int() }).nullable().optional(),
  /** The cross-domain type used for the cultural bridge, when one was used. */
  bridgeDomain: z.string().nullable().optional(),
  /** Which planner made each decision, what was proposed, and what ran. */
  planner: PlannerTrace.optional(),
});
export type ResearchRun = z.infer<typeof ResearchRun>;

// Identifiers from a previous response that a follow-up request may send back. They only ever become
// Qloo query parameters, so a strict character set is enough to keep them inert.
const EntityId = z.string().trim().regex(/^[A-Za-z0-9_.:-]{1,80}$/);
const TagId = z.string().trim().regex(/^[A-Za-z0-9_.:-]{1,200}$/);

/** Category-only discovery: the same category and location as a taste-informed run, with no taste signal. */
export const BaselineRequest = z.strictObject({
  categoryTagId: TagId,
  categoryName: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(60),
  venueCategory: VenueCategory,
  demo: z.literal(true).optional(),
});
export type BaselineRequest = z.infer<typeof BaselineRequest>;

export const BaselineResult = z.object({
  mode: z.enum(["live", "fixture"]),
  request: BaselineRequest,
  candidates: z.array(PartnershipCandidate).max(10),
  depth: z.number().int(),
  provenance: EvidenceProvenance,
  callsUsed: z.number().int(),
  limitations: z.array(z.string()),
});
export type BaselineResult = z.infer<typeof BaselineResult>;

/**
 * The same question asked of a language model with no Qloo data, as a baseline. Explicit consent is
 * required because the references and area go to the model provider.
 */
export const LlmBaselineRequest = z.strictObject({
  seeds: z.array(CulturalSeed).max(3),
  city: ShortText,
  neighborhood: z.string().trim().max(60).optional(),
  venueCategory: VenueCategory,
  guestCategories: z.array(ProductCategory).min(1).max(5),
  consent: z.literal(true),
});
export type LlmBaselineRequest = z.infer<typeof LlmBaselineRequest>;

export const LlmBaselineResult = z.object({
  model: z.string(),
  venues: z.array(z.object({ name: z.string().max(80), reason: z.string().max(160) })).max(5),
  discarded: z.number().int(),
  provenance: z.literal("llm_interpretation"),
  limitations: z.array(z.string()),
});
export type LlmBaselineResult = z.infer<typeof LlmBaselineResult>;

/** Venue-side evidence: what Qloo associates with the selected venue itself, in the bridge's domain. */
export const VenueBridgeRequest = z.strictObject({
  venueId: EntityId,
  venueName: z.string().trim().min(1).max(200),
  venueCategory: VenueCategory,
  /** The domain the guest-side bridge used, so both sides stay comparable. Defaults by category. */
  domain: z.enum(BRIDGE_DOMAIN_TYPES as [string, ...string[]]).optional(),
  demo: z.literal(true).optional(),
});
export type VenueBridgeRequest = z.infer<typeof VenueBridgeRequest>;

export const VenueBridge = z.object({
  mode: z.enum(["live", "fixture"]),
  venueId: z.string(),
  venueName: z.string(),
  domain: z.string(),
  title: z.string(),
  noun: z.string(),
  items: z.array(ThemeItem).max(10),
  provenance: EvidenceProvenance,
  callsUsed: z.number().int(),
  limitations: z.array(z.string()),
});
export type VenueBridge = z.infer<typeof VenueBridge>;

export const ResearchEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("plan"), mode: z.enum(["live", "fixture"]), steps: z.array(z.object({ id: ResearchStepId, label: z.string() })) }),
  z.object({ type: z.literal("step"), step: ResearchStep }),
  z.object({ type: z.literal("decision"), decision: PlannerDecision }),
  z.object({ type: z.literal("result"), run: ResearchRun }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string(), retryable: z.boolean() }),
]);
export type ResearchEvent = z.infer<typeof ResearchEvent>;

