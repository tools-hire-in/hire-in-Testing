/**
 * Contextual Notification Builders (Task #1102)
 *
 * Upgrades generic compliance notifications into data-rich messages that
 * show the employee/manager exactly where they stand and what action closes the gap.
 *
 * Each builder reads live data from the DB and returns a payload shaped for
 * the notifyUser() gateway. The sweep logic (who to notify, dedup, frequency)
 * is unchanged — only the message payload produced here changes.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { getPortalBaseUrl } from "./portalUrl";

/** Formatted goal row for inclusion in a notification message */
interface GoalSummaryLine {
  title: string;
  progress: number;
  targetDate: string | null;
  isAutoTracked: boolean;
  isOverdue: boolean;
  statusIcon: string; // ✅ ⚠️ ❌
  lastUpdatedAt: string | null;
}

/** Raw goal row from DB */
interface GoalRow {
  id: string;
  title: string;
  progress: string | number;
  target_date: string | null;
  status: string;
  tracking_type: string | null;
}

function statusIcon(progress: number, isOverdue: boolean): string {
  if (isOverdue) return "❌";
  if (progress >= 80) return "✅";
  if (progress >= 50) return "⚠️";
  return "⚠️";
}

function formatGoalLine(goal: GoalSummaryLine): string {
  const suffix = goal.isAutoTracked
    ? ""
    : " (manual goal — manager will discuss)";
  return `— ${goal.title}: ${goal.progress}% ${goal.statusIcon}${suffix}`;
}

/** Raw goal row from DB — extended to include staleness info */
interface GoalRowExtended extends GoalRow {
  last_progress_updated_at: string | null;
}

/** Fetch goals for a plan and build summary lines */
async function fetchPlanGoalLines(planId: string): Promise<GoalSummaryLine[]> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const rows = (await db.execute(sql`
    SELECT id, title, progress, target_date, status, tracking_type, last_progress_updated_at
    FROM performance_goals
    WHERE plan_id = ${planId}
      AND status NOT IN ('cancelled')
    ORDER BY sort_order ASC NULLS LAST, created_at ASC
    LIMIT 10
  `)).rows as GoalRowExtended[];

  return rows.map(g => {
    const progress = typeof g.progress === "number" ? g.progress : parseFloat(String(g.progress ?? "0"));
    const isOverdue = !!g.target_date && g.target_date < todayStr && progress < 100;
    return {
      title: String(g.title),
      progress,
      targetDate: g.target_date ? String(g.target_date) : null,
      isAutoTracked: g.tracking_type !== null && g.tracking_type !== "manual",
      isOverdue,
      statusIcon: statusIcon(progress, isOverdue),
      lastUpdatedAt: g.last_progress_updated_at ? String(g.last_progress_updated_at) : null,
    };
  });
}

/** Returns days since the goal was last updated (or Infinity if never) */
function daysSinceUpdate(goal: GoalSummaryLine): number {
  if (!goal.lastUpdatedAt) return Infinity;
  return Math.floor((Date.now() - new Date(goal.lastUpdatedAt).getTime()) / 86400000);
}

export interface ContextualPayload {
  /** Plain-text in-app message */
  inAppTitle: string;
  inAppMessage: string;
  /** Email subject + HTML for email delivery */
  emailSubject: string;
  emailHtml: string;
  metadata?: Record<string, unknown>;
}

// ─── 1. Check-in Reminder (24 h before) ───────────────────────────────────────

interface CheckInRow {
  id: string;
  employee_id: string;
  manager_id: string | null;
  scheduled_date: string;
  check_in_type: string;
  milestone_day?: number | null;
  plan_id?: string | null;
}

/**
 * Build a rich check-in reminder for both employee and manager.
 * `forManager` controls whether the extra manager CTA line is included.
 */
