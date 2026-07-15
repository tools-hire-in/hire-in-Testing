/**
 * Task #1115 — Recruiter Activity & Conversion Tracker
 * All recruiter activity, pipeline, and funnel API endpoints.
 */
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, gte, lte, sql, desc, inArray, isNull } from "drizzle-orm";
import { adminUsers, applications, recruiterActivityLogs, applicationStageHistory, employeePlans } from "@shared/schema";
import { recomputeGoalProgress } from "./performanceRoutes";

const RECRUITER_ROLES = new Set(["super_admin", "admin", "hr", "operations", "manager", "recruiter"]);
const MANAGER_ROLES = new Set(["super_admin", "admin", "hr", "manager"]);
// Roles where we do NOT auto-attribute recruiter_id at application creation
// (super_admin/admin/hr may create on behalf of others — leave null for them unless explicit)
const AUTO_ASSIGN_RECRUITER_ROLES = new Set(["operations", "manager", "recruiter"]);

const VALID_STAGES = [
  "submitted",
  "phone_screen",
  "technical_interview",
  "final_interview",
  "offer_made",
  "placed",
  "rejected",
  "withdrawn",
] as const;
type ApplicationStage = typeof VALID_STAGES[number];

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function getDateRange(query: any): { from: string; to: string } {
  const today = new Date().toISOString().split("T")[0];
  const from = typeof query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.from)
    ? query.from
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split("T")[0];
      })();
  const to = typeof query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.to)
    ? query.to
    : today;
  return { from, to };
}

async function getDirectReportIds(managerId: string): Promise<string[]> {
  const reports = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(and(eq(adminUsers.managerId, managerId), isNull(adminUsers.deletedAt)));
  return reports.map((r) => r.id);
}

/**
 * Verify that `targetId` is a direct report of `managerId`.
 * HR/admin/super_admin bypass the check (they can see all).
 * Returns true if allowed, false + sends 403 if not.
 */
async function assertManagerCanViewRecruiter(
  req: Request,
  res: Response,
  managerId: string,
  role: string,
  targetId: string,
): Promise<boolean> {
  // Privileged roles can query any recruiter
  if (role === "hr" || role === "admin" || role === "super_admin") return true;
  // Managers can only see their direct reports
  const reportIds = await getDirectReportIds(managerId);
  if (!reportIds.includes(targetId)) {
    res.status(403).json({ error: "You can only view data for your direct reports" });
    return false;
  }
  return true;
}

