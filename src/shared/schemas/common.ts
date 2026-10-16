import { z } from "zod";
import { DAYS, FORMATS } from "../constants/vocabulary";

export const PROVENANCE_KINDS = [
  "qloo_observed",
  "party_supplied",
  "synthetic_demo",
  "derived_rule",
  "llm_interpretation",
  "unknown",
] as const;
export const ProvenanceKind = z.enum(PROVENANCE_KINDS);
export type ProvenanceKind = z.infer<typeof ProvenanceKind>;

export const PROVENANCE_LABELS: Record<ProvenanceKind, string> = {
  qloo_observed: "Observed in Qloo",
  party_supplied: "Supplied by a party",
  synthetic_demo: "Fictional example",
  derived_rule: "Derived by a stated rule",
  llm_interpretation: "Language-model draft",
  unknown: "Unknown",
};

export const Day = z.enum(DAYS);
export const Format = z.enum(FORMATS);

// Whole US dollars keep the arithmetic exact; cents would add precision nobody negotiates over.
export const Money = z.number().int().min(0).max(1_000_000);
export const NullableMoney = Money.nullable();

export const Hour = z.number().int().min(0).max(24);

export const TimeWindow = z
  .strictObject({
    day: Day,
    start: Hour,
    end: Hour,
  })
  .refine((w) => w.end > w.start, { message: "End hour must be after start hour" });
export type TimeWindow = z.infer<typeof TimeWindow>;

export const Availability = z.array(TimeWindow).max(14);
export type Availability = z.infer<typeof Availability>;

export const ShortText = z.string().trim().min(1).max(80);
export const OptionalNote = z.string().trim().max(500).optional();

export const Party = z.enum(["guest", "host"]);
export type Party = z.infer<typeof Party>;
