# Upgrade: next actions

## Next session: do this first

1. Read `CLAUDE.md`, then this file, `UPGRADE_STATE.json`, `UPGRADE_TASKS.md`, `UPGRADE_BLOCKERS.md`, and the tail of
   `UPGRADE_PROGRESS.md`.
2. `git status`, `git branch --show-current` (expect `upgrade/selected-venue-journey`), `git log --oneline -10`,
   `git fetch origin`. The actual Git HEAD is authoritative; the ledger may lag by one commit.
3. Production must stay on the rollback reference in `UPGRADE_STATE.json` (`rollback.production_version`) until the
   upgrade passes every gate in `UPGRADE_TASKS.md` U8. Check with `curl -s <url>/api/health`.
4. Continue the first task in `UPGRADE_TASKS.md` whose state is `in_progress`, else the first `pending` task whose
   dependencies are `verified_complete`.

## Current position

U1–U3 core is committed (selected-venue journey, category-only comparison, venue-side bridge). Next: U4 (bounded
planner), then U5 (guided demonstration), U6 (CPU). See `UPGRADE_TASKS.md`.

## Rules that apply to every step

- Live Qloo calls are scarce (5/s, 10,000/month, app ceiling 300/day). Offline tests use the synthetic upstream.
  Record every live call count in `UPGRADE_PROGRESS.md`.
- Local runs without live quota: `npm run dev:fixture` (Vite `--mode fixture` loads the git-ignored
  `.dev.vars.fixture`, which holds empty credential entries). Plain `npm run dev` and the default Playwright web
  server read `.dev.vars` and run live.
- Never deploy to production before U8 passes. Candidate checks use `wrangler versions upload` (no traffic) where
  preview URLs are available.
