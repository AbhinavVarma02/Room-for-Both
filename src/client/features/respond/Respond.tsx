import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FORMAT_LABELS, PRODUCT_CATEGORY_LABELS, VENUE_CATEGORY_LABELS } from "@shared/constants/vocabulary";
import type { HostProfile } from "@shared/schemas/profiles";
import { ApiRequestError, getHostView, submitHostResponse } from "../../app/api";
import { Callout, Card, Skeleton } from "../../components/ui/primitives";
import { HostForm } from "../two-sided/HostForm";

/**
 * The host's private page. The token travels in the URL fragment, which browsers never send to
 * servers or in Referer headers; the page forwards it only as a bearer header to our own API.
 */
function tokenFromHash(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const t = params.get("t");
  return t && /^[A-Za-z0-9_-]{43}$/.test(t) ? t : null;
}

export function Respond() {
  const token = useMemo(() => tokenFromHash(), []);
  const [saved, setSaved] = useState<{ editsRemaining: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = useQuery({
    queryKey: ["host-view", token],
    queryFn: () => getHostView(token ?? ""),
    enabled: token !== null,
    retry: false,
  });

  if (!token) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-semibold">This link is incomplete</h1>
        <p className="mt-3 text-ink-soft">Ask the business that sent it for a fresh link, and open it exactly as sent.</p>
      </div>
    );
  }

  if (view.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12 sm:px-6" aria-busy="true">
        <h1 className="sr-only">Loading the partnership request</h1>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (view.error || !view.data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-semibold">This link can't be opened</h1>
        <p className="mt-3 text-ink-soft">{view.error instanceof ApiRequestError ? view.error.message : "It may have expired or been withdrawn."}</p>
      </div>
    );
  }

  const { summary, host, editsRemaining, expiresAt } = view.data;
  const initial: HostProfile = host ?? {
    source: "host_response_link",
    venueName: summary.venueName,
    venueCategory: summary.venueCategory,
    goals: [],
    allowedFormats: null,
    availability: null,
    popupFeePerDayUsd: null,
    shelfFeePerWeekUsd: null,
    shelfMinWeeks: null,
    eventFeePerHourUsd: null,
    eventMinHours: null,
    guestFloorSqFt: null,
    shelfLinearFt: null,
    eventCapacity: null,
    staffHoursPerActivation: null,
    excludedCategories: null,
    samplingAllowed: null,
    alcoholOnPremises: null,
    requiresExclusivity: null,
    priorities: [],
    fixedFields: [],
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Private partnership request</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{summary.guestBusinessName} would like to explore a collaboration</h1>
      <Card className="mt-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-faint">For</dt>
            <dd className="font-medium">
              {summary.venueName} ({VENUE_CATEGORY_LABELS[summary.venueCategory]})
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">They sell</dt>
            <dd className="font-medium">{summary.productCategories.map((c) => PRODUCT_CATEGORY_LABELS[c]).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Formats proposed</dt>
            <dd className="font-medium">{summary.proposedFormats.map((f) => FORMAT_LABELS[f]).join(", ")}</dd>
          </div>
          {summary.culturalTheme && (
            <div>
              <dt className="text-ink-faint">Theme idea</dt>
              <dd className="font-medium">{summary.culturalTheme}</dd>
            </div>
          )}
        </dl>
        {summary.message && (
          <blockquote className="mt-4 border-l-2 border-host/40 pl-3 text-sm whitespace-pre-line text-ink-soft">{summary.message}</blockquote>
        )}
      </Card>

      <Callout className="mt-6" tone="info" title="Your answers, your terms">
        Tell them what would work for your venue. Leave anything blank that you have not decided; it will be shown as unknown, never guessed.
        Answering does not commit you to anything. This link expires {new Date(expiresAt).toLocaleDateString()} and can be saved {editsRemaining} more
        time{editsRemaining === 1 ? "" : "s"}.
      </Callout>

      {saved && (
        <Callout className="mt-6" tone="ok" title="Saved. Thank you.">
          {summary.guestBusinessName} can now see your answers. You can update them {saved.editsRemaining} more time{saved.editsRemaining === 1 ? "" : "s"}.
        </Callout>
      )}
      {error && <Callout className="mt-6" tone="bad" title={error} />}

      <div className="mt-8">
        {editsRemaining > 0 && (!saved || saved.editsRemaining > 0) ? (
          <HostForm
            initial={initial}
            mode="host_entry"
            submitLabel="Save my answers"
            onSubmit={async (h) => {
              setError(null);
              try {
                const { source: _source, ...answer } = h;
                setSaved(await submitHostResponse(token, answer));
              } catch (e) {
                setError(e instanceof ApiRequestError ? e.message : "Could not save your answers.");
              }
            }}
          />
        ) : (
          <Callout tone="warn" title="No edits remaining on this link." />
        )}
      </div>
    </div>
  );
}
