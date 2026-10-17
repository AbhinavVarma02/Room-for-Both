import { Check, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Brief } from "../features/brief/Brief";
import { Discovery } from "../features/discovery/Discovery";
import { Frontier } from "../features/frontier/Frontier";
import { GuestIntake } from "../features/intake/GuestIntake";
import { Reversal } from "../features/reversal/Reversal";
import { GuideBanner } from "../features/guide/GuideBanner";
import { HostWorkspace } from "../features/two-sided/HostWorkspace";
import { Button, Notice, cn } from "../components/ui/primitives";
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="no-print flex items-center justify-between gap-2">
        <nav aria-label="Workspace steps" className="min-w-0 overflow-x-auto">
          <ol className="flex min-w-max items-center gap-0.5 sm:gap-1">
            {STEPS.map((s, i) => {
              const enabled = available(s.id, state);
              const current = s.id === step;
              const content = (
                <>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
                      current
                        ? "border-common bg-common text-white"
                        : done(s.id, state)
                          ? "border-common/40 bg-common-soft text-common"
                          : "border-line-strong text-ink-faint",
                    )}
                  >
                    {done(s.id, state) && !current ? <Check className="size-3.5" aria-hidden /> : i + 1}
                  </span>
                  {/* On narrow screens only the current step keeps its name; the others stay as numbered stops. */}
                  <span className={cn("text-sm font-medium", current ? "text-ink" : "sr-only text-ink-soft md:not-sr-only")}>{s.label}</span>
                </>
              );
              return (
                <li key={s.id} className="flex items-center">
                  {enabled ? (
                    <Link
                      href={stepHref(s.id)}
                      aria-current={current ? "step" : undefined}
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-sunken sm:px-2"
                    >
                      {content}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 px-1.5 py-1.5 opacity-50 sm:px-2" aria-disabled="true">
                      {content}
                    </span>
                  )}
                  {i < STEPS.length - 1 && <span className="h-px w-2 bg-line-strong sm:mx-0.5 sm:w-4" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </nav>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            if (window.confirm("Clear this workspace and start over? Your inputs in this browser will be removed.")) {
              dispatch({ type: "reset" });
              navigate("/");
            }
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> <span className="max-sm:sr-only">Start over</span>
        </Button>
      </div>

      {state.isExample &&
        (state.host?.source === "hypothetical_scenario" && state.selection?.mode === "live" ? (
          <Notice className="no-print mt-4" title="Fictional guest, real venue, hypothetical terms">
            {state.host.venueName} is a real place suggested by Qloo; its terms here are placeholders it has not seen or agreed to.
          </Notice>
        ) : (
          <Notice className="no-print mt-4" title="Fictional example">
            {state.host?.source === "fictional_example" || state.selection?.mode === "fixture"
              ? "Both businesses and their terms are invented."
              : "The guest business and its terms are invented."}{" "}
            Cultural references are real public names.
          </Notice>
        ))}

      {!gate && <GuideBanner step={step} />}

      <div className="mt-6 sm:mt-8">
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
    <header className="mb-5 sm:mb-6">
      <p className="eyebrow">{eyebrow ?? `Step ${STEPS.findIndex((x) => x.id === step) + 1} of ${STEPS.length}`}</p>
      <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">{s?.title}</h1>
      {children && <div className="mt-2 max-w-2xl text-ink-soft">{children}</div>}
    </header>
  );
}

export function StepNav({
  back,
  next,
  nextLabel,
  nextDisabled,
  onNext,
  nextVariant = "primary",
}: {
  back?: StepId;
  next?: StepId;
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext?: () => void;
  /** Secondary when the page already has its own primary action, so each screen has one. */
  nextVariant?: "primary" | "secondary";
}) {
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
          variant={nextVariant}
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
