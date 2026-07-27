/**
 * Studio Campaigns & Calendar — Pure E2E regression
 *
 * Full browser flow: login via UI → create campaign → generate AI plan →
 * confirm plan → navigate to calendar → verify article stubs appear.
 *
 * Run: E2E_NO_SERVER=1 npx playwright test tests/e2e/studioCampaignsRegression.spec.ts
 *
 * NOTE: The "Generate AI Plan" step calls the AI service. If AI is not
 * configured the server returns a 503 and the button shows an error toast.
 * In that case the test falls back to confirming a manually-built plan so
 * the rest of the regression flow (confirm → calendar) is still exercised.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_PASSWORD,
  loginViaUI,
  loginViaAPI,
  apiPost,
  apiGet,
} from "./fixtures/auth";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5000";

/** YYYY-MM-DD N days from today */
function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Future ISO timestamp N days + 2 hours from now */
function futureISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + 2);
  return d.toISOString();
}

// ── shared state across tests ─────────────────────────────────────────────────

let testProjectId = "";
let testCampaignId = "";
const cleanupArticleIds: string[] = [];

// ── setup: create a project via API so the campaign can be linked ─────────────

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  await loginViaAPI(ctx, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const projRes = await apiPost(ctx, BASE_URL, "/api/admin/studio/projects", {
    name: "Regression Test Project",
    slug: `regression-test-${Date.now()}`,
    description: "Ephemeral project for regression E2E tests",
    publishesToInsights: false,
  });
  if (projRes.status === 201) {
    testProjectId = (projRes.body as any).id ?? "";
  }
  await ctx.close();
});

// ── teardown: remove all test data ────────────────────────────────────────────

