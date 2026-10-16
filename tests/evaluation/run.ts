/**
 * Offline evaluation: runs every handcrafted case, measures rule compliance, unsupported-claim
 * and numeric-grounding rates, research call counts, and engine latency, then writes
 * docs/evaluation-results.md. `--live` additionally runs a small authenticated Qloo sample
 * (requires QLOO_API_KEY in the environment) and stores only aggregate metrics locally.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { evaluateScenario, diffEvaluations } from "../../src/shared/domain";
import { buildBrief } from "../../src/shared/domain/brief";
import type { ScenarioEvaluation } from "../../src/shared/domain/types";
import type { ResearchRequest, ResearchRun } from "../../src/shared/schemas/evidence";
import type { Scenario } from "../../src/shared/schemas/profiles";
import { checkDraft } from "../../src/worker/integrations/gemini/client";
import { QlooClient, QlooError, type QlooPath, type QlooTransport, type QueryValue } from "../../src/worker/integrations/qloo/client";
import { FixtureTransport } from "../../src/worker/integrations/qloo/fixture-transport";
import { runResearch } from "../../src/worker/orchestration/research";
import { localVar } from "../../scripts/lib";
import { CASES, NARRATIVE_FACTS, type ResearchCase } from "./cases";

class FaultTransport implements QlooTransport {
  #inner: FixtureTransport;
  constructor(
    budget: number,
    private readonly fault: ResearchCase["fault"],
  ) {
    this.#inner = new FixtureTransport(budget);
  }
  get callsUsed() {
    return this.#inner.callsUsed;
  }
  async get(path: QlooPath, query: Record<string, QueryValue>) {
    if (this.fault === "rate_limited") {
      await this.#inner.get(path, query);
      throw new QlooError("RATE_LIMITED", "synthetic rate limit", true, 429);
    }
    if (this.fault === "timeout_venues" && path === "/v2/insights" && query["filter.type"] === "urn:entity:place") {
      await this.#inner.get(path, query);
      throw new QlooError("TIMEOUT", "synthetic timeout", true);
    }
    const value = await this.#inner.get(path, query);
    if (this.fault === "malformed") return { results: [{ unexpected: true }, "not an entity", null, { name: 42 }] };
    return value;
  }
}

/** Statements that claim outcomes the engine cannot know. Disclaimers that negate them are allowed. */
const UNSUPPORTED = /\b(will|would) (increase|boost|grow|generate|bring|attract|double)\b|\bguarantee(d|s)?\b|\b(expected|projected|estimated) (revenue|sales|visitors|footfall|customers)\b|\b\d+(\.\d+)?\s?%/i;

function statements(e: ScenarioEvaluation, s: Scenario): string[] {
  const brief = buildBrief(s, e, null, { hypothetical: false, selectedCandidateId: null, now: new Date(0) });
  return [
    ...e.options.flatMap((o) => o.constraints.flatMap((c) => [c.explanation, c.requirement?.text ?? ""])),
    ...e.reversals.flatMap((r) => r.candidates.flatMap((c) => c.changes.map((ch) => ch.description))),
    ...e.questions.flatMap((q) => [q.text, q.detail]),
    brief.summary,
    ...brief.guestValue,
    ...brief.hostValue,
  ].filter(Boolean);
}

/** Every number a statement uses must come from the inputs or from arithmetic the engine reports. */
function allowedNumbers(s: Scenario, e: ScenarioEvaluation): Set<string> {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "number") out.add(String(v));
    else if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === "object") Object.values(v).forEach(add);
  };
  add(s);
  for (const o of e.options) {
    add(o.metrics);
    add(o.variant);
    add(o.slot);
    for (const c of o.constraints) add(c.requirement?.value);
  }
  for (const r of e.reversals) for (const c of r.candidates) for (const ch of c.changes) add(ch.to);
  for (const o of e.options) {
    const fee = o.metrics.hostFeeUsd;
    const cap = s.guest.maxOutlayUsd;
    const out2 = o.metrics.guestOutlayUsd;
    if (out2 !== null && cap !== null) out.add(String(Math.abs(out2 - cap)));
    if (fee !== null && cap !== null) out.add(String(cap - fee));
  }
  const hostSpace = [s.host.guestFloorSqFt, s.host.shelfLinearFt, s.host.eventCapacity];
  const guestSpace = [s.guest.popupFootprintSqFt, s.guest.shelfLinearFt, s.guest.minEventAudience];
  for (const g of guestSpace) for (const h of hostSpace) if (g !== null && h !== null) out.add(String(Math.abs(g - h)));
  for (let h = 0; h <= 24; h += 1) out.add(String(h));
  for (let n = 1; n <= 12; n += 1) out.add(String(n));
  return out;
}

function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*/g) ?? []).map((n) => n.replace(/,/g, ""));
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
}

