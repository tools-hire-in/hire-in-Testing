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
 *   admin      → role: admin, super_admin (2 admin-specific additions appended after hr steps)
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { isRouteReachableByTrack } from "@shared/onboardingRbac";
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
  if (!m) return null;
  // Strip trailing punctuation (period, comma, semicolon) that may be part of the sentence
  return m[2].replace(/[.,;]+$/, "");
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

// ── Admin-specific steps (not from a source doc file) ─────────────────────────
/**
 * Two admin/super_admin-only steps that extend the HR track.
 * These cover the onboarding flow itself — enabling it in production and the
 * QA enforcer flag used during testing.
 */
const ADMIN_SPECIFIC_STEPS: ParsedStep[] = [
  {
    track: "admin",
    stepNumber: 1,
    title: "Enable the Onboarding Flow in Production",
    isHighRisk: false,
    purpose:
      "Activate the interactive onboarding overlay for all users by toggling the master feature flag. Without this, no user sees the onboarding flow regardless of their role.",
    whereToFind: "/admin/settings/feature-flags",
    navRoute: "/admin/settings/feature-flags",
    howToUse:
      "1. Go to `/admin/settings/feature-flags`.\n2. Locate the `onboarding_flow_enabled` flag.\n3. Toggle it ON.\n4. Log out and log back in to confirm the onboarding overlay appears in your own session.\n\nThis is the master switch — it controls whether any user sees the onboarding flow. Turning it OFF hides the flow for all users immediately.",
    importantRules: [
      "Only super_admin and admin can toggle feature flags.",
      "Changes take effect immediately — there is no staging step.",
      "The flag controls visibility only — existing progress records are not deleted when the flag is OFF.",
      "Confirm the overlay appears in your own session after enabling before announcing it to users.",
    ],
    commonMistake: null,
    scenario: null,
    practicalExercise:
      "Toggle `onboarding_flow_enabled` ON, log out, log back in, and confirm that the onboarding overlay appears. Then navigate to your role's first step and verify the step content loads correctly.",
    knowledgeCheck: [
      {
        question: "What is the master switch that controls whether any user sees the onboarding flow?",
        answer: "The `onboarding_flow_enabled` feature flag at /admin/settings/feature-flags.",
      },
      {
        question: "If you turn the onboarding flow flag OFF, are existing user progress records deleted?",
        answer: "No — progress records are preserved. The flag only hides the overlay.",
      },
      {
        question: "Who can toggle the onboarding_flow_enabled flag?",
        answer: "super_admin and admin only.",
      },
      {
        question: "When do flag changes take effect?",
        answer: "Immediately — there is no staging or confirmation step.",
      },
      {
        question: "How do you confirm the flag change worked?",
        answer: "Log out and log back in — the onboarding overlay should appear in your own session.",
      },
    ],
    whereToGetHelp:
      "Feature flag engineering rules: `docs/engineering/ENGINEERING_RUNBOOK.md` §Feature Flags.",
  },
  {
    track: "admin",
    stepNumber: 2,
    title: "QA Enforcer Flag (Dev/QA Only)",
    isHighRisk: false,
    purpose:
      "Use the `onboarding_enforce_always` flag to force the onboarding overlay to re-appear on every login, regardless of prior completion. This is for testing role tracks without resetting the database.",
    whereToFind: "/admin/settings/feature-flags",
    navRoute: "/admin/settings/feature-flags",
    howToUse:
      "1. Go to `/admin/settings/feature-flags`.\n2. Locate `onboarding_enforce_always`.\n3. Toggle it ON.\n4. Log out, log back in — the overlay re-appears even if you previously completed all steps.\n5. Walk through the flow to verify content and guardrails work correctly.\n6. **Toggle OFF before releasing to production.**",
    importantRules: [
      "This flag must be OFF before releasing to production. It is for testing only.",
      "With this flag ON, all users see the onboarding overlay on every login, regardless of completion status.",
      "Use this to QA-test any role track without needing DB resets or new test accounts.",
      "The flag does not affect knowledge check results or progress records — they are still written normally.",
    ],
    commonMistake:
      "Leaving `onboarding_enforce_always` ON when releasing to production. Every user will see the onboarding overlay on every login, including users who completed onboarding weeks ago. Always turn this flag OFF before a production release.",
    scenario: null,
    practicalExercise:
      "Toggle `onboarding_enforce_always` ON. Log out, log back in. Confirm the onboarding overlay re-appears. Walk all steps for your role. Verify: HIGH RISK badge appears on payroll steps, knowledge check blocks the confirm button until all questions are reviewed. Then toggle the flag OFF.",
    knowledgeCheck: [
      {
        question: "What does the `onboarding_enforce_always` flag do?",
        answer: "Forces the onboarding overlay to re-appear on every login, regardless of completion status.",
      },
      {
        question: "When must this flag be turned OFF?",
        answer: "Before every production release — it is for dev/QA testing only.",
      },
      {
        question: "Why is this flag useful for testing?",
        answer: "You can QA-test any role track without DB resets or creating new test accounts.",
      },
      {
        question: "Does enabling this flag delete existing progress records?",
        answer: "No — progress and knowledge check records are still written normally.",
      },
      {
        question: "Which roles are affected when this flag is ON?",
        answer: "All users — every role sees the overlay on every login while the flag is ON.",
      },
    ],
    whereToGetHelp:
      "Feature flag engineering rules: `docs/engineering/ENGINEERING_RUNBOOK.md` §Feature Flags.",
  },
];

