# Progress log

Chronological, factual. Commands and observed outcomes only.

## #1 Bootstrap (P0)
- Working directory was empty; no prior Git repository.
- Tools detected: Node v24.14.0, npm 11.9.0, Git 2.53.0 (Windows). Not installed: `gh`, global `wrangler`, pnpm, bun.
- `git init -b main` succeeded. Added `.gitignore`, `.gitattributes`, `CLAUDE.md`, `.agent/` ledger.
- Latest registry versions observed: wrangler 4.151.0, vite 8.3.4, @cloudflare/vite-plugin 1.64.0, hono 4.13.13,
  zod 4.6.7, vitest 5.0.5 (@cloudflare/vitest-pool-workers 0.23.0 requires vitest ^4.1), react 19.3.1,
  tailwindcss 4.3.3, @playwright/test 1.64.1, typescript 7.0.2, eslint 10.12.0.

## #2 Scaffold, Qloo verification, engine (P1 partial, P2, P3, P5)
- Installed dependencies (npm, lockfile committed). TypeScript pinned to 6.0.3 because typescript-eslint 8.71 supports `<6.1`.
  Vitest 5 used with Wrangler `getPlatformProxy` (real local D1 via Miniflare) instead of `@cloudflare/vitest-pool-workers`, whose 0.23 release requires Vitest 4.
