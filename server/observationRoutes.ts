/**
 * Observation Tower — backend routes
 *
 * 5 endpoints:
 *   GET  /api/observation/pulse                — plan/check-in health pulse + governance exception categories
 *   GET  /api/observation/compliance-radar     — SOP / training / policy compliance + ceipal sync health
 *   GET  /api/observation/exit-signals         — early-warning signals (stalled PIPs, declining check-ins, expiring plans)
 *   POST /api/observation/signal-action        — create_goal | add_coaching_note
 *   GET  /api/observation/company-goal-templates — seeded org-level goal template catalogue
 *
 * Role rules:
 *   super_admin / admin   → scope=org by default; ?scope=team accepted
 *   manager               → scope always forced to team (own direct reports only)
 *   hr                    → signal-action + company-goal-templates only; 403 on data endpoints
 *   all other roles       → 403 on all endpoints
 */

import { type Express, type Request, type Response } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { requireAuth } from "./auth";
import { buildCeoReportData } from "./governanceService";
import { normalizeGoalCategory } from "./performanceRoutes";

type Role =
  | "super_admin"
  | "admin"
  | "hr"
  | "manager"
  | "operations"
  | "employee"
  | "recruiter"
  | "finance"
  | "executive";

const ORG_ROLES: Role[] = ["super_admin", "admin"];
const DATA_ROLES: Role[] = ["super_admin", "admin", "manager"];
const ACTION_ROLES: Role[] = ["super_admin", "admin", "manager"];
const TEMPLATE_ROLES: Role[] = ["super_admin", "admin", "hr", "manager"];

function getRole(req: Request): Role {
  return (req.session as any)?.role as Role;
}

function getUserId(req: Request): string {
  return (req.session as any)?.userId as string;
}

/**
 * Resolves scope from the request:
 *  - super_admin/admin: org by default, team if ?scope=team
 *  - manager: always team (own direct reports)
 * Returns { scopeType, teamIds } where teamIds=null means org (no filter).
 */
async function resolveScope(
  req: Request,
): Promise<{ scopeType: "org" | "team"; teamIds: string[] | null }> {
  const role = getRole(req);
  const userId = getUserId(req);
  const requestedScope = (req.query.scope as string) ?? "org";

  if (ORG_ROLES.includes(role as any) && requestedScope !== "team") {
    return { scopeType: "org", teamIds: null };
  }

  const rows = await db.execute(sql`
    SELECT id FROM admin_users
    WHERE manager_id = ${userId}
      AND deleted_at IS NULL
      AND is_active = true
  `);
  const teamIds = (rows.rows as any[]).map((r) => r.id as string);
  return { scopeType: "team", teamIds };
}

// ─── Pulse ────────────────────────────────────────────────────────────────────

