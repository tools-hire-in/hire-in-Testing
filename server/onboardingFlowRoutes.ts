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
 *   GET    /api/onboarding/steps/export        – export steps; add ?format=pdf for PDF download
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
import { onboardingSteps, userOnboardingProgress, adminUsers, auditLogs } from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { resolveRoles } from "@shared/accessControl";
import PDFDocument from "pdfkit";
import type { OnboardingStep } from "@shared/schema";

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
   * GET /api/onboarding/steps/export?track=manager[&format=pdf]
   * Returns all active steps for a track.
   * Without format=pdf: returns JSON.
   * With format=pdf: generates and streams a formatted PDF guide.
   */
  app.get(
    "/api/onboarding/steps/export",
    requirePermission("onboarding_manage", "admin"),
    async (req: Request, res: Response) => {
      const { track, format } = req.query as { track?: string; format?: string };

      if (!track) {
        return res.status(400).json({ error: "track query param is required" });
      }

      try {
        const rows = await db
          .select()
          .from(onboardingSteps)
          .where(and(eq(onboardingSteps.track, track as any), eq(onboardingSteps.isActive, true)))
          .orderBy(asc(onboardingSteps.stepNumber));

        if (format !== "pdf") {
          return res.json(rows);
        }

        const pdfBuffer = await generateOnboardingGuidePdf(track, rows);
        const dateStr = new Date().toISOString().split("T")[0];
        const filename = `${track}-onboarding-guide-${dateStr}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        res.end(pdfBuffer);
      } catch (err) {
        console.error("[onboarding-flow] GET /api/onboarding/steps/export error:", err);
        res.status(500).json({ error: "Failed to export steps" });
      }
    },
  );
}

// ── PDF generation ────────────────────────────────────────────────────────────

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const RED_RISK = "#B91C1C";
const AMBER_BOX = "#92400E";
const MUTED = "#6B7280";
const TEXT = "#111827";

const TRACK_LABELS: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR / Admin",
  executive: "Executive",
  admin: "Admin / Super Admin",
};

function generateOnboardingGuidePdf(track: string, steps: OnboardingStep[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new (PDFDocument as any)({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 60, right: 60 },
      autoFirstPage: false,
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = 595.28 - 60 - 60;
    const exportDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const trackLabel = TRACK_LABELS[track] ?? track.charAt(0).toUpperCase() + track.slice(1);
    const guideTitle = `${trackLabel} Track — Portal Onboarding Guide`;

    // ── Cover page ────────────────────────────────────────────────────────────
    doc.addPage();
    doc.rect(0, 0, 595.28, 180).fill(NAVY);
    doc.fillColor("#FFFFFF").fontSize(22).font("Helvetica-Bold")
      .text(guideTitle, 60, 60, { width: 475 });
    doc.fillColor("#CBD5E1").fontSize(11).font("Helvetica")
      .text(`Generated on ${exportDate}  ·  ${steps.length} step${steps.length !== 1 ? "s" : ""}`, 60, 110);
    doc.fillColor(MUTED).fontSize(9).font("Helvetica")
      .text("This guide is always generated from the current live content. Re-download after any updates.", 60, 145, { width: 475 });

    doc.moveDown(8);
    doc.fillColor(TEXT).fontSize(10).font("Helvetica")
      .text("Contents", 60, 200, { underline: true, continued: false });
    doc.moveDown(0.5);
    steps.forEach((s, i) => {
      const prefix = s.isHighRisk ? "⚠ " : "";
      doc.fillColor(TEXT).fontSize(9.5).font("Helvetica")
        .text(`${i + 1}.  ${prefix}${s.title}`, 60, undefined, { width: pageW });
    });

    // ── One page per step ─────────────────────────────────────────────────────
    steps.forEach((step) => {
      doc.addPage();

      let y = 56;

      // Step header bar
      doc.rect(0, 0, 595.28, 48).fill(NAVY);
      doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica")
        .text(`Step ${step.stepNumber}  ·  ${trackLabel} Track`, 60, 12);
      doc.fillColor("#FFFFFF").fontSize(13).font("Helvetica-Bold")
        .text(step.title, 60, 26, { width: 400 });

      if (step.isHighRisk) {
        doc.rect(460, 8, 80, 18).fill(RED_RISK);
        doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold")
          .text("HIGH RISK", 462, 13);
      }

      y = 68;

      const section = (label: string, color = NAVY) => {
        doc.fillColor(color).fontSize(8).font("Helvetica-Bold")
          .text(label.toUpperCase(), 60, y, { width: pageW });
        y = (doc as any).y + 3;
        doc.moveTo(60, y).lineTo(60 + pageW, y).strokeColor(color).lineWidth(0.5).stroke();
        y += 6;
      };

      const body = (text: string, opts?: object) => {
        doc.fillColor(TEXT).fontSize(9.5).font("Helvetica")
          .text(text, 60, y, { width: pageW, lineGap: 2, ...opts });
        y = (doc as any).y + 8;
      };

      const ensureSpace = (needed: number) => {
        if (y + needed > 780) {
          doc.addPage();
          y = 56;
        }
      };

      // Purpose
      if (step.purpose) {
        ensureSpace(40);
        section("Purpose");
        body(step.purpose);
      }

      // Where to find
      if (step.whereToFind) {
        ensureSpace(30);
        section("Where to Find It");
        const locText = step.navRoute ? `${step.whereToFind}  (${step.navRoute})` : step.whereToFind;
        body(locText);
      }

      // How to use
      if (step.howToUse) {
        ensureSpace(40);
        section("How to Use It");
        const plainText = step.howToUse.replace(/\*\*(.+?)\*\*/g, "$1").replace(/#+\s/g, "").replace(/`([^`]+)`/g, "$1");
        body(plainText);
      }

      // Important rules
      const rules = Array.isArray(step.importantRules) ? step.importantRules as string[] : [];
      if (rules.length > 0) {
        ensureSpace(40);
        section("Important Rules");
        rules.forEach((rule) => {
          ensureSpace(20);
          doc.fillColor(TEXT).fontSize(9.5).font("Helvetica")
            .text(`•  ${rule}`, 68, y, { width: pageW - 8, lineGap: 2 });
          y = (doc as any).y + 5;
        });
        y += 3;
      }

      // Common mistake (HIGH RISK only)
      if (step.isHighRisk && step.commonMistake) {
        ensureSpace(50);
        doc.rect(60, y, pageW, 1).fill(AMBER_BOX);
        y += 4;
        doc.rect(60, y, pageW, 14).fill("#FEF3C7");
        doc.fillColor(AMBER_BOX).fontSize(7.5).font("Helvetica-Bold")
          .text("⚠  COMMON MISTAKE", 64, y + 3);
        y += 18;
        doc.fillColor(AMBER_BOX).fontSize(9.5).font("Helvetica")
          .text(step.commonMistake, 64, y, { width: pageW - 8, lineGap: 2 });
        y = (doc as any).y + 10;
      }

      // Scenario
      if (step.scenario) {
        ensureSpace(50);
        section("Scenario");
        const plainScenario = step.scenario.replace(/\*\*(.+?)\*\*/g, "$1").replace(/#+\s/g, "");
        doc.rect(60, y, pageW, (doc.heightOfString(plainScenario, { width: pageW - 8 }) || 60) + 12)
          .fillAndStroke("#F9FAFB", "#E5E7EB");
        y += 6;
        body(plainScenario);
      }

      // Practical exercise
      if (step.practicalExercise) {
        ensureSpace(50);
        section("Practical Exercise", "#1D4ED8");
        const plainEx = step.practicalExercise.replace(/\*\*(.+?)\*\*/g, "$1").replace(/#+\s/g, "");
        body(plainEx);
      }

      // Knowledge check
      const kc = Array.isArray(step.knowledgeCheck) ? step.knowledgeCheck as Array<{ question: string; answer: string }> : null;
      if (kc && kc.length > 0) {
        ensureSpace(50);
        section("Knowledge Check");
        kc.forEach((item, qi) => {
          ensureSpace(30);
          doc.fillColor(TEXT).fontSize(9.5).font("Helvetica-Bold")
            .text(`Q${qi + 1}: ${item.question}`, 60, y, { width: pageW });
          y = (doc as any).y + 3;
          doc.fillColor(MUTED).fontSize(9.5).font("Helvetica")
            .text(`Answer: ${item.answer}`, 68, y, { width: pageW - 8, lineGap: 2 });
          y = (doc as any).y + 8;
        });
      }

      // Where to get help
      if (step.whereToGetHelp) {
        ensureSpace(30);
        section("Where to Get Help");
        body(step.whereToGetHelp);
      }
    });

    // ── Page footers ──────────────────────────────────────────────────────────
    const totalPages = (doc as any).bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fillColor(MUTED).fontSize(8).font("Helvetica")
        .text(`${guideTitle}  ·  ${exportDate}  ·  Page ${i + 1} of ${totalPages}`,
          60, 820, { width: pageW, align: "center" });
    }

    doc.end();
  });
}
