/**
 * Governance Pulse Aggregation Service
 *
 * Single-function read-only snapshot of org-wide governance health across:
 *   - SOP compliance (wave breakdown, ack %)
 *   - Training compliance (overdue, locked)
 *   - Employee plans (PIP / growth / probation, per-manager stall breakdown)
 *   - Probation milestones (due soon, missed recently)
 *   - Goals health (on-track / at-risk / overdue split + escalated drill-down)
 *   - Check-in compliance (org-wide + per-manager miss rate)
 *   - Action items (pre-ranked severity list)
 *
 * All queries are pure reads. No mutations.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { SOP_ACK_GRACE_DAYS } from "./sopRollout";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SopWaveSummary {
  waveNumber: number;
  name: string;
  activated: boolean;
  sopCount: number;
  ackPercent: number;
}

export interface SopSection {
  totalAssigned: number;
  acknowledged: number;
  overdue: number;
  waves: SopWaveSummary[];
}

export interface TrainingSection {
  totalActive: number;
  compliant: number;
  overdue: number;
  locked: number;
}

export interface PlanStages {
  acknowledged: number;
  checkInsInProgress: number;
  overdueCoaching: number;
  noCoachingInThreshold: number;
}

export interface ManagerPlanBreakdown {
  managerId: string;
  managerName: string;
  pipsActive: number;
  pipsStalled: number;
  growthPlansActive: number;
  probationActive: number;
  checkInsOverdue: number;
}

export interface PlansSection {
  pip: PlanStages & { active: number };
  growth: PlanStages & { active: number };
  probation: PlanStages & { active: number };
  perManager: ManagerPlanBreakdown[];
}

export interface ProbationMilestoneDue {
  employeeId: string;
  employeeName: string;
  milestoneDay: number;
  managerId: string | null;
  managerName: string | null;
  daysUntilDue: number;
}

export interface ProbationMilestoneMissed {
  employeeId: string;
  employeeName: string;
  milestoneDay: number;
  managerId: string | null;
  managerName: string | null;
  missedDaysAgo: number;
  strikeCount: number;
}

export interface ProbationSection {
  dueSoon: ProbationMilestoneDue[];
  missedRecently: ProbationMilestoneMissed[];
}

export interface GoalsHealthSplit {
  onTrack: number;
  atRisk: number;
  overdue: number;
  total: number;
}

export interface EscalatedGoalWithCoachingGap {
  goalId: string;
  goalTitle: string;
  employeeId: string;
  employeeName: string;
  managerId: string | null;
  managerName: string | null;
  daysSinceLastCoaching: number;
  daysOverdue: number;
}

export interface GoalsSection {
  healthSplit: GoalsHealthSplit;
  escalatedWithCoachingGap: EscalatedGoalWithCoachingGap[];
  overdueCount: number;
}

export interface OrgCheckinRate {
  scheduled: number;
  completed: number;
  missed: number;
  completionRate: number;
}

export interface ManagerCheckinCompliance {
  managerId: string;
  managerName: string;
  scheduled: number;
  completed: number;
  missed: number;
  missRate: number;
  consecutiveMisses: number;
}

export interface CheckinsSection {
  org: OrgCheckinRate;
  perManager: ManagerCheckinCompliance[];
  overdueCount: number;
}

export interface PipPulseSection {
  overdue: number;
  byManager: Array<{ managerId: string; count: number }>;
}

export type ActionItemCategory = "sop" | "pip" | "probation" | "goal" | "training" | "checkin";
export type ActionItemSeverity = "critical" | "warning" | "info";

export interface ActionItem {
  id: string;
  category: ActionItemCategory;
  severity: ActionItemSeverity;
  employeeName: string;
  employeeId: string;
  managerId: string | null;
  managerName: string | null;
  description: string;
  daysOverdue: number;
  deepLinkPath: string;
}

// Internal types for sharing data between sections and action item builder
interface SopActionRow {
  userId: string;
  employeeName: string;
  managerId: string | null;
  managerName: string | null;
  daysOverdue: number;
  daysUntilGrace: number | null;
  enforcement: string | null;
  sopMasterId: string;
}

interface TrainingActionRow {
  userId: string;
  employeeName: string;
  managerId: string | null;
  managerName: string | null;
  trackTitle: string;
  daysOverdue: number;
  role: string;
}

interface PipActionRow {
  planId: string;
  employeeId: string;
  employeeName: string;
  managerId: string | null;
  managerName: string | null;
  planAgeDays: number;
  coachingEntryCount: number;
  lastCoachingDate: string | null;
  daysCoachingGap: number;
}

export interface GovernancePulse {
  sop: SopSection;
  training: TrainingSection;
  plans: PlansSection;
  probation: ProbationSection;
  goals: GoalsSection;
  checkins: CheckinsSection;
  pip: PipPulseSection;
  action_items: ActionItem[];
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysDiff(from: Date, to: Date): number {
  return Math.floor((from.getTime() - to.getTime()) / 86400000);
}

async function getThreshold(key: string, fallback: number): Promise<number> {
  try {
    const rows = await db.execute(sql`
      SELECT value FROM system_settings WHERE key = ${key} LIMIT 1
    `);
    if (rows.rows.length > 0) {
      const v = (rows.rows[0] as any).value;
      const parsed = typeof v === "number" ? v : parseInt(String(v), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch { /* use fallback */ }
  return fallback;
}

