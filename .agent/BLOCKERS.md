# Blockers

No secret values or login details are ever written here.

| ID | Affects | Why blocked | Needs | Safe continuation | Unblocking action | Status |
|----|---------|-------------|-------|-------------------|-------------------|--------|
| EXT-QLOO-KEY | P2-05, P4-06, P7-05, P8-05, P8-06, release | No Qloo API key or API host is available to the build environment | Repository owner with an authorised Qloo developer key | Adapter built against official docs; synthetic fixtures and visibly labelled fixture mode for all offline tests | Put `QLOO_API_KEY` and `QLOO_BASE_URL` in `.dev.vars` (local) and run `npx wrangler secret put QLOO_API_KEY` / `QLOO_BASE_URL` (deployed); then `npm run smoke:live` | open |
| EXT-GH-CLI | P1-07, P8-01, P8-02 | GitHub CLI is not installed in this environment | Repository owner | Local commits continue; CI workflow written and validated locally | `winget install --id GitHub.cli`, then `gh auth login` in an interactive terminal | open |
| EXT-CF-AUTH | P8-03 – P8-06, P7-08 | Cloudflare login not yet confirmed | Repository owner with a Cloudflare account on the Free plan | Full local emulation via the Vite Cloudflare plugin and Miniflare | `npx wrangler login`, then `npx wrangler whoami` | open (check pending) |
| EXT-GEMINI-KEY | P4-05 live check (optional) | No Gemini developer key; optional feature | Repository owner, only if a no-cost model is available on their account | Deterministic explanations are the default supported mode | Put `GEMINI_API_KEY` and `GEMINI_MODEL` in `.dev.vars` / Worker secrets | optional |
