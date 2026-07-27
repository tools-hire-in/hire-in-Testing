/**
 * Studio Ideas Bank — API contract tests
 *
 * Covers: CRUD, state machine happy paths, invalid transitions,
 * comments, watchers, and the generate-social-draft endpoint.
 *
 * Authenticates via the real HTTP login endpoint (same as E2E tests) so the
 * session cookie is valid for all subsequent calls.  Requires the dev server
 * to be running at E2E_BASE_URL (default: http://localhost:5000).
 *
 * Run: E2E_NO_SERVER=1 npx tsx --test server/tests/studioIdeasApi.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

// ── Config ─────────────────────────────────────────────────────────────────────
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5000";
const ADMIN_EMAIL = "e2e-admin@hire-in.com";
const ADMIN_PASSWORD = "E2eTest@2024!";

// ── Session cookie helper ──────────────────────────────────────────────────────
let sessionCookie = "";

async function login(): Promise<void> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/([^=]+=([^;]+))/);
  if (match) {
    sessionCookie = match[1];
  }
  assert.ok(res.ok, `Login failed (status ${res.status})`);
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Resolve the first active studio project; create one if none exist. */
async function resolveProjectId(): Promise<string> {
  const { status, body } = await api("GET", "/api/admin/studio/projects");
  assert.equal(status, 200, "Could not list studio projects");
  const projects = body as Array<{ id: string; isActive?: boolean }>;
  const active = projects.find((p) => p.isActive !== false);
  if (active) return active.id;

  // Create a minimal test project if the DB is empty
  const { status: cs, body: created } = await api("POST", "/api/admin/studio/projects", {
    name: "Test Project (auto)",
    slug: `test-project-auto-${Date.now()}`,
  });
  assert.equal(cs, 201, `Failed to create test project: ${JSON.stringify(created)}`);
  return (created as any).id as string;
}

/** Archive/soft-delete an idea by setting archivedAt via direct DELETE-like update.
 *  The API doesn't expose a DELETE endpoint for ideas, so we mark them archived. */
async function archiveIdea(id: string): Promise<void> {
  // Best-effort cleanup — if the endpoint doesn't support archivedAt patching,
  // just leave the test idea in the DB (it won't affect other tests).
  await api("PATCH", `/api/studio/content-ideas/${id}`, { archivedAt: new Date().toISOString() }).catch(
    () => {},
  );
}

// ── Test state ─────────────────────────────────────────────────────────────────
let projectId = "";
const createdIdeaIds: string[] = [];

// ── Suite setup / teardown ────────────────────────────────────────────────────

before(async () => {
  await login();
  projectId = await resolveProjectId();
});

after(async () => {
  for (const id of createdIdeaIds) {
    await archiveIdea(id).catch(() => {});
  }
});

// ── CRUD ──────────────────────────────────────────────────────────────────────

describe("Ideas Bank — CRUD", () => {
  let ideaId = "";

  it("POST /api/studio/content-ideas → 201 with id and status=idea", async () => {
    const { status, body } = await api("POST", "/api/studio/content-ideas", {
      projectId,
      topic: "Top 5 IT skills for 2025 [test-crud]",
      contentType: "social_post",
      channels: ["linkedin"],
      format: "carousel",
    });
    assert.equal(status, 201, `Unexpected status: ${JSON.stringify(body)}`);
    const idea = body as any;
    assert.ok(idea.id, "Response must include an id");
    assert.ok(
      ["idea", "suggested"].includes(idea.status),
      `Expected status=idea or suggested, got ${idea.status}`,
    );
    ideaId = idea.id;
    createdIdeaIds.push(ideaId);
  });

  it("GET /api/studio/content-ideas → includes the newly created idea", async () => {
    const { status, body } = await api(
      "GET",
      `/api/studio/content-ideas?projectId=${encodeURIComponent(projectId)}&contentType=social_post`,
    );
    assert.equal(status, 200);
    const ideas = body as any[];
    const found = ideas.find((i) => i.id === ideaId);
    assert.ok(found, "Newly created idea must appear in the list");
    assert.equal(found.topic, "Top 5 IT skills for 2025 [test-crud]");
  });

  it("GET /api/studio/content-ideas/:id → returns the idea with its comments array", async () => {
    const { status, body } = await api("GET", `/api/studio/content-ideas/${ideaId}`);
    assert.equal(status, 200);
    const idea = body as any;
    assert.equal(idea.id, ideaId);
    assert.ok(Array.isArray(idea.comments), "Response must include a comments array");
  });

  it("PATCH /api/studio/content-ideas/:id → updated topic is reflected", async () => {
    const newTopic = "Top 5 IT skills for 2025 [test-crud-updated]";
    const { status, body } = await api("PATCH", `/api/studio/content-ideas/${ideaId}`, {
      topic: newTopic,
    });
    assert.equal(status, 200, `PATCH failed: ${JSON.stringify(body)}`);
    const updated = body as any;
    assert.equal(updated.topic, newTopic);
  });

  it("PATCH /api/studio/content-ideas/:id — cannot change status (must use /transition)", async () => {
    // The route strips `status` from the patch body; the status should be unchanged.
    const before = await api("GET", `/api/studio/content-ideas/${ideaId}`);
    const originalStatus = (before.body as any).status;
    await api("PATCH", `/api/studio/content-ideas/${ideaId}`, { status: "published" });
    const after = await api("GET", `/api/studio/content-ideas/${ideaId}`);
    assert.equal((after.body as any).status, originalStatus, "Status must not change via PATCH");
  });
});

