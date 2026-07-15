/**
 * Governance Control Routes
 *
 * Access control uses action-specific permission keys:
 *   governance.manager  — manager/hr/admin/super_admin can view team controls, close, escalate
 *   governance.hr       — hr/admin/super_admin/executive can see all controls, create, resolve disputes
 *   governance.ceo      — super_admin/admin/executive can view the anonymized CEO report
 * All authenticated users can view/submit/dispute their own obligations (no extra permission needed).
 *
 * Object-level checks are enforced on every manager mutation:
 *   - The control must belong to a direct report of the acting manager (or the manager is HR/admin).
 *
 * Row-level enforcement summary:
 *   GET /my               — SQL WHERE owner_id = session.userId                          ✓ server
 *   GET /manager          — SQL WHERE manager_id = session.userId (HR bypasses to all)   ✓ server
 *   GET /manager/:empId   — resolveManagerScopeForEmployee() + SQL WHERE owner_id        ✓ server
 *   GET /admin            — governance.hr permission required (all controls returned)    ✓ server
 *   GET /:id              — owner OR manager OR HR — resolveReadScopeForControl()        ✓ server
 *   GET /:id/events       — same scope as GET /:id                                       ✓ server
 *   GET /ceo-report       — governance.ceo permission, aggregate only                    ✓ server
 *   POST /                — governance.hr permission                                     ✓ server
 *   POST /:id/close       — governance.manager + resolveManagerScopeForControl()         ✓ server
 *   POST /:id/escalate    — governance.manager + resolveManagerScopeForControl()         ✓ server
 *   POST /:id/evidence    — owner_id enforced in submitEmployeeEvidence()                ✓ server
 *   POST /:id/dispute     — owner_id enforced in disputeGovernanceControl()              ✓ server
 *   POST /:id/review-dispute — governance.hr permission                                  ✓ server
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  createGovernanceControl,
  closeGovernanceControl,
  submitEmployeeEvidence,
  disputeGovernanceControl,
  getManagerGovernanceControls,
  getEmployeeGovernanceControls,
  buildCeoReportData,
  reassignGovernanceControl,
} from "./governanceService";
import { emitGovernanceEvent, getControlEventHistory } from "./governanceEvents";
import { resolveRoles } from "@shared/accessControl";
import { buildGovernancePulse, type GovernancePulse } from "./governancePulse";

// ── 5-minute in-memory pulse cache ───────────────────────────────────────────
const PULSE_CACHE_TTL_MS = 5 * 60 * 1000;
let pulseCache: { data: GovernancePulse; expiresAt: number } | null = null;

// ── camelCase normalizer ──────────────────────────────────────────────────────
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function rowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}
function rowsToCamel(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(rowToCamel);
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

function getSession(req: Request, res: Response): { userId: string; role: string } | null {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return { userId: req.session.userId, role: req.session.role! };
}

function checkPermission(req: Request, res: Response, permKey: string): { userId: string; role: string } | null {
  const session = getSession(req, res);
  if (!session) return null;
  const allowed = resolveRoles(permKey, ["super_admin"]);
  if (!allowed.includes(session.role)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return null;
  }
  return session;
}

/**
 * Resolve whether the acting user has manager-scope access to a specific control.
 * HR/admin/super_admin bypass the scope check (they can act on any control).
 * Managers are checked by looking up the control's manager_id.
 */
async function resolveManagerScopeForControl(
  controlId: string,
  userId: string,
  role: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const hrRoles = resolveRoles("governance.hr", ["super_admin"]);
  if (hrRoles.includes(role)) return { allowed: true };

  const row = await db.execute(sql`
    SELECT manager_id FROM governance_controls WHERE id = ${controlId} LIMIT 1
  `);
  if (!row.rows.length) return { allowed: false, reason: "Control not found" };
  const managerId = (row.rows[0] as any).manager_id;
  if (managerId === userId) return { allowed: true };
  return { allowed: false, reason: "You do not manage this employee" };
}

