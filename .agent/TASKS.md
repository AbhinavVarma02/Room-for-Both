# Task register

Assignee: `agent` (automated engineering session), `human` (repository owner), `external` (third-party service).
States: `pending`, `in_progress`, `implemented_unverified`, `blocked_external`, `verified_complete`, `failed`.
Evidence references point to `.agent/PROGRESS.md` entries or commands that can be re-run.

Release-critical open work: P2-05, P4-06, P7-05, P7-08 (live), P8-05, P8-06 (live), P10-03, all waiting on the Qloo
credential. Optional and not release-critical: P4-05 (Gemini narrative, live check) and P6-09 (map view).
Scope is frozen: no new features until the live Qloo steps in `.agent/NEXT.md` are done.

## P0 — Bootstrap and recovery

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P0-01 | Inspect workspace, detect tools and auth | — | agent | verified_complete | tool list recorded | PROGRESS #1 |
| P0-02 | `.gitignore`, `.gitattributes`, `git init -b main` | P0-01 | agent | verified_complete | `git status` | PROGRESS #1 |
| P0-03 | `CLAUDE.md` and `.agent/` ledger | P0-02 | agent | verified_complete | files present, JSON valid | PROGRESS #1 |
| P0-04 | First commit | P0-03 | agent | verified_complete | `git log` | c2cba9f |

## P1 — Scaffold

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P1-01 | `package.json`, strict TS config, lockfile | P0-04 | agent | verified_complete | `npm run typecheck` | PROGRESS #3 |
| P1-02 | React + Vite + Tailwind client | P1-01 | agent | verified_complete | `npm run build`, e2e | PROGRESS #3 |
| P1-03 | Hono Worker, `/api/health`, SPA assets | P1-01 | agent | verified_complete | integration + e2e | PROGRESS #2 |
| P1-04 | Shared Zod schemas | P1-01 | agent | verified_complete | schema tests | PROGRESS #2 |
| P1-05 | ESLint | P1-01 | agent | verified_complete | `npm run lint` | PROGRESS #3 |
| P1-06 | Vitest unit + integration | P1-01 | agent | verified_complete | `npm test`, `npm run test:integration` | PROGRESS #3 |
| P1-07 | GitHub Actions CI | P1-05, P1-06 | agent | verified_complete | workflow green on GitHub | runs 38852228902 … 38855382520 (latest, 27a2ad6) |
| P1-08 | README and MIT LICENSE | P0-04 | agent | verified_complete | files present | 9cbbc0d |
| P1-09 | Local dev server serves app + API | P1-02, P1-03 | agent | verified_complete | browser walkthrough | PROGRESS #3 |

## P2 — Qloo capability and adapter

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P2-01 | Verify Qloo routes, headers, fields, usage guidance | — | agent | verified_complete | `docs/api.md` | PROGRESS #2 |
| P2-02 | Client: trusted host, timeout, bounded retry, budget, breaker | P2-01 | agent | verified_complete | integration tests (synthetic upstream) | PROGRESS #2 |
| P2-03 | Normalisation with provenance | P2-02 | agent | verified_complete | integration tests | PROGRESS #2 |
| P2-04 | Original synthetic fixtures | P2-01 | agent | verified_complete | `tests/fixtures/qloo-fake.ts`, fixture transport | PROGRESS #2 |
| P2-05 | Live authenticated Qloo smoke test | P2-02, EXT-QLOO-KEY | agent | blocked_external | `npm run smoke:live` | prints BLOCKED (no key) |

## P3 — Two-sided inputs and deterministic constraints

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P3-01 | Guest/Host/Scenario contracts | P1-04 | agent | verified_complete | schema tests | PROGRESS #2 |
| P3-02 | Arrangement templates | P3-01 | agent | verified_complete | unit tests | PROGRESS #2 |
| P3-03 | Hard-constraint evaluation | P3-02 | agent | verified_complete | unit tests | PROGRESS #2 |
| P3-04 | Edge cases, adversarial input | P3-03 | agent | verified_complete | unit tests + eval | PROGRESS #3 |
| P3-05 | `/api/evaluate` | P3-03, P1-03 | agent | verified_complete | integration tests | PROGRESS #2 |
| P3-06 | Host response link (hashed, expiring, scoped) | P3-01, P1-03 | agent | verified_complete | integration + e2e (local D1) | PROGRESS #3 |

## P4 — Cultural bridge and bounded orchestration

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P4-01 | Research planner, tool registry, call budget | P2-02 | agent | verified_complete | integration + eval (synthetic) | PROGRESS #2 |
| P4-02 | Exact-match policy, weak-coverage fallback | P4-01 | agent | verified_complete | integration + eval | PROGRESS #2 |
| P4-03 | Cultural bridge themes and shared tags | P4-02 | agent | verified_complete | integration (synthetic) | PROGRESS #2 |
| P4-04 | Visibly labelled fixture mode | P4-01 | agent | verified_complete | e2e asserts labels | PROGRESS #3 |
| P4-05 | Optional Gemini prose with guards | P5-02 | agent | implemented_unverified | integration with fake model passes; live model untested | EXT-GEMINI-KEY (optional) |
| P4-06 | Live research verified end to end | P4-03, EXT-QLOO-KEY | agent | blocked_external | live smoke + public verify | — |

