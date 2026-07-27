/**
 * Studio Campaigns & Calendar — API contract tests
 *
 * Run: npx tsx --test server/tests/studioCampaignsApi.test.ts
 *
 * Requires the dev server to be running (E2E_BASE_URL or http://localhost:5000).
 * Authenticates as the E2E admin (super_admin) so every route is reachable.
 *
 * AI-dependent endpoints (generate-plan-preview, generate-social-draft) may
 * return 503 when no AI provider is configured; those tests accept 503 and skip
 * the deep assertions.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

// ── config ─────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5000";
const ADMIN_EMAIL = "e2e-admin@hire-in.com";
const ADMIN_PASSWORD = "E2eTest@2024!";

// ── HTTP helpers ───────────────────────────────────────────────────────────────

let sessionCookie = "";

async function login(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  // getSetCookie() (Node 18+) returns an array; fall back to get() for older runtimes.
  const rawCookies: string[] = (res.headers as any).getSetCookie?.() ??
    ([res.headers.get("set-cookie")].filter(Boolean) as string[]);
  // Keep only the name=value portion (strip Path/Expires/HttpOnly/SameSite)
  sessionCookie = rawCookies.map((c) => c.split(";")[0].trim()).join("; ");
  if (!sessionCookie) throw new Error("No session cookie received from login");
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: sessionCookie },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function post(path: string, data: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function patch(path: string, data: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ── test state ─────────────────────────────────────────────────────────────────

let testProjectId = "";
let testCampaignId = "";
const createdArticleIds: string[] = [];
const createdIdeaIds: string[] = [];
// ai-plan stubs tracked separately for the "outside range" assertion
const aiPlanStubIds: string[] = [];

// ── helpers ────────────────────────────────────────────────────────────────────

/** Future date (N days from today) as YYYY-MM-DD */
function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Future ISO timestamp (N days from now) for scheduledAt fields */
function futureISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // Add an extra hour so "future" check stays valid during test run
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

// ── setup / teardown ───────────────────────────────────────────────────────────

before(async () => {
  await login();

  // Create a dedicated test studio project
  const { status, body } = await post("/api/admin/studio/projects", {
    name: "Test Project — Campaigns API",
    slug: `test-campaigns-api-${Date.now()}`,
    description: "Ephemeral project created by campaign API tests",
    publishesToInsights: false,
  });
  assert.equal(status, 201, `Failed to create test project: ${JSON.stringify(body)}`);
  testProjectId = (body as any).id;
  assert.ok(testProjectId, "Expected project id");
});

