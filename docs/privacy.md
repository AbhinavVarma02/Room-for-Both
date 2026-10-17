# Privacy

Room for Both is designed to need as little data as possible and to keep most of it on the visitor's device.

## What stays in your browser

Your workspace (guest profile, host terms, the latest research run, and any host-link tokens you created) is
kept in your browser's local storage so you can return to it. It is never uploaded as a whole. "Start over"
clears it. A host-link token lets anyone using the same browser profile read the host's answers until the link
expires, so start over on a shared computer.

## What is sent to the server, and why

| Action | Data sent | Kept on the server? |
|--------|-----------|---------------------|
| Evaluate (API use only; the app evaluates locally) | The scenario | No |
| Cultural research | Up to three cultural references, city, neighbourhood, venue category, product categories (product categories stay on the server and are not sent to Qloo) | No. Counts only, for rate limits |
| Create a host link | Only the summary you choose to share: business name, product categories, proposed formats, the venue's public name, optional theme and message | Yes, until expiry (7 days) or withdrawal |
| Host answers | The host's terms | Yes, until expiry or withdrawal |
| Reference sensitivity check (optional) | The run's matched reference IDs and names, category, and area, to repeat the venue search without each reference | No. Counts only |
| Optional language-model summary | Computed facts: names, option labels, statuses, amounts, question texts | No |
| Optional model planner | Cultural references, product categories, venue type, and (only after an empty search) the area names | No. Counts only |
| Optional language-model baseline | Cultural references, product categories, venue type, and area | No. Counts only |
| Category-only comparison, venue-side lookup | The run's venue category tag, area, and the chosen venue's public Qloo ID and name | No. Counts only |

Your budget, own costs, notes, and priorities are never shared with a host and never sent to Qloo.

## Third parties

- **Qloo** receives the cultural references, location, and venue category from research requests, sent by the
  Room for Both server. Under Qloo's Terms of Use, Qloo may use anonymised input signals to improve its service, so the app sends
  nothing else: no business names, terms, budgets, notes, or contact details. Qloo describes its data as
  aggregate and free of personal information. Qloo results are shown to you and kept in your browser; the
  server does not retain them (see [data sources and licensing](data-licensing.md)).
- **Google Gemini API** (only if the operator enables it and you consent each time) receives only what the table
  above lists for the feature you chose; never business names for the planner or baseline, and never budgets,
  costs, notes, contact details, or host-link data. Google's free tier states that submitted content may be used
  to improve Google's products, which is why consent is required each time.
- **Cloudflare** hosts the app and database.

## Server records

- Host links: hashed tokens, shared summary, host answers, timestamps. Deleted after expiry by a daily job.
- Rate-limit and usage counters: keyed by a daily-rotating hash, never a raw address. Removed after a day
  (rate limits) or thirty days (daily totals).
- Logs: request metadata only (route, status, duration, counts, error class). No request bodies.

## What Room for Both never does

It never contacts a business for you, never infers a person's identity or traits from cultural data, and never
uses cultural affinity as evidence of a venue's traffic, sales, or willingness to partner.
