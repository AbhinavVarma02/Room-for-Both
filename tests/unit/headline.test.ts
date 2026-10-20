import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../../src/shared/domain";
import { closestToWorking } from "../../src/shared/domain/headline";
import { EXAMPLE_SCENARIO } from "../../src/shared/fixtures/example-scenario";
import { scenario } from "../fixtures/builders";

describe("closestToWorking", () => {
  it("features a format that has nothing working yet over another variant of one that does", () => {
    const e = evaluateScenario(EXAMPLE_SCENARIO);
    // The engine still ranks the 2-week shelf first; it would only land where the 4-week shelf already is.
    expect(e.reversals[0]?.optionId).toBe("shelf:2");
    expect(e.options.find((o) => o.id === "shelf:4")?.status).toBe("conditional");
    const closest = closestToWorking(e);
    expect(closest?.option.id).toBe("cohosted_event:2");
    expect(closest?.changes).toEqual(["Guest becomes available Tuesday 5 pm–7 pm, when the host is free."]);
    expect(closest?.statusAfter).toBe("conditional");
  });

  it("falls back to the engine's first verified reversal when every blocked format already works", () => {
    const e = evaluateScenario(scenario({}, { shelfMinWeeks: 4 }));
    expect(e.options.find((o) => o.id === "shelf:4")?.status).toBe("feasible");
    const closest = closestToWorking(e);
    expect(closest?.option.id).toBe("shelf:2");
    expect(closest?.changes).toEqual(["Lower the host's minimum from 4 to 2 weeks."]);
  });

  it("returns nothing when no option is blocked", () => {
    expect(closestToWorking(evaluateScenario(scenario()))).toBeNull();
  });
});