## P5 — Agreement Frontier and Decision Reversal

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P5-01 | Frontier enumeration + non-dominance | P3-03 | agent | verified_complete | unit tests | PROGRESS #2 |
| P5-02 | Reversal thresholds, verified minimal change | P5-01 | agent | verified_complete | unit tests | PROGRESS #2 |
| P5-03 | Question ranking | P5-02 | agent | verified_complete | unit tests | PROGRESS #2 |
| P5-04 | Decision trace | P5-02 | agent | verified_complete | unit + e2e | PROGRESS #3 |
| P5-05 | Monotonicity, ties, non-negotiable, adversarial | P5-02 | agent | verified_complete | unit + eval | PROGRESS #3 |

## P6 — Product UX

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P6-01 | Landing and fictional example | P1-02 | agent | verified_complete | e2e | PROGRESS #3 |
| P6-02 | Guest intake form | P3-01 | agent | verified_complete | e2e | PROGRESS #3 |
| P6-03 | Discovery with provenance and states | P4-01 | agent | verified_complete | e2e (fixture mode) | PROGRESS #3 |
| P6-04 | Two-sided workspace | P3-01 | agent | verified_complete | e2e | PROGRESS #3 |
| P6-05 | Agreement Frontier screen | P5-01 | agent | verified_complete | e2e | PROGRESS #3 |
| P6-06 | Decision Reversal screen | P5-02 | agent | verified_complete | e2e | PROGRESS #3 |
| P6-07 | Brief, print, JSON export | P5-03 | agent | verified_complete | e2e (download) | PROGRESS #3 |
| P6-08 | Methodology, errors, not-found | P6-01 | agent | verified_complete | e2e | PROGRESS #3 |
| P6-09 | Optional map | P4-03 | agent | pending | — | Not shipped; list-only view is the supported fallback |
| P6-10 | Mobile and keyboard | P6-07 | agent | verified_complete | e2e mobile project, skip-link test | PROGRESS #3 |

## P7 — Security, performance, evaluation

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P7-01 | Headers, body limits, safe errors | P1-03 | agent | verified_complete | integration tests | PROGRESS #2 |
| P7-02 | Rate limits and quota ceilings | P4-01 | agent | verified_complete | integration tests (local D1) | PROGRESS #3 |
| P7-03 | Structured privacy-safe logs | P1-03 | agent | verified_complete | code review; redaction filter | PROGRESS #2 |
| P7-04 | ≥30 evaluation cases + metrics | P5-03 | agent | verified_complete | `npm run eval` 40/40 | PROGRESS #3 |
| P7-05 | Live Qloo vs baseline comparison | P7-04, EXT-QLOO-KEY | agent | blocked_external | `npm run eval -- --live` | offline mechanics comparison done |
| P7-06 | Playwright desktop + mobile | P6-07 | agent | verified_complete | `npm run test:e2e` 22/22 | PROGRESS #3, #6 |
| P7-07 | Full offline check green | all | agent | verified_complete | `npm run check` exit 0 | PROGRESS #3 |
| P7-08 | Worker CPU time measured on deployment | P8-06 | agent | implemented_unverified | `wrangler tail` | fixture mode measured (evaluate 2–21 ms, research 3–18 ms; first request on a fresh isolate highest); live pending |

## P8 — GitHub and public deployment

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P8-01 | GitHub access | — | human | verified_complete | push succeeded | owner-created repo; GCM credentials |
| P8-02 | Push to public repo AbhinavVarma02/Room-for-Both | P8-01 | agent | verified_complete | `git ls-remote origin main` | origin/main == 27a2ad6 (PROGRESS #6) |
| P8-03 | Cloudflare login | — | human | verified_complete | `npx wrangler whoami` | PROGRESS #4 |
| P8-04 | D1 create + remote migrations | P8-03 | agent | verified_complete | migrations apply --remote | PROGRESS #4 |
| P8-05 | Worker secrets | P8-03, EXT-QLOO-KEY | human | blocked_external | `wrangler secret list` | CLIENT_KEY_SALT set; QLOO_API_KEY pending approval |
| P8-06 | Deploy + anonymous external smoke | P8-04, P8-05 | agent | implemented_unverified | `npm run verify:public` | fixture mode 9/10 (PROGRESS #4, #6), e2e 22/22 on public URL; live mode pending |

## P9 — Documentation

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P9-01 | README | P6-07 | agent | verified_complete | links checked | 9cbbc0d; public URL present (PROGRESS #6) |
| P9-02 | `docs/` set | P7-04 | agent | verified_complete | files present | 9cbbc0d |
| P9-03 | Licence audit, OG metadata | P9-01 | agent | verified_complete | bundled licence file; audit in PROGRESS #3 | 283c005 |
| P9-04 | Private handoff packet in `.local/` | P9-02 | agent | verified_complete | file exists, ignored | `git check-ignore` confirms; URLs filled (PROGRESS #6) |

## P10 — Release audit

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P10-01 | Sweep blocked tasks | all | agent | verified_complete | BLOCKERS updated | PROGRESS #6 |
| P10-02 | Clean install, full check, scans | all | agent | verified_complete | `npm run check`, e2e, `scan:secrets` | PROGRESS #3 |
| P10-03 | Final audit and release state | P10-02 | agent | blocked_external | STATE.json | ready_except_external_dependencies |
