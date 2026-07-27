/**
 * Studio Workflow Fixtures
 *
 * Helpers used by studioWorkflowHybrid.spec.ts and studioWorkflowRegression.spec.ts.
 *
 * `seedArticleInState` drives a fresh article to the requested pipeline state
 * using sequential API calls (super_admin session via BrowserContext cookies).
 * States that are not reachable through the public API (pending_marketing) are
 * set via a direct SQL update using the server DB module — acceptable in test
 * fixtures, never done in application code.
 *
 * `assertArticleState` fetches the article and asserts its status field.
 */

import { type BrowserContext, request as pwRequest } from "@playwright/test";
import { db } from "../../../server/db.js";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Low-level helpers that mirror the ones in fixtures/auth.ts but accept a
// pre-authenticated BrowserContext so no extra login is needed.
// ---------------------------------------------------------------------------

async function apiPost(
  context: BrowserContext,
  baseURL: string,
  path: string,
  data: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const cookies = await context.cookies();
  const apiCtx = await pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
  const res = await apiCtx.post(path, {
    data: data as Record<string, unknown>,
  });
  const body = await res.json().catch(() => ({}));
  await apiCtx.dispose();
  return { status: res.status(), body };
}

async function apiGet(
  context: BrowserContext,
  baseURL: string,
  path: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const cookies = await context.cookies();
  const apiCtx = await pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
  const res = await apiCtx.get(path);
  const body = await res.json().catch(() => ({}));
  await apiCtx.dispose();
  return { status: res.status(), body };
}

// ---------------------------------------------------------------------------
// Direct DB helper — only used for states unreachable via the public API
// (pending_marketing). This is intentional: the API's STUDIO_TRANSITIONS map
// has empty entries for states governed by dedicated decision endpoints, and
// there is no "force-set status" public endpoint. Using raw SQL here mirrors
// the approach in e2e-seed.ts and keeps test setup deterministic.
// ---------------------------------------------------------------------------

async function forceSetArticleStatus(
  articleId: string,
  status: string,
): Promise<void> {
  await db.execute(
    sql`UPDATE studio_articles SET status = ${status}, updated_at = NOW() WHERE id = ${articleId}`,
  );
}

// ---------------------------------------------------------------------------
// Public API: create & drive article to targetState
// ---------------------------------------------------------------------------

type ArticleState =
  | "draft"
  | "in_review"
  | "pending_cm_review"
  | "pending_author"
  | "approved"
  | "pending_marketing"
  | "pending_final_approval"
  | "published"
  | "scheduled"
  | "archived";

/**
 * Creates a fresh studio article and advances it to `targetState` using
 * sequential API calls authenticated as the super_admin passed via `context`.
 *
 * Returns the article id.
 */
