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
