/**
 * Manager Inbox routes — Linear-style action triage with escalation chain.
 *
 * Architecture: view layer on top of existing data. buildInboxItems() queries the
 * same underlying tables (leave_requests, offer_letters, etc.) used by other endpoints
 * such as /api/governance/pulse. We use direct SQL rather than HTTP sub-requests to
 * avoid circular in-process calls and extra latency — the WHERE clauses mirror those
 * endpoints' logic exactly.
 *
 * Visibility model:
 *   manager     → live items for their direct reports; escalated items are HIDDEN (prior-tier lock)
 *   hr_admin    → items escalated to them (manager_action_due_dates) + offer-letter countersign
 *   super_admin → items escalated to them (manager_action_due_dates); can resolve directly
 */
import type { Express } from "express";
import { db } from "./db";
import { sql, eq, and, inArray } from "drizzle-orm";
import {
  adminUsers,
  managerActionDueDates,
  managerInboxAudit,
} from "@shared/schema";
import { notifyUser } from "./notifications";
import { requireAuth } from "./auth";

type InboxItemType =
  | "leave_approval"
  | "offer_letter"
  | "probation_checkin"
  | "attendance_correction"
  | "pip_checkin"
  | "training_compliance";

type AssigneeTier = "manager" | "hr_admin" | "super_admin";

function roleToTier(role: string): AssigneeTier {
  if (role === "super_admin") return "super_admin";
  if (role === "hr" || role === "admin") return "hr_admin";
  return "manager";
}

function nextTier(tier: AssigneeTier): AssigneeTier | null {
  if (tier === "manager") return "hr_admin";
  if (tier === "hr_admin") return "super_admin";
  return null;
}

const ITEM_TYPE_META: Record<InboxItemType, { label: string; deepLink: string }> = {
  leave_approval: { label: "Leave Approval", deepLink: "/admin/hr/leave-approvals" },
  offer_letter: { label: "Offer Letter", deepLink: "/admin/new-hire?tab=offer-letters" },
  probation_checkin: { label: "Probation Check-in", deepLink: "/admin/hr/my-team?tab=team" },
  attendance_correction: { label: "Attendance Correction", deepLink: "/admin/hr/my-team?tab=corrections" },
  pip_checkin: { label: "PIP Check-in", deepLink: "/admin/hr/my-team?tab=team" },
  training_compliance: { label: "Training Compliance", deepLink: "/admin/growth?tab=training-mgmt" },
};

const INBOX_ROLES = ["manager", "hr", "admin", "super_admin"];

