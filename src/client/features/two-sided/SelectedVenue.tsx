import { MapPin, Sparkles } from "lucide-react";
import { compareBridge, crossDomainTheme } from "@shared/domain/bridge";
import type { VenueSelection } from "@shared/schemas/selection";
import { Card, ProvenanceChip, cn } from "../../components/ui/primitives";
import { StrengthPill } from "../discovery/Discovery";

/**
 * The chosen venue and the two directions of the cultural bridge. The guest's side and the venue's
 * side are separate Qloo requests, so their scores are never mixed; only identical entities and tag
 * names are shown as shared.
 */
export function SelectedVenuePanel({ selection, compact = false }: { selection: VenueSelection; compact?: boolean }) {
  const c = selection.candidate;
  const cross = crossDomainTheme(selection.guestThemes);
  const bridge = compareBridge(cross, selection.venueBridge, selection.bridgeDomain);
  const sharedIds = new Set(bridge?.shared.map((s) => s.id) ?? []);
  const fictional = selection.mode === "fixture";

  return (
    <Card aria-labelledby="selected-venue-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Chosen from cultural research</p>
          <h2 id="selected-venue-heading" className="mt-1 font-display text-xl font-semibold">
            {c.venue.name}
          </h2>
        </div>
        <span className="flex flex-wrap items-center gap-1.5">
          <StrengthPill strength={c.strength} affinity={c.venue.affinity} />
          <ProvenanceChip kind={c.provenance.kind} />
        </span>
      </div>
      {c.venue.address && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {c.venue.address}
        </p>
      )}
      <p className="mt-2 text-sm text-ink-soft">
        #{c.rank} for {selection.signals.length ? selection.signals.map((s) => `“${s}”`).join(", ") : "the guest's search"}
        {c.contributions.length > 0 && <> · most influenced by {c.contributions.map((x) => `${x.seed} (${x.score.toFixed(2)})`).join(", ")}</>}
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        Source: {c.provenance.request} · {new Date(c.provenance.retrievedAt).toLocaleString()}
      </p>

      {!compact && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-guest/20 bg-guest-soft/40 p-4" aria-labelledby="bridge-guest">
            <h3 id="bridge-guest" className="text-sm font-semibold">
              From the guest's references
            </h3>
            {cross ? (
              <ul className="mt-2 space-y-1 text-sm">
                {cross.items.slice(0, 8).map((i) => (
                  <li key={i.id} className={cn(sharedIds.has(i.id) && "font-semibold text-common")}>
                    {i.name}
                    {sharedIds.has(i.id) && <span className="sr-only"> (also linked to the venue)</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">
                {selection.guestThemes.length ? `Taste tags: ${selection.guestThemes[0]?.items.map((i) => i.name).join(", ")}` : "No cultural bridge in this run."}
              </p>
            )}
          </section>
          <section className="rounded-xl border border-host/20 bg-host-soft/40 p-4" aria-labelledby="bridge-venue" aria-live="polite">
            <h3 id="bridge-venue" className="text-sm font-semibold">
              {fictional ? "From the venue's own profile (fictional data)" : "From the venue's own Qloo profile"}
            </h3>
            {selection.venueBridge ? (
              selection.venueBridge.items.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {selection.venueBridge.items.slice(0, 8).map((i) => (
                    <li key={i.id} className={cn(sharedIds.has(i.id) && "font-semibold text-common")}>
                      {i.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">{selection.venueBridge.limitations.at(-1)}</p>
              )
            ) : selection.venueBridgeNote ? (
              <p className="mt-2 text-sm text-ink-soft">{selection.venueBridgeNote}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">Looking up what {fictional ? "the fictional data" : "Qloo"} links to this venue…</p>
            )}
          </section>
        </div>
      )}

      {!compact && bridge && (
        <div className="mt-4 rounded-xl border border-line bg-paper/70 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-common" aria-hidden /> Where the two sides meet
          </p>
          {bridge.shared.length > 0 ? (
            <p className="mt-1">
              In both lists: <span className="font-medium">{bridge.shared.map((s) => s.name).join(", ")}</span>.
            </p>
          ) : (
            <p className="mt-1 text-ink-soft">No {bridge.noun} appear in both lists{bridge.comparable ? "" : " (the two sides used different kinds of results)"}.</p>
          )}
          {bridge.sharedTags.length > 0 && <p className="mt-1">Taste tags on both sides: {bridge.sharedTags.join(", ")}.</p>}
          <p className="mt-2 text-xs text-ink-faint">{bridge.method}</p>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-faint">
        Cultural evidence suggests whom to approach and what to propose. It says nothing about the venue's fees, space, schedule, or interest in partnering.
      </p>
    </Card>
  );
}
