# API

All routes are same-origin under `/api`. Bodies are JSON (`Content-Type: application/json`), at most 32 KB,
and validated by strict Zod schemas in `src/shared/schemas`; unknown fields are rejected. Errors look like:

```json
{ "error": { "code": "validation_failed", "message": "Check these fields: scenario.guest.maxOutlayUsd.", "requestId": "…" } }
```

Every response carries `X-Request-Id`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and
`Referrer-Policy: no-referrer`. Cross-origin `POST`, `PUT`, and `DELETE` requests are refused with `403`.

## Room for Both routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Liveness, engine version, research mode (`live`/`fixture`), whether storage is bound. No configuration values. |
| `GET` | `/api/config` | Public runtime settings for the client: research mode, call budget, whether narrative drafts and host links are enabled. |
| `POST` | `/api/evaluate` | `{ scenario }` → `{ evaluation }`. Pure, deterministic; the same function the browser runs. |
| `POST` | `/api/research` | Bounded cultural research. Streams `application/x-ndjson` events (below). Rate limited per client and capped by a daily upstream ceiling. |
| `POST` | `/api/host-requests` | `{ summary }` → `201 { requestId, hostToken, ownerToken, expiresAt, editsAllowed }`. Limited to 10 per client per hour. |
| `GET` | `/api/host-requests/respond` | Host view of a request. `Authorization: Bearer <hostToken>`. |
| `PUT` | `/api/host-requests/respond` | Host answers `{ host }` (no `source` field; the server sets it). At most 3 saves per link. |
| `GET` | `/api/host-requests/:id` | Guest view of the host's answers. `Authorization: Bearer <ownerToken>`. |
| `DELETE` | `/api/host-requests/:id` | Guest withdraws the link and deletes the host's answers. |
| `POST` | `/api/narrative` | Optional. `{ facts, consent: true }` → `{ summary, provenance: "llm_interpretation", model }`. `501` unless configured. |

Unknown, expired, revoked, and wrong-token host-link lookups all return the same `404`.

### Research stream events

```text
{"type":"plan","mode":"live","steps":[{"id":"resolve_seeds","label":"…"}, …]}
{"type":"step","step":{"id":"resolve_seeds","tool":"resolve_entity","status":"done","calls":2,"summary":"2 of 2 references matched exactly.","durationMs":412}}
…
{"type":"result","run":{ … ResearchRun … }}
```

or, on a fatal upstream error, `{"type":"error","code":"rate_limited","message":"…","retryable":true}`.

## Qloo routes used

Verified against Qloo's public documentation (docs.qloo.com and its public docs repository) and the request
conventions of Qloo's published client package. Authentication is the `X-Api-Key` header; list parameters
are comma-separated; the default host is Qloo's documented production URL, overridable with
`QLOO_BASE_URL` (restricted to `https` on `qloo.com` hosts).

| Step | Route | Parameters we send | Fields we read |
|------|-------|--------------------|----------------|
| Match a cultural reference | `GET /search` | `query`, `types` (entity URN), `take=5` | `results[].entity_id` (or `id`), `name`, `types`, `popularity` |
| Match a venue category | `GET /v2/tags` | `filter.query`, `take=10` | `results.tags[].id` (or `tag_id`), `name`, `type` |
| Rank venues | `GET /v2/insights` | `filter.type=urn:entity:place`, `filter.tags`, `filter.location.query`, `signal.interests.entities`, `feature.explainability=true`, `take` | `results.entities[]`: `entity_id`, `name`, `properties.address`, `location`, `tags`, `query.affinity`, `query.explainability` |
| Cultural bridge | `GET /v2/insights` | `filter.type` (`urn:entity:book`, `urn:entity:artist`, `urn:entity:podcast`, or `urn:tag`), `signal.interests.entities`, `take=8` | entities or `results.tags[]` with `query.affinity` |

Documented behaviours we rely on: `404` means no results (treated as empty), `400` when a locality query is
not found, `429` for rate limits. Affinity scores are 0–1 and relative to the query; Qloo's published
reading is above 0.8 very high, 0.6–0.8 high, lower values weaker.

We do not store or redistribute Qloo responses. The only server-side reuse is a six-hour, per-isolate cache of
the tag ID for each venue category, which avoids repeating an identical lookup.
