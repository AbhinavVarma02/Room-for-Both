import { z } from "zod";
import {
  GUEST_CRITERIA,
  GUEST_DEALBREAKERS,
  HOST_CRITERIA,
  HOST_GOALS,
  OBJECTIVES,
  PRODUCT_CATEGORIES,
  SECTORS,
  SEED_KINDS,
  VENUE_CATEGORIES,
} from "../constants/vocabulary";
import { Availability, Format, NullableMoney, OptionalNote, ShortText } from "./common";

export const ProductCategory = z.enum(PRODUCT_CATEGORIES);
export const Objective = z.enum(OBJECTIVES);
export const HostGoal = z.enum(HOST_GOALS);
export const VenueCategory = z.enum(VENUE_CATEGORIES);
export const SeedKind = z.enum(SEED_KINDS);
export const GuestDealbreaker = z.enum(GUEST_DEALBREAKERS);
export const GuestCriterion = z.enum(GUEST_CRITERIA);
export const HostCriterion = z.enum(HOST_CRITERIA);

export const CulturalSeed = z.strictObject({
  label: ShortText,
  kind: SeedKind,
});
export type CulturalSeed = z.infer<typeof CulturalSeed>;

export const GUEST_NEGOTIABLE_FIELDS = [
  "maxOutlayUsd",
  "ownCostPerActivationUsd",
  "availability",
  "popupFootprintSqFt",
  "shelfLinearFt",
  "minEventAudience",
  "staffCount",
  "acceptableFormats",
  "wantsSampling",
  "dealbreakers",
] as const;
export const GuestField = z.enum(GUEST_NEGOTIABLE_FIELDS);
export type GuestField = z.infer<typeof GuestField>;

export const HOST_NEGOTIABLE_FIELDS = [
  "allowedFormats",
  "availability",
  "popupFeePerDayUsd",
  "shelfFeePerWeekUsd",
  "shelfMinWeeks",
  "eventFeePerHourUsd",
  "eventMinHours",
  "guestFloorSqFt",
  "shelfLinearFt",
  "eventCapacity",
  "staffHoursPerActivation",
  "excludedCategories",
  "samplingAllowed",
  "alcoholOnPremises",
  "requiresExclusivity",
] as const;
export const HostField = z.enum(HOST_NEGOTIABLE_FIELDS);
export type HostField = z.infer<typeof HostField>;

const SmallCount = z.number().int().min(0).max(10_000);

export const GuestProfile = z.strictObject({
  origin: z.enum(["party_supplied", "synthetic_demo"]),
  businessName: ShortText,
  sector: z.enum(SECTORS),
  productCategories: z.array(ProductCategory).min(1).max(5),
  culturalSeeds: z.array(CulturalSeed).max(5),
  market: z.strictObject({
    city: ShortText,
    neighborhood: z.string().trim().max(60).optional(),
  }),
  objectives: z.array(Objective).min(1).max(3),
  maxOutlayUsd: NullableMoney,
  ownCostPerActivationUsd: NullableMoney,
  availability: Availability.nullable(),
  popupFootprintSqFt: SmallCount.nullable(),
  shelfLinearFt: SmallCount.nullable(),
  minEventAudience: SmallCount.nullable(),
  staffCount: z.number().int().min(0).max(50).nullable(),
  wantsSampling: z.boolean(),
  acceptableFormats: z.array(Format).min(1).max(3),
  dealbreakers: z.array(GuestDealbreaker).max(2),
  priorities: z.array(GuestCriterion).max(3),
  fixedFields: z.array(GuestField).max(GUEST_NEGOTIABLE_FIELDS.length),
  notes: OptionalNote,
});
export type GuestProfile = z.infer<typeof GuestProfile>;

/**
 * `hypothetical_scenario` is the fictional example's terms attached to a real venue chosen from
 * research, so the method can be explored before the venue answers. The venue has not stated them.
 */
export const HOST_SOURCES = ["fictional_example", "host_response_link", "entered_by_guest", "hypothetical_scenario"] as const;
export const HostSource = z.enum(HOST_SOURCES);
export type HostSource = z.infer<typeof HostSource>;

export const HostProfile = z.strictObject({
  source: HostSource,
  venueName: ShortText,
  venueCategory: VenueCategory,
  qlooEntityId: z.string().trim().max(64).optional(),
  goals: z.array(HostGoal).max(3),
  allowedFormats: z.array(Format).max(3).nullable(),
  availability: Availability.nullable(),
  popupFeePerDayUsd: NullableMoney,
  shelfFeePerWeekUsd: NullableMoney,
  shelfMinWeeks: z.number().int().min(1).max(52).nullable(),
  eventFeePerHourUsd: NullableMoney,
  eventMinHours: z.number().int().min(1).max(12).nullable(),
  guestFloorSqFt: SmallCount.nullable(),
  shelfLinearFt: SmallCount.nullable(),
  eventCapacity: SmallCount.nullable(),
  staffHoursPerActivation: z.number().int().min(0).max(24).nullable(),
  excludedCategories: z.array(ProductCategory).max(PRODUCT_CATEGORIES.length).nullable(),
  samplingAllowed: z.boolean().nullable(),
  alcoholOnPremises: z.boolean().nullable(),
  requiresExclusivity: z.boolean().nullable(),
  priorities: z.array(HostCriterion).max(2),
  fixedFields: z.array(HostField).max(HOST_NEGOTIABLE_FIELDS.length),
  notes: OptionalNote,
  /** The venue's own programming interests, in its words. Shapes the activation idea; never a constraint. */
  programmingInterests: z.string().trim().max(200).optional(),
});
export type HostProfile = z.infer<typeof HostProfile>;

export const Scenario = z.strictObject({
  guest: GuestProfile,
  host: HostProfile,
});
export type Scenario = z.infer<typeof Scenario>;

