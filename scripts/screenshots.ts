/**
 * Captures README screenshots from a running local instance (fixture mode, fictional example).
 * Usage: npm run dev (or preview), then: npx tsx scripts/screenshots.ts [baseUrl]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:5173";
mkdirSync("docs/images", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
await page.setExtraHTTPHeaders({ "cf-connecting-ip": "10.20.30.40" });

await page.goto(base);
await page.screenshot({ path: "docs/images/landing.png" });

await page.getByRole("button", { name: /Try the fictional example/ }).click();
await page.getByRole("button", { name: /Save and continue/ }).click();
await page.getByRole("button", { name: "Run cultural research" }).click();
await page.getByRole("heading", { name: "Venue candidates" }).waitFor();
await page.getByRole("heading", { name: "Cultural bridge" }).scrollIntoViewIfNeeded();
await page.screenshot({ path: "docs/images/discovery.png" });

await page.goto(`${base}/workspace/frontier`);
await page.getByRole("heading", { name: "Trade-offs" }).waitFor();
await page.getByRole("heading", { name: "Trade-offs" }).scrollIntoViewIfNeeded();
await page.screenshot({ path: "docs/images/frontier.png" });

await page.goto(`${base}/workspace/reversal?option=cohosted_event%3A2`);
await page.getByRole("heading", { name: "Why is this blocked?" }).scrollIntoViewIfNeeded();
await page.screenshot({ path: "docs/images/reversal.png", fullPage: false });

await browser.close();
console.log("Saved docs/images/{landing,discovery,frontier,reversal}.png");