// ── SOP section ───────────────────────────────────────────────────────────────

interface SopSectionResult {
  section: SopSection;
  actionRows: SopActionRow[];
}

async function buildSopSectionWithActions(): Promise<SopSectionResult> {
  const now = new Date();
  const graceMs = SOP_ACK_GRACE_DAYS * 86400000;

  const progressRows = (await db.execute(sql`
    SELECT
      sep.user_id,
      sep.sop_master_id,
      sep.acknowledged_at,
      ws.wave_number,
      ws.operational_at,
      rw.enforcement,
      au.first_name || ' ' || au.last_name AS employee_name,
      au.manager_id,
      m.first_name || ' ' || m.last_name AS manager_name,
      COALESCE(
        sep.deadline_at::date,
        (ws.operational_at::date + (${SOP_ACK_GRACE_DAYS} || ' days')::interval)::date
      ) AS effective_deadline
    FROM sop_employee_progress sep
    JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
    LEFT JOIN rollout_waves rw ON rw.wave_number = ws.wave_number
    JOIN admin_users au ON au.id = sep.user_id
    LEFT JOIN admin_users m ON m.id = au.manager_id
    WHERE au.is_active = true AND au.deleted_at IS NULL
  `)).rows as any[];

  const totalAssigned = progressRows.length;
  const acknowledged = progressRows.filter((r) => r.acknowledged_at).length;

  let overdueCount = 0;
  const actionRows: SopActionRow[] = [];

  for (const r of progressRows) {
    if (r.acknowledged_at) continue;
    if (!r.operational_at) continue;

    const deadline = r.effective_deadline
      ? new Date(r.effective_deadline)
      : new Date(new Date(r.operational_at).getTime() + graceMs);

    const nowEpoch = now.getTime();
    const deadlineEpoch = deadline.getTime();
    const operationalAt = new Date(r.operational_at);
    const graceEnd = new Date(operationalAt.getTime() + graceMs);

    if (deadlineEpoch < nowEpoch) {
      overdueCount++;
      const daysOverdue = daysDiff(now, deadline);
      actionRows.push({
        userId: r.user_id,
        employeeName: r.employee_name || "Unknown",
        managerId: r.manager_id || null,
        managerName: r.manager_name || null,
        daysOverdue,
        daysUntilGrace: null,
        enforcement: r.enforcement || null,
        sopMasterId: r.sop_master_id,
      });
    } else {
      // Approaching grace period (within 3 days)
      const daysUntilGrace = daysDiff(graceEnd, now);
      if (daysUntilGrace >= 0 && daysUntilGrace <= 3) {
        actionRows.push({
          userId: r.user_id,
          employeeName: r.employee_name || "Unknown",
          managerId: r.manager_id || null,
          managerName: r.manager_name || null,
          daysOverdue: 0,
          daysUntilGrace,
          enforcement: r.enforcement || null,
          sopMasterId: r.sop_master_id,
        });
      }
    }
  }

  const waveRows = (await db.execute(sql`
    SELECT rw.wave_number, rw.name, rw.activated_at,
           COUNT(ws.id) AS sop_count
    FROM rollout_waves rw
    LEFT JOIN wave_sops ws ON ws.wave_number = rw.wave_number
    GROUP BY rw.wave_number, rw.name, rw.activated_at
    ORDER BY rw.wave_number
  `)).rows as any[];

  const waves: SopWaveSummary[] = waveRows.map((w) => {
    const waveNum = Number(w.wave_number);
    const sopCount = Number(w.sop_count);
    const waveProgress = progressRows.filter((p) => Number(p.wave_number) === waveNum);
    const waveTotal = waveProgress.length;
    const waveAcked = waveProgress.filter((p) => p.acknowledged_at).length;
    const ackPercent = waveTotal > 0 ? Math.round((waveAcked / waveTotal) * 100) : 0;
    return {
      waveNumber: waveNum,
      name: String(w.name || `Wave ${waveNum}`),
      activated: !!w.activated_at,
      sopCount,
      ackPercent,
    };
  });

  return {
    section: { totalAssigned, acknowledged, overdue: overdueCount, waves },
    actionRows,
  };
}

// ── Training section ──────────────────────────────────────────────────────────

interface TrainingSectionResult {
  section: TrainingSection;
  actionRows: TrainingActionRow[];
}

