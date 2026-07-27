/**
 * Studio Admin — Hybrid Spec
 *
 * Light UI smoke tests confirming each Studio admin page loads and primary
 * data renders, combined with API contract assertions (shape, not values)
 * made through the running server using loginViaAPI + apiGet/apiPost.
 *
 * Run with the full E2E suite:
 *   E2E_NO_SERVER=1 npx playwright test tests/e2e/studioAdminHybrid.spec.ts
 *
 * Prerequisites: e2e-seed must have been run (npx tsx scripts/e2e-seed.ts).
 */

import { test, expect, type BrowserContext } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_PASSWORD,
  loginViaAPI,
  apiGet,
  apiPost,
} from "./fixtures/auth";

// ── Shared login state ────────────────────────────────────────────────────────

let adminContext: BrowserContext;

test.beforeAll(async ({ browser }) => {
  adminContext = await browser.newContext();
  await loginViaAPI(adminContext, process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000", E2E_ADMIN_EMAIL, E2E_PASSWORD);
});

test.afterAll(async () => {
  await adminContext.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// API CONTRACT TESTS — shape assertions via the live server
// These run first so page-load failures don't mask API regressions.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("API — Studio Analytics endpoints", () => {
  test("GET /api/admin/studio/analytics returns 200 with workflow/audience shape", async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const { status, body } = await apiGet(adminContext, baseURL, "/api/admin/studio/analytics");
    expect(status, `expected 200, got ${status}`).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty("workflow");
    const wf = b.workflow as Record<string, unknown>;
    expect(wf).toHaveProperty("publishedCount");
    expect(wf).toHaveProperty("slaRatePct");
    expect(wf).toHaveProperty("medianDraftToPublishDays");
    expect(b).toHaveProperty("audience");
    expect(b).toHaveProperty("topArticles");
    expect(b).toHaveProperty("subscribers");
  });

  test("GET /api/studio/analytics/attribution returns 200 with array", async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const { status, body } = await apiGet(adminContext, baseURL, "/api/studio/analytics/attribution");
    expect(status, `expected 200, got ${status}`).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/admin/studio/spend/summary returns 200 with expected keys", async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const { status, body } = await apiGet(adminContext, baseURL, "/api/admin/studio/spend/summary");
    expect(status, `expected 200, got ${status}`).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty("monthly");
    expect(b).toHaveProperty("byModel");
    expect(b).toHaveProperty("byKind");
    expect(b).toHaveProperty("dailySeries");
    expect(Array.isArray(b.monthly)).toBe(true);
    expect(Array.isArray(b.dailySeries)).toBe(true);
  });
});

