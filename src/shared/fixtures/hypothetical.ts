import type { VenueCategory } from "../constants/vocabulary";
import type { HostProfile } from "../schemas/profiles";
import { EXAMPLE_HOST } from "./example-scenario";

interface VenueRef {
  id: string;
  name: string;
  category: VenueCategory;
}

/** A venue chosen from research whose terms nobody has supplied yet: every host value starts unknown. */
export function unknownHostFor(venue: VenueRef): HostProfile {
  return {
    source: "entered_by_guest",
    venueName: venue.name.slice(0, 80),
    venueCategory: venue.category,
    qlooEntityId: venue.id.slice(0, 64),
    goals: [],
    allowedFormats: null,
    availability: null,
    popupFeePerDayUsd: null,
    shelfFeePerWeekUsd: null,
    shelfMinWeeks: null,
    eventFeePerHourUsd: null,
    eventMinHours: null,
    guestFloorSqFt: null,
    shelfLinearFt: null,
    eventCapacity: null,
    staffHoursPerActivation: null,
    excludedCategories: null,
    samplingAllowed: null,
    alcoholOnPremises: null,
    requiresExclusivity: null,
    priorities: [],
    fixedFields: [],
  };
}

/**
 * The fictional example's terms attached to a real venue so the method can be explored before the
 * venue answers. Only the terms are copied: the fictional host's notes and goals are not, because
 * they would put words in a real business's mouth.
 */
export function hypotheticalHostFor(venue: VenueRef): HostProfile {
  const { notes: _notes, goals: _goals, programmingInterests: _interests, ...terms } = EXAMPLE_HOST;
  return {
    ...terms,
    source: "hypothetical_scenario",
    venueName: venue.name.slice(0, 80),
    venueCategory: venue.category,
    qlooEntityId: venue.id.slice(0, 64),
    goals: [],
    notes: "Hypothetical terms copied from the fictional example to explore the method. Not stated by the venue.",
  };
}
