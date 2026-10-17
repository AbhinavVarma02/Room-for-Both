import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Download, FileText, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { evaluateScenario } from "@shared/domain";
import { buildBrief, narrativeFacts, type BriefInput } from "@shared/domain/brief";
import { money } from "@shared/domain/format";
import type { ProvenanceKind } from "@shared/schemas/common";
import { ApiRequestError, draftNarrative, getConfig } from "../../app/api";
import { useWorkspace } from "../../app/store";
import { StepNav } from "../../app/Workspace";
import { Button, Callout, Notice, PartyTag, ProvenanceChip, StatusBadge, cn } from "../../components/ui/primitives";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 border-b border-line pb-2 text-xl font-semibold">{children}</h2>;
}

/**
 * Reference sections start collapsed on screen so the decision reads first. Every one opens for
 * printing (see the print handler in App), so the printed brief stays complete.
 */
function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-6 border-b border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 select-none hover:text-common [&::-webkit-details-marker]:hidden">
        <ChevronDown className="no-print size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180" aria-hidden />
        <h2 className="flex-1 text-xl font-semibold">{title}</h2>
        {meta && <span className="no-print text-sm text-ink-faint">{meta}</span>}
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  );
}

function Glance({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-paper/60 p-4", className)}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 text-sm text-ink">{children}</dd>
    </div>
  );
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
    // A what-if brief is compared with the stated terms so every edited value reads as a proposal.
    const stated = useWhatIf && guest && host ? { scenario: { guest, host }, evaluation: evaluateScenario({ guest, host }) } : undefined;
    return buildBrief(scenario, evaluateScenario(scenario), state.research, {
      hypothetical: useWhatIf,
      selection: state.selection,
      sensitivity: state.sensitivity,
      ...(stated ? { stated } : {}),
    });
  }, [scenario, state.research, state.selection, state.sensitivity, useWhatIf, guest, host]);

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
    if (!i.proposedChange) (acc[i.provenance] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-4">
        {/* The brief's own title is this page's h1, so the step header here is a plain intro. */}
        <div>
          <p className="eyebrow">Step 6 of 6 · Decision brief</p>
          <p className="mt-1.5 max-w-xl text-ink-soft">A draft for both businesses to review together. Printing opens every section.</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            {brief.hostTerms.disclaimer && (
              <Callout tone="bad" title="Hypothetical host terms">
                {brief.hostTerms.disclaimer}
              </Callout>
            )}
            {brief.fictional && !brief.hostTerms.disclaimer && (
              <Notice title="Fictional example">Describes invented businesses for demonstration. It is not about any real company.</Notice>
            )}
            {brief.hostTerms.disclaimer && scenario.guest.origin === "synthetic_demo" && (
              <Notice title="Fictional guest">The guest business is invented for demonstration. It is not a real company.</Notice>
            )}
            {brief.hypothetical && (
              <Notice title="What-if values">
                Built from values explored in Decision Reversal, not the parties' entered terms.
                {brief.counterproposal ? " Each changed value is listed below as a proposal the named party still has to confirm." : ""}
              </Notice>
            )}
            {brief.twoSided.status !== "fictional_two_sided" && brief.twoSided.status !== "hypothetical_host" && (
              <Notice tone="info" title="Whose inputs these are">
                {brief.twoSided.explanation}
              </Notice>
            )}
          </div>
        </header>

        <section aria-labelledby="glance-title" className="mt-8">
          <h2 id="glance-title" className="text-xl font-semibold">
            At a glance
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Glance label="Proposed collaboration">
              {brief.proposal ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-semibold">{brief.activation?.title ?? brief.proposal.label}</span>
                  {brief.activation && <span className="text-ink-soft">as a {brief.proposal.label.toLowerCase()}</span>}
                </span>
              ) : (
                <span className="text-ink-soft">No arrangement is feasible or conditional yet.</span>
              )}
            </Glance>
            <Glance label="Current feasibility">
              <span className="flex flex-wrap items-center gap-2">
                {brief.proposal ? <StatusBadge status={brief.proposal.status} /> : <StatusBadge status="no_go" />}
                <span className="text-ink-soft">
                  {(["feasible", "conditional", "no_go"] as const)
                    .map((st) => `${brief.options.filter((o) => o.status === st).length} ${st === "no_go" ? "no-go" : st}`)
                    .join(" · ")}
                </span>
              </span>
            </Glance>
            <Glance label="Cultural rationale">
              {brief.activation?.why[0] ?? (brief.cultural ? "See the cultural evidence below." : "No cultural research was run for this brief.")}
            </Glance>
            <Glance label="Needs confirming first">
              {brief.unresolved.length > 0 ? (
                <ul className="space-y-1">
                  {brief.unresolved.slice(0, 2).map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                  {brief.unresolved.length > 2 && <li className="text-ink-faint">and {brief.unresolved.length - 2} more below</li>}
                </ul>
              ) : (
                "Nothing unresolved on the stated terms; both sides still confirm the details."
              )}
            </Glance>
            {brief.questions[0] && (
              <Glance label="Recommended next conversation" className="sm:col-span-2 border-common/25 bg-common-soft/40">
                <span className="font-medium">Ask: “{brief.questions[0].text}”</span>
              </Glance>
            )}
          </dl>
        </section>

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
                <p className="mt-2 text-xs text-ink-faint">
                  Drafted by {narrative.data.model} from the facts above and checked for added numbers or claims. Verify before use.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="font-semibold">Optional: ask a language model for a plain-language version</p>
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 size-4 accent-common" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span className="text-ink-soft">
                    I agree to send the summary facts shown above (names, option labels, statuses, and amounts) to Google's Gemini API, whose free tier may use
                    submitted content to improve Google's products.
                  </span>
                </label>
                <Button size="sm" variant="secondary" disabled={!consent || narrative.isPending} onClick={() => narrative.mutate()}>
                  <FileText className="size-4" aria-hidden /> Draft a summary
                </Button>
                {narrative.error && (
                  <p className="text-bad" role="alert">
                    {narrative.error instanceof ApiRequestError ? narrative.error.message : "The summary could not be drafted."} The rule-based summary is
                    unaffected.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {brief.counterproposal && (
          <>
            <H2>Proposed changes to discuss</H2>
            <p className="mt-3 text-sm text-ink-soft">
              Nobody has agreed to these. They are the values tried in Decision Reversal, set against what each side stated, and each one needs the named
              party's confirmation before anything below holds.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {brief.counterproposal.changes.map((c) => (
                <li key={`${c.party}-${c.label}`} className="flex flex-wrap items-baseline gap-2 rounded-xl border border-line p-3">
                  <PartyTag party={c.party} />
                  <span className="font-medium">{c.label}:</span>
                  <span className="text-ink-soft line-through">{c.from}</span>
                  <span aria-hidden>→</span>
                  <span className="sr-only">proposed</span>
                  <span className="font-medium">{c.to}</span>
                  <span className="text-xs text-ink-faint">needs confirmation by the {c.party}</span>
                </li>
              ))}
            </ul>
            {brief.counterproposal.effects.length > 0 ? (
              <div className="mt-3 text-sm">
                <p className="font-medium">What these changes would do, re-checked by the same rules</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
                  {brief.counterproposal.effects.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">These changes do not change any option's status.</p>
            )}
          </>
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
            <p className="text-xs text-ink-faint">
              Hypotheses describe why each side might want this. They are not forecasts and promise no gain to either party.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-ink-soft">
            No option is currently feasible or conditional. The closest blocked options and what would unblock them are listed below.
          </p>
        )}

        {brief.activation && (
          <>
            <H2>Activation idea</H2>
            <div className="mt-4 rounded-xl border border-common/25 bg-common-soft/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-lg font-semibold">{brief.activation.title}</p>
                <span className="flex flex-wrap gap-1.5">
                  {brief.activation.sources.map((k) => (
                    <ProvenanceChip key={k} kind={k} />
                  ))}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-faint">For: {brief.activation.forOption}</p>
              <p className="mt-3 leading-relaxed">{brief.activation.pitch}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold">Why this theme</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-soft">
                    {brief.activation.why.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold">Still unverified</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-soft">
                    {brief.activation.unverified.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {brief.concepts.length > 1 && (
          <Section title="Other ideas the evidence supports" meta={`${brief.concepts.length} ideas`}>
            <ul className="mt-3 space-y-3 text-sm">
              {brief.concepts.map((c) => (
                <li key={c.basis} className="rounded-xl border border-line p-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.title}</span>
                    {c.lead && (
                      <>
                        <span className="text-ink-faint">· {c.lead.label}</span>
                        <StatusBadge status={c.lead.status} short />
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-ink-soft">{c.observed.join(" ")}</p>
                  {c.mightNotSuit[0] && <p className="mt-1 text-xs text-ink-faint">Might not suit: {c.mightNotSuit[0]}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">Statuses come from the same checks as the options below; the evidence only chooses the idea.</p>
          </Section>
        )}

        <H2>What decides what</H2>
        <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          {[brief.decides.opportunity, brief.decides.feasibility, brief.decides.commercial].map((d) => (
            <li key={d} className="rounded-xl border border-line bg-paper/60 p-3 text-ink-soft">
              <span className="font-semibold text-ink">{d.slice(0, d.indexOf(":") + 1)}</span>
              {d.slice(d.indexOf(":") + 1)}
            </li>
          ))}
        </ul>

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

        <Section title="All options" meta={`${brief.options.length} checked`}>
          <div className="mt-1 overflow-x-auto">
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
        </Section>

        {brief.closestBlocked.length > 0 && (
          <Section title="What would change the answer" meta={`${brief.closestBlocked.length} blocked options`}>
            <ul className="mt-1 space-y-4">
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
          </Section>
        )}

        <H2>Cultural evidence</H2>
        {brief.cultural ? (
          <div className="mt-3 space-y-4">
            {brief.cultural.mode === "fixture" && <Callout tone="warn" title="Fixture data: fictional cultural results, not from Qloo." />}
            {brief.cultural.mode === "live" && (
              <Callout tone="info" title="Cultural results retrieved live from Qloo.">
                They describe aggregate taste associations only, not either business's customers, sales, or terms.
              </Callout>
            )}
            {brief.venue && (
              <div className="rounded-xl border border-line p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  Venue chosen from research: <span className="font-semibold">{brief.venue.name}</span> <ProvenanceChip kind={brief.venue.evidence} />
                </p>
                <p className="mt-1 text-ink-soft">
                  #{brief.venue.rank} in its research run · {brief.venue.affinityLabel}
                  {brief.venue.influencedBy.length > 0 ? ` · most influenced by ${brief.venue.influencedBy.join(", ")}` : ""}
                  {brief.venue.address ? ` · ${brief.venue.address}` : ""}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Source: {brief.venue.request}, {brief.venue.retrievedAt} · entity {brief.venue.qlooEntityId}
                </p>
              </div>
            )}
            <Section title="Full cultural evidence" meta="bridge, comparison, sensitivity, sources">
              <div className="space-y-4">
                {brief.bridge && (brief.bridge.venueSide || brief.bridge.shared.length > 0) && (
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    {brief.bridge.guestSide && (
                      <div>
                        <p className="font-medium">Guest side: {brief.bridge.guestSide.title}</p>
                        <p className="text-ink-soft">{brief.bridge.guestSide.items.join(", ")}</p>
                        <p className="text-xs text-ink-faint">Source: {brief.bridge.guestSide.source}</p>
                      </div>
                    )}
                    {brief.bridge.venueSide && (
                      <div>
                        <p className="font-medium">Venue side: {brief.bridge.venueSide.title}</p>
                        <p className="text-ink-soft">{brief.bridge.venueSide.items.join(", ") || "No results."}</p>
                        <p className="text-xs text-ink-faint">Source: {brief.bridge.venueSide.source}</p>
                      </div>
                    )}
                    <p className="sm:col-span-2">
                      {brief.bridge.shared.length ? `In both: ${brief.bridge.shared.join(", ")}.` : "No item appears on both sides."}
                      {brief.bridge.sharedTags.length ? ` Shared taste tags: ${brief.bridge.sharedTags.join(", ")}.` : ""}{" "}
                      <span className="text-xs text-ink-faint">{brief.bridge.method}</span>
                    </p>
                  </div>
                )}
                {brief.discoveryComparison && (
                  <div className="text-sm">
                    <p className="font-medium">With and without the taste signal</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
                      {brief.discoveryComparison.findings.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-ink-faint">Category-only source: {brief.discoveryComparison.source}</p>
                  </div>
                )}
                {brief.sensitivity && (
                  <div className="text-sm">
                    <p className="font-medium">How much each reference matters</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
                      {brief.sensitivity.findings.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                      {brief.sensitivity.references.map((r) => (
                        <li key={r.omitted}>
                          Without “{r.omitted}”: {r.finding}
                        </li>
                      ))}
                    </ul>
                  </div>
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
            </Section>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">No cultural research was run for this brief.</p>
        )}

        <Section title="Inputs and where they came from" meta={`${brief.inputs.length} inputs`}>
          <div className="mt-1 space-y-5">
            {brief.counterproposal && (
              <div>
                <h3 className="text-sm font-semibold">Proposed in this what-if, not stated by the party</h3>
                <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {brief.inputs
                    .filter((i) => i.proposedChange)
                    .map((i) => (
                      <li key={`${i.party}-${i.label}`} className="flex items-baseline gap-2">
                        <PartyTag party={i.party} />
                        <span className="text-ink-soft">{i.label}:</span> <span>{i.value}</span>
                        <span className="text-xs text-ink-faint">(stated: {i.proposedChange?.from})</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
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
        </Section>

        {brief.proposal && (
          <Section title="Assumptions in the proposed format" meta={`${brief.proposal.assumptions.length}`}>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {brief.proposal.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Method and limits">
          <p className="mt-1 text-sm">{brief.method}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {brief.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Section>
      </article>

      <StepNav back="reversal" />
    </div>
  );
}
