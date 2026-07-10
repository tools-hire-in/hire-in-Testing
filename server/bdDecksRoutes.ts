import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import PDFDocument from "pdfkit";

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const WHITE = "#FFFFFF";
const TEXT_DARK = "#1a1a1a";
const TEXT_MUTED = "#555555";

const DOMAIN_LABELS: Record<string, string> = {
  healthcare: "Healthcare",
  it: "IT",
  engineering: "Engineering",
  professional_services: "Professional Services",
};

export interface BdSlide {
  title: string;
  bullets: string[];
  speaker_notes: string;
}

export interface BdDeckRow {
  id: string;
  title: string;
  domain: string;
  deck_type: string;
  parent_id: string | null;
  version: string;
  client_name: string | null;
  status: string;
  description: string | null;
  changes_summary: string | null;
  slides: BdSlide[];
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Role helpers ──────────────────────────────────────────────────────────────

/** Any staff member who can access BD content (view/list) */
function requireBdRole(req: Request): boolean {
  const role = (req.session as any)?.role;
  return ["super_admin", "admin", "hr", "manager", "operations", "recruiter"].includes(role);
}

/** Only manager and above can create/clone client decks */
function canCreateClientDeck(req: Request): boolean {
  const role = (req.session as any)?.role;
  return ["super_admin", "admin", "hr", "manager"].includes(role);
}

/** Only super_admin can create/edit/archive master decks */
function isSuperAdmin(req: Request): boolean {
  return (req.session as any)?.role === "super_admin";
}

// ── Audit logger ──────────────────────────────────────────────────────────────

async function logAudit(
  deckId: string,
  action: string,
  req: Request,
  note?: string
) {
  try {
    const actorId = (req.session as any)?.userId ?? null;
    const actorEmail = (req.session as any)?.email ?? null;
    const noteVal = note ?? null;
    await db.execute(sql`
      INSERT INTO bd_deck_audit_log (deck_id, action, actor_id, actor_email, note)
      VALUES (${deckId}, ${action}, ${actorId}, ${actorEmail}, ${noteVal})
    `);
  } catch (err) {
    console.error("[bd-decks] audit log error:", err);
  }
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerBdDecksRoutes(app: Express) {

  // GET /api/bd/decks — list decks with optional query filters: domain, deck_type, status
  app.get("/api/bd/decks", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!requireBdRole(req)) return res.status(403).json({ error: "Insufficient permissions" });

    try {
      const { domain, deck_type, status } = req.query as Record<string, string | undefined>;

      // Build parameterised query incrementally using drizzle tagged templates
      // We branch on filter combinations to keep each branch fully typed.
      let result;

      if (domain && deck_type && status) {
        result = await db.execute(sql`
          SELECT * FROM bd_decks
          WHERE domain = ${domain} AND deck_type = ${deck_type} AND status = ${status}
          ORDER BY deck_type ASC, domain ASC, version DESC, updated_at DESC`);
      } else if (domain && deck_type) {
        result = await db.execute(sql`
          SELECT * FROM bd_decks
          WHERE domain = ${domain} AND deck_type = ${deck_type} AND status != 'archived'
          ORDER BY deck_type ASC, domain ASC, version DESC, updated_at DESC`);
      } else if (domain && status) {
        result = await db.execute(sql`
          SELECT * FROM bd_decks
          WHERE domain = ${domain} AND status = ${status}
          ORDER BY deck_type ASC, domain ASC, version DESC, updated_at DESC`);
      } else if (deck_type && status) {
        result = await db.execute(sql`
          SELECT * FROM bd_decks
          WHERE deck_type = ${deck_type} AND status = ${status}
          ORDER BY deck_type ASC, domain ASC, version DESC, updated_at DESC`);
      } else if (domain) {
        result = await db.execute(sql`
          SELECT * FROM bd_decks
          WHERE domain = ${domain} AND status != 'archived'
          ORDER BY deck_type ASC, domain ASC, version DESC, updated_at DESC`);
      } else if (deck_type) {
        result = await db.execute(sql`
          SELECT * FROM bd_decks
          WHERE deck_type = ${deck_type} AND status != 'archived'
          ORDER BY deck_type ASC, domain ASC, version DESC, updated_at DESC`);
      } else if (status) {
        result = await db.execute(sql`
          SELECT * FROM bd_decks
          WHERE status = ${status}
          ORDER BY deck_type ASC, domain ASC, version DESC, updated_at DESC`);
      } else {
        result = await db.execute(sql`
          SELECT * FROM bd_decks
          WHERE status != 'archived'
          ORDER BY deck_type ASC, domain ASC, version DESC, updated_at DESC`);
      }

      res.json(result.rows);
    } catch (err: any) {
      console.error("[bd-decks] list error:", err);
      res.status(500).json({ error: err?.message || "Failed to list decks" });
    }
  });

