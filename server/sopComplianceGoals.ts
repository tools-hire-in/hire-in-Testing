/**
 * SOP Wave Compliance Goal Engine
 *
 * When a SOP wave assigns training to an employee, this module:
 *  1. Creates an individual performance goal (category: compliance) linked to the SOP.
 *  2. Upserts/increments a manager roll-up goal (category: operational).
 *  3. Schedules three check-in prompts: Day 7, Day 15, Day 30.
 *  4. Sends in-app notifications for the scheduled check-ins.
 *
 * All operations are idempotent — re-running skips existing goals/check-ins.
 */

import { db } from "./db";
import { storage } from "./storage";
import { performanceGoals, checkIns, adminUsers, rolloutWaves, sopEmployeeProgress, waveSops } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { SopDocument } from "@shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): string {
  const d = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual employee compliance goal
// ─────────────────────────────────────────────────────────────────────────────

export async function createSopComplianceGoal(
  userId: string,
  sopDoc: SopDocument,
  dueDate: Date,
  parentGoalId: string | null = null,
): Promise<string | null> {
  // Idempotency check: skip if a sop_compliance goal already exists for this (userId, sopDoc)
  const existing = await db
    .select({ id: performanceGoals.id, startDate: performanceGoals.startDate })
    .from(performanceGoals)
    .where(
      and(
        eq(performanceGoals.employeeId, userId),
        eq(performanceGoals.linkedSopId, sopDoc.id),
        sql`${performanceGoals.source} = 'sop_compliance'`,
      ),
    )
    .limit(1);

  // Resolve the employee's manager
  const [emp] = await db
    .select({ managerId: adminUsers.managerId })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId))
    .limit(1);

  const managerId = emp?.managerId ?? null;

  if (existing.length > 0) {
    // Goal already exists — backfill any missing check-ins anchored to the
    // goal's original startDate so day offsets don't shift on re-assignment.
    const anchorDate = existing[0].startDate
      ? new Date(existing[0].startDate)
      : new Date();
    await scheduleComplianceCheckIns(userId, managerId, existing[0].id, sopDoc, anchorDate);
    return existing[0].id;
  }

  const dueDateStr = dueDate.toISOString().split("T")[0];
  const startDateStr = todayStr();

  const [goal] = await db
    .insert(performanceGoals)
    .values({
      employeeId: userId,
      managerId,
      title: `Complete SOP: ${sopDoc.code} — ${sopDoc.title ?? "SOP Training"}`,
      description: `Assigned as part of SOP wave training. Complete acknowledgement by ${dueDateStr}.`,
      category: "compliance",
      startDate: startDateStr,
      targetDate: dueDateStr,
      status: "not_started",
      progress: 0,
      source: "sop_compliance",
      linkedSopId: sopDoc.id,
      parentGoalId,
      sortOrder: 0,
    } as any)
    .returning({ id: performanceGoals.id });

  const goalId = goal?.id ?? null;
  if (!goalId) return null;

  // Schedule check-ins anchored to today (Day 7/15/30 from assignment, NOT from due date)
  await scheduleComplianceCheckIns(userId, managerId, goalId, sopDoc, new Date());

  return goalId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manager roll-up goal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert a wave-level manager roll-up goal (one per manager per wave).
 *
 * Source is always `sop_compliance_manager` for consistent filtering in the
 * goals UI. Wave-specific identity is stored in `sourceRef` (e.g. "wave_1")
 * so it can be keyed uniquely without polluting the filterable source key.
 *
 * After creating/finding the goal, syncs progress = % of direct reports
 * who have acknowledged all operational SOPs in the wave.
 */
