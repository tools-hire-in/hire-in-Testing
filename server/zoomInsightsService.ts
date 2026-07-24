/**
 * Zoom AI Insights Engine
 *
 * Reads sanitized Zoom communications data (call logs + SMS digests) for each
 * recruiter and cross-references candidate funnel stage changes to produce
 * structured AI coaching insights per recruiter, plus a team-level digest.
 *
 * Privacy guarantees:
 *   - Raw phone numbers are NEVER included in prompts — only counts and durations.
 *   - Raw SMS messages are NEVER included — only pre-generated sanitized digests.
 *   - Recruiter names are anonymized in prompts (Recruiter A, B, ...).
 *
 * Primary export: generateInsightsForDate(date: string) → Promise<void>
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { z } from "zod";

// ── Zod schema for the AI response ───────────────────────────────────────────

const ColdCandidateSchema = z.object({
  label: z.string(),
  daysSinceContact: z.number().int().nonnegative(),
  stage: z.string(),
});

const ActionableGoalSchema = z.object({
  goal: z.string(),
  rationale: z.string(),
  urgency: z.enum(["high", "medium"]),
});

const RecruiterInsightSchema = z.object({
  responsivenessScore: z.number().min(0).max(100),
  coldCandidates: z.array(ColdCandidateSchema),
  conversationPatterns: z.array(z.string()),
  actionableGoals: z.array(ActionableGoalSchema).min(1).max(5),
});

const TeamInsightSchema = z.object({
  teamObservations: z.array(z.string()),
  suggestedTeamFocus: z.string(),
  topUrgentActions: z.array(z.string()),
});

export type RecruiterInsight = z.infer<typeof RecruiterInsightSchema>;
export type TeamInsight = z.infer<typeof TeamInsightSchema>;

// ── Rolling stats helper ──────────────────────────────────────────────────────

interface RollingStats {
  avgCallsPerDay: number;
  totalCallsInPeriod: number;
  totalCallDurationSeconds: number;
  missedCallCount: number;
  answeredCallCount: number;
  stageMovements: Array<{
    fromStage: string;
    toStage: string;
    count: number;
  }>;
  fallOutRates: Record<string, number>;
}

/**
 * Compute 30-day rolling stats for a recruiter identified by their admin_users.id.
 * Only uses aggregates — no raw phone numbers.
 */