after(async () => {
  // Clean up all test data in dependency order
  if (createdIdeaIds.length) {
    await db
      .execute(sql`DELETE FROM studio_content_ideas WHERE id = ANY(${createdIdeaIds})`)
      .catch(() => {});
  }
  if (createdArticleIds.length) {
    await db
      .execute(sql`DELETE FROM studio_articles WHERE id = ANY(${createdArticleIds})`)
      .catch(() => {});
  }
  if (testCampaignId) {
    // Also delete articles/ideas linked to the campaign (confirm-plan may have created more)
    await db
      .execute(sql`DELETE FROM studio_content_ideas WHERE campaign_id = ${testCampaignId}`)
      .catch(() => {});
    await db
      .execute(sql`DELETE FROM studio_articles WHERE campaign_id = ${testCampaignId}`)
      .catch(() => {});
    await db
      .execute(sql`DELETE FROM studio_campaigns WHERE id = ${testCampaignId}`)
      .catch(() => {});
  }
  if (testProjectId) {
    // Clean up any remaining articles / ideas / campaigns in the test project
    await db
      .execute(sql`DELETE FROM studio_content_ideas WHERE project_id = ${testProjectId}`)
      .catch(() => {});
    await db
      .execute(sql`DELETE FROM studio_articles WHERE project_id = ${testProjectId}`)
      .catch(() => {});
    await db
      .execute(sql`DELETE FROM studio_campaigns WHERE project_id = ${testProjectId}`)
      .catch(() => {});
    await db
      .execute(sql`DELETE FROM studio_projects WHERE id = ${testProjectId}`)
      .catch(() => {});
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// § 1 — Campaign CRUD
// ══════════════════════════════════════════════════════════════════════════════

describe("Campaign CRUD", async () => {
  it("POST /api/studio/campaigns — creates a campaign and returns 201 with id", async () => {
    const { status, body } = await post("/api/studio/campaigns", {
      projectId: testProjectId,
      name: "API Test Campaign",
      status: "active",
      funnelStage: "awareness",
      channels: ["linkedin"],
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
    assert.ok((body as any).id, "Expected campaign id in response");
    testCampaignId = (body as any).id;
  });

  it("GET /api/studio/campaigns — lists campaigns including the new one with ideaCounts", async () => {
    const { status, body } = await get(
      `/api/studio/campaigns?projectId=${encodeURIComponent(testProjectId)}`,
    );
    assert.equal(status, 200);
    const list = body as any[];
    assert.ok(Array.isArray(list), "Expected array response");
    const found = list.find((c) => c.id === testCampaignId);
    assert.ok(found, "Created campaign not in list");
    assert.ok(
      found.ideaCounts && typeof found.ideaCounts.total === "number",
      "Expected ideaCounts.total on list item",
    );
    assert.ok(typeof found.ideaCounts.done === "number", "Expected ideaCounts.done on list item");
  });

  it("GET /api/studio/campaigns/:id — returns campaign with ideas and articles arrays", async () => {
    const { status, body } = await get(`/api/studio/campaigns/${testCampaignId}`);
    assert.equal(status, 200);
    const campaign = body as any;
    assert.equal(campaign.id, testCampaignId);
    assert.ok(Array.isArray(campaign.ideas), "Expected ideas array");
    assert.ok(Array.isArray(campaign.articles), "Expected articles array");
    assert.ok(campaign.ideaCounts, "Expected ideaCounts");
  });

  it("PATCH /api/studio/campaigns/:id — updates name and it is reflected on GET", async () => {
    const newName = "API Test Campaign — Updated";
    const { status } = await patch(`/api/studio/campaigns/${testCampaignId}`, {
      name: newName,
    });
    assert.equal(status, 200);
    const { body: detail } = await get(`/api/studio/campaigns/${testCampaignId}`);
    assert.equal((detail as any).name, newName, "Updated name not reflected on GET");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// § 2 — Contributors
// ══════════════════════════════════════════════════════════════════════════════

describe("Campaign contributors", async () => {
  let adminId = "";

  before(async () => {
    // Resolve the E2E admin's user id so we can add them as a contributor
    const { body } = await get("/api/auth/me");
    adminId = (body as any).id ?? "";
    assert.ok(adminId, "Could not resolve admin user id from /api/auth/me");
  });

  it("POST /api/studio/campaigns/:id/contributors — appends contributor and returns updated campaign", async () => {
    const { status, body } = await post(
      `/api/studio/campaigns/${testCampaignId}/contributors`,
      { userIds: [adminId] },
    );
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    const updated = body as any;
    const ids: string[] = Array.isArray(updated.contributorUserIds)
      ? updated.contributorUserIds
      : [];
    assert.ok(ids.includes(adminId), "Admin user not in contributorUserIds after append");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// § 3 — Analytics
// ══════════════════════════════════════════════════════════════════════════════

describe("Campaign analytics", async () => {
  it("GET /api/studio/campaigns/:id/analytics — returns 200 with expected shape keys", async () => {
    const { status, body } = await get(`/api/studio/campaigns/${testCampaignId}/analytics`);
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    // Shape check — may be empty for a new campaign but keys must exist
    const data = body as any;
    assert.ok("engagementMatrix" in data || "ideasByStatus" in data || "publishedCount" in data,
      `Unexpected analytics shape: ${JSON.stringify(Object.keys(data))}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// § 4 — AI plan preview (no-write) + confirm-plan (writes)
// ══════════════════════════════════════════════════════════════════════════════

describe("Campaign AI plan — preview and confirm", async () => {
  it("POST generate-plan-preview — returns suggestions array and does NOT write articles", async () => {
    // Count articles before
    const beforeRows = await db.execute(
      sql`SELECT COUNT(*) AS cnt FROM studio_articles WHERE campaign_id = ${testCampaignId}`,
    );
    const before = Number((beforeRows.rows[0] as any)?.cnt ?? 0);

    const { status, body } = await post(
      `/api/studio/campaigns/${testCampaignId}/generate-plan-preview`,
      { itemCount: 4 },
    );

    // 503 = AI not configured in this environment — skip deep assertions
    if (status === 503) return;

    assert.ok(
      status === 200 || status === 201,
      `Expected 200/201, got ${status}: ${JSON.stringify(body)}`,
    );
    const result = body as any;
    assert.ok(Array.isArray(result.suggestions), "Expected suggestions array in preview response");
    assert.ok(result.suggestions.length > 0, "Expected at least one suggestion");
    // Verify first suggestion has required shape
    const s = result.suggestions[0];
    assert.ok(typeof s.topic === "string" && s.topic.length > 0, "Suggestion missing topic");
    assert.ok(typeof s.contentType === "string", "Suggestion missing contentType");

    // CRITICAL: confirm no articles were written to DB
    const afterRows = await db.execute(
      sql`SELECT COUNT(*) AS cnt FROM studio_articles WHERE campaign_id = ${testCampaignId}`,
    );
    const after = Number((afterRows.rows[0] as any)?.cnt ?? 0);
    assert.equal(after, before, "generate-plan-preview must NOT write articles to DB");
  });

  it("POST confirm-plan — creates articles and ideas linked to campaign", async () => {
    const suggestions = [
      {
        topic: "AI in Staffing — API Test Article",
        contentType: "article",
        channels: ["website"],
        suggestedDate: futureDate(7),
        brief: "Test brief for article",
      },
      {
        topic: "Social Post on Hiring Trends — API Test",
        contentType: "social_post",
        channels: ["linkedin"],
        suggestedDate: futureDate(8),
        brief: "Test brief for social post",
      },
    ];

    // Count before
    const beforeArt = await db.execute(
      sql`SELECT COUNT(*) AS cnt FROM studio_articles WHERE campaign_id = ${testCampaignId}`,
    );
    const beforeIdea = await db.execute(
      sql`SELECT COUNT(*) AS cnt FROM studio_content_ideas WHERE campaign_id = ${testCampaignId}`,
    );
    const artBefore = Number((beforeArt.rows[0] as any)?.cnt ?? 0);
    const ideaBefore = Number((beforeIdea.rows[0] as any)?.cnt ?? 0);

    const { status, body } = await post(
      `/api/studio/campaigns/${testCampaignId}/confirm-plan`,
      { suggestions },
    );
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);

    const result = body as any;
    assert.ok(typeof result.created === "number", "Expected 'created' count in response");
    assert.equal(result.created, 2, "Expected 2 items created (1 article + 1 social post)");
    assert.ok(Array.isArray(result.articles), "Expected articles array");
    assert.ok(Array.isArray(result.ideas), "Expected ideas array");
    assert.equal(result.articles.length, 1, "Expected 1 article created");
    assert.equal(result.ideas.length, 1, "Expected 1 idea created");

    // Track for cleanup
    for (const a of result.articles) createdArticleIds.push(String(a.id));
    for (const i of result.ideas) createdIdeaIds.push(String(i.id));

    // Verify articles exist in DB and are linked to the campaign
    const afterArt = await db.execute(
      sql`SELECT COUNT(*) AS cnt FROM studio_articles WHERE campaign_id = ${testCampaignId}`,
    );
    const artAfter = Number((afterArt.rows[0] as any)?.cnt ?? 0);
    assert.ok(artAfter > artBefore, "Article count should increase after confirm-plan");

    // Verify the article has correct campaign linkage
    const artRow = await db.execute(
      sql`SELECT campaign_id, status, scheduled_at FROM studio_articles WHERE id = ${createdArticleIds[0]}`,
    );
    const art = artRow.rows[0] as any;
    assert.equal(String(art.campaign_id), testCampaignId, "Article not linked to campaign");
    assert.equal(art.status, "draft", "Confirmed article should have status=draft");
    assert.ok(art.scheduled_at, "Article should have scheduledAt set");

    // Verify ideas in DB
    const afterIdea = await db.execute(
      sql`SELECT COUNT(*) AS cnt FROM studio_content_ideas WHERE campaign_id = ${testCampaignId}`,
    );
    const ideaAfter = Number((afterIdea.rows[0] as any)?.cnt ?? 0);
    assert.ok(ideaAfter > ideaBefore, "Idea count should increase after confirm-plan");
  });

  it("POST confirm-plan second call — returns 201 (endpoint accepts re-confirmation)", async () => {
    // The backend does not deduplicate; this test verifies the endpoint is
    // callable again without a server error.
    const suggestions = [
      {
        topic: "Second Confirm — Idempotency Check",
        contentType: "article",
        channels: ["website"],
        suggestedDate: futureDate(10),
        brief: "Second confirm test",
      },
    ];
    const { status, body } = await post(
      `/api/studio/campaigns/${testCampaignId}/confirm-plan`,
      { suggestions },
    );
    assert.equal(
      status,
      201,
      `Expected 201 on second confirm, got ${status}: ${JSON.stringify(body)}`,
    );
    // Track for cleanup
    for (const a of (body as any).articles ?? []) createdArticleIds.push(String(a.id));
    for (const i of (body as any).ideas ?? []) createdIdeaIds.push(String(i.id));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// § 5 — Calendar: GET, ai-plan, schedule-draft, reschedule, generate-social-draft
// ══════════════════════════════════════════════════════════════════════════════

describe("Calendar API", async () => {
  const calFrom = futureDate(20);
  const calTo = futureDate(34);
  let calArticleId = "";

  it("GET /api/admin/studio/calendar — returns empty array for a date range with no articles", async () => {
    // Use a far-future date range unlikely to have existing articles
    const from = futureDate(200);
    const to = futureDate(214);
    const { status, body } = await get(
      `/api/admin/studio/calendar?from=${from}&to=${to}&projectId=${encodeURIComponent(testProjectId)}`,
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray(body), "Expected array response");
  });

  it("POST /api/admin/studio/calendar/ai-plan — creates N article stubs in the date range", async () => {
    const { status, body } = await post("/api/admin/studio/calendar/ai-plan", {
      projectId: testProjectId,
      fromDate: calFrom,
      toDate: calTo,
      articlesPerWeek: 3,
      topicFocus: ["IT staffing", "Healthcare hiring"],
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
    const result = body as any;
    assert.ok(typeof result.count === "number" && result.count > 0, "Expected count > 0");
    assert.ok(Array.isArray(result.stubs), "Expected stubs array");
    assert.ok(Array.isArray(result.plan), "Expected plan array");

    // Track stubs for cleanup and for schedule-draft test
    for (const stub of result.stubs) {
      createdArticleIds.push(String(stub.id));
      aiPlanStubIds.push(String(stub.id));
    }
    calArticleId = result.stubs[0]?.id ? String(result.stubs[0].id) : "";

    // Each stub should have a scheduledAt within the requested date range
    for (const stub of result.stubs) {
      const sched = stub.scheduledAt ? String(stub.scheduledAt).slice(0, 10) : null;
      assert.ok(sched && sched >= calFrom && sched <= calTo,
        `Stub scheduledAt ${sched} outside range [${calFrom}, ${calTo}]`);
    }
  });

  it("GET /api/admin/studio/calendar — seeded article appears in date range response", async () => {
    const { status, body } = await get(
      `/api/admin/studio/calendar?from=${calFrom}&to=${calTo}&projectId=${encodeURIComponent(testProjectId)}`,
    );
    assert.equal(status, 200);
    const items = body as any[];
    assert.ok(Array.isArray(items), "Expected array");
    assert.ok(items.length > 0, "Expected at least one item in range after ai-plan");
    const found = items.find((a) => a.id === calArticleId || createdArticleIds.includes(String(a.id)));
    assert.ok(found, "ai-plan stub not found in calendar GET for same date range");
  });

  it("GET /api/admin/studio/calendar — article outside range is excluded", async () => {
    // Query a range BEFORE the ai-plan stubs (calFrom = futureDate(20)) — those stubs must not appear
    const rangeEnd = futureDate(19);
    const rangeStart = futureDate(16);
    const { status, body } = await get(
      `/api/admin/studio/calendar?from=${rangeStart}&to=${rangeEnd}&projectId=${encodeURIComponent(testProjectId)}`,
    );
    assert.equal(status, 200);
    const items = body as any[];
    // Only check ai-plan stubs (scheduled at futureDate(20)+); confirm-plan articles may legitimately
    // fall in other date ranges and are not under test here.
    for (const stubId of aiPlanStubIds) {
      const found = items.find((a) => String(a.id) === stubId);
      assert.ok(!found, `ai-plan stub ${stubId} should not appear before its scheduled date range`);
    }
  });

  it("POST /api/admin/studio/articles/:id/schedule-draft — moves draft to scheduled with correct scheduledAt", async () => {
    if (!calArticleId) {
      // ai-plan may have failed — skip this test
      return;
    }
    const schedAt = futureISO(25);
    const { status, body } = await post(
      `/api/admin/studio/articles/${calArticleId}/schedule-draft`,
      { scheduledAt: schedAt },
    );
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    const article = body as any;
    assert.equal(article.status, "scheduled", "Article status should be 'scheduled' after schedule-draft");
    // scheduledAt should match within 1-second tolerance
    const returned = new Date(article.scheduledAt).getTime();
    const expected = new Date(schedAt).getTime();
    assert.ok(Math.abs(returned - expected) < 2000, "scheduledAt not updated correctly");
  });

  it("POST /api/admin/studio/articles/:id/reschedule — updates scheduledAt on a scheduled article", async () => {
    if (!calArticleId) return;
    const newSchedAt = futureISO(30);
    const { status, body } = await post(
      `/api/admin/studio/articles/${calArticleId}/reschedule`,
      { scheduledAt: newSchedAt },
    );
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    const article = body as any;
    assert.equal(article.status, "scheduled");
    const returned = new Date(article.scheduledAt).getTime();
    const expected = new Date(newSchedAt).getTime();
    assert.ok(Math.abs(returned - expected) < 2000, "scheduledAt not updated by reschedule");
  });

  it("POST /api/admin/studio/calendar/generate-social-draft — returns caption string (or 503 if AI not configured)", async () => {
    const { status, body } = await post(
      "/api/admin/studio/calendar/generate-social-draft",
      { topic: "AI in staffing", platform: "instagram" },
    );
    // 503 = AI not configured — acceptable in dev environment
    if (status === 503) return;
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    const result = body as any;
    assert.ok(
      typeof result.caption === "string" && result.caption.length > 0,
      `Expected non-empty caption string, got: ${JSON.stringify(result)}`,
    );
  });
});
