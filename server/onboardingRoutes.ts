import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  learningTracks, trackSections, sectionQuizQuestions, sectionQuizOptions,
  trackAssignments, sectionProgress, sectionAcknowledgements, trackCompletions, onboardingAuditEvents,
  systemSettings,
} from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import crypto from "crypto";
import { seedOnboardingContent, seedSectionAdditions } from "./onboardingSeed";

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

        const [assignment] = await db.insert(trackAssignments).values({
          trackId: id, userId, assignedBy: req.session.userId!,
          dueDate: dueDate ? new Date(dueDate) : null,
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

      res.json({ ok: true, documentHash });
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
    if (!HR_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Not authorized" });

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
