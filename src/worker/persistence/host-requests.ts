import { HostProfile } from "../../shared/schemas/profiles";
import { SharedSummary, type HostRequestView, type OwnerRequestView } from "../../shared/schemas/api";
import { digestsEqual, randomToken, sha256Hex } from "../security/crypto";

export const LINK_TTL_MS = 7 * 86_400_000;
export const EDITS_ALLOWED = 3;

interface Row {
  id: string;
  host_token_hash: string;
  owner_token_hash: string;
  shared_summary: string;
  host_profile: string | null;
  status: "pending" | "submitted" | "revoked";
  edits_remaining: number;
  created_at: number;
  expires_at: number;
  submitted_at: number | null;
}

function parseHost(json: string | null) {
  if (!json) return null;
  const parsed = HostProfile.safeParse(JSON.parse(json));
  return parsed.success ? parsed.data : null;
}

export class HostRequestStore {
  constructor(private readonly db: D1Database) {}

  async create(summary: SharedSummary, now: number) {
    const id = randomToken(16);
    const hostToken = randomToken(32);
    const ownerToken = randomToken(32);
    const expiresAt = now + LINK_TTL_MS;
    await this.db
      .prepare(
        "INSERT INTO host_requests (id, host_token_hash, owner_token_hash, shared_summary, host_profile, status, edits_remaining, created_at, expires_at, submitted_at) VALUES (?1, ?2, ?3, ?4, NULL, 'pending', ?5, ?6, ?7, NULL)",
      )
      .bind(id, await sha256Hex(hostToken), await sha256Hex(ownerToken), JSON.stringify(summary), EDITS_ALLOWED, now, expiresAt)
      .run();
    return { requestId: id, hostToken, ownerToken, expiresAt, editsAllowed: EDITS_ALLOWED };
  }

  /** Looks a host link up by token hash. Expired or revoked links behave exactly like unknown ones. */
  async findForHost(hostToken: string, now: number): Promise<{ row: Row; view: HostRequestView } | null> {
    const row = await this.db.prepare("SELECT * FROM host_requests WHERE host_token_hash = ?1").bind(await sha256Hex(hostToken)).first<Row>();
    if (!row || row.expires_at <= now || row.status === "revoked") return null;
    const summary = SharedSummary.safeParse(JSON.parse(row.shared_summary));
    if (!summary.success) return null;
    return {
      row,
      view: {
        summary: summary.data,
        status: row.status,
        expiresAt: row.expires_at,
        editsRemaining: row.edits_remaining,
        host: parseHost(row.host_profile),
      },
    };
  }

  async submit(row: Row, host: HostProfile, now: number): Promise<{ editsRemaining: number } | null> {
    // The WHERE clause re-checks every condition atomically so concurrent submissions cannot
    // exceed the edit allowance or write after expiry or revocation.
    const result = await this.db
      .prepare(
        "UPDATE host_requests SET host_profile = ?1, status = 'submitted', edits_remaining = edits_remaining - 1, submitted_at = ?2 WHERE id = ?3 AND edits_remaining > 0 AND expires_at > ?2 AND status != 'revoked' RETURNING edits_remaining",
      )
      .bind(JSON.stringify(host), now, row.id)
      .first<{ edits_remaining: number }>();
    return result ? { editsRemaining: result.edits_remaining } : null;
  }

  async findForOwner(id: string, ownerToken: string, now: number): Promise<OwnerRequestView | null> {
    const row = await this.db.prepare("SELECT * FROM host_requests WHERE id = ?1").bind(id).first<Row>();
    if (!row || row.expires_at <= now) return null;
    if (!digestsEqual(row.owner_token_hash, await sha256Hex(ownerToken))) return null;
    return {
      requestId: row.id,
      status: row.status,
      expiresAt: row.expires_at,
      submittedAt: row.submitted_at,
      host: row.status === "revoked" ? null : parseHost(row.host_profile),
    };
  }

  async revoke(id: string, ownerToken: string, now: number): Promise<boolean> {
    const view = await this.findForOwner(id, ownerToken, now);
    if (!view) return false;
    await this.db.prepare("UPDATE host_requests SET status = 'revoked', host_profile = NULL WHERE id = ?1").bind(id).run();
    return true;
  }
}