export function registerRecruiterRoutes(app: Express) {

  // ── POST /api/recruiter/activity — upsert today's activity log ────────────
  app.post("/api/recruiter/activity", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    if (!RECRUITER_ROLES.has(role)) {
      return res.status(403).json({ error: "Recruiter access required" });
    }

    const { callsMade, screensConducted, notes, logDate } = req.body ?? {};

    const today = new Date().toISOString().split("T")[0];
    const targetDate = typeof logDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(logDate) ? logDate : today;

    // Only allow logging for today or yesterday (prevent far-future backdating)
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    })();
    if (targetDate > today || targetDate < yesterday) {
      return res.status(400).json({ error: "Can only log activity for today or yesterday" });
    }

    const calls = typeof callsMade === "number" ? Math.max(0, Math.floor(callsMade)) : 0;
    const screens = typeof screensConducted === "number" ? Math.max(0, Math.floor(screensConducted)) : 0;

    try {
      const result = await db
        .insert(recruiterActivityLogs)
        .values({
          recruiterId: userId,
          logDate: targetDate,
          callsMade: calls,
          screensConducted: screens,
          notes: typeof notes === "string" ? notes.trim() || null : null,
        })
        .onConflictDoUpdate({
          target: [recruiterActivityLogs.recruiterId, recruiterActivityLogs.logDate],
          set: {
            callsMade: calls,
            screensConducted: screens,
            notes: typeof notes === "string" ? notes.trim() || null : null,
            updatedAt: new Date(),
          },
        })
        .returning();
      const saved = result[0];
      res.json(saved);

      // Trigger goal auto-progress for any recruiter_metric:call_volume goals linked to this recruiter
      setImmediate(async () => {
        try {
          const { performanceGoals } = await import("@shared/schema");
          const linkedGoals = await db
            .select({ id: performanceGoals.id })
            .from(performanceGoals)
            .where(
              and(
                eq(performanceGoals.employeeId, userId),
                sql`${performanceGoals.sourceRef} LIKE 'recruiter_metric:%'`,
              ),
            );
          for (const g of linkedGoals) {
            await recomputeGoalProgress(g.id).catch(() => {});
          }
        } catch (_) {}
      });
    } catch (err: any) {
      console.error("[recruiter] activity upsert error:", err);
      res.status(500).json({ error: "Failed to save activity log" });
    }
  });

  // ── GET /api/recruiter/activity — fetch activity logs ─────────────────────
  app.get("/api/recruiter/activity", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;

    const { from, to } = getDateRange(req.query);

    // Determine which recruiter(s) to query
    let targetIds: string[];

    if (req.query.recruiterId) {
      // Explicit recruiter query — only managers/hr/admin can query others
      const requestedId = req.query.recruiterId as string;
      if (requestedId !== userId) {
        if (!MANAGER_ROLES.has(role)) {
          return res.status(403).json({ error: "Cannot view other recruiter data" });
        }
        // Managers must verify the target is their direct report
        if (!await assertManagerCanViewRecruiter(req, res, userId, role, requestedId)) return;
      }
      targetIds = [requestedId];
    } else if (req.query.team === "true" && MANAGER_ROLES.has(role)) {
      // Manager requesting their whole team
      if (role === "hr" || role === "admin" || role === "super_admin") {
        // HR/admin can see all active recruiters
        const all = await db
          .select({ id: adminUsers.id })
          .from(adminUsers)
          .where(and(isNull(adminUsers.deletedAt), eq(adminUsers.isActive, true)));
        targetIds = all.map((u) => u.id);
      } else {
        targetIds = await getDirectReportIds(userId);
      }
    } else {
      targetIds = [userId];
    }

    if (targetIds.length === 0) return res.json([]);

    try {
      const rows = await db
        .select({
          id: recruiterActivityLogs.id,
          recruiterId: recruiterActivityLogs.recruiterId,
          logDate: recruiterActivityLogs.logDate,
          callsMade: recruiterActivityLogs.callsMade,
          screensConducted: recruiterActivityLogs.screensConducted,
          notes: recruiterActivityLogs.notes,
          updatedAt: recruiterActivityLogs.updatedAt,
          recruiterFirstName: adminUsers.firstName,
          recruiterLastName: adminUsers.lastName,
          recruiterEmail: adminUsers.email,
        })
        .from(recruiterActivityLogs)
        .leftJoin(adminUsers, eq(recruiterActivityLogs.recruiterId, adminUsers.id))
        .where(
          and(
            targetIds.length === 1
              ? eq(recruiterActivityLogs.recruiterId, targetIds[0])
              : inArray(recruiterActivityLogs.recruiterId, targetIds),
            gte(recruiterActivityLogs.logDate, from),
            lte(recruiterActivityLogs.logDate, to),
          ),
        )
        .orderBy(desc(recruiterActivityLogs.logDate));

      res.json(rows);
    } catch (err: any) {
      console.error("[recruiter] activity fetch error:", err);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // ── GET /api/recruiter/activity/today-team — manager widget summary ────────
  app.get("/api/recruiter/activity/today-team", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    if (!MANAGER_ROLES.has(role)) {
      return res.status(403).json({ error: "Manager access required" });
    }

    const today = new Date().toISOString().split("T")[0];

    try {
      let teamIds: string[];
      if (role === "hr" || role === "admin" || role === "super_admin") {
        const all = await db
          .select({ id: adminUsers.id })
          .from(adminUsers)
          .where(and(isNull(adminUsers.deletedAt), eq(adminUsers.isActive, true)));
        teamIds = all.map((u) => u.id);
      } else {
        teamIds = await getDirectReportIds(userId);
      }

      if (teamIds.length === 0) return res.json([]);

      const rows = await db
        .select({
          recruiterId: recruiterActivityLogs.recruiterId,
          callsMade: recruiterActivityLogs.callsMade,
          screensConducted: recruiterActivityLogs.screensConducted,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
        })
        .from(recruiterActivityLogs)
        .leftJoin(adminUsers, eq(recruiterActivityLogs.recruiterId, adminUsers.id))
        .where(
          and(
            inArray(recruiterActivityLogs.recruiterId, teamIds),
            eq(recruiterActivityLogs.logDate, today),
          ),
        )
        .orderBy(adminUsers.firstName);

      res.json(rows);
    } catch (err: any) {
      console.error("[recruiter] today-team error:", err);
      res.status(500).json({ error: "Failed to fetch team activity" });
    }
  });

  // ── GET /api/recruiter/pipeline — recruiter's own submissions ─────────────
  app.get("/api/recruiter/pipeline", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    if (!RECRUITER_ROLES.has(role)) {
      return res.status(403).json({ error: "Recruiter access required" });
    }

    // Managers/HR/admin can query another recruiter's pipeline; manager must verify direct-report
    let targetRecruiterId = userId;
    if (req.query.recruiterId && req.query.recruiterId !== userId) {
      if (!MANAGER_ROLES.has(role)) {
        return res.status(403).json({ error: "Cannot view other recruiter pipeline" });
      }
      const requestedId = req.query.recruiterId as string;
      if (!await assertManagerCanViewRecruiter(req, res, userId, role, requestedId)) return;
      targetRecruiterId = requestedId;
    }

    const stageFilter = req.query.stage as string | undefined;

    try {
      const conditions = [eq(applications.recruiterId, targetRecruiterId)];
      if (stageFilter && VALID_STAGES.includes(stageFilter as ApplicationStage)) {
        conditions.push(eq(applications.stage, stageFilter));
      }

      const rows = await db
        .select({
          id: applications.id,
          candidateName: applications.candidateName,
          email: applications.email,
          phone: applications.phone,
          jobId: applications.jobId,
          status: applications.status,
          stage: applications.stage,
          stageUpdatedAt: applications.stageUpdatedAt,
          placementDate: applications.placementDate,
          ceipalSyncStatus: applications.ceipalSyncStatus,
          createdAt: applications.createdAt,
          updatedAt: applications.updatedAt,
        })
        .from(applications)
        .where(and(...conditions))
        .orderBy(desc(applications.updatedAt));

      res.json(rows);
    } catch (err: any) {
      console.error("[recruiter] pipeline fetch error:", err);
      res.status(500).json({ error: "Failed to fetch pipeline" });
    }
  });

  // ── PATCH /api/recruiter/applications/:id/stage — advance stage ───────────
  app.patch("/api/recruiter/applications/:id/stage", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    if (!RECRUITER_ROLES.has(role)) {
      return res.status(403).json({ error: "Recruiter access required" });
    }

    const { stage, notes, placementDate } = req.body ?? {};
    if (!stage || !VALID_STAGES.includes(stage as ApplicationStage)) {
      return res.status(400).json({ error: `Invalid stage. Valid values: ${VALID_STAGES.join(", ")}` });
    }

    try {
      const [existing] = await db
        .select()
        .from(applications)
        .where(eq(applications.id, req.params.id))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Application not found" });

      // Role gate: recruiters/operations can only update their own submissions;
      // managers must verify the submission's recruiter is their direct report
      if (role === "recruiter" || role === "operations") {
        if (existing.recruiterId !== userId) {
          return res.status(403).json({ error: "Can only update your own submissions" });
        }
      } else if (role === "manager" && existing.recruiterId && existing.recruiterId !== userId) {
        if (!await assertManagerCanViewRecruiter(req, res, userId, role, existing.recruiterId)) return;
      }

      // Stage transition rules (non-privileged: sequential only — no skipping steps)
      const STAGE_SEQUENCE = ["submitted", "phone_screen", "technical_interview", "final_interview", "offer_made", "placed"] as const;
      const stageOrder: Record<string, number> = {
        submitted: 0, phone_screen: 1, technical_interview: 2, final_interview: 3,
        offer_made: 4, placed: 5, rejected: -1, withdrawn: -1,
      };
      const currentOrder = stageOrder[existing.stage || "submitted"] ?? 0;
      const newOrder = stageOrder[stage] ?? 0;
      const isTerminal = stage === "rejected" || stage === "withdrawn";
      const isPrivileged = role === "hr" || role === "admin" || role === "super_admin";

      if (!isPrivileged) {
        if (!isTerminal) {
          if (newOrder < currentOrder) {
            return res.status(400).json({
              error: `Cannot move stage backwards from '${existing.stage}' to '${stage}'. HR/admin can override.`,
            });
          }
          // Disallow skipping stages: must advance exactly one step at a time
          if (newOrder > currentOrder + 1) {
            const nextStageName = STAGE_SEQUENCE[currentOrder + 1] ?? "next stage";
            return res.status(400).json({
              error: `Cannot skip stages. Move from '${existing.stage}' to '${nextStageName}' first.`,
              expectedNext: nextStageName,
            });
          }
        }
      }

      const fromStage = existing.stage || "submitted";
      const now = new Date();

      const updateData: Record<string, any> = {
        stage,
        stageUpdatedAt: now,
        stageUpdatedBy: userId,
        updatedAt: now,
      };

      if (stage === "placed") {
        const pd = typeof placementDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(placementDate)
          ? placementDate
          : now.toISOString().split("T")[0];
        updateData.placementDate = pd;
      }

      await db.update(applications).set(updateData).where(eq(applications.id, req.params.id));

      // Write stage history
      await db.insert(applicationStageHistory).values({
        applicationId: req.params.id,
        fromStage,
        toStage: stage,
        changedBy: userId,
        notes: typeof notes === "string" ? notes.trim() || null : null,
      });

      const [updated] = await db.select().from(applications).where(eq(applications.id, req.params.id)).limit(1);
      res.json(updated);

      // Trigger goal auto-progress for placement_count / interview_conversion goals
      const recruiterId = existing.recruiterId;
      if (recruiterId) {
        setImmediate(async () => {
          try {
            const { performanceGoals } = await import("@shared/schema");
            const linkedGoals = await db
              .select({ id: performanceGoals.id })
              .from(performanceGoals)
              .where(
                and(
                  eq(performanceGoals.employeeId, recruiterId),
                  sql`${performanceGoals.sourceRef} LIKE 'recruiter_metric:%'`,
                ),
              );
            for (const g of linkedGoals) {
              await recomputeGoalProgress(g.id).catch(() => {});
            }
          } catch (_) {}
        });
      }
    } catch (err: any) {
      console.error("[recruiter] stage update error:", err);
      res.status(500).json({ error: "Failed to update stage" });
    }
  });

  // ── GET /api/manager/team-funnel — team conversion funnel ─────────────────
  app.get("/api/manager/team-funnel", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    if (!MANAGER_ROLES.has(role)) {
      return res.status(403).json({ error: "Manager access required" });
    }

    // "plan" range: derive from the active employee plans for the manager's team
    let planPeriodLabel: string | null = null;
    let resolvedFrom: string | null = null;
    let resolvedTo: string | null = null;

    if (req.query.range === "plan") {
      // Fetch the manager's team's active plans to determine the period
      let teamIds: string[];
      const tempRole = role;
      if (tempRole === "hr" || tempRole === "admin" || tempRole === "super_admin") {
        const all = await db.select({ id: adminUsers.id }).from(adminUsers)
          .where(and(isNull(adminUsers.deletedAt), eq(adminUsers.isActive, true)));
        teamIds = all.map((u) => u.id);
      } else {
        teamIds = await getDirectReportIds(userId);
      }
      if (teamIds.length > 0) {
        const plans = await db
          .select({ startDate: employeePlans.startDate, durationDays: employeePlans.durationDays })
          .from(employeePlans)
          .where(
            and(
              inArray(employeePlans.employeeId, teamIds),
              eq(employeePlans.status, "active"),
            ),
          );
        if (plans.length > 0) {
          const starts = plans.map((p) => p.startDate ?? "").filter(Boolean).sort();
          const ends = plans.map((p) => {
            if (!p.startDate || !p.durationDays) return null;
            const d = new Date(p.startDate);
            d.setDate(d.getDate() + p.durationDays);
            return d.toISOString().split("T")[0];
          }).filter(Boolean).sort();
          resolvedFrom = starts[0] ?? null;
          resolvedTo = ends[ends.length - 1] ?? null;
          planPeriodLabel = `Active plan period (${resolvedFrom} – ${resolvedTo})`;
        }
      }
      // Fall back to month if no active plans found
      if (!resolvedFrom || !resolvedTo) {
        const today = new Date();
        resolvedFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
        resolvedTo = today.toISOString().split("T")[0];
        planPeriodLabel = "This month (no active plans found)";
      }
    }

    const { from: defaultFrom, to: defaultTo } = getDateRange(req.query);
    const from = resolvedFrom ?? defaultFrom;
    const to = resolvedTo ?? defaultTo;

    try {
      // Determine team scope (managers see only direct reports; HR/admin see all)
      let teamIds: string[];
      if (role === "hr" || role === "admin" || role === "super_admin") {
        const all = await db
          .select({ id: adminUsers.id })
          .from(adminUsers)
          .where(and(isNull(adminUsers.deletedAt), eq(adminUsers.isActive, true)));
        teamIds = all.map((u) => u.id);
      } else {
        teamIds = await getDirectReportIds(userId);
      }

      if (teamIds.length === 0) return res.json([]);

      // Aggregate activity logs for the period
      const activityRows = await db
        .select({
          recruiterId: recruiterActivityLogs.recruiterId,
          totalCalls: sql<number>`SUM(${recruiterActivityLogs.callsMade})::int`,
          totalScreensLogged: sql<number>`SUM(${recruiterActivityLogs.screensConducted})::int`,
        })
        .from(recruiterActivityLogs)
        .where(
          and(
            inArray(recruiterActivityLogs.recruiterId, teamIds),
            gte(recruiterActivityLogs.logDate, from),
            lte(recruiterActivityLogs.logDate, to),
          ),
        )
        .groupBy(recruiterActivityLogs.recruiterId);

      // Aggregate pipeline stage counts using max stage EVER REACHED (via stage history).
      // This prevents undercounting candidates who progressed to interview/phone_screen
      // and were later rejected or withdrawn — they still count as converted.
      // Logic: for each application submitted in the period, find the highest-ranked
      // stage it ever transitioned INTO (via application_stage_history.to_stage).
      // If a candidate has no history rows, fall back to their current stage.
      const STAGE_RANK: Record<string, number> = {
        submitted: 0, phone_screen: 1, technical_interview: 2, final_interview: 3,
        offer_made: 4, placed: 5, rejected: -1, withdrawn: -1,
      };

      // Step 1: get all applications submitted by this team in the period
      const periodApps = await db
        .select({
          id: applications.id,
          recruiterId: applications.recruiterId,
          stage: applications.stage,
        })
        .from(applications)
        .where(
          and(
            inArray(applications.recruiterId, teamIds),
            gte(applications.createdAt, new Date(from)),
            lte(applications.createdAt, new Date(to + "T23:59:59Z")),
          ),
        );

      // Step 2: fetch all stage history entries for these applications
      const appIds = periodApps.map((a) => a.id);
      let historyRows: Array<{ applicationId: string; toStage: string }> = [];
      if (appIds.length > 0) {
        historyRows = await db
          .select({ applicationId: applicationStageHistory.applicationId, toStage: applicationStageHistory.toStage })
          .from(applicationStageHistory)
          .where(inArray(applicationStageHistory.applicationId, appIds));
      }

      // Step 3: for each application compute its max positive stage ever reached
      const historyByApp = new Map<string, string[]>();
      for (const h of historyRows) {
        if (!historyByApp.has(h.applicationId)) historyByApp.set(h.applicationId, []);
        historyByApp.get(h.applicationId)!.push(h.toStage);
      }

      const pipelineRows = periodApps.map((app) => {
        const stages = historyByApp.get(app.id) ?? [];
        // Find the max positive stage ever reached (ignore rejected/withdrawn ranks)
        const positiveStages = stages.filter((s) => (STAGE_RANK[s] ?? -1) >= 0);
        const maxHistoryStage = positiveStages.sort((a, b) => (STAGE_RANK[b] ?? 0) - (STAGE_RANK[a] ?? 0))[0] ?? null;
        // Also consider current stage (may be ahead of history for new submissions with no history rows)
        const currentPositive = (STAGE_RANK[app.stage || "submitted"] ?? -1) >= 0 ? app.stage : null;
        const candidates = [maxHistoryStage, currentPositive].filter(Boolean) as string[];
        const bestStage = candidates.sort((a, b) => (STAGE_RANK[b] ?? 0) - (STAGE_RANK[a] ?? 0))[0] ?? app.stage ?? "submitted";
        return { recruiterId: app.recruiterId, stage: bestStage };
      });

      // Get recruiter info
      const recruiters = await db
        .select({
          id: adminUsers.id,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          role: adminUsers.role,
          designation: adminUsers.designation,
        })
        .from(adminUsers)
        .where(inArray(adminUsers.id, teamIds));

      // Build the funnel map
      const activityMap = new Map<string, { totalCalls: number; totalScreensLogged: number }>();
      for (const row of activityRows) {
        activityMap.set(row.recruiterId, { totalCalls: row.totalCalls, totalScreensLogged: row.totalScreensLogged });
      }

      // pipelineRows is now [{recruiterId, stage}] — one entry per application.
      // Build per-recruiter stage → count maps by incrementing.
      const pipelineMap = new Map<string, Record<string, number>>();
      for (const row of pipelineRows) {
        if (!row.recruiterId) continue;
        if (!pipelineMap.has(row.recruiterId)) pipelineMap.set(row.recruiterId, {});
        const stageKey = row.stage || "submitted";
        const bucket = pipelineMap.get(row.recruiterId)!;
        bucket[stageKey] = (bucket[stageKey] ?? 0) + 1;
      }

      const result = recruiters.map((r) => {
        const activity = activityMap.get(r.id) ?? { totalCalls: 0, totalScreensLogged: 0 };
        const stages = pipelineMap.get(r.id) ?? {};
        const submissions = Object.values(stages).reduce((a, b) => a + b, 0);
        const phoneScreens = (stages.phone_screen || 0) + (stages.technical_interview || 0) + (stages.final_interview || 0) + (stages.offer_made || 0) + (stages.placed || 0);
        const interviews = (stages.technical_interview || 0) + (stages.final_interview || 0) + (stages.offer_made || 0) + (stages.placed || 0);
        const offers = (stages.offer_made || 0) + (stages.placed || 0);
        const placements = stages.placed || 0;

        const screenRate = submissions > 0 ? Math.round((phoneScreens / submissions) * 100) : null;
        const closeRate = interviews > 0 ? Math.round((placements / interviews) * 100) : null;

        return {
          recruiterId: r.id,
          recruiterName: `${r.firstName} ${r.lastName}`,
          role: r.role,
          designation: r.designation,
          callsMade: activity.totalCalls,
          screensLogged: activity.totalScreensLogged,
          submissions,
          phoneScreens,
          interviews,
          offers,
          placements,
          screenRate,
          closeRate,
          stages,
        };
      });

      // Only return recruiters who have some activity
      const active = result.filter((r) => r.submissions > 0 || r.callsMade > 0);
      // Include plan-period metadata in the response header for the UI to display
      res.json({ rows: active, planPeriodLabel, from, to });
    } catch (err: any) {
      console.error("[recruiter] team-funnel error:", err);
      res.status(500).json({ error: "Failed to fetch team funnel" });
    }
  });

  // ── GET /api/hr/recruiter-funnel/:recruiterId — HR/admin view of single recruiter ──
  // Manager callers must verify the recruiterId is their direct report.
  app.get("/api/hr/recruiter-funnel/:recruiterId", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    if (!MANAGER_ROLES.has(role)) {
      return res.status(403).json({ error: "Manager access required" });
    }

    const { recruiterId } = req.params;

    // Managers can only view their own direct reports; HR/admin bypass
    if (!await assertManagerCanViewRecruiter(req, res, userId, role, recruiterId)) return;

    const { from, to } = getDateRange(req.query);

    try {
      const activity = await db
        .select({
          totalCalls: sql<number>`COALESCE(SUM(${recruiterActivityLogs.callsMade}), 0)::int`,
          totalScreens: sql<number>`COALESCE(SUM(${recruiterActivityLogs.screensConducted}), 0)::int`,
        })
        .from(recruiterActivityLogs)
        .where(
          and(
            eq(recruiterActivityLogs.recruiterId, recruiterId),
            gte(recruiterActivityLogs.logDate, from),
            lte(recruiterActivityLogs.logDate, to),
          ),
        );

      const stages = await db
        .select({
          stage: applications.stage,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(applications)
        .where(
          and(
            eq(applications.recruiterId, recruiterId),
            gte(applications.createdAt, new Date(from)),
            lte(applications.createdAt, new Date(to + "T23:59:59Z")),
          ),
        )
        .groupBy(applications.stage);

      const stageMap: Record<string, number> = {};
      for (const row of stages) stageMap[row.stage || "submitted"] = row.count;

      res.json({
        recruiterId,
        period: { from, to },
        activity: activity[0] ?? { totalCalls: 0, totalScreens: 0 },
        stages: stageMap,
      });
    } catch (err: any) {
      console.error("[recruiter] recruiter-funnel error:", err);
      res.status(500).json({ error: "Failed to fetch recruiter funnel" });
    }
  });

  // ── GET /api/recruiter/applications/:id/stage-history ─────────────────────
  app.get("/api/recruiter/applications/:id/stage-history", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    if (!RECRUITER_ROLES.has(role)) {
      return res.status(403).json({ error: "Recruiter access required" });
    }

    try {
      // Fetch the application to verify access scope
      const [app] = await db
        .select({ id: applications.id, recruiterId: applications.recruiterId })
        .from(applications)
        .where(eq(applications.id, req.params.id))
        .limit(1);

      if (!app) return res.status(404).json({ error: "Application not found" });

      // Recruiters/operations can only view history for their own submissions
      if (role === "recruiter" || role === "operations") {
        if (app.recruiterId !== userId) {
          return res.status(403).json({ error: "Can only view history for your own submissions" });
        }
      } else if (role === "manager" && app.recruiterId && app.recruiterId !== userId) {
        // Manager must verify the application's recruiter is their direct report
        if (!await assertManagerCanViewRecruiter(req, res, userId, role, app.recruiterId)) return;
      }

      const rows = await db
        .select({
          id: applicationStageHistory.id,
          fromStage: applicationStageHistory.fromStage,
          toStage: applicationStageHistory.toStage,
          changedAt: applicationStageHistory.changedAt,
          notes: applicationStageHistory.notes,
          changerFirstName: adminUsers.firstName,
          changerLastName: adminUsers.lastName,
        })
        .from(applicationStageHistory)
        .leftJoin(adminUsers, eq(applicationStageHistory.changedBy, adminUsers.id))
        .where(eq(applicationStageHistory.applicationId, req.params.id))
        .orderBy(desc(applicationStageHistory.changedAt));

      res.json(rows);
    } catch (err: any) {
      console.error("[recruiter] stage-history error:", err);
      res.status(500).json({ error: "Failed to fetch stage history" });
    }
  });
}

/**
 * Called from the public application submission endpoint (POST /api/applications).
 * If the caller is authenticated with a recruiter/operations/manager role, auto-attributes
 * the application to them. HR/admin are excluded — they often create on behalf of others.
 */
export function getAutoRecruiterIdFromSession(session: any): string | null {
  if (!session?.userId || !session?.role) return null;
  if (AUTO_ASSIGN_RECRUITER_ROLES.has(session.role)) return session.userId;
  return null;
}
