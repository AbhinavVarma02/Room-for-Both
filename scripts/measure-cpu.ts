/**
 * Measures CPU and wall time per route on a deployed Worker using `wrangler tail`.
 * Usage: npm run measure:cpu -- https://<worker>.workers.dev [--demo] [--runs N] [--followups] [--planner]
 *        [--version-id <id>]
 * `--demo` runs research as the fictional demonstration (no upstream calls), which separates the cost
 * of handling upstream responses from the rest of the research pipeline. `--followups` adds the
 * category-only comparison and the venue-side lookup after each run; `--planner` adds runs where the
 * model planner decides (with consent). `--version-id` limits the tail to one Worker version, so a
 * candidate uploaded with `wrangler versions upload` can be measured on its preview URL.
 * Sends 3 health checks, 5 evaluations, and N research runs (default 3; three references, widened search).
 * In live mode each research run spends up to 7 upstream calls, each follow-up 1, each planner run up to 2
 * model calls.
 */
import { spawn } from "node:child_process";
import { EXAMPLE_SCENARIO } from "../src/shared/fixtures/example-scenario";
import type { ResearchRun } from "../src/shared/schemas/evidence";

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) ?? "").replace(/\/$/, "");
const demo = args.includes("--demo");
const followups = args.includes("--followups");
const planner = args.includes("--planner");
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const runs = Math.min(5, Math.max(1, Number(flag("--runs") ?? 3)));
const versionId = flag("--version-id");
if (!base) {
  console.log("Usage: npm run measure:cpu -- https://<worker>.workers.dev");
  process.exit(0);
}

const tail = spawn(`npx wrangler tail room-for-both --format json${versionId ? ` --version-id ${versionId}` : ""}`, { shell: true, stdio: ["ignore", "pipe", "ignore"] });
let raw = "";
tail.stdout.on("data", (chunk: Buffer) => (raw += chunk.toString()));
await new Promise((r) => setTimeout(r, 20_000));

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
  ...(demo ? { demo: true } : {}),
};
const resultOf = (text: string): ResearchRun | null => {
  for (const line of text.split("\n")) {
    if (line.includes('"type":"result"')) return (JSON.parse(line) as { run: ResearchRun }).run;
  }
  return null;
};
for (let i = 0; i < 3; i += 1) await fetch(`${base}/api/health`).then((r) => r.text());
for (let i = 0; i < 5; i += 1) await post("/api/evaluate", { scenario: EXAMPLE_SCENARIO });
let upstreamCalls = 0;
for (let i = 0; i < runs; i += 1) {
  const run = resultOf(await post("/api/research", research));
  upstreamCalls += run?.mode === "live" ? run.callsUsed : 0;
  const top = run?.candidates[0];
  if (followups && run?.venueSearch && top) {
    const d = run.mode === "fixture" ? { demo: true } : {};
    await post("/api/research/baseline", { categoryTagId: run.venueSearch.categoryTagId, categoryName: run.venueSearch.categoryName, location: run.venueSearch.location, venueCategory: "bookstore", ...d });
    await post("/api/research/venue-bridge", { venueId: top.venue.id, venueName: top.venue.name, venueCategory: "bookstore", ...d });
    upstreamCalls += run.mode === "live" ? 2 : 0;
  }
}
if (planner) {
  for (let i = 0; i < 2; i += 1) {
    const run = resultOf(await post("/api/research?probe=planner", { ...research, planner: "model", plannerConsent: true }));
    upstreamCalls += run?.mode === "live" ? run.callsUsed : 0;
    console.log(`planner run: ${run?.planner?.modelCalls ?? 0} model calls, decisions ${run?.planner?.decisions.map((d) => `${d.point}:${d.planner}${d.fallback ? "(fallback)" : ""}`).join(" ")}`);
  }
}
console.log(`Upstream Qloo calls spent (approximate): ${upstreamCalls}`);
await new Promise((r) => setTimeout(r, 15_000));
// With a shell on Windows, kill() only stops the shell and leaves `wrangler tail` running.
if (process.platform === "win32" && tail.pid) spawn("taskkill", ["/pid", String(tail.pid), "/T", "/F"], { stdio: "ignore" });
else tail.kill();

// The tail stream is a sequence of JSON objects; split it by brace depth, ignoring braces inside strings.
const events: { cpuTime?: number; wallTime?: number; outcome?: string; event?: { request?: { url?: string; method?: string } } }[] = [];
let depth = 0;
let start = -1;
let inString = false;
let escaped = false;
for (let i = 0; i < raw.length; i += 1) {
  const ch = raw[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = true;
    else if (ch === '"') inString = false;
    continue;
  }
  if (ch === '"') inString = true;
  else if (ch === "{") {
    if (depth === 0) start = i;
    depth += 1;
  } else if (ch === "}") {
    depth -= 1;
    if (depth === 0) {
      try {
        events.push(JSON.parse(raw.slice(start, i + 1)));
      } catch {
        // Ignore partial objects at the stream edges.
      }
    }
  }
}

const rows = new Map<string, { cpu: number[]; wall: number[]; outcomes: Set<string> }>();
for (const e of events) {
  const url = e.event?.request?.url;
  if (!url) continue;
  const key = `${e.event?.request?.method ?? ""} ${new URL(url).pathname}${new URL(url).search}`;
  const row = rows.get(key) ?? { cpu: [], wall: [], outcomes: new Set<string>() };
  row.cpu.push(e.cpuTime ?? NaN);
  row.wall.push(e.wallTime ?? NaN);
  row.outcomes.add(e.outcome ?? "unknown");
  rows.set(key, row);
}
if (rows.size === 0) {
  console.log("No tail events captured. Check `npx wrangler whoami` and that the Worker name is room-for-both.");
  process.exit(1);
}
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? NaN;
for (const [key, r] of rows) {
  console.log(
    `${key.padEnd(36)} n=${r.cpu.length}  cpu ms [${r.cpu.join(", ")}] p50 ${q(r.cpu, 0.5)} p90 ${q(r.cpu, 0.9)} max ${Math.max(...r.cpu)}  wall ms [${r.wall.join(", ")}]  ${[...r.outcomes].join(",")}`,
  );
}
const worst = Math.max(...[...rows.values()].flatMap((r) => r.cpu));
console.log(worst <= 10 ? `Highest CPU ${worst} ms: within the Workers Free 10 ms limit.` : `Highest CPU ${worst} ms exceeds the Workers Free 10 ms limit.`);
process.exit(0);
