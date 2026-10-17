# Limitations

Room for Both is decision support. Its answers are only as good as the inputs and the rules below.

## Decision model

- Three collaboration formats at fixed lengths. Other structures (revenue share, consignment, residencies,
  multi-venue tours) are not modelled.
- Twelve constraint types. Payment terms, restocking, insurance, liability, permits, accessibility, and
  contracts are out of scope and listed as questions to resolve directly.
- Availability is weekly windows in whole hours. Specific dates, holidays, and one-off closures are not modelled.
- "Feasible" means feasible on the stated requirements. It is never an agreement or an approval.
- Minimal changes are minimal among the candidate changes generated for each failed check, not a global
  optimum over every possible edit.
- Priorities are ordinal. The frontier never weighs one party's gain against the other's.
- Value statements in the brief are hypotheses tied to stated goals, not forecasts.

## Cultural research

- Results depend on Qloo's coverage of a market and venue category. Small, new, or unusual venues may be missing.
  Live examples: no bookstores were returned for Greenpoint (the planner widened to Brooklyn), and a Brooklyn
  query also returned a Manhattan store. Addresses are always shown so the visitor can check.
- Large, well-known venues and chains can rank highly because Qloo's results reflect overall popularity as
  well as affinity. Small independent venues may appear lower or not at all.
- A small business entered by name is usually not in Qloo; it then stays an approximate or unmatched
  reference and is not used as a signal. Well-known cultural references work best.
- Cross-domain pairings are not available for every reference type (a brand-only reference returned no books);
  the bridge then falls back to taste tags and says so.
- Only exact matches are used as signals. Approximate matches are disclosed and excluded, which can reduce
  coverage for unusual names.
- Affinity is relative to each query and describes aggregate taste. It says nothing about foot traffic, sales,
  rent, permissions, or a venue's interest in partnering.
- Venue categories are matched to Qloo tags by name at runtime. Two labels have no exact Qloo tag and search
  the nearest category instead ("Clothing boutique" as "Clothing store", "Plant shop" as "Plant nursery"),
  which is disclosed. If no tag matches exactly, venue discovery is skipped rather than guessed.
- Without a configured credential, or when the visitor chooses the demonstration, every cultural result is
  fictional and labelled as such.
- Live access currently relies on a time-limited Qloo credential; after it ends, live discovery stops until
  separately authorised access is obtained ([data sources and licensing](data-licensing.md)).

## Operations

- Built for the Cloudflare Workers Free plan: 100,000 requests a day, 10 ms CPU per request, 50 subrequests,
  and D1 Free's daily read and write allowances. Heavy public use would hit these limits; the app degrades by
  refusing new research runs rather than upgrading.
- A live research run uses 16–25 ms of CPU on the deployed Worker, above the nominal 10 ms. Cloudflare allows
  isolates to run over occasionally, and no request has been terminated so far (see
  [evaluation](evaluation.md#worker-cpu-on-the-free-plan)), but sustained public traffic could trigger
  termination. The planned remedy is to split research into two bounded requests, never a paid plan.
- The live Qloo allowance is 10,000 calls a month. At up to 7 calls per run and a 300-call daily ceiling,
  about 40 live runs a day are possible; after that, visitors are offered the fictional demonstration.
- Rate limits are per Cloudflare location and fixed windows; they are approximate, not exact accounting.
- Host links are bearer links: anyone who has one can answer as the host until it expires or is withdrawn.

## Evaluation

- The evaluation cases were written by the same team that wrote the engine. They show the rules behave as
  documented; they are not independent validation of business value.
- The cultural-layer comparison in `docs/evaluation-results.md` uses fixture data and measures pipeline
  mechanics only. The live sample in `docs/evaluation.md` is five fixed scenarios: it shows the integration
  works on real data, not statistical reliability.
- No customer research has been run; no time or money savings are claimed.
