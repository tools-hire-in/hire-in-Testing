/**
 * Zoom Comms API Routes
 *
 * Exposes sanitized Zoom communications data and AI insights to the frontend.
 * RBAC: manager, hr, admin, super_admin only. Recruiters have no access.
 * Managers are scope-checked: they can only query direct reports (manager_id FK).
 *
 * Privacy guarantees enforced at the response layer:
 *   - No raw phone numbers (caller_number / callee_number / peer_number)
 *   - No raw SMS message bodies (zoom_sms_messages.body)
 *   - No candidate real names
 *   - Only sanitized digest text from zoom_sms_digests
 */
import type { Express, Request, Response, NextFunction } from "express";
import { requireAuth } from "./auth";
import { db } from "./db";
import { sql } from "drizzle-orm";

const COMMS_ALLOWED_ROLES = new Set(["super_admin", "admin", "hr", "manager"]);
const ADMIN_SYNC_ROLES = new Set(["super_admin", "admin", "hr"]);

// ── Role-check middleware ─────────────────────────────────────────────────────

function requireCommsRole(req: Request, res: Response, next: NextFunction): void {
  if (!COMMS_ALLOWED_ROLES.has(req.session!.role as string)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }
  next();
}

function requireSyncRole(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_SYNC_ROLES.has(req.session!.role as string)) {
    res.status(403).json({ error: "Insufficient permissions — admin/hr/super_admin only" });
    return;
  }
  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Today's date in America/Los_Angeles timezone (DST-aware). */
function todayLosAngeles(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function validateDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * Check that the authenticated manager is allowed to view data for a recruiter
 * identified by email. HR/admin/super_admin bypass this check.
 * Returns the admin_users row for the target, or null after sending 403/404.
 */
async function assertManagerScopeByEmail(
  req: Request,
  res: Response,
  targetEmail: string,
): Promise<{ id: string; email: string; firstName: string | null; lastName: string | null } | null> {
  const userId = req.session!.userId!;
  const role = req.session!.role as string;

  const result = await db.execute(sql`
    SELECT id, email, first_name, last_name, manager_id
    FROM admin_users
    WHERE LOWER(email) = LOWER(${targetEmail})
      AND deleted_at IS NULL
    LIMIT 1
  `);
  const rows = (result?.rows ?? result ?? []) as Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    manager_id: string | null;
  }>;

  const target = rows[0];
  if (!target) {
    res.status(404).json({ error: "Recruiter not found" });
    return null;
  }

  if (role === "hr" || role === "admin" || role === "super_admin") {
    return { id: target.id, email: target.email, firstName: target.first_name, lastName: target.last_name };
  }

  // Manager role: target must be a direct report
  if (target.manager_id !== userId) {
    res.status(403).json({ error: "You can only view data for your direct reports" });
    return null;
  }

  return { id: target.id, email: target.email, firstName: target.first_name, lastName: target.last_name };
}

/**
 * Resolve the set of users whose Zoom comms are visible to the caller on `date`.
 * Only returns users who have actual call or SMS activity on that date (recruiter-scope).
 */
async function resolveActiveCommsMembersForDate(
  userId: string,
  role: string,
  date: string,
): Promise<Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>> {
  if (role === "hr" || role === "admin" || role === "super_admin") {
    const result = await db.execute(sql`
      SELECT DISTINCT au.id, au.email, au.first_name, au.last_name
      FROM admin_users au
      WHERE au.deleted_at IS NULL
        AND au.is_active = true
        AND (
          EXISTS (
            SELECT 1 FROM zoom_call_logs cl
            WHERE cl.user_id = au.id AND cl.start_time::date = ${date}::date
          )
          OR EXISTS (
            SELECT 1 FROM zoom_sms_sessions ss
            WHERE ss.user_id = au.id AND ss.session_start::date = ${date}::date
          )
        )
      ORDER BY au.first_name, au.last_name
    `);
    return ((result?.rows ?? result ?? []) as any[]).map((r) => ({
      id: r.id as string,
      email: r.email as string,
      firstName: r.first_name as string | null,
      lastName: r.last_name as string | null,
    }));
  }

  // Manager: only direct reports with activity on that date
  const result = await db.execute(sql`
    SELECT DISTINCT au.id, au.email, au.first_name, au.last_name
    FROM admin_users au
    WHERE au.manager_id = ${userId}
      AND au.deleted_at IS NULL
      AND au.is_active = true
      AND (
        EXISTS (
          SELECT 1 FROM zoom_call_logs cl
          WHERE cl.user_id = au.id AND cl.start_time::date = ${date}::date
        )
        OR EXISTS (
          SELECT 1 FROM zoom_sms_sessions ss
          WHERE ss.user_id = au.id AND ss.session_start::date = ${date}::date
        )
      )
    ORDER BY au.first_name, au.last_name
  `);
  return ((result?.rows ?? result ?? []) as any[]).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    firstName: r.first_name as string | null,
    lastName: r.last_name as string | null,
  }));
}

