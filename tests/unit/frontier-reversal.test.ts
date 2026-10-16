import { describe, expect, it } from "vitest";
import { applyChanges, diffEvaluations, dominates, evaluateScenario, reverseOption } from "../../src/shared/domain";
import type { ArrangementOption } from "../../src/shared/domain/types";
import { scenario } from "../fixtures/builders";

const byId = (opts: ArrangementOption[], id: string) => {
  const o = opts.find((x) => x.id === id);
  if (!o) throw new Error(`missing ${id}`);
  return o;
};

describe("Agreement Frontier", () => {
  it("lists every viable option when no priorities were stated", () => {
    const e = evaluateScenario(scenario());
    expect(e.frontier.method).toBe("no_priorities_stated");
    expect(e.frontier.nonDominatedIds).toHaveLength(9);
  });

  it("keeps only options not beaten on every stated priority", () => {
    const e = evaluateScenario(scenario({ priorities: ["lower_outlay"] }));
    // The 2-week shelf and the 1-hour event tie on the cheapest outlay ($100 fee + $200 own costs).
    expect(e.frontier.nonDominatedIds).toEqual(["shelf:2", "cohosted_event:1"]);
    expect(e.options[0]?.id).toBe("shelf:2");
  });

  it("keeps genuine trade-offs between the two parties", () => {
    const e = evaluateScenario(scenario({ priorities: ["lower_outlay"] }, { priorities: ["higher_fee"] }));
    // Lower outlay for the guest always means a lower fee for the host here, so nothing dominates.
    expect(e.frontier.nonDominatedIds.length).toBe(e.options.filter((o) => o.status !== "no_go").length);
  });

  it("treats equal metrics as ties rather than dominance", () => {
    const e = evaluateScenario(scenario({ priorities: ["lower_outlay"] }));
    const pop2 = byId(e.options, "popup:2");
    const pop4 = byId(e.options, "popup:4");
    expect(pop2.metrics.guestOutlayUsd).toBe(pop4.metrics.guestOutlayUsd);
    expect(dominates(pop2, pop4, ["lower_outlay"])).toBe(false);
    expect(dominates(pop4, pop2, ["lower_outlay"])).toBe(false);
  });

  it("never claims dominance across an unknown metric", () => {
    const e = evaluateScenario(scenario({ priorities: ["lower_outlay"] }, { eventFeePerHourUsd: null }));
    const event = byId(e.options, "cohosted_event:1");
    expect(event.metrics.guestOutlayUsd).toBeNull();
    expect(e.frontier.nonDominatedIds).toContain("cohosted_event:1");
  });

  it("excludes no-go options from the frontier", () => {
    const e = evaluateScenario(scenario({ priorities: ["lower_outlay"] }, { shelfMinWeeks: 4 }));
    expect(byId(e.options, "shelf:2").status).toBe("no_go");
    expect(e.frontier.nonDominatedIds).not.toContain("shelf:2");
    expect(e.frontier.nonDominatedIds).toEqual(["cohosted_event:1"]);
  });
});

describe("Decision Reversal", () => {
  it("finds the exact budget increase that unblocks an over-budget option", () => {
    const s = scenario({ maxOutlayUsd: 450 });
    const e = evaluateScenario(s);
    const r = reverseOption(s, byId(e.options, "cohosted_event:3"));
    expect(r.blockingConstraints).toEqual(["budget"]);
    const budgetFix = r.candidates[0]?.changes.find((c) => c.field === "maxOutlayUsd");
    expect(budgetFix?.to).toBe(500);
    expect(r.minimalChange?.verified).toBe(true);
    expect(r.minimalChange?.statusAfter).toBe("feasible");
  });

  it("offers a host rate cap that fits the budget", () => {
    const s = scenario({ maxOutlayUsd: 450 });
    const r = reverseOption(s, byId(evaluateScenario(s).options, "cohosted_event:3"));
    const rate = r.candidates[0]?.changes.find((c) => c.field === "eventFeePerHourUsd");
    expect(rate?.to).toBe(83); // floor((450 - 200) / 3)
  });

  it("re-evaluation confirms every suggested minimal change", () => {
    const s = scenario(
      { popupFootprintSqFt: 80, maxOutlayUsd: 400, availability: [{ day: "sat", start: 10, end: 16 }] },
      { staffHoursPerActivation: 1, shelfMinWeeks: 4 },
    );
    const e = evaluateScenario(s);
    for (const r of e.reversals) {
      if (!r.minimalChange) continue;
      const after = evaluateScenario(applyChanges(s, r.minimalChange.changes));
      expect(byId(after.options, r.optionId).status).toBe(r.minimalChange.statusAfter);
      expect(r.minimalChange.verified).toBe(r.minimalChange.statusAfter !== "no_go");
    }
  });

  it("refuses to suggest changes to a field a party marked non-negotiable", () => {
    const s = scenario({}, { shelfMinWeeks: 4, fixedFields: ["shelfMinWeeks"] });
    const r = reverseOption(s, byId(evaluateScenario(s).options, "shelf:2"));
    expect(r.nonNegotiableBlockers).toEqual(["minimum_term"]);
    expect(r.minimalChange).toBeNull();
  });

  it("falls back to the other party when one side's field is fixed", () => {
    const s = scenario({ popupFootprintSqFt: 60, fixedFields: ["popupFootprintSqFt"] });
    const r = reverseOption(s, byId(evaluateScenario(s).options, "popup:2"));
    expect(r.minimalChange?.changes.map((c) => `${c.party}.${c.field}`)).toEqual(["host.guestFloorSqFt"]);
    expect(r.minimalChange?.changes[0]?.to).toBe(60);
  });

  it("extends a partial overlap instead of inventing a new day when that is smaller", () => {
    const s = scenario({ availability: [{ day: "wed", start: 10, end: 14 }] }, { availability: [{ day: "wed", start: 12, end: 18 }] });
    const r = reverseOption(s, byId(evaluateScenario(s).options, "cohosted_event:3"));
    const first = r.candidates.find((c) => c.constraint === "schedule")?.changes[0];
    expect(first?.kind).toBe("extend_window");
    expect(r.minimalChange?.verified).toBe(true);
  });

  it("orders reversals so verified, smaller change sets come first", () => {
    const s = scenario({ maxOutlayUsd: 450, popupFootprintSqFt: 60, availability: [{ day: "mon", start: 9, end: 12 }] });
    const e = evaluateScenario(s);
    const sizes = e.reversals.filter((r) => r.minimalChange?.verified).map((r) => r.minimalChange?.changes.length ?? 0);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });
});

