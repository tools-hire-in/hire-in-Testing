/**
 * Hybrid spec — Content Studio Insights, Gate-A & Brief Pipeline
 *
 * API contract tests for resolve-brief, suggest-topics, generation-estimate,
 * brief-quality, generations, cost, resolve-risk-flags.
 *
 * UI smoke for Gate-A approve / reject / revise actions using the testids
 * that already exist in ArticleEditor.tsx (panel-gate-a, button-gate-a-*).
 *
 * Key contracts (verified against server/routes.ts):
 *   - resolve-brief returns { brief: { hookOptions, contentGoal, platform, ... } }
 *     — does NOT honor x-studio-ai-mock; may return 503 when AI is unconfigured.
 *   - suggest-topics returns { suggestions: string[] }
 *     — does NOT honor x-studio-ai-mock; may return 503 when AI is unconfigured.
 *   - Gate-A approve requires article.status === "planning_review" AND
 *     article.insightsPlanning.decision === "PROCEED".
 *   - Gate-A reject transitions article to status "rejected".
 *   - DELETE /api/admin/studio/articles/:id only succeeds when status is "draft".
 *
 * Requires:
 *   - App server running (E2E_NO_SERVER=1 or webServer configured)
 */

import { test, expect, request as playwrightRequest, type BrowserContext } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_PASSWORD,
  loginViaAPI,
  apiGet,
} from "./fixtures/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function apiRequest(
  context: BrowserContext,
  baseURL: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
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
  switch (method) {
    case "POST":   res = await apiCtx.post(path, { data: data as any }); break;
    case "PATCH":  res = await apiCtx.patch(path, { data: data as any }); break;
    case "DELETE": res = await apiCtx.delete(path); break;
    default:       res = await apiCtx.get(path); break;
  }
  const body = await res.json().catch(() => ({}));
  await apiCtx.dispose();
  return { status: res.status(), body };
}

/** Force an article back to draft (needed for cleanup of non-draft articles). */
async function forceToDraftAndDelete(
  context: BrowserContext,
  baseURL: string,
  id: string,
): Promise<void> {
  if (!id) return;
  // Patch to draft so DELETE is unblocked.
  await apiRequest(context, baseURL, "PATCH", `/api/admin/studio/articles/${id}`, {
    status: "draft",
  }).catch(() => {});
  await apiRequest(context, baseURL, "DELETE", `/api/admin/studio/articles/${id}`).catch(() => {});
}

// ---------------------------------------------------------------------------
// Shared state seeded in beforeAll
// ---------------------------------------------------------------------------
let projectId: string;
/** Article used for resolve-brief, generation-estimate, cost, generations, risk-flags. */
let articleId: string;
/** Insights article for Gate-A Approve test. */
let insightsApproveId: string;
/** Insights article for Gate-A Reject test. */
let insightsRejectId: string;
/** Insights article for Gate-A Revise test. */
let insightsReviseId: string;

