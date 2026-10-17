import { BRIDGE_DOMAINS, BRIDGE_DOMAIN_TYPES, CROSS_DOMAIN_BY_VENUE, PRODUCT_CATEGORY_LABELS, SEED_KIND_LABELS, VENUE_CATEGORY_LABELS, type BridgeDomain } from "../../shared/constants/vocabulary";
import type { ResearchRequest, ResolvedSeed } from "../../shared/schemas/evidence";
import { BridgeProposal, WidenProposal, type DecisionPoint, type PlannerDecision, type PlannerTrace } from "../../shared/schemas/planner";
import { PlannerCallError, responseSchema } from "../integrations/gemini/planner";

/**
 * Bounded planning. The deterministic planner is always available and is the fallback for every
 * decision. With the visitor's consent, a language model may propose one allow-listed action at each
 * of at most `maxDecisions` decision points; the Worker validates the proposal against the
 * allow-list and the run's own state, and runs the deterministic choice whenever it does not hold.
 * There is no loop: each decision point is visited at most once per run.
 */

export interface ModelPort {
  model: string;
  /** Sends one decision prompt; resolves with the model's parsed JSON or throws PlannerCallError. */
  propose(prompt: string, schema: object): Promise<unknown>;
  /** Reserves one model call against the deployment's daily allowance; false when none is left. */
  reserveCall(): Promise<boolean>;
}

export interface PlannerSetup {
  requested: "model" | "deterministic";
  availability: string;
  port: ModelPort | null;
  maxDecisions: number;
}

/** `none` skips only the bridge (no exact reference); `stop` ends the run before venue discovery. */
export type BridgeChoice =
  | { kind: "cross_domain"; domain: BridgeDomain }
  | { kind: "taste_tags" }
  | { kind: "none" }
  | { kind: "stop" };

const describe = (p: BridgeProposal | WidenProposal): string => {
  if (p.action === "cross_domain") return `Build the bridge from ${BRIDGE_DOMAINS[p.domain as BridgeDomain].noun}`;
  if (p.action === "taste_tags") return "Build the bridge from taste tags";
  if (p.action === "clarify") return `Ask the visitor to confirm reference #${p.referenceIndex + 1}`;
  if (p.action === "widen") return "Widen the venue search to the city";
  return "Stop";
};

