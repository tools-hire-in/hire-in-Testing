/**
 * Zoom Server-to-Server OAuth service.
 * Uses Account ID + Client ID + Client Secret to obtain a token (no user login required).
 * Token is cached in-memory with a 55-minute TTL.
 *
 * Credential loading priority:
 *   1. In-memory creds set via setZoomCredentials() (populated from DB on startup or after connect)
 *   2. Environment variables ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET (dev fallback)
 */

let zoomToken: string | null = null;
let zoomTokenExpiresAt: number = 0;

let _accountId: string | null = null;
let _clientId: string | null = null;
let _clientSecret: string | null = null;

export interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

/** Explicitly set in-memory credentials (call after loading from DB or after a new connect). */
export function setZoomCredentials(creds: ZoomCredentials): void {
  _accountId = creds.accountId;
  _clientId = creds.clientId;
  _clientSecret = creds.clientSecret;
  zoomToken = null;
  zoomTokenExpiresAt = 0;
}

function getZoomCredentials(): ZoomCredentials | null {
  const accountId = _accountId || process.env.ZOOM_ACCOUNT_ID;
  const clientId = _clientId || process.env.ZOOM_CLIENT_ID;
  const clientSecret = _clientSecret || process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) return null;
  return { accountId, clientId, clientSecret };
}

/**
 * Load Zoom credentials from system_settings (key: zoom_integration).
 * Supports both encrypted (accountIdEnc/clientIdEnc/clientSecretEnc) and
 * legacy plaintext (accountId/clientId/clientSecret) shapes.
 * Call once during server startup so credentials survive restarts.
 */
export async function loadZoomCredentialsFromDb(db: any): Promise<void> {
  try {
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(
      sql`SELECT value FROM system_settings WHERE key = 'zoom_integration' LIMIT 1`
    );
    const rows = result?.rows ?? result ?? [];
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return;
    const val = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    if (!val) return;

    let accountId: string;
    let clientId: string;
    let clientSecret: string;

    if (val.accountIdEnc && val.clientIdEnc && val.clientSecretEnc) {
      // Encrypted shape — decrypt each field
      const { decryptVaultField } = await import("./utils/vaultCrypto");
      function tryDec(enc: string): string {
        if (!enc) return "";
        if (enc.startsWith("plain:")) return enc.slice("plain:".length);
        try { return decryptVaultField(enc); } catch { return enc; }
      }
      accountId = tryDec(val.accountIdEnc);
      clientId = tryDec(val.clientIdEnc);
      clientSecret = tryDec(val.clientSecretEnc);
    } else if (val.accountId && val.clientId && val.clientSecret) {
      // Legacy plaintext shape
      accountId = val.accountId;
      clientId = val.clientId;
      clientSecret = val.clientSecret;
    } else {
      return;
    }

    if (accountId && clientId && clientSecret) {
      setZoomCredentials({ accountId, clientId, clientSecret });
      console.log("[zoomService] Zoom credentials loaded from DB");
    }
  } catch (err) {
    console.warn("[zoomService] Could not load credentials from DB:", err);
  }
}

async function getZoomToken(): Promise<string> {
  const now = Date.now();
  if (zoomToken && now < zoomTokenExpiresAt) return zoomToken;

  const creds = getZoomCredentials();
  if (!creds) throw new Error("Zoom credentials not configured");

  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(creds.accountId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom OAuth failed: ${res.status} — ${err}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token in Zoom response");

  zoomToken = data.access_token;
  const expiresIn = (data.expires_in ?? 3600) - 300;
  zoomTokenExpiresAt = now + expiresIn * 1000;
  return zoomToken!;
}

export async function testZoomConnection(): Promise<{
  ok: boolean;
  scopes?: string;
  error?: string;
  statusCode?: number;
  errorCode?: number | string;
  message?: string;
}> {
  try {
    const token = await getZoomToken();
    const res = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      let errorCode: number | string | undefined;
      let message: string | undefined;
      let detail = `Zoom API returned ${res.status}`;
      try {
        const body = await res.json();
        errorCode = body.code;
        message = body.message;
        if (body?.message) detail = `Zoom API ${res.status}: ${body.message}`;
        if (body?.code) errorCode = String(body.code);
      } catch {
        message = await res.text().catch(() => undefined);
      }
      return {
        ok: false,
        statusCode: res.status,
        errorCode,
        message,
        error: message || detail
          ? (message ? `Zoom API ${res.status}: ${message}` : detail)
          : `Zoom API returned ${res.status}`,
      };
    }
    const data = await res.json();
    return { ok: true, scopes: data.account_id ? "account_credentials" : undefined };
  } catch (err: any) {
    const oauthMatch = err.message?.match(/Zoom OAuth failed: (\d+) — (.*)/);
    if (oauthMatch) {
      return {
        ok: false,
        statusCode: parseInt(oauthMatch[1], 10),
        message: oauthMatch[2],
        error: err.message,
      };
    }
    return { ok: false, error: err.message };
  }
}

