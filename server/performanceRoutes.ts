import type { Express, Request, Response } from "express";
import { db } from "./db";
import { emitGovernanceEvent } from "./governanceEvents";
import {
  performanceGoals, goalMilestones, checkIns, reviewCycles, reviews, performanceFeedback,
  systemSettings, adminUsers, auditLogs, sopDocuments,
  type PerformanceGoal, type GoalMilestone, type CheckIn, type ReviewCycle, type Review, type PerformanceFeedback,
} from "@shared/schema";
import { computeGoalProgress, classifyGoalMetricType, AUTO_TRACKABLE_METRIC_TYPES } from "./goalAutoProgressService";
import { resolveRoles } from "@shared/accessControl";
import { eq, and, or, inArray, sql, desc, asc, isNull, isNotNull } from "drizzle-orm";
import { DatabaseStorage } from "./storage";
import { sendCheckInReminderEmail, sendPlanManagerBriefingEmail } from "./email";
import {
  cadenceCheckInType, PROBATION_CADENCE_DAYS, milestoneDayFor, probationAreaKey,
  computeWeightedOverall, type ProbationWeight, type ProbationReviewScores,
} from "@shared/probation";
import { getAllReporteeIds, getAllReporteeIdsFromDb } from "./orgUtils";

// ─── Healthcare Plan types ────────────────────────────────────────────────────
interface PlanGoalTemplate {
  id: string;
  plan_type: string;
  role_slug: string;
  department_scope: string;
  goal_title: string;
  goal_category: string;
  goal_description: string | null;
  target_metric: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface EmployeePlan {
  id: string;
  employee_id: string;
  manager_id: string | null;
  plan_type: string;
  department_scope: string;
  status: string;
  outcome: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  pip_hr_acknowledged_at: string | null;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
}

// ─── Shared helper: insert plan-linked goals from template rows ───────────────
// Called by both POST /api/hr/plans (auto-seed) and POST /api/performance/goals/batch
// (manual plan-link). Keeps goal-creation logic in ONE canonical place.
export async function insertPlanGoalsFromTemplates(
  planId: string,
  employeeId: string,
  managerId: string | null,
  startDate: string,
  endDate: string,
  templates: PlanGoalTemplate[],
): Promise<number> {
  const sourceRef = `plan:${planId}`;
  for (const tmpl of templates) {
    await db.execute(sql`
      INSERT INTO performance_goals
        (employee_id, manager_id, title, description, category, plan_id, source_ref, start_date, target_date, weight)
      VALUES
        (${employeeId}, ${managerId}, ${tmpl.goal_title}, ${tmpl.goal_description ?? null},
         ${normalizeGoalCategory(tmpl.goal_category)}, ${planId}, ${sourceRef}, ${startDate}, ${endDate}, 3)
    `);
  }
  return templates.length;
}

// plan_goal_templates.goal_category uses a richer vocabulary (e.g. "production")
// than the performance_goals.category enum (individual|team|company|development).
// Map template categories onto valid enum buckets so goal insertion never fails
// on an out-of-enum value. "production"/output goals are individual-attributed.
const GOAL_CATEGORY_ENUM = new Set(["individual", "team", "company", "development"]);
export function normalizeGoalCategory(raw: string | null | undefined): string {
  if (raw && GOAL_CATEGORY_ENUM.has(raw)) return raw;
  if (raw === "production") return "individual";
  return "individual";
}

// ─── Activation engine ───────────────────────────────────────────────────────
// Instantiate a REAL, active, fully-tracked growth plan from a signed offer-letter
// addendum that carries a 90-day growth-plan clause. Mirrors POST /api/hr/plans
// exactly (active plan + SOP check-in schedule + template goals) so once created
// the plan follows the normal SOP: day-before/same-day reminders, manager + HR
// notifications, and escalations (driven by the scheduler off check_ins/plans).
// Idempotent — a matching growth plan for the same employee + window is never
// duplicated, so accept, countersign, and the startup backfill are all safe to
// call repeatedly. This is the foundation for the broader "attach a plan to any
// offer/addendum" system; today the only attachment signal is the growth clause.
export type AttachablePlanType = "probation" | "growth" | "pip";

// Default plan window (days) when the caller doesn't supply one. Probation and
// growth both run the 90-day cycle; PIP defaults to a 30-day window.
const PLAN_DEFAULT_DURATION_DAYS: Record<AttachablePlanType, number> = {
  probation: 90,
  growth: 90,
  pip: 30,
};

// A canonical, plan-type-agnostic goal shape used to seed performance_goals.
interface SeedGoal { title: string; description: string | null; category: string }

// ─── Shared helper: resolve the goal-template set for an attached plan ─────────
// Generalizes goal resolution across plan types:
//  - probation → cross-department framework (universal + role/level milestones,
//    legacy healthcare fallback) via resolveProbationGoalTemplates.
//  - growth / pip → plan_goal_templates filtered by plan_type, best-matched on
//    role/department/level when supplied, with sensible fallbacks so we never
//    create a zero-goal growth plan (PIP may legitimately resolve to zero goals).
export async function resolveAttachedPlanGoals(opts: {
  planType: AttachablePlanType;
  department?: string | null;
  role?: string | null;
  level?: string | null;
  designation?: string | null;
  departmentName?: string | null;
}): Promise<SeedGoal[]> {
  if (opts.planType === "probation") {
    const { parseProbationKey, resolveProbationGoalTemplates } = await import("./probationTemplates");
    const key = (opts.department || opts.role || opts.level)
      ? { department: opts.department ?? null, role: opts.role ?? null, level: opts.level ?? null }
      : parseProbationKey(opts.designation ?? null, opts.departmentName ?? null);
    const legacyRoleSlug = (opts.designation || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || null;
    const resolved = await resolveProbationGoalTemplates(key, legacyRoleSlug);
    return resolved.map(g => ({ title: g.title, description: g.description, category: g.category }));
  }

  // growth / pip — match by role (and best dept/level group) when provided.
  let rows: any[] = [];
  if (opts.role) {
    const candidates = await db.execute(sql`
      SELECT goal_title, goal_description, goal_category, sort_order, department, level
      FROM plan_goal_templates
      WHERE plan_type = ${opts.planType}::employee_plan_type
        AND is_active = true
        AND role = ${opts.role}
      ORDER BY sort_order ASC
    `);
    const all = candidates.rows as any[];
    const score = (row: any): number => {
      let s = 0;
      if (opts.department && row.department === opts.department) s += 4;
      else if (!row.department) s += 1;
      if (opts.level && row.level === opts.level) s += 2;
      else if (row.level === "all" || !row.level) s += 1;
      return s;
    };
    let best = -1; let bestGroupKey: string | null = null;
    for (const row of all) {
      const sc = score(row);
      const gk = `${row.department ?? ""}::${row.level ?? ""}`;
      if (sc > best) { best = sc; bestGroupKey = gk; }
    }
    if (bestGroupKey !== null) {
      rows = all.filter(r => `${r.department ?? ""}::${r.level ?? ""}` === bestGroupKey);
    }
  }

  // Growth fallback: legacy role_slug progression tracks, then ANY active growth
  // template so a salary-revision / promotion clause never yields a zero-goal plan.
  if (rows.length === 0 && opts.planType === "growth") {
    const candidateSlugs = ["foundation_to_senior", "senior_recruiter", "associate_recruiter"];
    for (const slug of candidateSlugs) {
      const r = await db.execute(sql`
        SELECT goal_title, goal_description, goal_category, sort_order
        FROM plan_goal_templates
        WHERE plan_type = 'growth' AND role_slug = ${slug} AND is_active = true
        ORDER BY sort_order ASC
      `);
      if (r.rows.length > 0) { rows = r.rows as any[]; break; }
    }
    if (rows.length === 0) {
      const r = await db.execute(sql`
        SELECT goal_title, goal_description, goal_category, sort_order
        FROM plan_goal_templates
        WHERE plan_type = 'growth' AND is_active = true
        ORDER BY sort_order ASC
      `);
      rows = r.rows as any[];
    }
  }

  // PIP fallback: any active PIP template (zero is acceptable — PIP goals are
  // frequently authored manually per case).
  if (rows.length === 0 && opts.planType === "pip" && !opts.role) {
    const r = await db.execute(sql`
      SELECT goal_title, goal_description, goal_category, sort_order
      FROM plan_goal_templates
      WHERE plan_type = 'pip' AND is_active = true
      ORDER BY sort_order ASC
    `);
    rows = r.rows as any[];
  }

  return (rows as any[]).map(r => ({
    title: r.goal_title,
    description: r.goal_description ?? null,
    category: r.goal_category ?? "individual",
  }));
}

// ─── Shared helper: seed plan-linked goals from a resolved goal set ───────────
// Single canonical insert used by both the document-activation engine and the
// onboarding probation activation, so goal columns stay consistent everywhere.
// startDate/endDate are nullable — pending plans pass null and dates are
// populated at activation time.
export async function seedPlanGoals(
  planId: string,
  employeeId: string,
  managerId: string | null,
  startDate: string | null,
  endDate: string | null,
  goals: SeedGoal[],
): Promise<number> {
  const sourceRef = `plan:${planId}`;
  for (const g of goals) {
    await db.execute(sql`
      INSERT INTO performance_goals
        (employee_id, manager_id, plan_id, title, description, category, status, progress,
         auto_progress_from_milestones, source_ref, start_date, target_date, weight)
      VALUES
        (${employeeId}, ${managerId}, ${planId}, ${g.title}, ${g.description ?? null},
         ${normalizeGoalCategory(g.category)}, 'not_started', 0, true, ${sourceRef},
         ${startDate}, ${endDate}, 3)
    `);
  }
  return goals.length;
}

// ─── Activation engine ───────────────────────────────────────────────────────
// Instantiate a REAL, active, fully-tracked plan of ANY type (probation / growth
// / pip) from a signed offer-letter or addendum that carries an attached plan
// template. Mirrors POST /api/hr/plans (active plan + SOP check-in schedule +
// template goals) so once created the plan follows the normal SOP. Idempotent —
// a matching plan of the same type for the same employee + window is never
// duplicated, so accept, countersign, and the startup backfill are all safe to
// call repeatedly.
export async function ensurePlanFromDocument(opts: {
  planType: AttachablePlanType;
  employeeId?: string | null;
  offerLetterId?: string | null;
  effectiveDate?: string | null;
  // The date the EMPLOYEE actually signed the addendum (addendum.accepted_at).
  // Kept for back-compat; no longer used to set start_date (plans are now
  // dormant until the manager explicitly activates them).
  signatureDate?: string | Date | null;
  createdBy: string;
  durationDays?: number;
  department?: string | null;
  role?: string | null;
  level?: string | null;
  designation?: string | null;
  departmentName?: string | null;
}): Promise<{ created: boolean; planId?: string; reason?: string }> {
  const planType = opts.planType;
  let employeeId = opts.employeeId ?? null;
  if (!employeeId && opts.offerLetterId) {
    const r = await db.execute(sql`
      SELECT employee_id FROM employee_plans
      WHERE offer_letter_id = ${opts.offerLetterId} AND employee_id IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `);
    employeeId = ((r.rows[0] as any)?.employee_id as string | undefined) ?? null;
  }
  if (!employeeId) return { created: false, reason: "no_employee" };

  // Confirm employee exists and resolve their manager so escalations route per SOP.
  const emp = await db.execute(sql`SELECT id, manager_id FROM admin_users WHERE id = ${employeeId} LIMIT 1`);
  if (emp.rows.length === 0) return { created: false, reason: "employee_missing" };
  const managerId = ((emp.rows[0] as any)?.manager_id as string | undefined) ?? null;

  const durationDays = opts.durationDays ?? PLAN_DEFAULT_DURATION_DAYS[planType];

  // Idempotency: a plan of this type for this employee already exists in a non-
  // closed state. When an offer_letter_id is provided match by that first (new
  // pending-plan path). Fall back to the legacy date-window match for already-
  // activated plans created before this flow change so the startup backfill
  // never double-creates a plan that was previously activated.
  const signatureDateStr = opts.signatureDate
    ? (opts.signatureDate instanceof Date
        ? opts.signatureDate.toISOString().slice(0, 10)
        : String(opts.signatureDate).slice(0, 10))
    : null;
  const legacyStart = (signatureDateStr && signatureDateStr.trim())
    ? signatureDateStr
    : (opts.effectiveDate && opts.effectiveDate.trim())
      ? opts.effectiveDate.slice(0, 10)
      : null;
  const legacyEnd = legacyStart
    ? new Date(new Date(legacyStart).getTime() + durationDays * 86400000).toISOString().slice(0, 10)
    : null;
  const legacyEffectiveStart = (opts.effectiveDate && opts.effectiveDate.trim())
    ? opts.effectiveDate.slice(0, 10)
    : legacyStart;
  const legacyEffectiveEnd = legacyEffectiveStart
    ? new Date(new Date(legacyEffectiveStart).getTime() + durationDays * 86400000).toISOString().slice(0, 10)
    : null;

  const dup = await db.execute(sql`
    SELECT id FROM employee_plans
    WHERE employee_id = ${employeeId} AND plan_type = ${planType}::employee_plan_type
      AND status NOT IN ('closed', 'extended')
      AND (
        ${opts.offerLetterId != null} AND offer_letter_id = ${opts.offerLetterId ?? null}
        OR ${legacyStart != null} AND start_date = ${legacyStart} AND end_date = ${legacyEnd}
        OR ${legacyEffectiveStart != null} AND start_date = ${legacyEffectiveStart} AND end_date = ${legacyEffectiveEnd}
      )
    LIMIT 1
  `);
  if (dup.rows.length > 0) return { created: false, planId: (dup.rows[0] as any).id, reason: "exists" };

  const goals = await resolveAttachedPlanGoals({
    planType,
    department: opts.department,
    role: opts.role,
    level: opts.level,
    designation: opts.designation,
    departmentName: opts.departmentName,
  });
  // Probation always has universal goals and growth always falls back to ANY
  // active template; a zero-goal result there means templates aren't seeded yet,
  // so abort rather than create an empty plan. PIP may legitimately be zero-goal.
  if (goals.length === 0 && planType !== "pip") return { created: false, reason: "no_templates" };

  // Create the PENDING plan (dormant — no dates, no check-ins yet).
  // The manager will explicitly activate it, at which point start_date, end_date,
  // check-in schedule, and governance control are all set in one deliberate action.
  const offerLetterIdVal = opts.offerLetterId ?? null;
  const result = await db.execute(sql`
    INSERT INTO employee_plans
      (employee_id, manager_id, plan_type, department_scope, status, start_date, end_date,
       duration_days, offer_letter_id, created_by)
    VALUES
      (${employeeId}, ${managerId}, ${planType}::employee_plan_type,
       'healthcare'::employee_plan_dept_scope, 'pending'::employee_plan_status,
       NULL, NULL, ${durationDays}, ${offerLetterIdVal}, ${opts.createdBy})
    RETURNING *
  `);
  const plan = result.rows[0] as EmployeePlan;

  // Seed goals with NULL dates — target_date is set at activation time from
  // the template's due_day_offset.
  await seedPlanGoals(plan.id, employeeId, managerId, null, null, goals);

  return { created: true, planId: plan.id };
}

// Back-compat thin wrapper: the original growth-only entry point now delegates to
// the generalized engine. Existing call sites (addendum accept/countersign,
// startup backfill) keep working unchanged.
export async function ensureGrowthPlanFromAddendum(opts: {
  employeeId?: string | null;
  offerLetterId?: string | null;
  effectiveDate?: string | null;
  signatureDate?: string | Date | null;
  createdBy: string;
  durationDays?: number;
}): Promise<{ created: boolean; planId?: string; reason?: string }> {
  return ensurePlanFromDocument({ ...opts, planType: "growth" });
}

// ── Cadence settings helper ───────────────────────────────────────────────────
// Single shared fetch so every generatePlanCheckIns call site uses DB-backed
// intervals. Falls back to the historical hardcoded defaults (7 days each) on
// any DB error so plan creation never blocks on a settings read failure.
export async function fetchPlanCadenceSettings(): Promise<{ pipCheckInDays: number; growthCheckInDays: number }> {
  let pipCheckInDays = 7;
  let growthCheckInDays = 7;
  try {
    const [pipSetting, growthSetting] = await Promise.all([
      storage.getSystemSetting("governance_pip_checkin_days"),
      storage.getSystemSetting("governance_growth_checkin_days"),
    ]);
    const pipVal = pipSetting?.value !== undefined ? parseInt(String(pipSetting.value), 10) : NaN;
    const growthVal = growthSetting?.value !== undefined ? parseInt(String(growthSetting.value), 10) : NaN;
    if (!Number.isNaN(pipVal) && pipVal > 0) pipCheckInDays = pipVal;
    if (!Number.isNaN(growthVal) && growthVal > 0) growthCheckInDays = growthVal;
  } catch { /* use defaults */ }
  return { pipCheckInDays, growthCheckInDays };
}

export function generatePlanCheckIns(
  planId: string,
  employeeId: string,
  managerId: string | null,
  planType: string,
  startDate: string,
  endDate: string,
  opts: { pipCheckInDays?: number; growthCheckInDays?: number } = {},
): { employeeId: string; managerId: string | null; planId: string; checkInType: string; scheduledDate: string; status: string }[] {
  const schedule: { employeeId: string; managerId: string | null; planId: string; checkInType: string; scheduledDate: string; status: string }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msPerDay = 86400000;

  const pipInterval = opts.pipCheckInDays && opts.pipCheckInDays > 0 ? opts.pipCheckInDays : 7;
  const growthInterval = opts.growthCheckInDays && opts.growthCheckInDays > 0 ? opts.growthCheckInDays : 7;

  const addDays = (from: Date, days: number) => new Date(from.getTime() + days * msPerDay);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const push = (d: Date, type: string) => {
    if (d <= end) schedule.push({ employeeId, managerId, planId, checkInType: type, scheduledDate: fmt(d), status: "scheduled" });
  };

  if (planType === "probation") {
    // Eight probation check-ins per the 90-day framework. Day 30/60/90 are the
    // FORMAL milestone reviews (scored scorecard required); the rest (Day
    // 1/7/15/45/75) are lightweight PULSE check-ins typed "weekly".
    PROBATION_CADENCE_DAYS.forEach(day => push(addDays(start, day), cadenceCheckInType(day)));
  } else if (planType === "pip") {
    // PIP review every `pipInterval` days for the full duration (DB-configurable, default 7)
    let cur = addDays(start, pipInterval);
    while (cur <= end) {
      schedule.push({ employeeId, managerId, planId, checkInType: "pip_review", scheduledDate: fmt(cur), status: "scheduled" });
      cur = addDays(cur, pipInterval);
    }
  } else if (planType === "growth") {
    // Milestone check-ins at days 30, 60, 90
    const milestoneDays = new Set([30, 60, 90]);
    milestoneDays.forEach(day => push(addDays(start, day), "milestone"));
    // Periodic updates every `growthInterval` days (DB-configurable, default 7)
    // Skip days that coincide with milestone days
    let cur = addDays(start, growthInterval);
    while (cur <= end) {
      const dayOffset = Math.round((cur.getTime() - start.getTime()) / msPerDay);
      if (!milestoneDays.has(dayOffset)) {
        push(cur, "weekly_update");
      }
      cur = addDays(cur, growthInterval);
    }
  }
  return schedule;
}

// Probation milestone review forms — the Day 30 / 60 / 90 manager check-ins each
// have a distinct purpose. Labels are derived from the offset (in days) of a
// milestone check-in from the plan start. Non-milestone days return null.
export const PROBATION_MILESTONE_LABELS: Record<number, string> = {
  30: "Calibration & Correction",
  60: "Consistency Check",
  90: "Confirmation Review",
};

export function probationMilestoneLabel(dayOffset: number): string | null {
  return PROBATION_MILESTONE_LABELS[dayOffset] ?? null;
}

const ADMIN_ROLES = ["super_admin", "admin", "hr"];
const MANAGER_ROLES = ["super_admin", "admin", "hr", "manager"];
const ALL_ROLES = ["super_admin", "admin", "hr", "operations", "manager", "employee"];

function requireAuth(req: Request, res: Response): string | null {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.session.userId;
}

// `super_admin` is the ONLY role auto-granted here — it is the protected
// break-glass role. `admin` is resolved through the registry like all other
// roles. Do NOT add `admin` back to this auto-grant.
function requirePermission(req: Request, res: Response, featureKey: string, allowedRoles: string[]): string | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  const role = req.session.role;
  const allowed = resolveRoles(featureKey, Array.from(new Set(["super_admin", ...allowedRoles])));
  if (allowed.includes(role!)) return userId;
  res.status(403).json({ error: "Insufficient permissions" });
  return null;
}

async function isFeatureEnabledOrAdmin(role: string): Promise<boolean> {
  if (ADMIN_ROLES.includes(role) || role === "manager") return true;
  const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, "performance_management_enabled"));
  return setting?.value === true;
}