export async function upsertManagerRollupGoal(
  managerId: string,
  sopDoc: SopDocument,
  waveNumber: number | null,
): Promise<string | null> {
  const waveLabel = waveNumber != null ? `Wave ${waveNumber}` : "SOP Wave";
  const waveRef = waveNumber != null ? `wave_${waveNumber}` : "wave_unknown";

  // Find existing wave-level roll-up goal for this manager.
  // source='sop_compliance' for consistent filtering; sourceRef='wave_N_mgr' for uniqueness.
  const waveRefMgr = `${waveRef}_mgr`;
  const existing = await db
    .select({ id: performanceGoals.id })
    .from(performanceGoals)
    .where(
      and(
        eq(performanceGoals.employeeId, managerId),
        sql`${performanceGoals.source} = 'sop_compliance'`,
        sql`${performanceGoals.sourceRef} = ${waveRefMgr}`,
      ),
    )
    .limit(1);

  let goalId: string | null = null;

  if (existing.length > 0) {
    goalId = existing[0].id;
  } else {
    const dueDateStr = addDays(new Date(), 15);
    const [goal] = await db
      .insert(performanceGoals)
      .values({
        employeeId: managerId,
        managerId: null,
        title: `Ensure team completes ${waveLabel} SOPs`,
        description: `Wave-level compliance roll-up. Track direct reports completing all ${waveLabel} SOPs. Progress (%) is updated automatically as your team acknowledges SOP requirements.`,
        category: "operational",
        startDate: todayStr(),
        targetDate: dueDateStr,
        status: "in_progress",
        progress: 0,
        source: "sop_compliance",
        sourceRef: waveRefMgr,
        linkedSopId: null,
        sortOrder: 0,
      } as any)
      .returning({ id: performanceGoals.id });
    goalId = goal?.id ?? null;
  }

  // Sync KPI progress: % of direct reports who have acknowledged all wave SOPs
  if (goalId && waveNumber != null) {
    await syncManagerRollupProgress(managerId, goalId, waveNumber).catch((e) =>
      console.error("[sopComplianceGoals] progress sync error:", e));
  }

  return goalId;
}

/**
 * Refresh the manager roll-up goal's progress = % of direct reports who have
 * acknowledged every operational SOP in the wave. Called whenever a new
 * employee is assigned (idempotent — safe to call multiple times).
 */