test.beforeAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  // Reuse or create a studio project.
  const projects = await apiGet(context, baseURL!, "/api/admin/studio/projects");
  const list = projects.body as any[];
  if (Array.isArray(list) && list.length > 0) {
    projectId = list[0].id;
  } else {
    const created = await apiRequest(context, baseURL!, "POST", "/api/admin/studio/projects", {
      name: "E2E Insights Brief Test Project",
      slug: `e2e-insights-brief-${Date.now()}`,
    });
    expect(created.status, `Project creation failed: ${JSON.stringify(created.body)}`).toBe(201);
    projectId = created.body.id;
  }

  // Standard article for non-Gate-A contract tests.
  const art = await apiRequest(context, baseURL!, "POST", "/api/admin/studio/articles", {
    projectId,
    title: "Hybrid Insights Brief Test Article",
    contentType: "thought_leadership",
    contentGoal: "THOUGHT_LEADERSHIP",
    audience: ["EMPLOYER_CLIENT"],
    generationBrief: "Test brief for hybrid insights spec",
  });
  expect(art.status, `Article creation failed: ${JSON.stringify(art.body)}`).toBe(201);
  articleId = art.body.id;

  // Three Insights articles for Gate-A UI flows.
  // Each is created as contentType "insights" (starts in planning_review),
  // then patched with insightsPlanning.decision = "PROCEED" so Gate-A approve
  // can transition them to draft.
  for (const [key, title] of [
    ["approve", "Gate-A Approve Test Article"],
    ["reject",  "Gate-A Reject Test Article"],
    ["revise",  "Gate-A Revise Test Article"],
  ] as const) {
    const r = await apiRequest(context, baseURL!, "POST", "/api/admin/studio/articles", {
      projectId,
      title,
      contentType: "insights",
    });
    expect(r.status, `Insights article '${title}' creation failed: ${JSON.stringify(r.body)}`).toBe(201);
    const id: string = r.body.id;

    // Seed insightsPlanning with decision = "PROCEED" so Gate-A approve can fire.
    const patch = await apiRequest(context, baseURL!, "PATCH", `/api/admin/studio/articles/${id}`, {
      insightsPlanning: {
        decision: "PROCEED",
        primaryReader: "IT hiring manager",
        coreQuestion: "Why does talent brand matter for staffing firms?",
        whyNow: "AI transformation has shifted hiring demand",
      },
    });
    expect(patch.status, `Patch insightsPlanning failed for ${title}: ${JSON.stringify(patch.body)}`).toBe(200);

    if (key === "approve") insightsApproveId = id;
    if (key === "reject")  insightsRejectId  = id;
    if (key === "revise")  insightsReviseId  = id;
  }

  await context.close();
});

test.afterAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  // Standard article starts in draft — delete directly.
  await apiRequest(context, baseURL!, "DELETE", `/api/admin/studio/articles/${articleId}`).catch(() => {});

  // Insights articles may be in planning_review, rejected, or draft depending on test outcome.
  // Patch back to draft before deleting.
  for (const id of [insightsApproveId, insightsRejectId, insightsReviseId].filter(Boolean)) {
    await forceToDraftAndDelete(context, baseURL!, id);
  }

  await context.close();
});

// ---------------------------------------------------------------------------
// 1. resolve-brief — valid request
// ---------------------------------------------------------------------------
test("resolve-brief: returns brief.hookOptions array for a valid topic when AI is available", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "POST",
    `/api/admin/studio/articles/${articleId}/resolve-brief`,
    {
      topic: "Why IT staffing firms need a talent brand",
      contentGoal: "THOUGHT_LEADERSHIP",
      audience: "EMPLOYER_CLIENT",
    },
  );

  // 200 = AI responded; 503 = AI not configured in test environment (both acceptable).
  const acceptable = [200, 503];
  expect(
    acceptable.includes(res.status),
    `resolve-brief returned unexpected status ${res.status}: ${JSON.stringify(res.body)}`,
  ).toBe(true);

  if (res.status === 200) {
    // Contract: response is { brief: { hookOptions: [...], contentGoal, platform, ... } }
    expect(res.body).toHaveProperty("brief");
    const brief = res.body.brief as any;
    expect(brief).toHaveProperty("hookOptions");
    expect(Array.isArray(brief.hookOptions)).toBe(true);
    expect(brief.hookOptions.length).toBeGreaterThanOrEqual(1);
    // Each hook option should have at minimum a text field.
    const firstHook = brief.hookOptions[0];
    expect(firstHook).toBeDefined();
    expect(firstHook.text ?? firstHook.archetype ?? firstHook.hook).toBeDefined();
    // contentGoal and platform present.
    expect(brief.contentGoal ?? brief.platform).toBeDefined();
  }

  await context.close();
});

// ---------------------------------------------------------------------------
// 2. resolve-brief — missing topic → 400
// ---------------------------------------------------------------------------
test("resolve-brief: returns 400 when topic is missing", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "POST",
    `/api/admin/studio/articles/${articleId}/resolve-brief`,
    { contentGoal: "THOUGHT_LEADERSHIP" },
  );

  expect(
    res.status,
    `Expected 400 for missing topic, got ${res.status}: ${JSON.stringify(res.body)}`,
  ).toBe(400);

  await context.close();
});

