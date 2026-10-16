import { Check, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Brief } from "../features/brief/Brief";
import { Discovery } from "../features/discovery/Discovery";
import { Frontier } from "../features/frontier/Frontier";
import { GuestIntake } from "../features/intake/GuestIntake";
import { Reversal } from "../features/reversal/Reversal";
import { HostWorkspace } from "../features/two-sided/HostWorkspace";
import { Button, Callout, cn } from "../components/ui/primitives";
import { useWorkspace, type WorkspaceState } from "./store";

export const STEPS = [
  { id: "guest", label: "Guest", title: "Guest profile" },
  { id: "discovery", label: "Discover", title: "Cultural discovery" },
  { id: "host", label: "Host", title: "Two-sided workspace" },
  { id: "frontier", label: "Frontier", title: "Agreement Frontier" },
  { id: "reversal", label: "Reversal", title: "Decision Reversal" },
  { id: "brief", label: "Brief", title: "Decision brief" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

function available(step: StepId, state: WorkspaceState): boolean {
  if (step === "guest") return true;
  if (step === "discovery" || step === "host") return state.guest !== null;
  return state.guest !== null && state.host !== null;
}

function done(step: StepId, state: WorkspaceState): boolean {
  if (step === "guest") return state.guest !== null;
  if (step === "discovery") return state.research !== null;
  if (step === "host") return state.host !== null;
  return false;
}

export function stepHref(step: StepId) {
  return `/workspace/${step}`;
}

export function Workspace() {
  const params = useParams<{ step?: string }>();
  const [, navigate] = useLocation();
  const { state, dispatch } = useWorkspace();
  const step = (STEPS.find((s) => s.id === params.step)?.id ?? "guest") as StepId;
  const index = STEPS.findIndex((s) => s.id === step);

  useEffect(() => {
    // On narrow screens the step bar scrolls; keep the current step visible.
    document.querySelector("[aria-current=step]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [step]);

  const gate = !available(step, state);
  const firstMissing = STEPS.find((s) => !done(s.id, state) && s.id !== "discovery");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Workspace steps" className="w-full overflow-x-auto sm:w-auto">
          <ol className="flex min-w-max items-center gap-1">
            {STEPS.map((s, i) => {
              const enabled = available(s.id, state);
              const current = s.id === step;
              const content = (
                <>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
                      current ? "border-common bg-common text-white" : done(s.id, state) ? "border-common/40 bg-common-soft text-common" : "border-line-strong text-ink-faint",
                    )}
                  >
                    {done(s.id, state) && !current ? <Check className="size-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("text-sm font-medium", current ? "text-ink" : "text-ink-soft")}>{s.label}</span>
                </>
              );
              return (
                <li key={s.id} className="flex items-center">
                  {enabled ? (
                    <Link href={stepHref(s.id)} aria-current={current ? "step" : undefined} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sunken">
                      {content}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 px-2 py-1.5 opacity-50" aria-disabled="true">
                      {content}
                    </span>
                  )}
                  {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-4 bg-line-strong" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </nav>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm("Clear this workspace and start over? Your inputs in this browser will be removed.")) {
              dispatch({ type: "reset" });
              navigate("/");
            }
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Start over
        </Button>
      </div>

      {state.isExample && (
        <Callout tone="warn" className="no-print mt-5" title="Fictional example">
          Both businesses and all of their terms are invented to demonstrate the method. Cultural references are real public names the fictional
          guest identifies with. Edit anything, or start your own scenario from the home page.
        </Callout>
      )}

      <div className="mt-8">
        {gate ? (
          <div className="card mx-auto max-w-xl p-8 text-center">
            <h1 className="text-2xl font-semibold">{STEPS[index]?.title}</h1>
            <p className="mt-3 text-ink-soft">This step needs the guest and host inputs first.</p>
            <Button className="mt-5" onClick={() => navigate(stepHref(firstMissing?.id ?? "guest"))}>
              Go to {firstMissing?.title ?? "the guest profile"}
            </Button>
          </div>
        ) : step === "guest" ? (
          <GuestIntake />
        ) : step === "discovery" ? (
          <Discovery />
        ) : step === "host" ? (
          <HostWorkspace />
        ) : step === "frontier" ? (
          <Frontier />
        ) : step === "reversal" ? (
          <Reversal />
        ) : (
          <Brief />
        )}
      </div>
    </div>
  );
}

export function StepHeader({ step, children, eyebrow }: { step: StepId; children?: React.ReactNode; eyebrow?: string }) {
  const s = STEPS.find((x) => x.id === step);
  return (
    <header className="mb-6">
      <p className="eyebrow">{eyebrow ?? `Step ${STEPS.findIndex((x) => x.id === step) + 1} of ${STEPS.length}`}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{s?.title}</h1>
      {children && <div className="mt-3 max-w-3xl text-ink-soft">{children}</div>}
    </header>
  );
}

export function StepNav({ back, next, nextLabel, nextDisabled, onNext }: { back?: StepId; next?: StepId; nextLabel?: string; nextDisabled?: boolean; onNext?: () => void }) {
  const [, navigate] = useLocation();
  return (
    <div className="no-print mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
      {back ? (
        <Button variant="ghost" onClick={() => navigate(stepHref(back))}>
          ← Back
        </Button>
      ) : (
        <span />
      )}
      {(next || onNext) && (
        <Button
          disabled={nextDisabled}
          onClick={() => {
            if (onNext) onNext();
            else if (next) navigate(stepHref(next));
          }}
        >
          {nextLabel ?? "Continue"} →
        </Button>
      )}
    </div>
  );
}
