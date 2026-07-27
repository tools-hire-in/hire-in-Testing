/**
 * Studio Ideas Bank — Hybrid spec
 *
 * Mixes API seeding (fast, reliable) with targeted UI assertions so we catch
 * rendering regressions without running a full click-through for every scenario.
 *
 * Patterns:
 *  - loginViaAPI  → establish authenticated browser session
 *  - apiPost/GET  → seed or verify state
 *  - page.goto    → render the relevant UI surface
 *  - expect       → assert visible elements / status badges
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_PASSWORD,
  loginViaAPI,
  apiPost,
  apiGet,
} from "./fixtures/auth";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5000";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Get or create the first active studio project. Returns its id. */
async function resolveProjectId(context: import("@playwright/test").BrowserContext): Promise<string> {
  const { status, body } = await apiGet(context, BASE_URL, "/api/admin/studio/projects");
  if (status === 200) {
    const projects = body as Array<{ id: string; isActive?: boolean }>;
    const active = projects.find((p) => p.isActive !== false);
    if (active) return active.id;
  }
  const { body: created } = await apiPost(context, BASE_URL, "/api/admin/studio/projects", {
    name: "Hybrid Test Project",
    slug: `hybrid-test-project-${Date.now()}`,
  });
  return (created as any).id as string;
}

/** Create a social post idea via API and return its id + status. */
async function createIdea(
  context: import("@playwright/test").BrowserContext,
  projectId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; status: string }> {
  const { body } = await apiPost(context, BASE_URL, "/api/studio/content-ideas", {
    projectId,
    topic: `Hybrid test idea ${Date.now()}`,
    contentType: "social_post",
    channels: ["linkedin"],
    format: "carousel",
    ...overrides,
  });
  return { id: (body as any).id, status: (body as any).status };
}

/** Drive an idea through a chain of transitions via API. */
async function driveTransitions(
  context: import("@playwright/test").BrowserContext,
  ideaId: string,
  transitions: string[],
): Promise<void> {
  for (const to of transitions) {
    await apiPost(context, BASE_URL, `/api/studio/content-ideas/${ideaId}/transition`, { to });
  }
}

/** Archive a test idea (best-effort cleanup). */
async function cleanupIdea(
  context: import("@playwright/test").BrowserContext,
  ideaId: string,
): Promise<void> {
  await apiPost(context, BASE_URL, `/api/studio/content-ideas/${ideaId}`, {}).catch(() => {});
}

// ── Suite ──────────────────────────────────────────────────────────────────────

