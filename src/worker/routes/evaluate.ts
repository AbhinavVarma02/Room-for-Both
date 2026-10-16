import { Hono } from "hono";
import { evaluateScenario } from "../../shared/domain";
import { EvaluateRequest } from "../../shared/schemas/api";
import { type AppEnv, readJson } from "../http";

export const evaluate = new Hono<AppEnv>();

evaluate.post("/evaluate", async (c) => {
  const body = await readJson(c, EvaluateRequest);
  if (!body.ok) return body.response;
  const t0 = Date.now();
  const evaluation = evaluateScenario(body.data.scenario);
  c.get("log").info("evaluate", { options: evaluation.options.length, feasible: evaluation.counts.feasible, ms: Date.now() - t0 });
  return c.json({ evaluation });
});
