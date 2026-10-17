import type { ResearchRun } from "../schemas/evidence";
import type { VenueSelection } from "../schemas/selection";

/** Freezes a candidate with the run it appeared in: its evidence, signals, and cultural bridge. */
export function selectionFrom(run: ResearchRun, venueId: string, now: Date = new Date()): VenueSelection | null {
  const candidate = run.candidates.find((c) => c.venue.id === venueId);
  if (!candidate) return null;
  return {
    candidate,
    runId: run.runId,
    mode: run.mode,
    selectedAt: now.toISOString(),
    signals: run.seeds.filter((s) => s.status === "exact").map((s) => s.input.label.slice(0, 80)),
    guestThemes: run.themes.slice(0, 4),
    bridgeDomain: run.bridgeDomain ?? null,
    venueBridge: null,
    venueBridgeNote: null,
    baseline: null,
  };
}
