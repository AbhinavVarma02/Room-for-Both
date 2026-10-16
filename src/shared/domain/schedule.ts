import { DAYS, type Day } from "../constants/vocabulary";
import type { Availability, TimeWindow } from "../schemas/common";
import type { Slot } from "./types";

export interface OverlapResult {
  /** Earliest slot (week order, then start hour) that fits the requested duration. */
  slot: Slot | null;
  /** Longest single overlap found on any day, in hours. */
  longestOverlap: number;
  /** The day and windows that produced the longest overlap, used to suggest minimal extensions. */
  longest: { day: Day; start: number; end: number; guest: TimeWindow; host: TimeWindow } | null;
}

const dayIndex = (d: Day) => DAYS.indexOf(d);

export function sortWindows(windows: Availability): Availability {
  return [...windows].sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.start - b.start || a.end - b.end);
}

export function findOverlap(guest: Availability, host: Availability, duration: number): OverlapResult {
  let slot: Slot | null = null;
  let longestOverlap = 0;
  let longest: OverlapResult["longest"] = null;

  for (const g of sortWindows(guest)) {
    for (const h of sortWindows(host)) {
      if (g.day !== h.day) continue;
      const start = Math.max(g.start, h.start);
      const end = Math.min(g.end, h.end);
      const length = end - start;
      if (length <= 0) continue;
      if (length > longestOverlap) {
        longestOverlap = length;
        longest = { day: g.day, start, end, guest: g, host: h };
      }
      if (length >= duration) {
        const candidate: Slot = { day: g.day, start, end: start + duration };
        if (
          slot === null ||
          dayIndex(candidate.day) < dayIndex(slot.day) ||
          (candidate.day === slot.day && candidate.start < slot.start)
        ) {
          slot = candidate;
        }
      }
    }
  }
  return { slot, longestOverlap, longest };
}

export function addWindow(availability: Availability, window: TimeWindow): Availability {
  return sortWindows([...availability, window]);
}

export function replaceWindow(availability: Availability, from: TimeWindow, to: TimeWindow): Availability {
  let replaced = false;
  const next = availability.map((w) => {
    if (!replaced && w.day === from.day && w.start === from.start && w.end === from.end) {
      replaced = true;
      return to;
    }
    return w;
  });
  return sortWindows(next);
}

export function daysOf(availability: Availability): Day[] {
  return [...new Set(sortWindows(availability).map((w) => w.day))];
}
