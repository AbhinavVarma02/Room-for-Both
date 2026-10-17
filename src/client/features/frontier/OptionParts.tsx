import { ArrowRight, CheckCircle2, CircleDashed, HelpCircle, MinusCircle, XCircle } from "lucide-react";
import { windowLabel, money } from "@shared/domain/format";
import type { ArrangementOption, ConstraintResult, ProfileField } from "@shared/domain/types";
import { Button, Disclosure, PartyTag, ProvenanceChip, StatusBadge, cn } from "../../components/ui/primitives";

const ICON = {
  pass: { Icon: CheckCircle2, className: "text-ok", label: "Pass" },
  fail: { Icon: XCircle, className: "text-bad", label: "Fails" },
  unknown: { Icon: HelpCircle, className: "text-warn", label: "Unknown" },
  not_applicable: { Icon: MinusCircle, className: "text-ink-faint", label: "Not applicable" },
} as const;

// Plain names for the profile fields a check reads, so the evidence line never shows code identifiers.
export const FIELD_LABELS: Record<ProfileField, string> = {
  maxOutlayUsd: "budget",
  ownCostPerActivationUsd: "own costs",
  availability: "availability",
  popupFootprintSqFt: "pop-up footprint",
  shelfLinearFt: "shelf space",
  minEventAudience: "minimum audience",
  staffCount: "team size",
  acceptableFormats: "formats",
  wantsSampling: "sampling",
  dealbreakers: "dealbreakers",
  allowedFormats: "formats hosted",
  popupFeePerDayUsd: "pop-up day rate",
  shelfFeePerWeekUsd: "shelf fee per week",
  shelfMinWeeks: "minimum shelf term",
  eventFeePerHourUsd: "event fee per hour",
  eventMinHours: "minimum event length",
  guestFloorSqFt: "floor space",
  eventCapacity: "event capacity",
  staffHoursPerActivation: "staff hours",
  excludedCategories: "excluded categories",
  samplingAllowed: "sampling allowed",
  alcoholOnPremises: "alcohol on premises",
  requiresExclusivity: "requires exclusivity",
  productCategories: "product categories",
};

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
                  {FIELD_LABELS[i.field] ?? i.field}: {display(i.value)}
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

/** Pass, fail, and unknown counts as icons with words, so the tally never depends on colour. */
export function CheckTally({ option, className }: { option: ArrangementOption; className?: string }) {
  const count = (s: ConstraintResult["status"]) => option.constraints.filter((c) => c.status === s).length;
  const parts = (["pass", "fail", "unknown"] as const).map((s) => ({ s, n: count(s) })).filter((p) => p.n > 0);
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft", className)}>
      {parts.map(({ s, n }) => {
        const I = ICON[s];
        return (
          <span key={s} className="inline-flex items-center gap-1">
            <I.Icon className={cn("size-4", I.className)} aria-hidden />
            <span className="tabular-nums">
              {n} {s === "pass" ? "pass" : s === "fail" ? (n === 1 ? "fails" : "fail") : "unknown"}
            </span>
          </span>
        );
      })}
    </p>
  );
}

export function whenLabel(option: ArrangementOption) {
  return option.slot ? windowLabel(option.slot.day, option.slot.start, option.slot.end) : option.format === "shelf" ? "Normal opening hours" : "No shared time";
}

/** The focused view of one arrangement: the reason first, then the numbers, then every check on request. */
export function OptionDetail({
  option,
  nonDominated,
  onReverse,
  headingLevel = 3,
}: {
  option: ArrangementOption;
  nonDominated: boolean;
  onReverse?: () => void;
  headingLevel?: 3 | 4;
}) {
  const failing = option.constraints.filter((c) => c.status === "fail");
  const unknown = option.constraints.filter((c) => c.status === "unknown");
  const H = headingLevel === 3 ? "h3" : "h4";
  return (
    <article aria-labelledby={`opt-${option.id}`} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <H id={`opt-${option.id}`} className="font-display text-xl font-semibold">
          {option.label}
        </H>
        <StatusBadge status={option.status} short />
      </div>
      {nonDominated && option.status !== "no_go" && (
        <p className="inline-flex w-fit items-center gap-1 rounded-full bg-common-soft px-2 py-0.5 text-xs font-semibold text-common">
          On the frontier · not beaten on every stated priority
        </p>
      )}

      {failing.length > 0 && (
        <div className="rounded-lg border-l-4 border-bad bg-bad-soft/60 p-3 text-sm">
          <p className="font-semibold text-bad">Why it is blocked</p>
          <ul className="mt-1 space-y-1 text-ink">
            {failing.map((c) => (
              <li key={c.id}>{c.explanation}</li>
            ))}
          </ul>
        </div>
      )}
      {failing.length === 0 && unknown.length > 0 && (
        <div className="rounded-lg border-l-4 border-warn bg-warn-soft/60 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-warn">
            <CircleDashed className="size-4" aria-hidden /> Waiting on
          </p>
          <ul className="mt-1 space-y-1 text-ink">
            {unknown.map((c) => (
              <li key={c.id}>{c.requirement?.text ?? c.explanation}</li>
            ))}
          </ul>
        </div>
      )}
      {failing.length === 0 && unknown.length === 0 && (
        <p className="rounded-lg border-l-4 border-ok bg-ok-soft/60 p-3 text-sm font-medium text-ink">
          Passes every check on both sides' stated terms. Both still need to agree.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-faint">Guest pays in total</dt>
          <dd className="font-semibold tabular-nums">{option.metrics.guestOutlayUsd === null ? "Unknown" : money(option.metrics.guestOutlayUsd)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Host fee</dt>
          <dd className="font-semibold tabular-nums">{option.metrics.hostFeeUsd === null ? "Unknown" : money(option.metrics.hostFeeUsd)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">When</dt>
          <dd className="font-semibold">{whenLabel(option)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Staff hours</dt>
          <dd className="font-semibold tabular-nums">
            guest {option.metrics.guestStaffHours} · host {option.metrics.hostStaffHours}
          </dd>
        </div>
      </dl>

      <CheckTally option={option} />

      <Disclosure title={`All ${option.constraints.length} checks and assumptions`} className="border-t border-line pt-2">
        <ul className="divide-y divide-line">
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
      </Disclosure>

      {onReverse && option.status !== "feasible" && (
        <Button variant="secondary" size="sm" onClick={onReverse}>
          {option.status === "no_go" ? "What would change this?" : "What is still missing?"} <ArrowRight className="size-4" aria-hidden />
        </Button>
      )}
    </article>
  );
}
