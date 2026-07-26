/**
 * Proactive Plan Nudge Engine
 * Fires pre-milestone notifications for probation/PIP/growth plans.
 * Uses scheduled_nudges table for idempotent dedup:
 *   UNIQUE(plan_id, nudge_type, nudge_date, COALESCE(check_in_id, ''))
 *
 * Nudge types:
 *   plan_checkin_48h    — formal check-in milestone in 48 hours
 *   plan_checkin_24h    — formal check-in milestone in 24 hours
 *   probation_d7        — probation 1-week pulse check
 *   probation_d75       — probation day-75 (15 days before typical 90-day end)
 *   pip_no_meeting_14d  — active PIP with no meeting in 14 days (weekly, with HR copy)
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { notifyUser } from "./notifications";
import { dispatchAutomatedEmail } from "./email";
import { getPortalBaseUrl } from "./portalUrl";

function dateOffset(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/** Monday of the ISO week containing `dateStr` (used for weekly throttle). */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

async function markNudgeSent(
  planId: string,
  nudgeType: string,
  nudgeDate: string,
  checkInId?: string | null,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO scheduled_nudges (plan_id, nudge_type, nudge_date, check_in_id)
    VALUES (${planId}, ${nudgeType}, ${nudgeDate}, ${checkInId ?? null})
    ON CONFLICT (plan_id, nudge_type, nudge_date, COALESCE(check_in_id, '')) DO NOTHING
  `);
}

async function alreadySent(
  planId: string,
  nudgeType: string,
  nudgeDate: string,
  checkInId?: string | null,
): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 FROM scheduled_nudges
    WHERE plan_id = ${planId}
      AND nudge_type = ${nudgeType}
      AND nudge_date = ${nudgeDate}
      AND COALESCE(check_in_id, '') = COALESCE(${checkInId ?? null}, '')
    LIMIT 1
  `);
  return r.rows.length > 0;
}

async function sendNudgeEmail(opts: {
  managerEmail: string;
  managerFirstName: string;
  employeeName: string;
  subject: string;
  headline: string;
  body: string;
  emailType: string;
}): Promise<void> {
  const ctaUrl = `${getPortalBaseUrl()}/admin/hr/my-team`;
  const htmlBody = `
    <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 19px;">Hi ${opts.managerFirstName},</h2>
    <p style="color: #475569; line-height: 1.6; margin: 0 0 14px;">${opts.body}</p>
    <div style="margin: 22px 0;">
      <a href="${ctaUrl}" style="display: inline-block; background: #1F3A6E; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px;">Open My Team</a>
    </div>`;
  const shell = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #1F3A6E; padding: 28px 32px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Hire'in Solutions</h1>
        <p style="color: #93c5fd; margin: 6px 0 0; font-size: 14px;">${opts.headline}</p>
      </div>
      <div style="padding: 32px;">${htmlBody}</div>
      <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
      </div>
    </div>`;
  await dispatchAutomatedEmail(opts.emailType, "plan:nudge", {
    to: opts.managerEmail,
    subject: opts.subject,
    html: shell,
    text: `Hi ${opts.managerFirstName},\n\n${opts.body}\n\nOpen My Team: ${ctaUrl}\n\nBest regards,\nAlina Carter\nHR Manager · Hire'in Solutions`,
  });
}