/**
 * Fetch the emails of a manager's direct reports (non-deleted, active).
 */
async function getDirectReportEmails(managerId: string): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT email FROM admin_users
    WHERE manager_id = ${managerId}
      AND deleted_at IS NULL
      AND is_active = true
  `);
  return ((result?.rows ?? result ?? []) as any[]).map((r) => r.email as string).filter(Boolean);
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerZoomCommsRoutes(app: Express): void {

  // ── GET /api/manager/comms/team?date= ──────────────────────────────────────
  // Team summary card: per-recruiter call counts, missed counts, SMS threads, AI excerpt.
  // Only users with Zoom activity on the date are returned (recruiter-scope filter).
  app.get(
    "/api/manager/comms/team",
    requireAuth,
    requireCommsRole,
    async (req: Request, res: Response) => {
      const userId = req.session!.userId!;
      const role = req.session!.role as string;
      const date = validateDate(req.query.date) ?? todayLosAngeles();

      try {
        const members = await resolveActiveCommsMembersForDate(userId, role, date);
        if (members.length === 0) return res.json([]);

        const memberIds = members.map((m) => m.id);
        const memberEmails = members.map((m) => m.email);

        const callStatsResult = await db.execute(sql`
          SELECT
            user_id,
            COUNT(*)::int                                           AS call_count,
            COUNT(*) FILTER (WHERE status ILIKE '%miss%')::int     AS missed_count
          FROM zoom_call_logs
          WHERE start_time::date = ${date}::date
            AND user_id = ANY(${memberIds}::text[])
          GROUP BY user_id
        `);
        const callStatsMap = new Map<string, { callCount: number; missedCount: number }>();
        for (const row of ((callStatsResult?.rows ?? callStatsResult ?? []) as any[])) {
          callStatsMap.set(row.user_id, {
            callCount: row.call_count ?? 0,
            missedCount: row.missed_count ?? 0,
          });
        }

        const smsStatsResult = await db.execute(sql`
          SELECT user_id, COUNT(*)::int AS sms_thread_count
          FROM zoom_sms_sessions
          WHERE session_start::date = ${date}::date
            AND user_id = ANY(${memberIds}::text[])
          GROUP BY user_id
        `);
        const smsStatsMap = new Map<string, number>();
        for (const row of ((smsStatsResult?.rows ?? smsStatsResult ?? []) as any[])) {
          smsStatsMap.set(row.user_id, row.sms_thread_count ?? 0);
        }

        const insightResult = await db.execute(sql`
          SELECT subject_id, content
          FROM zoom_ai_insights
          WHERE insight_type = 'recruiter_daily'
            AND subject_id = ANY(${memberEmails}::text[])
            AND (content->>'date') = ${date}
          ORDER BY generated_at DESC
        `);
        const insightMap = new Map<string, string>();
        for (const row of ((insightResult?.rows ?? insightResult ?? []) as any[])) {
          if (!insightMap.has(row.subject_id)) {
            const content = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
            const goals: any[] = content?.actionableGoals ?? [];
            const excerpt = goals.length > 0 ? goals[0].goal : null;
            insightMap.set(row.subject_id, excerpt ? String(excerpt).slice(0, 160) : "");
          }
        }

        const response = members.map((m) => {
          const callStats = callStatsMap.get(m.id) ?? { callCount: 0, missedCount: 0 };
          return {
            userId: m.id,
            email: m.email,
            name: `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.email,
            callCount: callStats.callCount,
            missedCount: callStats.missedCount,
            smsThreadCount: smsStatsMap.get(m.id) ?? 0,
            aiDigestExcerpt: insightMap.get(m.email) ?? null,
            date,
          };
        });

        res.json(response);
      } catch (err: any) {
        console.error("[zoomComms] GET /team error:", err);
        res.status(500).json({ error: "Failed to fetch team comms summary" });
      }
    },
  );

  // ── GET /api/manager/comms/recruiter?email=&date= ──────────────────────────
  // Full recruiter detail: sanitized call rows, SMS sessions with digest only, AI insight.
  app.get(
    "/api/manager/comms/recruiter",
    requireAuth,
    requireCommsRole,
    async (req: Request, res: Response) => {
      const targetEmail = typeof req.query.email === "string" ? req.query.email.trim() : "";
      if (!targetEmail) return res.status(400).json({ error: "email query parameter is required" });

      const date = validateDate(req.query.date) ?? todayLosAngeles();

      try {
        const target = await assertManagerScopeByEmail(req, res, targetEmail);
        if (!target) return;

        // Call rows — direction, duration, outcome only; no phone numbers
        const callResult = await db.execute(sql`
          SELECT id, direction, duration, status, start_time, end_time
          FROM zoom_call_logs
          WHERE user_id = ${target.id}
            AND start_time::date = ${date}::date
          ORDER BY start_time ASC
        `);
        const callLog = ((callResult?.rows ?? callResult ?? []) as any[]).map((r) => ({
          id: r.id as string,
          direction: r.direction as string | null,
          duration: r.duration as number | null,
          outcome: r.status as string | null,
          startTime: r.start_time as string | null,
          endTime: r.end_time as string | null,
        }));

        // SMS sessions — digest text only; no peer_number, no raw message bodies
        const smsResult = await db.execute(sql`
          SELECT
            s.id,
            s.session_start,
            s.session_end,
            s.message_count,
            d.digest_text
          FROM zoom_sms_sessions s
          LEFT JOIN zoom_sms_digests d ON d.session_id = s.id AND d.date = ${date}
          WHERE s.user_id = ${target.id}
            AND s.session_start::date = ${date}::date
          ORDER BY s.session_start ASC
        `);
        const smsSessions = ((smsResult?.rows ?? smsResult ?? []) as any[]).map((r) => ({
          id: r.id as string,
          sessionStart: r.session_start as string | null,
          sessionEnd: r.session_end as string | null,
          messageCount: r.message_count as number | null,
          sanitizedDigest: r.digest_text as string | null,
        }));

        // Full AI insight for this recruiter on this date
        const insightResult = await db.execute(sql`
          SELECT id, content, generated_at
          FROM zoom_ai_insights
          WHERE insight_type = 'recruiter_daily'
            AND subject_id = ${target.email}
            AND (content->>'date') = ${date}
          ORDER BY generated_at DESC
          LIMIT 1
        `);
        const insightRow = ((insightResult?.rows ?? insightResult ?? []) as any[])[0] ?? null;
        const insight = insightRow
          ? {
              id: insightRow.id as string,
              content: typeof insightRow.content === "string"
                ? JSON.parse(insightRow.content)
                : insightRow.content,
              generatedAt: insightRow.generated_at as string | null,
            }
          : null;

        res.json({
          recruiter: {
            userId: target.id,
            email: target.email,
            name: `${target.firstName ?? ""} ${target.lastName ?? ""}`.trim() || target.email,
          },
          date,
          callLog,
          smsSessions,
          insight,
        });
      } catch (err: any) {
        console.error("[zoomComms] GET /recruiter error:", err);
        res.status(500).json({ error: "Failed to fetch recruiter comms detail" });
      }
    },
  );

  // ── GET /api/manager/comms/insights/history?email=&days=30 ────────────────
  // Last N days of zoom_ai_insights rows for a recruiter, newest first.
  app.get(
    "/api/manager/comms/insights/history",
    requireAuth,
    requireCommsRole,
    async (req: Request, res: Response) => {
      const targetEmail = typeof req.query.email === "string" ? req.query.email.trim() : "";
      if (!targetEmail) return res.status(400).json({ error: "email query parameter is required" });

      const rawDays = parseInt(String(req.query.days ?? "30"), 10);
      const days = Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 365 ? rawDays : 30;

      try {
        const target = await assertManagerScopeByEmail(req, res, targetEmail);
        if (!target) return;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const result = await db.execute(sql`
          SELECT id, content, generated_at
          FROM zoom_ai_insights
          WHERE insight_type = 'recruiter_daily'
            AND subject_id = ${target.email}
            AND generated_at >= ${cutoffStr}::timestamp
          ORDER BY generated_at DESC
        `);

        const history = ((result?.rows ?? result ?? []) as any[]).map((r) => ({
          id: r.id as string,
          content: typeof r.content === "string" ? JSON.parse(r.content) : r.content,
          generatedAt: r.generated_at as string | null,
        }));

        res.json({
          recruiter: {
            userId: target.id,
            email: target.email,
            name: `${target.firstName ?? ""} ${target.lastName ?? ""}`.trim() || target.email,
          },
          days,
          history,
        });
      } catch (err: any) {
        console.error("[zoomComms] GET /insights/history error:", err);
        res.status(500).json({ error: "Failed to fetch insight history" });
      }
    },
  );

  // ── GET /api/manager/comms/team-digest?date= ──────────────────────────────
  // Returns the AI insight digest scoped to the caller's visible team:
  //   - HR/admin/super_admin: the global team_daily row (all recruiters).
  //   - Manager: the recruiter_daily insights for their direct reports only
  //     (no cross-team data leaks).
  app.get(
    "/api/manager/comms/team-digest",
    requireAuth,
    requireCommsRole,
    async (req: Request, res: Response) => {
      const userId = req.session!.userId!;
      const role = req.session!.role as string;
      const date = validateDate(req.query.date) ?? todayLosAngeles();

      try {
        if (role === "hr" || role === "admin" || role === "super_admin") {
          // Privileged roles: return the global team_daily AI insight
          const result = await db.execute(sql`
            SELECT id, content, generated_at
            FROM zoom_ai_insights
            WHERE insight_type = 'team_daily'
              AND subject_id = 'team'
              AND (content->>'date') = ${date}
            ORDER BY generated_at DESC
            LIMIT 1
          `);
          const row = ((result?.rows ?? result ?? []) as any[])[0] ?? null;
          if (!row) return res.json({ date, scope: "team", digest: null });

          return res.json({
            date,
            scope: "team",
            digest: {
              id: row.id as string,
              content: typeof row.content === "string" ? JSON.parse(row.content) : row.content,
              generatedAt: row.generated_at as string | null,
            },
          });
        }

        // Manager: synthesize a single team-level digest from direct reports only.
        // This ensures no cross-team data leakage while keeping a consistent response shape.
        const directReportEmails = await getDirectReportEmails(userId);
        if (directReportEmails.length === 0) {
          return res.json({ date, scope: "manager_team", digest: null });
        }

        const result = await db.execute(sql`
          SELECT id, subject_id, content, generated_at
          FROM zoom_ai_insights
          WHERE insight_type = 'recruiter_daily'
            AND subject_id = ANY(${directReportEmails}::text[])
            AND (content->>'date') = ${date}
          ORDER BY subject_id, generated_at DESC
        `);

        // Deduplicate to latest insight per recruiter, then synthesize team digest
        const seenEmails = new Set<string>();
        const recruiterContents: any[] = [];
        let latestGeneratedAt: string | null = null;

        for (const row of ((result?.rows ?? result ?? []) as any[])) {
          if (!seenEmails.has(row.subject_id)) {
            seenEmails.add(row.subject_id);
            const content = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
            recruiterContents.push(content);
            if (!latestGeneratedAt) latestGeneratedAt = row.generated_at as string | null;
          }
        }

        if (recruiterContents.length === 0) {
          return res.json({ date, scope: "manager_team", digest: null });
        }

        // Synthesize a TeamInsight-shaped object from the scoped recruiter insights
        const teamObservations: string[] = [];
        const topUrgentActions: string[] = [];
        const scores: number[] = [];

        for (const c of recruiterContents) {
          for (const p of (c?.conversationPatterns ?? [])) {
            if (typeof p === "string" && !teamObservations.includes(p)) teamObservations.push(p);
          }
          for (const g of (c?.actionableGoals ?? [])) {
            if (g?.urgency === "high" && typeof g.goal === "string") {
              topUrgentActions.push(g.goal);
            }
          }
          if (typeof c?.responsivenessScore === "number") scores.push(c.responsivenessScore);
        }

        const avgScore = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;

        const suggestedTeamFocus = topUrgentActions.length > 0
          ? topUrgentActions[0]
          : teamObservations.length > 0
            ? teamObservations[0]
            : "Review individual recruiter insights for coaching opportunities.";

        const synthesizedContent = {
          date,
          scope: "manager_team",
          recruiterCount: recruiterContents.length,
          avgResponsivenessScore: avgScore,
          teamObservations: teamObservations.slice(0, 3),
          suggestedTeamFocus,
          topUrgentActions: topUrgentActions.slice(0, 3),
        };

        res.json({
          date,
          scope: "manager_team",
          digest: {
            content: synthesizedContent,
            generatedAt: latestGeneratedAt,
          },
        });
      } catch (err: any) {
        console.error("[zoomComms] GET /team-digest error:", err);
        res.status(500).json({ error: "Failed to fetch team digest" });
      }
    },
  );

  // ── POST /api/admin/comms/sync ─────────────────────────────────────────────
  // Trigger manual sync + insights generation for a date. Admin/HR/super_admin only.
  app.post(
    "/api/admin/comms/sync",
    requireAuth,
    requireSyncRole,
    async (req: Request, res: Response) => {
      const rawDate = req.body?.date;
      const date = validateDate(rawDate) ?? new Date().toISOString().slice(0, 10);

      try {
        const { triggerManualSync } = await import("./zoomService");
        const summary = await triggerManualSync(date);
        res.json({ ok: true, date, summary });
      } catch (err: any) {
        console.error("[zoomComms] POST /sync error:", err);
        res.status(500).json({ error: "Sync failed", detail: err.message });
      }
    },
  );
}