export async function seedArticleInState(
  context: BrowserContext,
  baseURL: string,
  projectId: string,
  targetState: ArticleState,
  overrides: { title?: string } = {},
): Promise<string> {
  const title =
    overrides.title ??
    `E2E Workflow Test – ${targetState} – ${Date.now()}`;

  // 1. Create article (starts as draft)
  const { status: createStatus, body: createBody } = await apiPost(
    context,
    baseURL,
    "/api/admin/studio/articles",
    { projectId, title, contentType: "article" },
  );
  if (createStatus !== 200 && createStatus !== 201) {
    throw new Error(
      `seedArticleInState: create failed (${createStatus}): ${JSON.stringify(createBody)}`,
    );
  }
  const articleId = (createBody as any).id as string;
  if (!articleId) throw new Error("seedArticleInState: no article id returned");

  if (targetState === "draft") return articleId;

  // 2. draft → in_review
  const { status: tStatus, body: tBody } = await apiPost(
    context,
    baseURL,
    `/api/admin/studio/articles/${articleId}/transition`,
    { to: "in_review" },
  );
  if (tStatus !== 200) {
    throw new Error(
      `seedArticleInState: transition to in_review failed (${tStatus}): ${JSON.stringify(tBody)}`,
    );
  }
  if (targetState === "in_review") return articleId;

  // 3. in_review → pending_cm_review via review-decision approve
  // super_admin is a privileged reviewer so no active-assignment ownership check fires.
  const { status: rdStatus, body: rdBody } = await apiPost(
    context,
    baseURL,
    `/api/admin/studio/articles/${articleId}/review-decision`,
    { decision: "approve" },
  );
  if (rdStatus !== 200) {
    throw new Error(
      `seedArticleInState: review-decision failed (${rdStatus}): ${JSON.stringify(rdBody)}`,
    );
  }
  if (targetState === "pending_cm_review") return articleId;

  // 4. pending_cm_review → pending_author via cm-decision approve
  const { status: cmStatus, body: cmBody } = await apiPost(
    context,
    baseURL,
    `/api/admin/studio/articles/${articleId}/cm-decision`,
    { decision: "approve" },
  );
  if (cmStatus !== 200) {
    throw new Error(
      `seedArticleInState: cm-decision failed (${cmStatus}): ${JSON.stringify(cmBody)}`,
    );
  }
  if (targetState === "pending_author") return articleId;

  // 5. pending_author → approved via author-decision approve (super_admin = admin proxy)
  const { status: adStatus, body: adBody } = await apiPost(
    context,
    baseURL,
    `/api/admin/studio/articles/${articleId}/author-decision`,
    { decision: "approve" },
  );
  if (adStatus !== 200) {
    throw new Error(
      `seedArticleInState: author-decision failed (${adStatus}): ${JSON.stringify(adBody)}`,
    );
  }
  if (targetState === "approved") return articleId;

  // 6. approved → pending_marketing via direct DB update.
  //    The generic transition endpoint has an empty STUDIO_TRANSITIONS entry for
  //    `approved` (all post-author states use dedicated decision endpoints) and
  //    there is no public force-status endpoint. The marketing-decision route
  //    requires `pending_marketing` or `author_approved`, so we set it directly.
  await forceSetArticleStatus(articleId, "pending_marketing");
  if (targetState === "pending_marketing") return articleId;

  // 7. pending_marketing → pending_final_approval via marketing-decision recommend
  //    super_admin passes requirePermission("studio.marketing_approve") because
  //    requirePermission always prepends super_admin to the allowed set.
  const { status: mdStatus, body: mdBody } = await apiPost(
    context,
    baseURL,
    `/api/admin/studio/articles/${articleId}/marketing-decision`,
    { decision: "recommend" },
  );
  if (mdStatus !== 200) {
    throw new Error(
      `seedArticleInState: marketing-decision failed (${mdStatus}): ${JSON.stringify(mdBody)}`,
    );
  }
  if (targetState === "pending_final_approval") return articleId;

  // 8. pending_final_approval → published or scheduled via final-decision
  if (targetState === "published") {
    const { status: fdStatus, body: fdBody } = await apiPost(
      context,
      baseURL,
      `/api/admin/studio/articles/${articleId}/final-decision`,
      { decision: "publish" },
    );
    if (fdStatus !== 200) {
      throw new Error(
        `seedArticleInState: final-decision(publish) failed (${fdStatus}): ${JSON.stringify(fdBody)}`,
      );
    }
    return articleId;
  }

  if (targetState === "scheduled") {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { status: fdStatus, body: fdBody } = await apiPost(
      context,
      baseURL,
      `/api/admin/studio/articles/${articleId}/final-decision`,
      { decision: "schedule", scheduledAt: future },
    );
    if (fdStatus !== 200) {
      throw new Error(
        `seedArticleInState: final-decision(schedule) failed (${fdStatus}): ${JSON.stringify(fdBody)}`,
      );
    }
    return articleId;
  }

  if (targetState === "archived") {
    // Archive directly from current state (pending_final_approval).
    const { status: archStatus, body: archBody } = await apiPost(
      context,
      baseURL,
      `/api/admin/studio/articles/${articleId}/archive`,
      {},
    );
    if (archStatus !== 200) {
      throw new Error(
        `seedArticleInState: archive failed (${archStatus}): ${JSON.stringify(archBody)}`,
      );
    }
    return articleId;
  }

  throw new Error(`seedArticleInState: unsupported target state "${targetState}"`);
}

/**
 * GET the article and assert its status equals `expectedState`.
 * Throws (fails the test) if status does not match.
 */
export async function assertArticleState(
  context: BrowserContext,
  baseURL: string,
  articleId: string,
  expectedState: string,
): Promise<Record<string, unknown>> {
  const { status, body } = await apiGet(
    context,
    baseURL,
    `/api/admin/studio/articles/${articleId}`,
  );
  if (status !== 200) {
    throw new Error(
      `assertArticleState: GET article failed (${status}): ${JSON.stringify(body)}`,
    );
  }
  const actual = (body as any).status;
  if (actual !== expectedState) {
    throw new Error(
      `assertArticleState: expected status "${expectedState}" but got "${actual}" for article ${articleId}`,
    );
  }
  return body as Record<string, unknown>;
}

async function apiPatch(
  context: BrowserContext,
  baseURL: string,
  path: string,
  data: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const cookies = await context.cookies();
  const apiCtx = await pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
  const res = await apiCtx.patch(path, {
    data: data as Record<string, unknown>,
  });
  const body = await res.json().catch(() => ({}));
  await apiCtx.dispose();
  return { status: res.status(), body };
}

// Re-export the raw helpers for use in spec files.
export { apiPost, apiGet, apiPatch };