/** Fetch live inbox items. Visibility is tier-appropriate. */
async function buildInboxItems(userId: string, role: string) {
  const tier = roleToTier(role);
  const items: any[] = [];

  if (tier === "manager") {
    // Manager sees live items for their own direct reports only

    // 1. Leave approvals
    try {
      const rows = await db.execute(sql`
        SELECT lr.id, lr.user_id AS employee_id,
               COALESCE(au.first_name || ' ' || au.last_name, au.email) AS employee_name,
               lr.type AS leave_type, lr.start_date, lr.end_date, lr.created_at
        FROM leave_requests lr
        JOIN admin_users au ON au.id = lr.user_id
        WHERE lr.status = 'pending' AND au.manager_id = ${userId}
        ORDER BY lr.created_at ASC LIMIT 50
      `);
      for (const r of rows.rows as any[]) {
        items.push({
          itemType: "leave_approval" as InboxItemType,
          itemId: String(r.id),
          employeeName: r.employee_name || "Employee",
          employeeId: r.employee_id,
          description: `${r.leave_type ?? "Leave"} request: ${r.start_date ? new Date(r.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}${r.end_date && r.end_date !== r.start_date ? " – " + new Date(r.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}`,
          createdAt: r.created_at,
        });
      }
    } catch {}

    // 2. Offer letters pending manager approval — scoped to OLs created by this manager
    try {
      const rows = await db.execute(sql`
        SELECT ol.id, ol.candidate_name, ol.created_at
        FROM offer_letters ol
        WHERE ol.status = 'pending_approval'
          AND ol.created_by = ${userId}
        ORDER BY ol.created_at ASC LIMIT 30
      `);
      for (const r of rows.rows as any[]) {
        items.push({
          itemType: "offer_letter" as InboxItemType,
          itemId: String(r.id),
          employeeName: r.candidate_name || "Candidate",
          employeeId: null,
          description: "Awaiting approval",
          createdAt: r.created_at,
        });
      }
    } catch {}

    // 3. Attendance corrections
    try {
      const rows = await db.execute(sql`
        SELECT ar.id, ar.employee_id,
               COALESCE(au.first_name || ' ' || au.last_name, au.email) AS employee_name,
               ar.attendance_date, ar.created_at
        FROM attendance_regularizations ar
        JOIN admin_users au ON au.id = ar.employee_id
        WHERE ar.status = 'pending' AND au.manager_id = ${userId}
        ORDER BY ar.created_at ASC LIMIT 30
      `);
      for (const r of rows.rows as any[]) {
        items.push({
          itemType: "attendance_correction" as InboxItemType,
          itemId: String(r.id),
          employeeName: r.employee_name || "Employee",
          employeeId: r.employee_id,
          description: `Punch correction request for ${r.attendance_date ? new Date(r.attendance_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "date unknown"}`,
          createdAt: r.created_at,
        });
      }
    } catch {}

    // 4. Probation check-ins overdue
    try {
      const rows = await db.execute(sql`
        SELECT pc.id, pc.employee_id,
               COALESCE(au.first_name || ' ' || au.last_name, au.email) AS employee_name,
               pc.milestone_day, pc.due_date, pc.created_at
        FROM probation_checkins pc
        JOIN admin_users au ON au.id = pc.employee_id
        WHERE pc.status = 'pending' AND pc.due_date <= CURRENT_DATE + INTERVAL '2 days'
          AND au.manager_id = ${userId}
        ORDER BY pc.due_date ASC LIMIT 20
      `);
      for (const r of rows.rows as any[]) {
        items.push({
          itemType: "probation_checkin" as InboxItemType,
          itemId: String(r.id),
          employeeName: r.employee_name || "Employee",
          employeeId: r.employee_id,
          description: `Day ${r.milestone_day} probation check-in due${r.due_date ? " " + new Date(r.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}`,
          createdAt: r.created_at,
        });
      }
    } catch {}

    // 5. PIP check-ins overdue
    try {
      const rows = await db.execute(sql`
        SELECT ep.id, ep.employee_id,
               COALESCE(au.first_name || ' ' || au.last_name, au.email) AS employee_name,
               ep.next_checkin_due, ep.created_at
        FROM employee_plans ep
        JOIN admin_users au ON au.id = ep.employee_id
        WHERE ep.plan_type = 'pip' AND ep.status = 'active'
          AND ep.next_checkin_due <= CURRENT_DATE + INTERVAL '2 days'
          AND au.manager_id = ${userId}
        ORDER BY ep.next_checkin_due ASC LIMIT 20
      `);
      for (const r of rows.rows as any[]) {
        items.push({
          itemType: "pip_checkin" as InboxItemType,
          itemId: String(r.id),
          employeeName: r.employee_name || "Employee",
          employeeId: r.employee_id,
          description: `PIP coaching check-in due${r.next_checkin_due ? " " + new Date(r.next_checkin_due).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}`,
          createdAt: r.created_at,
        });
      }
    } catch {}

    // 6. Training compliance locks
    try {
      const rows = await db.execute(sql`
        SELECT et.id AS track_id, et.user_id AS employee_id,
               COALESCE(au.first_name || ' ' || au.last_name, au.email) AS employee_name,
               et.created_at
        FROM employee_training et
        JOIN admin_users au ON au.id = et.user_id
        WHERE et.compliance_locked = TRUE AND et.status != 'completed'
          AND au.manager_id = ${userId}
        ORDER BY et.created_at ASC LIMIT 20
      `);
      for (const r of rows.rows as any[]) {
        items.push({
          itemType: "training_compliance" as InboxItemType,
          itemId: String(r.track_id),
          employeeName: r.employee_name || "Employee",
          employeeId: r.employee_id,
          description: "Training compliance lock — employee blocked from portal access",
          createdAt: r.created_at,
        });
      }
    } catch {}

  } else if (tier === "hr_admin") {
    // HR/Admin: only see items escalated to them + offer letters pending countersign

    // Items escalated to this specific user — join back to source tables for employee name
    try {
      const rows = await db.execute(sql`
        SELECT
          madd.item_type,
          madd.item_id,
          madd.escalation_reason,
          madd.escalated_at,
          madd.created_at,
          COALESCE(
            CASE madd.item_type
              WHEN 'leave_approval'       THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM leave_requests lr JOIN admin_users au2 ON au2.id = lr.user_id WHERE lr.id = madd.item_id::int LIMIT 1)
              WHEN 'attendance_correction' THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM attendance_regularizations ar JOIN admin_users au2 ON au2.id = ar.employee_id WHERE ar.id = madd.item_id LIMIT 1)
              WHEN 'offer_letter'         THEN (SELECT ol.candidate_name FROM offer_letters ol WHERE ol.id = madd.item_id LIMIT 1)
              WHEN 'probation_checkin'    THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM probation_checkins pc JOIN admin_users au2 ON au2.id = pc.employee_id WHERE pc.id = madd.item_id::int LIMIT 1)
              WHEN 'pip_checkin'          THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM employee_plans ep JOIN admin_users au2 ON au2.id = ep.employee_id WHERE ep.id = madd.item_id::int LIMIT 1)
              WHEN 'training_compliance'  THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM employee_training et JOIN admin_users au2 ON au2.id = et.user_id WHERE et.id = madd.item_id::int LIMIT 1)
            END,
            'Employee'
          ) AS employee_name
        FROM manager_action_due_dates madd
        WHERE madd.assignee_id = ${userId}
          AND madd.assignee_tier = 'hr_admin'
          AND madd.status IN ('new', 'deferred')
        ORDER BY madd.created_at ASC LIMIT 50
      `);
      for (const r of rows.rows as any[]) {
        items.push({
          itemType: r.item_type as InboxItemType,
          itemId: String(r.item_id),
          employeeName: r.employee_name || "Employee",
          employeeId: null,
          description: `Escalated: ${ITEM_TYPE_META[r.item_type as InboxItemType]?.label ?? r.item_type}${r.escalation_reason ? " — " + r.escalation_reason : ""}`,
          createdAt: r.escalated_at ?? r.created_at,
          isEscalated: true,
        });
      }
    } catch {}

    // Offer letters pending HR counter-signature (inherently HR-level, no escalation needed)
    try {
      const rows = await db.execute(sql`
        SELECT ol.id, ol.candidate_name, ol.created_at
        FROM offer_letters ol
        WHERE ol.status = 'pending_countersign'
        ORDER BY ol.created_at ASC LIMIT 30
      `);
      for (const r of rows.rows as any[]) {
        items.push({
          itemType: "offer_letter" as InboxItemType,
          itemId: String(r.id),
          employeeName: r.candidate_name || "Candidate",
          employeeId: null,
          description: "Awaiting HR counter-signature",
          createdAt: r.created_at,
        });
      }
    } catch {}

  } else {
    // super_admin: only items escalated to them — join back to source tables for employee name
    try {
      const rows = await db.execute(sql`
        SELECT
          madd.item_type,
          madd.item_id,
          madd.escalation_reason,
          madd.escalated_at,
          madd.created_at,
          COALESCE(
            CASE madd.item_type
              WHEN 'leave_approval'       THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM leave_requests lr JOIN admin_users au2 ON au2.id = lr.user_id WHERE lr.id = madd.item_id::int LIMIT 1)
              WHEN 'attendance_correction' THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM attendance_regularizations ar JOIN admin_users au2 ON au2.id = ar.employee_id WHERE ar.id = madd.item_id LIMIT 1)
              WHEN 'offer_letter'         THEN (SELECT ol.candidate_name FROM offer_letters ol WHERE ol.id = madd.item_id LIMIT 1)
              WHEN 'probation_checkin'    THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM probation_checkins pc JOIN admin_users au2 ON au2.id = pc.employee_id WHERE pc.id = madd.item_id::int LIMIT 1)
              WHEN 'pip_checkin'          THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM employee_plans ep JOIN admin_users au2 ON au2.id = ep.employee_id WHERE ep.id = madd.item_id::int LIMIT 1)
              WHEN 'training_compliance'  THEN (SELECT COALESCE(au2.first_name || ' ' || au2.last_name, au2.email) FROM employee_training et JOIN admin_users au2 ON au2.id = et.user_id WHERE et.id = madd.item_id::int LIMIT 1)
            END,
            'Employee'
          ) AS employee_name
        FROM manager_action_due_dates madd
        WHERE madd.assignee_id = ${userId}
          AND madd.assignee_tier = 'super_admin'
          AND madd.status IN ('new', 'deferred')
        ORDER BY madd.created_at ASC LIMIT 50
      `);
      for (const r of rows.rows as any[]) {
        items.push({
          itemType: r.item_type as InboxItemType,
          itemId: String(r.item_id),
          employeeName: r.employee_name || "Employee",
          employeeId: null,
          description: `Escalated: ${ITEM_TYPE_META[r.item_type as InboxItemType]?.label ?? r.item_type}${r.escalation_reason ? " — " + r.escalation_reason : ""}`,
          createdAt: r.escalated_at ?? r.created_at,
          isEscalated: true,
        });
      }
    } catch {}
  }

  return items;
}

