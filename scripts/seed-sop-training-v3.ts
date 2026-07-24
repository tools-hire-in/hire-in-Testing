/**
 * Seed script: SOP Training v3 Quiz Bank
 *
 * Reads attached_assets/hirein_sop_quiz_bank_v3_seed_*.json and inserts:
 *  - 21 learningTracks (one per training module)
 *  - 5 lesson sections per module (from lessonBlocks[])
 *  - 1 "Module Assessment" section per module (orderIndex = 5)
 *  - 8 sectionQuizQuestions per module (linked to the assessment section)
 *  - sectionQuizOptions rows for each option (backward compat)
 *
 * Safe to re-run: uses ON CONFLICT DO NOTHING / skip-if-exists logic.
 * Exits 1 if QA assertions fail after seeding.
 *
 * Run: npx tsx scripts/seed-sop-training-v3.ts
 */

import { db } from "../server/db";
import { eq, and, sql } from "drizzle-orm";
import {
  learningTracks, trackSections, sectionQuizQuestions, sectionQuizOptions,
} from "../shared/schema";
import fs from "fs";
import path from "path";

const SEED_FILE = path.join(
  process.cwd(),
  "attached_assets",
  "hirein_sop_quiz_bank_v3_seed_1784861801576.json"
);

const HIGH_PASS_IDS = new Set(["HIS-TRN-HC-001", "HIS-TRN-LEGAL-001", "HIS-TRN-OPS-001"]);

function getPassingScore(trainingId: string, moduleScore: number): number {
  if (HIGH_PASS_IDS.has(trainingId)) return 90;
  return moduleScore ?? 80;
}