  // GET /api/bd/decks/pending — super_admin approval queue
  app.get("/api/bd/decks/pending", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Super admin only" });

    try {
      const result = await db.execute(sql`
        SELECT * FROM bd_decks
        WHERE status = 'pending_approval' AND deck_type = 'client'
        ORDER BY updated_at ASC
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[bd-decks] pending error:", err);
      res.status(500).json({ error: err?.message || "Failed to list pending decks" });
    }
  });

  // GET /api/bd/decks/:id — single deck
  app.get("/api/bd/decks/:id", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!requireBdRole(req)) return res.status(403).json({ error: "Insufficient permissions" });

    try {
      const result = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      if (result.rows.length === 0) return res.status(404).json({ error: "Deck not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("[bd-decks] get error:", err);
      res.status(500).json({ error: err?.message || "Failed to get deck" });
    }
  });

  // GET /api/bd/decks/:id/audit — audit log for a deck
  app.get("/api/bd/decks/:id/audit", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!requireBdRole(req)) return res.status(403).json({ error: "Insufficient permissions" });

    try {
      const result = await db.execute(sql`
        SELECT * FROM bd_deck_audit_log
        WHERE deck_id = ${req.params.id}
        ORDER BY created_at DESC
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[bd-decks] audit error:", err);
      res.status(500).json({ error: err?.message || "Failed to get audit log" });
    }
  });

