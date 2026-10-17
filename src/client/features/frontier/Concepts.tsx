import { ChevronDown, Star } from "lucide-react";
import { FORMAT_LABELS } from "@shared/constants/vocabulary";
import type { ProposalConcept } from "@shared/domain/concepts";
import { Card, ProvenanceChip, StatusBadge, cn } from "../../components/ui/primitives";

/**
 * Distinct ideas from different slices of the cultural evidence, each beside the rules engine's
 * answer for the formats it suits. The first idea with a workable format is marked as the one to
 * discuss first; that mark is about feasibility on stated terms, never about expected success.
 */
export function ProposalConcepts({ concepts, promising }: { concepts: ProposalConcept[]; promising: ProposalConcept | null }) {
  if (concepts.length === 0) return null;
  return (
    <section className="mb-8" aria-labelledby="concepts-title">
      <h2 id="concepts-title" className="text-xl font-semibold">
        Ideas worth proposing
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">
        Each idea comes from a different part of the cultural evidence. Whether its formats work is decided only by both parties' stated terms, so the
        same evidence can point to an idea that is blocked today.
        {promising ? "" : " None of them has a workable format on current terms yet; the change suggested above is the place to start."}
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {concepts.map((c) => (
          <ConceptCard key={c.basis} concept={c} lead={c === promising} />
        ))}
      </div>
    </section>
  );
}

function ConceptCard({ concept: c, lead }: { concept: ProposalConcept; lead: boolean }) {
  return (
    <Card className={cn("flex flex-col", lead && "border-2 border-common")}>
      <p className="eyebrow">{c.angle}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-semibold">{c.title}</h3>
        {lead && (
          <span className="inline-flex items-center gap-1 rounded-full bg-common px-2 py-0.5 text-xs font-semibold text-white">
            <Star className="size-3" aria-hidden /> Discuss first
          </span>
        )}
      </div>
      {c.lead && <p className="mt-1 text-xs text-ink-faint">Lead format: {c.formatTitle}</p>}
      <p className="mt-2 text-sm leading-relaxed">{c.pitch}</p>

      <ul className="mt-3 space-y-2" aria-label="Formats this idea suits">
        {c.formats.map((f) => (
          <li key={f.format} className="rounded-lg border border-line p-2 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{FORMAT_LABELS[f.format]}</span>
              <StatusBadge status={f.status} short />
              <span className="text-xs text-ink-faint">{f.label}</span>
            </span>
            <span className="mt-1 block text-xs text-ink-soft">{f.note}</span>
          </li>
        ))}
      </ul>

      <details className="group mt-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-1 font-medium text-ink-soft hover:text-ink">
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /> Evidence, confirmations, and reasons it may not suit
        </summary>
        <div className="mt-2 space-y-3">
          <Block title="Observed">{c.observed}</Block>
          <Block title="Interpretation">{[c.interpretation]}</Block>
          <Block title="The host would need to confirm">{c.hostConfirmations}</Block>
          <Block title="Still unverified">{c.unverified}</Block>
          {c.mightNotSuit.length > 0 && <Block title="Why it might not suit">{c.mightNotSuit}</Block>}
        </div>
      </details>
      <p className="mt-auto flex flex-wrap gap-1.5 pt-3">
        {c.sources.map((k) => (
          <ProvenanceChip key={k} kind={k} />
        ))}
      </p>
    </Card>
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
