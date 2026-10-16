import { type Page, expect } from "@playwright/test";

/**
 * Local runs share one rate-limit identity, so each test presents a fresh simulated client
 * address. On Cloudflare this header is set by the edge and cannot be supplied by a browser.
 */
export async function freshClient(page: Page) {
  // Cloudflare's edge rejects a client-supplied CF-Connecting-IP, so only simulate it locally.
  if (process.env.E2E_BASE_URL) return;
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": `10.${octet()}.${octet()}.${octet()}` });
}

export async function startExample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Try the fictional example/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Guest profile" })).toBeVisible();
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
