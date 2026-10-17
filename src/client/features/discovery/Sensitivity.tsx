import { useMutation } from "@tanstack/react-query";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { compareSensitivity, type ReferenceEffect } from "@shared/domain/sensitivity";
import type { ResearchRun } from "@shared/schemas/evidence";
import { ApiRequestError, runSensitivity } from "../../app/api";
import { useWorkspace } from "../../app/store";
import { Button, Card, ProvenanceChip, cn } from "../../components/ui/primitives";

const EFFECT: Record<ReferenceEffect, { label: string; className: string }> = {
  changes_top: { label: "Changes the first choice", className: "bg-common text-white" },
  changes_list: { label: "Changes the list", className: "bg-common-soft text-common" },
  reorders: { label: "Reorders only", className: "bg-sunken text-ink-soft" },
  no_change: { label: "No change", className: "border border-line-strong text-ink-faint" },
  failed: { label: "Not measured", className: "border border-dashed border-line-strong text-ink-faint" },
};

/**
 * How much the list depends on each reference: the same search repeated without one reference at a
 * time. Opt-in, because each variant is a live call, and every statement is read off the lists.
 */
export function SensitivityPanel({ run }: { run: ResearchRun }) {
  const { state, dispatch } = useWorkspace();
  const result = state.sensitivity?.runId === run.runId ? state.sensitivity.result : null;
  const search = run.venueSearch;
  const signals = run.seeds.filter((s) => s.status === "exact" && s.entity).map((s) => ({ id: s.entity?.id ?? "", label: s.input.label.slice(0, 80) }));
  const check = useMutation({
    mutationFn: () => {
      if (!search) throw new Error("No venue search to repeat.");
      return runSensitivity({
        categoryTagId: search.categoryTagId,
        categoryName: search.categoryName.slice(0, 120),
        location: search.location.slice(0, 60),
        venueCategory: run.request.venueCategory,
        signals: signals.slice(0, 3),
        take: Math.min(search.take, 8),
        ...(run.mode === "fixture" ? { demo: true as const } : {}),
      });
    },
    onSuccess: (r) => dispatch({ type: "set_sensitivity", runId: run.runId, result: r }),
  });

  // With a single reference, leaving it out is the category-only search the panel above already runs.
  if (!search || run.candidates.length === 0 || signals.length < 2) return null;
  const summary = result ? compareSensitivity(run.candidates, result) : null;

  return (
    <Card aria-labelledby="sensitivity-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sensitivity-heading" className="flex items-center gap-2 text-lg font-semibold">
          <SlidersHorizontal className="size-5 text-common" aria-hidden /> How much each reference matters
        </h2>
        {result?.variants[0] && <ProvenanceChip kind={result.variants[0].provenance.kind} />}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        The same search repeated {signals.length} times, each time without one reference. It shows whether the first choice rests on one reference or on
        several, using only the lists that come back.
      </p>
      {!result && (
        <div className="mt-4" aria-live="polite">
          <Button variant="secondary" size="sm" disabled={check.isPending} onClick={() => check.mutate()}>
            {check.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <SlidersHorizontal className="size-4" aria-hidden />}
            {check.isPending ? "Repeating the search…" : `Test each reference${run.mode === "live" ? ` (${signals.length} Qloo calls)` : ""}`}
          </Button>
          {check.error && (
            <p className="mt-2 text-sm text-bad" role="alert">
              {check.error instanceof ApiRequestError ? check.error.message : "The check could not run."} The results above are unaffected.
            </p>
          )}
        </div>
      )}
      {summary && result && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {summary.findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <ul className="space-y-2 text-sm">
            {summary.references.map((r) => (
              <li key={r.omitted} className="rounded-lg border border-line p-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Without “{r.omitted}”</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", EFFECT[r.effect].className)}>{EFFECT[r.effect].label}</span>
                </span>
                <span className="mt-1 block text-ink-soft">{r.finding}</span>
              </li>
            ))}
          </ul>
          <ul className="list-disc space-y-1 pl-5 text-xs text-ink-faint">
            {result.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
