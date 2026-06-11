import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  performanceGoals, checkIns, reviewCycles, reviews, performanceFeedback,
  systemSettings, adminUsers, auditLogs,
  type PerformanceGoal, type CheckIn, type ReviewCycle, type Review, type PerformanceFeedback,
} from "@shared/schema";
import { eq, and, or, inArray, sql, desc } from "drizzle-orm";
import { DatabaseStorage } from "./storage";
import { sendCheckInReminderEmail } from "./email";

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

function requireRole(req: Request, res: Response, allowedRoles: string[]): string | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  const role = req.session.role;
  if (role === "super_admin" || role === "admin") return userId;
  if (!allowedRoles.includes(role!)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return null;
  }
  return userId;
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
  type?: string;
  sourceRef?: string;
  bulk?: boolean;
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

export function registerPerformanceRoutes(app: Express) {

  // ==========================================
  // GOALS
  // ==========================================

  app.get("/api/performance/goals", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, ALL_ROLES);
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
    const userId = requireRole(req, res, MANAGER_ROLES);
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
    const userId = requireRole(req, res, MANAGER_ROLES);
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
    const userId = requireRole(req, res, ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;
    const role = req.session.role!;

    try {
      const { title, description, category, startDate, targetDate, weight, employeeId, rayoAcademyTrackId } = req.body;
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
    const userId = requireRole(req, res, ALL_ROLES);
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
        goals: { title: string; description?: string; startDate?: string; targetDate?: string }[];
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
          sourceRef: sourceRef || null,
        }))
      ).returning();

      for (const g of inserted) {
        if (sourceRef) {
          await createAuditLog(userId, "performance_goal_created_from_addendum", { goalId: g.id, title: g.title, sourceRef }, targetEmployee !== userId ? targetEmployee : undefined);
        } else {
          await createAuditLog(userId, "performance_goal_created", { goalId: g.id, title: g.title, bulk: true }, targetEmployee !== userId ? targetEmployee : undefined);
        }
      }

      res.status(201).json({ created: inserted.length, goals: inserted });
    } catch (error) {
      console.error("Error batch creating goals:", error);
      res.status(500).json({ error: "Failed to create goals" });
    }
  });

  app.patch("/api/performance/goals/:id", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, ALL_ROLES);
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

      const { title, description, category, startDate, targetDate, weight, status, progress, rayoAcademyTrackId } = req.body;
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

      const [updated] = await db.update(performanceGoals).set(updates).where(eq(performanceGoals.id, req.params.id)).returning();
      await createAuditLog(userId, "performance_goal_updated", { goalId: req.params.id, changes: updates as Record<string, unknown> }, existing.employeeId);
      res.json(updated);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  app.delete("/api/performance/goals/:id", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, ALL_ROLES);
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
  // CHECK-INS
  // ==========================================

  app.get("/api/performance/check-ins", async (req: Request, res: Response) => {
    const userId = requireRole(req, res, ALL_ROLES);
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
    const userId = requireRole(req, res, MANAGER_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const { employeeId, scheduledDate, employeeNotes, managerNotes, actionItems } = req.body;
      if (!employeeId || !scheduledDate) return res.status(400).json({ error: "Employee and scheduled date required" });

      const teamIds = await getTeamMemberIds(userId);
      if (!teamIds.includes(employeeId) && !ADMIN_ROLES.includes(req.session.role!)) {
        return res.status(403).json({ error: "Cannot schedule check-in for this employee" });
      }

      const [ci] = await db.insert(checkIns).values({
        employeeId,
        managerId: userId,
        scheduledDate,
        employeeNotes: employeeNotes || null,
        managerNotes: managerNotes || null,
        actionItems: actionItems || null,
      }).returning();

      await createAuditLog(userId, "check_in_created", { checkInId: ci.id, scheduledDate }, employeeId);

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
    const userId = requireRole(req, res, ALL_ROLES);
    if (!userId) return;
    if (!(await requireFeatureAccess(req, res))) return;

    try {
      const [existing] = await db.select().from(checkIns).where(eq(checkIns.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Check-in not found" });

      if (existing.employeeId !== userId && existing.managerId !== userId && !ADMIN_ROLES.includes(req.session.role!)) {
        return res.status(403).json({ error: "Not authorized to update this check-in" });
      }

      const { status, employeeNotes, managerNotes, actionItems, rating } = req.body;
      const updates: Partial<CheckIn> = { updatedAt: new Date() };
      if (status !== undefined) {
        updates.status = status;
        if (status === "completed") updates.completedAt = new Date();
      }
      if (employeeNotes !== undefined) updates.employeeNotes = employeeNotes;
      if (managerNotes !== undefined) updates.managerNotes = managerNotes;
      if (actionItems !== undefined) updates.actionItems = actionItems;
      if (rating !== undefined) updates.rating = rating;

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
    const userId = requireRole(req, res, ALL_ROLES);
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
    const userId = requireRole(req, res, ADMIN_ROLES);
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
    const userId = requireRole(req, res, ADMIN_ROLES);
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
    const userId = requireRole(req, res, ALL_ROLES);
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
    const userId = requireRole(req, res, MANAGER_ROLES);
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
    const userId = requireRole(req, res, ALL_ROLES);
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
    const userId = requireRole(req, res, ALL_ROLES);
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
    const userId = requireRole(req, res, MANAGER_ROLES);
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
    const userId = requireRole(req, res, ALL_ROLES);
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
    const userId = requireRole(req, res, ALL_ROLES);
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
    const userId = requireRole(req, res, ALL_ROLES);
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
    const userId = requireRole(req, res, ALL_ROLES);
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
}