  // POST /api/bd/decks — create master deck (super_admin only)
  app.post("/api/bd/decks", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Super admin only can create master decks" });

    try {
      const userId = (req.session as any).userId;
      const { title, domain, version, description, slides } = req.body;

      if (!title?.trim()) return res.status(400).json({ error: "title is required" });
      const validDomains = ["healthcare", "it", "engineering", "professional_services"];
      if (!validDomains.includes(domain)) return res.status(400).json({ error: "Invalid domain" });

      const slidesJson = JSON.stringify(Array.isArray(slides) ? slides : []);
      const descVal = description?.trim() || null;

      const result = await db.execute(sql`
        INSERT INTO bd_decks (title, domain, deck_type, version, status, description, slides, created_by)
        VALUES (
          ${title.trim()}, ${domain}, 'master',
          ${version || "v1"}, 'draft', ${descVal}, ${slidesJson}::jsonb, ${userId}
        )
        RETURNING *
      `);

      const deck = result.rows[0] as BdDeckRow;
      await logAudit(deck.id, "created_master", req, `Master deck created: ${deck.title}`);
      res.status(201).json(deck);
    } catch (err: any) {
      console.error("[bd-decks] create error:", err);
      res.status(500).json({ error: err?.message || "Failed to create deck" });
    }
  });

  // POST /api/bd/decks/:id/clone — clone master as client deck (manager+)
  app.post("/api/bd/decks/:id/clone", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!canCreateClientDeck(req)) return res.status(403).json({ error: "Manager or above required to create client decks" });

    try {
      const userId = (req.session as any).userId;
      const { client_name, description } = req.body;

      if (!client_name?.trim()) return res.status(400).json({ error: "client_name is required" });

      const masterResult = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      if (masterResult.rows.length === 0) return res.status(404).json({ error: "Master deck not found" });

      const master = masterResult.rows[0] as BdDeckRow;
      if (master.deck_type !== "master") return res.status(400).json({ error: "Can only clone master decks" });

      const now = new Date();
      const monthName = now.toLocaleDateString("en-US", { month: "short" });
      const year = now.getFullYear();
      const domainLabel = DOMAIN_LABELS[master.domain] || master.domain;
      const deckTitle = `${client_name.trim()} · ${domainLabel} · ${monthName} ${year}`;
      const slidesJson = JSON.stringify(master.slides || []);
      const descVal = description?.trim() || null;

      const result = await db.execute(sql`
        INSERT INTO bd_decks (title, domain, deck_type, parent_id, version, client_name, status, description, slides, created_by)
        VALUES (
          ${deckTitle}, ${master.domain}, 'client', ${master.id},
          ${master.version}, ${client_name.trim()}, 'draft',
          ${descVal}, ${slidesJson}::jsonb, ${userId}
        )
        RETURNING *
      `);

      const deck = result.rows[0] as BdDeckRow;
      await logAudit(deck.id, "cloned_from_master", req, `Cloned from master: "${master.title}" (${master.version})`);
      res.status(201).json(deck);
    } catch (err: any) {
      console.error("[bd-decks] clone error:", err);
      res.status(500).json({ error: err?.message || "Failed to clone deck" });
    }
  });

  // PATCH /api/bd/decks/:id — update slides, status, title, description, changes_summary
  app.patch("/api/bd/decks/:id", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!requireBdRole(req)) return res.status(403).json({ error: "Insufficient permissions" });

    try {
      const deckResult = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      if (deckResult.rows.length === 0) return res.status(404).json({ error: "Deck not found" });
      const deck = deckResult.rows[0] as BdDeckRow;

      // Master decks: super_admin only
      if (deck.deck_type === "master" && !isSuperAdmin(req)) {
        return res.status(403).json({ error: "Only super admin can edit master decks" });
      }

      // Client decks that are pending approval or approved: super_admin only to change slides
      if (deck.deck_type === "client" && ["pending_approval", "approved"].includes(deck.status)) {
        if (!isSuperAdmin(req)) {
          return res.status(403).json({ error: "Deck is locked. Only super admin can edit after submission." });
        }
      }

      const { slides, title, description, changes_summary } = req.body;
      const auditNotes: string[] = [];

      if (slides !== undefined) {
        const slidesJson = JSON.stringify(Array.isArray(slides) ? slides : []);
        await db.execute(sql`UPDATE bd_decks SET slides = ${slidesJson}::jsonb, updated_at = NOW() WHERE id = ${req.params.id}`);
        auditNotes.push("slides updated");
      }
      if (title !== undefined && String(title).trim()) {
        const t = String(title).trim();
        await db.execute(sql`UPDATE bd_decks SET title = ${t}, updated_at = NOW() WHERE id = ${req.params.id}`);
        auditNotes.push(`title → "${t}"`);
      }
      if (description !== undefined) {
        const d = description?.trim() || null;
        await db.execute(sql`UPDATE bd_decks SET description = ${d}, updated_at = NOW() WHERE id = ${req.params.id}`);
        auditNotes.push("description updated");
      }
      if (changes_summary !== undefined) {
        const c = changes_summary?.trim() || null;
        await db.execute(sql`UPDATE bd_decks SET changes_summary = ${c}, updated_at = NOW() WHERE id = ${req.params.id}`);
        auditNotes.push("changes summary updated");
      }

      if (auditNotes.length > 0) {
        await logAudit(req.params.id, "edited", req, auditNotes.join("; "));
      }

      const updated = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      res.json(updated.rows[0]);
    } catch (err: any) {
      console.error("[bd-decks] update error:", err);
      res.status(500).json({ error: err?.message || "Failed to update deck" });
    }
  });

  // POST /api/bd/decks/:id/submit-approval — client deck: submit for super_admin approval
  app.post("/api/bd/decks/:id/submit-approval", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!canCreateClientDeck(req)) return res.status(403).json({ error: "Manager or above required" });

    try {
      const deckResult = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      if (deckResult.rows.length === 0) return res.status(404).json({ error: "Deck not found" });
      const deck = deckResult.rows[0] as BdDeckRow;

      if (deck.deck_type !== "client") return res.status(400).json({ error: "Only client decks need approval" });
      if (deck.status !== "draft") return res.status(400).json({ error: "Only draft decks can be submitted for approval" });

      await db.execute(sql`UPDATE bd_decks SET status = 'pending_approval', updated_at = NOW() WHERE id = ${req.params.id}`);
      await logAudit(req.params.id, "submitted_for_approval", req, req.body?.note || null);

      const updated = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      res.json(updated.rows[0]);
    } catch (err: any) {
      console.error("[bd-decks] submit-approval error:", err);
      res.status(500).json({ error: err?.message || "Failed to submit for approval" });
    }
  });

  // POST /api/bd/decks/:id/approve — super_admin approves a client deck
  app.post("/api/bd/decks/:id/approve", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Super admin only can approve decks" });

    try {
      const deckResult = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      if (deckResult.rows.length === 0) return res.status(404).json({ error: "Deck not found" });
      const deck = deckResult.rows[0] as BdDeckRow;

      if (deck.deck_type !== "client") return res.status(400).json({ error: "Only client decks require approval" });
      if (deck.status !== "pending_approval") return res.status(400).json({ error: "Deck is not pending approval" });

      const actorId = (req.session as any).userId;
      await db.execute(sql`
        UPDATE bd_decks
        SET status = 'approved', approved_by = ${actorId}, approved_at = NOW(), updated_at = NOW()
        WHERE id = ${req.params.id}
      `);
      await logAudit(req.params.id, "approved", req, req.body?.note || "Approved for client distribution");

      const updated = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      res.json(updated.rows[0]);
    } catch (err: any) {
      console.error("[bd-decks] approve error:", err);
      res.status(500).json({ error: err?.message || "Failed to approve deck" });
    }
  });

  // POST /api/bd/decks/:id/revoke-approval — super_admin revokes approval (back to draft)
  app.post("/api/bd/decks/:id/revoke-approval", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Super admin only" });

    try {
      const deckResult = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      if (deckResult.rows.length === 0) return res.status(404).json({ error: "Deck not found" });
      const deck = deckResult.rows[0] as BdDeckRow;

      if (!["approved", "pending_approval"].includes(deck.status)) {
        return res.status(400).json({ error: "Deck is not in an approvable state" });
      }

      await db.execute(sql`
        UPDATE bd_decks
        SET status = 'draft', approved_by = NULL, approved_at = NULL, updated_at = NOW()
        WHERE id = ${req.params.id}
      `);
      await logAudit(req.params.id, "approval_revoked", req, req.body?.note || "Reverted to draft");

      const updated = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      res.json(updated.rows[0]);
    } catch (err: any) {
      console.error("[bd-decks] revoke error:", err);
      res.status(500).json({ error: err?.message || "Failed to revoke approval" });
    }
  });

  // DELETE /api/bd/decks/:id — soft archive
  app.delete("/api/bd/decks/:id", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const deckResult = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      if (deckResult.rows.length === 0) return res.status(404).json({ error: "Deck not found" });
      const deck = deckResult.rows[0] as BdDeckRow;

      // Masters: super_admin only; client decks: creator or manager+
      if (deck.deck_type === "master" && !isSuperAdmin(req)) {
        return res.status(403).json({ error: "Only super admin can archive master decks" });
      }
      if (deck.deck_type === "client" && !canCreateClientDeck(req)) {
        return res.status(403).json({ error: "Manager or above required to archive client decks" });
      }

      await db.execute(sql`UPDATE bd_decks SET status = 'archived', updated_at = NOW() WHERE id = ${req.params.id}`);
      await logAudit(req.params.id, "archived", req);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[bd-decks] delete error:", err);
      res.status(500).json({ error: err?.message || "Failed to archive deck" });
    }
  });

  // GET /api/bd/decks/:id/pdf — generate PDF export
  // Client decks: must be approved (super_admin can always download)
  app.get("/api/bd/decks/:id/pdf", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!requireBdRole(req)) return res.status(403).json({ error: "Insufficient permissions" });

    try {
      const result = await db.execute(sql`SELECT * FROM bd_decks WHERE id = ${req.params.id} LIMIT 1`);
      if (result.rows.length === 0) return res.status(404).json({ error: "Deck not found" });

      const deck = result.rows[0] as BdDeckRow;

      // Gate PDF for client decks — only approved (or super_admin bypass)
      if (deck.deck_type === "client" && deck.status !== "approved" && !isSuperAdmin(req)) {
        return res.status(403).json({
          error: "This deck has not been approved for distribution. Submit it for approval first.",
        });
      }

      const slides: BdSlide[] = Array.isArray(deck.slides) ? deck.slides : [];
      const domainLabel = DOMAIN_LABELS[deck.domain] || deck.domain;
      const showNotes = req.query.notes === "1";

      const pdfBuffer = await generateDeckPdf(deck, slides, domainLabel, showNotes);

      await logAudit(req.params.id, "downloaded_pdf", req);

      const safeName = deck.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_").slice(0, 60);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_${deck.version}.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[bd-decks] pdf error:", err);
      res.status(500).json({ error: err?.message || "Failed to generate PDF" });
    }
  });
}