test.describe("Ideas Bank — Hybrid (API seed + UI validate)", () => {
  test.describe.configure({ retries: 1 });

  // ── 1. Idea creation wizard end-to-end ─────────────────────────────────────

  test("idea creation wizard: complete all 4 steps → card appears in list", async ({
    page,
    context,
  }) => {
    await loginViaAPI(context, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);
    const projectId = await resolveProjectId(context);

    // Mock the AI generate-social-draft endpoint so the wizard doesn't need real AI.
    await page.route("**/api/admin/studio/calendar/generate-social-draft", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ caption: "Mock AI caption for Remote IT staffing trends" }),
      }),
    );

    await page.goto("/studio/ideas");
    await page.waitForLoadState("networkidle");

    // Open the New Social Post dialog.
    const newBtn = page.locator('[data-testid="button-new-social-post"]');
    await expect(newBtn).toBeVisible({ timeout: 10_000 });
    await newBtn.click();

    // Step 0 — Topic
    await expect(page.locator('[data-testid="dialog-create-post"]')).toBeVisible({
      timeout: 8_000,
    });
    await page.fill('[data-testid="input-create-topic"]', "Remote IT staffing trends");
    await page.click('[data-testid="button-next-step-1"]');

    // Step 1 — Platform: LinkedIn
    await expect(page.locator('[data-testid="button-platform-linkedin"]')).toBeVisible({
      timeout: 5_000,
    });
    await page.click('[data-testid="button-platform-linkedin"]');
    await page.click('[data-testid="button-next-step-2"]');

    // Step 2 — Format: Carousel → Generate AI Draft
    await expect(page.locator('[data-testid="button-format-carousel"]')).toBeVisible({
      timeout: 5_000,
    });
    await page.click('[data-testid="button-format-carousel"]');
    await page.click('[data-testid="button-generate-draft"]');

    // Step 3 — Generated caption shown; save.
    await expect(page.locator('[data-testid="badge-ai-generated"]')).toBeVisible({
      timeout: 10_000,
    });
    await page.click('[data-testid="button-save-idea"]');

    // After save, dialog closes and we're redirected to the idea detail page OR
    // the list updates. Accept either: the idea topic must appear somewhere.
    await expect(
      page.locator('text="Remote IT staffing trends"').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── 2. Approve an idea seeded in in_review ─────────────────────────────────

  test("approve button: in_review idea → status badge shows approved", async ({
    page,
    context,
  }) => {
    await loginViaAPI(context, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);
    const projectId = await resolveProjectId(context);

    // Seed idea in in_review state.
    const { id: ideaId } = await createIdea(context, projectId);
    await driveTransitions(context, ideaId, ["in_review"]);

    // Navigate to the idea detail page.
    await page.goto(`/studio/ideas/${ideaId}`);
    await page.waitForLoadState("networkidle");

    // Look for an "Approve" action button or transition control.
    // The detail page renders transition buttons. Try to find one.
    const approveBtn = page
      .locator('button')
      .filter({ hasText: /approve/i })
      .first();

    await expect(approveBtn).toBeVisible({ timeout: 10_000 });
    await approveBtn.click();

    // Status badge should update to "approved".
    await expect(
      page.locator('[class*="emerald"]').filter({ hasText: /approved/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await cleanupIdea(context, ideaId);
  });

  // ── 3. Request Changes on an in_review idea ────────────────────────────────

  test("request changes: in_review idea → status moves to changes_requested", async ({
    page,
    context,
  }) => {
    await loginViaAPI(context, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);
    const projectId = await resolveProjectId(context);

    const { id: ideaId } = await createIdea(context, projectId);
    await driveTransitions(context, ideaId, ["in_review"]);

    await page.goto(`/studio/ideas/${ideaId}`);
    await page.waitForLoadState("networkidle");

    const changesBtn = page
      .locator('button')
      .filter({ hasText: /request.?changes|changes.?requested/i })
      .first();

    await expect(changesBtn).toBeVisible({ timeout: 10_000 });
    await changesBtn.click();

    // The status displayed on the page should include "changes" somewhere.
    await expect(
      page
        .locator('[class*="orange"]')
        .filter({ hasText: /changes/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    await cleanupIdea(context, ideaId);
  });

  // ── 4. Published idea appears in the Ideas Bank list ──────────────────────

  test("published idea seeded via API appears in the ideas list", async ({
    page,
    context,
  }) => {
    await loginViaAPI(context, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);
    const projectId = await resolveProjectId(context);

    const topic = `Published test idea ${Date.now()}`;
    const { id: ideaId } = await createIdea(context, projectId, { topic });
    await driveTransitions(context, ideaId, [
      "in_review",
      "approved",
      "in_production",
      "published",
    ]);

    // Navigate to Ideas Bank and search for the topic.
    await page.goto("/studio/ideas");
    await page.waitForLoadState("networkidle");

    // Search for the idea so it's visible even in a long list.
    const searchInput = page.locator('[data-testid="input-ideas-search"]');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill(topic.slice(0, 30));
    await page.waitForTimeout(600); // debounce

    await expect(page.locator(`[data-testid="card-idea-${ideaId}"]`)).toBeVisible({
      timeout: 8_000,
    });

    // Status badge must show "published".
    await expect(
      page.locator(`[data-testid="badge-status-${ideaId}"]`),
    ).toContainText(/published/i);

    await cleanupIdea(context, ideaId);
  });
});
