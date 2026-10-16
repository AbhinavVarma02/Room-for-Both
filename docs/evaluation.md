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

Measured with `wrangler tail` on the deployed Worker (Workers Free, fixture mode), small samples:

| Route | Requests | CPU time (ms) | Wall time (ms) |
|-------|----------|---------------|----------------|
| `POST /api/evaluate` | 5 | 2–5 | 3–6 |
| `POST /api/research` (three references, widened search) | 3 | 3–9 | 34–95 |
| `GET /api/health` | 3 | 0 | 0–1 |

All are inside the Free plan's 10 ms CPU limit, but research has little headroom. Live Qloo payloads are larger
than fixture payloads, so CPU time must be re-measured once live access is available. If it exceeds the limit, the
plan is to split research into two requests rather than upgrade.

The Playwright suite also passes against the public deployment (`E2E_BASE_URL=<url> npm run test:e2e`: 22 of 22),
and `npm run verify:public` passes every check except live Qloo mode.

## Not yet measured

- Live Qloo match rates, candidate counts, latency, and CPU time.
- Any business outcome. No customer research has been conducted.