async function buildTrainingSectionWithActions(): Promise<TrainingSectionResult> {
  const now = new Date();

  const activeEmployees = (await db.execute(sql`
    SELECT id, role, training_exempt,
           first_name || ' ' || last_name AS full_name,
           manager_id
    FROM admin_users
    WHERE is_active = true AND deleted_at IS NULL AND employment_status = 'active'
  `)).rows as any[];

  const totalActive = activeEmployees.length;
  if (totalActive === 0) {
    return { section: { totalActive: 0, compliant: 0, overdue: 0, locked: 0 }, actionRows: [] };
  }

  const userIds = activeEmployees.map((u) => u.id);
  const userMap = new Map(activeEmployees.map((u) => [u.id, u]));

  const assignments = (await db.execute(sql`
    SELECT ta.user_id, ta.id AS assignment_id, ta.status, ta.due_date, ta.track_id
    FROM track_assignments ta
    WHERE ta.user_id = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}])
      AND ta.status != 'completed'
      AND ta.due_date IS NOT NULL
  `)).rows as any[];

  const trackIds = [...new Set(assignments.map((a) => a.track_id))];
  const trackTitleMap = new Map<string, string>();
  if (trackIds.length > 0) {
    const tracks = (await db.execute(sql`
      SELECT id, title FROM learning_tracks
      WHERE id = ANY(ARRAY[${sql.join(trackIds.map(id => sql`${id}`), sql`, `)}])
    `)).rows as any[];
    for (const t of tracks) trackTitleMap.set(t.id, t.title || "Training");
  }

  const extensions = (await db.execute(sql`
    SELECT ter.user_id, ter.assignment_id, ter.new_due_date
    FROM training_extension_requests ter
    WHERE ter.status = 'approved'
      AND ter.user_id = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}])
  `)).rows as any[];

  const extMap = new Map<string, Date>();
  for (const e of extensions) {
    const key = `${e.user_id}::${e.assignment_id}`;
    const d = new Date(e.new_due_date);
    const existing = extMap.get(key);
    if (!existing || d > existing) extMap.set(key, d);
  }

  const overdueByUser = new Map<string, { trackTitle: string; daysOverdue: number }[]>();
  for (const a of assignments) {
    const extKey = `${a.user_id}::${a.assignment_id}`;
    const ext = extMap.get(extKey);
    const effectiveDue = ext ?? new Date(a.due_date);
    if (effectiveDue < now) {
      const daysOverdue = daysDiff(now, effectiveDue);
      const arr = overdueByUser.get(a.user_id) ?? [];
      arr.push({ trackTitle: trackTitleMap.get(a.track_id) ?? "Training", daysOverdue });
      overdueByUser.set(a.user_id, arr);
    }
  }

  const EXEMPT_ROLES = ["super_admin", "admin"];

  let compliant = 0;
  let overdueCount = 0;
  let locked = 0;
  const actionRows: TrainingActionRow[] = [];

  // Resolve manager names for action rows
  const managerIds = [...new Set(activeEmployees.map((u) => u.manager_id).filter(Boolean))];
  const managerNameMap = new Map<string, string>();
  if (managerIds.length > 0) {
    const mgrs = (await db.execute(sql`
      SELECT id, first_name || ' ' || last_name AS full_name FROM admin_users
      WHERE id = ANY(ARRAY[${sql.join(managerIds.map(id => sql`${id}`), sql`, `)}])
    `)).rows as any[];
    for (const m of mgrs) managerNameMap.set(m.id, m.full_name);
  }

  for (const u of activeEmployees) {
    if (u.training_exempt) { compliant++; continue; }
    const overdueItems = overdueByUser.get(u.id);
    if (!overdueItems || overdueItems.length === 0) {
      compliant++;
    } else {
      overdueCount++;
      if (!EXEMPT_ROLES.includes(u.role)) locked++;
      // Emit the worst (oldest) overdue track as action row
      const worst = overdueItems.reduce((a, b) => (b.daysOverdue > a.daysOverdue ? b : a));
      actionRows.push({
        userId: u.id,
        employeeName: u.full_name || "Unknown",
        managerId: u.manager_id || null,
        managerName: u.manager_id ? (managerNameMap.get(u.manager_id) ?? null) : null,
        trackTitle: worst.trackTitle,
        daysOverdue: worst.daysOverdue,
        role: u.role,
      });
    }
  }

  return { section: { totalActive, compliant, overdue: overdueCount, locked }, actionRows };
}

// ── Plans section ─────────────────────────────────────────────────────────────

interface PlansSectionResult {
  section: PlansSection;
  pipActionRows: PipActionRow[];
}

