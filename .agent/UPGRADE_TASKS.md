# Upgrade task register

States: `pending`, `in_progress`, `verified_complete`, `blocked_external`, `failed_needs_fix`, `deferred`.
Nothing is `verified_complete` until its gate has passed and the evidence is in `UPGRADE_PROGRESS.md`.

## U0 — Baseline and recovery

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U0-01 | Verify branch, remote, CI, deployed version, health, rollback target | — | — | verified_complete | HEAD == origin/main, CI success, `/api/health` live | UPGRADE_PROGRESS #1 |
| U0-02 | Upgrade branch, trackers, CLAUDE.md pointer | U0-01 | `.agent/UPGRADE_*`, `CLAUDE.md` | in_progress | files committed | — |

## U1 — Selected-venue journey

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U1-01 | Selection snapshot (venue ID, name, type, evidence, source, retrieval time, run ID) persisted; stale-run handling; reselect updates dependants | U0-02 | `src/client/app/store.tsx`, `src/shared/schemas/selection.ts` | pending | unit + e2e reselect | — |
| U1-02 | Hypothetical host scenario source: editable fictional terms attached to a real venue, labelled everywhere | U1-01 | `profiles.ts`, `provenance.ts`, HostWorkspace, Brief | pending | unit (provenance), e2e labels | — |
| U1-03 | Activation concept from the cultural theme per format (pure, no effect on money or schedule) | U1-01 | `src/shared/domain/activation.ts` | pending | unit; decision invariance | — |
| U1-04 | Brief and JSON export: selected venue, evidence, activation, hypothetical labels, no endorsement wording | U1-02, U1-03 | `brief.ts`, `Brief.tsx` | pending | unit + e2e | — |

## U2 — Category-only comparison

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U2-01 | Bounded baseline request: same category, same resolved location, no taste signal (1 call) | U1-01 | `routes/research.ts`, `orchestration/baseline.ts` | pending | integration | — |
| U2-02 | Comparison function: overlap, rank shifts, evidence only with signals, no-change cases | U2-01 | `src/shared/domain/comparison.ts` | pending | unit | — |
| U2-03 | Comparison panel in discovery | U2-02 | Discovery | pending | e2e | — |
| U2-04 | Evaluation cases (offline) and a small live scenario | U2-02 | `tests/evaluation` | pending | `npm run eval` | — |
| U2-05 | LLM-only comparison: feasibility decision | U2-04 | docs | pending | decision recorded | — |

## U3 — Two-sided cultural bridge

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U3-01 | Capability test: venue entity as a Qloo signal (≤4 live calls) | U0-02 | scratch script only | pending | recorded result | — |
| U3-02 | Venue-side evidence (if supported) or host-entered programming interests (if not) | U3-01 | research route, HostForm | pending | integration | — |
| U3-03 | Overlap and complement computation; two directions shown separately | U3-02 | `src/shared/domain/bridge.ts` | pending | unit | — |
| U3-04 | Carry the bridge into arrangement view and brief | U3-03, U1-04 | Frontier, Brief | pending | e2e | — |

## U4 — Bounded model-assisted research planner

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U4-01 | Allow-listed planner actions, schema, validator | U0-02 | `src/shared/schemas/planner.ts`, `orchestration/planner.ts` | pending | unit | — |
| U4-02 | Gemini planning adapter (structured output, timeout, quota) | U4-01 | `integrations/gemini/planner.ts` | pending | unit | — |
| U4-03 | Integrate with deterministic fallback, consent, decision cap, visible trace | U4-02 | research orchestration, Discovery | pending | integration | — |
| U4-04 | Failure tests: malformed, unsupported, injection, quota, timeout, no consent, contradiction, budget, fallback | U4-03 | tests | pending | integration | — |

## U5 — First 90 seconds

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U5-01 | Landing states the cultural reason and the two-sided problem; fast demonstration entry | U1-04 | Landing | pending | e2e | — |
| U5-02 | Guided demonstration path with minimal form interaction | U5-01 | Workspace, guide component | pending | e2e | — |
| U5-03 | Clear failure reason, visible reversal cue, before/after status | U5-02 | Frontier, Reversal | pending | e2e | — |
| U5-04 | Mobile header overflow at 375 px; widths 320–414 | — | Chrome | pending | e2e width matrix | — |
| U5-05 | Automated accessibility checks | U5-03 | tests/e2e | pending | e2e | — |

## U6 — Performance, cost, safety

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U6-01 | Profile CPU of research stages | U0-02 | scripts | pending | measurements recorded | — |
| U6-02 | Split research into independently bounded requests if needed | U6-01 | research route, client | pending | integration + measured CPU | — |
| U6-03 | Measure the candidate on Cloudflare without moving production traffic | U6-02 | — | pending | CPU p50/p90/p99 | — |
| U6-04 | Private quota-increase request draft | — | `.local/` | pending | file present | — |

## U7 — Product impact

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U7-01 | Business case: initial customer, intermediary buyer, manual workflow, limits | — | `docs/business-case.md` | pending | review | — |
| U7-02 | Interview script (private) and case study | U7-01 | `.local/`, `docs/` | pending | files present | — |

## U8 — Release validation

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U8-01 | Full offline suite, eval, secret scan, build | U1–U6 | — | pending | `npm run check`, scan clean | — |
| U8-02 | Playwright desktop and mobile (fixture), then bounded live checks | U8-01 | — | pending | e2e green | — |
| U8-03 | Merge to main after green CI | U8-02 | — | pending | CI success | — |
| U8-04 | Deploy, verify publicly in a fresh session, or roll back | U8-03 | — | pending | verify:public, public e2e | — |

## U9 — Documentation and presentation

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U9-01 | README, architecture, evaluation, demo guide, API docs | U8-04 | `docs/`, README | pending | review | — |
| U9-02 | Private submission text, repository About steps, screenshots | U8-04 | `.local/` | pending | files present | — |

## U10 — Re-evaluation and handoff

| ID | Task | Needs | Files | State | Gate | Evidence |
|----|------|-------|-------|-------|------|----------|
| U10-01 | Independent re-evaluation (private) | U9 | `.local/` | pending | file present | — |
| U10-02 | Final trackers and handoff | U10-01 | `.agent/` | pending | — | — |
