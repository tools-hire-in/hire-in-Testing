/**
 * Zoom AI Insights Engine
 *
 * Called after each nightly sync completes (or manually triggered).
 * For each recruiter: builds a structured prompt using ONLY sanitized digests,
 * call metadata, and candidate stage changes — never raw SMS bodies.
 *
 * Outputs structured JSON validated with Zod before storing in zoom_ai_insights.
 */

import { z } from "zod";

// ── Output schema ─────────────────────────────────────────────────────────────

const actionableGoalSchema = z.object({
  goal: z.string(),
  rationale: z.string(),
  urgency: z.enum(["high", "medium"]),
});

const coldCandidateSchema = z.object({
  label: z.string(),
  daysSinceContact: z.number(),
  stage: z.string(),
});

export const insightContentSchema = z.object({
  responsivenessScore: z.number().min(0).max(100),
  coldCandidates: z.array(coldCandidateSchema),
  conversationPatterns: z.array(z.string()),
  actionableGoals: z.array(actionableGoalSchema),
});

export type InsightContent = z.infer<typeof insightContentSchema>;

export interface RecruiterInsightInput {
  email: string;
  date: string;
  callStats: {
    total: number;
    outbound: number;
    inbound: number;
    missed: number;
    answered: number;
    totalDurationSeconds: number;
  };
  smsDigests: string[];
  stageChangesToday: Array<{ candidateLabel: string; fromStage: string; toStage: string }>;
  rollingPatternSummary: string;
}

/**
 * Run the AI insights engine for one recruiter.
 * Returns the structured insight content (already validated).
 */
export async function generateRecruiterInsight(
  input: RecruiterInsightInput,
): Promise<InsightContent | null> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return null;

  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const callSummary =
      `Calls today: ${input.callStats.total} total ` +
      `(${input.callStats.outbound} outbound, ${input.callStats.inbound} inbound, ` +
      `${input.callStats.missed} missed, ${input.callStats.answered} answered). ` +
      `Total talk time: ${Math.round(input.callStats.totalDurationSeconds / 60)} minutes.`;

    const smsSection =
      input.smsDigests.length > 0
        ? input.smsDigests.map((d, i) => `Thread ${i + 1}: ${d}`).join("\n")
        : "No SMS threads today.";

    const stageSection =
      input.stageChangesToday.length > 0
        ? input.stageChangesToday
            .map((s) => `- ${s.candidateLabel}: ${s.fromStage} → ${s.toStage}`)
            .join("\n")
        : "No stage changes today.";

    const prompt = `You are an AI coaching assistant for a staffing agency. Analyse the recruiter's daily comms data and provide specific, evidence-backed coaching insights.

CALL DATA:
${callSummary}

SMS THREAD DIGESTS (anonymised summaries — no raw content):
${smsSection}

PIPELINE STAGE CHANGES TODAY:
${stageSection}

30-DAY ROLLING PATTERN SUMMARY:
${input.rollingPatternSummary || "No historical data yet."}

Return a JSON object with this EXACT structure:
{
  "responsivenessScore": <0-100 integer, based on reply latency patterns, follow-up gaps, and missed calls>,
  "coldCandidates": [{"label": "<stage description>", "daysSinceContact": <number>, "stage": "<pipeline stage>"}],
  "conversationPatterns": ["<observation string>", ...],
  "actionableGoals": [
    {"goal": "<specific actionable goal>", "rationale": "<evidence from today's data>", "urgency": "high"|"medium"}
  ]
}

Rules:
- Provide 3-5 actionable goals. Make them specific and evidence-backed from the data provided.
- Cold candidates: identify patterns suggesting candidates with no contact in 3+ days still active.
- Conversation patterns: identify recurring themes across the SMS threads.
- Urgency "high" = needs action within 24h; "medium" = within this week.
- Stay factual. Do not invent data not present in the input.`;

    const completion = await client.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a recruiter coaching AI. Always respond with valid JSON matching the requested schema." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const validated = insightContentSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn("[zoomInsightsService] Validation failed:", validated.error.message);
      return null;
    }
    return validated.data;
  } catch (err: any) {
    console.warn("[zoomInsightsService] generateRecruiterInsight error:", err?.message ?? err);
    return null;
  }
}

/**
 * Generate a team-level digest from aggregated recruiter summaries.
 */
export async function generateTeamDigest(
  date: string,
  recruiterSummaries: Array<{ email: string; insight: InsightContent | null }>,
): Promise<string | null> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return null;
  if (recruiterSummaries.length === 0) return null;

  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const summaryText = recruiterSummaries
      .filter((r) => r.insight !== null)
      .map((r) => {
        const ins = r.insight!;
        const topGoal = ins.actionableGoals?.[0];
        return `Recruiter ${r.email}: responsiveness=${ins.responsivenessScore}/100, top concern: ${topGoal?.goal ?? "none"} [${topGoal?.urgency ?? ""}]`;
      })
      .join("\n");

    if (!summaryText) return null;

    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are a team performance coach. Summarise the team's daily comms in 3-4 sentences: who needs coaching attention, which pipeline stage is bleeding drop-offs, and one team-level focus for tomorrow.",
        },
        { role: "user", content: `Date: ${date}\n\n${summaryText}` },
      ],
    });

    return completion.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err: any) {
    console.warn("[zoomInsightsService] generateTeamDigest error:", err?.message ?? err);
    return null;
  }
}

/**
 * Upsert an insight row for a recruiter (scope='user') or team (scope='team').
 */
export async function upsertInsight(
  date: string,
  scope: "user" | "team",
  scopeId: string,
  content: InsightContent | { teamDigest: string },
  db: any,
  sql: any,
): Promise<void> {
  try {
    const id = `${scope}-${scopeId}-${date}`.replace(/[^a-zA-Z0-9\-]/g, "_").slice(0, 120);
    await db.execute(sql`
      INSERT INTO zoom_ai_insights (id, date, scope, scope_id, content, generated_at)
      VALUES (${id}, ${date}::date, ${scope}, ${scopeId}, ${JSON.stringify(content)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
        SET content = EXCLUDED.content,
            generated_at = NOW()
    `);
  } catch (err) {
    console.warn("[zoomInsightsService] upsert error:", err);
  }
}
