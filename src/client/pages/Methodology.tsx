import { FORMAT_LABELS } from "@shared/constants/vocabulary";
import { ARRANGEMENT_TEMPLATES } from "@shared/domain/arrangements";
import { PROVENANCE_KINDS, PROVENANCE_LABELS } from "@shared/schemas/common";
import { ProvenanceChip, StatusBadge } from "../components/ui/primitives";

const CHECKS = [
  ["Guest accepts this format", "The guest listed the format as acceptable."],
  ["Host allows this format", "The host listed the format. Unknown if the host has not said."],
  ["Fits the guest's total budget", "Host fee for the option plus the guest's own costs is at most the guest's budget. Whole dollars, exact arithmetic."],
  ["Meets the host's minimum length", "Shelf weeks or event hours meet the host's stated minimum."],
  ["Shared time available", "Pop-ups and events need one window where both parties are free for the full length. Touching windows do not overlap."],
  ["Space fits", "Pop-up footprint and shelf length fit what the host offers; an event room holds the guest's minimum audience, if one is set."],
  ["Host staff time", "A co-hosted event needs host staff for its full length."],
  ["Guest can staff it", "Pop-ups and events need at least one guest team member on site."],
  ["Product category permitted", "None of the guest's product categories is on the host's exclusion list."],
  ["Sampling permitted", "Only if the guest plans in-person samples during a pop-up or event."],
  ["Guest conditions", "Alcohol on premises and exclusivity clauses, when the guest has ruled them out."],
] as const;