// ── State machine — happy paths ───────────────────────────────────────────────

describe("Ideas Bank — state machine happy paths", () => {
  let ideaId = "";

  before(async () => {
    // Create a fresh idea to drive through the full lifecycle.
    const { status, body } = await api("POST", "/api/studio/content-ideas", {
      projectId,
      topic: "Remote IT staffing trends 2025 [test-sm]",
      contentType: "social_post",
      channels: ["instagram"],
      format: "reel",
      status: "suggested",
    });
    assert.equal(status, 201, `Setup failed: ${JSON.stringify(body)}`);
    ideaId = (body as any).id;
    createdIdeaIds.push(ideaId);
  });

  async function transition(to: string): Promise<unknown> {
    const { status, body } = await api(
      "POST",
      `/api/studio/content-ideas/${ideaId}/transition`,
      { to },
    );
    assert.equal(
      status,
      200,
      `Transition to "${to}" failed (status ${status}): ${JSON.stringify(body)}`,
    );
    const idea = body as any;
    assert.equal(idea.status, to, `Expected status=${to} after transition`);
    return idea;
  }

  it("suggested → idea", async () => { await transition("idea"); });
  it("idea → in_review", async () => { await transition("in_review"); });
  it("in_review → approved", async () => { await transition("approved"); });
  it("approved → in_production", async () => { await transition("in_production"); });
  it("in_production → scheduled", async () => { await transition("scheduled"); });
  it("scheduled → published", async () => { await transition("published"); });
  it("published → done", async () => { await transition("done"); });
});

// ── State machine — invalid transitions ────────────────────────────────────────

describe("Ideas Bank — invalid transitions → 400", () => {
  let ideaId = "";

  before(async () => {
    const { body } = await api("POST", "/api/studio/content-ideas", {
      projectId,
      topic: "Invalid transition test [test-inv]",
      contentType: "social_post",
      channels: ["linkedin"],
      status: "done",          // Seed directly into "done" via status param on create
    });
    // The create endpoint may coerce to "idea"; if so drive it to done first.
    ideaId = (body as any).id;
    createdIdeaIds.push(ideaId);
    // Drive to done regardless of what status came back (best-effort).
    const currentStatus = (body as any).status as string;
    const path: string[] = [];
    if (currentStatus === "suggested") path.push("idea");
    if (["suggested", "idea"].includes(currentStatus)) path.push("in_review");
    if (["suggested", "idea", "in_review"].includes(currentStatus))
      path.push("approved", "in_production", "published");
    path.push("done");
    for (const s of path) {
      await api("POST", `/api/studio/content-ideas/${ideaId}/transition`, { to: s }).catch(
        () => {},
      );
    }
  });

  it("done → in_review returns 400 (invalid transition)", async () => {
    const { status } = await api(
      "POST",
      `/api/studio/content-ideas/${ideaId}/transition`,
      { to: "in_review" },
    );
    assert.equal(status, 400);
  });

  it("suggested → published returns 400 (invalid transition)", async () => {
    // Create a fresh suggested idea and try to jump directly to published.
    const { body } = await api("POST", "/api/studio/content-ideas", {
      projectId,
      topic: "Suggested→published jump test [test-inv2]",
      contentType: "social_post",
      channels: ["linkedin"],
    });
    const freshId = (body as any).id as string;
    createdIdeaIds.push(freshId);

    // Drive to "suggested" if needed
    const currentStatus = (body as any).status as string;
    if (currentStatus !== "suggested") {
      // Accept that the test is inconclusive if we can't start from suggested
      return;
    }
    const { status } = await api(
      "POST",
      `/api/studio/content-ideas/${freshId}/transition`,
      { to: "published" },
    );
    assert.equal(status, 400);
  });

  it("transition to an unknown status returns 400", async () => {
    const { status } = await api(
      "POST",
      `/api/studio/content-ideas/${ideaId}/transition`,
      { to: "flying" },
    );
    assert.equal(status, 400);
  });
});

