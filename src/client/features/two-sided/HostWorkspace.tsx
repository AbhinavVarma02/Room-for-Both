import * as Tabs from "@radix-ui/react-tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, FlaskConical, Link2, PencilLine, RefreshCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { DAY_LABELS, FORMATS, FORMAT_LABELS, PRODUCT_CATEGORY_LABELS } from "@shared/constants/vocabulary";
import { clock, money } from "@shared/domain/format";
import { guestProvenance, hostProvenance } from "@shared/domain/provenance";
import { EXAMPLE_HOST } from "@shared/fixtures/example-scenario";
import { unknownHostFor } from "@shared/fixtures/hypothetical";
import type { Availability } from "@shared/schemas/common";
import type { GuestProfile, HostProfile } from "@shared/schemas/profiles";
import { ApiRequestError, createHostLink, getConfig, getOwnerView, revokeHostLink } from "../../app/api";
import { useWorkspace } from "../../app/store";
import { StepHeader, StepNav, stepHref } from "../../app/Workspace";
import { Button, Callout, Card, Field, PartyTag, ProvenanceChip, ToggleChips, cn } from "../../components/ui/primitives";
import { HostForm } from "./HostForm";
import { SelectedVenuePanel } from "./SelectedVenue";

const BLANK_HOST: HostProfile = {
  source: "entered_by_guest",
  venueName: "",
  venueCategory: "bookstore",
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

const HOST_TERM_KEYS = [
  "allowedFormats",
  "availability",
  "popupFeePerDayUsd",
  "shelfFeePerWeekUsd",
  "eventFeePerHourUsd",
  "guestFloorSqFt",
  "shelfLinearFt",
  "eventCapacity",
  "staffHoursPerActivation",
] as const satisfies readonly (keyof HostProfile)[];

const SOURCE_LABEL: Record<HostProfile["source"], { text: string; tone: string }> = {
  fictional_example: { text: "Fictional example host", tone: "bg-warn-soft text-warn" },
  host_response_link: { text: "Answered by the host", tone: "bg-ok-soft text-ok" },
  entered_by_guest: { text: "Entered by the guest · unconfirmed", tone: "bg-sunken text-ink-soft" },
  hypothetical_scenario: { text: "Hypothetical terms · not from the venue", tone: "bg-warn-soft text-warn" },
};

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .filter(([, x]) => x !== undefined)
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}

function windows(a: Availability | null) {
  if (a === null) return null;
  if (a.length === 0) return "None";
  return a.map((w) => `${DAY_LABELS[w.day].slice(0, 3)} ${clock(w.start)}–${clock(w.end)}`).join(", ");
}

type Provenance = ReturnType<typeof guestProvenance>;

/** A stated value, or a dashed "not provided" box; the source chip shows only where it differs from the column's usual source. */
function Cell({
  value,
  provenance,
  usual,
  hypothetical,
}: {
  value: React.ReactNode;
  provenance: Provenance;
  usual: Provenance | null;
  hypothetical?: boolean;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="inline-flex rounded-md border border-dashed border-line-strong px-2 py-0.5 text-sm text-ink-faint italic">Not provided</span>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={cn("text-sm text-ink", hypothetical && "decoration-warn/60 decoration-dashed underline-offset-4 [text-decoration-line:underline]")}>
        {value}
      </span>
      {provenance !== usual && <ProvenanceChip kind={provenance} />}
    </div>
  );
}