async function runLive() {
  const apiKey = localVar("QLOO_API_KEY");
  if (!apiKey) {
    console.log("Live evaluation skipped: QLOO_API_KEY is not set (blocker EXT-QLOO-KEY).");
    return null;
  }
  const requests: ResearchRequest[] = [
    { seeds: [{ label: "Aesop", kind: "brand" }, { label: "Braiding Sweetgrass", kind: "book" }], city: "Brooklyn", venueCategory: "bookstore", guestCategories: ["skincare"], maxCandidates: 5 },
    { seeds: [{ label: "Patagonia", kind: "brand" }], city: "Portland", venueCategory: "cafe", guestCategories: ["apparel"], maxCandidates: 5 },
    { seeds: [], city: "Chicago", venueCategory: "record_store", guestCategories: ["art_prints"], maxCandidates: 5 },
  ];
  const results = [];
  for (const request of requests) {
    const transport = new QlooClient({ apiKey, baseUrl: localVar("QLOO_BASE_URL"), callBudget: 7 });
    const t0 = performance.now();
    try {
      const run = await runResearch(request, { transport, mode: "live", callBudget: 7, runId: "eval" });
      results.push({
        venueCategory: request.venueCategory,
        seeds: request.seeds.length,
        exactSeeds: run.seeds.filter((s) => s.status === "exact").length,
        candidates: run.candidates.length,
        themes: run.themes.length,
        strengths: run.candidates.map((c) => c.strength),
        callsUsed: run.callsUsed,
        ms: Math.round(performance.now() - t0),
      });
    } catch (error) {
      results.push({ venueCategory: request.venueCategory, error: error instanceof QlooError ? error.code : "INTERNAL", callsUsed: transport.callsUsed, ms: Math.round(performance.now() - t0) });
    }
  }
  mkdirSync("tests/evaluation/output", { recursive: true });
  writeFileSync("tests/evaluation/output/live-results.json", `${JSON.stringify(results, null, 2)}\n`);
  return results;
}

