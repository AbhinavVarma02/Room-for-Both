import type { Format } from "../constants/vocabulary";
import type { GuestProfile, HostProfile } from "../schemas/profiles";
import { hours, money, weeks } from "./format";

/**
 * An arrangement template describes the structural requirements of a collaboration format.
 * Templates contain no prices, footprints, or availability of their own: every quantity they
 * check comes from one of the two parties. The only numbers here are the enumerated
 * durations we explore, which are options to compare rather than facts about either business.
 */
export interface ArrangementTemplate {
  format: Format;
  unit: "hours" | "weeks";
  variants: readonly number[];
  needsScheduleOverlap: boolean;
  /** Host staff time the format inherently needs: a co-hosted event needs host staff for its whole length. */
  hostStaffHours: (variant: number) => number;
  /** Minimum guest staff on site; a pop-up or event is staffed by the guest throughout. */
  guestStaffRequired: number;
  /** Whether a guest's in-person sampling would happen during this format. */
  involvesSampling: boolean;
  hostFee: (host: HostProfile, variant: number) => number | null;
  feeExplanation: (host: HostProfile, variant: number) => string;
  minimumTerm: (host: HostProfile) => { value: number | null; field: "shelfMinWeeks" | "eventMinHours" } | null;
  space: {
    guestField: "popupFootprintSqFt" | "shelfLinearFt" | "minEventAudience";
    hostField: "guestFloorSqFt" | "shelfLinearFt" | "eventCapacity";
    unitLabel: string;
    /** When the guest leaves this value empty, the check does not apply (e.g. no minimum audience). */
    guestOptional: boolean;
  };
  label: (variant: number) => string;
  assumptions: string[];
}

export const ARRANGEMENT_TEMPLATES: readonly ArrangementTemplate[] = [
  {
    format: "popup",
    unit: "hours",
    variants: [2, 4, 6],
    needsScheduleOverlap: true,
    hostStaffHours: () => 0,
    guestStaffRequired: 1,
    involvesSampling: true,
    hostFee: (host) => host.popupFeePerDayUsd,
    feeExplanation: (host) =>
      host.popupFeePerDayUsd === null ? "day rate not provided" : `day rate ${money(host.popupFeePerDayUsd)}`,
    minimumTerm: () => null,
    space: { guestField: "popupFootprintSqFt", hostField: "guestFloorSqFt", unitLabel: "sq ft", guestOptional: false },
    label: (v) => `One-day pop-up · ${hours(v)}`,
    assumptions: [
      "The guest staffs the pop-up for its full length; the host provides floor space only.",
      "The host's day rate covers one calendar day regardless of pop-up length.",
    ],
  },
  {
    format: "shelf",
    unit: "weeks",
    variants: [2, 4, 8],
    needsScheduleOverlap: false,
    hostStaffHours: () => 0,
    guestStaffRequired: 0,
    involvesSampling: false,
    hostFee: (host, v) => (host.shelfFeePerWeekUsd === null ? null : host.shelfFeePerWeekUsd * v),
    feeExplanation: (host, v) =>
      host.shelfFeePerWeekUsd === null
        ? "weekly shelf fee not provided"
        : `${weeks(v)} × ${money(host.shelfFeePerWeekUsd)}/week`,
    minimumTerm: (host) => ({ value: host.shelfMinWeeks, field: "shelfMinWeeks" }),
    space: { guestField: "shelfLinearFt", hostField: "shelfLinearFt", unitLabel: "linear ft", guestOptional: false },
    label: (v) => `Curated shelf placement · ${weeks(v)}`,
    assumptions: [
      "Host staff sell shelf items during normal opening hours; no dedicated staff time is assumed.",
      "Restocking and settlement terms are not modelled and must be agreed directly.",
    ],
  },
  {
    format: "cohosted_event",
    unit: "hours",
    variants: [1, 2, 3],
    needsScheduleOverlap: true,
    hostStaffHours: (v) => v,
    guestStaffRequired: 1,
    involvesSampling: true,
    hostFee: (host, v) => (host.eventFeePerHourUsd === null ? null : host.eventFeePerHourUsd * v),
    feeExplanation: (host, v) =>
      host.eventFeePerHourUsd === null
        ? "hourly event fee not provided"
        : `${hours(v)} × ${money(host.eventFeePerHourUsd)}/hour`,
    minimumTerm: (host) => ({ value: host.eventMinHours, field: "eventMinHours" }),
    space: { guestField: "minEventAudience", hostField: "eventCapacity", unitLabel: "people", guestOptional: true },
    label: (v) => `Co-hosted event · ${hours(v)}`,
    assumptions: [
      "A co-hosted event needs at least one host staff member present for its full length.",
      "At least one guest team member attends the full event.",
    ],
  },
] as const;

export function templateFor(format: Format): ArrangementTemplate {
  const template = ARRANGEMENT_TEMPLATES.find((t) => t.format === format);
  if (!template) throw new Error(`Unknown format: ${format}`);
  return template;
}

export function optionId(format: Format, variant: number): string {
  return `${format}:${variant}`;
}

export type GuestSpaceField = ArrangementTemplate["space"]["guestField"];
export type HostSpaceField = ArrangementTemplate["space"]["hostField"];

export function guestSpaceValue(guest: GuestProfile, field: GuestSpaceField): number | null {
  return guest[field];
}

export function hostSpaceValue(host: HostProfile, field: HostSpaceField): number | null {
  return host[field];
}