async function buildPlansSectionWithActions(pipCheckinDays: number): Promise<PlansSectionResult> {
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);
  const thresholdStr = new Date(now.getTime() - pipCheckinDays * 86400000).toISOString().slice(0, 10);

  const plans = (await db.execute(sql`
    SELECT
      ep.id, ep.employee_id, ep.manager_id, ep.plan_type, ep.status,
      ep.acknowledged_at, ep.start_date,
      au.first_name || ' ' || au.last_name AS employee_name,
      m.first_name || ' ' || m.last_name AS manager_name
    FROM employee_plans ep
    LEFT JOIN admin_users au ON au.id = ep.employee_id
    LEFT JOIN admin_users m ON m.id = ep.manager_id
    WHERE ep.status = 'active'
      AND ep.employee_id IS NOT NULL
  `)).rows as any[];

  const planIds = plans.map((p) => p.id);

  const coachingRows = planIds.length > 0 ? (await db.execute(sql`
    SELECT plan_id, MAX(entry_date) AS last_entry_date, COUNT(*) AS entry_count
    FROM coaching_log_entries
    WHERE plan_id = ANY(ARRAY[${sql.join(planIds.map(id => sql`${id}`), sql`, `)}])
    GROUP BY plan_id
  `)).rows as any[] : [];

  const coachingMap = new Map<string, { lastDate: string; count: number }>();
  for (const c of coachingRows) {
    coachingMap.set(c.plan_id, { lastDate: c.last_entry_date, count: Number(c.entry_count) });
  }

  const checkInsForPlans = planIds.length > 0 ? (await db.execute(sql`
    SELECT plan_id, status, scheduled_date
    FROM check_ins
    WHERE plan_id = ANY(ARRAY[${sql.join(planIds.map(id => sql`${id}`), sql`, `)}])
  `)).rows as any[] : [];

  const checkInsByPlan = new Map<string, any[]>();
  for (const ci of checkInsForPlans) {
    const arr = checkInsByPlan.get(ci.plan_id) ?? [];
    arr.push(ci);
    checkInsByPlan.set(ci.plan_id, arr);
  }

  function classifyPlan(plan: any): PlanStages {
    const coaching = coachingMap.get(plan.id);
    const cis = checkInsByPlan.get(plan.id) ?? [];
    const overdueCheckIns = cis.filter(
      (ci) => ci.status === "scheduled" && ci.scheduled_date < nowStr,
    ).length;
    const completedCheckIns = cis.filter((ci) => ci.status === "completed").length;
    const lastCoachingDate = coaching?.lastDate;
    const coachingInThreshold = lastCoachingDate && lastCoachingDate >= thresholdStr;
    return {
      acknowledged: plan.acknowledged_at ? 1 : 0,
      checkInsInProgress: completedCheckIns > 0 ? 1 : 0,
      overdueCoaching: overdueCheckIns > 0 ? 1 : 0,
      noCoachingInThreshold: !coachingInThreshold ? 1 : 0,
    };
  }

  const pipPlans = plans.filter((p) => p.plan_type === "pip");
  const growthPlans = plans.filter((p) => p.plan_type === "growth");
  const probationPlans = plans.filter((p) => p.plan_type === "probation");

  function sumStages(planList: any[]): PlanStages {
    const out: PlanStages = { acknowledged: 0, checkInsInProgress: 0, overdueCoaching: 0, noCoachingInThreshold: 0 };
    for (const p of planList) {
      const s = classifyPlan(p);
      out.acknowledged += s.acknowledged;
      out.checkInsInProgress += s.checkInsInProgress;
      out.overdueCoaching += s.overdueCoaching;
      out.noCoachingInThreshold += s.noCoachingInThreshold;
    }
    return out;
  }

  // Per-manager breakdown
  const managerMap = new Map<string, { name: string; pip: any[]; growth: any[]; probation: any[] }>();
  for (const p of plans) {
    if (!p.manager_id) continue;
    if (!managerMap.has(p.manager_id)) {
      managerMap.set(p.manager_id, { name: p.manager_name || "Unknown", pip: [], growth: [], probation: [] });
    }
    const m = managerMap.get(p.manager_id)!;
    if (p.plan_type === "pip") m.pip.push(p);
    else if (p.plan_type === "growth") m.growth.push(p);
    else if (p.plan_type === "probation") m.probation.push(p);
  }

  const perManager: ManagerPlanBreakdown[] = [];
  for (const [managerId, data] of managerMap) {
    const pipsActive = data.pip.length;
    const pipsStalled = data.pip.filter((p) => {
      const coaching = coachingMap.get(p.id);
      if (!coaching || coaching.count === 0) return true;
      return coaching.lastDate < thresholdStr;
    }).length;
    const overdueCheckInsCount = [...data.pip, ...data.probation, ...data.growth].reduce((acc, p) => {
      const cis = checkInsByPlan.get(p.id) ?? [];
      return acc + cis.filter((ci) => ci.status === "scheduled" && ci.scheduled_date < nowStr).length;
    }, 0);
    perManager.push({
      managerId,
      managerName: data.name,
      pipsActive,
      pipsStalled,
      growthPlansActive: data.growth.length,
      probationActive: data.probation.length,
      checkInsOverdue: overdueCheckInsCount,
    });
  }
  perManager.sort((a, b) => b.pipsStalled - a.pipsStalled || b.pipsActive - a.pipsActive);

  // PIP action rows for action item builder
  const pipActionRows: PipActionRow[] = pipPlans.map((p) => {
    const coaching = coachingMap.get(p.id);
    const planStartDate = p.start_date ? new Date(p.start_date) : now;
    const planAgeDays = daysDiff(now, planStartDate);
    const lastCoachingDate = coaching?.lastDate ?? null;
    const daysCoachingGap = lastCoachingDate
      ? daysDiff(now, new Date(lastCoachingDate))
      : planAgeDays;
    return {
      planId: p.id,
      employeeId: p.employee_id,
      employeeName: p.employee_name || "Unknown",
      managerId: p.manager_id || null,
      managerName: p.manager_name || null,
      planAgeDays,
      coachingEntryCount: coaching?.count ?? 0,
      lastCoachingDate,
      daysCoachingGap,
    };
  });

  return {
    section: {
      pip: { active: pipPlans.length, ...sumStages(pipPlans) },
      growth: { active: growthPlans.length, ...sumStages(growthPlans) },
      probation: { active: probationPlans.length, ...sumStages(probationPlans) },
      perManager,
    },
    pipActionRows,
  };
}

// ── Probation milestones section ──────────────────────────────────────────────

