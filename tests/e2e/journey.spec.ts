import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, freshClient, startExample } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshClient(page);
});

test("landing page explains the product and offers the fictional example", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Room for Both/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Find common ground");
  await expect(page.getByText("The example uses two invented businesses")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expectNoHorizontalScroll(page);
});

test("complete fictional journey: discovery, frontier, reversal, and brief", async ({ page }) => {
  await startExample(page);
  await expect(page.getByText("Fictional example").first()).toBeVisible();
  await expect(page.getByLabel("Business name")).toHaveValue("Fernleaf Botanics (fictional)");
  await page.getByRole("button", { name: /Save and continue/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Cultural discovery" })).toBeVisible();
  await expect(page.getByText("Fixture mode: fictional cultural data")).toBeVisible();
  await page.getByRole("button", { name: "Run cultural research" }).click();
  await expect(page.getByRole("heading", { name: "Venue candidates" })).toBeVisible();
  await expect(page.getByText("(fictional)", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("No Qloo request was made").first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole("button", { name: /Continue with Larkspur/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Two-sided workspace" })).toBeVisible();
  await expect(page.getByText("Fictional example host")).toBeVisible();
  await expect(page.getByRole("table", { name: /side by side/ })).toBeVisible();

  await page.getByRole("button", { name: "See the Agreement Frontier" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agreement Frontier" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Trade-off between guest outlay and host fee/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Conditional: waiting on missing inputs \(2\)/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /No-go on current terms \(7\)/ })).toBeVisible();
  await page.getByText(/All 12 checks and assumptions/).first().click();
  await expect(page.getByText("Template assumptions").first()).toBeVisible();

  await page.getByRole("button", { name: "Explore what would change the answer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Decision Reversal" })).toBeVisible();
  await page.getByLabel("Option").selectOption("cohosted_event:2");
  await expect(page.getByRole("heading", { name: "Why is this blocked?" })).toBeVisible();
  await expect(page.getByText("No shared day").first()).toBeVisible();
  await expect(page.getByText(/Re-checked with the same rules/)).toBeVisible();

  await page.getByRole("button", { name: "Sat", exact: true }).click();
  const trace = page.getByRole("heading", { name: "Decision trace" }).locator("..").locator("..");
  await expect(trace.getByText("Co-hosted event · 2 hours:")).toBeVisible();
  await expect(trace.getByText(/Resolved shared time available/)).toBeVisible();
  await expect(page.getByText("What-if mode: these values are hypothetical")).toBeVisible();

  await page.getByRole("button", { name: "Build the decision brief" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Fernleaf Botanics \(fictional\) × Larkspur/ })).toBeVisible();
  await expect(page.getByText("Describes invented businesses for demonstration")).toBeVisible();
  await expect(page.getByRole("heading", { name: "First three questions to ask" })).toBeVisible();
  await expect(page.getByText("Do your partnerships require exclusivity?").first()).toBeVisible();
  await expect(page.getByText("Fixture data: fictional cultural results, not from Qloo.")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("room-for-both-decision-brief.json");
  await expectNoHorizontalScroll(page);
});

test("workspace survives a reload and can be cleared", async ({ page }) => {
  await startExample(page);
  await page.getByRole("button", { name: /Save and continue/ }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Cultural discovery" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Find common ground");
});