function usualOf(kinds: Provenance[]): Provenance | null {
  const counts = new Map<Provenance, number>();
  for (const k of kinds) if (k !== "unknown") counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function SideBySide({ guest, host }: { guest: GuestProfile; host: HostProfile }) {
  const g = (v: unknown) => guestProvenance(guest, v);
  const h = (v: unknown) => hostProvenance(host, v);
  const rows: { label: string; guest: [React.ReactNode, unknown]; host: [React.ReactNode, unknown] }[] = [
    {
      label: "Money",
      guest: [
        guest.maxOutlayUsd === null
          ? null
          : `Budget ${money(guest.maxOutlayUsd)}${guest.ownCostPerActivationUsd !== null ? `, own costs ${money(guest.ownCostPerActivationUsd)}` : ""}`,
        guest.maxOutlayUsd,
      ],
      host: [
        [
          host.popupFeePerDayUsd !== null && `Pop-up ${money(host.popupFeePerDayUsd)}/day`,
          host.shelfFeePerWeekUsd !== null && `shelf ${money(host.shelfFeePerWeekUsd)}/week`,
          host.eventFeePerHourUsd !== null && `event ${money(host.eventFeePerHourUsd)}/hour`,
        ]
          .filter(Boolean)
          .join(", ") || null,
        host.popupFeePerDayUsd ?? host.shelfFeePerWeekUsd ?? host.eventFeePerHourUsd,
      ],
    },
    { label: "Availability", guest: [windows(guest.availability), guest.availability], host: [windows(host.availability), host.availability] },
    {
      label: "Space",
      guest: [
        [guest.popupFootprintSqFt !== null && `${guest.popupFootprintSqFt} sq ft pop-up`, guest.shelfLinearFt !== null && `${guest.shelfLinearFt} ft shelf`]
          .filter(Boolean)
          .join(", ") || null,
        guest.popupFootprintSqFt ?? guest.shelfLinearFt,
      ],
      host: [
        [
          host.guestFloorSqFt !== null && `${host.guestFloorSqFt} sq ft floor`,
          host.shelfLinearFt !== null && `${host.shelfLinearFt} ft shelf`,
          host.eventCapacity !== null && `${host.eventCapacity} people`,
        ]
          .filter(Boolean)
          .join(", ") || null,
        host.guestFloorSqFt ?? host.shelfLinearFt ?? host.eventCapacity,
      ],
    },
    {
      label: "People",
      guest: [guest.staffCount === null ? null : `${guest.staffCount} team member${guest.staffCount === 1 ? "" : "s"}`, guest.staffCount],
      host: [host.staffHoursPerActivation === null ? null : `${host.staffHoursPerActivation} staff hours`, host.staffHoursPerActivation],
    },
    {
      label: "Formats",
      guest: [guest.acceptableFormats.map((f) => FORMAT_LABELS[f]).join(", "), guest.acceptableFormats],
      host: [host.allowedFormats?.map((f) => FORMAT_LABELS[f]).join(", ") || (host.allowedFormats ? "None" : null), host.allowedFormats],
    },
    {
      label: "Categories",
      guest: [guest.productCategories.map((c) => PRODUCT_CATEGORY_LABELS[c]).join(", "), guest.productCategories],
      host: [
        host.excludedCategories === null
          ? null
          : host.excludedCategories.length
            ? `Excludes ${host.excludedCategories.map((c) => PRODUCT_CATEGORY_LABELS[c].toLowerCase()).join(", ")}`
            : "No exclusions",
        host.excludedCategories,
      ],
    },
  ];
  const guestUsual = usualOf(rows.filter((r) => r.guest[0]).map((r) => g(r.guest[1])));
  const hostUsual = usualOf(rows.filter((r) => r.host[0]).map((r) => h(r.host[1])));
  const hypothetical = host.source === "hypothetical_scenario";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left">
        <caption className="sr-only">Guest and host inputs side by side</caption>
        <thead>
          <tr className="text-xs text-ink-faint">
            <th scope="col" className="w-28 pb-2 font-medium" />
            <th scope="col" className="pb-2 font-medium">
              <span className="flex flex-wrap items-center gap-1.5">
                <PartyTag party="guest" /> <span className="text-ink">{guest.businessName}</span>
                {guestUsual && <ProvenanceChip kind={guestUsual} />}
              </span>
            </th>
            <th scope="col" className="pb-2 font-medium">
              <span className="flex flex-wrap items-center gap-1.5">
                <PartyTag party="host" /> <span className="text-ink">{host.venueName || "Host"}</span>
                {hypothetical ? <span className="font-semibold text-warn">· hypothetical terms</span> : hostUsual && <ProvenanceChip kind={hostUsual} />}
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line align-top">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="py-3 pr-3 text-sm font-medium text-ink-soft">
                {r.label}
              </th>
              <td className="py-3 pr-4">
                <Cell value={r.guest[0]} provenance={g(r.guest[1])} usual={guestUsual} />
              </td>
              <td className={cn("py-3 pl-3", hypothetical && "bg-warn-soft/35")}>
                <Cell value={r.host[0]} provenance={h(r.host[1])} usual={hostUsual} hypothetical={hypothetical} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-ink-faint">
        The chip by each name says where that side's values came from; a cell shows its own chip only when it differs. A dashed box means nobody has stated it
        yet.{hypothetical ? " Shaded host values are hypothetical placeholders, not the venue's terms." : ""}
      </p>
    </div>
  );
}

