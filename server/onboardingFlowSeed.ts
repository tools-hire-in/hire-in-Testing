/**
 * Onboarding Flow seed — reads content from docs/training source files.
 *
 * Source files (exact content, version-controlled):
 *   docs/training/employee-onboarding-track-source.md
 *   docs/training/manager-onboarding-track-source.md
 *   docs/training/hr-admin-onboarding-track-source.md  (covers hr, admin, super_admin)
 *   docs/training/executive-onboarding-track-source.md
 *
 * Track→role mapping:
 *   employee   → role: employee
 *   manager    → role: manager
 *   hr         → role: hr, admin, super_admin  (HR/Admin source doc covers all three)
 *   executive  → role: executive
 *   admin      → enum value reserved; currently no separate track seeded
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Path helper ───────────────────────────────────────────────────────────────
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function docPath(file: string): string {
  return join(ROOT, "docs", "training", file);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface KnowledgeCheckItem {
  question: string;
  answer: string;
}

interface ParsedStep {
  track: "employee" | "manager" | "hr" | "executive" | "admin";
  stepNumber: number;
  title: string;
  isHighRisk: boolean;
  purpose: string | null;
  whereToFind: string | null;
  navRoute: string | null;
  howToUse: string | null;
  importantRules: string[];
  commonMistake: string | null;
  scenario: string | null;
  practicalExercise: string | null;
  knowledgeCheck: KnowledgeCheckItem[] | null;
  whereToGetHelp: string;
}

// ── Markdown parser ───────────────────────────────────────────────────────────

/**
 * Extract the first `/admin/...` or `https://[...]...` nav path from a
 * "Where to find it" string.
 */
function extractNavRoute(whereToFind: string): string | null {
  const m = whereToFind.match(/(`|")?(\/admin\/[^\s`")\n]+)/);
  return m ? m[2] : null;
}

/**
 * Strip leading `- ` or `* ` and Markdown bold markers from a bullet line.
 * Returns null for blank lines.
 */
function parseBullet(line: string): string | null {
  const trimmed = line.replace(/^\s*[-*]\s+/, "").replace(/\*\*/g, "").trim();
  return trimmed || null;
}

/**
 * Pair numbered questions with their answers from a Knowledge Check section.
 *
 * Section format:
 *   1. Question one?
 *   2. Question two?
 *   ...
 *   *(Answers: 1 — Answer one; 2 — Answer two; ...)*
 */
function parseKnowledgeCheck(text: string): KnowledgeCheckItem[] | null {
  const questions: string[] = [];
  const qRegex = /^\d+\.\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = qRegex.exec(text)) !== null) {
    questions.push(m[1].trim());
  }
  if (questions.length === 0) return null;

  const answersMatch = text.match(/\*\(Answers:\s*([\s\S]+?)\)\*/);
  const answers: string[] = [];
  if (answersMatch) {
    // Each answer is "N — text" separated by ";"
    const raw = answersMatch[1].replace(/\n/g, " ").trim();
    const parts = raw.split(/;\s*/);
    for (const part of parts) {
      const aMatch = part.match(/^\d+\s*[—–-]\s*(.+)$/);
      if (aMatch) answers.push(aMatch[1].trim());
    }
  }

  return questions.map((q, i) => ({
    question: q,
    answer: answers[i] ?? "",
  }));
}

/**
 * Parse a single topic block (the text after `## Topic N:`) into a ParsedStep.
 */
