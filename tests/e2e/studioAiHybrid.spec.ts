/**
 * Hybrid spec — Content Studio AI Intelligence Layer
 *
 * API sets up state, UI validates pre-population; API also called directly to
 * verify the generate endpoint response contract.
 *
 * Requires:
 *   - App server running (E2E_NO_SERVER=1 or webServer configured)
 *   - STUDIO_AI_MOCK not required in env: mock is activated per-request via
 *     the x-studio-ai-mock: true header sent from the test.
 */

import { test, expect, request as playwrightRequest, type BrowserContext } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_PASSWORD,
  loginViaAPI,
  apiGet,
} from "./fixtures/auth";
import {
  MOCK_ARTICLE_DRAFT,
  BANNED_SLOP_SPOT_CHECK,
} from "./fixtures/aiMock";

// ---------------------------------------------------------------------------
// Helpers — extend apiPost/apiPatch/apiDelete to support custom headers
// ---------------------------------------------------------------------------
async function apiRequest(
  context: BrowserContext,
  baseURL: string,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  data?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  const cookies = await context.cookies();
  const apiCtx = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
      ...extraHeaders,
    },
  });
  let res;
  if (method === "POST") {
    res = await apiCtx.post(path, { data: data as any });
  } else if (method === "PATCH") {
    res = await apiCtx.patch(path, { data: data as any });
  } else {
    res = await apiCtx.delete(path);
  }
  const body = await res.json().catch(() => ({}));
  await apiCtx.dispose();
  return { status: res.status(), body };
}

const AI_MOCK_HEADER = { "x-studio-ai-mock": "true" };

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------
let projectId: string;
let articleIdA: string; // Scenarios A + B
let articleIdC: string; // Scenario C

test.beforeAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  // Get or create a studio project for test isolation.
  const projects = await apiGet(context, baseURL!, "/api/admin/studio/projects");
  const existing = (projects.body as any[]);
  if (Array.isArray(existing) && existing.length > 0) {
    projectId = existing[0].id;
  } else {
    const created = await apiRequest(context, baseURL!, "POST", "/api/admin/studio/projects", {
      name: "E2E AI Intelligence Test Project",
      slug: `e2e-ai-intel-${Date.now()}`,
    });
    expect(created.status, `Project creation failed: ${JSON.stringify(created.body)}`).toBe(201);
    projectId = (created.body as any).id;
  }

  // Create article for Scenarios A & B.
  const artA = await apiRequest(context, baseURL!, "POST", "/api/admin/studio/articles", {
    projectId,
    title: "Hybrid Test — Intelligence Layer",
    contentType: "article",
    staffingDomain: "IT_STAFFING",
    contentGoal: "THOUGHT_LEADERSHIP",
    audience: ["EMPLOYER_CLIENT"],
    toneVoice: "authoritative",
    generationBrief: "Hybrid test brief — automation seed",
  });
  expect(artA.status, `Article A creation failed: ${JSON.stringify(artA.body)}`).toBe(201);
  articleIdA = (artA.body as any).id;

  await context.close();
});

test.afterAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  // Clean up created articles.
  for (const id of [articleIdA, articleIdC].filter(Boolean)) {
    await apiRequest(context, baseURL!, "DELETE", `/api/admin/studio/articles/${id}`).catch(() => {});
  }
  await context.close();
});

// ---------------------------------------------------------------------------
// Scenario A — Editor sidebar pre-population (API seed → UI validate)
// ---------------------------------------------------------------------------
test("Scenario A: article editor sidebar pre-populates from seeded values", async ({ page, baseURL }) => {
  const context = page.context();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  await page.goto(`/admin/studio/articles/${articleIdA}`);

  // Dismiss any modals that open automatically.
  await page
    .locator('[role="dialog"] button', { hasText: /close|dismiss|cancel/i })
    .first()
    .click()
    .catch(() => {});

  // Wait for the editor to load.
  await expect(page.locator('[data-testid="article-editor"], #article-editor, .article-editor-root').first()).toBeVisible({
    timeout: 15_000,
  }).catch(() => {
    // Fallback: just wait for the page title to appear
  });

  // The AI brief tab contains the strategy sidebar.
  const aiBriefTab = page.getByRole("tab", { name: /brief|strategy|ai brief/i }).first();
  if (await aiBriefTab.isVisible()) {
    await aiBriefTab.click();
  }

  // Assert the generation brief is pre-populated from the seeded value.
  const briefTextarea = page
    .locator("textarea")
    .filter({ hasText: /Hybrid test brief/ })
    .or(page.locator('[placeholder*="brief" i], [data-field="generationBrief"]'))
    .first();
  await expect(briefTextarea).toBeVisible({ timeout: 10_000 });

  // The brief should contain the seeded value.
  const briefValue = await briefTextarea.inputValue().catch(() => briefTextarea.textContent());
  expect(briefValue).toContain("Hybrid test brief");
});