export function Methodology() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Method, data use & limits</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">How Room for Both reaches a decision</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Room for Both is decision support for two businesses considering a collaboration. It checks proposals against what each side actually said,
        shows what is unknown, and finds the smallest changes that would make a blocked option workable. It does not predict sales or approve deals.
      </p>

      <Section title="Two sides, two sets of inputs">
        <p>
          The guest (the brand looking for a partner) and the host (the venue) each state their own terms. A scenario is called two-sided only when the
          host's values come from the host, through a private response link, or when both profiles are clearly marked as fictional examples. If a
          guest types in what they believe the host wants, the analysis says so and treats it as unconfirmed.
        </p>
      </Section>

      <Section title="Arrangement templates">
        <p>Three collaboration formats are checked, each at a small fixed set of lengths. Templates contain no prices, spaces, or schedules of their own.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-2 pr-4 font-medium">Format</th>
                <th className="py-2 pr-4 font-medium">Lengths compared</th>
                <th className="py-2 font-medium">Structural assumptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ARRANGEMENT_TEMPLATES.map((t) => (
                <tr key={t.format} className="align-top">
                  <td className="py-3 pr-4 font-medium">{FORMAT_LABELS[t.format]}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {t.variants.join(", ")} {t.unit}
                  </td>
                  <td className="py-3 text-ink-soft">{t.assumptions.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Hard constraints">
        <p>Every option is run through the same deterministic checks. Each check reports pass, fail, unknown, or not applicable, with the exact inputs it used.</p>
        <dl className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {CHECKS.map(([name, rule]) => (
            <div key={name} className="grid gap-1 p-3 sm:grid-cols-[14rem_1fr]">
              <dt className="font-medium">{name}</dt>
              <dd className="text-ink-soft">{rule}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-2">
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge status="feasible" /> every check passes or does not apply.
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge status="conditional" /> nothing fails, but at least one input is missing.
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge status="no_go" /> at least one check fails on the stated inputs.
          </p>
        </div>
      </Section>

      <Section title="Agreement Frontier">
        <p>
          Each party may rank what matters to them (for the guest: lower outlay, fewer staff hours, more customer-facing hours; for the host: a higher
          fee, fewer staff hours). Among options that are not no-go, we highlight those that no other option beats on every stated priority. This is
          Pareto-style dominance over the parties' own rankings. It never adds the two parties' gains together, so it makes no claim about economic
          optimality, and it does not apply when neither side states priorities.
        </p>
      </Section>

      <Section title="Decision Reversal">
        <p>
          For every no-go option we list, per failed check, the changes that would make it pass: an exact budget, rate, footprint, or staff-hour
          threshold, an extended or added time window, or a dropped condition. We pick the smallest negotiable change for each failed check, apply them
          together, and re-run the same evaluation to confirm the option is no longer blocked. Only verified combinations are shown. Fields a party
          marks as non-negotiable are never suggested.
        </p>
        <p className="mt-3">
          Open questions are ranked by observable decision sensitivity: first the inputs that alone stand between an option and a clear answer, then
          by how many options depend on them. This is a count, not a probability or a value-of-information estimate.
        </p>
      </Section>

      <Section title="Cultural research with Qloo">
        <p>
          When the server holds a Qloo credential, a bounded research run makes at most a fixed number of calls: it matches up to three cultural
          references to Qloo entities, matches the venue category to a Qloo tag, ranks venues in the market by affinity to the matched references
          (widening from neighbourhood to city if needed), and asks Qloo what else the references' audience connects with. Only exact matches are used
          as signals; approximate matches are disclosed and left out.
        </p>
        <p className="mt-3">
          Affinity scores are shown as Qloo documents them: relative to the query, with above 0.8 read as very high, 0.6–0.8 as high, and lower values
          as weaker. They describe aggregate taste associations. They are not foot traffic, sales, rent, permission, or proof that a venue wants to
          partner. Without a credential, the app runs in a clearly labelled fixture mode with fictional data.
        </p>
        <p className="mt-3">
          Live access uses a time-limited Qloo credential. If Qloo rejects it or is unavailable, the app says so and offers the fictional
          demonstration instead; a run is always entirely live or entirely fictional, and its label follows it into the brief. Qloo results are
          shown to you and kept in your browser, not stored by Room for Both's server.
        </p>
      </Section>

      <Section title="Provenance labels">
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {PROVENANCE_KINDS.map((k) => (
            <li key={k} className="flex items-center gap-2">
              <ProvenanceChip kind={k} />
              <span className="text-sm text-ink-soft">
                {
                  {
                    qloo_observed: "returned by Qloo in this run",
                    party_supplied: "entered by the guest or host",
                    synthetic_demo: "invented for the fictional example",
                    derived_rule: "computed by a stated rule",
                    llm_interpretation: "drafted by a language model",
                    unknown: "not provided yet",
                  }[k]
                }
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-faint">Labels never upgrade: generated prose cannot turn an assumption into an observation.</p>
      </Section>

      <Section title="Optional language-model summary">
        <p>
          If the operator enables it, you can ask for a short plain-language summary drafted by Google's Gemini API. It only ever sees facts the engine
          already computed, you must agree before anything is sent, and drafts that add numbers, links, or claims of approval are discarded.
          Summaries are labelled {PROVENANCE_LABELS.llm_interpretation.toLowerCase()}.
        </p>
      </Section>

      <Section title="Data use and privacy">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your workspace stays in your browser's local storage. Clear it any time with “Start over”.</li>
          <li>
            Research requests send your cultural references, city, and venue category to Room for Both's server, which queries Qloo. Your budget and
            other terms are not sent to Qloo.
          </li>
          <li>
            A host response link stores only what you choose to share, the host's answers, and hashes of the link tokens. Links expire after seven
            days, allow three edits, and can be withdrawn at any time.
          </li>
          <li>Rate limits use a daily-rotating hash of your connection, never your raw address. Server logs contain no request contents.</li>
          <li>Room for Both never contacts a business for you.</li>
        </ul>
      </Section>

      <Section title="Limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>The model covers the constraints listed above. Insurance, liability, restocking, payment terms, and contracts are out of scope.</li>
          <li>Availability is weekly windows in whole hours; holidays and specific dates must be agreed directly.</li>
          <li>Venue candidates depend on Qloo's coverage of a market and category; small or new venues may be missing.</li>
          <li>A feasible option is feasible on stated requirements only. It is not an agreement until both businesses say so.</li>
        </ul>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-3 leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}
