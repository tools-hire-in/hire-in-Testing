/**
 * Zoom Comms Analytics Routes
 *
 * Manager-facing API for comms analytics. Recruiter self-view is explicitly out of scope.
 *
 * Routes:
 *   GET  /api/manager/comms/team          — team overview for a date
 *   GET  /api/manager/comms/recruiter     — per-recruiter call stats + digests + AI insights
 *   GET  /api/manager/comms/insights/history — historical AI insights trend view
 *   POST /api/admin/comms/sync            — manual sync trigger
 *   GET  /api/admin/comms/sync/status     — last-sync metadata
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sql, eq, and, isNull } from "drizzle-orm";
import { adminUsers } from "@shared/schema";

const MANAGER_ROLES = new Set(["super_admin", "admin", "hr", "manager"]);
const ADMIN_ROLES = new Set(["super_admin", "admin", "hr"]);

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function requireManagerRole(req: Request, res: Response): boolean {
  if (!requireAuth(req, res)) return false;
  if (!MANAGER_ROLES.has(req.session!.role as string)) {
    res.status(403).json({ error: "Manager access required" });
    return false;
  }
  return true;
}

function requireAdminRole(req: Request, res: Response): boolean {
  if (!requireAuth(req, res)) return false;
  if (!ADMIN_ROLES.has(req.session!.role as string)) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

function requireSyncRole(req: Request, res: Response): boolean {
  return requireAdminRole(req, res);
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function parseDate(val: unknown): string {
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return todayStr();
}

function validateDate(val: unknown): string | null {
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return null;
}

async function getDirectReportEmails(managerId: string): Promise<string[]> {
  const reports = await db
    .select({ email: adminUsers.email })
    .from(adminUsers)
    .where(and(eq(adminUsers.managerId, managerId), isNull(adminUsers.deletedAt)));
  return reports.map((r) => r.email);
}

export function registerZoomCommsRoutes(app: Express) {

  // ── GET /api/manager/comms/team ───────────────────────────────────────────
  app.get("/api/manager/comms/team", async (req: Request, res: Response) => {
    if (!requireManagerRole(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    const date = parseDate(req.query.date);

    try {
      // Determine which recruiter emails this manager can see
      let emailFilter: string[] | null = null;
      if (role === "manager") {
        emailFilter = await getDirectReportEmails(userId);
        if (emailFilter.length === 0) return res.json({ date, rows: [], teamDigest: null });
      }

      const callRows = (await db.execute(sql`
        SELECT email,
               COUNT(*)::int as total_calls,
               SUM(CASE WHEN result = 'missed' THEN 1 ELSE 0 END)::int as missed_calls,
               SUM(duration)::int as total_seconds
        FROM zoom_call_logs
        WHERE synced_date = ${date}::date
          ${emailFilter ? sql`AND email = ANY(${emailFilter}::text[])` : sql``}
        GROUP BY email
      `)) as any;
      const callStats = (Array.isArray(callRows?.rows) ? callRows.rows : callRows ?? []) as any[];

      const smsRows = (await db.execute(sql`
        SELECT email, COUNT(*)::int as sms_threads
        FROM zoom_sms_sessions
        WHERE synced_date = ${date}::date
          ${emailFilter ? sql`AND email = ANY(${emailFilter}::text[])` : sql``}
        GROUP BY email
      `)) as any;
      const smsStats = (Array.isArray(smsRows?.rows) ? smsRows.rows : smsRows ?? []) as any[];

      // Fetch team-level AI digest
      const teamDigestRow = (await db.execute(sql`
        SELECT content FROM zoom_ai_insights
        WHERE date = ${date}::date AND scope = 'team' AND scope_id = 'team'
        LIMIT 1
      `)) as any;
      const teamDigestRows = Array.isArray(teamDigestRow?.rows) ? teamDigestRow.rows : teamDigestRow ?? [];
      const teamDigest = teamDigestRows[0]?.content?.teamDigest ?? null;

      // Merge call stats + SMS stats
      const emailSet = new Set([
        ...callStats.map((r: any) => r.email),
        ...smsStats.map((r: any) => r.email),
      ]);
      const rows = Array.from(emailSet).map((email) => {
        const cs = callStats.find((r: any) => r.email === email);
        const ss = smsStats.find((r: any) => r.email === email);
        return {
          email,
          totalCalls: cs?.total_calls ?? 0,
          missedCalls: cs?.missed_calls ?? 0,
          totalMinutes: Math.round((cs?.total_seconds ?? 0) / 60),
          smsThreads: ss?.sms_threads ?? 0,
        };
      });

      res.json({ date, rows, teamDigest });
    } catch (err: any) {
      console.error("[zoomComms] team overview error:", err);
      res.status(500).json({ error: "Failed to fetch team comms overview" });
    }
  });

  // ── GET /api/manager/comms/recruiter ─────────────────────────────────────
  app.get("/api/manager/comms/recruiter", async (req: Request, res: Response) => {
    if (!requireManagerRole(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    const date = parseDate(req.query.date);
    const targetEmail = typeof req.query.email === "string" ? req.query.email : null;

    if (!targetEmail) return res.status(400).json({ error: "email query param required" });

    // Scope check: managers can only see direct reports
    if (role === "manager") {
      const allowedEmails = await getDirectReportEmails(userId);
      if (!allowedEmails.includes(targetEmail)) {
        return res.status(403).json({ error: "You can only view data for your direct reports" });
      }
    }

  // ── GET /api/admin/comms/sync-status ──────────────────────────────────────
  // Returns the most recent sync summary written by the sync engine, plus the
  // current zoom_sync_time_pst and zoom_sync_lookback_days settings.
  app.get(
    "/api/admin/comms/sync-status",
    requireAuth,
    requireSyncRole,
    async (_req: Request, res: Response) => {
      try {
        const summaryRow = await db.execute(sql`
          SELECT value FROM system_settings WHERE key = 'zoom_last_sync_summary' LIMIT 1
        `);
        const summaryRows = summaryRow?.rows ?? summaryRow ?? [];
        const raw = Array.isArray(summaryRows) ? summaryRows[0] : undefined;
        const summary = raw?.value
          ? (typeof raw.value === "string" ? JSON.parse(raw.value) : raw.value)
          : null;
        res.json({ summary });
      } catch (err: any) {
        console.error("[zoomComms] GET /sync-status error:", err);
        res.status(500).json({ error: "Failed to fetch sync status" });
      }
    },
  );

  // ── GET /api/admin/comms/sync-settings ────────────────────────────────────
  // Returns zoom_sync_time_pst (default "18:00") and zoom_sync_lookback_days (default 7).
  app.get(
    "/api/admin/comms/sync-settings",
    requireAuth,
    requireSyncRole,
    async (_req: Request, res: Response) => {
      try {
        const timeRow = await db.execute(sql`
          SELECT value FROM system_settings WHERE key = 'zoom_sync_time_pst' LIMIT 1
        `);
        const lookbackRow = await db.execute(sql`
          SELECT value FROM system_settings WHERE key = 'zoom_sync_lookback_days' LIMIT 1
        `);
        const timeRaw = (timeRow?.rows ?? timeRow ?? [])[0];
        const lookbackRaw = (lookbackRow?.rows ?? lookbackRow ?? [])[0];

        const syncTimePst = timeRaw?.value
          ? (typeof timeRaw.value === "string" ? timeRaw.value.replace(/^"|"$/g, "") : String(timeRaw.value))
          : "18:00";
        const lookbackDays = lookbackRaw?.value
          ? Number(typeof lookbackRaw.value === "string" ? lookbackRaw.value : lookbackRaw.value)
          : 7;

        res.json({ syncTimePst, lookbackDays });
      } catch (err: any) {
        console.error("[zoomComms] GET /sync-settings error:", err);
        res.status(500).json({ error: "Failed to fetch sync settings" });
      }
    },
  );

  // ── PUT /api/admin/comms/sync-settings ────────────────────────────────────
  // Persists zoom_sync_time_pst and/or zoom_sync_lookback_days to system_settings.
  app.put(
    "/api/admin/comms/sync-settings",
    requireAuth,
    requireSyncRole,
    async (req: Request, res: Response) => {
      try {
        const { syncTimePst, lookbackDays } = req.body ?? {};

        if (syncTimePst !== undefined) {
          const timeStr = String(syncTimePst).trim();
          if (!/^\d{2}:\d{2}$/.test(timeStr)) {
            return res.status(400).json({ error: "syncTimePst must be HH:MM format" });
          }
          await db.execute(sql`
            INSERT INTO system_settings (key, value)
            VALUES ('zoom_sync_time_pst', ${JSON.stringify(timeStr)}::jsonb)
            ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(timeStr)}::jsonb, updated_at = NOW()
          `);
        }

        if (lookbackDays !== undefined) {
          const days = parseInt(String(lookbackDays), 10);
          if (isNaN(days) || days < 1 || days > 30) {
            return res.status(400).json({ error: "lookbackDays must be 1–30" });
          }
          await db.execute(sql`
            INSERT INTO system_settings (key, value)
            VALUES ('zoom_sync_lookback_days', ${days}::jsonb)
            ON CONFLICT (key) DO UPDATE SET value = ${days}::jsonb, updated_at = NOW()
          `);
        }

        res.json({ ok: true });
      } catch (err: any) {
        console.error("[zoomComms] PUT /sync-settings error:", err);
        res.status(500).json({ error: "Failed to save sync settings" });
      }
    },
  );

  // ── POST /api/admin/comms/sync ─────────────────────────────────────────────
  // Trigger manual sync for a date range using zoom_sync_lookback_days.
  // Syncs from (date - lookbackDays + 1) to date inclusive so the configured
  // lookback window is honoured. Admin/HR/super_admin only.
  app.post(
    "/api/admin/comms/sync",
    requireAuth,
    requireSyncRole,
    async (req: Request, res: Response) => {
      const rawDate = req.body?.date;
      const toDate = validateDate(rawDate) ?? new Date().toISOString().slice(0, 10);

      try {
        const { syncAllUsersForDate } = await import("./zoomService");

        // Read lookback setting (default 7)
        const lookbackRow = await db.execute(sql`
          SELECT value FROM system_settings WHERE key = 'zoom_sync_lookback_days' LIMIT 1
        `);
        const lookbackRaw = (lookbackRow?.rows ?? lookbackRow ?? [])[0];
        const rawLookback = lookbackRaw?.value;
        const lookbackDays = rawLookback !== undefined && rawLookback !== null
          ? Math.max(1, Math.min(30, Number(rawLookback)))
          : 7;

        // Build list of dates to sync (oldest first)
        const datesToSync: string[] = [];
        for (let i = lookbackDays - 1; i >= 0; i--) {
          const d = new Date(toDate + "T12:00:00Z");
          d.setUTCDate(d.getUTCDate() - i);
          datesToSync.push(d.toISOString().slice(0, 10));
        }

        // Aggregate summaries across all dates
        const aggregate = {
          usersProcessed: 0,
          callsStored: 0,
          sessionsStored: 0,
          digestsGenerated: 0,
          errors: [] as string[],
        };

        for (const date of datesToSync) {
          try {
            const summary = await syncAllUsersForDate(date);
            aggregate.usersProcessed = Math.max(aggregate.usersProcessed, summary.usersProcessed);
            aggregate.callsStored += summary.callsStored;
            aggregate.sessionsStored += summary.sessionsStored;
            aggregate.digestsGenerated += summary.digestsGenerated;
            aggregate.errors.push(...summary.errors);
          } catch (err: any) {
            aggregate.errors.push(`date=${date}: ${err.message}`);
          }
        }

        res.json({ ok: true, dateRange: { from: datesToSync[0], to: toDate }, lookbackDays, summary: aggregate });
      } catch (err: any) {
        console.error("[zoomComms] POST /sync error:", err);
        res.status(500).json({ error: "Sync failed", detail: err.message });
      }
    },
  );

    try {
      // Call stats — metadata only, no raw numbers
      const callRows = (await db.execute(sql`
        SELECT direction, duration, result, start_time, end_time
        FROM zoom_call_logs
        WHERE email = ${targetEmail} AND synced_date = ${date}::date
        ORDER BY start_time ASC
      `)) as any;
      const calls = (Array.isArray(callRows?.rows) ? callRows.rows : callRows ?? []) as any[];
      const callStats = {
        total: calls.length,
        outbound: calls.filter((c: any) => c.direction === "outbound").length,
        inbound: calls.filter((c: any) => c.direction === "inbound").length,
        missed: calls.filter((c: any) => c.result === "missed").length,
        answered: calls.filter((c: any) => c.result === "answered").length,
        totalMinutes: Math.round(calls.reduce((s: number, c: any) => s + (parseInt(c.duration, 10) || 0), 0) / 60),
      };

      // SMS digests — sanitized only, never raw content
      const digestRows = (await db.execute(sql`
        SELECT sd.session_id, sd.sanitized_digest, sd.sanitized_at,
               ss.participant_number, ss.message_count
        FROM zoom_sms_digests sd
        JOIN zoom_sms_sessions ss ON ss.session_id = sd.session_id
        WHERE ss.email = ${targetEmail} AND sd.date = ${date}::date
        ORDER BY sd.sanitized_at DESC
        LIMIT 50
      `)) as any;
      const digests = (Array.isArray(digestRows?.rows) ? digestRows.rows : digestRows ?? []) as any[];

      // AI insights
      const insightRow = (await db.execute(sql`
        SELECT content, generated_at FROM zoom_ai_insights
        WHERE date = ${date}::date AND scope = 'user' AND scope_id = ${targetEmail}
        LIMIT 1
      `)) as any;
      const insightRows = Array.isArray(insightRow?.rows) ? insightRow.rows : insightRow ?? [];
      const aiInsight = insightRows[0] ?? null;

      res.json({
        date,
        email: targetEmail,
        callStats,
        smsDigests: digests.map((d: any) => ({
          sessionId: d.session_id,
          sanitizedDigest: d.sanitized_digest,
          messageCount: d.message_count,
          sanitizedAt: d.sanitized_at,
        })),
        aiInsight: aiInsight ? {
          content: aiInsight.content,
          generatedAt: aiInsight.generated_at,
        } : null,
      });
    } catch (err: any) {
      console.error("[zoomComms] recruiter detail error:", err);
      res.status(500).json({ error: "Failed to fetch recruiter comms data" });
    }
  });

  // ── GET /api/manager/comms/insights/history ──────────────────────────────
  app.get("/api/manager/comms/insights/history", async (req: Request, res: Response) => {
    if (!requireManagerRole(req, res)) return;
    const userId = req.session!.userId!;
    const role = req.session!.role as string;
    const targetEmail = typeof req.query.email === "string" ? req.query.email : null;
    const days = Math.min(parseInt(String(req.query.days ?? "30"), 10) || 30, 90);

    if (!targetEmail) return res.status(400).json({ error: "email query param required" });

    if (role === "manager") {
      const allowedEmails = await getDirectReportEmails(userId);
      if (!allowedEmails.includes(targetEmail)) {
        return res.status(403).json({ error: "You can only view data for your direct reports" });
      }
    }

    try {
      const rows = (await db.execute(sql`
        SELECT date, content, generated_at
        FROM zoom_ai_insights
        WHERE scope = 'user' AND scope_id = ${targetEmail}
          AND date >= (CURRENT_DATE - INTERVAL '${sql.raw(String(days))} days')
        ORDER BY date DESC
        LIMIT 90
      `)) as any;
      const insights = (Array.isArray(rows?.rows) ? rows.rows : rows ?? []) as any[];

      res.json({ email: targetEmail, days, insights });
    } catch (err: any) {
      console.error("[zoomComms] insights history error:", err);
      res.status(500).json({ error: "Failed to fetch insights history" });
    }
  });

  // ── POST /api/admin/comms/sync — manual trigger ──────────────────────────
  app.post("/api/admin/comms/sync", async (req: Request, res: Response) => {
    if (!requireAdminRole(req, res)) return;

    try {
      const { isZoomConfigured, syncAllUsersForDate } = await import("./zoomService");
      if (!isZoomConfigured()) {
        return res.status(400).json({ error: "Zoom is not configured. Connect Zoom in Integrations first." });
      }

      const date = parseDate(req.body?.date);
      res.json({ message: `Zoom comms sync started for ${date}`, date });

      setImmediate(async () => {
        try {
          const { db: drizzleDb } = await import("./db");
          const { sql: drizzleSql } = await import("drizzle-orm");
          await syncAllUsersForDate(date, drizzleDb, drizzleSql, true);
        } catch (err) {
          console.error("[zoomComms] manual sync error:", err);
        }
      });
    } catch (err: any) {
      console.error("[zoomComms] sync trigger error:", err);
      res.status(500).json({ error: "Failed to start sync" });
    }
  });

  // ── GET /api/admin/comms/sync/status ────────────────────────────────────
  app.get("/api/admin/comms/sync/status", async (req: Request, res: Response) => {
    if (!requireAdminRole(req, res)) return;
    try {
      const rows = (await db.execute(sql`
        SELECT last_synced_at, last_synced_date, synced_user_count, status, error_message, updated_at
        FROM zoom_sync_meta WHERE id = 'singleton'
      `)) as any;
      const row = (Array.isArray(rows?.rows) ? rows.rows : rows ?? [])[0] ?? null;
      res.json(row ?? { status: "never_run" });
    } catch (err: any) {
      console.error("[zoomComms] sync status error:", err);
      res.status(500).json({ error: "Failed to fetch sync status" });
    }
  });
}
