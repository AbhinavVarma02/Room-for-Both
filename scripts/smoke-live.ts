/**
 * Live Qloo smoke test. Makes one bounded research run (at most 7 calls) with the credential in
 * the environment or .dev.vars and prints counts only: no keys, no raw payloads.
 * Exits 0 with BLOCKED when no credential is present, so it is safe to run anywhere.
 */
import { QlooClient, QlooError } from "../src/worker/integrations/qloo/client";
import { runResearch } from "../src/worker/orchestration/research";
import { localVar, table } from "./lib";

const apiKey = localVar("QLOO_API_KEY");
if (!apiKey) {
  console.log("BLOCKED: QLOO_API_KEY is not set in the environment or .dev.vars (blocker EXT-QLOO-KEY). No request was made.");
  process.exit(0);
}

const transport = new QlooClient({ apiKey, baseUrl: localVar("QLOO_BASE_URL"), callBudget: 7, timeoutMs: 10_000 });
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
  const ok = table([
    ["authenticated request succeeded", run.callsUsed > 0, `${run.callsUsed} calls`],
    ["at least one reference matched exactly", run.seeds.some((s) => s.status === "exact"), run.seeds.map((s) => `${s.input.label}: ${s.status}`).join(", ")],
    ["venue category resolved to a Qloo tag", run.categoryTag !== null, run.categoryTag?.name ?? "none"],
    ["venue candidates returned", run.candidates.length > 0, `${run.candidates.length} candidates`],
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
