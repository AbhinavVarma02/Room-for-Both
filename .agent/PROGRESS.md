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
