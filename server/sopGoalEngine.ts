// ─────────────────────────────────────────────────────────────────────────────
// SOP Compliance Goal Engine (Task #1568)
//
// When a SOP wave activates and training is assigned, this engine:
//   1. Creates an individual compliance goal for each assigned employee.
//   2. Upserts a team roll-up goal for the employee's direct manager.
//   3. Schedules three lightweight check-in prompts (Day 7 / 15 / 30).
//
// Idempotency guarantees:
//   - Employee goal: protected by a partial unique index
//     (employee_id, linked_sop_id) WHERE source='sop_compliance' AND category='individual'
//     → INSERT ON CONFLICT DO NOTHING; returns created=false on collision.
//   - Manager KPI increment: only executed AFTER employee goal is confirmed inserted
//     so retries after employee-goal failure cannot double-increment the target.
//   - Check-ins: existence check per (goal_id, prompt_key) before inserting.
//
// Category values (performance_goal_category enum):
//   'individual' for employee goals, 'team' for manager roll-up goals.
//
// Day-15 canonical key: 'sop_deadline_reminder' (matches notification type contract).
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./db";
import { sql as rawSql } from "drizzle-orm";
import type { SopDocument } from "@shared/schema";

export interface SopComplianceGoalResult {
  created: boolean;
  goalId: string | null;
}

/**
 * Creates (or detects an existing) SOP compliance goal for a single employee,
 * then upserts the manager's roll-up team goal only if the employee goal was
 * actually inserted (prevents manager KPI double-increment on retries).
 *
 * Returns { created, goalId }; created=false means the goal already existed.
 */
