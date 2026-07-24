import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  learningTracks, trackSections, trackAssignments, trainingSopLinks,
  roleTrainingRules, adminUsers, onboardingAuditEvents, sectionQuizQuestions, sectionQuizOptions,
} from "@shared/schema";
import { eq, and, inArray, or, sql, isNotNull, ilike } from "drizzle-orm";
import fs from "fs";
import path from "path";

const SUPER_ADMIN_ROLES = ["super_admin"];
const ADMIN_HR_ROLES = ["super_admin", "admin", "hr"];

function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: () => void) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.session.role!)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

const AUDIENCE_ROLE_MAP: Record<string, string[]> = {
  "All Employees": ["super_admin", "admin", "hr", "finance", "operations", "manager", "recruiter", "employee"],
  "Managers, Leads, AMs, Ops, HR": ["manager", "hr", "operations"],
  "Manager + Ops Governance": ["manager", "operations"],
  "All Delivery + Sales": ["manager", "operations", "employee"],
  "TA + Sales + Managers": ["manager", "operations"],
  "Recruiters + Leads": ["employee", "manager"],
  "Recruiters + Leads + Managers": ["employee", "manager"],
};

function mapAudienceToRoles(audience: string): string[] {
  if (AUDIENCE_ROLE_MAP[audience]) return AUDIENCE_ROLE_MAP[audience];
  const lower = audience.toLowerCase();
  if (lower.includes("all employee") || lower.includes("all relevant")) return AUDIENCE_ROLE_MAP["All Employees"];
  if (lower.includes("manager") && lower.includes("hr")) return ["manager", "hr", "operations"];
  if (lower.includes("manager")) return ["manager", "operations"];
  if (lower.includes("hr")) return ["hr"];
  if (lower.includes("recruiter")) return ["employee", "manager"];
  if (lower.includes("delivery") && lower.includes("sales")) return ["manager", "operations", "employee"];
  return [];
}