async function getRollingStats(userId: string, days = 30): Promise<RollingStats> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const defaultStats: RollingStats = {
    avgCallsPerDay: 0,
    totalCallsInPeriod: 0,
    totalCallDurationSeconds: 0,
    missedCallCount: 0,
    answeredCallCount: 0,
    stageMovements: [],
    fallOutRates: {},
  };

  try {
    // Call log aggregates — no raw numbers, just counts and durations
    const callResult = await db.execute(sql`
      SELECT
        COUNT(*)::int                                             AS total_calls,
        COALESCE(SUM(duration), 0)::int                          AS total_duration,
        COUNT(*) FILTER (WHERE status ILIKE '%miss%')::int       AS missed_calls,
        COUNT(*) FILTER (WHERE status ILIKE '%answer%'
                           OR  status ILIKE '%connect%')::int    AS answered_calls
      FROM zoom_call_logs
      WHERE user_id = ${userId}
        AND start_time >= ${cutoffStr}::date
    `);
    const callRow = ((callResult?.rows ?? callResult ?? []) as any[])[0];
    if (callRow) {
      defaultStats.totalCallsInPeriod = callRow.total_calls ?? 0;
      defaultStats.totalCallDurationSeconds = callRow.total_duration ?? 0;
      defaultStats.missedCallCount = callRow.missed_calls ?? 0;
      defaultStats.answeredCallCount = callRow.answered_calls ?? 0;
      defaultStats.avgCallsPerDay = days > 0
        ? Math.round((defaultStats.totalCallsInPeriod / days) * 10) / 10
        : 0;
    }
  } catch (err) {
    console.warn("[zoomInsights] getRollingStats — call log query failed:", err);
  }

  try {
    // Stage movements for applications owned by this recruiter
    const stageResult = await db.execute(sql`
      SELECT
        ash.from_stage,
        ash.to_stage,
        COUNT(*)::int AS cnt
      FROM application_stage_history ash
      JOIN applications a ON a.id = ash.application_id
      WHERE a.recruiter_id = ${userId}
        AND ash.changed_at >= ${cutoffStr}::timestamp
      GROUP BY ash.from_stage, ash.to_stage
      ORDER BY cnt DESC
    `);
    const stageRows = ((stageResult?.rows ?? stageResult ?? []) as any[]);

    defaultStats.stageMovements = stageRows.map((r) => ({
      fromStage: r.from_stage ?? "unknown",
      toStage: r.to_stage ?? "unknown",
      count: r.cnt ?? 0,
    }));

    // Compute fall-out rates per stage (withdrawn/rejected as pct of moves from that stage)
    const fromStageTotals: Record<string, number> = {};
    const fromStageDrops: Record<string, number> = {};

    for (const row of stageRows) {
      const from = row.from_stage ?? "unknown";
      fromStageTotals[from] = (fromStageTotals[from] ?? 0) + (row.cnt ?? 0);
      if (row.to_stage === "rejected" || row.to_stage === "withdrawn") {
        fromStageDrops[from] = (fromStageDrops[from] ?? 0) + (row.cnt ?? 0);
      }
    }

    for (const stage of Object.keys(fromStageTotals)) {
      const total = fromStageTotals[stage] ?? 0;
      const drops = fromStageDrops[stage] ?? 0;
      if (total > 0) {
        defaultStats.fallOutRates[stage] = Math.round((drops / total) * 100);
      }
    }
  } catch (err) {
    console.warn("[zoomInsights] getRollingStats — stage history query failed:", err);
  }

  return defaultStats;
}

// ── Prompt composer ───────────────────────────────────────────────────────────

interface CallSummary {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  totalDurationMinutes: number;
}

interface StageEvent {
  fromStage: string;
  toStage: string;
  count: number;
}

const SYSTEM_PROMPT_RECRUITER = `You are a recruitment coaching AI. Your job is to analyze a recruiter's daily communication activity and produce structured coaching insights.

Respond ONLY with valid JSON matching this exact schema:
{
  "responsivenessScore": <integer 0-100; higher = more responsive>,
  "coldCandidates": [
    { "label": "<anonymous label e.g. Candidate A>", "daysSinceContact": <int>, "stage": "<pipeline stage>" }
  ],
  "conversationPatterns": ["<observation about communication style or patterns>"],
  "actionableGoals": [
    { "goal": "<specific, measurable coaching action>", "rationale": "<why this matters>", "urgency": "high"|"medium" }
  ]
}

Rules:
- responsivenessScore: base it on answered/missed ratio, call volume, and SMS engagement.
- coldCandidates: list candidates who appear to need follow-up based on stage stagnation. Use generic labels (Candidate A, B, ...). Include daysSinceContact estimates based on context.
- conversationPatterns: 1-3 objective observations about communication habits.
- actionableGoals: exactly 3-5 specific, achievable goals for the next day/week. No vague advice.
- Do not include any real names, phone numbers, or PII.
- Do not invent data not present in the context.`;

const SYSTEM_PROMPT_TEAM = `You are a recruitment team coaching AI. You receive a summary of all recruiters' performance scores and coaching goals for the day. Produce a team-level digest.

Respond ONLY with valid JSON matching this exact schema:
{
  "teamObservations": ["<1-3 observations about the team's communication patterns>"],
  "suggestedTeamFocus": "<one clear focus area for the team tomorrow>",
  "topUrgentActions": ["<up to 3 urgent actions for the team or manager>"]
}

Rules:
- Base observations only on the data provided.
- Do not mention specific recruiter identifiers beyond generic labels.
- Keep suggestedTeamFocus concrete and actionable.`;