async function buildProbationSection(): Promise<ProbationSection> {
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);
  const in7Days = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const ago30Days = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const dueSoonRows = (await db.execute(sql`
    SELECT
      ci.employee_id, ci.manager_id, ci.scheduled_date,
      ep.start_date,
      au.first_name || ' ' || au.last_name AS employee_name,
      m.first_name || ' ' || m.last_name AS manager_name
    FROM check_ins ci
    JOIN employee_plans ep ON ci.plan_id = ep.id
    JOIN admin_users au ON ci.employee_id = au.id
    LEFT JOIN admin_users m ON ci.manager_id = m.id
    WHERE ep.plan_type = 'probation'
      AND ep.status = 'active'
      AND ci.status = 'scheduled'
      AND ci.scheduled_date >= ${nowStr}
      AND ci.scheduled_date <= ${in7Days}
      AND ci.check_in_type = 'milestone'
    ORDER BY ci.scheduled_date ASC
    LIMIT 50
  `)).rows as any[];

  const dueSoon: ProbationMilestoneDue[] = dueSoonRows.map((r) => {
    const scheduledDate = new Date(r.scheduled_date);
    const daysUntilDue = daysDiff(scheduledDate, now);
    const milestoneDay = r.start_date
      ? daysDiff(scheduledDate, new Date(r.start_date))
      : 0;
    return {
      employeeId: r.employee_id,
      employeeName: r.employee_name || "Unknown",
      milestoneDay,
      managerId: r.manager_id || null,
      managerName: r.manager_name || null,
      daysUntilDue,
    };
  });

  const missedRows = (await db.execute(sql`
    SELECT
      ci.employee_id, ci.manager_id, ci.scheduled_date,
      ep.start_date,
      au.first_name || ' ' || au.last_name AS employee_name,
      m.first_name || ' ' || m.last_name AS manager_name
    FROM check_ins ci
    JOIN employee_plans ep ON ci.plan_id = ep.id
    JOIN admin_users au ON ci.employee_id = au.id
    LEFT JOIN admin_users m ON ci.manager_id = m.id
    WHERE ep.plan_type = 'probation'
      AND ep.status = 'active'
      AND ci.status = 'scheduled'
      AND ci.scheduled_date < ${nowStr}
      AND ci.scheduled_date >= ${ago30Days}
      AND ci.check_in_type = 'milestone'
    ORDER BY ci.scheduled_date DESC
    LIMIT 100
  `)).rows as any[];

  // Per-employee strike count: total overdue milestones (not completed)
  const strikeCounts = (await db.execute(sql`
    SELECT
      ci.employee_id,
      COUNT(*) AS strike_count
    FROM check_ins ci
    JOIN employee_plans ep ON ci.plan_id = ep.id
    WHERE ep.plan_type = 'probation'
      AND ep.status = 'active'
      AND ci.check_in_type = 'milestone'
      AND ci.status = 'scheduled'
      AND ci.scheduled_date < ${nowStr}
    GROUP BY ci.employee_id
  `)).rows as any[];

  const strikeByEmployee = new Map<string, number>();
  for (const s of strikeCounts) {
    strikeByEmployee.set(s.employee_id, Math.min(Number(s.strike_count), 3));
  }

  const missedRecently: ProbationMilestoneMissed[] = missedRows.map((r) => {
    const scheduledDate = new Date(r.scheduled_date);
    const milestoneDay = r.start_date
      ? daysDiff(scheduledDate, new Date(r.start_date))
      : 0;
    return {
      employeeId: r.employee_id,
      employeeName: r.employee_name || "Unknown",
      milestoneDay,
      managerId: r.manager_id || null,
      managerName: r.manager_name || null,
      missedDaysAgo: daysDiff(now, scheduledDate),
      strikeCount: strikeByEmployee.get(r.employee_id) ?? 1,
    };
  });

  return { dueSoon, missedRecently };
}

// ── Goals section ─────────────────────────────────────────────────────────────

