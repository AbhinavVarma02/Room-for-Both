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
