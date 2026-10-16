/**
 * HTTP-level fake of the documented Qloo routes for offline tests. All payloads are original,
 * synthetic, and shaped after the public documentation; none are recorded API responses.
 */
export interface FakeCall {
  url: URL;
  apiKey: string | null;
}

export interface FakeOptions {
  /** Force a status for every call to a route prefix, e.g. { "/search": 401 }. */
  statusFor?: Record<string, number>;
  /** Fail the first N calls with this status, then behave normally. */
  flaky?: { status: number; times: number };
  searchMisses?: string[];
  fuzzySearch?: string[];
  noCategoryTag?: boolean;
  emptyVenuesFor?: string[];
  unknownLocations?: string[];
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function createQlooFake(options: FakeOptions = {}) {
  const calls: FakeCall[] = [];
  let flakyLeft = options.flaky?.times ?? 0;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers);
    calls.push({ url, apiKey: headers.get("x-api-key") });

    if (flakyLeft > 0 && options.flaky) {
      flakyLeft -= 1;
      return json({ error: "synthetic failure" }, options.flaky.status);
    }
    for (const [prefix, status] of Object.entries(options.statusFor ?? {})) {
      if (url.pathname.startsWith(prefix)) return json({ error: "synthetic" }, status);
    }

    if (url.pathname === "/search") {
      const q = url.searchParams.get("query") ?? "";
      if (options.searchMisses?.includes(q)) return json({ results: [] });
      const name = options.fuzzySearch?.includes(q) ? `${q} Collected Edition` : q;
      return json({
        results: [
          { entity_id: `SYN-${q.toUpperCase().replace(/\W+/g, "")}-1`, name, types: [url.searchParams.get("types") ?? "urn:entity:brand"], popularity: 0.7 },
          { entity_id: `SYN-${q.toUpperCase().replace(/\W+/g, "")}-2`, name: `${q} Imitation`, types: ["urn:entity:brand"], popularity: 0.2 },
        ],
      });
    }

    if (url.pathname === "/v2/tags") {
      if (options.noCategoryTag) return json({ results: { tags: [{ id: "urn:tag:synthetic:place:something_else", name: "Something Else", type: "urn:tag:synthetic:place" }] } });
      const q = url.searchParams.get("filter.query") ?? "";
      return json({
        results: {
          tags: [
            { id: `urn:tag:synthetic:media:${q.toLowerCase()}`, name: q, type: "urn:tag:synthetic:media" },
            { id: `urn:tag:synthetic:place:${q.toLowerCase().replace(/\s+/g, "_")}`, name: q, type: "urn:tag:synthetic:place" },
          ],
        },
      });
    }

    if (url.pathname === "/v2/insights") {
      const type = url.searchParams.get("filter.type");
      const signals = (url.searchParams.get("signal.interests.entities") ?? "").split(",").filter(Boolean);
      if (type === "urn:entity:place") {
        const loc = url.searchParams.get("filter.location.query") ?? "";
        if (options.unknownLocations?.includes(loc)) return json({ success: false, error: "locality not found" }, 400);
        if (options.emptyVenuesFor?.includes(loc)) return json({ success: true, results: { entities: [] } });
        const take = Number(url.searchParams.get("take") ?? 5);
        return json({
          success: true,
          results: {
            entities: Array.from({ length: Math.min(take, 4) }, (_, i) => ({
              name: `Synthetic Venue ${String.fromCharCode(65 + i)}`,
              entity_id: `SYN-VENUE-${i + 1}`,
              type: "urn:entity",
              subtype: "urn:entity:place",
              popularity: 0.5,
              properties: { address: `${100 + i} Synthetic Street` },
              location: { lat: 40.7 + i / 100, lon: -73.95 },
              tags: [
                { id: "urn:tag:synthetic:keyword:nature_writing", name: "Nature Writing", type: "urn:tag:synthetic:keyword" },
                { id: "urn:tag:synthetic:keyword:readings", name: "Readings", type: "urn:tag:synthetic:keyword" },
              ],
              query: {
                affinity: signals.length ? 0.9 - i * 0.15 : undefined,
                explainability: signals.length ? { [signals[0] ?? ""]: 0.7, [signals[1] ?? "none"]: 0.3 } : undefined,
              },
            })),
          },
        });
      }
      if (type === "urn:tag") {
        return json({ success: true, results: { tags: [{ tag_id: "urn:tag:synthetic:keyword:nature_writing", name: "Nature Writing", query: { affinity: 0.82 } }] } });
      }
      if (type?.startsWith("urn:entity:")) {
        return json({
          success: true,
          results: {
            entities: [
              { name: "Synthetic Title One", entity_id: "SYN-BOOK-1", subtype: type, tags: [{ id: "t1", name: "Nature Writing" }], query: { affinity: 0.88 } },
              { name: "Synthetic Title Two", entity_id: "SYN-BOOK-2", subtype: type, tags: [{ id: "t1", name: "Nature Writing" }], query: { affinity: 0.71 } },
            ],
          },
        });
      }
    }
    return json({ results: [] }, 404);
  }) as typeof fetch;

  return { fetchImpl, calls };
}