async function main() {
  const rows: { id: string; category: string; description: string; checks: number; passed: number; failures: string[] }[] = [];
  let statementsTotal = 0;
  let unsupported = 0;
  let numericTotal = 0;
  let numericGrounded = 0;
  const ungroundedExamples: string[] = [];
  const latencies: number[] = [];
  const researchCalls: number[] = [];
  let invariant = 0;
  let invariantTotal = 0;
  let withQloo = { themes: 0, candidates: 0, evidence: 0 };

  const fixtureRun = await runResearch(CASES.find((c): c is ResearchCase => c.kind === "research")?.request as ResearchRequest, {
    transport: new FixtureTransport(7),
    mode: "fixture",
    callBudget: 7,
    runId: "eval",
  });

  for (const c of CASES) {
    const failures: string[] = [];
    let checks = 0;
    if (c.kind === "engine") {
      const e = evaluateScenario(c.scenario);
      for (let i = 0; i < 25; i += 1) {
        const t0 = performance.now();
        evaluateScenario(c.scenario);
        latencies.push(performance.now() - t0);
      }
      for (const check of c.checks) {
        checks += 1;
        if (!check.pass(e)) failures.push(check.name);
      }
      if (c.edit) {
        checks += 1;
        const after = evaluateScenario(c.edit.apply(c.scenario));
        const flips = diffEvaluations(e, after, { party: "guest", field: c.edit.field, from: null, to: null }, 1).flips.length;
        if ((flips > 0) !== c.edit.expectFlips) failures.push(`edit to ${c.edit.field} ${c.edit.expectFlips ? "should" : "should not"} change a decision`);
      }
      const allowed = allowedNumbers(c.scenario, e);
      for (const st of statements(e, c.scenario)) {
        statementsTotal += 1;
        if (UNSUPPORTED.test(st)) unsupported += 1;
        for (const n of numbersIn(st)) {
          numericTotal += 1;
          if (allowed.has(n)) numericGrounded += 1;
          else if (ungroundedExamples.length < 5) ungroundedExamples.push(`${c.id}: “${st}” (${n})`);
        }
      }
      // Baseline comparison: the same case with and without cultural research. Decisions must not move.
      invariantTotal += 1;
      const plain = buildBrief(c.scenario, e, null, { hypothetical: false, selectedCandidateId: null, now: new Date(0) });
      const cultural = buildBrief(c.scenario, evaluateScenario(c.scenario), fixtureRun, { hypothetical: false, selectedCandidateId: fixtureRun.candidates[0]?.venue.id ?? null, now: new Date(0) });
      if (JSON.stringify(plain.options) === JSON.stringify(cultural.options)) invariant += 1;
      withQloo = {
        themes: withQloo.themes + (cultural.cultural?.themes.length ?? 0),
        candidates: withQloo.candidates + (cultural.cultural?.selectedVenue ? 1 : 0),
        evidence: withQloo.evidence + (cultural.cultural?.themes.reduce((s, t) => s + t.items.length, 0) ?? 0),
      };
    } else if (c.kind === "research") {
      const budget = c.budget ?? 7;
      const transport = c.fault && c.fault !== "none" ? new FaultTransport(budget, c.fault) : new FixtureTransport(budget);
      let run: ResearchRun | null = null;
      let error: string | null = null;
      try {
        run = await runResearch(c.request, { transport, mode: "fixture", callBudget: budget, runId: c.id });
      } catch (e) {
        error = e instanceof QlooError ? e.code : "INTERNAL";
      }
      researchCalls.push(transport.callsUsed);
      for (const check of c.checks) {
        checks += 1;
        if (!check.pass(run, error)) failures.push(check.name);
      }
    } else {
      checks += 1;
      const accepted = checkDraft(c.draft, NARRATIVE_FACTS) === null;
      if (accepted !== c.expectAccepted) failures.push(c.expectAccepted ? "grounded draft was rejected" : "unsupported draft was accepted");
    }
    rows.push({ id: c.id, category: c.category, description: c.description, checks, passed: checks - failures.length, failures });
  }

  const totalChecks = rows.reduce((s, r) => s + r.checks, 0);
  const passedChecks = rows.reduce((s, r) => s + r.passed, 0);
  const casesPassed = rows.filter((r) => r.failures.length === 0).length;
  const live = process.argv.includes("--live") ? await runLive() : null;

  const results = {
    cases: rows.length,
    casesPassed,
    checks: totalChecks,
    checksPassed: passedChecks,
    unsupportedClaimRate: { flagged: unsupported, statements: statementsTotal },
    numericGrounding: { grounded: numericGrounded, numbers: numericTotal, examples: ungroundedExamples },
    decisionInvariance: { identical: invariant, cases: invariantTotal },
    culturalLayer: { mode: "fixture", ...withQloo },
    researchCalls: { runs: researchCalls.length, max: Math.max(...researchCalls), mean: researchCalls.reduce((a, b) => a + b, 0) / researchCalls.length },
    engineLatencyMs: { samples: latencies.length, median: quantile(latencies, 0.5), p95: quantile(latencies, 0.95) },
    live,
    rows,
  };

  const lines = [
    "# Evaluation results",
    "",
    "Generated by `npm run eval` from the synthetic cases in `tests/evaluation/cases.ts`. Do not edit by hand.",
    "Environment: offline, Node.js, fixture transport for research cases. No Qloo or model calls are made.",
    "",
    "| Measure | Result |",
    "|---|---|",
    `| Cases passing every check | ${casesPassed} / ${rows.length} |`,
    `| Individual checks passing | ${passedChecks} / ${totalChecks} (${pct(passedChecks, totalChecks)}) |`,
    `| Generated statements flagged as unsupported claims | ${unsupported} / ${statementsTotal} (${pct(unsupported, statementsTotal)}) |`,
    `| Numbers in generated statements traceable to inputs or reported arithmetic | ${numericGrounded} / ${numericTotal} (${pct(numericGrounded, numericTotal)}) |`,
    `| Decisions identical with and without the cultural layer | ${invariant} / ${invariantTotal} |`,
    `| Research runs: upstream calls per run (max / mean) | ${results.researchCalls.max} / ${results.researchCalls.mean.toFixed(1)} over ${researchCalls.length} runs |`,
    `| Engine evaluation time, median / p95 (ms, ${latencies.length} samples) | ${results.engineLatencyMs.median.toFixed(2)} / ${results.engineLatencyMs.p95.toFixed(2)} |`,
    "",
    "## Cultural layer versus no-cultural-layer baseline",
    "",
    "Both arms use identical scenarios and the identical rules engine. The cultural arm adds one fixture research run, so these",
    `numbers measure pipeline mechanics only, not the quality of Qloo's data: the cultural arm attached ${withQloo.themes} themes and`,
    `${withQloo.evidence} provenance-labelled evidence items across ${invariantTotal} briefs; the baseline attached none. Decision`,
    `invariance (${invariant}/${invariantTotal}) confirms cultural data never changes a feasibility verdict.`,
    "",
    live
      ? `Live Qloo sample: ${JSON.stringify(live)}`
      : "Live Qloo comparison: **not run** (requires an authorised Qloo key; see BLOCKERS EXT-QLOO-KEY).",
    "",
    "## Cases",
    "",
    "| ID | Category | Description | Checks | Result |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.id} | ${r.category} | ${r.description} | ${r.passed}/${r.checks} | ${r.failures.length ? `FAIL: ${r.failures.join("; ")}` : "pass"} |`),
    "",
  ];
  if (ungroundedExamples.length) lines.push("## Ungrounded numbers found", "", ...ungroundedExamples.map((x) => `- ${x}`), "");

  mkdirSync("tests/evaluation/output", { recursive: true });
  writeFileSync("tests/evaluation/output/offline-results.json", `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync("docs/evaluation-results.md", lines.join("\n"));
  console.log(lines.slice(5, 14).join("\n"));
  if (casesPassed !== rows.length) {
    console.error(`\n${rows.length - casesPassed} case(s) failed.`);
    for (const r of rows.filter((x) => x.failures.length)) console.error(`  ${r.id}: ${r.failures.join("; ")}`);
    process.exitCode = 1;
  }
}

void main();
