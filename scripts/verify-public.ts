/**
 * Verifies a deployed Room for Both instance from the outside, as an anonymous visitor would.
 * Usage: npm run verify:public -- https://<your-worker>.workers.dev
 */
import { EXAMPLE_SCENARIO } from "../src/shared/fixtures/example-scenario";
import { table } from "./lib";

const base = (process.argv[2] ?? process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.log("BLOCKED: pass the public URL, e.g. npm run verify:public -- https://room-for-both.example.workers.dev");
  process.exit(0);
}

const rows: [string, boolean, string?][] = [];
const check = async (name: string, fn: () => Promise<[boolean, string?]>) => {
  try {
    const [ok, detail] = await fn();
    rows.push([name, ok, detail]);
  } catch (error) {
    rows.push([name, false, error instanceof Error ? error.message : "error"]);
  }
};

await check("home page serves HTML", async () => {
  const res = await fetch(`${base}/`);
  const html = await res.text();
  return [res.ok && html.includes("<title>Room for Both"), `HTTP ${res.status}`];
});
await check("security headers on HTML", async () => {
  const res = await fetch(`${base}/`);
  const csp = res.headers.get("content-security-policy") ?? "";
  return [csp.includes("default-src 'self'") && res.headers.get("x-frame-options") === "DENY", csp ? "CSP present" : "no CSP"];
});
for (const path of ["/workspace/guest", "/methodology", "/respond"]) {
  await check(`client route ${path}`, async () => {
    const res = await fetch(`${base}${path}`);
    return [res.ok && (await res.text()).includes('id="root"'), `HTTP ${res.status}`];
  });
}
let mode = "unknown";
await check("health endpoint", async () => {
  const res = await fetch(`${base}/api/health`);
  const body = (await res.json()) as { status?: string; research?: { mode?: string } };
  mode = body.research?.mode ?? "unknown";
  return [res.ok && body.status === "ok", `research mode: ${mode}`];
});
await check("deterministic evaluation", async () => {
  const res = await fetch(`${base}/api/evaluate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario: EXAMPLE_SCENARIO }) });
  const body = (await res.json()) as { evaluation?: { counts?: Record<string, number> } };
  const c = body.evaluation?.counts;
  return [res.ok && c?.feasible === 0 && c?.conditional === 2 && c?.no_go === 7, JSON.stringify(c)];
});
await check("research stream completes", async () => {
  const res = await fetch(`${base}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seeds: [{ label: "Aesop", kind: "brand" }], city: "Brooklyn", venueCategory: "bookstore", guestCategories: ["skincare"], maxCandidates: 3 }),
  });
  const text = await res.text();
  const events = text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as { type: string; run?: { mode: string; candidates: unknown[] }; code?: string });
  const result = events.find((e) => e.type === "result");
  const error = events.find((e) => e.type === "error");
  return [res.ok && !!result, result ? `mode ${result.run?.mode}, ${result.run?.candidates.length} candidates` : `error: ${error?.code ?? res.status}`];
});
await check("live Qloo mode (release requirement)", async () => [mode === "live", mode === "live" ? "live" : "server is in fixture mode"]);
await check("cross-origin writes refused", async () => {
  const res = await fetch(`${base}/api/evaluate`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example" }, body: "{}" });
  return [res.status === 403, `HTTP ${res.status}`];
});

const ok = table(rows);
process.exit(ok ? 0 : 1);
