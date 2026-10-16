# Task register

Assignee: `agent` (automated engineering session), `human` (repository owner), `external` (third-party service).
States: `pending`, `in_progress`, `implemented_unverified`, `blocked_external`, `verified_complete`, `failed`.
Evidence references point to `.agent/PROGRESS.md` entries or commands that can be re-run.

## P0 — Bootstrap and recovery

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P0-01 | Inspect workspace, detect tools and auth | — | agent | verified_complete | folder empty; tool list recorded | PROGRESS #1 |
| P0-02 | `.gitignore`, `.gitattributes`, `git init -b main` | P0-01 | agent | verified_complete | `git status` works | PROGRESS #1 |
| P0-03 | `CLAUDE.md` and `.agent/` ledger | P0-02 | agent | verified_complete | files present and valid JSON | PROGRESS #1 |
| P0-04 | First commit | P0-03 | agent | pending | `git log` shows commit | |

## P1 — Scaffold

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P1-01 | `package.json`, strict TS config, committed lockfile | P0-04 | agent | pending | `npm ci` succeeds | |
| P1-02 | React + Vite + Tailwind client shell | P1-01 | agent | pending | `npm run build` | |
| P1-03 | Hono Worker, `/api/health`, SPA static assets | P1-01 | agent | pending | integration test hits `/api/health` | |
| P1-04 | Shared Zod schemas | P1-01 | agent | pending | typecheck | |
| P1-05 | ESLint | P1-01 | agent | pending | `npm run lint` | |
| P1-06 | Vitest unit + integration setup | P1-01 | agent | pending | `npm test` | |
| P1-07 | GitHub Actions CI (offline, no secrets) | P1-05, P1-06 | agent | pending | workflow runs green on GitHub | |
| P1-08 | README starter and MIT LICENSE | P0-04 | agent | pending | files present | |
| P1-09 | Local dev server serves app + API | P1-02, P1-03 | agent | pending | browser check of `npm run dev` | |

## P2 — Qloo capability and adapter

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P2-01 | Verify Qloo routes, headers, entity types, response fields, usage terms from official docs | — | agent | pending | notes in `docs/api.md` with source links | |
| P2-02 | Qloo client: timeout, bounded retry, backoff, error normalisation, per-run call budget | P2-01 | agent | pending | unit tests with fake fetch | |
| P2-03 | Normalise to `QlooEntity` / `CulturalEvidence` with provenance | P2-02 | agent | pending | contract tests on synthetic fixtures | |
| P2-04 | Original synthetic fixtures (no real payloads) | P2-01 | agent | pending | fixtures labelled synthetic | |
| P2-05 | Live authenticated Qloo smoke test | P2-02, EXT-QLOO-KEY | agent | pending | `npm run smoke:live` | |

## P3 — Two-sided inputs and deterministic constraints

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P3-01 | Guest/Host/Scenario contracts with provenance and negotiability | P1-04 | agent | pending | typecheck + schema tests | |
| P3-02 | Arrangement templates (pop-up, shelf, co-hosted event) | P3-01 | agent | pending | unit tests | |
| P3-03 | Hard-constraint feasibility evaluation | P3-02 | agent | pending | unit tests per constraint | |
| P3-04 | Edge cases: missing values, contradictions, adversarial input | P3-03 | agent | pending | unit tests | |
| P3-05 | `/api/evaluate` route | P3-03, P1-03 | agent | pending | integration test | |
| P3-06 | Host response link (hashed, expiring, scoped token in D1) | P3-01, P1-03 | agent | pending | integration tests incl. access control | |

## P4 — Cultural bridge and bounded orchestration

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P4-01 | Research planner with typed tool registry and call budget | P2-02 | agent | pending | unit tests | |
| P4-02 | Seed resolution, weak-coverage fallback with disclosed proxies | P4-01 | agent | pending | unit tests | |
| P4-03 | Cultural bridge themes and evidence provenance | P4-02 | agent | pending | unit tests | |
| P4-04 | Visibly labelled fixture mode | P4-01 | agent | pending | e2e shows label | |
| P4-05 | Optional Gemini prose, schema-checked, deterministic fallback | P5-02 | agent | pending | unit tests with fake model | |
| P4-06 | Live research run verified end to end | P4-03, EXT-QLOO-KEY | agent | pending | live smoke | |