function InvitePanel({ guest, host }: { guest: GuestProfile; host: HostProfile }) {
  const { state, dispatch } = useWorkspace();
  const config = useQuery({ queryKey: ["config"], queryFn: getConfig });
  const [formats, setFormats] = useState(guest.acceptableFormats);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState(state.research?.themes[0]?.title ?? "");
  const [copied, setCopied] = useState(false);
  const link = state.hostLink;

  const create = useMutation({
    mutationFn: () =>
      createHostLink({
        guestBusinessName: guest.businessName,
        productCategories: guest.productCategories,
        proposedFormats: formats.length ? formats : guest.acceptableFormats,
        venueName: host.venueName || "Your venue",
        venueCategory: host.venueCategory,
        ...(theme ? { culturalTheme: theme.slice(0, 160) } : {}),
        ...(message.trim() ? { message: message.trim().slice(0, 500) } : {}),
      }),
    onSuccess: (r) =>
      dispatch({
        type: "set_host_link",
        link: {
          requestId: r.requestId,
          ownerToken: r.ownerToken,
          hostUrl: `${window.location.origin}/respond#t=${r.hostToken}`,
          expiresAt: r.expiresAt,
          venueName: host.venueName,
        },
      }),
  });

  const status = useMutation({
    mutationFn: () => {
      if (!link) throw new Error("No link");
      return getOwnerView(link.requestId, link.ownerToken);
    },
  });

  if (config.data && !config.data.hostLinksEnabled) {
    return <Callout tone="warn" title="Private host links are not available on this server" />;
  }

  if (!link) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-ink-soft">
          Create a private link the venue can open to enter its own terms. The venue sees only what is listed below: never your budget, costs, priorities, or
          notes.
        </p>
        <div className="rounded-xl border border-line bg-paper/70 p-4 text-sm">
          <p>
            <span className="text-ink-faint">From:</span> {guest.businessName} ({guest.productCategories.map((c) => PRODUCT_CATEGORY_LABELS[c]).join(", ")})
          </p>
          <p className="mt-1">
            <span className="text-ink-faint">To:</span> {host.venueName || "the venue"}
          </p>
        </div>
        <Field label="Formats to propose">
          <ToggleChips options={FORMATS} labels={FORMAT_LABELS} value={formats} onChange={setFormats} ariaLabel="Formats to propose" tone="host" />
        </Field>
        <Field label="Collaboration theme" htmlFor="invite-theme" optional>
          <input id="invite-theme" className="input" maxLength={160} value={theme} onChange={(e) => setTheme(e.target.value)} />
        </Field>
        <Field label="Short message" htmlFor="invite-message" optional>
          <textarea id="invite-message" className="input min-h-20" maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        {create.error && <Callout tone="bad" title={create.error instanceof ApiRequestError ? create.error.message : "Could not create the link."} />}
        <Button variant="host" disabled={create.isPending || !host.venueName} onClick={() => create.mutate()}>
          <Link2 className="size-4" aria-hidden /> Create private link
        </Button>
      </div>
    );
  }

  const submitted = status.data?.status === "submitted" && status.data.host;
  return (
    <div className="space-y-5">
      <Callout tone="info" title="Send this link directly to the venue">
        Anyone with the link can answer as the host, so share it privately. It expires {new Date(link.expiresAt).toLocaleDateString()} and allows three edits.
        Room for Both never sends it for you.
      </Callout>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="host-link" className="sr-only">
          Private host link
        </label>
        <input id="host-link" readOnly className="input flex-1 font-mono text-xs" value={link.hostUrl} onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link.hostUrl);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => status.mutate()} disabled={status.isPending}>
          <RefreshCcw className="size-4" aria-hidden /> Check for the host's answers
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            await revokeHostLink(link.requestId, link.ownerToken).catch(() => undefined);
            dispatch({ type: "set_host_link", link: null });
            status.reset();
          }}
        >
          Withdraw link
        </Button>
      </div>
      <div aria-live="polite">
        {status.error && <Callout tone="bad" title={status.error instanceof ApiRequestError ? status.error.message : "Could not check the link."} />}
        {status.data && !submitted && <p className="text-sm text-ink-soft">No answers yet. The link is {status.data.status}.</p>}
        {submitted && status.data?.host && (
          <Callout tone="ok" title={`${status.data.host.venueName} has answered`}>
            <p>Their answers replace any values you entered on their behalf and are labelled as supplied by the host.</p>
            <Button className="mt-3" size="sm" variant="host" onClick={() => status.data?.host && dispatch({ type: "set_host", host: status.data.host })}>
              Use the host's answers
            </Button>
          </Callout>
        )}
      </div>
    </div>
  );
}

