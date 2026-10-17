import { ArrowRight, CheckCircle2, CircleDashed, FileText, Lock, ShieldCheck, XCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { applyChanges, evaluateScenario } from "@shared/domain";
import { linkedSelection } from "@shared/domain/brief";
import { mostPromising, proposalConcepts } from "@shared/domain/concepts";
import { money } from "@shared/domain/format";
import { blockerSummary, closestToWorking } from "@shared/domain/headline";
import type { ArrangementOption, OptionStatus, ScenarioEvaluation } from "@shared/domain/types";
import type { GuestProfile, HostProfile } from "@shared/schemas/profiles";
import { useWorkspace } from "../../app/store";
import { StepHeader, StepNav } from "../../app/Workspace";
import { Button, Disclosure, Notice, PartyTag, StatusBadge, StatusMark, cn, useMediaQuery } from "../../components/ui/primitives";
import { ProposalConcepts } from "./Concepts";
import { OptionDetail } from "./OptionParts";
import { TradeoffChart } from "./TradeoffChart";
import { TRANSITION_GRID, TransitionArrow, TransitionStep, reasonsOf, toneOf } from "./Transition";

const STATUS_ORDER: OptionStatus[] = ["feasible", "conditional", "no_go"];
const TILE: Record<OptionStatus, { word: string; hint: string; Icon: typeof CheckCircle2; on: string; text: string }> = {
  feasible: { word: "Feasible", hint: "Pass every check", Icon: CheckCircle2, on: "border-ok/30 bg-ok-soft", text: "text-ok" },
  conditional: { word: "Conditional", hint: "Waiting on answers", Icon: CircleDashed, on: "border-warn/30 bg-warn-soft", text: "text-warn" },
  no_go: { word: "No-go", hint: "Blocked on current terms", Icon: XCircle, on: "border-bad/25 bg-bad-soft", text: "text-bad" },
};
type Filter = OptionStatus | "all";
const WHOSE: Record<ScenarioEvaluation["twoSided"]["status"], { title: string; tone: "warn" | "info" }> = {
  two_sided: { title: "Two-sided inputs", tone: "info" },
  fictional_two_sided: { title: "Fictional two-sided example", tone: "warn" },
  hypothetical_host: { title: "Hypothetical host terms", tone: "warn" },
  one_sided: { title: "One-sided: host terms unconfirmed", tone: "warn" },
};

export function Frontier() {
  const { state } = useWorkspace();
  const [, navigate] = useLocation();
  const { guest, host } = state;
  const evaluation = useMemo(() => (guest && host ? evaluateScenario({ guest, host }) : null), [guest, host]);
  const concepts = useMemo(() => {
    if (!evaluation || !guest || !host) return [];
    const selection = linkedSelection(host, state.selection);
    return proposalConcepts(
      {
        guestName: guest.businessName,
        guestProducts: guest.productCategories,
        host,
        themes: selection?.guestThemes ?? state.research?.themes ?? [],
        bridgeDomain: selection?.bridgeDomain ?? state.research?.bridgeDomain ?? null,
        venueBridge: selection?.venueBridge ?? null,
        signals: selection?.signals ?? state.research?.seeds.filter((x) => x.status === "exact").map((x) => x.input.label) ?? [],
        evidenceMode: selection?.mode ?? state.research?.mode ?? null,
      },
      evaluation,
    );
  }, [evaluation, guest, host, state.selection, state.research]);
  const closest = useMemo(() => (evaluation ? closestToWorking(evaluation) : null), [evaluation]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const explorer = useRef<HTMLElement>(null);
  if (!evaluation || !guest || !host) return null;

  const reverse = (id: string) => navigate(`/workspace/reversal?option=${encodeURIComponent(id)}`);
  const showStatus = (s: OptionStatus) => {
    setFilter(s);
    setSelected(null);
    explorer.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  // Whose inputs these are changes how far the result can be relied on, so it sits beside the answer,
  // except for the labelled example, whose notice is already at the top of every step.
  const whose = evaluation.twoSided.status === "fictional_two_sided" && state.isExample ? null : WHOSE[evaluation.twoSided.status];

  return (
    <div>
      <StepHeader step="frontier">Every way these two businesses could work together, checked against both sides' terms.</StepHeader>

      <DecisionSummary evaluation={evaluation} onShow={showStatus} />
      {whose && (
        <Notice className="mt-3" tone={whose.tone} title={whose.title}>
          {evaluation.twoSided.explanation}
        </Notice>
      )}

      {evaluation.counts.feasible > 0 ? (
        <ReadyPanel evaluation={evaluation} onBrief={() => navigate("/workspace/brief")} />
      ) : closest ? (
        <ClosestPanel
          guest={guest}
          host={host}
          option={closest.option}
          reversal={evaluation.reversals.find((r) => r.optionId === closest.option.id)}
          onExplore={() => reverse(closest.option.id)}
        />
      ) : (
        <BlockedPanel evaluation={evaluation} onReverse={() => navigate("/workspace/reversal")} />
      )}

      <ProposalConcepts concepts={concepts} promising={mostPromising(concepts)} />

      <ArrangementExplorer
        ref={explorer}
        evaluation={evaluation}
        filter={filter}
        onFilter={(f) => {
          setFilter(f);
          setSelected(null);
        }}
        selectedId={selected ?? closest?.option.id ?? null}
        onSelect={setSelected}
        onReverse={reverse}
      />

      <div className="mt-6 space-y-3">
        <Disclosure
          tone="card"
          title="Trade-off chart: what the guest pays against the host's fee"
          meta={`${evaluation.options.filter((o) => o.metrics.guestOutlayUsd !== null && o.metrics.hostFeeUsd !== null).length} plotted`}
        >
          <TradeoffChart evaluation={evaluation} selectedId={selected ?? closest?.option.id ?? null} />
          <p className="mt-3 text-sm text-ink-soft">{evaluation.frontier.note}</p>
        </Disclosure>
        <Disclosure tone="card" title="How these results are decided">
          <ul className="space-y-3 text-sm text-ink-soft">
            <li>
              <span className="font-semibold text-ink">Operational feasibility</span> comes only from both sides' stated terms, through fixed rules you can open
              on each arrangement. Cultural evidence never changes a fee, a schedule, or a check.
            </li>
            <li>
              <span className="font-semibold text-ink">Cultural opportunity</span> suggests which idea is worth proposing. It is not a proxy for space, traffic,
              rent, or a venue's willingness to partner.
            </li>
            <li>
              <span className="font-semibold text-ink">Commercial success</span> is unknown. Nothing here forecasts revenue, foot traffic, or demand; only a
              real activation can show it.
            </li>
            <li>
              <span className="font-semibold text-ink">Whose inputs these are:</span> {evaluation.twoSided.explanation}
            </li>
          </ul>
        </Disclosure>
      </div>

      <StepNav back="host" next="reversal" nextLabel="Explore what would change the answer" nextVariant="secondary" />
    </div>
  );
}

function headline(e: ScenarioEvaluation): { answer: string; detail: string } {
  const { feasible, conditional, no_go } = e.counts;
  const total = e.options.length;
  if (feasible > 0)
    return {
      answer: "Yes, on stated terms.",
      detail: `${feasible} of ${total} arrangement${feasible === 1 ? " passes" : "s pass"} every check. Both businesses still need to agree.`,
    };
  if (conditional > 0)
    return {
      answer: `Not yet, but ${conditional} could work.`,
      detail: `${conditional} arrangement${conditional === 1 ? "" : "s"} could work once open questions are answered; ${no_go} ${no_go === 1 ? "is" : "are"} blocked on current terms.`,
    };
  return { answer: "Not on current terms.", detail: `All ${total} arrangements are blocked. The panel below shows what stands in the way.` };
}

/** The decision in one glance: the answer, three counts, and the most common blocker. */
function DecisionSummary({ evaluation, onShow }: { evaluation: ScenarioEvaluation; onShow: (s: OptionStatus) => void }) {
  const h = headline(evaluation);
  const blocker = blockerSummary(evaluation, 1)[0];
  return (
    <section aria-labelledby="decision-title" className="card p-5 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-center">
        <div>
          <h2 id="decision-title" className="eyebrow !font-sans">
            Can these businesses work together?
          </h2>
          <p className="mt-2 font-display text-3xl leading-tight font-semibold sm:text-4xl">{h.answer}</p>
          <p className="mt-2 max-w-xl text-ink-soft">{h.detail}</p>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Arrangements by status">
          {STATUS_ORDER.map((s) => {
            const t = TILE[s];
            const n = evaluation.counts[s];
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onShow(s)}
                  aria-label={`${n} ${t.word.toLowerCase()}: ${t.hint.toLowerCase()}. Show ${n === 1 ? "it" : "them"} in the list.`}
                  className={cn(
                    "flex h-full w-full flex-col items-start rounded-xl border p-3 text-left transition-colors sm:p-4",
                    n > 0 ? t.on : "border-line bg-sunken/40",
                    "hover:border-ink-faint",
                  )}
                >
                  <span className={cn("flex items-center gap-1.5 text-xs font-semibold sm:text-sm", n > 0 ? t.text : "text-ink-faint")}>
                    <t.Icon className="size-4 shrink-0" aria-hidden /> <span className="max-[400px]:sr-only">{t.word}</span>
                  </span>
                  <span className={cn("mt-1 font-display text-4xl leading-none font-semibold tabular-nums sm:text-5xl", n > 0 ? "text-ink" : "text-ink-faint")}>
                    {n}
                  </span>
                  <span className={cn("mt-1 text-xs font-semibold min-[401px]:hidden", n > 0 ? t.text : "text-ink-faint")} aria-hidden>
                    {t.word}
                  </span>
                  <span className="mt-1.5 hidden text-xs text-ink-soft sm:block">{t.hint}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {blocker && blocker.count > 1 && (
        <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-sm">
          <XCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
          <span>
            <span className="font-semibold">Biggest blocker: {blocker.label.toLowerCase()}</span>
            <span className="text-ink-soft">
              {" "}
              stops {blocker.count} of {evaluation.counts.no_go} blocked arrangements. {blocker.example}
            </span>
          </span>
        </p>
      )}
    </section>
  );
}

/**
 * The arrangement closest to working and the smallest verified change, shown as a before → after
 * transition. Both states come from the rules engine; the "after" is re-checked by applying the change
 * to a copy of the scenario, and the change is labelled as a proposal nobody has agreed to.
 */
function ClosestPanel({
  guest,
  host,
  option,
  reversal,
  onExplore,
}: {
  guest: GuestProfile;
  host: HostProfile;
  option: ArrangementOption;
  reversal: ScenarioEvaluation["reversals"][number] | undefined;
  onExplore: () => void;
}) {
  const change = reversal?.minimalChange;
  const after = useMemo(() => {
    if (!change) return null;
    return evaluateScenario(applyChanges({ guest, host }, change.changes)).options.find((o) => o.id === option.id) ?? null;
  }, [guest, host, change, option.id]);
  if (!change || !after) return null;
  const nowReasons = reasonsOf(option);
  const stillOpen = after.constraints.filter((c) => c.status === "unknown").map((c) => c.requirement?.text ?? c.explanation);
  const parties = [...new Set(change.changes.map((c) => c.party))];

  return (
    <section aria-labelledby="closest-title" className="mt-6 rounded-[var(--radius-card)] border border-common/25 bg-common-soft/40 p-5 sm:p-7">
      <p className="eyebrow">Closest to agreement</p>
      <h2 id="closest-title" className="mt-1 text-2xl font-semibold sm:text-3xl">
        {option.label}
      </h2>
      <div className={cn("mt-5", TRANSITION_GRID)}>
        <TransitionStep tone={toneOf(option.status)} label="Now" badge={<StatusBadge status={option.status} short />}>
          <ul className="space-y-1">
            {nowReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </TransitionStep>
        <TransitionArrow />
        <TransitionStep tone="change" label="Proposed change">
          <ul className="space-y-2">
            {change.changes.map((c) => (
              <li key={`${c.party}.${c.field}`} className="flex items-start gap-2 font-medium">
                <PartyTag party={c.party} /> <span>{c.description}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">
            Not agreed: the {parties.join(" and ")} {parties.length > 1 ? "have" : "has"} not confirmed this.
          </p>
        </TransitionStep>
        <TransitionArrow />
        <TransitionStep tone={toneOf(change.statusAfter)} label="Re-checked" badge={<StatusBadge status={change.statusAfter} short />}>
          {stillOpen.length > 0 ? (
            <>
              <p className="text-ink-soft">Still waiting on:</p>
              <ul className="mt-0.5 space-y-1">
                {stillOpen.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : change.statusAfter === "feasible" ? (
            <p>Passes every check on stated terms.</p>
          ) : (
            <p>Still blocked by another check.</p>
          )}
        </TransitionStep>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button size="lg" onClick={onExplore}>
          Explore the change <ArrowRight className="size-4" aria-hidden />
        </Button>
        <p className="flex items-center gap-1.5 text-sm text-ink-soft">
          <ShieldCheck className="size-4 shrink-0 text-common" aria-hidden /> Same rules, re-run. A what-if, not an agreement.
        </p>
      </div>
    </section>
  );
}

/** When something already passes, lead with it: the next move is the brief, not a change. */
function ReadyPanel({ evaluation, onBrief }: { evaluation: ScenarioEvaluation; onBrief: () => void }) {
  const nd = new Set(evaluation.frontier.nonDominatedIds);
  const feasible = evaluation.options.filter((o) => o.status === "feasible");
  const option = feasible.find((o) => nd.has(o.id)) ?? feasible[0];
  if (!option) return null;
  return (
    <section aria-labelledby="ready-title" className="mt-6 rounded-[var(--radius-card)] border border-ok/30 bg-ok-soft/40 p-5 sm:p-7">
      <p className="eyebrow">Ready to discuss</p>
      <h2 id="ready-title" className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold sm:text-3xl">
        {option.label} <StatusBadge status="feasible" short />
      </h2>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-ink-faint">Guest pays in total</dt>
          <dd className="text-lg font-semibold tabular-nums">{option.metrics.guestOutlayUsd === null ? "Unknown" : money(option.metrics.guestOutlayUsd)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Host fee</dt>
          <dd className="text-lg font-semibold tabular-nums">{option.metrics.hostFeeUsd === null ? "Unknown" : money(option.metrics.hostFeeUsd)}</dd>
        </div>
      </dl>
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">
        It passes every check on both sides' stated terms. That is not an agreement: both businesses still confirm the details in the brief.
      </p>
      <Button size="lg" className="mt-5" onClick={onBrief}>
        <FileText className="size-4" aria-hidden /> Build the decision brief
      </Button>
    </section>
  );
}

/** No verified change exists: show what actually blocks, never an invented improvement. */
function BlockedPanel({ evaluation, onReverse }: { evaluation: ScenarioEvaluation; onReverse: () => void }) {
  const blockers = blockerSummary(evaluation, 3);
  const locked = [...new Set(evaluation.reversals.flatMap((r) => r.nonNegotiableBlockers))];
  const waiting = evaluation.options.filter((o) => o.status === "conditional");
  return (
    <section aria-labelledby="blocked-title" className="mt-6 rounded-[var(--radius-card)] border border-line-strong bg-sunken/50 p-5 sm:p-7">
      <p className="eyebrow">What stands in the way</p>
      <h2 id="blocked-title" className="mt-1 text-2xl font-semibold">
        {waiting.length > 0 ? "Answers are needed before anything can work" : "No single negotiable change unblocks an arrangement"}
      </h2>
      {waiting.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {[...new Set(waiting.flatMap((o) => o.constraints.filter((c) => c.status === "unknown").map((c) => c.requirement?.text ?? c.explanation)))].map(
            (t) => (
              <li key={t} className="flex items-start gap-2">
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden /> {t}
              </li>
            ),
          )}
        </ul>
      )}
      {blockers.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {blockers.map((b) => (
            <li key={b.id} className="flex items-start gap-2">
              <XCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
              <span>
                <span className="font-semibold">{b.label}</span> blocks {b.count} arrangement{b.count === 1 ? "" : "s"}.{" "}
                <span className="text-ink-soft">{b.example}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {locked.length > 0 && (
        <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> Some blockers depend on terms marked non-negotiable:{" "}
          {locked.map((b) => b.replace(/_/g, " ")).join(", ")}.
        </p>
      )}
      <Button size="lg" className="mt-5" onClick={onReverse}>
        Explore what would change the answer <ArrowRight className="size-4" aria-hidden />
      </Button>
    </section>
  );
}

interface ExplorerProps {
  evaluation: ScenarioEvaluation;
  filter: Filter;
  onFilter: (f: Filter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReverse: (id: string) => void;
  ref: React.Ref<HTMLElement>;
}

/** All arrangements as a compact list with one focused detail: side by side on wide screens, inline on narrow ones. */
function ArrangementExplorer({ evaluation, filter, onFilter, selectedId, onSelect, onReverse, ref }: ExplorerProps) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const nd = new Set(evaluation.frontier.nonDominatedIds);
  const sorted = [...evaluation.options].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || Number(nd.has(b.id)) - Number(nd.has(a.id)),
  );
  const visible = filter === "all" ? sorted : sorted.filter((o) => o.status === filter);
  const current = visible.find((o) => o.id === selectedId) ?? visible[0] ?? null;
  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: evaluation.options.length },
    ...STATUS_ORDER.map((s) => ({ id: s, label: TILE[s].word, n: evaluation.counts[s] })),
  ];
  const detail = (o: ArrangementOption, level: 3 | 4) => (
    <OptionDetail option={o} nonDominated={nd.has(o.id)} onReverse={() => onReverse(o.id)} headingLevel={level} />
  );

  return (
    <section ref={ref} className="mt-12 scroll-mt-6" aria-labelledby="explorer-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Arrangement explorer</p>
          <h2 id="explorer-title" className="mt-1 text-2xl font-semibold">
            All {evaluation.options.length} arrangements
          </h2>
        </div>
        <div role="group" aria-label="Show arrangements by status" className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => onFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.id ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-soft hover:text-ink",
              )}
            >
              {f.id !== "all" && <StatusMark status={f.id} className={filter === f.id ? "text-white" : undefined} label={false} />}
              {f.label} <span className="tabular-nums opacity-75">{f.n}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="card mt-4 p-6 text-sm text-ink-soft">No arrangement has this status on the current terms.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:items-start">
          <ul className="card divide-y divide-line overflow-hidden p-0" aria-label="Arrangements">
            {visible.map((o) => {
              const active = current?.id === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-controls={wide ? "arrangement-detail" : undefined}
                    onClick={() => onSelect(o.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      active ? "bg-common-soft/70 shadow-[inset_3px_0_0_var(--color-common)]" : "hover:bg-sunken/60",
                    )}
                  >
                    <StatusMark status={o.status} className="text-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{o.label}</span>
                      <span className="block text-xs text-ink-soft">
                        {TILE[o.status].word}
                        {nd.has(o.id) && o.status !== "no_go" && " · on the frontier"} · guest{" "}
                        {o.metrics.guestOutlayUsd === null ? "unknown" : money(o.metrics.guestOutlayUsd)}
                      </span>
                    </span>
                  </button>
                  {!wide && active && <div className="border-t border-line bg-surface px-4 py-4">{detail(o, 3)}</div>}
                </li>
              );
            })}
          </ul>
          {wide && current && (
            <div id="arrangement-detail" className="card sticky top-4 p-6">
              {detail(current, 3)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
