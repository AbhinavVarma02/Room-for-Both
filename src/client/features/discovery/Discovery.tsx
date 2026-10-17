import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bot, CheckCircle2, CircleDashed, Cog, Loader2, MapPin, MinusCircle, Sparkles, Store, Tags, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { SEED_KIND_LABELS, VENUE_CATEGORIES, VENUE_CATEGORY_LABELS, type VenueCategory } from "@shared/constants/vocabulary";
import { STRENGTH_LABELS, affinityText, influenceText } from "@shared/domain/affinity";
import type { PartnershipCandidate, ResearchRun, ResearchStep, ResearchStepId, Strength } from "@shared/schemas/evidence";
import type { PlannerDecision } from "@shared/schemas/planner";
import { ApiRequestError, getConfig, streamResearch } from "../../app/api";
import { useWorkspace } from "../../app/store";
import { StepHeader, StepNav, stepHref } from "../../app/Workspace";
import { Button, Callout, Card, Disclosure, Notice, ProvenanceChip, cn } from "../../components/ui/primitives";
import { DiscoveryComparisonPanel } from "./Comparison";
import { SensitivityPanel } from "./Sensitivity";
import { useSelectVenue } from "./selectVenue";

type StepState = { id: ResearchStepId; label: string; status: "pending" | ResearchStep["status"]; summary?: string };

/** How a failed live run is presented. Each state says plainly whether live data was involved. */
type ErrorKind = "unauthorized" | "unavailable" | "throttled" | "other";
type ResearchError = { message: string; retryable: boolean; kind: ErrorKind };

const UNPLANNED_LABELS: Partial<Record<ResearchStepId, string>> = { broaden_location: "Widening the search area" };

const ERROR_TITLES: Record<ErrorKind, string> = {
  unauthorized: "Live Qloo access is not authorized right now",
  unavailable: "Live cultural data is temporarily unavailable",
  throttled: "Please wait before researching again",
  other: "Research did not finish",
};

function streamErrorKind(code: string): ErrorKind {
  if (code === "auth" || code === "not_configured" || code === "untrusted_base_url") return "unauthorized";
  if (["rate_limited", "quota_exhausted", "upstream_unavailable", "timeout", "network", "upstream", "malformed"].includes(code)) return "unavailable";
  return "other";
}

function httpErrorKind(code: string): ErrorKind {
  // A 429 before the stream starts is this app's own per-visitor limit, which a demo run shares.
  if (code === "rate_limited") return "throttled";
  if (["quota_exhausted", "limiter_unavailable", "research_unavailable"].includes(code)) return "unavailable";
  return "other";
}

const STRENGTH_STYLE: Record<Strength, string> = {
  strong: "bg-common text-white",
  moderate: "bg-common-soft text-common",
  weak: "bg-sunken text-ink-soft",
  unscored: "border border-dashed border-line-strong text-ink-faint",
};

export function StrengthPill({ strength, affinity }: { strength: Strength; affinity: number | null }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", STRENGTH_STYLE[strength])}
      title="Relative to this query, per Qloo's published score ranges"
    >
      {STRENGTH_LABELS[strength]}
      {affinity !== null && strength !== "unscored" && <span className="font-mono font-normal tabular-nums">· {affinityText(affinity)}</span>}
    </span>
  );
}

function StepIcon({ status }: { status: StepState["status"] }) {
  if (status === "done") return <CheckCircle2 className="size-4 text-ok" aria-hidden />;
  if (status === "failed") return <XCircle className="size-4 text-bad" aria-hidden />;
  if (status === "skipped") return <MinusCircle className="size-4 text-ink-faint" aria-hidden />;
  return <CircleDashed className="size-4 text-ink-faint" aria-hidden />;
}

