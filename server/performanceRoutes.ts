import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  performanceGoals, goalMilestones, checkIns, reviewCycles, reviews, performanceFeedback,
  systemSettings, adminUsers, auditLogs,
  type PerformanceGoal, type GoalMilestone, type CheckIn, type ReviewCycle, type Review, type PerformanceFeedback,
} from "@shared/schema";
import { resolveRoles } from "@shared/accessControl";
import { eq, and, or, inArray, sql, desc, asc, isNull } from "drizzle-orm";
import { DatabaseStorage } from "./storage";
import { sendCheckInReminderEmail, sendProbationManagerBriefingEmail } from "./email";
import {
  cadenceCheckInType, PROBATION_CADENCE_DAYS, milestoneDayFor, probationAreaKey,
  computeWeightedOverall, type ProbationWeight, type ProbationReviewScores,
} from "@shared/probation";

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
  start_date: string;
  end_date: string;
  duration_days: number;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
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
export async function ensureGrowthPlanFromAddendum(opts: {
  employeeId?: string | null;
  offerLetterId?: string | null;
  effectiveDate?: string | null;
  createdBy: string;
  durationDays?: number;
}): Promise<{ created: boolean; planId?: string; reason?: string }> {
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

  const startDate = (opts.effectiveDate && opts.effectiveDate.trim())
    ? opts.effectiveDate.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const durationDays = opts.durationDays ?? 90;
  const endDate = new Date(new Date(startDate).getTime() + durationDays * 86400000)
    .toISOString().slice(0, 10);

  // Idempotency: same employee + growth + identical window already planned.
  const dup = await db.execute(sql`
    SELECT id FROM employee_plans
    WHERE employee_id = ${employeeId} AND plan_type = 'growth'
      AND start_date = ${startDate} AND end_date = ${endDate}
    LIMIT 1
  `);
  if (dup.rows.length > 0) return { created: false, planId: (dup.rows[0] as any).id, reason: "exists" };

  // Resolve the growth goal-template set. A salary-revision / promotion growth
  // clause maps to the foundation->senior 90-day progression track; fall back to
  // senior, then associate, then ANY active growth template so we never create a
  // zero-goal plan.
  const candidateSlugs = ["foundation_to_senior", "senior_recruiter", "associate_recruiter"];
  let templates: PlanGoalTemplate[] = [];
  for (const slug of candidateSlugs) {
    const r = await db.execute(sql`
      SELECT * FROM plan_goal_templates
      WHERE plan_type = 'growth' AND role_slug = ${slug} AND is_active = true
      ORDER BY sort_order ASC
    `);
    if (r.rows.length > 0) { templates = r.rows as PlanGoalTemplate[]; break; }
  }
  if (templates.length === 0) {
    const r = await db.execute(sql`
      SELECT * FROM plan_goal_templates
      WHERE plan_type = 'growth' AND is_active = true
      ORDER BY sort_order ASC
    `);
    templates = r.rows as PlanGoalTemplate[];
  }
  if (templates.length === 0) return { created: false, reason: "no_templates" };

  // Create the ACTIVE plan, its SOP check-in schedule, and the template goals.
  const result = await db.execute(sql`
    INSERT INTO employee_plans (employee_id, manager_id, plan_type, department_scope, status, start_date, end_date, duration_days, created_by)
    VALUES (${employeeId}, ${managerId}, 'growth'::employee_plan_type, 'healthcare'::employee_plan_dept_scope, 'active'::employee_plan_status, ${startDate}, ${endDate}, ${durationDays}, ${opts.createdBy})
    RETURNING *
  `);
  const plan = result.rows[0] as EmployeePlan;

  const checkInSchedule = generatePlanCheckIns(plan.id, employeeId, managerId, "growth", startDate, endDate);
  for (const ci of checkInSchedule) {
    await db.execute(sql`
      INSERT INTO check_ins (employee_id, manager_id, plan_id, check_in_type, scheduled_date, status)
      VALUES (${ci.employeeId}, ${ci.managerId}, ${ci.planId}, ${ci.checkInType}::check_in_type, ${ci.scheduledDate}, 'scheduled'::check_in_status)
    `);
  }

  await insertPlanGoalsFromTemplates(plan.id, employeeId, managerId, startDate, endDate, templates);

  return { created: true, planId: plan.id };
}

