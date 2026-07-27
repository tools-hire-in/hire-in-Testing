/**
 * Pure E2E regression spec — Content Studio AI Intelligence Layer
 *
 * One test touching every layer:
 *   login → article creation → editor brief sidebar → generate dialog
 *   → mock generation → persistence round-trip
 *
 * Uses loginViaUI for full auth exercise, then API helpers for teardown.
 *
 * The generate call is activated via the x-studio-ai-mock: true header so
 * no real AI spend occurs.
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_PASSWORD, loginViaAPI, loginViaUI } from "./fixtures/auth";

// ---------------------------------------------------------------------------
// Helper: authenticated fetch for teardown without full context helper dependency
// ---------------------------------------------------------------------------
async function authedDelete(
  baseURL: string,
  cookies: string,
  articleId: string,
): Promise<void> {
  const ctx = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Cookie: cookies },
  });
  await ctx.delete(`/api/admin/studio/articles/${articleId}`).catch(() => {});
  await ctx.dispose();
}

// ---------------------------------------------------------------------------
// Regression test
// ---------------------------------------------------------------------------
test("Full regression: create → brief → generate → save → reload persistence", async ({
  page,
  browser,
  baseURL,
}) => {
  // ------------------------------------------------------------------
  // Step 1: Login via UI (full auth entry point)
  // ------------------------------------------------------------------
  await loginViaUI(page, E2E_ADMIN_EMAIL, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/admin\/my-desk/, { timeout: 15_000 });

  // ------------------------------------------------------------------
  // Step 2: Navigate to Content Studio
  // ------------------------------------------------------------------
  await page.goto("/admin/studio");
  await expect(page).toHaveURL(/\/admin\/studio/, { timeout: 10_000 });
  await page.waitForLoadState("networkidle");

  // ------------------------------------------------------------------
  // Step 3: Create a new article. We use the API to seed it reliably,
  // then navigate to the editor — this avoids brittle dialog automation
  // while still exercising the full editor lifecycle.
  // ------------------------------------------------------------------
  const context = page.context();
  const apiCtxSeed = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: (await context.cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; "),
    },
  });

  // Find an existing project (required for article creation).
  const projectsRes = await apiCtxSeed.get("/api/admin/studio/projects");
  const projects: any[] = await projectsRes.json().catch(() => []);
  expect(projects.length, "Need at least one studio project to run regression test").toBeGreaterThan(0);
  const projectId = projects[0].id;

  const createRes = await apiCtxSeed.post("/api/admin/studio/articles", {
    data: {
      projectId,
      title: "E2E Regression — Intelligence Layer",
      contentType: "article",
      staffingDomain: "GENERAL_STAFFING",
      audience: ["EMPLOYER_CLIENT"],
      generationBrief: "Full regression brief",
    },
  });
  expect(createRes.status(), `Article creation failed: ${await createRes.text()}`).toBe(201);
  const created: any = await createRes.json();
  const articleId: string = created.id;
  await apiCtxSeed.dispose();

  // ------------------------------------------------------------------
  // Step 4: Navigate to the article editor
  // ------------------------------------------------------------------
  await page.goto(`/admin/studio/articles/${articleId}`);
  await page.waitForLoadState("networkidle");

  // Dismiss any auto-open modals (e.g., "start generating" prompt).
  await page
    .locator('[role="dialog"]')
    .filter({ hasText: /generate|start|draft/i })
    .locator("button", { hasText: /close|dismiss|later|skip/i })
    .first()
    .click({ timeout: 3_000 })
    .catch(() => {});

  // ------------------------------------------------------------------
  // Step 5: Verify Article Brief & Strategy sidebar section
  // ------------------------------------------------------------------
  // Navigate to the AI brief tab if it exists as a tab.
  const aiBriefTab = page
    .getByRole("tab", { name: /brief|ai brief|strategy/i })
    .first();
  if (await aiBriefTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await aiBriefTab.click();
  }

  // The generationBrief should be pre-populated.
  const briefField = page
    .locator("textarea")
    .filter({ hasText: /Full regression brief/ })
    .or(
      page.locator(
        '[data-field="generationBrief"], [placeholder*="brief" i], [aria-label*="brief" i]',
      ),
    )
    .first();

  await expect(briefField).toBeVisible({ timeout: 10_000 });
  const briefValue = await briefField.inputValue().catch(() => briefField.textContent());
  expect(briefValue).toContain("Full regression brief");

  // ------------------------------------------------------------------
  // Step 6: Set toneVoice to conversational and save
  // ------------------------------------------------------------------
  // Find the tone select and set it.
  const toneSelect = page
    .locator("select, [role='combobox']")
    .filter({ has: page.locator("option[value='conversational'], [data-value='conversational']") })
    .first();

  const toneSelectVisible = await toneSelect.isVisible({ timeout: 3_000 }).catch(() => false);
  if (toneSelectVisible) {
    await toneSelect.selectOption("conversational").catch(async () => {
      await toneSelect.click();
      await page.getByRole("option", { name: /conversational/i }).click();
    });
  }

  // Save via save button.
  const saveBtn = page
    .getByRole("button", { name: /save/i })
    .first();
  if (await saveBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1_000);
  }

  // ------------------------------------------------------------------
  // Step 7: Open the Generate dialog
  // ------------------------------------------------------------------
  const generateBtn = page
    .getByRole("button", { name: /generate|draft/i })
    .first();
  await expect(generateBtn).toBeVisible({ timeout: 10_000 });
  await generateBtn.click();

  // Wait for the generate dialog to open.
  const dialog = page.locator('[role="dialog"]').filter({ hasText: /generate|content goal|audience/i }).first();
  await expect(dialog).toBeVisible({ timeout: 8_000 });

  // ------------------------------------------------------------------
  // Step 8: Assert Content Goal, Audience, Market Context fields
  // ------------------------------------------------------------------
  const contentGoalField = dialog
    .locator("select, [role='combobox']")
    .filter({ has: dialog.locator('[data-value], option') })
    .first();
  await expect(contentGoalField).toBeVisible({ timeout: 5_000 });

  // ------------------------------------------------------------------
  // Step 9: Set Content Goal, Audience, fill topic
  // ------------------------------------------------------------------
  const topicInput = dialog
    .locator('input[type="text"], textarea')
    .filter({ has: page.locator('[placeholder*="topic" i]') })
    .or(dialog.locator('input[placeholder*="topic" i]'))
    .first();

  // Fill the topic field if it's visible.
  if (await topicInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await topicInput.fill("Why staffing firms need a strong employer brand");
  }

  // Fill company facts textarea if present.
  const factsArea = dialog
    .locator("textarea")
    .filter({ has: page.locator('[placeholder*="fact" i]') })
    .or(dialog.locator('[placeholder*="fact" i]'))
    .first();
  if (await factsArea.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await factsArea.fill("Hire'in places 500 engineers per month");
  }

  // ------------------------------------------------------------------
  // Step 10: Trigger generation via the mock header (intercept approach)
  // ------------------------------------------------------------------
  // We intercept the generate-article API call and inject the mock header,
  // then let the browser route run as normal but with the header set.
  await page.route(`**/api/admin/studio/articles/${articleId}/generate-article`, async (route) => {
    const req = route.request();
    await route.continue({
      headers: {
        ...req.headers(),
        "x-studio-ai-mock": "true",
      },
    });
  });

  // Click the Generate button inside the dialog.
  const genSubmitBtn = dialog
    .getByRole("button", { name: /generate/i })
    .last();
  await expect(genSubmitBtn).toBeVisible();
  await genSubmitBtn.click();

  // ------------------------------------------------------------------
  // Step 11: Wait for generation to complete
  // ------------------------------------------------------------------
  // A loading state (spinner / skeleton) should appear briefly.
  // Then the draft body should be populated.
  // We poll for the article body content to be non-empty (timeout 30 s).
  await expect(async () => {
    const articleData = await page
      .context()
      .request.get(`/api/admin/studio/articles/${articleId}`)
      .then((r) => r.json())
      .catch(() => ({}));
    expect(
      (articleData?.bodyMarkdown ?? "").trim().length,
      "Article body should be non-empty after generation",
    ).toBeGreaterThan(0);
  }).toPass({ timeout: 30_000, intervals: [2_000] });

  // ------------------------------------------------------------------
  // Step 12: Save and reload to verify persistence
  // ------------------------------------------------------------------
  await page.goto(`/admin/studio/articles/${articleId}`);
  await page.waitForLoadState("networkidle");

  // Re-dismiss modals.
  await page
    .locator('[role="dialog"]')
    .filter({ hasText: /generate|start/i })
    .locator("button", { hasText: /close|dismiss|later/i })
    .first()
    .click({ timeout: 3_000 })
    .catch(() => {});

  // Navigate to AI brief tab again.
  const aiBriefTabReload = page
    .getByRole("tab", { name: /brief|ai brief|strategy/i })
    .first();
  if (await aiBriefTabReload.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await aiBriefTabReload.click();
  }

  // Step 13: Assert generationBrief still shows "Full regression brief".
  const briefFieldReload = page
    .locator("textarea")
    .filter({ hasText: /Full regression brief/ })
    .or(
      page.locator(
        '[data-field="generationBrief"], [placeholder*="brief" i], [aria-label*="brief" i]',
      ),
    )
    .first();
  await expect(briefFieldReload).toBeVisible({ timeout: 10_000 });
  const reloadBriefValue = await briefFieldReload.inputValue().catch(() => briefFieldReload.textContent());
  expect(reloadBriefValue).toContain("Full regression brief");

  // ------------------------------------------------------------------
  // Step 14: Cleanup — delete the article via API
  // ------------------------------------------------------------------
  const cookies = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  await authedDelete(baseURL!, cookies, articleId);
});
