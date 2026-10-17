import { ArrowDown, ArrowRight } from "lucide-react";
import type { ArrangementOption, OptionStatus } from "@shared/domain/types";
import { cn } from "../../components/ui/primitives";

export type TransitionTone = "bad" | "warn" | "ok" | "change" | "neutral";

export const toneOf = (s: OptionStatus): TransitionTone => (s === "no_go" ? "bad" : s === "conditional" ? "warn" : "ok");

/** What stands between an arrangement and "feasible": its failed checks, or else its open questions. */
export function reasonsOf(option: ArrangementOption): string[] {
  const failing = option.constraints.filter((c) => c.status === "fail");
  if (failing.length > 0) return failing.map((c) => c.explanation);
  return option.constraints.filter((c) => c.status === "unknown").map((c) => c.requirement?.text ?? c.explanation);
}

/** One state in a before → change → after sequence. */
export function TransitionStep({ tone, label, badge, children }: { tone: TransitionTone; label: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border p-4",
        tone === "bad" && "border-bad/25 bg-bad-soft/50",
        tone === "warn" && "border-warn/30 bg-warn-soft/50",
        tone === "ok" && "border-ok/30 bg-ok-soft/50",
        tone === "change" && "border-2 border-dashed border-common/50 bg-surface",
        tone === "neutral" && "border-line bg-surface",
      )}
    >
      <p className="eyebrow">{label}</p>
      {badge && <div className="mt-2">{badge}</div>}
      <div className="mt-2 text-sm text-ink">{children}</div>
    </div>
  );
}

export function TransitionArrow() {
  return (
    <span className="flex items-center justify-center text-ink-faint" aria-hidden>
      <ArrowDown className="size-5 md:hidden" />
      <ArrowRight className="hidden size-5 md:block" />
    </span>
  );
}

export const TRANSITION_GRID = "grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)_auto_minmax(0,1fr)] md:gap-3";
