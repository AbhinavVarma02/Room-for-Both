import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../../src/shared/domain";
import type { ArrangementOption, ConstraintId } from "../../src/shared/domain/types";
import { scenario } from "../fixtures/builders";

const option = (opts: ArrangementOption[], id: string) => {
  const o = opts.find((x) => x.id === id);
  if (!o) throw new Error(`missing option ${id}`);
  return o;
};
const check = (o: ArrangementOption, id: ConstraintId) => o.constraints.find((c) => c.id === id);

describe("baseline", () => {
  it("passes every option when both parties fully agree", () => {
    const e = evaluateScenario(scenario());
    expect(e.counts).toEqual({ feasible: 9, conditional: 0, no_go: 0 });
    for (const o of e.options) expect(o.constraints.every((c) => c.status === "pass" || c.status === "not_applicable")).toBe(true);
  });

  it("is deterministic for identical input", () => {
    const s = scenario({ maxOutlayUsd: 900 }, { samplingAllowed: null });
    expect(JSON.stringify(evaluateScenario(s))).toEqual(JSON.stringify(evaluateScenario(structuredClone(s))));
  });
});

describe("budget", () => {
  it("passes when the total exactly equals the budget", () => {
    // 2 h event: 2 × 100 + 200 own = 400.
    const e = evaluateScenario(scenario({ maxOutlayUsd: 400 }));
    expect(check(option(e.options, "cohosted_event:2"), "budget")?.status).toBe("pass");
    expect(check(option(e.options, "cohosted_event:3"), "budget")?.status).toBe("fail");
  });

  it("fails before any fee is known when own costs already exceed the budget", () => {
    const e = evaluateScenario(scenario({ maxOutlayUsd: 100, ownCostPerActivationUsd: 150 }, { eventFeePerHourUsd: null }));
    const b = check(option(e.options, "cohosted_event:1"), "budget");
    expect(b?.status).toBe("fail");
    expect(b?.missing).toEqual([]);
  });

  it("fails when the partner fee alone exceeds the budget even if own costs are unknown", () => {
    const e = evaluateScenario(scenario({ maxOutlayUsd: 250, ownCostPerActivationUsd: null }));
    expect(check(option(e.options, "popup:2"), "budget")?.status).toBe("fail");
  });

  it("is unknown with an exact fee threshold when only the host fee is missing", () => {
    const e = evaluateScenario(scenario({ maxOutlayUsd: 1000, ownCostPerActivationUsd: 400 }, { eventFeePerHourUsd: null }));
    const b = check(option(e.options, "cohosted_event:2"), "budget");
    expect(b?.status).toBe("unknown");
    expect(b?.requirement).toMatchObject({ party: "host", field: "eventFeePerHourUsd", comparator: "at_most", value: 300 });
  });

  it("names the guest budget as the requirement when it is the only missing value", () => {
    const e = evaluateScenario(scenario({ maxOutlayUsd: null }));
    const b = check(option(e.options, "popup:2"), "budget");
    expect(b?.status).toBe("unknown");
    expect(b?.requirement).toMatchObject({ party: "guest", field: "maxOutlayUsd", comparator: "at_least", value: 500 });
  });

  it("multiplies weekly shelf fees by the placement length", () => {
    const e = evaluateScenario(scenario());
    expect(option(e.options, "shelf:8").metrics.hostFeeUsd).toBe(400);
    expect(option(e.options, "shelf:8").metrics.guestOutlayUsd).toBe(600);
  });
});

describe("schedule", () => {
  it("picks the earliest shared slot in week order", () => {
    const e = evaluateScenario(
      scenario(
        { availability: [{ day: "fri", start: 10, end: 14 }, { day: "tue", start: 12, end: 18 }] },
        { availability: [{ day: "tue", start: 15, end: 20 }, { day: "fri", start: 9, end: 12 }] },
      ),
    );
    expect(option(e.options, "cohosted_event:2").slot).toEqual({ day: "tue", start: 15, end: 17 });
  });

  it("treats touching windows as no overlap", () => {
    const e = evaluateScenario(scenario({ availability: [{ day: "mon", start: 9, end: 12 }] }, { availability: [{ day: "mon", start: 12, end: 18 }] }));
    expect(check(option(e.options, "cohosted_event:1"), "schedule")?.status).toBe("fail");
  });

  it("fails a long option but passes a short one on a partial overlap", () => {
    const e = evaluateScenario(scenario({ availability: [{ day: "wed", start: 10, end: 14 }] }, { availability: [{ day: "wed", start: 12, end: 18 }] }));
    expect(check(option(e.options, "cohosted_event:2"), "schedule")?.status).toBe("pass");
    expect(check(option(e.options, "cohosted_event:3"), "schedule")?.status).toBe("fail");
  });

  it("is unknown when the host has not shared availability, and does not apply to shelves", () => {
    const e = evaluateScenario(scenario({}, { availability: null }));
    expect(check(option(e.options, "popup:2"), "schedule")?.status).toBe("unknown");
    expect(check(option(e.options, "shelf:2"), "schedule")?.status).toBe("not_applicable");
  });

  it("fails when the host lists no availability at all", () => {
    const e = evaluateScenario(scenario({}, { availability: [] }));
    expect(check(option(e.options, "popup:2"), "schedule")?.status).toBe("fail");
  });
});