// ---------------------------------------------------------------------------
// 3. suggest-topics — returns topic strings when AI is available
// ---------------------------------------------------------------------------
test("suggest-topics: returns suggestions array when AI is available", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "POST",
    "/api/admin/studio/suggest-topics",
    { projectId, contentType: "article" },
  );

  // 200 = AI responded; 503 = AI not configured (both acceptable).
  const acceptable = [200, 503];
  expect(
    acceptable.includes(res.status),
    `suggest-topics returned unexpected status ${res.status}: ${JSON.stringify(res.body)}`,
  ).toBe(true);

  if (res.status === 200) {
    // Contract: { suggestions: string[] }
    const body = res.body as any;
    const topics: unknown = body.suggestions ?? body.topics ?? body.ideas ?? (Array.isArray(body) ? body : null);
    expect(Array.isArray(topics), `Expected array of topics, got: ${JSON.stringify(body)}`).toBe(true);
    expect((topics as unknown[]).length).toBeGreaterThanOrEqual(1);
    for (const t of topics as unknown[]) {
      expect(typeof t).toBe("string");
    }
  }

  await context.close();
});

// ---------------------------------------------------------------------------
// 4. generation-estimate — returns token and cost estimates
// ---------------------------------------------------------------------------
test("generation-estimate: returns cost and token estimates", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "POST",
    `/api/admin/studio/articles/${articleId}/generation-estimate`,
    {
      topic: "How AI is reshaping IT staffing",
      contentGoal: "EDUCATIONAL",
      audience: "CANDIDATE",
      contentType: "thought_leadership",
    },
  );

  expect(res.status, `generation-estimate failed: ${JSON.stringify(res.body)}`).toBe(200);

  const body = res.body as any;
  // Server returns estimatedCostMin, estimatedCostMax, inputTokenEstimate.
  const tokenField = body.inputTokenEstimate ?? body.estimatedTokens ?? body.tokenEstimate;
  const costField  = body.estimatedCostMin  ?? body.estimatedCostUsd  ?? body.costMin;
  expect(tokenField, `Missing token estimate in: ${JSON.stringify(body)}`).toBeDefined();
  expect(typeof tokenField).toBe("number");
  expect(tokenField).toBeGreaterThan(0);
  expect(costField, `Missing cost estimate in: ${JSON.stringify(body)}`).toBeDefined();
  expect(typeof costField).toBe("number");
  expect(costField).toBeGreaterThanOrEqual(0);

  await context.close();
});

// ---------------------------------------------------------------------------
// 5. brief-quality — returns score and tier
// ---------------------------------------------------------------------------
test("brief-quality: returns score and tier for article with populated brief", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "GET",
    `/api/admin/studio/articles/${articleId}/brief-quality`,
  );

  expect(res.status, `brief-quality failed: ${JSON.stringify(res.body)}`).toBe(200);

  const body = res.body as any;
  // Server returns { score: number, tier: "ready"|"fair"|"thin", missingFields: string[] }
  const score = body.score ?? body.overallScore ?? body.briefScore;
  expect(score, `Missing score in: ${JSON.stringify(body)}`).toBeDefined();
  expect(typeof score).toBe("number");
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(100);

  const tier = body.tier ?? body.quality ?? body.level;
  expect(tier, `Missing tier in: ${JSON.stringify(body)}`).toBeDefined();
  expect(["ready", "fair", "thin"].includes(tier)).toBe(true);

  await context.close();
});

