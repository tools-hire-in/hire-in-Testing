import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  learningTracks, trackSections, sectionQuizQuestions, sectionQuizOptions,
  trackAssignments, sectionProgress, sectionAcknowledgements, trackCompletions, onboardingAuditEvents,
  systemSettings, trainingExtensionRequests, adminUsers, attendance,
} from "@shared/schema";
import { eq, and, inArray, sql, isNull, lt, ne } from "drizzle-orm";
import crypto from "crypto";
import { seedOnboardingContent, seedSectionAdditions } from "./onboardingSeed";
import {
  isRayoEnabled, getRayoTracks, getRayoUserAssignments, assignRayoTrack,
  getRayoTeamProgress, getRayoComplianceStatus, getRayoTrackProgress,
  getRayoCertificates, provisionRayoUser,
} from "./rayoAcademyClient";

const ADMIN_ROLES = ["super_admin", "admin", "hr", "manager", "operations"];
const HR_ROLES = ["super_admin", "admin", "hr"];

function requireOnboardingAccess(req: Request, res: Response): boolean {
  const role = req.session.role;
  if (!role) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

async function isFeatureEnabledOrAdmin(role: string): Promise<boolean> {
  if (ADMIN_ROLES.includes(role)) return true;
  const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, "onboarding_training_enabled"));
  return setting?.value === true;
}

async function appendAuditEvent(userId: string, eventType: string, meta: Record<string, any>) {
  await db.insert(onboardingAuditEvents).values({
    userId,
    trackId: meta.trackId,
    sectionId: meta.sectionId,
    assignmentId: meta.assignmentId,
    eventType,
    metadata: meta,
  });
}