export function HostWorkspace() {
  const { state, dispatch } = useWorkspace();
  const [, navigate] = useLocation();
  const guest = state.guest;
  const host = state.host;
  const [tab, setTab] = useState<"answers" | "invite">(host?.source === "entered_by_guest" && !state.selection ? "invite" : "answers");
  if (!guest) return null;
  const current = host ?? BLANK_HOST;
  const source = SOURCE_LABEL[current.source];
  const linked = state.selection && host?.qlooEntityId === state.selection.candidate.venue.id.slice(0, 64) ? state.selection : null;
  const noTermsYet = linked !== null && current.source === "entered_by_guest" && HOST_TERM_KEYS.every((k) => current[k] === null);

  return (
    <div>
      <StepHeader step="host">
        Each side states its own terms. Nothing about the host is inferred from cultural data, and a missing answer stays unknown.
      </StepHeader>

      {linked && (
        <div className="mb-6">
          <SelectedVenuePanel selection={linked} />
        </div>
      )}

      {linked && current.source === "hypothetical_scenario" && (
        <Callout tone="warn" className="mb-6" title={`Hypothetical terms: ${current.venueName} has not stated or agreed to any of them`}>
          <p>
            Every host value below is a fictional placeholder for exploring the method. None describes the venue's real fees, schedule, space, or interest. Edit
            them, or ask the venue for its own answers through a private link.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() =>
              linked &&
              dispatch({
                type: "set_host",
                host: unknownHostFor({ id: linked.candidate.venue.id, name: linked.candidate.venue.name, category: linked.candidate.category }),
              })
            }
          >
            Clear the hypothetical terms
          </Button>
        </Callout>
      )}

      {noTermsYet && (
        <Card className="mb-6" aria-labelledby="terms-choice">
          <h2 id="terms-choice" className="text-lg font-semibold">
            No terms from {current.venueName} yet
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Cultural research cannot tell you the venue's terms. Choose how to continue:</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Button
              variant="secondary"
              className="h-auto flex-col items-start gap-1 p-4 text-left"
              onClick={() => dispatch({ type: "use_hypothetical_terms" })}
            >
              <span className="flex items-center gap-2 font-semibold">
                <FlaskConical className="size-4" aria-hidden /> Explore with hypothetical terms
              </span>
              <span className="text-xs font-normal text-ink-soft">Fictional placeholder terms, labelled on every screen.</span>
            </Button>
            <Button variant="secondary" className="h-auto flex-col items-start gap-1 p-4 text-left" onClick={() => setTab("answers")}>
              <span className="flex items-center gap-2 font-semibold">
                <PencilLine className="size-4" aria-hidden /> Enter terms the venue gave you
              </span>
              <span className="text-xs font-normal text-ink-soft">Marked as entered by you, unconfirmed by the venue.</span>
            </Button>
            <Button variant="secondary" className="h-auto flex-col items-start gap-1 p-4 text-left" onClick={() => setTab("invite")}>
              <span className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-4" aria-hidden /> Invite the venue privately
              </span>
              <span className="text-xs font-normal text-ink-soft">The venue states its own terms through a private link.</span>
            </Button>
          </div>
        </Card>
      )}

      {host && (
        <Card className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Side by side</h2>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", source.tone)}>{source.text}</span>
          </div>
          <SideBySide guest={guest} host={host} />
        </Card>
      )}

      {state.isExample && host?.source !== "fictional_example" && (
        <Callout tone="info" className="mb-6" title="Want the fictional host back?">
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => dispatch({ type: "set_host", host: EXAMPLE_HOST })}>
            Restore the fictional bookstore
          </Button>
        </Callout>
      )}

      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as "answers" | "invite")}>
        <Tabs.List aria-label="Host inputs" className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1">
          <Tabs.Trigger
            value="answers"
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft data-[state=active]:bg-host data-[state=active]:text-white"
          >
            Host's terms
          </Tabs.Trigger>
          <Tabs.Trigger
            value="invite"
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-ink-soft data-[state=active]:bg-host data-[state=active]:text-white"
          >
            <ShieldCheck className="size-4" aria-hidden /> Invite the host privately
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="answers">
          <HostForm
            key={JSON.stringify(current)}
            initial={current}
            mode={
              current.source === "fictional_example" || current.source === "hypothetical_scenario"
                ? "fictional"
                : current.source === "host_response_link"
                  ? "host_entry"
                  : "guest_entry"
            }
            submitLabel="Save host terms and compare"
            onSubmit={(h) => {
              // If the guest edits answers the host supplied, those values are no longer the host's own words.
              const edited = stableJson({ ...h, source: current.source }) !== stableJson(current);
              const nextSource = current.source === "host_response_link" && edited ? "entered_by_guest" : current.source;
              dispatch({ type: "set_host", host: { ...h, source: nextSource } });
              navigate(stepHref("frontier"));
            }}
          />
        </Tabs.Content>
        <Tabs.Content value="invite">
          <Card>
            <InvitePanel guest={guest} host={current} />
          </Card>
        </Tabs.Content>
      </Tabs.Root>

      <StepNav back="discovery" next="frontier" nextDisabled={!host} nextLabel="See the Agreement Frontier" />
    </div>
  );
}
