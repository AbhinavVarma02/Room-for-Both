import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { evaluateScenario } from "@shared/domain";
import { buildBrief, narrativeFacts, type BriefInput } from "@shared/domain/brief";
import { money } from "@shared/domain/format";
import type { ProvenanceKind } from "@shared/schemas/common";
import { ApiRequestError, draftNarrative, getConfig } from "../../app/api";
import { useWorkspace } from "../../app/store";
import { StepHeader, StepNav } from "../../app/Workspace";
import { Button, Callout, PartyTag, ProvenanceChip, StatusBadge } from "../../components/ui/primitives";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 border-b border-line pb-2 text-xl font-semibold">{children}</h2>;
}

export function Brief() {
  const { state } = useWorkspace();
  const search = useSearch();
  const useWhatIf = new URLSearchParams(search).get("whatif") === "1" && state.whatIf !== null;
  const { guest, host, whatIf } = state;
  const scenario = useMemo(() => (useWhatIf ? whatIf : guest && host ? { guest, host } : null), [useWhatIf, whatIf, guest, host]);
  const config = useQuery({ queryKey: ["config"], queryFn: getConfig });
  const [consent, setConsent] = useState(false);

  const brief = useMemo(() => {
    if (!scenario) return null;
    return buildBrief(scenario, evaluateScenario(scenario), state.research, { hypothetical: useWhatIf, selectedCandidateId: state.selectedCandidateId });
  }, [scenario, state.research, state.selectedCandidateId, useWhatIf]);

  const narrative = useMutation({
    mutationFn: () => {
      if (!brief || !scenario) throw new Error("No brief");
      return draftNarrative(narrativeFacts(brief, scenario.guest.businessName, scenario.host.venueName));
    },
  });

  if (!brief || !scenario) return null;

  const download = () => {
    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "room-for-both-decision-brief.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const byProvenance = brief.inputs.reduce<Record<string, BriefInput[]>>((acc, i) => {
    (acc[i.provenance] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div>
      <div className="no-print">
        <StepHeader step="brief">A draft for both businesses to review together. Print it, save it as a PDF from the print dialog, or download the data.</StepHeader>
        <div className="mb-8 flex flex-wrap gap-3">
          <Button onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Print or save as PDF
          </Button>
          <Button variant="secondary" onClick={download}>
            <Download className="size-4" aria-hidden /> Download JSON
          </Button>
        </div>
      </div>

      <article className="card mx-auto max-w-4xl p-6 sm:p-10 print:max-w-none print:border-0 print:p-0" aria-labelledby="brief-title">
        <header>
          <p className="eyebrow">Joint decision brief · draft for human review</p>
          <h1 id="brief-title" className="mt-2 text-3xl font-semibold tracking-tight">
            {brief.title}
          </h1>
          <p className="mt-2 text-sm text-ink-faint">
            Generated {new Date(brief.generatedAt).toLocaleString()} · rules engine v{brief.engineVersion}
          </p>
          <div className="mt-4 space-y-2">
            {brief.fictional && (
              <Callout tone="warn" title="Fictional example">
                Describes invented businesses for demonstration. It is not about any real company.
              </Callout>
            )}
            {brief.hypothetical && (
              <Callout tone="warn" title="What-if values">
                Built from hypothetical values explored in Decision Reversal, not the parties' entered terms.
              </Callout>
            )}
            <Callout tone={brief.twoSided.status === "two_sided" ? "ok" : "info"} title="Whose inputs these are">
              {brief.twoSided.explanation}
            </Callout>
          </div>
        </header>

        <H2>Summary</H2>
        <p className="mt-3 leading-relaxed">{brief.summary}</p>
        <p className="mt-2 text-xs text-ink-faint">Rule-based summary assembled from the checks below.</p>

        {config.data?.narrativeEnabled && (
          <div className="no-print mt-4 rounded-xl border border-line bg-sunken/40 p-4">
            {narrative.data ? (
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  Plain-language draft <ProvenanceChip kind="llm_interpretation" />
                </p>
                <p className="mt-2 text-sm leading-relaxed">{narrative.data.summary}</p>
                <p className="mt-2 text-xs text-ink-faint">Drafted by {narrative.data.model} from the facts above and checked for added numbers or claims. Verify before use.</p>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="font-semibold">Optional: ask a language model for a plain-language version</p>
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 size-4 accent-common" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span className="text-ink-soft">
                    I agree to send the summary facts shown above (names, option labels, statuses, and amounts) to Google's Gemini API, whose free tier may
                    use submitted content to improve Google's products.
                  </span>
                </label>
                <Button size="sm" variant="secondary" disabled={!consent || narrative.isPending} onClick={() => narrative.mutate()}>
                  <FileText className="size-4" aria-hidden /> Draft a summary
                </Button>
                {narrative.error && (
                  <p className="text-bad" role="alert">
                    {narrative.error instanceof ApiRequestError ? narrative.error.message : "The summary could not be drafted."} The rule-based summary is unaffected.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <H2>Proposed starting point</H2>
        {brief.proposal ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-display text-xl font-semibold">{brief.proposal.label}</p>
              <StatusBadge status={brief.proposal.status} />
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-faint">Guest outlay</dt>
                <dd className="font-medium">{brief.proposal.guestOutlayUsd === null ? "Unknown" : money(brief.proposal.guestOutlayUsd)}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Host fee</dt>
                <dd className="font-medium">{brief.proposal.hostFeeUsd === null ? "Unknown" : money(brief.proposal.hostFeeUsd)}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">When</dt>
                <dd className="font-medium">{brief.proposal.when}</dd>
              </div>
            </dl>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-guest-soft/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <PartyTag party="guest" /> Value hypothesis
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-soft">
                  {brief.guestValue.length ? brief.guestValue.map((v) => <li key={v}>{v}</li>) : <li>No objectives stated.</li>}
                </ul>
              </div>
              <div className="rounded-xl bg-host-soft/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <PartyTag party="host" /> Value hypothesis
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-soft">
                  {brief.hostValue.length ? brief.hostValue.map((v) => <li key={v}>{v}</li>) : <li>No goals stated by the host.</li>}
                </ul>
              </div>
            </div>
            <p className="text-xs text-ink-faint">Hypotheses describe why each side might want this. They are not forecasts and promise no gain to either party.</p>
          </div>
        ) : (
          <p className="mt-3 text-ink-soft">No option is currently feasible or conditional. The closest blocked options and what would unblock them are listed below.</p>
        )}

        {brief.unresolved.length > 0 && (
          <>
            <H2>Unresolved before commitment</H2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {brief.unresolved.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </>
        )}

        <H2>First three questions to ask</H2>
        <ol className="mt-3 list-decimal space-y-3 pl-5">
          {brief.questions.map((q) => (
            <li key={q.text}>
              <p className="font-medium">{q.text}</p>
              <p className="text-sm text-ink-soft">{q.detail}</p>
            </li>
          ))}
        </ol>

        <H2>All options</H2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-2 pr-3 font-medium">Option</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Outlay</th>
                <th className="py-2 pr-3 font-medium">Fee</th>
                <th className="py-2 font-medium">Main reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {brief.options.map((o) => (
                <tr key={o.label}>
                  <td className="py-2 pr-3 font-medium">
                    {o.label}
                    {o.onFrontier && <span className="block text-xs text-common">on the frontier</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={o.status} short />
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{o.guestOutlayUsd === null ? "—" : money(o.guestOutlayUsd)}</td>
                  <td className="py-2 pr-3 tabular-nums">{o.hostFeeUsd === null ? "—" : money(o.hostFeeUsd)}</td>
                  <td className="py-2 text-ink-soft">{o.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {brief.closestBlocked.length > 0 && (
          <>
            <H2>What would change the answer</H2>
            <ul className="mt-3 space-y-4">
              {brief.closestBlocked.map((b) => (
                <li key={b.label}>
                  <p className="font-medium">{b.label}</p>
                  <p className="text-sm text-ink-soft">Blocked by: {b.reasons.join(" ")}</p>
                  {b.changes.length > 0 ? (
                    <p className="text-sm">Smallest verified change: {b.changes.join(" ")}</p>
                  ) : (
                    <p className="text-sm text-bad">Blocked by non-negotiable terms: {b.nonNegotiable.join(", ")}.</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <H2>Cultural evidence</H2>
        {brief.cultural ? (
          <div className="mt-3 space-y-4">
            {brief.cultural.mode === "fixture" && <Callout tone="warn" title="Fixture data: fictional cultural results, not from Qloo." />}
            {brief.cultural.selectedVenue && (
              <p className="text-sm">
                Selected venue: <span className="font-medium">{brief.cultural.selectedVenue.name}</span> ({brief.cultural.selectedVenue.strength}
                {brief.cultural.selectedVenue.affinity !== null ? `, affinity ${brief.cultural.selectedVenue.affinity.toFixed(2)}` : ""}). Source:{" "}
                {brief.cultural.selectedVenue.source}.
              </p>
            )}
            {brief.cultural.themes.map((t) => (
              <div key={t.title}>
                <p className="flex items-center gap-2 font-medium">
                  {t.title} <ProvenanceChip kind={t.provenance} />
                </p>
                <p className="text-sm text-ink-soft">{t.items.join(", ")}</p>
                <p className="text-xs text-ink-faint">Source: {t.source}</p>
              </div>
            ))}
            {brief.cultural.themes.length === 0 && <p className="text-sm text-ink-soft">The research run produced no cultural themes.</p>}
            <ul className="list-disc space-y-1 pl-5 text-xs text-ink-faint">
              {brief.cultural.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">No cultural research was run for this brief.</p>
        )}

        <H2>Inputs and where they came from</H2>
        <div className="mt-3 space-y-5">
          {(Object.keys(byProvenance) as ProvenanceKind[]).map((k) => (
            <div key={k}>
              <h3 className="text-sm font-semibold">
                <ProvenanceChip kind={k} className="text-xs" />
                <span className="sr-only"> inputs</span>
              </h3>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {byProvenance[k]?.map((i) => (
                  <li key={`${i.party}-${i.label}`} className="flex items-baseline gap-2">
                    <PartyTag party={i.party} />
                    <span className="text-ink-soft">{i.label}:</span> <span>{i.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {brief.proposal && (
          <>
            <H2>Assumptions in the proposed format</H2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {brief.proposal.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </>
        )}

        <H2>Method and limits</H2>
        <p className="mt-3 text-sm">{brief.method}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {brief.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </article>

      <StepNav back="reversal" />
    </div>
  );
}
