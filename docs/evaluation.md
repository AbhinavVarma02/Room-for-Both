# Evaluation

Room for Both is evaluated at four levels. All offline levels run in CI without credentials.

| Level | Command | What it shows |
|-------|---------|---------------|
| Unit | `npm test` | Every hard constraint, edge case, frontier rule, reversal property, schema bound, and monotonicity property |
| Integration | `npm run test:integration` | The real API against a local D1: validation, limits, streaming research against a synthetic Qloo, host-link access control, narrative guards |
| End to end | `npm run test:e2e` | Complete journeys in Chromium on desktop and a mobile viewport against the production build running in workerd, or against a deployed URL with `E2E_BASE_URL`. Journeys read the server mode and assert the labels that mode must show |
| Evaluation suite | `npm run eval` | 40 handcrafted cases with measured metrics, written to `docs/evaluation-results.md` |

## The evaluation suite

`tests/evaluation/cases.ts` holds 40 synthetic cases in three groups:

- **27 engine cases:** overlapping, touching, and missing schedules; fee and budget contradictions; unknown host
  permissions; staffing and capacity conflicts; non-negotiable clauses; category exclusions; dealbreakers;
  one-sided host data; edits that should and should not change a decision; frontier trade-offs and ties;
  adversarial text; extreme values.
- **9 research cases** run through the real planner with fault injection: normal run, no references,
  unresolvable reference, empty market, upstream timeout, rate limit, exhausted budget, instruction-like input,
  and malformed payloads.
- **4 language-model output cases:** one grounded draft and three that must be rejected (invented number,
  approval claim, link).

Metrics reported:

| Metric | Definition |
|--------|------------|
| Rule compliance | Hand-written expectations met, per case and per check |
| Unsupported-claim rate | Generated statements (explanations, requirements, suggested changes, questions, brief summary, value hypotheses) matching forecast or guarantee patterns |
| Numeric grounding | Numbers in generated statements that appear in the inputs or in arithmetic the engine reports. Small integers 0–24 (hours, days, lengths) are always accepted, which makes this check weaker for small numbers |
| Decision invariance | Whether attaching cultural research changes any feasibility verdict (it must not) |
| Upstream calls per research run | Calls counted by the transport, including retries |
| Engine latency | Wall time of `evaluateScenario`, 25 repetitions per engine case |

The latest offline results are in [`evaluation-results.md`](evaluation-results.md). To show the checks can
fail, we changed the budget rule from `≤` to `<` locally: the suite reported 38 of 40 cases passing (the
threshold edit case and the verified-reversal case failed). The change was reverted.

## Cultural layer versus a no-cultural-layer baseline

Both arms use the same scenarios and the same engine. The baseline builds the brief without research; the
cultural arm attaches one research run. Offline, that run uses fixture data, so the comparison only shows that
the pipeline attaches labelled evidence and never moves a decision. It says nothing about the quality of
Qloo's data.

## Live Qloo evaluation

`npm run eval -- --live` runs five fixed scenarios through the production planner against the live Qloo API
and prints aggregate metrics only; no response data is kept. It is a functional check on real data with a
deliberately small sample, not a statistical estimate of reliability. Latest run (17 October 2026, 22 calls):

| Scenario | References: exact / approx. / unmatched | Venues found | Scored / explained | Bridge | Evidence labelled *Observed in Qloo* | Calls | Time |
|----------|------------------|--------------|--------------------|--------|-----------------|-------|------|
| L1 product example: 3 references, Greenpoint then Brooklyn, bookstore | 3 / 0 / 0 | 5 (after widening) | 5 / 5 | Cross-domain books, plus recurring tags | 10 / 10 | 7 | 2.1 s |
| L2 brand reference, Portland, cafe | 1 / 0 / 0 | 5 | 5 / 5 | Cross-domain podcasts, plus recurring tags | 8 / 8 | 4 | 1.1 s |
| L3 brand-only reference, Brooklyn, bookstore | 1 / 0 / 0 | 5 | 5 / 5 | Taste tags (cross-domain books rejected by Qloo; fallback used) | 7 / 7 | 4 | 1.1 s |
| L4 a small-business name plus an artist, Chicago, record store | 1 / 1 / 0 | 5 | 5 / 5 | Cross-domain artists, plus recurring tags | 9 / 9 | 5 | 4.3 s |
| L5 no references, Austin, plant shop | none given | 5 | 0 / 0 (unscored without a signal, as designed) | Skipped (needs a reference) | 5 / 5 | 2 | 0.4 s |