function buildRecruiterPrompt(
  label: string,
  date: string,
  callSummary: CallSummary,
  digests: string[],
  stageEvents: StageEvent[],
  rolling: RollingStats,
): string {
  const lines: string[] = [
    `# Recruiter Activity Report — ${label} — ${date}`,
    "",
    "## Today's Call Activity",
    `- Total calls: ${callSummary.totalCalls}`,
    `- Answered: ${callSummary.answeredCalls}`,
    `- Missed: ${callSummary.missedCalls}`,
    `- Total talk time: ${callSummary.totalDurationMinutes} minutes`,
    "",
    "## Today's SMS Conversation Summaries (sanitized, no raw messages)",
  ];

  if (digests.length === 0) {
    lines.push("- No SMS sessions today.");
  } else {
    digests.forEach((d, i) => {
      lines.push(`- Conversation ${i + 1}: ${d}`);
    });
  }

  lines.push("", "## Today's Pipeline Stage Changes");
  if (stageEvents.length === 0) {
    lines.push("- No stage changes today.");
  } else {
    for (const e of stageEvents) {
      lines.push(`- ${e.count}x: ${e.fromStage} → ${e.toStage}`);
    }
  }

  lines.push("", "## 30-Day Rolling Context");
  lines.push(`- Avg calls/day (30d): ${rolling.avgCallsPerDay}`);
  lines.push(`- Total calls (30d): ${rolling.totalCallsInPeriod}`);
  lines.push(`- Answered (30d): ${rolling.answeredCallCount}, Missed: ${rolling.missedCallCount}`);

  const fallOutEntries = Object.entries(rolling.fallOutRates);
  if (fallOutEntries.length > 0) {
    lines.push("- Fall-out rates by stage (30d):");
    for (const [stage, rate] of fallOutEntries) {
      lines.push(`  - ${stage}: ${rate}% fall-out`);
    }
  }

  lines.push("", "## Instructions");
  lines.push("Based on the above, produce your coaching insight JSON response.");

  return lines.join("\n");
}

function buildTeamPrompt(date: string, recruiterSummaries: Array<{ label: string; insight: RecruiterInsight }>): string {
  const lines: string[] = [
    `# Team Coaching Digest — ${date}`,
    "",
    "## Recruiter Summaries",
  ];

  for (const { label, insight } of recruiterSummaries) {
    lines.push(``, `### ${label}`);
    lines.push(`- Responsiveness Score: ${insight.responsivenessScore}/100`);
    if (insight.coldCandidates.length > 0) {
      lines.push(`- Cold candidates flagged: ${insight.coldCandidates.length}`);
    }
    if (insight.actionableGoals.length > 0) {
      const highUrgency = insight.actionableGoals.filter((g) => g.urgency === "high");
      if (highUrgency.length > 0) {
        lines.push(`- High-urgency goals: ${highUrgency.map((g) => g.goal).join("; ")}`);
      }
    }
  }

  lines.push("", "## Instructions");
  lines.push("Based on the above recruiter summaries, produce the team-level coaching digest JSON.");

  return lines.join("\n");
}

// ── OpenAI caller ─────────────────────────────────────────────────────────────

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (!apiKey) {
    throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY not configured");
  }

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("OpenAI returned empty content");
  return content;
}

// ── Upsert helper ─────────────────────────────────────────────────────────────

