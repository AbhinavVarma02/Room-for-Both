import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../../src/shared/domain";
import { EXAMPLE_SCENARIO } from "../../src/shared/fixtures/example-scenario";
import { GuestProfile, HostProfile, Scenario } from "../../src/shared/schemas/profiles";
import { guest, host } from "../fixtures/builders";

describe("profile schemas", () => {
  it("accepts the builders and the fictional example", () => {
    expect(GuestProfile.safeParse(guest()).success).toBe(true);
    expect(HostProfile.safeParse(host()).success).toBe(true);
    expect(Scenario.safeParse(EXAMPLE_SCENARIO).success).toBe(true);
  });

  it("rejects unknown keys so clients cannot smuggle fields past validation", () => {
    expect(GuestProfile.safeParse({ ...guest(), isAdmin: true }).success).toBe(false);
    expect(HostProfile.safeParse({ ...host(), approved: true }).success).toBe(false);
  });

  it("rejects negative or fractional money and out-of-range hours", () => {
    expect(GuestProfile.safeParse(guest({ maxOutlayUsd: -1 })).success).toBe(false);
    expect(GuestProfile.safeParse(guest({ maxOutlayUsd: 10.5 })).success).toBe(false);
    expect(GuestProfile.safeParse(guest({ availability: [{ day: "mon", start: 9, end: 25 }] })).success).toBe(false);
  });

  it("rejects windows that end before they start", () => {
    expect(HostProfile.safeParse(host({ availability: [{ day: "fri", start: 18, end: 12 }] })).success).toBe(false);
    expect(HostProfile.safeParse(host({ availability: [{ day: "fri", start: 12, end: 12 }] })).success).toBe(false);
  });

  it("bounds free text and list sizes", () => {
    expect(GuestProfile.safeParse(guest({ businessName: "x".repeat(81) })).success).toBe(false);
    expect(GuestProfile.safeParse(guest({ notes: "x".repeat(501) })).success).toBe(false);
    expect(GuestProfile.safeParse(guest({ businessName: "   " })).success).toBe(false);
    const seeds = Array.from({ length: 6 }, (_, i) => ({ label: `Seed ${i}`, kind: "brand" as const }));
    expect(GuestProfile.safeParse(guest({ culturalSeeds: seeds })).success).toBe(false);
  });

  it("requires at least one product category, objective, and acceptable format", () => {
    expect(GuestProfile.safeParse(guest({ productCategories: [] })).success).toBe(false);
    expect(GuestProfile.safeParse(guest({ objectives: [] })).success).toBe(false);
    expect(GuestProfile.safeParse(guest({ acceptableFormats: [] })).success).toBe(false);
  });

  it("only accepts enumerated vocabulary", () => {
    expect(GuestProfile.safeParse({ ...guest(), productCategories: ["<script>"] }).success).toBe(false);
    expect(HostProfile.safeParse({ ...host(), source: "verified_partner" }).success).toBe(false);
  });
});

describe("fictional example", () => {
  // The example is data, not engine logic: these assertions document what its inputs produce.
  const e = evaluateScenario(EXAMPLE_SCENARIO);

  it("is clearly labelled fictional on both sides", () => {
    expect(e.twoSided.status).toBe("fictional_two_sided");
    expect(EXAMPLE_SCENARIO.guest.businessName).toMatch(/fictional/i);
    expect(EXAMPLE_SCENARIO.host.venueName).toMatch(/fictional/i);
  });

  it("blocks every weekend event and pop-up because the host is only free on weeknights", () => {
    for (const o of e.options.filter((x) => x.format !== "shelf")) {
      expect(o.status).toBe("no_go");
      expect(o.constraints.find((c) => c.id === "schedule")?.status).toBe("fail");
    }
  });

  it("leaves the four- and eight-week shelf conditional on one host answer", () => {
    expect(e.options.filter((o) => o.status === "conditional").map((o) => o.id)).toEqual(["shelf:4", "shelf:8"]);
    expect(e.questions[0]).toMatchObject({ party: "host", field: "requiresExclusivity" });
  });

  it("turns the two-hour event conditional when the host opens a Saturday slot", () => {
    const changed = evaluateScenario({
      ...EXAMPLE_SCENARIO,
      host: { ...EXAMPLE_SCENARIO.host, availability: [...(EXAMPLE_SCENARIO.host.availability ?? []), { day: "sat", start: 10, end: 14 }] },
    });
    expect(changed.options.find((o) => o.id === "cohosted_event:2")?.status).toBe("conditional");
    expect(changed.options.find((o) => o.id === "cohosted_event:3")?.status).toBe("no_go");
  });

  it("reports the one-hour event as blocked by a non-negotiable host minimum", () => {
    const r = e.reversals.find((x) => x.optionId === "cohosted_event:1");
    expect(r?.nonNegotiableBlockers).toContain("minimum_term");
  });
});
