# Architecture decisions

Format: We chose … because …; alternative …; trade-off ….

## ADR-001 Single package, single Worker
We chose one npm package with `src/client`, `src/worker`, and `src/shared` deployed as one Cloudflare
Worker that serves static assets and `/api/*`, because it keeps the browser and API same-origin, keeps
one lockfile, and fits the Workers Free plan without a second service; alternative: npm workspaces with
separate web and API packages; trade-off: less isolation between client and server build settings,
which we manage with separate `tsconfig` files.

## ADR-002 Deterministic domain engine shared by browser and Worker
We chose to implement feasibility, the Agreement Frontier, and Decision Reversal as pure TypeScript in
`src/shared/domain`, because what-if edits must recompute instantly without network calls or Qloo quota
and every decision must be reproducible from its inputs; alternative: server-only evaluation; trade-off:
the browser bundle carries the engine (small), and the Worker re-validates anything it persists.

## ADR-003 npm as package manager
We chose npm because it ships with Node.js LTS and avoids an extra bootstrap step for contributors;
alternative: pnpm; trade-off: slower installs.

## ADR-004 Domain engine lives in src/shared, not src/worker
We chose `src/shared/domain` because the browser must recompute what-if edits instantly; alternative: a
worker-only domain folder; trade-off: shared code must avoid Worker- and DOM-specific APIs, which the separate
tsconfig projects enforce.

## ADR-005 Integration tests with Wrangler getPlatformProxy
We chose to run the real Hono app in Vitest (Node) against a real local D1 from `getPlatformProxy` because
`@cloudflare/vitest-pool-workers` 0.23 requires Vitest 4 while the project uses Vitest 5; alternative: pin
Vitest 4; trade-off: tests run in Node rather than workerd, so Playwright runs against the Vite Cloudflare
plugin (workerd) cover runtime parity.

## ADR-006 Qloo access through documented HTTPS routes only
We chose a small typed client for `/search`, `/v2/tags` and `/v2/insights`, verified against Qloo's public
docs and its published client's request conventions, because Workers cannot spawn the CLI harness;
alternative: a separate always-on server running the harness; trade-off: needs owner confirmation that direct
API access is permitted for the issued credential (EXT-QLOO-ACCESS).

## ADR-007 Uncertain matches are disclosed, never used as signals
We chose to pass only exact entity and tag matches into later Qloo requests because an approximate match can
silently change the meaning of a result; alternative: use the top search result; trade-off: some runs return
fewer signals, which we disclose in the run's limitations.

## ADR-008 Rate limits and quota ceilings in D1
We chose D1 fixed-window counters keyed by a daily-rotating hash of the client because the Workers Rate
Limiting binding's availability on the Free plan is not documented; alternative: the binding; trade-off: one
D1 write per throttled request, well inside D1 Free's 100,000 daily writes for expected traffic.

## ADR-009 Optional Gemini narrative is opt-in per request
We chose to disable narrative drafting unless an operator sets GEMINI_API_KEY and GEMINI_MODEL, and to require
explicit visitor consent per request, because Google's free tier states submitted content may be used to
improve its products; alternative: always-on summaries; trade-off: most visitors see the deterministic brief only.
