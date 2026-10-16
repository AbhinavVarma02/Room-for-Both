# Next actions

Restart: open the repository root, follow "Start of every session" in `CLAUDE.md`. All offline gates are green;
remaining work is external. Check each capability before retrying (smallest safe probe first).

1. **GitHub (P8-01, P8-02).** Probe: `gh auth status`. If authenticated: `gh repo view room-for-both` (must not exist,
   or must be the owner's empty repo), then `gh repo create room-for-both --public --source . --remote origin --push`.
   Verify with `git ls-remote origin main`, record URL and SHA in STATE.json, set `VITE_REPOSITORY_URL` in `.env`.
   Check the CI run with `gh run list --limit 1`.
2. **Cloudflare (P8-03, P8-04).** Probe: `npx wrangler whoami` (confirm a Free-plan account; never upgrade). Then
   `npx wrangler d1 create room-for-both`, put the `database_id` in `wrangler.jsonc`, `npm run db:migrate:remote`.
3. **Secrets (P8-05).** The owner runs `npx wrangler secret put QLOO_API_KEY` and `npx wrangler secret put CLIENT_KEY_SALT`
   interactively. Never ask for the values in chat.
4. **Deploy and verify (P8-06).** `npm run deploy`, then `npm run verify:public -- <workers.dev URL>`. Record the URL.
5. **Live checks (P2-05, P4-06, P7-05, P7-08).** With a key in `.dev.vars`: `npm run smoke:live`, `npm run eval -- --live`.
   Read Worker CPU time from Cloudflare observability. Update `docs/evaluation.md` with measured live results.
6. **Docs (P9-01, P9-04).** Add the verified public URL to README; complete `.local/external-entry-packet.md`.
7. Optional: P6-09 map for verified coordinates (MapLibre + OpenFreeMap; CSP must allow the tile host).
