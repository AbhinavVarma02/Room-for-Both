/**
 * Per-route CPU for a Worker version that `wrangler tail` cannot see, such as an uploaded but undeployed
 * candidate on its preview URL. Each probe kind runs alone inside its own clock minute; Cloudflare's
 * GraphQL analytics, grouped by minute and version, then attribute CPU to each kind.
 * Usage: npm run measure:cpu:windows -- https://<alias>-room-for-both.<subdomain>.workers.dev <version id prefix> [--live] [--planner] [--n 3]
 *        [--only health,evaluate,research,baseline,venue-bridge,research+planner]
 * Without --live every research request is the fictional demonstration and no upstream quota is spent.
 * With --live: n research runs (up to 7 Qloo calls each), n category-only comparisons and n venue-side
 * lookups (1 call each). --planner adds two model-planned runs (up to 2 model calls each).
 */
import { execSync } from "node:child_process";
import { EXAMPLE_SCENARIO } from "../src/shared/fixtures/example-scenario";
import type { ResearchRun } from "../src/shared/schemas/evidence";

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) ?? "").replace(/\/$/, "");
const version = args.find((a) => /^[0-9a-f]{8}/.test(a));
const live = args.includes("--live");
const planner = args.includes("--planner");
const n = Math.min(5, Math.max(1, Number(args[args.indexOf("--n") + 1] ?? 3) || 3));
if (!base || !version) {
  console.log("Usage: npm run measure:cpu:windows -- <preview url> <version id prefix> [--live] [--planner] [--n 3]");
  process.exit(0);
}

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.text());
const research = {
  seeds: [
    { label: "Aesop", kind: "brand" },
    { label: "Patagonia", kind: "brand" },
    { label: "Braiding Sweetgrass", kind: "book" },
  ],
  city: "Brooklyn",
  neighborhood: "Greenpoint",
  venueCategory: "bookstore",
  guestCategories: ["skincare"],
  maxCandidates: 5,
  ...(live ? {} : { demo: true }),
};
const resultOf = (text: string): ResearchRun | null => {
  for (const line of text.split("\n")) if (line.includes('"type":"result"')) return (JSON.parse(line) as { run: ResearchRun }).run;
  return null;
};

/** Waits for the next clock minute plus a margin, so each probe kind owns one analytics bucket. */
async function nextMinute() {
  const now = Date.now();
  await new Promise((r) => setTimeout(r, 60_000 - (now % 60_000) + 2_000));
  return new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
}

let lastRun: ResearchRun | null = null;
let qloo = 0;
const probes: [string, () => Promise<void>][] = [
  ["health", async () => void (await fetch(`${base}/api/health`).then((r) => r.text()))],
  ["evaluate", async () => void (await post("/api/evaluate", { scenario: EXAMPLE_SCENARIO }))],
  [
    "research",
    async () => {
      lastRun = resultOf(await post("/api/research", research));
      if (lastRun?.mode === "live") qloo += lastRun.callsUsed;
    },
  ],
  [
    "baseline",
    async () => {
      const s = lastRun?.venueSearch;
      if (!s || !lastRun) return;
      await post("/api/research/baseline", { categoryTagId: s.categoryTagId, categoryName: s.categoryName, location: s.location, venueCategory: "bookstore", ...(lastRun.mode === "fixture" ? { demo: true } : {}) });
      if (lastRun.mode === "live") qloo += 1;
    },
  ],
  [
    "venue-bridge",
    async () => {
      const top = lastRun?.candidates[0];
      if (!top || !lastRun) return;
      await post("/api/research/venue-bridge", { venueId: top.venue.id, venueName: top.venue.name, venueCategory: "bookstore", ...(lastRun.mode === "fixture" ? { demo: true } : {}) });
      if (lastRun.mode === "live") qloo += 1;
    },
  ],
];
if (planner) {
  probes.push([
    "research+planner",
    async () => {
      const run = resultOf(await post("/api/research", { ...research, planner: "model", plannerConsent: true }));
      if (run?.mode === "live") qloo += run.callsUsed;
    },
  ]);
}

// `--only research,baseline` limits the probes (research still runs first when a follow-up needs its result).
const only = args.includes("--only") ? (args[args.indexOf("--only") + 1] ?? "").split(",") : null;
const windows = new Map<string, string>();
for (const [kind, fn] of probes) {
  if (only && !only.includes(kind)) {
    if (kind === "research" && only.some((k) => k === "baseline" || k === "venue-bridge")) await fn();
    continue;
  }
  const minute = await nextMinute();
  const count = kind === "research+planner" ? 2 : kind === "health" || kind === "evaluate" ? 5 : n;
  for (let i = 0; i < count; i += 1) await fn();
  windows.set(minute, kind);
  console.log(`${minute} ${kind} x${count}`);
}
console.log(`Upstream Qloo calls spent: ${qloo}. Waiting three minutes for analytics…`);
await new Promise((r) => setTimeout(r, 180_000));

const token = execSync("npx wrangler auth token", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  .split(/\s+/)
  .find((t) => /^[A-Za-z0-9_.-]{30,}$/.test(t));
const account = /([0-9a-f]{32})/.exec(execSync("npx wrangler whoami", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))?.[1];
const minutes = [...windows.keys()].sort();
const query = `query ($account: String!, $since: Time!, $until: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    workersInvocationsAdaptive(limit: 100, filter: { scriptName: "room-for-both", datetime_geq: $since, datetime_leq: $until }) {
      dimensions { scriptVersion datetimeMinute status }
      sum { requests errors }
      quantiles { cpuTimeP50 cpuTimeP90 cpuTimeP99 }
      max { cpuTime }
    }
  } }
}`;
const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { account, since: minutes[0], until: new Date(Date.parse(minutes[minutes.length - 1] ?? "") + 60_000).toISOString() } }),
});
const body = (await res.json()) as {
  errors?: { message: string }[];
  data?: { viewer: { accounts: { workersInvocationsAdaptive: { dimensions: { scriptVersion: string; datetimeMinute: string; status: string }; sum: { requests: number; errors: number }; quantiles: Record<string, number>; max: { cpuTime: number } }[] }[] } };
};
if (body.errors?.length) {
  console.log(`Analytics query failed: ${body.errors.map((e) => e.message).join("; ")}`);
  process.exit(1);
}
const ms = (us: number | undefined) => (us === undefined ? "?" : (us / 1000).toFixed(1));
for (const r of (body.data?.viewer.accounts[0]?.workersInvocationsAdaptive ?? []).filter((x) => x.dimensions.scriptVersion.startsWith(version)).sort((a, b) => a.dimensions.datetimeMinute.localeCompare(b.dimensions.datetimeMinute))) {
  const kind = windows.get(new Date(r.dimensions.datetimeMinute).toISOString()) ?? "other";
  console.log(
    `${kind.padEnd(17)} ${r.dimensions.status.padEnd(10)} requests ${r.sum.requests} errors ${r.sum.errors}  cpu p50 ${ms(r.quantiles.cpuTimeP50)} p90 ${ms(r.quantiles.cpuTimeP90)} p99 ${ms(r.quantiles.cpuTimeP99)} max ${ms(r.max.cpuTime)}`,
  );
}
