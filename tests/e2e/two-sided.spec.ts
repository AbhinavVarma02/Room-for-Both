import { expect, test } from "@playwright/test";
import { freshClient, startExample } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshClient(page);
});

test("a custom scenario validates input and labels guest-entered host terms as unconfirmed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start your own scenario" }).click();
  await page.getByRole("button", { name: /Save and continue/ }).click();
  await expect(page.getByText("Some answers need attention")).toBeVisible();

  await page.getByLabel("Business name").fill("Synthetic Candle Studio");
  await page.getByRole("group", { name: "Product categories" }).getByRole("button", { name: "Candles & home scent" }).click();
  await page.getByLabel("City or market").fill("Testville");
  await page.getByRole("group", { name: "Objectives" }).getByRole("button", { name: "Reach new customers" }).click();
  await page.getByLabel("Total budget for one activation").fill("800");
  await page.getByLabel("Your own costs per activation").fill("200");
  await page.getByRole("button", { name: /Save and continue/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Cultural discovery" })).toBeVisible();
  await page.getByRole("button", { name: /Continue to the host/ }).click();
  await page.getByRole("tab", { name: "Host's terms" }).click();
  await expect(page.getByText("You are entering the host's terms on their behalf")).toBeVisible();
  await page.getByLabel("Venue name").fill("Synthetic Gallery");
  await page.getByLabel("Shelf placement fee per week").fill("50");
  await page.getByRole("button", { name: "Save host terms and compare" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Agreement Frontier" })).toBeVisible();
  await expect(page.getByText("One-sided: host terms unconfirmed")).toBeVisible();
  // Nothing about the host was guessed, so no option can be declared feasible.
  await expect(page.getByRole("button", { name: /^0 feasible/ })).toBeVisible();
});

test("a host answers through a private link and the scenario becomes two-sided", async ({ page, context }) => {
  await startExample(page);
  await page.getByRole("button", { name: /Save and continue/ }).click();
  await page.getByRole("button", { name: /Continue with Larkspur/ }).click();
  await page.getByRole("tab", { name: /Invite the host privately/ }).click();
  await page.getByLabel("Short message").fill("Would a small shelf collaboration interest you?");
  await page.getByRole("button", { name: "Create private link" }).click();
  const link = await page.getByLabel("Private host link").inputValue();
  expect(link).toMatch(/\/respond#t=[A-Za-z0-9_-]{43}$/);

  const host = await context.newPage();
  if (!process.env.E2E_BASE_URL) await host.setExtraHTTPHeaders({ "cf-connecting-ip": "10.9.9.9" });
  await host.goto(link);
  await expect(host.getByRole("heading", { level: 1 })).toContainText("would like to explore a collaboration");
  await expect(host.getByText("Would a small shelf collaboration interest you?")).toBeVisible();
  // The guest's budget is never shown to the host.
  await expect(host.getByText("$2,000")).toHaveCount(0);
  // The host states only what a shelf placement needs; everything else stays unknown.
  await host.getByRole("group", { name: "Allowed formats" }).getByRole("button", { name: "Curated shelf placement" }).click();
  await host.getByLabel("Shelf placement fee per week").fill("45");
  await host.getByLabel("Minimum shelf placement").fill("2");
  await host.getByLabel("Shelf space for a partner").fill("4");
  await host.getByRole("checkbox", { name: "Not stated yet" }).last().uncheck();
  await host.getByRole("group", { name: "Partnerships require exclusivity" }).getByText("No", { exact: true }).click();
  await host.getByRole("button", { name: "Save my answers" }).click();
  await expect(host.getByText("Saved. Thank you.")).toBeVisible();
  await host.close();

  await page.getByRole("button", { name: "Check for the host's answers" }).click();
  await page.getByRole("button", { name: "Use the host's answers" }).click();
  await expect(page.getByText("Answered by the host")).toBeVisible();
  await page.getByRole("button", { name: "See the Agreement Frontier" }).click();
  await expect(page.getByText("Two-sided inputs")).toBeVisible();
  await expect(page.getByText("Yes, on stated terms.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Ready to discuss|Curated shelf placement/ }).first()).toBeVisible();
});

test("an incomplete or unknown host link fails safely", async ({ page }) => {
  await page.goto("/respond");
  await expect(page.getByRole("heading", { level: 1, name: "This link is incomplete" })).toBeVisible();
  await page.goto(`/respond#t=${"A".repeat(43)}`);
  await expect(page.getByRole("heading", { level: 1, name: "This link can't be opened" })).toBeVisible();
});
