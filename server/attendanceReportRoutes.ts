import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sql, eq, and, inArray, notInArray } from "drizzle-orm";
import { adminUsers, attendanceReportManagerApprovals } from "@shared/schema";
import { storage } from "./storage";
import { generateAttendanceReportRun, ensureRunForMonthAndNotify, reconcileManagerApprovals, notifyManagersForRun } from "./attendanceReport";
import { sendAttendanceApprovalRequestEmail, sendAttendanceEditsSubmittedEmail, sendAttendanceDeadlineExpiredEmail, sendAttendanceApprovalCompleteEmail } from "./email";
import { getPortalBaseUrl, attendanceApprovalUrl } from "./portalUrl";
import { isRoleAllowed } from "@shared/accessControl";

// Throttle the per-request safety-net so it runs at most once per 30 min.
let lastEnsureCheck = 0;
const ENSURE_THROTTLE_MS = 30 * 60 * 1000;

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireHrOrAdmin(req: Request, res: Response, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  // Centralized: resolves allowed roles via the central access registry (when
  // the flag is on) or this exact fallback (legacy). No auto-grant.
  if (isRoleAllowed(req.session.role, "hr.attendanceReport.access", ["super_admin", "admin", "hr"])) return next();
  return res.status(403).json({ error: "HR or Admin access required" });
}

async function getFeatureFlags() {
  const setting = await storage.getSystemSetting("feature_flags");
  return (setting?.value as Record<string, boolean>) || {};
}

async function notifyUsers(userIds: string[], notification: { title: string; message: string; type?: string }) {
  try {
    const flags = await getFeatureFlags();
    if (!flags.notifications_enabled) return;
    for (const userId of userIds) {
      await storage.createNotification({
        userId,
        title: notification.title,
        message: notification.message,
        type: notification.type || "info",
      });
    }
  } catch (err) {
    console.error("[attendance-report] Notification error:", err);
  }
}

async function getHrAdminUsers(): Promise<{ id: string; email: string; firstName: string; lastName: string; role: string }[]> {
  const allAdmins = await db.select({
    id: adminUsers.id,
    email: adminUsers.email,
    firstName: adminUsers.firstName,
    lastName: adminUsers.lastName,
    role: adminUsers.role,
  }).from(adminUsers).where(eq(adminUsers.isActive, true));
  return allAdmins.filter(u => ["super_admin", "admin", "hr"].includes(u.role || "")) as any[];
}

async function sendApprovalCompleteNotification(runId: string, month: number, year: number, overridden = false) {
  try {
    const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });
    const hrUsers = await getHrAdminUsers();
    const hrIds = hrUsers.map(u => u.id);

    await notifyUsers(hrIds, {
      title: overridden ? "Attendance Override Applied — Salary Run Unlocked" : "Attendance Approved — Salary Run Unlocked",
      message: overridden
        ? `HR override applied for ${monthName} ${year}. You can now generate the salary run.`
        : `All managers have approved attendance for ${monthName} ${year}. You can now generate the salary run.`,
      type: "success",
    });

    // Fetch entry summary for CSV email
    const entries = (await db.execute(sql`
      SELECT
        e.cur_present_days, e.cur_absent_days, e.cur_lop_days, e.cur_leave_days,
        e.cur_holiday_days, e.cur_total_hours,
        u.first_name, u.last_name, u.employee_id
      FROM attendance_report_entries e
      JOIN admin_users u ON u.id = e.user_id
      WHERE e.run_id = ${runId}
      ORDER BY u.first_name, u.last_name
    `)).rows as any[];

    const entrySummary = entries.map((e: any) => ({
      name: `${e.first_name} ${e.last_name}`,
      employeeId: e.employee_id || "",
      presentDays: Number(e.cur_present_days) || 0,
      absentDays: Number(e.cur_absent_days) || 0,
      lopDays: Number(e.cur_lop_days) || 0,
      leaveDays: Number(e.cur_leave_days) || 0,
      holidayDays: Number(e.cur_holiday_days) || 0,
      totalHours: Number(e.cur_total_hours) || 0,
    }));

    // Send to configured salary_report_recipients (TO + CC), with HR as fallback
    const recipientsSetting = await storage.getSystemSetting("salary_report_recipients");
    const salaryRecipients = recipientsSetting?.value as { to?: string[]; cc?: string[] } | undefined;
    const toEmails: string[] = (salaryRecipients?.to && salaryRecipients.to.length > 0)
      ? salaryRecipients.to
      : hrUsers.map(u => u.email);

    if (toEmails.length > 0) {
      sendAttendanceApprovalCompleteEmail({
        toEmails,
        month: monthName,
        year,
        overridden,
        salaryRunUrl: `${getPortalBaseUrl()}/admin/hr/reports`,
        entrySummary,
      }).catch(console.error);
    }
  } catch (err) {
    console.error("[attendance-report] Approval complete notification error:", err);
  }
}

