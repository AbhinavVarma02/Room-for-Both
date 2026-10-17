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

## ADR-010 Live Qloo access on the credential's documented host, by direct HTTPS
We chose to call the documented routes directly from the Worker on the single host named in the credential's
issuing guide, because Qloo's developer guide for this credential documents exactly that method (`X-Api-Key`
header, curl and Python examples) and states the key is rejected elsewhere; alternative: Qloo's CLI or MCP
harness, which cannot run in a Worker and whose "serverless not supported" note concerns the MCP server only;
trade-off: the host is configuration, not code, and the credential is time-limited, so the app must degrade
honestly when it ends (ADR-012). Supersedes the open question in ADR-006.

## ADR-011 Pace upstream calls and size the daily ceiling to the monthly allowance
We chose to space calls from an isolate by 250 ms, retry a 429 once after Qloo's reported reset, stop on an
exhausted monthly allowance, and lower the daily ceiling from 1,500 to 300 calls, because authenticated
headers report 5 calls per second and 10,000 per month and a research run's quick sequential calls hit the
per-second limit; alternative: retry harder or raise the budget; trade-off: a run takes about 2 s, and about
40 live runs a day are possible before visitors are offered the fictional demonstration.

## ADR-012 One mode per run, and a visitor-selectable fictional demonstration
We chose to let the research request ask for the fictional demonstration (`demo: true`), offered when live
access is rejected or unavailable, and to keep each run entirely live or entirely fictional with its mode
carried into the brief, because users must never see fictional and Qloo results mixed or a live label on
fictional data; alternative: silently fall back to fixtures; trade-off: one more request shape, and demo runs
still count towards the per-client limit.

## ADR-013 Read upstream fields with type checks instead of per-item schema parsing
We chose direct type checks in the Qloo normaliser, stopping at the twelve thematic tags we keep, because a
live run carries about 1,500 nested tags and per-item schema parsing pushed research CPU well past the
Workers Free limit; alternative: keep Zod for upstream items; trade-off: hand-written checks, covered by unit
tests built from synthetic payloads shaped like observed responses. Request bodies are still validated with Zod.

## ADR-014 Disclose substitutions instead of guessing: venue-category proxies and the bridge fallback
We chose to search Qloo's nearest category for the two labels with no exact tag ("Clothing boutique" as
"Clothing store", "Plant shop" as "Plant nursery"), and to fall back to taste tags scoped by
`filter.parents.types` when a cross-domain lookup is rejected, stating both in the run's limitations, because
authenticated tag searches and responses showed these gaps; alternative: skip discovery for those categories,
or use unscoped taste tags (which mixed payment and TV tags into results); trade-off: the category searched can
be broader than the visitor's label.

## ADR-015 Gemini on the free tier only, from a project without billing
We chose `gemini-3.5-flash-lite` with a Google AI Studio key from a project whose billing is disabled, because
that guarantees no charge and the model is listed as free; alternative: a newer or larger model; trade-off:
free-tier quota (15 per minute, 500 per day) and Google may use submitted content, so consent stays per request
and the app ceiling (300 a day) sits under the quota.
