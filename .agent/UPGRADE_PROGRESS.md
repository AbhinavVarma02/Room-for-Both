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

## #6 CPU on Cloudflare: candidate version, measured without moving production traffic (U6-01, U6-03 partial)

- Built from 2e21d0b and ran `wrangler versions upload --preview-alias candidate`: version 72add54d, served at the
  `candidate-` preview alias. Production stays at 100% on 1c4b8f19 (`wrangler deployments list`).
- `wrangler tail` (with or without `--version-id`) captured no events for preview-URL traffic, so added
  `scripts/cpu-analytics.ts` (GraphQL analytics by version) and `scripts/measure-cpu-windows.ts` (each route alone in
  its own clock minute, then CPU quantiles per minute and version). The Workers Observability query API returned 403
  for the Wrangler session's token.
- Demo mode (no upstream calls), CPU ms p50 / max: health 1.8 / 8.1, evaluate 3.0 / 13.1, research 10.8 / 19.4,
  category-only comparison 2.2 / 3.0, venue-side lookup 3.0 / 5.7.
- Live (39 Qloo calls, 4 model calls): health 0.8 / 3.7, evaluate 2.9 / 3.0, research 20.6 / 44.7, comparison
  10.3 / 31.6, venue-side lookup 6.1 / 9.2, research with the model planner 18.9 / 31.1. All requests succeeded.
- Research is in the same range as the production version's earlier measurements (16–25 ms), so the upgrade did not
  materially raise it; it is still above the nominal 10 ms. The comparison request fetches 10 places, about 200 KB
  (place payloads carry ~9.5 KB of descriptive properties each); Node parses and normalises it in under 1 ms, so the
  Workers figure is not explained by parsing alone.
- Live calls spent in this entry: Qloo 42 (39 measurement + 3 payload-size probes), Gemini 4.

## #7 CPU experiment and decision on splitting research (U6-02)

- Experiment version d31f587c (alias `exp1`, never deployed, code change not committed): research events buffered
  into one write instead of streamed. Same minute, demo mode, n=5: streamed candidate p50 8.2 / max 28.8 ms,
  buffered p50 6.2 / max 14.2 ms. The gain is within run-to-run noise and would remove the live step display, so it
  was not adopted.
- 24-hour analytics by version (`npm run cpu:analytics -- --minutes 1440`): every version, including production
  1c4b8f19 (p50 4.4, p90 23.5, max 28.5 ms) and the candidate 72add54d (p50 3.8, p90 18.9, max 44.7 ms), shows only
  `success` statuses and 0 errors; no request was terminated for CPU, including requests above 60 ms.
- Decision: research is not split. Requests with zero upstream calls (demo research, health) already reach 8–29 ms
  on a cold isolate, so the tail is dominated by per-isolate start-up work rather than by how many upstream payloads
  one request handles; splitting would add requests and complexity without bringing the tail under 10 ms. The model
  planner did not raise research CPU (p50 18.9 vs 20.6 ms). RISK-CPU stays an open watch item.
- Live calls spent: none (demo mode).

## #8 Live evaluation with follow-ups (U2-04)

- `npm run eval -- --live`: five fixed scenarios, 22 research calls plus 8 follow-up calls (category-only comparison
  and venue-side lookup for the first venue). Aggregates only; no names or payloads stored.
- Category-only comparison, four scenarios with a taste signal: all four `different_venues`. Venues in both top
  lists: 4, 1, 4, 5 of 5; venues only the taste signal surfaced (absent from the category-only top 10): 1, 4, 1, 0.
  The taste-ranked first venue sat at #3, outside the top 10, #2, and #1 of the category-only list.
- Venue-side lookup: 8 items in each of the four scenarios; 0 items matched the guest-side list by entity ID in any
  scenario; shared taste tags 4, 1, 0 (taste-tag bridge, not comparable), and 8. So in live data the two directions
  meet through shared themes, not identical titles, and the activation idea says so.
- All evidence `qloo_observed` (39/39), 0/114 items dropped by the normaliser, 0 unsupported statements.
- Live calls spent: Qloo 30.

## #9 Language-model-only baseline and a live candidate walkthrough (U2-05)

