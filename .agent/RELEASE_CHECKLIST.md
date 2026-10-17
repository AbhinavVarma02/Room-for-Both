# Release checklist

Each row: `verified`, `at_risk`, `blocked`, or `not_yet_tested`, with evidence. PROGRESS #7 holds the live evidence.

## Functional

| Gate | Status | Evidence |
|------|--------|----------|
| Real Qloo authentication succeeds | verified | `npm run smoke:live`: accepted on the first probe |
| Authorised Qloo host identified | verified | Host named in Qloo's developer guide for the credential; set as `QLOO_BASE_URL` (value kept out of Git) |
| Actual API response structures validated | verified | Field lists from authenticated responses (docs/api.md); 0/114 items dropped in the live evaluation; regression tests from synthetic payloads |
| Live cultural discovery works | verified | Live evaluation 5/5 scenarios found venues; public `verify:public` live research stream; public e2e journey |
| Provenance distinguishes real and fictional information | verified | 39/39 live evidence items `qloo_observed`; e2e asserts live labels, and fictional labels after the fallback |
| Two-sided workflow, Agreement Frontier, Decision Reversal, briefs | verified | Public e2e 24/24 (desktop and mobile); eval 40/40 |
| Gemini live generation works | verified | `npm run smoke:gemini` 2/2; public `/api/narrative` 200; public e2e summary test 2/2 |
| No unsupported business claims | verified | Offline 0/3157 statements flagged; live sample 0 flagged; Gemini output checks |

## Engineering

| Gate | Status | Evidence |
|------|--------|----------|
| Unit, integration, evaluation | verified | `npm run check` exit 0: 69 unit, 49 integration, eval 40/40 (60/60 checks) |
| Typecheck, lint, build | verified | `npm run check` |
| Desktop and mobile Playwright (local, live mode) | verified | `npx playwright test` 24/24 |
| Public live end-to-end | verified | `E2E_BASE_URL=<url> npx playwright test` 24/24, plus the summary test 2/2 |
| GitHub CI | verified | Runs 38995913094 (5bf47ef) and 38997070624 (0e17b50) success; latest in STATE.json |
| Secret scan | verified | `npm run scan:secrets` clean, including exact local secret values; no key in the client assets or Worker bundle |
| Production deployment verified | verified | `npm run verify:public` 10/10 including live mode |
| Worker performance on the authorised plan | at_risk | Live research 16–25 ms CPU against a nominal 10 ms; Cloudflare analytics: 0 CPU terminations in 183 requests; remedy planned (BLOCKERS RISK-CPU) |

## Compliance and operations

| Gate | Status | Evidence |
|------|--------|----------|
| Time-limited credential documented | verified | docs/data-licensing.md, README |
| Direct server-side API use authorised | verified (by documentation) | Qloo's developer guide for the credential documents direct HTTPS with `X-Api-Key` (ADR-010); owner to confirm the email adds nothing (EXT-QLOO-EMAIL) |
| Authorised-use period known | verified (by documentation), owner check open | Guide: keys stay active through the end of the programme's review period, then are deactivated; EXT-QLOO-EMAIL |
| No unauthorised post-credential use planned | verified | NEXT.md "When the Qloo credential ends"; no Qloo data stored to reuse |
| $0 infrastructure | blocked | No paid resources configured; Gemini project has billing disabled; Cloudflare plan confirmation open (EXT-CF-PLAN) |
| Credential handling | verified | Secrets installed from stdin; names-only listings; no values in Git, logs, bundles, or responses |
| Open-source licence | verified | MIT, detected by GitHub |
| Private entry packet | verified | `.local/external-entry-packet.md` updated (git-ignored) |
| Post-credential fallback implemented and verified | verified | Fixture mode and visitor-selected demonstration; e2e simulated rejection test passes locally and publicly |

## Known limitations
See `docs/limitations.md`.
