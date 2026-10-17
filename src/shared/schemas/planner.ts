import { z } from "zod";
import { BRIDGE_DOMAIN_TYPES } from "../constants/vocabulary";

/**
 * The research planner's decision points and the only actions a model may propose at each. The
 * Worker validates every proposal against this allow-list and the run's own state before acting;
 * a model never names a URL, an endpoint, a parameter, or a tool outside this list.
 */
export const DecisionPoint = z.enum(["bridge", "widen"]);
export type DecisionPoint = z.infer<typeof DecisionPoint>;

export const BridgeProposal = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("cross_domain"), domain: z.enum(BRIDGE_DOMAIN_TYPES as [string, ...string[]]), rationale: z.string().max(200) }),
  z.strictObject({ action: z.literal("taste_tags"), rationale: z.string().max(200) }),
  z.strictObject({ action: z.literal("clarify"), referenceIndex: z.number().int().min(0).max(4), rationale: z.string().max(200) }),
  z.strictObject({ action: z.literal("stop"), rationale: z.string().max(200) }),
]);
export type BridgeProposal = z.infer<typeof BridgeProposal>;

export const WidenProposal = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("widen"), rationale: z.string().max(200) }),
  z.strictObject({ action: z.literal("stop"), rationale: z.string().max(200) }),
]);
export type WidenProposal = z.infer<typeof WidenProposal>;

export const PlannerDecision = z.object({
  point: DecisionPoint,
  /** Who proposed the action that ran. */
  planner: z.enum(["model", "deterministic"]),
  /** What the model proposed, in words, when it was asked. */
  proposed: z.string().max(200).nullable(),
  accepted: z.boolean(),
  /** Why the proposal was accepted, rejected, or never requested. */
  reason: z.string().max(300),
  /** The action that actually ran. */
  executed: z.string().max(200),
  /** The model's one-line reason, shown as a language-model interpretation; null when none was accepted. */
  rationale: z.string().max(200).nullable(),
  fallback: z.boolean(),
  ms: z.number().min(0),
});
export type PlannerDecision = z.infer<typeof PlannerDecision>;

export const PlannerTrace = z.object({
  requested: z.enum(["model", "deterministic"]),
  /** Why the model planner was or was not available for this run. */
  availability: z.string().max(300),
  model: z.string().max(80).nullable(),
  maxDecisions: z.number().int(),
  modelCalls: z.number().int(),
  decisions: z.array(PlannerDecision).max(4),
  stopReason: z.string().max(300).nullable(),
  /** A clarification the planner asked the visitor to confirm, built from Qloo's own alternatives. */
  clarification: z.string().max(300).nullable(),
});
export type PlannerTrace = z.infer<typeof PlannerTrace>;
