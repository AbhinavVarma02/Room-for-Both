# Upgrade progress

Append-only. Each entry: what ran, what was observed, live calls spent, next action.

## #1 Baseline (U0-01)

- `git status`: clean on `main`; HEAD == origin/main == a517810.
- GitHub Actions run 39000001359 on a517810: completed, success.
- `wrangler deployments list`: production at 100% on Worker version 1c4b8f19-a82a-402d-abf8-1cacd6bd13e3
  (deployed from 1a8d36a; later commits are ledger-only). This is the rollback reference.
- Public `/api/health`: `research.mode` live, `narrative.enabled` true, storage bound. `/api/config`: call budget 7,
  three references per run, host links enabled. No Qloo or Gemini calls spent.
- Created branch `upgrade/selected-venue-journey` from main.
- Next: commit trackers (U0-02), then U1-01.

## #2 Venue-signal capability test (U3-01) and payload sizes (U6-01, partial)

- Three live Qloo calls from a private scratch script (not in the repository): one place `/search`, one
  `/v2/insights` with `filter.type=urn:entity:book` and the venue's own entity as `signal.interests.entities`,
  one `/v2/insights` with `filter.type=urn:tag` scoped to books with the same venue signal.
- Result: a place entity is accepted as an interest signal. The book call returned HTTP 200 with 8 entities, all
  carrying affinity (0.87–0.90), and the titles were plausibly coherent for the venue. The tag call returned 8 tags,
  every one with affinity 1.00, so venue-side taste tags do not discriminate and are not used.
- Decision: venue-side evidence uses the same cross-domain type as the guest-side bridge (books, artists, or
  podcasts by venue category), one call per selected venue. Categories without a cross-domain type use
  host-entered programming interests instead.
- Payload sizes: 36 KB (search, 3 results), 68 KB (8 books), 2 KB (tags). `JSON.parse` in Node took 0.02–0.18 ms,
  so response parsing is not where production research CPU goes; the earlier demo-mode measurement (5–15 ms with no
  upstream calls) points at per-request application work. Follow-up in U6-01.
- Live calls spent: Qloo 3, Gemini 0.
