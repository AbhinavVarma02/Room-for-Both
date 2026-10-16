# Blockers

No secret values or login details are ever written here.

## Open

| ID | Affects | Why blocked | Needs | Safe continuation | Unblocking action | Status |
|----|---------|-------------|-------|-------------------|-------------------|--------|
| EXT-QLOO-KEY | P2-05, P4-06, P7-05, P7-08 (live), P8-05, release | The owner has requested Qloo API access; approval is pending and may take several business days. No key is available | Repository owner | The deployed app runs in labelled fixture mode; adapter verified against a synthetic upstream; live smoke test, host probe, live evaluation and CPU script are ready and report BLOCKED without a key | Follow `.agent/NEXT.md` "When the Qloo credential arrives" | open |
| EXT-QLOO-ACCESS | release | Qloo's starter kit lists its CLI/MCP harness as the supported access surfaces for issued credentials and says serverless functions are not a supported route for its MCP server. It does not say whether direct HTTPS calls to the documented API from a server are permitted | Repository owner, to confirm with Qloo | All requests use documented routes, server-side only, within a per-run budget and daily ceiling | Ask Qloo support (or the credential issuer) to confirm direct server-side HTTPS access for the credential; record the answer in DECISIONS.md | open |
| EXT-QLOO-HOST | live verification | Qloo's public docs and official client name `api.qloo.com` (production) and `staging.api.qloo.com`. Issued credentials may be scoped to another `qloo.com` host. All candidate hosts exist and reject unauthenticated calls, so only a real key can show which one accepts it | Credential | The client accepts any `https` host on `qloo.com`; `npm run smoke:live` probes candidates with one call each | Resolved by the host probe once the key exists; set `QLOO_BASE_URL` to the accepted host | open (depends on EXT-QLOO-KEY) |
| EXT-CF-PLAN | infrastructure gate | The account's billing plan cannot be read with Wrangler's sign-in (subscriptions API returns 403 without billing scope) | Repository owner | Usage is designed for Workers Free and D1 Free limits; no billing setting has been touched | Check Workers & Pages → Plans (or Manage account → Billing → Subscriptions) in the dashboard and confirm "Free" | open |
| EXT-GEMINI-KEY | P4-05 live check | Optional feature; no key | Repository owner, only if a no-cost model is available | Deterministic summaries are the default | Set `GEMINI_API_KEY` and `GEMINI_MODEL` as Worker secrets | optional |

## Resolved

| ID | Resolution |
|----|------------|
| EXT-GH-CLI | The owner created the public repository; pushes work through Git Credential Manager. The GitHub CLI install was cancelled at the elevation prompt and is not required. |
| EXT-CF-AUTH | `wrangler login` completed; D1 created and migrated; Worker deployed. |
