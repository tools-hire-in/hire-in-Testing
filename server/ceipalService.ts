import { db } from "./db";
import { jobs, applications, adminUsers } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  isZoomConfigured,
  getZoomUsers,
  getZoomCallLogs,
  getZoomSmsLogs,
  getZoomMeetings,
} from "./zoomService";

const CEIPAL_AUTH_URL_V1 = "https://api.ceipal.com/v1/createAuthtoken";
const CEIPAL_AUTH_URL_V2 = "https://api.ceipal.com/v2/createAuthtoken";
const CEIPAL_REFRESH_URL = "https://api.ceipal.com/v1/refreshToken/";

let activeAuthUrl = CEIPAL_AUTH_URL_V1;

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;
let lastAuthAt: number = 0;
let isSyncing = false;
let v2CompatChecked = false;

/** Return health metadata for the Ceipal token cache — used by the status route. */
export function getCeipalTokenHealth(): {
  lastAuthAt: string | null;
  tokenExpiresAt: string | null;
  tokenValid: boolean;
} {
  const now = Date.now();
  return {
    lastAuthAt: lastAuthAt ? new Date(lastAuthAt).toISOString() : null,
    tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
    tokenValid: !!(cachedToken && now < tokenExpiresAt),
  };
}

function parseTokenResponse(text: string): { access_token?: string; refresh_token?: string } {
  try {
    return JSON.parse(text);
  } catch {
    console.warn("[ceipal] Auth response is not valid JSON — Ceipal API is expected to return JSON");
    return {};
  }
}

/** Exported thin wrapper so other modules can reuse the cached token. */
export async function getCeipalToken(): Promise<string> {
  return authenticate();
}

/**
 * Make a fetch call with automatic token-retry on 401.
 * On a 401 response the cached token is cleared, a fresh token is requested,
 * and the call is retried exactly once.  Exported so compliance and other
 * modules can share the same behaviour without duplicating token logic.
 */
