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
import { sendCheckInReminderEmail } from "./email";

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
async function insertPlanGoalsFromTemplates(
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
         ${tmpl.goal_category}, ${planId}, ${sourceRef}, ${startDate}, ${endDate}, 3)
    `);
  }
  return templates.length;
}

function generatePlanCheckIns(
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
    // Milestone reviews at days 15, 30, 60, 90
    [15, 30, 60, 90].forEach(day => push(addDays(start, day), "milestone"));
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

function requireRole(req: Request, res: Response, featureKey: string, allowedRoles: string[]): string | null {
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
    const userId = requireRole(req, res, "performance.goals", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.goals.team", MANAGER_ROLES);
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
    const userId = requireRole(req, res, "performance.teamGoals", MANAGER_ROLES);
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
    const userId = requireRole(req, res, "performance.goals", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.goals.batch", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.goals", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.goals", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.goals.milestones", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.goals.milestones", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.milestones", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.milestones", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.goals.milestones.reorder", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.goals.checkIns", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.goals.checkIns", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.checkIns.get", ALL_ROLES);
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

      const enrichedList = list.map(ci => {
        const emp = userMap.get(ci.employeeId);
        const mgr = ci.managerId ? userMap.get(ci.managerId) : null;
        return {
          ...ci,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          managerName: mgr ? `${mgr.firstName} ${mgr.lastName}` : "Unknown",
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
    const userId = requireRole(req, res, "performance.checkIns.post", MANAGER_ROLES);
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
    const userId = requireRole(req, res, "performance.checkIns.patch", ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const [existing] = await db.select().from(checkIns).where(eq(checkIns.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Check-in not found" });

      if (existing.employeeId !== userId && existing.managerId !== userId && !ADMIN_ROLES.includes(req.session.role!)) {
        return res.status(403).json({ error: "Not authorized to update this check-in" });
      }

      const { status, employeeNotes, managerNotes, actionItems, rating, goalId } = req.body;
      const updates: Partial<CheckIn> = { updatedAt: new Date() };
      if (status !== undefined) {
        updates.status = status;
        if (status === "completed") updates.completedAt = new Date();
      }
      if (employeeNotes !== undefined) updates.employeeNotes = employeeNotes;
      if (managerNotes !== undefined) updates.managerNotes = managerNotes;
      if (actionItems !== undefined) updates.actionItems = actionItems;
      if (rating !== undefined) updates.rating = rating;
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
    const userId = requireRole(req, res, "performance.reviewCycles.get", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.reviewCycles.post", ADMIN_ROLES);
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
    const userId = requireRole(req, res, "performance.reviewCycles.patch", ADMIN_ROLES);
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
    const userId = requireRole(req, res, "performance.reviews.my", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.reviews.team", MANAGER_ROLES);
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
    const userId = requireRole(req, res, "performance.reviews", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.reviews.self", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.reviews.manager", MANAGER_ROLES);
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
    const userId = requireRole(req, res, "performance.feedback.received", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.feedback.sent", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.feedback", ALL_ROLES);
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
    const userId = requireRole(req, res, "performance.employees", ALL_ROLES);
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
    const userId = requireRole(req, res, "hr.planTemplates.meta", MANAGER_ROLES);
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
    const userId = requireRole(req, res, "hr.planTemplates.get", MANAGER_ROLES);
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
    const userId = requireRole(req, res, "hr.planTemplates.post", ADMIN_ROLES);
    if (!userId) return;
    try {
      const { plan_type, role_slug, goal_title, goal_category, goal_description, target_metric, sort_order } = req.body;
      if (!plan_type || !role_slug || !goal_title) return res.status(400).json({ error: "plan_type, role_slug, and goal_title are required" });
      const result = await db.execute(sql`
        INSERT INTO plan_goal_templates (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
        VALUES (${plan_type}::employee_plan_type, ${role_slug}, 'healthcare'::employee_plan_dept_scope, ${goal_title}, ${goal_category || "individual"}, ${goal_description || null}, ${target_metric || null}, ${sort_order ?? 0}, true)
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
    const userId = requireRole(req, res, "hr.planTemplates.patch", ADMIN_ROLES);
    if (!userId) return;
    try {
      const { goal_title, goal_description, target_metric, sort_order, is_active, goal_category } = req.body;
      const result = await db.execute(sql`
        UPDATE plan_goal_templates SET
          goal_title = COALESCE(${goal_title ?? null}, goal_title),
          goal_description = COALESCE(${goal_description ?? null}, goal_description),
          target_metric = COALESCE(${target_metric ?? null}, target_metric),
          goal_category = COALESCE(${goal_category ?? null}, goal_category),
          sort_order = COALESCE(${sort_order ?? null}, sort_order),
          is_active = COALESCE(${is_active ?? null}, is_active),
          updated_at = NOW()
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
    const userId = requireRole(req, res, "hr.planTemplates.delete", ADMIN_ROLES);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPLOYEE PLANS (Probation / Growth / PIP) CRUD API
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/hr/plans", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.plans.post", MANAGER_ROLES);
    if (!userId) return;
    try {
      const { employee_id, plan_type, start_date, end_date, duration_days, manager_id, role_slug } = req.body;

      // ── Validate ALL inputs before any DB writes ──────────────────────────
      if (!employee_id || !plan_type || !start_date || !end_date || !duration_days) {
        return res.status(400).json({ error: "employee_id, plan_type, start_date, end_date, duration_days are required" });
      }
      if (!role_slug) {
        return res.status(400).json({ error: "role_slug is required to auto-seed goals from plan templates" });
      }

      // Verify employee exists
      const empResult = await db.execute(sql`
        SELECT au.id, d.name as department_name FROM admin_users au
        LEFT JOIN departments d ON au.department_id = d.id
        WHERE au.id = ${employee_id}
      `);
      const empRow = empResult.rows[0] as { id: string; department_name: string | null } | undefined;
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

      // Pre-fetch templates (needed even when custom_goals provided, to validate role/plan combo exists)
      const tmplResult = await db.execute(sql`
        SELECT * FROM plan_goal_templates
        WHERE plan_type = ${plan_type}::employee_plan_type
          AND role_slug = ${role_slug}
          AND is_active = true
        ORDER BY sort_order ASC
      `);
      const planTemplates = tmplResult.rows as PlanGoalTemplate[];

      // Determine which goals to seed: custom (if non-empty) or templates
      const useCustomGoals = Array.isArray(custom_goals) && custom_goals.length > 0;
      if (!useCustomGoals && planTemplates.length === 0) {
        return res.status(400).json({
          error: `No active templates found for plan_type="${plan_type}" and role_slug="${role_slug}". Cannot create a zero-goal plan.`,
        });
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
               ${g.category || "individual"}, ${plan.id}, ${sourceRef}, ${start_date}, ${end_date}, 3)
          `);
        }
        goalsCreated = custom_goals!.filter(g => g.title?.trim()).length;
      } else {
        goalsCreated = await insertPlanGoalsFromTemplates(
          plan.id, employee_id, manager_id || null, start_date, end_date, planTemplates,
        );
      }

      await createAuditLog(userId, "employee_plan_created", { planId: plan.id, plan_type, employee_id }, employee_id);
      res.status(201).json({ plan, checkInsScheduled: checkInSchedule.length, goalsCreated });
    } catch (error) {
      console.error("Error creating employee plan:", error);
      res.status(500).json({ error: "Failed to create employee plan" });
    }
  });

  app.get("/api/hr/plans", async (req: Request, res: Response) => {
    // Employees can list their own plans; managers/admin see their scope
    const userId = requireRole(req, res, "hr.plans.get", ALL_ROLES);
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
    const userId = requireRole(req, res, "hr.plans.get", ALL_ROLES);
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
      // Also return associated check-ins and goals
      const checkInsResult = await db.execute(sql`SELECT * FROM check_ins WHERE plan_id = ${req.params.id} ORDER BY scheduled_date ASC`);
      const goalsResult = await db.execute(sql`SELECT * FROM performance_goals WHERE plan_id = ${req.params.id} ORDER BY created_at ASC`);
      res.json({ plan, checkIns: checkInsResult.rows, goals: goalsResult.rows });
    } catch (error) {
      console.error("Error fetching employee plan:", error);
      res.status(500).json({ error: "Failed to fetch employee plan" });
    }
  });

  app.patch("/api/hr/plans/:id", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.plans.patch", MANAGER_ROLES);
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
    const userId = requireRole(req, res, "hr.checkIns", MANAGER_ROLES);
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
            WHEN ${reviewScores != null} THEN ${reviewScores != null ? JSON.stringify(reviewScores) : null}::jsonb
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
    const userId = requireRole(req, res, "hr.plans.acknowledge", ALL_ROLES);
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
    const userId = requireRole(req, res, "hr.myPlan", ALL_ROLES);
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

      res.json({
        plan,
        checkIns: checkInsResult.rows,
        goals: goalsResult.rows,
        weeklyUpdates: weeklyUpdatesResult.rows,
      });
    } catch (error) {
      console.error("Error fetching my plan:", error);
      res.status(500).json({ error: "Failed to fetch plan" });
    }
  });

  // ─── Update goal progress/notes (employee self-update) ────────────────────

  app.patch("/api/hr/plans/:planId/goals/:goalId", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, "hr.plans.goals", ALL_ROLES);
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
    const userId = requireRole(req, res, "hr.plans.weeklyUpdate", ALL_ROLES);
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
}
