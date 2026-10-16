/**
 * Live Qloo smoke test, in three stages, each spending as little quota as possible:
 *   1. Host probe: one minimal authenticated `/search` call per candidate host (at most three), so we
 *      never assume which host an issued credential is valid on.
 *   2. Response-structure check: field presence in real payloads against what the normaliser reads.
 *   3. One bounded research run (at most 7 calls) through the production planner.
 * Prints statuses, counts, and field names only: never keys, never payload values.
 * Exits 0 with BLOCKED when no credential is present.
 *
 * Candidate hosts: QLOO_BASE_URL (if set), then QLOO_CANDIDATE_BASE_URLS (comma-separated, for hosts named
 * in your credential instructions), then Qloo's documented production host.
 */
import { QLOO_DOCUMENTED_BASE_URL, QlooClient, QlooError, type QlooPath, type QlooTransport, type QueryValue } from "../src/worker/integrations/qloo/client";
import { resultItems } from "../src/worker/integrations/qloo/normalize";
import { runResearch } from "../src/worker/orchestration/research";
import { localVar, table } from "./lib";

const apiKey = localVar("QLOO_API_KEY");
if (!apiKey) {
  console.log("BLOCKED: QLOO_API_KEY is not set in the environment or .dev.vars (blocker EXT-QLOO-KEY). No request was made.");
  process.exit(0);
}

const candidates = [
  ...new Set(
    [localVar("QLOO_BASE_URL"), ...(localVar("QLOO_CANDIDATE_BASE_URLS") ?? "").split(","), QLOO_DOCUMENTED_BASE_URL]
      .map((h) => h?.trim().replace(/\/+$/, ""))
      .filter((h): h is string => !!h),
  ),
].slice(0, 3);

// Stage 1: which host accepts this credential?
let host: string | null = null;
console.log("Stage 1: host probe (one call per host)");
for (const candidate of candidates) {
  const probe = new QlooClient({ apiKey, baseUrl: candidate, callBudget: 1, maxAttempts: 1, timeoutMs: 10_000 });
  try {
    await probe.get("/search", { query: "Patagonia", types: "urn:entity:brand", take: 1 });
    console.log(`  ${new URL(candidate).host}: accepted`);
    host ??= candidate;
  } catch (error) {
    const detail = error instanceof QlooError ? `${error.code}${error.status ? ` (HTTP ${error.status})` : ""}` : "unexpected error";
    console.log(`  ${new URL(candidate).host}: ${detail}`);
  }
  if (host) break;
}
if (!host) {
  console.log("FAIL  no candidate host accepted the credential. Check the host named in your credential instructions.");
  process.exit(1);
}
console.log(`Using ${new URL(host).host}. Set QLOO_BASE_URL to this value locally and as a Worker secret.\n`);

// Stage 2: record which fields real payloads carry, without keeping any values.
type Shape = { path: string; type: string; items: number; fields: Record<string, number> };
const shapes: Shape[] = [];
const has = (o: unknown, path: string) => path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o) !== undefined;
class RecordingTransport implements QlooTransport {
  constructor(private readonly inner: QlooClient) {}
  get callsUsed() {
    return this.inner.callsUsed;
  }
  async get(path: QlooPath, query: Record<string, QueryValue>) {
    const payload = await this.inner.get(path, query);
    const key = path === "/v2/tags" || query["filter.type"] === "urn:tag" ? "tags" : "entities";
    const items = resultItems(payload, key);
    const fields = ["entity_id", "id", "tag_id", "name", "type", "subtype", "types", "popularity", "properties.address", "location.lat", "location.lon", "location.latitude", "location.longitude", "tags", "query.affinity", "query.explainability"];
    shapes.push({
      path,
      type: String(query["filter.type"] ?? query.types ?? ""),
      items: items.length,
      fields: Object.fromEntries(fields.map((f) => [f, items.filter((i) => has(i, f)).length]).filter(([, n]) => (n as number) > 0)),
    });
    return payload;
  }
}

const transport = new RecordingTransport(new QlooClient({ apiKey, baseUrl: host, callBudget: 7, timeoutMs: 10_000 }));
const started = Date.now();
try {
  const run = await runResearch(
    {
      seeds: [
        { label: "Aesop", kind: "brand" },
        { label: "Braiding Sweetgrass", kind: "book" },
      ],
      city: "Brooklyn",
      venueCategory: "bookstore",
      guestCategories: ["skincare"],
      maxCandidates: 5,
    },
    { transport, mode: "live", callBudget: 7, runId: "smoke" },
  );
  console.log("Stage 2: response structure (items carrying each field)");
  for (const s of shapes) console.log(`  ${s.path} ${s.type}: ${s.items} items ${JSON.stringify(s.fields)}`);
  const venueShape = shapes.find((s) => s.type === "urn:entity:place");
  console.log("\nStage 3: bounded research run");
  const ok = table([
    ["authenticated research run completed", run.callsUsed > 0, `${run.callsUsed} calls`],
    ["at least one reference matched exactly", run.seeds.some((s) => s.status === "exact"), run.seeds.map((s) => `${s.input.label}: ${s.status}`).join(", ")],
    ["venue category resolved to a Qloo tag", run.categoryTag !== null, run.categoryTag?.name ?? "none"],
    ["venue candidates returned", run.candidates.length > 0, `${run.candidates.length} candidates`],
    ["venue payload has IDs and names", !!venueShape && (venueShape.fields.entity_id ?? venueShape.fields.id ?? 0) > 0 && (venueShape.fields.name ?? 0) > 0, ""],
    ["affinity scores present in live payload", (venueShape?.fields["query.affinity"] ?? 0) > 0, "absence means candidates show as unscored"],
    ["cultural bridge built", run.themes.length > 0, `${run.themes.length} themes`],
    ["evidence labelled as Qloo-observed", run.candidates.every((c) => c.provenance.kind === "qloo_observed"), ""],
    ["stayed within the call budget", run.callsUsed <= run.callBudget, `${run.callsUsed}/${run.callBudget}`],
  ]);
  console.log(`Duration: ${Date.now() - started} ms`);
  process.exit(ok ? 0 : 1);
} catch (error) {
  console.log(`FAIL  live research: ${error instanceof QlooError ? `${error.code}${error.status ? ` (HTTP ${error.status})` : ""}` : "unexpected error"}`);
  process.exit(1);
}
