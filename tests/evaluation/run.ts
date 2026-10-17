/**
 * Offline evaluation: runs every handcrafted case, measures rule compliance, unsupported-claim
 * and numeric-grounding rates, research call counts, and engine latency, then writes
 * docs/evaluation-results.md. `--live` additionally runs a small authenticated Qloo sample
 * (requires QLOO_API_KEY in the environment) and stores only aggregate metrics locally.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { applyChanges, evaluateScenario, diffEvaluations } from "../../src/shared/domain";
import { compareBridge, crossDomainTheme } from "../../src/shared/domain/bridge";
import { buildBrief } from "../../src/shared/domain/brief";
import { compareDiscovery } from "../../src/shared/domain/comparison";
import { compareSensitivity } from "../../src/shared/domain/sensitivity";
import { selectionFrom } from "../../src/shared/domain/selection";
import type { ScenarioEvaluation } from "../../src/shared/domain/types";
import type { ResearchRequest, ResearchRun, SensitivityRequest } from "../../src/shared/schemas/evidence";
import type { Scenario } from "../../src/shared/schemas/profiles";
import { checkDraft } from "../../src/worker/integrations/gemini/client";
import { QlooClient, QlooError, type QlooPath, type QlooTransport, type QueryValue } from "../../src/worker/integrations/qloo/client";
import { FixtureTransport } from "../../src/worker/integrations/qloo/fixture-transport";
import { normalizeEntity, normalizeTag, resultItems } from "../../src/worker/integrations/qloo/normalize";
import { runBaseline, runSensitivity, runVenueBridge } from "../../src/worker/orchestration/followups";
import { runResearch } from "../../src/worker/orchestration/research";
import type { VenueSelection } from "../../src/shared/schemas/selection";
import { localVar } from "../../scripts/lib";
import { EXAMPLE_GUEST } from "../../src/shared/fixtures/example-scenario";
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
  const brief = buildBrief(s, e, null, { hypothetical: false, selection: null, now: new Date(0) });
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

/**
 * Fixed live scenarios. They reuse the product's example references and cover each bridge path:
 * cross-domain books, cross-domain podcasts, a brand-only reference where the cross-domain lookup
 * may be rejected (taste-tag fallback), an unresolvable small-business name, and no references.
 */
const LIVE_SCENARIOS: { id: string; request: ResearchRequest }[] = [
  { id: "L1 example: 3 references, Greenpoint then Brooklyn, bookstore", request: { seeds: [{ label: "Aesop", kind: "brand" }, { label: "Patagonia", kind: "brand" }, { label: "Braiding Sweetgrass", kind: "book" }], city: "Brooklyn", neighborhood: "Greenpoint", venueCategory: "bookstore", guestCategories: ["skincare"], maxCandidates: 5 } },
  { id: "L2 brand reference, Portland, cafe", request: { seeds: [{ label: "Patagonia", kind: "brand" }], city: "Portland", venueCategory: "cafe", guestCategories: ["apparel"], maxCandidates: 5 } },
  { id: "L3 brand-only reference, Brooklyn, bookstore", request: { seeds: [{ label: "Aesop", kind: "brand" }], city: "Brooklyn", venueCategory: "bookstore", guestCategories: ["skincare"], maxCandidates: 5 } },
  { id: "L4 unresolvable business name plus artist, Chicago, record store", request: { seeds: [{ label: "Fernleaf Botanics", kind: "brand" }, { label: "Khruangbin", kind: "artist" }], city: "Chicago", venueCategory: "record_store", guestCategories: ["art_prints"], maxCandidates: 5 } },
  { id: "L5 no references, Austin, plant shop", request: { seeds: [], city: "Austin", venueCategory: "plant_shop", guestCategories: ["plants"], maxCandidates: 5 } },
];

