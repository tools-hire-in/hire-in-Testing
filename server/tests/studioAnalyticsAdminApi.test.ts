/**
 * Studio Analytics & Admin API — Access Control + Contract Tests
 *
 * Tests:
 *  - 401 for unauthenticated requests on every studio endpoint
 *  - 403 for roles that lack the required permission
 *  - 2xx (not 403) for roles that have access
 *  - Response shape assertions where the endpoint returns real data (shape,
 *    not values)
 *
 * Uses the same RBAC mini-app pattern as rbac.test.ts: a small Express app
 * with the real `requireAuth` + `requirePermission` middleware but with a
 * fake session injected, so tests run without standing up the full server.
 * Route handlers are stubs that return fixture payloads — we are testing the
 * permission layer and the documented response contract, not the DB query.
 *
 * Run:
 *   npx tsx --test server/tests/studioAnalyticsAdminApi.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";

import { requireAuth, requirePermission } from "../auth.js";

// ── Fake session helper ───────────────────────────────────────────────────────

function withSession(userId: string, role: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { userId, role };
    next();
  };
}

const FAKE_ID = "00000000-0000-0000-0000-000000000001";

// ── Fixture payloads (document the expected contract) ────────────────────────

const ANALYTICS_FIXTURE = {
  range: { dateFrom: null, dateTo: null },
  workflow: {
    publishedCount: 0,
    medianDraftToPublishDays: null,
    slaRatePct: null,
    slaSampleSize: 0,
    marketingRejectionRatePct: null,
    marketingDecisionCount: 0,
  },
  audience: { views: 0, ctaClicks: 0, ctaRatePct: null, reactionsByType: [], totalReactions: 0 },
  topArticles: [],
  authorLeaderboard: [],
  categoryBreakdown: [],
  subscribers: { confirmed: 0, newThisMonth: 0 },
};

const SPEND_FIXTURE = {
  monthly: [],
  byModel: [],
  byKind: [],
  topArticles: [],
  byUser: [],
  dailySeries: [],
};

const ARTICLES_FIXTURE = { items: [], total: 0 };

// ── Build a mini Express app with real auth middleware + stub handlers ────────

function buildApp(userId: string, role: string) {
  const app = express();
  app.use(express.json());
  app.use(withSession(userId, role));

  // Analytics
  app.get(
    "/api/admin/studio/analytics",
    requireAuth,
    requirePermission("studio.view_analytics", "marketing_manager"),
    (_req: Request, res: Response) => res.json(ANALYTICS_FIXTURE),
  );

  // Attribution
  app.get(
    "/api/studio/analytics/attribution",
    requireAuth,
    requirePermission("studio.view_analytics", "marketing_manager"),
    (_req: Request, res: Response) => res.json([]),
  );

  // Spend summary — super_admin only
  app.get(
    "/api/admin/studio/spend/summary",
    requireAuth,
    requirePermission("studio.spend_dashboard"),
    (_req: Request, res: Response) => res.json(SPEND_FIXTURE),
  );

  // Authors list — studio.view (NOT studio.manage_authors; manage_authors is only for writes)
  app.get(
    "/api/admin/studio/authors",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    (_req: Request, res: Response) => res.json([]),
  );

  // Create author from employee
  app.post(
    "/api/admin/studio/authors/from-employee",
    requireAuth,
    requirePermission("studio.manage_authors"),
    (_req: Request, res: Response) => res.status(201).json({ id: "author-1", displayName: "Test Author" }),
  );

  // Merge author
  app.post(
    "/api/admin/studio/authors/:id/merge",
    requireAuth,
    requirePermission("studio.manage_authors"),
    (_req: Request, res: Response) => res.json({ ok: true }),
  );

  // Studio access — list
  app.get(
    "/api/admin/studio/access",
    requireAuth,
    requirePermission("studio.manage_authors"),
    (_req: Request, res: Response) => res.json([]),
  );

  // Studio access — grant
  app.post(
    "/api/admin/studio/access",
    requireAuth,
    requirePermission("studio.manage_authors"),
    (req: Request, res: Response) => {
      const { addOn } = req.body ?? {};
      const VALID = ["marketing_manager", "content_creator", "influencer"];
      if (!addOn || !VALID.includes(addOn)) {
        return res.status(400).json({ error: "Invalid addOn value" });
      }
      res.json({ ok: true, studioAddOn: addOn });
    },
  );

  // Studio access — revoke
  app.delete(
    "/api/admin/studio/access/:userId",
    requireAuth,
    requirePermission("studio.manage_authors"),
    (_req: Request, res: Response) => res.json({ ok: true }),
  );

  // Subscribers list
  app.get(
    "/api/admin/studio/subscribers",
    requireAuth,
    requirePermission("studio.manage_settings"),
    (_req: Request, res: Response) =>
      res.json({ items: [], counts: { active: 0, unsubscribed: 0, suppressed: 0, total: 0 } }),
  );

  // Subscribers export
  app.get(
    "/api/admin/studio/subscribers/export",
    requireAuth,
    requirePermission("studio.manage_settings"),
    (_req: Request, res: Response) => {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send("email,status,subscribed_at\n");
    },
  );

  // Articles list
  app.get(
    "/api/admin/studio/articles",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    (_req: Request, res: Response) => res.json(ARTICLES_FIXTURE),
  );

  // Inbox — requireAuth only (no permission gate on the real route)
  app.get(
    "/api/admin/studio/inbox",
    requireAuth,
    (_req: Request, res: Response) => res.json([]),
  );

  return app;
}

// ── Unauthenticated app ───────────────────────────────────────────────────────

function buildAnonApp() {
  const app = express();
  app.use(express.json());
  // No session injection — req.session.userId will be undefined

  app.get(
    "/api/admin/studio/analytics",
    (req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = {};
      next();
    },
    requireAuth,
    (_req: Request, res: Response) => res.json(ANALYTICS_FIXTURE),
  );

  app.get(
    "/api/admin/studio/spend/summary",
    (req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = {};
      next();
    },
    requireAuth,
    (_req: Request, res: Response) => res.json(SPEND_FIXTURE),
  );

  app.post(
    "/api/admin/studio/access",
    (req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = {};
      next();
    },
    requireAuth,
    (_req: Request, res: Response) => res.json({ ok: true }),
  );

  return app;
}

const superAdmin    = buildApp(FAKE_ID, "super_admin");
const admin         = buildApp(FAKE_ID, "admin");
const manager       = buildApp(FAKE_ID, "manager");
const employee      = buildApp(FAKE_ID, "employee");
const contentEditor = buildApp(FAKE_ID, "content_editor");
const reviewer      = buildApp(FAKE_ID, "reviewer");
const anon          = buildAnonApp();

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — Analytics
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/studio/analytics — studio.view_analytics gate", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(anon).get("/api/admin/studio/analytics");
    assert.equal(res.status, 401);
  });

  it("returns 403 for employee role", async () => {
    const res = await request(employee).get("/api/admin/studio/analytics");
    assert.equal(res.status, 403);
  });

  it("returns 403 for manager role", async () => {
    const res = await request(manager).get("/api/admin/studio/analytics");
    assert.equal(res.status, 403);
  });

  it("returns 200 for admin role with expected shape", async () => {
    const res = await request(admin).get("/api/admin/studio/analytics");
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    const body = res.body;
    assert.ok("workflow" in body, "response must have workflow key");
    assert.ok("publishedCount" in body.workflow, "workflow must have publishedCount");
    assert.ok("slaRatePct" in body.workflow, "workflow must have slaRatePct");
    assert.ok("medianDraftToPublishDays" in body.workflow, "workflow must have medianDraftToPublishDays");
    assert.ok("audience" in body, "response must have audience key");
    assert.ok("topArticles" in body, "response must have topArticles key");
    assert.ok("authorLeaderboard" in body, "response must have authorLeaderboard key");
    assert.ok("subscribers" in body, "response must have subscribers key");
  });

  it("returns 200 for super_admin role", async () => {
    const res = await request(superAdmin).get("/api/admin/studio/analytics");
    assert.equal(res.status, 200);
  });
});

describe("GET /api/studio/analytics/attribution — studio.view_analytics gate", () => {
  it("returns 403 for employee role", async () => {
    const res = await request(employee).get("/api/studio/analytics/attribution");
    assert.equal(res.status, 403);
  });

  it("returns 403 for manager role", async () => {
    const res = await request(manager).get("/api/studio/analytics/attribution");
    assert.equal(res.status, 403);
  });

  it("returns 200 with an array for admin role", async () => {
    const res = await request(admin).get("/api/studio/analytics/attribution");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body), "attribution response must be an array");
  });

  it("returns 200 for super_admin role", async () => {
    const res = await request(superAdmin).get("/api/studio/analytics/attribution");
    assert.equal(res.status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — Spend summary (super_admin only)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/studio/spend/summary — studio.spend_dashboard (super_admin only)", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(anon).get("/api/admin/studio/spend/summary");
    assert.equal(res.status, 401);
  });

  it("returns 403 for employee role", async () => {
    const res = await request(employee).get("/api/admin/studio/spend/summary");
    assert.equal(res.status, 403);
  });

  it("returns 403 for manager role", async () => {
    const res = await request(manager).get("/api/admin/studio/spend/summary");
    assert.equal(res.status, 403);
  });

  it("returns 403 for admin role (not super_admin)", async () => {
    const res = await request(admin).get("/api/admin/studio/spend/summary");
    assert.equal(res.status, 403, "admin (not super_admin) must be denied spend dashboard");
  });

  it("returns 200 for super_admin with expected shape", async () => {
    const res = await request(superAdmin).get("/api/admin/studio/spend/summary");
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    const body = res.body;
    assert.ok("monthly" in body, "spend summary must have monthly key");
    assert.ok("byModel" in body, "spend summary must have byModel key");
    assert.ok("byKind" in body, "spend summary must have byKind key");
    assert.ok("dailySeries" in body, "spend summary must have dailySeries key");
    assert.ok(Array.isArray(body.monthly), "monthly must be an array");
    assert.ok(Array.isArray(body.dailySeries), "dailySeries must be an array");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Authors
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/studio/authors — studio.view gate", () => {
  // Real route: requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer")
  // Allowed roles: super_admin, admin, marketing_manager, content_editor, reviewer
  it("returns 403 for employee role", async () => {
    const res = await request(employee).get("/api/admin/studio/authors");
    assert.equal(res.status, 403);
  });

  it("returns 403 for manager role (not in studio.view)", async () => {
    const res = await request(manager).get("/api/admin/studio/authors");
    assert.equal(res.status, 403);
  });

  it("returns 200 with array for admin role", async () => {
    const res = await request(admin).get("/api/admin/studio/authors");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body), "authors response must be an array");
  });

  it("returns 200 for content_editor role (studio.view)", async () => {
    const res = await request(contentEditor).get("/api/admin/studio/authors");
    assert.equal(res.status, 200, "content_editor must have studio.view access to authors list");
    assert.ok(Array.isArray(res.body));
  });

  it("returns 200 for reviewer role (studio.view)", async () => {
    const res = await request(reviewer).get("/api/admin/studio/authors");
    assert.equal(res.status, 200, "reviewer must have studio.view access to authors list");
    assert.ok(Array.isArray(res.body));
  });

  it("returns 200 for super_admin role", async () => {
    const res = await request(superAdmin).get("/api/admin/studio/authors");
    assert.equal(res.status, 200);
  });
});

describe("POST /api/admin/studio/authors/from-employee — studio.manage_authors gate", () => {
  it("returns 403 for employee role", async () => {
    const res = await request(employee)
      .post("/api/admin/studio/authors/from-employee")
      .send({ userId: FAKE_ID });
    assert.equal(res.status, 403);
  });

  it("returns 2xx for admin role", async () => {
    const res = await request(admin)
      .post("/api/admin/studio/authors/from-employee")
      .send({ userId: FAKE_ID });
    assert.ok(res.status >= 200 && res.status < 300, `expected 2xx, got ${res.status}`);
  });
});

describe("POST /api/admin/studio/authors/:id/merge — studio.manage_authors gate", () => {
  it("returns 403 for employee role", async () => {
    const res = await request(employee)
      .post("/api/admin/studio/authors/author-1/merge")
      .send({ targetAuthorId: "author-2" });
    assert.equal(res.status, 403);
  });

  it("returns 200 for super_admin with ok:true", async () => {
    const res = await request(superAdmin)
      .post("/api/admin/studio/authors/author-1/merge")
      .send({ targetAuthorId: "author-2" });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4 — Studio Access
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/studio/access — studio.manage_authors gate", () => {
  it("returns 403 for employee role", async () => {
    const res = await request(employee).get("/api/admin/studio/access");
    assert.equal(res.status, 403);
  });

  it("returns 403 for manager role", async () => {
    const res = await request(manager).get("/api/admin/studio/access");
    assert.equal(res.status, 403);
  });

  it("returns 200 with array for admin role", async () => {
    const res = await request(admin).get("/api/admin/studio/access");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body), "access list response must be an array");
  });
});

describe("POST /api/admin/studio/access — grant access + input validation", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(anon)
      .post("/api/admin/studio/access")
      .send({ userId: FAKE_ID, addOn: "marketing_manager" });
    assert.equal(res.status, 401);
  });

  it("returns 403 for employee role", async () => {
    const res = await request(employee)
      .post("/api/admin/studio/access")
      .send({ userId: FAKE_ID, addOn: "marketing_manager" });
    assert.equal(res.status, 403);
  });

  it("returns 200 for admin granting marketing_manager", async () => {
    const res = await request(admin)
      .post("/api/admin/studio/access")
      .send({ userId: FAKE_ID, addOn: "marketing_manager" });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.studioAddOn, "marketing_manager");
  });

  it("returns 200 for admin granting content_creator", async () => {
    const res = await request(admin)
      .post("/api/admin/studio/access")
      .send({ userId: FAKE_ID, addOn: "content_creator" });
    assert.equal(res.status, 200);
    assert.equal(res.body.studioAddOn, "content_creator");
  });

  it("returns 400 for invalid addOn value", async () => {
    const res = await request(admin)
      .post("/api/admin/studio/access")
      .send({ userId: FAKE_ID, addOn: "not_a_real_addon" });
    assert.equal(res.status, 400, "invalid addOn must return 400");
  });
});

describe("DELETE /api/admin/studio/access/:userId — revoke access", () => {
  it("returns 403 for employee role", async () => {
    const res = await request(employee).delete(`/api/admin/studio/access/${FAKE_ID}`);
    assert.equal(res.status, 403);
  });

  it("returns 200 for admin role", async () => {
    const res = await request(admin).delete(`/api/admin/studio/access/${FAKE_ID}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5 — Subscribers
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/studio/subscribers — studio.manage_settings gate", () => {
  it("returns 403 for employee role", async () => {
    const res = await request(employee).get("/api/admin/studio/subscribers");
    assert.equal(res.status, 403);
  });

  it("returns 403 for manager role", async () => {
    const res = await request(manager).get("/api/admin/studio/subscribers");
    assert.equal(res.status, 403);
  });

  it("returns 200 for admin role with expected shape", async () => {
    const res = await request(admin).get("/api/admin/studio/subscribers");
    assert.equal(res.status, 200);
    const body = res.body;
    assert.ok("items" in body, "response must have items key");
    assert.ok("counts" in body, "response must have counts key");
    assert.ok(Array.isArray(body.items), "items must be an array");
    assert.ok("active" in body.counts, "counts must have active key");
    assert.ok("total" in body.counts, "counts must have total key");
  });
});

describe("GET /api/admin/studio/subscribers/export — CSV export", () => {
  it("returns 403 for employee role", async () => {
    const res = await request(employee).get("/api/admin/studio/subscribers/export");
    assert.equal(res.status, 403);
  });

  it("returns 200 with text/csv content-type for admin role", async () => {
    const res = await request(admin).get("/api/admin/studio/subscribers/export");
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    const ct = res.headers["content-type"] ?? "";
    assert.ok(ct.includes("text/csv"), `expected text/csv content-type, got: ${ct}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6 — Articles list (Live Content data source)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/studio/articles — studio.view gate", () => {
  // Real route: requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer")
  // Allowed: super_admin, admin, marketing_manager, content_editor, reviewer
  it("returns 403 for employee role", async () => {
    const res = await request(employee).get("/api/admin/studio/articles?status=published");
    assert.equal(res.status, 403);
  });

  it("returns 403 for manager role (not in studio.view)", async () => {
    const res = await request(manager).get("/api/admin/studio/articles?status=published");
    assert.equal(res.status, 403);
  });

  it("returns 200 for admin with items + total shape", async () => {
    const res = await request(admin).get("/api/admin/studio/articles?status=published");
    assert.equal(res.status, 200);
    const body = res.body;
    assert.ok("items" in body, "response must have items key");
    assert.ok("total" in body, "response must have total key");
    assert.ok(Array.isArray(body.items), "items must be an array");
  });

  it("returns 200 for content_editor role (studio.view)", async () => {
    const res = await request(contentEditor).get("/api/admin/studio/articles?status=published");
    assert.equal(res.status, 200, "content_editor must pass studio.view gate");
  });

  it("returns 200 for reviewer role (studio.view)", async () => {
    const res = await request(reviewer).get("/api/admin/studio/articles?status=published");
    assert.equal(res.status, 200, "reviewer must pass studio.view gate");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 7 — Inbox
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/studio/inbox — requireAuth only (no permission gate)", () => {
  // Real route: requireAuth only — any authenticated user can query their own inbox.
  // The inbox is personalized: it returns only items assigned to the requesting user.
  it("returns 401 for unauthenticated requests", async () => {
    const anonInbox = (() => {
      const app = express();
      app.use(express.json());
      app.get("/api/admin/studio/inbox",
        (req: Request, _res: Response, next: NextFunction) => { (req as any).session = {}; next(); },
        requireAuth,
        (_req: Request, res: Response) => res.json([]),
      );
      return app;
    })();
    const res = await request(anonInbox).get("/api/admin/studio/inbox");
    assert.equal(res.status, 401);
  });

  it("returns 200 for employee role (auth-only gate — inbox is self-scoped)", async () => {
    const res = await request(employee).get("/api/admin/studio/inbox");
    assert.equal(res.status, 200, "employee must be allowed past the auth-only inbox gate");
    assert.ok(Array.isArray(res.body), "inbox response must be an array");
  });

  it("returns 200 for manager role", async () => {
    const res = await request(manager).get("/api/admin/studio/inbox");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it("returns 200 for admin role with array response", async () => {
    const res = await request(admin).get("/api/admin/studio/inbox");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body), "inbox response must be an array");
  });

  it("returns 200 for super_admin role", async () => {
    const res = await request(superAdmin).get("/api/admin/studio/inbox");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});
