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

export async function testZoomConnection(): Promise<{ ok: boolean; scopes?: string; error?: string }> {
  try {
    const token = await getZoomToken();
    const res = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { ok: false, error: `Zoom API returned ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, scopes: data.account_id ? "account_credentials" : undefined };
  } catch (err: any) {
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

// ── Daily sync engine ─────────────────────────────────────────────────────────

export interface SyncSummary {
  usersProcessed: number;
  callsStored: number;
  sessionsStored: number;
  digestsGenerated: number;
  errors: string[];
}

/**
 * Fetch all messages for a single SMS session from the Zoom Phone API.
 * Returns [] on any error so the caller can continue with other sessions.
 */
async function getZoomSmsMessages(
  zoomUserId: string,
  zoomSessionId: string,
): Promise<any[]> {
  try {
    const token = await getZoomToken();
    const res = await fetch(
      `https://api.zoom.us/v2/phone/users/${encodeURIComponent(zoomUserId)}/sms_sessions/${encodeURIComponent(zoomSessionId)}/messages?page_size=300`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.messages) ? data.messages : [];
  } catch {
    return [];
  }
}

/**
 * Sync call logs and SMS sessions for a single matched user on a given date.
 *
 * @param adminUserId   Internal admin_users.id (used as FK in zoom tables)
 * @param zoomUserId    Zoom's user ID (used in Zoom API paths)
 * @param date          YYYY-MM-DD string for the sync window
 * @returns             Counts of rows upserted
 */
export async function syncDailyLogsForUser(
  adminUserId: string,
  zoomUserId: string,
  date: string,
): Promise<{ callsStored: number; sessionsStored: number }> {
  const { db } = await import("./db");
  const { sql } = await import("drizzle-orm");

  const dateRange: DateRange = { from: date, to: date };
  let callsStored = 0;
  let sessionsStored = 0;

  // ── Call logs ──────────────────────────────────────────────────────────────
  const callLogs = await getZoomCallLogs(zoomUserId, dateRange);
  for (const log of callLogs) {
    try {
      await db.execute(sql`
        INSERT INTO zoom_call_logs
          (zoom_call_id, user_id, zoom_user_id, direction, duration,
           caller_number, callee_number, start_time, end_time, status, raw_data, created_at)
        VALUES (
          ${log.id ?? null},
          ${adminUserId},
          ${zoomUserId},
          ${log.direction ?? null},
          ${log.duration ?? null},
          ${log.caller_number ?? log.from ?? null},
          ${log.callee_number ?? log.to ?? null},
          ${log.date_time ? new Date(log.date_time) : null},
          ${log.end_time ? new Date(log.end_time) : null},
          ${log.result ?? log.status ?? null},
          ${JSON.stringify(log)}::jsonb,
          NOW()
        )
        ON CONFLICT (zoom_call_id) DO UPDATE
          SET duration      = EXCLUDED.duration,
              status        = EXCLUDED.status,
              raw_data      = EXCLUDED.raw_data
      `);
      callsStored++;
    } catch (err) {
      console.warn(`[zoomService] syncDailyLogsForUser — call log upsert failed (id=${log.id}):`, err);
    }
  }

  // ── SMS sessions + messages ────────────────────────────────────────────────
  const smsSessions = await getZoomSmsLogs(zoomUserId, dateRange);
  for (const session of smsSessions) {
    const zoomSessionId: string = session.session_id ?? session.id ?? "";
    if (!zoomSessionId) continue;

    // Upsert the session row
    let internalSessionId: string | null = null;
    try {
      const result = await db.execute(sql`
        INSERT INTO zoom_sms_sessions
          (zoom_session_id, user_id, zoom_user_id, peer_number,
           session_start, session_end, message_count, created_at, updated_at)
        VALUES (
          ${zoomSessionId},
          ${adminUserId},
          ${zoomUserId},
          ${session.peer_number ?? null},
          ${session.date_time ? new Date(session.date_time) : null},
          ${session.last_message_time ? new Date(session.last_message_time) : null},
          ${session.total_messages ?? 0},
          NOW(), NOW()
        )
        ON CONFLICT (zoom_session_id) DO UPDATE
          SET message_count = EXCLUDED.message_count,
              session_end   = EXCLUDED.session_end,
              updated_at    = NOW()
        RETURNING id
      `);
      const rows = result?.rows ?? result ?? [];
      internalSessionId = (Array.isArray(rows) && rows[0]?.id) ? rows[0].id as string : null;
      sessionsStored++;
    } catch (err) {
      console.warn(`[zoomService] syncDailyLogsForUser — session upsert failed (zoom_session_id=${zoomSessionId}):`, err);
      continue;
    }

    if (!internalSessionId) {
      // Fetch existing id by zoom_session_id
      try {
        const lookupResult = await db.execute(sql`
          SELECT id FROM zoom_sms_sessions WHERE zoom_session_id = ${zoomSessionId} LIMIT 1
        `);
        const lookupRows = lookupResult?.rows ?? lookupResult ?? [];
        internalSessionId = (Array.isArray(lookupRows) && lookupRows[0]?.id)
          ? lookupRows[0].id as string
          : null;
      } catch {
        continue;
      }
    }

    if (!internalSessionId) continue;

    // Fetch and upsert messages for this session
    const messages = await getZoomSmsMessages(zoomUserId, zoomSessionId);
    for (const msg of messages) {
      try {
        await db.execute(sql`
          INSERT INTO zoom_sms_messages
            (session_id, zoom_message_id, body, direction, sent_at, created_at)
          VALUES (
            ${internalSessionId},
            ${msg.id ?? null},
            ${msg.message ?? msg.body ?? null},
            ${msg.direction ?? null},
            ${msg.date_time ? new Date(msg.date_time) : null},
            NOW()
          )
          ON CONFLICT (zoom_message_id) DO UPDATE
            SET body      = EXCLUDED.body,
                direction = EXCLUDED.direction,
                sent_at   = EXCLUDED.sent_at
        `);
      } catch (err) {
        console.warn(`[zoomService] syncDailyLogsForUser — message upsert failed (msg.id=${msg.id}):`, err);
      }
    }
  }

  return { callsStored, sessionsStored };
}

/**
 * Sync all active Zoom users against admin_users for the given date,
 * then run the sanitizer+digest pipeline for any SMS session without a digest.
 *
 * Returns a summary object suitable for logging.
 */
export async function syncAllUsersForDate(date: string): Promise<SyncSummary> {
  const { db } = await import("./db");
  const { sql } = await import("drizzle-orm");
  const { generateDigest } = await import("./zoomSanitizer");

  const summary: SyncSummary = {
    usersProcessed: 0,
    callsStored: 0,
    sessionsStored: 0,
    digestsGenerated: 0,
    errors: [],
  };

  console.log(`[zoomService] syncAllUsersForDate — starting sync for date=${date}`);

  // Fetch all active Zoom users
  const zoomUsers = await getZoomUsers();
  if (zoomUsers.length === 0) {
    console.warn("[zoomService] syncAllUsersForDate — no Zoom users returned (credentials may not be set)");
    return summary;
  }

  // Build email → Zoom user map
  const zoomByEmail = new Map<string, { id: string; email: string }>();
  for (const zu of zoomUsers) {
    if (zu.email) zoomByEmail.set(zu.email.toLowerCase(), zu);
  }

  // Fetch matching admin_users by email
  let adminRows: Array<{ id: string; email: string }> = [];
  try {
    const result = await db.execute(sql`
      SELECT id, email
      FROM admin_users
      WHERE is_active = true
        AND deleted_at IS NULL
        AND employment_status = 'active'
    `);
    adminRows = (result?.rows ?? result ?? []) as Array<{ id: string; email: string }>;
  } catch (err) {
    summary.errors.push(`admin_users query failed: ${String(err)}`);
    return summary;
  }

  // Process each matched user
  for (const adminUser of adminRows) {
    const lowerEmail = adminUser.email?.toLowerCase();
    const zoomUser = lowerEmail ? zoomByEmail.get(lowerEmail) : undefined;
    if (!zoomUser) continue; // No Zoom account for this admin user — skip silently

    try {
      const { callsStored, sessionsStored } = await syncDailyLogsForUser(
        adminUser.id,
        zoomUser.id,
        date,
      );
      summary.callsStored += callsStored;
      summary.sessionsStored += sessionsStored;
      summary.usersProcessed++;
    } catch (err) {
      const msg = `Failed sync for user ${adminUser.email}: ${String(err)}`;
      console.error(`[zoomService] ${msg}`);
      summary.errors.push(msg);
    }
  }

  // Warn about Zoom users that have no matching admin_users record
  for (const [email] of zoomByEmail) {
    if (!adminRows.some((u) => u.email?.toLowerCase() === email)) {
      console.warn(`[zoomService] syncAllUsersForDate — Zoom user not mapped to admin_users: ${email}`);
    }
  }

  // ── Sanitize + digest any sessions that don't yet have a digest for this date ──
  let sessionsNeedingDigest: Array<{ id: string }> = [];
  try {
    const result = await db.execute(sql`
      SELECT s.id
      FROM zoom_sms_sessions s
      WHERE NOT EXISTS (
        SELECT 1 FROM zoom_sms_digests d
        WHERE d.session_id = s.id AND d.date = ${date}
      )
      AND s.session_start::date = ${date}::date
    `);
    sessionsNeedingDigest = (result?.rows ?? result ?? []) as Array<{ id: string }>;
  } catch (err) {
    console.warn("[zoomService] syncAllUsersForDate — digest candidate query failed:", err);
  }

  for (const session of sessionsNeedingDigest) {
    try {
      // Fetch raw messages for this session
      const msgResult = await db.execute(sql`
        SELECT body, direction FROM zoom_sms_messages
        WHERE session_id = ${session.id}
        ORDER BY sent_at ASC
      `);
      const rawMessages = ((msgResult?.rows ?? msgResult ?? []) as Array<{ body: string | null; direction: string | null }>)
        .map((r) => ({ body: r.body ?? "", direction: r.direction ?? "outbound" }));

      if (rawMessages.length === 0) continue;

      await generateDigest(rawMessages, session.id, date);
      summary.digestsGenerated++;
    } catch (err) {
      console.warn(`[zoomService] syncAllUsersForDate — digest failed for session ${session.id}:`, err);
    }
  }

  console.log(
    `[zoomService] syncAllUsersForDate complete — date=${date} users=${summary.usersProcessed} calls=${summary.callsStored} sessions=${summary.sessionsStored} digests=${summary.digestsGenerated} errors=${summary.errors.length}`,
  );

  return summary;
}

/**
 * Manual trigger wrapper — exported for use by the admin API route (built in the API layer task).
 * Defaults to today's date in UTC if no date is provided.
 */
export async function triggerManualSync(date?: string): Promise<SyncSummary> {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  return syncAllUsersForDate(targetDate);
}
