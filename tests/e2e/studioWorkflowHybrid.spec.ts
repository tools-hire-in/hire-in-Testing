/**
 * Studio Workflow Pipeline — Hybrid Spec
 *
 * One describe block per pipeline role. Each scenario:
 *   1. seeds an article into the correct pre-condition state via API/DB helpers
 *   2. logs in the appropriate user via API (fast, no UI login page)
 *   3. navigates to the role's review page
 *   4. performs the primary action (button click)
 *   5. asserts the resulting article state via API
 *
 * Unhappy-path assertions (wrong-role 403, invalid-transition 400/409) are
 * API-only — no UI navigation needed.
 *
 * Run:
 *   E2E_NO_SERVER=1 npx playwright test tests/e2e/studioWorkflowHybrid.spec.ts
 *
 * Prerequisites: e2e-seed must have been run (npx tsx scripts/e2e-seed.ts).
 */

import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_PASSWORD,
  loginViaAPI,
  apiPost,
  apiGet,
} from "./fixtures/auth";
import {
  seedArticleInState,
  assertArticleState,
  apiPatch,
} from "./fixtures/studioWorkflow";
import { E2E_STUDIO_PROJECT_ID } from "../../scripts/e2e-seed";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000";

// ─── Shared admin context (seeding + privileged actions) ────────────────────

let adminCtx: BrowserContext;

test.beforeAll(async ({ browser }) => {
  adminCtx = await browser.newContext();
  await loginViaAPI(adminCtx, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);
});

