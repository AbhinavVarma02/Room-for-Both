import { Hono } from "hono";
import { ENGINE_VERSION } from "../../shared/domain/types";
import { settings } from "../env";
import type { AppEnv } from "../http";
import { MAX_SEEDS_PER_RUN } from "../orchestration/research";

export const meta = new Hono<AppEnv>();

meta.get("/health", (c) => {
  const s = settings(c.env);
  return c.json({
    status: "ok",
    service: "room-for-both",
    engineVersion: ENGINE_VERSION,
    research: { mode: s.qlooConfigured ? "live" : "fixture" },
    narrative: { enabled: s.geminiConfigured },
    storage: { bound: c.env.DB !== undefined },
  });
});

meta.get("/config", (c) => {
  const s = settings(c.env);
  return c.json({
    researchMode: s.qlooConfigured ? "live" : "fixture",
    narrativeEnabled: s.geminiConfigured,
    callBudget: s.callBudget,
    maxSeedsPerRun: MAX_SEEDS_PER_RUN,
    hostLinksEnabled: c.env.DB !== undefined,
  });
});
