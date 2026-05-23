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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const objectStorageService = new ObjectStorageService();

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const role = req.session.role;
    if (role === "super_admin" || role === "admin" || roles.includes(role!)) return next();
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

  app.post("/api/contracts/templates", requireRole("hr", "operations"), upload.single("file"), async (req, res) => {
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
        filePath,
        placeholderList: placeholders,
        uploadedBy: req.session!.userId,
      });
      res.status(201).json(template);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/contracts/templates/:id", requireRole("hr", "operations"), async (req, res) => {
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

  app.post("/api/contracts/clients", requireRole("hr", "operations"), async (req, res) => {
    try {
      if (!req.body.name) return res.status(400).json({ error: "Client name required" });
      const client = await dbStorage.createContractClient(req.body);
      res.status(201).json(client);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/contracts/clients/:id", requireRole("hr", "operations"), async (req, res) => {
    try {
      const client = await dbStorage.updateContractClient(req.params.id, req.body);
      if (!client) return res.status(404).json({ error: "Client not found" });
      res.json(client);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/contracts/clients/:id/status", requireRole("hr", "operations"), async (req, res) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive must be a boolean" });
      const client = await dbStorage.toggleContractClientStatus(req.params.id, isActive);
      if (!client) return res.status(404).json({ error: "Client not found" });
      res.json(client);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/contracts/clients/:id", requireRole("hr", "operations"), async (req, res) => {
    res.status(405).json({ error: "Hard deletion of clients is disabled. Use PATCH /status to deactivate." });
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
  app.post("/api/contracts", requireRole("hr", "operations", "manager"), async (req, res) => {
    try {
      const {
        templateId, clientId, clientName, candidateName, candidateRole,
        variableValues, contractStartDate, contractEndDate, marginPerHour,
        paymentTermsDays, billingFrequency, notes, templateName,
      } = req.body;

      if (!clientName) return res.status(400).json({ error: "Client name required" });

      let docxPath: string | null = null;

      if (templateId) {
        const tmpl = await dbStorage.getContractTemplate(templateId);
        if (!tmpl) return res.status(404).json({ error: "Template not found" });

        // Fetch template file
        const tmplBuffer = await objectStorageService.downloadBuffer(tmpl.filePath);
        const rendered = renderTemplate(tmplBuffer, variableValues || {});

        const outPath = `.private/contracts/${Date.now()}_${clientName.replace(/\s+/g, "_")}.docx`;
        docxPath = await objectStorageService.uploadBuffer(rendered, outPath,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        await dbStorage.incrementContractTemplateUsage(templateId);
      }

      const contract = await dbStorage.createContract({
        source: "generated",
        templateId: templateId || null,
        clientId: clientId || null,
        templateName: templateName || null,
        clientName,
        candidateName: candidateName || null,
        candidateRole: candidateRole || null,
        variableValues: variableValues || {},
        docxPath,
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        marginPerHour: marginPerHour || null,
        paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : null,
        billingFrequency: billingFrequency || null,
        notes: notes || null,
        createdBy: req.session!.userId,
      });

      res.status(201).json(contract);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Upload an existing/imported contract
  app.post("/api/contracts/import", requireRole("hr", "operations", "manager"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const { clientName, clientId, candidateName, candidateRole, contractStartDate, contractEndDate,
        marginPerHour, paymentTermsDays, billingFrequency, notes } = req.body;
      if (!clientName) return res.status(400).json({ error: "Client name required" });

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
        marginPerHour: marginPerHour || null,
        paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : null,
        billingFrequency: billingFrequency || null,
        notes: notes || null,
        status: "countersigned",
        createdBy: req.session!.userId,
      });

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

  // Send (or resend) contract for client signing
  app.post("/api/contracts/:id/send", requireRole("hr", "operations"), async (req, res) => {
    try {
      const contract = await dbStorage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Not found" });
      if (contract.source === "imported") return res.status(400).json({ error: "Imported contracts do not use the signing workflow" });
      if (!["draft", "sent"].includes(contract.status)) {
        return res.status(400).json({ error: `Cannot send: contract status is '${contract.status}'. Only draft or sent contracts can be (re)sent.` });
      }

      const token = generateToken();
      const appBase = process.env.APP_URL || `https://${req.headers.host}`;
      const signingUrl = `${appBase}/contracts/sign/${token}`;

      await dbStorage.updateContract(contract.id, {
        signingToken: token,
        status: "sent",
        sentAt: new Date(),
      });

      const clientEmail = req.body.clientEmail || (contract.clientId
        ? (await dbStorage.getContractClient(contract.clientId))?.email
        : null);

      if (clientEmail) {
        await sendContractSigningEmail({
          to: clientEmail,
          clientName: contract.clientName,
          candidateName: contract.candidateName || undefined,
          signingUrl,
        });
      }

      res.json({ success: true, signingUrl });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Public: load contract signing page data (returns data for any valid token; status communicated in payload)
  app.get("/api/contracts/sign/:token", async (req, res) => {
    try {
      const contract = await dbStorage.getContractByToken(req.params.token);
      if (!contract) return res.status(404).json({ error: "Contract not found or link expired" });
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

      const authCode = generateAuthCode();
      const hashInput = `${contract.id}:${contract.clientName}:${new Date().toISOString()}`;
      const documentHash = computeHash(hashInput);

      await dbStorage.updateContract(contract.id, {
        status: "client_signed",
        clientSignedAt: new Date(),
        clientSignedIp: req.ip || "",
        authCode,
        documentHash,
      });

      res.json({ success: true, authCode });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // HR counter-signs (only allowed after client has signed)
  app.post("/api/contracts/:id/countersign", requireRole("hr"), async (req, res) => {
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
  app.patch("/api/contracts/:id", requireRole("hr", "operations"), async (req, res) => {
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

  app.post("/api/contracts/:id/invoices", requireRole("hr", "operations"), async (req, res) => {
    try {
      const invoice = await dbStorage.createContractInvoice({
        contractId: req.params.id,
        ...req.body,
        createdBy: req.session!.userId,
      });
      res.status(201).json(invoice);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/contracts/invoices/:id", requireRole("hr", "operations"), async (req, res) => {
    try {
      const invoice = await dbStorage.updateContractInvoice(req.params.id, req.body);
      if (!invoice) return res.status(404).json({ error: "Not found" });
      res.json(invoice);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/contracts/invoices/:id", requireRole("hr", "operations"), async (req, res) => {
    try {
      await dbStorage.deleteContractInvoice(req.params.id);
      res.status(204).send();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
