import { ArrowRight, History, Lock, RotateCcw, ShieldCheck, Wand2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { DAYS, DAY_LABELS, type Day } from "@shared/constants/vocabulary";
import { applyChanges, diffEvaluations, evaluateScenario } from "@shared/domain";
import { clock, money } from "@shared/domain/format";
import { closestToWorking } from "@shared/domain/headline";
import type { ArrangementOption, OptionStatus } from "@shared/domain/types";
import type { Party } from "@shared/schemas/common";
import type { GuestProfile, HostProfile, Scenario } from "@shared/schemas/profiles";
import { useWorkspace } from "../../app/store";
import { StepHeader, StepNav } from "../../app/Workspace";
import { Button, Card, Disclosure, Notice, PartyTag, Slider, StatusBadge, cn } from "../../components/ui/primitives";
import { ConstraintRow, FIELD_LABELS } from "../frontier/OptionParts";
import { TRANSITION_GRID, TransitionArrow, TransitionStep, reasonsOf, toneOf } from "../frontier/Transition";

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
  {
    party: "host",
    field: "eventFeePerHourUsd",
    label: "Host event fee",
    max: (b) => Math.max(1500, b * 2),
    step: 25,
    format: (v) => `${money(v)}/h`,
    start: 300,
  },
  { party: "host", field: "eventMinHours", label: "Host minimum event length", max: () => 6, min: 1, format: (v) => `${v} h`, start: 2 },
  {
    party: "host",
    field: "popupFeePerDayUsd",
    label: "Host pop-up day rate",
    max: (b) => Math.max(2000, b * 2),
    step: 25,
    format: (v) => `${money(v)}/day`,
    start: 500,
  },
  {
    party: "host",
    field: "shelfFeePerWeekUsd",
    label: "Host shelf fee",
    max: (b) => Math.max(300, b * 2),
    step: 5,
    format: (v) => `${money(v)}/wk`,
    start: 60,
  },
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
  const [selected, setSelected] = useState<string | null>(
    () => new URLSearchParams(search).get("option") ?? (baseEval ? closestToWorking(baseEval)?.option.id : null) ?? baseEval?.reversals[0]?.optionId ?? null,
  );

  if (!baseline || !whatIf || !baseEval || !liveEval) return null;

  const candidates = liveEval.options.filter((o) => o.status !== "feasible");
  const selectedId =
    selected && liveEval.options.some((o) => o.id === selected) ? selected : (liveEval.reversals[0]?.optionId ?? candidates[0]?.id ?? liveEval.options[0]?.id);
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
    commit(
      "host",
      "availability",
      has ? `open ${DAY_LABELS[day]}` : `closed ${DAY_LABELS[day]}`,
      has ? `closed ${DAY_LABELS[day]}` : `open ${DAY_LABELS[day]}`,
      next,
    );
  };

  const applySuggested = () => {
    const next = applyChanges(whatIf, reversal?.minimalChange?.changes ?? []);
    update(next);
    commit("host", "suggested changes", "current", reversal?.minimalChange?.changes.map((c) => c.description).join(" ") ?? "", next);
  };
  const last = state.trace[state.trace.length - 1];
  const resetWhatIf = () => {
    dispatch({ type: "set_what_if", scenario: null });
    dispatch({ type: "clear_trace" });
    committed.current = baseline;
  };

  const setBool = (field: "samplingAllowed" | "requiresExclusivity", value: boolean | null) => {
    const next = { ...whatIf, host: { ...whatIf.host, [field]: value } };
    update(next);
    commit("host", field, whatIf.host[field], value, next);
  };

  const baseOption = option ? baseEval.options.find((o) => o.id === option.id) : undefined;
  const baseReversal = baseEval.reversals.find((r) => r.optionId === selectedId);
  const suggested = !changed && reversal?.minimalChange?.verified ? reversal.minimalChange : null;
  // The "after" state is the engine re-run on a copy with the suggested change applied, never a guess.
  const predicted = suggested ? evaluateScenario(applyChanges(whatIf, suggested.changes)).options.find((o) => o.id === selectedId) : undefined;
  const differences = changed ? describeDifferences(baseline, whatIf) : [];
  const ways = (reversal ?? baseReversal)?.candidates ?? [];

  return (
    <div>
      <StepHeader step="reversal">Change one term and watch the decision re-check with the same rules. Nothing is sent to anyone.</StepHeader>

      {changed && (
        <Notice className="mb-4" title="What-if mode: these values are hypothetical">
          They are nobody's actual terms until both businesses agree. Reset to return to the entered values.
        </Notice>
      )}

      <section aria-labelledby="shift-title" className="card p-5 sm:p-7">
        <h2 id="shift-title" className="sr-only">
          How the decision changes
        </h2>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-md">
            <label htmlFor="option-select" className="eyebrow">
              Arrangement
            </label>
            <select id="option-select" className="input mt-1.5 font-medium" value={selectedId} onChange={(e) => setSelected(e.target.value)}>
              {liveEval.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} — {o.status === "no_go" ? "no-go" : o.status}
                </option>
              ))}
            </select>
          </div>
          {changed && (
            <Button variant="ghost" size="sm" onClick={resetWhatIf}>
              <RotateCcw className="size-4" aria-hidden /> Reset to entered terms
            </Button>
          )}
        </div>

        {option && baseOption && (
          <div className={cn("mt-5", TRANSITION_GRID)}>
            <TransitionStep tone={toneOf(baseOption.status)} label="With the entered terms" badge={<StatusBadge status={baseOption.status} short />}>
              <ReasonList option={baseOption} />
            </TransitionStep>
            <TransitionArrow />
            {changed ? (
              <TransitionStep tone="change" label="Your what-if">
                {differences.length === 0 ? (
                  <p>No term differs from the entered values.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {differences.map((d) => (
                      <li key={d.key} className="flex items-start gap-2">
                        <PartyTag party={d.party} />
                        <span>
                          <span className="font-medium">{d.label}:</span> {d.from} → {d.to}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-ink-soft">Hypothetical: no business has agreed to these values.</p>
              </TransitionStep>
            ) : suggested ? (
              <TransitionStep tone="change" label="Smallest change that works">
                <ul className="space-y-1.5">
                  {suggested.changes.map((c) => (
                    <li key={`${c.party}.${c.field}`} className="flex items-start gap-2 font-medium">
                      <PartyTag party={c.party} /> <span>{c.description}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-3 self-start" onClick={applySuggested}>
                  Apply this change <ArrowRight className="size-4" aria-hidden />
                </Button>
              </TransitionStep>
            ) : (
              <TransitionStep tone="neutral" label="Smallest change">
                {option.status === "feasible" ? (
                  <p>Nothing blocks this arrangement on the current values.</p>
                ) : reversal && reversal.nonNegotiableBlockers.length > 0 ? (
                  <p className="flex gap-2">
                    <Lock className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                    <span>
                      No negotiable change unblocks it: it depends on terms marked non-negotiable (
                      {reversal.nonNegotiableBlockers.map((b) => b.replace(/_/g, " ")).join(", ")}).
                    </span>
                  </p>
                ) : (
                  <p>No verified change was found. Move the controls below to explore.</p>
                )}
              </TransitionStep>
            )}
            <TransitionArrow />
            {changed ? (
              <TransitionStep tone={toneOf(option.status)} label="With your what-if" badge={<StatusBadge status={option.status} short />}>
                <ReasonList option={option} />
              </TransitionStep>
            ) : suggested && predicted ? (
              <TransitionStep
                tone={toneOf(suggested.statusAfter)}
                label="If the change is accepted"
                badge={<StatusBadge status={suggested.statusAfter} short />}
              >
                <ReasonList option={predicted} />
              </TransitionStep>
            ) : (
              <TransitionStep tone={toneOf(option.status)} label="Now" badge={<StatusBadge status={option.status} short />}>
                <p className="text-ink-soft">Unchanged.</p>
              </TransitionStep>
            )}
          </div>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-sm text-ink-soft">
          <ShieldCheck className="size-4 shrink-0 text-common" aria-hidden /> Re-checked with the same rules, in your browser, without calling any outside
          service.
        </p>
      </section>

      {last && (
        <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 sm:px-5" role="status" aria-live="polite">
          <p className="text-sm text-ink-soft">
            {last.change.field === "suggested changes" ? (
              <>
                You applied: <span className="font-medium text-ink">{String(last.change.to)}</span>
              </>
            ) : (
              <>
                Your last change:{" "}
                <span className="font-medium text-ink">{FIELD_LABELS[last.change.field as keyof typeof FIELD_LABELS] ?? last.change.field}</span>{" "}
                {String(last.change.from ?? "unknown")} → {String(last.change.to ?? "unknown")}
              </>
            )}
          </p>
          {last.flips.length === 0 ? (
            <p className="mt-1 font-medium">No decision changed.</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {last.flips.map((f) => (
                <li key={f.optionId}>
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {f.label}: <StatusBadge status={f.before} short /> <ArrowRight className="size-4" aria-label="became" />{" "}
                    <StatusBadge status={f.after} short />
                  </p>
                  <p className="text-sm text-ink-soft">{f.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="space-y-6">
          {option && option.status !== "feasible" && (
            <Card>
              <h2 className="text-lg font-semibold">{option.status === "no_go" ? "Why is this blocked?" : "What is still unknown?"}</h2>
              <ul className="mt-2 divide-y divide-line">
                {option.constraints
                  .filter((c) => c.status === (option.status === "no_go" ? "fail" : "unknown"))
                  .map((c) => (
                    <ConstraintRow key={c.id} c={c} />
                  ))}
              </ul>
              {changed && reversal?.minimalChange?.verified && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm text-ink-soft">
                  <Wand2 className="size-4 text-common" aria-hidden />
                  <span>Smallest change from here: {reversal.minimalChange.changes.map((c) => c.description).join(" ")}</span>
                  <span className="inline-flex items-center gap-1.5">
                    Re-checked with the same rules, it becomes <StatusBadge status={reversal.minimalChange.statusAfter} short />
                  </span>
                  <Button size="sm" variant="secondary" onClick={applySuggested}>
                    Apply
                  </Button>
                </div>
              )}
              {ways.some((c) => c.changes.length > 1) && (
                <Disclosure title="Other ways to clear each check" className="mt-2 border-t border-line pt-1 text-sm">
                  <ul className="space-y-3">
                    {ways.map((c) => (
                      <li key={c.constraint}>
                        <p className="font-medium capitalize">{c.constraint.replace(/_/g, " ")}</p>
                        <ul className="mt-1 space-y-1">
                          {c.changes.map((ch) => (
                            <li
                              key={`${ch.party}.${ch.field}.${ch.kind}`}
                              className={cn("flex items-start gap-2", !ch.negotiable && "text-ink-faint line-through")}
                            >
                              <PartyTag party={ch.party} /> {ch.description} {!ch.negotiable && <span className="no-underline">(non-negotiable)</span>}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </Disclosure>
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
                      {t.change.field === "suggested changes" ? (
                        <span>
                          <span className="font-medium">Applied the suggested change:</span> <span className="text-ink-soft">{String(t.change.to)}</span>
                        </span>
                      ) : (
                        <>
                          <span className="font-medium">{FIELD_LABELS[t.change.field as keyof typeof FIELD_LABELS] ?? t.change.field}</span>
                          <span className="text-ink-soft">
                            {String(t.change.from ?? "unknown")} <ArrowRight className="inline size-3" aria-label="to" /> {String(t.change.to ?? "unknown")}
                          </span>
                        </>
                      )}
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
              <Button variant="ghost" size="sm" disabled={!changed} onClick={resetWhatIf}>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const next = write(whatIf, k, k.start);
                          update(next);
                          commit(k.party, k.field, null, k.start, next);
                        }}
                      >
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
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      on ? "border-host bg-host text-white" : "border-line-strong bg-surface text-ink-soft",
                    )}
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
              Draft a brief proposing these changes
            </Button>
          )}
        </aside>
      </div>

      <StepNav back="frontier" next="brief" nextLabel="Build the decision brief" />
    </div>
  );
}

function ReasonList({ option }: { option: ArrangementOption }) {
  const reasons = reasonsOf(option);
  if (reasons.length === 0) return <p>Passes every check on stated terms.</p>;
  return (
    <>
      {option.status === "conditional" && <p className="text-ink-soft">Waiting on:</p>}
      <ul className="space-y-1">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </>
  );
}

function formatValue(field: string, v: unknown): string {
  const knob = KNOBS.find((k) => k.field === field);
  if (v === null || v === undefined) return "not provided";
  if (knob && typeof v === "number") return knob.format(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) {
    if (v.length === 0) return "none";
    const first: unknown = v[0];
    if (typeof first === "object" && first !== null && "day" in first) {
      return (v as { day: Day; start: number; end: number }[]).map((w) => `${DAY_LABELS[w.day].slice(0, 3)} ${clock(w.start)}–${clock(w.end)}`).join(", ");
    }
    return v.map(String).join(", ");
  }
  return String(v);
}

/** Every term the what-if changed relative to the entered values, read straight from the two scenarios. */
function describeDifferences(base: Scenario, next: Scenario): { key: string; party: Party; label: string; from: string; to: string }[] {
  const out: { key: string; party: Party; label: string; from: string; to: string }[] = [];
  for (const party of ["guest", "host"] as const) {
    const a = base[party] as Record<string, unknown>;
    const b = next[party] as Record<string, unknown>;
    for (const field of Object.keys(b)) {
      if (JSON.stringify(a[field]) === JSON.stringify(b[field])) continue;
      const label = KNOBS.find((k) => k.party === party && k.field === field)?.label ?? FIELD_LABELS[field as keyof typeof FIELD_LABELS] ?? field;
      out.push({
        key: `${party}.${field}`,
        party,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        from: formatValue(field, a[field]),
        to: formatValue(field, b[field]),
      });
    }
  }
  return out;
}
