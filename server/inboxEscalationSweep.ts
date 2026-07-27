/**
 * Manager Inbox Auto-Escalation Sweep
 * Runs daily at 8 AM IST via scheduler.
 *
 * Two passes:
 *  1. Auto-resolve: mark rows resolved when the underlying source item has been actioned
 *  2. Auto-escalate: promote tier-1/tier-2 rows that have sat ≥ 48h without action
 *     For deferred items: escalation triggers 48h AFTER defer_until (not after deferral was set)
 */
import { db } from "./db";
import { sql } from "drizzle-orm";
import { notifyUser } from "./notifications";

export interface EscalationSweepResult {
  resolved: number;
  escalated: number;
  notified: number;
}

const TIER_ROLES: Record<string, string[]> = {
  hr_admin: ["hr", "admin"],
  super_admin: ["super_admin"],
};

export async function runInboxEscalationSweep(): Promise<EscalationSweepResult> {
  let resolved = 0;
  let escalated = 0;
  let notified = 0;

  // ── Pass 0: Materialize baseline rows for all live manager-scope items ────
  // If a manager never interacts with an item, no row exists — so the 48h escalation
  // would never fire. This pass upserts DO-NOTHING rows for every currently-pending
  // source item so unattended items can age and auto-escalate correctly.
  try {
    // Leave approvals
    await db.execute(sql`
      INSERT INTO manager_action_due_dates
        (id, assignee_id, assignee_tier, item_type, item_id, status, original_assigned_at)
      SELECT gen_random_uuid(), au.manager_id, 'manager', 'leave_approval', lr.id::text, 'new', lr.created_at
      FROM leave_requests lr
      JOIN admin_users au ON au.id = lr.user_id
      WHERE lr.status = 'pending'
        AND au.manager_id IS NOT NULL
      ON CONFLICT (assignee_id, item_type, item_id) DO NOTHING
    `);

    // Attendance corrections
    await db.execute(sql`
      INSERT INTO manager_action_due_dates
        (id, assignee_id, assignee_tier, item_type, item_id, status, original_assigned_at)
      SELECT gen_random_uuid(), au.manager_id, 'manager', 'attendance_correction', ar.id, 'new', ar.created_at
      FROM attendance_regularizations ar
      JOIN admin_users au ON au.id = ar.employee_id
      WHERE ar.status = 'pending'
        AND au.manager_id IS NOT NULL
      ON CONFLICT (assignee_id, item_type, item_id) DO NOTHING
    `);

    // Probation check-ins overdue
    await db.execute(sql`
      INSERT INTO manager_action_due_dates
        (id, assignee_id, assignee_tier, item_type, item_id, status, original_assigned_at)
      SELECT gen_random_uuid(), au.manager_id, 'manager', 'probation_checkin', pc.id::text, 'new', pc.created_at
      FROM probation_checkins pc
      JOIN admin_users au ON au.id = pc.employee_id
      WHERE pc.status = 'pending'
        AND pc.due_date <= CURRENT_DATE + INTERVAL '2 days'
        AND au.manager_id IS NOT NULL
      ON CONFLICT (assignee_id, item_type, item_id) DO NOTHING
    `);

    // PIP check-ins overdue
    await db.execute(sql`
      INSERT INTO manager_action_due_dates
        (id, assignee_id, assignee_tier, item_type, item_id, status, original_assigned_at)
      SELECT gen_random_uuid(), au.manager_id, 'manager', 'pip_checkin', ep.id::text, 'new', ep.created_at
      FROM employee_plans ep
      JOIN admin_users au ON au.id = ep.employee_id
      WHERE ep.plan_type = 'pip' AND ep.status = 'active'
        AND ep.next_checkin_due <= CURRENT_DATE + INTERVAL '2 days'
        AND au.manager_id IS NOT NULL
      ON CONFLICT (assignee_id, item_type, item_id) DO NOTHING
    `);

    // Training compliance locks
    await db.execute(sql`
      INSERT INTO manager_action_due_dates
        (id, assignee_id, assignee_tier, item_type, item_id, status, original_assigned_at)
      SELECT gen_random_uuid(), au.manager_id, 'manager', 'training_compliance', et.id::text, 'new', et.created_at
      FROM employee_training et
      JOIN admin_users au ON au.id = et.user_id
      WHERE et.compliance_locked = TRUE AND et.status != 'completed'
        AND au.manager_id IS NOT NULL
      ON CONFLICT (assignee_id, item_type, item_id) DO NOTHING
    `);

    // Offer letters pending manager approval — keyed by created_by
    await db.execute(sql`
      INSERT INTO manager_action_due_dates
        (id, assignee_id, assignee_tier, item_type, item_id, status, original_assigned_at)
      SELECT gen_random_uuid(), ol.created_by, 'manager', 'offer_letter', ol.id, 'new', ol.created_at
      FROM offer_letters ol
      WHERE ol.status = 'pending_approval'
        AND ol.created_by IS NOT NULL
      ON CONFLICT (assignee_id, item_type, item_id) DO NOTHING
    `);

    // Offer letters pending HR counter-signature — seed hr_admin rows for ALL active HR/Admin users.
    // Without these rows, unattended pending_countersign letters would never auto-escalate to super_admin.
    await db.execute(sql`
      INSERT INTO manager_action_due_dates
        (id, assignee_id, assignee_tier, item_type, item_id, status, original_assigned_at)
      SELECT gen_random_uuid(), au.id, 'hr_admin', 'offer_letter', ol.id, 'new', ol.created_at
      FROM offer_letters ol
      CROSS JOIN admin_users au
      WHERE ol.status = 'pending_countersign'
        AND au.role IN ('hr', 'admin')
        AND au.is_active = TRUE
      ON CONFLICT (assignee_id, item_type, item_id) DO NOTHING
    `);
  } catch (err) {
    console.error("[inboxSweep] Materialization pass failed:", err);
  }

  // ── Pass 1: Auto-resolve rows whose source item is no longer pending ───────
  try {
    // Leave approvals that have been approved/rejected
    await db.execute(sql`
      UPDATE manager_action_due_dates madd
      SET status = 'resolved', updated_at = NOW()
      WHERE madd.item_type = 'leave_approval'
        AND madd.status NOT IN ('resolved')
        AND EXISTS (
          SELECT 1 FROM leave_requests lr
          WHERE lr.id = madd.item_id::int
            AND lr.status NOT IN ('pending')
        )
    `);

    // Count rows affected (approximate — run a quick count before/after is complex; log separately)
    const leaveResolved = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM manager_action_due_dates
      WHERE item_type = 'leave_approval' AND status = 'resolved'
        AND updated_at >= NOW() - INTERVAL '5 minutes'
    `);
    resolved += Number((leaveResolved.rows as any[])[0]?.cnt ?? 0);

    // Attendance corrections that have been approved/rejected
    await db.execute(sql`
      UPDATE manager_action_due_dates madd
      SET status = 'resolved', updated_at = NOW()
      WHERE madd.item_type = 'attendance_correction'
        AND madd.status NOT IN ('resolved')
        AND EXISTS (
          SELECT 1 FROM attendance_regularizations ar
          WHERE ar.id = madd.item_id
            AND ar.status NOT IN ('pending')
        )
    `);

    // Offer letters — tier-aware resolution to prevent stale manager rows:
    // Manager rows resolve as soon as OL leaves 'pending_approval' (manager's responsibility ends
    // when they approve; at that point HR takes over for counter-signature).
    await db.execute(sql`
      UPDATE manager_action_due_dates madd
      SET status = 'resolved', updated_at = NOW()
      WHERE madd.item_type = 'offer_letter'
        AND madd.assignee_tier = 'manager'
        AND madd.status NOT IN ('resolved')
        AND EXISTS (
          SELECT 1 FROM offer_letters ol
          WHERE ol.id = madd.item_id
            AND ol.status NOT IN ('pending_approval', 'draft')
        )
    `);
    // HR/Admin rows resolve when OL leaves 'pending_countersign' (HR's responsibility ends)
    await db.execute(sql`
      UPDATE manager_action_due_dates madd
      SET status = 'resolved', updated_at = NOW()
      WHERE madd.item_type = 'offer_letter'
        AND madd.assignee_tier IN ('hr_admin', 'super_admin')
        AND madd.status NOT IN ('resolved')
        AND EXISTS (
          SELECT 1 FROM offer_letters ol
          WHERE ol.id = madd.item_id
            AND ol.status NOT IN ('pending_countersign')
        )
    `);

    // Training compliance: resolved when employee is no longer locked
    await db.execute(sql`
      UPDATE manager_action_due_dates madd
      SET status = 'resolved', updated_at = NOW()
      WHERE madd.item_type = 'training_compliance'
        AND madd.status NOT IN ('resolved')
        AND EXISTS (
          SELECT 1 FROM employee_training et
          WHERE et.id = madd.item_id::int
            AND (et.compliance_locked = FALSE OR et.status = 'completed')
        )
    `);

    // Probation check-ins: resolved when completed
    await db.execute(sql`
      UPDATE manager_action_due_dates madd
      SET status = 'resolved', updated_at = NOW()
      WHERE madd.item_type = 'probation_checkin'
        AND madd.status NOT IN ('resolved')
        AND EXISTS (
          SELECT 1 FROM probation_checkins pc
          WHERE pc.id = madd.item_id::int
            AND pc.status NOT IN ('pending')
        )
    `);

    // PIP check-ins: resolved when plan is no longer active or check-in date has passed
    await db.execute(sql`
      UPDATE manager_action_due_dates madd
      SET status = 'resolved', updated_at = NOW()
      WHERE madd.item_type = 'pip_checkin'
        AND madd.status NOT IN ('resolved')
        AND EXISTS (
          SELECT 1 FROM employee_plans ep
          WHERE ep.id = madd.item_id::int
            AND (
              ep.status NOT IN ('active')
              OR ep.next_checkin_due > CURRENT_DATE + INTERVAL '2 days'
            )
        )
    `);
  } catch (err) {
    console.error("[inboxSweep] Auto-resolve pass failed:", err);
  }

  // ── Pass 2: Auto-escalate overdue items ───────────────────────────────────
  try {
    // Items are overdue if:
    //   - Never deferred: original_assigned_at <= NOW() - 48h
    //   - Deferred: defer_until <= NOW() - 48h (48h AFTER the deferral expired)
    const overdueRows = await db.execute(sql`
      SELECT
        madd.id,
        madd.item_type,
        madd.item_id,
        madd.assignee_id,
        madd.assignee_tier,
        madd.original_assigned_at,
        madd.defer_until
      FROM manager_action_due_dates madd
      WHERE madd.status IN ('new', 'deferred')
        AND madd.assignee_tier != 'super_admin'
        AND (
          (madd.defer_until IS NULL AND madd.original_assigned_at <= NOW() - INTERVAL '48 hours')
          OR
          (madd.defer_until IS NOT NULL AND madd.defer_until <= NOW() - INTERVAL '48 hours')
        )
      LIMIT 200
    `);

    for (const row of overdueRows.rows as any[]) {
      try {
        const nextTier = row.assignee_tier === "manager" ? "hr_admin" : "super_admin";
        const nextRoles = TIER_ROLES[nextTier] ?? ["super_admin"];

        // Mark current row as auto-escalated
        await db.execute(sql`
          UPDATE manager_action_due_dates
          SET status = 'escalated',
              escalated_at = NOW(),
              escalation_reason = 'Auto-escalated after 48h without action',
              updated_at = NOW()
          WHERE id = ${row.id}
        `);

        await db.execute(sql`
          INSERT INTO manager_inbox_audit (id, action_due_date_id, actor_id, action, note)
          VALUES (gen_random_uuid(), ${row.id}, ${row.assignee_id}, 'auto_escalated',
                  'Auto-escalated by daily inbox sweep after 48h')
        `);

        escalated++;

        // Create/update next-tier user rows and notify — no LIMIT so all eligible users receive the item
        const nextUsers = await db.execute(sql`
          SELECT id, email, first_name, last_name
          FROM admin_users
          WHERE role = ANY(${nextRoles}::text[])
            AND is_active = TRUE
        `);

        for (const nextUser of nextUsers.rows as any[]) {
          await db.execute(sql`
            INSERT INTO manager_action_due_dates
              (id, assignee_id, assignee_tier, item_type, item_id, status, escalated_at, escalation_reason)
            VALUES
              (gen_random_uuid(), ${nextUser.id}, ${nextTier}, ${row.item_type}, ${row.item_id},
               'new', NOW(), 'Auto-escalated after 48h without action')
            ON CONFLICT (assignee_id, item_type, item_id)
            DO UPDATE SET
              status = 'new',
              escalated_at = NOW(),
              escalation_reason = 'Auto-escalated after 48h without action',
              updated_at = NOW()
          `);

          await notifyUser(nextUser.id, {
            type: "hr_action_required",
            title: "Action escalated to you",
            message: `An inbox item (${row.item_type.replace(/_/g, " ")}) was auto-escalated to you after 48 hours without action. Please review your Inbox.`,
            link: "/admin/inbox",
          });
          notified++;
        }
      } catch (err) {
        console.error(`[inboxSweep] Failed to escalate row ${row.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[inboxSweep] Escalation pass failed:", err);
  }

  return { resolved, escalated, notified };
}
