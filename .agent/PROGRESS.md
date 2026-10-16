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
