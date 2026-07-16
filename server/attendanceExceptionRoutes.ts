import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireManagerOrAbove(req: Request, res: Response, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  const role = req.session.role || "";
  if (!["super_admin", "admin", "hr", "manager", "operations"].includes(role)) {
    return res.status(403).json({ error: "Manager or above access required" });
  }
  next();
}

function requireHrOrAdmin(req: Request, res: Response, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  const role = req.session.role || "";
  if (!["super_admin", "admin", "hr"].includes(role)) {
    return res.status(403).json({ error: "HR or Admin access required" });
  }
  next();
}

async function getAttendanceSettings(): Promise<{
  standardShiftHours: number;
  tier1: number;
  tier2: number;
  tier3: number;
  minExceptionShortfallMinutes: number;
  deficitPoolThresholdMinutes: number;
}> {
  try {
    const [h, t1, t2, t3, minShortfall, deficitThreshold] = await Promise.all([
      storage.getSystemSetting("standard_shift_hours"),
      storage.getSystemSetting("attendance_alert_tier1"),
      storage.getSystemSetting("attendance_alert_tier2"),
      storage.getSystemSetting("attendance_alert_tier3"),
      storage.getSystemSetting("min_exception_shortfall_minutes"),
      storage.getSystemSetting("attendance_deficit_pool_threshold_minutes"),
    ]);
    return {
      standardShiftHours: typeof h?.value === "number" ? h.value : 9.0,
      tier1: typeof t1?.value === "number" ? t1.value : 2,
      tier2: typeof t2?.value === "number" ? t2.value : 5,
      tier3: typeof t3?.value === "number" ? t3.value : 10,
      minExceptionShortfallMinutes: typeof minShortfall?.value === "number" ? minShortfall.value : 30,
      deficitPoolThresholdMinutes: typeof deficitThreshold?.value === "number" ? deficitThreshold.value : 120,
    };
  } catch {
    return { standardShiftHours: 9.0, tier1: 2, tier2: 5, tier3: 10, minExceptionShortfallMinutes: 30, deficitPoolThresholdMinutes: 120 };
  }
}

async function getFeatureFlags(): Promise<Record<string, boolean>> {
  try {
    const s = await storage.getSystemSetting("feature_flags");
    return (s?.value as Record<string, boolean>) || {};
  } catch { return {}; }
}

/**
 * Mark an attendance record as a pending short-day exception.
 * Stored as columns on the attendance row itself (idempotent — skips if already flagged).
 */