/**
 * Resolve whether the acting user has manager-scope access to view an employee's controls.
 * HR/admin/super_admin bypass the scope check.
 */
async function resolveManagerScopeForEmployee(
  employeeId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  const hrRoles = resolveRoles("governance.hr", ["super_admin"]);
  if (hrRoles.includes(role)) return true;

  const row = await db.execute(sql`
    SELECT id FROM admin_users WHERE id = ${employeeId} AND manager_id = ${userId} AND deleted_at IS NULL LIMIT 1
  `);
  return row.rows.length > 0;
}

/**
 * Resolve read-scope for a single control:
 *   - Owner (employee) can read their own.
 *   - Manager whose manager_id matches can read.
 *   - HR/admin/executive can read any.
 */
async function resolveReadScopeForControl(
  controlId: string,
  userId: string,
  role: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const hrRoles = resolveRoles("governance.hr", ["super_admin"]);
  if (hrRoles.includes(role)) return { allowed: true };

  const row = await db.execute(sql`
    SELECT owner_id, manager_id FROM governance_controls WHERE id = ${controlId} LIMIT 1
  `);
  if (!row.rows.length) return { allowed: false, reason: "Control not found" };
  const { owner_id, manager_id } = row.rows[0] as any;
  if (owner_id === userId || manager_id === userId) return { allowed: true };
  return { allowed: false, reason: "Access denied" };
}

// ── Routes ───────────────────────────────────────────────────────────────────