test.describe("API — Studio Authors endpoints", () => {
  test("GET /api/admin/studio/authors returns 200 with array", async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const { status, body } = await apiGet(adminContext, baseURL, "/api/admin/studio/authors");
    expect(status, `expected 200, got ${status}`).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

test.describe("API — Studio Access endpoints", () => {
  test("GET /api/admin/studio/access returns 200 with array", async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const { status, body } = await apiGet(adminContext, baseURL, "/api/admin/studio/access");
    expect(status, `expected 200, got ${status}`).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test("POST with invalid addOn returns 400", async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const { status } = await apiPost(adminContext, baseURL, "/api/admin/studio/access", {
      userId: "00000000-0000-0000-0000-000000000099",
      addOn: "not_a_real_addon",
    });
    expect(status).toBe(400);
  });
});

test.describe("API — Studio Subscribers endpoints", () => {
  test("GET /api/admin/studio/subscribers returns 200 with items + counts", async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const { status, body } = await apiGet(adminContext, baseURL, "/api/admin/studio/subscribers");
    expect(status, `expected 200, got ${status}`).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty("items");
    expect(b).toHaveProperty("counts");
    expect(Array.isArray(b.items)).toBe(true);
    const counts = b.counts as Record<string, unknown>;
    expect(counts).toHaveProperty("active");
    expect(counts).toHaveProperty("total");
  });
});

test.describe("API — Articles + Inbox endpoints", () => {
  test("GET /api/admin/studio/articles?status=published returns items + total", async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const { status, body } = await apiGet(
      adminContext,
      baseURL,
      "/api/admin/studio/articles?status=published",
    );
    expect(status, `expected 200, got ${status}`).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty("items");
    expect(b).toHaveProperty("total");
    expect(Array.isArray(b.items)).toBe(true);
    // All returned items must have status=published
    const items = b.items as Array<Record<string, unknown>>;
    for (const item of items) {
      expect(item.status).toBe("published");
    }
  });

  test("GET /api/admin/studio/inbox returns 200 with array", async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const { status, body } = await apiGet(adminContext, baseURL, "/api/admin/studio/inbox");
    expect(status, `expected 200, got ${status}`).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

test.describe("API — Unauthenticated requests return 401", () => {
  test("GET /api/admin/studio/analytics without auth returns 401", async ({ request }) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const res = await request.get(`${baseURL}/api/admin/studio/analytics`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/admin/studio/spend/summary without auth returns 401", async ({ request }) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const res = await request.get(`${baseURL}/api/admin/studio/spend/summary`);
    expect(res.status()).toBe(401);
  });

  test("POST /api/admin/studio/access without auth returns 401", async ({ request }) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";
    const res = await request.post(`${baseURL}/api/admin/studio/access`, {
      data: { userId: "test", addOn: "marketing_manager" },
    });
    expect(res.status()).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UI SMOKE TESTS — page loads + primary elements visible
// ─────────────────────────────────────────────────────────────────────────────

test.describe("UI Smoke — Analytics page", () => {
  test("page loads without error banners and shows metric content", async () => {
    const page = await adminContext.newPage();
    await page.goto("/admin/studio/analytics");

    // No fatal error banners
    const errorBanner = page.locator(
      '[data-testid*="error"], .text-destructive, [role="alert"]',
    ).filter({ hasText: /failed to load|something went wrong|error/i });
    await expect(errorBanner).toHaveCount(0, { timeout: 12_000 });

    // Analytics tabs should be present
    await expect(
      page.locator('[role="tablist"], [data-testid*="tab"]').first(),
    ).toBeVisible({ timeout: 12_000 });

    await page.close();
  });

  test("Analytics page tabs are switchable (Performance, Feedback, AI Spend)", async () => {
    const page = await adminContext.newPage();
    await page.goto("/admin/studio/analytics");

    // Wait for the page to stabilise
    await page.waitForLoadState("networkidle");

    // Try to click each tab if present — won't fail if tabs use different labels
    const tabList = page.locator('[role="tablist"]').first();
    await expect(tabList).toBeVisible({ timeout: 10_000 });

    const tabs = tabList.locator('[role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);

    // Click each tab and assert no JS error causes a blank page
    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      // Brief settle time
      await page.waitForTimeout(300);
      // Page body should still have content
      await expect(page.locator("body")).toBeVisible();
    }

    await page.close();
  });
});

test.describe("UI Smoke — Authors page", () => {
  test("page loads and shows authors list or empty state", async () => {
    const page = await adminContext.newPage();
    await page.goto("/admin/studio/authors");
    await page.waitForLoadState("networkidle");

    // Title is visible
    await expect(
      page.locator('[data-testid="text-authors-title"]'),
    ).toBeVisible({ timeout: 12_000 });

    // Either an authors list, a project switcher, or an empty state loads
    await expect(
      page.locator(
        '[data-testid*="author"], .authors-panel, [data-testid="text-authors-title"]',
      ).first(),
    ).toBeVisible();

    await page.close();
  });
});

test.describe("UI Smoke — Studio Access page", () => {
  test("page loads and access management UI is present", async () => {
    const page = await adminContext.newPage();
    await page.goto("/admin/studio/access");
    await page.waitForLoadState("networkidle");

    // Title is visible
    await expect(
      page.locator('[data-testid="text-studio-access-title"]'),
    ).toBeVisible({ timeout: 12_000 });

    // "Add Author" button present (admin has studio.manage_authors)
    await expect(
      page.locator('[data-testid="button-add-author"]'),
    ).toBeVisible({ timeout: 8_000 });

    await page.close();
  });
});

test.describe("UI Smoke — Subscribers page", () => {
  test("page loads and shows subscriber list or empty state", async () => {
    const page = await adminContext.newPage();
    await page.goto("/admin/studio/subscribers");
    await page.waitForLoadState("networkidle");

    // Title
    await expect(
      page.locator('[data-testid="text-subscribers-title"]'),
    ).toBeVisible({ timeout: 12_000 });

    // Export CSV button must be present
    await expect(
      page.locator('[data-testid="button-export-csv"]'),
    ).toBeVisible({ timeout: 8_000 });

    await page.close();
  });

  test("Export CSV button is present", async () => {
    const page = await adminContext.newPage();
    await page.goto("/admin/studio/subscribers");
    await expect(
      page.locator('[data-testid="button-export-csv"]'),
    ).toBeVisible({ timeout: 12_000 });
    await page.close();
  });
});

test.describe("UI Smoke — Live Content page", () => {
  test("page loads and shows live content list or empty state", async () => {
    const page = await adminContext.newPage();
    await page.goto("/admin/studio/live");
    await page.waitForLoadState("networkidle");

    // Title
    await expect(
      page.locator('[data-testid="text-live-content-title"]'),
    ).toBeVisible({ timeout: 12_000 });

    // Either items or the "Nothing is live right now" empty state
    await expect(
      page.locator(
        '[data-testid^="row-live-"], :text("Nothing is live right now")',
      ).first(),
    ).toBeVisible({ timeout: 8_000 });

    await page.close();
  });
});

test.describe("UI Smoke — Inbox page", () => {
  test("page loads without error", async () => {
    const page = await adminContext.newPage();
    await page.goto("/admin/studio/inbox");
    await page.waitForLoadState("networkidle");

    // Title
    await expect(
      page.locator('[data-testid="text-inbox-title"]'),
    ).toBeVisible({ timeout: 12_000 });

    // Either inbox items or the "all caught up" empty state
    await expect(
      page.locator(
        '[data-testid^="card-inbox-"], :text("You\'re all caught up"), :text("all caught up")',
      ).first(),
    ).toBeVisible({ timeout: 8_000 });

    await page.close();
  });
});