## P5 — Agreement Frontier and Decision Reversal

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P5-01 | Frontier enumeration + non-dominance on stated priorities | P3-03 | agent | pending | unit tests | |
| P5-02 | Reversal thresholds and minimal negotiable change, verified by re-evaluation | P5-01 | agent | pending | unit tests | |
| P5-03 | Question ranking by decision sensitivity | P5-02 | agent | pending | unit tests | |
| P5-04 | Decision trace (before → change → after → reason) | P5-02 | agent | pending | unit + e2e | |
| P5-05 | Monotonicity, ties, non-negotiable, adversarial tests | P5-02 | agent | pending | unit tests | |

## P6 — Product UX

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P6-01 | Landing page and fictional example entry | P1-02 | agent | pending | e2e | |
| P6-02 | Guest intake form | P3-01 | agent | pending | e2e | |
| P6-03 | Cultural discovery screen with provenance and states | P4-01 | agent | pending | e2e | |
| P6-04 | Two-sided workspace with host panel | P3-01 | agent | pending | e2e | |
| P6-05 | Agreement Frontier screen | P5-01 | agent | pending | e2e | |
| P6-06 | Decision Reversal screen | P5-02 | agent | pending | e2e | |
| P6-07 | Decision brief, print/PDF, JSON export | P5-03 | agent | pending | e2e | |
| P6-08 | Methodology, limits, error and offline states | P6-01 | agent | pending | e2e | |
| P6-09 | Optional map for verified coordinates with list fallback | P4-03 | agent | pending | e2e | |
| P6-10 | Mobile and keyboard pass | P6-07 | agent | pending | e2e mobile project | |

## P7 — Security, performance, evaluation

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P7-01 | Security headers, input size limits, safe errors | P1-03 | agent | pending | integration tests | |
| P7-02 | Rate limits and quota guardrails | P4-01 | agent | pending | integration tests | |
| P7-03 | Structured privacy-safe logs with request IDs and stage timing | P1-03 | agent | pending | unit tests | |
| P7-04 | ≥30 synthetic evaluation scenarios and metrics script | P5-03 | agent | pending | `npm run eval` | |
| P7-05 | Qloo vs no-Qloo baseline comparison | P7-04, EXT-QLOO-KEY | agent | pending | live eval output | |
| P7-06 | Playwright desktop + mobile journeys | P6-07 | agent | pending | `npm run test:e2e` | |
| P7-07 | Full offline check green | all above | agent | pending | `npm run check` | |
| P7-08 | Worker CPU time measured on deployed Worker | P8-06 | agent | pending | Cloudflare observability | |

## P8 — GitHub and public deployment

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P8-01 | GitHub CLI installed and authenticated | — | human | pending | `gh auth status` | |
| P8-02 | Create public `room-for-both` repo and push | P8-01 | agent | pending | `git ls-remote` | |
| P8-03 | Cloudflare login on a Free account | — | human | pending | `npx wrangler whoami` | |
| P8-04 | Create D1 database and apply migrations remotely | P8-03 | agent | pending | `wrangler d1 migrations list --remote` | |
| P8-05 | Set `QLOO_API_KEY`, `QLOO_BASE_URL` (and optional Gemini) as Worker secrets | P8-03, EXT-QLOO-KEY | human | pending | `wrangler secret list` names only | |
| P8-06 | Deploy and run anonymous external smoke test | P8-04, P8-05 | agent | pending | `npm run verify:public` | |

## P9 — Documentation

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P9-01 | Complete README | P6-07 | agent | pending | link check | |
| P9-02 | `docs/` set (architecture, business case, method, evaluation, security, privacy, limitations, deployment, api, demo guide) | P7-04 | agent | pending | link check | |
| P9-03 | Dependency licence audit, OG metadata, no dead links | P9-01 | agent | pending | script output | |
| P9-04 | Private handoff packet in `.local/` | P9-02 | agent | pending | file exists, ignored | |

## P10 — Release audit

| ID | Task | Needs | Assignee | State | Gate / verification | Evidence |
|----|------|-------|----------|-------|---------------------|----------|
| P10-01 | Sweep blocked tasks | all | agent | pending | updated BLOCKERS | |
| P10-02 | Clean install, full check, secret and text scan | all | agent | pending | command output | |
| P10-03 | Final audit and release state | P10-02 | agent | pending | STATE.json | |