export async function fetchWithTokenRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await authenticate();
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    console.log(`[ceipal] 401 on ${url} — force-refreshing token and retrying`);
    const freshToken = await authenticate(true);
    const retryHeaders: Record<string, string> = {
      "Authorization": `Bearer ${freshToken}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };
    return fetch(url, { ...options, headers: retryHeaders });
  }
  return res;
}

/** One-time v2 endpoint compatibility check (runs async, never throws).
 *  If v1 tokens are rejected by a v2 endpoint, switches activeAuthUrl to
 *  the v2 auth URL and invalidates the cached token so the next call
 *  re-authenticates via the v2 endpoint automatically.
 */
async function checkV2Compat(token: string): Promise<void> {
  try {
    const res = await fetch("https://api.ceipal.com/v2/getUsers/?page=1&page_size=1", {
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (res.status === 401) {
      console.warn("[ceipal] v2 compat check: v1 tokens are NOT valid for v2 endpoints — switching auth URL to v2 and re-authenticating");
      activeAuthUrl = CEIPAL_AUTH_URL_V2;
      cachedToken = null;
      tokenExpiresAt = 0;
    } else {
      console.log(`[ceipal] v2 compat check: status ${res.status} — v1 tokens are compatible with v2 endpoints`);
    }
  } catch (err: any) {
    console.warn("[ceipal] v2 compat check failed (network):", err.message);
  }
}

async function authenticate(forceRefresh = false): Promise<string> {
  const now = Date.now();

  if (forceRefresh) {
    cachedToken = null;
    tokenExpiresAt = 0;
  }

  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  if (cachedToken) {
    try {
      const refreshRes = await fetch(CEIPAL_REFRESH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Token": `Bearer ${cachedToken}`,
        },
      });
      if (refreshRes.ok) {
        const parsed = parseTokenResponse(await refreshRes.text());
        if (parsed.access_token) {
          cachedToken = parsed.access_token;
          tokenExpiresAt = now + 50 * 60 * 1000;
          lastAuthAt = now;
          return cachedToken;
        }
      }
    } catch (err) {
      console.log("Ceipal token refresh failed, performing full re-auth...");
    }
  }

  const email = process.env.CEIPAL_EMAIL;
  const password = process.env.CEIPAL_PASSWORD;
  const apiKey = process.env.CEIPAL_API_KEY;

  if (!email || !password || !apiKey) {
    throw new Error("Ceipal API credentials not configured");
  }

  const res = await fetch(activeAuthUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, api_key: apiKey }),
  });

  if (!res.ok) {
    throw new Error(`Ceipal authentication failed: ${res.status}`);
  }

  const parsed = parseTokenResponse(await res.text());

  if (!parsed.access_token) {
    throw new Error("Failed to parse Ceipal auth token");
  }

  cachedToken = parsed.access_token;
  tokenExpiresAt = now + 50 * 60 * 1000;
  lastAuthAt = now;

  if (!v2CompatChecked) {
    v2CompatChecked = true;
    checkV2Compat(cachedToken).catch(() => {});
  }

  return cachedToken;
}

export interface CeipalUser {
  id: string;
  email_id: string;
  display_name: string;
  team_name: string;
  business_unit_id: string;
  role: string;
  status: string;
  reporting_to: string;
}

export type CeipalUserMap = Map<string, CeipalUser>;

// ── Cached Ceipal user list (refreshed at most once per 30 min) ─────────────
let cachedCeipalUsers: CeipalUser[] | null = null;
let ceipalUsersCachedAt: number = 0;
const CEIPAL_USERS_CACHE_TTL_MS = 30 * 60 * 1000;

/** Fetch all Ceipal users via paginated GET /v2/getUsers/. Cached for 30 min. */
export async function getCeipalUsers(forceRefresh = false): Promise<CeipalUser[]> {
  const now = Date.now();
  if (!forceRefresh && cachedCeipalUsers && now - ceipalUsersCachedAt < CEIPAL_USERS_CACHE_TTL_MS) {
    return cachedCeipalUsers;
  }

  const PAGE_SIZE = 100;
  const allUsers: CeipalUser[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const url = `https://api.ceipal.com/v2/getUsers/?page=${page}&page_size=${PAGE_SIZE}`;
    let res: Response;
    try {
      res = await fetchWithTokenRetry(url);
    } catch (err: any) {
      console.warn(`[ceipal] getCeipalUsers page ${page} fetch error:`, err.message);
      break;
    }

    if (!res.ok) {
      if (res.status === 404) {
        console.log(`[ceipal] getCeipalUsers: 404 on page ${page} — end of results`);
        break;
      }
      console.warn(`[ceipal] getCeipalUsers: ${res.status} on page ${page}`);
      break;
    }

    const data = await res.json();
    const pageUsers: any[] = Array.isArray(data?.results) ? data.results
      : Array.isArray(data?.data) ? data.data
      : Array.isArray(data) ? data : [];

    if (pageUsers.length === 0) break;

    for (const u of pageUsers) {
      allUsers.push({
        id: String(u.id ?? u.user_id ?? ""),
        email_id: (u.email_id || u.email || "").trim(),
        display_name: u.display_name || u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim(),
        team_name: u.team_name || "",
        business_unit_id: String(u.business_unit_id ?? u.business_unit ?? ""),
        role: u.role || u.user_role || "",
        status: u.status || "",
        reporting_to: u.reporting_to || u.manager || "",
      });
    }

    if (pageUsers.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`[ceipal] getCeipalUsers: fetched ${allUsers.length} users across ${page} page(s)`);
  cachedCeipalUsers = allUsers;
  ceipalUsersCachedAt = Date.now();
  return allUsers;
}

/** Fetch a single Ceipal user by their Ceipal user ID. */
export async function getCeipalUserDetails(userId: string): Promise<CeipalUser | null> {
  try {
    const url = `https://api.ceipal.com/v2/getUserDetails/${userId}/`;
    const res = await fetchWithTokenRetry(url);
    if (!res.ok) {
      console.warn(`[ceipal] getCeipalUserDetails(${userId}): ${res.status}`);
      return null;
    }
    const u = await res.json();
    return {
      id: String(u.id ?? u.user_id ?? userId),
      email_id: (u.email_id || u.email || "").trim(),
      display_name: u.display_name || u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim(),
      team_name: u.team_name || "",
      business_unit_id: String(u.business_unit_id ?? u.business_unit ?? ""),
      role: u.role || u.user_role || "",
      status: u.status || "",
      reporting_to: u.reporting_to || u.manager || "",
    };
  } catch (err: any) {
    console.warn(`[ceipal] getCeipalUserDetails(${userId}) error:`, err.message);
    return null;
  }
}

/**
 * Return emails of active Ceipal users that have no matching local admin_user.
 * Uses the cached user list (TTL 30 min). Gracefully returns [] on any error.
 */
export async function getUnmatchedCeipalUsers(): Promise<string[]> {
  const email = process.env.CEIPAL_EMAIL;
  const password = process.env.CEIPAL_PASSWORD;
  const apiKey = process.env.CEIPAL_API_KEY;
  if (!email || !password || !apiKey) return [];

  try {
    const [ceipalUsers, localAdminRows] = await Promise.all([
      getCeipalUsers(),
      db.select({ email: adminUsers.email })
        .from(adminUsers)
        .where(isNull(adminUsers.deletedAt)),
    ]);

    const localEmailSet = new Set(
      localAdminRows.map(u => (u.email ?? "").toLowerCase()).filter(Boolean)
    );

    const activeUsers = ceipalUsers.filter(u =>
      (u.status || "").toLowerCase() === "active" || !u.status
    );

    return activeUsers
      .filter(u => u.email_id && !localEmailSet.has(u.email_id.toLowerCase()))
      .map(u => u.email_id);
  } catch (err: any) {
    console.warn("[ceipal] getUnmatchedCeipalUsers error:", err.message);
    return [];
  }
}

