# Security

## Secrets

- `QLOO_API_KEY`, `GEMINI_API_KEY`, and `CLIENT_KEY_SALT` exist only as Worker secrets (deployed) or in a
  git-ignored `.dev.vars` (local). They are never sent to the browser, logged, or returned by any route.
- The Qloo client refuses to send the key anywhere except an `https` URL on a `qloo.com` host, so a mistyped
  `QLOO_BASE_URL` cannot leak it.
- Production builds ship no source maps.
- `npm run scan:secrets` checks tracked files for key patterns, private files, and (when run locally) the exact
  values of the local secrets, because provider key formats change. CI runs it on every push.
- Upstream URLs are built from a validated base URL; the key is sent only in a request header, never in a URL
  or a response, and error messages shown to visitors name the failure class only.
- Gemini requests go only to Google's fixed `generativelanguage.googleapis.com` endpoint; the model name is
  validated against a strict pattern before it is placed in the URL.

## Untrusted input

- Every request body is parsed with strict Zod schemas (unknown fields rejected, lengths and ranges bounded,
  vocabularies enumerated) and capped at 32 KB.
- Validation errors name field paths but never echo submitted values.
- Upstream Qloo and Gemini payloads are treated as untrusted: size-capped (2 MB and 100 KB), read field by
  field with type checks, string lengths and list sizes capped, HTML entities decoded only for display text,
  malformed items dropped.
- React escapes all rendered text; the app sets no HTML from data. The CSP is `default-src 'self'` with no
  inline scripts.

## Language model

- No generic proxy: `/api/narrative` accepts only a structured object of facts the engine computed, plus explicit
  consent. There is no prompt field.
- The system instruction tells the model the facts are data, not instructions.
- Drafts are rejected if they introduce any number not in the facts, any link or markup, or claims such as
  "approved" or "guaranteed". The rule-based summary is always shown regardless.

## Host response links

- Tokens are 256-bit random values (base64url). Only SHA-256 hashes are stored.
- Host and owner tokens are separate; neither can perform the other's actions.
- The host token travels in the URL fragment, which browsers do not send to servers or in Referer headers.
  `/respond` also sets `Referrer-Policy: no-referrer` and is excluded in `robots.txt`.
- Links expire after seven days, allow three saves (enforced atomically in SQL), and can be withdrawn,
  which deletes the host's answers.
- Unknown, expired, revoked, and mismatched tokens all return the same `404`.
- The guest's budget, costs, notes, and priorities are never part of what the host sees.

## Abuse and cost controls

- Research: per-client hourly limit (default 12 runs), per-run call budget (default 7, retries included), daily
  upstream ceiling (default 300 calls, sized to the credential's monthly allowance), call pacing below Qloo's
  per-second limit, one bounded retry that waits for Qloo's reported reset, and a per-isolate circuit breaker
  after repeated upstream failures. If the counter store is unavailable, live research fails closed.
- The fictional demonstration makes no upstream calls but still counts towards the per-client hourly limit.
- Host link creation: 10 per client per hour; reads and writes are throttled separately.
- Narrative drafts: 20 per client per hour and 300 per day, below the model's free-tier quota (15 per minute,
  500 per day for the deployed project). There is no unrestricted anonymous model access.
- Client identity for limits is a daily-rotating hash of the connecting address; raw addresses are never stored.
- Cross-origin writes are refused. No cookies are used.

## Logging

Structured JSON lines with request ID, route, status, duration, counts, and error class. A redaction filter
drops any field whose name suggests a key, token, secret, address, email, or body.

## Reporting a vulnerability

Please open a private security advisory on the repository rather than a public issue.
