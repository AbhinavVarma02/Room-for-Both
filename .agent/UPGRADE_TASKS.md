# Upgrade task register

States: `pending`, `in_progress`, `verified_complete`, `blocked_external`, `failed_needs_fix`, `deferred`.
Nothing is `verified_complete` until its gate has passed and the evidence is in `UPGRADE_PROGRESS.md`.

## U0 — Baseline and recovery

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U0-01 | Verify branch, remote, CI, deployed version, health, rollback target | — | — | verified_complete | HEAD == origin/main, CI success, `/api/health` live | UPGRADE_PROGRESS #1 |
| U0-02 | Upgrade branch, trackers, CLAUDE.md pointer | U0-01 | `.agent/UPGRADE_*`, `CLAUDE.md` | verified_complete | files committed | 92720c9 |

## U1 — Selected-venue journey

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U1-01 | Selection snapshot (venue ID, name, type, evidence, source, retrieval time, run ID) persisted; stale-run handling; reselect updates dependants | U0-02 | `src/client/app/store.tsx`, `src/shared/schemas/selection.ts` | verified_complete | unit + e2e reselect | unit + e2e reselect (0f8e2bb) |
| U1-02 | Hypothetical host scenario source: editable fictional terms attached to a real venue, labelled everywhere | U1-01 | `profiles.ts`, `provenance.ts`, HostWorkspace, Brief | verified_complete | unit (provenance), e2e labels | unit + e2e labels and JSON export (0f8e2bb) |
| U1-03 | Activation concept from the cultural theme per format (pure, no effect on money or schedule) | U1-01 | `src/shared/domain/activation.ts` | verified_complete | unit; decision invariance | unit 22/22, eval invariance 27/27 (b60113a) |
| U1-04 | Brief and JSON export: selected venue, evidence, activation, hypothetical labels, no endorsement wording | U1-02, U1-03 | `brief.ts`, `Brief.tsx` | verified_complete | unit + e2e | unit + e2e guided journey (0f8e2bb) |

## U2 — Category-only comparison

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U2-01 | Bounded baseline request: same category, same resolved location, no taste signal (1 call) | U1-01 | `routes/research.ts`, `orchestration/baseline.ts` | verified_complete | integration | integration 32/32 (b60113a) |
| U2-02 | Comparison function: overlap, rank shifts, evidence only with signals, no-change cases | U2-01 | `src/shared/domain/comparison.ts` | verified_complete | unit | unit (4 cases) (b60113a) |
| U2-03 | Comparison panel in discovery | U2-02 | Discovery | verified_complete | e2e | e2e guided journey asserts comparison table (0f8e2bb) |
| U2-04 | Evaluation cases (offline) and a small live scenario | U2-02 | `tests/evaluation` | verified_complete | `npm run eval` | UPGRADE_PROGRESS #8 |
| U2-05 | LLM-only comparison: feasibility decision | U2-04 | docs | verified_complete | decision recorded | implemented with consent; UPGRADE_PROGRESS #9 |

## U3 — Two-sided cultural bridge

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U3-01 | Capability test: venue entity as a Qloo signal (≤4 live calls) | U0-02 | scratch script only | verified_complete | recorded result | UPGRADE_PROGRESS #2 |
| U3-02 | Venue-side evidence (if supported) or host-entered programming interests (if not) | U3-01 | research route, HostForm | verified_complete | integration | integration (venue-bridge, 5 cases) (b60113a) |
| U3-03 | Overlap and complement computation; two directions shown separately | U3-02 | `src/shared/domain/bridge.ts` | verified_complete | unit | unit (2 cases) (b60113a) |
| U3-04 | Carry the bridge into arrangement view and brief | U3-03, U1-04 | Frontier, Brief | verified_complete | e2e | e2e: host panel, brief venue and bridge (0f8e2bb) |