async function buildGoalsSection(goalCoachingThresholdDays: number): Promise<GoalsSection> {
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);
  const in14Days = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const thresholdStr = new Date(now.getTime() - goalCoachingThresholdDays * 86400000).toISOString().slice(0, 10);

  const goals = (await db.execute(sql`
    SELECT
      pg.id, pg.title, pg.employee_id, pg.manager_id, pg.target_date, pg.status,
      pg.last_escalated_at, pg.plan_id,
      au.first_name || ' ' || au.last_name AS employee_name,
      m.first_name || ' ' || m.last_name AS manager_name
    FROM performance_goals pg
    JOIN admin_users au ON au.id = pg.employee_id
    LEFT JOIN admin_users m ON m.id = pg.manager_id
    WHERE pg.status NOT IN ('completed', 'cancelled')
  `)).rows as any[];

  // Fetch last coaching date per goal's plan+employee
  const planIds = [...new Set(goals.map((g) => g.plan_id).filter(Boolean))];
  const coachingByPlanEmployee = new Map<string, string>();
  if (planIds.length > 0) {
    const coachingRows = (await db.execute(sql`
      SELECT plan_id, employee_id, MAX(entry_date) AS last_date
      FROM coaching_log_entries
      WHERE plan_id = ANY(ARRAY[${sql.join(planIds.map(id => sql`${id}`), sql`, `)}])
      GROUP BY plan_id, employee_id
    `)).rows as any[];
    for (const c of coachingRows) {
      coachingByPlanEmployee.set(`${c.plan_id}::${c.employee_id}`, c.last_date);
    }
  }

  let onTrack = 0;
  let atRisk = 0;
  let overdue = 0;
  const escalatedWithCoachingGap: EscalatedGoalWithCoachingGap[] = [];

  for (const g of goals) {
    const isOverdue = !!g.target_date && g.target_date < nowStr;
    const isEscalated = !!g.last_escalated_at;
    const dueWithin14 = !!g.target_date && g.target_date >= nowStr && g.target_date <= in14Days;

    // Get coaching gap if escalated
    let lastCoachingDate: string | null = null;
    if (isEscalated && g.plan_id) {
      lastCoachingDate = coachingByPlanEmployee.get(`${g.plan_id}::${g.employee_id}`) ?? null;
    }
    const coachingGapExceedsThreshold = isEscalated && (!lastCoachingDate || lastCoachingDate < thresholdStr);
    const coachingGapWithinThreshold = isEscalated && !!lastCoachingDate && lastCoachingDate >= thresholdStr;

    if (isOverdue) {
      overdue++;
    } else if (dueWithin14 || (isEscalated && coachingGapWithinThreshold)) {
      // at-risk: due within 14 days OR escalated but coaching gap < threshold (being managed)
      atRisk++;
    } else if (isEscalated && coachingGapExceedsThreshold) {
      // escalated with no coaching in threshold — still at-risk but also in drill-down
      atRisk++;
    } else {
      onTrack++;
    }

    if (isEscalated && coachingGapExceedsThreshold) {
      const daysSinceLastCoaching = lastCoachingDate
        ? daysDiff(now, new Date(lastCoachingDate))
        : 999;
      const daysOverdue = isOverdue && g.target_date
        ? daysDiff(now, new Date(g.target_date))
        : 0;
      escalatedWithCoachingGap.push({
        goalId: g.id,
        goalTitle: g.title,
        employeeId: g.employee_id,
        employeeName: g.employee_name || "Unknown",
        managerId: g.manager_id || null,
        managerName: g.manager_name || null,
        daysSinceLastCoaching,
        daysOverdue,
      });
    }
  }

  escalatedWithCoachingGap.sort((a, b) => b.daysSinceLastCoaching - a.daysSinceLastCoaching);

  return {
    healthSplit: { onTrack, atRisk, overdue, total: goals.length },
    escalatedWithCoachingGap,
    overdueCount: 0,
  };
}

// ── Check-ins section ─────────────────────────────────────────────────────────

