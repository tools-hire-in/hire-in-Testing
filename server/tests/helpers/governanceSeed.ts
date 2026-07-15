/**
 * Governance Test Seed Hierarchy
 *
 * Creates and tears down a deterministic 5-level org chain for governance tests.
 * All IDs are fixed so cleanup is always reliable regardless of test outcome.
 *
 * Hierarchy:
 *   CEO  (super_admin) cc000001-…
 *   └── VP (admin)     cc000002-…
 *         └── Manager  cc000003-…
 *               ├── RecruiterA (operations) — active PIP, overdue goals
 *               └── RecruiterB (operations) — active probation, overdue milestone
 *   HR Lead (hr)       cc000006-…  ← skip-level escalation recipient
 */

import { db } from "../../db.js";
import { sql } from "drizzle-orm";

// ── Fixed UUIDs (all valid UUID format, deterministic) ────────────────────────
export const GC_CEO_ID       = "cc000001-0000-0000-0000-000000000000";
export const GC_VP_ID        = "cc000002-0000-0000-0000-000000000000";
export const GC_MGR_ID       = "cc000003-0000-0000-0000-000000000000";
export const GC_REC_A_ID     = "cc000004-0000-0000-0000-000000000000"; // PIP
export const GC_REC_B_ID     = "cc000005-0000-0000-0000-000000000000"; // probation
export const GC_HR_ID        = "cc000006-0000-0000-0000-000000000000";

export const GC_PIP_PLAN_ID  = "cc000011-0000-0000-0000-000000000000";
export const GC_PROB_PLAN_ID = "cc000012-0000-0000-0000-000000000000";
export const GC_GOAL_A_ID    = "cc000021-0000-0000-0000-000000000000"; // 4 days overdue
export const GC_GOAL_B_ID    = "cc000022-0000-0000-0000-000000000000"; // 7 days overdue
export const GC_CHECKIN_ID   = "cc000031-0000-0000-0000-000000000000"; // Day-45 milestone

export const GC_TEST_USER_IDS = [GC_CEO_ID, GC_VP_ID, GC_MGR_ID, GC_REC_A_ID, GC_REC_B_ID, GC_HR_ID];

