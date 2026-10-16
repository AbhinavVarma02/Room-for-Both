# Next actions

Restart: open the repository root and follow "Start of every session" in `CLAUDE.md`.

## Current state (frozen)

The application is stable and frozen. Architecture and feature scope do not change; the only planned work is the
live Qloo integration below, plus fixes for defects it uncovers. Do not add features, redesign the client, add
frameworks or paid infrastructure, or recreate Cloudflare resources.

Already done (do not repeat): public repository `AbhinavVarma02/Room-for-Both` is `origin` and CI is green; Cloudflare
login works; D1 `room-for-both` exists with migrations applied; the Worker is deployed at
https://room-for-both.room-for-both.workers.dev in labelled fixture mode with the `CLIENT_KEY_SALT` secret set. The
offline health check (PROGRESS #6) passed: `npm run check`, `npm run scan:secrets`, Playwright 22/22, `verify:public` 9/10
(only the live-mode check fails, as expected).

Before starting, confirm a credential exists with the smallest safe test: `QLOO_API_KEY` is non-empty in `.dev.vars`
(never print it). If it is empty, stop: there is nothing to do until the owner adds it.

## When the Qloo credential arrives (EXT-QLOO-KEY)

1. Owner puts `QLOO_API_KEY=` in the local `.dev.vars`. That file already lists candidate hosts in
   `QLOO_CANDIDATE_BASE_URLS`; add the host named in the credential instructions if it differs.
2. `npm run smoke:live`: the host probe spends one call per candidate, at most 3. Then it checks response
   structures and runs one bounded research run (at most 7 calls). Fix any normaliser mismatch it reports, then
   `npm run check`. This resolves EXT-QLOO-HOST.
3. Owner sets Worker secrets interactively: `npx wrangler secret put QLOO_API_KEY` and
   `npx wrangler secret put QLOO_BASE_URL` (the accepted host).
4. `npm run deploy`, then `npm run verify:public -- https://room-for-both.room-for-both.workers.dev`. Every check
   should pass, including live mode.
5. `npm run eval -- --live`: three bounded runs; aggregate results go to an ignored file. Copy the measured numbers
   into `docs/evaluation.md`.
6. `npm run measure:cpu -- <url>`: re-measure CPU with real payloads. If warm research regularly exceeds 10 ms,
   split research into two requests (resolve, then discover/bridge). Never upgrade.
7. Re-run `E2E_BASE_URL=<url> npm run test:e2e`. The fixture banner assertions will change to live; update them.
   Research is limited to 12 runs per client per hour; if a run returns 429 `rate_limited`, wait for the next hour.
8. Update README (remove the "fixture mode" note), STATE.json, TASKS.md, RELEASE_CHECKLIST, and
   `.local/external-entry-packet.md`. Mark P2-05, P4-06, P7-05, P7-08, P8-05, P8-06 `verified_complete` only with
   live evidence in PROGRESS.md.

## Independent of the credential

- EXT-QLOO-ACCESS: owner confirms with Qloo that direct server-side HTTPS calls are permitted for the credential;
  record the answer in DECISIONS.md.
- EXT-CF-PLAN: owner confirms the Free plan in the dashboard (Workers & Pages → Plans). Wrangler cannot read billing.

## Optional, not release-critical

- P4-05: Gemini narrative live check, only if a no-cost model key is available (EXT-GEMINI-KEY).
- P6-09: map view. Not planned while scope is frozen.
