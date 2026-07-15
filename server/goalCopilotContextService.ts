/**
 * Goal Copilot Context Service (Task #1116)
 *
 * Classifies incoming CEO messages and assembles only the data relevant to
 * that intent. Context assembly runs in parallel (Promise.all) and is
 * designed to complete in < 200ms under normal DB load.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

// ── Intent classification ─────────────────────────────────────────────────────

export type CopilotIntent =
  | "placement_revenue"
  | "team_risk"
  | "compliance_sop"
  | "pipeline_conversion"
  | "create_goal"
  | "next_actions"
  | "general";

const INTENT_PATTERNS: Array<{ intent: CopilotIntent; keywords: string[] }> = [
  {
    intent: "create_goal",
    keywords: ["create a goal", "set a goal", "create goal", "add a goal", "new goal", "let's set", "setup a goal", "i want to set", "goal for"],
  },
  {
    intent: "next_actions",
    keywords: ["action", "what am i tracking", "my actions", "follow up", "what should i", "focus this week", "todo", "to-do"],
  },
  {
    intent: "team_risk",
    keywords: ["team", "risk", "attention", "struggling", "pip", "probation", "concern", "underperform", "who needs"],
  },
  {
    intent: "compliance_sop",
    keywords: ["compliance", "sop", "training", "acknowledgement", "acknowledge", "wave", "policy", "overdue training"],
  },
  {
    intent: "pipeline_conversion",
    keywords: ["conversion", "pipeline", "submission", "screen", "interview", "funnel", "call volume", "blocking"],
  },
  {
    intent: "placement_revenue",
    keywords: ["placement", "revenue", "financial", "quarter", "bill rate", "income", "earnings", "tracking"],
  },
];

export function classifyIntent(message: string): CopilotIntent {
  const lower = message.toLowerCase();
  for (const { intent, keywords } of INTENT_PATTERNS) {
    if (keywords.some((kw) => lower.includes(kw))) return intent;
  }
  return "general";
}

// ── Context data types ────────────────────────────────────────────────────────

export interface PlacementContext {
  totalPlacementsThisQuarter: number;
  targetPlacementsThisQuarter: number | null;
  weeklyRunRate: number;
  projectedEndOfQuarter: number;
  activeRecruiters: number;
  avgSubmissionsPerWeek: number;
}

export interface TeamRiskContext {
  employeesOnPIP: number;
  employeesOnProbation: number;
  overdueCheckIns: number;
  planHealthAtRisk: number;
  atRiskNames: string[];
}

export interface ComplianceContext {
  sopOverallAckPct: number;
  sopOverdue: number;
  trainingOverdue: number;
  trainingCompliant: number;
  activeWaves: number;
}

export interface PipelineContext {
  totalSubmissionsThisQuarter: number;
  screenedCount: number;
  conversionPct: number;
  avgCallsPerDayThisWeek: number;
  topRecruiters: Array<{ name: string; placements: number; submissions: number }>;
}

export interface CompanyGoalsContext {
  activeGoals: Array<{
    id: string;
    title: string;
    progress: number;
    status: string;
    targetDate: string | null;
  }>;
}

export interface NextActionsContext {
  openActions: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    goalTitle: string | null;
  }>;
}

export interface CopilotContext {
  intent: CopilotIntent;
  quarter: string;
  quarterStart: string;
  quarterEnd: string;
  today: string;
  placements?: PlacementContext;
  teamRisk?: TeamRiskContext;
  compliance?: ComplianceContext;
  pipeline?: PipelineContext;
  companyGoals?: CompanyGoalsContext;
  nextActions?: NextActionsContext;
}

// ── Quarter helpers ───────────────────────────────────────────────────────────

function getCurrentQuarter(): { label: string; start: string; end: string } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  const q = Math.floor(month / 3) + 1;
  const qStart = new Date(year, (q - 1) * 3, 1);
  const qEnd = new Date(year, q * 3, 0);
  return {
    label: `Q${q} ${year}`,
    start: qStart.toISOString().slice(0, 10),
    end: qEnd.toISOString().slice(0, 10),
  };
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchPlacementContext(quarterStart: string, quarterEnd: string): Promise<PlacementContext> {
  try {
    const [placementRow, recruiterRow, submissionRow, targetRow] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) AS total
        FROM applications
        WHERE stage = 'placed'
          AND placement_date BETWEEN ${quarterStart} AND ${quarterEnd}
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT recruiter_id) AS active
        FROM recruiter_activity_logs
        WHERE log_date >= CURRENT_DATE - INTERVAL '7 days'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(calls_made), 0) AS total_calls,
               COALESCE(SUM(screens_conducted), 0) AS total_screens,
               COUNT(DISTINCT recruiter_id) AS rec_count,
               COUNT(DISTINCT log_date) AS day_count
        FROM recruiter_activity_logs
        WHERE log_date >= CURRENT_DATE - INTERVAL '7 days'
      `),
      db.execute(sql`
        SELECT target_amount FROM company_financial_targets
        WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)::int
          AND quarter = CONCAT('Q', EXTRACT(QUARTER FROM CURRENT_DATE)::int)
        LIMIT 1
      `),
    ]);

    const total = Number((placementRow.rows[0] as any)?.total ?? 0);
    const activeRecruiters = Number((recruiterRow.rows[0] as any)?.active ?? 0);
    const weeklyCalls = Number((submissionRow.rows[0] as any)?.total_calls ?? 0);
    const dayCount = Number((submissionRow.rows[0] as any)?.day_count ?? 1);
    const avgCallsPerDay = dayCount > 0 ? weeklyCalls / dayCount : 0;

    // Estimate weekly submission run rate: calls * typical conversion assumption
    const avgSubsPerWeek = Math.round(avgCallsPerDay * 7 * 0.15); // 15% call-to-sub

    // Weeks elapsed & remaining this quarter
    const now = new Date();
    const qStart = new Date(quarterStart);
    const qEnd = new Date(quarterEnd);
    const totalWeeks = Math.ceil((qEnd.getTime() - qStart.getTime()) / (7 * 86400000));
    const weeksElapsed = Math.max(1, Math.ceil((now.getTime() - qStart.getTime()) / (7 * 86400000)));
    const weeksRemaining = Math.max(0, totalWeeks - weeksElapsed);
    const weeklyRunRate = weeksElapsed > 0 ? total / weeksElapsed : 0;
    const projected = Math.round(total + weeklyRunRate * weeksRemaining);

    const targetAmount = (targetRow.rows[0] as any)?.target_amount ?? null;

    return {
      totalPlacementsThisQuarter: total,
      targetPlacementsThisQuarter: targetAmount ? Math.round(Number(targetAmount)) : null,
      weeklyRunRate: Math.round(weeklyRunRate * 10) / 10,
      projectedEndOfQuarter: projected,
      activeRecruiters,
      avgSubmissionsPerWeek: avgSubsPerWeek,
    };
  } catch (err) {
    console.error("[copilot-context] fetchPlacementContext error:", err);
    return {
      totalPlacementsThisQuarter: 0,
      targetPlacementsThisQuarter: null,
      weeklyRunRate: 0,
      projectedEndOfQuarter: 0,
      activeRecruiters: 0,
      avgSubmissionsPerWeek: 0,
    };
  }
}

async function fetchTeamRiskContext(): Promise<TeamRiskContext> {
  try {
    const [pipRow, probRow, checkInRow, goalsRow] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) AS cnt FROM employee_plans WHERE plan_type = 'pip' AND status = 'active'
      `),
      db.execute(sql`
        SELECT COUNT(*) AS cnt FROM employee_plans WHERE plan_type = 'probation' AND status = 'active'
      `),
      db.execute(sql`
        SELECT COUNT(*) AS cnt FROM check_ins
        WHERE status = 'scheduled' AND scheduled_date < CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COUNT(*) AS cnt FROM performance_goals
        WHERE status IN ('at_risk', 'overdue') AND target_date IS NOT NULL
      `),
    ]);

    const atRiskNamesRow = await db.execute(sql`
      SELECT DISTINCT au.first_name || ' ' || au.last_name AS name
      FROM employee_plans ep
      JOIN admin_users au ON au.id = ep.employee_id
      WHERE ep.plan_type = 'pip' AND ep.status = 'active'
      LIMIT 5
    `);

    return {
      employeesOnPIP: Number((pipRow.rows[0] as any)?.cnt ?? 0),
      employeesOnProbation: Number((probRow.rows[0] as any)?.cnt ?? 0),
      overdueCheckIns: Number((checkInRow.rows[0] as any)?.cnt ?? 0),
      planHealthAtRisk: Number((goalsRow.rows[0] as any)?.cnt ?? 0),
      atRiskNames: (atRiskNamesRow.rows as any[]).map((r) => r.name).filter(Boolean),
    };
  } catch (err) {
    console.error("[copilot-context] fetchTeamRiskContext error:", err);
    return { employeesOnPIP: 0, employeesOnProbation: 0, overdueCheckIns: 0, planHealthAtRisk: 0, atRiskNames: [] };
  }
}

async function fetchComplianceContext(): Promise<ComplianceContext> {
  try {
    const [sopRow, trainRow, waveRow] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE acknowledged_at IS NULL AND ws.operational_at < NOW() - INTERVAL '14 days') AS overdue,
          ROUND(100.0 * COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL) / NULLIF(COUNT(*), 0)) AS ack_pct
        FROM sop_employee_progress sep
        JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
        JOIN admin_users au ON au.id = sep.user_id
        WHERE au.is_active = true AND au.deleted_at IS NULL
      `),
      db.execute(sql`
        SELECT
          COUNT(DISTINCT ta.user_id) FILTER (WHERE ta.due_date < CURRENT_DATE AND ta.status != 'completed') AS overdue_users,
          COUNT(DISTINCT ta.user_id) FILTER (WHERE ta.status = 'completed' OR ta.due_date >= CURRENT_DATE) AS compliant_users
        FROM track_assignments ta
        JOIN admin_users au ON au.id = ta.user_id
        WHERE au.is_active = true AND au.deleted_at IS NULL
      `),
      db.execute(sql`
        SELECT COUNT(*) AS active_waves FROM rollout_waves WHERE activated_at IS NOT NULL
      `),
    ]);

    return {
      sopOverallAckPct: Number((sopRow.rows[0] as any)?.ack_pct ?? 0),
      sopOverdue: Number((sopRow.rows[0] as any)?.overdue ?? 0),
      trainingOverdue: Number((trainRow.rows[0] as any)?.overdue_users ?? 0),
      trainingCompliant: Number((trainRow.rows[0] as any)?.compliant_users ?? 0),
      activeWaves: Number((waveRow.rows[0] as any)?.active_waves ?? 0),
    };
  } catch (err) {
    console.error("[copilot-context] fetchComplianceContext error:", err);
    return { sopOverallAckPct: 0, sopOverdue: 0, trainingOverdue: 0, trainingCompliant: 0, activeWaves: 0 };
  }
}

async function fetchPipelineContext(quarterStart: string, quarterEnd: string): Promise<PipelineContext> {
  try {
    const [subRow, topRow, callRow] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) AS total_subs,
          COUNT(*) FILTER (WHERE stage IN ('phone_screen','technical_interview','final_interview','offer_made','placed')) AS screened
        FROM applications
        WHERE created_at BETWEEN ${quarterStart}::date AND ${quarterEnd}::date + INTERVAL '1 day'
      `),
      db.execute(sql`
        SELECT
          au.first_name || ' ' || au.last_name AS name,
          COUNT(*) FILTER (WHERE a.stage = 'placed' AND a.placement_date BETWEEN ${quarterStart} AND ${quarterEnd}) AS placements,
          COUNT(*) AS submissions
        FROM applications a
        JOIN admin_users au ON au.id = a.recruiter_id
        WHERE a.recruiter_id IS NOT NULL
          AND a.created_at BETWEEN ${quarterStart}::date AND ${quarterEnd}::date + INTERVAL '1 day'
        GROUP BY au.id, au.first_name, au.last_name
        ORDER BY placements DESC, submissions DESC
        LIMIT 3
      `),
      db.execute(sql`
        SELECT COALESCE(AVG(calls_made), 0) AS avg_calls
        FROM recruiter_activity_logs
        WHERE log_date >= CURRENT_DATE - INTERVAL '7 days'
      `),
    ]);

    const totalSubs = Number((subRow.rows[0] as any)?.total_subs ?? 0);
    const screened = Number((subRow.rows[0] as any)?.screened ?? 0);
    const convPct = totalSubs > 0 ? Math.round((screened / totalSubs) * 100) : 0;

    return {
      totalSubmissionsThisQuarter: totalSubs,
      screenedCount: screened,
      conversionPct: convPct,
      avgCallsPerDayThisWeek: Math.round(Number((callRow.rows[0] as any)?.avg_calls ?? 0) * 10) / 10,
      topRecruiters: (topRow.rows as any[]).map((r) => ({
        name: r.name || "Unknown",
        placements: Number(r.placements ?? 0),
        submissions: Number(r.submissions ?? 0),
      })),
    };
  } catch (err) {
    console.error("[copilot-context] fetchPipelineContext error:", err);
    return { totalSubmissionsThisQuarter: 0, screenedCount: 0, conversionPct: 0, avgCallsPerDayThisWeek: 0, topRecruiters: [] };
  }
}

async function fetchCompanyGoals(): Promise<CompanyGoalsContext> {
  try {
    const rows = await db.execute(sql`
      SELECT id, title, progress, status, target_date
      FROM performance_goals
      WHERE category = 'company' AND status NOT IN ('completed', 'cancelled')
      ORDER BY created_at DESC
      LIMIT 10
    `);
    return {
      activeGoals: (rows.rows as any[]).map((r) => ({
        id: r.id,
        title: r.title,
        progress: Number(r.progress ?? 0),
        status: r.status,
        targetDate: r.target_date ?? null,
      })),
    };
  } catch (err) {
    console.error("[copilot-context] fetchCompanyGoals error:", err);
    return { activeGoals: [] };
  }
}

async function fetchNextActions(userId: string): Promise<NextActionsContext> {
  try {
    const rows = await db.execute(sql`
      SELECT cga.id, cga.title, cga.due_date::text AS due_date, pg.title AS goal_title
      FROM company_goal_actions cga
      LEFT JOIN performance_goals pg ON pg.id = cga.goal_id
      WHERE cga.assigned_to = ${userId} AND cga.completed_at IS NULL
      ORDER BY cga.due_date ASC NULLS LAST
      LIMIT 10
    `);
    return {
      openActions: (rows.rows as any[]).map((r) => ({
        id: r.id,
        title: r.title,
        dueDate: r.due_date ?? null,
        goalTitle: r.goal_title ?? null,
      })),
    };
  } catch (err) {
    console.error("[copilot-context] fetchNextActions error:", err);
    return { openActions: [] };
  }
}

// ── Main context builder ──────────────────────────────────────────────────────

export async function buildContextForIntent(intent: CopilotIntent, userId: string): Promise<CopilotContext> {
  const { label: quarter, start: quarterStart, end: quarterEnd } = getCurrentQuarter();
  const today = new Date().toISOString().slice(0, 10);

  const base: CopilotContext = { intent, quarter, quarterStart, quarterEnd, today };

  // Always fetch company goals for context
  const companyGoals = await fetchCompanyGoals();
  base.companyGoals = companyGoals;

  switch (intent) {
    case "placement_revenue": {
      const [placements, pipeline] = await Promise.all([
        fetchPlacementContext(quarterStart, quarterEnd),
        fetchPipelineContext(quarterStart, quarterEnd),
      ]);
      return { ...base, placements, pipeline };
    }
    case "team_risk": {
      const teamRisk = await fetchTeamRiskContext();
      return { ...base, teamRisk };
    }
    case "compliance_sop": {
      const compliance = await fetchComplianceContext();
      return { ...base, compliance };
    }
    case "pipeline_conversion": {
      const [pipeline, placements] = await Promise.all([
        fetchPipelineContext(quarterStart, quarterEnd),
        fetchPlacementContext(quarterStart, quarterEnd),
      ]);
      return { ...base, pipeline, placements };
    }
    case "create_goal": {
      // Full snapshot for goal creation
      const [placements, teamRisk, compliance, pipeline] = await Promise.all([
        fetchPlacementContext(quarterStart, quarterEnd),
        fetchTeamRiskContext(),
        fetchComplianceContext(),
        fetchPipelineContext(quarterStart, quarterEnd),
      ]);
      return { ...base, placements, teamRisk, compliance, pipeline };
    }
    case "next_actions": {
      const nextActions = await fetchNextActions(userId);
      return { ...base, nextActions };
    }
    case "general":
    default: {
      // Lightweight pulse: placements + 1 risk flag + SOP compliance
      const [placements, compliance] = await Promise.all([
        fetchPlacementContext(quarterStart, quarterEnd),
        fetchComplianceContext(),
      ]);
      return { ...base, placements, compliance };
    }
  }
}

// ── System prompt builder ─────────────────────────────────────────────────────

export function buildSystemPrompt(context: CopilotContext): string {
  const blocks: string[] = [
    `You are the CEO's operational copilot for a growing staffing firm (Healthcare, IT, Engineering, Professional Services). You have access to live system data about the team's performance, recruitment pipeline, compliance, and governance health. Today is ${context.today}. The current quarter is ${context.quarter}.`,

    `RESPONSE RULES:
- Always cite which data you're drawing from when making a statement.
- If a metric isn't in the provided context, say so explicitly — never estimate or guess.
- You understand staffing domain terms: recruiter ramp time, submission-to-interview conversion, bill rates, probation cadence, SOP compliance — do not ask the CEO to explain these.
- You propose, the CEO decides. Never frame a recommendation as a decision already made.
- If asked about client satisfaction, market data, competitor intelligence, or anything not in the context, say: "I don't have that in the system. Here's what I do know: [related data if any]."
- Keep responses concise, structured, and actionable. Use bullet points for lists.
- When proposing a goal, always end with: "Type 'approve' to create this, or tell me what to change."`,

    `LIVE SYSTEM DATA:
Quarter: ${context.quarter} (${context.quarterStart} to ${context.quarterEnd})`,
  ];

  if (context.placements) {
    const p = context.placements;
    blocks.push(`PLACEMENT DATA (${context.quarter}):
- Placements to date: ${p.totalPlacementsThisQuarter}
- Weekly run rate: ${p.weeklyRunRate} placements/week
- Quarter-end projection: ${p.projectedEndOfQuarter} placements
- Target: ${p.targetPlacementsThisQuarter != null ? p.targetPlacementsThisQuarter : "not set"}
- Active recruiters (past 7 days): ${p.activeRecruiters}
- Estimated avg submissions/week: ${p.avgSubmissionsPerWeek}`);
  }

  if (context.pipeline) {
    const p = context.pipeline;
    blocks.push(`PIPELINE DATA (${context.quarter}):
- Total submissions: ${p.totalSubmissionsThisQuarter}
- Advanced to screen/interview: ${p.screenedCount}
- Submission-to-screen conversion: ${p.conversionPct}%
- Avg calls/day this week: ${p.avgCallsPerDayThisWeek}
- Top recruiters: ${p.topRecruiters.map((r) => `${r.name} (${r.placements} placements, ${r.submissions} submissions)`).join("; ") || "No data"}`);
  }

  if (context.teamRisk) {
    const r = context.teamRisk;
    blocks.push(`TEAM RISK DATA:
- Employees on PIP: ${r.employeesOnPIP}${r.atRiskNames.length > 0 ? ` (${r.atRiskNames.join(", ")})` : ""}
- Employees on Probation: ${r.employeesOnProbation}
- Overdue check-ins: ${r.overdueCheckIns}
- Goals at risk or overdue: ${r.planHealthAtRisk}`);
  }

  if (context.compliance) {
    const c = context.compliance;
    blocks.push(`COMPLIANCE DATA:
- SOP overall acknowledgement: ${c.sopOverallAckPct}%
- SOP overdue (grace exceeded): ${c.sopOverdue}
- Active SOP waves: ${c.activeWaves}
- Training overdue: ${c.trainingOverdue} employees
- Training compliant: ${c.trainingCompliant} employees`);
  }

  if (context.companyGoals && context.companyGoals.activeGoals.length > 0) {
    blocks.push(`ACTIVE COMPANY GOALS:
${context.companyGoals.activeGoals.map((g) => `- ${g.title}: ${g.progress}% complete (${g.status})${g.targetDate ? `, target ${g.targetDate}` : ""}`).join("\n")}`);
  } else {
    blocks.push(`ACTIVE COMPANY GOALS: None set yet.`);
  }

  if (context.nextActions && context.nextActions.openActions.length > 0) {
    blocks.push(`YOUR OPEN ACTION ITEMS:
${context.nextActions.openActions.map((a) => `- ${a.title}${a.dueDate ? ` (due ${a.dueDate})` : ""}${a.goalTitle ? ` — linked to: ${a.goalTitle}` : ""}`).join("\n")}`);
  }

  blocks.push(`GOAL PROPOSAL FORMAT:
When the CEO asks to create a goal, respond with a structured proposal in this format:
**[GOAL_PROPOSAL]**
Title: <title>
Owner: <suggest based on context>
Target: <specific measurable target>
Timeline: <quarter or date range>
Milestones: <comma-separated>
Sub-goals: <if any>
Financial target: <if applicable>
**[/GOAL_PROPOSAL]**

Then explain the reasoning briefly and end with: "Type 'approve' to create this, or tell me what to change."`);

  return blocks.join("\n\n");
}
