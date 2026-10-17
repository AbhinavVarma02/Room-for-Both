# Data sources, licensing, and operating modes

Room for Both uses two external services. Both are optional at runtime: without them the decision engine, the
two-sided workflow, and the brief work unchanged.

| Service | Used for | Required? | Where it runs |
|---------|----------|-----------|---------------|
| Qloo Insights API | Cultural discovery: resolving references, ranking venues by affinity, building a cultural bridge | No. Without it, research runs as a labelled fictional demonstration | Server-side only, in the Worker |
| Gemini Developer API | An optional plain-language summary of the brief, drafted from already-computed facts | No. The rule-based summary is always shown | Server-side only, in the Worker, after visitor consent |

## Qloo access

### What the current credential allows

The deployment uses a **time-limited developer credential** issued by Qloo for a fixed programme period. It is
not a production or commercial licence. Material conditions, taken from Qloo's developer guide for the
credential and Qloo's Terms of Use:

- **Host.** The credential is valid only on the API host named in its issuing instructions. It is rejected by
  Qloo's standard production and staging hosts. The host is configuration (`QLOO_BASE_URL`), never hard-coded.
- **Access method.** Qloo's guide documents direct HTTPS calls to the documented routes with an `X-Api-Key`
  header, which is exactly what the Worker does. (Qloo's separate note that serverless functions are not a
  supported route applies to its MCP server, which this app does not use.)
- **Period.** The guide states that these credentials stay active through the end of the programme's review
  period and are deactivated afterwards, and the credential covers that programme only. The email that issued
  the credential adds no terms beyond the guide and states no date, so the exact deactivation moment is not known.
  Nothing in this repository assumes a date: the app reacts to the credential being rejected (see
  [operating modes](#operating-modes)).
- **Limits.** Observed in authenticated response headers: 5 requests per second and 10,000 requests per month.
  The app paces its calls (at most 4 per second per Worker isolate), allows 7 calls per research run, and stops
  live research for the day after 300 upstream calls, which keeps a month of use inside the monthly allowance.
- **Data.** Qloo permits private server-side caching of responses and forbids publishing response data in a
  public repository. This repository contains no Qloo responses: tests use original synthetic payloads that
  mirror observed field names only.
- **Inputs.** Under Qloo's Terms of Use, Qloo may use anonymised input signals sent to its API. The app sends
  only cultural reference names, a city or neighbourhood, and a venue category; never business names, terms,
  or contact details.

### What is stored

| Data | Where | How long |
|------|-------|----------|
| Venue-category tag IDs (for example the tag for "Book store") | Worker memory | Up to 6 hours per isolate |
| A research run's results | The visitor's own browser storage, and any brief the visitor downloads | Until the visitor clears it |
| A selected venue's public name, if the visitor creates a host link | D1, inside the private host-link record | Until the link expires and the daily cleanup removes it |

No other Qloo-derived data is retained. Upstream responses are parsed, reduced to the displayed fields, and
discarded at the end of each request.

### After the credential ends

When Qloo deactivates the credential, every live request is rejected. The app then:

1. tells the visitor that live Qloo access is not authorised for this deployment right now, without exposing
   any detail of the credential;
2. offers the fictional demonstration, whose results are labelled fictional on every screen and in the brief;
3. keeps the rest of the product (two-sided inputs, Agreement Frontier, Decision Reversal, brief) fully usable.

The operator should then remove the credential so the app opens directly in fixture mode
(`npx wrangler secret delete QLOO_API_KEY`). The public app then remains available as the fictional
demonstration only. Cached or recorded Qloo results must not be used to imitate live access after authorisation
ends, and this repository contains none to reuse.

### Continuing with separately authorised access

To run live discovery beyond the current credential's period, obtain a separate API agreement from Qloo
(through qloo.com or the contact route in Qloo's documentation), review its terms on data retention, display,
rate limits, and cost, then set the new `QLOO_API_KEY` and `QLOO_BASE_URL` secrets
([deployment](deployment.md#rotating-or-revoking-credentials)). No code change is needed if the new
credential uses the documented routes. Any paid access is outside this project's zero-cost operating
constraint and needs the owner's explicit decision.

## Operating modes

Every screen states which mode produced its cultural evidence.

| Mode | When | What the visitor sees |
|------|------|-----------------------|
| Live Qloo cultural intelligence | A credential is configured and accepted | "Live Qloo cultural intelligence" banner; evidence labelled *Observed in Qloo*, with the request and retrieval time |
| Fictional demonstration | No credential is configured, or the visitor chooses the demonstration | "Fixture mode: fictional cultural data" banner; every venue and theme marked fictional; no Qloo request is made |
| Live data temporarily unavailable | Qloo rate limit, timeout, outage, or the daily or monthly allowance is used up | "Live cultural data is temporarily unavailable", with retry and the fictional demonstration |
| Live access not authorised | Qloo rejects the credential (expired, revoked, or wrong host) | "Live Qloo access is not authorized right now", with the fictional demonstration only |

Fictional and live results are never mixed in one run: a run is entirely live or entirely fictional, and its
mode travels with it into the brief and the JSON export.

## Gemini

- The model is operator configuration (`GEMINI_MODEL`); the deployment uses `gemini-3.5-flash-lite` on the
  Gemini Developer API free tier, through a key created in Google AI Studio for a project without billing.
  A project without billing cannot incur charges; requests over the free quota are refused, and the app then
  shows the rule-based summary only.
- Free-tier quota for this model and project, read from Google's quota service: 15 requests per minute and
  500 per day. The app allows 20 summaries per visitor per hour and 300 per day in total.
- On the free tier, Google may use submitted content to improve its products. The visitor must tick a consent
  box for each summary. Only the computed facts are sent: business names, option labels, statuses, amounts,
  open questions, and theme titles. No contact details, notes, or host-link data.
- Output is checked before display: it must be valid structured JSON, add no number absent from the facts,
  contain no links or markup, and make no approval, guarantee, or growth claims. Rejected drafts are discarded.