export function Discovery() {
  const { state, dispatch } = useWorkspace();
  const [, navigate] = useLocation();
  const guest = state.guest;
  const config = useQuery({ queryKey: ["config"], queryFn: getConfig });
  const [category, setCategory] = useState<VenueCategory | null>(
    state.research?.request.venueCategory ?? (state.isExample ? "bookstore" : (state.host?.venueCategory ?? null)),
  );
  const [steps, setSteps] = useState<StepState[]>([]);
  const [decisions, setDecisions] = useState<PlannerDecision[]>([]);
  const [useModel, setUseModel] = useState(false);
  const [plannerConsent, setPlannerConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ResearchError | null>(null);
  const abort = useRef<AbortController | null>(null);
  const selectVenue = useSelectVenue();

  useEffect(() => () => abort.current?.abort(), []);

  if (!guest) return null;
  const run = state.research;

  const start = async (demo = false) => {
    if (!category) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setError(null);
    setSteps([]);
    setDecisions([]);
    try {
      await streamResearch(
        {
          seeds: guest.culturalSeeds,
          city: guest.market.city,
          ...(guest.market.neighborhood ? { neighborhood: guest.market.neighborhood } : {}),
          venueCategory: category,
          guestCategories: guest.productCategories,
          maxCandidates: 5,
          ...(demo ? { demo: true as const } : {}),
          ...(useModel ? { planner: "model" as const, ...(plannerConsent ? { plannerConsent: true as const } : {}) } : {}),
        },
        (event) => {
          if (event.type === "plan") setSteps(event.steps.map((s) => ({ ...s, status: "pending" })));
          if (event.type === "step") {
            setSteps((prev) => {
              let next = prev;
              if (!prev.some((p) => p.id === event.step.id)) {
                // Re-planned steps (such as widening the search) are not in the initial plan, so we slot
                // them in where they ran: before the first step that has not finished yet.
                const added: StepState = { id: event.step.id, label: UNPLANNED_LABELS[event.step.id] ?? event.step.id.replace(/_/g, " "), status: "pending" };
                const at = prev.findIndex((p) => p.status === "pending");
                next = at < 0 ? [...prev, added] : [...prev.slice(0, at), added, ...prev.slice(at)];
              }
              return next.map((p) => (p.id === event.step.id ? { ...p, status: event.step.status, summary: event.step.summary } : p));
            });
          }
          if (event.type === "decision") setDecisions((prev) => [...prev, event.decision]);
          if (event.type === "result") dispatch({ type: "set_research", research: event.run });
          if (event.type === "error") setError({ message: event.message, retryable: event.retryable, kind: streamErrorKind(event.code) });
        },
        controller.signal,
      );
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          e instanceof ApiRequestError
            ? { message: e.message, retryable: e.code !== "rate_limited", kind: httpErrorKind(e.code) }
            : { message: "Research could not be completed.", retryable: true, kind: "other" },
        );
      }
    } finally {
      setRunning(false);
    }
  };

  const evaluateCandidate = (c: PartnershipCandidate) => {
    // In the guided demonstration the visitor explores with labelled hypothetical terms straight away.
    if (run && selectVenue(run, c.venue.id, { hypothetical: state.guided })) navigate(stepHref("host"));
  };
  const linked = state.selection && state.host?.qlooEntityId === state.selection.candidate.venue.id.slice(0, 64) ? state.selection : null;

  const mode = config.data?.researchMode;

  return (
    <div>
      <StepHeader step="discovery">
        Qloo finds venues whose audiences share your customers' taste. It suggests <em>who</em> to approach; it says nothing about rent, traffic, or a venue's
        willingness to partner.
      </StepHeader>

      <div className="mb-6 space-y-2">
        {mode === "fixture" && (
          <Notice title="Fixture mode: fictional cultural data">
            Live Qloo access is not configured on this server, so research returns labelled fictional results through the same pipeline. No Qloo request is
            made.
          </Notice>
        )}
        {mode === "live" && (
          <Notice tone="info" title="Live Qloo cultural intelligence">
            Results come from Qloo's Insights API in real time, within {config.data?.callBudget} calls per run.
          </Notice>
        )}
        {mode === "live" && run?.mode === "fixture" && (
          <Notice title="Showing the fictional demonstration">
            The results below are fictional demonstration data, not a Qloo response. Run research again to try live data.
          </Notice>
        )}
      </div>

      <AutoStart when={state.guided && !run && category !== null} onStart={start} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        {/* Once results exist, phones show them before the search form. */}
        <Card className={cn("h-fit space-y-5", run && "order-2 lg:order-none")}>
          <div>
            <p className="eyebrow">Searching for</p>
            <p className="mt-1 font-medium">
              {guest.businessName} · {guest.market.neighborhood ? `${guest.market.neighborhood}, ` : ""}
              {guest.market.city}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Cultural references</p>
            {guest.culturalSeeds.length === 0 ? (
              <p className="mt-1 text-sm text-ink-faint">None given. Venues will be listed without a taste signal.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {guest.culturalSeeds.map((s) => (
                  <li key={`${s.label}-${s.kind}`} className="rounded-full bg-guest-soft px-2.5 py-1 text-xs text-guest">
                    {s.label} <span className="opacity-70">· {SEED_KIND_LABELS[s.kind]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Kind of host venue</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {VENUE_CATEGORIES.map((v) => (
                <label
                  key={v}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm",
                    category === v ? "border-common bg-common text-white" : "border-line-strong bg-surface text-ink-soft",
                  )}
                >
                  <input type="radio" name="venue-category" value={v} className="sr-only" checked={category === v} onChange={() => setCategory(v)} />
                  {VENUE_CATEGORY_LABELS[v]}
                </label>
              ))}
            </div>
          </fieldset>
          {config.data?.plannerEnabled && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Research planner</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="planner" className="mt-1 accent-common" checked={!useModel} onChange={() => setUseModel(false)} />
                <span>
                  Rules only <span className="text-ink-faint">· the same inputs always make the same calls</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="planner" className="mt-1 accent-common" checked={useModel} onChange={() => setUseModel(true)} />
                <span>
                  Let a language model choose research steps{" "}
                  <span className="text-ink-faint">· up to two decisions from a fixed list, checked before they run</span>
                </span>
              </label>
              {useModel && (
                <label className="ml-6 flex items-start gap-2 rounded-lg bg-sunken/60 p-2.5 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-common"
                    checked={plannerConsent}
                    onChange={(e) => setPlannerConsent(e.target.checked)}
                  />
                  <span>
                    I agree to send my cultural references, product categories, venue type, and search area to Google's Gemini API, whose free tier may use
                    submitted content to improve Google's products. Business names, budgets, and terms are never sent. Without consent the rules decide.
                  </span>
                </label>
              )}
            </fieldset>
          )}
          <Button className="w-full" disabled={!category || running || !guest.market.city} onClick={() => start()}>
            {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {running ? "Researching…" : run ? "Run research again" : "Run cultural research"}
          </Button>
        </Card>

        <div className="min-w-0 space-y-6">
          {run && !running && <QlooStrip run={run} />}
          {(running || steps.length > 0) && (
            <ResearchLog
              collapsed={!running && run !== null}
              count={steps.length}
              planner={run?.planner?.requested === "model" ? "model-assisted" : "rules only"}
            >
              <h2 className={cn("text-lg font-semibold", !running && run !== null && "sr-only")}>Research steps</h2>
              <ol className="mt-3 space-y-2" aria-live="polite">
                {steps.map((s) => (
                  <li key={s.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5">
                      {s.status === "pending" && running ? <Loader2 className="size-4 animate-spin text-common" aria-hidden /> : <StepIcon status={s.status} />}
                    </span>
                    <span>
                      <span className="font-medium">{s.label}</span>
                      <span className="sr-only"> — {s.status === "pending" ? (running ? "in progress" : "not run") : s.status}</span>
                      {s.summary && <span className="block text-ink-soft">{s.summary}</span>}
                    </span>
                  </li>
                ))}
              </ol>
              {(decisions.length > 0 || run?.planner) && (
                <DecisionTrace decisions={decisions.length ? decisions : (run?.planner?.decisions ?? [])} run={running ? null : run} />
              )}
            </ResearchLog>
          )}

          {error && (
            <Callout tone="bad" title={ERROR_TITLES[error.kind]}>
              <p>{error.message}</p>
              {(error.kind === "unauthorized" || error.kind === "unavailable") && (
                <p className="mt-1">No live results are shown. You can run the fictional demonstration instead; every result in it is labelled fictional.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {error.retryable && error.kind !== "unauthorized" && (
                  <Button size="sm" variant="secondary" onClick={() => start()}>
                    Try again
                  </Button>
                )}
                {(error.kind === "unauthorized" || error.kind === "unavailable") && (
                  <Button size="sm" variant="secondary" onClick={() => start(true)}>
                    Run the fictional demonstration
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => navigate(stepHref("host"))}>
                  Continue without cultural evidence
                </Button>
              </div>
            </Callout>
          )}

          {!run && !running && !error && (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-8 text-center text-ink-soft">
              <p className="font-medium text-ink">No research yet</p>
              <p className="mt-1 text-sm">Choose a kind of venue and run research. You can also skip this and evaluate a host you already know.</p>
            </div>
          )}

          {run && linked && linked.runId !== run.runId && (
            <Callout tone="info" title={`Your chosen venue, ${linked.candidate.venue.name}, came from an earlier research run`}>
              Its evidence is kept with the choice (retrieved {new Date(linked.candidate.provenance.retrievedAt).toLocaleString()}). Choose a venue below to
              replace it.
            </Callout>
          )}
          {run && (
            <ResearchResults
              run={run}
              onEvaluate={evaluateCandidate}
              selectedId={linked?.runId === run.runId ? linked.candidate.venue.id : null}
              comparison={
                <>
                  <DiscoveryComparisonPanel run={run} auto={state.guided} />
                  <SensitivityPanel run={run} />
                </>
              }
            />
          )}
        </div>
      </div>

      <StepNav back="guest" next="host" nextLabel={state.host ? `Continue with ${state.host.venueName}` : "Continue to the host"} />
    </div>
  );
}

/** Qloo's part in one line of three steps: what went in, what it found, and what it can't say. */
function QlooStrip({ run }: { run: ResearchRun }) {
  const exact = run.seeds.filter((s) => s.status === "exact").length;
  const bridged = run.themes.reduce((n, t) => n + t.items.length, 0);
  const steps = [
    {
      Icon: Tags,
      value: `${exact} of ${run.seeds.length}`,
      label: "references matched",
      detail:
        run.seeds
          .filter((s) => s.status === "exact")
          .map((s) => s.input.label)
          .join(", ") || "none",
    },
    {
      Icon: Sparkles,
      value: String(bridged),
      label: bridged === 1 ? "title linked to them" : "titles linked to them",
      detail: run.themes[0]?.title ?? "no theme",
    },
    {
      Icon: Store,
      value: String(run.candidates.length),
      label: `${VENUE_CATEGORY_LABELS[run.request.venueCategory].toLowerCase()} venues ranked`,
      detail: "by how strongly their audiences share this taste",
    },
  ];
  return (
    <section aria-labelledby="qloo-strip-title" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="qloo-strip-title" className="text-lg font-semibold">
          What Qloo found
        </h2>
        <span className="text-xs text-ink-faint">
          {run.mode === "live" ? `${run.callsUsed} of ${run.callBudget} Qloo calls used · live run` : "Fictional demonstration · no Qloo calls"}
        </span>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-7">
        {steps.map((st, i) => (
          <li key={st.label} className="relative flex min-w-0 items-start gap-3 rounded-xl bg-common-soft/50 p-3.5">
            <st.Icon className="mt-1 size-5 shrink-0 text-common" aria-hidden />
            <div className="min-w-0">
              <p className="font-display text-2xl leading-none font-semibold tabular-nums">{st.value}</p>
              <p className="mt-1 text-sm font-medium">{st.label}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{st.detail}</p>
            </div>
            {i < steps.length - 1 && <ArrowRight className="absolute top-1/2 -right-5.5 hidden size-4 -translate-y-1/2 text-ink-faint sm:block" aria-hidden />}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-ink-soft">
        Taste only: nothing here measures a venue's rent, traffic, or willingness to partner. Those come from the host.
      </p>
    </section>
  );
}

/** While research runs, its steps stream in plainly; once done, they fold away behind one line. */
function ResearchLog({ collapsed, count, planner, children }: { collapsed: boolean; count: number; planner: string; children: React.ReactNode }) {
  if (!collapsed) return <Card>{children}</Card>;
  return (
    <Disclosure tone="card" title="How this research ran" meta={`${count} steps · ${planner}`}>
      {children}
    </Disclosure>
  );
}

function ResearchResults({
  run,
  onEvaluate,
  selectedId,
  comparison,
}: {
  run: ResearchRun;
  onEvaluate: (c: PartnershipCandidate) => void;
  selectedId: string | null;
  comparison: React.ReactNode;
}) {
  const exact = run.seeds.filter((s) => s.status === "exact").length;
  return (
    <div className="space-y-6">
      <section aria-labelledby="candidates-heading">
        <h2 id="candidates-heading" className="text-lg font-semibold">
          Venue candidates
        </h2>
        {run.candidates.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No venues were found for this search. You can still evaluate a host you choose yourself.</p>
        ) : (
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {run.candidates.map((c, i) => {
              const chosen = selectedId === c.venue.id;
              const featured = selectedId ? chosen : i === 0;
              return (
                <li key={c.venue.id} className={cn("card flex flex-col p-5", featured && "md:col-span-2 sm:p-6", chosen && "ring-2 ring-common")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-ink-faint">
                      #{c.rank} in this query
                      {chosen ? (
                        <span className="ml-2 font-semibold text-common">· Your chosen venue</span>
                      ) : (
                        featured && <span className="ml-2 font-semibold text-ink">· Closest taste match</span>
                      )}
                    </p>
                    <ProvenanceChip kind={c.provenance.kind} />
                  </div>
                  <h3 className={cn("mt-1 font-display leading-snug font-semibold", featured ? "text-2xl" : "text-lg")}>{c.venue.name}</h3>
                  <div className="mt-2">
                    <StrengthPill strength={c.strength} affinity={c.venue.affinity} />
                  </div>
                  {c.venue.address && (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {c.venue.address}
                    </p>
                  )}
                  {c.contributions.length > 0 && <p className="mt-2 text-sm text-ink-soft">Most influenced by: {influenceText(c.contributions).join(", ")}</p>}
                  {c.sharedTags.length > 0 && (
                    <p className="mt-2 text-sm">
                      <span className="text-ink-soft">Shares taste signals with the bridge: </span>
                      {c.sharedTags.join(", ")}
                    </p>
                  )}
                  <div className="mt-auto pt-4">
                    <Button variant={chosen ? "primary" : "secondary"} size="sm" onClick={() => onEvaluate(c)}>
                      {chosen ? "Continue with this venue" : "Evaluate a partnership"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {run.themes.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold">Cultural bridge</h2>
          <div className="mt-4 space-y-6">
            {run.themes.map((t) => (
              <section key={t.id} aria-labelledby={`theme-${t.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`theme-${t.id}`} className="font-display text-base font-semibold">
                    {t.title}
                  </h3>
                  <span className="flex gap-1.5">
                    <ProvenanceChip kind={t.provenance.kind} />
                    <ProvenanceChip kind="derived_rule" />
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{t.rationale}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {t.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 rounded-lg border border-line bg-paper/70 px-2.5 py-1.5 text-sm">
                      {i.name}
                      {i.affinity !== null && <StrengthPill strength={i.strength} affinity={i.affinity} />}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-faint">
                  Source: {t.provenance.request} · {new Date(t.provenance.retrievedAt).toLocaleString()}
                </p>
              </section>
            ))}
          </div>
        </Card>
      )}

      {comparison}

      <Disclosure tone="card" title="Reference matching" meta={`${exact} of ${run.seeds.length} exact`}>
        {run.seeds.length === 0 ? (
          <p className="text-sm text-ink-soft">No references were searched.</p>
        ) : (
          <ul className="divide-y divide-line">
            {run.seeds.map((s) => (
              <li key={`${s.input.label}-${s.input.kind}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{s.input.label}</span>
                  <span className="text-ink-faint"> → </span>
                  {s.entity ? s.entity.name : <span className="text-ink-faint">not found</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      s.status === "exact" ? "bg-ok-soft text-ok" : s.status === "uncertain" ? "bg-warn-soft text-warn" : "bg-sunken text-ink-faint",
                    )}
                  >
                    {s.status === "exact" ? "Exact match · used" : s.status === "uncertain" ? "Approximate · not used" : "Not used"}
                  </span>
                  <ProvenanceChip kind={s.provenance.kind} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Disclosure>

      <section aria-labelledby="limits-heading" className="rounded-[var(--radius-card)] border border-line bg-sunken/40 p-5">
        <h2 id="limits-heading" className="text-base font-semibold">
          What this research does not show
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {run.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Which planner made each decision, what was proposed, whether it was accepted, and what ran. */
function DecisionTrace({ decisions, run }: { decisions: PlannerDecision[]; run: ResearchRun | null }) {
  const trace = run?.planner;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-sm font-semibold">
        Planner decisions{" "}
        <span className="font-normal text-ink-faint">
          ·{" "}
          {trace
            ? trace.requested === "model"
              ? `model requested, ${trace.modelCalls} of ${trace.maxDecisions} model calls used`
              : "rules only"
            : "in progress"}
        </span>
      </p>
      {trace && trace.requested === "model" && <p className="mt-1 text-xs text-ink-faint">{trace.availability}</p>}
      <ul className="mt-2 space-y-2" aria-live="polite">
        {decisions.map((d) => (
          <li key={`${d.point}-${d.executed}`} className="flex gap-2.5 text-sm">
            {d.planner === "model" ? (
              <Bot className="mt-0.5 size-4 shrink-0 text-host" aria-hidden />
            ) : (
              <Cog className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
            )}
            <span>
              <span className="font-medium">{d.point === "bridge" ? "How to build the cultural bridge" : "Whether to widen an empty search"}:</span>{" "}
              {d.executed}
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                  d.planner === "model" ? "bg-host-soft text-host" : "bg-sunken text-ink-soft",
                )}
              >
                {d.planner === "model" ? "model, validated" : d.fallback ? "rules, after fallback" : "rules"}
              </span>
              {d.proposed && d.planner !== "model" && <span className="block text-xs text-ink-faint">Model proposed: {d.proposed}</span>}
              <span className="block text-xs text-ink-faint">{d.reason}</span>
              {d.rationale && (
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                  <ProvenanceChip kind="llm_interpretation" /> “{d.rationale}”
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {trace?.clarification && (
        <Callout tone="warn" className="mt-3" title="Please confirm a reference">
          {trace.clarification}
        </Callout>
      )}
      {trace?.stopReason && <p className="mt-2 text-sm text-warn">{trace.stopReason}</p>}
      <p className="mt-2 text-xs text-ink-faint">
        A model may only choose from a fixed list of research actions. It never decides feasibility, fees, or schedules.
      </p>
    </div>
  );
}

/** The guided example starts research itself, once, so the visitor reaches results without a form. */
function AutoStart({ when, onStart }: { when: boolean; onStart: () => Promise<void> }) {
  const done = useRef(false);
  useEffect(() => {
    if (!when || done.current) return;
    // Deferred so a development double-mount cancels the first attempt instead of aborting its request.
    const timer = setTimeout(() => {
      done.current = true;
      void onStart();
    }, 0);
    return () => clearTimeout(timer);
  }, [when, onStart]);
  return null;
}