export interface CeipalJob {
  id: string;
  job_code: string;
  job_title: string;
  public_job_title: string;
  job_description: string;
  public_job_description: string;
  city: string;
  states: string;
  country: string;
  zip_code: string;
  location: string;
  job_type: string;
  job_status: string;
  duration: string;
  experience: string;
  number_of_positions: string;
  primary_skills: string;
  secondary_skills: string;
  pay_rate___salary: string;
  client_bill_rate___salary: string;
  job_start_date: string;
  job_end_date: string;
  remote_job: string;
  client: string;
  department: string;
  industry: string;
  tax_terms: string;
  post_job_on_career_portal: string;
  [key: string]: any;
}

const ACTIVE_STATUSES = new Set(["active", "open"]);

function isCeipalJobActive(status: string | undefined): boolean {
  if (!status) return false;
  return ACTIVE_STATUSES.has(status.trim().toLowerCase());
}

const MAX_PAGES = 500;

export async function fetchCeipalJobs(): Promise<CeipalJob[]> {
  const endpoint = process.env.CEIPAL_JOBS_ENDPOINT;
  if (!endpoint) {
    throw new Error("CEIPAL_JOBS_ENDPOINT not configured");
  }

  const PAGE_LIMIT = 50;
  const allJobs: CeipalJob[] = [];
  const seenIds = new Set<string>();
  let page = 1;

  while (page <= MAX_PAGES) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const pagedUrl = `${endpoint}${separator}page=${page}&limit=${PAGE_LIMIT}`;

    const res = await fetchWithTokenRetry(pagedUrl, { method: "GET" });

    if (!res.ok) {
      if (res.status === 404) {
        const body404 = await res.text();
        let json404: any = {};
        try { json404 = JSON.parse(body404); } catch {}
        const msg404 = (json404.message || json404.detail || body404 || "").toLowerCase();
        if (
          msg404.includes("please provide the access token") ||
          msg404.includes("company access is temporarily disabled") ||
          msg404.includes("invalid token") ||
          msg404.includes("token") && msg404.includes("authentication")
        ) {
          throw new Error(`Ceipal auth error on page ${page}: ${json404.message || body404}`);
        }
        console.log(`[ceipal] Page ${page} returned 404 — reached end of results`);
        break;
      }
      const errText = await res.text();
      throw new Error(`Ceipal jobs fetch failed: ${res.status} - ${errText}`);
    }

    const data = await res.json();

    let pageJobs: CeipalJob[] = [];
    if (Array.isArray(data)) {
      pageJobs = data;
    } else if (data && Array.isArray(data.results)) {
      pageJobs = data.results;
    }

    if (pageJobs.length === 0) break;

    let newCount = 0;
    for (const job of pageJobs) {
      const key = job.id || job.job_code;
      if (key && seenIds.has(key)) continue;
      if (key) seenIds.add(key);
      allJobs.push(job);
      newCount++;
    }

    console.log(`[ceipal] Fetched page ${page}: ${pageJobs.length} jobs (${newCount} new)`);

    if (pageJobs.length < PAGE_LIMIT) {
      console.log(`[ceipal] Page ${page} returned ${pageJobs.length} < ${PAGE_LIMIT}, reached last page`);
      break;
    }

    page++;
  }

  if (page > MAX_PAGES) {
    console.warn(`[ceipal] Reached max page limit (${MAX_PAGES}), stopping pagination`);
  }

  const totalPages = Math.min(page, MAX_PAGES);
  console.log(`[ceipal] Total jobs fetched across ${totalPages} page(s): ${allJobs.length}`);
  return allJobs;
}

function stripHtml(html: string): string {
  if (!html) return "";
  let text = html;
  text = text.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;amp;/gi, "&");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<hr\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&rsquo;/gi, "\u2019");
  text = text.replace(/&lsquo;/gi, "\u2018");
  text = text.replace(/&rdquo;/gi, "\u201D");
  text = text.replace(/&ldquo;/gi, "\u201C");
  text = text.replace(/&mdash;/gi, "\u2014");
  text = text.replace(/&ndash;/gi, "\u2013");
  text = text.replace(/&hellip;/gi, "\u2026");
  text = text.replace(/&bull;/gi, "\u2022");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&#\d+;/gi, "");
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\r/g, "\n");
  text = text.replace(/\t/g, " ");
  text = text.replace(/ {2,}/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/^\s+$/gm, "");
  return text.trim();
}