async function requireFeatureAccess(req: Request, res: Response): Promise<boolean> {
  const role = req.session.role!;
  const enabled = await isFeatureEnabledOrAdmin(role);
  if (!enabled) {
    res.status(403).json({ error: "Performance module not enabled" });
    return false;
  }
  return true;
}

const storage = new DatabaseStorage();

// ─── Plan notification helpers ────────────────────────────────────────────────

async function isPlanNotificationsEnabled(): Promise<boolean> {
  try {
    const { getFeatureFlag } = await import("./featureFlags");
    return getFeatureFlag("notifications_enabled");
  } catch { return false; }
}

async function notifyPlan(
  recipientId: string | null | undefined,
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!recipientId) return;
  try {
    if (!(await isPlanNotificationsEnabled())) return;
    await storage.createNotification({ userId: recipientId, type, title, message, isRead: false, metadata: metadata ?? null });
  } catch (err) {
    console.error(`[performanceRoutes] Notification error (${type}) for ${recipientId}:`, err);
  }
}

async function getHrAdminIds(): Promise<string[]> {
  try {
    const result = await db.execute(sql`
      SELECT id FROM admin_users
      WHERE role IN ('hr', 'admin', 'super_admin') AND is_active = true AND deleted_at IS NULL
    `);
    return (result.rows as any[]).map((r: any) => r.id as string);
  } catch { return []; }
}

// ─── Step 1: brief the owning manager once per probation plan ─────────────────
// Idempotent: an atomic UPDATE…WHERE manager_briefed_at IS NULL claims the
// single-fire slot, so concurrent activation paths (create / acknowledge /
// PATCH active) can all call this safely. Respects the notifications feature
// flag — when notifications are off, nothing is sent and the slot is NOT
// claimed, so the briefing can still fire later once notifications are enabled.
async function briefManagerOnce(planId: string): Promise<void> {
  try {
    if (!(await isPlanNotificationsEnabled())) return;

    // Load the plan + manager + employee details first (read before claim).
    const planRes = await db.execute(sql`
      SELECT ep.id, ep.plan_type, ep.manager_id, ep.start_date, ep.end_date, ep.status,
             ep.acknowledged_at, ep.manager_briefed_at,
             mgr.first_name AS mgr_first_name, mgr.email AS mgr_email,
             emp.first_name || ' ' || emp.last_name AS employee_name
      FROM employee_plans ep
      JOIN admin_users mgr ON ep.manager_id = mgr.id
      JOIN admin_users emp ON ep.employee_id = emp.id
      WHERE ep.id = ${planId}
    `);
    const plan = planRes.rows[0] as any;
    if (!plan) return;
    if (!["probation", "growth", "pip"].includes(plan.plan_type)) return;
    if (!plan.manager_id) return;
    if (plan.manager_briefed_at) return;

    // Atomically claim the single-fire slot.
    const claim = await db.execute(sql`
      UPDATE employee_plans SET manager_briefed_at = NOW()
      WHERE id = ${planId} AND manager_briefed_at IS NULL
      RETURNING id
    `);
    if (claim.rows.length === 0) return; // someone else already briefed

    const ackStatus = plan.acknowledged_at ? "acknowledged by the employee" : "pending employee acknowledgement";

    const planLabel = plan.plan_type === "pip"
      ? "Performance Improvement Plan"
      : plan.plan_type === "growth"
        ? "Growth Plan"
        : "Probation Plan";
    const cadenceMsg = plan.plan_type === "pip"
      ? `Run the weekly PIP review check-ins for the full plan duration.`
      : plan.plan_type === "growth"
        ? `Run the weekly progress check-ins and complete the Day 30/60/90 milestone reviews.`
        : `Run the Day 1/7/15/30/45/60/75/90 check-ins and complete the Day 30/60/90 scorecards.`;
    const briefingLink = plan.plan_type === "probation" ? "/admin/probation-guide" : "/admin/performance/check-ins";

    await notifyPlan(
      plan.manager_id,
      `${plan.plan_type}_manager_briefing`,
      `You own ${plan.employee_name}'s ${planLabel}`,
      `${cadenceMsg} Plan runs ${plan.start_date} → ${plan.end_date}.`,
      { planId: plan.id, planType: plan.plan_type, employeeName: plan.employee_name, link: briefingLink },
    );

    if (plan.mgr_email) {
      try {
        await sendPlanManagerBriefingEmail({
          to: plan.mgr_email,
          managerFirstName: plan.mgr_first_name || "there",
          employeeName: plan.employee_name,
          startDate: plan.start_date,
          endDate: plan.end_date,
          ackStatus,
          planType: plan.plan_type,
        });
      } catch (e) {
        console.error(`[performanceRoutes] manager briefing email failed for plan ${planId}:`, e);
      }
    }
  } catch (err) {
    console.error(`[performanceRoutes] briefManagerOnce failed for plan ${planId}:`, err);
  }
}

// ─── Probation scoring helpers (Step 3/5) ─────────────────────────────────────
// Reads the same authoritative weighted areas the GET /api/hr/probation-scoring-bands
// endpoint serves (DB table first, system_settings JSON fallback). No parallel
// scoring model — the scorecard, enforcement, and guidance view share this data.
async function getProbationFinalWeights(): Promise<ProbationWeight[]> {
  try {
    const wr = await db.execute(sql`
      SELECT area, weight FROM probation_final_weights WHERE is_active = true ORDER BY sort_order ASC
    `);
    if (wr.rows.length > 0) {
      return (wr.rows as any[]).map(r => ({ area: String(r.area), weight: Number(r.weight) }));
    }
    const js = await db.execute(sql`SELECT value FROM system_settings WHERE key = 'probation_final_weights' LIMIT 1`);
    let raw = (js.rows[0] as any)?.value;
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
    if (Array.isArray(raw)) return raw.map((r: any) => ({ area: String(r.area), weight: Number(r.weight) }));
  } catch (err) {
    console.error("[performanceRoutes] getProbationFinalWeights failed:", err);
  }
  return [];
}

function validateMilestoneScores(
  incoming: any,
  weights: ProbationWeight[],
): { ok: boolean; error?: string; normalized?: ProbationReviewScores } {
  if (!incoming || typeof incoming !== "object") {
    return { ok: false, error: "Milestone scores are required to complete a Day 30/60/90 review." };
  }
  const scores = (incoming.scores && typeof incoming.scores === "object") ? incoming.scores : incoming;
  if (!scores || typeof scores !== "object") {
    return { ok: false, error: "Milestone scores are required to complete a Day 30/60/90 review." };
  }
  if (weights.length === 0) {
    // No configured areas — still require an overall numeric score so a review
    // is never confirmed with empty scoring.
    const overall = typeof incoming.overall === "number" ? incoming.overall : NaN;
    if (Number.isNaN(overall)) return { ok: false, error: "An overall milestone score is required." };
    return { ok: true, normalized: { scores: scores as Record<string, number>, overall: Math.round(overall), recommendedOutcome: incoming.recommendedOutcome ?? null, band: incoming.band ?? null, decisionNote: incoming.decisionNote ?? null } };
  }
  for (const w of weights) {
    const key = probationAreaKey(w.area);
    const v = (scores as any)[key];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 100) {
      return { ok: false, error: `A score (0-100) for "${w.area}" is required.` };
    }
  }
  const overall = computeWeightedOverall(scores as Record<string, number>, weights);
  return {
    ok: true,
    normalized: {
      scores: scores as Record<string, number>,
      overall,
      recommendedOutcome: incoming.recommendedOutcome ?? null,
      band: incoming.band ?? null,
      decisionNote: incoming.decisionNote ?? null,
    },
  };
}

