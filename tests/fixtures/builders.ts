import type { GuestProfile, HostProfile, Scenario } from "../../src/shared/schemas/profiles";

/**
 * Synthetic test builders. A fully specified, everything-passes baseline lets each test change
 * exactly one input and attribute any status change to that input alone.
 */
export function guest(overrides: Partial<GuestProfile> = {}): GuestProfile {
  return {
    origin: "party_supplied",
    businessName: "Test Guest Co",
    sector: "beauty_personal_care",
    productCategories: ["skincare"],
    culturalSeeds: [],
    market: { city: "Testville" },
    objectives: ["new_customers"],
    maxOutlayUsd: 5000,
    ownCostPerActivationUsd: 200,
    availability: [{ day: "thu", start: 16, end: 22 }],
    popupFootprintSqFt: 20,
    shelfLinearFt: 2,
    minEventAudience: null,
    staffCount: 2,
    wantsSampling: false,
    acceptableFormats: ["popup", "shelf", "cohosted_event"],
    dealbreakers: [],
    priorities: [],
    fixedFields: [],
    ...overrides,
  };
}

export function host(overrides: Partial<HostProfile> = {}): HostProfile {
  return {
    source: "host_response_link",
    venueName: "Test Host Venue",
    venueCategory: "bookstore",
    goals: [],
    allowedFormats: ["popup", "shelf", "cohosted_event"],
    availability: [{ day: "thu", start: 16, end: 22 }],
    popupFeePerDayUsd: 300,
    shelfFeePerWeekUsd: 50,
    shelfMinWeeks: 1,
    eventFeePerHourUsd: 100,
    eventMinHours: 1,
    guestFloorSqFt: 50,
    shelfLinearFt: 6,
    eventCapacity: 40,
    staffHoursPerActivation: 6,
    excludedCategories: [],
    samplingAllowed: true,
    alcoholOnPremises: false,
    requiresExclusivity: false,
    priorities: [],
    fixedFields: [],
    ...overrides,
  };
}

export function scenario(g: Partial<GuestProfile> = {}, h: Partial<HostProfile> = {}): Scenario {
  return { guest: guest(g), host: host(h) };
}
