import type { Express, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { storage as dbStorage } from "./storage";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { extractPlaceholders, renderTemplate } from "./contractTemplateEngine";
import { sendContractSigningEmail, sendContractCountersignEmail } from "./email";
import { searchCeipalCandidates } from "./ceipalService";
import { resolveRoles } from "@shared/accessControl";
import { z } from "zod";
import { tokenLookupLimiter } from "./rateLimits";
import { calculateMargins, validateMarginInputs, MarginValidationError } from "./services/contractMarginService";
import type { ContractType } from "./services/contractMarginService";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const objectStorageService = new ObjectStorageService();

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// Centralized permission middleware — resolves allowed roles via the central
// access registry (ACCESS_REGISTRY).
// `super_admin` is the ONLY role auto-granted here — it is the protected
// break-glass role. `admin` is resolved through the registry like all other
// roles. Do NOT add `admin` back to this auto-grant.
// The trailing role list is the defensive default seed for resolveRoles.
function requirePermission(featureKey: string, ...roles: string[]) {
  return (req: Request, res: Response, next: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const allowed = resolveRoles(featureKey, Array.from(new Set(["super_admin", ...roles])));
    if (allowed.includes(req.session.role!)) return next();
    return res.status(403).json({ error: "Insufficient permissions" });
  };
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateAuthCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function computeHash(data: string): string {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET || "contract-hash-secret")
    .update(data)
    .digest("hex");
}

const SAMPLE_TEMPLATE_PATH = path.resolve("public/samples/Staffing_Services_Agreement_Sample.docx");

export function registerContractRoutes(app: Express) {

  // ─── CANDIDATE SEARCH (Ceipal-first with graceful fallback) ────────────────
  app.get("/api/contracts/candidates/search", requireAuth, async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      const result = await searchCeipalCandidates(q);
      res.json(result);
    } catch (e: any) {
      res.json({ candidates: [], ceipal_unavailable: true, message: e.message });
    }
  });

  // ─── SAMPLE TEMPLATE DOWNLOAD ───────────────────────────────────────────────
  app.get("/api/contracts/sample-template", (req, res) => {
    if (!fs.existsSync(SAMPLE_TEMPLATE_PATH)) {
      return res.status(404).json({ error: "Sample template not found" });
    }
    res.setHeader("Content-Disposition", 'attachment; filename="Staffing_Services_Agreement_Sample.docx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    fs.createReadStream(SAMPLE_TEMPLATE_PATH).pipe(res);
  });

  // ─── CONTRACT TEMPLATES ──────────────────────────────────────────────────────
  app.get("/api/contracts/templates", requireAuth, async (req, res) => {
    try {
      const templates = await dbStorage.getContractTemplates();
      res.json(templates);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/contracts/templates", requirePermission("contracts.templates", "hr", "operations"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      if (!req.body.name) return res.status(400).json({ error: "Template name required" });

      const placeholders = extractPlaceholders(req.file.buffer);
      const filePath = await objectStorageService.uploadBuffer(
        req.file.buffer,
        `.private/contract-templates/${Date.now()}_${req.file.originalname}`,
        req.file.mimetype
      );

      const template = await dbStorage.createContractTemplate({
        name: req.body.name,
        description: req.body.description || null,
        clientId: req.body.clientId || null,
        filePath,
        placeholderList: placeholders,
        uploadedBy: req.session!.userId,
      });
      res.status(201).json(template);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/contracts/templates/:id", requirePermission("contracts.templates", "hr", "operations"), async (req, res) => {
    try {
      await dbStorage.deleteContractTemplate(req.params.id);
      res.status(204).send();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── CLIENT REGISTRY ────────────────────────────────────────────────────────
  app.get("/api/contracts/clients", requireAuth, async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly !== "false";
      res.json(await dbStorage.getContractClients(activeOnly));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/contracts/clients", requirePermission("contracts.clients", "hr", "operations"), async (req, res) => {
    try {
      if (!req.body.name) return res.status(400).json({ error: "Client name required" });
      const client = await dbStorage.createContractClient(req.body);
      res.status(201).json(client);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/contracts/clients/:id", requirePermission("contracts.clients", "hr", "operations"), async (req, res) => {
    try {
      const client = await dbStorage.updateContractClient(req.params.id, req.body);
      if (!client) return res.status(404).json({ error: "Client not found" });
      res.json(client);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/contracts/clients/:id/status", requirePermission("contracts.clients.status", "hr", "operations"), async (req, res) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive must be a boolean" });
      const client = await dbStorage.toggleContractClientStatus(req.params.id, isActive);
      if (!client) return res.status(404).json({ error: "Client not found" });
      res.json(client);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/contracts/clients/:id", requirePermission("contracts.clients", "hr", "operations"), async (req, res) => {
    res.status(405).json({ error: "Hard deletion of clients is disabled. Use PATCH /status to deactivate." });
  });

  // ─── MARGIN DRY-RUN ──────────────────────────────────────────────────────────
  // POST /api/contracts/calculate-margins — no DB write, returns derived values.
  // Returns partial nulls for incomplete inputs (safe for live preview).
  app.post("/api/contracts/calculate-margins", requireAuth, (req, res) => {
    try {
      const {
        contractType, billRate, payRate, passthroughFee,
        referralFeeFlat, referralFeePct, candidateAnnualSalary,
        businessMarketingCost,
      } = req.body;
      if (!contractType) return res.status(400).json({ error: "contractType required" });
      const result = calculateMargins({
        contractType: contractType as ContractType,
        billRate: billRate != null ? Number(billRate) : null,
        payRate: payRate != null ? Number(payRate) : null,
        passthroughFee: passthroughFee != null ? Number(passthroughFee) : null,
        referralFeeFlat: referralFeeFlat != null ? Number(referralFeeFlat) : null,
        referralFeePct: referralFeePct != null ? Number(referralFeePct) : null,
        candidateAnnualSalary: candidateAnnualSalary != null ? Number(candidateAnnualSalary) : null,
        businessMarketingCost: businessMarketingCost != null ? Number(businessMarketingCost) : null,
      });
      res.json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ─── CONTRACT GENERATION ─────────────────────────────────────────────────────
  app.get("/api/contracts", requireAuth, async (req, res) => {
    try {
      const { clientId, status, search } = req.query as Record<string, string>;
      const list = await dbStorage.getContracts({ clientId, status, search });
      res.json(list);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const c = await dbStorage.getContract(req.params.id);
      if (!c) return res.status(404).json({ error: "Contract not found" });
      res.json(c);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Generate a contract from a template
  app.post("/api/contracts", requirePermission("contracts.post", "hr", "operations", "manager"), async (req, res) => {
    try {
      const {
        templateId, clientId, clientName, candidateName, candidateRole,
        candidates, variableValues,
        agreementDate, paymentTermsDays, billingFrequency,
        notes, templateName,
        contractType, billRate, payRate, passthroughFee,
        referralFeeFlat, businessMarketingCost, currency,
      } = req.body;

      if (!clientName) return res.status(400).json({ error: "Client name required" });

      // ─── Freeform MSA branch ────────────────────────────────────────────────
      // When a `freeformMsa` payload is supplied, build the DOCX from pre-written,
      // user-edited clauses instead of the docxtemplater template path. The record
      // is saved as a normal generated contract (templateId null, source generated)
      // so the existing dispatch / e-sign / countersign / verify pipeline applies
      // unchanged. Freeform inputs are persisted in variableValues with a flag.
      if (req.body.freeformMsa) {
        const msaSchema = z.object({
          client: z.object({
            name: z.string().min(1, "Client name required"),
            ein: z.string().optional().default(""),
            address: z.string().optional().default(""),
            signatoryName: z.string().optional().default(""),
            signatoryTitle: z.string().optional().default(""),
          }),
          provider: z.object({
            name: z.string().optional().default("Hire'in Solutions"),
            ein: z.string().optional().default(""),
            address: z.string().optional().default(""),
            signatoryName: z.string().optional().default(""),
            signatoryTitle: z.string().optional().default(""),
          }).optional().default({}),
          establishment: z.object({
            city: z.string().optional().default(""),
            state: z.string().optional().default(""),
            country: z.string().optional().default(""),
          }).optional().default({}),
          clauses: z.array(z.object({
            key: z.string(),
            title: z.string().optional().default(""),
            body: z.string().optional().default(""),
          })).default([]),
          additionalTerms: z.string().optional().default(""),
        });

        const parsed = msaSchema.safeParse(req.body.freeformMsa);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid MSA input", details: parsed.error.flatten() });
        }
        const msa = parsed.data;

        const { buildFreeformMsaDocx } = await import("./freeformMsa");
        const buffer = await buildFreeformMsaDocx({
          client: msa.client,
          provider: msa.provider,
          establishment: msa.establishment,
          agreementDate: agreementDate || undefined,
          clauses: msa.clauses,
          additionalTerms: msa.additionalTerms,
        });

        const outPath = `.private/contracts/${Date.now()}_MSA_${(msa.client.name || clientName).replace(/\s+/g, "_")}.docx`;
        const msaDocxPath = await objectStorageService.uploadBuffer(
          buffer, outPath,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        // Persist EIN back to the registry client so it's remembered next time.
        if (clientId && msa.client.ein?.trim()) {
          try {
            const existing = await dbStorage.getContractClient(clientId);
            if (existing && !existing.ein?.trim()) {
              await dbStorage.updateContractClient(clientId, { ein: msa.client.ein.trim() });
            }
          } catch { /* non-fatal */ }
        }

        const contract = await dbStorage.createContract({
          source: "generated",
          templateId: null,
          clientId: clientId || null,
          templateName: "Master Services Agreement (Freeform)",
          clientName,
          candidateName: null,
          candidateRole: null,
          candidates: [],
          variableValues: {
            __msaFreeform: true,
            client: msa.client,
            provider: msa.provider,
            establishment: msa.establishment,
            clauses: msa.clauses,
            additionalTerms: msa.additionalTerms,
          },
          docxPath: msaDocxPath,
          agreementDate: agreementDate || null,
          paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : null,
          billingFrequency: billingFrequency || null,
          notes: notes || null,
          createdBy: req.session!.userId,
        });

        return res.status(201).json(contract);
      }

      // Normalise candidates array — fall back to legacy single-candidate fields
      const candidatesArray: Array<{ name: string; role: string; startDate: string; location: string; engagementType: string }> =
        Array.isArray(candidates) && candidates.length > 0
          ? candidates
          : candidateName
            ? [{ name: candidateName, role: candidateRole || "", startDate: contractStartDate || "", location: "", engagementType: "" }]
            : [];

      // Backwards-compat: populate legacy columns from first candidate
      const legacyName = candidatesArray[0]?.name || candidateName || null;
      const legacyRole = candidatesArray[0]?.role || candidateRole || null;

      let docxPath: string | null = null;

      if (templateId) {
        const tmpl = await dbStorage.getContractTemplate(templateId);
        if (!tmpl) return res.status(404).json({ error: "Template not found" });

        // Fetch template file
        const tmplBuffer = await objectStorageService.downloadBuffer(tmpl.filePath);
        const rendered = renderTemplate(tmplBuffer, variableValues || {}, candidatesArray);

        const outPath = `.private/contracts/${Date.now()}_${clientName.replace(/\s+/g, "_")}.docx`;
        docxPath = await objectStorageService.uploadBuffer(rendered, outPath,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        await dbStorage.incrementContractTemplateUsage(templateId);
      }

      const resolvedContractType: ContractType = (contractType as ContractType) || "contract_hourly";
      const marginInputs = {
        contractType: resolvedContractType,
        billRate: billRate ? Number(billRate) : null,
        payRate: payRate ? Number(payRate) : null,
        passthroughFee: passthroughFee ? Number(passthroughFee) : null,
        referralFeeFlat: (req.body.referralFeeFlat) ? Number(req.body.referralFeeFlat) : null,
        referralFeePct: (req.body.referralFeePct) ? Number(req.body.referralFeePct) : null,
        candidateAnnualSalary: (req.body.candidateAnnualSalary) ? Number(req.body.candidateAnnualSalary) : null,
        businessMarketingCost: businessMarketingCost ? Number(businessMarketingCost) : null,
      };

      try { validateMarginInputs(marginInputs); } catch (e) {
        if (e instanceof MarginValidationError) return res.status(400).json({ error: e.message });
        throw e;
      }

      const margins = calculateMargins(marginInputs);

      const contract = await dbStorage.createContract({
        source: "generated",
        templateId: templateId || null,
        clientId: clientId || null,
        templateName: templateName || null,
        clientName,
        candidateName: legacyName,
        candidateRole: legacyRole,
        candidates: candidatesArray,
        variableValues: variableValues || {},
        docxPath,
        agreementDate: agreementDate || null,
        paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : null,
        billingFrequency: billingFrequency || null,
        notes: notes || null,
        createdBy: req.session!.userId,
        contractType: resolvedContractType,
        currency: currency || "USD",
        billRate: billRate || null,
        payRate: payRate || null,
        passthroughFee: passthroughFee ? String(passthroughFee) : null,
        referralFee: margins.referralFee != null ? String(margins.referralFee) : null,
        grossMargin: margins.grossMargin != null ? String(margins.grossMargin) : null,
        businessMarketingCost: businessMarketingCost ? String(businessMarketingCost) : null,
        netMargin: margins.netMargin != null ? String(margins.netMargin) : null,
      } as any);

      res.status(201).json(contract);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Upload an existing/imported contract
  app.post("/api/contracts/import", requirePermission("contracts.import", "hr", "operations", "manager"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const {
        clientName, clientId, candidateName, candidateRole,
        paymentTermsDays, billingFrequency, notes,
        specialty, billRate, payRate,
        contractStartDate, contractEndDate,
        contractType, passthroughFee, referralFeeFlat, businessMarketingCost,
        currency,
      } = req.body;
      if (!clientName) return res.status(400).json({ error: "Client name required" });

      const resolvedContractType: ContractType = (contractType as ContractType) || "contract_hourly";

      const marginInputs = {
        contractType: resolvedContractType,
        billRate: billRate ? Number(billRate) : null,
        payRate: payRate ? Number(payRate) : null,
        passthroughFee: passthroughFee ? Number(passthroughFee) : null,
        referralFeeFlat: referralFeeFlat ? Number(referralFeeFlat) : null,
        referralFeePct: req.body.referralFeePct ? Number(req.body.referralFeePct) : null,
        candidateAnnualSalary: req.body.candidateAnnualSalary ? Number(req.body.candidateAnnualSalary) : null,
        businessMarketingCost: businessMarketingCost ? Number(businessMarketingCost) : null,
      };

      try { validateMarginInputs(marginInputs); } catch (e) {
        if (e instanceof MarginValidationError) return res.status(400).json({ error: e.message });
        throw e;
      }

      const margins = calculateMargins(marginInputs);

      const ext = path.extname(req.file.originalname).toLowerCase();
      const mimeType = ext === ".pdf" ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const uploadedDocPath = await objectStorageService.uploadBuffer(
        req.file.buffer,
        `.private/contracts/imported/${Date.now()}_${req.file.originalname}`,
        mimeType
      );

      const contract = await dbStorage.createContract({
        source: "imported",
        templateId: null,
        clientId: clientId || null,
        templateName: null,
        clientName,
        candidateName: candidateName || null,
        candidateRole: candidateRole || null,
        variableValues: {},
        docxPath: null,
        uploadedDocPath,
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : null,
        billingFrequency: billingFrequency || null,
        notes: notes || null,
        status: "countersigned",
        createdBy: req.session!.userId,
        contractType: resolvedContractType,
        currency: currency || "USD",
        specialty: specialty || null,
        billRate: billRate ? billRate : null,
        payRate: payRate ? payRate : null,
        passthroughFee: passthroughFee ? String(passthroughFee) : null,
        referralFee: margins.referralFee != null ? String(margins.referralFee) : null,
        grossMargin: margins.grossMargin != null ? String(margins.grossMargin) : null,
        businessMarketingCost: businessMarketingCost ? String(businessMarketingCost) : null,
        netMargin: margins.netMargin != null ? String(margins.netMargin) : null,
      } as any);

      res.status(201).json(contract);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Download contract DOCX
  app.get("/api/contracts/:id/download", requireAuth, async (req, res) => {
    try {
      const contract = await dbStorage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Not found" });

      const filePath = contract.uploadedDocPath || contract.docxPath;
      if (!filePath) return res.status(404).json({ error: "No document available" });

      const buffer = await objectStorageService.downloadBuffer(filePath);
      const ext = filePath.endsWith(".pdf") ? ".pdf" : ".docx";
      const mime = ext === ".pdf" ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const filename = `Contract_${contract.clientName.replace(/\s+/g, "_")}${ext}`;

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", mime);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Send (or resend) contract for client signing — routes through DocumentDispatchService.
  // super_admin: direct dispatch (esign_link); all other roles: request approval.
  app.post("/api/contracts/:id/send", requirePermission("contracts.send", "super_admin", "hr", "operations"), async (req, res) => {
    try {
      const contract = await dbStorage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Not found" });
      if (contract.source === "imported") return res.status(400).json({ error: "Imported contracts do not use the signing workflow" });
      if (!["draft", "sent", "pending_dispatch_approval"].includes(contract.status)) {
        return res.status(400).json({ error: `Cannot send: contract status is '${contract.status}'` });
      }

      const role = req.session!.role;
      const isSuperAdmin = role === "super_admin" || role === "architect";
      const appBase = process.env.APP_URL || `https://${req.headers.host}`;
      const clientEmail = req.body.clientEmail || (contract.clientId
        ? (await dbStorage.getContractClient(contract.clientId))?.email
        : undefined) || undefined;

      if (isSuperAdmin) {
        const { directDispatch } = await import("./documentDispatch");
        const result = await directDispatch({
          documentType: "contract",
          documentId: req.params.id,
          deliveryMethod: "esign_link",
          approvedBy: req.session!.userId,
          approvedByName: (req.session as any).name || role,
          approvedByEmail: (req.session as any).email || "",
          recipientEmail: clientEmail,
          ccRecipients: [],
          appBase,
        });
        if (!result.success) return res.status(500).json({ error: result.error });
        return res.json({ success: true, signingUrl: result.signingUrl });
      } else {
        const { requestDispatch } = await import("./documentDispatch");
        const result = await requestDispatch({
          documentType: "contract",
          documentId: req.params.id,
          requestedBy: req.session!.userId,
          recipientEmail: clientEmail,
          ccRecipients: [],
          note: "Submitted via send action",
        });
        if (!result.success) return res.status(500).json({ error: result.error });
        return res.json({ success: true, pendingApproval: true });
      }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Public: load contract signing page data (returns data for any valid token; status communicated in payload)
  app.get("/api/contracts/sign/:token", tokenLookupLimiter, async (req, res) => {
    try {
      const contract = await dbStorage.getContractByToken(req.params.token);
      if (!contract) return res.status(404).json({ error: "Contract not found or link expired" });

      // Soft expiry: contracts sent more than 30 days ago and still awaiting signature are treated as expired.
      const EXPIRY_DAYS = 30;
      if (contract.status === "sent" && contract.sentAt) {
        const sentAt = new Date(contract.sentAt);
        const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() - sentAt.getTime() > expiryMs) {
          return res.status(410).json({ error: "This signing link has expired. Please contact the team to request a new link.", status: "expired" });
        }
      }

      // Always return contract data so public page can render the correct status message
      res.json({
        id: contract.id,
        clientName: contract.clientName,
        candidateName: contract.candidateName,
        candidateRole: contract.candidateRole,
        contractStartDate: contract.contractStartDate,
        contractEndDate: contract.contractEndDate,
        marginPerHour: contract.marginPerHour,
        paymentTermsDays: contract.paymentTermsDays,
        billingFrequency: contract.billingFrequency,
        status: contract.status,
        authCode: contract.authCode,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/contracts/sign/:token", async (req, res) => {
    try {
      const contract = await dbStorage.getContractByToken(req.params.token);
      if (!contract) return res.status(404).json({ error: "Not found" });
      if (contract.status !== "sent") return res.status(400).json({ error: "Already signed or cancelled" });

      const signedAt = new Date();
      const consentAcceptedAt = req.body?.consentAcceptedAt ? new Date(req.body.consentAcceptedAt) : null;
      const signatureFont: string | undefined = req.body?.signatureFont || undefined;

      if (contract.authCode && contract.documentHash) {
        // Contract was pre-signed at dispatch time (presigned_pdf or both delivery method).
        // Reuse the existing cryptographic artifacts — do NOT re-sign with a new timestamp
        // as that would invalidate verification details already sent to the recipient.
        await dbStorage.updateContract(contract.id, {
          status: "client_signed",
          clientSignedAt: signedAt,
          clientSignedIp: req.ip || "",
        });
        const { recordSignature } = await import("./documentSigningService");
        await recordSignature({
          documentType: "contract",
          documentId: contract.id,
          referenceNumber: contract.referenceNumber,
          signerName: contract.clientName,
          signerRole: "client",
          signedAt,
          ipAddress: req.ip || "",
          contentHash: contract.documentHash,
          authCode: contract.authCode,
          consentAcceptedAt,
          metadata: signatureFont ? { signatureFont } : null,
        });
        return res.json({ success: true, authCode: contract.authCode, referenceNumber: contract.referenceNumber });
      }

      // esign_link flow: sign now using the client's execution timestamp
      const { signContract } = await import("./documentSigningService");
      const sigResult = signContract({
        id: contract.id,
        clientName: contract.clientName,
        templateName: contract.templateName,
        agreementDate: contract.agreementDate,
        billingFrequency: contract.billingFrequency,
        paymentTermsDays: contract.paymentTermsDays,
        candidates: contract.candidates,
        signedAt,
      });

      await dbStorage.updateContract(contract.id, {
        status: "client_signed",
        clientSignedAt: signedAt,
        signedAt,
        clientSignedIp: req.ip || "",
        authCode: sigResult.authCode,
        documentHash: sigResult.documentHash,
        referenceNumber: sigResult.refNumber,
      });

      const { recordSignature } = await import("./documentSigningService");
      await recordSignature({
        documentType: "contract",
        documentId: contract.id,
        referenceNumber: sigResult.refNumber,
        signerName: contract.clientName,
        signerRole: "client",
        signedAt,
        ipAddress: req.ip || "",
        contentHash: sigResult.documentHash,
        authCode: sigResult.authCode,
        consentAcceptedAt,
        metadata: signatureFont ? { signatureFont } : null,
      });

      res.json({ success: true, authCode: sigResult.authCode, referenceNumber: sigResult.refNumber });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // HR counter-signs (only allowed after client has signed)
  app.post("/api/contracts/:id/countersign", requirePermission("contracts.countersign", "hr"), async (req, res) => {
    try {
      const contract = await dbStorage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Not found" });
      if (contract.status !== "client_signed") {
        return res.status(400).json({
          error: `Cannot countersign: contract must be in 'client_signed' state (current: ${contract.status}). The client must sign first.`,
        });
      }

      await dbStorage.updateContract(contract.id, {
        status: "countersigned",
        countersignedBy: req.session!.userId,
        countersignedAt: new Date(),
      });

      // Try to send confirmation email
      try {
        const clientRecord = contract.clientId ? await dbStorage.getContractClient(contract.clientId) : null;
        const clientEmail = clientRecord?.email;
        if (clientEmail) {
          await sendContractCountersignEmail({
            to: clientEmail,
            clientName: contract.clientName,
            candidateName: contract.candidateName || undefined,
            authCode: contract.authCode || "",
          });
        }
      } catch { /* email failure is non-fatal */ }

      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Update contract metadata
  app.patch("/api/contracts/:id", requirePermission("contracts.patch", "hr", "operations"), async (req, res) => {
    try {
      const contract = await dbStorage.updateContract(req.params.id, req.body);
      if (!contract) return res.status(404).json({ error: "Not found" });
      res.json(contract);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── INVOICE TRACKING ────────────────────────────────────────────────────────
  app.get("/api/contracts/:id/invoices", requireAuth, async (req, res) => {
    try {
      res.json(await dbStorage.getContractInvoices(req.params.id));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/contracts/invoices/all", requireAuth, async (req, res) => {
    try {
      const { status } = req.query as Record<string, string>;
      res.json(await dbStorage.getAllInvoices({ status }));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/contracts/:id/invoices", requirePermission("contracts.invoices", "hr", "operations"), async (req, res) => {
    try {
      const invoice = await dbStorage.createContractInvoice({
        contractId: req.params.id,
        ...req.body,
        createdBy: req.session!.userId,
      });
      res.status(201).json(invoice);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/contracts/invoices/:id", requirePermission("contracts.invoices", "hr", "operations"), async (req, res) => {
    try {
      const invoice = await dbStorage.updateContractInvoice(req.params.id, req.body);
      if (!invoice) return res.status(404).json({ error: "Not found" });
      res.json(invoice);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/contracts/invoices/:id", requirePermission("contracts.invoices", "hr", "operations"), async (req, res) => {
    try {
      await dbStorage.deleteContractInvoice(req.params.id);
      res.status(204).send();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── DOCUMENT DISPATCH WORKFLOW ──────────────────────────────────────────────

  // POST /api/contracts/:id/dispatch
  // super_admin / architect: direct dispatch with delivery method choice
  // all other roles: request approval (sets pending_dispatch_approval)
  app.post("/api/contracts/:id/dispatch", requirePermission("contracts.dispatch", "super_admin", "admin", "hr", "operations", "manager", "architect"), async (req, res) => {
    try {
      const contract = await dbStorage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Contract not found" });
      if (!["draft", "sent", "pending_dispatch_approval"].includes(contract.status)) {
        return res.status(400).json({ error: `Cannot dispatch: contract status is '${contract.status}'` });
      }

      const role = req.session!.role;
      const isSuperAdmin = role === "super_admin" || role === "architect";
      const { deliveryMethod, recipientEmail, ccRecipients, note } = req.body;

      if (isSuperAdmin) {
        const method = deliveryMethod || "esign_link";
        if (!["esign_link", "presigned_pdf", "both"].includes(method)) {
          return res.status(400).json({ error: "Invalid delivery method. Use: esign_link | presigned_pdf | both" });
        }

        const { directDispatch } = await import("./documentDispatch");
        const appBase = process.env.APP_URL || `https://${req.headers.host}`;

        const dispatcherUser = await dbStorage.getAdminUser(req.session!.userId);
        const dispatcherName = dispatcherUser ? `${dispatcherUser.firstName} ${dispatcherUser.lastName}` : "Admin";
        const dispatcherEmail = dispatcherUser?.email || "noreply@hirein.com";

        const result = await directDispatch({
          documentType: "contract",
          documentId: req.params.id,
          deliveryMethod: method,
          approvedBy: req.session!.userId,
          approvedByName: dispatcherName,
          approvedByEmail: dispatcherEmail,
          recipientEmail,
          ccRecipients: ccRecipients || [],
          appBase,
        });

        if (!result.success) return res.status(500).json({ error: result.error });

        await dbStorage.updateContract(req.params.id, {
          ccRecipients: (ccRecipients || []) as any,
          dispatchMethod: method,
        } as any);

        return res.json({ success: true, signingUrl: result.signingUrl });
      } else {
        const { requestDispatch } = await import("./documentDispatch");
        const result = await requestDispatch({
          documentType: "contract",
          documentId: req.params.id,
          requestedBy: req.session!.userId,
          ccRecipients: ccRecipients || [],
          note,
          recipientEmail: recipientEmail || undefined,
        });

        if (!result.success) return res.status(500).json({ error: result.error });

        return res.json({ success: true, message: "Dispatch request submitted for approval" });
      }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/contracts/:id/dispatch/approve — super_admin/architect only
  app.post("/api/contracts/:id/dispatch/approve", requirePermission("contracts.dispatch.approve", "super_admin", "architect"), async (req, res) => {
    try {
      const role = req.session!.role;
      if (role !== "super_admin" && role !== "architect") {
        return res.status(403).json({ error: "Only super_admin or architect can approve dispatch requests" });
      }

      const contract = await dbStorage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Contract not found" });
      if (contract.status !== "pending_dispatch_approval") {
        return res.status(400).json({ error: `Contract is not pending dispatch approval (status: ${contract.status})` });
      }

      const { deliveryMethod, recipientEmail } = req.body;
      const method = deliveryMethod || "esign_link";

      const { directDispatch } = await import("./documentDispatch");
      const appBase = process.env.APP_URL || `https://${req.headers.host}`;
      const dispatcherUser = await dbStorage.getAdminUser(req.session!.userId);
      const dispatcherName = dispatcherUser ? `${dispatcherUser.firstName} ${dispatcherUser.lastName}` : "Admin";
      const dispatcherEmail = dispatcherUser?.email || "noreply@hirein.com";

      // Fall back to the recipient email stored at request-for-approval time if approver
      // didn't override it in the approval modal (ensures dispatch works even when the
      // client master record has no email address).
      const resolvedRecipientEmail = recipientEmail || (contract as any).dispatchRecipientEmail || undefined;

      const result = await directDispatch({
        documentType: "contract",
        documentId: req.params.id,
        deliveryMethod: method,
        approvedBy: req.session!.userId,
        approvedByName: dispatcherName,
        approvedByEmail: dispatcherEmail,
        recipientEmail: resolvedRecipientEmail,
        ccRecipients: (contract.ccRecipients as any) || [],
        appBase,
      });

      if (!result.success) return res.status(500).json({ error: result.error });
      res.json({ success: true, signingUrl: result.signingUrl });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/contracts/:id/dispatch/reject — super_admin/architect only
  app.post("/api/contracts/:id/dispatch/reject", requirePermission("contracts.dispatch.reject", "super_admin", "architect"), async (req, res) => {
    try {
      const role = req.session!.role;
      if (role !== "super_admin" && role !== "architect") {
        return res.status(403).json({ error: "Only super_admin or architect can reject dispatch requests" });
      }

      const contract = await dbStorage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Contract not found" });

      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ error: "Rejection reason required" });

      const { rejectDispatch } = await import("./documentDispatch");
      const result = await rejectDispatch({
        documentType: "contract",
        documentId: req.params.id,
        rejectedBy: req.session!.userId,
        reason,
      });

      if (!result.success) return res.status(500).json({ error: result.error });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/contracts/pending-dispatch — list pending_dispatch_approval contracts
  app.get("/api/contracts/pending-dispatch", requireAuth, async (req, res) => {
    try {
      const list = await dbStorage.getContracts({ status: "pending_dispatch_approval" });
      res.json(list);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