export function registerOnboardingRoutes(app: Express) {

  // ==========================================
  // TRACK MANAGEMENT (admin/hr/manager)
  // ==========================================

  app.get("/api/onboarding/tracks", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    const role = req.session.role!;
    const enabled = await isFeatureEnabledOrAdmin(role);
    if (!enabled) return res.status(403).json({ error: "Training module not enabled" });

    try {
      const isAdmin = ADMIN_ROLES.includes(role);
      const rows = await db.select().from(learningTracks)
        .where(isAdmin ? undefined : eq(learningTracks.status, "published"))
        .orderBy(learningTracks.createdAt);

      // For each track, get section count and assignment count
      const enriched = await Promise.all(rows.map(async (track) => {
        const [sectionCount] = await db.select({ count: sql<number>`count(*)::int` })
          .from(trackSections).where(eq(trackSections.trackId, track.id));
        const [assignCount] = await db.select({ count: sql<number>`count(*)::int` })
          .from(trackAssignments).where(eq(trackAssignments.trackId, track.id));
        return { ...track, sectionCount: sectionCount?.count ?? 0, assignmentCount: assignCount?.count ?? 0 };
      }));

      res.json(enriched);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch tracks" });
    }
  });

  app.post("/api/onboarding/tracks", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    const role = req.session.role!;
    if (!ADMIN_ROLES.includes(role)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { title, description, targetRole, targetDepartmentId, version } = req.body;
      const [track] = await db.insert(learningTracks).values({
        title, description, targetRole: targetRole || null, targetDepartmentId: targetDepartmentId || null,
        version: version || "1.0", status: "draft", createdBy: req.session.userId!,
      }).returning();

      await appendAuditEvent(req.session.userId!, "track_created", { trackId: track.id, title });
      res.json(track);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create track" });
    }
  });

  app.patch("/api/onboarding/tracks/:id", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    const role = req.session.role!;
    if (!ADMIN_ROLES.includes(role)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { id } = req.params as { id: string };
      const { title, description, targetRole, targetDepartmentId, version, status } = req.body;
      const [updated] = await db.update(learningTracks)
        .set({ title, description, targetRole, targetDepartmentId, version, status, updatedAt: new Date() })
        .where(eq(learningTracks.id, id)).returning();

      if (status === "published") {
        await appendAuditEvent(req.session.userId!, "track_published", { trackId: id });
      }
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update track" });
    }
  });

  app.delete("/api/onboarding/tracks/:id", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!HR_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { id } = req.params as { id: string };
      await db.update(learningTracks).set({ status: "archived", updatedAt: new Date() })
        .where(eq(learningTracks.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to archive track" });
    }
  });

  // ==========================================
  // SECTIONS
  // ==========================================

  app.get("/api/onboarding/tracks/:id/sections", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    const enabled = await isFeatureEnabledOrAdmin(req.session.role!);
    if (!enabled) return res.status(403).json({ error: "Training module not enabled" });

    try {
      const { id } = req.params as { id: string };
      const sections = await db.select().from(trackSections)
        .where(eq(trackSections.trackId, id))
        .orderBy(trackSections.orderIndex);

      // Include quiz questions + options for each section
      const enriched = await Promise.all(sections.map(async (section) => {
        const [question] = await db.select().from(sectionQuizQuestions)
          .where(eq(sectionQuizQuestions.sectionId, section.id));
        if (question) {
          const options = await db.select().from(sectionQuizOptions)
            .where(eq(sectionQuizOptions.questionId, question.id))
            .orderBy(sectionQuizOptions.orderIndex);
          return { ...section, quiz: { ...question, options } };
        }
        return { ...section, quiz: null };
      }));

      res.json(enriched);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch sections" });
    }
  });

  app.post("/api/onboarding/tracks/:id/sections", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { id } = req.params as { id: string };
      const { title, body, orderIndex, minDwellSeconds, estimatedMinutes } = req.body;
      const [section] = await db.insert(trackSections).values({
        trackId: id, title, body: body || "", orderIndex: orderIndex ?? 0,
        minDwellSeconds: minDwellSeconds ?? 30, estimatedMinutes: estimatedMinutes ?? 5,
      }).returning();
      res.json(section);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create section" });
    }
  });

  app.patch("/api/onboarding/sections/:id", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { id } = req.params as { id: string };
      const { title, body, orderIndex, minDwellSeconds, estimatedMinutes } = req.body;
      const [updated] = await db.update(trackSections)
        .set({ title, body, orderIndex, minDwellSeconds, estimatedMinutes })
        .where(eq(trackSections.id, id)).returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update section" });
    }
  });

  app.delete("/api/onboarding/sections/:id", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { id } = req.params as { id: string };
      await db.delete(trackSections).where(eq(trackSections.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete section" });
    }
  });

  // Upsert quiz question for a section
  app.put("/api/onboarding/sections/:sectionId/quiz", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { sectionId } = req.params as { sectionId: string };
      const { questionText, explanation, options } = req.body;

      // Upsert question
      let question: any;
      const [existing] = await db.select().from(sectionQuizQuestions)
        .where(eq(sectionQuizQuestions.sectionId, sectionId));

      if (existing) {
        [question] = await db.update(sectionQuizQuestions)
          .set({ questionText, explanation })
          .where(eq(sectionQuizQuestions.id, existing.id)).returning();
      } else {
        [question] = await db.insert(sectionQuizQuestions)
          .values({ sectionId, questionText, explanation }).returning();
      }

      // Replace options
      if (Array.isArray(options)) {
        await db.delete(sectionQuizOptions).where(eq(sectionQuizOptions.questionId, question.id));
        if (options.length > 0) {
          await db.insert(sectionQuizOptions).values(
            options.map((o: any, i: number) => ({
              questionId: question.id,
              optionText: o.optionText,
              isCorrect: !!o.isCorrect,
              orderIndex: i,
            }))
          );
        }
      }

      const freshOptions = await db.select().from(sectionQuizOptions)
        .where(eq(sectionQuizOptions.questionId, question.id))
        .orderBy(sectionQuizOptions.orderIndex);

      res.json({ ...question, options: freshOptions });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save quiz" });
    }
  });

  // ==========================================
  // ASSIGNMENTS
  // ==========================================

  app.post("/api/onboarding/tracks/:id/assign", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { id } = req.params as { id: string };
      const { userIds, dueDate } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "userIds is required" });
      }

      const results = [];
      for (const userId of userIds) {
        // Check if already assigned
        const [existing] = await db.select().from(trackAssignments)
          .where(and(eq(trackAssignments.trackId, id), eq(trackAssignments.userId, userId)));
        if (existing) {
          results.push({ userId, status: "already_assigned", assignment: existing });
          continue;
        }

        const autoDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
        const [assignment] = await db.insert(trackAssignments).values({
          trackId: id, userId, assignedBy: req.session.userId!,
          dueDate: dueDate ? new Date(dueDate) : autoDate,
          status: "not_started",
        }).returning();

        await appendAuditEvent(req.session.userId!, "track_assigned", {
          trackId: id, assignmentId: assignment.id, assignedTo: userId,
        });
        results.push({ userId, status: "assigned", assignment });
      }

      res.json({ results });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to assign track" });
    }
  });

  app.get("/api/onboarding/my-training-alerts", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    const enabled = await isFeatureEnabledOrAdmin(req.session.role!);
    if (!enabled) return res.json({ overdue: 0, dueSoon: 0, total: 0 });

    try {
      const userId = req.session.userId!;
      const now = new Date();
      const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const rows = await db.select().from(trackAssignments)
        .where(eq(trackAssignments.userId, userId));

      const active = rows.filter(a => a.status !== "completed" && a.dueDate);
      const overdue = active.filter(a => new Date(a.dueDate!) < now).length;
      const dueSoon = active.filter(a => {
        const d = new Date(a.dueDate!);
        return d >= now && d <= in3days;
      }).length;

      res.json({ overdue, dueSoon, total: overdue + dueSoon });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training alerts" });
    }
  });

  app.get("/api/onboarding/my-assignments", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    const enabled = await isFeatureEnabledOrAdmin(req.session.role!);
    if (!enabled) return res.status(403).json({ error: "Training module not enabled" });

    try {
      const userId = req.session.userId!;
      const assignments = await db.select({
        assignment: trackAssignments,
        track: learningTracks,
      }).from(trackAssignments)
        .innerJoin(learningTracks, eq(learningTracks.id, trackAssignments.trackId))
        .where(eq(trackAssignments.userId, userId));

      const enriched = await Promise.all(assignments.map(async ({ assignment, track }) => {
        const sections = await db.select({ id: trackSections.id })
          .from(trackSections).where(eq(trackSections.trackId, track.id));
        const total = sections.length;
        const completedProgress = await db.select().from(sectionProgress)
          .where(and(
            eq(sectionProgress.assignmentId, assignment.id),
            eq(sectionProgress.status, "completed")
          ));
        return {
          ...assignment,
          track,
          totalSections: total,
          completedSections: completedProgress.length,
          progressPct: total > 0 ? Math.round((completedProgress.length / total) * 100) : 0,
        };
      }));

      res.json(enriched);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  app.get("/api/onboarding/assignments/:id", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    const enabled = await isFeatureEnabledOrAdmin(req.session.role!);
    if (!enabled) return res.status(403).json({ error: "Training module not enabled" });

    try {
      const { id } = req.params as { id: string };
      const userId = req.session.userId!;
      const role = req.session.role!;

      const [assignment] = await db.select().from(trackAssignments)
        .where(eq(trackAssignments.id, id));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });

      // Must be owner or admin/hr/manager
      if (assignment.userId !== userId && !ADMIN_ROLES.includes(role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const sections = await db.select().from(trackSections)
        .where(eq(trackSections.trackId, assignment.trackId))
        .orderBy(trackSections.orderIndex);

      const progressRows = await db.select().from(sectionProgress)
        .where(eq(sectionProgress.assignmentId, id));

      const ackRows = await db.select().from(sectionAcknowledgements)
        .where(eq(sectionAcknowledgements.assignmentId, id));

      const sectionsWithProgress = await Promise.all(sections.map(async (section) => {
        const progress = progressRows.find(p => p.sectionId === section.id) || null;
        const ack = ackRows.find(a => a.sectionId === section.id) || null;
        const [question] = await db.select().from(sectionQuizQuestions)
          .where(eq(sectionQuizQuestions.sectionId, section.id));
        if (question) {
          const options = await db.select().from(sectionQuizOptions)
            .where(eq(sectionQuizOptions.questionId, question.id))
            .orderBy(sectionQuizOptions.orderIndex);
          return { ...section, quiz: { ...question, options }, progress, acknowledgement: ack };
        }
        return { ...section, quiz: null, progress, acknowledgement: ack };
      }));

      const [track] = await db.select().from(learningTracks)
        .where(eq(learningTracks.id, assignment.trackId));

      res.json({ assignment, track, sections: sectionsWithProgress });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch assignment" });
    }
  });

  // ==========================================
  // EMPLOYEE PROGRESS
  // ==========================================

  // Mark section started / update dwell time
  app.post("/api/onboarding/progress/:assignmentId/:sectionId/view", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;

    try {
      const { assignmentId, sectionId } = req.params as { assignmentId: string; sectionId: string };
      const userId = req.session.userId!;

      const [existing] = await db.select().from(sectionProgress)
        .where(and(eq(sectionProgress.assignmentId, assignmentId), eq(sectionProgress.sectionId, sectionId)));

      if (!existing) {
        await db.insert(sectionProgress).values({
          assignmentId, sectionId, userId, status: "in_progress",
          dwellSeconds: 0, lastViewedAt: new Date(),
        });
        // Also mark assignment as in_progress if it was not_started
        await db.update(trackAssignments)
          .set({ status: "in_progress" })
          .where(and(eq(trackAssignments.id, assignmentId), eq(trackAssignments.status, "not_started")));

        await appendAuditEvent(userId, "section_viewed", { assignmentId, sectionId });
      } else {
        await db.update(sectionProgress)
          .set({ lastViewedAt: new Date() })
          .where(eq(sectionProgress.id, existing.id));
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to record view" });
    }
  });

  // Update dwell time
  app.post("/api/onboarding/progress/:assignmentId/:sectionId/dwell", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;

    try {
      const { assignmentId, sectionId } = req.params as { assignmentId: string; sectionId: string };
      const { seconds } = req.body;

      await db.update(sectionProgress)
        .set({ dwellSeconds: seconds, lastViewedAt: new Date() })
        .where(and(eq(sectionProgress.assignmentId, assignmentId), eq(sectionProgress.sectionId, sectionId)));

      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update dwell" });
    }
  });

  // Submit quiz answer
  app.post("/api/onboarding/progress/:assignmentId/:sectionId/quiz", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;

    try {
      const { assignmentId, sectionId } = req.params as { assignmentId: string; sectionId: string };
      const userId = req.session.userId!;
      const { optionId } = req.body;

      const [question] = await db.select().from(sectionQuizQuestions)
        .where(eq(sectionQuizQuestions.sectionId, sectionId));
      if (!question) return res.status(404).json({ error: "No quiz for this section" });

      const options = await db.select().from(sectionQuizOptions)
        .where(eq(sectionQuizOptions.questionId, question.id));
      const selected = options.find(o => o.id === optionId);
      const correct = options.find(o => o.isCorrect);
      const isCorrect = selected?.isCorrect === true;

      // Increment attempts
      const [progress] = await db.select().from(sectionProgress)
        .where(and(eq(sectionProgress.assignmentId, assignmentId), eq(sectionProgress.sectionId, sectionId)));

      const newAttempts = (progress?.quizAttempts ?? 0) + 1;
      const passed = isCorrect || newAttempts >= 3; // allow pass after 3 attempts (show answer)

      await db.update(sectionProgress)
        .set({ quizAttempts: newAttempts, quizPassed: passed })
        .where(and(eq(sectionProgress.assignmentId, assignmentId), eq(sectionProgress.sectionId, sectionId)));

      await appendAuditEvent(userId, "quiz_answered", {
        assignmentId, sectionId, optionId, isCorrect, attempt: newAttempts,
      });

      res.json({
        isCorrect,
        passed,
        attempts: newAttempts,
        explanation: question.explanation,
        correctOptionId: passed ? correct?.id : undefined,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to submit quiz" });
    }
  });

  // Section acknowledgement (sign-off)
  app.post("/api/onboarding/progress/:assignmentId/:sectionId/acknowledge", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;

    try {
      const { assignmentId, sectionId } = req.params as { assignmentId: string; sectionId: string };
      const userId = req.session.userId!;
      const { typedName } = req.body;

      if (!typedName) return res.status(400).json({ error: "typedName is required" });

      // Get section body for hash
      const [section] = await db.select().from(trackSections).where(eq(trackSections.id, sectionId));
      if (!section) return res.status(404).json({ error: "Section not found" });

      const documentHash = crypto.createHash("sha256").update(section.body).digest("hex");
      const ip = req.ip || req.socket?.remoteAddress || "";

      // Insert ack (may already exist — idempotent upsert by checking)
      const [existingAck] = await db.select().from(sectionAcknowledgements)
        .where(and(eq(sectionAcknowledgements.assignmentId, assignmentId), eq(sectionAcknowledgements.sectionId, sectionId)));

      if (!existingAck) {
        await db.insert(sectionAcknowledgements).values({
          assignmentId, sectionId, userId, typedName, documentHash, ipAddress: ip,
        });
      }

      // Mark section progress completed
      await db.update(sectionProgress)
        .set({ status: "completed", completedAt: new Date() })
        .where(and(eq(sectionProgress.assignmentId, assignmentId), eq(sectionProgress.sectionId, sectionId)));

      await appendAuditEvent(userId, "section_acknowledged", { assignmentId, sectionId, typedName, documentHash });

      // Auto-complete: check if all sections for this track are now acknowledged
      let autoCompleted = false;
      let autoReceiptHash = "";
      let autoReceiptData: any = null;
      try {
        const [assignment] = await db.select().from(trackAssignments)
          .where(eq(trackAssignments.id, assignmentId));
        if (assignment && assignment.status !== "completed") {
          const allSections = await db.select().from(trackSections)
            .where(eq(trackSections.trackId, assignment.trackId));
          const allAcks = await db.select().from(sectionAcknowledgements)
            .where(eq(sectionAcknowledgements.assignmentId, assignmentId));

          if (allAcks.length >= allSections.length) {
            const allHashes = allAcks.sort((a, b) => a.sectionId.localeCompare(b.sectionId))
              .map(a => a.documentHash || "").join("|");
            autoReceiptHash = crypto.createHash("sha256").update(allHashes).digest("hex");

            autoReceiptData = {
              trackId: assignment.trackId,
              assignmentId,
              userId,
              completedAt: new Date().toISOString(),
              acknowledgements: allAcks.map(a => ({
                sectionId: a.sectionId,
                typedName: a.typedName,
                acknowledgedAt: a.acknowledgedAt,
                documentHash: a.documentHash,
              })),
            };

            const [existingCompletion] = await db.select().from(trackCompletions)
              .where(eq(trackCompletions.assignmentId, assignmentId));
            if (!existingCompletion) {
              await db.insert(trackCompletions).values({
                assignmentId, userId, receiptHash: autoReceiptHash, receiptData: autoReceiptData,
              });
            }

            await db.update(trackAssignments)
              .set({ status: "completed", completedAt: new Date() })
              .where(eq(trackAssignments.id, assignmentId));

            await appendAuditEvent(userId, "track_auto_completed", { assignmentId, trackId: assignment.trackId, receiptHash: autoReceiptHash });
            autoCompleted = true;
          }
        }
      } catch (autoErr) {
        console.error("Auto-complete check failed (non-fatal):", autoErr);
      }

      res.json({ ok: true, documentHash, autoCompleted, receiptHash: autoReceiptHash || undefined, receiptData: autoReceiptData || undefined });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to acknowledge section" });
    }
  });

  // Complete track
  app.post("/api/onboarding/progress/:assignmentId/complete", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;

    try {
      const { assignmentId } = req.params as { assignmentId: string };
      const userId = req.session.userId!;

      const [assignment] = await db.select().from(trackAssignments)
        .where(eq(trackAssignments.id, assignmentId));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });

      // If already completed, return existing completion data
      if (assignment.status === "completed") {
        const [existingCompletion] = await db.select().from(trackCompletions)
          .where(eq(trackCompletions.assignmentId, assignmentId));
        return res.json({ receiptHash: existingCompletion?.receiptHash || "", receiptData: existingCompletion?.receiptData || null, alreadyCompleted: true });
      }

      // Verify all sections are acknowledged
      const sections = await db.select().from(trackSections)
        .where(eq(trackSections.trackId, assignment.trackId));
      const acks = await db.select().from(sectionAcknowledgements)
        .where(eq(sectionAcknowledgements.assignmentId, assignmentId));

      if (acks.length < sections.length) {
        return res.status(400).json({ error: "Not all sections acknowledged", remaining: sections.length - acks.length });
      }

      // Compute receipt hash from all ack hashes
      const allHashes = acks.sort((a, b) => a.sectionId.localeCompare(b.sectionId))
        .map(a => a.documentHash || "").join("|");
      const receiptHash = crypto.createHash("sha256").update(allHashes).digest("hex");

      const receiptData = {
        trackId: assignment.trackId,
        assignmentId,
        userId,
        completedAt: new Date().toISOString(),
        acknowledgements: acks.map(a => ({
          sectionId: a.sectionId,
          typedName: a.typedName,
          acknowledgedAt: a.acknowledgedAt,
          documentHash: a.documentHash,
        })),
      };

      // Upsert completion
      const [existing] = await db.select().from(trackCompletions)
        .where(eq(trackCompletions.assignmentId, assignmentId));
      if (!existing) {
        await db.insert(trackCompletions).values({
          assignmentId, userId, receiptHash, receiptData,
        });
      }

      // Update assignment status
      await db.update(trackAssignments)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(trackAssignments.id, assignmentId));

      await appendAuditEvent(userId, "track_completed", { assignmentId, trackId: assignment.trackId, receiptHash });

      res.json({ receiptHash, receiptData });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to complete track" });
    }
  });

  // ==========================================
  // MANAGER/HR DASHBOARD
  // ==========================================

  app.get("/api/onboarding/team-progress", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    const role = req.session.role!;
    if (!ADMIN_ROLES.includes(role)) return res.status(403).json({ error: "Not authorized" });

    try {
      const userId = req.session.userId!;
      const { adminUsers: adminUsersTable } = await import("@shared/schema");

      // Get users in scope
      let users;
      if (["super_admin", "admin", "hr"].includes(role)) {
        users = await db.select().from(adminUsersTable).where(eq(adminUsersTable.isActive, true));
      } else {
        // Manager: direct reports only
        users = await db.select().from(adminUsersTable)
          .where(and(eq(adminUsersTable.managerId, userId), eq(adminUsersTable.isActive, true)));
      }

      const tracks = await db.select().from(learningTracks)
        .where(eq(learningTracks.status, "published"));

      const matrix = await Promise.all(users.map(async (user) => {
        const userAssignments = await db.select({
          assignment: trackAssignments,
        }).from(trackAssignments)
          .where(eq(trackAssignments.userId, user.id));

        const trackProgress = tracks.map(track => {
          const assignment = userAssignments.find(a => a.assignment.trackId === track.id)?.assignment;
          if (!assignment) return { trackId: track.id, trackTitle: track.title, status: "not_assigned" };

          const now = new Date();
          let status = assignment.status;
          if (status !== "completed" && assignment.dueDate && new Date(assignment.dueDate) < now) {
            status = "overdue";
          }
          return {
            trackId: track.id,
            trackTitle: track.title,
            assignmentId: assignment.id,
            status,
            dueDate: assignment.dueDate,
            completedAt: assignment.completedAt,
          };
        });

        return {
          user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, employeeId: user.employeeId },
          trackProgress,
        };
      }));

      res.json({ tracks: tracks.map(t => ({ id: t.id, title: t.title })), matrix });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch team progress" });
    }
  });

  app.get("/api/onboarding/team-progress/:userId", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { userId } = req.params as { userId: string };
      const assignments = await db.select({
        assignment: trackAssignments,
        track: learningTracks,
      }).from(trackAssignments)
        .innerJoin(learningTracks, eq(learningTracks.id, trackAssignments.trackId))
        .where(eq(trackAssignments.userId, userId));

      const enriched = await Promise.all(assignments.map(async ({ assignment, track }) => {
        const sections = await db.select().from(trackSections)
          .where(eq(trackSections.trackId, track.id)).orderBy(trackSections.orderIndex);
        const progresses = await db.select().from(sectionProgress)
          .where(eq(sectionProgress.assignmentId, assignment.id));
        const acks = await db.select().from(sectionAcknowledgements)
          .where(eq(sectionAcknowledgements.assignmentId, assignment.id));

        return {
          assignment,
          track,
          sections: sections.map(s => ({
            ...s,
            progress: progresses.find(p => p.sectionId === s.id) || null,
            acknowledgement: acks.find(a => a.sectionId === s.id) || null,
          })),
        };
      }));

      res.json(enriched);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch user progress" });
    }
  });

  // Get existing assignments for a track
  app.get("/api/onboarding/tracks/:id/assignments", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { id } = req.params as { id: string };
      const { adminUsers: adminUsersTable } = await import("@shared/schema");

      const assignments = await db.select({
        assignment: trackAssignments,
        user: adminUsersTable,
      }).from(trackAssignments)
        .innerJoin(adminUsersTable, eq(adminUsersTable.id, trackAssignments.userId))
        .where(eq(trackAssignments.trackId, id));

      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  // CSV Export: team progress
  app.get("/api/onboarding/team-progress/export/csv", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { adminUsers: adminUsersTable } = await import("@shared/schema");
      const assignments = await db.select({
        assignment: trackAssignments,
        track: learningTracks,
        user: adminUsersTable,
      }).from(trackAssignments)
        .innerJoin(learningTracks, eq(learningTracks.id, trackAssignments.trackId))
        .innerJoin(adminUsersTable, eq(adminUsersTable.id, trackAssignments.userId));

      const rows: string[] = ["Employee,Email,Employee ID,Track,Status,Due Date,Completed At"];
      for (const { assignment, track, user } of assignments) {
        const now = new Date();
        let status = assignment.status;
        if (status !== "completed" && assignment.dueDate && new Date(assignment.dueDate) < now) status = "overdue";
        rows.push([
          `${user.firstName} ${user.lastName}`, user.email, user.employeeId || "",
          track.title, status,
          assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "",
          assignment.completedAt ? new Date(assignment.completedAt).toLocaleDateString() : "",
        ].join(","));
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=training-progress.csv");
      res.send(rows.join("\n"));
    } catch (error) {
      res.status(500).json({ error: "Failed to export" });
    }
  });

  // ==========================================
  // SYSTEM SETTINGS (feature flag)
  // ==========================================

  app.get("/api/system-settings/:key", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;

    try {
      const { key } = req.params as { key: string };
      const { systemSettings: sysSettingsTable } = await import("@shared/schema");
      const [setting] = await db.select().from(sysSettingsTable).where(eq(sysSettingsTable.key, key));
      res.json({ key, value: setting?.value ?? null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/system-settings/:key", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!HR_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { key } = req.params as { key: string };
      const { value } = req.body;
      const { systemSettings: sysSettingsTable } = await import("@shared/schema");
      const [existing] = await db.select().from(sysSettingsTable).where(eq(sysSettingsTable.key, key));

      if (existing) {
        await db.update(sysSettingsTable)
          .set({ value, updatedAt: new Date(), updatedBy: req.session.userId! })
          .where(eq(sysSettingsTable.key, key));
      } else {
        await db.insert(sysSettingsTable).values({ key, value, updatedBy: req.session.userId! });
      }

      res.json({ key, value });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // ==========================================
  // COMPLIANCE STATUS & EXTENSION REQUESTS
  // ==========================================

  const EXEMPT_ROLES = ["super_admin", "admin"];
  const LOCKABLE_ROLES = ["hr", "manager", "operations", "employee"];

  const ENDORSER_ROLES: Record<string, string[]> = {
    employee: ["manager"],
    manager: ["hr", "admin"],
    hr: ["admin"],
    operations: ["admin"],
  };

  async function getComplianceStatus(userId: string, userRole: string) {
    if (EXEMPT_ROLES.includes(userRole) || !LOCKABLE_ROLES.includes(userRole)) {
      return { locked: false, overdueCount: 0, trackTitles: [] as string[], pendingExtensions: [] as any[] };
    }

    const now = new Date();
    const assignments = await db.select({
      id: trackAssignments.id,
      trackId: trackAssignments.trackId,
      status: trackAssignments.status,
      dueDate: trackAssignments.dueDate,
    }).from(trackAssignments).where(eq(trackAssignments.userId, userId));

    const overdueAssignments = assignments.filter(a =>
      a.status !== "completed" && a.dueDate && new Date(a.dueDate) < now
    );

    if (overdueAssignments.length === 0) {
      return { locked: false, overdueCount: 0, trackTitles: [] as string[], pendingExtensions: [] as any[] };
    }

    const approvedExtensions = await db.select()
      .from(trainingExtensionRequests)
      .where(and(
        eq(trainingExtensionRequests.userId, userId),
        eq(trainingExtensionRequests.status, "approved"),
      ));

    const approvedByAssignment = new Map<string, Date>();
    for (const ext of approvedExtensions) {
      const existing = approvedByAssignment.get(ext.assignmentId);
      if (!existing || new Date(ext.newDueDate) > existing) {
        approvedByAssignment.set(ext.assignmentId, new Date(ext.newDueDate));
      }
    }

    const stillOverdue = overdueAssignments.filter(a => {
      const approvedNewDate = approvedByAssignment.get(a.id);
      if (approvedNewDate && approvedNewDate > now) return false;
      return true;
    });

    if (stillOverdue.length === 0) {
      return { locked: false, overdueCount: 0, trackTitles: [] as string[], pendingExtensions: [] as any[] };
    }

    const overdueTrackIds = stillOverdue.map(a => a.trackId);
    const tracks = await db.select({ id: learningTracks.id, title: learningTracks.title })
      .from(learningTracks).where(inArray(learningTracks.id, overdueTrackIds));
    const trackTitles = tracks.map(t => t.title);

    const pendingExts = await db.select()
      .from(trainingExtensionRequests)
      .where(and(
        eq(trainingExtensionRequests.userId, userId),
        eq(trainingExtensionRequests.status, "pending"),
      ));

    return {
      locked: true,
      overdueCount: stillOverdue.length,
      trackTitles,
      pendingExtensions: pendingExts,
    };
  }

  app.get("/api/onboarding/compliance-status", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const result = await getComplianceStatus(req.session.userId, req.session.role!);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to check compliance status" });
    }
  });

  // Create extension request (locked user submits)
  app.post("/api/onboarding/extension-requests", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { assignmentId, reason, newDueDate } = req.body;
      if (!assignmentId || !reason || !newDueDate) {
        return res.status(400).json({ error: "assignmentId, reason, and newDueDate are required" });
      }

      const requestedDate = new Date(newDueDate);
      if (isNaN(requestedDate.getTime()) || requestedDate <= new Date()) {
        return res.status(400).json({ error: "newDueDate must be a valid future date" });
      }

      const [assignment] = await db.select().from(trackAssignments)
        .where(and(eq(trackAssignments.id, assignmentId), eq(trackAssignments.userId, req.session.userId)));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });

      if (assignment.status === "completed") {
        return res.status(400).json({ error: "Cannot request extension for a completed assignment" });
      }

      if (!assignment.dueDate) {
        return res.status(400).json({ error: "Assignment has no due date set" });
      }

      if (assignment.dueDate && requestedDate <= new Date(assignment.dueDate)) {
        return res.status(400).json({ error: "Requested new due date must be after the current due date" });
      }

      const existingActive = await db.select().from(trainingExtensionRequests)
        .where(and(
          eq(trainingExtensionRequests.assignmentId, assignmentId),
          inArray(trainingExtensionRequests.status, ["pending", "endorsed"]),
        ));
      if (existingActive.length > 0) {
        return res.status(400).json({ error: "An extension request is already in progress for this assignment" });
      }

      const [request] = await db.insert(trainingExtensionRequests).values({
        assignmentId,
        userId: req.session.userId,
        requestedById: req.session.userId,
        reason,
        newDueDate: new Date(newDueDate),
        status: "pending",
      }).returning();

      await appendAuditEvent(req.session.userId, "extension_requested", {
        assignmentId,
        extensionRequestId: request.id,
        newDueDate,
        reason,
      });

      res.status(201).json(request);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create extension request" });
    }
  });

  // Get my extension requests
  app.get("/api/onboarding/extension-requests/my", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const requests = await db.select().from(trainingExtensionRequests)
        .where(eq(trainingExtensionRequests.userId, req.session.userId));

      const enriched = await Promise.all(requests.map(async (r) => {
        const [assignment] = await db.select().from(trackAssignments)
          .where(eq(trackAssignments.id, r.assignmentId));
        let trackTitle = "";
        if (assignment) {
          const [track] = await db.select({ title: learningTracks.title })
            .from(learningTracks).where(eq(learningTracks.id, assignment.trackId));
          trackTitle = track?.title || "";
        }
        let resolverName = "";
        if (r.resolvedById) {
          const [resolver] = await db.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
            .from(adminUsers).where(eq(adminUsers.id, r.resolvedById));
          resolverName = resolver ? `${resolver.firstName} ${resolver.lastName}` : "";
        }
        let endorserName = "";
        if (r.endorsedById) {
          const [endorser] = await db.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
            .from(adminUsers).where(eq(adminUsers.id, r.endorsedById));
          endorserName = endorser ? `${endorser.firstName} ${endorser.lastName}` : "";
        }
        return { ...r, trackTitle, resolverName, endorserName };
      }));

      res.json(enriched);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch extension requests" });
    }
  });

  const ENDORSER_ALLOWED_ROLES = ["manager", "hr", "admin"];

  function canEndorseRequest(endorserRole: string, endorserId: string, requesterRole: string, requesterManagerId: string | null): boolean {
    const endorserRolesForRequester = ENDORSER_ROLES[requesterRole] || [];
    if (!endorserRolesForRequester.includes(endorserRole)) return false;
    if (requesterRole === "employee" && endorserRole === "manager") {
      return requesterManagerId === endorserId;
    }
    return true;
  }

  // Get requests that need endorsement (for managers/hr/admin who are one level above)
  app.get("/api/onboarding/extension-requests/to-endorse", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const myRole = req.session.role!;
    if (!ENDORSER_ALLOWED_ROLES.includes(myRole)) return res.status(403).json({ error: "Not an endorser role" });

    try {
      const pendingRequests = await db.select().from(trainingExtensionRequests)
        .where(eq(trainingExtensionRequests.status, "pending"));

      const enrichedPromises = pendingRequests.map(async (r) => {
        const [requester] = await db.select({
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          role: adminUsers.role,
          email: adminUsers.email,
          managerId: adminUsers.managerId,
        }).from(adminUsers).where(eq(adminUsers.id, r.userId));

        if (!requester) return null;

        if (!canEndorseRequest(myRole, req.session.userId!, requester.role, requester.managerId)) return null;

        const [assignment] = await db.select().from(trackAssignments)
          .where(eq(trackAssignments.id, r.assignmentId));
        let trackTitle = "";
        let currentDueDate = null;
        if (assignment) {
          const [track] = await db.select({ title: learningTracks.title })
            .from(learningTracks).where(eq(learningTracks.id, assignment.trackId));
          trackTitle = track?.title || "";
          currentDueDate = assignment.dueDate;
        }

        const isDirectReport = myRole === "manager" && requester.role === "employee" && requester.managerId === req.session.userId!;

        return {
          ...r,
          trackTitle,
          currentDueDate,
          requesterName: `${requester.firstName} ${requester.lastName}`,
          requesterRole: requester.role,
          requesterEmail: requester.email,
          isDirectReport,
        };
      });

      const enriched = (await Promise.all(enrichedPromises)).filter(Boolean);
      res.json(enriched);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch requests to endorse" });
    }
  });

  // Endorse an extension request (manager/hr/admin forwarding to super_admin)
  app.patch("/api/onboarding/extension-requests/:id/endorse", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const myRole = req.session.role!;
    if (!ENDORSER_ALLOWED_ROLES.includes(myRole)) return res.status(403).json({ error: "Not an endorser role" });

    try {
      const { id } = req.params;
      const { comment } = req.body;

      const [request] = await db.select().from(trainingExtensionRequests)
        .where(eq(trainingExtensionRequests.id, id));
      if (!request) return res.status(404).json({ error: "Extension request not found" });
      if (request.status !== "pending") return res.status(400).json({ error: "Request is no longer pending" });

      const [requester] = await db.select({ role: adminUsers.role, managerId: adminUsers.managerId })
        .from(adminUsers).where(eq(adminUsers.id, request.userId));
      if (!requester) return res.status(404).json({ error: "Requester not found" });

      if (!canEndorseRequest(myRole, req.session.userId!, requester.role, requester.managerId)) {
        return res.status(403).json({ error: "You are not authorized to endorse this request" });
      }

      const { action } = req.body;
      const isManagerDirectReport = myRole === "manager" && requester.role === "employee" && requester.managerId === req.session.userId!;

      if (isManagerDirectReport && (action === "approve" || action === "reject")) {
        const finalStatus = action === "approve" ? "approved" : "rejected";
        const [updated] = await db.update(trainingExtensionRequests).set({
          status: finalStatus,
          endorsedById: req.session.userId,
          endorsedAt: new Date(),
          endorserComment: comment || null,
          resolvedById: req.session.userId,
          resolvedAt: new Date(),
          resolverComment: comment || null,
        }).where(eq(trainingExtensionRequests.id, id)).returning();

        if (finalStatus === "approved") {
          await db.update(trackAssignments).set({
            dueDate: new Date(request.newDueDate),
          }).where(eq(trackAssignments.id, request.assignmentId));
        }

        await appendAuditEvent(req.session.userId, `extension_${finalStatus}`, {
          extensionRequestId: id,
          assignmentId: request.assignmentId,
          userId: request.userId,
          comment: comment || null,
          newDueDate: request.newDueDate,
          managerDirectApproval: true,
        });

        res.json(updated);
      } else {
        const [updated] = await db.update(trainingExtensionRequests).set({
          status: "endorsed",
          endorsedById: req.session.userId,
          endorsedAt: new Date(),
          endorserComment: comment || null,
        }).where(eq(trainingExtensionRequests.id, id)).returning();

        await appendAuditEvent(req.session.userId, "extension_endorsed", {
          extensionRequestId: id,
          assignmentId: request.assignmentId,
          userId: request.userId,
          comment: comment || null,
        });

        res.json(updated);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to endorse extension request" });
    }
  });

  // Get all endorsed extension requests for super_admin final approval
  app.get("/api/onboarding/extension-requests/pending", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (req.session.role !== "super_admin") return res.status(403).json({ error: "super_admin only" });

    try {
      const requests = await db.select().from(trainingExtensionRequests)
        .where(eq(trainingExtensionRequests.status, "endorsed"));

      const enriched = await Promise.all(requests.map(async (r) => {
        const [assignment] = await db.select().from(trackAssignments)
          .where(eq(trackAssignments.id, r.assignmentId));
        let trackTitle = "";
        let currentDueDate = null;
        if (assignment) {
          const [track] = await db.select({ title: learningTracks.title })
            .from(learningTracks).where(eq(learningTracks.id, assignment.trackId));
          trackTitle = track?.title || "";
          currentDueDate = assignment.dueDate;
        }
        const [requester] = await db.select({
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          role: adminUsers.role,
          email: adminUsers.email,
        }).from(adminUsers).where(eq(adminUsers.id, r.userId));
        let endorserName = "";
        if (r.endorsedById) {
          const [endorser] = await db.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
            .from(adminUsers).where(eq(adminUsers.id, r.endorsedById));
          endorserName = endorser ? `${endorser.firstName} ${endorser.lastName}` : "";
        }
        return {
          ...r,
          trackTitle,
          currentDueDate,
          requesterName: requester ? `${requester.firstName} ${requester.lastName}` : "",
          requesterRole: requester?.role || "",
          requesterEmail: requester?.email || "",
          endorserName,
        };
      }));

      res.json(enriched);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch pending extension requests" });
    }
  });

  // Approve or reject extension request (super_admin — requires endorsement first)
  app.patch("/api/onboarding/extension-requests/:id", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (req.session.role !== "super_admin") return res.status(403).json({ error: "super_admin only" });

    try {
      const { id } = req.params;
      const { status, comment } = req.body;

      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
      }

      const [request] = await db.select().from(trainingExtensionRequests)
        .where(eq(trainingExtensionRequests.id, id));
      if (!request) return res.status(404).json({ error: "Extension request not found" });
      if (request.status !== "endorsed") return res.status(400).json({ error: "Request must be endorsed by a manager/admin before final approval" });

      const [updated] = await db.update(trainingExtensionRequests).set({
        status,
        resolvedById: req.session.userId,
        resolvedAt: new Date(),
        resolverComment: comment || null,
      }).where(eq(trainingExtensionRequests.id, id)).returning();

      if (status === "approved") {
        await db.update(trackAssignments).set({
          dueDate: new Date(request.newDueDate),
        }).where(eq(trackAssignments.id, request.assignmentId));
      }

      await appendAuditEvent(req.session.userId, `extension_${status}`, {
        extensionRequestId: id,
        assignmentId: request.assignmentId,
        userId: request.userId,
        comment: comment || null,
        newDueDate: request.newDueDate,
      });

      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update extension request" });
    }
  });

  // ==========================================
  // RAYO ACADEMY INTEGRATION
  // ==========================================

  app.get("/api/rayo-academy/status", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const enabled = await isRayoEnabled();
      res.json({ enabled });
    } catch (error) {
      res.json({ enabled: false });
    }
  });

  app.get("/api/rayo-academy/tracks", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const result = await getRayoTracks();
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch Rayo Academy tracks" });
    }
  });

  app.get("/api/rayo-academy/my-assignments", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;

    try {
      const result = await getRayoUserAssignments(req.session.userId!);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch Rayo Academy assignments" });
    }
  });

  app.post("/api/rayo-academy/assign", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { userIds, trackId, dueDate } = req.body;
      if (!Array.isArray(userIds) || !trackId) {
        return res.status(400).json({ error: "userIds and trackId are required" });
      }

      const rayoEnabled = await isRayoEnabled();
      const results = [];

      for (const userId of userIds) {
        let assignedViaRayo = false;
        if (rayoEnabled) {
          const [user] = await db.select({ email: adminUsers.email }).from(adminUsers).where(eq(adminUsers.id, userId));
          if (user) {
            const result = await assignRayoTrack(user.email, trackId, dueDate);
            if (result.success) {
              results.push({ userId, ...result, source: "rayo" });
              assignedViaRayo = true;
            }
          }
        }

        if (!assignedViaRayo) {
          const [existing] = await db.select().from(trackAssignments)
            .where(and(eq(trackAssignments.trackId, trackId), eq(trackAssignments.userId, userId)));
          if (existing) {
            results.push({ userId, success: true, status: "already_assigned", source: "local" });
            continue;
          }

          const autoDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
          await db.insert(trackAssignments).values({
            trackId, userId, assignedBy: req.session.userId!,
            dueDate: dueDate ? new Date(dueDate) : autoDate,
            status: "not_started",
          });
          results.push({ userId, success: true, status: "assigned", source: rayoEnabled ? "local_fallback" : "local" });
        }
      }

      res.json({ results });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to assign track" });
    }
  });

  app.get("/api/rayo-academy/team-progress", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!ADMIN_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const userId = req.session.userId!;
      const role = req.session.role!;

      let users;
      if (["super_admin", "admin", "hr"].includes(role)) {
        users = await db.select().from(adminUsers).where(eq(adminUsers.isActive, true));
      } else {
        users = await db.select().from(adminUsers)
          .where(and(eq(adminUsers.managerId, userId), eq(adminUsers.isActive, true)));
      }

      const rayoEnabled = await isRayoEnabled();

      if (rayoEnabled) {
        const userIds = users.map(u => u.id);
        const { data, fromApi } = await getRayoTeamProgress(userIds);
        if (data && fromApi) {
          return res.json({ ...data, fromApi: true });
        }
      }

      const tracks = await db.select().from(learningTracks)
        .where(eq(learningTracks.status, "published"));

      const matrix = await Promise.all(users.map(async (user) => {
        const userAssignments = await db.select({
          assignment: trackAssignments,
        }).from(trackAssignments)
          .where(eq(trackAssignments.userId, user.id));

        const trackProgress = tracks.map(track => {
          const assignment = userAssignments.find(a => a.assignment.trackId === track.id)?.assignment;
          if (!assignment) return { trackId: track.id, trackTitle: track.title, status: "not_assigned", progressPct: 0 };

          const now = new Date();
          let status = assignment.status;
          if (status !== "completed" && assignment.dueDate && new Date(assignment.dueDate) < now) {
            status = "overdue";
          }
          return {
            trackId: track.id,
            trackTitle: track.title,
            assignmentId: assignment.id,
            status,
            progressPct: 0,
            dueDate: assignment.dueDate,
            completedAt: assignment.completedAt,
          };
        });

        return {
          user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, employeeId: user.employeeId },
          trackProgress,
        };
      }));

      res.json({ tracks: tracks.map(t => ({ id: t.id, title: t.title })), matrix, fromApi: false });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch team progress" });
    }
  });

  app.get("/api/rayo-academy/compliance-status", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const rayoEnabled = await isRayoEnabled();
      if (rayoEnabled) {
        const [user] = await db.select({ email: adminUsers.email }).from(adminUsers).where(eq(adminUsers.id, req.session.userId));
        if (user) {
          const { status, fromApi } = await getRayoComplianceStatus(user.email);
          if (status && fromApi) {
            return res.json({ ...status, fromApi: true });
          }
        }
      }

      const result = await getComplianceStatus(req.session.userId, req.session.role!);
      res.json({ ...result, fromApi: false });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to check compliance status" });
    }
  });

  app.get("/api/rayo-academy/track-progress/:trackId", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { trackId } = req.params;
      const [user] = await db.select({ email: adminUsers.email }).from(adminUsers).where(eq(adminUsers.id, req.session.userId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const progress = await getRayoTrackProgress(trackId, user.email);
      if (progress) {
        return res.json(progress);
      }

      res.json({ trackId, progressPct: 0, status: "unknown" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch track progress" });
    }
  });

  app.get("/api/rayo-academy/certificates", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const [user] = await db.select({ email: adminUsers.email }).from(adminUsers).where(eq(adminUsers.id, req.session.userId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const result = await getRayoCertificates(user.email);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });

  app.post("/api/rayo-academy/provision", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (!HR_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });

      const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const result = await provisionRayoUser(user.email, user.firstName, user.lastName, user.role);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to provision Rayo Academy user" });
    }
  });

  // Seed endpoint (super_admin only)
  app.post("/api/onboarding/seed", async (req: Request, res: Response) => {
    if (!requireOnboardingAccess(req, res)) return;
    if (req.session.role !== "super_admin") return res.status(403).json({ error: "super_admin only" });

    try {
      const tracksResult = await seedOnboardingContent(req.session.userId!);
      const sectionsResult = await seedSectionAdditions(req.session.userId!);
      res.json({
        created: tracksResult.created,
        skipped: tracksResult.skipped,
        sectionsAdded: sectionsResult.added,
        sectionsSkipped: sectionsResult.skipped,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Seed failed" });
    }
  });
}
