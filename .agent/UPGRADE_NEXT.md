# Upgrade: next actions

## Next session: do this first

The upgrade is complete, verified, and deployed (UPGRADE_PROGRESS #11). There is no unfinished engineering task.

1. Read `CLAUDE.md`, then `.agent/NEXT.md` for the routine check; this upgrade ledger is history.
2. `git status`; `git log --oneline -5` on `main`; GitHub Actions for the latest SHA; `curl -s <url>/api/health`
   (expect research `live`, planner `modelAvailable: true`).
3. If something is wrong in production: `npx wrangler rollback 1c4b8f19-a82a-402d-abf8-1cacd6bd13e3` restores the
   pre-upgrade version (secrets and D1 unaffected), then `npm run verify:public -- <url>`.

## Owner actions (not engineering)

- Submit the external entry form yourself; the draft is `.local/devpost-description.md`.
- Fill the repository's About section; steps in `.local/github-about.md`.
- Optional: send `.local/qloo-quota-request.md` through the documented support channel.

## Watch items

RISK-CPU, RISK-QLOO-QUOTA, RISK-CREDENTIAL-END in `.agent/BLOCKERS.md`. Measure a version's CPU with
`npm run cpu:analytics -- --minutes 1440` or `npm run measure:cpu:windows` (see `docs/deployment.md`).