async function checkAndAdvanceRunStatus(runId: string) {
  const [run] = (await db.execute(sql`SELECT * FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
  if (!run) return;
  // Never regress from terminal states
  if (run.status === "approved" || run.status === "overridden" || run.status === "deadline_expired") return;

  const approvals = (await db.execute(sql`
    SELECT status FROM attendance_report_manager_approvals WHERE run_id = ${runId}
  `)).rows as any[];

  const prevStatus = run.status;

  if (approvals.length === 0) {
    await db.execute(sql`UPDATE attendance_report_runs SET status = 'approved', updated_at = NOW() WHERE id = ${runId}`);
    await sendApprovalCompleteNotification(runId, run.month, run.year);
    return;
  }

  const hasPending = approvals.some((a: any) => a.status === "pending");
  const hasEditsSubmitted = approvals.some((a: any) => a.status === "edits_submitted");

  let newStatus = prevStatus;
  if (!hasPending && !hasEditsSubmitted) {
    newStatus = "approved";
  } else if (hasEditsSubmitted) {
    newStatus = "edits_pending_hr";
  } else {
    newStatus = "in_review";
  }

  if (newStatus !== prevStatus) {
    await db.execute(sql`UPDATE attendance_report_runs SET status = ${newStatus}, updated_at = NOW() WHERE id = ${runId}`);
    if (newStatus === "approved") {
      await sendApprovalCompleteNotification(runId, run.month, run.year);
    }
  }
}

function isDeadlinePassed(deadlineAt: string | null): boolean {
  if (!deadlineAt) return false;
  return new Date(deadlineAt) < new Date();
}

export function registerAttendanceReportRoutes(app: Express) {

  // Per-authenticated-request safety-net hook (throttled to once per 30 min).
  // Fires on any /api/hr request to self-heal open runs: re-syncs each open run to
  // the current org structure and notifies any managers (e.g. Shafique) who were
  // missing from the approval list. This catches both missed cron windows and
  // managers added/changed after the run was generated.
  app.use("/api/hr", (req: Request, _res, next) => {
    if (req.session?.userId) {
      const now = Date.now();
      if (now - lastEnsureCheck >= ENSURE_THROTTLE_MS) {
        lastEnsureCheck = now;
        (async () => {
          const openRuns = (await db.execute(sql`
            SELECT id FROM attendance_report_runs
            WHERE status NOT IN ('approved', 'overridden', 'deadline_expired')
          `)).rows as any[];
          for (const r of openRuns) {
            const { added } = await reconcileManagerApprovals(r.id);
            if (added.length > 0) await notifyManagersForRun(r.id, added);
          }
        })().catch(err => console.error("[attendance-report] Per-request reconcile failed:", err));
      }
    }
    next();
  });

  app.get("/api/hr/attendance-report/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);
      if (!month || !year) return res.status(400).json({ error: "month and year required" });

      const [run] = (await db.execute(sql`
        SELECT id, status, deadline_at, created_at FROM attendance_report_runs
        WHERE month = ${month} AND year = ${year}
        LIMIT 1
      `)).rows as any[];

      if (!run) return res.json({ exists: false, approved: false });

      const managerApprovals = (await db.execute(sql`
        SELECT ma.manager_id, ma.status, u.first_name, u.last_name
        FROM attendance_report_manager_approvals ma
        LEFT JOIN admin_users u ON u.id = ma.manager_id
        WHERE ma.run_id = ${run.id}
      `)).rows as any[];

      const pendingEdits = (await db.execute(sql`
        SELECT COUNT(*)::int as cnt FROM attendance_report_edits
        WHERE run_id = ${run.id} AND status = 'pending'
      `)).rows as any[];

      res.json({
        exists: true,
        runId: run.id,
        status: run.status,
        deadlineAt: run.deadline_at,
        createdAt: run.created_at,
        approved: run.status === "approved" || run.status === "overridden",
        overridden: run.status === "overridden",
        managerApprovals,
        pendingEditsCount: pendingEdits[0]?.cnt || 0,
      });
    } catch (error) {
      console.error("Attendance report status error:", error);
      res.status(500).json({ error: "Failed to fetch attendance report status" });
    }
  });

  app.get("/api/hr/attendance-report/runs", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const runs = (await db.execute(sql`
        SELECT r.*, u.first_name || ' ' || u.last_name AS override_by_name
        FROM attendance_report_runs r
        LEFT JOIN admin_users u ON u.id = r.override_by
        ORDER BY r.year DESC, r.month DESC
      `)).rows as any[];
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch runs" });
    }
  });

  app.post("/api/hr/attendance-report/generate", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const month = parseInt(req.body.month);
      const year = parseInt(req.body.year);
      if (!month || !year || month < 1 || month > 12) {
        return res.status(400).json({ error: "Valid month and year required" });
      }

      const existing = (await db.execute(sql`
        SELECT id, status FROM attendance_report_runs WHERE month = ${month} AND year = ${year} LIMIT 1
      `)).rows as any[];

      if (existing.length > 0) {
        return res.status(409).json({ error: "A report run already exists for this month. Use override to unlock." });
      }

      const { runId, managerIds } = await generateAttendanceReportRun(month, year, req.session.userId);

      const [run] = (await db.execute(sql`SELECT * FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];

      if (managerIds.length > 0) {
        const managers = await db.select({
          id: adminUsers.id,
          email: adminUsers.email,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
        }).from(adminUsers).where(inArray(adminUsers.id, managerIds));

        await notifyManagersForRun(runId, managers as any);
      }

      // Audit log the run creation
      await storage.createAuditLog({
        actorId: req.session.userId!,
        action: "attendance_report_run_created",
        changes: { runId, month, year, managerCount: managerIds.length },
      });

      res.status(201).json(run);
    } catch (error) {
      console.error("Generate attendance report run error:", error);
      res.status(500).json({ error: "Failed to generate attendance report run" });
    }
  });

  // Re-sync an existing run to the current org structure and notify any managers
  // who were missed (e.g. a reporting manager who never received the request).
  app.post("/api/hr/attendance-report/runs/:id/notify-missed", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const runId = req.params.id;
      const [run] = (await db.execute(sql`SELECT id, status FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
      if (!run) return res.status(404).json({ error: "Run not found" });

      const { added } = await reconcileManagerApprovals(runId);
      if (added.length > 0) await notifyManagersForRun(runId, added);

      await storage.createAuditLog({
        actorId: req.session.userId!,
        action: "attendance_report_notify_missed",
        changes: { runId, notified: added.map(m => m.id) },
      });

      res.json({
        notified: added.length,
        managers: added.map(m => ({ id: m.id, name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email })),
      });
    } catch (error) {
      console.error("Notify-missed managers error:", error);
      res.status(500).json({ error: "Failed to notify missed managers" });
    }
  });

  // Re-send the approval request to EVERY manager who still has an open (non-finalized)
  // approval row on this run — regardless of whether they were notified before.
  // Managers who already approved/overrode are intentionally skipped so we don't nag them.
  app.post("/api/hr/attendance-report/runs/:id/resend-approval", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const runId = String(req.params.id);
      const [run] = (await db.execute(sql`SELECT id, status FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
      if (!run) return res.status(404).json({ error: "Run not found" });

      const managers = (await db
        .select({
          id: adminUsers.id,
          email: adminUsers.email,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
        })
        .from(attendanceReportManagerApprovals)
        .innerJoin(adminUsers, eq(adminUsers.id, attendanceReportManagerApprovals.managerId))
        .where(and(
          eq(attendanceReportManagerApprovals.runId, runId),
          notInArray(attendanceReportManagerApprovals.status, ["approved", "overridden"]),
          eq(adminUsers.isActive, true),
        ))) as any[];

      if (managers.length > 0) await notifyManagersForRun(runId, managers as any);

      await storage.createAuditLog({
        actorId: req.session.userId!,
        action: "attendance_report_resend_approval",
        changes: { runId, notified: managers.map(m => m.id) },
      });

      res.json({
        notified: managers.length,
        managers: managers.map(m => ({ id: m.id, name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email })),
      });
    } catch (error) {
      console.error("Resend approval error:", error);
      res.status(500).json({ error: "Failed to resend approval request" });
    }
  });

  app.get("/api/hr/attendance-report/runs/:id/my-team", requireAuth, async (req: Request, res: Response) => {
    try {
      const managerId = req.session.userId!;
      const runId = req.params.id;

      const [run] = (await db.execute(sql`SELECT * FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
      if (!run) return res.status(404).json({ error: "Run not found" });

      const [myApproval] = (await db.execute(sql`
        SELECT * FROM attendance_report_manager_approvals
        WHERE run_id = ${runId} AND manager_id = ${managerId}
      `)).rows as any[];

      const entries = (await db.execute(sql`
        SELECT e.*, u.first_name, u.last_name, u.email, u.designation, u.employee_id
        FROM attendance_report_entries e
        JOIN admin_users u ON u.id = e.user_id
        WHERE e.run_id = ${runId} AND e.manager_id = ${managerId}
        ORDER BY u.first_name, u.last_name
      `)).rows as any[];

      let edits: any[] = [];
      if (entries.length > 0) {
        edits = (await db.execute(sql`
          SELECT ed.*, u.first_name || ' ' || u.last_name AS reviewed_by_name
          FROM attendance_report_edits ed
          LEFT JOIN admin_users u ON u.id = ed.reviewed_by
          WHERE ed.run_id = ${runId} AND ed.manager_id = ${managerId}
        `)).rows as any[];
      }

      res.json({ run, myApproval: myApproval || null, entries, edits });
    } catch (error) {
      console.error("Get my-team run error:", error);
      res.status(500).json({ error: "Failed to fetch approval workspace" });
    }
  });

  app.get("/api/hr/attendance-report/my-run", requireAuth, async (req: Request, res: Response) => {
    try {
      const managerId = req.session.userId!;
      const role = req.session.role;
      const isManager = role === "manager" || role === "hr" || role === "admin" || role === "super_admin" || role === "operations";
      if (!isManager) return res.json({ run: null });

      const approvals = (await db.execute(sql`
        SELECT ma.run_id, r.month, r.year, r.status, r.deadline_at, ma.status AS manager_status
        FROM attendance_report_manager_approvals ma
        JOIN attendance_report_runs r ON r.id = ma.run_id
        WHERE ma.manager_id = ${managerId}
        ORDER BY r.year DESC, r.month DESC
        LIMIT 1
      `)).rows as any[];

      if (approvals.length === 0) return res.json({ run: null });
      res.json({ run: approvals[0] });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending run" });
    }
  });

  app.post("/api/hr/attendance-report/runs/:id/approve", requireAuth, async (req: Request, res: Response) => {
    try {
      const managerId = req.session.userId!;
      const runId = req.params.id;

      const [run] = (await db.execute(sql`SELECT * FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
      if (!run) return res.status(404).json({ error: "Run not found" });
      if (run.status === "approved" || run.status === "overridden") {
        return res.status(409).json({ error: "Run already closed" });
      }
      if (run.status === "deadline_expired" || isDeadlinePassed(run.deadline_at)) {
        return res.status(409).json({ error: "Approval deadline has passed. Contact HR to override." });
      }

      const [approval] = (await db.execute(sql`
        SELECT * FROM attendance_report_manager_approvals WHERE run_id = ${runId} AND manager_id = ${managerId}
      `)).rows as any[];
      if (!approval) return res.status(403).json({ error: "You are not a reviewer for this run" });

      await db.execute(sql`
        UPDATE attendance_report_manager_approvals
        SET status = 'approved', approved_at = NOW()
        WHERE run_id = ${runId} AND manager_id = ${managerId}
      `);

      await storage.createAuditLog({
        actorId: managerId,
        action: "attendance_manager_approved",
        changes: { runId, month: run.month, year: run.year },
      });

      await checkAndAdvanceRunStatus(runId);

      res.json({ success: true });
    } catch (error) {
      console.error("Approve run error:", error);
      res.status(500).json({ error: "Failed to approve" });
    }
  });

  app.post("/api/hr/attendance-report/runs/:id/edits", requireAuth, async (req: Request, res: Response) => {
    try {
      const managerId = req.session.userId!;
      const runId = req.params.id;
      const { corrections } = req.body;

      if (!Array.isArray(corrections) || corrections.length === 0) {
        return res.status(400).json({ error: "corrections array required" });
      }

      const [run] = (await db.execute(sql`SELECT * FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
      if (!run) return res.status(404).json({ error: "Run not found" });
      if (run.status === "approved" || run.status === "overridden") {
        return res.status(409).json({ error: "Run already closed" });
      }
      if (run.status === "deadline_expired" || isDeadlinePassed(run.deadline_at)) {
        return res.status(409).json({ error: "Approval deadline has passed. Contact HR to override." });
      }

      const [approval] = (await db.execute(sql`
        SELECT * FROM attendance_report_manager_approvals WHERE run_id = ${runId} AND manager_id = ${managerId}
      `)).rows as any[];
      if (!approval) return res.status(403).json({ error: "You are not a reviewer for this run" });

      const origMap: Record<string, string> = {
        presentDays: "orig_present_days",
        absentDays: "orig_absent_days",
        lopDays: "orig_lop_days",
        leaveDays: "orig_leave_days",
        holidayDays: "orig_holiday_days",
        totalHours: "orig_total_hours",
      };

      const fieldColMap: Record<string, string> = {
        presentDays: "cur_present_days",
        absentDays: "cur_absent_days",
        lopDays: "cur_lop_days",
        leaveDays: "cur_leave_days",
        holidayDays: "cur_holiday_days",
        totalHours: "cur_total_hours",
      };

      let editsCreated = 0;
      for (const corr of corrections) {
        const { entryId, field, proposedValue, reason } = corr;
        if (!entryId || !field || proposedValue === undefined || !reason?.trim()) continue;
        if (!fieldColMap[field]) continue;

        const [entry] = (await db.execute(sql`
          SELECT * FROM attendance_report_entries WHERE id = ${entryId} AND run_id = ${runId} AND manager_id = ${managerId}
        `)).rows as any[];
        if (!entry) continue;

        const originalValue = entry[origMap[field]];

        await db.execute(sql`
          INSERT INTO attendance_report_edits (run_id, entry_id, manager_id, field, original_value, proposed_value, reason, status)
          VALUES (${runId}, ${entryId}, ${managerId}, ${field}, ${String(originalValue)}, ${String(proposedValue)}, ${reason.trim()}, 'pending')
        `);
        editsCreated++;
      }

      await db.execute(sql`
        UPDATE attendance_report_manager_approvals
        SET status = 'edits_submitted'
        WHERE run_id = ${runId} AND manager_id = ${managerId}
      `);

      await storage.createAuditLog({
        actorId: managerId,
        action: "attendance_edits_submitted",
        changes: { runId, month: run.month, year: run.year, editsCount: editsCreated },
      });

      await checkAndAdvanceRunStatus(runId);

      const hrUsers = await getHrAdminUsers();

      const [manager] = await db.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
        .from(adminUsers)
        .where(eq(adminUsers.id, managerId));

      const monthName = new Date(run.year, run.month - 1, 1).toLocaleString("en-US", { month: "long" });

      const hrIds = hrUsers.map(u => u.id);
      if (hrIds.length > 0) {
        sendAttendanceEditsSubmittedEmail({
          toEmails: hrUsers.map(u => u.email),
          managerName: manager ? `${manager.firstName} ${manager.lastName}` : "A manager",
          month: monthName,
          year: run.year,
          correctionCount: editsCreated,
          reviewUrl: `${getPortalBaseUrl()}/admin/hr/reports?tab=attendance-approvals`,
        }).catch(console.error);

        await notifyUsers(hrIds, {
          title: "Attendance Corrections Submitted",
          message: `${manager ? `${manager.firstName} ${manager.lastName}` : "A manager"} submitted ${editsCreated} attendance correction(s) for ${monthName} ${run.year}. Please review.`,
          type: "action",
        });
      }

      res.json({ success: true, editsCreated });
    } catch (error) {
      console.error("Submit edits error:", error);
      res.status(500).json({ error: "Failed to submit edits" });
    }
  });

  app.get("/api/hr/attendance-report/edits/pending", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const edits = (await db.execute(sql`
        SELECT
          ed.*,
          emp.first_name AS emp_first_name, emp.last_name AS emp_last_name, emp.employee_id AS emp_employee_id,
          mgr.first_name AS mgr_first_name, mgr.last_name AS mgr_last_name,
          r.month, r.year,
          rv.first_name AS reviewer_first_name, rv.last_name AS reviewer_last_name
        FROM attendance_report_edits ed
        JOIN attendance_report_entries e ON e.id = ed.entry_id
        JOIN admin_users emp ON emp.id = e.user_id
        JOIN admin_users mgr ON mgr.id = ed.manager_id
        JOIN attendance_report_runs r ON r.id = ed.run_id
        LEFT JOIN admin_users rv ON rv.id = ed.reviewed_by
        WHERE ed.status = 'pending'
        ORDER BY ed.created_at DESC
      `)).rows as any[];

      res.json(edits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending edits" });
    }
  });

  app.patch("/api/hr/attendance-report/edits/:id/review", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const editId = req.params.id;
      const reviewerId = req.session.userId!;
      const { action, rejectionNote } = req.body;

      if (action !== "approve" && action !== "reject") {
        return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
      }

      const [edit] = (await db.execute(sql`
        SELECT ed.*, e.run_id FROM attendance_report_edits ed
        JOIN attendance_report_entries e ON e.id = ed.entry_id
        WHERE ed.id = ${editId}
      `)).rows as any[];
      if (!edit) return res.status(404).json({ error: "Edit not found" });
      if (edit.status !== "pending") return res.status(409).json({ error: "Edit already reviewed" });

      const newStatus = action === "approve" ? "approved" : "rejected";
      await db.execute(sql`
        UPDATE attendance_report_edits
        SET status = ${newStatus}, reviewed_by = ${reviewerId}, reviewed_at = NOW(), rejection_note = ${rejectionNote || null}
        WHERE id = ${editId}
      `);

      if (action === "approve") {
        const fieldColMap: Record<string, string> = {
          presentDays: "cur_present_days",
          absentDays: "cur_absent_days",
          lopDays: "cur_lop_days",
          leaveDays: "cur_leave_days",
          holidayDays: "cur_holiday_days",
          totalHours: "cur_total_hours",
        };
        const col = fieldColMap[edit.field];
        if (col) {
          await db.execute(sql`
            UPDATE attendance_report_entries
            SET ${sql.raw(col)} = ${String(edit.proposed_value)}
            WHERE id = ${edit.entry_id}
          `);
        }
      }

      await storage.createAuditLog({
        actorId: reviewerId,
        action: `attendance_edit_${action}d`,
        changes: { editId, runId: edit.run_id, managerId: edit.manager_id, field: edit.field, action },
      });

      const [managerApproval] = (await db.execute(sql`
        SELECT * FROM attendance_report_manager_approvals
        WHERE run_id = ${edit.run_id} AND manager_id = ${edit.manager_id}
      `)).rows as any[];

      const pendingEditsForManager = (await db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM attendance_report_edits ed
        JOIN attendance_report_entries e ON e.id = ed.entry_id
        WHERE ed.run_id = ${edit.run_id} AND ed.manager_id = ${edit.manager_id} AND ed.status = 'pending'
      `)).rows as any[];

      if ((pendingEditsForManager[0]?.cnt || 0) === 0 && managerApproval?.status === "edits_submitted") {
        await db.execute(sql`
          UPDATE attendance_report_manager_approvals
          SET status = 'approved', approved_at = NOW()
          WHERE run_id = ${edit.run_id} AND manager_id = ${edit.manager_id}
        `);
      }

      await checkAndAdvanceRunStatus(edit.run_id);

      res.json({ success: true });
    } catch (error) {
      console.error("Review edit error:", error);
      res.status(500).json({ error: "Failed to review edit" });
    }
  });

  app.post("/api/hr/attendance-report/runs/:id/override", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const runId = req.params.id;
      const overrideBy = req.session.userId!;
      const { overrideNote, managerId } = req.body;

      if (!overrideNote?.trim()) {
        return res.status(400).json({ error: "Override note is required" });
      }

      const [run] = (await db.execute(sql`SELECT * FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
      if (!run) return res.status(404).json({ error: "Run not found" });

      if (managerId) {
        await db.execute(sql`
          UPDATE attendance_report_manager_approvals
          SET status = 'overridden', override_by = ${overrideBy}, override_note = ${overrideNote.trim()}, overridden_at = NOW()
          WHERE run_id = ${runId} AND manager_id = ${managerId}
        `);
        await checkAndAdvanceRunStatus(runId);
      } else {
        await db.execute(sql`
          UPDATE attendance_report_runs
          SET status = 'overridden', override_by = ${overrideBy}, override_note = ${overrideNote.trim()}, updated_at = NOW()
          WHERE id = ${runId}
        `);
        sendApprovalCompleteNotification(runId, run.month, run.year, true).catch(console.error);
      }

      await storage.createAuditLog({
        actorId: overrideBy,
        action: "attendance_report_override",
        changes: { runId, managerId: managerId || null, overrideNote: overrideNote.trim() },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Override run error:", error);
      res.status(500).json({ error: "Failed to override" });
    }
  });

  app.get("/api/hr/attendance-report/edits/pending-count", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const [row] = (await db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM attendance_report_edits WHERE status = 'pending'
      `)).rows as any[];
      res.json({ count: row?.cnt || 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/hr/attendance-report/runs/:id/check-deadline", requireAuth, requireHrOrAdmin, async (req: Request, res: Response) => {
    try {
      const runId = req.params.id;
      const [run] = (await db.execute(sql`SELECT * FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
      if (!run) return res.status(404).json({ error: "Not found" });

      const deadline = run.deadline_at ? new Date(run.deadline_at) : null;
      const expired = deadline && deadline < new Date();

      const terminalStatuses = ["approved", "overridden", "deadline_expired"];
      if (expired && !terminalStatuses.includes(run.status)) {
        await db.execute(sql`
          UPDATE attendance_report_runs SET status = 'deadline_expired', updated_at = NOW() WHERE id = ${runId}
        `);

        const hrUsers = await getHrAdminUsers();
        const monthName = new Date(run.year, run.month - 1, 1).toLocaleString("en-US", { month: "long" });

        sendAttendanceDeadlineExpiredEmail({
          toEmails: hrUsers.map(u => u.email),
          month: monthName,
          year: run.year,
          overrideUrl: `${getPortalBaseUrl()}/admin/hr/reports?tab=attendance-approvals`,
        }).catch(console.error);

        await notifyUsers(hrUsers.map(u => u.id), {
          title: "Attendance Approval Deadline Expired",
          message: `The 24-hour approval window for ${monthName} ${run.year} attendance has expired. HR override required to proceed with salary run.`,
          type: "warning",
        });
      }

      res.json({ expired: !!expired, status: run.status });
    } catch (error) {
      res.status(500).json({ error: "Failed" });
    }
  });
}
