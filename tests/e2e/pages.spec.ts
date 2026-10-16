import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

test("methodology page documents rules, provenance, and limits", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { level: 1, name: "How Room for Both reaches a decision" })).toBeVisible();
  for (const name of ["Hard constraints", "Agreement Frontier", "Decision Reversal", "Cultural research with Qloo", "Data use and privacy", "Limitations"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expectNoHorizontalScroll(page);
});

test("unknown routes show a helpful not-found page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { level: 1, name: "There's nothing at this address" })).toBeVisible();
});

test("workspace steps that need inputs explain what is missing", async ({ page }) => {
  await page.goto("/workspace/frontier");
  await expect(page.getByText("This step needs the guest and host inputs first.")).toBeVisible();
});

test("keyboard users can skip straight to content", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
});

test("API health is public and reveals no configuration values", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toMatchObject({ status: "ok", service: "room-for-both" });
  expect(JSON.stringify(body)).not.toMatch(/key|secret|token/i);
});