export function registerTrainingCatalogRoutes(app: Express) {

  app.post("/api/training/seed-import",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      if (!["super_admin", "admin"].includes(req.session.role!)) return res.status(403).json({ error: "Insufficient permissions" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const seedPath = path.join(process.cwd(), "attached_assets", "hirein_sop_training_seed_data_1782980559842.json");
        if (!fs.existsSync(seedPath)) {
          return res.status(404).json({ error: "Seed file not found" });
        }
        const raw = fs.readFileSync(seedPath, "utf-8");
        const seedData = JSON.parse(raw);
        const modules: any[] = seedData.trainingModules || [];

        let tracksUpserted = 0;
        let linksCreated = 0;
        let rulesCreated = 0;

        await db.transaction(async (tx) => {
          for (const mod of modules) {
            const { trainingId, sopCode, moduleTitle, category, launchWave, audience, durationMinutes, purpose, learningObjectives } = mod;

            const description = [
              purpose ? `**Purpose:** ${purpose}` : null,
              learningObjectives?.length
                ? `**Learning Objectives:**\n${(learningObjectives as string[]).map((o: string) => `- ${o}`).join("\n")}`
                : null,
            ].filter(Boolean).join("\n\n");

            const existingRows = await tx.select({ id: learningTracks.id })
              .from(learningTracks)
              .where(eq(learningTracks.trainingId, trainingId));

            let trackId: string;
            if (existingRows.length > 0) {
              trackId = existingRows[0].id;
              await tx.update(learningTracks)
                .set({
                  title: moduleTitle,
                  description,
                  sopCategory: category,
                  launchWave,
                  audience,
                  updatedAt: new Date(),
                })
                .where(eq(learningTracks.id, trackId));
            } else {
              const [inserted] = await tx.insert(learningTracks).values({
                title: moduleTitle,
                description,
                status: "draft",
                trainingId,
                sopCategory: category,
                launchWave,
                audience,
                version: "1.0",
                versionNumber: 1,
                isPolicyTrack: false,
                isUniversal: false,
                createdBy: req.session.userId!,
              }).returning({ id: learningTracks.id });
              trackId = inserted.id;

              const estimatedMinutes = Math.max(5, Math.ceil((durationMinutes || 30) / 3));
              const sectionsToCreate = [
                { title: "Purpose & Business Value", body: purpose || "" },
                {
                  title: "Learning Objectives",
                  body: learningObjectives?.length
                    ? (learningObjectives as string[]).map((o: string, i: number) => `${i + 1}. ${o}`).join("\n")
                    : "",
                },
              ];
              for (let i = 0; i < sectionsToCreate.length; i++) {
                const s = sectionsToCreate[i];
                if (s.body.trim()) {
                  await tx.insert(trackSections).values({
                    trackId,
                    title: s.title,
                    body: s.body,
                    orderIndex: i,
                    minDwellSeconds: 30,
                    estimatedMinutes,
                  });
                }
              }
            }

            tracksUpserted++;

            const codes = (sopCode || "").split(";").map((c: string) => c.trim()).filter(Boolean);
            for (const code of codes) {
              const isGlobal = code === "ALL";
              try {
                await tx.insert(trainingSopLinks).values({ trackId, sopCode: code, isGlobal }).onConflictDoNothing();
                linksCreated++;
              } catch {
                // ignore unique conflict
              }
            }

            const roleSlugs = mapAudienceToRoles(audience || "");
            for (const roleSlug of roleSlugs) {
              try {
                const existing = await tx.select({ id: roleTrainingRules.id })
                  .from(roleTrainingRules)
                  .where(and(
                    eq(roleTrainingRules.trackId, trackId),
                    eq(roleTrainingRules.roleSlug, roleSlug),
                  ));
                if (existing.length === 0) {
                  await tx.insert(roleTrainingRules).values({ trackId, roleSlug, isMandatory: true });
                  rulesCreated++;
                }
              } catch {
                // non-fatal
              }
            }
          }
        });

        res.json({ tracksUpserted, linksCreated, rulesCreated });
      } catch (error) {
        console.error("Seed import error:", error);
        res.status(500).json({ error: "Seed import failed" });
      }
    }
  );

  app.get("/api/training/by-sop/:sopCode",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const { sopCode } = req.params as { sopCode: string };
        const userId = req.session.userId!;

        const links = await db.select({ trackId: trainingSopLinks.trackId, isGlobal: trainingSopLinks.isGlobal })
          .from(trainingSopLinks)
          .where(or(
            eq(trainingSopLinks.sopCode, sopCode),
            eq(trainingSopLinks.isGlobal, true),
          ));

        const trackIds = [...new Set(links.map((l) => l.trackId))];
        if (trackIds.length === 0) return res.json([]);

        const tracks = await db.select()
          .from(learningTracks)
          .where(and(
            inArray(learningTracks.id, trackIds),
            eq(learningTracks.status, "published"),
          ));

        const [sectionCounts, assignmentTotals] = await Promise.all([
          Promise.all(tracks.map((t) =>
            db.select({ count: sql<number>`count(*)::int` })
              .from(trackSections)
              .where(eq(trackSections.trackId, t.id))
              .then((r) => ({ trackId: t.id, count: r[0]?.count ?? 0 }))
          )),
          Promise.all(tracks.map((t) =>
            db.select({
              total: sql<number>`count(*)::int`,
              completed: sql<number>`sum(case when status = 'completed' then 1 else 0 end)::int`,
            })
              .from(trackAssignments)
              .where(eq(trackAssignments.trackId, t.id))
              .then((r) => ({ trackId: t.id, total: r[0]?.total ?? 0, completed: r[0]?.completed ?? 0 }))
          )),
        ]);

        const userAssignments = trackIds.length > 0
          ? await db.select()
              .from(trackAssignments)
              .where(and(
                inArray(trackAssignments.trackId, trackIds),
                eq(trackAssignments.userId, userId),
              ))
          : [];

        const linkMap = new Map<string, boolean>();
        for (const l of links) linkMap.set(l.trackId, l.isGlobal);

        const result = tracks.map((track) => {
          const sc = sectionCounts.find((x) => x.trackId === track.id);
          const at = assignmentTotals.find((x) => x.trackId === track.id);
          const myAssignment = userAssignments.find((a) => a.trackId === track.id);
          return {
            ...track,
            isGlobal: linkMap.get(track.id) ?? false,
            sectionCount: sc?.count ?? 0,
            totalAssignments: at?.total ?? 0,
            completedAssignments: at?.completed ?? 0,
            myAssignment: myAssignment ?? null,
            myStatus: myAssignment?.status ?? "not_assigned",
          };
        });

        res.json(result);
      } catch (error) {
        console.error("by-sop error:", error);
        res.status(500).json({ error: "Failed to fetch training for SOP" });
      }
    }
  );

  app.get("/api/training/catalog",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const { wave, category, audience, q } = req.query as { wave?: string; category?: string; audience?: string; q?: string };
        const userId = req.session.userId!;

        const rows = await db.select()
          .from(learningTracks)
          .where(and(
            eq(learningTracks.status, "published"),
            isNotNull(learningTracks.sopCategory),
          ));

        let filtered = rows;
        if (wave) filtered = filtered.filter((t) => t.launchWave === wave);
        if (category) filtered = filtered.filter((t) => t.sopCategory === category);
        if (audience) filtered = filtered.filter((t) => t.audience === audience);
        if (q) {
          const lower = q.toLowerCase();
          filtered = filtered.filter((t) =>
            t.title.toLowerCase().includes(lower) ||
            (t.sopCategory ?? "").toLowerCase().includes(lower)
          );
        }

        const trackIds = filtered.map((t) => t.id);
        const userAssignments = trackIds.length > 0
          ? await db.select()
              .from(trackAssignments)
              .where(and(
                inArray(trackAssignments.trackId, trackIds),
                eq(trackAssignments.userId, userId),
              ))
          : [];

        const result = filtered.map((track) => {
          const myAssignment = userAssignments.find((a) => a.trackId === track.id);
          return {
            ...track,
            myStatus: myAssignment?.status ?? "not_assigned",
            myAssignmentId: myAssignment?.id ?? null,
          };
        });

        res.json(result);
      } catch (error) {
        console.error("catalog error:", error);
        res.status(500).json({ error: "Failed to fetch training catalog" });
      }
    }
  );

  app.get("/api/training/track/:trackId/sop-codes",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const { trackId } = req.params as { trackId: string };
        const rows = await db.select({ sopCode: trainingSopLinks.sopCode })
          .from(trainingSopLinks)
          .where(eq(trainingSopLinks.trackId, trackId));
        res.json(rows.map((r) => r.sopCode));
      } catch (error) {
        console.error("track sop-codes error:", error);
        res.status(500).json({ error: "Failed to fetch SOP codes for track" });
      }
    }
  );

  app.post("/api/training/bulk-assign-by-role",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      if (!ADMIN_HR_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Insufficient permissions" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const { trackId, roleSlug, department, dueDate } = req.body as {
          trackId: string;
          roleSlug: string;
          department?: string;
          dueDate?: string;
        };
        if (!trackId || !roleSlug) return res.status(400).json({ error: "trackId and roleSlug are required" });

        const [track] = await db.select({ id: learningTracks.id })
          .from(learningTracks)
          .where(eq(learningTracks.id, trackId));
        if (!track) return res.status(404).json({ error: "Track not found" });

        let userQuery = db.select({ id: adminUsers.id })
          .from(adminUsers)
          .where(and(
            eq(adminUsers.isActive, true),
            eq(adminUsers.role, roleSlug as any),
            ...(department ? [eq(adminUsers.departmentId, department)] : []),
          ));

        const users = await userQuery;
        if (users.length === 0) return res.json({ assigned: 0, skipped: 0 });

        const existingAssignments = await db.select({ userId: trackAssignments.userId })
          .from(trackAssignments)
          .where(and(
            eq(trackAssignments.trackId, trackId),
            inArray(trackAssignments.userId, users.map((u) => u.id)),
          ));

        const alreadyAssigned = new Set(existingAssignments.map((a) => a.userId));
        const toAssign = users.filter((u) => !alreadyAssigned.has(u.id));

        const dueDateObj = dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

        let assigned = 0;
        for (const user of toAssign) {
          try {
            await db.insert(trackAssignments).values({
              trackId,
              userId: user.id,
              assignedBy: req.session.userId!,
              dueDate: dueDateObj,
              status: "not_started",
            });
            assigned++;
          } catch {
            // non-fatal
          }
        }

        await db.insert(onboardingAuditEvents).values({
          userId: req.session.userId!,
          eventType: "bulk_role_assign",
          metadata: { trackId, roleSlug, department, assigned, skipped: alreadyAssigned.size },
        });

        res.json({ assigned, skipped: alreadyAssigned.size });
      } catch (error) {
        console.error("bulk-assign error:", error);
        res.status(500).json({ error: "Failed to bulk assign" });
      }
    }
  );

  // v3 Quiz Bank Seed Import — triggers the v3 training module + quiz question seeder
  app.post("/api/training/seed-import-v3",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      if (!["super_admin", "admin"].includes(req.session.role!)) return res.status(403).json({ error: "Insufficient permissions" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const seedPath = path.join(process.cwd(), "attached_assets", "hirein_sop_quiz_bank_v3_seed_1784861801576.json");
        if (!fs.existsSync(seedPath)) return res.status(404).json({ error: "v3 seed file not found" });

        const raw = fs.readFileSync(seedPath, "utf-8");
        const seedData = JSON.parse(raw);
        const modules: any[] = seedData.trainingModules ?? [];

        const HIGH_PASS_IDS = new Set(["HIS-TRN-HC-001", "HIS-TRN-LEGAL-001", "HIS-TRN-OPS-001"]);
        const getPassingScore = (trainingId: string, moduleScore: number) =>
          HIGH_PASS_IDS.has(trainingId) ? 90 : (moduleScore ?? 80);

        let tracksUpserted = 0, sectionsCreated = 0, questionsCreated = 0, optionsCreated = 0;

        for (const mod of modules) {
          const trainingId: string = mod.trainingId;
          const passingScore = getPassingScore(trainingId, mod.passingScore ?? 80);
          const audience: string = mod.audience ?? "";
          let targetRole = "";
          if (audience.toLowerCase().includes("manager")) targetRole = "manager";
          else if (audience.toLowerCase().includes("hr")) targetRole = "hr";

          let trackId: string;
          const [existing] = await db.select({ id: learningTracks.id })
            .from(learningTracks)
            .where(eq(learningTracks.trainingId, trainingId))
            .limit(1);

          if (existing) {
            trackId = existing.id;
            await db.execute(sql`
              UPDATE learning_tracks SET title=${mod.title}, description=${mod.why ?? ""}, passing_score=${passingScore},
              acknowledgment_required=${mod.acknowledgmentRequired ?? true}, version='3.0', status='published'
              WHERE id=${trackId}
            `);
          } else {
            const [ins] = await db.insert(learningTracks).values({
              trainingId, title: mod.title, description: mod.why ?? "", targetRole,
              version: "3.0", status: "published", isUniversal: targetRole === "", isPolicyTrack: false,
            } as any).returning({ id: learningTracks.id });
            trackId = ins.id;
            await db.execute(sql`UPDATE learning_tracks SET passing_score=${passingScore}, acknowledgment_required=${mod.acknowledgmentRequired ?? true} WHERE id=${trackId}`);
          }
          tracksUpserted++;

          // Create lesson sections (orderIndex 0–4)
          const lessonBlocks: any[] = mod.lessonBlocks ?? [];
          for (let i = 0; i < lessonBlocks.length; i++) {
            const lb = lessonBlocks[i];
            const body = [
              lb.trainer_notes ? `**Trainer Notes**\n${lb.trainer_notes}` : "",
              lb.learner_activity ? `**Activity**\n${lb.learner_activity}` : "",
              lb.evidence ? `**Evidence**\n${lb.evidence}` : "",
            ].filter(Boolean).join("\n\n");
            const [existSec] = await db.select({ id: trackSections.id }).from(trackSections)
              .where(and(eq(trackSections.trackId, trackId), eq(trackSections.orderIndex, i))).limit(1);
            if (!existSec) {
              const durationMin = parseInt(String(mod.duration ?? "45")) || 45;
              await db.insert(trackSections).values({
                trackId, title: lb.topic ?? `Lesson ${i + 1}`, body, orderIndex: i,
                estimatedMinutes: Math.max(1, Math.ceil(durationMin / 6)), minDwellSeconds: 90,
              } as any);
              sectionsCreated++;
            }
          }

          // Create assessment section (orderIndex = 5)
          const [existAssess] = await db.select({ id: trackSections.id }).from(trackSections)
            .where(and(eq(trackSections.trackId, trackId), eq(trackSections.orderIndex, 5))).limit(1);
          let assessId: string;
          if (existAssess) {
            assessId = existAssess.id;
          } else {
            const [ass] = await db.insert(trackSections).values({
              trackId, title: "Module Assessment", orderIndex: 5, minDwellSeconds: 0, estimatedMinutes: 10,
              body: `Complete all ${mod.quizQuestions?.length ?? 8} questions. Required: ${passingScore}%.`,
            } as any).returning({ id: trackSections.id });
            assessId = ass.id;
            sectionsCreated++;
          }

          // Seed quiz questions
          const quizQuestions: any[] = mod.quizQuestions ?? [];
          for (const q of quizQuestions) {
            const [existQ] = await db.select({ id: sectionQuizQuestions.id }).from(sectionQuizQuestions)
              .where(and(eq(sectionQuizQuestions.sectionId, assessId), sql`question_id = ${q.questionId}`)).limit(1);
            if (existQ) continue;

            const optionsJson = JSON.stringify((q.options ?? []).map((o: any, oi: number) => ({
              key: o.key, text: o.text, isCorrect: o.isCorrect, orderIndex: oi,
            })));
            const [ins] = await db.insert(sectionQuizQuestions).values({
              sectionId: assessId, questionText: q.prompt, explanation: q.rationale ?? "",
            } as any).returning({ id: sectionQuizQuestions.id });
            // Arrays must be JSON.stringify-ed before ::jsonb cast (Postgres pg driver would
            // otherwise convert a JS array to a record literal that fails the cast)
            const tagsJson2 = JSON.stringify(q.tags ?? []);
            await db.execute(sql`
              UPDATE section_quiz_questions SET
                question_type=${q.question_type ?? "single_choice"}, cognitive_level=${q.cognitive_level ?? ""},
                tags=${tagsJson2}::jsonb, auto_gradable=${q.auto_gradable ?? true}, points=${q.points ?? 1},
                options=${optionsJson}::jsonb, correct_option=${q.correct_option ?? ""},
                correct_answer_text=${q.correct_answer_text ?? ""}, requires_human_review=${q.requires_human_review ?? false},
                quiz_version=${String(mod.quizVersion ?? "3.0")}, question_no=${q.questionNo}, question_id=${q.questionId}
              WHERE id=${ins.id}
            `);
            questionsCreated++;

            for (let oi = 0; oi < (q.options ?? []).length; oi++) {
              const opt = q.options[oi];
              await db.insert(sectionQuizOptions).values({
                questionId: ins.id, optionText: opt.text, isCorrect: opt.isCorrect === true, orderIndex: oi,
              } as any);
              optionsCreated++;
            }
          }
        }

        // ── Post-import QA assertions ──────────────────────────────────────────
        // Hard-fail if the DB does not reflect the expected v3 state after seeding
        const [{ total_tracks }] = await db.execute(sql`
          SELECT COUNT(*) AS total_tracks FROM learning_tracks WHERE training_id LIKE 'HIS-TRN-%'
        `).then(r => r.rows as any[]);

        // Per-module exact question count check (must be exactly 8 per module assessment)
        const modulesNotEight = await db.execute(sql`
          SELECT lt.training_id, COUNT(sqq.id) AS q_count
          FROM learning_tracks lt
          JOIN track_sections ts ON ts.track_id = lt.id AND ts.title = 'Module Assessment'
          JOIN section_quiz_questions sqq ON sqq.section_id = ts.id
          WHERE lt.training_id LIKE 'HIS-TRN-%'
          GROUP BY lt.training_id
          HAVING COUNT(sqq.id) != 8
        `).then(r => r.rows as any[]);

        const [{ total_questions }] = await db.execute(sql`
          SELECT COUNT(*) AS total_questions FROM section_quiz_questions
          WHERE section_id IN (
            SELECT ts.id FROM track_sections ts
            JOIN learning_tracks lt ON ts.track_id = lt.id
            WHERE lt.training_id LIKE 'HIS-TRN-%' AND ts.title = 'Module Assessment'
          )
        `).then(r => r.rows as any[]);

        const [{ hr_count }] = await db.execute(sql`
          SELECT COUNT(*) AS hr_count FROM section_quiz_questions
          WHERE section_id IN (
            SELECT ts.id FROM track_sections ts
            JOIN learning_tracks lt ON ts.track_id = lt.id
            WHERE lt.training_id LIKE 'HIS-TRN-%' AND ts.title = 'Module Assessment'
          ) AND requires_human_review = TRUE
        `).then(r => r.rows as any[]);

        const failures: string[] = [];
        if (parseInt(total_tracks) < 21) failures.push(`Expected ≥21 HIS-TRN tracks, found ${total_tracks}`);
        if (parseInt(total_questions) < 168) failures.push(`Expected ≥168 quiz questions, found ${total_questions}`);
        if (parseInt(hr_count) > 0) failures.push(`Expected 0 requires_human_review questions, found ${hr_count}`);
        if (modulesNotEight.length > 0) {
          const detail = modulesNotEight.map((r: any) => `${r.training_id}(${r.q_count}q)`).join(", ");
          failures.push(`Modules without exactly 8 questions: ${detail}`);
        }

        if (failures.length > 0) {
          return res.status(500).json({
            error: "v3 QA assertions failed — seed incomplete",
            failures,
            counts: { total_tracks, total_questions, hr_count }
          });
        }

        res.json({
          tracksUpserted, sectionsCreated, questionsCreated, optionsCreated,
          qa: { total_tracks: parseInt(total_tracks), total_questions: parseInt(total_questions) }
        });
      } catch (err) {
        console.error("seed-import-v3 error:", err);
        res.status(500).json({ error: "v3 seed import failed", detail: String(err) });
      }
    }
  );

  // Quiz Question Browser — HR Admin view with cognitive_level + tag filters
  app.get("/api/training/quiz-questions",
    requireRole(ADMIN_HR_ROLES),
    async (req: Request, res: Response) => {
      try {
        const { cognitiveLevel, tag, trackId, page = "1", pageSize = "50" } = req.query as Record<string, string>;
        const limit = Math.min(parseInt(pageSize) || 50, 200);
        const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

        // Fetch all quiz questions with optional trackId filter via section lookup
        let sectionIds: string[] | undefined;
        if (trackId) {
          const secs = await db.select({ id: trackSections.id }).from(trackSections)
            .where(eq(trackSections.trackId, trackId));
          sectionIds = secs.map(s => s.id);
          if (sectionIds.length === 0) return res.json({ questions: [], total: 0 });
        }

        const rows = await db.select({
          id: sectionQuizQuestions.id,
          sectionId: sectionQuizQuestions.sectionId,
          questionText: sectionQuizQuestions.questionText,
          explanation: sectionQuizQuestions.explanation,
          questionType: sql<string>`${sectionQuizQuestions}.question_type`.as("questionType"),
          cognitiveLevel: sql<string>`${sectionQuizQuestions}.cognitive_level`.as("cognitiveLevel"),
          tags: sql<string[]>`${sectionQuizQuestions}.tags`.as("tags"),
          points: sql<number>`${sectionQuizQuestions}.points`.as("points"),
          autoGradable: sql<boolean>`${sectionQuizQuestions}.auto_gradable`.as("autoGradable"),
          questionNo: sql<number>`${sectionQuizQuestions}.question_no`.as("questionNo"),
          questionId: sql<string>`${sectionQuizQuestions}.question_id`.as("questionId"),
          quizVersion: sql<string>`${sectionQuizQuestions}.quiz_version`.as("quizVersion"),
          correctOption: sql<string>`${sectionQuizQuestions}.correct_option`.as("correctOption"),
        }).from(sectionQuizQuestions)
          .where(
            and(
              sectionIds ? inArray(sectionQuizQuestions.sectionId, sectionIds) : undefined,
              cognitiveLevel ? sql`${sectionQuizQuestions}.cognitive_level = ${cognitiveLevel}` : undefined,
              tag ? sql`${sectionQuizQuestions}.tags::jsonb ? ${tag}` : undefined,
            )
          )
          .orderBy(sectionQuizQuestions.sectionId, sql`${sectionQuizQuestions}.question_no`)
          .limit(limit)
          .offset(offset);

        // Enrich with track info via section → track lookup
        const uniqueSectionIds = [...new Set(rows.map(r => r.sectionId).filter(Boolean))];
        let sectionTrackMap: Record<string, { sectionTitle: string; trackId: string; trackTitle: string }> = {};
        if (uniqueSectionIds.length > 0) {
          const secs = await db.select({
            id: trackSections.id,
            title: trackSections.title,
            trackId: trackSections.trackId,
          }).from(trackSections).where(inArray(trackSections.id, uniqueSectionIds as string[]));
          const trackIds = [...new Set(secs.map(s => s.trackId).filter(Boolean))];
          let trackTitles: Record<string, string> = {};
          if (trackIds.length > 0) {
            const trs = await db.select({ id: learningTracks.id, title: learningTracks.title })
              .from(learningTracks).where(inArray(learningTracks.id, trackIds as string[]));
            trs.forEach(t => { trackTitles[t.id] = t.title; });
          }
          secs.forEach(s => {
            sectionTrackMap[s.id] = {
              sectionTitle: s.title,
              trackId: s.trackId,
              trackTitle: trackTitles[s.trackId] ?? "",
            };
          });
        }

        const enriched = rows.map(q => ({
          ...q,
          sectionTitle: sectionTrackMap[q.sectionId!]?.sectionTitle ?? "",
          trackId: sectionTrackMap[q.sectionId!]?.trackId ?? "",
          trackTitle: sectionTrackMap[q.sectionId!]?.trackTitle ?? "",
        }));

        res.json({ questions: enriched, total: enriched.length, page: parseInt(page) || 1, pageSize: limit });
      } catch (error) {
        console.error("quiz-questions browse error:", error);
        res.status(500).json({ error: "Failed to fetch quiz questions" });
      }
    }
  );
}
