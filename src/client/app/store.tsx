import { type ReactNode, createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { z } from "zod";
import type { TraceEntry } from "@shared/domain/types";
import { EXAMPLE_GUEST, EXAMPLE_HOST } from "@shared/fixtures/example-scenario";
import { ResearchRun } from "@shared/schemas/evidence";
import { GuestProfile, HostProfile, type Scenario } from "@shared/schemas/profiles";

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
  selectedCandidateId: string | null;
  hostLink: HostLink | null;
  whatIf: Scenario | null;
  trace: TraceEntry[];
  isExample: boolean;
}

const EMPTY: WorkspaceState = {
  guest: null,
  host: null,
  research: null,
  selectedCandidateId: null,
  hostLink: null,
  whatIf: null,
  trace: [],
  isExample: false,
};

type Action =
  | { type: "load_example" }
  | { type: "start_custom" }
  | { type: "set_guest"; guest: GuestProfile }
  | { type: "set_host"; host: HostProfile | null }
  | { type: "set_research"; research: ResearchRun | null }
  | { type: "select_candidate"; id: string | null }
  | { type: "set_host_link"; link: HostLink | null }
  | { type: "set_what_if"; scenario: Scenario | null }
  | { type: "push_trace"; entry: TraceEntry }
  | { type: "clear_trace" }
  | { type: "reset" };

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "load_example":
      return { ...EMPTY, guest: EXAMPLE_GUEST, host: EXAMPLE_HOST, isExample: true };
    case "start_custom":
      return { ...EMPTY };
    case "set_guest":
      // A changed guest invalidates any what-if sandbox built on the previous inputs.
      return { ...state, guest: action.guest, whatIf: null, trace: [] };
    case "set_host":
      return { ...state, host: action.host, whatIf: null, trace: [] };
    case "set_research":
      return { ...state, research: action.research, selectedCandidateId: null };
    case "select_candidate":
      return { ...state, selectedCandidateId: action.id };
    case "set_host_link":
      return { ...state, hostLink: action.link };
    case "set_what_if":
      return { ...state, whatIf: action.scenario };
    case "push_trace":
      return { ...state, trace: [...state.trace, action.entry].slice(-50) };
    case "clear_trace":
      return { ...state, trace: [] };
    case "reset":
      return { ...EMPTY };
  }
}

const STORAGE_KEY = "room-for-both.workspace.v1";

const Persisted = z.object({
  guest: GuestProfile.nullable(),
  host: HostProfile.nullable(),
  research: ResearchRun.nullable(),
  selectedCandidateId: z.string().nullable(),
  hostLink: z
    .object({ requestId: z.string(), ownerToken: z.string(), hostUrl: z.string(), expiresAt: z.number(), venueName: z.string() })
    .nullable(),
  isExample: z.boolean(),
});

// Storage is a convenience: private windows or blocked storage simply start a fresh workspace.
function load(): WorkspaceState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = Persisted.safeParse(JSON.parse(raw));
    return parsed.success ? { ...EMPTY, ...parsed.data } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(state: WorkspaceState) {
  try {
    const { whatIf: _w, trace: _t, ...persisted } = state;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

const Ctx = createContext<{ state: WorkspaceState; dispatch: (a: Action) => void } | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => save(state), [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export function scenarioOf(state: WorkspaceState): Scenario | null {
  return state.guest && state.host ? { guest: state.guest, host: state.host } : null;
}