test.afterAll(async ({ browser }) => {
  if (!testProjectId && !testCampaignId) return;
  const ctx = await browser.newContext();
  await loginViaAPI(ctx, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  // Delete linked articles/ideas and the campaign via direct DB cleanup
  // (no bulk-delete API exists, so we use the DB-aware teardown endpoint if available)
  if (testCampaignId) {
    // Archive the campaign — best-effort
    await apiPost(ctx, BASE_URL, `/api/admin/studio/campaigns/${testCampaignId}/archive`, {}).catch(() => {});
  }

  await ctx.close();
});

// ═══════════════════════════════════════════════════════════════════════════
// Full regression flow
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Studio Campaigns & Calendar — full regression", () => {
  test(
    "create campaign → confirm plan → calendar shows article stubs",
    async ({ page, context }) => {
      // ── Step 1: Login via UI ──────────────────────────────────────────────
      await loginViaUI(page, E2E_ADMIN_EMAIL, E2E_PASSWORD);

      // Dismiss modals if present
      const appTour = page.locator('[data-testid="dialog-app-tour"]');
      if (await appTour.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await page.keyboard.press("Escape");
        await appTour.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
      }
      await page.route("**/api/hr/announcements/dismiss", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }),
      );
      const announceDismiss = page.locator('[data-testid="button-announcement-dismiss"]');
      if (await announceDismiss.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await announceDismiss.click();
      }

      // ── Step 2: Navigate to Campaigns ─────────────────────────────────────
      await page.goto("/studio/campaigns");
      await page.waitForLoadState("networkidle");

      // ── Step 3: Create new campaign via UI ────────────────────────────────
      const newCampaignBtn = page.locator('[data-testid="button-new-campaign"]');
      await newCampaignBtn.waitFor({ state: "visible", timeout: 12_000 });
      await newCampaignBtn.click();

      // Fill campaign form
      await page.locator('[data-testid="input-campaign-name"]').fill("Regression Campaign");

      // Set funnel stage to "awareness"
      const funnelTrigger = page.locator('[data-testid="select-campaign-funnel"]');
      if (await funnelTrigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await funnelTrigger.click();
        await page.locator('[role="option"]').filter({ hasText: /awareness/i }).first().click();
      }

      // Set status to "active"
      const statusTrigger = page.locator('[data-testid="select-campaign-status"]');
      if (await statusTrigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await statusTrigger.click();
        await page.locator('[role="option"]').filter({ hasText: /active/i }).first().click();
      }

      // Save campaign
      const saveBtn = page.locator('[data-testid="button-save-campaign"]');
      await saveBtn.click();
      await page.waitForLoadState("networkidle");

      // Should navigate to campaign detail page — wait for campaign name heading
      const campaignTitle = page.locator('[data-testid="text-campaign-name"]');
      await campaignTitle.waitFor({ state: "visible", timeout: 15_000 });
      await expect(campaignTitle).toContainText("Regression Campaign");

      // Extract campaign ID from URL
      const url = page.url();
      const idMatch = url.match(/campaigns\/([^?/]+)/);
      testCampaignId = idMatch ? idMatch[1] : "";

      // ── Step 4: Try Generate AI Plan ──────────────────────────────────────
      // Look for either the "day plan" or "legacy plan" button
      const dayPlanBtn = page.locator('[data-testid="button-day-plan-campaign"]');
      const legacyPlanBtn = page.locator('[data-testid="button-plan-campaign-legacy"]');
      const planBtnVisible = await dayPlanBtn
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      const legacyVisible = !planBtnVisible && await legacyPlanBtn
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      let planPreviewVisible = false;

      if (planBtnVisible || legacyVisible) {
        const btn = planBtnVisible ? dayPlanBtn : legacyPlanBtn;
        await btn.click();
        await page.waitForLoadState("networkidle");

        // Wait briefly for plan preview to appear or AI error toast
        planPreviewVisible = await page
          .locator('[data-testid^="section-day-"], [data-testid^="row-plan-suggestion-"]')
          .first()
          .isVisible({ timeout: 8_000 })
          .catch(() => false);
      }

      // ── Step 5: Confirm plan (via UI if preview visible, else via API) ────

      if (planPreviewVisible) {
        // Confirm via UI button
        const confirmBtn = page.locator('[data-testid="button-confirm-plan"], [data-testid="button-confirm-day-plan"]').first();
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForLoadState("networkidle");
          // Expect success toast or plan disappearing
          await page.waitForTimeout(1_500);
        }
      } else {
        // AI not available or plan UI not found — seed via API
        if (testCampaignId) {
          const confRes = await apiPost(context, BASE_URL, `/api/studio/campaigns/${testCampaignId}/confirm-plan`, {
            suggestions: [
              {
                topic: "Regression — IT Staffing Trends",
                contentType: "article",
                channels: ["website"],
                suggestedDate: futureDate(10),
                brief: "Regression test article seeded via API fallback",
              },
              {
                topic: "Regression — LinkedIn Teaser",
                contentType: "social_post",
                channels: ["linkedin"],
                suggestedDate: futureDate(11),
                brief: "Regression test social post seeded via API fallback",
              },
            ],
          });
          expect(confRes.status).toBe(201);
          for (const a of (confRes.body as any).articles ?? []) {
            cleanupArticleIds.push(String(a.id));
          }
        }
      }

      // ── Step 6: Navigate to Calendar ─────────────────────────────────────
      const [year, month] = futureDate(10).split("-");
      await page.goto(
        `/admin/studio/calendar?month=${year}-${month}${testProjectId ? `&projectId=${encodeURIComponent(testProjectId)}` : ""}`,
      );
      await page.waitForLoadState("networkidle");

      // ── Step 7: Assert at least one article stub from the campaign appears ──
      // The calendar renders article chips; we verify the page loaded without errors
      await expect(page.locator("body")).not.toContainText("Something went wrong");

      // Calendar structure should be visible
      const calStructure = page.locator(
        '[data-testid="button-prev-month"], [data-testid="button-ai-plan"], [data-testid="button-next-month"]',
      ).first();
      await expect(calStructure).toBeVisible({ timeout: 12_000 });

      // If we have confirmed articles, they should appear as chips on the calendar
      if (testCampaignId) {
        // Verify via API that articles exist in the calendar range
        const calFrom = futureDate(8);
        const calTo = futureDate(13);
        const calRes = await apiGet(
          context,
          BASE_URL,
          `/api/admin/studio/calendar?from=${calFrom}&to=${calTo}${testProjectId ? `&projectId=${encodeURIComponent(testProjectId)}` : ""}`,
        );
        expect(calRes.status).toBe(200);
        const items = calRes.body as any[];
        const campaignItems = items.filter(
          (a) =>
            String(a.campaignId ?? a.campaign_id) === testCampaignId ||
            cleanupArticleIds.includes(String(a.id)),
        );
        // At least one article from the campaign should be in the calendar
        expect(campaignItems.length).toBeGreaterThan(0);
      }

      // ── Step 8: Click an article stub on the calendar (opens article editor) ──
      // Find a calendar chip that is clickable
      const articleChip = page
        .locator('a[href*="/articles/"][href*="/edit"], [data-testid^="chip-article-"]')
        .first();
      if (await articleChip.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const href = await articleChip.getAttribute("href");
        if (href) {
          await page.goto(href);
          await page.waitForLoadState("networkidle");
          // Article editor should load without a crash
          await expect(page.locator("body")).not.toContainText("Something went wrong");
        }
      }
    },
  );

  // ── Standalone: calendar page basic smoke test ───────────────────────────

  test("calendar page loads without error after UI login", async ({ page }) => {
    await loginViaUI(page, E2E_ADMIN_EMAIL, E2E_PASSWORD);

    // Dismiss modals
    const appTour = page.locator('[data-testid="dialog-app-tour"]');
    if (await appTour.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await appTour.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
    }

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await page.goto(`/admin/studio/calendar?month=${monthStr}`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Something went wrong");

    // Navigation buttons should be visible
    const prevBtn = page.locator('[data-testid="button-prev-month"]');
    const nextBtn = page.locator('[data-testid="button-next-month"]');
    await expect(prevBtn.or(nextBtn)).toBeVisible({ timeout: 12_000 });
  });

  // ── ai-plan smoke: bulk stub creation via UI dialog ───────────────────────

  test("AI Schedule dialog opens and accepts input", async ({ page, context }) => {
    await loginViaAPI(context, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await page.goto(`/admin/studio/calendar?month=${monthStr}`);
    await page.waitForLoadState("networkidle");

    // Open AI Schedule dialog
    const aiBtn = page.locator('[data-testid="button-ai-plan"]');
    await aiBtn.waitFor({ state: "visible", timeout: 10_000 });
    await aiBtn.click();

    const dialog = page.locator('[data-testid="dialog-ai-plan"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fill in articles per week
    const perWeekInput = page.locator('[data-testid="input-ai-per-week"]');
    await expect(perWeekInput).toBeVisible();
    await perWeekInput.fill("2");

    // Fill topic focus
    const topicsInput = page.locator('[data-testid="input-ai-topics"]');
    await expect(topicsInput).toBeVisible();
    await topicsInput.fill("IT staffing trends");

    // Submit button should be enabled when project is selected
    const submitBtn = page.locator('[data-testid="button-ai-plan-submit"]');
    await expect(submitBtn).toBeVisible();

    // Close without submitting (dialog tested for presence and interaction)
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });
});