export async function createSopComplianceGoal(
  userId: string,
  sopDoc: SopDocument,
  actorUserId: string,
): Promise<SopComplianceGoalResult> {
  // ── 1. Compute dates ───────────────────────────────────────────────────────
  const today = new Date();
  const startDateStr = today.toISOString().split("T")[0];
  const dueDate = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  // ── 2. Resolve manager ────────────────────────────────────────────────────
  const userRow = await db.execute(rawSql`
    SELECT manager_id FROM admin_users WHERE id = ${userId} LIMIT 1
  `);
  const managerId = ((userRow.rows[0] as any) ?? {})?.manager_id as string | null ?? null;

  // ── 3. Insert employee goal — idempotent via ON CONFLICT DO NOTHING ────────
  //      The partial unique index (employee_id, linked_sop_id) WHERE source='sop_compliance'
  //      AND category='individual' guarantees no duplicate for same employee + SOP.
  const empTitle = `Complete SOP training: ${sopDoc.title}`;
  const empDesc = `Mandatory SOP compliance training for ${sopDoc.code}. Complete within 15 days of assignment.`;

  const insertResult = await db.execute(rawSql`
    INSERT INTO performance_goals
      (employee_id, manager_id, title, description, category, source,
       linked_sop_id, start_date, target_date, status, progress)
    VALUES
      (${userId}, ${managerId}, ${empTitle}, ${empDesc},
       'individual', 'sop_compliance', ${sopDoc.id},
       ${startDateStr}, ${dueDateStr}, 'in_progress', 0)
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  // Goal already existed — skip all side effects
  if ((insertResult.rows as any[]).length === 0) {
    const existing = await db.execute(rawSql`
      SELECT id FROM performance_goals
      WHERE employee_id = ${userId}
        AND source = 'sop_compliance'
        AND linked_sop_id = ${sopDoc.id}
        AND category = 'individual'
      LIMIT 1
    `);
    const existingId = ((existing.rows[0] as any)?.id as string) ?? null;
    return { created: false, goalId: existingId };
  }

  const goalId = ((insertResult.rows[0] as any)?.id as string) ?? null;
  if (!goalId) return { created: false, goalId: null };

  // ── 4. Upsert manager roll-up goal — only after employee goal is confirmed ─
  let managerGoalId: string | null = null;
  if (managerId) {
    const existingManagerGoal = await db.execute(rawSql`
      SELECT id, kpi_target FROM performance_goals
      WHERE employee_id = ${managerId}
        AND source = 'sop_compliance'
        AND linked_sop_id = ${sopDoc.id}
        AND category = 'team'
      LIMIT 1
    `);
    if ((existingManagerGoal.rows as any[]).length > 0) {
      const mgRow = existingManagerGoal.rows[0] as any;
      managerGoalId = mgRow.id as string;
      const newTarget = ((mgRow.kpi_target as number) ?? 0) + 1;
      await db.execute(rawSql`
        UPDATE performance_goals
        SET kpi_target = ${newTarget}, updated_at = NOW()
        WHERE id = ${managerGoalId}
      `);
    } else {
      const mgTitle = `Ensure team completes SOP: ${sopDoc.title}`;
      const mgDesc = `Team roll-up compliance goal for SOP ${sopDoc.code}. KPI target = direct reports assigned to this wave.`;
      const mgResult = await db.execute(rawSql`
        INSERT INTO performance_goals
          (employee_id, manager_id, title, description, category, source,
           linked_sop_id, start_date, target_date, status, progress, kpi_target)
        VALUES
          (${managerId}, ${actorUserId}, ${mgTitle}, ${mgDesc},
           'team', 'sop_compliance', ${sopDoc.id},
           ${startDateStr}, ${dueDateStr}, 'in_progress', 0, 1)
        RETURNING id
      `);
      managerGoalId = ((mgResult.rows[0] as any)?.id as string) ?? null;
    }

    // Back-fill parent_goal_id on the employee goal now that manager goal is known
    if (managerGoalId) {
      await db.execute(rawSql`
        UPDATE performance_goals SET parent_goal_id = ${managerGoalId}
        WHERE id = ${goalId}
      `);
    }
  }

  // ── 5. Schedule three check-in prompts (idempotent per prompt_key) ─────────
  //      Canonical keys match the notification type contract end-to-end:
  //        Day  7 → sop_early_nudge       (employee only)
  //        Day 15 → sop_deadline_reminder  (employee + manager)
  //        Day 30 → sop_reinforcement      (employee + manager)
  const CHECK_IN_SCHEDULE: Array<{ offsetDays: number; promptKey: string }> = [
    { offsetDays: 7,  promptKey: "sop_early_nudge" },
    { offsetDays: 15, promptKey: "sop_deadline_reminder" },
    { offsetDays: 30, promptKey: "sop_reinforcement" },
  ];

  for (const { offsetDays, promptKey } of CHECK_IN_SCHEDULE) {
    const scheduledDate = new Date(today.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    const scheduledDateStr = scheduledDate.toISOString().split("T")[0];

    const existingCheckIn = await db.execute(rawSql`
      SELECT id FROM check_ins
      WHERE goal_id = ${goalId} AND prompt_key = ${promptKey}
      LIMIT 1
    `);
    if ((existingCheckIn.rows as any[]).length > 0) continue;

    await db.execute(rawSql`
      INSERT INTO check_ins
        (employee_id, manager_id, goal_id, prompt_key, scheduled_date, status, check_in_type)
      VALUES
        (${userId}, ${managerId}, ${goalId}, ${promptKey}, ${scheduledDateStr}, 'scheduled', 'milestone')
    `);
  }

  return { created: true, goalId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Compliance Health Cache (5-minute in-memory, separate from governance_pulse)
// ─────────────────────────────────────────────────────────────────────────────

interface ComplianceHealthCache {
  [scopeKey: string]: {
    data: ComplianceHealthResponse;
    expiresAt: number;
  };
}

const complianceHealthCache: ComplianceHealthCache = {};
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface WaveComplianceCounts {
  onTrack: number;
  lagging: number;
  overdue: number;
  notStarted: number;
}

export interface WaveComplianceRow {
  waveNumber: number;
  waveName: string;
  counts: WaveComplianceCounts;
  directReportBreakdown?: Array<{
    userId: string;
    name: string;
    status: keyof WaveComplianceCounts;
  }>;
  deptRollup?: Array<{
    department: string;
    counts: WaveComplianceCounts;
  }>;
}

export interface ComplianceHealthResponse {
  waves: WaveComplianceRow[];
  computedAt: string;
}

/**
 * Returns SOP compliance health data for the requesting user's scope.
 * - employee   → personal goals only (their own SOPs)
 * - manager    → personal + directReportBreakdown
 * - hr/admin   → org-wide with deptRollup
 *
 * Cached per (userId, role) for 5 minutes in a dedicated cache object.
 * Must NOT share cache with governance_pulse (prevents poisoning of live counts).
 */
export async function getComplianceHealth(
  userId: string,
  role: string,
): Promise<ComplianceHealthResponse> {
  const cacheKey = `${userId}:${role}`;
  const cached = complianceHealthCache[cacheKey];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const now = new Date();

  // Load all active waves
  const wavesResult = await db.execute(rawSql`
    SELECT wave_number, name FROM rollout_waves
    WHERE status = 'active'
    ORDER BY wave_number
  `);
  const waves = wavesResult.rows as Array<{ wave_number: number; name: string }>;

  if (waves.length === 0) {
    const empty: ComplianceHealthResponse = { waves: [], computedAt: now.toISOString() };
    complianceHealthCache[cacheKey] = { data: empty, expiresAt: Date.now() + CACHE_TTL_MS };
    return empty;
  }

  // Load wave → sop_master_id mapping for active waves
  const waveNumbers = waves.map((w) => w.wave_number);
  const waveSopsResult = await db.execute(rawSql`
    SELECT wave_number, sop_master_id FROM wave_sops
    WHERE wave_number = ANY(${waveNumbers}::int[])
  `);
  const waveSopRows = waveSopsResult.rows as Array<{ wave_number: number; sop_master_id: string }>;

  // Build scoped user set
  let scopedUserIds: string[];
  if (role === "employee") {
    scopedUserIds = [userId];
  } else if (role === "manager") {
    const reportees = await db.execute(rawSql`
      SELECT id FROM admin_users WHERE manager_id = ${userId} AND deleted_at IS NULL
    `);
    scopedUserIds = [userId, ...(reportees.rows as any[]).map((r: any) => r.id as string)];
  } else {
    // hr, admin, super_admin — org-wide
    const allUsers = await db.execute(rawSql`
      SELECT id FROM admin_users WHERE is_active = true AND deleted_at IS NULL
    `);
    scopedUserIds = (allUsers.rows as any[]).map((r: any) => r.id as string);
  }

  if (scopedUserIds.length === 0) {
    const empty: ComplianceHealthResponse = { waves: [], computedAt: now.toISOString() };
    complianceHealthCache[cacheKey] = { data: empty, expiresAt: Date.now() + CACHE_TTL_MS };
    return empty;
  }

  // Load sop_employee_progress for scoped users
  const progressResult = await db.execute(rawSql`
    SELECT
      sep.sop_master_id,
      sep.user_id,
      sep.acknowledged_at,
      sep.training_completed_at,
      sep.deadline_at,
      ta.due_date AS ta_due_date
    FROM sop_employee_progress sep
    LEFT JOIN track_assignments ta
      ON ta.user_id = sep.user_id
      AND ta.sop_code = sep.sop_master_id
    WHERE sep.user_id = ANY(${scopedUserIds}::text[])
  `);
  const progressRows = progressResult.rows as Array<{
    sop_master_id: string;
    user_id: string;
    acknowledged_at: string | null;
    training_completed_at: string | null;
    deadline_at: string | null;
    ta_due_date: string | null;
  }>;

  // Index progress by (sopMasterId, userId)
  const progressIndex = new Map<string, typeof progressRows[0]>();
  for (const row of progressRows) {
    progressIndex.set(`${row.sop_master_id}:${row.user_id}`, row);
  }

  function classifyStatus(
    sopMasterId: string,
    uid: string,
  ): keyof WaveComplianceCounts {
    const key = `${sopMasterId}:${uid}`;
    const prog = progressIndex.get(key);
    if (!prog) return "notStarted";
    if (prog.acknowledged_at) return "onTrack";
    const deadline = prog.deadline_at ?? prog.ta_due_date;
    const isOverdue = deadline ? new Date(deadline) < now : false;
    if (isOverdue) return "overdue";
    if (prog.training_completed_at) return "onTrack";
    return "lagging";
  }

  // Load user details for direct-report and dept breakdown
  let userDetails: Array<{ id: string; first_name: string; last_name: string; department: string | null; manager_id: string | null }> = [];
  if (role === "manager" || role === "hr" || role === "admin" || role === "super_admin") {
    const detailsResult = await db.execute(rawSql`
      SELECT au.id, au.first_name, au.last_name, d.name AS department, au.manager_id
      FROM admin_users au
      LEFT JOIN departments d ON d.id = au.department_id
      WHERE au.id = ANY(${scopedUserIds}::text[]) AND au.deleted_at IS NULL
    `);
    userDetails = detailsResult.rows as any[];
  }

  const waveRows: WaveComplianceRow[] = [];

  for (const wave of waves) {
    const waveNumber = wave.wave_number;
    const sopMasterIds = waveSopRows
      .filter((ws) => ws.wave_number === waveNumber)
      .map((ws) => ws.sop_master_id);

    if (sopMasterIds.length === 0) continue;

    const counts: WaveComplianceCounts = { onTrack: 0, lagging: 0, overdue: 0, notStarted: 0 };
    const directReportMap = new Map<string, { userId: string; name: string; status: keyof WaveComplianceCounts }>();
    const deptMap = new Map<string, WaveComplianceCounts>();

    for (const uid of scopedUserIds) {
      for (const sopMasterId of sopMasterIds) {
        const status = classifyStatus(sopMasterId, uid);
        counts[status] += 1;

        if (role === "manager" && uid !== userId) {
          const detail = userDetails.find((u) => u.id === uid);
          if (detail) {
            const existing = directReportMap.get(uid);
            const SEVERITY: Record<keyof WaveComplianceCounts, number> = { overdue: 3, lagging: 2, notStarted: 1, onTrack: 0 };
            if (!existing || SEVERITY[status] > SEVERITY[existing.status]) {
              directReportMap.set(uid, {
                userId: uid,
                name: `${detail.first_name} ${detail.last_name}`.trim(),
                status,
              });
            }
          }
        }

        if (role === "hr" || role === "admin" || role === "super_admin") {
          const detail = userDetails.find((u) => u.id === uid);
          const dept = detail?.department ?? "Unknown";
          if (!deptMap.has(dept)) {
            deptMap.set(dept, { onTrack: 0, lagging: 0, overdue: 0, notStarted: 0 });
          }
          deptMap.get(dept)![status] += 1;
        }
      }
    }

    const row: WaveComplianceRow = { waveNumber, waveName: wave.name, counts };

    if (role === "manager" && directReportMap.size > 0) {
      row.directReportBreakdown = Array.from(directReportMap.values());
    }
    if ((role === "hr" || role === "admin" || role === "super_admin") && deptMap.size > 0) {
      row.deptRollup = Array.from(deptMap.entries()).map(([department, c]) => ({ department, counts: c }));
    }

    waveRows.push(row);
  }

  const result: ComplianceHealthResponse = { waves: waveRows, computedAt: now.toISOString() };
  complianceHealthCache[cacheKey] = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}

/**
 * Sweep: fire SOP compliance check-in notifications for today's due check-ins.
 * Called by the daily cron at 08:30 IST. Reads check_ins where:
 *   - scheduled_date = todayStr
 *   - status = 'scheduled'
 *   - prompt_key is one of the three canonical SOP keys
 *
 * Notification routing (matches sop_compliance_nudge type in notificationTypes.ts):
 *   sop_early_nudge      → employee only
 *   sop_deadline_reminder → employee + manager
 *   sop_reinforcement    → employee + manager
 *
 * Each check-in is marked 'completed' after firing so it never re-fires.
 */
export async function fireSopCheckInNotifications(todayStr: string): Promise<{ fired: number; errors: number }> {
  let fired = 0;
  let errors = 0;

  const checkIns = await db.execute(rawSql`
    SELECT ci.id, ci.employee_id, ci.manager_id, ci.goal_id, ci.prompt_key,
           pg.title AS goal_title, pg.linked_sop_id,
           sd.title AS sop_title, sd.code AS sop_code,
           pg.target_date
    FROM check_ins ci
    JOIN performance_goals pg ON pg.id = ci.goal_id
    LEFT JOIN sop_documents sd ON sd.id = pg.linked_sop_id
    WHERE ci.scheduled_date = ${todayStr}
      AND ci.status = 'scheduled'
      AND ci.prompt_key IN ('sop_early_nudge', 'sop_deadline_reminder', 'sop_reinforcement')
  `);

  for (const row of checkIns.rows as any[]) {
    try {
      const promptKey = row.prompt_key as string;
      const sopTitle = (row.sop_title ?? row.goal_title ?? "SOP") as string;
      const sopCode = (row.sop_code ?? "") as string;
      const targetDate = row.target_date as string | null;
      const employeeId = row.employee_id as string;
      const managerId = row.manager_id as string | null;

      const daysRemaining = targetDate
        ? Math.max(0, Math.ceil((new Date(targetDate).getTime() - Date.now()) / (86400 * 1000)))
        : 0;

      let empTitle: string;
      let empMessage: string;
      let managerTitle: string | null = null;
      let managerMessage: string | null = null;
      let notifType: string;

      if (promptKey === "sop_early_nudge") {
        notifType = "sop_early_nudge";
        empTitle = `SOP training reminder: ${sopTitle}`;
        empMessage = `You have ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left to complete SOP training for ${sopCode || sopTitle}. Log in and complete it now.`;
      } else if (promptKey === "sop_deadline_reminder") {
        notifType = "sop_deadline_reminder";
        empTitle = `SOP training deadline approaching: ${sopTitle}`;
        empMessage = `Your SOP training deadline for ${sopCode || sopTitle} is in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}. Complete it to stay compliant.`;
        managerTitle = `Team SOP deadline: ${sopTitle}`;
        managerMessage = `An employee's SOP training deadline for ${sopCode || sopTitle} is approaching. Check team compliance in the SOP portal.`;
      } else {
        notifType = "sop_reinforcement";
        empTitle = `SOP compliance reinforcement: ${sopTitle}`;
        empMessage = daysRemaining > 0
          ? `SOP compliance check for ${sopCode || sopTitle}: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining. Stay on track.`
          : `SOP compliance check for ${sopCode || sopTitle}: training window has ended. Please ensure you are fully acknowledged.`;
        managerTitle = `SOP compliance reinforcement for team: ${sopTitle}`;
        managerMessage = `30-day SOP compliance reinforcement for ${sopCode || sopTitle}. Review team acknowledgement status.`;
      }

      const { notifyUser } = await import("./notifications");

      // Notify employee
      await notifyUser({
        userId: employeeId,
        type: notifType,
        title: empTitle,
        message: empMessage,
        metadata: { goalId: row.goal_id, checkInId: row.id, sopCode, link: "/admin/my-training" },
      });

      // Notify manager (sop_deadline_reminder and sop_reinforcement only)
      if (managerId && managerTitle && managerMessage) {
        await notifyUser({
          userId: managerId,
          type: notifType,
          title: managerTitle,
          message: managerMessage,
          metadata: { goalId: row.goal_id, checkInId: row.id, sopCode, link: "/admin/hr/my-team" },
        });
      }

      // Mark completed so it never re-fires
      await db.execute(rawSql`
        UPDATE check_ins SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = ${row.id}
      `);

      fired += 1;
    } catch (err) {
      console.error(`[sopGoalEngine] fireSopCheckInNotifications: check-in ${(row as any).id} error:`, err);
      errors += 1;
    }
  }

  return { fired, errors };
}
