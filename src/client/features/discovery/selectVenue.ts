import { CROSS_DOMAIN_BY_VENUE } from "@shared/constants/vocabulary";
import type { ResearchRun } from "@shared/schemas/evidence";
import { ApiRequestError, fetchVenueBridge } from "../../app/api";
import { selectionFrom, useWorkspace } from "../../app/store";

/**
 * Choosing a venue freezes it with its evidence, resets host terms that belonged to another venue,
 * and looks up the venue's own side of the cultural bridge (one upstream call) in the background.
 */
export function useSelectVenue() {
  const { dispatch } = useWorkspace();
  return (run: ResearchRun, venueId: string, opts: { hypothetical?: boolean } = {}) => {
    const selection = selectionFrom(run, venueId);
    if (!selection) return false;
    dispatch({ type: "select_venue", selection, ...(opts.hypothetical ? { hypothetical: true } : {}) });
    const venue = selection.candidate.venue;
    if (!CROSS_DOMAIN_BY_VENUE[selection.candidate.category]) {
      dispatch({ type: "set_venue_bridge", venueId: venue.id, bridge: null, note: "Venue-side cultural evidence is available for bookstores, record stores, and cafes only." });
      return true;
    }
    fetchVenueBridge({ venueId: venue.id, venueName: venue.name.slice(0, 200), venueCategory: selection.candidate.category, ...(run.mode === "fixture" ? { demo: true as const } : {}) })
      .then((bridge) => dispatch({ type: "set_venue_bridge", venueId: venue.id, bridge }))
      .catch((e: unknown) =>
        dispatch({
          type: "set_venue_bridge",
          venueId: venue.id,
          bridge: null,
          note: e instanceof ApiRequestError ? `Venue-side lookup unavailable: ${e.message}` : "Venue-side lookup unavailable.",
        }),
      );
    return true;
  };
}
