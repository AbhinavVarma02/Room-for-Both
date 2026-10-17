import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, freshClient, researchMode, startExample } from "./helpers";

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

test("complete journey: discovery, frontier, reversal, and brief", async ({ page }) => {
  // The fictional guest and host are the same in both modes; only the cultural layer differs, and
  // each mode must say which one it is.
  const mode = await researchMode(page);
  await startExample(page);
  await expect(page.getByText("Fictional example").first()).toBeVisible();
  await expect(page.getByLabel("Business name")).toHaveValue("Fernleaf Botanics (fictional)");
  await page.getByRole("button", { name: /Save and continue/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Cultural discovery" })).toBeVisible();
  await expect(page.getByText(mode === "live" ? "Live Qloo cultural intelligence" : "Fixture mode: fictional cultural data")).toBeVisible();
  await page.getByRole("button", { name: "Run cultural research" }).click();
  await expect(page.getByRole("heading", { name: "Venue candidates" })).toBeVisible({ timeout: 30_000 });
  if (mode === "live") {
    await expect(page.getByText(/Qloo calls used · live run/)).toBeVisible();
    await expect(page.getByText("Observed in Qloo").first()).toBeVisible();
    await expect(page.getByText("No Qloo request was made")).toHaveCount(0);
  } else {
    await expect(page.getByText("(fictional)", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("No Qloo request was made").first()).toBeVisible();
  }
  await expectNoHorizontalScroll(page);

  await page.getByRole("button", { name: /Continue with Larkspur/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Two-sided workspace" })).toBeVisible();
  await expect(page.getByText("Fictional example host")).toBeVisible();
  await expect(page.getByRole("table", { name: /side by side/ })).toBeVisible();

  await page.getByRole("button", { name: "See the Agreement Frontier" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agreement Frontier" })).toBeVisible();
  // The decision first: three counts from the engine, then the arrangement closest to agreement.
  const counts = page.getByRole("list", { name: "Arrangements by status" });
  await expect(counts.getByRole("button", { name: /^0 feasible/ })).toBeVisible();
  await expect(counts.getByRole("button", { name: /^2 conditional/ })).toBeVisible();
  await expect(counts.getByRole("button", { name: /^7 no-go/ })).toBeVisible();
  const closest = page.locator('[aria-labelledby="closest-title"]');
  await expect(closest.getByText("Closest to agreement")).toBeVisible();
  await expect(closest.getByText("Not agreed: the host has not confirmed this.")).toBeVisible();
  await expect(closest.getByRole("button", { name: /Explore the change/ })).toBeVisible();

  // Every arrangement stays available: a status filter, a compact list, and one focused detail.
  await counts.getByRole("button", { name: /^2 conditional/ }).click();
  const list = page.getByRole("list", { name: "Arrangements", exact: true });
  await expect(list.locator(":scope > li")).toHaveCount(2);
  await page.getByRole("group", { name: "Show arrangements by status" }).getByRole("button", { name: /^All/ }).click();
  await expect(list.locator(":scope > li")).toHaveCount(9);
  await list.getByRole("button", { name: /Curated shelf placement · 4 weeks/ }).click();
  await expect(page.getByText("Waiting on", { exact: true })).toBeVisible();
  await page.getByText(/All 12 checks and assumptions/).first().click();
  await expect(page.getByText("Template assumptions").first()).toBeVisible();
  await page.getByText(/Trade-off chart/).click();
  await expect(page.getByRole("img", { name: /Trade-off between guest outlay and host fee/ })).toBeVisible();

  await page.getByRole("button", { name: "Explore what would change the answer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Decision Reversal" })).toBeVisible();
  await page.getByLabel("Arrangement").selectOption("cohosted_event:2");
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
  await expect(page.getByText(mode === "live" ? "Cultural results retrieved live from Qloo." : "Fixture data: fictional cultural results, not from Qloo.")).toBeVisible();

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

test("a rejected live credential falls back to a labelled fictional demonstration", async ({ page }) => {
  const mode = await researchMode(page);
  // We simulate the upstream rejection in the browser so the test spends no Qloo quota; the demo
  // request itself goes to the real server.
  await page.route("**/api/research", async (route) => {
    const body = route.request().postDataJSON() as { demo?: boolean };
    if (body.demo) return route.continue();
    const message = "Live access to Qloo is not authorized for this deployment right now: the credential was rejected.";
    return route.fulfill({ status: 200, contentType: "application/x-ndjson", body: `${JSON.stringify({ type: "error", code: "auth", message, retryable: false })}\n` });
  });
  await startExample(page);
  await page.getByRole("button", { name: /Save and continue/ }).click();
  await page.getByRole("button", { name: "Run cultural research" }).click();
  await expect(page.getByText("Live Qloo access is not authorized right now")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await page.getByRole("button", { name: "Run the fictional demonstration" }).click();
  await expect(page.getByRole("heading", { name: "Venue candidates" })).toBeVisible();
  await expect(page.getByText("Fictional demonstration · no Qloo calls")).toBeVisible();
  await expect(page.getByText("(fictional)", { exact: false }).first()).toBeVisible();
  if (mode === "live") await expect(page.getByText("Showing the fictional demonstration")).toBeVisible();
  await expect(page.getByText("Observed in Qloo")).toHaveCount(0);
});

test("the optional language-model summary needs consent and never replaces the rule-based brief", async ({ page }) => {
  const config = (await (await page.request.get("/api/config")).json()) as { narrativeEnabled: boolean };
  test.skip(!config.narrativeEnabled, "Narrative drafting is not configured on this server.");
  await startExample(page);
  await page.goto("/workspace/brief");
  await expect(page.getByText("Rule-based summary assembled from the checks below.")).toBeVisible();
  const draft = page.getByRole("button", { name: "Draft a summary" });
  await expect(draft).toBeDisabled();

  // First a simulated provider failure: the brief must stay usable and say so.
  await page.route("**/api/narrative", (route) =>
    route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: { code: "narrative_unavailable", message: "The summary could not be drafted." } }) }),
  );
  await page.getByRole("checkbox", { name: /send the summary facts/ }).check();
  await draft.click();
  await expect(page.getByRole("alert")).toContainText("The rule-based summary is unaffected.");
  await expect(page.getByText("Rule-based summary assembled from the checks below.")).toBeVisible();

  // Then one real draft, labelled as a model interpretation.
  await page.unroute("**/api/narrative");
  await draft.click();
  await expect(page.getByText("Plain-language draft")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Language-model draft").first()).toBeVisible();
});
