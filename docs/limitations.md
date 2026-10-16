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
- Only exact matches are used as signals. Approximate matches are disclosed and excluded, which can reduce
  coverage for unusual names.
- Affinity is relative to each query and describes aggregate taste. It says nothing about foot traffic, sales,
  rent, permissions, or a venue's interest in partnering.
- Venue categories are matched to Qloo tags by name at runtime. If no tag matches exactly, venue discovery is
  skipped rather than guessed.
- Without a configured credential the app runs in fixture mode, and every cultural result is fictional.
- Whether direct server-side API access is permitted for a given Qloo credential depends on that credential's
  terms; operators should confirm this with Qloo.

## Operations

- Built for the Cloudflare Workers Free plan: 100,000 requests a day, 10 ms CPU per request, 50 subrequests,
  and D1 Free's daily read and write allowances. Heavy public use would hit these limits; the app degrades by
  refusing new research runs rather than upgrading.
- Rate limits are per Cloudflare location and fixed windows; they are approximate, not exact accounting.
- Host links are bearer links: anyone who has one can answer as the host until it expires or is withdrawn.

## Evaluation

- The evaluation cases were written by the same team that wrote the engine. They show the rules behave as
  documented; they are not independent validation of business value.
- The cultural-layer comparison in `docs/evaluation-results.md` uses fixture data and measures pipeline
  mechanics only. A live comparison requires an authorised Qloo credential.
- No customer research has been run; no time or money savings are claimed.
