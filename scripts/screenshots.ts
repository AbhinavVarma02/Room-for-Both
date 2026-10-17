/**
 * Captures README screenshots from a running local instance in fixture mode (fictional data only, never Qloo
 * responses), following the guided example.
 * Usage: npm run dev:fixture, then: npx tsx scripts/screenshots.ts [baseUrl]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:5173";
mkdirSync("docs/images", { recursive: true });

/** Scrolls so an element starts just below the top edge, framing the section that follows it. */
async function frame(selector: string) {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const view = el.ownerDocument.defaultView;
      view?.scrollTo(0, el.getBoundingClientRect().top + view.scrollY - 24);
    });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
await page.setExtraHTTPHeaders({ "cf-connecting-ip": "10.20.30.40" });

const health = (await (await page.request.get(`${base}/api/health`)).json()) as { research: { mode: string } };
if (health.research.mode !== "fixture") throw new Error("Screenshots must come from fixture mode, so no Qloo data reaches the repository.");

await page.goto(base);
await page.screenshot({ path: "docs/images/landing.png" });

await page.getByRole("button", { name: /See it in 90 seconds/ }).click();
await page.getByRole("table", { name: /with the taste signal and with category only/ }).waitFor();
await page.getByRole("heading", { name: "What the taste signal changed" }).scrollIntoViewIfNeeded();
await page.screenshot({ path: "docs/images/discovery.png" });

const guide = page.getByRole("complementary", { name: "Guided example" });
await guide.getByRole("button", { name: /^Choose / }).click();
await page.getByText("Where the two sides meet").waitFor();
await page.getByText("Chosen from cultural research").scrollIntoViewIfNeeded();
await page.screenshot({ path: "docs/images/host.png" });

await guide.getByRole("button", { name: "See which arrangements work" }).click();
await page.getByRole("heading", { name: "Agreement Frontier", level: 1 }).waitFor();
await frame('[aria-labelledby="decision-title"]');
await page.screenshot({ path: "docs/images/frontier.png" });

await frame('[aria-labelledby="concepts-title"]');
await page.screenshot({ path: "docs/images/ideas.png" });

await page.getByRole("button", { name: /Explore the change/ }).click();
await page.getByRole("button", { name: /Apply this change/ }).click();
await page.getByRole("status").filter({ hasText: "You applied" }).waitFor();
await frame('[aria-labelledby="shift-title"]');
await page.screenshot({ path: "docs/images/reversal.png" });

await guide.getByRole("button", { name: "Build the decision brief" }).click();
await page.getByRole("heading", { name: "At a glance" }).waitFor();
await frame('[aria-labelledby="glance-title"]');
await page.screenshot({ path: "docs/images/brief.png" });

await browser.close();
console.log("Saved docs/images/{landing,discovery,host,frontier,ideas,reversal,brief}.png");