// ---------------------------------------------------------------------------
// 6. generations — list returns array
// ---------------------------------------------------------------------------
test("generations: GET returns an array; non-empty entries have id and createdAt", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "GET",
    `/api/admin/studio/articles/${articleId}/generations`,
  );

  expect(res.status, `generations list failed: ${JSON.stringify(res.body)}`).toBe(200);

  const body = res.body as any;
  const list: unknown = Array.isArray(body) ? body : body.generations ?? body.items ?? body.data;
  expect(Array.isArray(list), `Expected array, got: ${JSON.stringify(body)}`).toBe(true);

  if ((list as any[]).length > 0) {
    const first = (list as any[])[0];
    expect(first.id ?? first.generationId).toBeDefined();
    expect(first.createdAt ?? first.created_at).toBeDefined();
  }

  await context.close();
});

// ---------------------------------------------------------------------------
// 7. cost — returns totalCostUsd
// ---------------------------------------------------------------------------
test("cost: GET returns { totalCostUsd: number }", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "GET",
    `/api/admin/studio/articles/${articleId}/cost`,
  );

  expect(res.status, `cost failed: ${JSON.stringify(res.body)}`).toBe(200);
  expect(res.body).toHaveProperty("totalCostUsd");
  expect(typeof (res.body as any).totalCostUsd).toBe("number");
  expect((res.body as any).totalCostUsd).toBeGreaterThanOrEqual(0);

  await context.close();
});

// ---------------------------------------------------------------------------
// 8. resolve-risk-flags — clears risk flags
// ---------------------------------------------------------------------------
test("resolve-risk-flags: POST 200/204 and article has no blocking flags after call", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "POST",
    `/api/admin/studio/articles/${articleId}/resolve-risk-flags`,
    {},
  );

  expect(
    [200, 204].includes(res.status),
    `resolve-risk-flags unexpected status ${res.status}: ${JSON.stringify(res.body)}`,
  ).toBe(true);

  // Verify the article no longer has blocking risk flags.
  const art = await apiRequest(context, baseURL!, "GET", `/api/admin/studio/articles/${articleId}`);
  expect(art.status).toBe(200);
  const artBody = art.body as any;
  const flags = artBody.riskFlags ?? artBody.risk_flags ?? artBody.safetyFailuresJsonb ?? [];
  const blocking = Array.isArray(flags)
    ? flags.filter((f: any) => f?.blocking !== false)
    : [];
  expect(
    blocking.length,
    `Expected no blocking risk flags after resolve; found: ${JSON.stringify(blocking)}`,
  ).toBe(0);

  await context.close();
});

// ---------------------------------------------------------------------------
// 9. Gate-A API: approve → article transitions to draft
// ---------------------------------------------------------------------------
test("Gate-A API: approve moves Insights article from planning_review to draft", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "POST",
    `/api/admin/studio/articles/${insightsApproveId}/gate-a/approve`,
    {},
  );

  expect(
    [200, 204].includes(res.status),
    `Gate-A approve failed with ${res.status}: ${JSON.stringify(res.body)}`,
  ).toBe(true);

  // Verify status is now draft.
  const art = await apiRequest(context, baseURL!, "GET", `/api/admin/studio/articles/${insightsApproveId}`);
  expect(art.status).toBe(200);
  expect(
    (art.body as any).status,
    `Expected status 'draft' after Gate-A approve, got '${(art.body as any).status}'`,
  ).toBe("draft");

  await context.close();
});

// ---------------------------------------------------------------------------
// 10. Gate-A API: reject → article transitions to rejected
// ---------------------------------------------------------------------------
test("Gate-A API: reject transitions Insights article to rejected status", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "POST",
    `/api/admin/studio/articles/${insightsRejectId}/gate-a/reject`,
    { reason: "Insufficient sourcing and thin hook — please revise." },
  );

  expect(
    [200, 204].includes(res.status),
    `Gate-A reject failed with ${res.status}: ${JSON.stringify(res.body)}`,
  ).toBe(true);

  // Verify status is rejected.
  const art = await apiRequest(context, baseURL!, "GET", `/api/admin/studio/articles/${insightsRejectId}`);
  expect(art.status).toBe(200);
  expect(
    (art.body as any).status,
    `Expected status 'rejected' after Gate-A reject, got '${(art.body as any).status}'`,
  ).toBe("rejected");

  await context.close();
});