async function run() {
  if (!fs.existsSync(SEED_FILE)) {
    console.error(`Seed file not found: ${SEED_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(SEED_FILE, "utf-8");
  const seedData = JSON.parse(raw);
  const modules: any[] = seedData.trainingModules ?? [];

  console.log(`Loaded ${modules.length} training modules from seed file.`);

  let tracksUpserted = 0;
  let sectionsCreated = 0;
  let questionsCreated = 0;
  let optionsCreated = 0;

  for (const mod of modules) {
    const trainingId: string = mod.trainingId;
    const passingScore = getPassingScore(trainingId, mod.passingScore ?? 80);
    const acknowledgmentRequired: boolean = mod.acknowledgmentRequired ?? true;

    const audience: string = mod.audience ?? "";
    let targetRole = "";
    if (audience.toLowerCase().includes("manager")) targetRole = "manager";
    else if (audience.toLowerCase().includes("hr")) targetRole = "hr";

    // Upsert learning track keyed by trainingId column
    let trackId: string;
    const existing = await db.select({ id: learningTracks.id })
      .from(learningTracks)
      .where(eq(learningTracks.trainingId, trainingId))
      .limit(1);

    if (existing.length > 0) {
      trackId = existing[0].id;
      await db.update(learningTracks)
        .set({
          title: mod.title,
          description: mod.why ?? mod.description ?? "",
          targetRole,
          version: "3.0",
          isUniversal: targetRole === "",
          passingScore,
          acknowledgmentRequired,
        } as any)
        .where(eq(learningTracks.id, trackId));
      console.log(`  Updated track: ${trainingId}`);
    } else {
      const [inserted] = await db.insert(learningTracks).values({
        trainingId,
        title: mod.title,
        description: mod.why ?? "",
        targetRole,
        version: "3.0",
        status: "published",
        isUniversal: targetRole === "",
        isPolicyTrack: false,
        passingScore,
        acknowledgmentRequired,
      } as any).returning({ id: learningTracks.id });
      trackId = inserted.id;
      console.log(`  Created track: ${trainingId}`);
    }
    tracksUpserted++;

    // Create lesson block sections (orderIndex 0–4)
    const lessonBlocks: any[] = mod.lessonBlocks ?? [];
    for (let i = 0; i < lessonBlocks.length; i++) {
      const lb = lessonBlocks[i];
      const sectionTitle = lb.topic ?? `Lesson ${i + 1}`;
      const body = [
        lb.trainer_notes ? `**Trainer Notes**\n${lb.trainer_notes}` : "",
        lb.learner_activity ? `**Activity**\n${lb.learner_activity}` : "",
        lb.evidence ? `**Evidence**\n${lb.evidence}` : "",
      ].filter(Boolean).join("\n\n");

      const existingSec = await db.select({ id: trackSections.id })
        .from(trackSections)
        .where(and(eq(trackSections.trackId, trackId), eq(trackSections.orderIndex, i)))
        .limit(1);

      if (existingSec.length === 0) {
        const durationMin = parseInt(String(mod.duration ?? "45")) || 45;
        await db.insert(trackSections).values({
          trackId,
          title: sectionTitle,
          body,
          orderIndex: i,
          estimatedMinutes: Math.max(1, Math.ceil(durationMin / (lessonBlocks.length + 1))),
          minDwellSeconds: 90,
        } as any);
        sectionsCreated++;
      }
    }

    // Create Module Assessment section (orderIndex = 5)
    const assessmentIdx = 5;
    const existingAssess = await db.select({ id: trackSections.id })
      .from(trackSections)
      .where(and(eq(trackSections.trackId, trackId), eq(trackSections.orderIndex, assessmentIdx)))
      .limit(1);

    let assessmentSectionId: string;
    if (existingAssess.length > 0) {
      assessmentSectionId = existingAssess[0].id;
    } else {
      const [assessSec] = await db.insert(trackSections).values({
        trackId,
        title: "Module Assessment",
        body: `Complete all ${mod.quizQuestions?.length ?? 8} questions to pass this module. Required score: ${passingScore}%.`,
        orderIndex: assessmentIdx,
        estimatedMinutes: 10,
        minDwellSeconds: 0,
      } as any).returning({ id: trackSections.id });
      assessmentSectionId = assessSec.id;
      sectionsCreated++;
    }

    // Clean up any pre-existing quiz questions without a question_id (leftover from previous non-v3 seeds)
    // These would cause the 9-question bug since our skip-if-exists check uses question_id
    await db.execute(sql`
      DELETE FROM section_quiz_questions
      WHERE section_id = ${assessmentSectionId} AND (question_id IS NULL OR question_id = '')
    `);

    // Seed quiz questions into the assessment section
    const quizQuestions: any[] = mod.quizQuestions ?? [];
    for (const q of quizQuestions) {
      const questionId: string = q.questionId;

      // Check if already seeded (by question_id column)
      const existingQ = await db.select({ id: sectionQuizQuestions.id })
        .from(sectionQuizQuestions)
        .where(and(
          eq(sectionQuizQuestions.sectionId, assessmentSectionId),
          sql`question_id = ${questionId}`,
        ))
        .limit(1);

      if (existingQ.length > 0) continue;

      const options: any[] = q.options ?? [];
      const optionsJson = JSON.stringify(options.map((o: any, oi: number) => ({
        key: o.key,
        text: o.text,
        isCorrect: o.isCorrect,
        orderIndex: oi,
      })));

      const [insertedQ] = await db.insert(sectionQuizQuestions).values({
        sectionId: assessmentSectionId,
        questionText: q.prompt,
        explanation: q.rationale ?? "",
      } as any).returning({ id: sectionQuizQuestions.id });

      // Update new v3 columns via raw SQL (ALTER TABLE-added columns)
      // Arrays/objects must be pre-serialized as JSON strings before ::jsonb cast
      const tagsJson = JSON.stringify(q.tags ?? []);
      await db.execute(sql`
        UPDATE section_quiz_questions SET
          question_type         = ${q.question_type ?? "single_choice"},
          cognitive_level       = ${q.cognitive_level ?? ""},
          tags                  = ${tagsJson}::jsonb,
          auto_gradable         = ${q.auto_gradable ?? true},
          points                = ${q.points ?? 1},
          options               = ${optionsJson}::jsonb,
          correct_option        = ${q.correct_option ?? ""},
          correct_answer_text   = ${q.correct_answer_text ?? ""},
          requires_human_review = ${q.requires_human_review ?? false},
          quiz_version          = ${String(mod.quizVersion ?? "3.0")},
          question_no           = ${q.questionNo},
          question_id           = ${questionId}
        WHERE id = ${insertedQ.id}
      `);
      questionsCreated++;

      // Insert options into sectionQuizOptions (backward compat)
      for (let oi = 0; oi < options.length; oi++) {
        const opt = options[oi];
        await db.insert(sectionQuizOptions).values({
          questionId: insertedQ.id,
          optionText: opt.text,
          isCorrect: opt.isCorrect === true,
          orderIndex: oi,
        } as any);
        optionsCreated++;
      }
    }

    process.stdout.write(`.`);
  }

  console.log(`\n\n--- Seed phase complete ---`);
  console.log(`Tracks upserted  : ${tracksUpserted}`);
  console.log(`Sections created : ${sectionsCreated}`);
  console.log(`Questions created: ${questionsCreated}`);
  console.log(`Options created  : ${optionsCreated}`);

  // ── Post-import QA assertions ──────────────────────────────────────────────
  console.log("\n--- Running QA assertions ---");

  const trackCount = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM learning_tracks WHERE training_id LIKE 'HIS-TRN-%'
  `).then(r => parseInt((r.rows[0] as any).cnt));

  const questionCount = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM section_quiz_questions
    WHERE section_id IN (
      SELECT ts.id FROM track_sections ts
      JOIN learning_tracks lt ON ts.track_id = lt.id
      WHERE lt.training_id LIKE 'HIS-TRN-%' AND ts.title = 'Module Assessment'
    )
  `).then(r => parseInt((r.rows[0] as any).cnt));

  const hrReviewCount = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM section_quiz_questions
    WHERE section_id IN (
      SELECT ts.id FROM track_sections ts
      JOIN learning_tracks lt ON ts.track_id = lt.id
      WHERE lt.training_id LIKE 'HIS-TRN-%' AND ts.title = 'Module Assessment'
    ) AND requires_human_review = TRUE
  `).then(r => parseInt((r.rows[0] as any).cnt));

  const perModuleCounts = await db.execute(sql`
    SELECT lt.training_id, COUNT(sqq.id) AS q_count
    FROM learning_tracks lt
    JOIN track_sections ts ON ts.track_id = lt.id AND ts.title = 'Module Assessment'
    JOIN section_quiz_questions sqq ON sqq.section_id = ts.id
    WHERE lt.training_id LIKE 'HIS-TRN-%'
    GROUP BY lt.training_id
    HAVING COUNT(sqq.id) != 8
  `).then(r => r.rows as any[]);

  const failures: string[] = [];
  if (trackCount < 21) failures.push(`Expected ≥21 HIS-TRN tracks, found ${trackCount}`);
  if (questionCount < 168) failures.push(`Expected ≥168 quiz questions across all modules, found ${questionCount}`);
  if (hrReviewCount > 0) failures.push(`Expected 0 requires_human_review questions, found ${hrReviewCount}`);
  if (perModuleCounts.length > 0) {
    const badMods = perModuleCounts.map(r => `${r.training_id}(${r.q_count}q)`).join(", ");
    failures.push(`Modules without exactly 8 questions: ${badMods}`);
  }

  if (failures.length > 0) {
    console.error("\n✗ QA ASSERTIONS FAILED:");
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log(`✓ HIS-TRN tracks in DB  : ${trackCount} (expected ≥21)`);
  console.log(`✓ Quiz questions in DB  : ${questionCount} (expected 168)`);
  console.log(`✓ requires_human_review : ${hrReviewCount} (expected 0)`);
  console.log(`✓ All modules have exactly 8 questions`);
  console.log("\n✅ All QA assertions passed — v3 Quiz Bank seed is complete.\n");

  process.exit(0);
}

run().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
