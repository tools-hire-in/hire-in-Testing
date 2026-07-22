/**
 * Interactive Onboarding Flow Routes
 * ---------------------------------------------------------------------------
 * Backing the role-scoped step-by-step onboarding overlay introduced in
 * Onboarding Part 1. Separate from the existing training-track onboarding
 * (onboardingRoutes.ts) which covers the SOP / learning-track compliance system.
 *
 * Progress routes (any authenticated user):
 *   GET  /api/onboarding/progress               – steps for user's track merged with progress
 *   POST /api/onboarding/step/:stepId/complete   – mark a step done (+ knowledge check result)
 *   POST /api/onboarding/reset                   – wipe own progress row
 *   POST /api/onboarding/snooze                  – snooze the overlay
 *
 * Admin step CRUD (requirePermission('onboarding_manage')):
 *   GET    /api/onboarding/steps               – all steps for a track (?track=)
 *   POST   /api/onboarding/steps               – create step
 *   PATCH  /api/onboarding/steps/:id           – edit a step
 *   DELETE /api/onboarding/steps/:id           – soft-delete (isActive=false)
 *   POST   /api/onboarding/steps/reorder       – reorder steps within a track
 *   GET    /api/onboarding/steps/export        – JSON export (admin, ?track=) OR PDF guide download (any user, ?track=&format=pdf)
 *
 * Role → track mapping (aligned with source doc target audiences):
 *   employee              → "employee" track
 *   manager               → "manager"  track
 *   hr                    → "hr"       track  (HR/Admin source doc covers hr/admin/super_admin)
 *   admin / super_admin   → "hr"       track  + "admin" additions merged
 *   executive             → "executive" track
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { onboardingSteps, userOnboardingProgress, adminUsers, auditLogs } from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { resolveRoles } from "@shared/accessControl";
import { generateOnboardingGuidePdf } from "./onboardingGuidePdf";

// ── Permission middleware ─────────────────────────────────────────────────────
// Mirrors the `requirePermission` factory in routes.ts — returns Express
// middleware that checks session auth + role against the ACCESS_REGISTRY key.

function requirePermission(featureKey: string, ...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const allowed = resolveRoles(featureKey, Array.from(new Set(["super_admin", ...allowedRoles])));
    if (allowed.includes(req.session.role!)) {
      return next();
    }
    return res.status(403).json({ error: "Insufficient permissions" });
  };
}

const requireAuth = (req: Request, res: Response, next?: NextFunction): boolean => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (next) next();
  return true;
};

// ── Role → track mapping ─────────────────────────────────────────────────────

/**
 * Primary track for a role. admin/super_admin use "hr" as their primary track;
 * their additional admin-specific steps are fetched from the "admin" track and
 * merged (see fetchStepsForRole). operations falls back to the "manager" track.
 */
function primaryTrack(role: string): string {
  switch (role) {
    case "employee":    return "employee";
    case "manager":
    case "operations":  return "manager";
    case "hr":          return "hr";
    case "admin":
    case "super_admin": return "hr";
    case "executive":   return "executive";
    default:            return "employee";
  }
}

/**
 * Whether this role also receives the admin-specific additions
 * (steps seeded under the "admin" track).
 */
