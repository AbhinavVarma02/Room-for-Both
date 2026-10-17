import * as Tabs from "@radix-ui/react-tabs";
import { Lightbulb, Star } from "lucide-react";
import { useState } from "react";
import { FORMAT_LABELS } from "@shared/constants/vocabulary";
import type { ProposalConcept } from "@shared/domain/concepts";
import { Disclosure, ProvenanceChip, StatusBadge, cn } from "../../components/ui/primitives";

/**
 * Collaboration ideas from different slices of the cultural evidence, one at a time. The idea marked
 * to discuss first is the first with a workable format on stated terms; that mark is about
 * feasibility, never about expected success.
 */
export function ProposalConcepts({ concepts, promising }: { concepts: ProposalConcept[]; promising: ProposalConcept | null }) {
  const first = promising ?? concepts[0];
  // Only a visitor's own choice is remembered; until then the tab follows the recommendation, which can
  // change when venue-side evidence arrives after the first render.
  const [chosen, setChosen] = useState<string | null>(null);
  if (concepts.length === 0 || !first) return null;
  const value = chosen && concepts.some((c) => c.basis === chosen) ? chosen : first.basis;
  return (
    <section className="mt-12" aria-labelledby="concepts-title">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <Lightbulb className="size-3.5 text-guest" aria-hidden /> From the cultural evidence
          </p>
          <h2 id="concepts-title" className="mt-1 text-2xl font-semibold">
            {promising ? "Recommended collaboration idea" : "Collaboration ideas"}
          </h2>
        </div>
        <p className="max-w-md text-sm text-ink-soft">
          The evidence suggests the idea. Only both sides' terms decide whether it can run, and nothing here forecasts sales.
        </p>
      </div>
      {!promising && <p className="mt-2 text-sm text-ink-soft">No idea has a workable format on current terms yet; the change above is the place to start.</p>}

      <Tabs.Root value={value} onValueChange={setChosen} className="mt-4">
        {concepts.length > 1 && (
          <Tabs.List aria-label="Collaboration ideas" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {concepts.map((c) => (
              <Tabs.Trigger
                key={c.basis}
                value={c.basis}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  "border-line-strong bg-surface text-ink-soft hover:text-ink data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-white",
                )}
              >
                {c === promising && <Star className="size-3.5" aria-label="Discuss first" />}
                {c.title}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        )}
        {concepts.map((c) => (
          <Tabs.Content key={c.basis} value={c.basis} className="mt-3 focus-visible:outline-offset-4">
            <ConceptPanel concept={c} lead={c === promising} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </section>
  );
}

function nextStep(c: ProposalConcept): string {
  if (!c.lead) return "No format for this idea fits both sides yet.";
  if (c.lead.status === "feasible") return `Propose the ${c.lead.label.toLowerCase()} and confirm the details below.`;
  if (c.lead.status === "conditional") return `Ask the host the open question, then propose the ${c.lead.label.toLowerCase()}.`;
  return `Explore the change that unblocks the ${c.lead.label.toLowerCase()} before proposing it.`;
}

function ConceptPanel({ concept: c, lead }: { concept: ProposalConcept; lead: boolean }) {
  return (
    <article className={cn("card overflow-hidden", lead && "border-guest/40")} aria-labelledby={`concept-${c.basis}`}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="bg-guest-soft/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`concept-${c.basis}`} className="font-display text-2xl font-semibold">
              {c.title}
            </h3>
            {lead && (
              <span className="inline-flex items-center gap-1 rounded-full bg-guest px-2 py-0.5 text-xs font-semibold text-white">
                <Star className="size-3" aria-hidden /> Discuss first
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-faint">{c.angle}</p>
          <p className="mt-3 leading-relaxed">{c.pitch}</p>
          <p className="mt-4 flex flex-wrap gap-1.5">
            {c.sources.map((k) => (
              <ProvenanceChip key={k} kind={k} />
            ))}
          </p>
        </div>
        <dl className="grid content-start gap-4 p-5 text-sm sm:p-6">
          <div>
            <dt className="eyebrow">Best format now</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {c.lead ? (
                <>
                  <span className="font-semibold">{c.lead.label}</span>
                  <StatusBadge status={c.lead.status} short />
                </>
              ) : (
                <span className="text-ink-soft">None fits yet</span>
              )}
            </dd>
          </div>
          {c.observed[0] && (
            <div>
              <dt className="eyebrow">Strongest evidence</dt>
              <dd className="mt-1 text-ink">{c.observed[0]}</dd>
            </div>
          )}
          {c.hostConfirmations.length > 0 && (
            <div>
              <dt className="eyebrow">Not confirmed yet</dt>
              <dd className="mt-1 text-ink">
                {c.hostConfirmations[0]}
                {c.hostConfirmations.length > 1 && <span className="text-ink-faint"> (+{c.hostConfirmations.length - 1} more below)</span>}
              </dd>
            </div>
          )}
          <div>
            <dt className="eyebrow">Next step</dt>
            <dd className="mt-1 font-medium text-ink">{nextStep(c)}</dd>
          </div>
        </dl>
      </div>
      <Disclosure title="Every format, the full evidence, and why it might not suit" className="border-t border-line px-5 sm:px-6">
        <div className="space-y-4 pb-4 text-sm">
          <ul className="space-y-2" aria-label="Formats this idea suits">
            {c.formats.map((f) => (
              <li key={f.format} className="rounded-lg border border-line p-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{FORMAT_LABELS[f.format]}</span>
                  <StatusBadge status={f.status} short />
                  <span className="text-xs text-ink-faint">{f.label}</span>
                </span>
                <span className="mt-1 block text-xs text-ink-soft">{f.note}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 md:grid-cols-2">
            <Block title="Observed">{c.observed}</Block>
            <Block title="Interpretation">{[c.interpretation]}</Block>
            <Block title="The host would need to confirm">{c.hostConfirmations}</Block>
            <Block title="Still unverified">{c.unverified}</Block>
            {c.mightNotSuit.length > 0 && <Block title="Why it might not suit">{c.mightNotSuit}</Block>}
          </div>
        </div>
      </Disclosure>
    </article>
  );
}

function Block({ title, children }: { title: string; children: string[] }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
        {children.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