function sensitivityRequest(run: ResearchRun): SensitivityRequest | null {
  const signals = run.seeds.filter((x) => x.status === "exact" && x.entity).map((x) => ({ id: x.entity?.id ?? "", label: x.input.label.slice(0, 80) }));
  if (!run.venueSearch || signals.length < 2) return null;
  const { categoryTagId, categoryName, location, take } = run.venueSearch;
  return { categoryTagId, categoryName, location, venueCategory: run.request.venueCategory, signals: signals.slice(0, 3), take: Math.min(take, 8) };
}

async function runLive() {
  const apiKey = localVar("QLOO_API_KEY");
  if (!apiKey) {
    console.log("Live evaluation skipped: QLOO_API_KEY is not set. No request was made.");
    return null;
  }
  const results = [];
  let extraCalls = 0;
  for (const { id, request } of LIVE_SCENARIOS) {
    const inner = new QlooClient({ apiKey, baseUrl: localVar("QLOO_BASE_URL"), callBudget: 7 });
    let rawItems = 0;
    let dropped = 0;
    // Counts items the normaliser rejects; payloads themselves are never stored.
    const transport: QlooTransport = {
      get callsUsed() {
        return inner.callsUsed;
      },
      async get(path: QlooPath, query: Record<string, QueryValue>) {
        const payload = await inner.get(path, query);
        const tags = path === "/v2/tags" || query["filter.type"] === "urn:tag";
        const items = resultItems(payload, tags ? "tags" : "entities");
        rawItems += items.length;
        dropped += items.filter((i) => (tags ? normalizeTag(i) : normalizeEntity(i)) === null).length;
        return payload;
      },
    };
    const t0 = performance.now();
    try {
      const run = await runResearch(request, { transport, mode: "live", callBudget: 7, runId: "eval" });
      const evidence = [...run.seeds.map((x) => x.provenance), ...run.candidates.map((c) => c.provenance), ...run.themes.map((t) => t.provenance)];
      const text = [...run.limitations, ...run.themes.map((t) => t.rationale), ...run.steps.map((x) => x.summary)];
      const bridge = run.steps.find((x) => x.id === "cultural_bridge");
      // Category-only comparison (one call) and venue-side bridge for the first venue (one call).
      const extra = { compare: "not run", inBoth: 0, onlyWithTaste: 0, topInCategoryOnly: "n/a", venueSideItems: 0, sharedItems: 0, sharedTags: 0, sensitivity: "not run" };
      const top = run.candidates[0];
      if (run.venueSearch && top && top.strength !== "unscored") {
        const followup = new QlooClient({ apiKey, baseUrl: localVar("QLOO_BASE_URL"), callBudget: 2 });
        const base = await runBaseline(
          { categoryTagId: run.venueSearch.categoryTagId, categoryName: run.venueSearch.categoryName, location: run.venueSearch.location, venueCategory: request.venueCategory },
          { transport: followup, mode: "live" },
        );
        extraCalls += followup.callsUsed;
        const cmp = compareDiscovery(run.candidates, base.candidates, base.depth);
        const r = cmp.rows.find((x) => x.id === top.venue.id)?.baselineRank;
        Object.assign(extra, { compare: cmp.outcome, inBoth: cmp.inBoth, onlyWithTaste: cmp.onlyWithTaste, topInCategoryOnly: r ? `#${r}` : `not in top ${base.depth}` });
        const vb = new QlooClient({ apiKey, baseUrl: localVar("QLOO_BASE_URL"), callBudget: 2 });
        try {
          const venue = await runVenueBridge({ venueId: top.venue.id, venueName: top.venue.name, venueCategory: request.venueCategory }, { transport: vb, mode: "live" });
          const b = compareBridge(crossDomainTheme(run.themes), venue, run.bridgeDomain ?? null);
          Object.assign(extra, { venueSideItems: venue.items.length, sharedItems: b?.shared.length ?? 0, sharedTags: b?.sharedTags.length ?? 0 });
        } catch {
          // Categories without a cross-domain type have no venue-side lookup.
        }
        extraCalls += vb.callsUsed;
        // Reference sensitivity: one call per matched reference, only when at least two matched.
        const sreq = sensitivityRequest(run);
        if (sreq) {
          const st = new QlooClient({ apiKey, baseUrl: localVar("QLOO_BASE_URL"), callBudget: sreq.signals.length + 1 });
          const sens = compareSensitivity(run.candidates, await runSensitivity(sreq, { transport: st, mode: "live" }));
          extra.sensitivity = sens.references.map((x) => x.effect).join(",");
          extraCalls += st.callsUsed;
        }
      }
      results.push({
        id,
        references: request.seeds.length,
        exact: run.seeds.filter((x) => x.status === "exact").length,
        uncertain: run.seeds.filter((x) => x.status === "uncertain").length,
        unresolved: run.seeds.filter((x) => x.status === "unresolved").length,
        categoryMatched: run.categoryTag !== null,
        widened: run.steps.some((x) => x.id === "broaden_location"),
        candidates: run.candidates.length,
        scored: run.candidates.filter((c) => c.venue.affinity !== null).length,
        explained: run.candidates.filter((c) => c.contributions.length > 0).length,
        themes: run.themes.length,
        bridge: bridge ? `${bridge.tool}:${bridge.status}` : "none",
        provenanceObserved: `${evidence.filter((p) => p.kind === "qloo_observed").length}/${evidence.length}`,
        unsupportedStatements: text.filter((x) => UNSUPPORTED.test(x)).length,
        normalisationDropped: `${dropped}/${rawItems}`,
        callsUsed: run.callsUsed,
        ...extra,
        ms: Math.round(performance.now() - t0),
      });
    } catch (error) {
      results.push({ id, error: error instanceof QlooError ? error.code : "INTERNAL", callsUsed: inner.callsUsed, ms: Math.round(performance.now() - t0) });
    }
  }
  mkdirSync("tests/evaluation/output", { recursive: true });
  writeFileSync("tests/evaluation/output/live-results.json", `${JSON.stringify(results, null, 2)}
`);
  console.table(results);
  console.log(`Follow-up calls (comparison, venue side, sensitivity): ${extraCalls}`);
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
  let withQloo = { themes: 0, candidates: 0, evidence: 0, activations: 0 };
  let activationStatements = 0;
  let activationUnsupported = 0;
  const ideas = { briefs: 0, ideas: 0, repeatedItems: 0, formats: 0, formatsMatchingEngine: 0, statements: 0, unsupported: 0 };
  const proposals = { briefs: 0, changed: 0, labelledUnconfirmed: 0 };

  const fixtureRun = await runResearch(CASES.find((c): c is ResearchCase => c.kind === "research")?.request as ResearchRequest, {
    transport: new FixtureTransport(7),
    mode: "fixture",
    callBudget: 7,
    runId: "eval",
  });
  // Follow-ups on the fixture run: the category-only comparison and the venue's own side of the bridge.
  const search = fixtureRun.venueSearch;
  const firstVenue = fixtureRun.candidates[0];
  if (!search || !firstVenue) throw new Error("The fixture research run returned no venues.");
  const fixtureBaseline = await runBaseline(
    { categoryTagId: search.categoryTagId, categoryName: search.categoryName, location: search.location, venueCategory: fixtureRun.request.venueCategory },
    { transport: new FixtureTransport(2), mode: "fixture" },
  );
  const fixtureComparison = compareDiscovery(fixtureRun.candidates, fixtureBaseline.candidates, fixtureBaseline.depth);
  const fixtureVenueBridge = await runVenueBridge(
    { venueId: firstVenue.venue.id, venueName: firstVenue.venue.name, venueCategory: fixtureRun.request.venueCategory },
    { transport: new FixtureTransport(2), mode: "fixture" },
  );
  const fixtureSelection: VenueSelection = { ...(selectionFrom(fixtureRun, firstVenue.venue.id, new Date(0)) as VenueSelection), venueBridge: fixtureVenueBridge, baseline: fixtureBaseline };
  const fixtureBridge = compareBridge(crossDomainTheme(fixtureRun.themes), fixtureVenueBridge, fixtureRun.bridgeDomain ?? null);
  // Reference sensitivity needs at least two matched references, so it runs on the fictional example's three.
  const exampleRun = await runResearch({ ...fixtureRun.request, seeds: EXAMPLE_GUEST.culturalSeeds }, { transport: new FixtureTransport(7), mode: "fixture", callBudget: 7, runId: "eval-example" });
  const fixtureSensitivityRequest = sensitivityRequest(exampleRun);
  const fixtureSensitivity = fixtureSensitivityRequest
    ? compareSensitivity(exampleRun.candidates, await runSensitivity(fixtureSensitivityRequest, { transport: new FixtureTransport(4), mode: "fixture" }))
    : null;

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
      const plain = buildBrief(c.scenario, e, null, { hypothetical: false, selection: null, now: new Date(0) });
      // The cultural arm links the host to a selected venue with venue-side evidence, so the activation
      // idea and the two-sided bridge are attached; decisions must still not move.
      const linkedScenario: Scenario = { ...c.scenario, host: { ...c.scenario.host, qlooEntityId: fixtureSelection.candidate.venue.id } };
      const cultural = buildBrief(linkedScenario, evaluateScenario(linkedScenario), fixtureRun, { hypothetical: false, selection: fixtureSelection, now: new Date(0) });
      if (JSON.stringify(plain.options) === JSON.stringify(cultural.options) && JSON.stringify(plain.proposal) === JSON.stringify(cultural.proposal)) invariant += 1;
      withQloo = {
        themes: withQloo.themes + (cultural.cultural?.themes.length ?? 0),
        candidates: withQloo.candidates + (cultural.venue ? 1 : 0),
        evidence: withQloo.evidence + (cultural.cultural?.themes.reduce((s, t) => s + t.items.length, 0) ?? 0),
        activations: withQloo.activations + (cultural.activation ? 1 : 0),
      };
      // Proposal ideas: each from distinct evidence, every status read from the engine, no outcome claims.
      const linkedEval = evaluateScenario(linkedScenario);
      ideas.briefs += 1;
      ideas.ideas += cultural.concepts.length;
      const seen = new Set<string>();
      for (const idea of cultural.concepts) {
        for (const item of idea.items) {
          if (seen.has(item)) ideas.repeatedItems += 1;
          seen.add(item);
        }
        for (const f of idea.formats) {
          ideas.formats += 1;
          if (linkedEval.options.find((o) => o.id === f.optionId)?.status === f.status) ideas.formatsMatchingEngine += 1;
        }
        for (const st of [idea.pitch, ...idea.observed, ...idea.mightNotSuit, ...idea.hostConfirmations]) {
          ideas.statements += 1;
          if (UNSUPPORTED.test(st)) {
            ideas.unsupported += 1;
            failures.push(`idea statement flagged: ${st.slice(0, 60)}`);
          }
        }
      }
      // Counterproposal: apply the first verified change and check every edited value reads as unconfirmed.
      const change = e.reversals.find((r) => r.minimalChange?.verified)?.minimalChange;
      if (change) {
        const whatIf = applyChanges(c.scenario, change.changes);
        const proposal = buildBrief(whatIf, evaluateScenario(whatIf), null, { hypothetical: true, selection: null, now: new Date(0), stated: { scenario: c.scenario, evaluation: e } });
        const edited = proposal.inputs.filter((i) => i.proposedChange);
        proposals.briefs += 1;
        proposals.changed += edited.length;
        proposals.labelledUnconfirmed += edited.filter((i) => i.provenance === "unknown" && i.proposedChange?.confirmBy === i.party).length;
        checks += 1;
        if (!proposal.counterproposal || edited.some((i) => i.provenance !== "unknown")) failures.push("an edited value kept a party's provenance in the what-if brief");
      }
      const activationText = [cultural.activation?.pitch ?? "", ...(cultural.activation?.why ?? []), ...(cultural.activation?.unverified ?? []), cultural.hostTerms.disclaimer ?? ""];
      for (const st of activationText.filter(Boolean)) {
        activationStatements += 1;
        if (UNSUPPORTED.test(st)) {
          activationUnsupported += 1;
          failures.push(`activation statement flagged: ${st.slice(0, 60)}`);
        }
      }
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
  if (process.argv.includes("--live")) await runLive();

  const results = {
    cases: rows.length,
    casesPassed,
    checks: totalChecks,
    checksPassed: passedChecks,
    unsupportedClaimRate: { flagged: unsupported, statements: statementsTotal },
    numericGrounding: { grounded: numericGrounded, numbers: numericTotal, examples: ungroundedExamples },
    decisionInvariance: { identical: invariant, cases: invariantTotal },
    culturalLayer: { mode: "fixture", ...withQloo, activationStatements, activationUnsupported },
    categoryOnlyComparison: { mode: "fixture", outcome: fixtureComparison.outcome, inBoth: fixtureComparison.inBoth, onlyWithTaste: fixtureComparison.onlyWithTaste, onlyCategory: fixtureComparison.onlyCategory },
    venueSideBridge: { mode: "fixture", items: fixtureVenueBridge.items.length, shared: fixtureBridge?.shared.length ?? 0, sharedTags: fixtureBridge?.sharedTags.length ?? 0 },
    proposalIdeas: ideas,
    counterproposals: proposals,
    referenceSensitivity: { mode: "fixture", effects: fixtureSensitivity?.references.map((r) => `${r.omitted}: ${r.effect}`) ?? [] },
    researchCalls: { runs: researchCalls.length, max: Math.max(...researchCalls), mean: researchCalls.reduce((a, b) => a + b, 0) / researchCalls.length },
    engineLatencyMs: { samples: latencies.length, median: quantile(latencies, 0.5), p95: quantile(latencies, 0.95) },
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
    `| Decisions identical with and without the cultural layer (venue, bridge, and activation idea attached) | ${invariant} / ${invariantTotal} |`,
    `| Activation-idea and disclaimer statements flagged as unsupported claims | ${activationUnsupported} / ${activationStatements} |`,
    `| Proposal ideas: format statuses identical to the rules engine | ${ideas.formatsMatchingEngine} / ${ideas.formats} |`,
    `| Proposal ideas: items repeated from another idea in the same brief | ${ideas.repeatedItems} (over ${ideas.ideas} ideas in ${ideas.briefs} briefs) |`,
    `| Proposal-idea statements flagged as unsupported claims | ${ideas.unsupported} / ${ideas.statements} |`,
    `| What-if briefs: edited values labelled as unconfirmed proposals | ${proposals.labelledUnconfirmed} / ${proposals.changed} (in ${proposals.briefs} briefs) |`,
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
    "## Category-only comparison and venue-side bridge (fixture mechanics)",
    "",
    `The fixture run was compared with a category-only search of the same category and area (outcome: ${fixtureComparison.outcome}).`,
    `${fixtureComparison.inBoth} venues appear in both lists, ${fixtureComparison.onlyWithTaste} only in the taste-informed list, and ${fixtureComparison.onlyCategory} only in the category-only list.`,
    `The venue-side lookup for the first venue returned ${fixtureVenueBridge.items.length} items: ${fixtureBridge?.shared.length ?? 0} also on the guest side, with ${fixtureBridge?.sharedTags.length ?? 0} shared taste tags.`,
    fixtureSensitivity
      ? `Reference sensitivity on a fixture run with the fictional example's three references (one fictional search per left-out reference): ${fixtureSensitivity.references.map((r) => `without “${r.omitted}”, ${r.effect.replace(/_/g, " ")}`).join("; ")}. The fixture builds in this dependence on purpose so both outcomes are exercised.`
      : "Reference sensitivity was not run: the fixture run had fewer than two matched references.",
    "Fixture data is fictional, so these figures check the mechanics only. Live figures are recorded in `docs/evaluation.md`.",
    "",
    "Live Qloo measurements are taken separately with `npm run eval -- --live` (fixed scenarios, aggregate metrics only) and",
    "recorded with their date in `docs/evaluation.md`; this generated report stays offline so it is reproducible.",
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