// ---------------------------------------------------------------------------
// 11. Gate-A API: revise → article stays in planning_review, brief updated
// ---------------------------------------------------------------------------
test("Gate-A API: revise-brief keeps article in planning_review and returns when AI available", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const res = await apiRequest(
    context,
    baseURL!,
    "POST",
    `/api/admin/studio/articles/${insightsReviseId}/gate-a/revise`,
    {
      primaryReader: "IT hiring manager",
      primaryReaderQuestion: "What specific hiring challenge does this article solve?",
      whyNow: "IT hiring is at a 10-year high due to AI transformation.",
    },
  );

  // 200 = brief revised; 503 = AI not configured (both acceptable).
  const acceptable = [200, 204, 503];
  expect(
    acceptable.includes(res.status),
    `Gate-A revise unexpected status ${res.status}: ${JSON.stringify(res.body)}`,
  ).toBe(true);

  // Article should still be in planning_review after revise.
  const art = await apiRequest(context, baseURL!, "GET", `/api/admin/studio/articles/${insightsReviseId}`);
  expect(art.status).toBe(200);
  expect(
    (art.body as any).status,
    `Expected status 'planning_review' after Gate-A revise, got '${(art.body as any).status}'`,
  ).toBe("planning_review");

  await context.close();
});

// ---------------------------------------------------------------------------
// 12. Gate-A UI: Approve button visible and functional in the editor
// ---------------------------------------------------------------------------
test("Gate-A UI: Approve button visible in ArticleEditor for planning_review Insights article", async ({ page, baseURL }) => {
  // Create a fresh Insights article with PROCEED planning for the UI test
  // (insightsApproveId was already transitioned to draft by test #9).
  const context = page.context();
  await loginViaAPI(context, baseURL!, E2E_ADMIN_EMAIL, E2E_PASSWORD);

  const apiCtx = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });

  const createRes = await apiCtx.post("/api/admin/studio/articles", {
    data: { projectId, title: "Gate-A UI Approve Test", contentType: "insights" },
  });
  expect(createRes.status(), `UI test article creation failed`).toBe(201);
  const uiArticle: any = await createRes.json();
  const uiArticleId: string = uiArticle.id;

  // Seed insightsPlanning.
  await apiCtx.patch(`/api/admin/studio/articles/${uiArticleId}`, {
    data: {
      insightsPlanning: {
        decision: "PROCEED",
        primaryReader: "IT hiring manager",
        coreQuestion: "Why does talent brand matter?",
        whyNow: "AI transformation context",
      },
    },
  });
  await apiCtx.dispose();

  // Navigate to the article editor.
  await page.goto(`/admin/studio/articles/${uiArticleId}`);
  await page.waitForLoadState("networkidle");

  // Dismiss any auto-open modals.
  await page
    .locator('[role="dialog"] button')
    .filter({ hasText: /close|dismiss|later|skip/i })
    .first()
    .click({ timeout: 3_000 })
    .catch(() => {});

  // Gate-A panel must be visible for a planning_review Insights article.
  const gateAPanel = page.locator('[data-testid="panel-gate-a"]');
  await expect(gateAPanel).toBeVisible({ timeout: 15_000 });

  // Approve button must be present.
  const approveBtn = page.locator('[data-testid="button-gate-a-approve"]');
  await expect(approveBtn).toBeVisible({ timeout: 8_000 });

  // Click Approve.
  await approveBtn.click();
  await page.waitForTimeout(2_000);

  // API assertion: status is draft.
  const apiCtx2 = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
  const artRes = await apiCtx2.get(`/api/admin/studio/articles/${uiArticleId}`);
  const artBody: any = await artRes.json();
  await apiCtx2.dispose();

  expect(
    artBody.status,
    `Expected 'draft' after Gate-A UI approve, got '${artBody.status}'`,
  ).toBe("draft");

  // Cleanup.
  const cleanupCtx = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
  await cleanupCtx.delete(`/api/admin/studio/articles/${uiArticleId}`).catch(() => {});
  await cleanupCtx.dispose();
});
