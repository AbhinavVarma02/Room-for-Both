# Next actions

Restart: open the repository root and follow "Start of every session" in `CLAUDE.md`.

Already done (do not repeat): public repository `AbhinavVarma02/Room-for-Both` is `origin`, CI is green, Cloudflare
login works, D1 `room-for-both` exists with migrations applied, and the Worker is deployed at
https://room-for-both.room-for-both.workers.dev in labelled fixture mode with the `CLIENT_KEY_SALT` secret set.

## When the Qloo credential arrives (EXT-QLOO-KEY)

1. Owner puts `QLOO_API_KEY=` in the local `.dev.vars`. That file already lists candidate hosts in
   `QLOO_CANDIDATE_BASE_URLS`; add the host named in the credential instructions if it differs.
2. `npm run smoke:live`: the host probe spends one call per candidate, at most 3. Then it checks response
   structures and runs one bounded research run (at most 7 calls). Fix any normaliser mismatch it reports.
3. Owner sets Worker secrets interactively: `npx wrangler secret put QLOO_API_KEY` and
   `npx wrangler secret put QLOO_BASE_URL` (the accepted host).
4. `npm run deploy`, then `npm run verify:public -- https://room-for-both.room-for-both.workers.dev`. Every check
   should pass, including live mode.
5. `npm run eval -- --live`: three bounded runs; aggregate results go to an ignored file. Copy the measured numbers
   into `docs/evaluation.md`.
6. `npm run measure:cpu -- <url>`: re-measure CPU with real payloads. If warm research regularly exceeds 10 ms,
   split research into two requests (resolve, then discover/bridge). Never upgrade.
7. Re-run `E2E_BASE_URL=<url> npm run test:e2e`. The fixture banner assertions will change to live; update them.
8. Update README (remove the "fixture mode" note), STATE.json, RELEASE_CHECKLIST, and `.local/external-entry-packet.md`.

## Independent of the credential

- EXT-QLOO-ACCESS: owner confirms with Qloo that direct server-side HTTPS calls are permitted for the credential.
- EXT-CF-PLAN: owner confirms the Free plan in the dashboard (Workers & Pages → Plans). Wrangler cannot read billing.
- Optional, not planned: map view (P6-09).