export async function buildCheckinReminderPayload(
  checkIn: CheckInRow,
  employeeName: string,
  managerName: string,
  forManager: boolean,
): Promise<ContextualPayload> {
  const portalBase = getPortalBaseUrl();
  const label = checkIn.milestone_day
    ? `Day ${checkIn.milestone_day} Check-in`
    : checkIn.check_in_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  let goalLines: string[] = [];
  let trackedCount = 0;
  let totalCount = 0;

  if (checkIn.plan_id) {
    const lines = await fetchPlanGoalLines(checkIn.plan_id);
    totalCount = lines.length;
    trackedCount = lines.filter(l => l.isAutoTracked && !l.isOverdue).length;
    goalLines = lines.map(formatGoalLine);
  }

  const progressSummary = totalCount > 0
    ? `You're on track on ${trackedCount} of ${totalCount} tracked metrics.`
    : "";

  const goalBlock = goalLines.length > 0
    ? `\n\n**Your progress this period:**\n${goalLines.join("\n")}`
    : "";

  const managerExtra = forManager
    ? "\n\nLog your coaching notes before the session so the record is current."
    : "";

  const recipient = forManager ? managerName : employeeName;
  const otherParty = forManager ? employeeName : managerName;

  const inAppMessage = `${label} tomorrow — review is scheduled with ${otherParty}. ${progressSummary}`;

  const emailHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1F3A6E">${label} Tomorrow — Here's Where You Stand</h2>
  <p>Your ${label.toLowerCase()} with <strong>${otherParty}</strong> is scheduled for tomorrow.</p>
  ${goalBlock ? `<div style="background:#f9f9f9;border-left:4px solid #1F3A6E;padding:12px 16px;margin:16px 0">
    <strong>Progress this period:</strong><br/>
    <pre style="font-family:inherit;margin:8px 0">${goalLines.join("\n")}</pre>
    <p style="margin:8px 0 0">${progressSummary}</p>
  </div>` : ""}
  ${managerExtra ? `<p><em>${managerExtra.trim()}</em></p>` : ""}
  <p><a href="${portalBase}/admin/hr/my-team?tab=checkins" style="color:#F47C20">→ Go to Check-ins</a></p>
</div>`.trim();

  return {
    inAppTitle: `${label} Tomorrow`,
    inAppMessage,
    emailSubject: `${label} Tomorrow — Here's Where You Stand`,
    emailHtml,
    metadata: {
      checkInId: checkIn.id,
      planId: checkIn.plan_id,
      scheduledDate: checkIn.scheduled_date,
      goalCount: totalCount,
      onTrackCount: trackedCount,
    },
  };
}

// ─── 2. Coaching Entry Prompt ────────────────────────────────────────────────

interface PlanRow {
  id: string;
  plan_type: string;
  employee_id: string;
}

/**
 * Build a rich coaching prompt for a manager who hasn't logged a note recently.
 * Includes week-over-week staleness: goals not updated in the past 7 days are
 * highlighted as "no update this week" so the manager knows which to focus on.
 */
