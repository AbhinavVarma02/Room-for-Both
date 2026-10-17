import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, freshClient, researchMode, useFictionalResearch } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshClient(page);
});

async function startGuided(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /See it in 90 seconds/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cultural discovery" })).toBeVisible();
}

test("guided example: cultural reason, chosen venue, why it fails, one change, and the brief", async ({ page }) => {
  const mode = await researchMode(page);
  await startGuided(page);
  const guide = page.getByRole("complementary", { name: "Guided example" });

  // Research and the category-only comparison start by themselves.
  await expect(page.getByRole("heading", { name: "Venue candidates" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "What the taste signal changed" })).toBeVisible();
  await expect(page.getByRole("table", { name: /with the taste signal and with category only/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Available only with cultural signals")).toBeVisible();
  const venue = (await page.locator("#candidates-heading + ul h3").first().textContent())?.trim() ?? "";
  expect(venue.length).toBeGreaterThan(0);
  if (mode === "fixture") expect(venue).toContain("(fictional)");

  await guide.getByRole("button", { name: /^Choose / }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Two-sided workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: venue, exact: true })).toBeVisible();
  await expect(page.getByText("From the guest's references")).toBeVisible();
  await expect(page.getByText(`Hypothetical terms: ${venue} has not stated or agreed to any of them`)).toBeVisible();
  await expect(page.getByText("Hypothetical terms · not from the venue")).toBeVisible();
  if (mode === "live") await expect(page.getByText("Fictional guest, real venue, hypothetical terms")).toBeVisible();
  await expectNoHorizontalScroll(page);

  await guide.getByRole("button", { name: "See which arrangements work" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agreement Frontier" })).toBeVisible();
  await expect(page.getByText("Can these businesses work together?")).toBeVisible();
  const closest = (await page.locator("#closest-title").textContent())?.trim() ?? "";
  expect(closest.length).toBeGreaterThan(0);
  await expect(page.getByText("Nothing here forecasts sales", { exact: false })).toBeVisible();

  // The guide points to the page's own single action instead of repeating it.
  await page.getByRole("button", { name: /Explore the change/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Decision Reversal" })).toBeVisible();
  await page.getByRole("button", { name: /Apply this change/ }).click();
  const status = page.getByRole("status").filter({ hasText: "You applied" });
  await expect(status).toContainText(`${closest}:`);
  await expect(status).toContainText(/Conditional|Feasible/);

  await guide.getByRole("button", { name: "Build the decision brief" }).click();
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(`× ${venue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(hypothetical terms\\)`) })).toBeVisible();
  await expect(page.getByText("Hypothetical host terms")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activation idea" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What decides what" })).toBeVisible();
  await expect(page.getByText(/Venue chosen from research:/)).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const file = await download;
  const brief = JSON.parse(await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"))) as {
    hostTerms: { source: string; disclaimer: string };
    venue: { name: string; evidence: string };
    activation: { why: string[] } | null;
  };
  expect(brief.hostTerms.source).toBe("hypothetical_scenario");
  expect(brief.hostTerms.disclaimer).toMatch(/has not seen, stated, or agreed/);
  expect(brief.venue.name).toBe(venue);
  expect(brief.venue.evidence).toBe(mode === "live" ? "qloo_observed" : "synthetic_demo");
  expect(brief.activation?.why.length).toBeGreaterThan(0);

  await guide.getByRole("button", { name: "Finish the guide" }).click();
  await expect(page.getByRole("complementary", { name: "Guided example" })).toHaveCount(0);
});