export async function firePlanProactiveNudges(): Promise<{ fired: number; errors: number }> {
  const today = todayIST();
  const in48h = dateOffset(today, 2);
  const in24h = dateOffset(today, 1);
  let fired = 0;
  let errors = 0;

  try {
    // ── 1. Pre-milestone nudges (48h and 24h) ────────────────────────────────
    const upcomingCIs = (await db.execute(sql`
      SELECT ci.id AS check_in_id, ci.plan_id, ci.scheduled_date, ci.check_in_type,
             ep.manager_id, ep.plan_type,
             au.first_name || ' ' || au.last_name AS employee_name,
             mgr.first_name AS manager_first_name, mgr.email AS manager_email
      FROM check_ins ci
      JOIN employee_plans ep ON ep.id = ci.plan_id
      JOIN admin_users au ON au.id = ep.employee_id
      JOIN admin_users mgr ON mgr.id = ep.manager_id
      WHERE ci.status != 'completed'
        AND ci.check_in_type != 'weekly_update'
        AND ci.scheduled_date IN (${in48h}, ${in24h})
        AND ep.status = 'active'
        AND ep.manager_id IS NOT NULL
        AND (mgr.deleted_at IS NULL OR mgr.deleted_at > NOW())
    `)).rows as any[];

    for (const ci of upcomingCIs) {
      const is48h = ci.scheduled_date === in48h;
      const nudgeType = is48h ? "plan_checkin_48h" : "plan_checkin_24h";
      // 24h nudges are pulse-only; formal milestones (pip_review, probation_review) only get the 48h nudge
      if (!is48h && (ci.check_in_type === "pip_review" || ci.check_in_type === "probation_review")) continue;
      const label = is48h ? "in 2 days" : "tomorrow";
      const checkInLabel = ci.check_in_type === "pip_review" ? "PIP Review" : "Check-In";
      const nudgeTitle = `Upcoming ${checkInLabel} — ${label}`;
      const nudgeMsg = `${ci.employee_name}'s check-in is scheduled for ${ci.scheduled_date}. Prepare your notes and log the meeting afterwards.`;

      if (await alreadySent(ci.plan_id, nudgeType, today, ci.check_in_id)) continue;

      try {
        // In-app notification (both 48h and 24h)
        await notifyUser({
          userId: ci.manager_id,
          type: "plan_nudge",
          title: nudgeTitle,
          message: nudgeMsg,
          metadata: { link: "/admin/hr/my-team", checkInId: ci.check_in_id },
        });

        // Email only for 48h formal milestone nudge; 24h is a lighter in-app-only pulse
        if (is48h && ci.manager_email) {
          await sendNudgeEmail({
            managerEmail: ci.manager_email,
            managerFirstName: ci.manager_first_name || "there",
            employeeName: ci.employee_name,
            subject: `Reminder: ${checkInLabel} for ${ci.employee_name} is in 2 days`,
            headline: `Upcoming ${checkInLabel}`,
            body: `${ci.employee_name}'s <strong>${checkInLabel}</strong> is scheduled for <strong>${ci.scheduled_date}</strong> (in 2 days). Please prepare your notes and discussion points. After the meeting, log it in My Team to keep the plan on track.`,
            emailType: nudgeType,
          }).catch(e => console.error(`[planNudgeEngine] nudge email failed for ${nudgeType}:`, e));
        }

        await markNudgeSent(ci.plan_id, nudgeType, today, ci.check_in_id);
        fired++;
      } catch (e) {
        console.error(`[planNudgeEngine] ${nudgeType} nudge failed for plan ${ci.plan_id}:`, e);
        errors++;
      }
    }

    // ── 2. Probation day-7 pulse ──────────────────────────────────────────────
    const probD7 = (await db.execute(sql`
      SELECT ep.id AS plan_id, ep.manager_id,
             au.first_name || ' ' || au.last_name AS employee_name,
             mgr.first_name AS manager_first_name, mgr.email AS manager_email
      FROM employee_plans ep
      JOIN admin_users au ON au.id = ep.employee_id
      JOIN admin_users mgr ON mgr.id = ep.manager_id
      WHERE ep.plan_type = 'probation'
        AND ep.status = 'active'
        AND ep.start_date = ${dateOffset(today, -7)}
        AND ep.manager_id IS NOT NULL
        AND (mgr.deleted_at IS NULL OR mgr.deleted_at > NOW())
        -- Only nudge if no meetings have been logged for this plan in the first 7 days
        AND NOT EXISTS (
          SELECT 1 FROM plan_meetings pm
          WHERE pm.plan_id = ep.id AND pm.deleted_at IS NULL
        )
    `)).rows as any[];

    for (const p of probD7) {
      if (await alreadySent(p.plan_id, "probation_d7", today)) continue;
      try {
        await notifyUser({
          userId: p.manager_id,
          type: "plan_nudge",
          title: `Probation: 1-Week Check — ${p.employee_name}`,
          message: `It has been 7 days since ${p.employee_name} started probation. Log your initial observations and check that Day 1/7 check-ins are on track.`,
          metadata: { link: "/admin/hr/my-team" },
        });
        if (p.manager_email) {
          await sendNudgeEmail({
            managerEmail: p.manager_email,
            managerFirstName: p.manager_first_name || "there",
            employeeName: p.employee_name,
            subject: `Probation 1-Week Check — ${p.employee_name}`,
            headline: "Probation: Week 1 Milestone",
            body: `${p.employee_name} has now been on probation for 7 days. Log your initial observations and ensure the Day 1 and Day 7 check-ins have been completed.`,
            emailType: "probation_d7",
          }).catch(e => console.error(`[planNudgeEngine] probation_d7 email failed:`, e));
        }
        await markNudgeSent(p.plan_id, "probation_d7", today);
        fired++;
      } catch (e) {
        console.error(`[planNudgeEngine] probation_d7 nudge failed for plan ${p.plan_id}:`, e);
        errors++;
      }
    }

    // ── 3. Probation day-75 early warning ────────────────────────────────────
    const probD75 = (await db.execute(sql`
      SELECT ep.id AS plan_id, ep.manager_id,
             au.first_name || ' ' || au.last_name AS employee_name,
             mgr.first_name AS manager_first_name, mgr.email AS manager_email
      FROM employee_plans ep
      JOIN admin_users au ON au.id = ep.employee_id
      JOIN admin_users mgr ON mgr.id = ep.manager_id
      WHERE ep.plan_type = 'probation'
        AND ep.status = 'active'
        AND ep.start_date = ${dateOffset(today, -75)}
        AND ep.manager_id IS NOT NULL
        AND (mgr.deleted_at IS NULL OR mgr.deleted_at > NOW())
    `)).rows as any[];

    for (const p of probD75) {
      if (await alreadySent(p.plan_id, "probation_d75", today)) continue;
      try {
        await notifyUser({
          userId: p.manager_id,
          type: "plan_nudge",
          title: `Probation: 15 Days Remaining — ${p.employee_name}`,
          message: `${p.employee_name} is on Day 75 of probation. Finalize your assessment before the Day 90 review.`,
          metadata: { link: "/admin/hr/my-team" },
        });
        if (p.manager_email) {
          await sendNudgeEmail({
            managerEmail: p.manager_email,
            managerFirstName: p.manager_first_name || "there",
            employeeName: p.employee_name,
            subject: `Action Required: ${p.employee_name}'s Probation Ends in 15 Days`,
            headline: "Probation: Final Stretch",
            body: `${p.employee_name} is on Day 75 of their probation period — just 15 days until the final Day 90 review. Please finalise your assessment scores and prepare a clear recommendation (pass / extend / exit) before the review date.`,
            emailType: "probation_d75",
          }).catch(e => console.error(`[planNudgeEngine] probation_d75 email failed:`, e));
        }
        await markNudgeSent(p.plan_id, "probation_d75", today);
        fired++;
      } catch (e) {
        console.error(`[planNudgeEngine] probation_d75 nudge failed for plan ${p.plan_id}:`, e);
        errors++;
      }
    }

    // ── 4. PIP: no meeting in 14 days — weekly throttle, copies HR ───────────
    // Weekly throttle: dedup key uses Monday of the current week so the alert
    // fires at most once per week per plan rather than every day.
    const currentWeekStart = weekStart(today);
    const cutoff14d = dateOffset(today, -14);

    const stalePIPs = (await db.execute(sql`
      SELECT ep.id AS plan_id, ep.manager_id,
             au.first_name || ' ' || au.last_name AS employee_name,
             mgr.first_name AS manager_first_name, mgr.email AS manager_email,
             MAX(pm.meeting_date) AS last_meeting_date
      FROM employee_plans ep
      JOIN admin_users au ON au.id = ep.employee_id
      JOIN admin_users mgr ON mgr.id = ep.manager_id
      LEFT JOIN plan_meetings pm ON pm.plan_id = ep.id AND pm.deleted_at IS NULL
      WHERE ep.plan_type = 'pip'
        AND ep.status = 'active'
        AND ep.manager_id IS NOT NULL
        AND (mgr.deleted_at IS NULL OR mgr.deleted_at > NOW())
      GROUP BY ep.id, ep.manager_id, employee_name, mgr.first_name, mgr.email
      HAVING MAX(pm.meeting_date) IS NULL OR MAX(pm.meeting_date) < ${cutoff14d}
    `)).rows as any[];

    for (const p of stalePIPs) {
      if (await alreadySent(p.plan_id, "pip_no_meeting_14d", currentWeekStart)) continue;

      try {
        const sinceMsg = p.last_meeting_date
          ? `last meeting was on ${p.last_meeting_date}`
          : "no meeting has been logged";
        const inAppMsg = `${p.employee_name}'s PIP has had ${sinceMsg} (14+ days). Log a meeting to maintain engagement.`;

        // Notify manager
        await notifyUser({
          userId: p.manager_id,
          type: "plan_nudge",
          title: `PIP Engagement Stalled — ${p.employee_name}`,
          message: inAppMsg,
          metadata: { link: "/admin/hr/my-team" },
        });

        // Email manager with deep-link
        if (p.manager_email) {
          await sendNudgeEmail({
            managerEmail: p.manager_email,
            managerFirstName: p.manager_first_name || "there",
            employeeName: p.employee_name,
            subject: `PIP Alert: No Meeting Logged for ${p.employee_name} in 14+ Days`,
            headline: "PIP Engagement Check",
            body: `${p.employee_name}'s PIP has had <strong>${sinceMsg}</strong> (14+ days). Regular 1:1 meetings are required to maintain engagement and document progress. Please schedule and log a meeting as soon as possible.`,
            emailType: "pip_no_meeting_14d",
          }).catch(e => console.error(`[planNudgeEngine] pip_no_meeting_14d manager email failed:`, e));
        }

        // Copy all HR users (in-app only — to avoid email spam)
        const hrUsers = (await db.execute(sql`
          SELECT id FROM admin_users
          WHERE role IN ('hr', 'super_admin')
            AND id != ${p.manager_id}
            AND (deleted_at IS NULL OR deleted_at > NOW())
        `)).rows as any[];

        for (const hr of hrUsers) {
          await notifyUser({
            userId: hr.id,
            type: "plan_nudge",
            title: `[HR Alert] PIP Stalled — ${p.employee_name}`,
            message: `Manager has had ${sinceMsg} for ${p.employee_name}'s active PIP. Review may be needed.`,
            metadata: { link: "/admin/hr/my-team" },
          }).catch(() => {});
        }

        await markNudgeSent(p.plan_id, "pip_no_meeting_14d", currentWeekStart);
        fired++;
      } catch (e) {
        console.error(`[planNudgeEngine] pip_no_meeting_14d nudge failed for plan ${p.plan_id}:`, e);
        errors++;
      }
    }
  } catch (err) {
    console.error("[planNudgeEngine] Fatal error in firePlanProactiveNudges:", err);
    errors++;
  }

  return { fired, errors };
}
