import { useMutation } from "@tanstack/react-query";
import { GitCompareArrows, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { compareDiscovery } from "@shared/domain/comparison";
import type { ResearchRun } from "@shared/schemas/evidence";
import { ApiRequestError, runBaseline } from "../../app/api";
import { useWorkspace } from "../../app/store";
import { Button, Callout, Card, ProvenanceChip, cn } from "../../components/ui/primitives";

/**
 * What the taste signal changed: the same category and area searched with and without the guest's
 * references. The panel reports differences and sameness alike; it never ranks one list as better.
 */
export function DiscoveryComparisonPanel({ run, auto = false }: { run: ResearchRun; auto?: boolean }) {
  const { state, dispatch } = useWorkspace();
  const baseline = state.baseline?.runId === run.runId ? state.baseline.result : null;
  const search = run.venueSearch;
  const signalled = run.candidates.some((c) => c.strength !== "unscored");
  const compare = useMutation({
    mutationFn: () => {
      if (!search) throw new Error("No venue search to repeat.");
      return runBaseline({
        categoryTagId: search.categoryTagId,
        categoryName: search.categoryName.slice(0, 120),
        location: search.location.slice(0, 60),
        venueCategory: run.request.venueCategory,
        ...(run.mode === "fixture" ? { demo: true as const } : {}),
      });
    },
    onSuccess: (result) => dispatch({ type: "set_baseline", runId: run.runId, baseline: result }),
  });
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (auto && search && signalled && !baseline && started.current !== run.runId) {
      started.current = run.runId;
      compare.mutate();
    }
  }, [auto, search, signalled, baseline, run.runId, compare]);

  if (!search || run.candidates.length === 0) return null;
  if (!signalled) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">With and without the taste signal</h2>
        <p className="mt-2 text-sm text-ink-soft">No reference matched exactly, so this run already used category-only discovery. There is nothing to compare.</p>
      </Card>
    );
  }

  const cmp = baseline ? compareDiscovery(run.candidates, baseline.candidates, baseline.depth) : null;
  return (
    <Card aria-labelledby="compare-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="compare-heading" className="flex items-center gap-2 text-lg font-semibold">
          <GitCompareArrows className="size-5 text-common" aria-hidden /> What the taste signal changed
        </h2>
        {baseline && <ProvenanceChip kind={baseline.provenance.kind} />}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        The same venue search ({search.categoryName}, {search.location}) run twice: once ranked by affinity to the guest's references, once by
        category and area alone.
      </p>
      {!baseline && (
        <div className="mt-4" aria-live="polite">
          <Button variant="secondary" size="sm" disabled={compare.isPending} onClick={() => compare.mutate()}>
            {compare.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GitCompareArrows className="size-4" aria-hidden />}
            {compare.isPending ? "Running the category-only search…" : `Compare with category-only discovery${run.mode === "live" ? " (1 Qloo call)" : ""}`}
          </Button>
          {compare.error && (
            <p className="mt-2 text-sm text-bad" role="alert">
              {compare.error instanceof ApiRequestError ? compare.error.message : "The comparison could not run."} The taste-informed results are unaffected.
            </p>
          )}
        </div>
      )}
      {cmp && baseline && (
        <div className="mt-4 space-y-4" aria-live="polite">
          <Callout tone={cmp.outcome === "no_material_change" ? "warn" : "info"} title={OUTCOME_TITLE[cmp.outcome]}>
            <ul className="list-disc space-y-1 pl-4">
              {cmp.findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Callout>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-left text-sm">
              <caption className="sr-only">Venue ranks with the taste signal and with category only</caption>
              <thead className="text-xs text-ink-faint">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Venue
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    With taste signal
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Category only (top {cmp.baselineDepth})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {cmp.rows.map((r) => (
                  <tr key={r.id} className={cn(r.tasteRank === null && "text-ink-faint")}>
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {r.name}
                    </th>
                    <td className="py-2 pr-3 tabular-nums">{r.tasteRank === null ? `not in top ${cmp.tasteCount}` : `#${r.tasteRank}`}</td>
                    <td className="py-2 tabular-nums">{r.baselineRank === null ? `not in top ${cmp.baselineDepth}` : `#${r.baselineRank}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="text-sm font-semibold">Available only with cultural signals</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
              {cmp.onlyWithSignals.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-ink-faint">
            {baseline.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
            <li>
              Source: {baseline.provenance.request} · {new Date(baseline.provenance.retrievedAt).toLocaleString()}
            </li>
          </ul>
        </div>
      )}
    </Card>
  );
}

const OUTCOME_TITLE = {
  different_venues: "The taste signal changed which venues to approach",
  reordered: "Same venues, different order",
  no_material_change: "No material change in this search",
  insufficient: "Not enough results to compare",
} as const;
