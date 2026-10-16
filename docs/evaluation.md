# Evaluation

Room for Both is evaluated at four levels. All offline levels run in CI without credentials.

| Level | Command | What it shows |
|-------|---------|---------------|
| Unit | `npm test` | Every hard constraint, edge case, frontier rule, reversal property, schema bound, and monotonicity property |
| Integration | `npm run test:integration` | The real API against a local D1: validation, limits, streaming research against a synthetic Qloo, host-link access control, narrative guards |
| End to end | `npm run test:e2e` | Complete journeys in Chromium on desktop and a mobile viewport against the production build running in workerd |
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

A live comparison (`npm run eval -- --live`) makes three bounded research runs with an authorised credential
and records only aggregate counts in an ignored local file. **Status: not run**, pending a credential
(EXT-QLOO-KEY).

## Deployed Worker measurements

Measured with `wrangler tail` on the deployed Worker (Workers Free, fixture mode) across three sampling sessions
(`npm run measure:cpu -- <url>` reproduces this):

| Route | Requests | CPU time per request (ms) | Wall time (ms) |
|-------|----------|---------------------------|----------------|
| `POST /api/evaluate` | 15 | 2–21 (in the session that logged order: 21 for the first request, then 4–5) | 2–22 |
| `POST /api/research` (three references, widened search) | 9 | 3–18 | 34–102 |
| `GET /api/health` | 9 | 0–2 | 0–2 |

Every request completed with outcome `ok`; none was terminated. The spikes come from the first request a fresh
isolate serves: the JavaScript engine compiles each code path on first use. Profiling the same routes in Node shows
the first research request at about 29 ms and warm requests at 0.6 ms median (1.2 ms p95). Swapping Hono's router for
its linear router made no measurable difference, so the cost is not in our routing. Cloudflare documents that
isolates tolerate infrequent overruns of the 10 ms Free limit and terminate Workers that exceed it repeatedly. Warm
requests stay well under the limit, so we have not restructured the research flow.

Live Qloo payloads are larger than fixture payloads. A synthetic estimate sized after Qloo's documented examples
(about 450 KB across one run) adds roughly 1.4 ms warm and 6.5 ms cold for parsing and normalisation. This is an
estimate from synthetic data, not a measurement; CPU must be re-measured with real payloads. If live research
regularly exceeds the limit, the plan is to split it into two requests rather than upgrade.

The Playwright suite also passes against the public deployment (`E2E_BASE_URL=<url> npm run test:e2e`: 22 of 22),
and `npm run verify:public` passes every check except live Qloo mode.

## Not yet measured

- Live Qloo match rates, candidate counts, latency, and CPU time.
- Any business outcome. No customer research has been conducted.
