import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Loader2, MapPin, MinusCircle, Sparkles, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { SEED_KIND_LABELS, VENUE_CATEGORIES, VENUE_CATEGORY_LABELS, type VenueCategory } from "@shared/constants/vocabulary";
import type { PartnershipCandidate, ResearchRun, ResearchStep, ResearchStepId, Strength } from "@shared/schemas/evidence";
import { ApiRequestError, getConfig, streamResearch } from "../../app/api";
import { useWorkspace } from "../../app/store";
import { StepHeader, StepNav, stepHref } from "../../app/Workspace";
import { Button, Callout, Card, ProvenanceChip, cn } from "../../components/ui/primitives";

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

const STRENGTH: Record<Strength, { label: string; className: string }> = {
  strong: { label: "Very high affinity", className: "bg-common text-white" },
  moderate: { label: "High affinity", className: "bg-common-soft text-common" },
  weak: { label: "Lower affinity", className: "bg-sunken text-ink-soft" },
  unscored: { label: "No affinity score", className: "border border-dashed border-line-strong text-ink-faint" },
};

export function StrengthPill({ strength, affinity }: { strength: Strength; affinity: number | null }) {
  const s = STRENGTH[strength];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", s.className)} title="Relative to this query, per Qloo's published score ranges">
      {s.label}
      {affinity !== null && <span className="font-mono font-normal tabular-nums">· {affinity.toFixed(2)}</span>}
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
  const [category, setCategory] = useState<VenueCategory | null>(state.research?.request.venueCategory ?? (state.isExample ? "bookstore" : state.host?.venueCategory ?? null));
  const [steps, setSteps] = useState<StepState[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ResearchError | null>(null);
  const abort = useRef<AbortController | null>(null);

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
    dispatch({ type: "select_candidate", id: c.venue.id });
    dispatch({
      type: "set_host",
      host: {
        source: "entered_by_guest",
        venueName: c.venue.name.slice(0, 80),
        venueCategory: c.category,
        qlooEntityId: c.venue.id.slice(0, 64),
        goals: [],
        allowedFormats: null,
        availability: null,
        popupFeePerDayUsd: null,
        shelfFeePerWeekUsd: null,
        shelfMinWeeks: null,
        eventFeePerHourUsd: null,
        eventMinHours: null,
        guestFloorSqFt: null,
        shelfLinearFt: null,
        eventCapacity: null,
        staffHoursPerActivation: null,
        excludedCategories: null,
        samplingAllowed: null,
        alcoholOnPremises: null,
        requiresExclusivity: null,
        priorities: [],
        fixedFields: [],
      },
    });
    navigate(stepHref("host"));
  };

  const mode = config.data?.researchMode;

  return (
    <div>
      <StepHeader step="discovery">
        Find venues and themes your audience already connects with. Qloo's taste data suggests <em>which</em> relationship to explore; it says nothing
        about a venue's rent, traffic, or willingness to partner.
      </StepHeader>

      {mode === "fixture" && (
        <Callout tone="warn" className="mb-6" title="Fixture mode: fictional cultural data">
          Live Qloo access is not configured on this server, so research returns clearly labelled fictional results that exercise the same
          pipeline. No Qloo request is made.
        </Callout>
      )}
      {mode === "live" && (
        <Callout tone="info" className="mb-6" title="Live Qloo cultural intelligence">
          Results come from Qloo's Insights API in real time, within a fixed budget of {config.data?.callBudget} calls per run. A fictional
          demonstration is available if live access fails.
        </Callout>
      )}
      {mode === "live" && run?.mode === "fixture" && (
        <Callout tone="warn" className="mb-6" title="Showing the fictional demonstration">
          The results below are fictional demonstration data, not a Qloo response. Run research again to try live data.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="h-fit space-y-5">
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
                <label key={v} className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-sm", category === v ? "border-common bg-common text-white" : "border-line-strong bg-surface text-ink-soft")}>
                  <input type="radio" name="venue-category" value={v} className="sr-only" checked={category === v} onChange={() => setCategory(v)} />
                  {VENUE_CATEGORY_LABELS[v]}
                </label>
              ))}
            </div>
          </fieldset>
          <Button className="w-full" disabled={!category || running || !guest.market.city} onClick={() => start()}>
            {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {running ? "Researching…" : run ? "Run research again" : "Run cultural research"}
          </Button>
        </Card>

        <div className="space-y-6">
          {(running || steps.length > 0) && (
            <Card>
              <h2 className="text-lg font-semibold">Research steps</h2>
              <ol className="mt-3 space-y-2" aria-live="polite">
                {steps.map((s) => (
                  <li key={s.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5">{s.status === "pending" && running ? <Loader2 className="size-4 animate-spin text-common" aria-hidden /> : <StepIcon status={s.status} />}</span>
                    <span>
                      <span className="font-medium">{s.label}</span>
                      <span className="sr-only"> — {s.status === "pending" ? (running ? "in progress" : "not run") : s.status}</span>
                      {s.summary && <span className="block text-ink-soft">{s.summary}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
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

          {run && <ResearchResults run={run} onEvaluate={evaluateCandidate} selectedId={state.selectedCandidateId} />}
        </div>
      </div>

      <StepNav back="guest" next="host" nextLabel={state.host ? `Continue with ${state.host.venueName}` : "Continue to the host"} />
    </div>
  );
}

function ResearchResults({ run, onEvaluate, selectedId }: { run: ResearchRun; onEvaluate: (c: PartnershipCandidate) => void; selectedId: string | null }) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Reference matching</h2>
          <span className="text-xs text-ink-faint">
            {run.mode === "live" ? `${run.callsUsed} of ${run.callBudget} Qloo calls used · live run` : "Fictional demonstration · no Qloo calls"}
          </span>
        </div>
        {run.seeds.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No references were searched.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
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
      </Card>

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

      <section aria-labelledby="candidates-heading">
        <h2 id="candidates-heading" className="text-lg font-semibold">
          Venue candidates
        </h2>
        {run.candidates.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No venues were found for this search. You can still evaluate a host you choose yourself.</p>
        ) : (
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {run.candidates.map((c) => (
              <li key={c.venue.id} className={cn("card flex flex-col p-5", selectedId === c.venue.id && "ring-2 ring-common")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-ink-faint">#{c.rank} in this query</p>
                  <ProvenanceChip kind={c.provenance.kind} />
                </div>
                <h3 className="mt-1 font-display text-lg leading-snug font-semibold">{c.venue.name}</h3>
                <div className="mt-2">
                  <StrengthPill strength={c.strength} affinity={c.venue.affinity} />
                </div>
                {c.venue.address && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
                    <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {c.venue.address}
                  </p>
                )}
                {c.contributions.length > 0 && (
                  <p className="mt-2 text-sm text-ink-soft">
                    Most influenced by: {c.contributions.map((x) => `${x.seed} (${x.score.toFixed(2)})`).join(", ")}
                  </p>
                )}
                {c.sharedTags.length > 0 && (
                  <p className="mt-2 text-sm">
                    <span className="text-ink-soft">Shares taste signals with the bridge: </span>
                    {c.sharedTags.join(", ")}
                  </p>
                )}
                <p className="mt-3 text-xs text-ink-faint">Cultural data says nothing about this venue's fees, space, or interest. Those come from the host.</p>
                <div className="mt-auto pt-4">
                  <Button variant="secondary" size="sm" onClick={() => onEvaluate(c)}>
                    Evaluate a partnership with this venue
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="bg-sunken/40">
        <h2 className="text-base font-semibold">What this research does not show</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {run.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
