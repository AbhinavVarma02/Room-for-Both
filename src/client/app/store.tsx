import { type ReactNode, createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { z } from "zod";
import { BaselineResult, ResearchRun } from "@shared/schemas/evidence";
import { GuestProfile, HostProfile } from "@shared/schemas/profiles";
import { VenueSelection } from "@shared/schemas/selection";
import { type Action, EMPTY, reducer, type WorkspaceState } from "./workspace-state";

export { selectionFrom } from "@shared/domain/selection";
export type { HostLink, WorkspaceState } from "./workspace-state";

const STORAGE_KEY = "room-for-both.workspace.v1";

// Workspaces saved before venue selections existed carry `selectedCandidateId` instead; it is dropped
// and the visitor simply chooses the venue again.
const Persisted = z.object({
  guest: GuestProfile.nullable(),
  host: HostProfile.nullable(),
  research: ResearchRun.nullable(),
  selection: VenueSelection.nullable().optional(),
  baseline: z.object({ runId: z.string(), result: BaselineResult }).nullable().optional(),
  hostLink: z
    .object({ requestId: z.string(), ownerToken: z.string(), hostUrl: z.string(), expiresAt: z.number(), venueName: z.string() })
    .nullable(),
  isExample: z.boolean(),
  guided: z.boolean().optional(),
});

// Storage is a convenience: private windows or blocked storage simply start a fresh workspace.
function load(): WorkspaceState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = Persisted.safeParse(JSON.parse(raw));
    return parsed.success ? { ...EMPTY, ...parsed.data, selection: parsed.data.selection ?? null, baseline: parsed.data.baseline ?? null, guided: parsed.data.guided ?? false } : EMPTY;
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