describe("formats, terms, space and staffing", () => {
  it("fails formats the guest rejects and those the host does not host", () => {
    const e = evaluateScenario(scenario({ acceptableFormats: ["shelf"] }, { allowedFormats: ["popup", "shelf"] }));
    expect(check(option(e.options, "popup:2"), "guest_format")?.status).toBe("fail");
    expect(check(option(e.options, "cohosted_event:1"), "host_format")?.status).toBe("fail");
    expect(option(e.options, "shelf:2").status).toBe("feasible");
  });

  it("is conditional when the host has not said which formats it hosts", () => {
    const e = evaluateScenario(scenario({}, { allowedFormats: null }));
    expect(e.options.every((o) => o.status === "conditional")).toBe(true);
  });

  it("enforces minimum terms", () => {
    const e = evaluateScenario(scenario({}, { shelfMinWeeks: 4, eventMinHours: 2 }));
    expect(check(option(e.options, "shelf:2"), "minimum_term")?.status).toBe("fail");
    expect(check(option(e.options, "shelf:4"), "minimum_term")?.status).toBe("pass");
    expect(check(option(e.options, "cohosted_event:1"), "minimum_term")?.status).toBe("fail");
    expect(check(option(e.options, "popup:2"), "minimum_term")).toBeUndefined();
  });

  it("compares footprints, shelf space, and audience against host capacity", () => {
    const e = evaluateScenario(scenario({ popupFootprintSqFt: 60, shelfLinearFt: 8, minEventAudience: 50 }));
    expect(check(option(e.options, "popup:2"), "space")?.status).toBe("fail");
    expect(check(option(e.options, "shelf:2"), "space")?.status).toBe("fail");
    expect(check(option(e.options, "cohosted_event:1"), "space")?.status).toBe("fail");
  });

  it("skips the audience check when the guest sets no minimum", () => {
    const e = evaluateScenario(scenario({ minEventAudience: null }, { eventCapacity: null }));
    expect(check(option(e.options, "cohosted_event:1"), "space")?.status).toBe("not_applicable");
  });

  it("requires host staff for the full length of a co-hosted event only", () => {
    const e = evaluateScenario(scenario({}, { staffHoursPerActivation: 2 }));
    expect(check(option(e.options, "cohosted_event:2"), "host_staffing")?.status).toBe("pass");
    expect(check(option(e.options, "cohosted_event:3"), "host_staffing")?.status).toBe("fail");
    expect(check(option(e.options, "popup:6"), "host_staffing")?.status).toBe("not_applicable");
  });

  it("requires at least one guest team member on site for pop-ups and events", () => {
    const e = evaluateScenario(scenario({ staffCount: 0 }));
    expect(option(e.options, "popup:2").status).toBe("no_go");
    expect(option(e.options, "cohosted_event:1").status).toBe("no_go");
    expect(option(e.options, "shelf:2").status).toBe("feasible");
  });
});

describe("categories, sampling and dealbreakers", () => {
  it("fails every format when the host excludes the guest's category", () => {
    const e = evaluateScenario(scenario({ productCategories: ["skincare", "fragrance"] }, { excludedCategories: ["fragrance"] }));
    expect(e.counts.no_go).toBe(9);
    expect(check(e.options[0]!, "category_exclusion")?.explanation).toContain("fragrance");
  });

  it("is conditional when the host has not stated exclusions", () => {
    const e = evaluateScenario(scenario({}, { excludedCategories: null }));
    expect(e.counts.conditional).toBe(9);
  });

  it("checks sampling only when the guest plans to sample in person", () => {
    const off = evaluateScenario(scenario({ wantsSampling: false }, { samplingAllowed: false }));
    expect(off.counts.feasible).toBe(9);
    const on = evaluateScenario(scenario({ wantsSampling: true }, { samplingAllowed: false }));
    expect(option(on.options, "popup:2").status).toBe("no_go");
    expect(option(on.options, "shelf:2").status).toBe("feasible");
  });

  it("applies guest dealbreakers against host attributes", () => {
    const e = evaluateScenario(scenario({ dealbreakers: ["alcohol_on_premises", "exclusivity_required"] }, { alcoholOnPremises: true, requiresExclusivity: null }));
    const o = option(e.options, "shelf:2");
    expect(check(o, "dealbreaker_alcohol")?.status).toBe("fail");
    expect(check(o, "dealbreaker_exclusivity")?.status).toBe("unknown");
  });
});

describe("provenance", () => {
  it("labels fictional host values synthetic and missing values unknown", () => {
    const e = evaluateScenario(scenario({}, { source: "fictional_example", eventFeePerHourUsd: null }));
    const b = check(option(e.options, "cohosted_event:1"), "budget");
    const fee = b?.inputs.find((i) => i.field === "eventFeePerHourUsd");
    expect(fee?.provenance).toBe("unknown");
    const cap = b?.inputs.find((i) => i.field === "maxOutlayUsd");
    expect(cap?.provenance).toBe("party_supplied");
    const space = check(option(e.options, "popup:2"), "space")?.inputs.find((i) => i.party === "host");
    expect(space?.provenance).toBe("synthetic_demo");
  });

  it("reports two-sidedness from who entered the host values", () => {
    expect(evaluateScenario(scenario()).twoSided.status).toBe("two_sided");
    expect(evaluateScenario(scenario({}, { source: "entered_by_guest" })).twoSided.status).toBe("one_sided");
    expect(evaluateScenario(scenario({ origin: "synthetic_demo" }, { source: "fictional_example" })).twoSided.status).toBe("fictional_two_sided");
  });
});
