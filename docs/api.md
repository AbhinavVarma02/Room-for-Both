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
| `GET` | `/api/health` | Liveness, engine version, research mode (`live`/`fixture`), whether summaries are enabled and storage is bound. No configuration values. |
| `GET` | `/api/config` | Public runtime settings for the client: research mode, call budget, whether narrative drafts and host links are enabled. |
| `POST` | `/api/evaluate` | `{ scenario }` → `{ evaluation }`. Pure, deterministic; the same function the browser runs. |
| `POST` | `/api/research` | Bounded cultural research. Streams `application/x-ndjson` events (below). `"demo": true` runs the labelled fictional demonstration without calling Qloo. `"planner": "model"` with `"plannerConsent": true` lets the model propose decisions (validated; rules are the fallback). Rate limited per client (12 runs per hour) and capped by a daily upstream ceiling. |
| `POST` | `/api/research/baseline` | Category-only discovery: `{ categoryTagId, categoryName, location, venueCategory, demo? }` from a previous run → `{ mode, candidates, depth, provenance, callsUsed, limitations }`. One upstream call, no taste signal, 10 venues. |
| `POST` | `/api/research/venue-bridge` | Venue side of the bridge: `{ venueId, venueName, venueCategory, domain?, demo? }` → `{ mode, domain, items, provenance, callsUsed, limitations }`. One upstream call with the venue's own entity as the signal. `400 no_venue_domain` for categories without a cross-domain type. |
| `POST` | `/api/research/sensitivity` | Reference sensitivity: `{ categoryTagId, categoryName, location, venueCategory, signals[{ id, label }] (2–3), take, demo? }` from a previous run → `{ mode, variants[{ omitted, status, candidates, provenance }], callsUsed, limitations }`. One upstream call per reference, each repeating the taste-informed search without that reference; a failed variant is returned as `failed` with no candidates. The whole check is reserved against the daily ceiling first. |
| `POST` | `/api/research/llm-baseline` | Optional. `{ seeds, city, neighborhood?, venueCategory, guestCategories, consent: true }` → `{ model, venues[{ name, reason }], discarded, provenance: "llm_interpretation", limitations }`. One model call, no Qloo data; 6 per client per hour. `501` unless configured. |
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
{"type":"decision","decision":{"point":"bridge","planner":"model","proposed":"Build the bridge from podcasts","accepted":true,"reason":"Accepted: …","executed":"Build the bridge from podcasts","rationale":"…","fallback":false,"ms":1210}}
…
{"type":"result","run":{ … ResearchRun … }}
```

or, on a fatal upstream error, `{"type":"error","code":"…","message":"…","retryable":…}`. Codes: `auth` (credential
rejected; live access not authorised), `rate_limited`, `quota_exhausted` (monthly allowance used up),
`upstream_unavailable`, `timeout`, `network`, `upstream`, `malformed`, `not_configured`. Before the stream starts,
the route can also answer `429 rate_limited` (this app's per-client limit) or `503 quota_exhausted` (daily ceiling).

## Qloo routes used

Routes and parameters follow Qloo's public documentation (docs.qloo.com, including its entity-type parameter
guide). Field names below were then confirmed against authenticated responses; I recorded field lists only,
never values. Authentication is the `X-Api-Key` header; list parameters are comma-separated. The host is
`QLOO_BASE_URL`, restricted to `https` on `qloo.com` hosts; an issued credential may only work on the host
named in its instructions, so `npm run smoke:live` confirms the host with one call before anything else.

| Step | Route | Parameters sent | Fields read (observed in authenticated responses) |
|------|-------|--------------------|----------------|
| Match a cultural reference | `GET /search` | `query`, `types` (entity URN), `take=5` | `results[]`: `entity_id`, `name`, `types[]`, `popularity` |
| Match a venue category | `GET /v2/tags` | `filter.query`, `take=10` | `results.tags[]`: `id`, `name`, `type` |
| Rank venues | `GET /v2/insights` | `filter.type=urn:entity:place`, `filter.tags`, `filter.location.query`, `signal.interests.entities`, `feature.explainability=true`, `take` | `results.entities[]`: `entity_id`, `name`, `subtype`, `popularity`, `properties.address`, `properties.is_closed`, `location.lat`/`lon`, `tags[]` (`id`, `name`, `type`), `query.affinity`, `query.explainability["signal.interests.entities"][]` (`entity_id`, `score`); top-level `query.localities.filter[].name` |
| Cultural bridge | `GET /v2/insights` | `filter.type` (`urn:entity:book`, `urn:entity:artist`, or `urn:entity:podcast`), `signal.interests.entities`, `take=8` | `results.entities[]` as above, with `tags[]` and `query.affinity` |
| Bridge fallback, or categories without a cross-domain pairing | `GET /v2/insights` | `filter.type=urn:tag`, `signal.interests.entities`, `filter.parents.types` (the references' own entity types), `take=8` | `results.tags[]`: `tag_id`, `name`, `subtype`, `query.affinity` |
| Category-only comparison | `GET /v2/insights` | `filter.type=urn:entity:place`, `filter.tags`, `filter.location.query` (the run's), `take=10`, no signal | As for ranking venues; no affinity or explanation without a signal |
| Venue side of the bridge | `GET /v2/insights` | `filter.type` (the bridge's domain), `signal.interests.entities` (the venue's own entity ID), `take=8` | `results.entities[]` with `tags[]` and `query.affinity`. A capability test confirmed a place entity is accepted as a signal for book insights; venue-signalled taste tags all scored 1.00, so they are not used |

What authenticated responses showed, and how the app handles it:

| Observation | Handling |
|-------------|----------|
| Names can be HTML-escaped (`&amp;`) | Decoded before display; React escapes again on render |
| Book titles include subtitles (`Title: Subtitle`) | An exact match on the main title before the colon counts as exact, only if the visitor typed no subtitle |
| Optional fields are often `null`, and responses carry many fields the app does not use (hours, prices, images, descriptions) | Fields are read with type checks; wrong-typed fields count as absent; unused fields are dropped |
| Entities carry 80–125 tags mixing themes with formats, age brackets, and payment or price metadata | Only thematic tags count as recurring signals or venue overlaps (rule in `isThematicTag`) |
| Unscoped taste-tag queries mix unrelated domains | Taste tags are scoped with `filter.parents.types` |
| A brand-only reference can make a cross-domain request fail with `400` ("all signal.interests.entities were invalid") | The bridge falls back to scoped taste tags and says so |
| Some venue-category labels have no exact tag ("Clothing boutique", "Plant shop") | The nearest Qloo category ("Clothing store", "Plant nursery") is searched and disclosed |
| A neighbourhood can return no venues (Greenpoint bookstores) | The planner widens to the city and records the step |
| Results for a place query can include nearby areas (a Manhattan store for "Brooklyn") | Every run states that venues are ranked within the area Qloo matched; addresses are shown |
| Places carry `properties.is_closed` | Closed venues are left out and counted in the run's limitations |
| Rate limits are reported in headers: `x-second-ratelimit-*` (5 per second) and `x-month-ratelimit-*` (10,000 per month) | Calls are paced; a `429` waits for the reported reset before one retry; an exhausted monthly allowance stops without retrying |

Documented behaviours the client relies on: `404` means no results (treated as empty), `400` for an unknown locality or
invalid signals, `401`/`403` for a rejected credential, `429` for rate limits. Affinity scores are 0–1 and
relative to the query that produced them; Qloo's published reading is above 0.8 very high, 0.6–0.8 high,
lower values weaker. Scores from different queries, and the direction of an affinity, are not treated as
comparable.

We do not store or redistribute Qloo responses. The only server-side reuse is a six-hour, per-isolate cache of
the tag ID for each venue category. See [data sources and licensing](data-licensing.md).
