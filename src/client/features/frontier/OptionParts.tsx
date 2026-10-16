import { CheckCircle2, ChevronDown, CircleDashed, HelpCircle, MinusCircle, XCircle } from "lucide-react";
import { windowLabel, money } from "@shared/domain/format";
import type { ArrangementOption, ConstraintResult } from "@shared/domain/types";
import { PartyTag, ProvenanceChip, StatusBadge, cn } from "../../components/ui/primitives";

const ICON = {
  pass: { Icon: CheckCircle2, className: "text-ok", label: "Pass" },
  fail: { Icon: XCircle, className: "text-bad", label: "Fails" },
  unknown: { Icon: HelpCircle, className: "text-warn", label: "Unknown" },
  not_applicable: { Icon: MinusCircle, className: "text-ink-faint", label: "Not applicable" },
} as const;

function display(value: unknown): string {
  if (value === null || value === undefined) return "not provided";
  if (Array.isArray(value)) return value.length === 0 ? "none" : `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

export function ConstraintRow({ c }: { c: ConstraintResult }) {
  const s = ICON[c.status];
  return (
    <li className="flex gap-2.5 py-2.5">
      <s.Icon className={cn("mt-0.5 size-4 shrink-0", s.className)} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-ink">
          {c.label}
          <span className="sr-only">: {s.label}</span>
        </p>
        <p className="text-ink-soft">{c.explanation}</p>
        {c.requirement && <p className="mt-1 text-warn">To pass: {c.requirement.text}</p>}
        {c.status !== "not_applicable" && (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {c.inputs.map((i) => (
              <li key={`${i.party}.${i.field}`} className="flex items-center gap-1 text-[11px] text-ink-faint">
                <PartyTag party={i.party} />
                <span>
                  {i.field}: {display(i.value)}
                </span>
                <ProvenanceChip kind={i.provenance} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function OptionCard({ option, nonDominated, action }: { option: ArrangementOption; nonDominated: boolean; action?: React.ReactNode }) {
  const failing = option.constraints.filter((c) => c.status === "fail");
  const unknown = option.constraints.filter((c) => c.status === "unknown");
  return (
    <article
      className={cn(
        "card flex flex-col p-5",
        option.status === "feasible" && "border-ok/30",
        option.status === "conditional" && "border-warn/30",
        option.status === "no_go" && "bg-surface/70",
      )}
      aria-labelledby={`opt-${option.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={`opt-${option.id}`} className="font-display text-lg font-semibold">
          {option.label}
        </h3>
        <StatusBadge status={option.status} short />
      </div>
      {nonDominated && option.status !== "no_go" && (
        <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-common-soft px-2 py-0.5 text-xs font-semibold text-common">
          On the frontier · not beaten on every stated priority
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-ink-faint">Guest outlay</dt>
          <dd className="font-medium tabular-nums">{option.metrics.guestOutlayUsd === null ? "Unknown" : money(option.metrics.guestOutlayUsd)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Host fee</dt>
          <dd className="font-medium tabular-nums">{option.metrics.hostFeeUsd === null ? "Unknown" : money(option.metrics.hostFeeUsd)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">When</dt>
          <dd className="font-medium">{option.slot ? windowLabel(option.slot.day, option.slot.start, option.slot.end) : option.format === "shelf" ? "Normal opening hours" : "No shared slot"}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Staff hours</dt>
          <dd className="font-medium tabular-nums">
            guest {option.metrics.guestStaffHours} · host {option.metrics.hostStaffHours}
          </dd>
        </div>
      </dl>
      {failing.length > 0 && (
        <div className="mt-3 rounded-lg bg-bad-soft/70 p-3 text-sm">
          <p className="font-semibold text-bad">Why it is blocked</p>
          <ul className="mt-1 space-y-1 text-ink-soft">
            {failing.map((c) => (
              <li key={c.id}>{c.explanation}</li>
            ))}
          </ul>
        </div>
      )}
      {failing.length === 0 && unknown.length > 0 && (
        <div className="mt-3 rounded-lg bg-warn-soft/70 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-warn">
            <CircleDashed className="size-4" aria-hidden /> Waiting on
          </p>
          <ul className="mt-1 space-y-1 text-ink-soft">
            {unknown.map((c) => (
              <li key={c.id}>{c.requirement?.text ?? c.explanation}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-common">
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          All {option.constraints.length} checks and assumptions
        </summary>
        <ul className="mt-2 divide-y divide-line">
          {option.constraints.map((c) => (
            <ConstraintRow key={c.id} c={c} />
          ))}
        </ul>
        <div className="mt-3 rounded-lg bg-sunken/60 p-3 text-xs text-ink-soft">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
            Template assumptions <ProvenanceChip kind="derived_rule" />
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {option.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </details>
      {action && <div className="mt-auto pt-4">{action}</div>}
    </article>
  );
}
