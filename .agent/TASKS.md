# Task register

Assignee: `agent` (automated engineering session), `human` (repository owner), `external` (third-party service).
States: `pending`, `in_progress`, `implemented_unverified`, `blocked_external`, `verified_complete`, `failed`.
Evidence references point to `.agent/PROGRESS.md` entries or commands that can be re-run.

Live Qloo and Gemini integration is verified and deployed (PROGRESS #7). Open: P7-08 (Worker CPU above the nominal
Free limit on live research, no terminations observed: monitor) and P10-03 (waits on the owner's Free-plan
confirmation, EXT-CF-PLAN, and a check of the credential email, EXT-QLOO-EMAIL). Optional: P6-09 (map view).
Scope is frozen again: only monitoring, defect fixes, and the post-credential transition in `.agent/NEXT.md`.

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
| P1-07 | GitHub Actions CI | P1-05, P1-06 | agent | verified_complete | workflow green on GitHub | runs 38995913094 (5bf47ef), 38997070624 (0e17b50): success; see STATE.json for the latest |
| P1-08 | README and MIT LICENSE | P0-04 | agent | verified_complete | files present | 9cbbc0d |
| P1-09 | Local dev server serves app + API | P1-02, P1-03 | agent | verified_complete | browser walkthrough | PROGRESS #3 |

## P2 — Qloo capability and adapter

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P2-01 | Verify Qloo routes, headers, fields, usage guidance | — | agent | verified_complete | `docs/api.md` | PROGRESS #2 |
| P2-02 | Client: trusted host, timeout, bounded retry, budget, breaker | P2-01 | agent | verified_complete | integration tests (synthetic upstream) | PROGRESS #2 |
| P2-03 | Normalisation with provenance | P2-02 | agent | verified_complete | integration tests | PROGRESS #2 |
| P2-04 | Original synthetic fixtures | P2-01 | agent | verified_complete | `tests/fixtures/qloo-fake.ts`, fixture transport | PROGRESS #2 |
| P2-05 | Live authenticated Qloo smoke test | P2-02, EXT-QLOO-KEY | agent | verified_complete | `npm run smoke:live` | host accepted on first probe; field check and bounded run pass (PROGRESS #7) |
| P2-06 | Align normaliser and planner with authenticated responses | P2-05 | agent | verified_complete | regression tests from synthetic payloads shaped like observed responses; live smoke + live eval | 5bf47ef, 0e17b50 (PROGRESS #7) |

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
| P4-05 | Optional Gemini prose with guards | P5-02 | agent | verified_complete | `npm run smoke:gemini` 2/2; public `/api/narrative` 200; e2e summary test 2/2 on public URL | PROGRESS #7 |
| P4-06 | Live research verified end to end | P4-03, EXT-QLOO-KEY | agent | verified_complete | live smoke + public verify + public e2e | verify:public 10/10, e2e 24/24 live (PROGRESS #7) |
| P4-07 | Labelled operating modes and fictional fallback on live failure | P4-04 | agent | verified_complete | integration (demo flag, auth message) + e2e (simulated rejection) | 5bf47ef (PROGRESS #7) |

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
| P7-05 | Live Qloo evaluation | P7-04, EXT-QLOO-KEY | agent | verified_complete | `npm run eval -- --live` (5 fixed scenarios) | docs/evaluation.md; PROGRESS #7 |
| P7-06 | Playwright desktop + mobile | P6-07 | agent | verified_complete | `npm run test:e2e` 22/22 | PROGRESS #3, #6 |
| P7-07 | Full offline check green | all | agent | verified_complete | `npm run check` exit 0 | PROGRESS #3 |
| P7-08 | Worker CPU within the Free plan | P8-06 | agent | implemented_unverified | `npm run measure:cpu`; Cloudflare analytics | live research 16–25 ms after optimisation (nominal limit 10 ms); 0 CPU terminations in 183 requests; remedy if terminations appear: split research into two requests (PROGRESS #7) |

## P8 — GitHub and public deployment

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P8-01 | GitHub access | — | human | verified_complete | push succeeded | owner-created repo; GCM credentials |
| P8-02 | Push to public repo AbhinavVarma02/Room-for-Both | P8-01 | agent | verified_complete | `git ls-remote origin main` | see STATE.json `last_remote_sha` |
| P8-03 | Cloudflare login | — | human | verified_complete | `npx wrangler whoami` | PROGRESS #4 |
| P8-04 | D1 create + remote migrations | P8-03 | agent | verified_complete | migrations apply --remote | PROGRESS #4 |
| P8-05 | Worker secrets | P8-03, EXT-QLOO-KEY | agent | verified_complete | `wrangler secret list` (names only) | QLOO_API_KEY, QLOO_BASE_URL, GEMINI_API_KEY, GEMINI_MODEL set by `secret bulk` from stdin; CLIENT_KEY_SALT preserved (PROGRESS #7) |
| P8-06 | Deploy + anonymous external smoke | P8-04, P8-05 | agent | verified_complete | `npm run verify:public` | live mode 10/10; e2e 24/24 on public URL (PROGRESS #7) |

## P9 — Documentation

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P9-01 | README | P6-07 | agent | verified_complete | links checked | 9cbbc0d; public URL present (PROGRESS #6) |
| P9-02 | `docs/` set | P7-04 | agent | verified_complete | files present | 9cbbc0d |
| P9-03 | Licence audit, OG metadata | P9-01 | agent | verified_complete | bundled licence file; audit in PROGRESS #3 | 283c005 |
| P9-04 | Private handoff packet in `.local/` | P9-02 | agent | verified_complete | file exists, ignored | updated with live results (PROGRESS #7) |
| P9-05 | Licensing, operating modes, credential lifecycle docs | P4-07 | agent | verified_complete | `docs/data-licensing.md`, deployment rotation and rollback sections | PROGRESS #7 |

## P10 — Release audit

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P10-01 | Sweep blocked tasks | all | agent | verified_complete | BLOCKERS updated | PROGRESS #6 |
| P10-02 | Clean install, full check, scans | all | agent | verified_complete | `npm run check`, e2e, `scan:secrets` | PROGRESS #3 |
| P10-03 | Final audit and release state | P10-02 | agent | blocked_external | STATE.json | live release verified; waits on EXT-CF-PLAN and EXT-QLOO-EMAIL (owner checks) |