test("choosing another venue updates the host, the evidence, and the brief", async ({ page }) => {
  await useFictionalResearch(page);
  await startGuided(page);
  await page.getByRole("button", { name: "Exit the guided example" }).click();
  await expect(page.getByRole("heading", { name: "Venue candidates" })).toBeVisible({ timeout: 30_000 });
  const cards = page.locator("#candidates-heading + ul > li");
  test.skip((await cards.count()) < 2, "This search returned fewer than two venues.");
  const first = (await cards.nth(0).locator("h3").textContent())?.trim() ?? "";
  const second = (await cards.nth(1).locator("h3").textContent())?.trim() ?? "";

  await cards.nth(0).getByRole("button", { name: /Evaluate a partnership/ }).click();
  await expect(page.getByRole("heading", { name: first, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `No terms from ${first} yet` })).toBeVisible();
  await page.getByRole("button", { name: /Explore with hypothetical terms/ }).click();
  await expect(page.getByText("Hypothetical terms · not from the venue")).toBeVisible();

  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByText("· Your chosen venue")).toBeVisible();
  await cards.nth(1).getByRole("button", { name: /Evaluate a partnership/ }).click();
  await expect(page.getByRole("heading", { name: second, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: first, exact: true })).toHaveCount(0);
  // Hypothetical terms stay hypothetical for the new venue and are never attributed to it.
  await expect(page.getByText(`Hypothetical terms: ${second} has not stated or agreed to any of them`)).toBeVisible();

  await page.goto("/workspace/brief");
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(second.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Venue chosen from research:/)).toContainText(second);
});

test("reference sensitivity, proposal ideas, and a brief that proposes a change", async ({ page }) => {
  await useFictionalResearch(page);
  await startGuided(page);
  await expect(page.getByRole("heading", { name: "Venue candidates" })).toBeVisible({ timeout: 30_000 });

  // The fixture makes the first reference decisive and the other two inert, so both outcomes show.
  await page.getByRole("button", { name: /Test each reference/ }).click();
  const sensitivity = page.locator('[aria-labelledby="sensitivity-heading"]');
  await expect(sensitivity.getByText("Changes the first choice")).toBeVisible();
  await expect(sensitivity.getByText("No change").first()).toBeVisible();
  await expect(sensitivity.getByText(/The first choice depends on “Aesop”/)).toBeVisible();

  const guide = page.getByRole("complementary", { name: "Guided example" });
  await guide.getByRole("button", { name: /^Choose / }).click();
  await guide.getByRole("button", { name: "See which arrangements work" }).click();
  const ideas = page.locator('[aria-labelledby="concepts-title"]');
  await expect(ideas.getByRole("heading", { name: "A reading list both audiences share" })).toBeVisible();
  await expect(ideas.getByText("Discuss first")).toHaveCount(1);
  // Other ideas stay one choice away.
  await ideas.getByRole("tab", { name: /Start from the venue's own books/ }).click();
  await expect(ideas.getByRole("heading", { name: "Start from the venue's own books" })).toBeVisible();

  await page.getByRole("button", { name: /Explore the change/ }).click();
  await page.getByRole("button", { name: /Apply this change/ }).click();
  await page.getByRole("button", { name: "Draft a brief proposing these changes" }).click();
  await expect(page.getByRole("heading", { name: "Proposed changes to discuss" })).toBeVisible();
  await expect(page.getByText(/needs confirmation by the (host|guest)/).first()).toBeVisible();
  await expect(page.getByText(/If the proposed changes listed below are accepted, the suggested starting point/)).toBeVisible();
  await page.getByText("Full cultural evidence").click();
  await expect(page.getByText("How much each reference matters")).toBeVisible();
});

test("no horizontal scrolling from 320 to 414 pixels wide", async ({ page }) => {
  await useFictionalResearch(page);
  await startGuided(page);
  await expect(page.getByRole("heading", { name: "Venue candidates" })).toBeVisible({ timeout: 30_000 });
  for (const width of [320, 360, 375, 414]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/", "/workspace/discovery", "/workspace/host", "/workspace/frontier", "/workspace/reversal", "/workspace/brief", "/methodology"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  }
});

test("automated accessibility checks find no serious or critical issues", async ({ page }) => {
  await useFictionalResearch(page);
  await startGuided(page);
  await expect(page.getByRole("heading", { name: "Venue candidates" })).toBeVisible({ timeout: 30_000 });
  for (const path of ["/", "/workspace/guest", "/workspace/discovery", "/workspace/host", "/workspace/frontier", "/workspace/reversal", "/workspace/brief", "/methodology"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path}: ${v.id} (${v.nodes.length}) ${v.help}`)).toEqual([]);
  }
});
