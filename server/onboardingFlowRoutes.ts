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
 *   GET    /api/onboarding/steps/export        – export steps for PDF gen (?track=)
 *
 * Role → track mapping (aligned with source doc target audiences):
 *   employee              → "employee" track
 *   manager               → "manager"  track
 *   hr / admin / super_admin → "hr"   track  (HR/Admin source doc covers all three)
 *   executive             → "executive" track
 *   The "admin" enum value is reserved in onboarding_track for a future
 *   admin-specific track if the content ever diverges from the hr track.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { onboardingSteps, userOnboardingProgress } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { resolveRoles } from "@shared/accessControl";

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
 * Map a portal role to its onboarding track.
 *
 * hr, admin, and super_admin all receive the "hr" track — the HR/Admin source
 * document (docs/training/hr-admin-onboarding-track-source.md) explicitly
 * covers all three roles in a single shared track.
 */
function roleToTrack(role: string): string {
  switch (role) {
    case "employee":  return "employee";
    case "manager":   return "manager";
    case "hr":
    case "admin":
    case "super_admin": return "hr";
    case "executive": return "executive";
    default:          return "employee";
  }
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerOnboardingFlowRoutes(app: Express) {

  // ── Progress routes (any authenticated user) ─────────────────────────────

  /**
   * GET /api/onboarding/progress
   * Returns the steps for the user's current role-track merged with their
   * completion state. Single call — the client needs no second request.
   */
  app.get("/api/onboarding/progress", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const userId = req.session.userId!;
    const role = req.session.role!;
    const track = roleToTrack(role);

    try {
      const steps = await db
        .select()
        .from(onboardingSteps)
        .where(and(eq(onboardingSteps.track, track as any), eq(onboardingSteps.isActive, true)))
        .orderBy(asc(onboardingSteps.stepNumber));

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
      const [step] = await db
        .select({ id: onboardingSteps.id })
        .from(onboardingSteps)
        .where(eq(onboardingSteps.id, stepId));

      if (!step) return res.status(404).json({ error: "Step not found" });

      const [existing] = await db
        .select()
        .from(userOnboardingProgress)
        .where(and(eq(userOnboardingProgress.userId, userId), eq(userOnboardingProgress.role, role)));

      if (!existing) {
        const completedStepIds = [stepId];
        const kcPassed: Record<string, boolean> = {};
        if (knowledgeCheckPassed !== undefined) kcPassed[stepId] = knowledgeCheckPassed;
        await db.insert(userOnboardingProgress).values({
          userId,
          role,
          completedStepIds,
          knowledgeCheckPassed: kcPassed,
        });
      } else {
        const completedIds: string[] = (existing.completedStepIds as string[]) ?? [];
        if (!completedIds.includes(stepId)) completedIds.push(stepId);
        const kcPassed = (existing.knowledgeCheckPassed as Record<string, boolean>) ?? {};
        if (knowledgeCheckPassed !== undefined) kcPassed[stepId] = knowledgeCheckPassed;

        await db
          .update(userOnboardingProgress)
          .set({ completedStepIds: completedIds, knowledgeCheckPassed: kcPassed })
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
   * GET /api/onboarding/steps/export?track=manager
   * Returns all active steps for a track — used by PDF generation.
   */
  app.get(
    "/api/onboarding/steps/export",
    requirePermission("onboarding_manage", "admin"),
    async (req: Request, res: Response) => {
      const { track } = req.query as { track?: string };

      if (!track) {
        return res.status(400).json({ error: "track query param is required" });
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
