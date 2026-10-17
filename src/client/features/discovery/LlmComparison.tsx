import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Loader2 } from "lucide-react";
import { useState } from "react";
import { checkLlmVenues } from "@shared/domain/llm-match";
import type { BaselineResult, ResearchRun } from "@shared/schemas/evidence";
import { ApiRequestError, getConfig, runLlmBaseline } from "../../app/api";
import { useWorkspace } from "../../app/store";
import { Button, ProvenanceChip } from "../../components/ui/primitives";

/**
 * The same question asked of a language model with no Qloo data. Shown beside the Qloo results as a
 * baseline, with its names checked only against what Qloo returned on this page.
 */
export function LlmComparison({ run, baseline }: { run: ResearchRun; baseline: BaselineResult | null }) {
  const { state } = useWorkspace();
  const config = useQuery({ queryKey: ["config"], queryFn: getConfig });
  const [consent, setConsent] = useState(false);
  const guest = state.guest;
  const ask = useMutation({
    mutationFn: () =>
      runLlmBaseline({
        seeds: run.request.seeds.slice(0, 3),
        city: run.request.city,
        ...(run.request.neighborhood ? { neighborhood: run.request.neighborhood } : {}),
        venueCategory: run.request.venueCategory,
        guestCategories: run.request.guestCategories,
        consent: true,
      }),
  });
  if (!config.data?.narrativeEnabled || !guest) return null;
  const checks = ask.data ? checkLlmVenues(ask.data, run.candidates, baseline?.candidates ?? []) : [];

  return (
    <div className="mt-6 border-t border-line pt-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Bot className="size-4 text-host" aria-hidden /> Optional: the same question to a language model alone
      </p>
      {!ask.data ? (
        <div className="mt-2 space-y-2 text-sm" aria-live="polite">
          <label className="flex items-start gap-2 text-xs text-ink-soft">
            <input type="checkbox" className="mt-0.5 size-4 accent-common" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I agree to send the references, product categories, venue type, and area to Google's Gemini API, whose free tier may use submitted content
              to improve Google's products. No business names, budgets, or terms are sent.
            </span>
          </label>
          <Button size="sm" variant="secondary" disabled={!consent || ask.isPending} onClick={() => ask.mutate()}>
            {ask.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bot className="size-4" aria-hidden />} Ask without Qloo data (1 model call)
          </Button>
          {ask.error && (
            <p className="text-bad" role="alert">
              {ask.error instanceof ApiRequestError ? ask.error.message : "The language model could not answer."} The Qloo results are unaffected.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-3 text-sm" aria-live="polite">
          {checks.length === 0 ? (
            <p className="text-ink-soft">The model named no usable venues.</p>
          ) : (
            <ul className="space-y-2">
              {checks.map((v) => (
                <li key={v.name} className="rounded-lg border border-line p-2.5">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{v.name}</span> <ProvenanceChip kind="llm_interpretation" />
                    <span className="text-xs text-ink-faint">
                      {v.tasteRank !== null
                        ? `also #${v.tasteRank} in the taste-informed Qloo list`
                        : v.categoryRank !== null
                          ? `also #${v.categoryRank} in the category-only Qloo list`
                          : "not among the Qloo results on this page (not checked further)"}
                    </span>
                  </p>
                  <p className="mt-1 text-ink-soft">“{v.reason}”</p>
                </li>
              ))}
            </ul>
          )}
          <ul className="list-disc space-y-1 pl-5 text-xs text-ink-faint">
            {ask.data.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
            <li>Model: {ask.data.model}. A baseline, not ground truth: a name missing from Qloo's list may still be a real venue.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