function formatLocation(city: string, states: string): { city: string; state: string } {
  const stateList = states ? states.split(",").map(s => s.trim()).filter(Boolean) : [];
  const formattedCity = city?.trim() || "";

  if (stateList.length <= 2) {
    return { city: formattedCity, state: stateList.join(", ") };
  }

  return { city: formattedCity, state: `${stateList[0]} +${stateList.length - 1} more` };
}

function mapCeipalJobToLocal(ceipalJob: CeipalJob) {
  const rawDescription = ceipalJob.public_job_description || ceipalJob.job_description || "";
  const description = stripHtml(rawDescription);
  const skills = [ceipalJob.primary_skills, ceipalJob.secondary_skills].filter(Boolean).join(", ");
  const location = formatLocation(ceipalJob.city, ceipalJob.states);

  return {
    jobId: ceipalJob.job_code,
    title: ceipalJob.public_job_title || ceipalJob.job_title || "Untitled Position",
    specialty: ceipalJob.industry || null,
    department: ceipalJob.department || null,
    facility: ceipalJob.client || null,
    city: location.city || null,
    state: location.state || null,
    jobType: ceipalJob.job_type || ceipalJob.tax_terms || null,
    shift: null,
    duration: ceipalJob.duration || null,
    payRate: ceipalJob.pay_rate___salary || null,
    billRate: ceipalJob.client_bill_rate___salary || null,
    startDate: ceipalJob.job_start_date || null,
    description: description,
    requirements: skills || null,
    isActive: isCeipalJobActive(ceipalJob.job_status),
    isHot: false,
    rawData: ceipalJob,
    source: "ceipal" as const,
    ceipalJobCode: ceipalJob.job_code,
    ceipalJobId: ceipalJob.id,
  };
}

export async function syncCeipalJobs(): Promise<{ created: number; updated: number; deactivated: number; total: number }> {
  if (isSyncing) {
    throw new Error("A Ceipal sync is already in progress");
  }

  isSyncing = true;
  try {
    const ceipalJobs = await fetchCeipalJobs();
    let created = 0;
    let updated = 0;

    const seenJobCodes = new Set<string>();

    for (const cJob of ceipalJobs) {
      if (!cJob.job_code) continue;
      seenJobCodes.add(cJob.job_code);
      const mapped = mapCeipalJobToLocal(cJob);

      const existing = await db.select()
        .from(jobs)
        .where(eq(jobs.ceipalJobCode, cJob.job_code))
        .limit(1);

      if (existing.length > 0) {
        await db.update(jobs)
          .set({
            ...mapped,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, existing[0].id));
        updated++;
      } else {
        await db.insert(jobs).values(mapped);
        created++;
      }
    }

    let deactivated = 0;
    const localCeipalJobs = await db.select()
      .from(jobs)
      .where(and(eq(jobs.source, "ceipal"), eq(jobs.isActive, true)));

    for (const localJob of localCeipalJobs) {
      if (localJob.ceipalJobCode && !seenJobCodes.has(localJob.ceipalJobCode)) {
        await db.update(jobs)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(jobs.id, localJob.id));
        deactivated++;
      }
    }

    console.log(`[ceipal] Sync complete: ${created} created, ${updated} updated, ${deactivated} deactivated out of ${ceipalJobs.length} total`);
    return { created, updated, deactivated, total: ceipalJobs.length };
  } finally {
    isSyncing = false;
  }
}

// Searches Ceipal for candidates matching the query string.
// Falls back gracefully if Ceipal is not configured or the endpoint is unavailable.
export async function searchCeipalCandidates(q: string): Promise<{
  candidates: Array<{ name: string; email?: string; phone?: string; skills?: string }>;
  ceipal_unavailable?: boolean;
  message?: string;
}> {
  if (!q || q.trim().length < 2) return { candidates: [] };

  const email = process.env.CEIPAL_EMAIL;
  const password = process.env.CEIPAL_PASSWORD;
  const apiKey = process.env.CEIPAL_API_KEY;
  if (!email || !password || !apiKey) {
    return { candidates: [], ceipal_unavailable: true, message: "Ceipal is not configured in this environment." };
  }

  try {
    const url = `https://api.ceipal.com/v1/getCandidates/?search=${encodeURIComponent(q.trim())}&page=1&page_size=10`;
    const res = await fetchWithTokenRetry(url);

    if (!res.ok) {
      console.warn(`[ceipal] Candidate search returned ${res.status} — endpoint may not be supported`);
      return { candidates: [], ceipal_unavailable: true, message: "Candidate search is not available in this ATS configuration." };
    }

    const data = await res.json();
    const list: any[] = Array.isArray(data?.results) ? data.results
      : Array.isArray(data?.candidates) ? data.candidates
      : Array.isArray(data?.data) ? data.data
      : Array.isArray(data) ? data : [];

    const candidates = list
      .map((c: any) => ({
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.name || c.candidate_name || "",
        email: c.email_address || c.email || "",
        phone: c.mobile_number || c.phone || "",
        skills: c.primary_skills || c.skills || "",
      }))
      .filter((c: any) => c.name);

    return { candidates };
  } catch (err: any) {
    console.warn("[ceipal] searchCeipalCandidates error:", err.message);
    return { candidates: [], ceipal_unavailable: true, message: "Ceipal candidate search is temporarily unavailable." };
  }
}