function hasAdminAdditions(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Fetch all active steps for a role. admin/super_admin receive hr + admin
 * tracks merged, with admin steps' stepNumbers offset so they sort after hr steps.
 */
async function fetchStepsForRole(role: string) {
  const primary = primaryTrack(role);

  const hrSteps = await db
    .select()
    .from(onboardingSteps)
    .where(and(eq(onboardingSteps.track, primary as any), eq(onboardingSteps.isActive, true)))
    .orderBy(asc(onboardingSteps.stepNumber));

  if (!hasAdminAdditions(role)) {
    return { steps: hrSteps, track: primary };
  }

  // Merge admin-specific additions
  const adminSteps = await db
    .select()
    .from(onboardingSteps)
    .where(and(eq(onboardingSteps.track, "admin" as any), eq(onboardingSteps.isActive, true)))
    .orderBy(asc(onboardingSteps.stepNumber));

  // Offset admin step numbers so they sort after all hr steps
  const hrCount = hrSteps.length;
  const merged = [
    ...hrSteps,
    ...adminSteps.map((s) => ({
      ...s,
      stepNumber: hrCount + s.stepNumber,
    })),
  ];

  return { steps: merged, track: primary };
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerOnboardingFlowRoutes(app: Express) {

  // ── Progress routes (any authenticated user) ─────────────────────────────

  /**
   * GET /api/onboarding/progress
   * Returns the steps for the user's current role-track merged with their
   * completion state. Single call — the client needs no second request.
   *
   * admin/super_admin users receive hr steps + admin additions merged.
   */
  app.get("/api/onboarding/progress", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session.userId!;
    const role = req.session.role!;

    try {
      const { steps, track } = await fetchStepsForRole(role);

      const [progress] = await db
        .select()
        .from(userOnboardingProgress)
        .where(and(eq(userOnboardingProgress.userId, userId), eq(userOnboardingProgress.role, role)));

      res.json({
        track,
        steps,
        progress: progress ?? null,
        totalSteps: steps.length,
        completedCount: progress
          ? ((progress.completedStepIds as string[]) ?? []).length
          : 0,
      });
    } catch (err) {
      console.error("[onboarding-flow] GET /api/onboarding/progress error:", err);
      res.status(500).json({ error: "Failed to fetch onboarding progress" });
    }
  });

  /**
   * POST /api/onboarding/step/:stepId/complete
   * Marks a step as done. Optionally records knowledge check result in payload.
   * Body: { knowledgeCheckPassed?: boolean }
   */
  app.post("/api/onboarding/step/:stepId/complete", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session.userId!;
    const role = req.session.role!;
    const stepId = req.params.stepId;
    const { knowledgeCheckPassed } = req.body as { knowledgeCheckPassed?: boolean };

    try {
      const track = roleToTrack(role);

      // Validate step exists
      const [step] = await db
        .select({ id: onboardingSteps.id })
        .from(onboardingSteps)
        .where(eq(onboardingSteps.id, stepId));

      if (!step) return res.status(404).json({ error: "Step not found" });

      // Count total active steps for the track so we can detect completion
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(onboardingSteps)
        .where(and(eq(onboardingSteps.track, track as any), eq(onboardingSteps.isActive, true)));

      const [existing] = await db
        .select()
        .from(userOnboardingProgress)
        .where(and(eq(userOnboardingProgress.userId, userId), eq(userOnboardingProgress.role, role)));

      if (!existing) {
        const completedStepIds = [stepId];
        const kcPassed: Record<string, boolean> = {};
        if (knowledgeCheckPassed !== undefined) kcPassed[stepId] = knowledgeCheckPassed;
        const nowComplete = completedStepIds.length >= total;
        await db.insert(userOnboardingProgress).values({
          userId,
          role,
          completedStepIds,
          knowledgeCheckPassed: kcPassed,
          ...(nowComplete ? { completedAt: new Date() } : {}),
        });
      } else {
        const completedIds: string[] = (existing.completedStepIds as string[]) ?? [];
        if (!completedIds.includes(stepId)) completedIds.push(stepId);
        const kcPassed = (existing.knowledgeCheckPassed as Record<string, boolean>) ?? {};
        if (knowledgeCheckPassed !== undefined) kcPassed[stepId] = knowledgeCheckPassed;
        const nowComplete = completedIds.length >= total;
        const completedAtValue = nowComplete && !existing.completedAt ? new Date() : existing.completedAt;

        await db
          .update(userOnboardingProgress)
          .set({
            completedStepIds: completedIds,
            knowledgeCheckPassed: kcPassed,
            ...(completedAtValue ? { completedAt: completedAtValue } : {}),
          })
          .where(and(eq(userOnboardingProgress.userId, userId), eq(userOnboardingProgress.role, role)));
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("[onboarding-flow] POST /api/onboarding/step/:stepId/complete error:", err);
      res.status(500).json({ error: "Failed to mark step complete" });
    }
  });

  /**
   * POST /api/onboarding/reset
   * Wipes the user's own progress row (lets them restart the flow).
   */
  app.post("/api/onboarding/reset", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session.userId!;
    const role = req.session.role!;

    try {
      await db
        .delete(userOnboardingProgress)
        .where(and(eq(userOnboardingProgress.userId, userId), eq(userOnboardingProgress.role, role)));

      res.json({ ok: true });
    } catch (err) {
      console.error("[onboarding-flow] POST /api/onboarding/reset error:", err);
      res.status(500).json({ error: "Failed to reset onboarding progress" });
    }
  });

  /**
   * POST /api/onboarding/snooze
   * Sets snoozed=true on the user's progress row. Creates row if missing.
   */
  app.post("/api/onboarding/snooze", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session.userId!;
    const role = req.session.role!;

    try {
      const [existing] = await db
        .select()
        .from(userOnboardingProgress)
        .where(and(eq(userOnboardingProgress.userId, userId), eq(userOnboardingProgress.role, role)));

      if (!existing) {
        await db.insert(userOnboardingProgress).values({
          userId,
          role,
          completedStepIds: [],
          knowledgeCheckPassed: {},
          snoozed: true,
        });
      } else {
        await db
          .update(userOnboardingProgress)
          .set({ snoozed: true })
          .where(and(eq(userOnboardingProgress.userId, userId), eq(userOnboardingProgress.role, role)));
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("[onboarding-flow] POST /api/onboarding/snooze error:", err);
      res.status(500).json({ error: "Failed to snooze onboarding" });
    }
  });

  // ── Dashboard & admin wipe (requirePermission('onboarding_view'/'onboarding_manage')) ──

  /**
   * GET /api/onboarding/dashboard
   * Returns aggregated progress across all users.
   * hr: read-only (onboarding_view); admin/super_admin: full (onboarding_manage).
   */
  app.get(
    "/api/onboarding/dashboard",
    requirePermission("onboarding_view", "hr"),
    async (req: Request, res: Response) => {
      try {
        // 1. All active users
        const allUsers = await db
          .select({
            id: adminUsers.id,
            firstName: adminUsers.firstName,
            lastName: adminUsers.lastName,
            email: adminUsers.email,
            role: adminUsers.role,
          })
          .from(adminUsers)
          .where(eq(adminUsers.isActive, true));

        // 2. All progress rows
        const progressRows = await db
          .select()
          .from(userOnboardingProgress);

        // 3. Steps per track (id + title for display in expanded row)
        const allSteps = await db
          .select({
            track: onboardingSteps.track,
            id: onboardingSteps.id,
            title: onboardingSteps.title,
            stepNumber: onboardingSteps.stepNumber,
          })
          .from(onboardingSteps)
          .where(eq(onboardingSteps.isActive, true))
          .orderBy(asc(onboardingSteps.stepNumber));

        const stepsByTrack: Record<string, { id: string; title: string; stepNumber: number }[]> = {};
        for (const s of allSteps) {
          const t = s.track as string;
          if (!stepsByTrack[t]) stepsByTrack[t] = [];
          stepsByTrack[t].push({ id: s.id, title: s.title, stepNumber: s.stepNumber });
        }

        const stepsPerTrack: Record<string, number> = {};
        for (const [t, rows] of Object.entries(stepsByTrack)) {
          stepsPerTrack[t] = rows.length;
        }

        // 4. Build per-user result
        const users = allUsers.map((u) => {
          const track = roleToTrack(u.role);
          const progress = progressRows.find(
            (p) => p.userId === u.id && p.role === u.role
          );
          const totalSteps = stepsPerTrack[track] ?? 0;
          const completedStepIds = (progress?.completedStepIds as string[]) ?? [];
          const completedSteps = completedStepIds.length;
          const knowledgeChecksPassed = (progress?.knowledgeCheckPassed as Record<string, boolean>) ?? {};
          const lastActivityAt = progress?.completedAt ?? progress?.startedAt ?? null;

          return {
            userId: u.id,
            name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email,
            email: u.email,
            role: u.role,
            track,
            totalSteps,
            completedSteps,
            completedStepIds,
            steps: stepsByTrack[track] ?? [],
            knowledgeChecksPassed,
            completedAt: progress?.completedAt ? progress.completedAt.toISOString() : null,
            startedAt: progress?.startedAt ? progress.startedAt.toISOString() : null,
            snoozed: progress?.snoozed ?? false,
            lastActivityAt,
          };
        });

        res.json({ users });
      } catch (err) {
        console.error("[onboarding-flow] GET /api/onboarding/dashboard error:", err);
        res.status(500).json({ error: "Failed to fetch onboarding dashboard" });
      }
    },
  );

  /**
   * GET /api/onboarding/dashboard/stuck
   * Subset of dashboard: only users who are snoozed OR stalled (started > 48h
   * ago, not complete, fewer steps than total).
   */
  app.get(
    "/api/onboarding/dashboard/stuck",
    requirePermission("onboarding_view", "hr"),
    async (req: Request, res: Response) => {
      try {
        const allUsers = await db
          .select({
            id: adminUsers.id,
            firstName: adminUsers.firstName,
            lastName: adminUsers.lastName,
            email: adminUsers.email,
            role: adminUsers.role,
          })
          .from(adminUsers)
          .where(eq(adminUsers.isActive, true));

        const progressRows = await db
          .select()
          .from(userOnboardingProgress);

        const allStepsStuck = await db
          .select({
            track: onboardingSteps.track,
            id: onboardingSteps.id,
            title: onboardingSteps.title,
            stepNumber: onboardingSteps.stepNumber,
          })
          .from(onboardingSteps)
          .where(eq(onboardingSteps.isActive, true))
          .orderBy(asc(onboardingSteps.stepNumber));

        const stepsByTrackStuck: Record<string, { id: string; title: string; stepNumber: number }[]> = {};
        for (const s of allStepsStuck) {
          const t = s.track as string;
          if (!stepsByTrackStuck[t]) stepsByTrackStuck[t] = [];
          stepsByTrackStuck[t].push({ id: s.id, title: s.title, stepNumber: s.stepNumber });
        }

        const stepsPerTrack: Record<string, number> = {};
        for (const [t, rows] of Object.entries(stepsByTrackStuck)) {
          stepsPerTrack[t] = rows.length;
        }

        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const users = allUsers
          .map((u) => {
            const track = roleToTrack(u.role);
            const progress = progressRows.find(
              (p) => p.userId === u.id && p.role === u.role
            );
            const totalSteps = stepsPerTrack[track] ?? 0;
            const completedStepIds = (progress?.completedStepIds as string[]) ?? [];
            const completedSteps = completedStepIds.length;
            const knowledgeChecksPassed = (progress?.knowledgeCheckPassed as Record<string, boolean>) ?? {};
            const snoozed = progress?.snoozed ?? false;
            const startedAt = progress?.startedAt ?? null;
            const completedAt = progress?.completedAt ?? null;
            const lastActivityAt = completedAt ?? startedAt ?? null;

            const isStalled =
              startedAt &&
              new Date(startedAt) < cutoff &&
              !completedAt &&
              completedSteps < totalSteps;

            if (!snoozed && !isStalled) return null;

            return {
              userId: u.id,
              name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email,
              email: u.email,
              role: u.role,
              track,
              totalSteps,
              completedSteps,
              completedStepIds,
              steps: stepsByTrackStuck[track] ?? [],
              knowledgeChecksPassed,
              completedAt: completedAt ? completedAt.toISOString() : null,
              startedAt: startedAt ? startedAt.toISOString() : null,
              snoozed,
              lastActivityAt,
            };
          })
          .filter(Boolean);

        res.json({ users });
      } catch (err) {
        console.error("[onboarding-flow] GET /api/onboarding/dashboard/stuck error:", err);
        res.status(500).json({ error: "Failed to fetch stuck users" });
      }
    },
  );

  /**
   * DELETE /api/onboarding/progress/:userId
   * Wipe all progress rows for a user. Admin only. Audit logged.
   */
  app.delete(
    "/api/onboarding/progress/:userId",
    requirePermission("onboarding_manage", "admin"),
    async (req: Request, res: Response) => {
      const { userId } = req.params;
      const actorId = req.session.userId!;

      try {
        await db
          .delete(userOnboardingProgress)
          .where(eq(userOnboardingProgress.userId, userId));

        await db.insert(auditLogs).values({
          actorId,
          targetId: userId,
          action: "onboarding_progress_wiped",
          changes: { wiped: true, byAdmin: actorId },
        });

        res.json({ ok: true });
      } catch (err) {
        console.error("[onboarding-flow] DELETE /api/onboarding/progress/:userId error:", err);
        res.status(500).json({ error: "Failed to wipe progress" });
      }
    },
  );

  // ── Admin step CRUD (requirePermission('onboarding_manage')) ─────────────

  /**
   * GET /api/onboarding/steps?track=manager
   * Returns ALL steps (including inactive) for a track — admin use.
   */
  app.get(
    "/api/onboarding/steps",
    requirePermission("onboarding_manage", "admin"),
    async (req: Request, res: Response) => {
      const { track } = req.query as { track?: string };

      try {
        const rows = await db
          .select()
          .from(onboardingSteps)
          .where(track ? eq(onboardingSteps.track, track as any) : undefined)
          .orderBy(asc(onboardingSteps.track), asc(onboardingSteps.stepNumber));

        res.json(rows);
      } catch (err) {
        console.error("[onboarding-flow] GET /api/onboarding/steps error:", err);
        res.status(500).json({ error: "Failed to fetch steps" });
      }
    },
  );

  /**
   * POST /api/onboarding/steps
   * Create a new step.
   */
  app.post(
    "/api/onboarding/steps",
    requirePermission("onboarding_manage", "admin"),
    async (req: Request, res: Response) => {
      const {
        track, stepNumber, title, purpose, whereToFind, navRoute, howToUse,
        importantRules, isHighRisk, commonMistake, scenario, practicalExercise,
        knowledgeCheck, whereToGetHelp,
      } = req.body;

      if (!track || stepNumber === undefined || !title) {
        return res.status(400).json({ error: "track, stepNumber, and title are required" });
      }

      try {
        const [row] = await db
          .insert(onboardingSteps)
          .values({
            track,
            stepNumber,
            title,
            purpose: purpose ?? null,
            whereToFind: whereToFind ?? null,
            navRoute: navRoute ?? null,
            howToUse: howToUse ?? null,
            importantRules: importantRules ?? [],
            isHighRisk: isHighRisk ?? false,
            commonMistake: commonMistake ?? null,
            scenario: scenario ?? null,
            practicalExercise: practicalExercise ?? null,
            knowledgeCheck: knowledgeCheck ?? null,
            whereToGetHelp: whereToGetHelp ?? null,
          })
          .returning();

        res.status(201).json(row);
      } catch (err) {
        console.error("[onboarding-flow] POST /api/onboarding/steps error:", err);
        res.status(500).json({ error: "Failed to create step" });
      }
    },
  );

  /**
   * PATCH /api/onboarding/steps/:id
   * Edit any field on a step.
   */
  app.patch(
    "/api/onboarding/steps/:id",
    requirePermission("onboarding_manage", "admin"),
    async (req: Request, res: Response) => {
      const { id } = req.params;

      const allowedFields = [
        "stepNumber", "title", "purpose", "whereToFind", "navRoute", "howToUse",
        "importantRules", "isHighRisk", "commonMistake", "scenario", "practicalExercise",
        "knowledgeCheck", "whereToGetHelp", "isActive",
      ];

      const updates: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in req.body) updates[key] = req.body[key];
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const dbUpdates: Partial<typeof onboardingSteps.$inferInsert> & { updatedAt?: Date } = {
        updatedAt: new Date(),
      };
      if ("stepNumber" in updates) dbUpdates.stepNumber = updates.stepNumber as number;
      if ("title" in updates) dbUpdates.title = updates.title as string;
      if ("purpose" in updates) dbUpdates.purpose = updates.purpose as string | null;
      if ("whereToFind" in updates) dbUpdates.whereToFind = updates.whereToFind as string | null;
      if ("navRoute" in updates) dbUpdates.navRoute = updates.navRoute as string | null;
      if ("howToUse" in updates) dbUpdates.howToUse = updates.howToUse as string | null;
      if ("importantRules" in updates) dbUpdates.importantRules = updates.importantRules;
      if ("isHighRisk" in updates) dbUpdates.isHighRisk = updates.isHighRisk as boolean;
      if ("commonMistake" in updates) dbUpdates.commonMistake = updates.commonMistake as string | null;
      if ("scenario" in updates) dbUpdates.scenario = updates.scenario as string | null;
      if ("practicalExercise" in updates) dbUpdates.practicalExercise = updates.practicalExercise as string | null;
      if ("knowledgeCheck" in updates) dbUpdates.knowledgeCheck = updates.knowledgeCheck;
      if ("whereToGetHelp" in updates) dbUpdates.whereToGetHelp = updates.whereToGetHelp as string | null;
      if ("isActive" in updates) dbUpdates.isActive = updates.isActive as boolean;

      try {
        const [row] = await db
          .update(onboardingSteps)
          .set(dbUpdates)
          .where(eq(onboardingSteps.id, id))
          .returning();

        if (!row) return res.status(404).json({ error: "Step not found" });
        res.json(row);
      } catch (err) {
        console.error("[onboarding-flow] PATCH /api/onboarding/steps/:id error:", err);
        res.status(500).json({ error: "Failed to update step" });
      }
    },
  );

  /**
   * DELETE /api/onboarding/steps/:id
   * Soft-delete — sets isActive=false.
   */
  app.delete(
    "/api/onboarding/steps/:id",
    requirePermission("onboarding_manage", "admin"),
    async (req: Request, res: Response) => {
      const { id } = req.params;

      try {
        const [row] = await db
          .update(onboardingSteps)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(onboardingSteps.id, id))
          .returning();

        if (!row) return res.status(404).json({ error: "Step not found" });
        res.json({ ok: true, id: row.id });
      } catch (err) {
        console.error("[onboarding-flow] DELETE /api/onboarding/steps/:id error:", err);
        res.status(500).json({ error: "Failed to delete step" });
      }
    },
  );

  /**
   * POST /api/onboarding/steps/reorder
   * Body: { orderedIds: string[] } — ordered list of step IDs for a track.
   * Updates stepNumber for each ID to match its 1-indexed position.
   */
  app.post(
    "/api/onboarding/steps/reorder",
    requirePermission("onboarding_manage", "admin"),
    async (req: Request, res: Response) => {
      const { orderedIds } = req.body as { orderedIds?: string[] };

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ error: "orderedIds array is required" });
      }

      try {
        await Promise.all(
          orderedIds.map((id, idx) =>
            db
              .update(onboardingSteps)
              .set({ stepNumber: idx + 1, updatedAt: new Date() })
              .where(eq(onboardingSteps.id, id)),
          ),
        );

        res.json({ ok: true, count: orderedIds.length });
      } catch (err) {
        console.error("[onboarding-flow] POST /api/onboarding/steps/reorder error:", err);
        res.status(500).json({ error: "Failed to reorder steps" });
      }
    },
  );

  /**
   * GET /api/onboarding/command-card
   * Returns structured JSON for the Manager Command Card.
   * Content: probation cadence, PIP weekly rule, 3-strike escalation,
   * correction window, leave LWP warning, outcome options, SOP enforcement
   * levels, training compliance lock trigger.
   * Gate: requireAuth (any authenticated user — managers use it, HR should
   * also be able to reference it).
   */
  app.get("/api/onboarding/command-card", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;

    res.json({
      probationCadence: {
        title: "Probation Check-in Cadence",
        description: "8 check-ins auto-generated from the plan start date.",
        days: [1, 7, 15, 30, 45, 60, 75, 90],
        formalMilestoneDays: [30, 60, 90],
        note: "Days 30, 60, and 90 are formal milestone reviews requiring a rating score.",
      },
      pipRule: {
        title: "PIP Check-in Rule",
        description:
          "PIP plans auto-generate weekly check-ins for the full plan duration. Miss none — each missed check-in counts toward the 3-strike escalation.",
      },
      threeStrikeEscalation: {
        title: "3-Strike Escalation",
        description:
          "If 3 consecutive check-ins are missed on any plan, the plan status is escalated and an escalation notification is sent to HR. Avoid missing check-ins — escalations are visible to HR and executive leadership.",
        trigger: "3 consecutive missed check-ins on a probation or PIP plan",
        consequence: "Plan escalated; HR notified automatically",
      },
      correctionWindow: {
        title: "Attendance Correction Window",
        description:
          "Corrections can only be made within 3 calendar days of the attendance date. Beyond 3 days, the employee must raise a regularization ticket via Help Desk; HR then reviews and applies the correction.",
        windowDays: 3,
        beyondWindow:
          "Employee raises regularization ticket → HR review queue",
      },
      leaveLwpWarning: {
        title: "Leave LWP Warning",
        description:
          "Always check the LWP component before approving a leave request. If the employee applied for more days than their EL/SL balance allows, the deficit automatically becomes Leave Without Pay (LWP). Approving the request locks in the LWP deduction — there is no undo button for managers.",
        checkBefore: "Review the EL portion and LWP portion in the request summary",
        undoPath: "Escalate to HR to reverse an incorrectly approved request",
      },
      planOutcomes: {
        title: "Plan Outcome Options",
        description:
          "Available outcomes to set on a probation or PIP plan. Outcome is locked after setting.",
        options: [
          { value: "passed", label: "Passed", description: "Employee completes the plan successfully." },
          { value: "extended", label: "Extended", description: "Plan duration is extended; new check-ins are generated." },
          { value: "failed", label: "Failed", description: "Employee did not meet the plan criteria." },
          { value: "converted", label: "Converted to Growth", description: "Probation converts to a Growth plan." },
          { value: "terminated", label: "Terminated", description: "Employment is terminated at the end of the plan." },
        ],
      },
      sopEnforcementLevels: {
        title: "SOP Enforcement Levels",
        description:
          "Enforcement level is set per rollout wave and determines what happens when a user misses an SOP acknowledgment or training deadline.",
        levels: [
          {
            value: "soft",
            label: "Soft",
            description: "Warning banner shown on dashboard. Portal access unrestricted.",
          },
          {
            value: "measured",
            label: "Measured",
            description: "Prominent warning shown. Access unrestricted.",
          },
          {
            value: "full",
            label: "Full",
            description:
              "Compliance lock activates if deadline is missed. Portal access blocked until overdue items are completed or HR grants an exception.",
          },
        ],
      },
      trainingComplianceLock: {
        title: "Training Compliance Lock Trigger",
        description:
          "Two conditions must BOTH be true for a compliance lock to activate:",
        conditions: [
          "Training is past its due date",
          "The employee's rollout wave is set to 'full' enforcement",
        ],
        resolution:
          "Complete the overdue training (restores access immediately) OR ask HR to grant a training exception.",
        managerNote:
          "You cannot clear a lock for a team member yourself. Submit a training extension request to HR.",
      },
    });
  });

  /**
   * GET /api/onboarding/steps/export?track=manager[&format=pdf]
   *
   * Two modes:
   *   • JSON mode (no `format` param, requires onboarding_manage permission):
   *     Returns all active steps as JSON — used by the admin content editor.
   *   • PDF mode (`format=pdf`, any authenticated user):
   *     Validates that the requested `track` is accessible by the session role,
   *     generates a branded PDF guide, and streams it as a file download.
   *     admin/super_admin receive the merged hr+admin guide regardless of the
   *     track param they pass.
   *
   * This is the completion-screen download endpoint — replaces any static
   * printed or shared guides. Always reflects current portal content.
   */
  app.get(
    "/api/onboarding/steps/export",
    async (req: Request, res: Response) => {
      if (!requireAuth(req, res)) return;

      const { track, format } = req.query as { track?: string; format?: string };
      const role = req.session.role!;

      if (!track) {
        return res.status(400).json({ error: "track query param is required" });
      }

      // ── PDF mode: any authenticated user for their own track ──────────────
      if (format === "pdf") {
        // Validate: the requested track must be accessible to the session role.
        // admin/super_admin can request 'hr' or 'admin' (they see both merged).
        const validTracksForRole: Record<string, string[]> = {
          employee:    ["employee"],
          manager:     ["manager"],
          hr:          ["hr"],
          admin:       ["hr", "admin"],
          super_admin: ["hr", "admin"],
          executive:   ["executive"],
        };
        const allowed = validTracksForRole[role] ?? ["employee"];
        if (!allowed.includes(track)) {
          return res.status(403).json({ error: "You cannot export a guide for that track" });
        }

        try {
          // admin/super_admin get the merged hr+admin guide (full 8-step set).
          // All other roles get just their own track.
          const { steps, track: resolvedTrack } = hasAdminAdditions(role)
            ? await fetchStepsForRole(role)
            : {
                steps: await db
                  .select()
                  .from(onboardingSteps)
                  .where(and(eq(onboardingSteps.track, track as any), eq(onboardingSteps.isActive, true)))
                  .orderBy(asc(onboardingSteps.stepNumber)),
                track,
              };

          if (steps.length === 0) {
            return res.status(404).json({ error: "No onboarding steps found for your role" });
          }

          const pdfBuffer = await generateOnboardingGuidePdf(steps, resolvedTrack);
          const trackLabel = resolvedTrack.charAt(0).toUpperCase() + resolvedTrack.slice(1);
          const filename = `HIS-Onboarding-Guide-${trackLabel}-${new Date().toISOString().slice(0, 10)}.pdf`;

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          res.setHeader("Content-Length", pdfBuffer.length);
          return res.send(pdfBuffer);
        } catch (err) {
          console.error("[onboarding-flow] GET /api/onboarding/steps/export PDF error:", err);
          return res.status(500).json({ error: "Failed to generate onboarding guide PDF" });
        }
      }

      // ── JSON mode: admin content editor (requires onboarding_manage) ──────
      const allowed = resolveRoles("onboarding_manage", ["super_admin", "admin"]);
      if (!allowed.includes(role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      try {
        const rows = await db
          .select()
          .from(onboardingSteps)
          .where(and(eq(onboardingSteps.track, track as any), eq(onboardingSteps.isActive, true)))
          .orderBy(asc(onboardingSteps.stepNumber));

        res.json(rows);
      } catch (err) {
        console.error("[onboarding-flow] GET /api/onboarding/steps/export error:", err);
        res.status(500).json({ error: "Failed to export steps" });
      }
    },
  );
}

