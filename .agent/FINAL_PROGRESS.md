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

## #4 Documentation, ledger, candidate verification (F6, F7, F10 in progress)

- Docs (f2fbbb5): README rewritten in the author's voice; the case study's decision table moved into
  `docs/architecture.md`; the demo script left the public docs; screenshots regenerated from fixture mode (new
  `ideas.png`); docs describe ideas, sensitivity, and the counterproposal. First-person cleanup across docs.
- End-to-end (f91e639): a new test covers sensitivity, ideas, and the counterproposal brief (desktop and mobile).
- Candidate 1bb2e818 (from f91e639) on the `candidate` alias, production untouched: `/api/health` live; `/respond`
  now sends a single `Referrer-Policy: no-referrer`; `npm run verify:public` 10/10 including a live research stream.
  Live walkthrough in a browser: guided research, comparison, sensitivity (without "Patagonia" the first choice
  changes; without "Aesop" the list changes; without "Braiding Sweetgrass" only the order changes), venue side for a
  chosen independent venue, ideas, reversal, counterproposal brief, sensitivity findings in the brief.
- Defect found live and fixed (9c31152): the first idea marked "Discuss first" came only from the venue's own
  associations; ideas are now ranked by linkage and an unlinked idea is never recommended first. The guide notes in
  live mode that Qloo does not say whether a venue is independent.
- Candidate 61619c8f (from 9c31152; later commits are docs, ledger, and scripts only): desktop Playwright against
  the live candidate 18/18, including the live guided journey and the consented summary. Cloudflare analytics for
  61619c8f over that traffic: 28 requests, 0 errors, CPU p50 3.5, p90 27.5, p99 54.1 ms, no terminations.
- Ledger consolidated (1b75b87): superseded task, checklist, and upgrade files archived privately.
- Live calls spent so far this cycle (approximate): Qloo about 36, Gemini 1.