Across the sample: every well-known reference resolved exactly; the small-business name stayed approximate and
was not used as a signal; venue discovery succeeded in 5 of 5 scenarios; every scored venue carried a
per-reference explanation; 39 of 39 evidence items were labelled as observed in Qloo; 0 of 114 upstream items
were dropped by the normaliser; and 0 generated statements matched the unsupported-claim patterns. Calls per
run were 2–7 (mean 4.4), within the budget of 7. The same week, the product example was also run through the
public deployment by the Playwright journey and `npm run verify:public`.

The first live runs exposed defects the synthetic upstream could not: HTML-escaped names, book subtitles that
blocked exact matches, null optional fields, a per-second rate limit hit by quick sequential calls, rejected
cross-domain lookups for brand-only references, demographic and format tags counted as taste signals, and two
venue categories with no exact Qloo tag. Each was fixed with a regression test built from synthetic payloads
shaped like the observed responses ([API](api.md#qloo-routes-used)).

### Optional language-model summary

`npm run smoke:gemini` makes two calls with `gemini-3.5-flash-lite` (free tier). Latest run: both drafts were
valid structured JSON and passed the output checks; about 245 prompt and 100 output tokens per call, no thinking
tokens, about 1.0–1.2 s each from a local machine and 6.4 s for one call through the public Worker. An instruction
injected into the facts was not followed. An early draft attributed a negotiable change to the wrong option, so
the system instruction now defines each fact field; the next draft attributed it correctly. Output quality is
not otherwise scored: the draft is labelled as a language-model interpretation and never replaces the
rule-based summary.

## Worker CPU on the Free plan

Measured with `wrangler tail` on the deployed Worker (`npm run measure:cpu -- <url>`, add `--demo` for
fictional research):

| Route | Mode | Requests | CPU time per request (ms) | Wall time (ms) |
|-------|------|----------|---------------------------|----------------|
| `POST /api/research` (product example, widened search) | Live, before optimisation | 3 | 18, 32, 57 | 1,910–2,182 |
| `POST /api/research` (same) | Live, after optimisation | 3 | 16, 24, 25 | 1,960–2,249 |
| `POST /api/research` (same) | Fictional demonstration, no upstream calls | 3 | 5, 13, 15 | 51–122 |
| `POST /api/evaluate` | Pure computation, no I/O | 15 | 2–25 (25 on the first request after a deploy; otherwise 2–12) | 2–27 |
| `GET /api/health` | — | 9 | 0–1 | 0–2 |

Cloudflare's analytics for the Worker (17 October 2026, all traffic since deployment, including the runs above):
183 requests, all successful, 0 errors, 0 terminated for CPU; CPU p50 4.1 ms, p90 13.6 ms, p99 57.7 ms.

Interpretation. A live run receives about 260 KB of JSON across seven calls. Replaying one recorded run locally in
Node costs about 1 ms warm (0.6 ms of it JSON parsing) and about 4 ms on a cold process after the optimisation, so
most of the deployed figure is first-use compilation in fresh isolates plus response handling, which a
low-traffic Worker pays on most requests. The optimisation replaced per-item schema parsing of about 1,500
nested tags per run with direct type checks (normalisation 0.61 ms to 0.07 ms warm in Node). Live research
still exceeds the nominal 10 ms. Cloudflare documents that isolates tolerate occasional overruns and terminate
Workers that exceed the limit consistently. No request has been terminated so far; if terminations appear in
the dashboard, the remedy is to split research into two bounded requests (references and category; then venues
and bridge), never a paid plan.

## Public deployment checks

Against https://room-for-both.room-for-both.workers.dev with live Qloo and summaries enabled:
`npm run verify:public` passed 10 of 10 checks, including a live research stream, and the Playwright suite
passed 24 of 24 (desktop and mobile), including the live journey, the fictional fallback after a simulated
credential rejection, and, run separately, the optional summary with a real draft.

## Not yet measured

- Live behaviour beyond five scenarios and a few cities; coverage in other markets is unknown.
- Long-run CPU under sustained public traffic.
- Any business outcome. No customer research has been conducted.