- Commit 9cc7695: `POST /api/research/llm-baseline` (consent required; one Gemini call; shares the daily model
  allowance; 6 per visitor per hour). The answer is labelled a language-model interpretation, unsafe suggestions are
  discarded, and names are compared only with the Qloo lists already on the page (`src/shared/domain/llm-match.ts`).
  Unit 3 and integration 4 new tests.
- Candidate version 3a22350e uploaded to the `candidate` alias (production unchanged). A first page load showed a
  blank page because the browser still held the previous candidate's HTML referencing replaced asset hashes; a reload
  fixed it. Recorded as a deployment note: open tabs from before a deploy can fail to load lazy chunks until reloaded.
- Live guided walkthrough on the candidate: research widened Greenpoint to Brooklyn; comparison `different_venues`
  (taste #1 was #3 category-only; one taste-ranked venue absent from the category-only top 10); venue-side lookup
  returned 8 books with no title in common and 4 shared genre tags; the activation idea said so; reversal flipped the
  2-hour event to conditional; the brief carried the hypothetical disclaimer. The language-model-only answer named
  two venues: one matched a Qloo result by name, one was absent from the Qloo lists on the page (and is a plausible
  real local shop), which is shown as a baseline, not a failure of either side.
- Polish: subtitles trimmed in activation sentences; the guide says any other venue can be chosen (the live #1 was a
  national chain); name matches are worded as name matches.
- Live calls spent: Qloo 9, Gemini 1.

## #10 Release validation (U8, in progress)

- Local: `npm run check` exit 0 (unit 117, integration 73, eval 40/40, build); Playwright (fixture) 32 passed,
  2 skipped (summary tests need a model); secret scan clean (169 files).
- Release candidate version 2c5d1b4f uploaded to the `candidate` alias from e964395 (later commits are docs only).
- `E2E_BASE_URL=<candidate> npx playwright test --project=desktop` (live): 12 passed; 5 failed on "Please wait
  before researching again", the app's own 12-runs-per-visitor-per-hour limit, exhausted by earlier live checks from
  the same address in the same UTC hour (the limiter is shared by production and candidate). The guided live journey
  passed. Rerun after the window resets.
- Merged `upgrade/selected-venue-journey` into `main` by fast-forward (a97defa) and pushed; CI pending.
- Private: the private submission text in `.local/` rewritten for the upgraded product; `.local/github-about.md` manual steps
  (no metadata tool available); `.local/qloo-quota-request.md` draft (not sent); `.local/interview-script.md`.
- Live calls spent (approximate, from the candidate test run): Qloo 9, Gemini 1.

## #11 Release: verified and deployed (U8–U10)

- After the hourly window reset, the five rate-limited tests passed against the candidate (desktop 5/5), and the live
  guided and complete journeys passed on mobile (2/2). Desktop total on the candidate: 17/17.
- CI on `main` a97defa: GitHub Actions 39037549524, success.
- `npx wrangler versions deploy 2c5d1b4f…@100%`: production now serves version 2c5d1b4f (built from e964395; later
  commits are documentation and ledger only). Rollback: `npx wrangler rollback 1c4b8f19-a82a-402d-abf8-1cacd6bd13e3`.
- Public checks in fresh sessions: `npm run verify:public` 10/10 (live mode); Playwright pages 5/5; live guided
  journey 1/1. `/api/health`: research live, narrative enabled, model planner available (2 decisions).
- Analytics for version 2c5d1b4f over 90 minutes (preview and production): 66 requests, 0 errors, no CPU
  terminations; CPU p50 4.5, p90 12.7, p99 34.6 ms. RISK-CPU stays an open watch item.
- Usage today (UTC, app counters): Qloo 172 of the 300 ceiling, Gemini 9. Upgrade total, approximate: about 130 Qloo
  calls (94 counted by the app since the start of the day plus 36 from local scripts) and about 10 Gemini calls.
- Private (not committed): `.local/judges-audit-after-upgrade.md` re-evaluation; submission text, About steps, quota
  draft, interview script.
- Nothing was submitted to any external form. The GitHub About section is still empty (manual step).