export function generatePlanCheckIns(
  planId: string,
  employeeId: string,
  managerId: string | null,
  planType: string,
  startDate: string,
  endDate: string,
): { employeeId: string; managerId: string | null; planId: string; checkInType: string; scheduledDate: string; status: string }[] {
  const schedule: { employeeId: string; managerId: string | null; planId: string; checkInType: string; scheduledDate: string; status: string }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msPerDay = 86400000;

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
    // Weekly PIP review every 7 days for the full duration
    let cur = addDays(start, 7);
    while (cur <= end) {
      schedule.push({ employeeId, managerId, planId, checkInType: "pip_review", scheduledDate: fmt(cur), status: "scheduled" });
      cur = addDays(cur, 7);
    }
  } else if (planType === "growth") {
    // Milestone check-ins at days 30, 60, 90
    const milestoneDays = new Set([30, 60, 90]);
    milestoneDays.forEach(day => push(addDays(start, day), "milestone"));
    // Weekly updates every 7 days (skip days that coincide with milestone days)
    let cur = addDays(start, 7);
    while (cur <= end) {
      const dayOffset = Math.round((cur.getTime() - start.getTime()) / msPerDay);
      if (!milestoneDays.has(dayOffset)) {
        push(cur, "weekly_update");
      }
      cur = addDays(cur, 7);
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

function requirePermission(req: Request, res: Response, featureKey: string, allowedRoles: string[]): string | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  const role = req.session.role;
  const allowed = resolveRoles(featureKey, Array.from(new Set(["super_admin", "admin", ...allowedRoles])));
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
    const setting = await storage.getSystemSetting("feature_flags");
    const flags = (setting?.value as Record<string, boolean>) || {};
    return flags.notifications_enabled === true;
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
    if (plan.plan_type !== "probation") return;
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

    await notifyPlan(
      plan.manager_id,
      "probation_manager_briefing",
      `You own ${plan.employee_name}'s probation plan`,
      `Run the Day 1/7/15/30/45/60/75/90 check-ins and complete the Day 30/60/90 scorecards. Plan runs ${plan.start_date} → ${plan.end_date}.`,
      { planId: plan.id, planType: "probation", employeeName: plan.employee_name, link: "/admin/probation-guide" },
    );

    if (plan.mgr_email) {
      try {
        await sendProbationManagerBriefingEmail({
          to: plan.mgr_email,
          managerFirstName: plan.mgr_first_name || "there",
          employeeName: plan.employee_name,
          startDate: plan.start_date,
          endDate: plan.end_date,
          ackStatus,
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

async function getTeamMemberIds(managerId: string): Promise<string[]> {
  const members = await storage.getTeamMembers(managerId);
  return members.map(m => m.id);
}

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
  const teamIds = await getTeamMemberIds(userId);
  if (teamIds.includes(goal.employeeId)) return goal;
  return null;
}

// Recomputes a goal's progress from milestone completion when auto-progress is enabled.
// Progress only; status remains a manual field.
async function recomputeGoalProgress(goalId: string): Promise<void> {
  const [goal] = await db.select().from(performanceGoals).where(eq(performanceGoals.id, goalId));
  if (!goal || !goal.autoProgressFromMilestones) return;
  const milestones = await db.select().from(goalMilestones).where(eq(goalMilestones.goalId, goalId));
  if (milestones.length === 0) return;
  const doneCount = milestones.filter(m => m.done).length;
  const progress = Math.round((doneCount / milestones.length) * 100);
  await db.update(performanceGoals)
    .set({ progress, updatedAt: new Date() })
    .where(eq(performanceGoals.id, goalId));
}

export function registerPerformanceRoutes(app: Express) {

  // ==========================================
  // GOALS
  // ==========================================

  app.get("/api/performance/goals", async (req: Request, res: Response) => {
    const userId = requirePermission(req, res, "performance.goals", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const goals = await db.select().from(performanceGoals)
        .where(eq(performanceGoals.employeeId, userId))
        .orderBy(desc(performanceGoals.createdAt));
      res.json(goals);
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
      const teamIds = await getTeamMemberIds(userId);
      if (teamIds.length === 0) return res.json([]);

      const goals = await db.select().from(performanceGoals)
        .where(inArray(performanceGoals.employeeId, teamIds))
        .orderBy(desc(performanceGoals.createdAt));

      const employees = await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
        .from(adminUsers).where(inArray(adminUsers.id, teamIds));
      const empMap = Object.fromEntries(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));

      res.json(goals.map(g => ({ ...g, employeeName: empMap[g.employeeId] || "Unknown" })));
    } catch (error) {
      console.error("Error fetching team goals:", error);
      res.status(500).json({ error: "Failed to fetch team goals" });
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
        const members = await storage.getTeamMembers(userId);
        teamMembers = members.filter(u => u.isActive);
      }

      const teamIds = teamMembers.map(m => m.id);

      const goals = teamIds.length > 0
        ? await db.select().from(performanceGoals)
            .where(inArray(performanceGoals.employeeId, teamIds))
            .orderBy(desc(performanceGoals.createdAt))
        : [];

      const membersWithGoals = teamMembers.map(member => ({
        userId: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        designation: (member as any).designation || null,
        goals: goals.filter(g => g.employeeId === member.id).map(g => ({
          id: g.id,
          userId: g.employeeId,
          title: g.title,
          description: g.description,
          category: g.category,
          startDate: g.startDate,
          targetDate: g.targetDate,
          weight: g.weight,
          progress: g.progress,
          status: g.status,
          successCriteria: g.successCriteria,
          autoProgressFromMilestones: g.autoProgressFromMilestones,
          sourceRef: g.sourceRef,
          createdAt: g.createdAt,
        })),
      }));

      const totalGoals = goals.length;
      const completedGoals = goals.filter(g => g.status === "completed").length;
      const inProgressGoals = goals.filter(g => g.status === "in_progress" || g.status === "on_track").length;
      const atRiskGoals = goals.filter(g => g.status === "at_risk").length;

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
      const { title, description, category, startDate, targetDate, weight, employeeId, rayoAcademyTrackId, autoProgressFromMilestones } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required" });

      const targetEmployee = employeeId || userId;
      if (targetEmployee !== userId) {
        const teamIds = await getTeamMemberIds(userId);
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
        const teamIds = await getTeamMemberIds(userId);
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
          const planTeamIds = await getTeamMemberIds(userId);
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
          const ciSchedule = generatePlanCheckIns(
            linkedPlan.id, linkedPlan.employee_id, linkedPlan.manager_id,
            linkedPlan.plan_type, linkedPlan.start_date, linkedPlan.end_date
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
        const teamIds = await getTeamMemberIds(userId);
        if (!teamIds.includes(existing.employeeId) && !ADMIN_ROLES.includes(role)) {
          return res.status(403).json({ error: "Not authorized to update this goal" });
        }
      }

      const { title, description, category, startDate, targetDate, weight, status, progress, rayoAcademyTrackId, autoProgressFromMilestones } = req.body;
      const updates: Partial<PerformanceGoal> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (startDate !== undefined) updates.startDate = startDate;
      if (targetDate !== undefined) updates.targetDate = targetDate;
      if (weight !== undefined) updates.weight = weight;
      if (status !== undefined) updates.status = status;
      if (progress !== undefined) updates.progress = Math.min(100, Math.max(0, progress));
      if (rayoAcademyTrackId !== undefined) updates.rayoAcademyTrackId = rayoAcademyTrackId;
      if (autoProgressFromMilestones !== undefined) updates.autoProgressFromMilestones = autoProgressFromMilestones === true;

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
        const teamIds = await getTeamMemberIds(userId);
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
      const planMap = new Map<string, { planType: string; startDate: string }>();
      if (planIds.length > 0) {
        const planRows = await db.execute(sql`
          SELECT id, plan_type, start_date FROM employee_plans WHERE id IN (${sql.join(planIds.map(id => sql`${id}`), sql`, `)})
        `);
        for (const r of planRows.rows as any[]) {
          planMap.set(String(r.id), { planType: String(r.plan_type), startDate: String(r.start_date) });
        }
      }
      const todayStr = new Date().toISOString().slice(0, 10);

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

      const teamIds = await getTeamMemberIds(userId);
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
      const updates: Partial<CheckIn> = { updatedAt: new Date() };

      // Step 5: gate probation completion — manager notes always required; a
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
      const teamIds = await getTeamMemberIds(userId);
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
        const teamIds = await getTeamMemberIds(userId);
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

      const teamIds = await getTeamMemberIds(userId);
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
        const creatorTeamIds = await getTeamMemberIds(userId);
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
      const checkInSchedule = generatePlanCheckIns(
        plan.id, employee_id, manager_id || null, plan_type, start_date, end_date
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
            (SELECT COUNT(*) FROM check_ins ci WHERE ci.plan_id = ep.id)::int AS total_checkins
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
        const r = await db.execute(sql`SELECT ep.*, au.full_name as employee_name, m.full_name as manager_name FROM employee_plans ep LEFT JOIN admin_users au ON ep.employee_id = au.id LEFT JOIN admin_users m ON ep.manager_id = m.id WHERE ${where} ORDER BY ep.created_at DESC`);
        rows = r.rows as EmployeePlan[];
      } else {
        // Manager: see plans for their direct reports; if employee_id specified, verify team membership
        const teamIds = await getTeamMemberIds(userId);
        if (teamIds.length === 0) { rows = []; }
        else if (employee_id) {
          if (!teamIds.includes(employee_id)) {
            return res.status(403).json({ error: "Not authorized to view plans for this employee" });
          }
          const where = buildConditions(sql`ep.employee_id = ${employee_id}`);
          const r = await db.execute(sql`SELECT ep.*, au.full_name as employee_name, m.full_name as manager_name FROM employee_plans ep LEFT JOIN admin_users au ON ep.employee_id = au.id LEFT JOIN admin_users m ON ep.manager_id = m.id WHERE ${where} ORDER BY ep.created_at DESC`);
          rows = r.rows as EmployeePlan[];
        } else {
          const idList = sql.join(teamIds.map(id => sql`${id}`), sql`, `);
          const where = buildConditions(sql`ep.employee_id IN (${idList})`);
          const r = await db.execute(sql`SELECT ep.*, au.full_name as employee_name, m.full_name as manager_name FROM employee_plans ep LEFT JOIN admin_users au ON ep.employee_id = au.id LEFT JOIN admin_users m ON ep.manager_id = m.id WHERE ${where} ORDER BY ep.created_at DESC`);
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
        const teamIds = await getTeamMemberIds(userId);
        if (!teamIds.includes(plan.employee_id) && plan.employee_id !== userId) {
          return res.status(403).json({ error: "Not authorized to view this plan" });
        }
      }
      // Also return associated check-ins, goals, and coaching-log entries
      const checkInsResult = await db.execute(sql`SELECT * FROM check_ins WHERE plan_id = ${req.params.id} ORDER BY scheduled_date ASC`);
      const goalsResult = await db.execute(sql`SELECT * FROM performance_goals WHERE plan_id = ${req.params.id} ORDER BY created_at ASC`);
      const coachingLogResult = await db.execute(sql`
        SELECT cl.*, a.first_name || ' ' || a.last_name AS author_name
        FROM coaching_log_entries cl
        LEFT JOIN admin_users a ON cl.author_id = a.id
        WHERE cl.plan_id = ${req.params.id}
        ORDER BY cl.entry_date DESC, cl.created_at DESC
      `);
      res.json({ plan, checkIns: checkInsResult.rows, goals: goalsResult.rows, coachingLog: coachingLogResult.rows });
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
        const patchTeamIds = await getTeamMemberIds(userId);
        if (!patchTeamIds.includes(existingPlan.employee_id)) {
          return res.status(403).json({ error: "Not authorized to update this plan" });
        }
      }

      const { status, outcome, end_date } = req.body;
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
          const teamIds = await getTeamMemberIds(userId);
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
        const teamIds = await getTeamMemberIds(userId);
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
        const teamIds = await getTeamMemberIds(userId);
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
        const teamIds = await getTeamMemberIds(userId);
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
}
