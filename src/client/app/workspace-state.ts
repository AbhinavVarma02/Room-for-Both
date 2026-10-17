import type { TraceEntry } from "@shared/domain/types";
import { EXAMPLE_GUEST, EXAMPLE_HOST } from "@shared/fixtures/example-scenario";
import { hypotheticalHostFor, unknownHostFor } from "@shared/fixtures/hypothetical";
import type { BaselineResult, ResearchRun, VenueBridge } from "@shared/schemas/evidence";
import type { GuestProfile, HostProfile, Scenario } from "@shared/schemas/profiles";
import type { VenueSelection } from "@shared/schemas/selection";

/** Workspace state and its pure reducer, kept free of React and browser APIs so it can be tested directly. */

export interface HostLink {
  requestId: string;
  ownerToken: string;
  hostUrl: string;
  expiresAt: number;
  venueName: string;
}

export interface WorkspaceState {
  guest: GuestProfile | null;
  host: HostProfile | null;
  research: ResearchRun | null;
  /** The venue chosen from research, frozen with its evidence. */
  selection: VenueSelection | null;
  /** The category-only comparison for the current research run. */
  baseline: { runId: string; result: BaselineResult } | null;
  hostLink: HostLink | null;
  whatIf: Scenario | null;
  trace: TraceEntry[];
  isExample: boolean;
  /** The visitor started the guided demonstration; it only changes what guidance is shown. */
  guided: boolean;
}

export const EMPTY: WorkspaceState = {
  guest: null,
  host: null,
  research: null,
  selection: null,
  baseline: null,
  hostLink: null,
  whatIf: null,
  trace: [],
  isExample: false,
  guided: false,
};

export type Action =
  | { type: "load_example"; guided?: boolean }
  | { type: "start_custom" }
  | { type: "set_guest"; guest: GuestProfile }
  | { type: "set_host"; host: HostProfile | null }
  | { type: "set_research"; research: ResearchRun | null }
  | { type: "select_venue"; selection: VenueSelection; hypothetical?: boolean }
  | { type: "use_hypothetical_terms" }
  | { type: "set_venue_bridge"; venueId: string; bridge: VenueBridge | null; note?: string }
  | { type: "set_baseline"; runId: string; baseline: BaselineResult }
  | { type: "set_host_link"; link: HostLink | null }
  | { type: "set_what_if"; scenario: Scenario | null }
  | { type: "push_trace"; entry: TraceEntry }
  | { type: "clear_trace" }
  | { type: "end_guide" }
  | { type: "reset" };

const venueRef = (s: VenueSelection) => ({ id: s.candidate.venue.id, name: s.candidate.venue.name, category: s.candidate.category });

export function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "load_example":
      return { ...EMPTY, guest: EXAMPLE_GUEST, host: EXAMPLE_HOST, isExample: true, guided: action.guided === true };
    case "start_custom":
      return { ...EMPTY };
    case "set_guest":
      // A changed guest invalidates any what-if sandbox built on the previous inputs.
      return { ...state, guest: action.guest, whatIf: null, trace: [] };
    case "set_host":
      return { ...state, host: action.host, whatIf: null, trace: [] };
    case "set_research":
      // The selection keeps its own snapshot and run ID, so a new run never silently changes its evidence.
      return { ...state, research: action.research, baseline: null };
    case "select_venue": {
      // Terms typed for one venue say nothing about another, so a new venue starts unknown, unless the
      // visitor is exploring with hypothetical terms, which are placeholders for any venue.
      const keepHypothetical = action.hypothetical === true || state.host?.source === "hypothetical_scenario";
      const ref = venueRef(action.selection);
      const baseline = state.baseline?.runId === action.selection.runId ? state.baseline.result : action.selection.baseline;
      return {
        ...state,
        selection: { ...action.selection, baseline },
        host: keepHypothetical ? hypotheticalHostFor(ref) : unknownHostFor(ref),
        whatIf: null,
        trace: [],
      };
    }
    case "use_hypothetical_terms":
      if (!state.selection) return state;
      return { ...state, host: hypotheticalHostFor(venueRef(state.selection)), whatIf: null, trace: [] };
    case "set_venue_bridge":
      if (state.selection?.candidate.venue.id !== action.venueId) return state;
      return { ...state, selection: { ...state.selection, venueBridge: action.bridge, venueBridgeNote: action.note ?? null } };
    case "set_baseline":
      if (state.research?.runId !== action.runId) return state;
      return {
        ...state,
        baseline: { runId: action.runId, result: action.baseline },
        selection: state.selection?.runId === action.runId ? { ...state.selection, baseline: action.baseline } : state.selection,
      };
    case "set_host_link":
      return { ...state, hostLink: action.link };
    case "set_what_if":
      return { ...state, whatIf: action.scenario };
    case "push_trace":
      return { ...state, trace: [...state.trace, action.entry].slice(-50) };
    case "clear_trace":
      return { ...state, trace: [] };
    case "end_guide":
      return { ...state, guided: false };
    case "reset":
      return { ...EMPTY };
  }
}