describe("questions and trace", () => {
  it("ranks the input that alone decides the most options first", () => {
    const e = evaluateScenario(scenario({ wantsSampling: true }, { samplingAllowed: null, shelfFeePerWeekUsd: null }));
    const [first, second] = e.questions;
    expect(`${first?.party}.${first?.field}`).toBe("host.samplingAllowed");
    expect(first?.decisiveFor).toHaveLength(6);
    expect(`${second?.party}.${second?.field}`).toBe("host.shelfFeePerWeekUsd");
  });

  it("records which options flipped after one input change", () => {
    const before = scenario({ maxOutlayUsd: 450 });
    const after = scenario({ maxOutlayUsd: 500 });
    const entry = diffEvaluations(evaluateScenario(before), evaluateScenario(after), { party: "guest", field: "maxOutlayUsd", from: 450, to: 500 }, 1);
    // $500 is the outlay of every pop-up and of the 3-hour event, so all four flip together.
    expect(entry.flips.map((f) => f.optionId).sort()).toEqual(["cohosted_event:3", "popup:2", "popup:4", "popup:6"]);
    for (const flip of entry.flips) expect(flip).toMatchObject({ before: "no_go", after: "feasible" });
    expect(entry.flips[0]?.reason).toMatch(/budget/i);
  });

  it("records nothing when an edit does not change any decision", () => {
    const entry = diffEvaluations(
      evaluateScenario(scenario({ maxOutlayUsd: 5000 })),
      evaluateScenario(scenario({ maxOutlayUsd: 6000 })),
      { party: "guest", field: "maxOutlayUsd", from: 5000, to: 6000 },
      1,
    );
    expect(entry.flips).toEqual([]);
  });
});

describe("monotonicity", () => {
  const rank = { feasible: 0, conditional: 1, no_go: 2 } as const;

  it("never worsens any option when the guest budget rises", () => {
    let prev = evaluateScenario(scenario({ maxOutlayUsd: 0 }));
    for (let budget = 50; budget <= 2000; budget += 50) {
      const next = evaluateScenario(scenario({ maxOutlayUsd: budget }));
      for (const o of next.options) expect(rank[o.status]).toBeLessThanOrEqual(rank[byId(prev.options, o.id).status]);
      prev = next;
    }
  });

  it("never worsens any option when the host offers more space or staff time", () => {
    let prev = evaluateScenario(scenario({ popupFootprintSqFt: 40 }, { guestFloorSqFt: 0, staffHoursPerActivation: 0 }));
    for (let n = 1; n <= 60; n += 1) {
      const next = evaluateScenario(scenario({ popupFootprintSqFt: 40 }, { guestFloorSqFt: n, staffHoursPerActivation: Math.min(24, n) }));
      for (const o of next.options) expect(rank[o.status]).toBeLessThanOrEqual(rank[byId(prev.options, o.id).status]);
      prev = next;
    }
  });

  it("never improves any option when the host fee rises", () => {
    let prev = evaluateScenario(scenario({ maxOutlayUsd: 1000 }, { eventFeePerHourUsd: 0 }));
    for (let fee = 25; fee <= 1000; fee += 25) {
      const next = evaluateScenario(scenario({ maxOutlayUsd: 1000 }, { eventFeePerHourUsd: fee }));
      for (const o of next.options) expect(rank[o.status]).toBeGreaterThanOrEqual(rank[byId(prev.options, o.id).status]);
      prev = next;
    }
  });
});
