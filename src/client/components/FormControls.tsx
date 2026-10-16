import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { DAYS, DAY_LABELS, type Day } from "@shared/constants/vocabulary";
import { clock } from "@shared/domain/format";
import type { Availability } from "@shared/schemas/common";
import { Button, Field, cn } from "./ui/primitives";

export function NumberField({
  label,
  value,
  onChange,
  hint,
  error,
  prefix,
  suffix,
  min = 0,
  max,
  optional,
  placeholder = "Not provided",
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  hint?: string;
  error?: string | undefined;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  optional?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} optional={optional}>
      <div className="relative flex items-center">
        {prefix && <span className="pointer-events-none absolute left-3 text-ink-faint">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="numeric"
          className={cn("input tabular-nums", prefix && "pl-7", suffix && "pr-16")}
          value={value ?? ""}
          min={min}
          max={max}
          step={1}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange(null);
            const n = Math.round(Number(raw));
            onChange(Number.isFinite(n) ? n : null);
          }}
        />
        {suffix && <span className="pointer-events-none absolute right-3 text-sm text-ink-faint">{suffix}</span>}
      </div>
    </Field>
  );
}

const HOURS = Array.from({ length: 25 }, (_, h) => h);

export function AvailabilityEditor({
  value,
  onChange,
  party,
  error,
}: {
  value: Availability | null;
  onChange: (v: Availability | null) => void;
  party: "guest" | "host";
  error?: string | undefined;
}) {
  const windows = value ?? [];
  const update = (i: number, patch: Partial<Availability[number]>) => onChange(windows.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const used = new Set(windows.map((w) => w.day));
  const nextDay: Day = DAYS.find((d) => !used.has(d)) ?? "mon";
  return (
    <div className="space-y-3">
      {windows.length === 0 && (
        <p className="rounded-lg border border-dashed border-line-strong p-3 text-sm text-ink-faint">
          {value === null ? "Not provided yet. Options that need a shared time will stay conditional." : "No availability: options that need a shared time will fail."}
        </p>
      )}
      <ul className="space-y-2">
        {windows.map((w, i) => (
          <li key={`${w.day}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper/60 p-2">
            <label className="sr-only" htmlFor={`${party}-day-${i}`}>
              Day
            </label>
            <select id={`${party}-day-${i}`} className="input w-auto" value={w.day} onChange={(e) => update(i, { day: e.target.value as Day })}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {DAY_LABELS[d]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`${party}-start-${i}`}>
              From
            </label>
            <select id={`${party}-start-${i}`} className="input w-auto" value={w.start} onChange={(e) => update(i, { start: Number(e.target.value) })}>
              {HOURS.slice(0, 24).map((h) => (
                <option key={h} value={h}>
                  {clock(h)}
                </option>
              ))}
            </select>
            <span className="text-sm text-ink-faint">to</span>
            <label className="sr-only" htmlFor={`${party}-end-${i}`}>
              Until
            </label>
            <select id={`${party}-end-${i}`} className="input w-auto" value={w.end} onChange={(e) => update(i, { end: Number(e.target.value) })}>
              {HOURS.slice(1).map((h) => (
                <option key={h} value={h}>
                  {h === 24 ? "midnight" : clock(h)}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" aria-label={`Remove ${DAY_LABELS[w.day]} window`} onClick={() => onChange(windows.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" aria-hidden />
            </Button>
            {w.end <= w.start && <span className="text-xs font-medium text-bad">End must be after start</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={windows.length >= 14} onClick={() => onChange([...windows, { day: nextDay, start: 17, end: 20 }])}>
          <Plus className="size-4" aria-hidden /> Add a time window
        </Button>
        {value !== null && windows.length === 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Mark as not provided
          </Button>
        )}
        {value !== null && windows.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Clear
          </Button>
        )}
      </div>
      {error && (
        <p className="text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function PriorityPicker<T extends string>({
  options,
  labels,
  value,
  onChange,
  tone,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T[];
  onChange: (v: T[]) => void;
  tone: "guest" | "host";
}) {
  return (
    <div className="space-y-2">
      <div role="group" aria-label="Priorities in order" className="flex flex-wrap gap-2">
        {options.map((o) => {
          const rank = value.indexOf(o);
          const on = rank >= 0;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                on ? (tone === "guest" ? "border-guest bg-guest-soft text-guest" : "border-host bg-host-soft text-host") : "border-line-strong bg-surface text-ink-soft",
              )}
            >
              {on && (
                <span className={cn("flex size-5 items-center justify-center rounded-full text-xs font-bold text-white", tone === "guest" ? "bg-guest" : "bg-host")}>
                  {rank + 1}
                </span>
              )}
              {labels[o]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-faint">Tap in order of importance. Priorities rank options; they never override a hard constraint.</p>
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="card p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <h2 className="text-xl font-semibold" aria-hidden>
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </fieldset>
  );
}