export async function buildCoachingPromptPayload(
  plan: PlanRow,
  managerId: string,
  employeeName: string,
  daysSinceLastNote: number,
): Promise<ContextualPayload> {
  const portalBase = getPortalBaseUrl();
  const planLabel = plan.plan_type.replace(/_/g, " ").toUpperCase();

  const goalLines = plan.id ? await fetchPlanGoalLines(plan.id) : [];
  const overdueCount = goalLines.filter(l => l.isOverdue).length;

  // Week-over-week: classify each goal as active-this-week vs stale
  const staleGoals = goalLines.filter(l => daysSinceUpdate(l) > 7);
  const activeGoals = goalLines.filter(l => daysSinceUpdate(l) <= 7);
  const staleCount = staleGoals.length;

  // Format goal lines with staleness annotation
  const goalBlock = goalLines.map(g => {
    const stale = daysSinceUpdate(g) > 7;
    const suffix = g.isAutoTracked ? "" : " (manual goal — manager will discuss)";
    const weekNote = stale ? " — no update this week" : "";
    return `— ${g.title}: ${g.progress}% ${g.statusIcon}${suffix}${weekNote}`;
  }).join("\n");

  const dayWord = daysSinceLastNote === 1 ? "day" : "days";
  const title = `Coaching Note Needed — ${employeeName}'s ${planLabel}`;

  // Status summary: prioritise stale goals over overdue
  const statusLine = staleCount > 0
    ? `${staleCount} goal${staleCount !== 1 ? "s" : ""} had no update this week; ${activeGoals.length} are current.`
    : overdueCount > 0
    ? `${overdueCount} goal${overdueCount !== 1 ? "s" : ""} are overdue.`
    : "All goals have recent updates.";

  const inAppMessage =
    `It's been ${daysSinceLastNote} ${dayWord} since your last coaching note for ${employeeName}. ` +
    `${statusLine} A quick note keeps their record current.`;

  const emailHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1F3A6E">${title}</h2>
  <p>It's been <strong>${daysSinceLastNote} ${dayWord}</strong> since your last coaching note for ${employeeName}.</p>
  ${goalBlock ? `<div style="background:#f9f9f9;border-left:4px solid #F47C20;padding:12px 16px;margin:16px 0">
    <strong>Current status (↑ active this week / no update = stale):</strong><br/>
    <pre style="font-family:inherit;margin:8px 0">${goalBlock}</pre>
    <p style="margin:8px 0 0">${statusLine}</p>
  </div>` : ""}
  <p>A quick note on what you discussed or observed keeps their record current and prevents an escalation flag.</p>
  <p>
    <a href="${portalBase}/admin/hr/my-team?tab=coaching" style="color:#F47C20">→ Add Coaching Note</a>
    &nbsp;&nbsp;
    <a href="${portalBase}/admin/hr/my-team?tab=plans" style="color:#1F3A6E">→ View Full Plan</a>
  </p>
</div>`.trim();

  return {
    inAppTitle: title,
    inAppMessage,
    emailSubject: title,
    emailHtml,
    metadata: {
      planId: plan.id,
      planType: plan.plan_type,
      employeeId: plan.employee_id,
      managerId,
      daysSinceLastNote,
      overdueGoalCount: overdueCount,
      staleGoalCount: staleCount,
    },
  };
}

// ─── 3. SOP Overdue Nudge ────────────────────────────────────────────────────

interface SopNudgeInput {
  progressId: string;
  sopMasterId: string;
  sopCode: string;
  title: string;
  calendarDaysRemaining: number;
  workingDaysRemaining: number;
}

/**
 * Build a rich SOP overdue nudge with days-remaining countdown and estimated read time.
 */
export async function buildSopNudgePayload(input: SopNudgeInput): Promise<ContextualPayload> {
  const portalBase = getPortalBaseUrl();
  const estimatedMinutes = 8; // Fixed estimate; can be enhanced from word count

  const daysWord = input.calendarDaysRemaining === 1 ? "day" : "days";
  const urgency = input.calendarDaysRemaining <= 1
    ? "🔴 Urgent"
    : input.calendarDaysRemaining <= 3
    ? "⚠️ Action Required"
    : "Action Needed";

  const repeatLine = input.calendarDaysRemaining <= 1
    ? ""
    : "\n\nAfter today, this message will appear every working day until acknowledged.";

  const title = `${urgency}: ${input.sopCode} SOP Acknowledgment`;
  const inAppMessage =
    `${input.calendarDaysRemaining} ${daysWord} left before your portal access is restricted. ` +
    `Acknowledge ${input.sopCode} — ${input.title}. Takes ~${estimatedMinutes} minutes.`;

  const emailHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1F3A6E">${urgency}: ${input.sopCode} SOP Acknowledgment</h2>
  <p>You have <strong>${input.calendarDaysRemaining} ${daysWord}</strong> left before your portal access is restricted.</p>
  <div style="background:#fff8e1;border-left:4px solid #F47C20;padding:12px 16px;margin:16px 0">
    <strong>${input.sopCode} — ${input.title}</strong><br/>
    <span style="color:#666">This takes about ${estimatedMinutes} minutes.</span>
  </div>
  <p>
    <a href="${portalBase}/admin/my-desk?tab=my-sops" style="display:inline-block;background:#1F3A6E;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px">
      Acknowledge Now — ${input.sopCode}
    </a>
  </p>
  ${repeatLine ? `<p style="color:#999;font-size:12px"><em>${repeatLine.trim()}</em></p>` : ""}
</div>`.trim();

  return {
    inAppTitle: title,
    inAppMessage,
    emailSubject: `${urgency}: Acknowledge ${input.sopCode} — ${input.calendarDaysRemaining} ${daysWord} remaining`,
    emailHtml,
    metadata: {
      progressId: input.progressId,
      sopMasterId: input.sopMasterId,
      sopCode: input.sopCode,
      calendarDaysRemaining: input.calendarDaysRemaining,
      workingDaysRemaining: input.workingDaysRemaining,
      estimatedMinutes,
    },
  };
}
