/**
 * Ceipal Update Compliance — verification, escalation, and sweep logic.
 *
 * Implements the punch-out checkpoint system:
 *  1. fetchTodaySubmissionsByEmail  — queries Ceipal getSubmissions for today
 *  2. fetchTodayJobActivityByEmail  — queries Ceipal getJobPosts for today
 *  3. verifyTodayCeipalUpdate       — orchestrates both calls, stores result
 *  4. checkCeipalUpdateCompliance   — daily escalation sweep (manager notifications)
 *  5. sendCeipalMorningReminders    — reminds recruiters with unresolved yesterday commitments
 *  6. sendCeipalAnnouncement        — one-time deploy announcement
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { notifyUser } from "./notifications";
import { storage } from "./storage";

// ── Ceipal API helpers ────────────────────────────────────────────────────────

async function getTokenRetryFetch(): Promise<typeof import("./ceipalService").fetchWithTokenRetry | null> {
  try {
    const { fetchWithTokenRetry } = await import("./ceipalService");
    return fetchWithTokenRetry;
  } catch {
    return null;
  }
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

interface FetchResult {
  ok: boolean;   // false = API unreachable / auth failure / network error
  data: any[];
}

/** Fetch Ceipal submissions for today.
 *  Returns ok=false when credentials are missing, token fails, or HTTP/network errors occur.
 *  Returns ok=true with an empty array when the API is reachable but found no submissions.
 */
async function fetchTodaySubmissions(): Promise<FetchResult> {
  const email = process.env.CEIPAL_EMAIL;
  const password = process.env.CEIPAL_PASSWORD;
  const apiKey = process.env.CEIPAL_API_KEY;
  if (!email || !password || !apiKey) {
    console.log("[ceipal-compliance] fetchTodaySubmissions: credentials not configured → api_unavailable");
    return { ok: false, data: [] };
  }

  try {
    const fetchFn = await getTokenRetryFetch();
    if (!fetchFn) {
      console.log("[ceipal-compliance] fetchTodaySubmissions: could not load fetch helper → api_unavailable");
      return { ok: false, data: [] };
    }

    const today = todayStr();
    // v2 paginated submissions — fetch up to 3 pages (300 submissions should be ample for compliance check)
    const allRows: any[] = [];
    for (let page = 1; page <= 3; page++) {
      const url = `https://api.ceipal.com/v2/getSubmissions/?from_date=${today}&to_date=${today}&page=${page}&page_size=100`;
      const res = await fetchFn(url);
      if (!res.ok) {
        if (page === 1) {
          console.log(`[ceipal-compliance] v2 getSubmissions returned ${res.status} → api_unavailable`);
          return { ok: false, data: [] };
        }
        break;
      }
      const data = await res.json().catch(() => ({}));
      const rows: any[] = Array.isArray(data?.results) ? data.results
        : Array.isArray(data?.data) ? data.data
        : Array.isArray(data) ? data : [];
      if (rows.length === 0) break;
      allRows.push(...rows);
      if (rows.length < 100) break;
    }
    return { ok: true, data: allRows };
  } catch (err: any) {
    console.warn("[ceipal-compliance] fetchTodaySubmissions network error:", err.message, "→ api_unavailable");
    return { ok: false, data: [] };
  }
}

/** Fetch Ceipal job posts created or modified today.
 *  Returns ok=false on any failure; ok=true with data when API is reachable.
 */
