# Next actions

Restart: open the repository root and follow "Start of every session" in `CLAUDE.md`.

## Current state

Live Qloo discovery and the optional Gemini summary are verified locally and on the public deployment
(PROGRESS #7). Scope is frozen: only monitoring, defect fixes, and the credential transition below are in scope.
Do not add features, redesign the client, add frameworks or paid infrastructure, or recreate Cloudflare resources.

Production: https://room-for-both.room-for-both.workers.dev (upgrade release, version 2c5d1b4f; pre-upgrade
rollback target 1c4b8f19, see `.agent/UPGRADE_STATE.json`). Worker secrets (names only): `CLIENT_KEY_SALT`,
`QLOO_API_KEY`, `QLOO_BASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`. The deployed Worker version and Git SHA are
in `STATE.json`.

## Routine check (spend as little quota as possible)

1. `git status`, `git log --oneline -5`, GitHub Actions for the latest SHA (public API).
2. `curl -s <url>/api/health`: expect `research.mode` `live` and `narrative.enabled` `true`.
3. `npm run verify:public -- <url>` (one live research run, about 7 Qloo calls). A full guided run in the browser
   spends up to 9 Qloo calls; `npm run smoke:planner` spends 2 model calls and no Qloo calls.
4. Only if code changed: `npm run check`, `npx playwright test`, then `E2E_BASE_URL=<url> npx playwright test`
   (two live runs and two summaries). The per-client research limit is 12 runs an hour; on HTTP 429
   `rate_limited`, wait for the next UTC hour.
5. Watch items in BLOCKERS.md: look for `exceededCpu` / Error 1102 (RISK-CPU) and `quota_exhausted` (RISK-QLOO-QUOTA).

## Owner actions

None open. EXT-CF-PLAN and EXT-QLOO-EMAIL were confirmed by the owner (PROGRESS #8). The credential's actual
deactivation moment is still unknown (RISK-CREDENTIAL-END): watch for `auth` errors and do not assume a date.

## If the credential's terms differ from the developer guide

If the owner reports that server-side use from a public app is not permitted, or that the active period is
shorter than required: run `npx wrangler secret delete QLOO_API_KEY` (the app switches to the labelled fictional
demonstration), record the terms in DECISIONS.md, update `docs/data-licensing.md`, and mark the compliance gate
in RELEASE_CHECKLIST.md as blocked. Do not look for workarounds.

## When the Qloo credential ends

Signal: research streams return `auth` errors (visitors see "Live Qloo access is not authorized right now").

1. Confirm with one call: `npm run smoke:live` should report the host as rejected (HTTP 401/403).
2. `npx wrangler secret delete QLOO_API_KEY` and `npx wrangler secret delete QLOO_BASE_URL`.
3. `curl -s <url>/api/health` shows `research.mode` `fixture`; `E2E_BASE_URL=<url> npx playwright test` passes in
   fixture mode (the journeys read the server mode).
4. Update README's "Live app" line and `docs/data-licensing.md` to say live discovery has ended, and record it
   in PROGRESS.md and STATE.json. Never reuse recorded Qloo results to imitate live access.
5. The public app stays available as a labelled fictional demonstration for portfolio use. The credential is
   limited to the programme it was issued for, so neither it nor any recorded result is used after the programme.
6. If the owner later obtains separately authorised access, set the new secrets and repeat the routine check.

## If CPU terminations appear (RISK-CPU)

Split `/api/research` into two bounded requests: (1) resolve references and category, (2) find venues and build
the bridge, passing the resolved IDs from the first response. Keep the plan and step events identical for the
client, re-measure with `npm run measure:cpu -- <url>`, and never upgrade the plan.

## Optional, not release-critical

- P6-09: map view. Not planned while scope is frozen.
