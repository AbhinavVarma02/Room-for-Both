import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EXAMPLE_HOST } from "../../src/shared/fixtures/example-scenario";
import { cleanupExpired } from "../../src/worker/persistence/limits";
import { type Harness, jsonInit, startHarness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.dispose();
});
beforeEach(async () => {
  await h.reset();
});

const summary = {
  guestBusinessName: "Synthetic Skincare Co",
  productCategories: ["skincare"],
  proposedFormats: ["shelf", "cohosted_event"],
  venueName: "Synthetic Bookshop",
  venueCategory: "bookstore",
  culturalTheme: "Co-curated reading list",
  message: "Would a small shelf collaboration interest you?",
};
const { source: _source, ...hostAnswer } = { ...EXAMPLE_HOST, venueName: "Synthetic Bookshop" };
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function create() {
  const res = await h.request("/api/host-requests", jsonInit("POST", { summary }));
  expect(res.status).toBe(201);
  return res.json() as { requestId: string; hostToken: string; ownerToken: string; expiresAt: number; editsAllowed: number };
}

describe("host response links", () => {
  it("stores only token hashes and never the guest's budget", async () => {
    const link = await create();
    const row = await h.db.prepare("SELECT * FROM host_requests WHERE id = ?1").bind(link.requestId).first<Record<string, string>>();
    expect(JSON.stringify(row)).not.toContain(link.hostToken);
    expect(JSON.stringify(row)).not.toContain(link.ownerToken);
    expect(row?.host_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.shared_summary).not.toMatch(/outlay|budget/i);
  });

  it("lets the host read the shared summary and submit their own terms", async () => {
    const link = await create();
    const view = await h.request("/api/host-requests/respond", { headers: bearer(link.hostToken) });
    expect(view.status).toBe(200);
    expect(view.json()).toMatchObject({ status: "pending", summary: { guestBusinessName: "Synthetic Skincare Co" }, host: null });

    const put = await h.request("/api/host-requests/respond", jsonInit("PUT", { host: hostAnswer }, bearer(link.hostToken)));
    expect(put.status).toBe(200);
    expect(put.json()).toEqual({ status: "submitted", editsRemaining: 2 });

    const owner = await h.request(`/api/host-requests/${link.requestId}`, { headers: bearer(link.ownerToken) });
    const body = owner.json() as { status: string; host: { source: string; eventFeePerHourUsd: number } };
    expect(body.status).toBe("submitted");
    // The server, not the host, sets provenance: this is what makes the scenario genuinely two-sided.
    expect(body.host.source).toBe("host_response_link");
    expect(body.host.eventFeePerHourUsd).toBe(EXAMPLE_HOST.eventFeePerHourUsd);
  });

  it("does not let a host choose its own provenance label", async () => {
    const link = await create();
    const res = await h.request("/api/host-requests/respond", jsonInit("PUT", { host: { ...hostAnswer, source: "fictional_example" } }, bearer(link.hostToken)));
    expect(res.status).toBe(400);
  });

  it("keeps the two tokens' powers separate", async () => {
    const link = await create();
    expect((await h.request(`/api/host-requests/${link.requestId}`, { headers: bearer(link.hostToken) })).status).toBe(404);
    expect((await h.request("/api/host-requests/respond", { headers: bearer(link.ownerToken) })).status).toBe(404);
  });

  it("isolates one guest's request from another's", async () => {
    const a = await create();
    const b = await create();
    expect((await h.request(`/api/host-requests/${a.requestId}`, { headers: bearer(b.ownerToken) })).status).toBe(404);
    expect((await h.request(`/api/host-requests/${b.requestId}`, { headers: bearer(b.ownerToken) })).status).toBe(200);
  });

  it("rejects missing, malformed, and unknown tokens with the same answer", async () => {
    expect((await h.request("/api/host-requests/respond")).status).toBe(401);
    expect((await h.request("/api/host-requests/respond", { headers: { Authorization: "Bearer short" } })).status).toBe(401);
    const unknown = await h.request("/api/host-requests/respond", { headers: bearer("A".repeat(43)) });
    expect(unknown.status).toBe(404);
    expect(unknown.json()).toMatchObject({ error: { code: "not_found" } });
  });

  it("allows a bounded number of edits", async () => {
    const link = await create();
    for (let i = 0; i < 3; i += 1) {
      expect((await h.request("/api/host-requests/respond", jsonInit("PUT", { host: hostAnswer }, bearer(link.hostToken)))).status).toBe(200);
    }
    const fourth = await h.request("/api/host-requests/respond", jsonInit("PUT", { host: hostAnswer }, bearer(link.hostToken)));
    expect(fourth.status).toBe(409);
  });

  it("stops working once the guest withdraws it", async () => {
    const link = await create();
    await h.request("/api/host-requests/respond", jsonInit("PUT", { host: hostAnswer }, bearer(link.hostToken)));
    const del = await h.request(`/api/host-requests/${link.requestId}`, { method: "DELETE", headers: bearer(link.ownerToken) });
    expect(del.status).toBe(200);
    expect((await h.request("/api/host-requests/respond", { headers: bearer(link.hostToken) })).status).toBe(404);
    const row = await h.db.prepare("SELECT host_profile FROM host_requests WHERE id = ?1").bind(link.requestId).first<{ host_profile: string | null }>();
    expect(row?.host_profile).toBeNull();
  });

  it("expires and is cleaned up", async () => {
    const link = await create();
    await h.db.prepare("UPDATE host_requests SET expires_at = ?1 WHERE id = ?2").bind(Date.now() - 1, link.requestId).run();
    expect((await h.request("/api/host-requests/respond", { headers: bearer(link.hostToken) })).status).toBe(404);
    const removed = await cleanupExpired(h.db, Date.now());
    expect(removed.hostRequests).toBe(1);
  });

  it("validates the shared summary strictly", async () => {
    const res = await h.request("/api/host-requests", jsonInit("POST", { summary: { ...summary, maxOutlayUsd: 2000 } }));
    expect(res.status).toBe(400);
  });

  it("throttles withdrawal attempts like owner reads", async () => {
    const id = "A".repeat(22);
    const guess = bearer("B".repeat(43));
    for (let i = 0; i < 120; i += 1) expect((await h.request(`/api/host-requests/${id}`, { method: "DELETE", headers: guess })).status).toBe(404);
    expect((await h.request(`/api/host-requests/${id}`, { method: "DELETE", headers: guess })).status).toBe(429);
  });

  it("throttles link creation per client", async () => {
    for (let i = 0; i < 10; i += 1) await create();
    const res = await h.request("/api/host-requests", jsonInit("POST", { summary }));
    expect(res.status).toBe(429);
  });
});
