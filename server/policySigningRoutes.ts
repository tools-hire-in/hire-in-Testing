import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  adminUsers,
  policyDocuments,
  policySigningRequests,
  policySignatures,
  type PolicyDocument,
  type PolicySigningRequest,
  type PolicySignature,
} from "@shared/schema";
import { POLICY_DOCUMENTS } from "./policyContent";
import { generatePolicySignaturePdf } from "./policySignaturePdf";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const objectStorageService = new ObjectStorageService();

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireHR(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  const role = req.session.role;
  if (role === "super_admin" || role === "admin" || role === "hr") return next();
  return res.status(403).json({ error: "HR access required" });
}

async function ensurePoliciesSeeded(): Promise<void> {
  const existing = await db.select({ id: policyDocuments.id, title: policyDocuments.title })
    .from(policyDocuments)
    .where(eq(policyDocuments.isActive, true));

  const existingTitles = new Set(existing.map(e => e.title));

  for (const policy of POLICY_DOCUMENTS) {
    if (!existingTitles.has(policy.title)) {
      await db.insert(policyDocuments).values({
        title: policy.title,
        content: policy.pages,
        version: 1,
        isActive: true,
      });
    }
  }
}

export function registerPolicySigningRoutes(app: Express) {

  // === SEED (called at startup) ===
  ensurePoliciesSeeded().catch(e => console.error("Policy seeding error:", e));

  // ==========================================
  // HR MANAGEMENT ROUTES
  // ==========================================

  // List all active policy documents (HR)
  app.get("/api/hr/policies", requireHR, async (req: Request, res: Response) => {
    try {
      const policies = await db.select().from(policyDocuments)
        .where(eq(policyDocuments.isActive, true))
        .orderBy(policyDocuments.title);
      res.json(policies);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch policies" });
    }
  });

  // Create or update a policy document (HR/Admin only)
  app.post("/api/hr/policies", requireHR, async (req: Request, res: Response) => {
    try {
      const { title, content } = req.body;
      if (!title || !Array.isArray(content)) {
        return res.status(400).json({ error: "title and content[] are required" });
      }
      const [created] = await db.insert(policyDocuments).values({
        title,
        content,
        version: 1,
        isActive: true,
      }).returning();
      res.status(201).json(created);
    } catch (e) {
      res.status(500).json({ error: "Failed to create policy" });
    }
  });

  // Get sign-off status for a policy (HR)
  app.get("/api/hr/policies/:policyId/signoff-status", requireHR, async (req: Request, res: Response) => {
    try {
      const { policyId } = req.params;

      const requests = await db
        .select({
          requestId: policySigningRequests.id,
          employeeId: policySigningRequests.employeeId,
          status: policySigningRequests.status,
          sentAt: policySigningRequests.sentAt,
          dueDate: policySigningRequests.dueDate,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          email: adminUsers.email,
          empId: adminUsers.employeeId,
          role: adminUsers.role,
          department: adminUsers.departmentId,
        })
        .from(policySigningRequests)
        .innerJoin(adminUsers, eq(policySigningRequests.employeeId, adminUsers.id))
        .where(and(
          eq(policySigningRequests.policyDocumentId, policyId),
          eq(adminUsers.isActive, true),
        ))
        .orderBy(desc(policySigningRequests.sentAt));

      const requestIds = requests.map(r => r.requestId);
      let signaturesMap: Record<string, { signedAt: Date | null; pdfPath: string | null }> = {};

      if (requestIds.length > 0) {
        const sigs = await db.select({
          signingRequestId: policySignatures.signingRequestId,
          signedAt: policySignatures.signedAt,
          pdfPath: policySignatures.pdfPath,
        }).from(policySignatures).where(inArray(policySignatures.signingRequestId, requestIds));

        for (const s of sigs) {
          signaturesMap[s.signingRequestId] = { signedAt: s.signedAt, pdfPath: s.pdfPath };
        }
      }

      const now = new Date();
      const rows = requests.map(r => {
        const sig = signaturesMap[r.requestId];
        let status = r.status;
        if (status === "pending" && r.dueDate && new Date(r.dueDate) < now) {
          status = "overdue";
        }
        return {
          requestId: r.requestId,
          employeeId: r.employeeId,
          employeeName: `${r.firstName} ${r.lastName}`,
          email: r.email,
          empId: r.empId,
          role: r.role,
          status,
          sentAt: r.sentAt,
          signedAt: sig?.signedAt || null,
          pdfPath: sig?.pdfPath || null,
        };
      });

      const signed = rows.filter(r => r.status === "signed").length;
      const pending = rows.filter(r => r.status === "pending").length;
      const overdue = rows.filter(r => r.status === "overdue").length;

      res.json({ rows, summary: { signed, pending, overdue, total: rows.length } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch sign-off status" });
    }
  });

  // Push policy to employees (HR) — creates signing_request rows
  app.post("/api/hr/policies/:policyId/push", requireHR, async (req: Request, res: Response) => {
    try {
      const { policyId } = req.params;
      const { scope, departmentId, employeeIds, dueDate } = req.body;
      // scope: "all" | "department" | "individuals"

      const [policy] = await db.select().from(policyDocuments)
        .where(and(eq(policyDocuments.id, policyId), eq(policyDocuments.isActive, true)));
      if (!policy) return res.status(404).json({ error: "Policy not found" });

      let targetEmployees: { id: string }[] = [];
      if (scope === "all") {
        targetEmployees = await db.select({ id: adminUsers.id })
          .from(adminUsers)
          .where(and(eq(adminUsers.isActive, true), eq(adminUsers.employmentStatus, "active")));
      } else if (scope === "department" && departmentId) {
        targetEmployees = await db.select({ id: adminUsers.id })
          .from(adminUsers)
          .where(and(eq(adminUsers.isActive, true), eq(adminUsers.employmentStatus, "active"), eq(adminUsers.departmentId, departmentId)));
      } else if (scope === "individuals" && Array.isArray(employeeIds) && employeeIds.length > 0) {
        targetEmployees = await db.select({ id: adminUsers.id })
          .from(adminUsers)
          .where(and(eq(adminUsers.isActive, true), inArray(adminUsers.id, employeeIds)));
      } else {
        return res.status(400).json({ error: "Invalid scope or missing parameters" });
      }

      const sentByUserId = req.session!.userId as string;
      let created = 0;
      let skipped = 0;

      for (const emp of targetEmployees) {
        // Check if pending request already exists
        const existing = await db.select({ id: policySigningRequests.id })
          .from(policySigningRequests)
          .where(and(
            eq(policySigningRequests.policyDocumentId, policyId),
            eq(policySigningRequests.employeeId, emp.id),
            eq(policySigningRequests.status, "pending"),
          ))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await db.insert(policySigningRequests).values({
          policyDocumentId: policyId,
          employeeId: emp.id,
          sentByUserId,
          status: "pending",
          dueDate: dueDate ? new Date(dueDate) : null,
        });
        created++;
      }

      res.json({ created, skipped, total: targetEmployees.length });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to push policy" });
    }
  });

  // Send reminder email(s) to pending employees for a policy (HR)
  // Optional ?employeeId= query param limits to a single employee.
  app.post("/api/hr/policies/:policyId/remind-pending", requireHR, async (req: Request, res: Response) => {
    try {
      const { policyId } = req.params;
      const { employeeId } = req.query as { employeeId?: string };
      const { dispatchAutomatedEmail } = await import("./email");
      const { getPortalBaseUrl } = await import("./portalUrl");
      const portalUrl = getPortalBaseUrl();

      const [policy] = await db.select({ title: policyDocuments.title })
        .from(policyDocuments)
        .where(and(eq(policyDocuments.id, policyId), eq(policyDocuments.isActive, true)));
      if (!policy) return res.status(404).json({ error: "Policy not found" });

      const conditions: any[] = [
        eq(policySigningRequests.policyDocumentId, policyId),
        eq(policySigningRequests.status, "pending"),
        eq(adminUsers.isActive, true),
      ];
      if (employeeId) {
        conditions.push(eq(policySigningRequests.employeeId, employeeId));
      }

      const pending = await db
        .select({
          requestId: policySigningRequests.id,
          employeeId: policySigningRequests.employeeId,
          dueDate: policySigningRequests.dueDate,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          email: adminUsers.email,
        })
        .from(policySigningRequests)
        .innerJoin(adminUsers, eq(policySigningRequests.employeeId, adminUsers.id))
        .where(and(...conditions));

      let sent = 0;
      for (const row of pending) {
        if (!row.email) continue;
        try {
          const dueStr = row.dueDate
            ? new Date(row.dueDate).toLocaleDateString("en-IN", { dateStyle: "long" })
            : "N/A";

          const bodyHtml = `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
              <div style="background:linear-gradient(135deg,#1F3A6E 0%,#2c5282 100%);padding:28px 32px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Hire&rsquo;in Solutions</h1>
                <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;">Policy Compliance Reminder</p>
              </div>
              <div style="padding:32px;">
                <p style="color:#1e293b;margin:0 0 16px;">Hi ${row.firstName},</p>
                <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
                  This is a reminder that your signature is required for the following policy:
                </p>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
                  <p style="color:#475569;margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Policy</p>
                  <p style="color:#1e293b;margin:0;font-weight:600;">${policy.title}</p>
                  ${row.dueDate ? `<p style="color:#9a3412;margin:8px 0 0;font-size:13px;">Due: ${dueStr}</p>` : ""}
                </div>
                <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
                  Please log in to the portal and complete your policy acknowledgement as soon as possible.
                </p>
                <div style="text-align:center;margin:24px 0;">
                  <a href="${portalUrl}/admin/policy-gate"
                     style="display:inline-block;background:#F47C20;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:14px;">
                    Sign Policy Now
                  </a>
                </div>
                <p style="color:#94a3b8;font-size:12px;margin:0;">This is a reminder sent by your HR team. If you have already signed this policy, please disregard.</p>
              </div>
            </div>`;

          const bodyText = `Hi ${row.firstName},\n\nThis is a reminder that your signature is required for the "${policy.title}" policy${row.dueDate ? ` (due: ${dueStr})` : ""}.\n\nPlease log in and sign it here: ${portalUrl}/admin/policy-gate`;

          await dispatchAutomatedEmail(
            "policy_pending_employee_reminder",
            "policy_remind_pending_endpoint",
            {
              to: row.email,
              subject: `Reminder: Please sign the "${policy.title}" policy`,
              html: bodyHtml,
              text: bodyText,
            },
          );
          sent++;
        } catch (empErr) {
          console.error(`[policySigningRoutes] Reminder failed for ${row.email}:`, empErr);
        }
      }

      res.json({ sent });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to send reminders" });
    }
  });

  // Resend a signing request (HR) — resets to pending
  app.post("/api/hr/policy-requests/:requestId/resend", requireHR, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      await db.update(policySigningRequests)
        .set({ status: "pending", sentAt: new Date(), updatedAt: new Date() })
        .where(eq(policySigningRequests.id, requestId));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to resend request" });
    }
  });

  // Export CSV (HR)
  app.get("/api/hr/policies/:policyId/signoff-export", requireHR, async (req: Request, res: Response) => {
    try {
      const { policyId } = req.params;

      const [policy] = await db.select({ title: policyDocuments.title })
        .from(policyDocuments).where(eq(policyDocuments.id, policyId));

      const requests = await db
        .select({
          requestId: policySigningRequests.id,
          employeeId: policySigningRequests.employeeId,
          status: policySigningRequests.status,
          sentAt: policySigningRequests.sentAt,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          email: adminUsers.email,
          empId: adminUsers.employeeId,
        })
        .from(policySigningRequests)
        .innerJoin(adminUsers, eq(policySigningRequests.employeeId, adminUsers.id))
        .where(eq(policySigningRequests.policyDocumentId, policyId))
        .orderBy(adminUsers.firstName);

      const requestIds = requests.map(r => r.requestId);
      let signaturesMap: Record<string, Date | null> = {};
      if (requestIds.length > 0) {
        const sigs = await db.select({
          signingRequestId: policySignatures.signingRequestId,
          signedAt: policySignatures.signedAt,
        }).from(policySignatures).where(inArray(policySignatures.signingRequestId, requestIds));
        for (const s of sigs) signaturesMap[s.signingRequestId] = s.signedAt;
      }

      const now = new Date();
      let csv = "Employee Name,Employee ID,Email,Status,Sent At,Signed At\n";
      for (const r of requests) {
        const sig = signaturesMap[r.requestId];
        let status = r.status;
        if (status === "pending" && !sig) status = "pending";

        csv += [
          `"${r.firstName} ${r.lastName}"`,
          `"${r.empId || ""}"`,
          `"${r.email}"`,
          `"${status}"`,
          `"${r.sentAt ? new Date(r.sentAt).toLocaleDateString("en-IN") : ""}"`,
          `"${sig ? new Date(sig).toLocaleDateString("en-IN") : ""}"`,
        ].join(",") + "\n";
      }

      const safeTitle = (policy?.title || "policy").replace(/[^a-z0-9]/gi, "_");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_signoff_status.csv"`);
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: "Failed to export" });
    }
  });

  // ==========================================
  // EMPLOYEE SIGNING ROUTES
  // ==========================================

  // Get my pending signing requests
  app.get("/api/hr/my-policy-requests", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId as string;

      const requests = await db
        .select({
          requestId: policySigningRequests.id,
          status: policySigningRequests.status,
          sentAt: policySigningRequests.sentAt,
          policyId: policyDocuments.id,
          policyTitle: policyDocuments.title,
          policyVersion: policyDocuments.version,
        })
        .from(policySigningRequests)
        .innerJoin(policyDocuments, eq(policySigningRequests.policyDocumentId, policyDocuments.id))
        .where(and(
          eq(policySigningRequests.employeeId, userId),
          eq(policyDocuments.isActive, true),
        ))
        .orderBy(desc(policySigningRequests.sentAt));

      const requestIds = requests.map(r => r.requestId);
      let signaturesMap: Record<string, { id: string; signedAt: Date | null; pdfPath: string | null }> = {};
      if (requestIds.length > 0) {
        const sigs = await db.select({
          id: policySignatures.id,
          signingRequestId: policySignatures.signingRequestId,
          signedAt: policySignatures.signedAt,
          pdfPath: policySignatures.pdfPath,
        }).from(policySignatures).where(inArray(policySignatures.signingRequestId, requestIds));
        for (const s of sigs) signaturesMap[s.signingRequestId] = { id: s.id, signedAt: s.signedAt, pdfPath: s.pdfPath };
      }

      const result = requests.map(r => ({
        ...r,
        signedAt: signaturesMap[r.requestId]?.signedAt || null,
        pdfPath: signaturesMap[r.requestId]?.pdfPath || null,
        signatureId: signaturesMap[r.requestId]?.id || null,
      }));

      res.json(result);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch policy requests" });
    }
  });

  // Get a specific policy's content for signing
  app.get("/api/hr/policy-requests/:requestId/content", requireAuth, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const userId = req.session!.userId as string;

      const [request] = await db
        .select({
          requestId: policySigningRequests.id,
          status: policySigningRequests.status,
          employeeId: policySigningRequests.employeeId,
          policyId: policyDocuments.id,
          policyTitle: policyDocuments.title,
          policyVersion: policyDocuments.version,
          policyContent: policyDocuments.content,
        })
        .from(policySigningRequests)
        .innerJoin(policyDocuments, eq(policySigningRequests.policyDocumentId, policyDocuments.id))
        .where(and(
          eq(policySigningRequests.id, requestId),
          eq(policySigningRequests.employeeId, userId),
        ))
        .limit(1);

      if (!request) return res.status(404).json({ error: "Signing request not found" });

      // Check if already signed
      const [sig] = await db.select().from(policySignatures)
        .where(eq(policySignatures.signingRequestId, requestId)).limit(1);

      res.json({
        requestId: request.requestId,
        status: request.status,
        policyId: request.policyId,
        policyTitle: request.policyTitle,
        policyVersion: request.policyVersion,
        pages: request.policyContent as Array<{ page: number; body: string }>,
        alreadySigned: !!sig,
        signedAt: sig?.signedAt || null,
        pdfPath: sig?.pdfPath || null,
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch policy content" });
    }
  });

  // Submit final signature (employee)
  app.post("/api/hr/policy-requests/:requestId/sign", requireAuth, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const userId = req.session!.userId as string;
      const { pageInitials, finalSignature } = req.body;

      if (!Array.isArray(pageInitials) || !finalSignature) {
        return res.status(400).json({ error: "pageInitials and finalSignature are required" });
      }

      const [request] = await db
        .select({
          requestId: policySigningRequests.id,
          status: policySigningRequests.status,
          employeeId: policySigningRequests.employeeId,
          policyId: policyDocuments.id,
          policyTitle: policyDocuments.title,
          policyVersion: policyDocuments.version,
          policyContent: policyDocuments.content,
        })
        .from(policySigningRequests)
        .innerJoin(policyDocuments, eq(policySigningRequests.policyDocumentId, policyDocuments.id))
        .where(and(
          eq(policySigningRequests.id, requestId),
          eq(policySigningRequests.employeeId, userId),
          eq(policySigningRequests.status, "pending"),
        ))
        .limit(1);

      if (!request) return res.status(404).json({ error: "Signing request not found or already signed" });

      // Get employee details
      const [employee] = await db.select({
        firstName: adminUsers.firstName,
        lastName: adminUsers.lastName,
        employeeId: adminUsers.employeeId,
      }).from(adminUsers).where(eq(adminUsers.id, userId)).limit(1);

      const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || req.socket.remoteAddress
        || "unknown";

      const signedAt = new Date();
      const pages = request.policyContent as Array<{ page: number; body: string }>;

      // Validate: every policy page must have a non-empty initial
      const expectedPageNumbers = pages.map(p => p.page);
      const providedInitials = pageInitials as Array<{ page: number; initial: string }>;
      const missingPages: number[] = [];
      for (const pageNum of expectedPageNumbers) {
        const entry = providedInitials.find(pi => pi.page === pageNum);
        if (!entry || !entry.initial || !entry.initial.trim()) {
          missingPages.push(pageNum);
        }
      }
      if (missingPages.length > 0) {
        return res.status(400).json({
          error: `Missing initials for page(s): ${missingPages.join(", ")}. Every page must be initialled.`,
          missingPages,
        });
      }
      if (!finalSignature.trim()) {
        return res.status(400).json({ error: "Final signature cannot be empty" });
      }

      // Generate PDF — required for signing to be recorded
      let pdfPath: string | null = null;
      try {
        const pdfBuffer = await generatePolicySignaturePdf({
          policyTitle: request.policyTitle,
          policyVersion: request.policyVersion,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeId: employee.employeeId,
          signedAt,
          ipAddress,
          pageInitials: providedInitials,
          finalSignature,
          pages,
        });

        const fileName = `policy-${request.policyId}-${userId}-${Date.now()}.pdf`;
        const objectPath = `.private/policy-signatures/${fileName}`;
        const storedPath = await objectStorageService.uploadBuffer(pdfBuffer, objectPath, "application/pdf");
        pdfPath = storedPath;
      } catch (pdfErr) {
        console.error("Policy PDF generation/upload error:", pdfErr);
        return res.status(500).json({ error: "Failed to generate acknowledgement PDF. Please try again." });
      }

      // Save signature
      const [sig] = await db.insert(policySignatures).values({
        signingRequestId: requestId,
        employeeId: userId,
        ipAddress,
        pageInitials: providedInitials,
        finalSignature,
        pdfPath,
      }).returning();

      // Update request status
      await db.update(policySigningRequests)
        .set({ status: "signed", updatedAt: new Date() })
        .where(eq(policySigningRequests.id, requestId));

      // Fold the policy acknowledgement onto the central signing service + ledger so it
      // is verifiable via /verify like every other formally-signed document.
      const { signPolicyAcknowledgement, recordSignature } = await import("./documentSigningService");
      const sig_result = signPolicyAcknowledgement({
        policyId: request.policyId,
        policyTitle: request.policyTitle,
        policyVersion: request.policyVersion,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        pageInitials: providedInitials,
        finalSignature,
        signedAt,
      });
      await recordSignature({
        documentType: "policy",
        documentId: sig.id,
        referenceNumber: sig_result.refNumber,
        signerName: `${employee.firstName} ${employee.lastName}`,
        signerRole: "employee",
        signerUserId: userId,
        signedAt,
        ipAddress,
        contentHash: sig_result.documentHash,
        authCode: sig_result.authCode,
        sectionInitials: providedInitials,
        certificatePath: pdfPath,
        metadata: { policyId: request.policyId, policyVersion: request.policyVersion },
      });

      res.json({ success: true, signatureId: sig.id, pdfPath, referenceNumber: sig_result.refNumber, authCode: sig_result.authCode });
    } catch (e) {
      console.error("Policy signing error:", e);
      res.status(500).json({ error: "Failed to complete signing" });
    }
  });

  // Download signed PDF
  app.get("/api/hr/policy-signatures/:sigId/download", requireAuth, async (req: Request, res: Response) => {
    try {
      const { sigId } = req.params;
      const userId = req.session!.userId as string;
      const userRole = req.session!.role;

      const [sig] = await db.select().from(policySignatures)
        .where(eq(policySignatures.id, sigId)).limit(1);

      if (!sig) return res.status(404).json({ error: "Signature not found" });

      const isHR = userRole === "super_admin" || userRole === "admin" || userRole === "hr";
      if (!isHR && sig.employeeId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!sig.pdfPath) return res.status(404).json({ error: "PDF not available" });

      const pdfBuffer = await objectStorageService.downloadBuffer(sig.pdfPath);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="policy-acknowledgement-${sigId}.pdf"`);
      res.send(pdfBuffer);
    } catch (e) {
      res.status(500).json({ error: "Failed to download PDF" });
    }
  });

  // Get signature by signing request id — accessible to request owner OR HR
  app.get("/api/hr/policy-requests/:requestId/signature", requireAuth, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const userId = req.session!.userId as string;
      const userRole = req.session!.role;
      const isHR = userRole === "super_admin" || userRole === "admin" || userRole === "hr";

      // Verify ownership if not HR
      if (!isHR) {
        const [request] = await db.select({ employeeId: policySigningRequests.employeeId })
          .from(policySigningRequests)
          .where(eq(policySigningRequests.id, requestId))
          .limit(1);
        if (!request || request.employeeId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const [sig] = await db.select().from(policySignatures)
        .where(eq(policySignatures.signingRequestId, requestId)).limit(1);
      if (!sig) return res.status(404).json({ error: "Not signed yet" });
      res.json(sig);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch signature" });
    }
  });
}
