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
        <p className="mt-3">
          A venue chosen from cultural research starts with every term unknown. To explore before the venue answers, you can attach the fictional
          example's terms to it. They are labelled hypothetical on every screen and in the brief, and the venue has not seen or agreed to any of them.
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
        <p className="mt-3">
          <span className="font-medium text-ink">With and without the taste signal.</span> One more call repeats the same venue search with no
          references, ten venues deep, so you can see which venues the signal added or moved, and when it changed nothing. An optional, consented
          question to a language model with no Qloo data is shown beside it as a baseline; its venue names are only compared with the Qloo lists.
        </p>
        <p className="mt-3">
          <span className="font-medium text-ink">The venue's side.</span> When you choose a bookstore, record store, or cafe, one call uses the venue's
          own Qloo entity as the signal, in the same domain as your bridge. Items are matched by Qloo ID and tags by name; the two sides' scores are
          never combined. The strongest shared or guest-side items become an activation idea for the proposed format, which never enters a check.
        </p>
        <p className="mt-3">
          <span className="font-medium text-ink">How much each reference matters.</span> An optional check repeats the taste-informed search once per
          matched reference, each time without it. It reports whether the first choice, the list, or only the order changed, calls near-equal top
          scores a tie, and says when Qloo's explanation and the removal test disagree. A failed repeat is reported as not measured.
        </p>
        <p className="mt-3">
          <span className="font-medium text-ink">Ideas worth proposing.</span> Up to five ideas, each from a different slice of the evidence: titles
          both sides share, the venue's own side, the guest's side, taste tags, and the venue's stated interests. A fixed rule says which formats each
          idea suits; whether a format works comes only from the checks above. The first idea with a workable format is marked to discuss first.
        </p>
        <p className="mt-3">
          <span className="font-medium text-ink">Who plans the research.</span> Rules decide by default. With your consent, a language model may
          propose one action from a fixed list at two points: which domain to build the theme from, and whether to widen an empty search. The server
          checks every proposal against the list and the run's own facts before acting, and uses the rule's choice otherwise. Each decision shows who
          made it and why.
        </p>
      </Section>

      <Section title="What decides what">
        <ul className="list-disc space-y-2 pl-5">
          <li>Cultural opportunity, what might be worth trying: suggested by Qloo data. It picks the venue to approach and the theme to propose.</li>
          <li>Operational feasibility, what the stated terms permit: decided only by the deterministic checks above.</li>
          <li>Commercial success, whether it pays off: unknown. Nothing here forecasts revenue, traffic, or demand.</li>
        </ul>
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

      <Section title="Optional language-model features">
        <p>
          If the operator enables them, three features use Google's Gemini API, each only after you agree: a short plain-language summary of facts the
          engine already computed (drafts that add numbers, links, or claims of approval are discarded), the research planner's proposals (validated
          against a fixed list), and the language-model-only baseline. The planner and baseline see your cultural references, product categories,
          venue type, and area, never names, budgets, or terms. Model text is labelled {PROVENANCE_LABELS.llm_interpretation.toLowerCase()}.
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