async function fetchTodayJobActivity(): Promise<FetchResult> {
  const jobsEndpoint = process.env.CEIPAL_JOBS_ENDPOINT;
  if (!jobsEndpoint) {
    // Jobs endpoint is optional — treat as reachable-but-empty (no penalty)
    return { ok: true, data: [] };
  }

  try {
    const fetchFn = await getTokenRetryFetch();
    if (!fetchFn) {
      console.log("[ceipal-compliance] fetchTodayJobActivity: could not load fetch helper → api_unavailable");
      return { ok: false, data: [] };
    }

    const allJobs: any[] = [];
    for (let page = 1; page <= 3; page++) {
      const separator = jobsEndpoint.includes("?") ? "&" : "?";
      const url = `${jobsEndpoint}${separator}page=${page}&limit=50`;
      const res = await fetchFn(url);
      if (!res.ok) {
        // First page fail → API unavailable; mid-page break → treat as end of results
        if (page === 1) return { ok: false, data: [] };
        break;
      }
      const data = await res.json().catch(() => ({}));
      const pageJobs: any[] = Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data : [];
      if (pageJobs.length === 0) break;
      allJobs.push(...pageJobs);
      if (pageJobs.length < 50) break;
    }
    return { ok: true, data: allJobs };
  } catch (err: any) {
    console.warn("[ceipal-compliance] fetchTodayJobActivity network error:", err.message, "→ api_unavailable");
    return { ok: false, data: [] };
  }
}

/** Check if a job record was created or modified today. */
function isJobActiveToday(job: any, today: string): boolean {
  const dateFields = [
    "job_start_date", "created_date", "creation_date", "date_added",
    "last_modified", "updated_date", "modified_date", "last_updated",
  ];
  for (const f of dateFields) {
    const v = job[f];
    if (v && typeof v === "string" && v.startsWith(today)) return true;
  }
  return false;
}

/** Filter submissions/jobs by recruiter email. */
function filterByEmail(items: any[], email: string): any[] {
  const lower = email.toLowerCase();
  return items.filter((item: any) => {
    const fields = [
      item.submitted_by_email,
      item.recruiter_email,
      item.created_by_email,
      item.assigned_recruiter_email,
      item.owner_email,
      item.submitted_by,
    ];
    return fields.some(v => v && String(v).toLowerCase() === lower);
  });
}

// ── Local applications cross-reference ───────────────────────────────────────

/** IDs of applications pushed from website (ceipal_sync_status = 'synced').
 *  These shouldn't count toward recruiter-manual submissions. */
async function getWebsitePushedApplicantIds(): Promise<Set<string>> {
  try {
    const rows = await db.execute(sql`
      SELECT ceipal_applicant_id FROM applications
      WHERE ceipal_sync_status = 'synced' AND ceipal_applicant_id IS NOT NULL
    `);
    return new Set((rows.rows as any[]).map(r => String(r.ceipal_applicant_id)));
  } catch {
    return new Set();
  }
}

// ── Verify today's update for a specific recruiter ───────────────────────────

export interface CeipalVerifyResult {
  available: boolean;
  submissionsCount: number;
  jobsCount: number;
  status: "confirmed" | "confirmed_unverified" | "confirmed_no_evidence";
}

export async function verifyTodayCeipalUpdate(recruiterEmail: string): Promise<CeipalVerifyResult> {
  const today = todayStr();

  let submissionsResult: FetchResult;
  let jobsResult: FetchResult;
  let websiteIds: Set<string>;

  try {
    [submissionsResult, jobsResult, websiteIds] = await Promise.all([
      fetchTodaySubmissions(),
      fetchTodayJobActivity(),
      getWebsitePushedApplicantIds(),
    ]);
  } catch (err: any) {
    // Unexpected top-level error — treat as API unavailable
    console.warn("[ceipal-compliance] verifyTodayCeipalUpdate top-level error:", err.message);
    return { available: false, submissionsCount: 0, jobsCount: 0, status: "confirmed_unverified" };
  }

  // If either primary API call failed → API is unavailable; log as confirmed_unverified
  // so the recruiter is not penalised for an outage they have no control over.
  if (!submissionsResult.ok || !jobsResult.ok) {
    console.log(`[ceipal-compliance] API unavailable for ${recruiterEmail} — logging as confirmed_unverified`);
    return { available: false, submissionsCount: 0, jobsCount: 0, status: "confirmed_unverified" };
  }

  // API was reachable — now check for evidence of recruiter activity
  const manualSubs = filterByEmail(submissionsResult.data, recruiterEmail)
    .filter(s => !websiteIds.has(String(s.id || s.applicant_id || "")));

  const activeJobs = filterByEmail(jobsResult.data, recruiterEmail)
    .filter(j => isJobActiveToday(j, today));

  const submissionsCount = manualSubs.length;
  const jobsCount = activeJobs.length;
  const total = submissionsCount + jobsCount;

  // API reachable but no evidence found — recruiter self-confirmed; log as confirmed_no_evidence
  // (may be sync lag; excluded from escalation triggers)
  const status: CeipalVerifyResult["status"] = total === 0
    ? "confirmed_no_evidence"
    : "confirmed";

  return { available: true, submissionsCount, jobsCount, status };
}