// Model rationales are shown to visitors, so they get the same guard as model summaries: no links,
// no markup, and no claims about outcomes.
export function rationaleProblem(text: string): string | null {
  if (text.trim().length === 0) return "it gave no rationale";
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ai)\b/i.test(text)) return "its rationale contains a link";
  if (/[<>{}`]|\[[^\]]*\]\(/.test(text)) return "its rationale contains markup";
  if (/\b(will|would) (increase|boost|grow|generate|bring|attract|double)\b|\bguarantee/i.test(text)) return "its rationale claims an outcome";
  return null;
}

export class PlannerSession {
  readonly trace: PlannerTrace;
  #setup: PlannerSetup;
  #now: () => number;

  constructor(setup: PlannerSetup, now: () => number) {
    this.#setup = setup;
    this.#now = now;
    this.trace = {
      requested: setup.requested,
      availability: setup.availability,
      model: setup.port?.model ?? null,
      maxDecisions: setup.maxDecisions,
      modelCalls: 0,
      decisions: [],
      stopReason: null,
      clarification: null,
    };
  }

  /** Asks the model when allowed; returns its raw answer or the reason it could not be asked. */
  async #ask(point: DecisionPoint, prompt: string, schema: object): Promise<{ raw: unknown } | { skipped: string }> {
    const port = this.#setup.port;
    if (this.#setup.requested !== "model" || !port) return { skipped: this.#setup.availability };
    if (this.trace.modelCalls >= this.#setup.maxDecisions) return { skipped: `The run's limit of ${this.#setup.maxDecisions} model decisions was reached.` };
    if (!(await port.reserveCall())) return { skipped: "Today's model allowance is used up." };
    this.trace.modelCalls += 1;
    try {
      return { raw: await port.propose(prompt, schema) };
    } catch (error) {
      const code = error instanceof PlannerCallError ? error.code : "upstream";
      const why: Record<string, string> = {
        timeout: "The model did not answer in time.",
        quota: "The model's free-tier quota was exhausted.",
        malformed: "The model's answer was not valid JSON.",
        not_configured: "The model planner is not configured.",
        upstream: "The model service returned an error.",
      };
      void point;
      return { skipped: why[code] ?? why.upstream ?? "The model could not be asked." };
    }
  }

  #record(d: Omit<PlannerDecision, "ms">, t0: number) {
    this.trace.decisions.push({ ...d, ms: Math.max(0, this.#now() - t0) });
    return this.trace.decisions[this.trace.decisions.length - 1] as PlannerDecision;
  }

  /** Decision 1, after references are matched: which domain to build the cultural bridge from. */
  async decideBridge(request: ResearchRequest, seeds: ResolvedSeed[]): Promise<{ choice: BridgeChoice; decision: PlannerDecision }> {
    const t0 = this.#now();
    const exact = seeds.filter((s) => s.status === "exact" && s.entity);
    const uncertain = seeds.map((s, i) => ({ s, i })).filter(({ s }) => s.status === "uncertain" && s.entity);
    const fallbackDomain = CROSS_DOMAIN_BY_VENUE[request.venueCategory]?.type;
    const deterministic: BridgeChoice = exact.length === 0 ? { kind: "none" } : fallbackDomain ? { kind: "cross_domain", domain: fallbackDomain } : { kind: "taste_tags" };
    const deterministicText = deterministic.kind === "cross_domain" ? `Build the bridge from ${BRIDGE_DOMAINS[deterministic.domain].noun}` : deterministic.kind === "taste_tags" ? "Build the bridge from taste tags" : "Skip the bridge: no reference matched exactly";

    if (exact.length === 0 && uncertain.length === 0) {
      return {
        choice: deterministic,
        decision: this.#record({ point: "bridge", planner: "deterministic", proposed: null, accepted: true, reason: "Nothing to decide: no reference matched, so no model was asked.", executed: deterministicText, rationale: null, fallback: false }, t0),
      };
    }

    const actions = [...(exact.length ? ["cross_domain", "taste_tags"] : []), ...(uncertain.length ? ["clarify"] : []), ...(exact.length === 0 ? ["stop"] : [])];
    const facts = {
      venueCategory: VENUE_CATEGORY_LABELS[request.venueCategory],
      guestProductCategories: request.guestCategories.map((c) => PRODUCT_CATEGORY_LABELS[c]),
      references: seeds.map((s, i) => ({ index: i, label: s.input.label, kind: SEED_KIND_LABELS[s.input.kind], match: s.status === "uncertain" ? "approximate" : s.status })),
    };
    const prompt = [
      "Decision: how to build the cultural bridge, the theme a guest brand and a venue could build a collaboration around.",
      "Allowed actions:",
      ...(exact.length ? [`- cross_domain with domain one of ${BRIDGE_DOMAIN_TYPES.map((d) => `${d} (${BRIDGE_DOMAINS[d].noun})`).join(", ")}: what the references' audience also likes in that domain.`, "- taste_tags: describe the references' audience with taste tags instead."] : []),
      ...(uncertain.length ? ["- clarify with referenceIndex: only for a reference whose match is approximate; the visitor is asked which entity they meant."] : []),
      ...(exact.length === 0 ? ["- stop: end the run because no reference matched exactly."] : []),
      `If unsure, choose ${deterministic.kind === "cross_domain" ? `cross_domain with ${deterministic.domain}` : deterministic.kind === "none" ? "clarify" : deterministic.kind}.`,
      `Facts (JSON data): ${JSON.stringify(facts)}`,
    ].join("\n");

    const asked = await this.#ask("bridge", prompt, responseSchema(actions, exact.length ? BRIDGE_DOMAIN_TYPES : []));
    if ("skipped" in asked) {
      return {
        choice: deterministic,
        decision: this.#record({ point: "bridge", planner: "deterministic", proposed: null, accepted: false, reason: asked.skipped, executed: deterministicText, rationale: null, fallback: this.#setup.requested === "model" }, t0),
      };
    }
    const parsed = BridgeProposal.safeParse(asked.raw);
    const reject = (proposed: string | null, reason: string) => ({
      choice: deterministic,
      decision: this.#record({ point: "bridge", planner: "deterministic", proposed, accepted: false, reason: `Rejected: ${reason} The deterministic choice ran instead.`, executed: deterministicText, rationale: null, fallback: true }, t0),
    });
    if (!parsed.success) return reject(null, "the answer was not one allowed action with the required fields.");
    const p = parsed.data;
    if (!actions.includes(p.action)) return reject(describe(p), `“${p.action}” is not allowed at this point.`);
    const problem = rationaleProblem(p.rationale);
    if (problem) return reject(describe(p), `${problem}.`);
    if (p.action === "clarify") {
      const target = seeds[p.referenceIndex];
      if (!target || target.status !== "uncertain" || !target.entity) return reject(describe(p), "that reference did not match approximately.");
      this.trace.clarification = `Did you mean “${target.entity.name}” for “${target.input.label}”? It matched only approximately, so it was not used. Edit the reference to include it.`;
      return {
        choice: deterministic,
        decision: this.#record(
          { point: "bridge", planner: "model", proposed: describe(p), accepted: true, reason: "Accepted: the reference matched only approximately. The run continues with the exact references.", executed: `Asked the visitor to confirm “${target.input.label}”; ${deterministicText.toLowerCase()}`, rationale: p.rationale.trim(), fallback: false },
          t0,
        ),
      };
    }
    const choice: BridgeChoice = p.action === "cross_domain" ? { kind: "cross_domain", domain: p.domain as BridgeDomain } : p.action === "taste_tags" ? { kind: "taste_tags" } : { kind: "stop" };
    if (choice.kind === "stop") this.trace.stopReason = "The model planner stopped the run: no reference matched exactly, so there is no taste signal to research with.";
    return {
      choice,
      decision: this.#record({ point: "bridge", planner: "model", proposed: describe(p), accepted: true, reason: "Accepted: the action is allowed and consistent with the matched references.", executed: describe(p), rationale: p.rationale.trim(), fallback: false }, t0),
    };
  }

  /** Decision 2, only when the neighbourhood search is empty: widen to the city or stop. */
  async decideWiden(request: ResearchRequest, from: string, to: string): Promise<{ widen: boolean; decision: PlannerDecision }> {
    const t0 = this.#now();
    const prompt = [
      `Decision: the venue search in “${from}” found no ${VENUE_CATEGORY_LABELS[request.venueCategory].toLowerCase()} venues.`,
      "Allowed actions:",
      `- widen: search the wider area “${to}” instead (one more search).`,
      "- stop: end venue discovery for this run.",
      "If unsure, choose widen.",
      `Facts (JSON data): ${JSON.stringify({ searched: from, wider: to, venueCategory: VENUE_CATEGORY_LABELS[request.venueCategory] })}`,
    ].join("\n");
    const asked = await this.#ask("widen", prompt, responseSchema(["widen", "stop"], []));
    if ("skipped" in asked) {
      return { widen: true, decision: this.#record({ point: "widen", planner: "deterministic", proposed: null, accepted: false, reason: asked.skipped, executed: "Widen the venue search to the city", rationale: null, fallback: this.#setup.requested === "model" }, t0) };
    }
    const parsed = WidenProposal.safeParse(asked.raw);
    const problem = parsed.success ? rationaleProblem(parsed.data.rationale) : "the answer was not one allowed action";
    if (!parsed.success || problem) {
      return {
        widen: true,
        decision: this.#record({ point: "widen", planner: "deterministic", proposed: parsed.success ? describe(parsed.data) : null, accepted: false, reason: `Rejected: ${problem}. The deterministic choice ran instead.`, executed: "Widen the venue search to the city", rationale: null, fallback: true }, t0),
      };
    }
    const widen = parsed.data.action === "widen";
    if (!widen) this.trace.stopReason = `The model planner stopped venue discovery after “${from}” returned no venues.`;
    return { widen, decision: this.#record({ point: "widen", planner: "model", proposed: describe(parsed.data), accepted: true, reason: "Accepted: both actions are allowed here.", executed: describe(parsed.data), rationale: parsed.data.rationale.trim(), fallback: false }, t0) };
  }
}

export const DETERMINISTIC_ONLY = (availability: string): PlannerSetup => ({ requested: "deterministic", availability, port: null, maxDecisions: 0 });
