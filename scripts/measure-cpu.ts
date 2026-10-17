/**
 * Measures CPU and wall time per route on a deployed Worker using `wrangler tail`.
 * Usage: npm run measure:cpu -- https://<worker>.workers.dev [--demo]
 * `--demo` runs research as the fictional demonstration (no upstream calls), which separates the cost
 * of handling upstream responses from the rest of the research pipeline.
 * Sends 5 evaluations, 3 research runs (three references, widened search), and 3 health checks.
 * In live mode the research runs spend real upstream quota (at most 21 calls).
 */
import { spawn } from "node:child_process";
import { EXAMPLE_SCENARIO } from "../src/shared/fixtures/example-scenario";

const base = (process.argv.slice(2).find((a) => a.startsWith("http")) ?? "").replace(/\/$/, "");
const demo = process.argv.includes("--demo");
if (!base) {
  console.log("Usage: npm run measure:cpu -- https://<worker>.workers.dev");
  process.exit(0);
}

const tail = spawn("npx wrangler tail room-for-both --format json", { shell: true, stdio: ["ignore", "pipe", "ignore"] });
let raw = "";
tail.stdout.on("data", (chunk: Buffer) => (raw += chunk.toString()));
await new Promise((r) => setTimeout(r, 20_000));

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.text());
for (let i = 0; i < 5; i += 1) await post("/api/evaluate", { scenario: EXAMPLE_SCENARIO });
for (let i = 0; i < 3; i += 1) {
  await post("/api/research", {
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
  });
}
for (let i = 0; i < 3; i += 1) await fetch(`${base}/api/health`).then((r) => r.text());
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
  const key = `${e.event?.request?.method ?? ""} ${new URL(url).pathname}`;
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
for (const [key, r] of rows) {
  console.log(`${key.padEnd(24)} n=${r.cpu.length}  cpu ms [${r.cpu.join(", ")}]  wall ms [${r.wall.join(", ")}]  ${[...r.outcomes].join(",")}`);
}
const worst = Math.max(...[...rows.values()].flatMap((r) => r.cpu));
console.log(worst <= 10 ? `Highest CPU ${worst} ms: within the Workers Free 10 ms limit.` : `Highest CPU ${worst} ms exceeds the Workers Free 10 ms limit.`);
process.exit(0);