// ── Log recording ─────────────────────────────────────────────────────────────

export async function recordCeipalUpdateLog(opts: {
  userId: string;
  logDate: string;
  status: string;
  deferredReason?: string | null;
  commitmentTime?: Date | null;
  verifiedCount?: number | null;
  jobsCount?: number | null;
  verifiedAt?: Date | null;
}): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO ceipal_update_logs
        (user_id, log_date, status, deferred_reason, commitment_time, verified_count, jobs_count, verified_at)
      VALUES
        (${opts.userId}, ${opts.logDate}::date, ${opts.status},
         ${opts.deferredReason ?? null}, ${opts.commitmentTime?.toISOString() ?? null},
         ${opts.verifiedCount ?? null}, ${opts.jobsCount ?? null},
         ${opts.verifiedAt?.toISOString() ?? null})
      ON CONFLICT (user_id, log_date) DO UPDATE SET
        status = EXCLUDED.status,
        deferred_reason = COALESCE(EXCLUDED.deferred_reason, ceipal_update_logs.deferred_reason),
        commitment_time = COALESCE(EXCLUDED.commitment_time, ceipal_update_logs.commitment_time),
        verified_count = COALESCE(EXCLUDED.verified_count, ceipal_update_logs.verified_count),
        jobs_count = COALESCE(EXCLUDED.jobs_count, ceipal_update_logs.jobs_count),
        verified_at = COALESCE(EXCLUDED.verified_at, ceipal_update_logs.verified_at)
    `);
  } catch (err: any) {
    console.error("[ceipal-compliance] recordCeipalUpdateLog error:", err.message);
  }
}

// ── Morning reminder sweep ────────────────────────────────────────────────────

/** Called daily at 8 AM IST. Finds unresolved yesterday commitments and reminds recruiters. */
export async function sendCeipalMorningReminders(): Promise<void> {
  const yesterday = yesterdayStr();
  const now = new Date();

  try {
    const rows = await db.execute(sql`
      SELECT cul.id, cul.user_id, cul.log_date, cul.status, cul.commitment_time,
             au.first_name, au.last_name, au.email, au.manager_id,
             au.ceipal_update_prompt_enabled
      FROM ceipal_update_logs cul
      JOIN admin_users au ON au.id = cul.user_id
      WHERE cul.log_date = ${yesterday}::date
        AND cul.status IN ('deferred', 'skipped')
        AND au.is_active = true
        AND au.deleted_at IS NULL
        AND au.role = 'recruiter'
        AND (cul.commitment_time IS NULL OR cul.commitment_time < ${now.toISOString()})
    `);

    for (const row of rows.rows as any[]) {
      if (!row.ceipal_update_prompt_enabled) continue;

      const dateLabel = new Date(row.log_date + "T12:00:00Z").toLocaleDateString("en-US", {
        weekday: "short", day: "numeric", month: "short",
      });
      const commitmentStr = row.commitment_time
        ? new Date(row.commitment_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : "your committed time";

      await notifyUser({
        userId: String(row.user_id),
        type: "ceipal_morning_reminder",
        title: `Ceipal reminder — ${dateLabel} update still pending`,
        message: `Yesterday (${dateLabel}) you noted you'd update Ceipal by ${commitmentStr}. Did you do it? Tap to confirm, or update Ceipal now before today's punch-out.`,
        metadata: {
          logDate: row.log_date,
          priorStatus: row.status,
          // ?ceipal=1 opens the check-in modal directly when the CTA is tapped
          ctaUrl: "/admin/my-desk?ceipal=1",
        },
      });
    }

    console.log(`[ceipal-compliance] Morning reminders: ${rows.rows.length} recruiters notified for ${yesterday}`);
  } catch (err: any) {
    console.error("[ceipal-compliance] sendCeipalMorningReminders error:", err.message);
  }
}

// ── Manager escalation sweep ──────────────────────────────────────────────────

/** Called daily. Checks for 2 consecutive missed days → manager notification.
 *  Also flags 5 missed in 30 days (badge only, no notification).
 *  Exempted users (ceipal_update_prompt_enabled = false) are excluded.
 */
export async function checkCeipalUpdateCompliance(): Promise<void> {
  const today = todayStr();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  try {
    // Find all active recruiters with a manager who aren't exempt
    const recruiters = await db.execute(sql`
      SELECT id, first_name, last_name, email, manager_id
      FROM admin_users
      WHERE role = 'recruiter'
        AND is_active = true
        AND deleted_at IS NULL
        AND ceipal_update_prompt_enabled = true
        AND manager_id IS NOT NULL
    `);

    for (const recruiter of recruiters.rows as any[]) {
      const rId = String(recruiter.id);
      const rName = `${recruiter.first_name} ${recruiter.last_name}`.trim();
      const managerId = String(recruiter.manager_id);

      // Get logs for the last 30 days
      const logs = await db.execute(sql`
        SELECT log_date, status FROM ceipal_update_logs
        WHERE user_id = ${rId}
          AND log_date >= ${thirtyDaysAgoStr}::date
        ORDER BY log_date DESC
      `);

      const logRows = logs.rows as any[];

      // Only "deferred" and "skipped" are true misses for escalation purposes.
      // "confirmed_no_evidence" means the recruiter self-confirmed but the API had no
      // evidence yet (possible sync lag). We give benefit of the doubt and do NOT
      // escalate on this status — it is tracked in compliance rate charts separately.
      const escalationMissedStatuses = new Set(["deferred", "skipped"]);

      // 30-day miss count (escalation-only definition)
      const missedInMonth = logRows.filter(r => escalationMissedStatuses.has(r.status)).length;

      // 2 consecutive days check (check the 2 most recent logs)
      const recent2 = logRows.slice(0, 2);
      const twoConsecutive = recent2.length === 2 && recent2.every(r => escalationMissedStatuses.has(r.status));

      if (twoConsecutive) {
        // Check if manager was already notified today to avoid spamming
        const dedupKey = `ceipal_mgr_alert_${managerId}_${rId}_${today}`;
        const alreadySent = await storage.getSystemSetting(dedupKey);
        if (!alreadySent) {
          await notifyUser({
            userId: managerId,
            type: "ceipal_manager_alert",
            title: `${rName} hasn't confirmed Ceipal updates for 2 days`,
            message: `${rName} hasn't confirmed their Ceipal updates for 2 days in a row. Check their profile in My Team for details.`,
            metadata: {
              recruiterId: rId,
              recruiterName: rName,
              missedDays: 2,
              ctaUrl: "/admin/hr/my-team",
            },
          });
          await storage.upsertSystemSetting(dedupKey, new Date().toISOString());
        }
      }

      // Flag 5+ misses in 30 days — update the most recent log row with a flagged marker
      if (missedInMonth >= 5) {
        await db.execute(sql`
          UPDATE ceipal_update_logs
          SET manager_flagged_at = ${new Date().toISOString()}
          WHERE user_id = ${rId} AND log_date = (
            SELECT MAX(log_date) FROM ceipal_update_logs WHERE user_id = ${rId}
          ) AND manager_flagged_at IS NULL
        `);
      }

      // 10+ misses in 30 days → one-off HR notification (deduped per calendar month)
      if (missedInMonth >= 10) {
        const monthStr = today.slice(0, 7); // YYYY-MM
        const hrDedupKey = `ceipal_hr_alert_${rId}_${monthStr}`;
        const alreadySentHr = await storage.getSystemSetting(hrDedupKey);
        if (!alreadySentHr) {
          // Notify all active HR users
          const hrUsers = await db.execute(sql`
            SELECT id FROM admin_users
            WHERE role IN ('hr', 'admin', 'super_admin')
              AND is_active = true AND deleted_at IS NULL
          `);
          for (const hr of hrUsers.rows as any[]) {
            await notifyUser({
              userId: String(hr.id),
              type: "ceipal_compliance",
              title: `⚠️ ${rName} — 10+ Ceipal misses this month`,
              message: `${rName} has missed Ceipal updates ${missedInMonth} times in the last 30 days. Consider reviewing their compliance status or adjusting the check-in setting.`,
              metadata: {
                recruiterId: rId,
                recruiterName: rName,
                missedDays: missedInMonth,
                threshold: 10,
                ctaUrl: "/admin/hr/my-team?tab=ceipal",
              },
            });
          }
          await storage.upsertSystemSetting(hrDedupKey, new Date().toISOString());
          console.log(`[ceipal-compliance] 10-miss HR alert sent for ${rName} (${missedInMonth} misses)`);
        }
      }
    }

    console.log(`[ceipal-compliance] Escalation sweep complete for ${recruiters.rows.length} recruiters`);
  } catch (err: any) {
    console.error("[ceipal-compliance] checkCeipalUpdateCompliance error:", err.message);
  }
}

