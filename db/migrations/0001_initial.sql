-- Room for Both: minimal server-side state.
-- We store no guest budgets, no IP addresses, and no plaintext tokens. Rows expire and are
-- removed by the scheduled cleanup.

-- Private host-response links. Only SHA-256 hashes of the bearer tokens are stored.
CREATE TABLE IF NOT EXISTS host_requests (
  id TEXT PRIMARY KEY,
  host_token_hash TEXT NOT NULL UNIQUE,
  owner_token_hash TEXT NOT NULL,
  shared_summary TEXT NOT NULL,
  host_profile TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'submitted', 'revoked')),
  edits_remaining INTEGER NOT NULL CHECK (edits_remaining >= 0),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  submitted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_host_requests_expires ON host_requests (expires_at);

-- Fixed-window request counters keyed by a daily-rotating hash of the client, never the raw address.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);

-- Daily totals used to keep upstream API usage under a configured ceiling.
CREATE TABLE IF NOT EXISTS usage_counters (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, name)
);
