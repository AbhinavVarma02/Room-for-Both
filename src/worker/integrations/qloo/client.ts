/**
 * Server-side Qloo client. Routes, the `X-Api-Key` header, and comma-joined list parameters follow
 * Qloo's public API documentation (docs.qloo.com) and the request conventions of Qloo's own
 * published client. The key never leaves the Worker and is never logged.
 */

export const QLOO_DOCUMENTED_BASE_URL = "https://api.qloo.com";

export type QlooErrorCode =
  | "NOT_CONFIGURED"
  | "UNTRUSTED_BASE_URL"
  | "AUTH"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "UPSTREAM"
  | "UPSTREAM_UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK"
  | "MALFORMED"
  | "BUDGET_EXHAUSTED";

export class QlooError extends Error {
  constructor(
    readonly code: QlooErrorCode,
    message: string,
    readonly retryable = false,
    readonly status?: number,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export type QueryValue = string | number | boolean | readonly string[] | undefined;
export type QlooPath = "/search" | "/entities" | "/v2/insights" | "/v2/tags";

/** Anything that can answer a documented Qloo GET: the live client or the labelled fixture transport. */
export interface QlooTransport {
  get(path: QlooPath, query: Record<string, QueryValue>): Promise<unknown>;
  readonly callsUsed: number;
}

export interface QlooClientOptions {
  apiKey: string | undefined;
  baseUrl?: string | undefined;
  timeoutMs?: number;
  maxAttempts?: number;
  callBudget: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * We only send the credential to Qloo-operated hosts over HTTPS. A mistyped or tampered
 * QLOO_BASE_URL would otherwise forward the key to an arbitrary server.
 */
export function trustedBaseUrl(raw: string | undefined): URL {
  const url = new URL(raw && raw.trim() !== "" ? raw.trim() : QLOO_DOCUMENTED_BASE_URL);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(host === "qloo.com" || host.endsWith(".qloo.com"))) {
    throw new QlooError("UNTRUSTED_BASE_URL", "QLOO_BASE_URL must be an https URL on a qloo.com host.");
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new QlooError("UNTRUSTED_BASE_URL", "QLOO_BASE_URL must not contain credentials, a query, or a fragment.");
  }
  return url;
}

// A small per-isolate circuit breaker: after repeated upstream failures we stop spending
// quota and latency on calls that are likely to fail, and recover automatically.
const breaker = { failures: 0, openUntil: 0 };
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 60_000;

export function resetQlooCircuitBreaker(): void {
  breaker.failures = 0;
  breaker.openUntil = 0;
}

export class QlooClient implements QlooTransport {
  #apiKey: string;
  #base: URL;
  #timeoutMs: number;
  #maxAttempts: number;
  #budget: number;
  #maxBytes: number;
  #fetch: typeof fetch;
  #sleep: (ms: number) => Promise<void>;
  #calls = 0;

  constructor(options: QlooClientOptions) {
    if (!options.apiKey || options.apiKey.trim() === "") {
      throw new QlooError("NOT_CONFIGURED", "Qloo credentials are not configured on this server.");
    }
    this.#apiKey = options.apiKey.trim();
    this.#base = trustedBaseUrl(options.baseUrl);
    this.#timeoutMs = options.timeoutMs ?? 8000;
    this.#maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 2, 3));
    this.#budget = options.callBudget;
    this.#maxBytes = options.maxResponseBytes ?? 2_000_000;
    this.#fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.#sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get callsUsed(): number {
    return this.#calls;
  }

  buildUrl(path: QlooPath, query: Record<string, QueryValue>): URL {
    const url = new URL(path.replace(/^\//, ""), this.#base.href.endsWith("/") ? this.#base : new URL(`${this.#base.href}/`));
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === "") continue;
      const serialised = Array.isArray(value) ? value.join(",") : String(value);
      if (serialised !== "") url.searchParams.set(key, serialised);
    }
    return url;
  }

  async get(path: QlooPath, query: Record<string, QueryValue>): Promise<unknown> {
    if (Date.now() < breaker.openUntil) {
      throw new QlooError("UPSTREAM_UNAVAILABLE", "Qloo is temporarily unavailable; please try again shortly.", true);
    }
    const url = this.buildUrl(path, query);
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      // Every attempt can consume upstream quota, so retries count against the run's budget too.
      if (this.#calls >= this.#budget) {
        throw new QlooError("BUDGET_EXHAUSTED", `This research run reached its limit of ${this.#budget} Qloo calls.`);
      }
      this.#calls += 1;
      let response: Response;
      try {
        response = await this.#fetch(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json", "X-Api-Key": this.#apiKey },
          signal: AbortSignal.timeout(this.#timeoutMs),
        });
      } catch (cause) {
        const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
        if (attempt < this.#maxAttempts) {
          await this.#sleep(this.#backoff(attempt));
          continue;
        }
        this.#recordFailure();
        throw new QlooError(timedOut ? "TIMEOUT" : "NETWORK", timedOut ? "Qloo did not respond in time." : "Could not reach Qloo.", true);
      }

      if (response.ok) {
        breaker.failures = 0;
        return this.#readJson(response);
      }
      // Qloo documents 404 as "No results"; we treat it as an empty result set rather than an error.
      if (response.status === 404) {
        breaker.failures = 0;
        await response.body?.cancel();
        return { results: [] };
      }
      if (RETRYABLE.has(response.status) && attempt < this.#maxAttempts) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await response.body?.cancel();
        await this.#sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 2000) : this.#backoff(attempt));
        continue;
      }
      await response.body?.cancel();
      throw this.#httpError(response.status);
    }
    throw new QlooError("NETWORK", "Could not reach Qloo.", true);
  }

  #backoff(attempt: number): number {
    return Math.round(300 * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5));
  }

  #recordFailure(): void {
    breaker.failures += 1;
    if (breaker.failures >= BREAKER_THRESHOLD) breaker.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
  }

  #httpError(status: number): QlooError {
    if (status === 401 || status === 403) return new QlooError("AUTH", "Qloo rejected this server's credentials.", false, status);
    if (status === 429) return new QlooError("RATE_LIMITED", "Qloo's rate limit was reached. Please wait and try again.", true, status);
    if (status === 400) return new QlooError("BAD_REQUEST", "Qloo could not interpret this request (for example, an unknown location).", false, status);
    this.#recordFailure();
    return new QlooError("UPSTREAM", "Qloo returned an unexpected error.", true, status);
  }

  async #readJson(response: Response): Promise<unknown> {
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > this.#maxBytes) {
      await response.body?.cancel();
      throw new QlooError("MALFORMED", "Qloo returned a response larger than this app accepts.");
    }
    const text = await response.text();
    if (text.length > this.#maxBytes) throw new QlooError("MALFORMED", "Qloo returned a response larger than this app accepts.");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new QlooError("MALFORMED", "Qloo returned a response that was not valid JSON.");
    }
  }
}