// ── Team compliance summary ───────────────────────────────────────────────────

export interface CeipalTeamMemberCompliance {
  userId: string;
  name: string;
  email: string;
  promptEnabled: boolean;
  workingDays: number;
  confirmedDays: number;
  missedDays: number;
  rate: number; // 0–100
  flagged: boolean; // 5+ misses in 30 days
  recentLogs: Array<{ date: string; status: string }>;
}

/** Returns Ceipal compliance summary for all recruiters under a manager. */
export async function getTeamCeipalCompliance(managerId: string, monthStr?: string): Promise<CeipalTeamMemberCompliance[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fromDate = monthStr
    ? `${monthStr}-01`
    : `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = now.toISOString().split("T")[0];

  try {
    const recruiters = await db.execute(sql`
      SELECT id, first_name, last_name, email, ceipal_update_prompt_enabled
      FROM admin_users
      WHERE manager_id = ${managerId}
        AND role = 'recruiter'
        AND is_active = true
        AND deleted_at IS NULL
    `);

    const results: CeipalTeamMemberCompliance[] = [];
    const missedStatuses = new Set(["deferred", "skipped", "confirmed_no_evidence"]);
    const goodStatuses = new Set(["confirmed", "confirmed_unverified"]);

    for (const r of recruiters.rows as any[]) {
      const logs = await db.execute(sql`
        SELECT log_date::text AS date, status FROM ceipal_update_logs
        WHERE user_id = ${r.id}
          AND log_date >= ${fromDate}::date
          AND log_date <= ${toDate}::date
        ORDER BY log_date DESC
        LIMIT 31
      `);

      const logRows = logs.rows as any[];
      const confirmedDays = logRows.filter(l => goodStatuses.has(l.status)).length;
      const missedDays = logRows.filter(l => missedStatuses.has(l.status)).length;
      const workingDays = logRows.length;
      const rate = workingDays === 0 ? 0 : Math.round((confirmedDays / workingDays) * 100);
      const flagged = missedDays >= 5;

      results.push({
        userId: String(r.id),
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: String(r.email),
        promptEnabled: Boolean(r.ceipal_update_prompt_enabled),
        workingDays,
        confirmedDays,
        missedDays,
        rate,
        flagged,
        recentLogs: logRows.slice(0, 14).map(l => ({ date: l.date, status: l.status })),
      });
    }

    return results;
  } catch (err: any) {
    console.error("[ceipal-compliance] getTeamCeipalCompliance error:", err.message);
    return [];
  }
}

/** Org-wide compliance for HR view. */
export async function getOrgCeipalCompliance(): Promise<{
  totalRecruiters: number;
  avgRate: number;
  belowThreshold: number;
  members: CeipalTeamMemberCompliance[];
}> {
  try {
    const now = new Date();
    const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const toDate = now.toISOString().split("T")[0];
    const missedStatuses = ["deferred", "skipped", "confirmed_no_evidence"];
    const goodStatuses = ["confirmed", "confirmed_unverified"];

    const recruiters = await db.execute(sql`
      SELECT id, first_name, last_name, email, ceipal_update_prompt_enabled
      FROM admin_users
      WHERE role = 'recruiter' AND is_active = true AND deleted_at IS NULL
    `);

    const members: CeipalTeamMemberCompliance[] = [];

    for (const r of recruiters.rows as any[]) {
      const logs = await db.execute(sql`
        SELECT log_date::text AS date, status FROM ceipal_update_logs
        WHERE user_id = ${r.id} AND log_date >= ${fromDate}::date AND log_date <= ${toDate}::date
        ORDER BY log_date DESC LIMIT 31
      `);
      const logRows = logs.rows as any[];
      const confirmedDays = logRows.filter(l => goodStatuses.includes(l.status)).length;
      const missedDays = logRows.filter(l => missedStatuses.includes(l.status)).length;
      const workingDays = logRows.length;
      const rate = workingDays === 0 ? 0 : Math.round((confirmedDays / workingDays) * 100);
      members.push({
        userId: String(r.id),
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: String(r.email),
        promptEnabled: Boolean(r.ceipal_update_prompt_enabled),
        workingDays,
        confirmedDays,
        missedDays,
        rate,
        flagged: missedDays >= 5,
        recentLogs: logRows.slice(0, 14).map(l => ({ date: l.date, status: l.status })),
      });
    }

    const avgRate = members.length === 0 ? 0
      : Math.round(members.reduce((s, m) => s + m.rate, 0) / members.length);

    return {
      totalRecruiters: members.length,
      avgRate,
      belowThreshold: members.filter(m => m.rate < 70 && m.promptEnabled).length,
      members,
    };
  } catch (err: any) {
    console.error("[ceipal-compliance] getOrgCeipalCompliance error:", err.message);
    return { totalRecruiters: 0, avgRate: 0, belowThreshold: 0, members: [] };
  }
}

// ── One-time deploy announcement ──────────────────────────────────────────────

export async function sendCeipalAnnouncement(): Promise<void> {
  const FLAG_KEY = "ceipal_compliance_announcement_sent";
  try {
    const sent = await storage.getSystemSetting(FLAG_KEY);
    if (sent) {
      console.log("[ceipal-compliance] Announcement already sent — skipping");
      return;
    }

    await storage.upsertSystemSetting(FLAG_KEY, new Date().toISOString());

    const allUsers = await db.execute(sql`
      SELECT id, role FROM admin_users
      WHERE is_active = true AND deleted_at IS NULL
    `);

    for (const u of allUsers.rows as any[]) {
      const role = String(u.role);
      const userId = String(u.id);
      let title = "";
      let message = "";

      if (role === "recruiter") {
        title = "What's new: Ceipal end-of-day check-in";
        message = "When you punch out each day, you'll see a quick question: Did you update Ceipal today? Just tap Yes or No — takes 2 seconds. If you haven't updated yet, you can note when you'll do it and we'll remind you in the morning. If you're on leave or have a different arrangement, speak to HR and they can adjust your settings.";
      } else if (role === "manager") {
        title = "What's new: Ceipal update tracking for your team";
        message = "You can now see at a glance which team members are keeping their Ceipal up to date. Check your Team view — each recruiter shows their update rate for the month. If someone misses two days in a row, you'll get a heads-up notification.";
      } else if (["hr", "admin", "super_admin"].includes(role)) {
        title = "What's new: Ceipal update compliance + exception management";
        message = "Recruiters now confirm their Ceipal updates at punch-out each day. You can see team-wide compliance rates in the People & HR section. If someone needs to be exempted from the daily check-in (leave, role change, etc.), go to their profile in Users and toggle off the Ceipal checkpoint.";
      }

      if (title) {
        await notifyUser({
          userId,
          type: "system_announcement",
          title,
          message,
          metadata: { feature: "ceipal_compliance", dismissable: true },
        });
      }
    }

    console.log(`[ceipal-compliance] Announcement sent to ${allUsers.rows.length} users`);
  } catch (err: any) {
    console.error("[ceipal-compliance] sendCeipalAnnouncement error:", err.message);
  }
}