/** Check whether the caller is authorized to act on the given item */
async function isItemInScope(userId: string, role: string, itemType: InboxItemType, itemId: string): Promise<boolean> {
  const tier = roleToTier(role);

  if (tier === "manager") {
    // Must have an ACTIVE (new/deferred) triage row OR a live pending source item.
    // Escalated/resolved rows must NOT grant access — this enforces the chain-of-custody lock:
    // once escalated, the manager can no longer act on the item via API.
    const row = await db
      .select({ id: managerActionDueDates.id, status: managerActionDueDates.status })
      .from(managerActionDueDates)
      .where(and(
        eq(managerActionDueDates.assigneeId, userId),
        eq(managerActionDueDates.itemType, itemType as any),
        eq(managerActionDueDates.itemId, itemId),
      ))
      .limit(1);
    // If a row exists but is escalated or resolved, explicitly deny
    if (row.length > 0 && (row[0].status === "escalated" || row[0].status === "resolved")) return false;
    if (row.length > 0) return true;

    // Also allow if they are the live responsible manager
    if (itemType === "leave_approval") {
      const r = await db.execute(sql`
        SELECT 1 FROM leave_requests lr JOIN admin_users au ON au.id = lr.user_id
        WHERE lr.id = ${itemId}::int AND au.manager_id = ${userId} AND lr.status = 'pending' LIMIT 1
      `);
      if ((r.rows as any[]).length > 0) return true;
    }
    if (itemType === "attendance_correction") {
      const r = await db.execute(sql`
        SELECT 1 FROM attendance_regularizations ar JOIN admin_users au ON au.id = ar.employee_id
        WHERE ar.id = ${itemId} AND au.manager_id = ${userId} AND ar.status = 'pending' LIMIT 1
      `);
      if ((r.rows as any[]).length > 0) return true;
    }
    if (itemType === "offer_letter") {
      // Managers can only act on offer letters they created
      const r = await db.execute(sql`
        SELECT 1 FROM offer_letters ol
        WHERE ol.id = ${itemId} AND ol.status = 'pending_approval'
          AND ol.created_by = ${userId} LIMIT 1
      `);
      if ((r.rows as any[]).length > 0) return true;
    }
    if (itemType === "probation_checkin") {
      const r = await db.execute(sql`
        SELECT 1 FROM probation_checkins pc
        JOIN admin_users au ON au.id = pc.employee_id
        WHERE pc.id = ${itemId}::int AND au.manager_id = ${userId} AND pc.status = 'pending' LIMIT 1
      `);
      if ((r.rows as any[]).length > 0) return true;
    }
    if (itemType === "pip_checkin") {
      const r = await db.execute(sql`
        SELECT 1 FROM employee_plans ep
        JOIN admin_users au ON au.id = ep.employee_id
        WHERE ep.id = ${itemId}::int AND au.manager_id = ${userId}
          AND ep.plan_type = 'pip' AND ep.status = 'active' LIMIT 1
      `);
      if ((r.rows as any[]).length > 0) return true;
    }
    if (itemType === "training_compliance") {
      const r = await db.execute(sql`
        SELECT 1 FROM employee_training et
        JOIN admin_users au ON au.id = et.user_id
        WHERE et.id = ${itemId}::int AND au.manager_id = ${userId}
          AND et.compliance_locked = TRUE AND et.status != 'completed' LIMIT 1
      `);
      if ((r.rows as any[]).length > 0) return true;
    }
    return false;
  }

  // HR/Admin and Super Admin: item must be assigned to them in manager_action_due_dates
  // OR (HR/Admin) it's an offer_letter pending countersign
  if (tier === "hr_admin" && itemType === "offer_letter") {
    const r = await db.execute(sql`
      SELECT 1 FROM offer_letters ol
      WHERE ol.id = ${itemId} AND ol.status = 'pending_countersign' LIMIT 1
    `);
    if ((r.rows as any[]).length > 0) return true;
  }

  const row = await db
    .select({ id: managerActionDueDates.id })
    .from(managerActionDueDates)
    .where(and(
      eq(managerActionDueDates.assigneeId, userId),
      eq(managerActionDueDates.assigneeTier, tier as any),
      eq(managerActionDueDates.itemType, itemType as any),
      eq(managerActionDueDates.itemId, itemId),
    ))
    .limit(1);
  return row.length > 0;
}

