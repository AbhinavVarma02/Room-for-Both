import { money } from "@shared/domain/format";
import type { ArrangementOption, OptionStatus, ScenarioEvaluation } from "@shared/domain/types";

const COLORS: Record<OptionStatus, string> = { feasible: "#166534", conditional: "#8a5300", no_go: "#a1232f" };
const WORDS: Record<OptionStatus, string> = { feasible: "feasible", conditional: "conditional", no_go: "no-go" };

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

function Mark({ status, cx, cy, scale = 1 }: { status: OptionStatus; cx: number; cy: number; scale?: number }) {
  const c = COLORS[status];
  if (status === "feasible") return <circle cx={cx} cy={cy} r={6 * scale} fill={c} />;
  if (status === "conditional")
    return <rect x={cx - 5.5 * scale} y={cy - 5.5 * scale} width={11 * scale} height={11 * scale} fill={c} transform={`rotate(45 ${cx} ${cy})`} />;
  const d = 5 * scale;
  return <path d={`M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`} stroke={c} strokeWidth="2.5" />;
}

function LegendMark({ status }: { status: OptionStatus }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <Mark status={status} cx={8} cy={8} scale={0.9} />
    </svg>
  );
}

/**
 * Trade-off view: what the guest pays against what the host earns. Shape and colour both encode
 * status; options at the same amounts are drawn side by side and counted, and options with an
 * unknown amount are named rather than silently left out. The arrangement list is the keyboard
 * and screen-reader equivalent.
 */
export function TradeoffChart({ evaluation, selectedId }: { evaluation: ScenarioEvaluation; selectedId?: string | null }) {
  const points = evaluation.options.filter((o) => o.metrics.guestOutlayUsd !== null && o.metrics.hostFeeUsd !== null);
  const unplotted = evaluation.options.filter((o) => !points.includes(o));
  const nd = new Set(evaluation.frontier.nonDominatedIds);
  if (points.length === 0) {
    return <p className="text-sm text-ink-soft">No arrangement has both a known guest cost and a known host fee yet, so there is nothing to plot.</p>;
  }
  const W = 560;
  const H = 300;
  const pad = { l: 64, r: 20, t: 16, b: 46 };
  const xs = points.map((p) => p.metrics.guestOutlayUsd ?? 0);
  const ys = points.map((p) => p.metrics.hostFeeUsd ?? 0);
  const budget = evaluation.options[0]?.constraints.find((c) => c.id === "budget")?.inputs.find((i) => i.field === "maxOutlayUsd")?.value;
  const xTicks = niceTicks(Math.max(...xs, typeof budget === "number" ? budget : 0) * 1.05);
  const yTicks = niceTicks(Math.max(...ys) * 1.05);
  const xMax = xTicks[xTicks.length - 1] ?? 1;
  const yMax = yTicks[yTicks.length - 1] ?? 1;
  const x = (v: number) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);

  // Options with identical amounts sit side by side instead of hiding each other.
  const groups = new Map<string, ArrangementOption[]>();
  for (const p of points) {
    const key = `${p.metrics.guestOutlayUsd}|${p.metrics.hostFeeUsd}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const placed = [...groups.values()].flatMap((g) =>
    g.map((p, i) => ({ p, cx: x(p.metrics.guestOutlayUsd ?? 0) + (i - (g.length - 1) / 2) * 13, cy: y(p.metrics.hostFeeUsd ?? 0), shared: g.length })),
  );
  const selected = placed.find((q) => q.p.id === selectedId);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="chart-title chart-desc">
        <title id="chart-title">Trade-off between guest outlay and host fee</title>
        <desc id="chart-desc">
          Each mark is an arrangement. Left to right is what the guest pays in total; bottom to top is the host's fee. Circles are feasible, diamonds
          conditional, crosses no-go. The arrangement list on this page gives the same values.
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
            <text x={x(budget) - 4} y={pad.t + 12} fontSize="11" fill="#0f766e" textAnchor="end">
              guest budget {money(budget)}
            </text>
          </g>
        )}
        <text x={(W + pad.l) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#4a5560">
          What the guest pays in total →
        </text>
        <text x={14} y={(H - pad.b) / 2} textAnchor="middle" fontSize="12" fill="#4a5560" transform={`rotate(-90 14 ${(H - pad.b) / 2})`}>
          Fee to the host →
        </text>
        {placed.map(({ p, cx, cy }) => (
          <g key={p.id}>
            <title>{`${p.label}: ${WORDS[p.status]}. Guest pays ${money(p.metrics.guestOutlayUsd ?? 0)}, host fee ${money(p.metrics.hostFeeUsd ?? 0)}.`}</title>
            {nd.has(p.id) && p.status !== "no_go" && <circle cx={cx} cy={cy} r={11} fill="none" stroke="#2f4b8f" strokeWidth="2" />}
            <Mark status={p.status} cx={cx} cy={cy} />
          </g>
        ))}
        {selected && (
          <g aria-hidden>
            <circle cx={selected.cx} cy={selected.cy} r={15} fill="none" stroke="#1d2327" strokeWidth="1.5" strokeDasharray="3 3" />
            <text
              x={selected.cx > W / 2 ? selected.cx - 20 : selected.cx + 20}
              y={selected.cy - 14 < pad.t + 10 ? selected.cy + 26 : selected.cy - 14}
              fontSize="12"
              fontWeight="600"
              fill="#1d2327"
              textAnchor={selected.cx > W / 2 ? "end" : "start"}
            >
              {selected.p.label}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-3 space-y-1.5 text-xs text-ink-soft">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {(["feasible", "conditional", "no_go"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <LegendMark status={s} /> {WORDS[s]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-common">
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            on the frontier
          </span>
          {selected && (
            <span className="inline-flex items-center gap-1.5 text-ink">
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
              </svg>
              selected: {selected.p.label}
            </span>
          )}
        </span>
        {[...groups.values()].some((g) => g.length > 1) && <span className="block">Marks side by side share exactly the same amounts.</span>}
        {unplotted.length > 0 && <span className="block">Not plotted because a fee or cost is unknown: {unplotted.map((o) => o.label).join(", ")}.</span>}
      </figcaption>
    </figure>
  );
}