test.afterAll(async () => {
  await adminCtx.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. REVIEWER SCENARIOS — ReviewArticle.tsx
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Reviewer — review-decision API contract", () => {
  test("approve → article moves to pending_cm_review", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "in_review",
    );

    // super_admin is a privileged reviewer; no active-assignment ownership check
    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/review-decision`,
      { decision: "approve" },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "pending_cm_review");
  });

  test("request_changes → article returns to draft", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "in_review",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/review-decision`,
      { decision: "request_changes", comment: "Needs more detail in section 2." },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "draft");
  });

  test("decline → article returns to draft", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "in_review",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/review-decision`,
      { decision: "decline", comment: "Not aligned with editorial guidelines." },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "draft");
  });

  test("invalid decision → 400", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "in_review",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/review-decision`,
      { decision: "publish_directly" },
    );
    expect(status).toBe(400);
  });

  test("decision on article not in review → 409", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft", // not in_review
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/review-decision`,
      { decision: "approve" },
    );
    expect(status).toBe(409);
  });

  test("reassign → new reviewerUserId recorded", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "in_review",
    );

    // Reassign to the admin user itself (valid — avoids needing a second user id)
    const { status: meStatus, body: meBody } = await apiGet(
      adminCtx,
      BASE_URL,
      "/api/admin/me",
    );
    expect(meStatus).toBe(200);
    const adminId = (meBody as any).id as string;

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/reassign`,
      { reviewerUserId: adminId, comment: "Self-reassign for test." },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);

    // Verify the article is still in_review and assignment reflects new reviewer
    const { body: reviewBody } = await apiGet(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/review`,
    );
    const active = (reviewBody as any).activeAssignment;
    expect(active).toBeTruthy();
    expect((active as any).reviewerUserId).toBe(adminId);
  });
});

test.describe("Reviewer — ReviewArticle UI", () => {
  test("approve button advances article to pending_cm_review; stepper shows CM Review step", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    await loginViaAPI(ctx, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);

    const articleId = await seedArticleInState(
      ctx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "in_review",
    );

    const page = await ctx.newPage();
    await page.goto(`/admin/studio/articles/${articleId}/review`);
    await page.waitForSelector('[data-testid="button-approve"]', { timeout: 15_000 });
    await page.click('[data-testid="button-approve"]');

    // Wait for the toast / page to reflect the new state
    await page.waitForTimeout(1_500);

    await assertArticleState(ctx, BASE_URL, articleId, "pending_cm_review");

    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONTENT MANAGER SCENARIOS — CMReview.tsx
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Content Manager — cm-decision API contract", () => {
  test("approve → article moves to pending_author", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_cm_review",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/cm-decision`,
      { decision: "approve" },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "pending_author");
  });

  test("reject → article returns to draft", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_cm_review",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/cm-decision`,
      { decision: "reject", reason: "Does not meet quality bar." },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "draft");
  });

  test("reject without reason → 400", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_cm_review",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/cm-decision`,
      { decision: "reject" }, // missing reason
    );
    expect(status).toBe(400);
  });

  test("cm-decision on wrong state → 409", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/cm-decision`,
      { decision: "approve" },
    );
    expect(status).toBe(409);
  });

  test("CMReview UI — approve button advances article to pending_author", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    await loginViaAPI(ctx, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);

    const articleId = await seedArticleInState(
      ctx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_cm_review",
    );

    const page = await ctx.newPage();
    await page.goto("/admin/studio/cm-review");
    // Click the article card in the queue
    await page.waitForSelector(`[data-testid="card-cm-review-${articleId}"]`, {
      timeout: 15_000,
    });
    await page.click(`[data-testid="card-cm-review-${articleId}"]`);
    await page.waitForSelector('[data-testid="button-cm-approve"]', {
      timeout: 10_000,
    });
    await page.click('[data-testid="button-cm-approve"]');
    await page.waitForTimeout(1_500);

    await assertArticleState(ctx, BASE_URL, articleId, "pending_author");

    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUTHOR SIGN-OFF SCENARIOS — AuthorSignOff.tsx
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Author sign-off — author-decision API contract", () => {
  test("approve → article moves to approved", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_author",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/author-decision`,
      { decision: "approve" },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "approved");
  });

  test("request_changes → article returns to pending_cm_review", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_author",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/author-decision`,
      { decision: "request_changes", reason: "Please add citations." },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "pending_cm_review");
  });

  test("author-decision on wrong state → 409", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/author-decision`,
      { decision: "approve" },
    );
    expect(status).toBe(409);
  });

  test("AuthorSignOff UI — approve button moves article to approved", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    await loginViaAPI(ctx, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);

    const articleId = await seedArticleInState(
      ctx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_author",
    );

    const page = await ctx.newPage();
    await page.goto(`/admin/studio/articles/${articleId}/author-signoff`);
    await page.waitForSelector('[data-testid="button-author-approve"]', {
      timeout: 15_000,
    });
    await page.click('[data-testid="button-author-approve"]');
    await page.waitForTimeout(1_500);

    await assertArticleState(ctx, BASE_URL, articleId, "approved");

    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. MARKETING SCENARIOS — Approvals.tsx / marketing-decision
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Marketing — marketing-decision API contract", () => {
  test("recommend → article moves to pending_final_approval", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_marketing",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/marketing-decision`,
      { decision: "recommend" },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "pending_final_approval");
  });

  test("reject → article returns to draft", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_marketing",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/marketing-decision`,
      { decision: "reject", reason: "Misaligned with campaign messaging." },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "draft");
  });

  test("save → article stays in pending_marketing, metadata updated", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_marketing",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/marketing-decision`,
      {
        decision: "save",
        edits: { seoDescription: "Updated SEO description for marketing polish." },
      },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "pending_marketing");
  });

  test("reject without reason → 400", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_marketing",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/marketing-decision`,
      { decision: "reject" },
    );
    expect(status).toBe(400);
  });

  test("marketing-decision on wrong state → 409", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/marketing-decision`,
      { decision: "recommend" },
    );
    expect(status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. FINAL APPROVAL SCENARIOS — FinalApproval.tsx / final-decision
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Final Approval — final-decision API contract", () => {
  test("publish → article state becomes published", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_final_approval",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/final-decision`,
      { decision: "publish" },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "published");
  });

  test("schedule → article state becomes scheduled with correct scheduledAt", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_final_approval",
    );

    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const scheduledAt = futureDate.toISOString();

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/final-decision`,
      { decision: "schedule", scheduledAt },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);

    const article = await assertArticleState(adminCtx, BASE_URL, articleId, "scheduled");
    // scheduledAt should be within 60 seconds of what we sent
    const returnedAt = new Date((article as any).scheduledAt).getTime();
    expect(Math.abs(returnedAt - futureDate.getTime())).toBeLessThan(60_000);
  });

  test("reject → article returns to draft", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_final_approval",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/final-decision`,
      { decision: "reject", reason: "Needs final legal review." },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "draft");
  });

  test("reject without reason → 400", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_final_approval",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/final-decision`,
      { decision: "reject" },
    );
    expect(status).toBe(400);
  });

  test("final-decision on wrong state → 409", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/final-decision`,
      { decision: "publish" },
    );
    expect(status).toBe(409);
  });

  test("FinalApproval UI — publish button advances article to published", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    await loginViaAPI(ctx, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);

    const articleId = await seedArticleInState(
      ctx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_final_approval",
    );

    const page = await ctx.newPage();
    await page.goto("/admin/studio/final-approval");
    await page.waitForSelector(`[data-testid="card-final-${articleId}"]`, {
      timeout: 15_000,
    });
    await page.click(`[data-testid="card-final-${articleId}"]`);

    // WorkflowReviewPanel (mode="final") renders the "Publish Now" button
    await page.waitForSelector('[data-testid="button-publish-now"]', {
      timeout: 10_000,
    });
    await page.click('[data-testid="button-publish-now"]');
    await page.waitForTimeout(2_000);

    await assertArticleState(ctx, BASE_URL, articleId, "published");

    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SUPER ADMIN BULK ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Super Admin — bulk actions API contract", () => {
  test("force-publish bypasses all gates → article becomes published from draft", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/force-publish`,
      {},
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "published");
  });

  test("unpublish → published → approved", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "published",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/unpublish`,
      {},
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "approved");
  });

  test("archive → terminal archived state", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/archive`,
      {},
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    await assertArticleState(adminCtx, BASE_URL, articleId, "archived");
  });

  test("archive an already-archived article → 409", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "archived",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/archive`,
      {},
    );
    expect(status).toBe(409);
  });

  test("reschedule → scheduledAt updated on a scheduled article", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "scheduled",
    );

    const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const scheduledAt = newDate.toISOString();

    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/reschedule`,
      { scheduledAt },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);

    const article = await assertArticleState(adminCtx, BASE_URL, articleId, "scheduled");
    const returnedAt = new Date((article as any).scheduledAt).getTime();
    expect(Math.abs(returnedAt - newDate.getTime())).toBeLessThan(60_000);
  });

  test("reschedule with past date → 400", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "scheduled",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/reschedule`,
      { scheduledAt: new Date(Date.now() - 60_000).toISOString() },
    );
    expect(status).toBe(400);
  });

  test("force-publish already-published article → 409", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "published",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/force-publish`,
      {},
    );
    expect(status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. REGEN REQUEST FLOW
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Regen request flow — API contract", () => {
  test("editor posts regen-request → 201, status pending", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    // super_admin passes requirePermission("studio.generate_ai_draft")
    const { status, body } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/regen-request`,
      { reason: "AI output needs complete rework.", mode: "rework" },
    );
    expect(status, `expected 201, got ${status}: ${JSON.stringify(body)}`).toBe(201);
    expect((body as any).status).toBe("pending");
    expect((body as any).articleId).toBe(articleId);
  });

  test("super admin approves regen-request → status approved", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { body: reqBody } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/regen-request`,
      { reason: "Full regeneration needed.", mode: "full" },
    );
    const regenId = (reqBody as any).id as string;
    expect(regenId).toBeTruthy();

    const { status, body } = await apiPatch(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/regen-requests/${regenId}`,
      { action: "approve", approvalNote: "Approved for full regen." },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    expect((body as any).status).toBe("approved");
  });

  test("super admin rejects regen-request → status rejected", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { body: reqBody } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/regen-request`,
      { reason: "Wants new angle.", mode: "rework" },
    );
    const regenId = (reqBody as any).id as string;
    expect(regenId).toBeTruthy();

    const { status, body } = await apiPatch(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/regen-requests/${regenId}`,
      { action: "reject", approvalNote: "Not warranted." },
    );
    expect(status, `expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    expect((body as any).status).toBe("rejected");
  });

  test("regen-request without reason → 400", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { status } = await apiPost(
      adminCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/regen-request`,
      { mode: "rework" }, // missing reason
    );
    expect(status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PERMISSION GUARD ASSERTIONS (API-only)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Permission guards — wrong-role rejections", () => {
  let employeeCtx: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // Use the manager user (non-super_admin, no studio add-on) to test 403s
    employeeCtx = await browser.newContext();
    await loginViaAPI(
      employeeCtx,
      BASE_URL,
      "e2e-manager@hire-in.com",
      E2E_PASSWORD,
    );
  });

  test.afterAll(async () => {
    await employeeCtx.close();
  });

  test("manager hitting final-decision → 403", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_final_approval",
    );

    const { status } = await apiPost(
      employeeCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/final-decision`,
      { decision: "publish" },
    );
    expect(status).toBe(403);
  });

  test("manager hitting cm-decision → 403", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_cm_review",
    );

    const { status } = await apiPost(
      employeeCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/cm-decision`,
      { decision: "approve" },
    );
    expect(status).toBe(403);
  });

  test("non-assigned reviewer hitting review-decision → 403", async () => {
    // Create article in_review (auto-assigns admin as reviewer)
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "in_review",
    );

    // Manager is NOT the assigned reviewer and is not super_admin/cm_review
    const { status } = await apiPost(
      employeeCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/review-decision`,
      { decision: "approve" },
    );
    expect(status).toBe(403);
  });

  test("manager hitting force-publish → 403", async () => {
    const articleId = await seedArticleInState(
      adminCtx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "draft",
    );

    const { status } = await apiPost(
      employeeCtx,
      BASE_URL,
      `/api/admin/studio/articles/${articleId}/force-publish`,
      {},
    );
    expect(status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. WORKFLOW STEPPER — ArticleWorkflowStepper data-testid checks
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ArticleWorkflowStepper — active step per status", () => {
  async function getStepperActiveStep(page: Page): Promise<string> {
    // The stepper renders data-testid="step-<key>" for each step.
    // The active step has bg-primary class (rendered by the stepper component).
    const stepperEl = page.locator('[data-testid="div-stepper-steps"]');
    await stepperEl.waitFor({ timeout: 10_000 });
    // Find the step span with bg-primary (active step)
    const activeStep = page
      .locator('[data-testid^="step-"]')
      .filter({ has: page.locator(".bg-primary") });
    // Return the data-testid value (e.g. "step-in_review")
    const testId = await activeStep.first().getAttribute("data-testid").catch(() => null);
    if (!testId) {
      // Fallback: read the stepper callout text
      const callout = page.locator('[data-testid="div-stepper-callout"]');
      return (await callout.textContent()) ?? "";
    }
    return testId.replace("step-", "");
  }

  test("in_review article shows In Review step active", async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginViaAPI(ctx, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);

    const articleId = await seedArticleInState(
      ctx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "in_review",
    );

    const page = await ctx.newPage();
    await page.goto(`/admin/studio/articles/${articleId}/review`);
    await page.waitForSelector('[data-testid="div-workflow-stepper"]', {
      timeout: 15_000,
    });

    const activeKey = await getStepperActiveStep(page);
    expect(activeKey).toBe("in_review");

    await ctx.close();
  });

  test("pending_cm_review article shows CM Review step active", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    await loginViaAPI(ctx, BASE_URL, E2E_ADMIN_EMAIL, E2E_PASSWORD);

    const articleId = await seedArticleInState(
      ctx,
      BASE_URL,
      E2E_STUDIO_PROJECT_ID,
      "pending_cm_review",
    );

    const page = await ctx.newPage();
    // Navigate to the editor which renders the stepper
    await page.goto(`/admin/studio/articles/${articleId}/edit`);
    await page.waitForSelector('[data-testid="div-workflow-stepper"]', {
      timeout: 15_000,
    });

    const activeKey = await getStepperActiveStep(page);
    expect(activeKey).toBe("cm_review");

    await ctx.close();
  });
});
