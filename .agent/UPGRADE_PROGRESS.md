# Upgrade progress

Append-only. Each entry: what ran, what was observed, live calls spent, next action.

## #1 Baseline (U0-01)

- `git status`: clean on `main`; HEAD == origin/main == a517810.
- GitHub Actions run 39000001359 on a517810: completed, success.
- `wrangler deployments list`: production at 100% on Worker version 1c4b8f19-a82a-402d-abf8-1cacd6bd13e3
  (deployed from 1a8d36a; later commits are ledger-only). This is the rollback reference.
- Public `/api/health`: `research.mode` live, `narrative.enabled` true, storage bound. `/api/config`: call budget 7,
  three references per run, host links enabled. No Qloo or Gemini calls spent.
- Created branch `upgrade/selected-venue-journey` from main.
- Next: commit trackers (U0-02), then U1-01.

## #2 Venue-signal capability test (U3-01) and payload sizes (U6-01, partial)

- Three live Qloo calls from a private scratch script (not in the repository): one place `/search`, one
  `/v2/insights` with `filter.type=urn:entity:book` and the venue's own entity as `signal.interests.entities`,
  one `/v2/insights` with `filter.type=urn:tag` scoped to books with the same venue signal.
- Result: a place entity is accepted as an interest signal. The book call returned HTTP 200 with 8 entities, all
  carrying affinity (0.87–0.90), and the titles were plausibly coherent for the venue. The tag call returned 8 tags,
  every one with affinity 1.00, so venue-side taste tags do not discriminate and are not used.
- Decision: venue-side evidence uses the same cross-domain type as the guest-side bridge (books, artists, or
  podcasts by venue category), one call per selected venue. Categories without a cross-domain type use
  host-entered programming interests instead.
- Payload sizes: 36 KB (search, 3 results), 68 KB (8 books), 2 KB (tags). `JSON.parse` in Node took 0.02–0.18 ms,
  so response parsing is not where production research CPU goes; the earlier demo-mode measurement (5–15 ms with no
  upstream calls) points at per-request application work. Follow-up in U6-01.
- Live calls spent: Qloo 3, Gemini 0.

## #4 Bounded model-assisted planner (U4)

- Commit 5013eae. Planner: `src/worker/orchestration/planner.ts`; adapter `src/worker/integrations/gemini/planner.ts`;
  schemas `src/shared/schemas/planner.ts`. Decision points: `bridge` (cross-domain domain from an allow-list of
  books, music artists, podcasts; taste tags; clarify an approximate reference; stop only when no reference matched)
  and `widen` (only after an empty neighbourhood search). At most `PLANNER_MAX_DECISIONS` (default 2) model calls per
  run, each reserved against the shared daily model allowance (`GEMINI_DAILY_CALL_CEILING`, default 300).
- Consent: the request must carry `planner: "model"` and `plannerConsent: true`; otherwise no model call and the
  trace says why. The prompt carries references, product categories, venue type, and (for widening) the area names.
- Tests: unit 23 (all nine failure modes: malformed, unsupported action and domain, injection via rationale link or
  markup, outcome claim, contradictory stop or clarify, timeout, quota, invalid JSON, allowance used up, decision
  budget, no consent, deterministic default); integration 9 (accepted podcast choice changes the bridge request;
  second decision only after an empty search; provider 429 fallback; no consent; ceiling 0; no model configured;
  default deterministic; injected proposal rejected).
- `npm run smoke:planner` (2 live Gemini calls, no Qloo calls): both answers parsed and validated in ~1.3 s; the
  injected reference label was ignored and the executed action stayed on the allow-list.
- Totals: unit 114/114, integration 69/69, eval 40/40, invariance 27/27, scan clean.
- Live calls spent: Qloo 0, Gemini 2.

## #5 Guided demonstration and first 90 seconds (U5)

- Commit 0f8e2bb. Landing: hero names the two-sided problem and Qloo's role; "See it in 90 seconds" loads the
  fictional guest in guided mode and goes straight to discovery, where research and the category-only comparison
  start by themselves. A guide banner gives one sentence and one action per step and never changes a result.
- Frontier: headline card (why the featured co-hosted event fails, the check that blocks most no-go options, the
  closest verified change with before/after status) and a three-part "cultural opportunity / operational
  feasibility / commercial success" panel. Reversal: "Apply this change" cue and a before/after status card in a
  `role="status"` region.
- Mobile: Discovery overflowed by 35 px at 375 px (an implicit grid column sized to a table's minimum width); fixed
  with explicit single-column grids. The header wordmark is visually hidden below 360 px to avoid overlap.
- Accessibility: axe (WCAG 2.0/2.1 A and AA) found 6 colour-contrast failures for faint text (4.23–4.37:1); the
  faint ink token is now #5f6a74 (≥4.8:1 on every background used). Now 0 serious or critical issues on 8 pages.
- Added `@axe-core/playwright` 4.13.0 (dev only, MPL-2.0; the newest release was two days old, so the previous one
  was pinned). Playwright now builds with `--mode fixture` locally unless `E2E_LIVE=1`.
- Checks: Playwright 32 passed, 2 skipped (summary tests need a model) on desktop and mobile; unit 114, integration
  69, eval 40/40; scan clean. Live calls spent: none.
- Next: U6 CPU profiling on a non-production Worker version.