export interface RecruiterMetric {
  recruiterId: string;
  recruiterName: string;
  email: string;
  /** Submissions in the last 7 days (always computed, regardless of period) */
  submissionsWeek: number;
  /** Submissions in the last 30 days (always computed, regardless of period) */
  submissionsMonth: number;
  /** Submissions within the selected custom date range (equals submissionsMonth for week/month periods) */
  submissionsInPeriod: number;
  interviews: number;
  placements: number;
  /** Placements from Jan 1 of the current year to today */
  placementsYTD: number;
  topChannel: string;
  channels: Record<string, number>;
  callsMade: number;
  callMinutes: number;
  smsSent: number;
  meetingsHosted: number;
  dailyBreakdown: Array<{ date: string; submissions: number; calls: number }>;
  /** Ceipal profile fields (from getCeipalUsers enrichment) */
  ceipalUserId?: string;
  teamName?: string;
  businessUnitId?: string;
  ceipalRole?: string;
  reportingTo?: string;
}

function parseSubmissions(data: any): any[] {
  return Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data) ? data : [];
}

function isPlacement(sub: any): boolean {
  const stage = (sub.stage || sub.status || "").toLowerCase();
  return stage.includes("placement") || stage.includes("placed") || stage.includes("start");
}

export async function getCeipalRecruiterMetrics(
  period: string = "week",
  recruiterId?: string,
  customFrom?: string,
  customTo?: string
): Promise<{ metrics: RecruiterMetric[]; zoomAvailable: boolean; ceipalAvailable: boolean }> {
  const envEmail = process.env.CEIPAL_EMAIL;
  const envPassword = process.env.CEIPAL_PASSWORD;
  const envApiKey = process.env.CEIPAL_API_KEY;

  if (!envEmail || !envPassword || !envApiKey) {
    return { metrics: [], zoomAvailable: false, ceipalAvailable: false };
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // ── Fixed date windows (always computed) ───────────────────────────────────
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const weekFromStr = weekAgo.toISOString().split("T")[0];
  const monthFromStr = monthAgo.toISOString().split("T")[0];
  const ytdFromStr = `${now.getFullYear()}-01-01`;

  // ── Selected range (for dailyBreakdown + submissionsInPeriod) ──────────────
  let periodFrom: string;
  let periodTo: string;
  if (period === "custom" && customFrom && customTo) {
    periodFrom = customFrom;
    periodTo = customTo;
  } else if (period === "week") {
    periodFrom = weekFromStr;
    periodTo = todayStr;
  } else {
    periodFrom = monthFromStr;
    periodTo = todayStr;
  }

  try {
    async function fetchSubmissions(from: string, to: string): Promise<any[]> {
      const url = `https://api.ceipal.com/v1/getSubmissions/?from_date=${from}&to_date=${to}&page=1&page_size=300`;
      const res = await fetchWithTokenRetry(url);
      if (!res.ok) {
        console.warn(`[ceipal] getSubmissions ${from}→${to} returned ${res.status}`);
        return [];
      }
      return parseSubmissions(await res.json());
    }

    // Fetch rolling 30-day submissions, YTD submissions, local admin_user
    // emails, and Ceipal user list in parallel.
    const [monthSubs, ytdSubs, periodSubs, localAdminRows, ceipalUserList] = await Promise.all([
      fetchSubmissions(monthFromStr, todayStr),
      fetchSubmissions(ytdFromStr, todayStr),
      // Only fetch separately for custom ranges; week/month overlap with monthSubs
      (period === "custom" && customFrom && customTo)
        ? fetchSubmissions(periodFrom, periodTo)
        : Promise.resolve(null),
      db.select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name })
        .from(adminUsers)
        .where(isNull(adminUsers.deletedAt)),
      getCeipalUsers().catch((err: any) => {
        console.warn("[ceipal] getCeipalUsers in metrics run failed (non-fatal):", err.message);
        return [] as CeipalUser[];
      }),
    ]);

    // Build dual-indexed CeipalUserMap:
    //   - ceipalUserById: keyed by Ceipal user ID (primary — most reliable)
    //   - ceipalUserByEmail: keyed by email (secondary — fallback)
    const ceipalUserById = new Map<string, CeipalUser>();
    const ceipalUserByEmail = new Map<string, CeipalUser>();
    for (const cu of ceipalUserList) {
      if (cu.id) ceipalUserById.set(cu.id, cu);
      if (cu.email_id) ceipalUserByEmail.set(cu.email_id.toLowerCase(), cu);
    }

    // Build a set of lowercase local emails for fast lookups
    const localEmailSet = new Set(
      localAdminRows
        .map(u => (u.email ?? "").toLowerCase())
        .filter(Boolean)
    );

    /** Returns true if canonicalEmail belongs to a known local user (or if the
     *  set is empty, which means the DB query failed — degrade gracefully). */
    function isLocalRecruiter(canonicalEmail: string): boolean {
      if (localEmailSet.size === 0) return true; // graceful degrade
      return localEmailSet.has(canonicalEmail.toLowerCase());
    }

    // Build an email → display-name map from local users so recruiter names
    // shown in the dashboard match the internal HR system, not raw Ceipal strings.
    const localNameMap = new Map<string, string>(
      localAdminRows
        .filter(u => u.email)
        .map(u => [(u.email!).toLowerCase(), u.name ?? ""])
    );

    // For week/month periods the period window is a subset of monthSubs
    const effectivePeriodSubs: any[] = periodSubs ?? monthSubs;

    const recruiterMap = new Map<string, RecruiterMetric>();

    function ensureRecruiter(rId: string, rName: string, rEmail: string): RecruiterMetric {
      if (!recruiterMap.has(rId)) {
        recruiterMap.set(rId, {
          recruiterId: rId,
          recruiterName: rName,
          email: rEmail,
          submissionsWeek: 0,
          submissionsMonth: 0,
          submissionsInPeriod: 0,
          interviews: 0,
          placements: 0,
          placementsYTD: 0,
          topChannel: "",
          channels: {},
          callsMade: 0,
          callMinutes: 0,
          smsSent: 0,
          meetingsHosted: 0,
          dailyBreakdown: [],
        });
      }
      return recruiterMap.get(rId)!;
    }

    /**
     * Resolve recruiter identity from a submission row.
     * Primary: Ceipal user ID (from submission fields) → look up in ceipalUserById.
     * Secondary: email from submission → look up in ceipalUserByEmail.
     * Fallback: raw email / name fields from the submission row.
     *
     * Returns null if the recruiter cannot be matched to a known local user.
     */
    function resolveRecruiter(sub: any): {
      rId: string;
      rEmail: string;
      rName: string;
      ceipalUser: CeipalUser | undefined;
    } | null {
      // Extract raw fields from submission
      const subCeipalId = String(
        sub.submitted_by_id ?? sub.recruiter_id ?? sub.user_id ?? sub.created_by ?? ""
      ).trim();
      const rEmailRaw = (sub.submitted_by_email || sub.recruiter_email || "").trim();
      const rNameRaw = sub.submitted_by || sub.recruiter_name || rEmailRaw;

      // Resolve CeipalUser: prefer ID lookup, then email lookup
      let ceipalUser: CeipalUser | undefined;
      if (subCeipalId) {
        ceipalUser = ceipalUserById.get(subCeipalId);
      }
      if (!ceipalUser && rEmailRaw) {
        ceipalUser = ceipalUserByEmail.get(rEmailRaw.toLowerCase());
      }

      // Canonical email for local matching:
      // If Ceipal gave us a user, trust Ceipal's email (handles mismatches).
      const canonicalEmail = ceipalUser?.email_id || rEmailRaw;

      // Filter: only include recruiters matching a known local admin account
      if (!isLocalRecruiter(canonicalEmail)) return null;

      // Recruiter key: Ceipal user ID when available (most stable), else email
      const rId = ceipalUser?.id || canonicalEmail || rNameRaw;
      if (!rId) return null;

      // Display name: prefer local HR name → Ceipal display_name → raw sub name
      const displayName =
        (canonicalEmail && localNameMap.get(canonicalEmail.toLowerCase())) ||
        ceipalUser?.display_name ||
        rNameRaw;

      return { rId, rEmail: canonicalEmail, rName: displayName, ceipalUser };
    }

    // ── Process 30-day submissions → submissionsWeek + submissionsMonth ────────
    for (const sub of monthSubs) {
      const resolved = resolveRecruiter(sub);
      if (!resolved) continue;
      const { rId, rEmail, rName } = resolved;
      if (recruiterId && rId !== recruiterId) continue;

      const m = ensureRecruiter(rId, rName, rEmail);
      m.submissionsMonth++;

      const subDate = new Date(sub.submission_date || sub.created_date || now);
      if (subDate >= weekAgo) m.submissionsWeek++;

      const stage = (sub.stage || sub.status || "").toLowerCase();
      if (stage.includes("interview") || stage.includes("scheduled")) m.interviews++;
      if (isPlacement(sub)) m.placements++;

      const channel = sub.source || sub.sourcing_channel || sub.job_board || "Other";
      m.channels[channel] = (m.channels[channel] || 0) + 1;
    }

    // ── Process selected-period submissions → submissionsInPeriod + dailyBreakdown
    for (const sub of effectivePeriodSubs) {
      const resolved = resolveRecruiter(sub);
      if (!resolved) continue;
      const { rId, rEmail, rName } = resolved;
      if (recruiterId && rId !== recruiterId) continue;

      const m = ensureRecruiter(rId, rName, rEmail);
      m.submissionsInPeriod++;

      const subDate = new Date(sub.submission_date || sub.created_date || now);
      const dateKey = subDate.toISOString().split("T")[0];
      const dayEntry = m.dailyBreakdown.find(d => d.date === dateKey);
      if (dayEntry) dayEntry.submissions++;
      else m.dailyBreakdown.push({ date: dateKey, submissions: 1, calls: 0 });
    }

    // ── Process YTD submissions → placementsYTD ───────────────────────────────
    for (const sub of ytdSubs) {
      const resolved = resolveRecruiter(sub);
      if (!resolved) continue;
      const { rId, rEmail, rName } = resolved;
      if (recruiterId && rId !== recruiterId) continue;
      if (!isPlacement(sub)) continue;

      const m = ensureRecruiter(rId, rName, rEmail);
      m.placementsYTD++;
    }

    for (const m of recruiterMap.values()) {
      let maxCount = 0;
      for (const [ch, cnt] of Object.entries(m.channels)) {
        if (cnt > maxCount) { maxCount = cnt; m.topChannel = ch; }
      }
      m.dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));

      // Enrich with Ceipal profile data.
      // If rId is a Ceipal user ID, look up directly; else try by email.
      const cu = ceipalUserById.get(m.recruiterId)
        || (m.email ? ceipalUserByEmail.get(m.email.toLowerCase()) : undefined);
      if (cu) {
        m.ceipalUserId = cu.id;
        m.teamName = cu.team_name || undefined;
        m.businessUnitId = cu.business_unit_id || undefined;
        m.ceipalRole = cu.role || undefined;
        m.reportingTo = cu.reporting_to || undefined;
      }
    }

    // ── Zoom enrichment ────────────────────────────────────────────────────────
    // Zoom activity always uses fixed week (7d) + rolling-30 ranges so the
    // metrics are comparable regardless of the selected Ceipal period.
    const zoomOn = isZoomConfigured();

    if (zoomOn && recruiterMap.size > 0) {
      try {
        const zoomUsers = await getZoomUsers();

        if (zoomUsers.length > 0) {
          const emailIndex = new Map<string, RecruiterMetric>();
          for (const m of recruiterMap.values()) {
            if (m.email) emailIndex.set(m.email.toLowerCase(), m);
          }

          const matchedUsers = zoomUsers.filter(
            zu => zu.email && emailIndex.has(zu.email.toLowerCase())
          );

          // Fetch rolling-30 Zoom call data (normalizes to same cadence as submissionsMonth)
          const zoomRolling30 = { from: monthFromStr, to: todayStr };
          const zoomRollingWeek = { from: weekFromStr, to: todayStr };

          await Promise.allSettled(
            matchedUsers.map(async (zu) => {
              const m = emailIndex.get(zu.email.toLowerCase())!;

              // Call logs — rolling 30 days
              const calls = await getZoomCallLogs(zu.id, zoomRolling30);
              m.callsMade = calls.length;
              m.callMinutes = Math.round(
                calls.reduce((sum: number, c: any) => sum + (Number(c.duration) || 0), 0) / 60
              );
              // Merge call dates into the daily breakdown
              for (const c of calls) {
                const d = ((c.date_time || c.start_time || "") as string).split("T")[0];
                if (!d) continue;
                const day = m.dailyBreakdown.find(x => x.date === d);
                if (day) day.calls++;
                else m.dailyBreakdown.push({ date: d, submissions: 0, calls: 1 });
              }

              // SMS sessions — rolling week (short-range activity metric)
              const sms = await getZoomSmsLogs(zu.id, zoomRollingWeek);
              m.smsSent = sms.length;

              // Meetings hosted — rolling week
              const meetings = await getZoomMeetings(zu.id, zoomRollingWeek);
              m.meetingsHosted = meetings.length;
            })
          );

          for (const m of recruiterMap.values()) {
            m.dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));
          }
        }
      } catch (zoomErr: any) {
        console.warn("[ceipal] Zoom enrichment failed (non-fatal):", zoomErr.message);
      }
    }
    // ── end Zoom enrichment ────────────────────────────────────────────────────

    return {
      metrics: Array.from(recruiterMap.values()),
      zoomAvailable: zoomOn,
      ceipalAvailable: true,
    };
  } catch (err: any) {
    console.warn("[ceipal] getCeipalRecruiterMetrics error:", err.message);
    return { metrics: [], zoomAvailable: false, ceipalAvailable: false };
  }
}