function parseTopic(
  block: string,
  track: ParsedStep["track"],
  stepNumber: number,
): ParsedStep {
  const lines = block.split("\n");

  // First line: "N: Title [(HIGH RISK)]"
  const firstLine = lines[0].trim();
  const highRisk = /\(HIGH RISK\)/i.test(firstLine);
  const titleMatch = firstLine.match(/^\d+:\s+(.+?)(?:\s*\(HIGH RISK\))?\s*$/i);
  const title = titleMatch ? titleMatch[1].trim() : firstLine;

  // Extract **Purpose:** and **Where to find it:** from the header area
  // (before the first ### subsection)
  const firstSectionIdx = block.indexOf("\n### ");
  const header = firstSectionIdx >= 0 ? block.slice(0, firstSectionIdx) : block;

  const purposeMatch = header.match(/\*\*Purpose:\*\*\s*(.+?)(?=\n\n|\n\*\*|$)/s);
  const purpose = purposeMatch ? purposeMatch[1].replace(/\n/g, " ").trim() : null;

  const whereMatch = header.match(/\*\*Where to find it:\*\*\s*(.+?)(?=\n\n|\n\*\*|$)/s);
  const whereToFind = whereMatch
    ? whereMatch[1]
        .replace(/`/g, "")
        .replace(/\n/g, " ")
        .trim()
    : null;
  const navRoute = whereToFind ? extractNavRoute(whereToFind) : null;

  // Split into ### subsections
  const subsections = block.split(/\n### /);

  let howToUse: string | null = null;
  const importantRules: string[] = [];
  let commonMistake: string | null = null;
  let scenario: string | null = null;
  let practicalExercise: string | null = null;
  let knowledgeCheck: KnowledgeCheckItem[] | null = null;
  let whereToGetHelp = "";

  for (const sub of subsections.slice(1)) {
    const subLines = sub.split("\n");
    const subTitle = subLines[0].trim().toLowerCase();
    const subBody = subLines.slice(1).join("\n").trim();

    if (subTitle.startsWith("how to use")) {
      howToUse = subBody;
    } else if (subTitle.startsWith("important rules")) {
      for (const line of subBody.split("\n")) {
        const b = parseBullet(line);
        if (b) importantRules.push(b);
      }
    } else if (subTitle.startsWith("common mistake")) {
      commonMistake = subBody || null;
    } else if (subTitle.startsWith("scenario")) {
      scenario = subBody || null;
    } else if (subTitle.startsWith("practical exercise")) {
      practicalExercise = subBody || null;
    } else if (subTitle.startsWith("knowledge check")) {
      knowledgeCheck = parseKnowledgeCheck(subBody);
    } else if (subTitle.startsWith("where to get help")) {
      whereToGetHelp = subBody;
    } else if (
      subTitle.includes("understanding") ||
      subTitle.includes("deduction")
    ) {
      // Append to howToUse (executive Topic 2 has an extra table section)
      howToUse = howToUse
        ? `${howToUse}\n\n### ${subLines[0].trim()}\n${subBody}`
        : `### ${subLines[0].trim()}\n${subBody}`;
    }
  }

  return {
    track,
    stepNumber,
    title,
    isHighRisk: highRisk,
    purpose,
    whereToFind,
    navRoute,
    howToUse,
    importantRules,
    commonMistake,
    scenario,
    practicalExercise,
    knowledgeCheck,
    whereToGetHelp,
  };
}

/**
 * Parse an entire training source markdown file into an ordered array of steps.
 */
function parseTrackFile(
  file: string,
  track: ParsedStep["track"],
): ParsedStep[] {
  const content = readFileSync(docPath(file), "utf-8");
  // Split on "## Topic " — each element is one topic block
  const topicBlocks = content.split(/\n## Topic /).slice(1);
  return topicBlocks.map((block, idx) =>
    parseTopic(block.trim(), track, idx + 1),
  );
}

// ── Seed function ─────────────────────────────────────────────────────────────

export async function seedOnboardingSteps(): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM onboarding_steps`,
  );
  const count = (countResult.rows[0] as { count: number })?.count ?? 0;

  if (count > 0) {
    console.log(
      `[onboarding-flow-seed] onboarding_steps already has ${count} rows — skipping.`,
    );
    return;
  }

  // Parse all four source docs
  const allSteps: ParsedStep[] = [
    ...parseTrackFile("employee-onboarding-track-source.md", "employee"),
    ...parseTrackFile("manager-onboarding-track-source.md", "manager"),
    // HR/Admin source covers hr, admin, and super_admin — seeded under the 'hr' track
    // (see "Training track target audience" in the source file header).
    ...parseTrackFile("hr-admin-onboarding-track-source.md", "hr"),
    ...parseTrackFile("executive-onboarding-track-source.md", "executive"),
  ];

  console.log(
    `[onboarding-flow-seed] Seeding ${allSteps.length} steps across 4 tracks...`,
  );

  for (const step of allSteps) {
    await db.execute(sql`
      INSERT INTO onboarding_steps (
        track, step_number, title, purpose, where_to_find, nav_route, how_to_use,
        important_rules, is_high_risk, common_mistake, scenario, practical_exercise,
        knowledge_check, where_to_get_help, is_active
      ) VALUES (
        ${step.track}::onboarding_track,
        ${step.stepNumber},
        ${step.title},
        ${step.purpose},
        ${step.whereToFind},
        ${step.navRoute},
        ${step.howToUse},
        ${JSON.stringify(step.importantRules)}::jsonb,
        ${step.isHighRisk},
        ${step.commonMistake},
        ${step.scenario},
        ${step.practicalExercise},
        ${step.knowledgeCheck ? JSON.stringify(step.knowledgeCheck) : null}::jsonb,
        ${step.whereToGetHelp},
        true
      )
      ON CONFLICT (track, step_number) DO NOTHING
    `);
  }

  console.log(`[onboarding-flow-seed] Done — ${allSteps.length} steps seeded.`);
}
