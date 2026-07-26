import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";

function requireAuth(req: Request, res: Response, next: any) {
  if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requirePermission(...roles: string[]) {
  return (req: Request, res: Response, next: any) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (roles.includes((req.session as any).role)) return next();
    return res.status(403).json({ error: "Insufficient permissions" });
  };
}

// ─── Pipeline Summary (used by BD Agent context injection) ────────────────────

export async function getBdPipelineSummaryData() {
  const now = new Date();

  // Open deals grouped by stage with total value
  const dealsByStage = await db.execute(sql`
    SELECT
      stage,
      COUNT(*) AS deal_count,
      COALESCE(SUM(deal_value), 0) AS total_value,
      COALESCE(AVG(probability), 0) AS avg_probability
    FROM bd_deals
    WHERE stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY stage
    ORDER BY stage
  `);

  // Prospects not contacted in 14+ days (or never contacted)
  const staleProspects = await db.execute(sql`
    SELECT
      p.id,
      p.company_name,
      p.status,
      p.industry,
      p.last_activity_at,
      au.first_name || ' ' || au.last_name AS assigned_to_name
    FROM bd_prospects p
    LEFT JOIN admin_users au ON au.id = p.assigned_to
    WHERE p.status NOT IN ('closed_won', 'closed_lost')
      AND (p.last_activity_at IS NULL OR p.last_activity_at < NOW() - INTERVAL '14 days')
    ORDER BY p.last_activity_at ASC NULLS FIRST
    LIMIT 20
  `);

  // Contracts expiring within 90 days
  const expiringContracts = await db.execute(sql`
    SELECT
      c.id,
      c.client_name,
      c.contract_end_date AS end_date,
      c.status,
      c.bill_rate,
      c.contract_type,
      jsonb_array_length(COALESCE(c.candidates, '[]'::jsonb)) AS headcount
    FROM contracts c
    WHERE c.contract_end_date IS NOT NULL
      AND c.contract_end_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      AND c.status NOT IN ('terminated', 'cancelled')
    ORDER BY c.contract_end_date ASC
    LIMIT 20
  `);

  // Lapsed clients (contracts expired 90+ days ago, no active contract)
  const lapsedClients = await db.execute(sql`
    SELECT
      client_name,
      MAX(contract_end_date) AS last_contract_end,
      COUNT(*) AS contract_count
    FROM contracts
    WHERE contract_end_date IS NOT NULL
      AND contract_end_date::date < CURRENT_DATE - INTERVAL '90 days'
    GROUP BY client_name
    HAVING MAX(contract_end_date) = (
      SELECT MAX(c2.contract_end_date) FROM contracts c2
      WHERE c2.client_name = contracts.client_name
    )
    AND NOT EXISTS (
      SELECT 1 FROM contracts c3
      WHERE c3.client_name = contracts.client_name
        AND (c3.contract_end_date IS NULL OR c3.contract_end_date::date >= CURRENT_DATE - INTERVAL '90 days')
    )
    ORDER BY last_contract_end DESC
    LIMIT 15
  `);

  // Revenue by specialty from active contracts (bill_rate × 40h/week estimate per contract)
  const revenueBySpecialty = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(specialty), ''), 'Unspecified') AS specialty,
      COUNT(*) AS active_contract_count,
      COALESCE(SUM(bill_rate::numeric), 0) AS total_bill_rate_sum,
      COALESCE(AVG(bill_rate::numeric), 0) AS avg_bill_rate,
      COALESCE(SUM(bill_rate::numeric * 40), 0) AS est_weekly_revenue
    FROM contracts
    WHERE status NOT IN ('terminated', 'cancelled')
      AND (contract_end_date IS NULL OR contract_end_date::date >= CURRENT_DATE)
      AND bill_rate IS NOT NULL
    GROUP BY COALESCE(NULLIF(TRIM(specialty), ''), 'Unspecified')
    ORDER BY est_weekly_revenue DESC
    LIMIT 15
  `);

  // Overdue invoices
  const overdueInvoices = await db.execute(sql`
    SELECT
      ci.id,
      c.client_name,
      ci.amount,
      ci.due_date,
      ci.status,
      (CURRENT_DATE - ci.due_date::date) AS days_overdue
    FROM contract_invoices ci
    JOIN contracts c ON c.id = ci.contract_id
    WHERE ci.status IN ('sent', 'overdue')
      AND ci.due_date::date < CURRENT_DATE
    ORDER BY ci.due_date ASC
    LIMIT 15
  `).catch(() => ({ rows: [] }));

  // Total open pipeline value
  const pipelineTotal = await db.execute(sql`
    SELECT
      COUNT(*) AS open_deal_count,
      COALESCE(SUM(deal_value), 0) AS total_pipeline_value,
      COALESCE(SUM(deal_value * probability / 100), 0) AS weighted_pipeline_value
    FROM bd_deals
    WHERE stage NOT IN ('closed_won', 'closed_lost')
  `);

  // Active prospect counts
  const prospectCounts = await db.execute(sql`
    SELECT status, COUNT(*) AS count
    FROM bd_prospects
    GROUP BY status
  `);

  return {
    dealsByStage: dealsByStage.rows,
    staleProspects: staleProspects.rows,
    expiringContracts: expiringContracts.rows,
    lapsedClients: lapsedClients.rows,
    overdueInvoices: overdueInvoices.rows,
    revenueBySpecialty: revenueBySpecialty.rows,
    pipelineTotal: pipelineTotal.rows[0] || {},
    prospectCounts: prospectCounts.rows,
    generatedAt: now.toISOString(),
  };
}

export function registerBdPipelineRoutes(app: Express) {
  const BD_ROLES = ["super_admin", "admin", "operations", "manager"];
  const requireBd = requirePermission(...BD_ROLES);

  // ─── PIPELINE SUMMARY ───────────────────────────────────────────────────────

  app.get("/api/bd/pipeline/summary", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const data = await getBdPipelineSummaryData();
      res.json(data);
    } catch (err: any) {
      console.error("[bd-pipeline] summary error:", err);
      res.status(500).json({ error: err?.message || "Failed to get pipeline summary" });
    }
  });

  // ─── PROSPECTS ──────────────────────────────────────────────────────────────

  app.get("/api/bd/pipeline/prospects", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const { search, status, assignedTo } = req.query as Record<string, string>;

      let query = `
        SELECT
          p.*,
          au.first_name || ' ' || au.last_name AS assigned_to_name,
          au.email AS assigned_to_email,
          cb.first_name || ' ' || cb.last_name AS created_by_name,
          COUNT(DISTINCT d.id)::int AS deal_count,
          COUNT(DISTINCT a.id)::int AS activity_count
        FROM bd_prospects p
        LEFT JOIN admin_users au ON au.id = p.assigned_to
        LEFT JOIN admin_users cb ON cb.id = p.created_by
        LEFT JOIN bd_deals d ON d.prospect_id = p.id
        LEFT JOIN bd_activities a ON a.prospect_id = p.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIdx = 1;

      if (search) {
        query += ` AND (p.company_name ILIKE $${paramIdx} OR p.contact_name ILIKE $${paramIdx} OR p.contact_email ILIKE $${paramIdx})`;
        params.push(`%${search}%`);
        paramIdx++;
      }
      if (status) {
        query += ` AND p.status = $${paramIdx}`;
        params.push(status);
        paramIdx++;
      }
      if (assignedTo) {
        query += ` AND p.assigned_to = $${paramIdx}`;
        params.push(assignedTo);
        paramIdx++;
      }

      query += ` GROUP BY p.id, au.first_name, au.last_name, au.email, cb.first_name, cb.last_name ORDER BY p.updated_at DESC`;

      const { pool } = await import("./db");
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[bd-pipeline] list prospects error:", err);
      res.status(500).json({ error: err?.message || "Failed to list prospects" });
    }
  });

  app.get("/api/bd/pipeline/prospects/:id", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT
          p.*,
          au.first_name || ' ' || au.last_name AS assigned_to_name,
          au.email AS assigned_to_email,
          cb.first_name || ' ' || cb.last_name AS created_by_name
        FROM bd_prospects p
        LEFT JOIN admin_users au ON au.id = p.assigned_to
        LEFT JOIN admin_users cb ON cb.id = p.created_by
        WHERE p.id = ${req.params.id}
        LIMIT 1
      `);
      if (!result.rows.length) return res.status(404).json({ error: "Prospect not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to get prospect" });
    }
  });

  app.post("/api/bd/pipeline/prospects", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const {
        companyName, contactName, contactEmail, contactPhone,
        industry, source, status, icpScore, assignedTo, notes,
      } = req.body;

      if (!companyName?.trim()) return res.status(400).json({ error: "companyName is required" });

      const result = await db.execute(sql`
        INSERT INTO bd_prospects (
          company_name, contact_name, contact_email, contact_phone,
          industry, source, status, icp_score, assigned_to, notes,
          created_by, created_at, updated_at
        ) VALUES (
          ${companyName.trim()},
          ${contactName?.trim() || null},
          ${contactEmail?.trim() || null},
          ${contactPhone?.trim() || null},
          ${industry || null},
          ${source || null},
          ${status || "new"},
          ${icpScore != null ? Number(icpScore) : null},
          ${assignedTo || null},
          ${notes?.trim() || null},
          ${userId},
          NOW(), NOW()
        )
        RETURNING *
      `);
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("[bd-pipeline] create prospect error:", err);
      res.status(500).json({ error: err?.message || "Failed to create prospect" });
    }
  });

  app.patch("/api/bd/pipeline/prospects/:id", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const {
        companyName, contactName, contactEmail, contactPhone,
        industry, source, status, icpScore, assignedTo, linkedClientId, notes,
      } = req.body;

      const existing = await db.execute(sql`SELECT id FROM bd_prospects WHERE id = ${req.params.id} LIMIT 1`);
      if (!existing.rows.length) return res.status(404).json({ error: "Prospect not found" });

      await db.execute(sql`
        UPDATE bd_prospects SET
          company_name = COALESCE(${companyName?.trim() || null}, company_name),
          contact_name = COALESCE(${contactName?.trim() ?? null}, contact_name),
          contact_email = COALESCE(${contactEmail?.trim() ?? null}, contact_email),
          contact_phone = COALESCE(${contactPhone?.trim() ?? null}, contact_phone),
          industry = COALESCE(${industry ?? null}, industry),
          source = COALESCE(${source ?? null}, source),
          status = COALESCE(${status ?? null}, status),
          icp_score = COALESCE(${icpScore != null ? Number(icpScore) : null}, icp_score),
          assigned_to = COALESCE(${assignedTo ?? null}, assigned_to),
          linked_client_id = COALESCE(${linkedClientId ?? null}, linked_client_id),
          notes = COALESCE(${notes?.trim() ?? null}, notes),
          updated_at = NOW()
        WHERE id = ${req.params.id}
      `);

      const updated = await db.execute(sql`
        SELECT p.*, au.first_name || ' ' || au.last_name AS assigned_to_name
        FROM bd_prospects p
        LEFT JOIN admin_users au ON au.id = p.assigned_to
        WHERE p.id = ${req.params.id} LIMIT 1
      `);
      res.json(updated.rows[0]);
    } catch (err: any) {
      console.error("[bd-pipeline] update prospect error:", err);
      res.status(500).json({ error: err?.message || "Failed to update prospect" });
    }
  });

  app.delete("/api/bd/pipeline/prospects/:id", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const existing = await db.execute(sql`SELECT id FROM bd_prospects WHERE id = ${req.params.id} LIMIT 1`);
      if (!existing.rows.length) return res.status(404).json({ error: "Prospect not found" });
      await db.execute(sql`DELETE FROM bd_prospects WHERE id = ${req.params.id}`);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete prospect" });
    }
  });

  // ─── DEALS ──────────────────────────────────────────────────────────────────

  app.get("/api/bd/pipeline/deals", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const { prospectId, stage, specialty } = req.query as Record<string, string>;

      let whereClause = "WHERE 1=1";
      const conditions: string[] = [];

      const result = await db.execute(sql`
        SELECT
          d.*,
          p.company_name AS prospect_company_name,
          au.first_name || ' ' || au.last_name AS assigned_to_name
        FROM bd_deals d
        JOIN bd_prospects p ON p.id = d.prospect_id
        LEFT JOIN admin_users au ON au.id = d.assigned_to
        WHERE (${prospectId || null}::varchar IS NULL OR d.prospect_id = ${prospectId || null})
          AND (${stage || null}::varchar IS NULL OR d.stage = ${stage || null})
          AND (${specialty || null}::varchar IS NULL OR d.specialty = ${specialty || null})
        ORDER BY d.created_at DESC
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[bd-pipeline] list deals error:", err);
      res.status(500).json({ error: err?.message || "Failed to list deals" });
    }
  });

  app.post("/api/bd/pipeline/deals", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const {
        prospectId, title, stage, dealValue, headcount, specialty,
        probability, expectedCloseDate, assignedTo, lostReason,
      } = req.body;

      if (!prospectId) return res.status(400).json({ error: "prospectId is required" });
      if (!title?.trim()) return res.status(400).json({ error: "title is required" });

      // Verify prospect exists
      const prospectCheck = await db.execute(sql`SELECT id FROM bd_prospects WHERE id = ${prospectId} LIMIT 1`);
      if (!prospectCheck.rows.length) return res.status(404).json({ error: "Prospect not found" });

      const stageVal = stage || "discovery";
      const wonAt = stageVal === "closed_won" ? new Date().toISOString() : null;
      const lostAt = stageVal === "closed_lost" ? new Date().toISOString() : null;

      const result = await db.execute(sql`
        INSERT INTO bd_deals (
          prospect_id, title, stage, deal_value, headcount, specialty,
          probability, expected_close_date, won_at, lost_at, lost_reason,
          assigned_to, created_by, created_at, updated_at
        ) VALUES (
          ${prospectId}, ${title.trim()}, ${stageVal},
          ${dealValue != null ? String(dealValue) : null},
          ${headcount != null ? Number(headcount) : null},
          ${specialty || null},
          ${probability != null ? Number(probability) : null},
          ${expectedCloseDate || null},
          ${wonAt}, ${lostAt},
          ${lostReason?.trim() || null},
          ${assignedTo || userId},
          ${userId}, NOW(), NOW()
        )
        RETURNING *
      `);
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("[bd-pipeline] create deal error:", err);
      res.status(500).json({ error: err?.message || "Failed to create deal" });
    }
  });

  app.patch("/api/bd/pipeline/deals/:id", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const { title, stage, dealValue, headcount, specialty, probability, expectedCloseDate, assignedTo, lostReason } = req.body;

      const existing = await db.execute(sql`SELECT id, stage FROM bd_deals WHERE id = ${req.params.id} LIMIT 1`);
      if (!existing.rows.length) return res.status(404).json({ error: "Deal not found" });

      const stageVal = stage ?? (existing.rows[0] as any).stage;
      const wonAt = stageVal === "closed_won" ? new Date().toISOString() : null;
      const lostAt = stageVal === "closed_lost" ? new Date().toISOString() : null;

      await db.execute(sql`
        UPDATE bd_deals SET
          title = COALESCE(${title?.trim() || null}, title),
          stage = COALESCE(${stageVal || null}, stage),
          deal_value = COALESCE(${dealValue != null ? String(dealValue) : null}, deal_value),
          headcount = COALESCE(${headcount != null ? Number(headcount) : null}, headcount),
          specialty = COALESCE(${specialty ?? null}, specialty),
          probability = COALESCE(${probability != null ? Number(probability) : null}, probability),
          expected_close_date = COALESCE(${expectedCloseDate ?? null}, expected_close_date),
          won_at = CASE WHEN ${stageVal} = 'closed_won' THEN NOW() ELSE won_at END,
          lost_at = CASE WHEN ${stageVal} = 'closed_lost' THEN NOW() ELSE lost_at END,
          lost_reason = COALESCE(${lostReason?.trim() ?? null}, lost_reason),
          assigned_to = COALESCE(${assignedTo ?? null}, assigned_to),
          updated_at = NOW()
        WHERE id = ${req.params.id}
      `);

      const updated = await db.execute(sql`SELECT * FROM bd_deals WHERE id = ${req.params.id} LIMIT 1`);
      res.json(updated.rows[0]);
    } catch (err: any) {
      console.error("[bd-pipeline] update deal error:", err);
      res.status(500).json({ error: err?.message || "Failed to update deal" });
    }
  });

  app.delete("/api/bd/pipeline/deals/:id", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const existing = await db.execute(sql`SELECT id FROM bd_deals WHERE id = ${req.params.id} LIMIT 1`);
      if (!existing.rows.length) return res.status(404).json({ error: "Deal not found" });
      await db.execute(sql`DELETE FROM bd_deals WHERE id = ${req.params.id}`);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete deal" });
    }
  });

  // ─── ACTIVITIES ─────────────────────────────────────────────────────────────

  app.get("/api/bd/pipeline/activities", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const { prospectId, dealId } = req.query as Record<string, string>;

      const result = await db.execute(sql`
        SELECT
          a.*,
          au.first_name || ' ' || au.last_name AS logged_by_name,
          p.company_name AS prospect_company_name
        FROM bd_activities a
        LEFT JOIN admin_users au ON au.id = a.logged_by
        LEFT JOIN bd_prospects p ON p.id = a.prospect_id
        WHERE (${prospectId || null}::varchar IS NULL OR a.prospect_id = ${prospectId || null})
          AND (${dealId || null}::varchar IS NULL OR a.deal_id = ${dealId || null})
        ORDER BY a.activity_date DESC, a.created_at DESC
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[bd-pipeline] list activities error:", err);
      res.status(500).json({ error: err?.message || "Failed to list activities" });
    }
  });

  app.post("/api/bd/pipeline/activities", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { prospectId, dealId, activityType, subject, body, durationMinutes, outcome, activityDate } = req.body;

      if (!activityType) return res.status(400).json({ error: "activityType is required" });
      if (!subject?.trim()) return res.status(400).json({ error: "subject is required" });
      if (!activityDate) return res.status(400).json({ error: "activityDate is required" });
      if (!prospectId && !dealId) return res.status(400).json({ error: "prospectId or dealId is required" });

      // Insert activity
      const result = await db.execute(sql`
        INSERT INTO bd_activities (
          prospect_id, deal_id, activity_type, subject, body,
          duration_minutes, outcome, activity_date, logged_by, created_at
        ) VALUES (
          ${prospectId || null}, ${dealId || null},
          ${activityType}, ${subject.trim()}, ${body?.trim() || null},
          ${durationMinutes != null ? Number(durationMinutes) : null},
          ${outcome || null}, ${activityDate}, ${userId}, NOW()
        )
        RETURNING *
      `);

      // Update last_activity_at on the prospect
      let targetProspectId: string | null = prospectId || null;
      if (!targetProspectId && dealId) {
        const dealRow = await db.execute(sql`SELECT prospect_id FROM bd_deals WHERE id = ${dealId} LIMIT 1`);
        targetProspectId = (dealRow.rows[0] as any)?.prospect_id || null;
      }

      if (targetProspectId) {
        await db.execute(sql`
          UPDATE bd_prospects
          SET last_activity_at = NOW(), updated_at = NOW()
          WHERE id = ${targetProspectId}
        `);
      }

      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("[bd-pipeline] create activity error:", err);
      res.status(500).json({ error: err?.message || "Failed to log activity" });
    }
  });

  app.delete("/api/bd/pipeline/activities/:id", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      await db.execute(sql`DELETE FROM bd_activities WHERE id = ${req.params.id}`);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete activity" });
    }
  });

  // ─── CONTRACT CLIENTS (for close-won linking) ────────────────────────────────

  // POST /api/bd/pipeline/contract-clients — create a new contract client
  app.post("/api/bd/pipeline/contract-clients", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const { name, address, ein, signatoryName, signatoryTitle, email, phone, website } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "name is required" });
      const result = await db.execute(sql`
        INSERT INTO contract_clients (name, address, ein, signatory_name, signatory_title, email, phone, website)
        VALUES (${name.trim()}, ${address ?? null}, ${ein ?? null}, ${signatoryName ?? null},
                ${signatoryTitle ?? null}, ${email ?? null}, ${phone ?? null}, ${website ?? null})
        RETURNING id, name
      `);
      const row = result.rows[0];
      if (!row) return res.status(500).json({ error: "Insert did not return a row" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to create client" });
    }
  });

  app.get("/api/bd/pipeline/contract-clients", requireAuth, requireBd, async (req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT id, name, industry, contact_email, contact_name, is_active
        FROM contract_clients
        WHERE is_active = true
        ORDER BY name ASC
      `);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to get contract clients" });
    }
  });
}
