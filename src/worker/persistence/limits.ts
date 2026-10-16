/**
 * Request throttling and upstream quota accounting. D1 gives a consistent count across
 * isolates; when no database is bound (for example a bare local run) we fall back to a
 * per-isolate memory counter, which is best-effort and documented as such.
 */

export interface Limiter {
  /** Increments the counter and reports whether the request is within the limit. */
  hit(bucket: string, limit: number, windowSeconds: number, now: number): Promise<{ allowed: boolean; count: number }>;
  usage(day: string, name: string): Promise<number>;
  addUsage(day: string, name: string, amount: number): Promise<void>;
}

export class D1Limiter implements Limiter {
  constructor(private readonly db: D1Database) {}

  async hit(bucket: string, limit: number, windowSeconds: number, now: number) {
    const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
    const row = await this.db
      .prepare(
        "INSERT INTO rate_limits (bucket, window_start, count) VALUES (?1, ?2, 1) ON CONFLICT (bucket, window_start) DO UPDATE SET count = count + 1 RETURNING count",
      )
      .bind(bucket, windowStart)
      .first<{ count: number }>();
    const count = row?.count ?? limit + 1;
    return { allowed: count <= limit, count };
  }

  async usage(day: string, name: string) {
    const row = await this.db.prepare("SELECT count FROM usage_counters WHERE day = ?1 AND name = ?2").bind(day, name).first<{ count: number }>();
    return row?.count ?? 0;
  }

  async addUsage(day: string, name: string, amount: number) {
    if (amount <= 0) return;
    await this.db
      .prepare("INSERT INTO usage_counters (day, name, count) VALUES (?1, ?2, ?3) ON CONFLICT (day, name) DO UPDATE SET count = count + ?3")
      .bind(day, name, amount)
      .run();
  }
}

export class MemoryLimiter implements Limiter {
  #windows = new Map<string, number>();
  #usage = new Map<string, number>();

  async hit(bucket: string, limit: number, windowSeconds: number, now: number) {
    const key = `${bucket}|${Math.floor(now / 1000 / windowSeconds)}`;
    const count = (this.#windows.get(key) ?? 0) + 1;
    this.#windows.set(key, count);
    if (this.#windows.size > 5000) this.#windows.clear();
    return { allowed: count <= limit, count };
  }

  async usage(day: string, name: string) {
    return this.#usage.get(`${day}|${name}`) ?? 0;
  }

  async addUsage(day: string, name: string, amount: number) {
    const key = `${day}|${name}`;
    this.#usage.set(key, (this.#usage.get(key) ?? 0) + amount);
  }
}

const memory = new MemoryLimiter();

export function limiterFor(db: D1Database | undefined): Limiter {
  return db ? new D1Limiter(db) : memory;
}

export async function cleanupExpired(db: D1Database, now: number): Promise<{ hostRequests: number; rateLimits: number; usage: number }> {
  const nowSeconds = Math.floor(now / 1000);
  const cutoffDay = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10);
  const [a, b, c] = await db.batch([
    db.prepare("DELETE FROM host_requests WHERE expires_at < ?1").bind(now),
    db.prepare("DELETE FROM rate_limits WHERE window_start < ?1").bind(nowSeconds - 86_400),
    db.prepare("DELETE FROM usage_counters WHERE day < ?1").bind(cutoffDay),
  ]);
  return { hostRequests: a?.meta.changes ?? 0, rateLimits: b?.meta.changes ?? 0, usage: c?.meta.changes ?? 0 };
}