export interface DateRange {
  from: string;
  to: string;
}

export async function getZoomCallLogs(userId: string, dateRange: DateRange): Promise<any[]> {
  try {
    const token = await getZoomToken();
    const res = await fetch(
      `https://api.zoom.us/v2/phone/users/${encodeURIComponent(userId)}/call_logs?from=${dateRange.from}&to=${dateRange.to}&page_size=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.call_logs) ? data.call_logs : [];
  } catch {
    return [];
  }
}

export async function getZoomSmsLogs(userId: string, dateRange: DateRange): Promise<any[]> {
  try {
    const token = await getZoomToken();
    const res = await fetch(
      `https://api.zoom.us/v2/phone/users/${encodeURIComponent(userId)}/sms_sessions?from=${dateRange.from}&to=${dateRange.to}&page_size=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.sms_sessions) ? data.sms_sessions : [];
  } catch {
    return [];
  }
}

export async function getZoomMeetings(userId: string, dateRange: DateRange): Promise<any[]> {
  try {
    const token = await getZoomToken();
    const res = await fetch(
      `https://api.zoom.us/v2/metrics/meetings?type=past&from=${dateRange.from}&to=${dateRange.to}&page_size=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const meetings = Array.isArray(data?.meetings) ? data.meetings : [];
    return meetings.filter((m: any) => m.host_id === userId || m.email === userId);
  } catch {
    return [];
  }
}

/** Fetch a list of active Zoom account users (up to 300). Returns [] on any error. */
export async function getZoomUsers(): Promise<Array<{ id: string; email: string; first_name?: string; last_name?: string }>> {
  try {
    const token = await getZoomToken();
    const res = await fetch(
      `https://api.zoom.us/v2/users?status=active&page_size=300`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.users) ? data.users : [];
  } catch {
    return [];
  }
}

export function isZoomConfigured(): boolean {
  return getZoomCredentials() !== null;
}

export function clearZoomTokenCache(): void {
  zoomToken = null;
  zoomTokenExpiresAt = 0;
}

// ── Daily sync functions ──────────────────────────────────────────────────────

/**
 * Fetch SMS messages for a specific session.
 * Returns [] gracefully if the endpoint is unavailable.
 */
async function getZoomSmsMessages(userId: string, sessionId: string): Promise<any[]> {
  try {
    const token = await getZoomToken();
    const res = await fetch(
      `https://api.zoom.us/v2/phone/users/${encodeURIComponent(userId)}/sms_sessions/${encodeURIComponent(sessionId)}/messages?page_size=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.messages) ? data.messages : [];
  } catch {
    return [];
  }
}

/**
 * Sync one user's call logs and SMS sessions for a given date.
 * Upserts raw records idempotently then generates sanitized digests.
 */
export async function syncDailyLogsForUser(
  userId: string,
  email: string,
  date: string,
  db: any,
  sql: any,
  knownNames: string[] = [],
): Promise<{ callsUpserted: number; sessionsUpserted: number }> {
  let callsUpserted = 0;
  let sessionsUpserted = 0;

  const dateRange: DateRange = { from: date, to: date };

  // ── Call logs ──────────────────────────────────────────────────────────────
  try {
    const callLogs = await getZoomCallLogs(userId, dateRange);
    for (const log of callLogs) {
      if (!log.id) continue;
      await db.execute(sql`
        INSERT INTO zoom_call_logs
          (user_id, email, call_id, direction, duration, caller_number, callee_number, result, start_time, end_time, synced_date)
        VALUES
          (${userId}, ${email}, ${String(log.id)}, ${log.direction || "outbound"},
           ${log.duration ?? 0}, ${log.caller_number || null}, ${log.callee_number || null},
           ${log.result || "answered"},
           ${log.date_time ? new Date(log.date_time).toISOString() : null},
           ${log.end_time ? new Date(log.end_time).toISOString() : null},
           ${date}::date)
        ON CONFLICT (call_id, synced_date) DO UPDATE
          SET duration = EXCLUDED.duration,
              result = EXCLUDED.result
      `);
      callsUpserted++;
    }
  } catch (err) {
    console.warn(\`[zoomService] call log sync failed for \${email}:\`, err);
  }

  // ── SMS sessions ───────────────────────────────────────────────────────────
  try {
    const { sanitizeThread, generateDigest } = await import("./zoomSanitizer");
    const smsSessions = await getZoomSmsLogs(userId, dateRange);

    for (const session of smsSessions) {
      if (!session.session_id) continue;

      // Upsert the session record
      await db.execute(sql`
        INSERT INTO zoom_sms_sessions
          (user_id, email, session_id, participant_number, message_count, last_message_at, synced_date)
        VALUES
          (${userId}, ${email}, ${String(session.session_id)}, ${session.peer_number || session.participant_number || null},
           ${session.message_count ?? 0},
           ${session.last_message_date ? new Date(session.last_message_date).toISOString() : null},
           ${date}::date)
        ON CONFLICT (session_id, synced_date) DO UPDATE
          SET message_count = EXCLUDED.message_count,
              last_message_at = EXCLUDED.last_message_at
      `);
      sessionsUpserted++;

      // Fetch raw messages and store them
      const rawMessages = await getZoomSmsMessages(userId, session.session_id);
      for (const msg of rawMessages) {
        try {
          await db.execute(sql`
            INSERT INTO zoom_sms_messages (session_id, direction, body, sent_at)
            VALUES (${String(session.session_id)}, ${msg.direction || "outbound"}, ${msg.message || msg.body || null},
                   ${msg.date_time ? new Date(msg.date_time).toISOString() : null})
          `);
        } catch { /* dedupe is not strictly needed for messages */ }
      }

      // Sanitize and generate digest
      const msgs = rawMessages.map((m: any) => ({
        direction: (m.direction || "outbound") as "inbound" | "outbound",
        body: m.message || m.body || "",
        sentAt: m.date_time || null,
      }));
      const sanitized = sanitizeThread(msgs, knownNames);
      await generateDigest(sanitized, String(session.session_id), date, db, sql);
    }
  } catch (err) {
    console.warn(\`[zoomService] SMS sync failed for \${email}:\`, err);
  }

  return { callsUpserted, sessionsUpserted };
}

/**
 * Sync all active Zoom users for a given date.
 * After sync and digests, triggers the AI insights pass.
 */
export async function syncAllUsersForDate(
  date: string,
  db: any,
  sql: any,
  runAi: boolean = true,
): Promise<{ usersProcessed: number; totalCalls: number; totalSessions: number }> {
  console.log(\`[zoomService] Starting daily sync for \${date}\`);

  // Update sync meta to 'running'
  await db.execute(sql`
    UPDATE zoom_sync_meta SET status = 'running', updated_at = NOW() WHERE id = 'singleton'
  `).catch(() => {});

  let usersProcessed = 0;
  let totalCalls = 0;
  let totalSessions = 0;

  try {
    const zoomUsers = await getZoomUsers();

    // Fetch known team member names for PII substitution
    const { storage } = await import("./storage");
    let knownNames: string[] = [];
    try {
      const { db: drizzleDb, adminUsers } = await import("./db").then(async (m) => {
        const schema = await import("@shared/schema");
        return { db: m.db, adminUsers: schema.adminUsers };
      });
      const users = await drizzleDb.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName }).from(adminUsers);
      knownNames = users.flatMap((u: any) => [u.firstName, u.lastName].filter(Boolean));
    } catch { /* non-fatal */ }

    for (const zUser of zoomUsers) {
      if (!zUser.id || !zUser.email) continue;
      try {
        const { callsUpserted, sessionsUpserted } = await syncDailyLogsForUser(
          zUser.id,
          zUser.email,
          date,
          db,
          sql,
          knownNames,
        );
        usersProcessed++;
        totalCalls += callsUpserted;
        totalSessions += sessionsUpserted;
        console.log(\`[zoomService] Synced \${zUser.email}: \${callsUpserted} calls, \${sessionsUpserted} SMS sessions\`);
      } catch (err) {
        console.warn(\`[zoomService] Sync failed for \${zUser.email}:\`, err);
      }
    }

    // Update sync meta to 'idle' with success
    await db.execute(sql`
      UPDATE zoom_sync_meta
      SET status = 'idle', last_synced_at = NOW(), last_synced_date = \${date}::date,
          synced_user_count = \${usersProcessed}, error_message = NULL, updated_at = NOW()
      WHERE id = 'singleton'
    `).catch(() => {});

    console.log(\`[zoomService] Sync complete: \${usersProcessed} users, \${totalCalls} calls, \${totalSessions} sessions\`);

    // Trigger AI insights pass
    if (runAi) {
      setImmediate(async () => {
        try {
          await runAiInsightsForDate(date, zoomUsers, db, sql);
        } catch (err) {
          console.warn("[zoomService] AI insights pass failed:", err);
        }
      });
    }
  } catch (err: any) {
    console.error("[zoomService] syncAllUsersForDate fatal error:", err);
    await db.execute(sql`
      UPDATE zoom_sync_meta
      SET status = 'error', error_message = \${String(err?.message ?? err)}, updated_at = NOW()
      WHERE id = 'singleton'
    `).catch(() => {});
  }

  return { usersProcessed, totalCalls, totalSessions };
}

/**
 * Run the AI insights pass for all recruiters for a given date.
 */
export async function runAiInsightsForDate(
  date: string,
  zoomUsers: Array<{ id: string; email: string }>,
  db: any,
  sql: any,
): Promise<void> {
  const { generateRecruiterInsight, generateTeamDigest, upsertInsight } = await import("./zoomInsightsService");

  const recruiterSummaries: Array<{ email: string; insight: any }> = [];

  for (const zUser of zoomUsers) {
    if (!zUser.email) continue;
    try {
      // Build call stats
      const callRows = (await db.execute(sql`
        SELECT direction, duration, result FROM zoom_call_logs
        WHERE email = \${zUser.email} AND synced_date = \${date}::date
      `)) as any;
      const calls = Array.isArray(callRows?.rows) ? callRows.rows : callRows ?? [];
      const callStats = {
        total: calls.length,
        outbound: calls.filter((c: any) => c.direction === "outbound").length,
        inbound: calls.filter((c: any) => c.direction === "inbound").length,
        missed: calls.filter((c: any) => c.result === "missed").length,
        answered: calls.filter((c: any) => c.result === "answered").length,
        totalDurationSeconds: calls.reduce((s: number, c: any) => s + (parseInt(c.duration, 10) || 0), 0),
      };

      // Fetch digests for today
      const digestRows = (await db.execute(sql`
        SELECT sd.sanitized_digest FROM zoom_sms_digests sd
        JOIN zoom_sms_sessions ss ON ss.session_id = sd.session_id
        WHERE ss.email = \${zUser.email} AND sd.date = \${date}::date
        LIMIT 20
      `)) as any;
      const digests = (Array.isArray(digestRows?.rows) ? digestRows.rows : digestRows ?? [])
        .map((r: any) => r.sanitized_digest)
        .filter(Boolean);

      // Rolling 30-day pattern: count calls and sessions over last 30 days
      const rollingRows = (await db.execute(sql`
        SELECT COUNT(*) as call_count,
               AVG(duration)::int as avg_duration,
               SUM(CASE WHEN result = 'missed' THEN 1 ELSE 0 END) as missed_count
        FROM zoom_call_logs
        WHERE email = \${zUser.email}
          AND synced_date >= (\${date}::date - INTERVAL '30 days')
      `)) as any;
      const rolling = (Array.isArray(rollingRows?.rows) ? rollingRows.rows : rollingRows ?? [])[0];
      const rollingPatternSummary = rolling
        ? \`30-day: \${rolling.call_count} total calls, avg \${rolling.avg_duration}s duration, \${rolling.missed_count} missed.\`
        : "No rolling history yet.";

      const insight = await generateRecruiterInsight({
        email: zUser.email,
        date,
        callStats,
        smsDigests: digests,
        stageChangesToday: [],
        rollingPatternSummary,
      });

      if (insight) {
        await upsertInsight(date, "user", zUser.email, insight, db, sql);
      }
      recruiterSummaries.push({ email: zUser.email, insight });
    } catch (err) {
      console.warn(\`[zoomService] AI insights failed for \${zUser.email}:\`, err);
      recruiterSummaries.push({ email: zUser.email, insight: null });
    }
  }

  // Team digest
  try {
    const teamDigest = await generateTeamDigest(date, recruiterSummaries);
    if (teamDigest) {
      await upsertInsight(date, "team", "team", { teamDigest }, db, sql);
    }
  } catch (err) {
    console.warn("[zoomService] Team digest failed:", err);
  }

  console.log(
    `[zoomService] syncAllUsersForDate complete — date=${date} users=${summary.usersProcessed} calls=${summary.callsStored} sessions=${summary.sessionsStored} digests=${summary.digestsGenerated} errors=${summary.errors.length}`,
  );

  // ── Write last-sync summary to system_settings ────────────────────────────
  // This allows the admin sync-status endpoint to surface the last run's results
  // without an expensive DB aggregation query.
  try {
    const syncSummary = {
      ranAt: new Date().toISOString(),
      usersProcessed: summary.usersProcessed,
      callsStored: summary.callsStored,
      sessionsStored: summary.sessionsStored,
      digestsGenerated: summary.digestsGenerated,
      errors: summary.errors.slice(0, 10), // cap to avoid giant JSON
    };
    await db.execute(sql`
      INSERT INTO system_settings (key, value)
      VALUES ('zoom_last_sync_summary', ${JSON.stringify(syncSummary)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(syncSummary)}::jsonb, updated_at = NOW()
    `);
  } catch (err) {
    console.warn("[zoomService] syncAllUsersForDate — failed to write zoom_last_sync_summary:", err);
  }

  return summary;
}

/**
 * Manual trigger wrapper — exported for use by the admin API route (built in the API layer task).
 * Defaults to today's date in UTC if no date is provided.
 */
export async function triggerManualSync(date?: string): Promise<SyncSummary> {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  return syncAllUsersForDate(targetDate);