async function getPulse(req: Request, res: Response) {
  const role = getRole(req);
  if (!DATA_ROLES.includes(role as any)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { scopeType, teamIds } = await resolveScope(req);

  // Plan counts per type: active (not date-overdue), overdue (past end_date), escalated (governance)
  const planScopeFilter =
    scopeType === "team"
      ? sql`AND ep.employee_id = ANY(${teamIds!}::varchar[])`
      : sql``;

  const planRows = scopeType === "team" && teamIds!.length === 0
    ? { rows: [] }
    : await db.execute(sql`
        SELECT
          ep.plan_type,
          COUNT(*) FILTER (
            WHERE ep.status IN ('active', 'extended')
              AND (ep.end_date IS NULL OR ep.end_date::date >= CURRENT_DATE)
          )::int AS active_count,
          COUNT(*) FILTER (
            WHERE ep.status IN ('active', 'extended')
              AND ep.end_date IS NOT NULL
              AND ep.end_date::date < CURRENT_DATE
          )::int AS overdue_count,
          COUNT(*) FILTER (
            WHERE ep.status IN ('active', 'extended')
              AND EXISTS (
                SELECT 1 FROM governance_controls gc
                WHERE gc.reference_id IN (
                  'prob:' || ep.id,
                  'pip:' || ep.id,
                  'growth:' || ep.id
                )
                AND gc.status = 'escalated'
              )
          )::int AS escalated_count
        FROM employee_plans ep
        JOIN admin_users au ON au.id = ep.employee_id
        WHERE au.is_active = true
          AND au.deleted_at IS NULL
          AND ep.employee_id IS NOT NULL
          ${planScopeFilter}
        GROUP BY ep.plan_type
        ORDER BY ep.plan_type
      `);

  // Overdue check-ins: scheduled_date < today and status != 'completed'
  const overdueCheckInsResult = scopeType === "team" && teamIds!.length === 0
    ? { rows: [{ cnt: 0 }] }
    : await db.execute(
        scopeType === "team"
          ? sql`
              SELECT COUNT(*)::int AS cnt
              FROM check_ins ci
              WHERE ci.status != 'completed'
                AND ci.scheduled_date < CURRENT_DATE::text
                AND ci.employee_id = ANY(${teamIds!}::varchar[])
            `
          : sql`
              SELECT COUNT(*)::int AS cnt
              FROM check_ins ci
              WHERE ci.status != 'completed'
                AND ci.scheduled_date < CURRENT_DATE::text
            `,
      );

  // Governance exception categories — only meaningful at org scope;
  // for team scope we return the governance summary scoped to the team.
  let exceptionCategories: any[] = [];
  let governanceSummary: any = null;

  if (scopeType === "org") {
    try {
      const ceoData = await buildCeoReportData();
      exceptionCategories = ceoData.exceptionCategories;
      governanceSummary = {
        totalOpen: ceoData.totalOpen,
        totalOverdue: ceoData.totalOverdue,
        totalEscalated: ceoData.totalEscalated,
        totalDisputed: ceoData.totalDisputed,
        confirmedNonCompliance: ceoData.semanticSummary.confirmedNonCompliance,
      };
    } catch (err) {
      console.warn("[observation/pulse] buildCeoReportData error (non-fatal):", err);
    }
  } else {
    // Team-scoped governance: per-control_type exception category breakdown
    const gcResult = teamIds!.length === 0
      ? { rows: [] }
      : await db.execute(sql`
          SELECT
            gc.control_type,
            COUNT(*) FILTER (WHERE gc.status NOT IN ('closed','completed'))::int AS open,
            COUNT(*) FILTER (WHERE gc.status = 'overdue')::int AS overdue,
            COUNT(*) FILTER (WHERE gc.status = 'escalated')::int AS escalated,
            COUNT(*) FILTER (WHERE gc.dispute_note IS NOT NULL)::int AS disputed
          FROM governance_controls gc
          WHERE gc.owner_id = ANY(${teamIds!}::varchar[])
          GROUP BY gc.control_type
          ORDER BY open DESC
        `);
    exceptionCategories = (gcResult.rows as any[]).map((r) => ({
      controlType: r.control_type,
      open: Number(r.open ?? 0),
      overdue: Number(r.overdue ?? 0),
      escalated: Number(r.escalated ?? 0),
      disputed: Number(r.disputed ?? 0),
    }));
    const totals = exceptionCategories.reduce(
      (acc, c) => ({
        totalOpen: acc.totalOpen + c.open,
        totalOverdue: acc.totalOverdue + c.overdue,
        totalEscalated: acc.totalEscalated + c.escalated,
      }),
      { totalOpen: 0, totalOverdue: 0, totalEscalated: 0 },
    );
    governanceSummary = totals;
  }

  const plansByType: Record<string, { active: number; overdue: number; escalated: number }> = {};
  for (const row of planRows.rows as any[]) {
    plansByType[row.plan_type] = {
      active: Number(row.active_count ?? 0),
      overdue: Number(row.overdue_count ?? 0),
      escalated: Number(row.escalated_count ?? 0),
    };
  }

  return res.json({
    scopeType,
    plansByType,
    overdueCheckIns: Number((overdueCheckInsResult.rows[0] as any)?.cnt ?? 0),
    governanceSummary,
    exceptionCategories,
  });
}

// ─── Compliance Radar ────────────────────────────────────────────────────────

async function getComplianceRadar(req: Request, res: Response) {
  const role = getRole(req);
  if (!DATA_ROLES.includes(role as any)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { scopeType, teamIds } = await resolveScope(req);

  const userIdFilter =
    scopeType === "team"
      ? sql`AND au.id = ANY(${teamIds!}::varchar[])`
      : sql``;

  // Total active employees in scope (excluding super_admin)
  const totalResult = scopeType === "team" && teamIds!.length === 0
    ? { rows: [{ cnt: 0 }] }
    : await db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM admin_users au
        WHERE au.is_active = true
          AND au.deleted_at IS NULL
          AND au.role NOT IN ('super_admin')
          ${userIdFilter}
      `);
  const totalEmployees = Number((totalResult.rows[0] as any)?.cnt ?? 0);

  // ── SOP overall: employees who acked at least one active-wave SOP ──────────
  const sopOverallResult = scopeType === "team" && teamIds!.length === 0
    ? { rows: [{ acked_employees: 0 }] }
    : await db.execute(
        scopeType === "team"
          ? sql`
              SELECT COUNT(DISTINCT sep.user_id)::int AS acked_employees
              FROM sop_employee_progress sep
              JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
                AND ws.operational_at IS NOT NULL
              WHERE sep.acknowledged_at IS NOT NULL
                AND sep.user_id = ANY(${teamIds!}::varchar[])
            `
          : sql`
              SELECT COUNT(DISTINCT sep.user_id)::int AS acked_employees
              FROM sop_employee_progress sep
              JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
                AND ws.operational_at IS NOT NULL
              WHERE sep.acknowledged_at IS NOT NULL
            `,
      );
  const ackedEmployees = Number((sopOverallResult.rows[0] as any)?.acked_employees ?? 0);

  // ── SOP per-wave breakdown (scope-aware) ──────────────────────────────────
  const waveBreakdownResult = scopeType === "team" && teamIds!.length === 0
    ? { rows: [] }
    : await db.execute(
        scopeType === "team"
          ? sql`
              SELECT
                rw.wave_number,
                rw.name AS wave_name,
                rw.status AS wave_status,
                COUNT(DISTINCT ws.sop_master_id)::int AS total_sops,
                COALESCE(
                  (
                    SELECT COUNT(DISTINCT sep2.user_id)::int
                    FROM wave_sops ws2
                    JOIN sop_employee_progress sep2
                      ON sep2.sop_master_id = ws2.sop_master_id
                     AND sep2.acknowledged_at IS NOT NULL
                     AND sep2.user_id = ANY(${teamIds!}::varchar[])
                    WHERE ws2.wave_number = rw.wave_number
                      AND ws2.operational_at IS NOT NULL
                  ), 0
                ) AS acked_users
              FROM rollout_waves rw
              LEFT JOIN wave_sops ws ON ws.wave_number = rw.wave_number
                AND ws.operational_at IS NOT NULL
              GROUP BY rw.wave_number, rw.name, rw.status
              ORDER BY rw.wave_number
            `
          : sql`
              SELECT
                rw.wave_number,
                rw.name AS wave_name,
                rw.status AS wave_status,
                COUNT(DISTINCT ws.sop_master_id)::int AS total_sops,
                COALESCE(
                  (
                    SELECT COUNT(DISTINCT sep2.user_id)::int
                    FROM wave_sops ws2
                    JOIN sop_employee_progress sep2
                      ON sep2.sop_master_id = ws2.sop_master_id
                     AND sep2.acknowledged_at IS NOT NULL
                    WHERE ws2.wave_number = rw.wave_number
                      AND ws2.operational_at IS NOT NULL
                  ), 0
                ) AS acked_users
              FROM rollout_waves rw
              LEFT JOIN wave_sops ws ON ws.wave_number = rw.wave_number
                AND ws.operational_at IS NOT NULL
              GROUP BY rw.wave_number, rw.name, rw.status
              ORDER BY rw.wave_number
            `,
      );

  const waves = (waveBreakdownResult.rows as any[]).map((w) => ({
    waveNumber: w.wave_number,
    waveName: w.wave_name,
    waveStatus: w.wave_status,
    totalSops: w.total_sops,
    ackedUsers: w.acked_users,
    avgAckPct: totalEmployees > 0
      ? Math.round((Number(w.acked_users) / totalEmployees) * 100)
      : 0,
  }));

  // ── Training: employees with ALL required tracks complete ──────────────────
  const trainingResult = scopeType === "team" && teamIds!.length === 0
    ? { rows: [{ completed_employees: 0, total_assignments: 0, completed_assignments: 0 }] }
    : await db.execute(
        scopeType === "team"
          ? sql`
              SELECT
                COUNT(DISTINCT ta.user_id) FILTER (
                  WHERE NOT EXISTS (
                    SELECT 1 FROM track_assignments ta2
                    WHERE ta2.user_id = ta.user_id
                      AND ta2.status NOT IN ('completed','excepted')
                  )
                )::int AS completed_employees,
                COUNT(*)::int AS total_assignments,
                COUNT(*) FILTER (WHERE ta.status IN ('completed','excepted'))::int AS completed_assignments
              FROM track_assignments ta
              WHERE ta.user_id = ANY(${teamIds!}::varchar[])
            `
          : sql`
              SELECT
                COUNT(DISTINCT ta.user_id) FILTER (
                  WHERE NOT EXISTS (
                    SELECT 1 FROM track_assignments ta2
                    WHERE ta2.user_id = ta.user_id
                      AND ta2.status NOT IN ('completed','excepted')
                  )
                )::int AS completed_employees,
                COUNT(*)::int AS total_assignments,
                COUNT(*) FILTER (WHERE ta.status IN ('completed','excepted'))::int AS completed_assignments
              FROM track_assignments ta
              JOIN admin_users au ON au.id = ta.user_id
              WHERE au.is_active = true AND au.deleted_at IS NULL
            `,
      );
  const trainRow = (trainingResult.rows[0] as any) ?? {};
  const completedEmployees = Number(trainRow.completed_employees ?? 0);
  const totalAssignments = Number(trainRow.total_assignments ?? 0);
  const completedAssignments = Number(trainRow.completed_assignments ?? 0);

  // ── Policy sign-off count ─────────────────────────────────────────────────
  const policyResult = scopeType === "team" && teamIds!.length === 0
    ? { rows: [{ signed: 0 }] }
    : await db.execute(
        scopeType === "team"
          ? sql`
              SELECT COUNT(DISTINCT pa.user_id)::int AS signed
              FROM policy_acknowledgements pa
              WHERE pa.user_id = ANY(${teamIds!}::varchar[])
            `
          : sql`
              SELECT COUNT(DISTINCT pa.user_id)::int AS signed
              FROM policy_acknowledgements pa
            `,
      );
  const policySigned = Number((policyResult.rows[0] as any)?.signed ?? 0);

  // ── Ceipal sync health (last 7 days) ─────────────────────────────────────
  let ceipalSyncHealth: { lastSyncDate: string | null; successCount: number; errorCount: number } | null = null;
  try {
    const ceipalResult = await db.execute(sql`
      SELECT
        MAX(log_date::text) AS last_sync_date,
        COUNT(*) FILTER (WHERE status IN ('confirmed','confirmed_unverified','confirmed_no_evidence'))::int AS success_count,
        COUNT(*) FILTER (WHERE status IN ('deferred','skipped'))::int AS error_count
      FROM ceipal_update_logs
      WHERE log_date >= CURRENT_DATE - INTERVAL '7 days'
    `);
    const cRow = (ceipalResult.rows[0] as any) ?? {};
    ceipalSyncHealth = {
      lastSyncDate: cRow.last_sync_date ?? null,
      successCount: Number(cRow.success_count ?? 0),
      errorCount: Number(cRow.error_count ?? 0),
    };
  } catch (_) {
    ceipalSyncHealth = null;
  }

  return res.json({
    scopeType,
    totalEmployees,
    sop: {
      ackedAtLeastOne: ackedEmployees,
      percentAcked: totalEmployees > 0
        ? Math.round((ackedEmployees / totalEmployees) * 100)
        : 0,
      perWave: waves,
    },
    training: {
      totalAssignments,
      completedAssignments,
      completedEmployees,
      percentEmployeesComplete: totalEmployees > 0
        ? Math.round((completedEmployees / totalEmployees) * 100)
        : 0,
    },
    policy: {
      signed: policySigned,
      percentSigned: totalEmployees > 0
        ? Math.round((policySigned / totalEmployees) * 100)
        : 0,
    },
    ceipalSyncHealth,
  });
}

// ─── Exit Signals ─────────────────────────────────────────────────────────────

async function getExitSignals(req: Request, res: Response) {
  const role = getRole(req);
  if (!DATA_ROLES.includes(role as any)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { scopeType, teamIds } = await resolveScope(req);

  // Declining check-ins: employees whose LAST 3 completed check-ins ALL have rating < 3
  const decliningFilter =
    scopeType === "team"
      ? sql`AND ci_inner.employee_id = ANY(${teamIds!}::varchar[])`
      : sql``;

  const decliningResult = scopeType === "team" && teamIds!.length === 0
    ? { rows: [] }
    : await db.execute(sql`
        WITH ranked AS (
          SELECT
            ci_inner.employee_id,
            ci_inner.rating,
            ROW_NUMBER() OVER (
              PARTITION BY ci_inner.employee_id
              ORDER BY ci_inner.completed_at DESC NULLS LAST, ci_inner.created_at DESC
            ) AS rn
          FROM check_ins ci_inner
          WHERE ci_inner.status = 'completed'
            AND ci_inner.rating IS NOT NULL
            ${decliningFilter}
        )
        SELECT
          r.employee_id,
          au.first_name || ' ' || au.last_name AS employee_name,
          COALESCE(d.name, 'Unknown') AS department,
          au.manager_id,
          COALESCE(m.first_name || ' ' || m.last_name, 'N/A') AS manager_name,
          array_agg(r.rating ORDER BY r.rn)::int[] AS ratings
        FROM ranked r
        JOIN admin_users au ON au.id = r.employee_id AND au.deleted_at IS NULL
        LEFT JOIN departments d ON d.id = au.department_id
        LEFT JOIN admin_users m ON m.id = au.manager_id
        WHERE r.rn <= 3
        GROUP BY r.employee_id, au.first_name, au.last_name, d.name, au.manager_id,
                 m.first_name, m.last_name
        HAVING COUNT(*) = 3 AND MAX(r.rating) < 3
        ORDER BY MIN(r.rating)
      `);

  // Stalled PIPs: active PIP plans with no coaching_log_entries in the past 10 days
  const pipFilter =
    scopeType === "team"
      ? sql`AND ep.employee_id = ANY(${teamIds!}::varchar[])`
      : sql``;

  const stalledPipsResult = scopeType === "team" && teamIds!.length === 0
    ? { rows: [] }
    : await db.execute(sql`
        SELECT
          ep.id AS plan_id,
          ep.employee_id,
          ep.end_date,
          au.first_name || ' ' || au.last_name AS employee_name,
          COALESCE(latest_note.last_note_date, ep.created_at::date::text) AS last_coaching_date,
          (CURRENT_DATE - COALESCE(latest_note.last_note_date::date, ep.created_at::date))::int AS days_since_last_note
        FROM employee_plans ep
        JOIN admin_users au ON au.id = ep.employee_id AND au.deleted_at IS NULL
        LEFT JOIN (
          SELECT cle.plan_id, MAX(cle.created_at)::date::text AS last_note_date
          FROM coaching_log_entries cle
          GROUP BY cle.plan_id
        ) latest_note ON latest_note.plan_id = ep.id
        WHERE ep.plan_type = 'pip'
          AND ep.status = 'active'
          AND (CURRENT_DATE - COALESCE(latest_note.last_note_date::date, ep.created_at::date)) > 10
          ${pipFilter}
        ORDER BY days_since_last_note DESC
      `);

  // Expiring plans: employee_plans where end_date within 14 days, outcome is NULL
  const expiringFilter =
    scopeType === "team"
      ? sql`AND ep.employee_id = ANY(${teamIds!}::varchar[])`
      : sql``;

  const expiringPlansResult = scopeType === "team" && teamIds!.length === 0
    ? { rows: [] }
    : await db.execute(sql`
        SELECT
          ep.id AS plan_id,
          ep.plan_type,
          ep.employee_id,
          ep.end_date,
          au.first_name || ' ' || au.last_name AS employee_name,
          (ep.end_date::date - CURRENT_DATE)::int AS days_remaining
        FROM employee_plans ep
        JOIN admin_users au ON au.id = ep.employee_id AND au.deleted_at IS NULL
        WHERE ep.status = 'active'
          AND ep.outcome IS NULL
          AND ep.end_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
          ${expiringFilter}
        ORDER BY ep.end_date ASC
      `);

  return res.json({
    scopeType,
    decliningCheckIns: decliningResult.rows,
    stalledPips: stalledPipsResult.rows,
    expiringPlans: expiringPlansResult.rows,
  });
}

// ─── Signal Action ────────────────────────────────────────────────────────────

async function postSignalAction(req: Request, res: Response) {
  const role = getRole(req);
  if (!ACTION_ROLES.includes(role as any)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const userId = getUserId(req);
  const { action, employeeId, context, planId } = req.body as {
    action: string;
    employeeId: string;
    context: string;
    planId?: string;
  };

  if (!action || !employeeId || !context) {
    return res.status(400).json({ error: "action, employeeId, and context are required" });
  }

  // Verify employee exists
  const employeeRow = await db.execute(sql`
    SELECT id, first_name, last_name, manager_id
    FROM admin_users
    WHERE id = ${employeeId} AND deleted_at IS NULL
    LIMIT 1
  `);
  if (employeeRow.rows.length === 0) {
    return res.status(404).json({ error: "Employee not found" });
  }
  const employee = employeeRow.rows[0] as any;

  // Manager can only act on own direct reports
  if (role === "manager" && employee.manager_id !== userId) {
    return res.status(403).json({ error: "Not your direct report" });
  }

  if (action === "create_goal") {
    const goalCategory = normalizeGoalCategory("individual");
    const goalRows = await db.execute(sql`
      INSERT INTO performance_goals
        (employee_id, manager_id, title, description, category, status, progress,
         auto_progress_from_milestones, source_ref, start_date, weight)
      VALUES
        (${employeeId}, ${userId}, ${context}, ${context},
         ${goalCategory}, 'not_started', 0, false,
         ${'observation_tower:' + userId}, CURRENT_DATE::text, 3)
      RETURNING *
    `);
    const createdGoal = goalRows.rows[0];

    // Audit log — use onboarding_audit_events (free-form eventType varchar, no FK constraints that block arbitrary events)
    await db.execute(sql`
      INSERT INTO onboarding_audit_events (user_id, event_type, metadata, created_at)
      VALUES (
        ${userId},
        'observation_tower_create_goal',
        ${JSON.stringify({ action: "create_goal", employeeId, goalId: (createdGoal as any)?.id, context })}::jsonb,
        NOW()
      )
    `).catch((err: any) => console.warn("[observation/signal-action] audit log error:", err));

    return res.json({ action: "create_goal", result: createdGoal });
  }

  if (action === "add_coaching_note") {
    if (!planId) {
      return res.status(400).json({ error: "planId is required for add_coaching_note" });
    }

    // Verify plan belongs to this employee
    const planCheck = await db.execute(sql`
      SELECT id FROM employee_plans
      WHERE id = ${planId} AND employee_id = ${employeeId}
      LIMIT 1
    `);
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found for this employee" });
    }

    const noteRows = await db.execute(sql`
      INSERT INTO coaching_log_entries
        (plan_id, employee_id, author_id, note, entry_date, created_at, updated_at)
      VALUES
        (${planId}, ${employeeId}, ${userId}, ${context},
         CURRENT_DATE::text, NOW(), NOW())
      RETURNING *
    `);
    const createdEntry = noteRows.rows[0];

    // Audit log
    await db.execute(sql`
      INSERT INTO onboarding_audit_events (user_id, event_type, metadata, created_at)
      VALUES (
        ${userId},
        'observation_tower_add_coaching_note',
        ${JSON.stringify({ action: "add_coaching_note", employeeId, planId, entryId: (createdEntry as any)?.id })}::jsonb,
        NOW()
      )
    `).catch((err: any) => console.warn("[observation/signal-action] audit log error:", err));

    return res.json({ action: "add_coaching_note", result: createdEntry });
  }

  return res.status(400).json({ error: `Unknown action: ${action}. Supported: create_goal, add_coaching_note` });
}

// ─── Company Goal Templates ────────────────────────────────────────────────────

async function getCompanyGoalTemplates(req: Request, res: Response) {
  const role = getRole(req);
  if (!TEMPLATE_ROLES.includes(role as any)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const rows = await db.execute(sql`
    SELECT id, template_code, title, description, suggested_milestones, is_active
    FROM company_goal_templates
    WHERE is_active = true
    ORDER BY title ASC
  `);

  const templates = (rows.rows as any[]).map((r) => ({
    id: r.id,
    templateCode: r.template_code,
    title: r.title,
    description: r.description,
    suggestedMilestones: r.suggested_milestones ?? [],
    isActive: r.is_active,
  }));

  return res.json(templates);
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerObservationRoutes(app: Express) {
  app.get("/api/observation/pulse", requireAuth, async (req, res) => {
    try {
      await getPulse(req, res);
    } catch (err: any) {
      console.error("[observation/pulse]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/observation/compliance-radar", requireAuth, async (req, res) => {
    try {
      await getComplianceRadar(req, res);
    } catch (err: any) {
      console.error("[observation/compliance-radar]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/observation/exit-signals", requireAuth, async (req, res) => {
    try {
      await getExitSignals(req, res);
    } catch (err: any) {
      console.error("[observation/exit-signals]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/observation/signal-action", requireAuth, async (req, res) => {
    try {
      await postSignalAction(req, res);
    } catch (err: any) {
      console.error("[observation/signal-action]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/observation/company-goal-templates", requireAuth, async (req, res) => {
    try {
      await getCompanyGoalTemplates(req, res);
    } catch (err: any) {
      console.error("[observation/company-goal-templates]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