// Shared completion gate for probation check-ins (used by both PATCH paths).
// Returns an error string when completion must be blocked, or the normalized
// reviewScores to persist for a milestone review.
async function enforceProbationCompletion(opts: {
  completing: boolean;
  planId: string | null | undefined;
  scheduledDate: string;
  incomingManagerNotes?: string | null;
  existingManagerNotes?: string | null;
  incomingReviewScores?: any;
  existingReviewScores?: any;
}): Promise<{ error?: string; reviewScoresToPersist?: ProbationReviewScores | null }> {
  if (!opts.completing || !opts.planId) return {};
  const planRes = await db.execute(sql`SELECT plan_type, start_date FROM employee_plans WHERE id = ${opts.planId}`);
  const plan = planRes.rows[0] as any;
  if (!plan || plan.plan_type !== "probation") return {};

  const notes = String(opts.incomingManagerNotes ?? opts.existingManagerNotes ?? "").trim();
  if (!notes) return { error: "Manager notes are required to complete a probation check-in." };

  const mDay = milestoneDayFor(String(plan.start_date), String(opts.scheduledDate));
  if (mDay == null) return {}; // pulse check-in: notes are sufficient

  const weights = await getProbationFinalWeights();
  const v = validateMilestoneScores(opts.incomingReviewScores ?? opts.existingReviewScores, weights);
  if (!v.ok) return { error: v.error };
  return { reviewScoresToPersist: v.normalized ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────


interface AuditLogChanges {
  goalId?: string;
  title?: string;
  checkInId?: string;
  scheduledDate?: string;
  cycleId?: string;
  name?: string;
  reviewId?: string;
  employeeId?: string;
  feedbackId?: string;
  milestoneId?: string;
  order?: string[];
  done?: boolean;
  sourceRef?: string;
  type?: string;
  bulk?: boolean;
  planId?: string;
  plan_type?: string;
  employee_id?: string;
  role_slug?: string;
  goal_title?: string;
  id?: string;
  count?: number;
  changes?: Record<string, unknown>;
}

async function createAuditLog(actorId: string, action: string, changes?: AuditLogChanges, targetId?: string) {
  await db.insert(auditLogs).values({
    actorId,
    action,
    changes,
    targetId: targetId || null,
  });
}

// Returns the goal if the user may access (view/edit) it, otherwise null.
async function getAccessibleGoal(userId: string, role: string, goalId: string): Promise<PerformanceGoal | null> {
  const [goal] = await db.select().from(performanceGoals).where(eq(performanceGoals.id, goalId));
  if (!goal) return null;
  if (goal.employeeId === userId) return goal;
  if (ADMIN_ROLES.includes(role)) return goal;
  const teamIds = await getAllReporteeIdsFromDb(userId);
  if (teamIds.includes(goal.employeeId)) return goal;
  return null;
}

// Recomputes a goal's progress. Two paths:
// 1. Milestone-based: autoProgressFromMilestones=true — counts completed milestones.
// 2. Recruiter-activity-based: sourceRef starts with "recruiter_metric:" — delegates to
//    goalAutoProgressService (call_volume / interview_conversion / placement_count).
async function recomputeGoalProgress(goalId: string): Promise<void> {
  const [goal] = await db.select().from(performanceGoals).where(eq(performanceGoals.id, goalId));
  if (!goal) return;

  // ── Path 1: milestone-based auto-progress ────────────────────────────────
  if (goal.autoProgressFromMilestones) {
    const milestones = await db.select().from(goalMilestones).where(eq(goalMilestones.goalId, goalId));
    if (milestones.length === 0) return;
    const doneCount = milestones.filter(m => m.done).length;
    const progress = Math.round((doneCount / milestones.length) * 100);
    await db.update(performanceGoals)
      .set({ progress, updatedAt: new Date() })
      .where(eq(performanceGoals.id, goalId));
    return;
  }

  // ── Path 2: recruiter-metric auto-progress ───────────────────────────────
  // sourceRef format: "recruiter_metric:<type>:<target>"
  //   type   = call_volume | interview_conversion | placement_count
  //   target = numeric denominator for percentage calculation:
  //            • call_volume / placement_count: period target (e.g. 200 calls)
  //            • interview_conversion: leave empty or 100 (already a percentage)
  if (goal.sourceRef?.startsWith("recruiter_metric:")) {
    const parts = goal.sourceRef.split(":");   // ["recruiter_metric", type, optionalTarget]
    const metricType = parts[1] ?? "";
    const targetNum = parts[2] ? parseInt(parts[2], 10) : null;

    if (!AUTO_TRACKABLE_METRIC_TYPES.includes(metricType as any)) return;

    const periodFrom = goal.startDate ?? new Date().toISOString().split("T")[0];
    const periodTo = goal.targetDate ?? new Date().toISOString().split("T")[0];
    const result = await computeGoalProgress(metricType, goal.employeeId, periodFrom, periodTo);
    if (result === null) return;

    let progress: number;
    if (metricType === "interview_conversion") {
      // result.actual is already a percentage 0-100
      progress = Math.min(100, Math.max(0, result.actual));
    } else if (targetNum && targetNum > 0) {
      // call_volume / placement_count: normalise against stored target
      progress = Math.min(100, Math.max(0, Math.round((result.actual / targetNum) * 100)));
    } else {
      // No target denominator stored — store raw count capped at 100 and log
      console.warn(`[autoProgress] goal ${goalId} (${metricType}) has no target in sourceRef; storing raw actual=${result.actual}`);
      progress = Math.min(100, result.actual);
    }

    await db.update(performanceGoals)
      .set({ progress, updatedAt: new Date() })
      .where(eq(performanceGoals.id, goalId));
  }
}

// Exported so recruiterRoutes can trigger recomputation after activity/stage updates.
export { recomputeGoalProgress };

export function registerPerformanceRoutes(app: Express) {

  // ==========================================
  // GOALS
  // ==========================================

  app.get("/api/performance/goals", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const result = await db.execute(sql`
        SELECT pg.*,
               ep.start_date AS plan_start_date,
               ep.duration_days AS plan_duration_days
        FROM performance_goals pg
        LEFT JOIN employee_plans ep ON pg.plan_id = ep.id
        WHERE pg.employee_id = ${userId}
        ORDER BY pg.start_date ASC NULLS LAST, pg.target_date ASC NULLS LAST
      `);
      const mapped = (result.rows as any[]).map((g) => ({
        id: g.id,
        userId: g.employee_id,
        title: g.title,
        description: g.description,
        category: g.category,
        startDate: g.start_date,
        targetDate: g.target_date,
        weight: g.weight,
        progress: g.progress,
        status: g.status,
        successCriteria: g.success_criteria,
        rayoAcademyTrackId: g.rayo_academy_track_id,
        linkedSopId: g.linked_sop_id,
        autoProgressFromMilestones: g.auto_progress_from_milestones,
        sourceRef: g.source_ref,
        notes: g.notes,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
        planId: g.plan_id,
        planStartDate: g.plan_start_date,
        planDurationDays: g.plan_duration_days,
        employeeNudgedAt: g.employee_nudged_at,
        lastEscalatedAt: g.last_escalated_at,
        skipEscalatedAt: g.skip_escalated_at,
      }));
      res.json(mapped);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ error: "Failed to fetch goals" });
    }
  });

  app.get("/api/performance/goals/team", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals.team", MANAGER_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const teamIds = await getAllReporteeIdsFromDb(userId);
      if (teamIds.length === 0) return res.json([]);

      const goals = await db.select().from(performanceGoals)
        .where(inArray(performanceGoals.employeeId, teamIds))
        .orderBy(asc(performanceGoals.startDate), asc(performanceGoals.targetDate));

      const employees = await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
        .from(adminUsers).where(inArray(adminUsers.id, teamIds));
      const empMap = Object.fromEntries(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));

      res.json(goals.map(g => ({ ...g, employeeName: empMap[g.employeeId] || "Unknown" })));
    } catch (error) {
      console.error("Error fetching team goals:", error);
      res.status(500).json({ error: "Failed to fetch team goals" });
    }
  });

  // Role scorecard: rolls SOP-linked goal progress up by role (Task #664).
  // Read-only aggregation for the Performance Analytics page.
  app.get("/api/performance/sop-scorecard", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals.team", MANAGER_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const rows = await db.select({
        goalId: performanceGoals.id,
        title: performanceGoals.title,
        progress: performanceGoals.progress,
        status: performanceGoals.status,
        linkedSopId: performanceGoals.linkedSopId,
        role: adminUsers.role,
        sopCode: sopDocuments.code,
        sopTitle: sopDocuments.title,
      })
        .from(performanceGoals)
        .innerJoin(adminUsers, eq(performanceGoals.employeeId, adminUsers.id))
        .leftJoin(sopDocuments, eq(performanceGoals.linkedSopId, sopDocuments.id))
        .where(isNotNull(performanceGoals.linkedSopId))
        .orderBy(desc(performanceGoals.createdAt));

      const roleMap = new Map<string, {
        role: string;
        totalGoals: number;
        sumProgress: number;
        completed: number;
        sops: Map<string, { code: string; title: string; count: number }>;
      }>();

      for (const r of rows) {
        const role = r.role || "unassigned";
        const agg = roleMap.get(role) ?? { role, totalGoals: 0, sumProgress: 0, completed: 0, sops: new Map() };
        agg.totalGoals += 1;
        agg.sumProgress += r.progress ?? 0;
        if (r.status === "completed") agg.completed += 1;
        if (r.sopCode) {
          const key = r.sopCode;
          const sopAgg = agg.sops.get(key) ?? { code: r.sopCode, title: r.sopTitle ?? r.sopCode, count: 0 };
          sopAgg.count += 1;
          agg.sops.set(key, sopAgg);
        }
        roleMap.set(role, agg);
      }

      const scorecard = Array.from(roleMap.values())
        .map((a) => ({
          role: a.role,
          totalGoals: a.totalGoals,
          avgProgress: a.totalGoals > 0 ? Math.round(a.sumProgress / a.totalGoals) : 0,
          completed: a.completed,
          sops: Array.from(a.sops.values()).sort((x, y) => x.code.localeCompare(y.code)),
        }))
        .sort((x, y) => y.totalGoals - x.totalGoals);

      res.json(scorecard);
    } catch (error) {
      console.error("Error building SOP scorecard:", error);
      res.status(500).json({ error: "Failed to build SOP scorecard" });
    }
  });

  // Flat list of accessible employees for picker UIs (goal/check-in dialogs).
  // Managers get direct AND indirect reports; admins/HR get all active employees.
  app.get("/api/performance/team-members", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.teamGoals", MANAGER_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const role = req.session.role!;
      const allUsers = await storage.getAdminUsers();

      let accessible: typeof allUsers;
      if (ADMIN_ROLES.includes(role)) {
        accessible = allUsers.filter(u => u.isActive && u.id !== userId);
      } else {
        const reporteeIds = getAllReporteeIds(userId, allUsers);
        accessible = allUsers.filter(u => reporteeIds.includes(u.id) && u.isActive);
      }

      res.json(accessible.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        designation: (u as any).designation || null,
        role: u.role,
      })));
    } catch (error) {
      console.error("Error fetching performance team members:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // Grouped team goals endpoint — returns members shape expected by TeamGoals.tsx
  app.get("/api/performance/team-goals", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.teamGoals", MANAGER_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const role = req.session.role!;
      const allUsers = await storage.getAdminUsers();

      let teamMembers: typeof allUsers;
      if (ADMIN_ROLES.includes(role)) {
        teamMembers = allUsers.filter(u => u.isActive && u.id !== userId);
      } else {
        // Use full org-chain BFS (direct and indirect reports)
        const reporteeIds = getAllReporteeIds(userId, allUsers);
        teamMembers = allUsers.filter(u => reporteeIds.includes(u.id) && u.isActive);
      }

      const teamIds = teamMembers.map(m => m.id);

      const rawGoals = teamIds.length > 0
        ? (await db.execute(sql`
            SELECT pg.*,
                   ep.start_date AS plan_start_date,
                   ep.duration_days AS plan_duration_days,
                   ep.plan_type AS plan_type_from_plan
            FROM performance_goals pg
            LEFT JOIN employee_plans ep ON pg.plan_id = ep.id
            WHERE pg.employee_id = ANY(${teamIds})
            ORDER BY pg.start_date ASC NULLS LAST, pg.target_date ASC NULLS LAST
          `)).rows as any[]
        : [] as any[];

      const membersWithGoals = teamMembers.map(member => ({
        userId: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        designation: (member as any).designation || null,
        goals: rawGoals.filter((g: any) => g.employee_id === member.id).map((g: any) => ({
          id: g.id,
          userId: g.employee_id,
          title: g.title,
          description: g.description,
          category: g.category,
          startDate: g.start_date,
          targetDate: g.target_date,
          weight: g.weight,
          progress: g.progress,
          status: g.status,
          successCriteria: g.success_criteria,
          autoProgressFromMilestones: g.auto_progress_from_milestones,
          sourceRef: g.source_ref,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
          lastEscalatedAt: g.last_escalated_at,
          planId: g.plan_id,
          planStartDate: g.plan_start_date,
          planDurationDays: g.plan_duration_days,
        })),
      }));

      const totalGoals = rawGoals.length;
      const completedGoals = rawGoals.filter((g: any) => g.status === "completed").length;
      const inProgressGoals = rawGoals.filter((g: any) => g.status === "in_progress" || g.status === "on_track").length;
      const atRiskGoals = rawGoals.filter((g: any) => g.status === "at_risk").length;

      res.json({
        members: membersWithGoals,
        summary: { totalGoals, completedGoals, inProgressGoals, atRiskGoals },
      });
    } catch (error) {
      console.error("Error fetching team goals:", error);
      res.status(500).json({ error: "Failed to fetch team goals" });
    }
  });

  app.post("/api/performance/goals", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;
    const role = req.session.role!;

    try {
      const { title, description, category, startDate, targetDate, weight, employeeId, rayoAcademyTrackId, autoProgressFromMilestones, linkedSopId } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required" });

      const targetEmployee = employeeId || userId;
      if (targetEmployee !== userId) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(targetEmployee) && !ADMIN_ROLES.includes(role)) {
          return res.status(403).json({ error: "Cannot create goals for this employee" });
        }
      }

      const [goal] = await db.insert(performanceGoals).values({
        employeeId: targetEmployee,
        managerId: targetEmployee !== userId ? userId : null,
        title,
        description: description || null,
        category: category || "individual",
        startDate: startDate || null,
        targetDate: targetDate || null,
        weight: weight || 0,
        rayoAcademyTrackId: rayoAcademyTrackId || null,
        autoProgressFromMilestones: autoProgressFromMilestones === true,
        linkedSopId: linkedSopId || null,
      }).returning();

      await createAuditLog(userId, "performance_goal_created", { goalId: goal.id, title }, targetEmployee !== userId ? targetEmployee : undefined);
      res.status(201).json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  // Batch create goals — from annexure rows (with sourceRef) or manual bulk paste (no sourceRef)
  app.post("/api/performance/goals/batch", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals.batch", ALL_ROLES);
    if (!userId) return;

    try {
      const {
        employeeId,
        goals: goalItems,
        sourceRef,
        startDate: batchStartDate,
        targetDate: batchTargetDate,
      } = req.body as {
        employeeId?: string;
        sourceRef?: string;
        startDate?: string;
        targetDate?: string;
        goals: {
          title: string;
          description?: string;
          startDate?: string;
          targetDate?: string;
          autoProgressFromMilestones?: boolean;
          milestones?: { title: string; targetDate?: string }[];
        }[];
      };

      if (!Array.isArray(goalItems) || goalItems.length === 0) return res.status(400).json({ error: "goals array is required" });

      const cleanedItems = goalItems
        .map(g => ({ ...g, title: (g.title || "").trim() }))
        .filter(g => g.title.length > 0);
      if (cleanedItems.length === 0) return res.status(400).json({ error: "At least one goal with a title is required" });

      // Default to self when no employee specified (manual bulk-add on My Goals).
      const targetEmployee = employeeId || userId;

      // Authorization: admin/hr/super_admin can create for any employee;
      // managers can only create for their direct reports; everyone can create for themselves.
      const role = req.session.role!;
      if (targetEmployee !== userId && !ADMIN_ROLES.includes(role)) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(targetEmployee)) {
          return res.status(403).json({ error: "Not authorized to create goals for this employee" });
        }
      }

      const planId = (req.body.plan_id || req.body.planId) as string | undefined;

      // ── Plan validation BEFORE any writes ──────────────────────────────────
      let linkedPlan: EmployeePlan | null = null;
      if (planId) {
        const planResult = await db.execute(sql`SELECT * FROM employee_plans WHERE id = ${planId}`);
        if (planResult.rows.length === 0) {
          return res.status(404).json({ error: "Referenced plan not found" });
        }
        linkedPlan = planResult.rows[0] as EmployeePlan;
        if (linkedPlan.employee_id !== targetEmployee) {
          return res.status(403).json({ error: "Plan does not belong to the target employee" });
        }
        const batchRole = req.session.role!;
        if (!ADMIN_ROLES.includes(batchRole) && linkedPlan.employee_id !== userId) {
          const planTeamIds = await getAllReporteeIdsFromDb(userId);
          if (!planTeamIds.includes(linkedPlan.employee_id)) {
            return res.status(403).json({ error: "Not authorized to link goals to this plan" });
          }
        }
      }

      // Auto-derive source_ref for plan-linked goals to ensure traceability
      const effectiveSourceRef = planId ? `plan:${planId}` : (sourceRef || null);

      const inserted = await db.insert(performanceGoals).values(
        cleanedItems.map(g => ({
          employeeId: targetEmployee,
          managerId: targetEmployee !== userId ? userId : null,
          title: g.title,
          description: g.description?.trim() || null,
          category: "individual" as const,
          startDate: g.startDate || batchStartDate || null,
          targetDate: g.targetDate || batchTargetDate || null,
          weight: 3,
          sourceRef: effectiveSourceRef,
          autoProgressFromMilestones: g.autoProgressFromMilestones === true,
          planId: planId || null,
        }))
      ).returning();

      let milestonesCreated = 0;
      for (let i = 0; i < inserted.length; i++) {
        const g = inserted[i];
        const milestoneDefs = cleanedItems[i]?.milestones || [];
        if (milestoneDefs.length > 0) {
          const insertedMilestones = await db.insert(goalMilestones).values(
            milestoneDefs.map((m, idx) => ({
              goalId: g.id,
              title: m.title,
              targetDate: m.targetDate || null,
              sortOrder: idx,
            }))
          ).returning();
          milestonesCreated += insertedMilestones.length;
          await createAuditLog(userId, "goal_milestones_created_from_addendum", { goalId: g.id, sourceRef: effectiveSourceRef || undefined, changes: { count: insertedMilestones.length } }, targetEmployee !== userId ? targetEmployee : undefined);
        }
        if (effectiveSourceRef) {
          await createAuditLog(userId, "performance_goal_created_from_addendum", { goalId: g.id, title: g.title, sourceRef: effectiveSourceRef }, targetEmployee !== userId ? targetEmployee : undefined);
        } else {
          await createAuditLog(userId, "performance_goal_created", { goalId: g.id, title: g.title, bulk: true }, targetEmployee !== userId ? targetEmployee : undefined);
        }
      }

      // Generate plan check-ins if none exist yet (validation already done above)
      let planCheckInsScheduled = 0;
      if (linkedPlan) {
        const existingCi = await db.execute(sql`SELECT id FROM check_ins WHERE plan_id = ${planId} LIMIT 1`);
        if (existingCi.rows.length === 0) {
          const ciCadenceOpts = await fetchPlanCadenceSettings();
          const ciSchedule = generatePlanCheckIns(
            linkedPlan.id, linkedPlan.employee_id, linkedPlan.manager_id,
            linkedPlan.plan_type, linkedPlan.start_date, linkedPlan.end_date,
            ciCadenceOpts,
          );
          for (const ci of ciSchedule) {
            await db.execute(sql`
              INSERT INTO check_ins (employee_id, manager_id, plan_id, check_in_type, scheduled_date, status)
              VALUES (${ci.employeeId}, ${ci.managerId}, ${ci.planId}, ${ci.checkInType}::check_in_type, ${ci.scheduledDate}, 'scheduled'::check_in_status)
            `);
          }
          planCheckInsScheduled = ciSchedule.length;
        }
      }

      res.status(201).json({ created: inserted.length, milestonesCreated, goals: inserted, planCheckInsScheduled });
    } catch (error) {
      console.error("Error batch creating goals:", error);
      res.status(500).json({ error: "Failed to create goals" });
    }
  });

  app.patch("/api/performance/goals/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;
    const role = req.session.role!;

    try {
      const [existing] = await db.select().from(performanceGoals).where(eq(performanceGoals.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Goal not found" });

      if (existing.employeeId !== userId) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(existing.employeeId) && !ADMIN_ROLES.includes(role)) {
          return res.status(403).json({ error: "Not authorized to update this goal" });
        }
      }

      const { title, description, category, startDate, targetDate, weight, status, progress, rayoAcademyTrackId, autoProgressFromMilestones, linkedSopId } = req.body;
      const updates: Partial<PerformanceGoal> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (startDate !== undefined) updates.startDate = startDate;
      if (targetDate !== undefined) updates.targetDate = targetDate;
      if (weight !== undefined) updates.weight = weight;
      if (status !== undefined) updates.status = status;
      if (progress !== undefined) {
        const clamped = Math.min(100, Math.max(0, progress));
        updates.progress = clamped;
        // Track when progress was last changed (distinct from any other field update)
        if (clamped !== existing.progress) {
          (updates as any).lastProgressUpdatedAt = new Date();
          // Mark as manually entered when a manager/employee sets progress directly
          (updates as any).goalProgressSource = "manual";
          (updates as any).goalProgressUpdatedAt = new Date();
        }
      }
      if (rayoAcademyTrackId !== undefined) updates.rayoAcademyTrackId = rayoAcademyTrackId;
      if (autoProgressFromMilestones !== undefined) updates.autoProgressFromMilestones = autoProgressFromMilestones === true;
      if (linkedSopId !== undefined) updates.linkedSopId = linkedSopId || null;

      const [updated] = await db.update(performanceGoals).set(updates).where(eq(performanceGoals.id, req.params.id)).returning();
      // If auto-progress was just turned on, recompute from existing milestones immediately.
      if (updates.autoProgressFromMilestones === true) {
        await recomputeGoalProgress(req.params.id);
      }
      const [finalGoal] = await db.select().from(performanceGoals).where(eq(performanceGoals.id, req.params.id));
      await createAuditLog(userId, "performance_goal_updated", { goalId: req.params.id, changes: updates as Record<string, unknown> }, existing.employeeId);
      res.json(finalGoal || updated);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  app.delete("/api/performance/goals/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;
    const role = req.session.role!;

    try {
      const [existing] = await db.select().from(performanceGoals).where(eq(performanceGoals.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Goal not found" });

      if (existing.employeeId !== userId) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(existing.employeeId) && !ADMIN_ROLES.includes(role)) {
          return res.status(403).json({ error: "Not authorized to delete this goal" });
        }
      }

      await db.delete(performanceGoals).where(eq(performanceGoals.id, req.params.id));
      await createAuditLog(userId, "performance_goal_deleted", { goalId: req.params.id, title: existing.title }, existing.employeeId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ error: "Failed to delete goal" });
    }
  });

  // ==========================================
  // GOAL MILESTONES
  // ==========================================

  // List milestones for a goal
  app.get("/api/performance/goals/:goalId/milestones", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals.milestones", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const goal = await getAccessibleGoal(userId, req.session.role!, req.params.goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });

      const milestones = await db.select().from(goalMilestones)
        .where(eq(goalMilestones.goalId, req.params.goalId))
        .orderBy(asc(goalMilestones.sortOrder), asc(goalMilestones.createdAt));
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });

  // Create a milestone on a goal
  app.post("/api/performance/goals/:goalId/milestones", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals.milestones", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const goal = await getAccessibleGoal(userId, req.session.role!, req.params.goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });

      const { title, targetDate } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });

      const [maxRow] = await db.select({ max: sql<number>`coalesce(max(${goalMilestones.sortOrder}), -1)::int` })
        .from(goalMilestones).where(eq(goalMilestones.goalId, req.params.goalId));
      const nextOrder = (maxRow?.max ?? -1) + 1;

      const [milestone] = await db.insert(goalMilestones).values({
        goalId: req.params.goalId,
        title: title.trim(),
        targetDate: targetDate || null,
        sortOrder: nextOrder,
      }).returning();

      await recomputeGoalProgress(req.params.goalId);
      await createAuditLog(userId, "goal_milestone_created", { goalId: req.params.goalId, milestoneId: milestone.id, title: milestone.title }, goal.employeeId);
      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ error: "Failed to create milestone" });
    }
  });

  // Update a milestone (title, target date, done state)
  app.patch("/api/performance/milestones/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.milestones", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const [existing] = await db.select().from(goalMilestones).where(eq(goalMilestones.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Milestone not found" });

      const goal = await getAccessibleGoal(userId, req.session.role!, existing.goalId);
      if (!goal) return res.status(403).json({ error: "Not authorized to update this milestone" });

      const { title, targetDate, done } = req.body;
      const updates: Partial<GoalMilestone> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (targetDate !== undefined) updates.targetDate = targetDate || null;
      if (done !== undefined) {
        updates.done = done === true;
        updates.completedAt = done === true ? new Date() : null;
      }

      const [updated] = await db.update(goalMilestones).set(updates).where(eq(goalMilestones.id, req.params.id)).returning();
      await recomputeGoalProgress(existing.goalId);
      await createAuditLog(userId, "goal_milestone_updated", { goalId: existing.goalId, milestoneId: req.params.id, done: updates.done, changes: updates as Record<string, unknown> }, goal.employeeId);
      res.json(updated);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  // Delete a milestone
  app.delete("/api/performance/milestones/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.milestones", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const [existing] = await db.select().from(goalMilestones).where(eq(goalMilestones.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Milestone not found" });

      const goal = await getAccessibleGoal(userId, req.session.role!, existing.goalId);
      if (!goal) return res.status(403).json({ error: "Not authorized to delete this milestone" });

      await db.delete(goalMilestones).where(eq(goalMilestones.id, req.params.id));
      await recomputeGoalProgress(existing.goalId);
      await createAuditLog(userId, "goal_milestone_deleted", { goalId: existing.goalId, milestoneId: req.params.id, title: existing.title }, goal.employeeId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  // Reorder milestones within a goal
  app.post("/api/performance/goals/:goalId/milestones/reorder", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals.milestones.reorder", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const goal = await getAccessibleGoal(userId, req.session.role!, req.params.goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });

      const { orderedIds } = req.body as { orderedIds: string[] };
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ error: "orderedIds array is required" });
      }

      const existing = await db.select().from(goalMilestones).where(eq(goalMilestones.goalId, req.params.goalId));
      const existingIds = new Set(existing.map(m => m.id));
      if (!orderedIds.every(id => existingIds.has(id))) {
        return res.status(400).json({ error: "orderedIds contains unknown milestones" });
      }

      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(goalMilestones).set({ sortOrder: i, updatedAt: new Date() }).where(eq(goalMilestones.id, orderedIds[i]));
      }

      await createAuditLog(userId, "goal_milestones_reordered", { goalId: req.params.goalId, order: orderedIds }, goal.employeeId);

      const milestones = await db.select().from(goalMilestones)
        .where(eq(goalMilestones.goalId, req.params.goalId))
        .orderBy(asc(goalMilestones.sortOrder), asc(goalMilestones.createdAt));
      res.json(milestones);
    } catch (error) {
      console.error("Error reordering milestones:", error);
      res.status(500).json({ error: "Failed to reorder milestones" });
    }
  });

  // List check-ins linked to a specific goal
  app.get("/api/performance/goals/:goalId/check-ins", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals.checkIns", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const goal = await getAccessibleGoal(userId, req.session.role!, req.params.goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });

      const list = await db.select().from(checkIns)
        .where(eq(checkIns.goalId, req.params.goalId))
        .orderBy(desc(checkIns.scheduledDate));

      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const enriched = list.map(ci => {
        const mgr = ci.managerId ? userMap.get(ci.managerId) : null;
        return { ...ci, managerName: mgr ? `${mgr.firstName} ${mgr.lastName}` : null };
      });
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching goal check-ins:", error);
      res.status(500).json({ error: "Failed to fetch goal check-ins" });
    }
  });

  // Create a check-in linked to a specific goal (owner or manager/admin of the owner)
  app.post("/api/performance/goals/:goalId/check-ins", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals.checkIns", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const goal = await getAccessibleGoal(userId, req.session.role!, req.params.goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });

      const { scheduledDate, employeeNotes, managerNotes, actionItems } = req.body;
      if (!scheduledDate) return res.status(400).json({ error: "Scheduled date is required" });

      const [ci] = await db.insert(checkIns).values({
        employeeId: goal.employeeId,
        managerId: goal.managerId || (goal.employeeId !== userId ? userId : null),
        goalId: goal.id,
        scheduledDate,
        employeeNotes: employeeNotes || null,
        managerNotes: managerNotes || null,
        actionItems: actionItems || null,
      }).returning();

      await createAuditLog(userId, "goal_check_in_created", { goalId: goal.id, checkInId: ci.id, scheduledDate }, goal.employeeId);
      res.status(201).json(ci);
    } catch (error) {
      console.error("Error creating goal check-in:", error);
      res.status(500).json({ error: "Failed to create goal check-in" });
    }
  });

  // ==========================================
  // CHECK-INS
  // ==========================================

  app.get("/api/performance/check-ins", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.checkIns.get", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const role = req.session.role!;
      const isManagerRole = MANAGER_ROLES.includes(role);

      const list = await db.select().from(checkIns)
        .where(or(eq(checkIns.employeeId, userId), eq(checkIns.managerId, userId)))
        .orderBy(desc(checkIns.scheduledDate));

      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      // Resolve plan start dates + types so probation milestone check-ins can be
      // labeled as Day 30 / 60 / 90 review forms and the UI can render the
      // milestone scorecard and overdue state without a second round-trip.
      const planIds = Array.from(new Set(list.map(ci => ci.planId).filter(Boolean))) as string[];
      const planMap = new Map<string, { planType: string; startDate: string; endDate?: string; durationDays?: number }>();
      if (planIds.length > 0) {
        const planRows = await db.execute(sql`
          SELECT id, plan_type, start_date, end_date, duration_days FROM employee_plans WHERE id IN (${sql.join(planIds.map(id => sql`${id}`), sql`, `)})
        `);
        for (const r of planRows.rows as any[]) {
          planMap.set(String(r.id), {
            planType: String(r.plan_type),
            startDate: String(r.start_date),
            endDate: r.end_date ? String(r.end_date) : undefined,
            durationDays: r.duration_days ? Number(r.duration_days) : undefined,
          });
        }
      }
      const todayStr = new Date().toISOString().slice(0, 10);

      // Fetch all goals for each plan so we can populate discussion context
      const planGoalMap = new Map<string, any[]>();
      if (planIds.length > 0) {
        const goalRows = await db.execute(sql`
          SELECT id, plan_id, title, progress, status, target_date, start_date, updated_at
          FROM performance_goals
          WHERE plan_id IN (${sql.join(planIds.map(id => sql`${id}`), sql`, `)})
          ORDER BY start_date ASC NULLS LAST, target_date ASC NULLS LAST
        `);
        for (const g of goalRows.rows as any[]) {
          const arr = planGoalMap.get(String(g.plan_id)) ?? [];
          arr.push(g);
          planGoalMap.set(String(g.plan_id), arr);
        }
      }

      // Fetch each plan's sorted check-ins to find the previous action items
      const planCheckInsMap = new Map<string, any[]>();
      if (planIds.length > 0) {
        const ciRows = await db.execute(sql`
          SELECT id, plan_id, scheduled_date, action_items, status
          FROM check_ins
          WHERE plan_id IN (${sql.join(planIds.map(id => sql`${id}`), sql`, `)})
            AND status = 'completed'
          ORDER BY scheduled_date DESC
        `);
        for (const c of ciRows.rows as any[]) {
          const arr = planCheckInsMap.get(String(c.plan_id)) ?? [];
          arr.push(c);
          planCheckInsMap.set(String(c.plan_id), arr);
        }
      }

      // Helper: compute the phase label for a check-in based on plan type + days elapsed
      function computePlanPhase(
        planType: string,
        startDate: string,
        scheduledDate: string,
        durationDays?: number,
      ): { label: string; startDay: number; endDay: number } | null {
        const start = new Date(startDate).getTime();
        const sched = new Date(scheduledDate).getTime();
        const msPerDay = 86400000;
        const elapsed = Math.max(0, Math.floor((sched - start) / msPerDay));
        const dur = durationDays ?? (planType === "pip" ? 30 : 90);
        const phaseCount = planType === "pip" ? 3 : 3;
        const phaseLen = Math.ceil(dur / phaseCount);
        const phaseIdx = Math.min(Math.floor(elapsed / phaseLen), phaseCount - 1);
        const phaseStart = phaseIdx * phaseLen + 1;
        const phaseEnd = Math.min((phaseIdx + 1) * phaseLen, dur);
        return { label: `Day ${phaseStart}–${phaseEnd}`, startDay: phaseStart, endDay: phaseEnd };
      }

      // Helper: find goals "in scope" for a given phase. A goal belongs to this phase
      // if its start_date offset (relative to plan start) falls within [startDay-1, endDay-1].
      // Goals without a start_date are shown only in the current/next upcoming phase.
      function goalsInPhase(
        goals: any[],
        startDate: string,
        phase: { startDay: number; endDay: number } | null,
      ): any[] {
        if (!phase) return goals;
        const msPerDay = 86400000;
        const planStart = new Date(startDate).getTime();
        return goals.filter(g => {
          if (!g.start_date) return phase.startDay === 1; // no-date goals only in first phase
          const gStart = new Date(g.start_date).getTime();
          const gDayOffset = Math.floor((gStart - planStart) / msPerDay);
          // phase.startDay and endDay are 1-indexed; offset is 0-indexed
          return gDayOffset >= (phase.startDay - 1) && gDayOffset < phase.endDay;
        });
      }

      const enrichedList = list.map(ci => {
        const emp = userMap.get(ci.employeeId);
        const mgr = ci.managerId ? userMap.get(ci.managerId) : null;
        const plan = ci.planId ? planMap.get(ci.planId) : null;
        const isProbation = plan?.planType === "probation";
        const milestoneDay = isProbation && ci.scheduledDate
          ? milestoneDayFor(plan!.startDate, String(ci.scheduledDate))
          : null;
        const milestoneLabel = milestoneDay != null ? probationMilestoneLabel(milestoneDay) : null;
        const isOverdue = ci.status !== "completed" && ci.status !== "cancelled"
          && !!ci.scheduledDate && String(ci.scheduledDate) < todayStr;

        // Build discussion context for this check-in
        let discussionContext: {
          planPhase: string | null;
          planType: string | null;
          goalsInScope: Array<{ id: string; title: string; progress: number; status: string; targetDate: string | null }>;
          overdueGoals: Array<{ id: string; title: string; targetDate: string; progress: number }>;
          previousActionItems: string | null;
        } | null = null;

        if (ci.planId && plan) {
          const allPlanGoals = planGoalMap.get(ci.planId) ?? [];
          const phase = ci.scheduledDate
            ? computePlanPhase(plan.planType, plan.startDate, String(ci.scheduledDate), plan.durationDays)
            : null;
          const scopeGoals = goalsInPhase(allPlanGoals, plan.startDate, phase);
          const overdueGoals = allPlanGoals.filter(
            g => g.target_date && g.target_date < todayStr && g.status !== "completed" && g.status !== "cancelled"
          );
          // Find most recent PREVIOUS check-in (completed before this one)
          const sortedPlanCheckIns = planCheckInsMap.get(ci.planId) ?? [];
          const prevCheckIn = sortedPlanCheckIns.find(c =>
            c.id !== ci.id && (!ci.scheduledDate || c.scheduled_date < String(ci.scheduledDate))
          );
          discussionContext = {
            planPhase: phase?.label ?? null,
            planType: plan.planType,
            goalsInScope: scopeGoals.map(g => ({
              id: String(g.id),
              title: String(g.title),
              progress: Number(g.progress ?? 0),
              status: String(g.status ?? "not_started"),
              targetDate: g.target_date ? String(g.target_date) : null,
            })),
            overdueGoals: overdueGoals.map(g => ({
              id: String(g.id),
              title: String(g.title),
              targetDate: String(g.target_date),
              progress: Number(g.progress ?? 0),
            })),
            previousActionItems: prevCheckIn?.action_items ? String(prevCheckIn.action_items) : null,
          };
        }

        return {
          ...ci,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          managerName: mgr ? `${mgr.firstName} ${mgr.lastName}` : "Unknown",
          planType: plan?.planType ?? null,
          planStartDate: plan?.startDate ?? null,
          isProbation,
          milestoneDay,
          milestoneLabel,
          requiresScores: milestoneDay != null,
          isOverdue,
          discussionContext,
        };
      });

      let teamMembers: { id: string; firstName: string; lastName: string; email: string }[] = [];
      if (isManagerRole) {
        if (ADMIN_ROLES.includes(role)) {
          teamMembers = allUsers
            .filter(u => u.isActive && u.id !== userId)
            .map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }));
        } else {
          const members = await storage.getTeamMembers(userId);
          teamMembers = members
            .filter(u => u.isActive)
            .map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }));
        }
      }

      res.json({ checkIns: enrichedList, teamMembers, userRole: role });
    } catch (error) {
      console.error("Error fetching check-ins:", error);
      res.status(500).json({ error: "Failed to fetch check-ins" });
    }
  });

  app.post("/api/performance/check-ins", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.checkIns.post", MANAGER_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const { employeeId, scheduledDate, employeeNotes, managerNotes, actionItems, goalId } = req.body;
      if (!employeeId || !scheduledDate) return res.status(400).json({ error: "Employee and scheduled date required" });

      const teamIds = await getAllReporteeIdsFromDb(userId);
      if (!teamIds.includes(employeeId) && !ADMIN_ROLES.includes(req.session.role!)) {
        return res.status(403).json({ error: "Cannot schedule check-in for this employee" });
      }

      // Validate optional goal link belongs to the employee being checked in.
      if (goalId) {
        const [goal] = await db.select().from(performanceGoals).where(eq(performanceGoals.id, goalId));
        if (!goal || goal.employeeId !== employeeId) {
          return res.status(400).json({ error: "Linked goal does not belong to this employee" });
        }
      }

      const [ci] = await db.insert(checkIns).values({
        employeeId,
        managerId: userId,
        scheduledDate,
        employeeNotes: employeeNotes || null,
        managerNotes: managerNotes || null,
        actionItems: actionItems || null,
        goalId: goalId || null,
      }).returning();

      await createAuditLog(userId, "check_in_created", { checkInId: ci.id, scheduledDate, goalId: goalId || undefined }, employeeId);

      // Send notification email to the employee (non-blocking)
      (async () => {
        try {
          const [employee] = await db.select({ firstName: adminUsers.firstName, email: adminUsers.email })
            .from(adminUsers).where(eq(adminUsers.id, employeeId));
          const [manager] = await db.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
            .from(adminUsers).where(eq(adminUsers.id, userId));
          if (employee?.email && manager) {
            await sendCheckInReminderEmail({
              to: employee.email,
              firstName: employee.firstName,
              scheduledDate,
              managerName: `${manager.firstName} ${manager.lastName}`,
              notes: managerNotes || undefined,
            });
          }
        } catch (emailErr) {
          console.error("Failed to send check-in notification email:", emailErr);
        }
      })();

      res.status(201).json(ci);
    } catch (error) {
      console.error("Error creating check-in:", error);
      res.status(500).json({ error: "Failed to create check-in" });
    }
  });

  app.patch("/api/performance/check-ins/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.checkIns.patch", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const [existing] = await db.select().from(checkIns).where(eq(checkIns.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Check-in not found" });

      if (existing.employeeId !== userId && existing.managerId !== userId && !ADMIN_ROLES.includes(req.session.role!)) {
        return res.status(403).json({ error: "Not authorized to update this check-in" });
      }

      const { status, employeeNotes, managerNotes, actionItems, rating, goalId, reviewScores } = req.body;
      const patchRole = req.session.role!;
      const updates: Partial<CheckIn> = { updatedAt: new Date() };

      // Gate probation completion — manager notes always required; a
      // Day 30/60/90 milestone additionally requires a valid weighted scorecard.
      if (status === "completed") {
        const gate = await enforceProbationCompletion({
          completing: true,
          planId: existing.planId,
          scheduledDate: String(existing.scheduledDate),
          incomingManagerNotes: managerNotes,
          existingManagerNotes: existing.managerNotes,
          incomingReviewScores: reviewScores,
          existingReviewScores: (existing as any).reviewScores,
        });
        if (gate.error) return res.status(400).json({ error: gate.error });
        if (gate.reviewScoresToPersist !== undefined) {
          updates.reviewScores = gate.reviewScoresToPersist as any;
        }

        // Hard gate (employee-only): block employee self-completion if the plan
        // has any goals past targetDate with no progress since they became overdue.
        // Manager close path is intentionally unaffected (managers may close even
        // with overdue goals so they can record outcomes and leave coaching notes).
        const isEmployeeSubmitter = existing.employeeId === userId && !ADMIN_ROLES.includes(patchRole) && patchRole !== "manager";
        if (isEmployeeSubmitter && existing.planId) {
          const todayForGate = new Date().toISOString().slice(0, 10);
          const blockingGoalsResult = await db.execute(sql`
            SELECT id, title, target_date, progress
            FROM performance_goals
            WHERE plan_id = ${existing.planId}
              AND employee_id = ${existing.employeeId}
              AND status NOT IN ('completed', 'cancelled')
              AND target_date IS NOT NULL
              AND target_date < ${todayForGate}
              AND (last_progress_updated_at IS NULL OR last_progress_updated_at::date <= target_date::date)
            ORDER BY target_date ASC
            LIMIT 10
          `);
          const blocking = blockingGoalsResult.rows as any[];
          if (blocking.length > 0) {
            return res.status(409).json({
              error: "overdue_goals_block",
              message: `You must log progress on ${blocking.length} overdue goal${blocking.length !== 1 ? "s" : ""} before marking this check-in complete.`,
              blockingGoals: blocking.map(g => ({
                id: String(g.id),
                title: String(g.title),
                targetDate: String(g.target_date),
                progress: Number(g.progress ?? 0),
              })),
            });
          }
        }
      }

      if (status !== undefined) {
        updates.status = status;
        if (status === "completed") updates.completedAt = new Date();
      }
      if (employeeNotes !== undefined) updates.employeeNotes = employeeNotes;
      if (managerNotes !== undefined) updates.managerNotes = managerNotes;
      if (actionItems !== undefined) updates.actionItems = actionItems;
      if (rating !== undefined) updates.rating = rating;
      if (reviewScores !== undefined && updates.reviewScores === undefined) {
        updates.reviewScores = reviewScores as any;
      }
      if (goalId !== undefined) {
        if (goalId) {
          const [goal] = await db.select().from(performanceGoals).where(eq(performanceGoals.id, goalId));
          if (!goal || goal.employeeId !== existing.employeeId) {
            return res.status(400).json({ error: "Linked goal does not belong to this employee" });
          }
        }
        updates.goalId = goalId || null;
      }

      const [updated] = await db.update(checkIns).set(updates).where(eq(checkIns.id, req.params.id)).returning();
      await createAuditLog(userId, "check_in_updated", { checkInId: req.params.id, changes: updates as Record<string, unknown> }, existing.employeeId);
      res.json(updated);
    } catch (error) {
      console.error("Error updating check-in:", error);
      res.status(500).json({ error: "Failed to update check-in" });
    }
  });

  // ==========================================
  // REVIEW CYCLES
  // ==========================================

  app.get("/api/performance/review-cycles", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.reviewCycles.get", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const cycles = await db.select().from(reviewCycles).orderBy(desc(reviewCycles.createdAt));
      res.json(cycles);
    } catch (error) {
      console.error("Error fetching review cycles:", error);
      res.status(500).json({ error: "Failed to fetch review cycles" });
    }
  });

  app.post("/api/performance/review-cycles", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.reviewCycles.post", ADMIN_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const { name, startDate, endDate, type } = req.body;
      if (!name || !startDate || !endDate) return res.status(400).json({ error: "Name, start date, and end date required" });

      const [cycle] = await db.insert(reviewCycles).values({
        name,
        startDate,
        endDate,
        type: type || "annual",
        createdBy: userId,
      }).returning();

      await createAuditLog(userId, "review_cycle_created", { cycleId: cycle.id, name });
      res.status(201).json(cycle);
    } catch (error) {
      console.error("Error creating review cycle:", error);
      res.status(500).json({ error: "Failed to create review cycle" });
    }
  });

  app.patch("/api/performance/review-cycles/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.reviewCycles.patch", ADMIN_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const [existing] = await db.select().from(reviewCycles).where(eq(reviewCycles.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Review cycle not found" });

      const { name, startDate, endDate, type, status } = req.body;
      const updates: Partial<ReviewCycle> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (startDate !== undefined) updates.startDate = startDate;
      if (endDate !== undefined) updates.endDate = endDate;
      if (type !== undefined) updates.type = type;
      if (status !== undefined) updates.status = status;

      const [updated] = await db.update(reviewCycles).set(updates).where(eq(reviewCycles.id, req.params.id)).returning();
      await createAuditLog(userId, "review_cycle_updated", { cycleId: req.params.id, changes: updates as Record<string, unknown> });
      res.json(updated);
    } catch (error) {
      console.error("Error updating review cycle:", error);
      res.status(500).json({ error: "Failed to update review cycle" });
    }
  });

  // ==========================================
  // REVIEWS
  // ==========================================

  app.get("/api/performance/reviews/my", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.reviews.my", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const cycleId = req.query.cycleId as string;
      const conditions = [eq(reviews.employeeId, userId)];
      if (cycleId) conditions.push(eq(reviews.cycleId, cycleId));

      const list = await db.select().from(reviews)
        .where(and(...conditions))
        .orderBy(desc(reviews.createdAt));
      res.json(list);
    } catch (error) {
      console.error("Error fetching my reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.get("/api/performance/reviews/team", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.reviews.team", MANAGER_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const cycleId = req.query.cycleId as string;
      const teamIds = await getAllReporteeIdsFromDb(userId);
      if (teamIds.length === 0) return res.json([]);

      const conditions = [inArray(reviews.employeeId, teamIds)];
      if (cycleId) conditions.push(eq(reviews.cycleId, cycleId));

      const list = await db.select().from(reviews)
        .where(and(...conditions))
        .orderBy(desc(reviews.createdAt));

      const employees = await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
        .from(adminUsers).where(inArray(adminUsers.id, teamIds));
      const empMap = Object.fromEntries(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));

      res.json(list.map(r => ({ ...r, employeeName: empMap[r.employeeId] || "Unknown" })));
    } catch (error) {
      console.error("Error fetching team reviews:", error);
      res.status(500).json({ error: "Failed to fetch team reviews" });
    }
  });

  app.get("/api/performance/reviews/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.reviews", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const [review] = await db.select().from(reviews).where(eq(reviews.id, req.params.id));
      if (!review) return res.status(404).json({ error: "Review not found" });

      if (review.employeeId !== userId && review.reviewerId !== userId && !ADMIN_ROLES.includes(req.session.role!)) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(review.employeeId)) {
          return res.status(403).json({ error: "Not authorized to view this review" });
        }
      }

      res.json(review);
    } catch (error) {
      console.error("Error fetching review:", error);
      res.status(500).json({ error: "Failed to fetch review" });
    }
  });

  app.post("/api/performance/reviews/self", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.reviews.self", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const { cycleId, goalsReflection, strengths, improvements, developmentNeeds, rating, comments } = req.body;
      if (!cycleId) return res.status(400).json({ error: "Cycle ID is required" });

      const [cycle] = await db.select().from(reviewCycles).where(eq(reviewCycles.id, cycleId));
      if (!cycle) return res.status(404).json({ error: "Review cycle not found" });
      if (cycle.status !== "active" && cycle.status !== "in_review") {
        return res.status(400).json({ error: "Review cycle is not accepting submissions" });
      }

      const [review] = await db.insert(reviews).values({
        cycleId,
        employeeId: userId,
        reviewerId: userId,
        type: "self",
        goalsReflection: goalsReflection || null,
        strengths: strengths || null,
        improvements: improvements || null,
        developmentNeeds: developmentNeeds || null,
        rating: rating || null,
        comments: comments || null,
        status: "submitted",
        submittedAt: new Date(),
      }).returning();

      await createAuditLog(userId, "self_review_submitted", { reviewId: review.id, cycleId });
      res.status(201).json(review);
    } catch (error) {
      console.error("Error submitting self-review:", error);
      res.status(500).json({ error: "Failed to submit self-review" });
    }
  });

  app.post("/api/performance/reviews/manager", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.reviews.manager", MANAGER_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const { cycleId, employeeId, goalsReflection, strengths, improvements, developmentNeeds, rating, comments } = req.body;
      if (!cycleId || !employeeId) return res.status(400).json({ error: "Cycle ID and employee ID required" });

      const teamIds = await getAllReporteeIdsFromDb(userId);
      if (!teamIds.includes(employeeId) && !ADMIN_ROLES.includes(req.session.role!)) {
        return res.status(403).json({ error: "Cannot review this employee" });
      }

      const [cycle] = await db.select().from(reviewCycles).where(eq(reviewCycles.id, cycleId));
      if (!cycle) return res.status(404).json({ error: "Review cycle not found" });
      if (cycle.status !== "active" && cycle.status !== "in_review") {
        return res.status(400).json({ error: "Review cycle is not accepting submissions" });
      }

      const [review] = await db.insert(reviews).values({
        cycleId,
        employeeId,
        reviewerId: userId,
        type: "manager",
        goalsReflection: goalsReflection || null,
        strengths: strengths || null,
        improvements: improvements || null,
        developmentNeeds: developmentNeeds || null,
        rating: rating || null,
        comments: comments || null,
        status: "submitted",
        submittedAt: new Date(),
      }).returning();

      await createAuditLog(userId, "manager_review_submitted", { reviewId: review.id, cycleId, employeeId }, employeeId);
      res.status(201).json(review);
    } catch (error) {
      console.error("Error submitting manager review:", error);
      res.status(500).json({ error: "Failed to submit manager review" });
    }
  });

  // ==========================================
  // FEEDBACK
  // ==========================================

  app.get("/api/performance/feedback/received", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.feedback.received", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const list = await db.select().from(performanceFeedback)
        .where(eq(performanceFeedback.toEmployeeId, userId))
        .orderBy(desc(performanceFeedback.createdAt));

      const fromIds = [...new Set(list.map(f => f.fromEmployeeId))];
      let nameMap: Record<string, string> = {};
      if (fromIds.length > 0) {
        const users = await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
          .from(adminUsers).where(inArray(adminUsers.id, fromIds));
        nameMap = Object.fromEntries(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
      }

      res.json(list.map(f => ({ ...f, fromName: nameMap[f.fromEmployeeId] || "Unknown" })));
    } catch (error) {
      console.error("Error fetching received feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.get("/api/performance/feedback/sent", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.feedback.sent", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const list = await db.select().from(performanceFeedback)
        .where(eq(performanceFeedback.fromEmployeeId, userId))
        .orderBy(desc(performanceFeedback.createdAt));

      const toIds = [...new Set(list.map(f => f.toEmployeeId))];
      let nameMap: Record<string, string> = {};
      if (toIds.length > 0) {
        const users = await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
          .from(adminUsers).where(inArray(adminUsers.id, toIds));
        nameMap = Object.fromEntries(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
      }

      res.json(list.map(f => ({ ...f, toName: nameMap[f.toEmployeeId] || "Unknown" })));
    } catch (error) {
      console.error("Error fetching sent feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.post("/api/performance/feedback", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.feedback", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const { toEmployeeId, type, message, goalId } = req.body;
      if (!toEmployeeId || !message) return res.status(400).json({ error: "Recipient and message required" });

      const [target] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.id, toEmployeeId));
      if (!target) return res.status(404).json({ error: "Recipient not found" });

      const [fb] = await db.insert(performanceFeedback).values({
        fromEmployeeId: userId,
        toEmployeeId,
        type: type || "general",
        message,
        goalId: goalId || null,
      }).returning();

      await createAuditLog(userId, "performance_feedback_created", { feedbackId: fb.id, type: fb.type }, toEmployeeId);
      res.status(201).json(fb);
    } catch (error) {
      console.error("Error creating feedback:", error);
      res.status(500).json({ error: "Failed to create feedback" });
    }
  });

  // ==========================================
  // EMPLOYEES (for feedback recipient picker)
  // ==========================================

  // Returns a minimal list of active employees accessible to all performance module users
  app.get("/api/performance/employees", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.employees", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const users = await storage.getAdminUsers();
      const list = users
        .filter(u => u.isActive && u.id !== userId)
        .map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }));
      res.json(list);
    } catch (error) {
      console.error("Error fetching performance employees:", error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  // ==========================================
  // ALERTS (badge counts)
  // ==========================================

  app.get("/api/performance/my-alerts", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const role = req.session.role!;
      if (!(await isFeatureEnabledOrAdmin(role))) {
        return res.json({ pendingSelfReviews: 0, upcomingCheckIns: 0, total: 0 });
      }

      const activeCycles = await db.select({ id: reviewCycles.id })
        .from(reviewCycles)
        .where(or(eq(reviewCycles.status, "active"), eq(reviewCycles.status, "in_review")));

      let pendingSelfReviews = 0;
      if (activeCycles.length > 0) {
        const cycleIds = activeCycles.map(c => c.id);
        const existingSelfReviews = await db.select({ cycleId: reviews.cycleId })
          .from(reviews)
          .where(and(
            eq(reviews.employeeId, userId),
            eq(reviews.type, "self"),
            inArray(reviews.cycleId, cycleIds)
          ));
        const submittedCycleIds = new Set(existingSelfReviews.map(r => r.cycleId));
        pendingSelfReviews = cycleIds.filter(id => !submittedCycleIds.has(id)).length;
      }

      const today = new Date().toISOString().split("T")[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const upcomingCheckInsResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(checkIns)
        .where(and(
          eq(checkIns.employeeId, userId),
          eq(checkIns.status, "scheduled"),
          sql`${checkIns.scheduledDate} >= ${today}`,
          sql`${checkIns.scheduledDate} <= ${weekFromNow}`
        ));

      const upcomingCheckIns = upcomingCheckInsResult[0]?.count || 0;

      res.json({
        pendingSelfReviews,
        upcomingCheckIns,
        total: pendingSelfReviews + upcomingCheckIns,
      });
    } catch (error) {
      console.error("Error fetching performance alerts:", error);
      res.json({ pendingSelfReviews: 0, upcomingCheckIns: 0, total: 0 });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTHCARE PLAN GOAL TEMPLATES API
  // ═══════════════════════════════════════════════════════════════════════════

  // Returns distinct (plan_type, role_slug) combinations for active templates in a given dept.
  // Used by the frontend Load-from-Template dialog to build a DB-driven role dropdown.
  app.get("/api/hr/plan-templates/meta", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.planTemplates.meta", MANAGER_ROLES);
    if (!userId) return;
    try {
      const { department_scope } = req.query as { department_scope?: string };
      const deptFilter = department_scope
        ? sql`WHERE is_active = true AND department_scope = ${department_scope}::employee_plan_dept_scope`
        : sql`WHERE is_active = true`;
      const r = await db.execute(sql`
        SELECT DISTINCT plan_type::text, role_slug, department_scope::text
        FROM plan_goal_templates
        ${deptFilter}
        ORDER BY plan_type, role_slug
      `);
      res.json(r.rows);
    } catch (error) {
      console.error("Error fetching plan-templates meta:", error);
      res.status(500).json({ error: "Failed to fetch template metadata" });
    }
  });

  app.get("/api/hr/plan-templates", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.planTemplates.get", MANAGER_ROLES);
    if (!userId) return;
    try {
      const { plan_type, role_slug, department_scope, active_only } = req.query as {
        plan_type?: string; role_slug?: string; department_scope?: string; active_only?: string;
      };
      // Default to active-only; pass active_only=false to include inactive (HR admin use)
      const onlyActive = active_only !== "false";

      // Build WHERE clauses dynamically using safe parameterized fragments
      const conditions: ReturnType<typeof sql>[] = [];
      if (onlyActive) conditions.push(sql`is_active = true`);
      if (plan_type) conditions.push(sql`plan_type = ${plan_type}::employee_plan_type`);
      if (role_slug) conditions.push(sql`role_slug = ${role_slug}`);
      if (department_scope) conditions.push(sql`department_scope = ${department_scope}::employee_plan_dept_scope`);

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const r = await db.execute(sql`SELECT * FROM plan_goal_templates ${whereClause} ORDER BY plan_type, role_slug, sort_order ASC`);
      res.json(r.rows);
    } catch (error) {
      console.error("Error fetching plan templates:", error);
      res.status(500).json({ error: "Failed to fetch plan templates" });
    }
  });

  app.post("/api/hr/plan-templates", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.planTemplates.post", ADMIN_ROLES);
    if (!userId) return;
    try {
      const { plan_type, role_slug, goal_title, goal_category, goal_description, target_metric, sort_order,
        department, role, level, weight, milestone, is_universal, department_scope } = req.body;
      if (!plan_type || !role_slug || !goal_title) return res.status(400).json({ error: "plan_type, role_slug, and goal_title are required" });
      const result = await db.execute(sql`
        INSERT INTO plan_goal_templates (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active,
          department, role, level, weight, milestone, is_universal)
        VALUES (${plan_type}::employee_plan_type, ${role_slug}, ${(department_scope || "healthcare")}::employee_plan_dept_scope, ${goal_title}, ${goal_category || "individual"}, ${goal_description || null}, ${target_metric || null}, ${sort_order ?? 0}, true,
          ${department ?? null}, ${role ?? null}, ${level ?? null}, ${weight ?? null}, ${milestone ?? null}, ${is_universal ?? false})
        RETURNING *
      `);
      await createAuditLog(userId, "plan_template_created", { goal_title, plan_type, role_slug });
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating plan template:", error);
      res.status(500).json({ error: "Failed to create plan template" });
    }
  });

  app.patch("/api/hr/plan-templates/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.planTemplates.patch", ADMIN_ROLES);
    if (!userId) return;
    try {
      const body = req.body ?? {};
      const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
      const sets: any[] = [];
      // Content fields: only overwrite when a non-null value is supplied (preserve existing on null/absent).
      if (body.goal_title != null) sets.push(sql`goal_title = ${body.goal_title}`);
      if (body.goal_description != null) sets.push(sql`goal_description = ${body.goal_description}`);
      if (body.target_metric != null) sets.push(sql`target_metric = ${body.target_metric}`);
      if (body.goal_category != null) sets.push(sql`goal_category = ${body.goal_category}`);
      if (body.sort_order != null) sets.push(sql`sort_order = ${body.sort_order}`);
      if (body.is_active != null) sets.push(sql`is_active = ${body.is_active}`);
      if (body.is_universal != null) sets.push(sql`is_universal = ${body.is_universal}`);
      // Matrix-key fields: honor explicit null so admins can unset department/role/level/weight/milestone.
      if (has("department")) sets.push(sql`department = ${body.department ?? null}`);
      if (has("role")) sets.push(sql`role = ${body.role ?? null}`);
      if (has("level")) sets.push(sql`level = ${body.level ?? null}`);
      if (has("weight")) sets.push(sql`weight = ${body.weight ?? null}`);
      if (has("milestone")) sets.push(sql`milestone = ${body.milestone ?? null}`);
      if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });
      sets.push(sql`updated_at = NOW()`);
      const result = await db.execute(sql`
        UPDATE plan_goal_templates SET ${sql.join(sets, sql`, `)}
        WHERE id = ${req.params.id}
        RETURNING *
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Template not found" });
      await createAuditLog(userId, "plan_template_updated", { id: req.params.id, changes: req.body });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating plan template:", error);
      res.status(500).json({ error: "Failed to update plan template" });
    }
  });

  app.delete("/api/hr/plan-templates/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.planTemplates.delete", ADMIN_ROLES);
    if (!userId) return;
    try {
      await db.execute(sql`DELETE FROM plan_goal_templates WHERE id = ${req.params.id}`);
      await createAuditLog(userId, "plan_template_deleted", { id: req.params.id });
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting plan template:", error);
      res.status(500).json({ error: "Failed to delete plan template" });
    }
  });

  // Probation scoring bands + pass-rule (read-only reference for HR/admin UI)
  app.get("/api/hr/probation-scoring-bands", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.planTemplates.get", MANAGER_ROLES);
    if (!userId) return;
    try {
      const bands = await db.execute(sql`
        SELECT * FROM probation_scoring_bands
        WHERE is_active = true
        ORDER BY sort_order ASC, min_score DESC
      `);

      // probation_framework_db flag (default ON via `!== false`): when ON, the
      // pass rule + Day-90 final weights are read from their dedicated DB tables;
      // when OFF (revert), they come from the legacy system_settings JSON. The DB
      // path also falls back to JSON defensively if the tables are unexpectedly
      // empty, so the response shape is identical either way.
      const flagRow = await db.execute(sql`SELECT value FROM system_settings WHERE key = 'feature_flags' LIMIT 1`);
      const rawFlags = (flagRow.rows[0] as any)?.value;
      let flags: Record<string, any> = {};
      if (typeof rawFlags === "string") { try { flags = JSON.parse(rawFlags); } catch { flags = {}; } }
      else if (rawFlags && typeof rawFlags === "object") { flags = rawFlags; }
      const useDb = flags.probation_framework_db !== false;

      let passRule: any = null;
      let finalWeights: any = null;

      if (useDb) {
        const wr = await db.execute(sql`
          SELECT area, weight FROM probation_final_weights WHERE is_active = true ORDER BY sort_order ASC
        `);
        const pr = await db.execute(sql`
          SELECT rule FROM probation_pass_rule WHERE is_active = true ORDER BY updated_at DESC LIMIT 1
        `);
        if (wr.rows.length > 0) finalWeights = (wr.rows as any[]).map(r => ({ area: r.area, weight: Number(r.weight) }));
        if (pr.rows.length > 0) passRule = (pr.rows[0] as any).rule;
      }

      // Legacy JSON path: used when the flag is OFF, or as a defensive fallback
      // when the DB tables are empty.
      if (passRule == null || finalWeights == null) {
        const settings = await db.execute(sql`
          SELECT key, value FROM system_settings
          WHERE key IN ('probation_pass_rule', 'probation_final_weights')
        `);
        const settingsMap: Record<string, any> = {};
        for (const row of settings.rows as any[]) {
          try { settingsMap[row.key] = JSON.parse(row.value); }
          catch { settingsMap[row.key] = row.value; }
        }
        if (passRule == null) passRule = settingsMap["probation_pass_rule"] ?? null;
        if (finalWeights == null) finalWeights = settingsMap["probation_final_weights"] ?? null;
      }

      res.json({
        bands: bands.rows,
        passRule: passRule ?? null,
        finalWeights: finalWeights ?? null,
        source: useDb ? "db" : "json",
      });
    } catch (error) {
      console.error("Error fetching probation scoring bands:", error);
      res.status(500).json({ error: "Failed to fetch probation scoring bands" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPLOYEE PLANS (Probation / Growth / PIP) CRUD API
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/hr/plans", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.plans.post", MANAGER_ROLES);
    if (!userId) return;
    try {
      const { employee_id, plan_type, start_date, end_date, duration_days, manager_id, role_slug } = req.body;

      // ── Validate ALL inputs before any DB writes ──────────────────────────
      if (!employee_id || !plan_type || !start_date || !end_date || !duration_days) {
        return res.status(400).json({ error: "employee_id, plan_type, start_date, end_date, duration_days are required" });
      }
      // role_slug is required to seed Growth/PIP goals. Probation derives its
      // goals from the employee's department/role/level via the framework resolver.
      if (!role_slug && plan_type !== "probation") {
        return res.status(400).json({ error: "role_slug is required to auto-seed goals from plan templates" });
      }

      // Verify employee exists
      const empResult = await db.execute(sql`
        SELECT au.id, au.designation, d.name as department_name FROM admin_users au
        LEFT JOIN departments d ON au.department_id = d.id
        WHERE au.id = ${employee_id}
      `);
      const empRow = empResult.rows[0] as { id: string; designation: string | null; department_name: string | null } | undefined;
      if (!empRow) return res.status(404).json({ error: "Employee not found" });

      // Managers can only create plans for their direct reports; admins/hr are unrestricted
      const planCreatorRole = req.session.role!;
      if (!ADMIN_ROLES.includes(planCreatorRole)) {
        const creatorTeamIds = await getAllReporteeIdsFromDb(userId);
        if (!creatorTeamIds.includes(employee_id)) {
          return res.status(403).json({ error: "Not authorized to create plans for this employee" });
        }
      }

      // Only Growth and PIP plans are Healthcare-restricted; Probation is open to all departments
      if (plan_type !== "probation") {
        const deptName = (empRow.department_name || "").toLowerCase();
        if (!deptName.includes("healthcare") && !deptName.includes("health care")) {
          return res.status(400).json({ error: "Growth and PIP plans are restricted to Healthcare department employees" });
        }
      }

      // custom_goals: optional array of { title, description, category } from the manager-edited step-2 form
      const custom_goals: { title: string; description?: string; category?: string }[] | undefined = req.body.custom_goals;
      const useCustomGoals = Array.isArray(custom_goals) && custom_goals.length > 0;

      // Resolve the goals to pre-fill (skipped when manager supplied custom goals).
      // Probation uses the cross-department framework resolver (universal goals +
      // best-matching role/level milestone goals); Growth/PIP use legacy templates.
      let planTemplates: PlanGoalTemplate[] = [];
      let resolvedProbationGoals: { title: string; description: string | null; category: string }[] = [];
      if (!useCustomGoals) {
        if (plan_type === "probation") {
          const { parseProbationKey, resolveProbationGoalTemplates } = await import("./probationTemplates");
          const probationKey = parseProbationKey(empRow.designation, empRow.department_name);
          const resolved = await resolveProbationGoalTemplates(probationKey, role_slug || null);
          resolvedProbationGoals = resolved.map(g => ({ title: g.title, description: g.description, category: g.category }));
          if (resolvedProbationGoals.length === 0) {
            return res.status(400).json({
              error: "No probation templates resolved for this employee's department/role/level. Cannot create a zero-goal plan.",
            });
          }
        } else {
          const tmplResult = await db.execute(sql`
            SELECT * FROM plan_goal_templates
            WHERE plan_type = ${plan_type}::employee_plan_type
              AND role_slug = ${role_slug}
              AND is_active = true
            ORDER BY sort_order ASC
          `);
          planTemplates = tmplResult.rows as PlanGoalTemplate[];
          if (planTemplates.length === 0) {
            return res.status(400).json({
              error: `No active templates found for plan_type="${plan_type}" and role_slug="${role_slug}". Cannot create a zero-goal plan.`,
            });
          }
        }
      }

      // ── All validation passed — now execute writes ────────────────────────
      const result = await db.execute(sql`
        INSERT INTO employee_plans (employee_id, manager_id, plan_type, department_scope, status, start_date, end_date, duration_days, created_by)
        VALUES (${employee_id}, ${manager_id || null}, ${plan_type}::employee_plan_type, 'healthcare'::employee_plan_dept_scope, 'pending'::employee_plan_status, ${start_date}, ${end_date}, ${duration_days}, ${userId})
        RETURNING *
      `);
      const plan = result.rows[0] as EmployeePlan;

      // Generate check-in schedule
      const directCadenceOpts = await fetchPlanCadenceSettings();
      const checkInSchedule = generatePlanCheckIns(
        plan.id, employee_id, manager_id || null, plan_type, start_date, end_date,
        directCadenceOpts,
      );
      for (const ci of checkInSchedule) {
        await db.execute(sql`
          INSERT INTO check_ins (employee_id, manager_id, plan_id, check_in_type, scheduled_date, status)
          VALUES (${ci.employeeId}, ${ci.managerId}, ${ci.planId}, ${ci.checkInType}::check_in_type, ${ci.scheduledDate}, 'scheduled'::check_in_status)
        `);
      }

      // Seed goals: use custom goals if provided by manager, otherwise seed from templates
      let goalsCreated: number;
      if (useCustomGoals) {
        const sourceRef = `plan:${plan.id}`;
        for (const g of custom_goals!) {
          if (!g.title?.trim()) continue;
          await db.execute(sql`
            INSERT INTO performance_goals
              (employee_id, manager_id, title, description, category, plan_id, source_ref, start_date, target_date, weight)
            VALUES
              (${employee_id}, ${manager_id || null}, ${g.title.trim()}, ${g.description?.trim() ?? null},
               ${normalizeGoalCategory(g.category)}, ${plan.id}, ${sourceRef}, ${start_date}, ${end_date}, 3)
          `);
        }
        goalsCreated = custom_goals!.filter(g => g.title?.trim()).length;
      } else if (plan_type === "probation") {
        const sourceRef = `plan:${plan.id}`;
        for (const g of resolvedProbationGoals) {
          if (!g.title?.trim()) continue;
          await db.execute(sql`
            INSERT INTO performance_goals
              (employee_id, manager_id, title, description, category, plan_id, source_ref, start_date, target_date, weight)
            VALUES
              (${employee_id}, ${manager_id || null}, ${g.title.trim()}, ${g.description ?? null},
               ${normalizeGoalCategory(g.category)}, ${plan.id}, ${sourceRef}, ${start_date}, ${end_date}, 3)
          `);
        }
        goalsCreated = resolvedProbationGoals.filter(g => g.title?.trim()).length;
      } else {
        goalsCreated = await insertPlanGoalsFromTemplates(
          plan.id, employee_id, manager_id || null, start_date, end_date, planTemplates,
        );
      }

      await createAuditLog(userId, "employee_plan_created", { planId: plan.id, plan_type, employee_id }, employee_id);

      // Step 1: brief the owning manager (idempotent, probation-only, flag-gated).
      await briefManagerOnce(plan.id);

      res.status(201).json({ plan, checkInsScheduled: checkInSchedule.length, goalsCreated });
    } catch (error) {
      console.error("Error creating employee plan:", error);
      res.status(500).json({ error: "Failed to create employee plan" });
    }
  });

  app.get("/api/hr/plans", async (req: Request, res: Response) => {
    // Employees can list their own plans; managers/admin see their scope
    const userId = requirePermission(req, res, "hr.plans.get", ALL_ROLES);
    if (!userId) return;
    try {
      const { employee_id, plan_type, status, department_scope } = req.query as {
        employee_id?: string; plan_type?: string; status?: string; department_scope?: string;
      };
      const role = req.session.role!;

      // Build base WHERE conditions
      const buildConditions = (empIdClause: ReturnType<typeof sql>) => {
        const conds: ReturnType<typeof sql>[] = [empIdClause];
        if (plan_type) conds.push(sql`ep.plan_type = ${plan_type}::employee_plan_type`);
        if (status) conds.push(sql`ep.status = ${status}::employee_plan_status`);
        if (department_scope) conds.push(sql`ep.department_scope = ${department_scope}::employee_plan_dept_scope`);
        return sql.join(conds, sql` AND `);
      };

      let rows: EmployeePlan[];

      if (ADMIN_ROLES.includes(role)) {
        // Admin/HR: see all plans, optionally filtered by employee_id
        const where = employee_id
          ? buildConditions(sql`ep.employee_id = ${employee_id}`)
          : (plan_type || status || department_scope
            ? buildConditions(sql`TRUE`)
            : sql`TRUE`);
        const r = await db.execute(sql`
          SELECT ep.*,
            (au.first_name || ' ' || au.last_name) AS employee_name,
            (m.first_name || ' ' || m.last_name) AS manager_name,
            d.name AS department_name,
            (SELECT COUNT(*) FROM check_ins ci WHERE ci.plan_id = ep.id AND ci.status = 'completed')::int AS completed_checkins,
            (SELECT COUNT(*) FROM check_ins ci WHERE ci.plan_id = ep.id)::int AS total_checkins,
            (SELECT COUNT(*) FROM performance_goals pg WHERE pg.plan_id = ep.id)::int AS goals_count
          FROM employee_plans ep
          LEFT JOIN admin_users au ON ep.employee_id = au.id
          LEFT JOIN admin_users m ON ep.manager_id = m.id
          LEFT JOIN departments d ON au.department_id = d.id
          WHERE ${where}
          ORDER BY ep.created_at DESC
          LIMIT 200
        `);
        rows = r.rows as EmployeePlan[];
      } else if (role === "employee") {
        // Employees can only see their own plans
        const where = buildConditions(sql`ep.employee_id = ${userId}`);
        const r = await db.execute(sql`
          SELECT ep.*,
            (au.first_name || ' ' || au.last_name) AS employee_name,
            (m.first_name || ' ' || m.last_name) AS manager_name,
            (SELECT COUNT(*) FROM performance_goals pg WHERE pg.plan_id = ep.id)::int AS goals_count
          FROM employee_plans ep
          LEFT JOIN admin_users au ON ep.employee_id = au.id
          LEFT JOIN admin_users m ON ep.manager_id = m.id
          WHERE ${where} ORDER BY ep.created_at DESC
        `);
        rows = r.rows as EmployeePlan[];
      } else {
        // Manager: see plans for their direct reports; if employee_id specified, verify team membership
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (teamIds.length === 0) { rows = []; }
        else if (employee_id) {
          if (!teamIds.includes(employee_id)) {
            return res.status(403).json({ error: "Not authorized to view plans for this employee" });
          }
          const where = buildConditions(sql`ep.employee_id = ${employee_id}`);
          const r = await db.execute(sql`
            SELECT ep.*,
              (au.first_name || ' ' || au.last_name) AS employee_name,
              (m.first_name || ' ' || m.last_name) AS manager_name,
              (SELECT COUNT(*) FROM performance_goals pg WHERE pg.plan_id = ep.id)::int AS goals_count
            FROM employee_plans ep
            LEFT JOIN admin_users au ON ep.employee_id = au.id
            LEFT JOIN admin_users m ON ep.manager_id = m.id
            WHERE ${where} ORDER BY ep.created_at DESC
          `);
          rows = r.rows as EmployeePlan[];
        } else {
          const idList = sql.join(teamIds.map(id => sql`${id}`), sql`, `);
          const where = buildConditions(sql`ep.employee_id IN (${idList})`);
          const r = await db.execute(sql`
            SELECT ep.*,
              (au.first_name || ' ' || au.last_name) AS employee_name,
              (m.first_name || ' ' || m.last_name) AS manager_name,
              (SELECT COUNT(*) FROM performance_goals pg WHERE pg.plan_id = ep.id)::int AS goals_count
            FROM employee_plans ep
            LEFT JOIN admin_users au ON ep.employee_id = au.id
            LEFT JOIN admin_users m ON ep.manager_id = m.id
            WHERE ${where} ORDER BY ep.created_at DESC
          `);
          rows = r.rows as EmployeePlan[];
        }
      }
      res.json(rows);
    } catch (error) {
      console.error("Error fetching employee plans:", error);
      res.status(500).json({ error: "Failed to fetch employee plans" });
    }
  });

  app.get("/api/hr/plans/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.plans.get", ALL_ROLES);
    if (!userId) return;
    try {
      const result = await db.execute(sql`
        SELECT ep.*, au.full_name as employee_name, m.full_name as manager_name
        FROM employee_plans ep
        LEFT JOIN admin_users au ON ep.employee_id = au.id
        LEFT JOIN admin_users m ON ep.manager_id = m.id
        WHERE ep.id = ${req.params.id}
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
      const plan = result.rows[0] as EmployeePlan;
      const role = req.session.role!;
      if (!ADMIN_ROLES.includes(role)) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(plan.employee_id) && plan.employee_id !== userId) {
          return res.status(403).json({ error: "Not authorized to view this plan" });
        }
      }
      // Also return associated check-ins, goals, coaching-log entries, and meeting summary
      const checkInsResult = await db.execute(sql`SELECT * FROM check_ins WHERE plan_id = ${req.params.id} ORDER BY scheduled_date ASC`);
      const goalsResult = await db.execute(sql`SELECT * FROM performance_goals WHERE plan_id = ${req.params.id} ORDER BY start_date ASC NULLS LAST, target_date ASC NULLS LAST`);
      const coachingLogResult = await db.execute(sql`
        SELECT cl.*, a.first_name || ' ' || a.last_name AS author_name
        FROM coaching_log_entries cl
        LEFT JOIN admin_users a ON cl.author_id = a.id
        WHERE cl.plan_id = ${req.params.id}
        ORDER BY cl.entry_date DESC, cl.created_at DESC
      `);
      const meetingSummaryResult = await db.execute(sql`
        SELECT COUNT(*)::int AS meeting_count, MAX(meeting_date) AS last_meeting_date
        FROM plan_meetings
        WHERE plan_id = ${req.params.id} AND deleted_at IS NULL
      `);
      const meetingSummary = (meetingSummaryResult.rows[0] as any) ?? { meeting_count: 0, last_meeting_date: null };
      res.json({
        plan,
        checkIns: checkInsResult.rows,
        goals: goalsResult.rows,
        coachingLog: coachingLogResult.rows,
        meetingCount: meetingSummary.meeting_count ?? 0,
        lastMeetingDate: meetingSummary.last_meeting_date ?? null,
      });
    } catch (error) {
      console.error("Error fetching employee plan:", error);
      res.status(500).json({ error: "Failed to fetch employee plan" });
    }
  });

  app.patch("/api/hr/plans/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.plans.patch", MANAGER_ROLES);
    if (!userId) return;
    try {
      // Fetch plan first to enforce object-level authorization
      const existingResult = await db.execute(sql`SELECT * FROM employee_plans WHERE id = ${req.params.id}`);
      if (existingResult.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
      const existingPlan = existingResult.rows[0] as EmployeePlan;
      const patchRole = req.session.role!;
      if (!ADMIN_ROLES.includes(patchRole)) {
        const patchTeamIds = await getAllReporteeIdsFromDb(userId);
        if (!patchTeamIds.includes(existingPlan.employee_id)) {
          return res.status(403).json({ error: "Not authorized to update this plan" });
        }
      }

      const { status, outcome, end_date } = req.body;
      // Data-hygiene guard (mirrors ck_employee_plans_nonpending_has_employee):
      // a plan may only be NULL-employee while 'pending' (offer-seeded placeholder).
      // Block transitioning such a placeholder to a non-pending status with a clear
      // 400 instead of letting it surface as a 500 CHECK violation.
      if (status && status !== "pending" && !existingPlan.employee_id) {
        return res.status(400).json({ error: "Cannot activate or close a plan that has no employee assigned. This plan is an unfilled offer placeholder." });
      }
      const result = await db.execute(sql`
        UPDATE employee_plans SET
          status = COALESCE(${status ?? null}::employee_plan_status, status),
          outcome = COALESCE(${outcome ?? null}::employee_plan_outcome, outcome),
          end_date = COALESCE(${end_date ?? null}, end_date),
          updated_at = NOW()
        WHERE id = ${req.params.id}
        RETURNING *
      `);
      await createAuditLog(userId, "employee_plan_updated", { planId: req.params.id, changes: req.body });

      const updatedPlan = result.rows[0] as EmployeePlan;

      // Notification: plan status changed to active
      if (status === "active" && existingPlan.status !== "active") {
        const planLabel = updatedPlan.plan_type === "pip" ? "Performance Improvement Plan" : updatedPlan.plan_type === "probation" ? "Probation Plan" : "Growth Plan";
        await notifyPlan(updatedPlan.employee_id, "plan_activated",
          `Your ${planLabel} is now active`,
          `Your ${planLabel} has been activated and is now in progress.`,
          { planId: updatedPlan.id, planType: updatedPlan.plan_type },
        );
        // Step 1: ensure the owning manager has been briefed (idempotent).
        await briefManagerOnce(updatedPlan.id);
      }

      // Notification: plan closed with outcome
      if (status === "closed" && outcome) {
        const planLabel = updatedPlan.plan_type === "pip" ? "Performance Improvement Plan" : updatedPlan.plan_type === "probation" ? "Probation Plan" : "Growth Plan";
        await notifyPlan(updatedPlan.employee_id, "plan_closed",
          `Your ${planLabel} has been closed`,
          `Your plan has been closed with outcome: ${outcome}.`,
          { planId: updatedPlan.id, planType: updatedPlan.plan_type, outcome },
        );
        // Notify all HR/admin users (excluding the person who performed the action)
        const hrIds = await getHrAdminIds();
        const empResult = await db.execute(sql`SELECT first_name || ' ' || last_name AS name FROM admin_users WHERE id = ${updatedPlan.employee_id}`);
        const empName = (empResult.rows[0] as any)?.name || "An employee";
        for (const hrId of hrIds) {
          if (hrId === userId) continue;
          await notifyPlan(hrId, "plan_closed",
            `Plan closed: ${empName}`,
            `${empName}'s ${updatedPlan.plan_type} plan has been closed with outcome: ${outcome}.`,
            { planId: updatedPlan.id, planType: updatedPlan.plan_type, outcome, employeeId: updatedPlan.employee_id },
          );
        }
      }

      res.json(updatedPlan);
    } catch (error) {
      console.error("Error updating employee plan:", error);
      res.status(500).json({ error: "Failed to update employee plan" });
    }
  });

  // ─── Complete a plan check-in (manager action) ────────────────────────────
  // Supports PIP weekly review (reviewScores JSONB) and standard (rating/notes)
  app.patch("/api/hr/check-ins/:id", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.checkIns", MANAGER_ROLES);
    if (!userId) return;
    try {
      const ciResult = await db.execute(sql`SELECT * FROM check_ins WHERE id = ${req.params.id}`);
      if (ciResult.rows.length === 0) return res.status(404).json({ error: "Check-in not found" });
      const ci = ciResult.rows[0] as any;

      // Auth: manager must own the check-in or be admin/hr
      const patchRole = req.session.role!;
      if (!ADMIN_ROLES.includes(patchRole)) {
        if (ci.manager_id !== userId) {
          const teamIds = await getAllReporteeIdsFromDb(userId);
          if (!teamIds.includes(ci.employee_id)) {
            return res.status(403).json({ error: "Not authorized to update this check-in" });
          }
        }
      }

      const { status, managerNotes, rating, reviewScores, goalProgressNotes } = req.body;

      // Step 5: gate probation completion (manager notes + milestone scorecard).
      let scoresToPersist: any = reviewScores ?? null;
      if (status === "completed") {
        const gate = await enforceProbationCompletion({
          completing: true,
          planId: ci.plan_id,
          scheduledDate: String(ci.scheduled_date),
          incomingManagerNotes: managerNotes,
          existingManagerNotes: ci.manager_notes,
          incomingReviewScores: reviewScores,
          existingReviewScores: ci.review_scores,
        });
        if (gate.error) return res.status(400).json({ error: gate.error });
        if (gate.reviewScoresToPersist !== undefined && gate.reviewScoresToPersist !== null) {
          scoresToPersist = gate.reviewScoresToPersist;
        }
      }

      // Serialize goalProgressNotes as JSON into action_items when provided
      const actionItemsValue = goalProgressNotes && Object.keys(goalProgressNotes).length > 0
        ? JSON.stringify({ goalProgressNotes })
        : null;

      await db.execute(sql`
        UPDATE check_ins SET
          status = COALESCE(${status ?? null}::check_in_status, status),
          manager_notes = COALESCE(${managerNotes ?? null}, manager_notes),
          rating = COALESCE(${rating ?? null}, rating),
          review_scores = CASE
            WHEN ${scoresToPersist != null} THEN ${scoresToPersist != null ? JSON.stringify(scoresToPersist) : null}::jsonb
            ELSE review_scores
          END,
          action_items = CASE
            WHEN ${actionItemsValue != null} THEN ${actionItemsValue}
            ELSE action_items
          END,
          completed_at = CASE WHEN ${status === "completed"} THEN NOW() ELSE completed_at END,
          updated_at = NOW()
        WHERE id = ${req.params.id}
        RETURNING *
      `);

      await createAuditLog(userId, "plan_check_in_completed", { checkInId: req.params.id, planId: ci.plan_id ?? undefined }, ci.employee_id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error completing check-in:", error);
      res.status(500).json({ error: "Failed to complete check-in" });
    }
  });

  app.post("/api/hr/plans/:id/acknowledge", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.plans.acknowledge", ALL_ROLES);
    if (!userId) return;
    try {
      const { typed_name } = req.body as { typed_name?: string };

      // Fetch plan and verify ownership before any mutation
      const planCheck = await db.execute(sql`
        SELECT ep.*, au.first_name || ' ' || au.last_name AS employee_full_name
        FROM employee_plans ep
        JOIN admin_users au ON ep.employee_id = au.id
        WHERE ep.id = ${req.params.id} AND ep.employee_id = ${userId}
      `);
      if (planCheck.rows.length === 0) return res.status(404).json({ error: "Plan not found or not your plan" });
      const prePlan = planCheck.rows[0] as any;

      // PIP plans require a valid typed full name for digital acknowledgement evidence
      if (prePlan.plan_type === "pip") {
        const expectedName = (prePlan.employee_full_name as string || "").trim();
        if (!typed_name || typed_name.trim() !== expectedName) {
          return res.status(422).json({
            error: "Name verification failed. Please enter your full name exactly as it appears in your profile.",
          });
        }
      }

      const result = await db.execute(sql`
        UPDATE employee_plans SET
          acknowledged_at = NOW(),
          acknowledged_by = ${userId},
          acknowledged_name = ${typed_name?.trim() ?? null},
          status = CASE WHEN status = 'pending' THEN 'active'::employee_plan_status ELSE status END,
          updated_at = NOW()
        WHERE id = ${req.params.id} AND employee_id = ${userId}
        RETURNING *
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Plan not found or not your plan" });
      const acknowledgedPlan = result.rows[0] as EmployeePlan;

      // Insert durable acknowledgement evidence record (mirrors section_acknowledgements pattern)
      // This gives HR/audit a tamper-evident row with typed name, timestamp, and IP
      await db.execute(sql`
        INSERT INTO plan_acknowledgements (plan_id, user_id, plan_type, typed_name, ip_address)
        VALUES (
          ${req.params.id},
          ${userId},
          ${prePlan.plan_type},
          ${typed_name?.trim() ?? ""},
          ${req.ip ?? null}
        )
      `);

      await createAuditLog(userId, "employee_plan_acknowledged", { planId: req.params.id, typedName: typed_name?.trim() });

      // Step 1: ensure the owning manager has been briefed now the plan is active.
      await briefManagerOnce(acknowledgedPlan.id);

      // Fire notifications for plan acknowledgement
      const planLabel = acknowledgedPlan.plan_type === "pip" ? "Performance Improvement Plan" : acknowledgedPlan.plan_type === "probation" ? "Probation Plan" : "Growth Plan";
      // Employee: plan is now active
      await notifyPlan(userId, "plan_activated",
        `Your ${planLabel} is now active`,
        `You have acknowledged the plan. It is now active and in progress.`,
        { planId: acknowledgedPlan.id, planType: acknowledgedPlan.plan_type },
      );
      // Fetch employee name for notifications to others
      const empNameResult = await db.execute(sql`SELECT first_name || ' ' || last_name AS name FROM admin_users WHERE id = ${userId}`);
      const empName = (empNameResult.rows[0] as any)?.name || "An employee";
      // Manager: acknowledgement complete
      if (acknowledgedPlan.manager_id) {
        await notifyPlan(acknowledgedPlan.manager_id, "pip_acknowledged",
          `Plan acknowledged: ${empName}`,
          `${empName} has acknowledged and accepted the ${acknowledgedPlan.plan_type} plan.`,
          { planId: acknowledgedPlan.id, planType: acknowledgedPlan.plan_type, employeeId: userId },
        );
      }
      // HR/admin users: acknowledgement complete
      const hrIds = await getHrAdminIds();
      const notifiedSet = new Set([userId, acknowledgedPlan.manager_id]);
      for (const hrId of hrIds) {
        if (notifiedSet.has(hrId)) continue;
        await notifyPlan(hrId, "pip_acknowledged",
          `Plan acknowledged: ${empName}`,
          `${empName} has acknowledged and accepted the ${acknowledgedPlan.plan_type} plan.`,
          { planId: acknowledgedPlan.id, planType: acknowledgedPlan.plan_type, employeeId: userId },
        );
      }

      res.json(acknowledgedPlan);
    } catch (error) {
      console.error("Error acknowledging employee plan:", error);
      res.status(500).json({ error: "Failed to acknowledge plan" });
    }
  });

  // ─── Manager activates a pending plan ─────────────────────────────────────
  // POST /api/hr/plans/:id/activate   { startDate: "YYYY-MM-DD" }
  // Requirements:
  //   • Plan must be pending
  //   • Caller must be the plan's manager OR HR/Admin
  //   • PIP plans: pip_hr_acknowledged_at must be set before activation is allowed

  app.post("/api/hr/plans/:id/activate", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.plans.activate", ALL_ROLES);
    if (!userId) return;
    try {
      const { startDate } = req.body as { startDate?: string };
      if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return res.status(400).json({ error: "startDate (YYYY-MM-DD) is required" });
      }

      // Fetch plan with employee + manager names
      const planRes = await db.execute(sql`
        SELECT ep.*,
               emp.first_name || ' ' || emp.last_name AS employee_name,
               mgr.first_name || ' ' || mgr.last_name AS manager_name
        FROM employee_plans ep
        LEFT JOIN admin_users emp ON ep.employee_id = emp.id
        LEFT JOIN admin_users mgr ON ep.manager_id = mgr.id
        WHERE ep.id = ${req.params.id}
      `);
      if (planRes.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
      const plan = planRes.rows[0] as any;

      if (plan.status !== "pending") {
        return res.status(400).json({
          error: `Plan is already ${plan.status}. Only pending plans can be activated.`,
        });
      }
      if (!plan.employee_id) {
        return res.status(400).json({ error: "Cannot activate a plan with no employee assigned." });
      }

      // Authorization: the plan's direct manager or HR/Admin
      const role = req.session.role!;
      if (!ADMIN_ROLES.includes(role)) {
        if (plan.manager_id !== userId) {
          return res.status(403).json({ error: "Only the assigned manager or HR/Admin can activate this plan." });
        }
      }

      // PIP gating: HR must acknowledge before the manager can activate
      if (plan.plan_type === "pip" && !plan.pip_hr_acknowledged_at) {
        return res.status(400).json({
          error: "A PIP plan must be acknowledged by HR before it can be activated.",
        });
      }

      const durationDays: number = plan.duration_days;
      const startMs = new Date(startDate).getTime();
      const endDate = new Date(startMs + durationDays * 86400000).toISOString().slice(0, 10);

      // Seed check-ins
      const cadenceOpts = await fetchPlanCadenceSettings();
      const checkInSchedule = generatePlanCheckIns(
        plan.id, plan.employee_id, plan.manager_id, plan.plan_type, startDate, endDate, cadenceOpts,
      );
      for (const ci of checkInSchedule) {
        await db.execute(sql`
          INSERT INTO check_ins (employee_id, manager_id, plan_id, check_in_type, scheduled_date, status)
          VALUES (${ci.employeeId}, ${ci.managerId}, ${ci.planId},
                  ${ci.checkInType}::check_in_type, ${ci.scheduledDate}, 'scheduled'::check_in_status)
          ON CONFLICT DO NOTHING
        `);
      }

      // Update seeded goals: set start_date + target_date from due_day_offset
      const goalsRes = await db.execute(sql`
        SELECT id, title FROM performance_goals WHERE plan_id = ${plan.id}
      `);
      const msPerDay = 86400000;
      for (const goal of goalsRes.rows as any[]) {
        const tmplRes = await db.execute(sql`
          SELECT due_day_offset FROM plan_goal_templates
          WHERE plan_type = ${plan.plan_type}::employee_plan_type
            AND goal_title = ${goal.title}
            AND is_active = true
          ORDER BY due_day_offset ASC NULLS LAST
          LIMIT 1
        `);
        const offset = (tmplRes.rows[0] as any)?.due_day_offset ?? null;
        const targetDate = offset != null
          ? new Date(startMs + offset * msPerDay).toISOString().slice(0, 10)
          : endDate;
        await db.execute(sql`
          UPDATE performance_goals
          SET start_date = ${startDate}, target_date = ${targetDate}, updated_at = NOW()
          WHERE id = ${goal.id}
        `);
      }

      // Register governance control
      try {
        const controlType = plan.plan_type === "pip" ? "pip" : "probation";
        const { createGovernanceControl } = await import("./governanceService");
        await createGovernanceControl({
          controlType,
          referenceId: `${controlType === "pip" ? "pip" : "prob"}:${plan.id}`,
          ownerId: plan.employee_id,
          managerId: plan.manager_id ?? null,
          dueDate: endDate,
          requiredAction: plan.plan_type === "pip"
            ? "Meet all Performance Improvement Plan checkpoints by the end of the plan period."
            : "Complete all probation milestones and pass the confirmation review.",
          evidenceRequired: true,
        });
      } catch (govErr) {
        console.error("[governance] Non-fatal: failed to register governance control on plan activation:", govErr);
      }

      // Activate
      const updatedRes = await db.execute(sql`
        UPDATE employee_plans
        SET status = 'active'::employee_plan_status,
            start_date = ${startDate}, end_date = ${endDate},
            updated_at = NOW()
        WHERE id = ${plan.id}
        RETURNING *
      `);

      await createAuditLog(userId, "employee_plan_activated", {
        planId: plan.id, planType: plan.plan_type, startDate, endDate, activatedBy: userId,
      });

      // Notify the employee
      const planLabel = plan.plan_type === "pip"
        ? "Performance Improvement Plan"
        : plan.plan_type === "probation" ? "Probation Plan" : "Growth Plan";
      const actorRes = await db.execute(sql`SELECT first_name || ' ' || last_name AS name FROM admin_users WHERE id = ${userId} LIMIT 1`);
      const actorName = (actorRes.rows[0] as any)?.name ?? "Your manager";

      await notifyPlan(
        plan.employee_id, "plan_activated",
        `Your ${planLabel} is now active`,
        `Your ${planLabel} has been activated by ${actorName}, starting ${startDate} and running ${durationDays} days. Your goals are now live.`,
        { planId: plan.id, planType: plan.plan_type, startDate, endDate },
      );

      // Brief manager (idempotent once-only — safe to call after activation)
      await briefManagerOnce(plan.id);

      res.json(updatedRes.rows[0]);
    } catch (error) {
      console.error("Error activating plan:", error);
      res.status(500).json({ error: "Failed to activate plan" });
    }
  });

  // ─── HR acknowledges a pending PIP plan ────────────────────────────────────
  // PATCH /api/hr/plans/:id/acknowledge-pip
  // Sets pip_hr_acknowledged_at, unlocking the manager's Activate button.

  app.patch("/api/hr/plans/:id/acknowledge-pip", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.plans.acknowledgePip", ADMIN_ROLES);
    if (!userId) return;
    try {
      const planRes = await db.execute(sql`
        SELECT ep.*,
               emp.first_name || ' ' || emp.last_name AS employee_name
        FROM employee_plans ep
        LEFT JOIN admin_users emp ON ep.employee_id = emp.id
        WHERE ep.id = ${req.params.id}
      `);
      if (planRes.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
      const plan = planRes.rows[0] as any;

      if (plan.plan_type !== "pip") {
        return res.status(400).json({ error: "HR acknowledgement is only required for PIP plans." });
      }
      if (plan.pip_hr_acknowledged_at) {
        return res.json({ ok: true, alreadyAcknowledged: true });
      }
      if (plan.status !== "pending") {
        return res.status(400).json({ error: "Only pending PIP plans need HR acknowledgement." });
      }

      await db.execute(sql`
        UPDATE employee_plans
        SET pip_hr_acknowledged_at = NOW(), updated_at = NOW()
        WHERE id = ${req.params.id}
      `);

      await createAuditLog(userId, "pip_hr_acknowledged", {
        planId: req.params.id, hrUserId: userId, employeeName: plan.employee_name,
      });

      // Notify the plan's manager so they know they can now activate
      if (plan.manager_id) {
        await notifyPlan(
          plan.manager_id, "pip_hr_acknowledged",
          `PIP acknowledged — you can now activate ${plan.employee_name ?? "the employee"}'s plan`,
          `HR has reviewed and approved ${plan.employee_name ?? "the employee"}'s Performance Improvement Plan. ` +
          `You can now activate it from your team's Plans tab.`,
          { planId: plan.id, planType: "pip" },
        );
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Error acknowledging PIP plan:", error);
      res.status(500).json({ error: "Failed to acknowledge PIP plan" });
    }
  });

  // ─── Employee "My Plan" — fetch own active or pending plan ────────────────

  app.get("/api/hr/my-plan", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.myPlan", ALL_ROLES);
    if (!userId) return;
    try {
      // Fetch the most recent active or pending plan for this employee
      const planResult = await db.execute(sql`
        SELECT ep.*,
               au.first_name || ' ' || au.last_name AS employee_name,
               m.first_name || ' ' || m.last_name AS manager_name
        FROM employee_plans ep
        LEFT JOIN admin_users au ON ep.employee_id = au.id
        LEFT JOIN admin_users m ON ep.manager_id = m.id
        WHERE ep.employee_id = ${userId}
          AND ep.status IN ('active', 'pending')
        ORDER BY ep.created_at DESC
        LIMIT 1
      `);

      if (planResult.rows.length === 0) {
        return res.json(null);
      }

      const plan = planResult.rows[0] as any;

      // Fetch check-ins for this plan
      const checkInsResult = await db.execute(sql`
        SELECT * FROM check_ins
        WHERE plan_id = ${plan.id}
        ORDER BY scheduled_date ASC
      `);

      // Fetch goals for this plan
      const goalsResult = await db.execute(sql`
        SELECT * FROM performance_goals
        WHERE plan_id = ${plan.id}
        ORDER BY created_at ASC
      `);

      // Fetch last 4 weekly updates posted by the employee for this plan
      const weeklyUpdatesResult = await db.execute(sql`
        SELECT * FROM check_ins
        WHERE plan_id = ${plan.id}
          AND employee_id = ${userId}
          AND check_in_type = 'weekly_update'
        ORDER BY scheduled_date DESC
        LIMIT 4
      `);

      // Coaching notes recorded by the manager/HR against this plan (read-only for the employee)
      const coachingLogResult = await db.execute(sql`
        SELECT cl.*, a.first_name || ' ' || a.last_name AS author_name
        FROM coaching_log_entries cl
        LEFT JOIN admin_users a ON cl.author_id = a.id
        WHERE cl.plan_id = ${plan.id}
        ORDER BY cl.entry_date DESC, cl.created_at DESC
      `);

      res.json({
        plan,
        checkIns: checkInsResult.rows,
        goals: goalsResult.rows,
        weeklyUpdates: weeklyUpdatesResult.rows,
        coachingLog: coachingLogResult.rows,
      });
    } catch (error) {
      console.error("Error fetching my plan:", error);
      res.status(500).json({ error: "Failed to fetch plan" });
    }
  });

  // ─── Update goal progress/notes (employee self-update) ────────────────────

  app.patch("/api/hr/plans/:planId/goals/:goalId", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.plans.goals", ALL_ROLES);
    if (!userId) return;
    try {
      const { planId, goalId } = req.params;
      const { progress, notes } = req.body;

      // Verify the goal belongs to this plan and include plan_type for PIP read-only guard
      const goalResult = await db.execute(sql`
        SELECT pg.*, ep.employee_id AS plan_employee_id, ep.plan_type AS plan_plan_type
        FROM performance_goals pg
        JOIN employee_plans ep ON pg.plan_id = ep.id
        WHERE pg.id = ${goalId} AND pg.plan_id = ${planId}
      `);

      if (goalResult.rows.length === 0) {
        return res.status(404).json({ error: "Goal not found" });
      }

      const goal = goalResult.rows[0] as any;
      const role = req.session.role!;

      // PIP goals are read-only for employees — managers and HR/admins can still edit
      if (goal.plan_plan_type === "pip" && !ADMIN_ROLES.includes(role) && role !== "manager") {
        return res.status(403).json({ error: "PIP plan goals are read-only for employees" });
      }

      // Employees can only update their own plan goals; admins/managers can update any
      if (!ADMIN_ROLES.includes(role) && role !== "manager") {
        if (goal.plan_employee_id !== userId) {
          return res.status(403).json({ error: "Not authorized to update this goal" });
        }
      } else if (role === "manager" && !ADMIN_ROLES.includes(role)) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (goal.plan_employee_id !== userId && !teamIds.includes(goal.plan_employee_id)) {
          return res.status(403).json({ error: "Not authorized to update this goal" });
        }
      }

      const updates: Record<string, any> = { updated_at: new Date() };
      if (progress !== undefined) {
        const p = Math.min(100, Math.max(0, parseInt(progress)));
        updates.progress = isNaN(p) ? 0 : p;
      }
      if (notes !== undefined) {
        updates.notes = notes ?? null;
      }

      await db.execute(sql`
        UPDATE performance_goals SET
          progress = COALESCE(${updates.progress ?? null}, progress),
          notes = COALESCE(${updates.notes !== undefined ? updates.notes : null}, notes),
          goal_progress_source = CASE WHEN ${updates.progress ?? null} IS NOT NULL THEN 'manual' ELSE goal_progress_source END,
          goal_progress_updated_at = CASE WHEN ${updates.progress ?? null} IS NOT NULL THEN NOW() ELSE goal_progress_updated_at END,
          last_progress_updated_at = CASE WHEN ${updates.progress ?? null} IS NOT NULL THEN NOW() ELSE last_progress_updated_at END,
          updated_at = NOW()
        WHERE id = ${goalId}
      `);

      const [updated] = await db.select().from(performanceGoals).where(eq(performanceGoals.id, goalId));
      await createAuditLog(userId, "plan_goal_self_updated", { goalId, planId, changes: updates as Record<string, unknown> }, goal.plan_employee_id);
      res.json(updated);
    } catch (error) {
      console.error("Error updating plan goal:", error);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  // ─── Goal metric-type reclassification (Task #1101) ─────────────────────
  // HR/admin can correct the auto-classified metric type or switch a goal to
  // manual. On switch to manual, goal_progress_source is also set to 'manual'.

  app.post("/api/hr/goals/:goalId/metric-type", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.plans.goals", ADMIN_ROLES);
    if (!userId) return;
    try {
      const { goalId } = req.params;
      const { metricType, metricConfig } = req.body;

      const VALID_METRIC_TYPES = [
        "submission_count", "ats_compliance", "attendance_consistency",
        "sop_completion", "training_completion", "manual",
      ];
      if (!metricType || !VALID_METRIC_TYPES.includes(metricType)) {
        return res.status(400).json({
          error: `Invalid metricType. Must be one of: ${VALID_METRIC_TYPES.join(", ")}`,
        });
      }

      // Verify goal exists
      const goalResult = await db.execute(sql`
        SELECT id, goal_progress_source FROM performance_goals WHERE id = ${goalId} LIMIT 1
      `);
      if (goalResult.rows.length === 0) {
        return res.status(404).json({ error: "Goal not found" });
      }

      const configJson = metricConfig ? JSON.stringify(metricConfig) : null;
      await db.execute(sql`
        UPDATE performance_goals SET
          goal_metric_type = ${metricType},
          goal_metric_config = ${configJson ? sql`${configJson}::jsonb` : sql`'{}'::jsonb`},
          goal_progress_source = CASE WHEN ${metricType} = 'manual' THEN 'manual' ELSE goal_progress_source END,
          updated_at = NOW()
        WHERE id = ${goalId}
      `);

      const updated = (await db.execute(sql`
        SELECT id, goal_metric_type, goal_metric_config, goal_progress_source, goal_progress_updated_at
        FROM performance_goals WHERE id = ${goalId} LIMIT 1
      `)).rows[0];

      await createAuditLog(userId, "goal_metric_type_updated", {
        goalId,
        metricType,
        metricConfig: metricConfig ?? null,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating goal metric type:", error);
      res.status(500).json({ error: "Failed to update goal metric type" });
    }
  });

  // ─── Employee weekly self-update for a plan ───────────────────────────────

  app.post("/api/hr/plans/:planId/weekly-update", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "hr.plans.weeklyUpdate", ALL_ROLES);
    if (!userId) return;
    try {
      const { planId } = req.params;
      const { note } = req.body;

      if (!note || String(note).trim().length < 50) {
        return res.status(400).json({ error: "Weekly update must be at least 50 characters" });
      }

      // Verify the plan exists and belongs to this employee
      const planResult = await db.execute(sql`
        SELECT * FROM employee_plans
        WHERE id = ${planId} AND employee_id = ${userId}
      `);

      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: "Plan not found or not your plan" });
      }

      const plan = planResult.rows[0] as any;

      // Only probation and growth plans support employee weekly self-updates
      if (plan.plan_type !== "probation" && plan.plan_type !== "growth") {
        return res.status(400).json({ error: "Weekly self-updates are only available for Probation and Growth plans" });
      }

      // Check if employee has already posted an update this calendar week
      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday of current week
      const weekStartStr = weekStart.toISOString().split("T")[0];

      const existingThisWeek = await db.execute(sql`
        SELECT id FROM check_ins
        WHERE plan_id = ${planId}
          AND employee_id = ${userId}
          AND check_in_type = 'weekly_update'
          AND scheduled_date >= ${weekStartStr}
        LIMIT 1
      `);

      if (existingThisWeek.rows.length > 0) {
        return res.status(409).json({ error: "You have already posted a weekly update this week" });
      }

      const today = new Date().toISOString().split("T")[0];

      await db.execute(sql`
        INSERT INTO check_ins (employee_id, manager_id, plan_id, check_in_type, scheduled_date, status, employee_notes)
        VALUES (${userId}, ${plan.manager_id ?? null}, ${planId}, 'weekly_update'::check_in_type, ${today}, 'completed'::check_in_status, ${note.trim()})
      `);

      const inserted = await db.execute(sql`
        SELECT * FROM check_ins
        WHERE plan_id = ${planId} AND employee_id = ${userId} AND check_in_type = 'weekly_update'
        ORDER BY created_at DESC LIMIT 1
      `);

      await createAuditLog(userId, "plan_weekly_update_posted", { planId, id: inserted.rows[0]?.id as string | undefined });
      res.status(201).json(inserted.rows[0]);
    } catch (error) {
      console.error("Error posting weekly update:", error);
      res.status(500).json({ error: "Failed to post weekly update" });
    }
  });

  // ─── Coaching log ─────────────────────────────────────────────────────────
  // Managers/HR record ad-hoc coaching notes against an employee's plan.
  // Distinct from scheduled milestone check-ins.

  app.get("/api/hr/plans/:planId/coaching-log", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.plans.coachingLog", MANAGER_ROLES);
    if (!userId) return;
    try {
      const { planId } = req.params;
      const planResult = await db.execute(sql`SELECT * FROM employee_plans WHERE id = ${planId}`);
      if (planResult.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
      const plan = planResult.rows[0] as any;

      // Object-level authorization: admins/HR see all; managers only their team
      const role = req.session.role!;
      if (!ADMIN_ROLES.includes(role)) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(plan.employee_id)) {
          return res.status(403).json({ error: "Not authorized to view this coaching log" });
        }
      }

      const result = await db.execute(sql`
        SELECT cl.*, a.first_name || ' ' || a.last_name AS author_name
        FROM coaching_log_entries cl
        LEFT JOIN admin_users a ON cl.author_id = a.id
        WHERE cl.plan_id = ${planId}
        ORDER BY cl.entry_date DESC, cl.created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching coaching log:", error);
      res.status(500).json({ error: "Failed to fetch coaching log" });
    }
  });

  app.post("/api/hr/plans/:planId/coaching-log", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.plans.coachingLog", MANAGER_ROLES);
    if (!userId) return;
    try {
      const { planId } = req.params;
      const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
      const entryDate = typeof req.body?.entryDate === "string" && req.body.entryDate
        ? req.body.entryDate
        : new Date().toISOString().split("T")[0];

      if (note.length < 5) {
        return res.status(400).json({ error: "Coaching note must be at least 5 characters" });
      }

      const planResult = await db.execute(sql`SELECT * FROM employee_plans WHERE id = ${planId}`);
      if (planResult.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
      const plan = planResult.rows[0] as any;

      // Object-level authorization: admins/HR may log for anyone; managers only their team
      const role = req.session.role!;
      if (!ADMIN_ROLES.includes(role)) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(plan.employee_id)) {
          return res.status(403).json({ error: "Not authorized to add to this coaching log" });
        }
      }

      const inserted = await db.execute(sql`
        INSERT INTO coaching_log_entries (plan_id, employee_id, author_id, note, entry_date)
        VALUES (${planId}, ${plan.employee_id}, ${userId}, ${note}, ${entryDate})
        RETURNING *
      `);
      const row = inserted.rows[0] as any;

      const authorResult = await db.execute(sql`SELECT first_name || ' ' || last_name AS author_name FROM admin_users WHERE id = ${userId}`);
      row.author_name = (authorResult.rows[0] as any)?.author_name ?? null;

      await createAuditLog(userId, "plan_coaching_note_added", { planId, employeeId: plan.employee_id, id: row.id as string | undefined });

      // Close manager_coaching_obligation ONLY when the author is the plan's manager.
      // HR/admin notes do not satisfy the manager's own obligation — this preserves
      // accountability and prevents non-manager entries from hiding manager non-performance.
      if (userId === String(plan.manager_id)) {
        const mcoRef = `mgr_pip:${planId}`;
        const mcoUpdateResult = await db.execute(sql`
          UPDATE governance_controls
          SET status = 'completed', closed_at = NOW(), updated_at = NOW()
          WHERE reference_id = ${mcoRef}
            AND control_type::text = 'manager_coaching_obligation'
            AND status NOT IN ('completed', 'closed')
          RETURNING id
        `).catch(() => ({ rows: [] }));
        if (mcoUpdateResult.rows.length > 0) {
          emitGovernanceEvent({
            controlId: (mcoUpdateResult.rows[0] as any).id,
            eventType: "closed",
            actorId: userId,
            source: "user",
            metadata: { planId, action: "coaching_note_logged", entryDate, authorIsManager: true },
          }).catch(() => {});
        }
      }

      // Notify the employee that a coaching note was recorded (gated by plan-notification flag)
      await notifyPlan(plan.employee_id, "coaching_note_added",
        "New coaching note on your plan",
        "Your manager added a coaching note to your plan.",
        { planId, planType: plan.plan_type },
      );

      res.status(201).json(row);
    } catch (error) {
      console.error("Error adding coaching note:", error);
      res.status(500).json({ error: "Failed to add coaching note" });
    }
  });

  // ─── Plan Meetings — meeting log per plan ─────────────────────────────────
  // GET /api/hr/plans/:planId/meetings   — list all meeting logs
  // POST /api/hr/plans/:planId/meetings  — log a new meeting
  // DELETE /api/hr/plans/:planId/meetings/:meetingId — remove a log entry

  app.get("/api/hr/plans/:planId/meetings", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.plans.meetings", MANAGER_ROLES);
    if (!userId) return;
    try {
      const { planId } = req.params;
      const planResult = await db.execute(sql`SELECT * FROM employee_plans WHERE id = ${planId}`);
      if (planResult.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
      const plan = planResult.rows[0] as any;

      const role = req.session.role!;
      if (!ADMIN_ROLES.includes(role)) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(plan.employee_id)) {
          return res.status(403).json({ error: "Not authorized to view meetings for this plan" });
        }
      }

      const result = await db.execute(sql`
        SELECT pm.*, a.first_name || ' ' || a.last_name AS logged_by_name
        FROM plan_meetings pm
        LEFT JOIN admin_users a ON pm.logged_by = a.id
        WHERE pm.plan_id = ${planId}
          AND pm.deleted_at IS NULL
        ORDER BY pm.meeting_date DESC, pm.created_at DESC
      `);

      // Resolve attendee user IDs → names in one batch query
      const rows = result.rows as any[];
      const allAttendeeIds = new Set<string>();
      for (const row of rows) {
        if (Array.isArray(row.attendees)) row.attendees.forEach((id: string) => allAttendeeIds.add(id));
      }
      const idList = Array.from(allAttendeeIds);
      let nameMap: Record<string, string> = {};
      if (idList.length > 0) {
        const nameRes = await db.execute(sql`
          SELECT id, first_name || ' ' || last_name AS full_name
          FROM admin_users WHERE id = ANY(${idList}::text[])
        `);
        for (const nr of nameRes.rows as any[]) nameMap[nr.id] = nr.full_name;
      }
      const enriched = rows.map(row => ({
        ...row,
        attendee_names: Array.isArray(row.attendees)
          ? (row.attendees as string[]).map(id => nameMap[id] ?? id)
          : [],
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching plan meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  const VALID_MEETING_TYPES = ["check_in", "coaching", "pip_review", "probation_review", "informal"] as const;

  // HR is read-only for meeting logs; only managers, admin, and super_admin can write
  const PLAN_MEETING_WRITE_ROLES = ["super_admin", "admin", "manager", "operations"];

  app.post("/api/hr/plans/:planId/meetings", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.plans.meetings.write", PLAN_MEETING_WRITE_ROLES);
    if (!userId) return;
    try {
      const { planId } = req.params;
      const { meetingDate, durationMinutes, meetingType, notes, checkInId, attendees } = req.body ?? {};

      if (!meetingDate || typeof meetingDate !== "string") {
        return res.status(400).json({ error: "meetingDate is required" });
      }
      if (!meetingType || !(VALID_MEETING_TYPES as readonly string[]).includes(meetingType)) {
        return res.status(400).json({ error: `meetingType must be one of: ${VALID_MEETING_TYPES.join(", ")}` });
      }

      const planResult = await db.execute(sql`SELECT * FROM employee_plans WHERE id = ${planId}`);
      if (planResult.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
      const plan = planResult.rows[0] as any;

      const role = req.session.role!;
      if (!ADMIN_ROLES.includes(role)) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(plan.employee_id)) {
          return res.status(403).json({ error: "Not authorized to log meetings for this plan" });
        }
      }

      // Validate checkInId belongs to this plan if provided
      let resolvedCheckInId: string | null = null;
      if (checkInId) {
        const ciCheck = await db.execute(sql`
          SELECT id FROM check_ins WHERE id = ${checkInId} AND plan_id = ${planId} LIMIT 1
        `);
        if (ciCheck.rows.length === 0) {
          return res.status(400).json({ error: "checkInId does not belong to this plan" });
        }
        resolvedCheckInId = checkInId;
      }

      const dur = durationMinutes != null && !isNaN(Number(durationMinutes)) && Number(durationMinutes) > 0
        ? Number(durationMinutes)
        : null;

      const attendeesJson = Array.isArray(attendees) && attendees.length > 0
        ? JSON.stringify(attendees)
        : null;

      const inserted = await db.execute(sql`
        INSERT INTO plan_meetings (plan_id, logged_by, meeting_date, duration_minutes, meeting_type, attendees, notes, check_in_id)
        VALUES (
          ${planId}, ${userId}, ${meetingDate}, ${dur},
          ${meetingType}::plan_meeting_type,
          ${attendeesJson}::jsonb,
          ${notes ?? null},
          ${resolvedCheckInId}
        )
        RETURNING *
      `);
      const row = inserted.rows[0] as any;

      const authorResult = await db.execute(sql`SELECT first_name || ' ' || last_name AS logged_by_name FROM admin_users WHERE id = ${userId}`);
      row.logged_by_name = (authorResult.rows[0] as any)?.logged_by_name ?? null;

      await createAuditLog(userId, "plan_meeting_logged", { planId, employeeId: plan.employee_id, meetingDate, meetingType });

      res.status(201).json(row);
    } catch (error) {
      console.error("Error logging plan meeting:", error);
      res.status(500).json({ error: "Failed to log meeting" });
    }
  });

  app.delete("/api/hr/plans/:planId/meetings/:meetingId", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.plans.meetings.write", PLAN_MEETING_WRITE_ROLES);
    if (!userId) return;
    try {
      const { planId, meetingId } = req.params;
      const meetingResult = await db.execute(sql`
        SELECT pm.*, ep.employee_id
        FROM plan_meetings pm
        JOIN employee_plans ep ON ep.id = pm.plan_id
        WHERE pm.id = ${meetingId} AND pm.plan_id = ${planId}
      `);
      if (meetingResult.rows.length === 0) return res.status(404).json({ error: "Meeting not found" });
      const meeting = meetingResult.rows[0] as any;

      const role = req.session.role!;
      if (!ADMIN_ROLES.includes(role)) {
        // Non-admin: must be the original logger, and within 24 hours of logging
        if (String(meeting.logged_by) !== String(userId)) {
          return res.status(403).json({ error: "You can only delete meetings you logged" });
        }
        const ageHours = (Date.now() - new Date(meeting.created_at).getTime()) / 3600000;
        if (ageHours > 24) {
          return res.status(403).json({ error: "Meetings can only be deleted within 24 hours of logging. Contact HR to remove older entries." });
        }
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(meeting.employee_id)) {
          return res.status(403).json({ error: "Not authorized for this plan" });
        }
      }

      await db.execute(sql`UPDATE plan_meetings SET deleted_at = NOW() WHERE id = ${meetingId}`);
      await createAuditLog(userId, "plan_meeting_deleted", { planId, meetingId, employeeId: meeting.employee_id });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting plan meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // ── Plan attendee candidates — for the meeting log multi-select ─────────────
  app.get("/api/hr/plans/:planId/attendees", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.plans.meetings", MANAGER_ROLES);
    if (!userId) return;
    try {
      const { planId } = req.params;
      const planResult = await db.execute(sql`SELECT * FROM employee_plans WHERE id = ${planId}`);
      if (planResult.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
      const plan = planResult.rows[0] as any;

      const role = req.session.role!;
      if (!ADMIN_ROLES.includes(role)) {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(plan.employee_id)) {
          return res.status(403).json({ error: "Not authorized" });
        }
      }

      // Candidates = manager + employee + direct reports of manager (for larger team reviews)
      const managerId = plan.manager_id as string | null;
      const employeeId = plan.employee_id as string | null;
      const reporteeIds = managerId ? await getAllReporteeIdsFromDb(managerId) : [];
      const candidateIds = [...new Set([managerId, employeeId, ...reporteeIds].filter(Boolean))] as string[];

      const usersResult = await db.execute(sql`
        SELECT id, first_name || ' ' || last_name AS full_name, role
        FROM admin_users
        WHERE id = ANY(${candidateIds}::text[])
          AND (deleted_at IS NULL OR deleted_at > NOW())
        ORDER BY first_name, last_name
      `);

      res.json({
        attendees: usersResult.rows,
        defaultIds: [managerId, employeeId].filter(Boolean),
      });
    } catch (error) {
      console.error("Error fetching plan attendees:", error);
      res.status(500).json({ error: "Failed to fetch attendees" });
    }
  });

  // Manager context panel: goal progress + trend arrows + last 3 coaching snippets.
  // Loaded async when a check-in detail dialog opens; does not block the form.
  app.get("/api/hr/check-ins/:id/context", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role!;
      const checkInId = req.params.id;

      const ciResult = await db.execute(sql`
        SELECT ci.*, ep.plan_type, ep.start_date, ep.end_date
        FROM check_ins ci
        LEFT JOIN employee_plans ep ON ci.plan_id = ep.id
        WHERE ci.id = ${checkInId}
        LIMIT 1
      `);
      if (ciResult.rows.length === 0) return res.status(404).json({ error: "Check-in not found" });
      const ci = ciResult.rows[0] as any;

      // Auth: managers/admin/HR only — this panel contains manager coaching notes
      // intended as prep material before the session; employees must not see them.
      const MANAGER_CONTEXT_ROLES = ["super_admin", "admin", "hr", "manager"];
      if (!MANAGER_CONTEXT_ROLES.includes(role)) {
        return res.status(403).json({ error: "Not authorized — manager or HR access required" });
      }
      // Managers may only view check-ins from their own team
      if (role === "manager") {
        const teamIds = await getAllReporteeIdsFromDb(userId);
        if (!teamIds.includes(ci.employee_id) && ci.manager_id !== userId) {
          return res.status(403).json({ error: "Not authorized — not in your team" });
        }
      }

      const todayStr = new Date().toISOString().slice(0, 10);

      // Goals for this plan (if plan-linked)
      let goalRows: any[] = [];
      if (ci.plan_id) {
        const gr = await db.execute(sql`
          SELECT id, title, progress, start_date, target_date, status, tracking_type,
                 last_progress_updated_at
          FROM performance_goals
          WHERE plan_id = ${ci.plan_id}
            AND status NOT IN ('cancelled')
          ORDER BY sort_order ASC NULLS LAST, created_at ASC
          LIMIT 10
        `);
        goalRows = gr.rows as any[];
      }

      const todayMs = new Date(todayStr + "T12:00:00Z").getTime();

      const goals = goalRows.map((g: any) => {
        const progress = parseFloat(String(g.progress ?? "0"));
        const isOverdue = !!g.target_date && String(g.target_date).slice(0, 10) < todayStr && progress < 100;

        // Trend: compare actual progress vs time-proportional expected progress.
        // "up" = ahead of schedule (> expected + 10pp), "down" = behind (< expected - 10pp).
        // Falls back to "stable" when dates are absent or the goal is already overdue.
        let trend: "up" | "down" | "stable" = "stable";
        if (!isOverdue && g.start_date && g.target_date) {
          const startMs = new Date(String(g.start_date).slice(0, 10) + "T12:00:00Z").getTime();
          const endMs   = new Date(String(g.target_date).slice(0, 10) + "T12:00:00Z").getTime();
          const totalDays = endMs - startMs;
          if (totalDays > 0 && todayMs > startMs) {
            const elapsed = Math.min(todayMs - startMs, totalDays);
            const expectedProgress = (elapsed / totalDays) * 100;
            if (progress > expectedProgress + 10) trend = "up";
            else if (progress < expectedProgress - 10) trend = "down";
          }
        }

        return {
          id: String(g.id),
          title: String(g.title),
          progress,
          targetDate: g.target_date ? String(g.target_date).slice(0, 10) : null,
          status: String(g.status),
          isOverdue,
          trend,
          isManual: !g.tracking_type || g.tracking_type === "manual",
        };
      });

      // Last 3 coaching log entries for this plan
      let coachingSnippets: any[] = [];
      if (ci.plan_id) {
        const cr = await db.execute(sql`
          SELECT cle.id, cle.note, cle.entry_date, cle.created_at,
                 au.first_name || ' ' || au.last_name AS author_name
          FROM coaching_log_entries cle
          JOIN admin_users au ON cle.author_id = au.id
          WHERE cle.plan_id = ${ci.plan_id}
          ORDER BY cle.created_at DESC
          LIMIT 3
        `);
        coachingSnippets = (cr.rows as any[]).map(r => ({
          id: String(r.id),
          snippet: String(r.note).slice(0, 100),
          entryDate: String(r.entry_date),
          authorName: String(r.author_name),
        }));
      }

      // Days since last coaching note
      let daysSinceLastNote: number | null = null;
      if (coachingSnippets.length > 0) {
        const lastEntry = coachingSnippets[0];
        const lastDate = new Date(lastEntry.entryDate + "T12:00:00Z");
        daysSinceLastNote = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
      }

      res.json({
        checkInId,
        planId: ci.plan_id || null,
        planType: ci.plan_type || null,
        employeeId: String(ci.employee_id),
        goals,
        coachingSnippets,
        daysSinceLastNote,
      });
    } catch (error) {
      console.error("Error fetching check-in context:", error);
      res.status(500).json({ error: "Failed to fetch check-in context" });
    }
  });
}