export interface GovernanceTestHierarchy {
  ceoId:          string;
  vpId:           string;
  managerId:      string;
  recruiterAId:   string;
  recruiterBId:   string;
  hrLeadId:       string;
  pipPlanId:      string;
  probationPlanId: string;
  goalAId:        string;
  goalBId:        string;
  checkInId:      string;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Create the full test hierarchy. Idempotent via ON CONFLICT.
 * Returns all IDs for use in assertions.
 */
export async function createGovernanceTestHierarchy(): Promise<GovernanceTestHierarchy> {
  // Wipe any stale data from interrupted previous runs before inserting fresh
  await teardownGovernanceTestHierarchy();

  const today  = new Date().toISOString().slice(0, 10);
  const d4ago  = daysAgo(4);
  const d7ago  = daysAgo(7);
  const d45ago = daysAgo(45);
  const d90ago = daysAgo(90);
  const d5ago  = daysAgo(5);

  // ── Admin users ───────────────────────────────────────────────────────────
  // CEO first (no manager_id FK required)
  await db.execute(sql`
    INSERT INTO admin_users
      (id, email, password, first_name, last_name, role, is_active, hierarchy_level, created_at)
    VALUES
      (${GC_CEO_ID}, 'test-ceo@governance.test', 'x', 'GovTest', 'CEO', 'super_admin', true, 'ceo',     NOW()),
      (${GC_HR_ID},  'test-hr@governance.test',  'x', 'GovTest', 'HR',  'hr',          true, 'manager', NOW())
    ON CONFLICT (id) DO UPDATE SET is_active = true, deleted_at = NULL
  `);

  await db.execute(sql`
    INSERT INTO admin_users
      (id, email, password, first_name, last_name, role, is_active, hierarchy_level, manager_id, created_at)
    VALUES
      (${GC_VP_ID}, 'test-vp@governance.test', 'x', 'GovTest', 'VP', 'admin', true, 'vp', ${GC_CEO_ID}, NOW())
    ON CONFLICT (id) DO UPDATE SET is_active = true, deleted_at = NULL, manager_id = ${GC_CEO_ID}
  `);

  await db.execute(sql`
    INSERT INTO admin_users
      (id, email, password, first_name, last_name, role, is_active, hierarchy_level, manager_id, created_at)
    VALUES
      (${GC_MGR_ID}, 'test-mgr@governance.test', 'x', 'GovTest', 'Manager', 'manager', true, 'manager', ${GC_VP_ID}, NOW())
    ON CONFLICT (id) DO UPDATE SET is_active = true, deleted_at = NULL, manager_id = ${GC_VP_ID}
  `);

  await db.execute(sql`
    INSERT INTO admin_users
      (id, email, password, first_name, last_name, role, is_active, hierarchy_level, manager_id, created_at)
    VALUES
      (${GC_REC_A_ID}, 'test-rec-a@governance.test', 'x', 'GovTest', 'RecruiterA', 'operations', true, 'team_member', ${GC_MGR_ID}, NOW()),
      (${GC_REC_B_ID}, 'test-rec-b@governance.test', 'x', 'GovTest', 'RecruiterB', 'operations', true, 'team_member', ${GC_MGR_ID}, NOW())
    ON CONFLICT (id) DO UPDATE SET is_active = true, deleted_at = NULL, manager_id = ${GC_MGR_ID}
  `);

  // ── Employee plans ────────────────────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO employee_plans
      (id, employee_id, manager_id, plan_type, department_scope, status, start_date, end_date, duration_days, created_by)
    VALUES
      (${GC_PIP_PLAN_ID},  ${GC_REC_A_ID}, ${GC_MGR_ID}, 'pip',       'healthcare', 'active', ${d5ago},  ${today}, 30, ${GC_MGR_ID}),
      (${GC_PROB_PLAN_ID}, ${GC_REC_B_ID}, ${GC_MGR_ID}, 'probation', 'healthcare', 'active', ${d90ago}, ${today}, 90, ${GC_MGR_ID})
    ON CONFLICT (id) DO NOTHING
  `);

  // ── Performance goals (overdue, progress=0) ───────────────────────────────
  await db.execute(sql`
    INSERT INTO performance_goals
      (id, employee_id, manager_id, title, category, status, progress, plan_id, target_date, created_at)
    VALUES
      (${GC_GOAL_A_ID}, ${GC_REC_A_ID}, ${GC_MGR_ID}, '[GovTest] Goal A — 4 days overdue', 'individual', 'in_progress', 0, ${GC_PIP_PLAN_ID},  ${d4ago}, NOW()),
      (${GC_GOAL_B_ID}, ${GC_REC_A_ID}, ${GC_MGR_ID}, '[GovTest] Goal B — 7 days overdue', 'individual', 'in_progress', 0, ${GC_PIP_PLAN_ID},  ${d7ago}, NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  // ── Day-45 milestone check-in for probation ───────────────────────────────
  await db.execute(sql`
    INSERT INTO check_ins
      (id, employee_id, manager_id, plan_id, check_in_type, scheduled_date, status, created_at)
    VALUES
      (${GC_CHECKIN_ID}, ${GC_REC_B_ID}, ${GC_MGR_ID}, ${GC_PROB_PLAN_ID}, 'milestone', ${d45ago}, 'scheduled', NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  return {
    ceoId:           GC_CEO_ID,
    vpId:            GC_VP_ID,
    managerId:       GC_MGR_ID,
    recruiterAId:    GC_REC_A_ID,
    recruiterBId:    GC_REC_B_ID,
    hrLeadId:        GC_HR_ID,
    pipPlanId:       GC_PIP_PLAN_ID,
    probationPlanId: GC_PROB_PLAN_ID,
    goalAId:         GC_GOAL_A_ID,
    goalBId:         GC_GOAL_B_ID,
    checkInId:       GC_CHECKIN_ID,
  };
}

/**
 * Remove all test data created by createGovernanceTestHierarchy.
 * Safe to call even if create failed partway through.
 */
export async function teardownGovernanceTestHierarchy(): Promise<void> {
  // Delete governance events first (FK → governance_controls)
  await db.execute(sql`
    DELETE FROM governance_events
    WHERE control_id IN (
      SELECT id FROM governance_controls
      WHERE owner_id IN (
        ${GC_CEO_ID}, ${GC_VP_ID}, ${GC_MGR_ID},
        ${GC_REC_A_ID}, ${GC_REC_B_ID}, ${GC_HR_ID}
      )
    )
  `);
  await db.execute(sql`
    DELETE FROM governance_controls
    WHERE owner_id IN (
      ${GC_CEO_ID}, ${GC_VP_ID}, ${GC_MGR_ID},
      ${GC_REC_A_ID}, ${GC_REC_B_ID}, ${GC_HR_ID}
    )
  `);
  await db.execute(sql`
    DELETE FROM notifications
    WHERE user_id IN (
      ${GC_CEO_ID}, ${GC_VP_ID}, ${GC_MGR_ID},
      ${GC_REC_A_ID}, ${GC_REC_B_ID}, ${GC_HR_ID}
    )
  `);
  // Delete ALL check-ins for test users — cadence backfill may have created extras
  await db.execute(sql`
    DELETE FROM check_ins
    WHERE employee_id IN (
        ${GC_CEO_ID}, ${GC_VP_ID}, ${GC_MGR_ID},
        ${GC_REC_A_ID}, ${GC_REC_B_ID}, ${GC_HR_ID}
      )
       OR manager_id IN (
        ${GC_CEO_ID}, ${GC_VP_ID}, ${GC_MGR_ID},
        ${GC_REC_A_ID}, ${GC_REC_B_ID}, ${GC_HR_ID}
      )
  `);
  await db.execute(sql`
    DELETE FROM performance_goals
    WHERE employee_id IN (
      ${GC_CEO_ID}, ${GC_VP_ID}, ${GC_MGR_ID},
      ${GC_REC_A_ID}, ${GC_REC_B_ID}, ${GC_HR_ID}
    )
  `);
  await db.execute(sql`
    DELETE FROM employee_plans
    WHERE employee_id IN (
      ${GC_CEO_ID}, ${GC_VP_ID}, ${GC_MGR_ID},
      ${GC_REC_A_ID}, ${GC_REC_B_ID}, ${GC_HR_ID}
    )
  `);
  await db.execute(sql`
    DELETE FROM admin_users
    WHERE id IN (
      ${GC_CEO_ID}, ${GC_VP_ID}, ${GC_MGR_ID},
      ${GC_REC_A_ID}, ${GC_REC_B_ID}, ${GC_HR_ID}
    )
  `);
}

/**
 * Insert a governance_control for a test entity.
 * Returns the control id.
 */
export async function insertTestControl(opts: {
  controlType: string;
  referenceId: string;
  ownerId: string;
  managerId?: string | null;
  dueDate: string;
  status?: string;
  escalationLevel?: number;
}): Promise<string> {
  const result = await db.execute(sql`
    INSERT INTO governance_controls
      (control_type, reference_id, owner_id, manager_id, due_date, required_action,
       evidence_required, status, escalation_level)
    VALUES
      (${opts.controlType}::governance_control_type,
       ${opts.referenceId},
       ${opts.ownerId},
       ${opts.managerId ?? null},
       ${opts.dueDate}::date,
       '[GovTest] Test obligation',
       false,
       ${(opts.status ?? "pending")}::governance_control_status,
       ${opts.escalationLevel ?? 0})
    ON CONFLICT DO NOTHING
    RETURNING id
  `);
  if (result.rows.length > 0) {
    return (result.rows[0] as any).id as string;
  }
  // Already exists — fetch by reference_id
  const existing = await db.execute(sql`
    SELECT id FROM governance_controls WHERE reference_id = ${opts.referenceId} LIMIT 1
  `);
  return (existing.rows[0] as any).id as string;
}

/**
 * Stamp a fake 'notification_sent' governance_event on a control to simulate
 * the dedup guard having already fired for a given step.
 * Optionally back-date the created_at to simulate an older event.
 */
export async function stampNotificationSent(
  controlId: string,
  step: string,
  hoursAgo = 0
): Promise<void> {
  await db.execute(sql`
    INSERT INTO governance_events (control_id, event_type, source, metadata, created_at)
    VALUES (
      ${controlId},
      'notification_sent'::governance_event_type,
      'scheduler'::governance_event_source,
      ${JSON.stringify({ step })}::jsonb,
      NOW() - ${`${hoursAgo} hours`}::interval
    )
  `);
}

/**
 * Count governance_events of a given event_type for a control since a specific time.
 */
export async function countEvents(
  controlId: string,
  eventType: string,
  sinceMs: number
): Promise<number> {
  const since = new Date(sinceMs).toISOString();
  const r = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM governance_events
    WHERE control_id = ${controlId}
      AND event_type = ${eventType}::governance_event_type
      AND created_at >= ${since}::timestamptz
  `);
  return Number((r.rows[0] as any).cnt ?? 0);
}

/**
 * Count notifications created for a user since a specific time.
 */
export async function countNotifications(userId: string, sinceMs: number): Promise<number> {
  const since = new Date(sinceMs).toISOString();
  const r = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM notifications
    WHERE user_id = ${userId}
      AND created_at >= ${since}::timestamptz
  `);
  return Number((r.rows[0] as any).cnt ?? 0);
}

/**
 * Read the current state of a governance_control by id.
 */
export async function getControl(controlId: string): Promise<{
  status: string;
  escalationLevel: number;
} | null> {
  const r = await db.execute(sql`
    SELECT status, escalation_level FROM governance_controls WHERE id = ${controlId} LIMIT 1
  `);
  if (!r.rows.length) return null;
  const row = r.rows[0] as any;
  return { status: row.status, escalationLevel: Number(row.escalation_level) };
}

/**
 * Enable notifications_enabled feature flag and return the original value so
 * tests can restore it. If the flag is already enabled, returns true.
 */
export async function enableNotificationsFlag(): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT value FROM system_settings WHERE key = 'feature_flags' LIMIT 1
  `);
  const originalFlags = (r.rows[0] as any)?.value as Record<string, boolean> | undefined;
  const wasEnabled = originalFlags?.notifications_enabled === true;

  if (!wasEnabled) {
    const newFlags = { ...(originalFlags ?? {}), notifications_enabled: true };
    await db.execute(sql`
      UPDATE system_settings SET value = ${JSON.stringify(newFlags)}::jsonb
      WHERE key = 'feature_flags'
    `);
  }
  return wasEnabled;
}

/**
 * Restore the notifications_enabled flag to its original state.
 */
export async function restoreNotificationsFlag(wasEnabled: boolean): Promise<void> {
  if (!wasEnabled) {
    const r = await db.execute(sql`
      SELECT value FROM system_settings WHERE key = 'feature_flags' LIMIT 1
    `);
    const flags = (r.rows[0] as any)?.value as Record<string, boolean> | undefined;
    if (flags) {
      const restored = { ...flags, notifications_enabled: false };
      await db.execute(sql`
        UPDATE system_settings SET value = ${JSON.stringify(restored)}::jsonb
        WHERE key = 'feature_flags'
      `);
    }
  }
}
