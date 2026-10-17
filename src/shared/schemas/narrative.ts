import { z } from "zod";
import { ShortText } from "./common";

const Line = z.string().trim().min(1).max(200);

/**
 * The only input the optional language-model summary accepts: facts the deterministic engine
 * already computed. There is no free-form prompt field, so the endpoint cannot be used as a
 * general-purpose model proxy.
 */
export const NarrativeFacts = z.strictObject({
  guestName: ShortText,
  hostName: ShortText,
  twoSidedStatus: z.enum(["two_sided", "fictional_two_sided", "hypothetical_host", "one_sided"]),
  proposed: z
    .strictObject({
      label: z.string().trim().min(1).max(80),
      status: z.enum(["feasible", "conditional"]),
      guestOutlayUsd: z.number().int().min(0).max(1_000_000).nullable(),
      hostFeeUsd: z.number().int().min(0).max(1_000_000).nullable(),
    })
    .nullable(),
  blocked: z.array(z.strictObject({ label: z.string().trim().min(1).max(80), reasons: z.array(Line).max(4) })).max(4),
  minimalChanges: z.array(Line).max(4),
  openQuestions: z.array(Line).max(3),
  themeTitles: z.array(z.string().trim().min(1).max(80)).max(3),
});
export type NarrativeFacts = z.infer<typeof NarrativeFacts>;

export const NarrativeRequest = z.strictObject({
  facts: NarrativeFacts,
  /** The visitor must explicitly accept that the facts are sent to a third-party model. */
  consent: z.literal(true),
});

export const NarrativeResponse = z.object({
  summary: z.string(),
  provenance: z.literal("llm_interpretation"),
  model: z.string(),
});
export type NarrativeResponse = z.infer<typeof NarrativeResponse>;
