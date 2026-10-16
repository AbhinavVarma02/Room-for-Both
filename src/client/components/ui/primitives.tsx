import * as RadixSlider from "@radix-ui/react-slider";
import * as RadixSwitch from "@radix-ui/react-switch";
import { clsx, type ClassValue } from "clsx";
import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, forwardRef, useId } from "react";
import { twMerge } from "tailwind-merge";
import { PROVENANCE_LABELS, type ProvenanceKind } from "@shared/schemas/common";
import type { OptionStatus } from "@shared/domain/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Variant = "primary" | "secondary" | "ghost" | "guest" | "host" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-common text-white hover:bg-common/90 border-transparent",
  secondary: "bg-surface text-ink border-line-strong hover:bg-sunken",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-sunken hover:text-ink",
  guest: "bg-guest text-white border-transparent hover:bg-guest/90",
  host: "bg-host text-white border-transparent hover:bg-host/90",
  danger: "bg-surface text-bad border-bad/40 hover:bg-bad-soft",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" && "px-3 py-1.5 text-sm",
          size === "md" && "px-4 py-2 text-[15px]",
          size === "lg" && "px-5 py-3 text-base",
          VARIANTS[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card p-5 sm:p-6", className)} {...rest}>
      {children}
    </div>
  );
}

const STATUS: Record<OptionStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  feasible: { label: "Feasible on stated requirements", className: "bg-ok-soft text-ok border-ok/25", Icon: CheckCircle2 },
  conditional: { label: "Conditional", className: "bg-warn-soft text-warn border-warn/25", Icon: CircleDashed },
  no_go: { label: "No-go", className: "bg-bad-soft text-bad border-bad/25", Icon: XCircle },
};

export function StatusBadge({ status, short = false }: { status: OptionStatus; short?: boolean }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", s.className)}>
      <s.Icon className="size-3.5" aria-hidden />
      {short && status === "feasible" ? "Feasible" : s.label}
    </span>
  );
}

const PROVENANCE_STYLE: Record<ProvenanceKind, string> = {
  qloo_observed: "bg-common-soft text-common border-common/20",
  party_supplied: "bg-surface text-ink-soft border-line-strong",
  synthetic_demo: "bg-warn-soft text-warn border-warn/25",
  derived_rule: "bg-sunken text-ink-soft border-line",
  llm_interpretation: "bg-host-soft text-host border-host/20",
  unknown: "bg-surface text-ink-faint border-dashed border-line-strong",
};

export function ProvenanceChip({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", PROVENANCE_STYLE[kind], className)}
      title={`Provenance: ${PROVENANCE_LABELS[kind]}`}
    >
      {PROVENANCE_LABELS[kind]}
    </span>
  );
}

export function PartyTag({ party }: { party: "guest" | "host" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        party === "guest" ? "bg-guest-soft text-guest" : "bg-host-soft text-host",
      )}
    >
      {party}
    </span>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warn" | "bad" | "ok";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = tone === "warn" ? AlertTriangle : tone === "bad" ? XCircle : tone === "ok" ? CheckCircle2 : Info;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-4 text-sm",
        tone === "info" && "border-common/20 bg-common-soft text-ink",
        tone === "warn" && "border-warn/25 bg-warn-soft text-ink",
        tone === "bad" && "border-bad/25 bg-bad-soft text-ink",
        tone === "ok" && "border-ok/25 bg-ok-soft text-ink",
        className,
      )}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", tone === "info" && "text-common", tone === "warn" && "text-warn", tone === "bad" && "text-bad", tone === "ok" && "text-ok")}
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-soft">{children}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-faint">optional</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-faint">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ToggleChips<T extends string>({
  options,
  labels,
  value,
  onChange,
  ariaLabel,
  tone = "common",
  max,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T[];
  onChange: (next: T[]) => void;
  ariaLabel: string;
  tone?: "common" | "guest" | "host";
  max?: number;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = value.includes(opt);
        const disabled = !on && max !== undefined && value.length >= max;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((v) => v !== opt) : [...value, opt])}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-40",
              on
                ? tone === "guest"
                  ? "border-guest bg-guest text-white"
                  : tone === "host"
                    ? "border-host bg-host text-white"
                    : "border-common bg-common text-white"
                : "border-line-strong bg-surface text-ink-soft hover:border-ink-faint hover:text-ink",
            )}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  format,
  tone = "common",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Fires once when a drag or key press finishes, for recording a single trace entry per edit. */
  onCommit?: (v: number) => void;
  format: (v: number) => string;
  tone?: "guest" | "host" | "common";
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span id={id} className="text-sm font-medium text-ink">
          {label}
        </span>
        <span className="font-mono text-sm tabular-nums text-ink">{format(value)}</span>
      </div>
      <RadixSlider.Root
        className="relative flex h-5 w-full touch-none items-center select-none"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        onValueCommit={(v) => onCommit?.(v[0] ?? value)}
        aria-labelledby={id}
      >
        <RadixSlider.Track className="relative h-1.5 grow rounded-full bg-line">
          <RadixSlider.Range className={cn("absolute h-full rounded-full", tone === "guest" ? "bg-guest" : tone === "host" ? "bg-host" : "bg-common")} />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-labelledby={id}
          aria-valuetext={format(value)}
          className={cn(
            "block size-5 rounded-full border-2 bg-surface shadow focus-visible:outline-3",
            tone === "guest" ? "border-guest" : tone === "host" ? "border-host" : "border-common",
          )}
        />
      </RadixSlider.Root>
    </div>
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  const autoId = useId();
  const switchId = id ?? autoId;
  return (
    <div className="flex items-center gap-3">
      <RadixSwitch.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors data-[state=checked]:bg-common"
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
      </RadixSwitch.Root>
      <label htmlFor={switchId} className="text-sm text-ink">
        {label}
      </label>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-sunken", className)} aria-hidden />;
}