// ── PDF generator ─────────────────────────────────────────────────────────────

async function generateDeckPdf(deck: BdDeckRow, slides: BdSlide[], domainLabel: string, showNotes: boolean): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ml = doc.page.margins.left;
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    function drawNavyHeader() {
      doc.rect(0, 0, doc.page.width, 52).fill(NAVY);
    }

    function drawHeaderContent(slideNum: number, total: number) {
      drawNavyHeader();
      doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(12).text("Hire'in", ml, 16, { lineBreak: false });
      doc.fillColor(WHITE).font("Helvetica").fontSize(10).text(" Solutions", ml + 42, 17, { lineBreak: false });
      const titleX = ml + 120;
      doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(9).text(deck.title, titleX, 12, { width: pageW - 200, lineBreak: false });
      const meta = `${domainLabel}  ·  ${deck.version.toUpperCase()}`;
      doc.fillColor(ORANGE).font("Helvetica").fontSize(7.5).text(meta, titleX, 26, { lineBreak: false });
      const counterTxt = `${slideNum} / ${total}`;
      doc.fillColor(WHITE).font("Helvetica").fontSize(8.5).text(counterTxt, doc.page.width - doc.page.margins.right - 50, 20, { width: 50, align: "right", lineBreak: false });
    }

    // ── Cover ──
    drawNavyHeader();
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(11).text("Hire'in Solutions", ml, 16, { lineBreak: false });
    const coverY = 72;
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text(deck.title, ml, coverY, { width: pageW });
    const afterTitle = doc.y + 8;
    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(14).text(`${domainLabel}  ·  ${deck.version.toUpperCase()}`, ml, afterTitle, { width: pageW });
    if (deck.client_name) {
      doc.fillColor(TEXT_DARK).font("Helvetica-Bold").fontSize(11).text(`Prepared for: ${deck.client_name}`, ml, doc.y + 8, { width: pageW });
    }
    if (deck.description) {
      doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(9).text(deck.description, ml, doc.y + 6, { width: pageW });
    }
    if (deck.status === "approved") {
      doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(8).text("✓ Approved for distribution", ml, doc.y + 6, { width: pageW });
    }

    doc.moveTo(ml, doc.page.height - 50).lineTo(ml + pageW, doc.page.height - 50).lineWidth(1).strokeColor(ORANGE).stroke();
    const coverDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(8).text(`Confidential · ${coverDate}`, ml, doc.page.height - 42, { width: pageW });

    // ── Slides ──
    slides.forEach((slide, idx) => {
      doc.addPage();
      drawHeaderContent(idx + 1, slides.length);

      const slideY = 64;
      doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(8).text(`SLIDE ${idx + 1} OF ${slides.length}`, ml, slideY, { lineBreak: false });
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(16).text(slide.title, ml, slideY + 14, { width: pageW });

      let bulletY = doc.y + 10;
      const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
      const notesAreaH = showNotes && slide.speaker_notes ? 90 : 0;
      const availH = doc.page.height - doc.page.margins.bottom - bulletY - notesAreaH - 30;

      bullets.forEach((bullet, bi) => {
        if (doc.y - slideY > availH && bi > 0) return;
        doc.circle(ml + 4, bulletY + 5.5, 3).fill(ORANGE);
        doc.fillColor(TEXT_DARK).font("Helvetica").fontSize(10).text(bullet, ml + 14, bulletY, { width: pageW - 14 });
        bulletY = doc.y + 6;
      });

      if (showNotes && slide.speaker_notes) {
        const notesY = doc.page.height - doc.page.margins.bottom - notesAreaH;
        doc.moveTo(ml, notesY - 6).lineTo(ml + pageW, notesY - 6).lineWidth(0.5).strokeColor(ORANGE).stroke();
        doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(7.5).text("SPEAKER NOTES", ml, notesY, { lineBreak: false });
        doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(8).text(slide.speaker_notes, ml, notesY + 10, { width: pageW, height: notesAreaH - 14 });
      }

      doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(7.5).text("Confidential — Hire'in Solutions", ml, doc.page.height - 26, { width: pageW / 2, lineBreak: false });
      doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(7.5).text(`Slide ${idx + 1} of ${slides.length}`, ml + pageW / 2, doc.page.height - 26, { width: pageW / 2, align: "right", lineBreak: false });
    });

    doc.end();
  });
}