- `npx wrangler whoami` → not authenticated (EXT-CF-AUTH open).
- Qloo verification (P2-01): read Qloo public docs repository (reference/*.md, docs/*.md) and the published `@qloo/qloo-harness` 0.1.26
  package source (read only, not executed). Confirmed: production base URL `https://api.qloo.com`; header `X-Api-Key`; routes `/search`,
  `/entities`, `/v2/insights`, `/v2/tags`; list params comma-joined; results either an array or `results.entities` / `results.tags`;
  entity IDs `entity_id`; tag IDs `id` or `tag_id`; scores at `query.affinity` (0–1); `feature.explainability=true` adds
  `query.explainability`; `filter.location.query` locality search returns 400 when not found; 404 documented as "No results";
  429 rate limit. The bundled `openapi-schema.json` in the docs repo is the generic OpenAPI meta-schema, not Qloo's spec.
- Qloo's starter kit lists its CLI/MCP harness as the supported access surfaces for issued credentials and says serverless functions are not a
  supported route for its MCP server. We call the documented HTTPS API directly from the Worker. Recorded as EXT-QLOO-ACCESS (needs owner confirmation).
- Cloudflare limits verified from docs: Workers Free 100k req/day, 10 ms CPU, 50 subrequests, 128 MB; D1 Free 5M rows read / 100k written per day,
  50 queries per invocation. Rate Limiting binding's Free-plan availability not stated → D1 counters used instead.
- Gemini pricing page lists free-tier models (e.g. gemini-2.5-flash-lite, gemini-3.1-flash-lite); free-tier content is marked as used to improve
  Google products → narrative is opt-in per request with explicit consent and disabled unless configured.
- Engine: `src/shared/domain` (constraints, frontier, reversal, questions, trace). Commit d3a3e01.
- Worker: Hono app, NDJSON research stream, Qloo client (trusted-host check, timeout, bounded retry, call budget, circuit breaker), fixture
  transport, research planner, D1 limits, host links, Gemini adapter with output checks. Commit 37bbaa4.
- `npx vitest run` → 7 files, 100 tests passed (57 unit, 43 integration). `eslint src tests` clean. `tsc` app/worker/test clean.

## #3 Client, end-to-end tests, evaluation, docs (P1, P4, P6, P7, P9)
- React client: landing, workspace stepper (guest intake, discovery with streamed steps, two-sided workspace with private host
  link, Agreement Frontier with trade-off chart, Decision Reversal with what-if controls and trace, printable brief with JSON export),
  methodology page, host response page, not-found page. Route-level code splitting: main chunk 259 KB (82 KB gzip).
- Browser walkthrough of the fictional journey on the local dev server (built-in browser); mobile viewport 375 px has no horizontal scroll.
- Fixes found during review: fixture-mode text no longer attributes fictional associations to Qloo; guest edits to host-link answers relabel
  them as unconfirmed; what-if selection stays pinned; first-load focus order keeps the skip link first; host page reacts to hash changes;
  brief page has a single h1.
- `npx playwright test` → 22 passed (11 desktop Chrome, 11 Pixel 7) against `vite preview` (production build in workerd, local D1).
- `npm run eval` → 40/40 cases, 58/58 checks; 0/3157 statements flagged as unsupported claims; 3019/3019 numbers grounded;
  27/27 decisions invariant to the cultural layer; research calls max 6, mean 3.6; engine median 0.05–0.06 ms, p95 0.16 ms.
  Mutation check: changing the budget rule from `<=` to `<` made 2 cases fail (E19, E23); reverted.
- `npm run check` → exit 0 (typecheck, lint, 57 unit, 43 integration, eval, build). `npm run scan:secrets` → clean (130 files).
- Licence audit of the production tree: MIT, ISC (lucide-react), 0BSD (tslib), Unlicense (wouter), OFL-1.1 (fonts). Unknown entries are
  uninstalled optional peers of @hookform/resolvers; `@img/sharp-wasm32` is extraneous and not bundled. Vite now emits
  `third-party-licenses.md` with the build; linked from the footer.
- Docs: README, architecture, decision method, business case, API (incl. verified Qloo routes), security, privacy, limitations,
  deployment, evaluation, demo guide. Screenshots captured from the running app (fixture mode, fictional example).
- Commits: c34a1a6, 8307402, 5ceefe8, a31f071, 9cbbc0d, 283c005, 3bcc8d9.
- Not done: optional map (P6-09) intentionally not shipped. External: GitHub repo, Cloudflare deploy, live Qloo verification.

## #4 GitHub and Cloudflare (P8)
- Owner created the public repository AbhinavVarma02/Room-for-Both (empty). Added as `origin`; `git push -u origin main` succeeded via
  Git Credential Manager (91e8e99). GitHub Actions run 38852228902: both jobs succeeded (check; Playwright desktop + mobile).
- GitHub CLI install via winget was cancelled at the Windows elevation prompt; not required because pushes work.
- Owner reports Qloo API access requested; approval pending (may take several business days). Live Qloo work stays blocked (EXT-QLOO-KEY).
- First `npx wrangler login` timed out waiting for browser authorization (log: "Timed out waiting for authorization code").
- Second `npx wrangler login` succeeded (account confirmed with `wrangler whoami`). Plan tier is not shown by the CLI; no billing or plan
  setting was touched. `wrangler d1 list` empty → `wrangler d1 create room-for-both` (id b8196d69-7c57-4575-9b54-5ac6dd05ace9, not secret),
  `wrangler d1 migrations apply room-for-both --remote` → 0001_initial.sql applied.
- `npm run deploy` → https://room-for-both.room-for-both.workers.dev (version 8b056190-e32b-4009-9206-d3dad4368c10). New workers.dev TLS
  certificate took about 2 minutes to issue. `CLIENT_KEY_SALT` set as a secret from a locally generated random value (never printed).
- `npm run verify:public -- <url>` → 9/10 PASS; only "live Qloo mode" fails (expected: fixture mode, EXT-QLOO-KEY).
- `E2E_BASE_URL=<url> npx playwright test` → first run 12 failures caused by the test helper sending a simulated CF-Connecting-IP header,
  which Cloudflare's edge rejects; helper fixed to simulate only locally → 22/22 passed against the public deployment.
- `wrangler tail` CPU: evaluate 2–5 ms, fixture research 3–9 ms, health 0 ms (Workers Free limit 10 ms). Live research must be re-measured.

## #5 Reconciliation, Qloo host audit, CPU investigation
- Reconciled ledger: origin/main == ebeeef7; CI runs 38852228902, 38852420976, 38854006067 all success; /api/health 200 on the deployment.
  Removed obsolete repo-creation, Cloudflare-login, and D1-creation steps from NEXT.md; rewrote BLOCKERS.md (open vs resolved).
- Qloo host audit: latest starter kit (commit 0db91b8) names no API host; docs repository (d4a0eb9) references only api.qloo.com and
  staging.api.qloo.com; the official harness 0.1.26 treats only https://api.qloo.com as official (others need explicit trust).
  No public source documents another host. DNS + unauthenticated GET /search on three candidate hosts: all resolve, all return 401.
  Decision: no host is assumed. `smoke:live` now probes candidates (QLOO_BASE_URL, QLOO_CANDIDATE_BASE_URLS, documented production)
  with one call each, validates real response field presence, then runs one bounded research run. Local ignored `.dev.vars` lists
  the candidates; the tracked example uses generic wording only. Direct-HTTPS authorisation remains unclear → EXT-QLOO-ACCESS open.
- No credential present (.dev.vars key empty, no env var, Worker secrets: CLIENT_KEY_SALT only). Live tests not run; scripts report BLOCKED.
- Cloudflare: limits re-verified from docs (unchanged). `/accounts/{id}/workers/account-settings` readable (default usage model
  standard); `/accounts/{id}/subscriptions` 403 with Wrangler's token → plan not confirmable from CLI (EXT-CF-PLAN).
- CPU: new `npm run measure:cpu` (wrangler tail). Two more sessions on the deployment: evaluate up to 21 ms on the first request of a fresh
  isolate then 4–5 ms; fixture research 4–18 ms; all outcomes ok. Node profiling: first research request ~29 ms, warm median 0.63 ms;
  first health request ~14–19 ms vs 0.4 ms warm; Hono LinearRouter made no difference (experiment reverted). Cause: first-use compilation
  in fresh isolates. Synthetic estimate of live payload parsing: +1.4 ms warm / +6.5 ms cold (labelled estimate). No restructuring yet.

## #6 Final offline health check and scope freeze
- Git: branch `main`, working tree clean, `origin` = https://github.com/AbhinavVarma02/Room-for-Both.git; after `git fetch`,
  HEAD == origin/main == 27a2ad6. GitHub Actions (public API): runs 38852228902, 38852420976, 38854006067, 38855382520 all
  success; latest 38855382520 is on 27a2ad6.
- `npm run check` → exit 0: typecheck, lint, 57 unit, 44 integration, eval 40/40 cases and 60/60 checks (0/3157 unsupported
  statements, 3019/3019 numbers grounded, 27/27 decisions invariant), build. `npm run scan:secrets` → clean, 131 tracked files.
  Only `.dev.vars.example` and `.env.example` are tracked from the env family; both have empty values.
- `npx playwright test` (local production build in workerd, local D1) → 22/22 (11 desktop, 11 mobile).
- `npm run verify:public -- https://room-for-both.room-for-both.workers.dev` → 9/10 PASS; only "live Qloo mode" fails (fixture mode,
  expected). Public landing page reviewed in the built-in browser; discovery shows "Fixture mode: fictional cultural data".
- Cloudflare (read-only): active Worker version 2de0ba6b (secret change on top of upload 8b056190); `git diff 91e8e99..HEAD` touches
  no `src/` or client files (only the D1 `database_id` line and a script entry), so the deployment matches HEAD and was not
  redeployed. D1 `room-for-both` (b8196d69…) has tables `host_requests`, `rate_limits`, `usage_counters`, `d1_migrations`; remote migrations: none
  pending. Worker secrets: `CLIENT_KEY_SALT` only. Bindings: D1, one cron, observability; no paid products. No account or plan
  setting changed.
- A first public journey run hit HTTP 429 `rate_limited` on `/api/research`: the per-client limit (12 runs/hour) already held 16
  attempts in the 05:00 UTC window from the previous CPU measurements plus this check. Throttling works as designed; not a defect.
- After the window reset: `E2E_BASE_URL=<public url> npx playwright test` → 22/22 (desktop and mobile) against the public deployment,
  including the fixture-mode labels on discovery and the brief.
- Trackers reconciled: stale SHAs, CI run, CPU range (2–21 ms, not ≤9 ms), and public-URL notes corrected; P1, P9, P10-01 closed;
  release-critical vs optional work separated; scope freeze recorded in CLAUDE.md, NEXT.md, STATE.json.
- Not done (external): live Qloo smoke, host and field validation, live research, evaluation, CPU; access confirmation; plan check.

## #7 Live Qloo and Gemini integration, deployment, and evaluation
- Start: HEAD == origin/main == 55215aa, clean tree. `.dev.vars` holds QLOO_API_KEY, QLOO_BASE_URL, GEMINI_API_KEY,
  GEMINI_MODEL (presence and length checked; values never printed). All env files git-ignored.
- Terms reviewed: Qloo's developer guide for the credential (single valid host; rejected on production and staging;
  direct HTTPS with `X-Api-Key`; keys active through the end of the programme's review period, then deactivated;
  private server-side caching allowed; no response data in public repositories); Qloo Terms of Use (input-signal
  licence, no redistribution); the programme's rules (working app available free for testing through the review
  period; third-party use must follow its terms). The credential email was not available (no match in the connected
  mailbox) → EXT-QLOO-EMAIL for the owner. EXT-QLOO-KEY, EXT-QLOO-HOST, EXT-QLOO-ACCESS resolved (ADR-010).
- `npm run smoke:live`: host accepted on the first probe; first bounded run passed except the cultural bridge
  (0 themes). Diagnosis with single calls: book titles carry subtitles; names HTML-escaped; brand-only signals are
  rejected for book insights (400 "all signal.interests.entities were invalid"); unscoped taste tags mix domains;
  `filter.parents.types` scoping fixes that; explainability is a per-reference list; tags mix themes with formats and
  age brackets; places carry `is_closed`; response headers report 5 calls/s and 10,000/month. A later smoke run hit
  HTTP 429 from the per-second limit (five quick calls then a sixth); fixed with pacing and reset-aware retry.
- Gemini: key lists `gemini-3.5-flash-lite`; it belongs to an AI Studio project with billing disabled, restricted to
  the Generative Language API; free-tier quota 15/min, 500/day. `npm run smoke:gemini` 2/2 (≈245 in / 100 out tokens,
  ~1.1 s); injection not followed. One draft misattributed a change; the system instruction now defines each field.
- Fixes (5bf47ef): entity decoding, main-title matching, null-tolerant fields, pacing + 429 handling + monthly stop,
  daily ceiling 300, bridge fallback to scoped taste tags, thematic tag filter, closed venues, locality note,
  `demo: true` fictional demonstration with named error states, live brief label, mode-aware e2e, secret scan of
  exact local values. CI 38995913094 success.
- Deployment: `npm run deploy` → a601eb3f (code, still fixture); `wrangler secret bulk` from stdin (four secrets,
  CLIENT_KEY_SALT kept) → 701c21ef live. `verify:public` 10/10; public e2e 24/24; public `/api/narrative` 200.
- CPU (wrangler tail): live research 18/32/57 ms. Local replay of one captured run (private, ignored folder):
  normalisation 0.61 ms warm, full run ~9 ms cold. Replaced per-item schema parsing (0e17b50): 0.07 ms warm, ~4 ms
  cold; deployed research 16/24/25 ms; demo research 5/13/15 ms; evaluate 2–25 ms. Cloudflare GraphQL analytics:
  183 requests, all success, 0 errors, 0 CPU terminations; p50 4.1, p90 13.6, p99 57.7 ms → RISK-CPU watch item.
  Removed orphaned `wrangler tail` processes (two from the previous session); the CPU script now kills the tree.
- Venue categories (9 tag searches): 7 match exactly; "Clothing boutique" → "Clothing store", "Plant shop" →
  "Plant nursery" proxies with disclosure; plain place category preferred over restaurant/hotel genres (0e17b50).
- Live evaluation (`npm run eval -- --live`, 22 calls): 5/5 scenarios found venues; 6/7 references exact (the 7th a
  fictional business name, kept approximate); 20/20 signal-backed venues explained; 39/39 evidence qloo_observed;
  0/114 items dropped; 0 unsupported statements; 2–7 calls per run; 0.4–4.3 s.
- Checks on 0e17b50: `npm run check` exit 0 (69 unit, 49 integration, eval 40/40, build); local Playwright 24/24
  (live mode); public Playwright 24/24 and summary test 2/2; scan clean. CI 38997070624 success. Deployed a69d147b.
- Docs: new docs/data-licensing.md; README, api, deployment (secrets, rotation, rollback), security, privacy,
  limitations, evaluation, architecture, demo guide, Methodology page updated.
- Production usage on the day: Qloo calls counted by the app's own ceiling; see `usage_counters` in D1.
- Final: docs and ledger commit 1a8d36a pushed and deployed as 1c4b8f19; `verify:public` 10/10 (live); public
  pages e2e 10/10. Captured raw payloads used for local CPU profiling were deleted; private live screenshots for
  the entry packet remain in `.local/screenshots/` (ignored).

## #8 Owner confirmations recorded; release audit closed
- Start: HEAD == origin/main == 448b269, clean tree; CI 38997674176 (448b269) success. Public `/api/health`:
  `research.mode` `live`, `narrative.enabled` `true`, storage bound (no Qloo calls spent).
- EXT-CF-PLAN resolved: the owner visually verified Cloudflare billing in the dashboard — Workers Free, Active, no
  payment method on file. Owner-observed, not agent-observed (the Wrangler token still cannot read subscriptions).
- EXT-QLOO-EMAIL resolved: the owner reviewed the email that delivered the Qloo credential; it holds access
  information only, with no additional usage terms or restrictions. No permission and no expiry date is inferred
  from its silence; Qloo's developer guide for the credential and Qloo's Terms of Use stay the authority.
- Still uncertain (not an owner action): the credential's actual deactivation moment. The guide says keys stay
  active through the end of the programme's review period; the email gives no date. Kept as RISK-CREDENTIAL-END.
- Preserved: the credential is for the programme only; afterwards the public app runs as the labelled fictional
  demonstration for portfolio use (NEXT.md "When the Qloo credential ends"). RISK-CPU stays open as a watch item.
- Documentation and ledger only; no code, configuration, or deployment change. `npm run check` exit 0 (69 unit,
  49 integration, eval 60/60 checks, build); `npm run scan:secrets` clean (135 tracked files). P10-03 and P10 closed.
- Pushed b0cde9f; GitHub Actions 38999856845 success. Deployed Worker unchanged (1c4b8f19): no source change.