async function buildCheckinsSection(): Promise<CheckinsSection> {
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Only probation-plan milestones and goal-linked check-ins within the month.
  // General one-off / weekly check-ins are excluded to avoid inflating metrics.
  const checkInRows = (await db.execute(sql`
    SELECT
      ci.id, ci.manager_id, ci.status, ci.scheduled_date,
      m.first_name || ' ' || m.last_name AS manager_name
    FROM check_ins ci
    LEFT JOIN employee_plans ep ON ep.id = ci.plan_id
    LEFT JOIN admin_users m ON m.id = ci.manager_id
    WHERE ci.scheduled_date >= ${monthStart}
      AND ci.scheduled_date <= ${nowStr}
      AND ci.manager_id IS NOT NULL
      AND (
        (ep.plan_type = 'probation')
        OR ci.goal_id IS NOT NULL
      )
    ORDER BY ci.manager_id, ci.scheduled_date ASC
  `)).rows as any[];

  const orgScheduled = checkInRows.length;
  const orgCompleted = checkInRows.filter((ci) => ci.status === "completed").length;
  const orgMissed = checkInRows.filter((ci) => ci.status === "scheduled").length;
  const completionRate = orgScheduled > 0 ? Math.round((orgCompleted / orgScheduled) * 100) : 100;

  // Per-manager grouping — ordered by scheduled_date (already sorted above)
  const managerMap = new Map<string, {
    name: string;
    items: Array<{ date: string; completed: boolean }>;
  }>();

  for (const ci of checkInRows) {
    if (!ci.manager_id) continue;
    if (!managerMap.has(ci.manager_id)) {
      managerMap.set(ci.manager_id, { name: ci.manager_name || "Unknown", items: [] });
    }
    managerMap.get(ci.manager_id)!.items.push({
      date: ci.scheduled_date,
      completed: ci.status === "completed",
    });
  }

  const perManager: ManagerCheckinCompliance[] = [];
  for (const [managerId, data] of managerMap) {
    const scheduled = data.items.length;
    const completed = data.items.filter((i) => i.completed).length;
    const missed = scheduled - completed;
    const missRate = scheduled > 0 ? Math.round((missed / scheduled) * 100) : 0;

    // Compute maximum consecutive streak of missed check-ins (completed events break streak)
    let maxConsecutive = 0;
    let currentStreak = 0;
    for (const item of data.items) {
      if (!item.completed) {
        currentStreak++;
        if (currentStreak > maxConsecutive) maxConsecutive = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    perManager.push({
      managerId,
      managerName: data.name,
      scheduled,
      completed,
      missed,
      missRate,
      consecutiveMisses: maxConsecutive,
    });
  }

  perManager.sort((a, b) => b.missRate - a.missRate || b.missed - a.missed);

  return {
    org: { scheduled: orgScheduled, completed: orgCompleted, missed: orgMissed, completionRate },
    perManager,
    overdueCount: 0,
  };
}

// ── Action items builder ──────────────────────────────────────────────────────

function buildActionItems(opts: {
  sopActionRows: SopActionRow[];
  trainingActionRows: TrainingActionRow[];
  pipActionRows: PipActionRow[];
  probation: ProbationSection;
  goals: GoalsSection;
  checkins: CheckinsSection;
  pipCheckinDays: number;
}): ActionItem[] {
  const items: ActionItem[] = [];
  let idSeq = 0;
  const nextId = () => `ai-${++idSeq}`;

  const { sopActionRows, trainingActionRows, pipActionRows, probation, goals, checkins, pipCheckinDays } = opts;

  // ── SOP action items ──────────────────────────────────────────────────────
  for (const r of sopActionRows) {
    if (r.daysOverdue > 0) {
      // Overdue — critical if full enforcement, warning otherwise
      const isFullEnforcement = r.enforcement === "full";
      items.push({
        id: nextId(),
        category: "sop",
        severity: isFullEnforcement ? "critical" : "warning",
        employeeName: r.employeeName,
        employeeId: r.userId,
        managerId: r.managerId,
        managerName: r.managerName,
        description: `SOP acknowledgement overdue by ${r.daysOverdue}d (${isFullEnforcement ? "full enforcement" : "within grace"})`,
        daysOverdue: r.daysOverdue,
        deepLinkPath: "/admin/sops/my-sops",
      });
    } else if (r.daysUntilGrace !== null) {
      // Approaching grace deadline (within 3 days) — info
      items.push({
        id: nextId(),
        category: "sop",
        severity: "info",
        employeeName: r.employeeName,
        employeeId: r.userId,
        managerId: r.managerId,
        managerName: r.managerName,
        description: `SOP acknowledgement grace period ends in ${r.daysUntilGrace} day${r.daysUntilGrace !== 1 ? "s" : ""}`,
        daysOverdue: 0,
        deepLinkPath: "/admin/sops/my-sops",
      });
    }
  }

  // ── Training action items ─────────────────────────────────────────────────
  for (const r of trainingActionRows) {
    items.push({
      id: nextId(),
      category: "training",
      severity: "warning",
      employeeName: r.employeeName,
      employeeId: r.userId,
      managerId: r.managerId,
      managerName: r.managerName,
      description: `Overdue training: "${r.trackTitle}" (${r.daysOverdue}d overdue)`,
      daysOverdue: r.daysOverdue,
      deepLinkPath: "/admin/hr?tab=training",
    });
  }

  // ── PIP action items ──────────────────────────────────────────────────────
  for (const pip of pipActionRows) {
    if (pip.coachingEntryCount === 0 && pip.planAgeDays >= 14) {
      // Critical: PIP with 0 coaching entries and plan is 14+ days old
      items.push({
        id: nextId(),
        category: "pip",
        severity: "critical",
        employeeName: pip.employeeName,
        employeeId: pip.employeeId,
        managerId: pip.managerId,
        managerName: pip.managerName,
        description: `PIP has 0 coaching entries — plan is ${pip.planAgeDays}d old`,
        daysOverdue: pip.planAgeDays,
        deepLinkPath: "/admin/hr/my-team?tab=plans",
      });
    } else if (pip.daysCoachingGap > pipCheckinDays) {
      // Warning: PIP coaching gap exceeds threshold
      items.push({
        id: nextId(),
        category: "pip",
        severity: "warning",
        employeeName: pip.employeeName,
        employeeId: pip.employeeId,
        managerId: pip.managerId,
        managerName: pip.managerName,
        description: `PIP coaching gap: ${pip.daysCoachingGap}d since last entry (threshold: ${pipCheckinDays}d)`,
        daysOverdue: pip.daysCoachingGap,
        deepLinkPath: "/admin/hr/my-team?tab=plans",
      });
    }
  }

  // ── Probation action items ────────────────────────────────────────────────
  for (const m of probation.missedRecently) {
    items.push({
      id: nextId(),
      category: "probation",
      severity: m.strikeCount >= 2 ? "critical" : "warning",
      employeeName: m.employeeName,
      employeeId: m.employeeId,
      managerId: m.managerId,
      managerName: m.managerName,
      description: `Probation milestone${m.milestoneDay > 0 ? ` (Day ${m.milestoneDay})` : ""} missed ${m.missedDaysAgo}d ago (strike ${m.strikeCount}/3)`,
      daysOverdue: m.missedDaysAgo,
      deepLinkPath: "/admin/hr/my-team?tab=plans",
    });
  }
  for (const m of probation.dueSoon) {
    if (m.daysUntilDue <= 3) {
      items.push({
        id: nextId(),
        category: "probation",
        severity: "info",
        employeeName: m.employeeName,
        employeeId: m.employeeId,
        managerId: m.managerId,
        managerName: m.managerName,
        description: `Probation milestone${m.milestoneDay > 0 ? ` (Day ${m.milestoneDay})` : ""} due in ${m.daysUntilDue} day${m.daysUntilDue !== 1 ? "s" : ""}`,
        daysOverdue: 0,
        deepLinkPath: "/admin/hr/my-team?tab=plans",
      });
    }
  }

  // ── Goal action items ─────────────────────────────────────────────────────
  for (const g of goals.escalatedWithCoachingGap) {
    items.push({
      id: nextId(),
      category: "goal",
      severity: "warning",
      employeeName: g.employeeName,
      employeeId: g.employeeId,
      managerId: g.managerId,
      managerName: g.managerName,
      description: `Escalated goal "${g.goalTitle}" — ${g.daysSinceLastCoaching}d coaching gap${g.daysOverdue > 0 ? `, ${g.daysOverdue}d overdue` : ""}`,
      daysOverdue: g.daysOverdue,
      deepLinkPath: "/admin/hr/my-team?tab=goals",
    });
  }

  // ── Check-in action items ─────────────────────────────────────────────────
  for (const m of checkins.perManager) {
    if (m.consecutiveMisses >= 5) {
      items.push({
        id: nextId(),
        category: "checkin",
        severity: "critical",
        employeeName: "",
        employeeId: "",
        managerId: m.managerId,
        managerName: m.managerName,
        description: `${m.consecutiveMisses} consecutive missed check-ins this month`,
        daysOverdue: 0,
        deepLinkPath: "/admin/hr/my-team?tab=checkins",
      });
    } else if (m.missRate > 40 || m.consecutiveMisses >= 3) {
      items.push({
        id: nextId(),
        category: "checkin",
        severity: "warning",
        employeeName: "",
        employeeId: "",
        managerId: m.managerId,
        managerName: m.managerName,
        description: `Check-in miss rate ${m.missRate}% this month (${m.missed}/${m.scheduled} missed${m.consecutiveMisses >= 3 ? `, ${m.consecutiveMisses} consecutive` : ""})`,
        daysOverdue: 0,
        deepLinkPath: "/admin/hr/my-team?tab=checkins",
      });
    } else if (m.missRate >= 20) {
      items.push({
        id: nextId(),
        category: "checkin",
        severity: "info",
        employeeName: "",
        employeeId: "",
        managerId: m.managerId,
        managerName: m.managerName,
        description: `Check-in miss rate ${m.missRate}% this month (${m.missed}/${m.scheduled} missed)`,
        daysOverdue: 0,
        deepLinkPath: "/admin/hr/my-team?tab=checkins",
      });
    }
  }

  // ── Rank: critical → warning → info, then daysOverdue desc ───────────────
  const SEVERITY_RANK: Record<ActionItemSeverity, number> = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => {
    const sr = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    return sr !== 0 ? sr : b.daysOverdue - a.daysOverdue;
  });

  return items;
}

// ── Control counts from governance_controls ledger ────────────────────────────

export async function buildControlCounts(): Promise<{
  goalOverdue: number;
  checkinOverdue: number;
  pipOverdue: number;
  pipByManager: Array<{ managerId: string; count: number }>;
}> {
  const rows = (await db.execute(sql`
    SELECT control_type, manager_id, COUNT(*) AS cnt
    FROM governance_controls
    WHERE status = 'overdue'::governance_control_status
    GROUP BY control_type, manager_id
  `)).rows as any[];

  let goalOverdue = 0;
  let checkinOverdue = 0;
  let pipOverdue = 0;
  const pipByManagerMap = new Map<string, number>();

  for (const r of rows) {
    const cnt = Number(r.cnt);
    if (r.control_type === "goal") goalOverdue += cnt;
    else if (r.control_type === "check_in") checkinOverdue += cnt;
    else if (r.control_type === "pip") {
      pipOverdue += cnt;
      if (r.manager_id) {
        pipByManagerMap.set(r.manager_id, (pipByManagerMap.get(r.manager_id) ?? 0) + cnt);
      }
    }
  }

  const pipByManager = [...pipByManagerMap.entries()].map(([managerId, count]) => ({ managerId, count }));
  return { goalOverdue, checkinOverdue, pipOverdue, pipByManager };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildGovernancePulse(): Promise<GovernancePulse> {
  const [pipCheckinDays, goalCoachingThresholdDays] = await Promise.all([
    getThreshold("governance_pip_checkin_days", 7),
    getThreshold("governance_goal_coaching_threshold_days", 14),
  ]);

  const [
    { section: sop, actionRows: sopActionRows },
    { section: training, actionRows: trainingActionRows },
    { section: plans, pipActionRows },
    probation,
    goalsRaw,
    checkinsRaw,
    { goalOverdue, checkinOverdue, pipOverdue, pipByManager },
  ] = await Promise.all([
    buildSopSectionWithActions(),
    buildTrainingSectionWithActions(),
    buildPlansSectionWithActions(pipCheckinDays),
    buildProbationSection(),
    buildGoalsSection(goalCoachingThresholdDays),
    buildCheckinsSection(),
    buildControlCounts(),
  ]);

  const goals: GoalsSection = { ...goalsRaw, overdueCount: goalOverdue };
  const checkins: CheckinsSection = { ...checkinsRaw, overdueCount: checkinOverdue };
  const pip: PipPulseSection = { overdue: pipOverdue, byManager: pipByManager };

  const action_items = buildActionItems({
    sopActionRows,
    trainingActionRows,
    pipActionRows,
    probation,
    goals,
    checkins,
    pipCheckinDays,
  });

  return {
    sop,
    training,
    plans,
    probation,
    goals,
    checkins,
    pip,
    action_items,
    generatedAt: new Date().toISOString(),
  };
}