## U4 — Bounded model-assisted research planner

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U4-01 | Allow-listed planner actions, schema, validator | U0-02 | `src/shared/schemas/planner.ts`, `orchestration/planner.ts` | verified_complete | unit | unit 23/23 (5013eae) |
| U4-02 | Gemini planning adapter (structured output, timeout, quota) | U4-01 | `integrations/gemini/planner.ts` | verified_complete | unit | smoke:planner 2 live calls, UPGRADE_PROGRESS #4 |
| U4-03 | Integrate with deterministic fallback, consent, decision cap, visible trace | U4-02 | research orchestration, Discovery | verified_complete | integration | integration 9/9; UI trace (0f8e2bb) |
| U4-04 | Failure tests: malformed, unsupported, injection, quota, timeout, no consent, contradiction, budget, fallback | U4-03 | tests | verified_complete | integration | unit + integration cover all nine failure modes (5013eae) |

## U5 — First 90 seconds

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U5-01 | Landing states the cultural reason and the two-sided problem; fast demonstration entry | U1-04 | Landing | verified_complete | e2e | e2e guided (0f8e2bb) |
| U5-02 | Guided demonstration path with minimal form interaction | U5-01 | Workspace, guide component | verified_complete | e2e | e2e guided journey desktop+mobile (0f8e2bb) |
| U5-03 | Clear failure reason, visible reversal cue, before/after status | U5-02 | Frontier, Reversal | verified_complete | e2e | e2e: failure headline, Apply this change, before/after status (0f8e2bb) |
| U5-04 | Mobile header overflow at 375 px; widths 320–414 | — | Chrome | verified_complete | e2e width matrix | e2e width matrix 320/360/375/414 (0f8e2bb) |
| U5-05 | Automated accessibility checks | U5-03 | tests/e2e | verified_complete | e2e | axe wcag2a/aa: 0 serious or critical on 8 pages (0f8e2bb) |

## U6 — Performance, cost, safety

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U6-01 | Profile CPU of research stages | U0-02 | scripts | verified_complete | measurements recorded | UPGRADE_PROGRESS #6 |
| U6-02 | Split research into independently bounded requests if needed | U6-01 | research route, client | deferred | integration + measured CPU | evidence in UPGRADE_PROGRESS #7: cold start dominates; split not adopted |
| U6-03 | Measure the candidate on Cloudflare without moving production traffic | U6-02 | — | verified_complete | CPU p50/p90/p99 | candidate 72add54d measured, UPGRADE_PROGRESS #6–#7 |
| U6-04 | Private quota-increase request draft | — | `.local/` | verified_complete | file present | private draft in .local (not sent) |

## U7 — Product impact

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U7-01 | Business case: initial customer, intermediary buyer, manual workflow, limits | — | `docs/business-case.md` | verified_complete | review | docs/business-case.md (cc90781) |
| U7-02 | Interview script (private) and case study | U7-01 | `.local/`, `docs/` | verified_complete | files present | docs/case-study.md; private interview script (no interviews conducted) |

## U8 — Release validation

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U8-01 | Full offline suite, eval, secret scan, build | U1–U6 | — | verified_complete | `npm run check`, scan clean | npm run check exit 0; Playwright 32 passed, 2 skipped; scan clean |
| U8-02 | Playwright desktop and mobile (fixture), then bounded live checks | U8-01 | — | verified_complete | e2e green | fixture 32 passed; live candidate desktop 17/17 and mobile live journeys 2/2 (UPGRADE_PROGRESS #11) |
| U8-03 | Merge to main after green CI | U8-02 | — | verified_complete | CI success | main a97defa; CI 39037549524 success |
| U8-04 | Deploy, verify publicly in a fresh session, or roll back | U8-03 | — | verified_complete | verify:public, public e2e | 2c5d1b4f at 100%; verify:public 10/10; public e2e (UPGRADE_PROGRESS #11) |

## U9 — Documentation and presentation

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U9-01 | README, architecture, evaluation, demo guide, API docs | U8-04 | `docs/`, README | verified_complete | review | README and docs (cc90781 and later) |
| U9-02 | Private submission text, repository About steps, screenshots | U8-04 | `.local/` | verified_complete | files present | private drafts in .local (not submitted) |

## U10 — Re-evaluation and handoff

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U10-01 | Independent re-evaluation (private) | U9 | `.local/` | verified_complete | file present | private re-evaluation in .local |
| U10-02 | Final trackers and handoff | U10-01 | `.agent/` | verified_complete | — | trackers and handoff updated |