export async function syncManagerRollupProgress(
  managerId: string,
  rollupGoalId: string,
  waveNumber: number,
): Promise<void> {
  // Collect direct reports of this manager
  const directReports = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(
      and(
        eq(adminUsers.managerId, managerId),
        sql`${adminUsers.deletedAt} IS NULL`,
        sql`${adminUsers.isActive} = true`,
      ),
    );

  if (directReports.length === 0) return;

  // Get all operational SOPs in this wave
  const waveSopRows = await db
    .select({ sopMasterId: waveSops.sopMasterId, operationalAt: waveSops.operationalAt })
    .from(waveSops)
    .where(
      and(
        eq(waveSops.waveNumber, waveNumber),
        sql`${waveSops.operationalAt} IS NOT NULL`,
      ),
    );

  if (waveSopRows.length === 0) return;
  const sopMasterIds = waveSopRows.map((r) => r.sopMasterId);

  // Scope denominator: only DRs who are actually assigned to at least one SOP in this wave
  // (have a sop_employee_progress row). Non-impacted reports must not count against the manager.
  const allDRProgress = await db
    .select({ userId: sopEmployeeProgress.userId, sopMasterId: sopEmployeeProgress.sopMasterId, acknowledgedAt: sopEmployeeProgress.acknowledgedAt })
    .from(sopEmployeeProgress)
    .where(
      and(
        sql`${sopEmployeeProgress.userId} = ANY(ARRAY[${sql.join(directReports.map((r) => sql`${r.id}`), sql`, `)}]::text[])`,
        sql`${sopEmployeeProgress.sopMasterId} = ANY(ARRAY[${sql.join(sopMasterIds.map((id) => sql`${id}`), sql`, `)}]::text[])`,
      ),
    );

  // Build a map of userId → Set<sopMasterId> of acknowledged SOPs
  const progByUser = new Map<string, Map<string, boolean>>();
  for (const p of allDRProgress) {
    if (!progByUser.has(p.userId)) progByUser.set(p.userId, new Map());
    progByUser.get(p.userId)!.set(p.sopMasterId, p.acknowledgedAt != null);
  }

  // Filter to only DRs who have at least one progress row for this wave
  const assignedDRs = directReports.filter((r) => progByUser.has(r.id));
  if (assignedDRs.length === 0) return; // no assigned DRs yet — nothing to sync

  // Count assigned DRs who have acknowledged ALL wave SOPs
  let onTrackCount = 0;
  for (const report of assignedDRs) {
    const progMap = progByUser.get(report.id)!;
    const allAcknowledged = sopMasterIds.every((id) => progMap.get(id) === true);
    if (allAcknowledged) onTrackCount++;
  }

  const progressPct = Math.round((onTrackCount / assignedDRs.length) * 100);
  const newStatus = progressPct >= 100 ? "completed" : "in_progress";

  await db
    .update(performanceGoals)
    .set({
      progress: progressPct,
      status: newStatus,
      description: `Wave ${waveNumber} compliance roll-up: ${onTrackCount}/${assignedDRs.length} assigned direct reports have acknowledged all wave SOPs (${progressPct}% complete).`,
    } as any)
    .where(eq(performanceGoals.id, rollupGoalId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Check-in scheduling
// ─────────────────────────────────────────────────────────────────────────────

interface CheckInDef {
  day: number;
  prompt: string;
  notifyManager: boolean;
}

const CHECKIN_DEFS: CheckInDef[] = [
  { day: 7,  prompt: "sop_early_nudge",       notifyManager: false },
  { day: 15, prompt: "sop_deadline_reminder",  notifyManager: true  },
  { day: 30, prompt: "sop_reinforcement",      notifyManager: true  },
];

async function scheduleComplianceCheckIns(
  employeeId: string,
  managerId: string | null,
  goalId: string,
  sopDoc: SopDocument,
  startDate: Date,
): Promise<void> {
  // Insert future-dated check-in rows (Day 7, 15, 30 from assignment date).
  // Notifications for these check-ins are intentionally NOT sent here — they
  // are triggered by the existing unified governance cron (07:00 IST) when
  // the scheduledDate arrives. Sending them immediately would spam users on
  // assignment day with Day-30 reminders they haven't earned yet.
  for (const def of CHECKIN_DEFS) {
    const scheduledDate = addDays(startDate, def.day);

    // Idempotency: skip if a check-in for this goal already exists on that date
    const existing = await db
      .select({ id: checkIns.id })
      .from(checkIns)
      .where(
        and(
          eq(checkIns.goalId, goalId),
          eq(checkIns.scheduledDate, scheduledDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    // For manager-notifying check-ins (Day 15 & 30), persist a manager-context
    // note in managerNotes so the cron can render the team compliance summary
    // inline with the alert ("X of Y direct reports have acknowledged …").
    // The cron reads sopDoc.code + managerId to query live compliance at fire time.
    const managerContextNote = def.notifyManager && managerId
      ? JSON.stringify({ type: `${def.prompt}_manager`, sopCode: sopDoc.code, managerId, sopName: sopDoc.title ?? sopDoc.code })
      : undefined;

    await db.insert(checkIns).values({
      employeeId,
      managerId,
      goalId,
      checkInType: "milestone",
      scheduledDate,
      status: "scheduled",
      // Store the prompt key in employeeNotes so the cron can resolve the
      // right employee notification when the scheduled date arrives.
      employeeNotes: def.prompt,
      // Store manager-context JSON so the cron knows to send a manager alert
      // with inline team compliance summary for Day-15/30 check-ins.
      ...(managerContextNote ? { managerNotes: managerContextNote } : {}),
    } as any);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry: called from assignSopTraining after training assignment
// ─────────────────────────────────────────────────────────────────────────────

export async function ensureSopComplianceGoal(
  userId: string,
  sopDoc: SopDocument,
  dueDate: Date,
  waveNumber: number | null,
): Promise<void> {
  try {
    // Resolve manager first so we can create the manager roll-up (parent) goal
    // before the employee's goal, allowing parent_goal_id to be set on the child.
    const [emp] = await db
      .select({ managerId: adminUsers.managerId })
      .from(adminUsers)
      .where(eq(adminUsers.id, userId))
      .limit(1);

    const managerId = emp?.managerId ?? null;

    // Create manager roll-up first (idempotent) — this is the "parent"
    let parentGoalId: string | null = null;
    if (managerId) {
      parentGoalId = await upsertManagerRollupGoal(managerId, sopDoc, waveNumber);
    }

    // Create employee compliance goal (child), linked to parent via parentGoalId
    await createSopComplianceGoal(userId, sopDoc, dueDate, parentGoalId);
  } catch (err) {
    console.error(`[sopComplianceGoals] Failed to create compliance goal for user ${userId}:`, err);
  }
}