// ── Seed function ─────────────────────────────────────────────────────────────

/**
 * Upsert all onboarding steps from the source markdown docs on every startup.
 *
 * Behaviour:
 * - New rows are inserted.
 * - Existing rows are updated only when content has changed (IS DISTINCT FROM
 *   comparison on every content field — no-op writes are avoided).
 * - `is_active` is preserved from the DB value so that admin toggles survive
 *   restarts.  Set REFRESH_ONBOARDING_SEED=true to also reset is_active back to
 *   the seeded default (useful after a doc restructure or a track-level reset).
 * - User progress records (user_onboarding_progress) are never touched.
 */
export async function seedOnboardingSteps(): Promise<void> {
  const forceRefresh = process.env.REFRESH_ONBOARDING_SEED === "true";

  // Parse all four source docs
  const allSteps: ParsedStep[] = [
    ...parseTrackFile("employee-onboarding-track-source.md", "employee"),
    ...parseTrackFile("manager-onboarding-track-source.md", "manager"),
    // HR/Admin source covers hr, admin, and super_admin — seeded under the 'hr' track
    // (see "Training track target audience" in the source file header).
    ...parseTrackFile("hr-admin-onboarding-track-source.md", "hr"),
    ...parseTrackFile("executive-onboarding-track-source.md", "executive"),
    // Admin-specific additions (2 steps for admin/super_admin, appended after hr steps)
    ...ADMIN_SPECIFIC_STEPS,
  ];

  console.log(
    `[onboarding-flow-seed] Upserting ${allSteps.length} steps across 5 tracks (forceRefresh=${forceRefresh})...`,
  );

  let updated = 0;
  let unchanged = 0;

  for (const step of allSteps) {
    const result = await db.execute(sql`
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
      ON CONFLICT (track, step_number) DO UPDATE SET
        title              = EXCLUDED.title,
        purpose            = EXCLUDED.purpose,
        where_to_find      = EXCLUDED.where_to_find,
        nav_route          = EXCLUDED.nav_route,
        how_to_use         = EXCLUDED.how_to_use,
        important_rules    = EXCLUDED.important_rules,
        is_high_risk       = EXCLUDED.is_high_risk,
        common_mistake     = EXCLUDED.common_mistake,
        scenario           = EXCLUDED.scenario,
        practical_exercise = EXCLUDED.practical_exercise,
        knowledge_check    = EXCLUDED.knowledge_check,
        where_to_get_help  = EXCLUDED.where_to_get_help,
        is_active          = CASE WHEN ${forceRefresh} THEN EXCLUDED.is_active
                                  ELSE onboarding_steps.is_active END,
        updated_at         = NOW()
      WHERE (
        ${forceRefresh} OR
        onboarding_steps.title              IS DISTINCT FROM EXCLUDED.title OR
        onboarding_steps.purpose            IS DISTINCT FROM EXCLUDED.purpose OR
        onboarding_steps.where_to_find      IS DISTINCT FROM EXCLUDED.where_to_find OR
        onboarding_steps.nav_route          IS DISTINCT FROM EXCLUDED.nav_route OR
        onboarding_steps.how_to_use         IS DISTINCT FROM EXCLUDED.how_to_use OR
        onboarding_steps.important_rules    IS DISTINCT FROM EXCLUDED.important_rules OR
        onboarding_steps.is_high_risk       IS DISTINCT FROM EXCLUDED.is_high_risk OR
        onboarding_steps.common_mistake     IS DISTINCT FROM EXCLUDED.common_mistake OR
        onboarding_steps.scenario           IS DISTINCT FROM EXCLUDED.scenario OR
        onboarding_steps.practical_exercise IS DISTINCT FROM EXCLUDED.practical_exercise OR
        onboarding_steps.knowledge_check    IS DISTINCT FROM EXCLUDED.knowledge_check OR
        onboarding_steps.where_to_get_help  IS DISTINCT FROM EXCLUDED.where_to_get_help
      )
    `);
    if ((result.rowCount ?? 0) > 0) {
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log(
    `[onboarding-flow-seed] Done — ${updated} steps updated/inserted, ${unchanged} unchanged.`,
  );
}

// ── Manager gap-filling steps (Steps 6–9) ─────────────────────────────────────
// These four steps are not in the manager source doc (confirmed gaps in
// docs/training/TRAINING_GAP_MAP.md §Persona 3 Manager). They are derived
// from platform behaviour (routes, schema, business rules) and seeded via an
// always-run upsert so they survive re-deployments.
//
// Step 8 is seeded with isActive=false because the performance_management flag
// is OFF by default. An admin content manager can activate it when the flag is ON.

interface GapStep {
  stepNumber: number;
  title: string;
  isHighRisk: boolean;
  purpose: string;
  whereToFind: string;
  navRoute: string;
  howToUse: string;
  importantRules: string[];
  commonMistake: string | null;
  scenario: string | null;
  practicalExercise: string | null;
  knowledgeCheck: KnowledgeCheckItem[];
  whereToGetHelp: string;
  isActive: boolean;
}

const MANAGER_GAP_STEPS: GapStep[] = [
  // ── Step 6: Team Training Compliance ───────────────────────────────────────
  {
    stepNumber: 6,
    title: "Team Training Compliance",
    isHighRisk: false,
    purpose:
      "Read your team's training completion status, identify who is overdue, understand how the compliance lock affects team members, and know how to request a training extension on their behalf.",
    whereToFind: "My Team → Training tab (/admin/hr/my-team?tab=training-progress)",
    navRoute: "/admin/hr/my-team?tab=training-progress",
    howToUse: `**Reading training progress:**
1. Go to My Team → Training tab.
2. Each row shows the employee's completion percentage and any overdue assignments.
3. A member with 0% on an overdue track is the highest-priority risk.

**When a team member is at risk of a compliance lock:**
1. Identify the overdue track and its due date.
2. If the member is in a \`full\` enforcement wave and is past the due date, they will be locked out of the portal.
3. You cannot clear a compliance lock yourself.

**Submitting a training extension request:**
1. Contact HR with the employee's name, the overdue training track, and the reason more time is needed.
2. HR reviews the request and, if approved, updates the due date in the system.
3. The lock lifts automatically once HR applies the extension — no further action required.`,
    importantRules: [
      "A compliance lock activates only when two conditions are both true: training is overdue past the due date, AND the employee's rollout wave is set to `full` enforcement.",
      "Employees in `soft` or `measured` waves see a warning banner but are not locked out.",
      "You cannot clear a compliance lock for a team member — only HR can apply an extension (updates due date) or exception (permanently bypasses the requirement).",
      "The best prevention is coaching your team to complete training before the due date.",
    ],
    commonMistake: null,
    scenario: null,
    practicalExercise: null,
    knowledgeCheck: [
      {
        question:
          "A team member is in a 'measured' enforcement wave and their training is overdue. Will they be locked out of the portal?",
        answer:
          "No. Compliance locks only activate in 'full' enforcement waves. Measured enforcement shows a warning banner but does not restrict portal access.",
      },
      {
        question:
          "What must you do if a team member needs more time to complete an overdue training track?",
        answer:
          "Submit a training extension request to HR with the employee's name, the overdue track, and the reason. HR approves and updates the due date — you cannot do this yourself.",
      },
      {
        question:
          "Where do you see each team member's training completion percentage and overdue assignments?",
        answer:
          "My Team → Training tab (/admin/hr/my-team?tab=training-progress).",
      },
      {
        question:
          "Can a manager directly remove a compliance lock for a team member?",
        answer:
          "No. Only HR can remove a compliance lock, by granting either a training extension (updates the due date) or a training exception (permanently bypasses the requirement).",
      },
    ],
    whereToGetHelp:
      "Contact HR to submit a training extension request for a team member, or to clarify which rollout wave an employee belongs to.",
    isActive: true,
  },

  // ── Step 7: SOP Reading and Acknowledgment ─────────────────────────────────
  {
    stepNumber: 7,
    title: "SOP Reading and Acknowledgment",
    isHighRisk: false,
    purpose:
      "Understand how SOPs are assigned to your role by wave, what soft, measured, and full enforcement means for you personally, how to find and acknowledge your unread SOPs, and what happens if you miss your own SOP deadline under full enforcement.",
    whereToFind: "SOP Library (/admin/sops)",
    navRoute: "/admin/sops",
    howToUse: `**Finding your assigned SOPs:**
1. Go to /admin/sops.
2. Unacknowledged SOPs assigned to your role are highlighted. Filter by "Pending acknowledgment" to see only unread assignments.
3. Click on an SOP to read its full content.
4. Click "Acknowledge" to confirm you have read and understood it.

**Understanding enforcement levels:**
Your rollout wave determines how the system responds if you miss the acknowledgment deadline.
- \`soft\`: A banner appears on your dashboard. Portal access is unrestricted.
- \`measured\`: A more prominent warning is shown. Access remains unrestricted.
- \`full\`: If you miss the deadline, the compliance lock activates — you are blocked from the portal until you complete the overdue acknowledgment.

**Connection to your team:**
- If a team member hits a compliance lock, you will see it in My Team → Training tab.
- Your own SOP compliance and your team's compliance are tracked separately.`,
    importantRules: [
      "As a manager, you are subject to the same wave enforcement rules as your team members — including the compliance lock under full enforcement.",
      "Unacknowledged SOPs assigned to your role remain visible in /admin/sops until you acknowledge them.",
      "SOPs are versioned — acknowledging a version locks your acknowledgment to that content. A major published update may require a fresh acknowledgment.",
      "SOP acknowledgment (policy compliance) is separate from training track completion — both systems can generate compliance locks independently.",
    ],
    commonMistake: null,
    scenario: null,
    practicalExercise: null,
    knowledgeCheck: [
      {
        question:
          "You are in a 'measured' enforcement wave and miss your SOP acknowledgment deadline. Will you be locked out of the portal?",
        answer:
          "No. Measured enforcement shows a warning but does not lock portal access. Only 'full' enforcement triggers a compliance lock.",
      },
      {
        question:
          "Where do you go to find SOPs that are assigned to your role and pending acknowledgment?",
        answer:
          "/admin/sops — filter by 'Pending acknowledgment' to see only unread assignments.",
      },
      {
        question:
          "What happens to your portal access if you are in a 'full' enforcement wave and miss your SOP deadline?",
        answer:
          "The compliance lock activates — you are blocked from the portal until you complete the overdue acknowledgment.",
      },
      {
        question:
          "If a team member hits a compliance lock, where do you see this?",
        answer:
          "My Team → Training tab (/admin/hr/my-team?tab=training-progress) — it shows each team member's compliance status.",
      },
    ],
    whereToGetHelp:
      "Contact HR for questions about your assigned SOPs or your rollout wave. Contact the Operations team for SOP governance questions.",
    isActive: true,
  },

  // ── Step 8: Performance Goals and Check-ins (flag-gated, seeded inactive) ──
  {
    stepNumber: 8,
    title: "Performance Goals and Check-ins",
    isHighRisk: false,
    purpose:
      "Set and track performance goals for your team members, create check-in records from your 1:1 conversations, understand the review cycle timeline, and distinguish performance check-ins from probation milestones.",
    whereToFind:
      "Performance → Goals (/admin/performance/goals) and Check-ins (/admin/performance/check-ins)",
    navRoute: "/admin/performance/goals",
    howToUse: `**Setting a goal for a team member:**
1. Go to /admin/performance/goals → click "New Goal".
2. Select the team member, goal type (individual / team / company alignment), title, description, and target date.
3. Link a KPI or SOP if applicable.
4. Click "Save" — the goal appears in your team member's goals view.

**Creating a performance check-in:**
1. Go to /admin/performance/check-ins → click "New Check-in".
2. Select the team member and the conversation date.
3. Add notes, observations, and any agreed next steps.
4. Save — this is saved as a freeform conversation record (not a plan milestone).

**Submitting a manager review:**
1. HR creates review cycles that define the period and participants.
2. You submit a manager review for each team member in the cycle.
3. Both your review and the employee's self-review become visible after the submission deadline — neither party sees the other's review until then.

**Key distinction — performance vs. probation:**
- A performance check-in is a freeform conversation record in the performance module.
- A probation plan check-in is a formal scheduled milestone (Day 1/7/15/30/45/60/75/90) that affects the plan cadence and triggers 3-strike escalation if missed.
- Completing a performance check-in does NOT count as completing a probation milestone.`,
    importantRules: [
      "Performance goals are separate from probation plan milestones — do not use one to satisfy the other.",
      "Goal types: individual (personal development), team (shared team target), company alignment (linked to company OKRs).",
      "This feature is controlled by the Performance Management feature flag. Contact your Admin to enable it.",
      "Performance review scores are confidential — neither party sees the other's review until after the submission deadline.",
    ],
    commonMistake: null,
    scenario: null,
    practicalExercise: null,
    knowledgeCheck: [
      {
        question:
          "What is the key difference between a performance check-in and a probation plan check-in?",
        answer:
          "A performance check-in is a freeform conversation record in the performance module. A probation check-in is a formal scheduled milestone (Day 1/7/15/30/45/60/75/90) that affects plan cadence and triggers 3-strike escalation if missed. They are separate features.",
      },
      {
        question:
          "What are the three goal types available in the performance module?",
        answer:
          "Individual (personal development), Team (shared team target), and Company Alignment (linked to company OKRs).",
      },
      {
        question:
          "If you cannot see the performance goals menu, what is the most likely cause?",
        answer:
          "The Performance Management feature flag is OFF. Contact your Admin to enable it.",
      },
      {
        question:
          "After you submit a manager review in a review cycle, when can the employee see your review?",
        answer:
          "After the submission deadline — both the manager review and the employee self-review become visible at the same time once the deadline passes.",
      },
    ],
    whereToGetHelp:
      "This feature is controlled by the Performance Management feature flag. Contact your Admin to enable it. For review cycle setup, contact HR.",
    isActive: false, // Seeded inactive — activate when performance_management flag is ON
  },

  // ── Step 9: Salary Advance Approvals ───────────────────────────────────────
  {
    stepNumber: 9,
    title: "Salary Advance Approvals",
    isHighRisk: false,
    purpose:
      "Understand when a team member's advance request reaches you for approval, the 50% threshold CEO escalation rule, how overpayments differ from standard advances, and how automatic payroll recovery works.",
    whereToFind: "Salary Advance — Approvals tab (/admin/salary-advance)",
    navRoute: "/admin/salary-advance",
    howToUse: `**Approving a team member's advance request:**
1. Go to /admin/salary-advance → Approvals tab.
2. Review pending requests from your direct reports.
3. Check the requested amount, number of installments, and any outstanding balance.
4. Click "Approve" or "Reject" (provide a reason if rejecting).
5. After your approval, the request moves to HR for final approval and disbursement.

**50% threshold and CEO escalation:**
- If the amount exceeds 50% of the employee's monthly net salary, it is automatically escalated to super_admin (CEO) for a second approval — after yours.
- For amounts within the 50% threshold, your approval and HR final approval are sufficient.

**Overpayment vs. standard advance:**
- A standard advance is requested by the employee and approved: manager → HR → disbursed.
- An overpayment is recorded by HR (not requested by the employee) when salary was paid in excess. The full overpayment is recovered from the next payroll run; shortfalls carry forward.
- You do not approve overpayment recordings — those are HR-managed directly.

**Recovery:**
- Recovery is automatic each month: the payroll run deducts one installment.
- If net pay is insufficient in a recovery month, the shortfall carries forward to the next month — nothing is lost or forgiven.`,
    importantRules: [
      "Advance requests above 50% of net monthly salary require super_admin (CEO) approval in addition to your approval.",
      "Your approval scope is limited to your direct reports — you cannot act on requests from employees outside your team.",
      "Overpayments are recorded and managed by HR — manager approval is not required.",
      "Recovery is fully automatic from payroll. Shortfalls carry forward — they do not require manual intervention.",
      "The salary_advance_enabled flag must be ON for self-service requests. HR can record advances manually even when the flag is OFF.",
    ],
    commonMistake: null,
    scenario: null,
    practicalExercise: null,
    knowledgeCheck: [
      {
        question:
          "A team member requests an advance of 60% of their monthly net salary. What happens after you approve it?",
        answer:
          "The request is automatically escalated to super_admin (CEO) for a second approval, because it exceeds the 50% threshold.",
      },
      {
        question:
          "Does a manager need to approve an overpayment that HR records for a team member?",
        answer:
          "No. Overpayments are recorded and managed directly by HR — manager approval is not required.",
      },
      {
        question:
          "What happens to the advance recovery installment if the employee's net salary in a given month is too small to cover it?",
        answer:
          "The shortfall carries forward to the next month automatically — it is not cancelled or forgiven.",
      },
      {
        question:
          "Can a manager approve an advance request for an employee who is not in their direct team?",
        answer:
          "No. Manager approval scope is limited to direct reports only.",
      },
    ],
    whereToGetHelp:
      "Contact HR for advance status questions, overpayment queries, or if an employee needs a manually recorded advance when the self-service flag is OFF.",
    isActive: true,
  },
];

/**
 * Upsert the 4 gap-filling manager steps (6–9) derived from platform behaviour.
 * Runs on every startup after seedOnboardingSteps() — uses ON CONFLICT DO UPDATE
 * so the content is kept current without requiring a table wipe.
 */
export async function seedManagerGapSteps(): Promise<void> {
  try {
    const existingResult = await db.execute(
      sql`SELECT COUNT(*)::int AS count FROM onboarding_steps WHERE track = 'manager'`,
    );
    const managerCount = (existingResult.rows[0] as { count: number })?.count ?? 0;

    if (managerCount === 0) {
      console.log(
        "[onboarding-flow-seed] Manager track not yet seeded — gap steps will be added when the main seed runs.",
      );
      return;
    }

    // ── RBAC navRoute pre-validation ─────────────────────────────────────────
    // Verify every navRoute is reachable by the manager track before upserting.
    // Step 8 is seeded inactive (flag-gated) — its navRoute is still validated
    // so that activating it later doesn't silently point to an unreachable route.
    for (const step of MANAGER_GAP_STEPS) {
      const reachable = isRouteReachableByTrack(step.navRoute, "manager");
      if (!reachable) {
        console.warn(
          `[onboarding-flow-seed] WARNING: manager gap step ${step.stepNumber} ` +
          `navRoute '${step.navRoute}' is NOT in the manager RBAC route list. ` +
          `Add it to shared/onboardingRbac.ts before activating this step.`,
        );
      }
    }

    console.log(`[onboarding-flow-seed] Upserting ${MANAGER_GAP_STEPS.length} manager gap steps...`);

    for (const step of MANAGER_GAP_STEPS) {
      await db.execute(sql`
        INSERT INTO onboarding_steps (
          track, step_number, title, purpose, where_to_find, nav_route, how_to_use,
          important_rules, is_high_risk, common_mistake, scenario, practical_exercise,
          knowledge_check, where_to_get_help, is_active
        ) VALUES (
          'manager'::onboarding_track,
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
          ${JSON.stringify(step.knowledgeCheck)}::jsonb,
          ${step.whereToGetHelp},
          ${step.isActive}
        )
        ON CONFLICT (track, step_number) DO UPDATE SET
          title           = EXCLUDED.title,
          purpose         = EXCLUDED.purpose,
          where_to_find   = EXCLUDED.where_to_find,
          nav_route       = EXCLUDED.nav_route,
          how_to_use      = EXCLUDED.how_to_use,
          important_rules = EXCLUDED.important_rules,
          is_high_risk    = EXCLUDED.is_high_risk,
          common_mistake  = EXCLUDED.common_mistake,
          scenario        = EXCLUDED.scenario,
          practical_exercise = EXCLUDED.practical_exercise,
          knowledge_check = EXCLUDED.knowledge_check,
          where_to_get_help = EXCLUDED.where_to_get_help,
          is_active       = CASE
                              WHEN onboarding_steps.knowledge_check IS NULL THEN EXCLUDED.is_active
                              ELSE onboarding_steps.is_active
                            END,
          updated_at      = NOW()
      `);
    }

    console.log(
      `[onboarding-flow-seed] Manager gap steps (6–9) upserted successfully.`,
    );
  } catch (err) {
    console.error("[onboarding-flow-seed] seedManagerGapSteps error (non-fatal):", err);
  }
}

/**
 * Upserts the 2 admin-specific onboarding steps on every startup.
 *
 * Now that `seedOnboardingSteps()` always upserts (no longer skips on row count),
 * this function is a safety-net for admin steps that may be added between
 * deployments.  It uses the same content-comparing DO UPDATE pattern so that
 * content changes in ADMIN_SPECIFIC_STEPS are applied on the next restart
 * without a table wipe.  `is_active` is preserved from the DB unless
 * REFRESH_ONBOARDING_SEED=true.
 */
export async function ensureAdminOnboardingSteps(): Promise<void> {
  const forceRefresh = process.env.REFRESH_ONBOARDING_SEED === "true";

  for (const step of ADMIN_SPECIFIC_STEPS) {
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
      ON CONFLICT (track, step_number) DO UPDATE SET
        title              = EXCLUDED.title,
        purpose            = EXCLUDED.purpose,
        where_to_find      = EXCLUDED.where_to_find,
        nav_route          = EXCLUDED.nav_route,
        how_to_use         = EXCLUDED.how_to_use,
        important_rules    = EXCLUDED.important_rules,
        is_high_risk       = EXCLUDED.is_high_risk,
        common_mistake     = EXCLUDED.common_mistake,
        scenario           = EXCLUDED.scenario,
        practical_exercise = EXCLUDED.practical_exercise,
        knowledge_check    = EXCLUDED.knowledge_check,
        where_to_get_help  = EXCLUDED.where_to_get_help,
        is_active          = CASE WHEN ${forceRefresh} THEN EXCLUDED.is_active
                                  ELSE onboarding_steps.is_active END,
        updated_at         = NOW()
      WHERE (
        ${forceRefresh} OR
        onboarding_steps.title              IS DISTINCT FROM EXCLUDED.title OR
        onboarding_steps.purpose            IS DISTINCT FROM EXCLUDED.purpose OR
        onboarding_steps.where_to_find      IS DISTINCT FROM EXCLUDED.where_to_find OR
        onboarding_steps.nav_route          IS DISTINCT FROM EXCLUDED.nav_route OR
        onboarding_steps.how_to_use         IS DISTINCT FROM EXCLUDED.how_to_use OR
        onboarding_steps.important_rules    IS DISTINCT FROM EXCLUDED.important_rules OR
        onboarding_steps.is_high_risk       IS DISTINCT FROM EXCLUDED.is_high_risk OR
        onboarding_steps.common_mistake     IS DISTINCT FROM EXCLUDED.common_mistake OR
        onboarding_steps.scenario           IS DISTINCT FROM EXCLUDED.scenario OR
        onboarding_steps.practical_exercise IS DISTINCT FROM EXCLUDED.practical_exercise OR
        onboarding_steps.knowledge_check    IS DISTINCT FROM EXCLUDED.knowledge_check OR
        onboarding_steps.where_to_get_help  IS DISTINCT FROM EXCLUDED.where_to_get_help
      )
    `);
  }
  console.log(
    `[onboarding-flow-seed] ensureAdminOnboardingSteps — ${ADMIN_SPECIFIC_STEPS.length} admin steps upserted.`,
  );
}
