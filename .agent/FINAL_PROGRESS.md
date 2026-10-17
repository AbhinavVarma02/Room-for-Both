# Final improvement cycle: progress

## #1 Baseline (F0)

- `main` at 7186634 equals `origin/main`; working tree clean. GitHub Actions 39039183890 on 7186634: success.
- Production version 2c5d1b4f (100%), `/api/health`: research `live`, narrative enabled, planner available.
- `npm run check`: exit 0 (unit 117, integration 73, evaluation 60/60 checks, build).
- Repository: MIT license detected; About description, website, and topics empty.
- Branch `final/product-excellence` created from 7186634.

## #2 Audit, defect fixes, proposal ideas (F1–F3, in progress)

- Audit (TypeScript language-service reference scan over `src`, `tests`, `scripts`; dependency import scan): four
  exports with no references anywhere removed (825e0b7); every dependency is imported; no debug statements.
- Defect: discovery said "High affinity · 0.78" while the brief printed the internal band "moderate". One shared
  formatter in `src/shared/domain/affinity.ts` now serves discovery, the brief, and the JSON export (cdf4fbd).
- Defect: a what-if brief showed edited host values with the host's own provenance ("answered by the host"). Edited
  values are now listed as proposals the owning party must confirm, with `unknown` provenance, plus the status
  changes they cause (cdf4fbd). Regression tests in `tests/unit/brief.test.ts`.
- Feature: proposal ideas from distinct slices of evidence (shared titles, venue side, guest side, taste tags,
  stated interests), each with the engine's status per suited format, host confirmations, unverified points, and
  reasons it might not suit (b0a31c8, a6aa698). Tests in `tests/unit/concepts.test.ts`. Unit tests: 129 passed.

## #3 Reference sensitivity, security fixes, evaluation (F3–F5)

- Feature: opt-in reference sensitivity (`POST /api/research/sensitivity`, `SensitivityPanel`): one call per matched
  reference, each repeating the taste-informed search without it; findings read off the lists (first choice
  changes, list changes, reorder only, no change, not measured), a tie note under 0.02 affinity, and a note when
  Qloo's explanation disagrees with the removal test (1fc3443).
- Security (05c3061): IPv6 clients grouped by /64 for every per-client limit (`limitSubject`); host-link withdrawal
  throttled; sensitivity has its own bucket (half the research limit) and reserves its budget against the daily
  ceiling; single `no-referrer` header on `/respond`. `npm audit`: 0 vulnerabilities; copyleft licences are dev-only.
  Private review in `.local/`.
- Evaluation (6f782c2): offline eval now measures proposal ideas (216/216 format statuses identical to the engine,
  0 repeated items over 108 ideas, 0/561 statements flagged), what-if provenance (13/13 edited values labelled as
  unconfirmed), and fixture sensitivity. It caught a real gap: two suggested changes touched inputs the brief never
  listed; fixed. `npm run eval`: 40/40 cases, 73/73 checks. Unit + integration: 219 passed. Playwright (fixture):
  32 passed, 2 skipped (need a model).
