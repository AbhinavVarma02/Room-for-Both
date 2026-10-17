import { z } from "zod";
import { BaselineResult, CulturalTheme, PartnershipCandidate, VenueBridge } from "./evidence";

/**
 * A venue the guest chose from a research run, frozen with the evidence that led to it. The snapshot
 * travels with the workspace, so a later research run can never silently swap the venue's evidence,
 * and the brief always cites the run, request, and retrieval time the choice came from.
 */
export const VenueSelection = z.object({
  candidate: PartnershipCandidate,
  runId: z.string().max(64),
  mode: z.enum(["live", "fixture"]),
  selectedAt: z.string().max(40),
  /** The exactly matched references that served as taste signals in that run. */
  signals: z.array(z.string().max(80)).max(5),
  /** The guest-side cultural bridge from the same run. */
  guestThemes: z.array(CulturalTheme).max(4),
  /** The cross-domain type of that bridge, when one was used. */
  bridgeDomain: z.string().nullable(),
  /** Venue-side evidence, fetched after the selection (null until fetched or when unavailable). */
  venueBridge: VenueBridge.nullable(),
  /** Why venue-side evidence is missing, when a lookup was attempted and returned nothing usable. */
  venueBridgeNote: z.string().max(300).nullable().optional(),
  /** The category-only comparison for the same run, when the visitor ran it. */
  baseline: BaselineResult.nullable(),
});
export type VenueSelection = z.infer<typeof VenueSelection>;
