# Blockers

No secret values or login details are ever written here.

## Open (owner actions; no engineering work waits on them)

| ID | Affects | Why open | Needs | Safe continuation | Unblocking action | Status |
|----|---------|----------|-------|-------------------|-------------------|--------|
| EXT-CF-PLAN | infrastructure gate, P10-03 | The account's billing plan cannot be read with Wrangler's sign-in (subscriptions API returns 403 without billing scope). Usage is designed for Workers Free and D1 Free, and no billing setting has been touched | Repository owner | Nothing paid is configured: bindings are D1, one cron, observability; no paid products | Check Workers & Pages → Plans (or Manage account → Billing → Subscriptions) in the dashboard and confirm "Free" | open |
| EXT-QLOO-EMAIL | compliance gate, P10-03 | The Qloo credential's terms were taken from Qloo's developer guide for the credential programme and Qloo's Terms of Use. The credential email itself was not available to the agent (no matching message in the connected mailbox) | Repository owner | Live use follows the guide: documented host, direct HTTPS with `X-Api-Key`, documented routes, server-side only, paced under the reported limits | Read the email that delivered the key and confirm it adds no restriction beyond the guide, in particular on (a) server-side calls from a public web app and (b) the active period covering the full external review period. If it does, follow `.agent/NEXT.md` "If the credential's terms differ" | open |

## Watch items (not blockers)

| ID | Item | Evidence | Trigger | Planned response |
|----|------|----------|---------|------------------|
| RISK-CPU | Live research uses 16–25 ms CPU against the Free plan's nominal 10 ms | PROGRESS #7: `measure:cpu`; Cloudflare analytics show 0 CPU terminations in 183 requests | Any `exceededCpu` outcome or Error 1102 in the dashboard or `wrangler tail` | Split `/api/research` into two bounded requests (references and category; venues and bridge). Never upgrade the plan |
| RISK-QLOO-QUOTA | Credential allows 10,000 calls a month and 5 per second | Response headers (PROGRESS #7) | `quota_exhausted` events in logs | Daily ceiling is 300 calls; visitors get the fictional demonstration when it is reached |
| RISK-CREDENTIAL-END | The Qloo credential is time-limited | Qloo's developer guide for the credential | Live research returns `auth` errors | Follow `.agent/NEXT.md` "When the Qloo credential ends" |

Optional, never release-critical: P6-09 (map view).

## Resolved

| ID | Resolution |
|----|------------|
| EXT-QLOO-KEY | The owner obtained a Qloo credential and placed it in the local `.dev.vars`. Authenticated calls succeed (PROGRESS #7). |
| EXT-QLOO-HOST | Qloo's developer guide for the credential names one valid host and states the key is rejected on the production and staging hosts. The configured `QLOO_BASE_URL` is that host; it accepted the key on the first probe. Only that host is used; no other environment was probed. |
| EXT-QLOO-ACCESS | The same guide documents direct HTTPS calls to the documented routes with the `X-Api-Key` header (its own curl and Python examples), which is what the Worker does. The earlier "serverless is not supported" note concerns Qloo's MCP server, which this app does not use. Recorded in DECISIONS ADR-010. |
| EXT-GEMINI-KEY | The owner created a Google AI Studio key. It belongs to a project with billing disabled (read-only `gcloud billing projects describe`), is restricted to the Generative Language API, and lists `gemini-3.5-flash-lite`. Free-tier quota for the project: 15 requests per minute, 500 per day. Live checks pass (PROGRESS #7). |
| EXT-GH-CLI | The owner created the public repository; pushes work through Git Credential Manager. The GitHub CLI is not required. |
| EXT-CF-AUTH | `wrangler login` completed; D1 created and migrated; Worker deployed. |