async function upsertInsight(
  insightType: string,
  subjectId: string,
  subjectType: string,
  content: Record<string, unknown>,
  date: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO zoom_ai_insights
      (insight_type, subject_id, subject_type, content, generated_at, created_at)
    VALUES (
      ${insightType},
      ${subjectId},
      ${subjectType},
      ${JSON.stringify(content)}::jsonb,
      NOW(),
      NOW()
    )
  `);
  console.log(`[zoomInsights] Stored insight type=${insightType} subjectId=${subjectId} date=${date}`);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate AI coaching insights for all recruiters who had sync data on `date`,
 * then generate a team-level digest. Called by the sync engine after
 * syncAllUsersForDate completes.
 *
 * @param date  YYYY-MM-DD string
 */
export async function generateInsightsForDate(date: string): Promise<void> {
  console.log(`[zoomInsights] generateInsightsForDate — starting for date=${date}`);

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[zoomInsights] AI_INTEGRATIONS_OPENAI_API_KEY not set — skipping insights generation");
    return;
  }

  // Find all admin_users who had call logs or SMS sessions for this date
  let recruiterRows: Array<{ userId: string; email: string }> = [];
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT au.id AS user_id, au.email
      FROM admin_users au
      WHERE au.deleted_at IS NULL
        AND au.is_active = true
        AND (
          EXISTS (
            SELECT 1 FROM zoom_call_logs cl
            WHERE cl.user_id = au.id
              AND cl.start_time::date = ${date}::date
          )
          OR EXISTS (
            SELECT 1 FROM zoom_sms_sessions ss
            WHERE ss.user_id = au.id
              AND ss.session_start::date = ${date}::date
          )
        )
    `);
    recruiterRows = ((result?.rows ?? result ?? []) as any[]).map((r) => ({
      userId: r.user_id as string,
      email: r.email as string,
    }));
  } catch (err) {
    console.error("[zoomInsights] Failed to query recruiters with sync data:", err);
    return;
  }

  if (recruiterRows.length === 0) {
    console.log(`[zoomInsights] No recruiters with sync data for date=${date}, skipping`);
    return;
  }

  console.log(`[zoomInsights] Processing ${recruiterRows.length} recruiter(s) for date=${date}`);

  const recruiterSummariesForTeam: Array<{ label: string; insight: RecruiterInsight }> = [];

  for (let i = 0; i < recruiterRows.length; i++) {
    const { userId, email } = recruiterRows[i];
    const label = `Recruiter ${String.fromCharCode(65 + (i % 26))}`;

    // Add a small delay between recruiter calls to respect rate limits
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      // 1. Call stats for today
      let callSummary: CallSummary = {
        totalCalls: 0,
        answeredCalls: 0,
        missedCalls: 0,
        totalDurationMinutes: 0,
      };

      try {
        const callResult = await db.execute(sql`
          SELECT
            COUNT(*)::int                                              AS total_calls,
            COUNT(*) FILTER (WHERE status ILIKE '%answer%'
                               OR  status ILIKE '%connect%')::int     AS answered_calls,
            COUNT(*) FILTER (WHERE status ILIKE '%miss%')::int        AS missed_calls,
            COALESCE(SUM(duration), 0)::int                           AS total_duration_seconds
          FROM zoom_call_logs
          WHERE user_id = ${userId}
            AND start_time::date = ${date}::date
        `);
        const row = ((callResult?.rows ?? callResult ?? []) as any[])[0];
        if (row) {
          callSummary = {
            totalCalls: row.total_calls ?? 0,
            answeredCalls: row.answered_calls ?? 0,
            missedCalls: row.missed_calls ?? 0,
            totalDurationMinutes: Math.round((row.total_duration_seconds ?? 0) / 60),
          };
        }
      } catch (err) {
        console.warn(`[zoomInsights] Call stats query failed for userId=${userId}:`, err);
      }

      // 2. SMS digests for today (sanitized — no raw messages)
      let digests: string[] = [];
      try {
        const digestResult = await db.execute(sql`
          SELECT d.digest_text
          FROM zoom_sms_digests d
          JOIN zoom_sms_sessions s ON s.id = d.session_id
          WHERE s.user_id = ${userId}
            AND d.date = ${date}
            AND d.digest_text IS NOT NULL
        `);
        digests = ((digestResult?.rows ?? digestResult ?? []) as any[])
          .map((r) => r.digest_text as string)
          .filter(Boolean);
      } catch (err) {
        console.warn(`[zoomInsights] Digest query failed for userId=${userId}:`, err);
      }

      // 3. Stage events for today's applications owned by this recruiter
      let stageEvents: StageEvent[] = [];
      try {
        const stageResult = await db.execute(sql`
          SELECT
            ash.from_stage,
            ash.to_stage,
            COUNT(*)::int AS cnt
          FROM application_stage_history ash
          JOIN applications a ON a.id = ash.application_id
          WHERE a.recruiter_id = ${userId}
            AND ash.changed_at::date = ${date}::date
          GROUP BY ash.from_stage, ash.to_stage
        `);
        stageEvents = ((stageResult?.rows ?? stageResult ?? []) as any[]).map((r) => ({
          fromStage: r.from_stage ?? "unknown",
          toStage: r.to_stage ?? "unknown",
          count: r.cnt ?? 0,
        }));
      } catch (err) {
        console.warn(`[zoomInsights] Stage events query failed for userId=${userId}:`, err);
      }

      // 4. 30-day rolling stats
      const rolling = await getRollingStats(userId);

      // 5. Build and send prompt
      const userPrompt = buildRecruiterPrompt(
        label,
        date,
        callSummary,
        digests,
        stageEvents,
        rolling,
      );

      let rawResponse = "";
      let parsedInsight: RecruiterInsight | null = null;

      try {
        rawResponse = await callOpenAI(SYSTEM_PROMPT_RECRUITER, userPrompt);
        const parsed = JSON.parse(rawResponse);
        parsedInsight = RecruiterInsightSchema.parse(parsed);
      } catch (err) {
        console.warn(`[zoomInsights] AI response invalid for userId=${userId}:`, err);
        // Store fallback error row so the failure is visible
        await upsertInsight(
          "recruiter_daily",
          email,
          "user",
          { error: true, rawResponse: rawResponse.slice(0, 1000), date },
          date,
        ).catch(() => {});
        continue;
      }

      // 6. Store valid insight
      await upsertInsight(
        "recruiter_daily",
        email,
        "user",
        { ...parsedInsight, date, generatedForUserId: userId },
        date,
      );

      recruiterSummariesForTeam.push({ label, insight: parsedInsight });
    } catch (outerErr) {
      console.error(`[zoomInsights] Unexpected error processing userId=${userId}:`, outerErr);
    }
  }

  // ── Team digest ──────────────────────────────────────────────────────────────

  if (recruiterSummariesForTeam.length === 0) {
    console.log("[zoomInsights] No valid recruiter insights — skipping team digest");
    return;
  }

  // Extra delay before team digest call
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    const teamPrompt = buildTeamPrompt(date, recruiterSummariesForTeam);
    let rawTeamResponse = "";
    let parsedTeamInsight: TeamInsight | null = null;

    try {
      rawTeamResponse = await callOpenAI(SYSTEM_PROMPT_TEAM, teamPrompt);
      const parsed = JSON.parse(rawTeamResponse);
      parsedTeamInsight = TeamInsightSchema.parse(parsed);
    } catch (err) {
      console.warn("[zoomInsights] Team insight AI response invalid:", err);
      await upsertInsight(
        "team_daily",
        "team",
        "team",
        { error: true, rawResponse: rawTeamResponse.slice(0, 1000), date },
        date,
      ).catch(() => {});
      return;
    }

    await upsertInsight(
      "team_daily",
      "team",
      "team",
      { ...parsedTeamInsight, date, recruiterCount: recruiterSummariesForTeam.length },
      date,
    );

    console.log(`[zoomInsights] generateInsightsForDate complete — ${recruiterSummariesForTeam.length} recruiter insights + team digest stored for date=${date}`);
  } catch (err) {
    console.error("[zoomInsights] Failed to generate team digest:", err);
  }
}
