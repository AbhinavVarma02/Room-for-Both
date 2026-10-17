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