export async function pushApplicantToCeipal(applicationId: string): Promise<{ success: boolean; ceipalId?: string; error?: string }> {
  const endpoint = process.env.CEIPAL_APPLICANT_ENDPOINT;
  if (!endpoint) {
    await db.update(applications)
      .set({ ceipalSyncStatus: "skipped", updatedAt: new Date() })
      .where(eq(applications.id, applicationId));
    return { success: false, error: "CEIPAL_APPLICANT_ENDPOINT not configured" };
  }

  try {
    const [application] = await db.select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    let ceipalJobId: string | null = null;
    if (application.jobId) {
      const [job] = await db.select()
        .from(jobs)
        .where(eq(jobs.id, application.jobId))
        .limit(1);
      if (job) {
        ceipalJobId = job.ceipalJobId;
      }
    }

    const nameParts = (application.candidateName || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const token = await authenticate();

    const applicantObj: Record<string, any> = {
      first_name: firstName,
      last_name: lastName,
      email_address: application.email || "",
      mobile_number: (application.phone || "").replace(/\D/g, ""),
      source: "Website",
    };

    if (application.currentEmployer) {
      applicantObj.current_company = application.currentEmployer;
    }
    if (application.yearsExperience) {
      applicantObj.experience = String(application.yearsExperience);
    }
    if (application.linkedinUrl) {
      applicantObj.linkedin_profile_url = application.linkedinUrl;
    }

    if (application.resumePath) {
      try {
        const baseUrl = `http://127.0.0.1:${process.env.PORT || 5000}`;
        const resumeUrl = application.resumePath.startsWith("http")
          ? application.resumePath
          : `${baseUrl}${application.resumePath}`;
        console.log(`[ceipal] Fetching resume from: ${resumeUrl}`);
        const resumeResponse = await fetch(resumeUrl);
        if (resumeResponse.ok) {
          const resumeBuffer = await resumeResponse.arrayBuffer();
          const base64Content = Buffer.from(resumeBuffer).toString("base64");
          const pathParts = application.resumePath.split("/");
          const fileName = pathParts[pathParts.length - 1] || "resume.pdf";
          applicantObj.resume_content = base64Content;
          applicantObj.filename = fileName;
          console.log(`[ceipal] Attached resume: ${fileName} (${resumeBuffer.byteLength} bytes, base64: ${base64Content.length} chars)`);
        } else {
          console.warn(`[ceipal] Could not fetch resume from ${resumeUrl}: ${resumeResponse.status}`);
        }
      } catch (resumeErr: any) {
        console.warn(`[ceipal] Resume fetch error: ${resumeErr.message}`);
      }
    }

    const payload = [applicantObj];

    const logObj = { ...applicantObj };
    if (logObj.resume_content) {
      logObj.resume_content = `[base64, ${logObj.resume_content.length} chars]`;
    }
    console.log(`[ceipal] Pushing applicant ${applicationId} to endpoint: ${endpoint}`);
    console.log(`[ceipal] Payload:`, JSON.stringify([logObj]));

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`[ceipal] Response status: ${res.status}, body:`, JSON.stringify(responseData).substring(0, 500));

    if (res.ok) {
      const ceipalApplicantId = responseData?.id || responseData?.applicant_id || null;

      await db.update(applications)
        .set({
          ceipalSyncStatus: "synced",
          ceipalApplicantId: ceipalApplicantId ? String(ceipalApplicantId) : null,
          updatedAt: new Date(),
        })
        .where(eq(applications.id, applicationId));

      console.log(`[ceipal] Successfully synced applicant ${applicationId}, ceipalId: ${ceipalApplicantId}`);
      return { success: true, ceipalId: ceipalApplicantId ? String(ceipalApplicantId) : undefined };
    } else {
      const errorMsg = `Ceipal returned ${res.status}: ${JSON.stringify(responseData)}`;
      console.error(`[ceipal] Applicant push failed for ${applicationId}:`, errorMsg);

      await db.update(applications)
        .set({
          ceipalSyncStatus: "failed",
          updatedAt: new Date(),
        })
        .where(eq(applications.id, applicationId));

      return { success: false, error: errorMsg };
    }
  } catch (err: any) {
    console.error(`[ceipal] Applicant push error for ${applicationId}:`, err.message, err.stack);

    await db.update(applications)
      .set({
        ceipalSyncStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId));

    return { success: false, error: err.message };
  }
}