export async function createExceptionForShortDay(
  attendanceRecordId: string,
  _employeeId: string,
  _managerId: string | null,
  _workedHours: number,
  standardShiftHours: number,
): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE attendance
      SET exception_status = 'pending',
          exception_standard_hours = ${standardShiftHours}
      WHERE id = ${attendanceRecordId}
        AND exception_status IS NULL
    `);
  } catch (err) {
    console.error("[attendance-exception] Failed to set exception on attendance:", err);
  }
}

/**
 * Check monthly short-day + late count for an employee and fire escalation notifications
 * if a new tier threshold is crossed. Called after any short_day or late record is written.
 * Deduplication uses attendance_escalation_log (one row per employee/month/tier).
 */
export async function checkEscalationTiers(employeeId: string): Promise<void> {
  try {
    const settings = await getAttendanceSettings();
    const flags = await getFeatureFlags();
    if (!flags.notifications_enabled) return;

    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const month = `${nowIST.getUTCFullYear()}-${String(nowIST.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthStart = `${month}-01`;
    const lastDay = new Date(nowIST.getUTCFullYear(), nowIST.getUTCMonth() + 1, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    const countResult = (await db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM attendance
      WHERE user_id = ${employeeId}
        AND date >= ${monthStart}
        AND date <= ${monthEnd}
        AND status IN ('short_day', 'late')
    `)).rows as any[];
    const currentCount = Number(countResult[0]?.cnt || 0);

    const empRows = (await db.execute(sql`
      SELECT first_name, last_name, manager_id FROM admin_users WHERE id = ${employeeId} LIMIT 1
    `)).rows as any[];
    if (empRows.length === 0) return;
    const emp = empRows[0] as any;
    const empName = `${emp.first_name} ${emp.last_name}`;
    const managerId = emp.manager_id;

    const tiers = [
      { tier: 1, threshold: settings.tier1 },
      { tier: 2, threshold: settings.tier2 },
      { tier: 3, threshold: settings.tier3 },
    ];

    for (const tierDef of tiers) {
      if (currentCount < tierDef.threshold) continue;

      const alreadyNotified = (await db.execute(sql`
        SELECT id FROM attendance_escalation_log
        WHERE employee_id = ${employeeId} AND month = ${month} AND tier = ${tierDef.tier}
        LIMIT 1
      `)).rows as any[];
      if (alreadyNotified.length > 0) continue;

      let targetUserIds: string[] = [];
      if (tierDef.tier === 1 && managerId) {
        targetUserIds = [managerId];
      } else if (tierDef.tier === 2) {
        const admins = (await db.execute(sql`
          SELECT id FROM admin_users WHERE role IN ('admin', 'super_admin') AND is_active = true AND deleted_at IS NULL LIMIT 20
        `)).rows as any[];
        targetUserIds = admins.map((a: any) => a.id);
      } else if (tierDef.tier === 3) {
        const hrSuper = (await db.execute(sql`
          SELECT id FROM admin_users WHERE role IN ('super_admin', 'hr') AND is_active = true AND deleted_at IS NULL LIMIT 20
        `)).rows as any[];
        targetUserIds = hrSuper.map((a: any) => a.id);
      }

      if (targetUserIds.length === 0) continue;

      const tierLabels: Record<number, string> = {
        1: `Heads-up — ${empName} has had ${currentCount} short/late day(s) this month.`,
        2: `Attention — ${empName} has now had ${currentCount} short/late days this month — manager notified earlier.`,
        3: `Escalation — ${empName} has reached ${currentCount} short/late days this month — review recommended.`,
      };
      const tierTitles: Record<number, string> = {
        1: "Attendance Heads-up",
        2: "Attendance Alert",
        3: "Attendance Escalation",
      };

      for (const uid of targetUserIds) {
        await storage.createNotification({
          userId: uid,
          type: "attendance_escalation",
          title: tierTitles[tierDef.tier],
          message: tierLabels[tierDef.tier],
          isRead: false,
          metadata: { employeeId, month, tier: tierDef.tier, count: currentCount },
        }).catch(console.error);

        // Email dispatch when email feature flag is on
        if (flags.email_enabled) {
          try {
            const recipientRows = (await db.execute(sql`
              SELECT email, first_name, last_name FROM admin_users WHERE id = ${uid} LIMIT 1
            `)).rows as any[];
            const recipient = recipientRows[0] as any;
            if (recipient?.email) {
              const { sendEscalationEmail } = await import("./email");
              await sendEscalationEmail({
                to: recipient.email,
                recipientName: `${recipient.first_name} ${recipient.last_name}`,
                employeeName: empName,
                tier: tierDef.tier,
                count: currentCount,
                month,
              });
            }
          } catch (emailErr) {
            console.error("[attendance-escalation] Email dispatch failed (non-fatal):", emailErr);
          }
        }
      }

      await db.execute(sql`
        INSERT INTO attendance_escalation_log (employee_id, month, tier, count_at_trigger)
        VALUES (${employeeId}, ${month}, ${tierDef.tier}, ${currentCount})
      `);

      console.log(`[attendance-escalation] Tier ${tierDef.tier} fired for ${employeeId} in ${month} (count=${currentCount})`);
    }
  } catch (err) {
    console.error("[attendance-escalation] checkEscalationTiers failed:", err);
  }
}


export function registerAttendanceExceptionRoutes(app: Express) {

  // --- Exception count badge (manager sees pending for their team; HR/admin see all pending) ---
  app.get("/api/attendance/exceptions/count", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "";

      if (!["super_admin", "admin", "hr", "manager", "operations"].includes(role)) {
        return res.json({ count: 0 });
      }

      let countResult: any[];
      if (["super_admin", "admin", "hr"].includes(role)) {
        countResult = (await db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM attendance WHERE exception_status = 'pending'
        `)).rows as any[];
      } else {
        const teamMembers = await storage.getTeamMembers(userId);
        const teamIds = teamMembers.map((m) => m.id);
        if (teamIds.length === 0) return res.json({ count: 0 });
        countResult = (await db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM attendance
          WHERE exception_status = 'pending'
            AND user_id = ANY(ARRAY[${sql.join(teamIds.map(id => sql`${id}`), sql`, `)}]::text[])
        `)).rows as any[];
      }

      res.json({ count: Number(countResult[0]?.cnt || 0) });
    } catch (err) {
      console.error("[exceptions] count error:", err);
      res.json({ count: 0 });
    }
  });

  // --- List exceptions for manager's team (or all for HR/admin) ---
  app.get("/api/attendance/exceptions", requireAuth, requireManagerOrAbove, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "";
      const { status, startDate, endDate, department } = req.query as Record<string, string>;

      let teamFilter = sql``;
      if (!["super_admin", "admin", "hr"].includes(role)) {
        const teamMembers = await storage.getTeamMembers(userId);
        const teamIds = teamMembers.map((m) => m.id);
        if (teamIds.length === 0) return res.json([]);
        teamFilter = sql`AND a.user_id = ANY(ARRAY[${sql.join(teamIds.map(id => sql`${id}`), sql`, `)}]::text[])`;
      }

      const statusFilter = status ? sql`AND a.exception_status = ${status}` : sql``;
      const startFilter = startDate ? sql`AND a.date >= ${startDate}` : sql``;
      const endFilter = endDate ? sql`AND a.date <= ${endDate}` : sql``;
      const deptFilter = department ? sql`AND d.id = ${department}` : sql``;

      const rows = (await db.execute(sql`
        SELECT
          a.id,
          a.user_id AS employee_id,
          a.date AS attendance_date,
          a.total_hours AS worked_hours,
          a.exception_status AS status,
          a.exception_standard_hours AS standard_hours,
          a.exception_comment AS manager_comment,
          a.exception_resolved_by AS resolved_by,
          a.exception_resolved_at AS resolved_at,
          a.punch_in,
          a.punch_out,
          a.updated_at AS created_at,
          u.manager_id,
          u.first_name AS emp_first_name,
          u.last_name AS emp_last_name,
          u.employee_id AS emp_employee_id,
          d.name AS department_name,
          m.first_name AS manager_first_name,
          m.last_name AS manager_last_name,
          r.first_name AS resolver_first_name,
          r.last_name AS resolver_last_name,
          adp.deficit_minutes AS monthly_deficit_minutes,
          adp.settled_at AS pool_settled_at
        FROM attendance a
        JOIN admin_users u ON u.id = a.user_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN admin_users m ON m.id = u.manager_id
        LEFT JOIN admin_users r ON r.id = a.exception_resolved_by
        LEFT JOIN attendance_deficit_pool adp
          ON adp.employee_id = a.user_id
          AND adp.month = SUBSTR(a.date::text, 1, 7)
        WHERE a.exception_status IS NOT NULL
          ${teamFilter}
          ${statusFilter}
          ${startFilter}
          ${endFilter}
          ${deptFilter}
        ORDER BY a.date DESC
        LIMIT 200
      `)).rows as any[];

      const [settings, featureFlags] = await Promise.all([
        getAttendanceSettings(),
        getFeatureFlags(),
      ]);
      const deficitPoolEnabled = featureFlags.attendance_deficit_pool_enabled === true;

      res.json(rows.map((row: any) => ({
        id: row.id,
        attendanceRecordId: row.id,
        employeeId: row.employee_id,
        managerId: row.manager_id,
        exceptionType: "short_day",
        status: row.status,
        managerComment: row.manager_comment,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at,
        workedHours: Number(row.worked_hours || 0),
        standardHours: Number(row.standard_hours || 9),
        shortfall: Number(row.standard_hours || 9) - Number(row.worked_hours || 0),
        createdAt: row.created_at,
        attendanceDate: row.attendance_date,
        totalHours: row.worked_hours,
        punchIn: row.punch_in,
        punchOut: row.punch_out,
        employeeName: `${row.emp_first_name} ${row.emp_last_name}`,
        employeeCode: row.emp_employee_id,
        departmentName: row.department_name,
        managerName: row.manager_first_name ? `${row.manager_first_name} ${row.manager_last_name}` : null,
        resolverName: row.resolver_first_name ? `${row.resolver_first_name} ${row.resolver_last_name}` : null,
        // Deficit pool fields — only populated when feature flag is ON
        deficitPoolEnabled,
        monthlyDeficitMinutes: deficitPoolEnabled && row.monthly_deficit_minutes != null
          ? Number(row.monthly_deficit_minutes) : null,
        deficitThreshold: deficitPoolEnabled ? settings.deficitPoolThresholdMinutes : null,
        poolSettled: deficitPoolEnabled ? !!row.pool_settled_at : null,
      })));
    } catch (err) {
      console.error("[exceptions] list error:", err);
      res.status(500).json({ error: "Failed to fetch exceptions" });
    }
  });

  // --- Resolve exception (manager or HR) ---
  // :id is the attendance record id
  app.post("/api/attendance/exceptions/:id/resolve", requireAuth, requireManagerOrAbove, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { disposition, comment } = req.body;
      const actorId = req.session.userId!;
      const role = req.session.role || "";

      if (!["approved_exception", "marked_half_day"].includes(disposition)) {
        return res.status(400).json({ error: "disposition must be 'approved_exception' or 'marked_half_day'" });
      }
      if (disposition === "approved_exception" && !comment?.trim()) {
        return res.status(400).json({ error: "A comment is required when approving an exception" });
      }

      const excRows = (await db.execute(sql`
        SELECT a.id, a.user_id AS employee_id, a.date, a.exception_status,
               a.exception_standard_hours, u.manager_id
        FROM attendance a
        JOIN admin_users u ON u.id = a.user_id
        WHERE a.id = ${id}
        LIMIT 1
      `)).rows as any[];
      if (excRows.length === 0) return res.status(404).json({ error: "Attendance record not found" });
      const exc = excRows[0] as any;

      if (exc.exception_status !== "pending") {
        return res.status(409).json({ error: "Exception already resolved" });
      }

      if (!["super_admin", "admin", "hr"].includes(role)) {
        const teamMembers = await storage.getTeamMembers(actorId);
        const teamIds = new Set(teamMembers.map((m) => m.id));
        if (!teamIds.has(exc.employee_id)) {
          return res.status(403).json({ error: "You can only resolve exceptions for your team members" });
        }
      }

      if (disposition === "marked_half_day") {
        await db.execute(sql`
          UPDATE attendance
          SET status = 'half_day',
              notes = COALESCE(notes || '; ', '') || '[Exception] Marked as half day by manager'
          WHERE id = ${id}
        `);
        try {
          const currentYear = new Date().getFullYear();
          const leaveRows = (await db.execute(sql`
            SELECT lb.id, lb.leave_type_id, lb.used_days, lb.total_days
            FROM leave_balances lb
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE lb.user_id = ${exc.employee_id}
              AND lb.year = ${currentYear}
              AND lb.total_days > lb.used_days
              AND lt.is_active = true
            ORDER BY lt.name
            LIMIT 1
          `)).rows as any[];

          if (leaveRows.length > 0) {
            const lb = leaveRows[0] as any;
            await db.execute(sql`UPDATE leave_balances SET used_days = used_days + 0.5 WHERE id = ${lb.id}`);
            console.log(`[exceptions] Deducted 0.5 leave day from balance ${lb.id} for ${exc.employee_id}`);
          } else {
            console.warn(`[exceptions] No leave balance for ${exc.employee_id} — notifying HR`);
            const hrUsers = (await db.execute(sql`
              SELECT id FROM admin_users WHERE role IN ('hr', 'admin', 'super_admin') AND is_active = true AND deleted_at IS NULL LIMIT 10
            `)).rows as any[];
            for (const hr of hrUsers) {
              await storage.createNotification({
                userId: (hr as any).id,
                type: "leave_balance_insufficient",
                title: "Leave Balance Insufficient for Exception",
                message: `Employee exception was marked as half-day but no leave balance is available. Please review manually.`,
                isRead: false,
                metadata: { employeeId: exc.employee_id, attendanceId: id },
              }).catch(console.error);
            }
          }
        } catch (leaveErr) {
          console.error("[exceptions] Leave deduction failed:", leaveErr);
        }
      }

      // Update exception fields on the attendance row
      await db.execute(sql`
        UPDATE attendance
        SET exception_status = ${disposition},
            exception_comment = ${comment?.trim() || null},
            exception_resolved_by = ${actorId},
            exception_resolved_at = NOW()
        WHERE id = ${id}
      `);

      await storage.createAuditLog({
        actorId,
        targetId: exc.employee_id,
        action: `attendance_exception_${disposition}`,
        changes: { attendanceId: id, date: exc.date, disposition, comment: comment?.trim() || null },
      }).catch(console.error);

      res.json({ success: true });
    } catch (err) {
      console.error("[exceptions] resolve error:", err);
      res.status(500).json({ error: "Failed to resolve exception" });
    }
  });

  // --- HR: All Exceptions (cross-team) ---
  app.get("/api/attendance/exceptions/all", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const { status, startDate, endDate, department } = req.query as Record<string, string>;

      const statusFilter = status ? sql`AND a.exception_status = ${status}` : sql``;
      const startFilter = startDate ? sql`AND a.date >= ${startDate}` : sql``;
      const endFilter = endDate ? sql`AND a.date <= ${endDate}` : sql``;
      const deptFilter = department ? sql`AND d.id = ${department}` : sql``;

      const rows = (await db.execute(sql`
        SELECT
          a.id,
          a.user_id AS employee_id,
          a.date AS attendance_date,
          a.total_hours AS worked_hours,
          a.exception_status AS status,
          a.exception_standard_hours AS standard_hours,
          a.exception_comment AS manager_comment,
          a.exception_resolved_by AS resolved_by,
          a.exception_resolved_at AS resolved_at,
          a.updated_at AS created_at,
          u.manager_id,
          u.first_name AS emp_first_name,
          u.last_name AS emp_last_name,
          u.employee_id AS emp_employee_id,
          d.name AS department_name,
          d.id AS department_id,
          m.first_name AS manager_first_name,
          m.last_name AS manager_last_name,
          r.first_name AS resolver_first_name,
          r.last_name AS resolver_last_name
        FROM attendance a
        JOIN admin_users u ON u.id = a.user_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN admin_users m ON m.id = u.manager_id
        LEFT JOIN admin_users r ON r.id = a.exception_resolved_by
        WHERE a.exception_status IS NOT NULL
          ${statusFilter}
          ${startFilter}
          ${endFilter}
          ${deptFilter}
        ORDER BY a.date DESC
        LIMIT 500
      `)).rows as any[];

      res.json(rows.map((row: any) => ({
        id: row.id,
        attendanceRecordId: row.id,
        employeeId: row.employee_id,
        managerId: row.manager_id,
        exceptionType: "short_day",
        status: row.status,
        managerComment: row.manager_comment,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at,
        workedHours: Number(row.worked_hours || 0),
        standardHours: Number(row.standard_hours || 9),
        shortfall: Number(row.standard_hours || 9) - Number(row.worked_hours || 0),
        createdAt: row.created_at,
        attendanceDate: row.attendance_date,
        totalHours: row.worked_hours,
        employeeName: `${row.emp_first_name} ${row.emp_last_name}`,
        employeeCode: row.emp_employee_id,
        departmentName: row.department_name,
        departmentId: row.department_id,
        managerName: row.manager_first_name ? `${row.manager_first_name} ${row.manager_last_name}` : null,
        resolverName: row.resolver_first_name ? `${row.resolver_first_name} ${row.resolver_last_name}` : null,
      })));
    } catch (err) {
      console.error("[exceptions] all error:", err);
      res.status(500).json({ error: "Failed to fetch all exceptions" });
    }
  });

  // --- Attendance Risk Summary (HR/Admin) ---
  app.get("/api/attendance/risk-summary", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await getAttendanceSettings();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(Date.now() + IST_OFFSET_MS);
      const month = `${nowIST.getUTCFullYear()}-${String(nowIST.getUTCMonth() + 1).padStart(2, "0")}`;
      const monthStart = `${month}-01`;
      const lastDay = new Date(nowIST.getUTCFullYear(), nowIST.getUTCMonth() + 1, 0).getDate();
      const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

      const { tierFilter, department } = req.query as Record<string, string>;

      const rows = (await db.execute(sql`
        SELECT
          a.user_id,
          COUNT(*) AS monthly_count,
          MAX(a.date) AS last_occurrence,
          u.first_name,
          u.last_name,
          u.employee_id AS emp_code,
          d.name AS department_name,
          d.id AS department_id,
          m.first_name AS manager_first_name,
          m.last_name AS manager_last_name
        FROM attendance a
        JOIN admin_users u ON u.id = a.user_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN admin_users m ON m.id = u.manager_id
        WHERE a.date >= ${monthStart}
          AND a.date <= ${monthEnd}
          AND a.status IN ('short_day', 'late')
          AND u.is_active = true
          AND u.deleted_at IS NULL
          ${department ? sql`AND d.id = ${department}` : sql``}
        GROUP BY a.user_id, u.first_name, u.last_name, u.employee_id, d.name, d.id, m.first_name, m.last_name
        HAVING COUNT(*) >= ${settings.tier1}
        ORDER BY monthly_count DESC
        LIMIT 100
      `)).rows as any[];

      const escalations = (await db.execute(sql`
        SELECT employee_id, tier, count_at_trigger, notified_at
        FROM attendance_escalation_log
        WHERE month = ${month}
      `)).rows as any[];

      const escalationMap = new Map<string, number>();
      for (const e of escalations) {
        const current = escalationMap.get((e as any).employee_id) || 0;
        if ((e as any).tier > current) escalationMap.set((e as any).employee_id, (e as any).tier);
      }

      const results = rows
        .map((row: any) => {
          const count = Number(row.monthly_count);
          let highestTier = 0;
          if (count >= settings.tier3) highestTier = 3;
          else if (count >= settings.tier2) highestTier = 2;
          else if (count >= settings.tier1) highestTier = 1;
          return {
            employeeId: row.user_id,
            employeeName: `${row.first_name} ${row.last_name}`,
            employeeCode: row.emp_code,
            departmentName: row.department_name,
            departmentId: row.department_id,
            managerName: row.manager_first_name ? `${row.manager_first_name} ${row.manager_last_name}` : null,
            monthlyCount: count,
            lastOccurrence: row.last_occurrence,
            highestTierReached: highestTier,
            escalationStatus: highestTier > 0 ? `Tier ${highestTier}` : "None",
          };
        })
        .filter((r: any) => !tierFilter || String(r.highestTierReached) === tierFilter);

      res.json({ month, results, thresholds: { tier1: settings.tier1, tier2: settings.tier2, tier3: settings.tier3 } });
    } catch (err) {
      console.error("[exceptions] risk-summary error:", err);
      res.status(500).json({ error: "Failed to fetch risk summary" });
    }
  });


  // --- Attendance Settings (read) ---
  app.get("/api/attendance/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await getAttendanceSettings();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // --- Attendance Settings (write, HR/admin only) ---
  app.put("/api/attendance/settings", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const { standardShiftHours, tier1, tier2, tier3, minExceptionShortfallMinutes } = req.body;
      const actorId = req.session.userId!;

      if (standardShiftHours !== undefined) {
        const v = Number(standardShiftHours);
        if (isNaN(v) || v < 1 || v > 24) return res.status(400).json({ error: "standardShiftHours must be 1-24" });
        await storage.upsertSystemSetting("standard_shift_hours", v, actorId);
      }
      if (tier1 !== undefined) {
        const v = Number(tier1);
        if (isNaN(v) || v < 1) return res.status(400).json({ error: "tier1 must be >= 1" });
        await storage.upsertSystemSetting("attendance_alert_tier1", v, actorId);
      }
      if (tier2 !== undefined) {
        const v = Number(tier2);
        if (isNaN(v) || v < 1) return res.status(400).json({ error: "tier2 must be >= 1" });
        await storage.upsertSystemSetting("attendance_alert_tier2", v, actorId);
      }
      if (tier3 !== undefined) {
        const v = Number(tier3);
        if (isNaN(v) || v < 1) return res.status(400).json({ error: "tier3 must be >= 1" });
        await storage.upsertSystemSetting("attendance_alert_tier3", v, actorId);
      }
      if (minExceptionShortfallMinutes !== undefined) {
        const v = Number(minExceptionShortfallMinutes);
        if (isNaN(v) || v < 0 || v > 480) return res.status(400).json({ error: "minExceptionShortfallMinutes must be 0-480" });
        await storage.upsertSystemSetting("min_exception_shortfall_minutes", v, actorId);
      }
      const { deficitPoolThresholdMinutes } = req.body;
      if (deficitPoolThresholdMinutes !== undefined) {
        const v = Number(deficitPoolThresholdMinutes);
        if (isNaN(v) || v < 0 || v > 480) return res.status(400).json({ error: "deficitPoolThresholdMinutes must be 0-480" });
        await storage.upsertSystemSetting("attendance_deficit_pool_threshold_minutes", v, actorId);
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[settings] update error:", err);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });
}
