import { z } from "zod";
import { Format, ShortText } from "./common";
import { HostProfile, ProductCategory, Scenario, VenueCategory } from "./profiles";

export const ApiError = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() }),
});
export type ApiError = z.infer<typeof ApiError>;

export const EvaluateRequest = z.strictObject({ scenario: Scenario });

export const PublicConfig = z.object({
  researchMode: z.enum(["live", "fixture"]),
  narrativeEnabled: z.boolean(),
  callBudget: z.number(),
  maxSeedsPerRun: z.number(),
  hostLinksEnabled: z.boolean(),
});
export type PublicConfig = z.infer<typeof PublicConfig>;

/**
 * What a guest chooses to share with a host through a response link. Budgets, own costs, and
 * notes are deliberately absent: the host sees only what the guest would put in a first email.
 */
export const SharedSummary = z.strictObject({
  guestBusinessName: ShortText,
  productCategories: z.array(ProductCategory).min(1).max(5),
  proposedFormats: z.array(Format).min(1).max(3),
  venueName: ShortText,
  venueCategory: VenueCategory,
  culturalTheme: z.string().trim().max(160).optional(),
  message: z.string().trim().max(500).optional(),
});
export type SharedSummary = z.infer<typeof SharedSummary>;

export const CreateHostRequest = z.strictObject({ summary: SharedSummary });

export const CreateHostRequestResponse = z.object({
  requestId: z.string(),
  hostToken: z.string(),
  ownerToken: z.string(),
  expiresAt: z.number(),
  editsAllowed: z.number(),
});
export type CreateHostRequestResponse = z.infer<typeof CreateHostRequestResponse>;

/** The host never chooses its own provenance label: the server sets `source`. */
export const HostAnswerRequest = z.strictObject({ host: HostProfile.omit({ source: true }) });
export type HostAnswerRequest = z.infer<typeof HostAnswerRequest>;

export const HostRequestView = z.object({
  summary: SharedSummary,
  status: z.enum(["pending", "submitted", "revoked"]),
  expiresAt: z.number(),
  editsRemaining: z.number(),
  host: HostProfile.nullable(),
});
export type HostRequestView = z.infer<typeof HostRequestView>;

export const OwnerRequestView = z.object({
  requestId: z.string(),
  status: z.enum(["pending", "submitted", "revoked"]),
  expiresAt: z.number(),
  submittedAt: z.number().nullable(),
  host: HostProfile.nullable(),
});
export type OwnerRequestView = z.infer<typeof OwnerRequestView>;
