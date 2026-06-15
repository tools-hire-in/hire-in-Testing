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
