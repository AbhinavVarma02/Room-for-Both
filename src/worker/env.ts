export interface Env {
  ASSETS?: Fetcher;
  DB?: D1Database;
  APP_ENV?: string;
  QLOO_API_KEY?: string;
  QLOO_BASE_URL?: string;
  QLOO_MAX_CALLS_PER_RUN?: string;
  QLOO_DAILY_CALL_CEILING?: string;
  QLOO_TIMEOUT_MS?: string;
  RESEARCH_RUNS_PER_HOUR_PER_CLIENT?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_DAILY_CALL_CEILING?: string;
  PLANNER_MAX_DECISIONS?: string;
  PLANNER_TIMEOUT_MS?: string;
  CLIENT_KEY_SALT?: string;
}

export function intVar(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function settings(env: Env) {
  return {
    qlooConfigured: typeof env.QLOO_API_KEY === "string" && env.QLOO_API_KEY.trim() !== "",
    geminiConfigured:
      typeof env.GEMINI_API_KEY === "string" && env.GEMINI_API_KEY.trim() !== "" && typeof env.GEMINI_MODEL === "string" && env.GEMINI_MODEL.trim() !== "",
    callBudget: intVar(env.QLOO_MAX_CALLS_PER_RUN, 7, 1, 10),
    dailyCeiling: intVar(env.QLOO_DAILY_CALL_CEILING, 300, 0, 100_000),
    timeoutMs: intVar(env.QLOO_TIMEOUT_MS, 8000, 1000, 20_000),
    runsPerHour: intVar(env.RESEARCH_RUNS_PER_HOUR_PER_CLIENT, 12, 1, 1000),
    // Summaries and planner decisions share one daily allowance, set below the provider's free-tier quota.
    geminiDailyCeiling: intVar(env.GEMINI_DAILY_CALL_CEILING, 300, 0, 1000),
    plannerMaxDecisions: intVar(env.PLANNER_MAX_DECISIONS, 2, 0, 2),
    plannerTimeoutMs: intVar(env.PLANNER_TIMEOUT_MS, 4000, 1000, 8000),
  };
}