export function registerInboxRoutes(app: Express) {
  // GET /api/inbox — unified inbox for the current user
  app.get("/api/inbox", requireAuth, async (req: any, res) => {
    try {
      const userId: string = req.session.userId;
      const role: string = req.session.role ?? "employee";

      if (!INBOX_ROLES.includes(role)) {
        return res.json({ items: [], total: 0 });
      }

      const liveItems = await buildInboxItems(userId, role);

      // Merge with triage state rows from manager_action_due_dates for ALL tiers.
      // This ensures deferred items are hidden (snooze semantics) and escalated items
      // are excluded regardless of whether the user is manager, hr_admin, or super_admin.
      const tier = roleToTier(role);
      let statusMap: Record<string, any> = {};

      try {
        const rows = await db
          .select()
          .from(managerActionDueDates)
          .where(eq(managerActionDueDates.assigneeId, userId));
        for (const row of rows) {
          statusMap[`${row.itemType}:${row.itemId}`] = row;
        }
      } catch {}

      const now = new Date();
      const DEFER_CAP_HOURS = 48;

      const enriched = liveItems.map((item) => {
        const key = `${item.itemType}:${item.itemId}`;
        const row = statusMap[key];

        let status: "new" | "deferred" | "escalated" | "resolved" = item.isEscalated ? "new" : "new";
        let deferUntil: string | null = null;
        let escalatedAt: string | null = null;
        let escalationReason: string | null = null;
        let originalAssignedAt: string = item.createdAt ?? new Date().toISOString();

        if (row) {
          status = row.status as any;
          deferUntil = row.deferUntil ? new Date(row.deferUntil).toISOString() : null;
          escalatedAt = row.escalatedAt ? new Date(row.escalatedAt).toISOString() : null;
          escalationReason = row.escalationReason ?? null;
          originalAssignedAt = row.originalAssignedAt
            ? new Date(row.originalAssignedAt).toISOString()
            : item.createdAt;
        }

        // Deferred items past defer_until resurface
        if (status === "deferred" && deferUntil && new Date(deferUntil) <= now) {
          status = "new";
        }

        const assignedMs = new Date(originalAssignedAt).getTime();
        const waitingHours = (now.getTime() - assignedMs) / (1000 * 60 * 60);
        const isApproachingCap = waitingHours >= DEFER_CAP_HOURS * 0.75 && waitingHours < DEFER_CAP_HOURS;
        const isOverCap = waitingHours >= DEFER_CAP_HOURS;

        const meta = ITEM_TYPE_META[item.itemType as InboxItemType];

        return {
          id: row?.id ?? null,
          itemType: item.itemType,
          itemId: item.itemId,
          employeeName: item.employeeName,
          employeeId: item.employeeId ?? null,
          description: item.description,
          status,
          assigneeTier: row?.assigneeTier ?? tier,
          deferUntil,
          escalatedAt,
          escalationReason,
          originalAssignedAt,
          createdAt: item.createdAt,
          waitingHours: Math.round(waitingHours),
          isApproachingCap,
          isOverCap,
          typeLabel: meta?.label ?? item.itemType,
          deepLink: meta?.deepLink ?? "/admin/hr",
        };
      });

      // Prior-tier lock: once a manager escalates an item, it disappears from their view.
      // Deferred items that haven't expired are hidden (snooze semantics) until defer_until passes.
      // Only the tier it was escalated TO should see and act on it.
      const active = enriched.filter((i) =>
        i.status !== "resolved" &&
        i.status !== "escalated" &&
        i.status !== "deferred"          // deferred items whose deferUntil passed are already reset to "new" above
      );
      return res.json({ items: active, total: active.length });
    } catch (err) {
      console.error("[inbox] GET /api/inbox error:", err);
      return res.json({ items: [], total: 0 });
    }
  });

  // GET /api/inbox/count — lightweight count for notification-bell integration
  app.get("/api/inbox/count", requireAuth, async (req: any, res) => {
    try {
      const userId: string = req.session.userId;
      const role: string = req.session.role ?? "employee";

      if (!INBOX_ROLES.includes(role)) return res.json({ count: 0 });

      const liveItems = await buildInboxItems(userId, role);
      const tier = roleToTier(role);
      const now = new Date();
      const DEFER_CAP_HOURS = 48;

      // Load triage state for ALL tiers so defer/escalation status is honoured uniformly
      const triageRows = await db
        .select()
        .from(managerActionDueDates)
        .where(eq(managerActionDueDates.assigneeId, userId));
      const statusMap: Record<string, any> = {};
      for (const row of triageRows) statusMap[`${row.itemType}:${row.itemId}`] = row;

      const activeItems = liveItems.filter((item) => {
        const row = statusMap[`${item.itemType}:${item.itemId}`];
        if (!row) return true;
        if (row.status === "resolved") return false;
        if (row.status === "escalated") return false;
        // Deferred items with a future defer_until are snoozed (hidden)
        if (row.status === "deferred" && row.deferUntil && new Date(row.deferUntil) > now) return false;
        return true;
      });

      const activeCount = activeItems.length;

      // urgentCount = active items approaching or past the 48h SLA cap (≥75%).
      const urgentCount = activeItems.filter((item) => {
        const row = statusMap[`${item.itemType}:${item.itemId}`];
        const assignedMs = row?.originalAssignedAt
          ? new Date(row.originalAssignedAt).getTime()
          : new Date(item.createdAt ?? now).getTime();
        const ageHours = (now.getTime() - assignedMs) / (1000 * 60 * 60);
        return ageHours >= DEFER_CAP_HOURS * 0.75;
      }).length;

      // todayDueCount = active items first assigned today (calendar day, IST).
      // Used by the punch-out banner: new items landing in the inbox on this calendar day
      // that are still unresolved at end-of-shift.
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0); // midnight local → good enough for banner
      const todayDueCount = activeItems.filter((item) => {
        const row = statusMap[`${item.itemType}:${item.itemId}`];
        const assignedMs = row?.originalAssignedAt
          ? new Date(row.originalAssignedAt).getTime()
          : new Date(item.createdAt ?? now).getTime();
        return assignedMs >= todayStart.getTime();
      }).length;

      return res.json({ count: activeCount, urgentCount, todayDueCount });
    } catch {
      return res.json({ count: 0, urgentCount: 0, todayDueCount: 0 });
    }
  });

  // POST /api/inbox/:itemType/:itemId/defer
  app.post("/api/inbox/:itemType/:itemId/defer", requireAuth, async (req: any, res) => {
    try {
      const userId: string = req.session.userId;
      const role: string = req.session.role ?? "employee";
      const { itemType, itemId } = req.params as { itemType: InboxItemType; itemId: string };
      const { deferUntil } = req.body as { deferUntil: string };

      if (!INBOX_ROLES.includes(role)) return res.status(403).json({ error: "Access denied" });
      if (!deferUntil) return res.status(400).json({ error: "deferUntil is required" });

      const deferDate = new Date(deferUntil);
      const now = new Date();

      if (isNaN(deferDate.getTime())) return res.status(400).json({ error: "Invalid deferUntil date" });
      if (deferDate <= now) return res.status(400).json({ error: "deferUntil must be in the future" });

      const capMs = 48 * 60 * 60 * 1000;
      if (deferDate.getTime() - now.getTime() > capMs + 60000) {
        return res.status(400).json({ error: "Deferral cannot exceed 48 hours from now" });
      }

      const inScope = await isItemInScope(userId, role, itemType, itemId);
      if (!inScope) return res.status(403).json({ error: "This item is not in your scope" });

      const tier = roleToTier(role);

      const existing = await db
        .select()
        .from(managerActionDueDates)
        .where(and(
          eq(managerActionDueDates.assigneeId, userId),
          eq(managerActionDueDates.itemType, itemType as any),
          eq(managerActionDueDates.itemId, itemId),
        ))
        .limit(1);

      let rowId: string;
      if (existing.length > 0) {
        const upd = await db
          .update(managerActionDueDates)
          .set({ status: "deferred", deferUntil: deferDate, updatedAt: new Date() })
          .where(eq(managerActionDueDates.id, existing[0].id))
          .returning({ id: managerActionDueDates.id });
        rowId = upd[0].id;
      } else {
        const ins = await db
          .insert(managerActionDueDates)
          .values({ assigneeId: userId, assigneeTier: tier, itemType: itemType as any, itemId, status: "deferred", deferUntil: deferDate })
          .returning({ id: managerActionDueDates.id });
        rowId = ins[0].id;
      }

      await db.insert(managerInboxAudit).values({
        actionDueDateId: rowId,
        actorId: userId,
        action: "deferred",
        note: `Deferred until ${deferDate.toISOString()}`,
      });

      return res.json({ ok: true, deferUntil: deferDate.toISOString() });
    } catch (err) {
      console.error("[inbox] defer error:", err);
      return res.status(500).json({ error: "Failed to defer item" });
    }
  });

  // POST /api/inbox/:itemType/:itemId/escalate
  app.post("/api/inbox/:itemType/:itemId/escalate", requireAuth, async (req: any, res) => {
    try {
      const userId: string = req.session.userId;
      const role: string = req.session.role ?? "employee";
      const { itemType, itemId } = req.params as { itemType: InboxItemType; itemId: string };
      const { reason } = req.body as { reason?: string };

      if (!INBOX_ROLES.includes(role)) return res.status(403).json({ error: "Access denied" });

      // Reason is required for manual escalation
      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ error: "A reason (at least 5 characters) is required to escalate" });
      }

      const currentTier = roleToTier(role);
      const nextT = nextTier(currentTier);
      if (!nextT) return res.status(400).json({ error: "Cannot escalate — already at super_admin tier" });

      const inScope = await isItemInScope(userId, role, itemType, itemId);
      if (!inScope) return res.status(403).json({ error: "This item is not in your scope" });

      // Find next-tier users
      const nextTierRoles = nextT === "hr_admin" ? ["hr", "admin"] : ["super_admin"];
      const nextUsers = await db
        .select({ id: adminUsers.id, email: adminUsers.email, firstName: adminUsers.firstName })
        .from(adminUsers)
        .where(and(inArray(adminUsers.role as any, nextTierRoles), eq(adminUsers.isActive, true)));

      const now = new Date();

      // Mark current row as escalated
      const existing = await db
        .select()
        .from(managerActionDueDates)
        .where(and(
          eq(managerActionDueDates.assigneeId, userId),
          eq(managerActionDueDates.itemType, itemType as any),
          eq(managerActionDueDates.itemId, itemId),
        ))
        .limit(1);

      let rowId: string;
      if (existing.length > 0) {
        const upd = await db
          .update(managerActionDueDates)
          .set({ status: "escalated", escalatedAt: now, escalationReason: reason.trim(), updatedAt: now })
          .where(eq(managerActionDueDates.id, existing[0].id))
          .returning({ id: managerActionDueDates.id });
        rowId = upd[0].id;
      } else {
        const ins = await db
          .insert(managerActionDueDates)
          .values({ assigneeId: userId, assigneeTier: currentTier, itemType: itemType as any, itemId, status: "escalated", escalatedAt: now, escalationReason: reason.trim() })
          .returning({ id: managerActionDueDates.id });
        rowId = ins[0].id;
      }

      await db.insert(managerInboxAudit).values({
        actionDueDateId: rowId,
        actorId: userId,
        action: "escalated",
        note: reason.trim(),
      });

      // Create next-tier rows and notify
      for (const nextUser of nextUsers) {
        try {
          await db
            .insert(managerActionDueDates)
            .values({
              assigneeId: nextUser.id,
              assigneeTier: nextT,
              itemType: itemType as any,
              itemId,
              status: "new",
              escalatedAt: now,
              escalationReason: reason.trim(),
            })
            .onConflictDoUpdate({
              target: [managerActionDueDates.assigneeId, managerActionDueDates.itemType, managerActionDueDates.itemId],
              set: { status: "new", escalatedAt: now, escalationReason: reason.trim(), updatedAt: now },
            });

          const typeLabel = ITEM_TYPE_META[itemType]?.label ?? itemType;
          await notifyUser(nextUser.id, {
            type: "hr_action_required",
            title: "Action escalated to you",
            message: `A ${typeLabel} item has been escalated to you: ${reason.trim()}. Please review your Inbox.`,
            link: "/admin/inbox",
          });
        } catch {}
      }

      return res.json({ ok: true, escalatedToTier: nextT, notified: nextUsers.length });
    } catch (err) {
      console.error("[inbox] escalate error:", err);
      return res.status(500).json({ error: "Failed to escalate item" });
    }
  });

  // POST /api/inbox/:itemType/:itemId/act — record that user clicked through to act on the item.
  // Does NOT resolve the row — resolution comes from the sweep's auto-resolve pass once the
  // underlying source item (leave/correction/etc.) is no longer pending.
  // Returns the deepLink URL so the frontend can navigate to the right page.
  app.post("/api/inbox/:itemType/:itemId/act", requireAuth, async (req: any, res) => {
    try {
      const userId: string = req.session.userId;
      const role: string = req.session.role ?? "employee";
      const { itemType, itemId } = req.params as { itemType: InboxItemType; itemId: string };
      const { note } = req.body as { note?: string };

      if (!INBOX_ROLES.includes(role)) return res.status(403).json({ error: "Access denied" });

      const inScope = await isItemInScope(userId, role, itemType, itemId);
      if (!inScope) return res.status(403).json({ error: "This item is not in your scope" });

      const tier = roleToTier(role);

      // Ensure a triage row exists (upsert) so the audit entry has a FK target
      const existing = await db
        .select()
        .from(managerActionDueDates)
        .where(and(
          eq(managerActionDueDates.assigneeId, userId),
          eq(managerActionDueDates.itemType, itemType as any),
          eq(managerActionDueDates.itemId, itemId),
        ))
        .limit(1);

      let rowId: string;
      if (existing.length > 0) {
        rowId = existing[0].id;
      } else {
        const ins = await db
          .insert(managerActionDueDates)
          .values({ assigneeId: userId, assigneeTier: tier, itemType: itemType as any, itemId, status: "new" })
          .returning({ id: managerActionDueDates.id });
        rowId = ins[0].id;
      }

      // Log act_clicked — the valid enum value; do NOT change status to resolved
      await db.insert(managerInboxAudit).values({
        actionDueDateId: rowId,
        actorId: userId,
        action: "act_clicked",
        note: note?.trim() || null,
      });

      const deepLink = ITEM_TYPE_META[itemType]?.deepLink ?? "/admin/hr";
      return res.json({ ok: true, deepLink });
    } catch (err) {
      console.error("[inbox] act error:", err);
      return res.status(500).json({ error: "Failed to record action" });
    }
  });

  // POST /api/inbox/:itemType/:itemId/reassign — super_admin or hr_admin can reassign back down
  app.post("/api/inbox/:itemType/:itemId/reassign", requireAuth, async (req: any, res) => {
    try {
      const userId: string = req.session.userId;
      const role: string = req.session.role ?? "employee";
      const { itemType, itemId } = req.params as { itemType: InboxItemType; itemId: string };
      const { targetUserId, note } = req.body as { targetUserId: string; note?: string };

      if (!["super_admin", "hr", "admin"].includes(role)) {
        return res.status(403).json({ error: "Only HR/Admin/Super Admin can reassign inbox items" });
      }
      if (!targetUserId) return res.status(400).json({ error: "targetUserId is required" });

      // HR/Admin must have this item assigned to them (escalated to their tier).
      // Super Admin has full override — no row check required.
      if (role !== "super_admin") {
        const scopeCheck = await db
          .select({ id: managerActionDueDates.id })
          .from(managerActionDueDates)
          .where(and(
            eq(managerActionDueDates.assigneeId, userId),
            eq(managerActionDueDates.itemType, itemType as any),
            eq(managerActionDueDates.itemId, itemId),
          ))
          .limit(1);
        if (scopeCheck.length === 0) {
          return res.status(403).json({ error: "This item is not assigned to you" });
        }
      }

      // Validate target user exists
      const [targetUser] = await db
        .select({ id: adminUsers.id, role: adminUsers.role, isActive: adminUsers.isActive, firstName: adminUsers.firstName })
        .from(adminUsers)
        .where(eq(adminUsers.id, targetUserId))
        .limit(1);

      if (!targetUser || !targetUser.isActive) {
        return res.status(404).json({ error: "Target user not found or inactive" });
      }

      const targetTier = roleToTier(targetUser.role as string);
      const now = new Date();

      // Create/update a new row for the target user
      await db
        .insert(managerActionDueDates)
        .values({
          assigneeId: targetUserId,
          assigneeTier: targetTier,
          itemType: itemType as any,
          itemId,
          status: "new",
          escalatedAt: now,
          escalationReason: `Reassigned by ${role}: ${note?.trim() || "no note"}`,
        })
        .onConflictDoUpdate({
          target: [managerActionDueDates.assigneeId, managerActionDueDates.itemType, managerActionDueDates.itemId],
          set: { status: "new", escalatedAt: now, escalationReason: `Reassigned by ${role}: ${note?.trim() || "no note"}`, updatedAt: now },
        });

      // Also log on the current user's row
      const currentRow = await db
        .select({ id: managerActionDueDates.id })
        .from(managerActionDueDates)
        .where(and(
          eq(managerActionDueDates.assigneeId, userId),
          eq(managerActionDueDates.itemType, itemType as any),
          eq(managerActionDueDates.itemId, itemId),
        ))
        .limit(1);

      if (currentRow.length > 0) {
        await db.insert(managerInboxAudit).values({
          actionDueDateId: currentRow[0].id,
          actorId: userId,
          action: "escalated",
          note: `Reassigned to ${targetUser.firstName ?? targetUserId}: ${note?.trim() || "no note"}`,
        });
      }

      await notifyUser(targetUserId, {
        type: "hr_action_required",
        title: "Inbox item assigned to you",
        message: `An inbox item (${ITEM_TYPE_META[itemType]?.label ?? itemType}) has been assigned to you. Please review your Inbox.`,
        link: "/admin/inbox",
      });

      return res.json({ ok: true, reassignedTo: targetUserId, tier: targetTier });
    } catch (err) {
      console.error("[inbox] reassign error:", err);
      return res.status(500).json({ error: "Failed to reassign item" });
    }
  });

  // POST /api/inbox/:itemType/:itemId/resolve — super_admin or hr_admin can resolve an item directly.
  // This is the "final tier resolves" flow — marks the triage row resolved and logs audit action.
  app.post("/api/inbox/:itemType/:itemId/resolve", requireAuth, async (req: any, res) => {
    try {
      const userId: string = req.session.userId;
      const role: string = req.session.role ?? "employee";
      const { itemType, itemId } = req.params as { itemType: InboxItemType; itemId: string };
      const { note } = req.body as { note?: string };

      if (!["super_admin", "hr", "admin"].includes(role)) {
        return res.status(403).json({ error: "Only HR/Admin/Super Admin can directly resolve inbox items" });
      }

      const tier = roleToTier(role);
      const now = new Date();

      // HR/Admin must have this item assigned to them (escalated to their tier).
      // Super Admin has full override — can resolve any item regardless of assignment.
      if (role !== "super_admin") {
        const scopeCheck = await db
          .select({ id: managerActionDueDates.id })
          .from(managerActionDueDates)
          .where(and(
            eq(managerActionDueDates.assigneeId, userId),
            eq(managerActionDueDates.itemType, itemType as any),
            eq(managerActionDueDates.itemId, itemId),
          ))
          .limit(1);
        if (scopeCheck.length === 0) {
          return res.status(403).json({ error: "This item is not assigned to you" });
        }
      }

      // Upsert a triage row for this user (in case no row exists yet for escalated items)
      const existing = await db
        .select({ id: managerActionDueDates.id })
        .from(managerActionDueDates)
        .where(and(
          eq(managerActionDueDates.assigneeId, userId),
          eq(managerActionDueDates.itemType, itemType as any),
          eq(managerActionDueDates.itemId, itemId),
        ))
        .limit(1);

      let rowId: string;
      if (existing.length > 0) {
        const upd = await db
          .update(managerActionDueDates)
          .set({ status: "resolved", updatedAt: now })
          .where(eq(managerActionDueDates.id, existing[0].id))
          .returning({ id: managerActionDueDates.id });
        rowId = upd[0].id;
      } else {
        const ins = await db
          .insert(managerActionDueDates)
          .values({ assigneeId: userId, assigneeTier: tier, itemType: itemType as any, itemId, status: "resolved" })
          .returning({ id: managerActionDueDates.id });
        rowId = ins[0].id;
      }

      // Also mark any other tiers' rows for this item as resolved (full chain clear)
      await db.execute(sql`
        UPDATE manager_action_due_dates
        SET status = 'resolved', updated_at = NOW()
        WHERE item_type = ${itemType} AND item_id = ${itemId}
          AND status != 'resolved'
      `);

      await db.insert(managerInboxAudit).values({
        actionDueDateId: rowId,
        actorId: userId,
        action: "resolved",
        note: note?.trim() || `Resolved by ${role}`,
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error("[inbox] resolve error:", err);
      return res.status(500).json({ error: "Failed to resolve item" });
    }
  });

  // GET /api/inbox/audit/:itemType/:itemId — full cross-tier audit history for an item.
  // HR/Admin/Super Admin see all tiers; manager sees only their own rows.
  app.get("/api/inbox/audit/:itemType/:itemId", requireAuth, async (req: any, res) => {
    try {
      const userId: string = req.session.userId;
      const role: string = req.session.role ?? "employee";
      const { itemType, itemId } = req.params as { itemType: InboxItemType; itemId: string };

      if (!INBOX_ROLES.includes(role)) return res.status(403).json({ error: "Access denied" });

      const tier = roleToTier(role);
      const isCrossTierRole = tier === "hr_admin" || tier === "super_admin";

      if (!isCrossTierRole) {
        // Manager: must have the item in scope
        const inScope = await isItemInScope(userId, role, itemType, itemId);
        if (!inScope) return res.status(403).json({ error: "This item is not in your scope" });
      }
      // HR/Admin/Super Admin: can see audit for any item (cross-tier governance visibility)

      const rows = await db.execute(sql`
        SELECT
          mia.id, mia.action, mia.note, mia.created_at,
          COALESCE(au.first_name || ' ' || au.last_name, au.email) AS actor_name,
          au.role AS actor_role,
          madd.assignee_tier
        FROM manager_inbox_audit mia
        JOIN manager_action_due_dates madd ON madd.id = mia.action_due_date_id
        JOIN admin_users au ON au.id = mia.actor_id
        WHERE madd.item_type = ${itemType} AND madd.item_id = ${itemId}
        ORDER BY mia.created_at DESC
        LIMIT 50
      `);

      return res.json({ history: rows.rows });
    } catch (err) {
      console.error("[inbox] audit error:", err);
      return res.status(500).json({ error: "Failed to load audit history" });
    }
  });

  // GET /api/inbox/escalated-count — super_admin governance overview
  app.get("/api/inbox/escalated-count", requireAuth, async (req: any, res) => {
    try {
      const role: string = req.session.role ?? "employee";
      if (!["super_admin", "admin", "hr"].includes(role)) return res.json({ count: 0, over24h: 0 });

      const tier = roleToTier(role);

      const rows = await db.execute(sql`
        SELECT COUNT(*) AS count,
               COUNT(*) FILTER (WHERE escalated_at <= NOW() - INTERVAL '24 hours') AS over24h
        FROM manager_action_due_dates
        WHERE assignee_tier = ${tier}
          AND status IN ('new', 'deferred')
          AND escalated_at IS NOT NULL
      `);

      const r = (rows.rows as any[])[0];
      return res.json({ count: Number(r?.count ?? 0), over24h: Number(r?.over24h ?? 0) });
    } catch {
      return res.json({ count: 0, over24h: 0 });
    }
  });
}
