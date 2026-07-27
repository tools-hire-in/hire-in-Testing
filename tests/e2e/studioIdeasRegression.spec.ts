/**
 * Studio Ideas Bank — Full lifecycle regression
 *
 * Single end-to-end test that walks a social post idea from creation in the UI
 * through every state transition to "published", then verifies it appears in
 * the Ideas Bank list.  Cleans up via API after the test.
 *
 * Steps:
 *   1. Login via UI as admin
 *   2. Navigate to Ideas Bank → New Social Post
 *   3. Complete wizard: topic, platform (LinkedIn), format (Carousel), skip AI
 *   4. Assert idea card appears in list
 *   5. Drive transitions via API: → in_review → approved → in_production → scheduled → published
 *   6. Navigate to Ideas Bank; assert published badge visible on the idea card
 *   7. Clean up: archive idea via API
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

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5000";

// ── Helpers ────────────────────────────────────────────────────────────────────

async function resolveProjectId(context: import("@playwright/test").BrowserContext): Promise<string> {
  const { status, body } = await apiGet(context, BASE_URL, "/api/admin/studio/projects");
  if (status === 200) {
    const projects = body as Array<{ id: string; isActive?: boolean }>;
    const active = projects.find((p) => p.isActive !== false);
    if (active) return active.id;
  }
  const { body: created } = await apiPost(context, BASE_URL, "/api/admin/studio/projects", {
    name: "Regression Test Project",
    slug: `regression-test-${Date.now()}`,
  });
  return (created as any).id as string;
}

async function driveTransitions(
  context: import("@playwright/test").BrowserContext,
  ideaId: string,
  transitions: string[],
): Promise<void> {
  for (const to of transitions) {
    const { status, body } = await apiPost(
      context,
      BASE_URL,
      `/api/studio/content-ideas/${ideaId}/transition`,
      { to },
    );
    if (status !== 200) {
      console.warn(`[regression] transition to "${to}" returned ${status}: ${JSON.stringify(body)}`);
    }
  }
}

async function archiveIdea(
  context: import("@playwright/test").BrowserContext,
  ideaId: string,
): Promise<void> {
  await apiPost(context, BASE_URL, `/api/studio/content-ideas/${ideaId}`, {
    archivedAt: new Date().toISOString(),
  }).catch(() => {});
}

// ── Test ───────────────────────────────────────────────────────────────────────

test.describe("Studio Ideas — full lifecycle regression", () => {
  test.describe.configure({ retries: 1 });

  test(
    "idea created via wizard → driven to published via API → visible in Ideas Bank with published badge",
    async ({ page, context }) => {
      // ── 1. Login ────────────────────────────────────────────────────────────
      await loginViaUI(page, E2E_ADMIN_EMAIL, E2E_PASSWORD);
      await page.waitForURL((url) => !url.pathname.includes("/admin/login"), {
        timeout: 15_000,
      });

      // Also establish API session on the context (for driveTransitions later).
      await loginViaAPI(context, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);
      const projectId = await resolveProjectId(context);

      // ── 2. Set up route mocks ───────────────────────────────────────────────
      // Mock AI draft so the wizard doesn't need real AI keys.
      await page.route("**/api/admin/studio/calendar/generate-social-draft", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ caption: "Mock regression caption" }),
        }),
      );

      // Capture the created idea ID from the API response via page.on('response').
      let capturedIdeaId: string | null = null;
      page.on("response", async (response) => {
        try {
          if (
            response.url().includes("/api/studio/content-ideas") &&
            !response.url().includes("/transition") &&
            !response.url().includes("/comments") &&
            !response.url().includes("/watchers") &&
            response.request().method() === "POST" &&
            response.status() === 201
          ) {
            const body = await response.json().catch(() => null);
            if (body?.id && !capturedIdeaId) {
              capturedIdeaId = body.id;
            }
          }
        } catch { /* non-fatal */ }
      });

      // ── 3. Navigate to Ideas Bank ────────────────────────────────────────────
      await page.goto("/studio/ideas");
      await page.waitForLoadState("networkidle");

      // ── 4. Open wizard ───────────────────────────────────────────────────────
      const newBtn = page.locator('[data-testid="button-new-social-post"]');
      await expect(newBtn).toBeVisible({ timeout: 12_000 });
      await newBtn.click();

      await expect(page.locator('[data-testid="dialog-create-post"]')).toBeVisible({
        timeout: 8_000,
      });

      // Step 0 — Topic
      const uniqueTopic = `Regression lifecycle test ${Date.now()}`;
      await page.fill('[data-testid="input-create-topic"]', uniqueTopic);
      await page.click('[data-testid="button-next-step-1"]');

      // Step 1 — Platform: LinkedIn
      await expect(page.locator('[data-testid="button-platform-linkedin"]')).toBeVisible({
        timeout: 5_000,
      });
      await page.click('[data-testid="button-platform-linkedin"]');
      await page.click('[data-testid="button-next-step-2"]');

      // Step 2 — Format: Carousel → skip AI (to avoid rate-limit in CI)
      await expect(page.locator('[data-testid="button-format-carousel"]')).toBeVisible({
        timeout: 5_000,
      });
      await page.click('[data-testid="button-format-carousel"]');
      await page.click('[data-testid="button-skip-generate"]');

      // Step 3 — Save (no AI draft)
      await expect(page.locator('[data-testid="button-save-idea"]')).toBeVisible({
        timeout: 5_000,
      });
      await page.click('[data-testid="button-save-idea"]');

      // ── 5. Wait for creation to complete and resolve idea ID ────────────────
      // The wizard fires a POST /api/studio/content-ideas (captured by response
      // listener) then navigates to /studio/ideas/:id.  We wait for the detail
      // URL specifically (pathname ends with a UUID segment) so we don't resolve
      // early while still on the list page (/studio/ideas).
      await page.waitForURL(
        (url) => /\/studio\/ideas\/[0-9a-f-]{8,}/.test(url.pathname),
        { timeout: 15_000 },
      ).catch(() => {
        // Navigation may have already happened or be in progress — continue and
        // try to resolve the ID via the other strategies below.
      });

      // ── 6. Resolve the idea ID ────────────────────────────────────────────
      // Primary: captured from the 201 response listener (fires ~same time as nav).
      let ideaId: string | null = capturedIdeaId;

      // Fallback 1: extract from the current URL.
      if (!ideaId) {
        const m = page.url().match(/\/studio\/ideas\/([0-9a-f-]{8,})/i);
        if (m) ideaId = m[1];
      }

      // Fallback 2: find via API by matching topic (handles slow navigation).
      if (!ideaId) {
        const { body } = await apiGet(
          context,
          BASE_URL,
          `/api/studio/content-ideas?projectId=${encodeURIComponent(projectId)}&contentType=social_post`,
        );
        const ideas = body as Array<{ id: string; topic: string }>;
        const found = ideas.find((i) => i.topic.trim() === uniqueTopic.trim());
        if (found) ideaId = found.id;
      }

      expect(ideaId, "Created idea id must be resolvable (response listener, URL, or API)").not.toBeNull();

      // ── 7. Drive idea to published via API ────────────────────────────────
      await driveTransitions(context, ideaId!, [
        "in_review",
        "approved",
        "in_production",
        "scheduled",
        "published",
      ]);

      // ── 8. Verify published badge in Ideas Bank list ──────────────────────
      await page.goto("/studio/ideas");
      await page.waitForLoadState("networkidle");

      // Search for the idea to surface it even in a long list.
      const searchInput = page.locator('[data-testid="input-ideas-search"]');
      await expect(searchInput).toBeVisible({ timeout: 10_000 });
      await searchInput.fill(uniqueTopic.slice(0, 30));

      const card = page.locator(`[data-testid="card-idea-${ideaId}"]`);
      await expect(card).toBeVisible({ timeout: 10_000 });

      const statusBadge = page.locator(`[data-testid="badge-status-${ideaId}"]`);
      await expect(statusBadge).toContainText(/published/i);

      // ── 9. Cleanup ────────────────────────────────────────────────────────
      await archiveIdea(context, ideaId!);
    },
  );
});
