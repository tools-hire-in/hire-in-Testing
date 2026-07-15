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