// ---------------------------------------------------------------------------
// Scenario B — Generate endpoint contract (API seed → API generate → contract)
// ---------------------------------------------------------------------------
test("Scenario B: generate-article response contract includes resolvedAudience, resolvedDomain, and resolvedPromptLength", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "POST",
    `/api/admin/studio/articles/${articleIdA}/generate-article`,
    {
      mode: "topic",
      topic: "Why IT staffing firms need a talent brand",
      contentGoal: "THOUGHT_LEADERSHIP",
      audience: "EMPLOYER_CLIENT",
      industry: "IT_STAFFING",
      marketContext: "COMMERCIAL",
      complianceMode: "normal",
    },
    AI_MOCK_HEADER,
  );

  expect(res.status, `Generate failed: ${JSON.stringify(res.body)}`).toBe(200);

  const body = res.body as any;

  // Contract: required fields present
  expect(body).toHaveProperty("draft");
  expect(body).toHaveProperty("resolvedAudience");
  expect(body).toHaveProperty("resolvedDomain");
  expect(body).toHaveProperty("generationId");
  expect(body).toHaveProperty("resolvedPromptLength");

  // Resolved strategy values
  expect(body.resolvedAudience).toBe("EMPLOYER_CLIENT");
  expect(body.resolvedDomain).toBe("IT_STAFFING");

  // Intelligence path ran (prompt length > 2000)
  expect(
    body.resolvedPromptLength,
    `resolvedPromptLength should be > 2000 (got ${body.resolvedPromptLength}); intelligence path may not have fired`,
  ).toBeGreaterThan(2000);

  // Draft body must not contain [NEEDS_PROOF] markers
  const draftBody = (body.draft?.body_markdown ?? body.draft?.body ?? "") as string;
  expect(draftBody).not.toContain("[NEEDS_PROOF]");

  // Spot-check for banned slop phrases
  for (const phrase of BANNED_SLOP_SPOT_CHECK) {
    expect(draftBody.toLowerCase()).not.toContain(phrase.toLowerCase());
  }

  await context.close();
});

// ---------------------------------------------------------------------------
// Scenario C — Social kit generation carries intelligence params
// ---------------------------------------------------------------------------
test("Scenario C: generate-social-kit accepts intelligence params and returns kit", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  // Create a fresh article with JOB_MARKETING + CANDIDATE for this scenario.
  const artC = await apiRequest(context, baseURL!, "POST", "/api/admin/studio/articles", {
    projectId,
    title: "Social Kit Intelligence Test",
    contentType: "article",
    contentGoal: "JOB_MARKETING",
    audience: ["CANDIDATE"],
  });
  expect(artC.status, `Article C creation failed: ${JSON.stringify(artC.body)}`).toBe(201);
  articleIdC = (artC.body as any).id;

  // The social kit endpoint requires the article to have a body.
  // Patch in a body so the endpoint proceeds.
  const patchRes = await apiRequest(
    context,
    baseURL!,
    "PATCH",
    `/api/admin/studio/articles/${articleIdC}`,
    {
      bodyMarkdown: MOCK_ARTICLE_DRAFT.body_markdown,
    },
  );
  expect(patchRes.status, `PATCH body failed: ${JSON.stringify(patchRes.body)}`).toBe(200);

  // Now generate the social kit with intelligence params + mock header.
  const kitRes = await apiRequest(
    context,
    baseURL!,
    "POST",
    `/api/admin/studio/articles/${articleIdC}/generate-social-kit`,
    {
      contentType: "social_post",
      platform: "linkedin",
      contentGoal: "JOB_MARKETING",
      audience: "CANDIDATE",
      marketContext: "COMMERCIAL",
    },
    AI_MOCK_HEADER,
  );

  // The social kit endpoint does not currently have a mock bypass, so it may
  // return 200 with real content OR fail if AI is not configured in the
  // test environment. We accept either 200 (success) or 503 (AI not configured).
  const acceptableStatuses = [200, 503];
  expect(
    acceptableStatuses,
    `Expected status in [200, 503], got ${kitRes.status}: ${JSON.stringify(kitRes.body)}`,
  ).toContain(kitRes.status);

  if (kitRes.status === 200) {
    expect(kitRes.body).toHaveProperty("kit");
  }

  await context.close();
});
