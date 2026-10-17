/**
 * CPU time per Worker version from Cloudflare's GraphQL analytics, for traffic `wrangler tail` cannot
 * see (preview URLs of uploaded, undeployed versions) and for longer windows of production traffic.
 * Usage: npm run cpu:analytics -- [--minutes 60] [--version <id prefix>]
 * Uses the token of the logged-in Wrangler session; it is never printed.
 */
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const minutes = Number(flag("--minutes") ?? 60);
const version = flag("--version");

const token = execSync("npx wrangler auth token", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  .split(/\s+/)
  .find((t) => /^[A-Za-z0-9_.-]{30,}$/.test(t));
const whoami = execSync("npx wrangler whoami", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const account = /([0-9a-f]{32})/.exec(whoami)?.[1];
if (!token || !account) {
  console.log("BLOCKED: no Wrangler session or account. Run `npx wrangler login`.");
  process.exit(0);
}

const until = new Date();
const since = new Date(until.getTime() - minutes * 60_000);
const query = `query ($account: String!, $since: Time!, $until: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    workersInvocationsAdaptive(limit: 50, filter: { scriptName: "room-for-both", datetime_geq: $since, datetime_leq: $until }) {
      dimensions { scriptVersion status }
      sum { requests errors subrequests }
      quantiles { cpuTimeP50 cpuTimeP90 cpuTimeP99 cpuTimeP999 }
      max { cpuTime }
    }
  } }
}`;
const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { account, since: since.toISOString(), until: until.toISOString() } }),
});
const body = (await res.json()) as {
  errors?: { message: string }[];
  data?: { viewer: { accounts: { workersInvocationsAdaptive: { dimensions: { scriptVersion: string; status: string }; sum: { requests: number; errors: number; subrequests: number }; quantiles: Record<string, number>; max: { cpuTime: number } }[] }[] } };
};
if (body.errors?.length) {
  console.log(`Analytics query failed: ${body.errors.map((e) => e.message).join("; ")}`);
  process.exit(1);
}
const rows = (body.data?.viewer.accounts[0]?.workersInvocationsAdaptive ?? []).filter((r) => !version || r.dimensions.scriptVersion.startsWith(version));
console.log(`Window: last ${minutes} minutes. CPU times in milliseconds (analytics report microseconds).`);
for (const r of rows) {
  const ms = (us: number | undefined) => (us === undefined ? "?" : (us / 1000).toFixed(1));
  console.log(
    `${r.dimensions.scriptVersion.slice(0, 8)} ${r.dimensions.status.padEnd(14)} requests ${r.sum.requests} errors ${r.sum.errors} subrequests ${r.sum.subrequests}  cpu p50 ${ms(r.quantiles.cpuTimeP50)} p90 ${ms(r.quantiles.cpuTimeP90)} p99 ${ms(r.quantiles.cpuTimeP99)} p99.9 ${ms(r.quantiles.cpuTimeP999)} max ${ms(r.max.cpuTime)}`,
  );
}
if (rows.length === 0) console.log("No invocations in this window.");