export function registerGovernanceRoutes(app: Express): void {

  // ── Employee: view own open obligations ───────────────────────────────────
  app.get("/api/governance/my", async (req: Request, res: Response) => {
    const session = getSession(req, res);
    if (!session) return;
    try {
      const rawControls = await getEmployeeGovernanceControls(session.userId);
      const controls = rowsToCamel(rawControls);
      const summary = {
        total: rawControls.length,
        pending: rawControls.filter((c: any) => c.status === "pending").length,
        overdue: rawControls.filter((c: any) => c.status === "overdue").length,
        escalated: rawControls.filter((c: any) => c.status === "escalated").length,
        completed: rawControls.filter((c: any) => ["completed", "closed"].includes(c.status)).length,
        disputed: rawControls.filter((c: any) => c.dispute_note).length,
      };
      res.json({ controls, summary });
    } catch (err) {
      console.error("[governance] GET /my failed:", err);
      res.status(500).json({ error: "Failed to fetch governance obligations" });
    }
  });

  // ── Manager: view open governance controls for their full team ────────────
  app.get("/api/governance/manager", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.manager");
    if (!session) return;
    try {
      const controls = await getManagerGovernanceControls(session.userId);
      res.json(rowsToCamel(controls));
    } catch (err) {
      console.error("[governance] GET /manager failed:", err);
      res.status(500).json({ error: "Failed to fetch governance controls" });
    }
  });

  // ── Manager: view governance controls for a specific employee ──────────────
  app.get("/api/governance/manager/:employeeId", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.manager");
    if (!session) return;
    const { employeeId } = req.params as { employeeId: string };

    const hasScope = await resolveManagerScopeForEmployee(employeeId, session.userId, session.role);
    if (!hasScope) {
      return res.status(403).json({ error: "You do not manage this employee" });
    }

    try {
      const rows = await db.execute(sql`
        SELECT gc.id, gc.control_type, gc.reference_id, gc.due_date, gc.required_action,
               gc.status, gc.evidence_required, gc.evidence_record, gc.exception_reason,
               gc.escalation_level, gc.resolution, gc.closure_date, gc.dispute_note,
               gc.disputed_at, gc.flagged_for_hr_review, gc.created_at, gc.updated_at,
               o.first_name || ' ' || o.last_name AS owner_name,
               o.email AS owner_email,
               o.role AS owner_role,
               o.department_id AS owner_department
        FROM governance_controls gc
        JOIN admin_users o ON o.id = gc.owner_id
        WHERE gc.owner_id = ${employeeId}
        ORDER BY
          CASE gc.status
            WHEN 'escalated' THEN 1 WHEN 'overdue' THEN 2 WHEN 'in_progress' THEN 3
            WHEN 'pending' THEN 4 WHEN 'disputed' THEN 5 WHEN 'completed' THEN 6
            ELSE 7 END,
          gc.due_date ASC
        LIMIT 100
      `);
      const rawControls = rows.rows as any[];
      const controls = rowsToCamel(rawControls);
      const summary = {
        total: rawControls.length,
        pending: rawControls.filter((c) => c.status === "pending").length,
        overdue: rawControls.filter((c) => c.status === "overdue").length,
        escalated: rawControls.filter((c) => c.status === "escalated").length,
        completed: rawControls.filter((c) => ["completed", "closed"].includes(c.status)).length,
        disputed: rawControls.filter((c) => c.dispute_note).length,
      };
      res.json({ controls, summary });
    } catch (err) {
      console.error("[governance] GET /manager/:employeeId failed:", err);
      res.status(500).json({ error: "Failed to fetch employee governance controls" });
    }
  });

  // ── HR/Admin: view all controls (including flagged for review) ────────────
  app.get("/api/governance/admin", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.hr");
    if (!session) return;
    try {
      const { status, flagged } = req.query as { status?: string; flagged?: string };
      const rows = await db.execute(sql`
        SELECT gc.id, gc.control_type, gc.reference_id, gc.due_date, gc.required_action,
               gc.status, gc.evidence_required, gc.evidence_record, gc.exception_reason,
               gc.escalation_level, gc.resolution, gc.closure_date, gc.dispute_note,
               gc.disputed_at, gc.flagged_for_hr_review, gc.created_at, gc.updated_at,
               o.first_name || ' ' || o.last_name AS owner_name,
               o.employee_id AS owner_employee_id,
               o.role AS owner_role,
               o.designation AS owner_designation,
               m.first_name || ' ' || m.last_name AS manager_name,
               d.name AS department_name
        FROM governance_controls gc
        JOIN admin_users o ON o.id = gc.owner_id
        LEFT JOIN admin_users m ON m.id = gc.manager_id
        LEFT JOIN departments d ON d.id = o.department_id
        WHERE (${status ?? null}::text IS NULL OR gc.status::text = ${status ?? null}::text)
          AND (${flagged ?? null}::text IS NULL OR (${flagged ?? null}::text = 'true' AND gc.flagged_for_hr_review = true))
        ORDER BY gc.escalation_level DESC, gc.due_date ASC
        LIMIT 200
      `);
      res.json(rowsToCamel(rows.rows as Record<string, unknown>[]));
    } catch (err) {
      console.error("[governance] GET /admin failed:", err);
      res.status(500).json({ error: "Failed to fetch governance controls" });
    }
  });

  // ── CEO exception report data (anonymized) ────────────────────────────────
  app.get("/api/governance/ceo-report", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.ceo");
    if (!session) return;
    try {
      const reportData = await buildCeoReportData();
      res.json(reportData);
    } catch (err) {
      console.error("[governance] GET /ceo-report failed:", err);
      res.status(500).json({ error: "Failed to build CEO report" });
    }
  });

  // ── Governance Pulse — org-wide health snapshot ───────────────────────────
  // Aggregates SOP, training, plans, probation milestones, goals health split,
  // and check-in compliance into a single structured response.
  // Access: super_admin, admin, hr only. 403 for all other roles.
  // Cached 5 minutes in-memory; bypass with ?refresh=true.
  app.get("/api/governance/pulse", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const role = req.session.role as string;
    const ALLOWED_ROLES = ["super_admin", "admin", "hr"];
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const forceRefresh = req.query.refresh === "true";
    const now = Date.now();

    if (!forceRefresh && pulseCache && pulseCache.expiresAt > now) {
      return res.json(pulseCache.data);
    }

    try {
      const pulse = await buildGovernancePulse();
      pulseCache = { data: pulse, expiresAt: now + PULSE_CACHE_TTL_MS };
      return res.json(pulse);
    } catch (err) {
      console.error("[governance] GET /pulse failed:", err);
      return res.status(500).json({ error: "Failed to build governance pulse" });
    }
  });

  // ── Action Required — urgency-ranked overdue items ────────────────────────
  // Returns overdue/escalated controls ordered by escalation_level DESC, due_date ASC.
  // Access: hr, admin, super_admin, executive.
  app.get("/api/governance/action-required", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.hr");
    if (!session) return;
    try {
      const rows = await db.execute(sql`
        SELECT
          gc.id,
          gc.control_type         AS "controlType",
          gc.reference_id         AS "referenceId",
          gc.owner_id             AS "ownerId",
          gc.manager_id           AS "managerId",
          gc.due_date             AS "dueDate",
          gc.status,
          gc.escalation_level     AS "escalationLevel",
          gc.required_action      AS "requiredAction",
          o.first_name || ' ' || o.last_name AS "ownerName",
          o.email                 AS "ownerEmail",
          m.first_name || ' ' || m.last_name AS "managerName"
        FROM governance_controls gc
        JOIN admin_users o ON o.id = gc.owner_id
        LEFT JOIN admin_users m ON m.id = gc.manager_id
        WHERE gc.status IN ('overdue', 'escalated')
        ORDER BY gc.escalation_level DESC, gc.due_date ASC
        LIMIT 100
      `);
      res.json(rows.rows);
    } catch (err) {
      console.error("[governance] GET /action-required failed:", err);
      res.status(500).json({ error: "Failed to fetch action-required items" });
    }
  });

  // ── Manager breakdown — compliance summary for a manager's team ───────────
  // Access: the manager themselves, or hr/admin/super_admin/executive.
  app.get("/api/governance/manager/:id/breakdown", async (req: Request, res: Response) => {
    const session = getSession(req, res);
    if (!session) return;
    const { id: managerId } = req.params as { id: string };

    const isHrOrAbove = ["hr", "admin", "super_admin", "executive"].includes(session.role);
    const isSelf      = session.userId === managerId;
    const isManager   = session.role === "manager";

    if (!isHrOrAbove && !(isManager && isSelf)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const rows = await db.execute(sql`
        SELECT
          COUNT(*)                                                        AS "totalControls",
          COUNT(*) FILTER (WHERE gc.status IN ('overdue','escalated'))   AS "overdueCount",
          COUNT(*) FILTER (WHERE gc.status IN ('completed','closed'))    AS "completedCount",
          COUNT(*) FILTER (WHERE gc.status IN ('pending','in_progress')) AS "pendingCount",
          COUNT(DISTINCT gc.owner_id)                                    AS "directReportCount",
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE gc.status IN ('completed','closed'))
            / NULLIF(COUNT(*), 0)
          , 1)                                                            AS "complianceRate"
        FROM governance_controls gc
        WHERE gc.manager_id = ${managerId}
          AND gc.status NOT IN ('closed', 'completed')
          OR (gc.manager_id = ${managerId} AND gc.status IN ('closed', 'completed'))
      `);

      const summary = rows.rows[0] as any ?? {
        totalControls: 0, overdueCount: 0, completedCount: 0,
        pendingCount: 0, directReportCount: 0, complianceRate: null,
      };

      const byOwner = await db.execute(sql`
        SELECT
          gc.owner_id             AS "ownerId",
          o.first_name || ' ' || o.last_name AS "ownerName",
          COUNT(*)                AS "total",
          COUNT(*) FILTER (WHERE gc.status IN ('overdue','escalated')) AS "overdue",
          COUNT(*) FILTER (WHERE gc.status IN ('completed','closed'))  AS "completed"
        FROM governance_controls gc
        JOIN admin_users o ON o.id = gc.owner_id
        WHERE gc.manager_id = ${managerId}
        GROUP BY gc.owner_id, o.first_name, o.last_name
        ORDER BY overdue DESC, total DESC
      `);

      res.json({
        managerId,
        totalControls:     Number(summary.totalControls ?? 0),
        overdueCount:      Number(summary.overdueCount ?? 0),
        completedCount:    Number(summary.completedCount ?? 0),
        pendingCount:      Number(summary.pendingCount ?? 0),
        directReportCount: Number(summary.directReportCount ?? 0),
        complianceRate:    summary.complianceRate !== null ? Number(summary.complianceRate) : null,
        byEmployee:        byOwner.rows,
      });
    } catch (err) {
      console.error("[governance] GET /manager/:id/breakdown failed:", err);
      res.status(500).json({ error: "Failed to build manager breakdown" });
    }
  });

  // ── Single control detail (owner, manager, or HR) ─────────────────────────
  // Row-level: owner can read their own; manager can read their team member's;
  // HR/admin/executive can read any.
  app.get("/api/governance/:id", async (req: Request, res: Response) => {
    const session = getSession(req, res);
    if (!session) return;
    const { id } = req.params as { id: string };

    const scope = await resolveReadScopeForControl(id, session.userId, session.role);
    if (!scope.allowed) {
      return res.status(403).json({ error: scope.reason ?? "Access denied" });
    }

    try {
      const rows = await db.execute(sql`
        SELECT gc.id, gc.control_type, gc.reference_id, gc.due_date, gc.required_action,
               gc.status, gc.evidence_required, gc.evidence_record, gc.exception_reason,
               gc.escalation_level, gc.resolution, gc.closure_date, gc.dispute_note,
               gc.disputed_at, gc.flagged_for_hr_review, gc.created_at, gc.updated_at,
               o.first_name || ' ' || o.last_name AS owner_name,
               o.role AS owner_role,
               m.first_name || ' ' || m.last_name AS manager_name,
               d.name AS department_name
        FROM governance_controls gc
        JOIN admin_users o ON o.id = gc.owner_id
        LEFT JOIN admin_users m ON m.id = gc.manager_id
        LEFT JOIN departments d ON d.id = o.department_id
        WHERE gc.id = ${id}
        LIMIT 1
      `);
      if (!rows.rows.length) {
        return res.status(404).json({ error: "Control not found" });
      }
      res.json(rowToCamel(rows.rows[0] as Record<string, unknown>));
    } catch (err) {
      console.error("[governance] GET /:id failed:", err);
      res.status(500).json({ error: "Failed to fetch governance control" });
    }
  });

  // ── Single control event history (same scope as detail read) ─────────────
  app.get("/api/governance/:id/events", async (req: Request, res: Response) => {
    const session = getSession(req, res);
    if (!session) return;
    const { id } = req.params as { id: string };

    const scope = await resolveReadScopeForControl(id, session.userId, session.role);
    if (!scope.allowed) {
      return res.status(403).json({ error: scope.reason ?? "Access denied" });
    }

    try {
      const events = await getControlEventHistory(id);
      res.json(events);
    } catch (err) {
      console.error("[governance] GET /:id/events failed:", err);
      res.status(500).json({ error: "Failed to fetch event history" });
    }
  });

  // ── HR/Admin: manually create a governance control ────────────────────────
  app.post("/api/governance", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.hr");
    if (!session) return;
    const { controlType, referenceId, ownerId, managerId, dueDate, requiredAction, evidenceRequired } = req.body;
    if (!controlType || !ownerId || !dueDate || !requiredAction) {
      return res.status(400).json({ error: "controlType, ownerId, dueDate, requiredAction are required" });
    }
    try {
      const id = await createGovernanceControl({
        controlType, referenceId, ownerId, managerId, dueDate, requiredAction, evidenceRequired: !!evidenceRequired,
      });
      emitGovernanceEvent({
        controlId: id,
        eventType: "created",
        actorId: session.userId,
        source: "user",
        metadata: { controlType, ownerId, managerId: managerId ?? null, dueDate },
      }).catch(console.error);
      res.status(201).json({ id });
    } catch (err) {
      console.error("[governance] POST / failed:", err);
      res.status(500).json({ error: "Failed to create governance control" });
    }
  });

  // ── Manager: close a control ──────────────────────────────────────────────
  app.post("/api/governance/:id/close", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.manager");
    if (!session) return;
    const { id } = req.params as { id: string };

    const scope = await resolveManagerScopeForControl(id, session.userId, session.role);
    if (!scope.allowed) {
      return res.status(403).json({ error: scope.reason ?? "Forbidden" });
    }

    const { evidenceRecord, resolution } = req.body as { evidenceRecord?: string; resolution?: string };
    try {
      const result = await closeGovernanceControl({
        controlId: id,
        closedById: session.userId,
        evidenceRecord,
        resolution,
      });
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[governance] POST /:id/close failed:", err);
      res.status(500).json({ error: "Failed to close governance control" });
    }
  });

  // ── Manager: escalate / flag a control for HR review ─────────────────────
  app.post("/api/governance/:id/escalate", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.manager");
    if (!session) return;
    const { id } = req.params as { id: string };

    const scope = await resolveManagerScopeForControl(id, session.userId, session.role);
    if (!scope.allowed) {
      return res.status(403).json({ error: scope.reason ?? "Forbidden" });
    }

    const { reason } = req.body as { reason?: string };
    try {
      await db.execute(sql`
        UPDATE governance_controls
        SET flagged_for_hr_review = true,
            status = CASE WHEN status NOT IN ('closed','completed','disputed') THEN 'escalated'::governance_control_status ELSE status END,
            exception_reason = COALESCE(exception_reason, ${reason ?? null}),
            escalation_level = GREATEST(escalation_level, 1),
            updated_at = NOW()
        WHERE id = ${id}
      `);
      emitGovernanceEvent({
        controlId: id,
        eventType: "escalated",
        actorId: session.userId,
        source: "user",
        metadata: { reason: reason ?? null, manualEscalation: true },
      }).catch(console.error);
      res.json({ success: true });
    } catch (err) {
      console.error("[governance] POST /:id/escalate failed:", err);
      res.status(500).json({ error: "Failed to escalate control" });
    }
  });

  // ── Employee: submit evidence for their own control ───────────────────────
  app.post("/api/governance/:id/evidence", async (req: Request, res: Response) => {
    const session = getSession(req, res);
    if (!session) return;
    const { id } = req.params as { id: string };
    const { evidenceRecord } = req.body as { evidenceRecord: string };
    if (!evidenceRecord?.trim()) {
      return res.status(400).json({ error: "evidenceRecord is required" });
    }
    try {
      const result = await submitEmployeeEvidence({ controlId: id, userId: session.userId, evidenceRecord });
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true });
    } catch (err) {
      console.error("[governance] POST /:id/evidence failed:", err);
      res.status(500).json({ error: "Failed to submit evidence" });
    }
  });

  // ── Employee: raise a dispute / clarification ─────────────────────────────
  app.post("/api/governance/:id/dispute", async (req: Request, res: Response) => {
    const session = getSession(req, res);
    if (!session) return;
    const { id } = req.params as { id: string };
    const { disputeNote } = req.body as { disputeNote: string };
    if (!disputeNote?.trim()) {
      return res.status(400).json({ error: "disputeNote is required" });
    }
    try {
      const result = await disputeGovernanceControl({ controlId: id, userId: session.userId, disputeNote });
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true });
    } catch (err) {
      console.error("[governance] POST /:id/dispute failed:", err);
      res.status(500).json({ error: "Failed to raise dispute" });
    }
  });

  // ── HR: un-flag a dispute (mark as reviewed) ──────────────────────────────
  app.post("/api/governance/:id/review-dispute", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.hr");
    if (!session) return;
    const { id } = req.params as { id: string };
    const { resolution } = req.body as { resolution?: string };
    try {
      await db.execute(sql`
        UPDATE governance_controls
        SET flagged_for_hr_review = false,
            resolution = ${resolution ?? null},
            updated_at = NOW()
        WHERE id = ${id}
      `);
      emitGovernanceEvent({
        controlId: id,
        eventType: "status_changed",
        actorId: session.userId,
        source: "user",
        metadata: { action: "dispute_reviewed", resolution: resolution ?? null },
      }).catch(console.error);
      res.json({ success: true });
    } catch (err) {
      console.error("[governance] POST /:id/review-dispute failed:", err);
      res.status(500).json({ error: "Failed to review dispute" });
    }
  });

  // ── Governance Hub: Nudge Manager ────────────────────────────────────────
  // In-memory 24h re-nudge guard. Keyed by nudge:{managerId}:{employeeId}:{category}.
  // Resets on server restart — intentional; restart clears stale state anyway.
  const nudgeTtlMap = new Map<string, Date>();

  app.post("/api/governance/nudge", async (req: Request, res: Response) => {
    // governance.hr gate first (covers admin/super_admin/executive/hr), then narrow
    // to admin/super_admin only — HR users have read-only access to the Governance Hub.
    const session = checkPermission(req, res, "governance.hr");
    if (!session) return;
    if (!["admin", "super_admin"].includes(session.role)) {
      return res.status(403).json({ error: "Only admin and super_admin can send nudges" });
    }

    const { actionItemId, managerId, employeeId, category, daysOverdue, strikeCount, context } = req.body as {
      actionItemId?: string;
      managerId: string;
      employeeId?: string;
      category: string;
      daysOverdue?: number;
      strikeCount?: number;
      context?: string;
    };

    if (!managerId || !category) {
      return res.status(400).json({ error: "managerId and category are required" });
    }

    const nudgeKey = `nudge:${managerId}:${employeeId ?? ""}:${category}`;
    const lastNudge = nudgeTtlMap.get(nudgeKey);
    if (lastNudge && Date.now() - lastNudge.getTime() < 24 * 60 * 60 * 1000) {
      return res.json({ sent: false, alreadyNudged: true, sentAt: lastNudge.toISOString() });
    }

    try {
      let employeeName = "the employee";
      if (employeeId) {
        const empRow = (await db.execute(sql`
          SELECT first_name || ' ' || last_name AS full_name FROM admin_users WHERE id = ${employeeId} LIMIT 1
        `)).rows[0] as any;
        employeeName = empRow?.full_name || "the employee";
      }

      const overdueSuffix = daysOverdue && daysOverdue > 0 ? ` (${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue)` : "";
      const strikeSuffix = strikeCount ? ` (strike ${strikeCount} of 3)` : "";

      const MESSAGE_TEMPLATES: Record<string, string> = {
        pip: `Action required: ${employeeName}'s PIP has had no coaching session logged${overdueSuffix}. Please record a coaching note today to keep the plan on track.${context ? " Context: " + context : ""}`,
        checkin: `Check-in compliance alert: you have missed scheduled 1:1 check-ins${overdueSuffix}${strikeSuffix}. Please complete pending check-ins to maintain your team's coaching cadence.${context ? " Context: " + context : ""}`,
        probation: `Probation milestone missed for ${employeeName}${overdueSuffix}${strikeSuffix}. Please update their probation record and log the milestone outcome as soon as possible.${context ? " Context: " + context : ""}`,
        goal: `Goal compliance alert: ${employeeName} has an escalated goal with no coaching action${overdueSuffix}. Please log a coaching entry against this goal today.${context ? " Context: " + context : ""}`,
        sop: `SOP acknowledgment overdue: one or more employees in your team have not acknowledged a required SOP${overdueSuffix}. Please follow up to ensure timely acknowledgment.${context ? " Context: " + context : ""}`,
        training: `Training compliance alert: one or more employees in your team have overdue training assignments${overdueSuffix}. Please follow up to ensure completion.${context ? " Context: " + context : ""}`,
      };

      const message = MESSAGE_TEMPLATES[category] ?? `Governance action required for your team${overdueSuffix}. Please review the Governance Hub and take action.`;
      const { notifyUser } = await import("./notifications");
      await notifyUser({
        userId: managerId,
        type: "governance_overdue",
        title: `Governance Nudge: Action Required`,
        message,
        metadata: { actionItemId, category, employeeId, daysOverdue, strikeCount },
      });

      const sentAt = new Date();
      nudgeTtlMap.set(nudgeKey, sentAt);
      res.json({ sent: true, sentAt: sentAt.toISOString() });
    } catch (err) {
      console.error("[governance] POST /nudge failed:", err);
      res.status(500).json({ error: "Failed to send nudge" });
    }
  });

  // ── Governance Hub: Escalate to HR ───────────────────────────────────────
  // Creates an internal_requests row. Schema type enum has no "governance_escalation"
  // value, so we use type='hr' (closest semantic match) with metadata.subtype =
  // 'governance_escalation' to distinguish these rows.  status='pending_approval'
  // (not "open" which is not in the enum) marks it as new/unreviewed in the HR queue.
  // Idempotent: returns the existing open escalation if one already exists.
  app.post("/api/governance/escalate", async (req: Request, res: Response) => {
    // governance.hr gate first, then narrow to admin/super_admin only — HR is read-only
    // on the Governance Hub and cannot create escalation requests on behalf of others.
    const session = checkPermission(req, res, "governance.hr");
    if (!session) return;
    if (!["admin", "super_admin"].includes(session.role)) {
      return res.status(403).json({ error: "Only admin and super_admin can escalate to HR" });
    }

    const { actionItemId, employeeId, category, description } = req.body as {
      actionItemId?: string;
      employeeId?: string;
      category: string;
      description?: string;
    };

    if (!category) {
      return res.status(400).json({ error: "category is required" });
    }

    try {
      // Check for existing open escalation (idempotency guard)
      const existingRows = await db.execute(sql`
        SELECT id FROM internal_requests
        WHERE type = 'hr'
          AND metadata->>'subtype' = 'governance_escalation'
          AND (${employeeId ?? null}::text IS NULL OR requested_for_id = ${employeeId ?? null}::text)
          AND metadata->>'category' = ${category}
          AND status NOT IN ('resolved', 'closed', 'rejected')
        LIMIT 1
      `);

      if (existingRows.rows.length > 0) {
        const existing = existingRows.rows[0] as any;
        return res.json({ alreadyOpen: true, requestId: existing.id });
      }

      const requestNumber = `GOV-${Date.now().toString(36).toUpperCase()}`;

      const insertResult = await db.execute(sql`
        INSERT INTO internal_requests (
          request_number, requester_id, requested_for_id, type, title, description,
          priority, status, metadata, created_at, updated_at
        ) VALUES (
          ${requestNumber},
          ${session.userId},
          ${employeeId ?? null},
          'hr',
          ${`Governance Escalation: ${category.toUpperCase()}`},
          ${description ?? `Governance compliance issue escalated for HR review (category: ${category})`},
          'p2',
          'pending_approval',
          ${JSON.stringify({ subtype: "governance_escalation", category, actionItemId: actionItemId ?? null })}::jsonb,
          NOW(), NOW()
        )
        RETURNING id
      `);

      const newRow = insertResult.rows[0] as any;
      res.status(201).json({ created: true, requestId: newRow.id });
    } catch (err) {
      console.error("[governance] POST /escalate failed:", err);
      res.status(500).json({ error: "Failed to create escalation" });
    }
  });

  // ── HR: reassign a control to a new owner ─────────────────────────────────
  app.post("/api/governance/:id/reassign", async (req: Request, res: Response) => {
    const session = checkPermission(req, res, "governance.hr");
    if (!session) return;
    const { id } = req.params as { id: string };
    const { newOwnerId, newManagerId, reason } = req.body as {
      newOwnerId: string;
      newManagerId?: string;
      reason?: string;
    };
    if (!newOwnerId) {
      return res.status(400).json({ error: "newOwnerId is required" });
    }
    try {
      const result = await reassignGovernanceControl({
        controlId: id,
        newOwnerId,
        newManagerId,
        actorId: session.userId,
        reason,
      });
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true });
    } catch (err) {
      console.error("[governance] POST /:id/reassign failed:", err);
      res.status(500).json({ error: "Failed to reassign control" });
    }
  });

}
