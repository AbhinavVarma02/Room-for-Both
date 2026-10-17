import { ArrowRight, Lightbulb, Scale, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { evaluateScenario } from "@shared/domain";
import { linkedSelection } from "@shared/domain/brief";
import { type ProposalConcept, mostPromising, proposalConcepts } from "@shared/domain/concepts";
import { money } from "@shared/domain/format";
import { blockerSummary, closestToWorking, featuredOption } from "@shared/domain/headline";
import type { ArrangementOption, OptionStatus, ScenarioEvaluation } from "@shared/domain/types";
import { useWorkspace } from "../../app/store";
import { StepHeader, StepNav } from "../../app/Workspace";
import { Button, Callout, Card, ProvenanceChip, StatusBadge } from "../../components/ui/primitives";
import { ProposalConcepts } from "./Concepts";
import { OptionCard } from "./OptionParts";

const COLORS: Record<OptionStatus, string> = { feasible: "#166534", conditional: "#8a5300", no_go: "#a1232f" };
const SHAPES: Record<OptionStatus, "circle" | "diamond" | "cross"> = { feasible: "circle", conditional: "diamond", no_go: "cross" };

/** Round axis steps (1, 2, or 5 × a power of ten) so tick labels read naturally. */
function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
  const out: number[] = [];
  for (let v = 0; v < max + step; v += step) out.push(v);
  return out;
}

/**
 * Trade-off view: guest outlay against host fee. Shape and colour both encode status, so the
 * chart does not rely on colour alone, and every point is also listed in the cards below.
 */