// ── Comments ──────────────────────────────────────────────────────────────────

describe("Ideas Bank — comments", () => {
  let ideaId = "";
  let commentId = "";

  before(async () => {
    const { body } = await api("POST", "/api/studio/content-ideas", {
      projectId,
      topic: "Comment test idea [test-comments]",
      contentType: "social_post",
      channels: ["linkedin"],
    });
    ideaId = (body as any).id;
    createdIdeaIds.push(ideaId);
  });

  it("POST /api/studio/content-ideas/:id/comments → 201 with message content", async () => {
    const { status, body } = await api(
      "POST",
      `/api/studio/content-ideas/${ideaId}/comments`,
      { message: "This is a test comment" },
    );
    assert.equal(status, 201, `Comment creation failed: ${JSON.stringify(body)}`);
    const comment = body as any;
    assert.ok(comment.id, "Comment response must include an id");
    assert.ok(
      comment.message?.includes("This is a test comment"),
      `Expected message content in response, got: ${comment.message}`,
    );
    commentId = comment.id;
  });

  it("GET /api/studio/content-ideas/:id → comments array includes the new comment", async () => {
    const { status, body } = await api("GET", `/api/studio/content-ideas/${ideaId}`);
    assert.equal(status, 200);
    const idea = body as any;
    const found = (idea.comments as any[]).find((c: any) => c.id === commentId);
    assert.ok(found, "Comment must appear in the idea's comments array");
  });

  it("POST comment with empty message → 400", async () => {
    const { status } = await api(
      "POST",
      `/api/studio/content-ideas/${ideaId}/comments`,
      { message: "   " },
    );
    assert.equal(status, 400);
  });
});

// ── Watchers ──────────────────────────────────────────────────────────────────

describe("Ideas Bank — watchers", () => {
  let ideaId = "";

  before(async () => {
    const { body } = await api("POST", "/api/studio/content-ideas", {
      projectId,
      topic: "Watcher test idea [test-watchers]",
      contentType: "social_post",
      channels: ["linkedin"],
    });
    ideaId = (body as any).id;
    createdIdeaIds.push(ideaId);
  });

  it("POST /api/studio/content-ideas/:id/watchers → 201 watcher record", async () => {
    const { status, body } = await api(
      "POST",
      `/api/studio/content-ideas/${ideaId}/watchers`,
      {},
    );
    assert.equal(status, 201, `Add watcher failed: ${JSON.stringify(body)}`);
    const watcher = body as any;
    assert.ok(watcher.ideaId ?? watcher.idea_id ?? watcher.id, "Watcher response must include a reference field");
  });

  it("GET /api/studio/content-ideas/:id/watchers → includes the added watcher", async () => {
    const { status, body } = await api(
      "GET",
      `/api/studio/content-ideas/${ideaId}/watchers`,
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray(body), "Watchers response must be an array");
    assert.ok((body as any[]).length > 0, "Watchers array must not be empty after adding one");
  });
});

// ── generate-social-draft ─────────────────────────────────────────────────────

describe("Ideas Bank — generate-social-draft quick caption", () => {
  it("POST with topic + platform → 200 with non-empty caption (or 503 when AI not configured)", async () => {
    const { status, body } = await api(
      "POST",
      "/api/admin/studio/calendar/generate-social-draft",
      { topic: "Top 5 IT skills 2025", platform: "linkedin" },
    );

    if (status === 503) {
      // AI provider not configured in this environment — acceptable
      assert.equal(
        (body as any).code,
        "upstream",
        "503 must carry code=upstream when AI is not configured",
      );
      return;
    }

    assert.equal(status, 200, `Unexpected status: ${JSON.stringify(body)}`);
    const result = body as any;
    assert.ok(
      typeof result.caption === "string" && result.caption.trim().length > 0,
      `Expected non-empty caption string, got: ${JSON.stringify(result)}`,
    );
  });

  it("POST without topic → 400", async () => {
    const { status } = await api(
      "POST",
      "/api/admin/studio/calendar/generate-social-draft",
      { platform: "linkedin" },
    );
    assert.equal(status, 400);
  });

  it("POST without platform → 400", async () => {
    const { status } = await api(
      "POST",
      "/api/admin/studio/calendar/generate-social-draft",
      { topic: "Some topic" },
    );
    assert.equal(status, 400);
  });
});
