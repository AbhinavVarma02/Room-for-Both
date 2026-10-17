# Blockers

No secret values or login details are ever written here.

## Open

None. Both owner confirmations were received and are recorded under Resolved (PROGRESS #8).

## Watch items (not blockers)

| ID | Item | Evidence | Trigger | Planned response |
|----|------|----------|---------|------------------|
| RISK-CPU | Live research uses 16–25 ms CPU against the Free plan's nominal 10 ms | PROGRESS #7: `measure:cpu`; Cloudflare analytics show 0 CPU terminations in 183 requests | Any `exceededCpu` outcome or Error 1102 in the dashboard or `wrangler tail` | Split `/api/research` into two bounded requests (references and category; venues and bridge). Never upgrade the plan |
| RISK-QLOO-QUOTA | Credential allows 10,000 calls a month and 5 per second | Response headers (PROGRESS #7) | `quota_exhausted` events in logs | Daily ceiling is 300 calls; visitors get the fictional demonstration when it is reached |
| RISK-CREDENTIAL-END | The Qloo credential is time-limited and limited to the programme it was issued for. Its actual deactivation moment is unknown: the guide says keys stay active through the end of the programme's review period and are deactivated afterwards, and the issuing email states no date. No expiry date and no permission beyond the guide is inferred | Qloo's developer guide for the credential; owner review of the issuing email (EXT-QLOO-EMAIL) | Live research returns `auth` errors, or the programme's review period ends, whichever comes first | Follow `.agent/NEXT.md` "When the Qloo credential ends": remove the secrets and keep the public app as a fictional demonstration for portfolio use. Never reuse recorded Qloo results |

Optional, never release-critical: P6-09 (map view).

## Resolved

| ID | Resolution |
|----|------------|
| EXT-CF-PLAN | The owner visually verified Cloudflare billing in the dashboard: Workers Free, Active, with no payment method on file (PROGRESS #8). Owner-observed; the agent's Wrangler token still cannot read the subscription, and no billing setting was touched. |
| EXT-QLOO-EMAIL | The owner reviewed the email that delivered the Qloo credential: it contains access information only, with no additional usage terms or restrictions (PROGRESS #8). Its silence grants no extra permission and sets no expiry date: Qloo's developer guide for the credential and Qloo's Terms of Use remain the documented authority, including the programme-only scope and deactivation after the programme's review period (RISK-CREDENTIAL-END). |
| EXT-QLOO-KEY | The owner obtained a Qloo credential and placed it in the local `.dev.vars`. Authenticated calls succeed (PROGRESS #7). |
| EXT-QLOO-HOST | Qloo's developer guide for the credential names one valid host and states the key is rejected on the production and staging hosts. The configured `QLOO_BASE_URL` is that host; it accepted the key on the first probe. Only that host is used; no other environment was probed. |
| EXT-QLOO-ACCESS | The same guide documents direct HTTPS calls to the documented routes with the `X-Api-Key` header (its own curl and Python examples), which is what the Worker does. The earlier "serverless is not supported" note concerns Qloo's MCP server, which this app does not use. Recorded in DECISIONS ADR-010. |
| EXT-GEMINI-KEY | The owner created a Google AI Studio key. It belongs to a project with billing disabled (read-only `gcloud billing projects describe`), is restricted to the Generative Language API, and lists `gemini-3.5-flash-lite`. Free-tier quota for the project: 15 requests per minute, 500 per day. Live checks pass (PROGRESS #7). |
| EXT-GH-CLI | The owner created the public repository; pushes work through Git Credential Manager. The GitHub CLI is not required. |
| EXT-CF-AUTH | `wrangler login` completed; D1 created and migrated; Worker deployed. |
