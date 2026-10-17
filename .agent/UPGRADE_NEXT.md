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

Phase U1 (selected-venue journey). See `UPGRADE_TASKS.md` for the active task.

## Rules that apply to every step

- Live Qloo calls are scarce (5/s, 10,000/month, app ceiling 300/day). Offline tests use the synthetic upstream.
  Record every live call count in `UPGRADE_PROGRESS.md`.
- Local Playwright runs read `.dev.vars` and therefore run in live mode. Run them in fixture mode unless a live
  check is the point: `QLOO_API_KEY= GEMINI_API_KEY= npx playwright test` does not work because the Vite
  Cloudflare plugin reads `.dev.vars` directly; use `CLOUDFLARE_ENV` or the fixture-mode procedure recorded in
  `UPGRADE_PROGRESS.md` once established.
- Never deploy to production before U8 passes. Candidate checks use `wrangler versions upload` (no traffic) where
  preview URLs are available.
