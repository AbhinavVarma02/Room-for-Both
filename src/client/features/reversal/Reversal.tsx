import { ArrowRight, History, Lock, RotateCcw, Wand2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { DAYS, DAY_LABELS, type Day } from "@shared/constants/vocabulary";
import { applyChanges, diffEvaluations, evaluateScenario } from "@shared/domain";
import { clock, money } from "@shared/domain/format";
import type { ArrangementOption, OptionStatus } from "@shared/domain/types";
import type { Party } from "@shared/schemas/common";
import type { GuestProfile, HostProfile, Scenario } from "@shared/schemas/profiles";
import { useWorkspace } from "../../app/store";
import { StepHeader, StepNav } from "../../app/Workspace";
import { Button, Callout, Card, PartyTag, Slider, StatusBadge, cn } from "../../components/ui/primitives";
import { ConstraintRow } from "../frontier/OptionParts";

type NumericGuest = "maxOutlayUsd" | "ownCostPerActivationUsd" | "popupFootprintSqFt" | "shelfLinearFt" | "staffCount";
type NumericHost =
  | "popupFeePerDayUsd"
  | "shelfFeePerWeekUsd"
  | "shelfMinWeeks"
  | "eventFeePerHourUsd"
  | "eventMinHours"
  | "guestFloorSqFt"
  | "shelfLinearFt"
  | "eventCapacity"
  | "staffHoursPerActivation";

interface Knob {
  party: Party;
  field: NumericGuest | NumericHost;
  label: string;
  max: (base: number) => number;
  min?: number;
  step?: number;
  format: (v: number) => string;
  start: number;
}

const usd = (v: number) => money(v);
const KNOBS: Knob[] = [
  { party: "guest", field: "maxOutlayUsd", label: "Guest budget", max: (b) => Math.max(5000, b * 2), step: 25, format: usd, start: 1000 },
  { party: "guest", field: "ownCostPerActivationUsd", label: "Guest own costs", max: (b) => Math.max(2000, b * 2), step: 25, format: usd, start: 300 },
  { party: "guest", field: "popupFootprintSqFt", label: "Guest pop-up footprint", max: (b) => Math.max(120, b * 2), format: (v) => `${v} sq ft`, start: 30 },
  { party: "guest", field: "shelfLinearFt", label: "Guest shelf space needed", max: (b) => Math.max(12, b * 2), format: (v) => `${v} ft`, start: 3 },
  { party: "host", field: "eventFeePerHourUsd", label: "Host event fee", max: (b) => Math.max(1500, b * 2), step: 25, format: (v) => `${money(v)}/h`, start: 300 },
  { party: "host", field: "eventMinHours", label: "Host minimum event length", max: () => 6, min: 1, format: (v) => `${v} h`, start: 2 },
  { party: "host", field: "popupFeePerDayUsd", label: "Host pop-up day rate", max: (b) => Math.max(2000, b * 2), step: 25, format: (v) => `${money(v)}/day`, start: 500 },
  { party: "host", field: "shelfFeePerWeekUsd", label: "Host shelf fee", max: (b) => Math.max(300, b * 2), step: 5, format: (v) => `${money(v)}/wk`, start: 60 },
  { party: "host", field: "shelfMinWeeks", label: "Host minimum shelf term", max: () => 12, min: 1, format: (v) => `${v} wk`, start: 4 },
  { party: "host", field: "guestFloorSqFt", label: "Host floor space", max: (b) => Math.max(120, b * 2), format: (v) => `${v} sq ft`, start: 30 },
  { party: "host", field: "staffHoursPerActivation", label: "Host staff hours", max: () => 12, format: (v) => `${v} h`, start: 2 },
];

function read(s: Scenario, k: Knob): number | null {
  return k.party === "guest" ? (s.guest[k.field as NumericGuest] as number | null) : (s.host[k.field as NumericHost] as number | null);
}
function write(s: Scenario, k: Knob, v: number): Scenario {
  return k.party === "guest" ? { ...s, guest: { ...s.guest, [k.field]: v } as GuestProfile } : { ...s, host: { ...s.host, [k.field]: v } as HostProfile };
}

const STATUS_RANK: Record<OptionStatus, number> = { feasible: 0, conditional: 1, no_go: 2 };

export function Reversal() {
  const { state, dispatch } = useWorkspace();
  const [, navigate] = useLocation();
  const search = useSearch();
  const { guest, host } = state;
  const baseline = useMemo<Scenario | null>(() => (guest && host ? { guest, host } : null), [guest, host]);
  const whatIf = state.whatIf ?? baseline;
  const baseEval = useMemo(() => (baseline ? evaluateScenario(baseline) : null), [baseline]);
  const liveEval = useMemo(() => (whatIf ? evaluateScenario(whatIf) : null), [whatIf]);
  const committed = useRef<Scenario | null>(whatIf);
  // Pin the initial selection so what-if edits never silently switch which option is being examined.
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(search).get("option") ?? baseEval?.reversals[0]?.optionId ?? null);

  if (!baseline || !whatIf || !baseEval || !liveEval) return null;

  const candidates = liveEval.options.filter((o) => o.status !== "feasible");
  const selectedId = selected && liveEval.options.some((o) => o.id === selected) ? selected : (liveEval.reversals[0]?.optionId ?? candidates[0]?.id ?? liveEval.options[0]?.id);
  const option = liveEval.options.find((o) => o.id === selectedId) as ArrangementOption | undefined;
  const reversal = liveEval.reversals.find((r) => r.optionId === selectedId);
  const changed = JSON.stringify(whatIf) !== JSON.stringify(baseline);

  const update = (next: Scenario) => dispatch({ type: "set_what_if", scenario: next });
  const commit = (party: Party, field: string, from: unknown, to: unknown, next?: Scenario) => {
    const before = committed.current ?? baseline;
    const after = next ?? whatIf;
    const entry = diffEvaluations(evaluateScenario(before), evaluateScenario(after), { party, field, from, to }, state.trace.length + 1);
    dispatch({ type: "push_trace", entry });
    committed.current = after;
  };

  const toggleHostDay = (day: Day) => {
    const windows = whatIf.host.availability ?? [];
    const has = windows.some((w) => w.day === day);
    const guestWindow = whatIf.guest.availability?.find((w) => w.day === day);
    const nextWindows = has ? windows.filter((w) => w.day !== day) : [...windows, guestWindow ? { ...guestWindow } : { day, start: 17, end: 21 }];
    const next = { ...whatIf, host: { ...whatIf.host, availability: nextWindows } };
    update(next);
    commit("host", "availability", has ? `open ${DAY_LABELS[day]}` : `closed ${DAY_LABELS[day]}`, has ? `closed ${DAY_LABELS[day]}` : `open ${DAY_LABELS[day]}`, next);
  };

  const setBool = (field: "samplingAllowed" | "requiresExclusivity", value: boolean | null) => {
    const next = { ...whatIf, host: { ...whatIf.host, [field]: value } };
    update(next);
    commit("host", field, whatIf.host[field], value, next);
  };

  return (
    <div>
      <StepHeader step="reversal">
        Pick an option to see exactly why it is blocked and the smallest negotiable change that would unblock it. Then move the controls: every
        decision recomputes instantly from the same rules, without calling any outside service.
      </StepHeader>

      {changed && (
        <Callout tone="warn" className="mb-6" title="What-if mode: these values are hypothetical">
          They are nobody's actual terms until the parties agree. Reset to return to the entered values.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="space-y-6">
          <Card>
            <label htmlFor="option-select" className="eyebrow">
              Option
            </label>
            <select id="option-select" className="input mt-2" value={selectedId} onChange={(e) => setSelected(e.target.value)}>
              {liveEval.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} — {o.status === "no_go" ? "no-go" : o.status}
                </option>
              ))}
            </select>
            {option && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <StatusBadge status={option.status} />
                {baseEval.options.find((o) => o.id === option.id)?.status !== option.status && (
                  <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                    was <StatusBadge status={baseEval.options.find((o) => o.id === option.id)?.status ?? option.status} short />
                  </span>
                )}
              </div>
            )}
          </Card>

          {option && option.status === "no_go" && (
            <Card>
              <h2 className="text-lg font-semibold">Why is this blocked?</h2>
              <ul className="mt-2 divide-y divide-line">
                {option.constraints
                  .filter((c) => c.status === "fail")
                  .map((c) => (
                    <ConstraintRow key={c.id} c={c} />
                  ))}
              </ul>
            </Card>
          )}

          {option && option.status === "conditional" && (
            <Card>
              <h2 className="text-lg font-semibold">What is still unknown?</h2>
              <ul className="mt-2 divide-y divide-line">
                {option.constraints
                  .filter((c) => c.status === "unknown")
                  .map((c) => (
                    <ConstraintRow key={c.id} c={c} />
                  ))}
              </ul>
            </Card>
          )}

          {option && option.status === "feasible" && <Callout tone="ok" title="Nothing blocks this option on the current values." />}

          {reversal && (
            <Card>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Wand2 className="size-5 text-common" aria-hidden /> Smallest change that works
              </h2>
              {reversal.minimalChange ? (
                <>
                  <ol className="mt-3 space-y-2">
                    {reversal.minimalChange.changes.map((c) => (
                      <li key={`${c.party}.${c.field}`} className="flex items-start gap-2 rounded-lg border border-line bg-paper/60 p-3 text-sm">
                        <PartyTag party={c.party} />
                        <span>{c.description}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    Re-checked with the same rules: the option becomes <StatusBadge status={reversal.minimalChange.statusAfter} short />
                  </p>
                  <Button
                    className="mt-4"
                    variant="secondary"
                    onClick={() => {
                      const next = applyChanges(whatIf, reversal.minimalChange?.changes ?? []);
                      update(next);
                      commit("host", "suggested changes", "current", reversal.minimalChange?.changes.map((c) => c.description).join(" ") ?? "", next);
                    }}
                  >
                    Try these changes in the what-if
                  </Button>
                </>
              ) : (
                <div className="mt-3 flex gap-2 text-sm text-ink-soft">
                  <Lock className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                  <p>
                    No negotiable change can unblock this option: it depends on terms a party marked as non-negotiable (
                    {reversal.nonNegotiableBlockers.map((b) => b.replace(/_/g, " ")).join(", ")}).
                  </p>
                </div>
              )}
              {reversal.candidates.some((c) => c.changes.length > 1) && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-medium text-common">Other ways to clear each check</summary>
                  <ul className="mt-2 space-y-3">
                    {reversal.candidates.map((c) => (
                      <li key={c.constraint}>
                        <p className="font-medium capitalize">{c.constraint.replace(/_/g, " ")}</p>
                        <ul className="mt-1 space-y-1">
                          {c.changes.map((ch) => (
                            <li key={`${ch.party}.${ch.field}.${ch.kind}`} className={cn("flex items-start gap-2", !ch.negotiable && "text-ink-faint line-through")}>
                              <PartyTag party={ch.party} /> {ch.description} {!ch.negotiable && <span className="no-underline">(non-negotiable)</span>}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          )}

          <Card>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <History className="size-5 text-ink-soft" aria-hidden /> Decision trace
            </h2>
            {state.trace.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Changes you make in the what-if appear here with every decision they flipped.</p>
            ) : (
              <ol className="mt-3 space-y-3" aria-live="polite">
                {[...state.trace].reverse().map((t) => (
                  <li key={t.seq} className="rounded-lg border border-line p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-faint">#{t.seq}</span>
                      <PartyTag party={t.change.party} />
                      <span className="font-medium">{t.change.field}</span>
                      <span className="text-ink-soft">
                        {String(t.change.from ?? "unknown")} <ArrowRight className="inline size-3" aria-label="to" /> {String(t.change.to ?? "unknown")}
                      </span>
                    </p>
                    {t.flips.length === 0 ? (
                      <p className="mt-1 text-ink-faint">No decision changed.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {t.flips.map((f) => (
                          <li key={f.optionId} className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{f.label}:</span>
                            <StatusBadge status={f.before} short /> <ArrowRight className="size-3" aria-label="became" /> <StatusBadge status={f.after} short />
                            <span className="basis-full text-ink-soft">{f.reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="space-y-6" aria-label="What would change the answer">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">What would change the answer?</h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={!changed}
                onClick={() => {
                  dispatch({ type: "set_what_if", scenario: null });
                  dispatch({ type: "clear_trace" });
                  committed.current = baseline;
                }}
              >
                <RotateCcw className="size-4" aria-hidden /> Reset
              </Button>
            </div>
            <div className="mt-5 space-y-5">
              {KNOBS.map((k) => {
                const base = read(baseline, k);
                const v = read(whatIf, k);
                const locked = k.party === "guest" ? whatIf.guest.fixedFields.includes(k.field as never) : whatIf.host.fixedFields.includes(k.field as never);
                if (v === null) {
                  return (
                    <div key={`${k.party}.${k.field}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-ink-soft">
                        {k.label}: <em>not provided</em>
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => update(write(whatIf, k, k.start))}>
                        Assume a value
                      </Button>
                    </div>
                  );
                }
                return (
                  <div key={`${k.party}.${k.field}`}>
                    <Slider
                      label={`${k.label}${locked ? " (marked non-negotiable)" : ""}`}
                      value={v}
                      min={k.min ?? 0}
                      max={k.max(base ?? v)}
                      step={k.step ?? 1}
                      tone={k.party}
                      format={k.format}
                      onChange={(nv) => update(write(whatIf, k, nv))}
                      onCommit={(nv) => commit(k.party, k.field, read(committed.current ?? baseline, k), nv, write(whatIf, k, nv))}
                    />
                    {base !== null && base !== v && <p className="mt-1 text-xs text-ink-faint">Entered value: {k.format(base)}</p>}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold">Host days</h3>
            <p className="mt-1 text-xs text-ink-faint">Opening a day uses the guest's hours that day if it has any.</p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Host days open to partners">
              {DAYS.map((d) => {
                const on = (whatIf.host.availability ?? []).some((w) => w.day === d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleHostDay(d)}
                    className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-host bg-host text-white" : "border-line-strong bg-surface text-ink-soft")}
                  >
                    {DAY_LABELS[d].slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <ul className="mt-3 space-y-0.5 text-xs text-ink-soft">
              {(whatIf.host.availability ?? []).map((w) => (
                <li key={`${w.day}-${w.start}`}>
                  {DAY_LABELS[w.day]} {clock(w.start)}–{clock(w.end)}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="font-semibold">Simulate a host answer</h3>
            {(["samplingAllowed", "requiresExclusivity"] as const).map((f) => (
              <fieldset key={f} className="mt-3">
                <legend className="text-sm">{f === "samplingAllowed" ? "Sampling allowed?" : "Requires exclusivity?"}</legend>
                <div className="mt-1.5 inline-flex rounded-lg border border-line-strong p-0.5">
                  {[true, false, null].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={whatIf.host[f] === v}
                      onClick={() => setBool(f, v)}
                      className={cn("rounded-md px-3 py-1 text-sm", whatIf.host[f] === v ? "bg-host text-white" : "text-ink-soft")}
                    >
                      {v === null ? "Unknown" : v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </Card>

          <Card>
            <h3 className="font-semibold">All options now</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {[...liveEval.options]
                .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
                .map((o) => {
                  const before = baseEval.options.find((b) => b.id === o.id)?.status;
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-2">
                      <button type="button" className="text-left hover:underline" onClick={() => setSelected(o.id)}>
                        {o.label}
                      </button>
                      <span className="flex items-center gap-1">
                        {before && before !== o.status && (
                          <>
                            <StatusBadge status={before} short />
                            <ArrowRight className="size-3" aria-label="now" />
                          </>
                        )}
                        <StatusBadge status={o.status} short />
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Card>

          {changed && (
            <Button variant="secondary" className="w-full" onClick={() => navigate("/workspace/brief?whatif=1")}>
              Draft a brief from this what-if
            </Button>
          )}
        </aside>
      </div>

      <StepNav back="frontier" next="brief" nextLabel="Build the decision brief" />
    </div>
  );
}
