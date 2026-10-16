import type { GuestProfile, HostProfile, Scenario } from "../schemas/profiles";

/**
 * Fictional example used by "Try the example". Neither business exists. Every value below is
 * invented for demonstration and carries `synthetic_demo` provenance in the engine; the
 * cultural seeds are public cultural references the fictional guest says it identifies with.
 */
export const EXAMPLE_GUEST: GuestProfile = {
  origin: "synthetic_demo",
  businessName: "Fernleaf Botanics (fictional)",
  sector: "beauty_personal_care",
  productCategories: ["skincare"],
  culturalSeeds: [
    { label: "Aesop", kind: "brand" },
    { label: "Patagonia", kind: "brand" },
    { label: "Braiding Sweetgrass", kind: "book" },
  ],
  market: { city: "Brooklyn", neighborhood: "Greenpoint" },
  objectives: ["new_customers", "cultural_relevance"],
  maxOutlayUsd: 2000,
  ownCostPerActivationUsd: 450,
  availability: [
    { day: "sat", start: 10, end: 18 },
    { day: "sun", start: 11, end: 17 },
  ],
  popupFootprintSqFt: 40,
  shelfLinearFt: 3,
  minEventAudience: 20,
  staffCount: 2,
  wantsSampling: true,
  acceptableFormats: ["popup", "shelf", "cohosted_event"],
  dealbreakers: ["exclusivity_required"],
  priorities: ["lower_outlay", "more_customer_facing_hours"],
  fixedFields: ["dealbreakers"],
  notes: "Small-batch, refillable skincare. Wants to meet readers who care about how things are made.",
};

export const EXAMPLE_HOST: HostProfile = {
  source: "fictional_example",
  venueName: "Larkspur & Lamp Books (fictional)",
  venueCategory: "bookstore",
  goals: ["community_programming", "partner_fee_income"],
  allowedFormats: ["popup", "shelf", "cohosted_event"],
  availability: [
    { day: "tue", start: 17, end: 21 },
    { day: "wed", start: 17, end: 21 },
    { day: "thu", start: 18, end: 21 },
  ],
  popupFeePerDayUsd: 700,
  shelfFeePerWeekUsd: 60,
  shelfMinWeeks: 4,
  eventFeePerHourUsd: 600,
  eventMinHours: 2,
  guestFloorSqFt: 30,
  shelfLinearFt: 4,
  eventCapacity: 35,
  staffHoursPerActivation: 2,
  excludedCategories: ["candles_home_scent"],
  samplingAllowed: null,
  alcoholOnPremises: false,
  requiresExclusivity: null,
  priorities: ["higher_fee", "fewer_host_staff_hours"],
  fixedFields: ["excludedCategories", "eventMinHours"],
  notes: "Weekends are our busiest days, so partner programming runs on weeknights.",
};

export const EXAMPLE_SCENARIO: Scenario = { guest: EXAMPLE_GUEST, host: EXAMPLE_HOST };