export function TradeoffChart({ evaluation }: { evaluation: ScenarioEvaluation }) {
  const points = evaluation.options.filter((o) => o.metrics.guestOutlayUsd !== null && o.metrics.hostFeeUsd !== null);
  const unplotted = evaluation.options.length - points.length;
  const nd = new Set(evaluation.frontier.nonDominatedIds);
  if (points.length === 0) {
    return <p className="text-sm text-ink-soft">No option has both a known guest outlay and a known host fee yet, so there is nothing to plot.</p>;
  }
  const W = 560;
  const H = 300;
  const pad = { l: 64, r: 20, t: 16, b: 44 };
  const xs = points.map((p) => p.metrics.guestOutlayUsd ?? 0);
  const ys = points.map((p) => p.metrics.hostFeeUsd ?? 0);
  const budget = evaluation.options[0]?.constraints.find((c) => c.id === "budget")?.inputs.find((i) => i.field === "maxOutlayUsd")?.value;
  const xTicks = niceTicks(Math.max(...xs, typeof budget === "number" ? budget : 0) * 1.05);
  const yTicks = niceTicks(Math.max(...ys) * 1.05);
  const xMax = xTicks[xTicks.length - 1] ?? 1;
  const yMax = yTicks[yTicks.length - 1] ?? 1;
  const x = (v: number) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="chart-title chart-desc">
        <title id="chart-title">Trade-off between guest outlay and host fee</title>
        <desc id="chart-desc">
          Each point is an arrangement option. Horizontal position is the guest's total outlay, vertical position is the host's fee. Circles are
          feasible, diamonds conditional, crosses no-go.
        </desc>
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={pad.t} y2={H - pad.b} stroke="#e4dccf" />
            <text x={x(t)} y={H - pad.b + 18} textAnchor="middle" fontSize="11" fill="#5f6a74">
              {money(t)}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e4dccf" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5f6a74">
              {money(t)}
            </text>
          </g>
        ))}
        {typeof budget === "number" && (
          <g>
            <line x1={x(budget)} x2={x(budget)} y1={pad.t} y2={H - pad.b} stroke="#0f766e" strokeDasharray="5 4" strokeWidth="1.5" />
            <text x={x(budget) + 4} y={pad.t + 12} fontSize="11" fill="#0f766e">
              guest budget
            </text>
          </g>
        )}
        <text x={(W + pad.l) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#4a5560">
          Guest total outlay →
        </text>
        <text x={14} y={(H - pad.b) / 2} textAnchor="middle" fontSize="12" fill="#4a5560" transform={`rotate(-90 14 ${(H - pad.b) / 2})`}>
          Host fee →
        </text>
        {points.map((p, i) => {
          const cx = x(p.metrics.guestOutlayUsd ?? 0) + (i % 3) * 3 - 3;
          const cy = y(p.metrics.hostFeeUsd ?? 0);
          const color = COLORS[p.status];
          const shape = SHAPES[p.status];
          return (
            <g key={p.id}>
              <title>{`${p.label}: ${p.status.replace("_", "-")}, outlay ${money(p.metrics.guestOutlayUsd ?? 0)}, fee ${money(p.metrics.hostFeeUsd ?? 0)}`}</title>
              {nd.has(p.id) && p.status !== "no_go" && <circle cx={cx} cy={cy} r={11} fill="none" stroke="#2f4b8f" strokeWidth="2" />}
              {shape === "circle" && <circle cx={cx} cy={cy} r={6} fill={color} />}
              {shape === "diamond" && <rect x={cx - 5.5} y={cy - 5.5} width={11} height={11} fill={color} transform={`rotate(45 ${cx} ${cy})`} />}
              {shape === "cross" && <path d={`M${cx - 5} ${cy - 5}L${cx + 5} ${cy + 5}M${cx + 5} ${cy - 5}L${cx - 5} ${cy + 5}`} stroke={color} strokeWidth="2.5" />}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span>● feasible</span>
        <span>◆ conditional</span>
        <span>✕ no-go</span>
        <span className="text-common">◯ on the frontier</span>
        {unplotted > 0 && <span>{unplotted} option{unplotted === 1 ? "" : "s"} not plotted: fee or costs unknown</span>}
      </figcaption>
    </figure>
  );
}

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
  if (!evaluation) return null;
  const promising = mostPromising(concepts);
  const nd = new Set(evaluation.frontier.nonDominatedIds);
  const groups: { status: OptionStatus; title: string; options: ArrangementOption[] }[] = [
    { status: "feasible", title: "Feasible on stated requirements", options: evaluation.options.filter((o) => o.status === "feasible") },
    { status: "conditional", title: "Conditional: waiting on missing inputs", options: evaluation.options.filter((o) => o.status === "conditional") },
    { status: "no_go", title: "No-go on current terms", options: evaluation.options.filter((o) => o.status === "no_go") },
  ];

  return (
    <div>
      <StepHeader step="frontier">
        Every arrangement Room for Both knows how to structure, checked against both parties' terms. Nothing here is a score: each status comes from
        specific checks you can open.
      </StepHeader>

      <Headline evaluation={evaluation} onReverse={(id) => navigate(`/workspace/reversal?option=${encodeURIComponent(id)}`)} />
      <WhatDecides concept={promising ?? concepts[0] ?? null} />
      <ProposalConcepts concepts={concepts} promising={promising} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,24rem)]">
        <Card>
          <h2 className="text-lg font-semibold">Trade-offs</h2>
          <div className="mt-3">
            <TradeoffChart evaluation={evaluation} />
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <p className="eyebrow">Summary</p>
            <ul className="mt-3 space-y-2">
              {(["feasible", "conditional", "no_go"] as const).map((s) => (
                <li key={s} className="flex items-center justify-between">
                  <StatusBadge status={s} />
                  <span className="font-display text-2xl font-semibold tabular-nums">{evaluation.counts[s]}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Callout tone={evaluation.twoSided.status === "two_sided" ? "ok" : "warn"} title={evaluation.twoSided.status === "two_sided" ? "Two-sided inputs" : evaluation.twoSided.status === "fictional_two_sided" ? "Fictional two-sided example" : "One-sided: host terms unconfirmed"}>
            {evaluation.twoSided.explanation}
          </Callout>
          <p className="text-sm text-ink-soft">{evaluation.frontier.note}</p>
        </div>
      </div>

      {groups.map(
        (g) =>
          g.options.length > 0 && (
            <section key={g.status} className="mt-10" aria-labelledby={`group-${g.status}`}>
              <h2 id={`group-${g.status}`} className="text-xl font-semibold">
                {g.title} <span className="text-ink-faint">({g.options.length})</span>
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {g.options.map((o) => (
                  <OptionCard
                    key={o.id}
                    option={o}
                    nonDominated={nd.has(o.id)}
                    action={
                      o.status === "no_go" ? (
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/workspace/reversal?option=${encodeURIComponent(o.id)}`)}>
                          What would change this?
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ),
      )}

      <StepNav back="host" next="reversal" nextLabel="Explore what would change the answer" />
    </div>
  );
}

/** The result in one glance: why the obvious arrangement fails and which change is closest to working. */
function Headline({ evaluation, onReverse }: { evaluation: ScenarioEvaluation; onReverse: (optionId: string) => void }) {
  const blockers = blockerSummary(evaluation);
  const featured = featuredOption(evaluation);
  const closest = closestToWorking(evaluation);
  const noGo = evaluation.counts.no_go;
  const failing = featured?.constraints.filter((c) => c.status === "fail") ?? [];
  return (
    <Card className="mb-6" aria-labelledby="headline-title">
      <h2 id="headline-title" className="text-lg font-semibold">
        {evaluation.counts.feasible > 0
          ? `${evaluation.counts.feasible} arrangement${evaluation.counts.feasible === 1 ? "" : "s"} feasible on stated requirements`
          : evaluation.counts.conditional > 0
            ? "Nothing is feasible yet: some options wait on answers, others are blocked"
            : "Every option is blocked on the current terms"}
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {featured && featured.status === "no_go" && failing.length > 0 && (
          <div className="rounded-xl border border-bad/25 bg-bad-soft/50 p-4 text-sm">
            <p className="font-semibold">Why “{featured.label}” fails</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
              {failing.slice(0, 2).map((c) => (
                <li key={c.id}>{c.explanation}</li>
              ))}
            </ul>
            {blockers[0] && blockers[0].count > 1 && (
              <p className="mt-2 text-ink-soft">
                The same check, {blockers[0].label.toLowerCase()}, blocks {blockers[0].count} of {noGo} no-go options.
              </p>
            )}
          </div>
        )}
        {closest && (
          <div className="rounded-xl border border-common/25 bg-common-soft/50 p-4 text-sm">
            <p className="font-semibold">Closest to working: {closest.option.label}</p>
            <p className="mt-1 text-ink-soft">Smallest verified change: {closest.changes.join(" ")}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-ink-soft">
              Re-checked with the same rules: <StatusBadge status={closest.option.status} short /> <ArrowRight className="size-3" aria-label="becomes" />{" "}
              <StatusBadge status={closest.statusAfter as OptionStatus} short />
            </p>
            <Button size="sm" className="mt-3" onClick={() => onReverse(closest.option.id)}>
              Try this change <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Cultural opportunity, operational feasibility, and commercial success, kept visibly apart. */
function WhatDecides({ concept }: { concept: ProposalConcept | null }) {
  return (
    <div className="mb-6 grid gap-3 md:grid-cols-3" role="list" aria-label="What decides what">
      <div role="listitem" className="rounded-xl border border-line bg-surface p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Lightbulb className="size-4 text-guest" aria-hidden /> Cultural opportunity
        </p>
        {concept ? (
          <>
            <p className="mt-1 font-medium">{concept.formatTitle}</p>
            <p className="mt-1 text-ink-soft">{concept.pitch}</p>
            <p className="mt-1 text-xs text-ink-faint">The ideas below show where this comes from and which formats work.</p>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {concept.sources.map((k) => (
                <ProvenanceChip key={k} kind={k} />
              ))}
            </p>
          </>
        ) : (
          <p className="mt-1 text-ink-soft">Run cultural research to get a theme worth proposing.</p>
        )}
      </div>
      <div role="listitem" className="rounded-xl border border-line bg-surface p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Scale className="size-4 text-common" aria-hidden /> Operational feasibility
        </p>
        <p className="mt-1 text-ink-soft">Decided below, only by both parties' stated terms. The theme never changes a fee, a schedule, or a check.</p>
      </div>
      <div role="listitem" className="rounded-xl border border-line bg-surface p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4 text-ink-faint" aria-hidden /> Commercial success
        </p>
        <p className="mt-1 text-ink-soft">Unknown. Nothing here forecasts revenue, foot traffic, or demand; only a real activation can show it.</p>
      </div>
    </div>
  );
}
