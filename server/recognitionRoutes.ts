/**
 * Recognition Certificate Routes
 * Routes for the recognition approval pipeline, certificate issuance, and management.
 */
import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  praisePosts, adminUsers, praiseBadgeTypes,
  recognitionCertificates, recognitionCertificateAudit,
  notifications,
} from "@shared/schema";
import { eq, and, desc, inArray, sql, or } from "drizzle-orm";
import {
  issueRecognitionCertificate,
  revokeCertificate,
  correctCertificate,
} from "./services/certificateEngine/index";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const objectStorageService = new ObjectStorageService();

const MANAGER_ROLES = ["super_admin", "admin", "hr", "manager"];
const HR_ADMIN_ROLES = ["super_admin", "admin", "hr"];

function requireAuth(req: Request, res: Response): string | null {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.session.userId;
}

function requireRole(req: Request, res: Response, roles: string[]): boolean {
  if (!req.session?.role || !roles.includes(req.session.role)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

async function createNotification(userId: string, type: string, title: string, message: string, metadata?: Record<string, unknown>) {
  try {
    await db.insert(notifications).values({ userId, type, title, message, metadata: metadata ?? null });
  } catch {}
}

async function enrichPost(post: any): Promise<any> {
  // Raw SQL returns snake_case; accept both to be safe
  const giverId = post.giver_id ?? post.giverId;
  const recipientId = post.recipient_id ?? post.recipientId;
  const badgeTypeId = post.badge_type_id ?? post.badgeTypeId;
  const [giver, recipient, badge] = await Promise.all([
    db.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
      .from(adminUsers).where(eq(adminUsers.id, giverId)).limit(1),
    db.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
      .from(adminUsers).where(eq(adminUsers.id, recipientId)).limit(1),
    db.select({ id: praiseBadgeTypes.id, name: praiseBadgeTypes.name, emoji: praiseBadgeTypes.emoji, color: praiseBadgeTypes.color })
      .from(praiseBadgeTypes).where(eq(praiseBadgeTypes.id, badgeTypeId)).limit(1),
  ]);
  return {
    ...post,
    giverName: giver[0] ? `${giver[0].firstName} ${giver[0].lastName}` : "Unknown",
    recipientName: recipient[0] ? `${recipient[0].firstName} ${recipient[0].lastName}` : "Unknown",
    badgeType: badge[0] ?? null,
  };
}

export function registerRecognitionRoutes(app: Express) {

  // GET /api/manager/recognition/pending — review queue for managers/HR
  app.get("/api/manager/recognition/pending", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!requireRole(req, res, MANAGER_ROLES)) return;

    try {
      const status = (req.query.status as string) || "pending_verification";
      const rows = await db.execute(
        sql`SELECT * FROM praise_posts WHERE certificate_requested = true AND certificate_status = ${status} ORDER BY created_at DESC LIMIT 100`
      );
      const posts = rows.rows as any[];
      const enriched = await Promise.all(posts.map(enrichPost));
      res.json({ posts: enriched });
    } catch (err) {
      console.error("[recognition] GET pending error:", err);
      res.status(500).json({ error: "Failed to fetch recognition queue" });
    }
  });

  // GET /api/manager/recognition/queue — all statuses for review page
  app.get("/api/manager/recognition/queue", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!requireRole(req, res, MANAGER_ROLES)) return;

    try {
      const rows = await db.execute(
        sql`SELECT * FROM praise_posts WHERE certificate_requested = true ORDER BY created_at DESC LIMIT 200`
      );
      const posts = rows.rows as any[];
      const enriched = await Promise.all(posts.map(enrichPost));
      res.json({ posts: enriched });
    } catch (err) {
      console.error("[recognition] GET queue error:", err);
      res.status(500).json({ error: "Failed to fetch recognition queue" });
    }
  });

  // POST /api/manager/recognition/:id/approve
  app.post("/api/manager/recognition/:id/approve", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!requireRole(req, res, MANAGER_ROLES)) return;

    try {
      const postId = req.params.id;
      const { approvedCitation } = req.body;

      if (!approvedCitation?.trim()) {
        return res.status(400).json({ error: "approvedCitation is required" });
      }

      // Fetch post
      const rows = await db.execute(sql`SELECT * FROM praise_posts WHERE id = ${postId} LIMIT 1`);
      const post = rows.rows[0] as any;
      if (!post) return res.status(404).json({ error: "Recognition post not found" });
      if (!post.certificate_requested) return res.status(400).json({ error: "Not a certificate request" });
      if (post.certificate_status !== "pending_verification") {
        return res.status(409).json({ error: `Cannot approve: recognition is already '${post.certificate_status}'` });
      }

      // Issue the certificate atomically (no separate status transition — citation + status change
      // happen inside the engine's transaction so there is no "stranded approved" window)
      const issued = await issueRecognitionCertificate(postId, userId, { approvedCitation: approvedCitation.trim() });

      // Notify giver
      await createNotification(
        post.giver_id,
        "recognition_certificate_issued",
        "🎉 Recognition certificate issued!",
        `The recognition you gave has been approved and a verified certificate has been issued. Cert ID: ${issued.certificateId}`,
        { postId, certificateId: issued.certificateId },
      );

      res.json({ success: true, certificate: issued });
    } catch (err: any) {
      console.error("[recognition] approve error:", err);
      res.status(500).json({ error: err.message || "Failed to approve recognition" });
    }
  });

  // POST /api/manager/recognition/:id/return
  app.post("/api/manager/recognition/:id/return", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!requireRole(req, res, MANAGER_ROLES)) return;

    try {
      const postId = req.params.id;
      const { reason } = req.body;

      await db.execute(
        sql`UPDATE praise_posts SET certificate_status = 'returned' WHERE id = ${postId} AND certificate_requested = true`
      );

      const rows = await db.execute(sql`SELECT giver_id FROM praise_posts WHERE id = ${postId} LIMIT 1`);
      const post = rows.rows[0] as any;
      if (post?.giver_id) {
        await createNotification(
          post.giver_id,
          "recognition_returned",
          "Recognition returned for clarification",
          `Your recognition request has been returned for clarification. ${reason ? `Reason: ${reason}` : ""}`,
          { postId, reason },
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[recognition] return error:", err);
      res.status(500).json({ error: "Failed to return recognition" });
    }
  });

  // POST /api/manager/recognition/:id/reject
  app.post("/api/manager/recognition/:id/reject", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!requireRole(req, res, MANAGER_ROLES)) return;

    try {
      const postId = req.params.id;
      const { reason } = req.body;

      await db.execute(
        sql`UPDATE praise_posts SET certificate_status = 'rejected' WHERE id = ${postId} AND certificate_requested = true`
      );

      const rows = await db.execute(sql`SELECT giver_id FROM praise_posts WHERE id = ${postId} LIMIT 1`);
      const post = rows.rows[0] as any;
      if (post?.giver_id) {
        await createNotification(
          post.giver_id,
          "recognition_rejected",
          "Recognition certificate request rejected",
          `Your recognition certificate request was not approved. ${reason ? `Reason: ${reason}` : ""}`,
          { postId, reason },
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[recognition] reject error:", err);
      res.status(500).json({ error: "Failed to reject recognition" });
    }
  });

  // GET /api/praise/my-certificates — employee's own certificates
  app.get("/api/praise/my-certificates", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const certs = await db
        .select()
        .from(recognitionCertificates)
        .where(eq(recognitionCertificates.recipientId, userId))
        .orderBy(desc(recognitionCertificates.issuedAt));

      if (certs.length === 0) return res.json([]);

      const approverIds = [...new Set(certs.map((c) => c.approverId))];
      const badgeIds = [...new Set(certs.map((c) => c.badgeTypeId))];

      const [approvers, badges] = await Promise.all([
        db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName, designation: adminUsers.designation })
          .from(adminUsers).where(inArray(adminUsers.id, approverIds)),
        db.select().from(praiseBadgeTypes).where(inArray(praiseBadgeTypes.id, badgeIds)),
      ]);

      const approverMap = new Map(approvers.map((a) => [a.id, a]));
      const badgeMap = new Map(badges.map((b) => [b.id, b]));

      res.json(certs.map((c) => {
        const ap = approverMap.get(c.approverId);
        return {
          ...c,
          approverName: ap ? `${ap.firstName} ${ap.lastName}` : "Unknown",
          approverTitle: ap?.designation ?? null,
          badgeType: badgeMap.get(c.badgeTypeId) ?? null,
        };
      }));
    } catch (err) {
      console.error("[recognition] my-certificates error:", err);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });

  // GET /api/growth/certificates/:certId/download — download PDF
  app.get("/api/growth/certificates/:certId/download", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const [cert] = await db.select()
        .from(recognitionCertificates)
        .where(eq(recognitionCertificates.id, req.params.certId))
        .limit(1);

      if (!cert) return res.status(404).json({ error: "Certificate not found" });

      // Allow: recipient, approver, or manager/HR/admin
      const isOwner = cert.recipientId === userId || cert.approverId === userId;
      const isPrivileged = MANAGER_ROLES.includes(req.session?.role ?? "");
      if (!isOwner && !isPrivileged) return res.status(403).json({ error: "Access denied" });

      // Log view/download
      await db.insert(recognitionCertificateAudit).values({
        certificateId: cert.id,
        actorId: userId,
        action: "downloaded",
        metadata: { certId: cert.certificateId },
      }).catch(() => {});

      if (cert.pdfUrl) {
        return res.redirect(cert.pdfUrl);
      }
      res.status(404).json({ error: "PDF not available" });
    } catch (err) {
      res.status(500).json({ error: "Failed to download certificate" });
    }
  });

  // POST /api/admin/recognition/certificates/:certId/revoke
  app.post("/api/admin/recognition/certificates/:certId/revoke", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!requireRole(req, res, HR_ADMIN_ROLES)) return;
    try {
      const { reason } = req.body;
      await revokeCertificate(req.params.certId, userId, reason);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to revoke certificate" });
    }
  });

  // POST /api/admin/recognition/certificates/:certId/correct
  app.post("/api/admin/recognition/certificates/:certId/correct", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!requireRole(req, res, HR_ADMIN_ROLES)) return;
    try {
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ error: "reason is required" });
      const issued = await correctCertificate(req.params.certId, userId, reason);
      res.json({ success: true, certificate: issued });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to correct certificate" });
    }
  });

  // POST /api/admin/recognition/certificates/:certId/regenerate-pdf
  app.post("/api/admin/recognition/certificates/:certId/regenerate-pdf", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!requireRole(req, res, HR_ADMIN_ROLES)) return;
    try {
      const { regenerateCertificatePdf } = await import("./services/certificateEngine");
      const result = await regenerateCertificatePdf(req.params.certId, userId);
      res.json({ success: true, pdfUrl: result.pdfUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to regenerate PDF" });
    }
  });

  // GET /api/admin/recognition/certificates — admin list of all certificates
  app.get("/api/admin/recognition/certificates", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!requireRole(req, res, HR_ADMIN_ROLES)) return;
    try {
      const certs = await db
        .select()
        .from(recognitionCertificates)
        .orderBy(desc(recognitionCertificates.issuedAt))
        .limit(200);

      if (certs.length === 0) return res.json([]);

      const allUserIds = [...new Set([...certs.map((c) => c.recipientId), ...certs.map((c) => c.approverId)])];
      const badgeIds = [...new Set(certs.map((c) => c.badgeTypeId))];

      const [users, badges] = await Promise.all([
        db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
          .from(adminUsers).where(inArray(adminUsers.id, allUserIds)),
        db.select().from(praiseBadgeTypes).where(inArray(praiseBadgeTypes.id, badgeIds)),
      ]);

      const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
      const badgeMap = new Map(badges.map((b) => [b.id, b]));

      res.json(certs.map((c) => ({
        ...c,
        recipientName: userMap.get(c.recipientId) ?? "Unknown",
        approverName: userMap.get(c.approverId) ?? "Unknown",
        badgeType: badgeMap.get(c.badgeTypeId) ?? null,
      })));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });
}
