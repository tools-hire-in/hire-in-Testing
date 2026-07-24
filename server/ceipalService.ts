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

// ── Last API error tracker — read by integrationsRoutes.ts status endpoint ──
let lastCeipalApiError: { message: string; timestamp: string } | null = null;

function recordCeipalApiError(msg: string): void {
  lastCeipalApiError = { message: msg, timestamp: new Date().toISOString() };
  console.warn("[ceipal] API error recorded:", msg);
}

export function getLastCeipalApiError(): { message: string; timestamp: string } | null {
  return lastCeipalApiError;
}

export function clearLastCeipalApiError(): void {
  lastCeipalApiError = null;
}

/** null = not yet probed; true = v2 accessible; false = v2 returns 401 */
let v2AccessStatus: boolean | null = null;

/** Returns the last known Ceipal v2 access status. null = never checked. */
export function getCeipalV2AccessStatus(): boolean | null {
  return v2AccessStatus;
}

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
 *  Also updates the module-scope v2AccessStatus for diagnostic reporting.
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
      v2AccessStatus = false;
    } else {
      console.log(`[ceipal] v2 compat check: status ${res.status} — v1 tokens are compatible with v2 endpoints`);
      v2AccessStatus = true;
    }
  } catch (err: any) {
    console.warn("[ceipal] v2 compat check failed (network):", err.message);
    // Leave v2AccessStatus as null (unknown) on network error
  }
}

/**
 * Explicitly probe v2 API access and update v2AccessStatus.
 * Called from the integrations test endpoint so admins can get fresh v2 status
 * without waiting for the next full authentication cycle.
 * Returns true if v2 is accessible, false if not, null on network error.
 */
export async function probeV2Access(): Promise<boolean | null> {
  try {
    const token = await authenticate();
    const res = await fetch("https://api.ceipal.com/v2/getUsers/?page=1&page_size=1", {
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    v2AccessStatus = res.status !== 401;
    return v2AccessStatus;
  } catch {
    return null;
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
          // 5-min pre-expiry buffer: treat token as expired at 50 min, not 55 min
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
    const errMsg = `Ceipal authentication failed: ${res.status}`;
    recordCeipalApiError(errMsg);
    throw new Error(errMsg);
  }

  const parsed = parseTokenResponse(await res.text());

  if (!parsed.access_token) {
    throw new Error("Failed to parse Ceipal auth token");
  }

  cachedToken = parsed.access_token;
  // 5-min pre-expiry buffer: treat token as expired at 50 min, not 55 min
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
  // v2 enriched fields from getJobPostingDetails
  pay_rates?: CeipalPayRate[];
  primary_recruiter?: string;
  remote_opportunities?: string;
  closing_date?: string;
  employment_type?: string;
  skills?: string;
  [key: string]: any;
}

export interface CeipalPayRate {
  pay_type?: string;
  min_pay_rate?: string | number;
  max_pay_rate?: string | number;
  currency?: string;
  [key: string]: any;
}

const ACTIVE_STATUSES = new Set(["active", "open"]);

function isCeipalJobActive(status: string | undefined): boolean {
  if (!status) return false;
  return ACTIVE_STATUSES.has(status.trim().toLowerCase());
}

const MAX_PAGES = 500;
const V2_JOBS_BASE_URL = "https://api.ceipal.com/v2/getJobPostings/";
const V2_JOB_DETAIL_BASE_URL = "https://api.ceipal.com/v2/getJobPostingDetails/";

/**
 * Fetch enriched details for a single job from the Ceipal v2 detail endpoint.
 * Returns null on any error (non-fatal — the list-page stub is still used).
 */
async function getCeipalJobPostingDetails(jobId: string): Promise<Partial<CeipalJob> | null> {
  try {
    const url = `${V2_JOB_DETAIL_BASE_URL}${encodeURIComponent(jobId)}/`;
    const res = await fetchWithTokenRetry(url, { method: "GET" });
    if (!res.ok) {
      console.warn(`[ceipal] getJobPostingDetails(${jobId}) returned ${res.status} — skipping detail enrichment`);
      return null;
    }
    const data = await res.json();
    // The v2 detail endpoint may wrap in { results: [...] } or return the object directly
    if (Array.isArray(data?.results) && data.results.length > 0) return data.results[0];
    if (data && typeof data === "object" && !Array.isArray(data)) return data;
    return null;
  } catch (err: any) {
    console.warn(`[ceipal] getJobPostingDetails(${jobId}) error:`, err.message);
    return null;
  }
}

/**
 * Concurrency-limited batch enrichment: fetches job details for up to
 * `concurrency` jobs in parallel, merges the result back into each stub.
 */
async function enrichJobsWithDetails(jobs: CeipalJob[], concurrency = 5): Promise<CeipalJob[]> {
  const enriched: CeipalJob[] = [];
  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency);
    const details = await Promise.all(
      batch.map((job) => {
        const lookupId = job.id || job.job_code;
        if (!lookupId) return Promise.resolve(null);
        return getCeipalJobPostingDetails(lookupId);
      })
    );
    for (let j = 0; j < batch.length; j++) {
      const detail = details[j];
      if (detail) {
        enriched.push({ ...batch[j], ...detail });
      } else {
        enriched.push(batch[j]);
      }
    }
  }
  return enriched;
}

// Default to the v1 jobs endpoint if CEIPAL_JOBS_ENDPOINT is not configured.
// Step 4 of the Admin Setup Guide: optionally override to v2 getJobPosts endpoint.
const DEFAULT_CEIPAL_JOBS_ENDPOINT = "https://api.ceipal.com/v1/getJobPosts/";

export async function fetchCeipalJobs(): Promise<CeipalJob[]> {
  // Allow manual override via env var; default to v2 paginated endpoint
  const overrideEndpoint = process.env.CEIPAL_JOBS_ENDPOINT;
  const isV2 = !overrideEndpoint;

  // v2 uses page_size=50; legacy override keeps its own param style
  const PAGE_LIMIT = 50;
  const allJobs: CeipalJob[] = [];
  const seenIds = new Set<string>();
  let page = 1;

  while (page <= MAX_PAGES) {
    let pagedUrl: string;
    if (overrideEndpoint) {
      const separator = overrideEndpoint.includes("?") ? "&" : "?";
      pagedUrl = `${overrideEndpoint}${separator}page=${page}&limit=${PAGE_LIMIT}`;
    } else {
      pagedUrl = `${V2_JOBS_BASE_URL}?page=${page}&page_size=${PAGE_LIMIT}`;
    }

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
          (msg404.includes("token") && msg404.includes("authentication"))
        ) {
          throw new Error(`Ceipal auth error on page ${page}: ${json404.message || body404}`);
        }
        console.log(`[ceipal] Page ${page} returned 404 — reached end of results`);
        break;
      }
      const errText = await res.text();
      const errMsg = `Ceipal jobs fetch failed: ${res.status} - ${errText.slice(0, 300)}`;
      recordCeipalApiError(errMsg);
      throw new Error(errMsg);
    }

    const data = await res.json();

    let pageJobs: CeipalJob[] = [];
    if (Array.isArray(data)) {
      pageJobs = data;
    } else if (data && Array.isArray(data.results)) {
      pageJobs = data.results;
    } else if (data && Array.isArray(data.data)) {
      pageJobs = data.data;
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

  // v2 path: enrich each job stub with detail-endpoint data (pay_rates, primary_recruiter, etc.)
  if (isV2 && allJobs.length > 0) {
    console.log(`[ceipal] Fetching v2 job details for ${allJobs.length} jobs (concurrency=5)...`);
    const enriched = await enrichJobsWithDetails(allJobs, 5);
    console.log(`[ceipal] v2 enrichment complete`);
    return enriched;
  }

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
  const skills = [ceipalJob.primary_skills, ceipalJob.secondary_skills, ceipalJob.skills]
    .filter(Boolean).join(", ");
  const location = formatLocation(ceipalJob.city, ceipalJob.states);

  // Normalize pay_rates — v2 detail returns an array; guard against missing/malformed
  let ceipalPayRates: CeipalPayRate[] | null = null;
  if (Array.isArray(ceipalJob.pay_rates) && ceipalJob.pay_rates.length > 0) {
    ceipalPayRates = ceipalJob.pay_rates;
  }

  // Normalize closing_date to YYYY-MM-DD if present
  let closingDate: string | null = null;
  if (ceipalJob.closing_date) {
    const d = new Date(ceipalJob.closing_date);
    if (!isNaN(d.getTime())) {
      closingDate = d.toISOString().split("T")[0];
    }
  }

  return {
    jobId: ceipalJob.job_code,
    title: ceipalJob.public_job_title || ceipalJob.job_title || "Untitled Position",
    specialty: ceipalJob.industry || null,
    department: ceipalJob.department || null,
    facility: ceipalJob.client || null,
    city: location.city || null,
    state: location.state || null,
    jobType: ceipalJob.job_type || ceipalJob.employment_type || ceipalJob.tax_terms || null,
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
    // v2 enriched fields
    ceipalPayRates: ceipalPayRates as any,
    ceipalIndustry: ceipalJob.industry || null,
    ceipalClient: ceipalJob.client || null,
    ceipalPrimaryRecruiter: ceipalJob.primary_recruiter || null,
    remoteOpportunities: ceipalJob.remote_opportunities || ceipalJob.remote_job || null,
    closingDate: closingDate,
    primaryRecruiter: null as string | null,
    assignedRecruiter: null as string | null,
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

      // Enrich with v2 job posting details (richer pay/bill rates, client, industry, recruiters).
      // Best-effort: if v2 endpoint unavailable the base v1 data is used unchanged.
      const jobDetailId = cJob.id || cJob.job_code;
      if (jobDetailId) {
        const v2Details = await getCeipalJobPostingDetails(String(jobDetailId));
        if (v2Details) {
          // v2 data wins over v1 list data when present, since it's the authoritative record
          if (v2Details.billRate != null) mapped.billRate = String(v2Details.billRate);
          if (v2Details.payRate != null) mapped.payRate = String(v2Details.payRate);
          if (v2Details.clientName) mapped.facility = v2Details.clientName;
          if (v2Details.title) mapped.title = v2Details.title;
          if (v2Details.industry) mapped.specialty = v2Details.industry;
          if (v2Details.primaryRecruiter) mapped.primaryRecruiter = v2Details.primaryRecruiter;
          if (v2Details.assignedRecruiter) mapped.assignedRecruiter = v2Details.assignedRecruiter;
        }
      }

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

export interface CeipalInterviewDetail {
  interviewId: string;
  submissionId?: string;
  interviewMode?: string;
  interviewOutcome?: string;
  interviewDate?: string;
  scheduledDate?: string;
  recruiterEmail?: string;
  recruiterId?: string;
  [key: string]: any;
}

export interface CeipalPlacementDetail {
  placementId: string;
  jobSeekerId?: string;
  clientBillRate?: string;
  payRateMode?: string;
  placementStatus?: string;
  startDate?: string;
  recruiterEmail?: string;
  recruiterId?: string;
  [key: string]: any;
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
  ceipalUserId?: string;
  teamName?: string;
  businessUnitId?: string;
  ceipalRole?: string;
  reportingTo?: string;
  /** Latest interview detail for this recruiter (from v2 getInterviews) */
  latestInterview?: CeipalInterviewDetail;
  /** Latest placement detail for this recruiter (from v2 getPlacements) */
  latestPlacement?: CeipalPlacementDetail;
  /** v2 enrichment — team/BU from getCeipalUserDetails (nullable if unavailable) */
  team?: string;
  businessUnit?: string;
  /** v2 enrichment — bill/pay rates from placement details */
  billRates?: number[];
  payRates?: number[];
  /** v2 enrichment — interview mode and outcome from getCeipalInterviewDetails */
  interviewDetails?: Array<{ mode?: string; outcome?: string }>;
}

function parsePagedResults(data: any): any[] {
  return Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data) ? data : [];
}

function parseSubmissions(data: any): any[] {
  return parsePagedResults(data);
}

/**
 * Fetch all pages of a Ceipal v2 paginated list endpoint.
 * Stops when a page returns 0 results, a 404, or the page_size is under-filled.
 */
async function fetchCeipalV2Pages(
  baseUrl: string,
  pageSize = 100,
  maxPages = 50
): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}page=${page}&page_size=${pageSize}`;
    let res: Response;
    try {
      res = await fetchWithTokenRetry(url);
    } catch (err: any) {
      console.warn(`[ceipal] fetchCeipalV2Pages page ${page} network error:`, err.message);
      break;
    }
    if (res.status === 404) break;
    if (!res.ok) {
      console.warn(`[ceipal] fetchCeipalV2Pages page ${page} status ${res.status}`);
      break;
    }
    const data = await res.json().catch(() => ({}));
    const rows = parsePagedResults(data);
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

/**
 * Fetch v2 submissions with date filtering (paginated).
 * Replaces the v1 single-page call throughout metrics and compliance.
 */
export async function getCeipalSubmissionsV2(fromDate: string, toDate: string): Promise<any[]> {
  const base = `https://api.ceipal.com/v2/getSubmissions/?from_date=${fromDate}&to_date=${toDate}`;
  return fetchCeipalV2Pages(base);
}

/**
 * Fetch all v2 interviews for the given date range (paginated).
 */
export async function getCeipalInterviews(fromDate: string, toDate: string): Promise<CeipalInterviewDetail[]> {
  const base = `https://api.ceipal.com/v2/getInterviews/?from_date=${fromDate}&to_date=${toDate}`;
  const rows = await fetchCeipalV2Pages(base);
  return rows.map((r: any) => ({
    interviewId: String(r.id ?? r.interview_id ?? ""),
    submissionId: String(r.submission_id ?? r.applicant_id ?? ""),
    interviewMode: r.interview_mode ?? r.mode ?? r.interview_type ?? undefined,
    interviewOutcome: r.interview_outcome ?? r.outcome ?? r.result ?? undefined,
    interviewDate: r.interview_date ?? r.scheduled_date ?? r.date ?? undefined,
    scheduledDate: r.scheduled_date ?? r.interview_date ?? undefined,
    recruiterEmail: (r.recruiter_email ?? r.submitted_by_email ?? r.owner_email ?? "").toLowerCase() || undefined,
    recruiterId: String(r.recruiter_id ?? r.submitted_by_id ?? r.user_id ?? ""),
    ...r,
  }));
}

/**
 * Fetch full interview detail by ID from v2 API.
 */
export async function getCeipalInterviewDetails(interviewId: string): Promise<CeipalInterviewDetail | null> {
  try {
    const url = `https://api.ceipal.com/v2/getInterviewDetails/${interviewId}/`;
    const res = await fetchWithTokenRetry(url);
    if (!res.ok) {
      console.warn(`[ceipal] getCeipalInterviewDetails(${interviewId}): ${res.status}`);
      return null;
    }
    const r = await res.json();
    return {
      interviewId: String(r.id ?? r.interview_id ?? interviewId),
      submissionId: String(r.submission_id ?? r.applicant_id ?? ""),
      interviewMode: r.interview_mode ?? r.mode ?? r.interview_type ?? undefined,
      interviewOutcome: r.interview_outcome ?? r.outcome ?? r.result ?? undefined,
      interviewDate: r.interview_date ?? r.scheduled_date ?? r.date ?? undefined,
      scheduledDate: r.scheduled_date ?? r.interview_date ?? undefined,
      recruiterEmail: (r.recruiter_email ?? r.submitted_by_email ?? "").toLowerCase() || undefined,
      recruiterId: String(r.recruiter_id ?? r.submitted_by_id ?? r.user_id ?? ""),
      ...r,
    };
  } catch (err: any) {
    console.warn(`[ceipal] getCeipalInterviewDetails(${interviewId}) error:`, err.message);
    return null;
  }
}

/**
 * Fetch all v2 placements for the given date range (paginated).
 */
export async function getCeipalPlacements(fromDate: string, toDate: string): Promise<CeipalPlacementDetail[]> {
  const base = `https://api.ceipal.com/v2/getPlacements/?from_date=${fromDate}&to_date=${toDate}`;
  const rows = await fetchCeipalV2Pages(base);
  return rows.map((r: any) => ({
    placementId: String(r.id ?? r.placement_id ?? ""),
    jobSeekerId: String(r.job_seeker_id ?? r.candidate_id ?? r.applicant_id ?? ""),
    clientBillRate: r.client_bill_rate ?? r.bill_rate ?? r.client_bill_rate_salary ?? undefined,
    payRateMode: r.pay_rate_mode ?? r.pay_type ?? r.payment_mode ?? undefined,
    placementStatus: r.placement_status ?? r.status ?? undefined,
    startDate: r.start_date ?? r.placement_date ?? r.joining_date ?? undefined,
    recruiterEmail: (r.recruiter_email ?? r.submitted_by_email ?? r.owner_email ?? "").toLowerCase() || undefined,
    recruiterId: String(r.recruiter_id ?? r.submitted_by_id ?? r.user_id ?? ""),
    ...r,
  }));
}

/**
 * Fetch full placement detail by ID from v2 API.
 */
export async function getCeipalPlacementDetails(placementId: string): Promise<CeipalPlacementDetail | null> {
  try {
    const url = `https://api.ceipal.com/v2/getPlacementDetails/${placementId}/`;
    const res = await fetchWithTokenRetry(url);
    if (!res.ok) {
      console.warn(`[ceipal] getCeipalPlacementDetails(${placementId}): ${res.status}`);
      return null;
    }
    const r = await res.json();
    return {
      placementId: String(r.id ?? r.placement_id ?? placementId),
      jobSeekerId: String(r.job_seeker_id ?? r.candidate_id ?? r.applicant_id ?? ""),
      clientBillRate: r.client_bill_rate ?? r.bill_rate ?? r.client_bill_rate_salary ?? undefined,
      payRateMode: r.pay_rate_mode ?? r.pay_type ?? r.payment_mode ?? undefined,
      placementStatus: r.placement_status ?? r.status ?? undefined,
      startDate: r.start_date ?? r.placement_date ?? r.joining_date ?? undefined,
      recruiterEmail: (r.recruiter_email ?? r.submitted_by_email ?? "").toLowerCase() || undefined,
      recruiterId: String(r.recruiter_id ?? r.submitted_by_id ?? r.user_id ?? ""),
      ...r,
    };
  } catch (err: any) {
    console.warn(`[ceipal] getCeipalPlacementDetails(${placementId}) error:`, err.message);
    return null;
  }
}

/**
 * Known interview stage names from Ceipal ATS.
 * Used instead of loose "includes('interview')" to avoid false positives
 * (e.g. "interview rejected", "post-interview declined").
 */
const INTERVIEW_STAGES = new Set([
  "interview scheduled", "interview", "phone screen", "phone interview",
  "technical interview", "technical screen", "onsite interview", "in-person interview",
  "video interview", "first interview", "second interview", "third interview",
  "final interview", "scheduled",
]);

function isInterviewStage(stage: string): boolean {
  const s = stage.toLowerCase().trim();
  if (INTERVIEW_STAGES.has(s)) return true;
  // Loose match but exclude obvious non-interview stages
  if (s.includes("interview") && !s.includes("reject") && !s.includes("declin") && !s.includes("no show") && !s.includes("withdr")) return true;
  return false;
}

/**
 * Known placement/hire stage names from Ceipal ATS.
 * More precise than the previous loose contains("start") check.
 */
const PLACEMENT_STAGES = new Set([
  "placed", "placement", "active placement", "started", "offer accepted",
  "offer extended", "hired", "background check passed", "onboarding", "day 1",
  "start date confirmed",
]);

function isPlacement(sub: any): boolean {
  const stage = (sub.stage || sub.status || "").toLowerCase().trim();
  if (PLACEMENT_STAGES.has(stage)) return true;
  if (stage.includes("placement") || stage.includes("placed")) return true;
  // "start" only when unambiguous (avoid matching "restart", "started screening", etc.)
  if (stage === "start" || stage === "started") return true;
  return false;
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
    // Fetch rolling 30-day submissions (v2, paginated), YTD submissions, interviews,
    // placements, local admin_user emails, and Ceipal user list in parallel.
    const [monthSubs, ytdSubs, periodSubs, allInterviews, allPlacements, ytdPlacements, localAdminRows, ceipalUserList] = await Promise.all([
      getCeipalSubmissionsV2(monthFromStr, todayStr).catch((err: any) => {
        console.warn("[ceipal] v2 month submissions failed (non-fatal):", err.message);
        return [];
      }),
      getCeipalSubmissionsV2(ytdFromStr, todayStr).catch((err: any) => {
        console.warn("[ceipal] v2 ytd submissions failed (non-fatal):", err.message);
        return [];
      }),
      // Only fetch separately for custom ranges; week/month overlap with monthSubs
      (period === "custom" && customFrom && customTo)
        ? getCeipalSubmissionsV2(periodFrom, periodTo).catch((err: any) => {
            console.warn("[ceipal] v2 period submissions failed (non-fatal):", err.message);
            return [];
          })
        : Promise.resolve(null),
      getCeipalInterviews(monthFromStr, todayStr).catch((err: any) => {
        console.warn("[ceipal] v2 interviews failed (non-fatal):", err.message);
        return [] as CeipalInterviewDetail[];
      }),
      getCeipalPlacements(monthFromStr, todayStr).catch((err: any) => {
        console.warn("[ceipal] v2 placements failed (non-fatal):", err.message);
        return [] as CeipalPlacementDetail[];
      }),
      getCeipalPlacements(ytdFromStr, todayStr).catch((err: any) => {
        console.warn("[ceipal] v2 ytd placements failed (non-fatal):", err.message);
        return [] as CeipalPlacementDetail[];
      }),
      db.select({ id: adminUsers.id, email: adminUsers.email, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
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

    // email → display-name map from local users so recruiter names shown match.
    const localNameMap = new Map<string, string>(
      localAdminRows
        .filter(u => u.email)
        .map(u => [(u.email!).toLowerCase(), `${u.firstName} ${u.lastName}`.trim()])
    );

    // For week/month periods the period window is a subset of monthSubs
    const effectivePeriodSubs: any[] = periodSubs ?? monthSubs;

    const recruiterMap = new Map<string, RecruiterMetric>();

    // Maps for v2 enrichment — populated during submission loops
    // email.lower() → Ceipal numeric user ID (from sub.recruiter_id / sub.submitted_by_id)
    const recruiterCeipalId = new Map<string, string>();
    // email.lower() → set of placement IDs for placed submissions (v2 lookup)
    const recruiterPlacementIds = new Map<string, Set<string>>();
    // email.lower() → fallback count for placed subs with no placement_id in payload
    const recruiterPlacementsFallback = new Map<string, number>();
    // email.lower() → set of interview IDs for interview-stage submissions (v2 lookup)
    const recruiterInterviewIds = new Map<string, Set<string>>();
    // email.lower() → fallback count for interview-stage subs with no interview_id in payload
    const recruiterInterviewsFallback = new Map<string, number>();

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
      // Interview counting: prefer real v2 interview IDs over stage-name guessing.
      // Collect IDs here; v2 enrichment block below resolves the count.
      if (isInterviewStage(stage)) {
        const interviewId = sub.interview_id || sub.interview_code;
        if (rEmail && interviewId) {
          const emailKey = rEmail.toLowerCase();
          if (!recruiterInterviewIds.has(emailKey)) recruiterInterviewIds.set(emailKey, new Set());
          recruiterInterviewIds.get(emailKey)!.add(String(interviewId));
        } else {
          // No v2 interview ID in the payload — use stage detection as fallback
          const emailKey = rEmail.toLowerCase();
          recruiterInterviewsFallback.set(emailKey, (recruiterInterviewsFallback.get(emailKey) ?? 0) + 1);
        }
      }
      // Placement counting: prefer real v2 placement IDs over stage-name guessing.
      // Collect IDs here; v2 enrichment block below resolves the count + bill/pay rates.
      if (isPlacement(sub)) {
        const placementId = sub.placement_id || sub.placement_code;
        if (rEmail && placementId) {
          const emailKey = rEmail.toLowerCase();
          if (!recruiterPlacementIds.has(emailKey)) recruiterPlacementIds.set(emailKey, new Set());
          recruiterPlacementIds.get(emailKey)!.add(String(placementId));
        } else {
          // No v2 placement ID in the payload — use stage detection as fallback
          const emailKey = rEmail.toLowerCase();
          recruiterPlacementsFallback.set(emailKey, (recruiterPlacementsFallback.get(emailKey) ?? 0) + 1);
        }
      }

      // Collect Ceipal user ID for v2 enrichment
      const ceipalUserId = sub.recruiter_id || sub.submitted_by_id;
      if (rEmail && ceipalUserId && !recruiterCeipalId.has(rEmail.toLowerCase())) {
        recruiterCeipalId.set(rEmail.toLowerCase(), String(ceipalUserId));
      }

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

    // ── Build lookup maps for interview/placement attribution ─────────────────
    // Maps Ceipal submission IDs AND job_seeker_ids to the resolved recruiter
    // key (rId) so that interviews/placements can be attributed even when
    // recruiterEmail/recruiterId fields are absent from the v2 record.
    const submissionIdToRecruiterId = new Map<string, string>();
    const jobSeekerIdToRecruiterId = new Map<string, string>();
    for (const sub of monthSubs) {
      const resolved = resolveRecruiter(sub);
      if (!resolved) continue;
      const subId = String(sub.id ?? sub.submission_id ?? "");
      if (subId) submissionIdToRecruiterId.set(subId, resolved.rId);
      const jsId = String(sub.job_seeker_id ?? sub.candidate_id ?? sub.applicant_id ?? "");
      if (jsId) jobSeekerIdToRecruiterId.set(jsId, resolved.rId);
    }

    // ── Process v2 interviews → real interview counts per recruiter ────────────
    // Interviews are attributed to a recruiter via:
    //   (a) interview.recruiterEmail / interview.recruiterId field
    //   (b) interview.submissionId → submission recruiter map
    const recruiterInterviews = new Map<string, CeipalInterviewDetail[]>();
    for (const iv of allInterviews) {
      // Resolve recruiter from interview record
      let ivRecruiterId: string | null = null;
      if (iv.recruiterEmail) {
        const cu = ceipalUserByEmail.get(iv.recruiterEmail.toLowerCase());
        if (cu) {
          ivRecruiterId = cu.id;
        } else if (isLocalRecruiter(iv.recruiterEmail)) {
          ivRecruiterId = iv.recruiterEmail;
        }
      }
      if (!ivRecruiterId && iv.recruiterId) {
        const cu = ceipalUserById.get(iv.recruiterId);
        if (cu) ivRecruiterId = cu.id;
      }
      if (!ivRecruiterId && iv.submissionId) {
        ivRecruiterId = submissionIdToRecruiterId.get(iv.submissionId) ?? null;
      }
      if (!ivRecruiterId) continue;
      if (recruiterId && ivRecruiterId !== recruiterId) continue;
      if (!recruiterInterviews.has(ivRecruiterId)) recruiterInterviews.set(ivRecruiterId, []);
      recruiterInterviews.get(ivRecruiterId)!.push(iv);
    }

    // Apply interview counts and collect the most recent per recruiter for detail fetch
    const interviewDetailFetches: Array<{ rId: string; interviewId: string }> = [];
    for (const [rId, ivList] of recruiterInterviews.entries()) {
      const mExisting = recruiterMap.get(rId);
      if (mExisting) {
        mExisting.interviews = ivList.length;
        // Latest interview = most recent by date
        const sorted = [...ivList].sort((a, b) =>
          (b.interviewDate ?? "").localeCompare(a.interviewDate ?? "")
        );
        if (sorted[0]) {
          mExisting.latestInterview = sorted[0]; // list-row data (always shown even if detail fails)
          interviewDetailFetches.push({ rId, interviewId: sorted[0].interviewId });
        }
      }
    }
    // Enrich latest interview with authoritative detail records (non-fatal)
    if (interviewDetailFetches.length > 0) {
      const ivDetailResults = await Promise.allSettled(
        interviewDetailFetches.map(({ rId, interviewId }) =>
          getCeipalInterviewDetails(interviewId).then(detail => ({ rId, detail }))
        )
      );
      for (const result of ivDetailResults) {
        if (result.status === "fulfilled" && result.value.detail) {
          const m = recruiterMap.get(result.value.rId);
          if (m) m.latestInterview = result.value.detail;
        }
      }
    }

    // ── Process v2 placements → real placement counts per recruiter ────────────
    // Attribution priority: (a) recruiterEmail/recruiterId on record, then
    // (b) jobSeekerId → submission recruiter map (cross-reference via candidate).
    const recruiterPlacements = new Map<string, CeipalPlacementDetail[]>();
    for (const pl of allPlacements) {
      let plRecruiterId: string | null = null;
      if (pl.recruiterEmail) {
        const cu = ceipalUserByEmail.get(pl.recruiterEmail.toLowerCase());
        if (cu) {
          plRecruiterId = cu.id;
        } else if (isLocalRecruiter(pl.recruiterEmail)) {
          plRecruiterId = pl.recruiterEmail;
        }
      }
      if (!plRecruiterId && pl.recruiterId) {
        const cu = ceipalUserById.get(pl.recruiterId);
        if (cu) plRecruiterId = cu.id;
      }
      // Fallback: jobSeekerId → recruiter via submissions cross-reference
      if (!plRecruiterId && pl.jobSeekerId) {
        plRecruiterId = jobSeekerIdToRecruiterId.get(pl.jobSeekerId) ?? null;
      }
      if (!plRecruiterId) continue;
      if (recruiterId && plRecruiterId !== recruiterId) continue;
      if (!recruiterPlacements.has(plRecruiterId)) recruiterPlacements.set(plRecruiterId, []);
      recruiterPlacements.get(plRecruiterId)!.push(pl);
    }

    // Collect latest placement per recruiter, then fetch authoritative detail records
    const placementDetailFetches: Array<{ rId: string; placementId: string }> = [];
    for (const [rId, plList] of recruiterPlacements.entries()) {
      const mExisting = recruiterMap.get(rId);
      if (mExisting) {
        mExisting.placements = plList.length;
        const sorted = [...plList].sort((a, b) =>
          (b.startDate ?? "").localeCompare(a.startDate ?? "")
        );
        if (sorted[0]) {
          mExisting.latestPlacement = sorted[0]; // list-row data (always shown even if detail fails)
          placementDetailFetches.push({ rId, placementId: sorted[0].placementId });
        }
      }
    }
    // Enrich with authoritative detail records (non-fatal — list-row data already set)
    if (placementDetailFetches.length > 0) {
      const detailResults = await Promise.allSettled(
        placementDetailFetches.map(({ rId, placementId }) =>
          getCeipalPlacementDetails(placementId).then(detail => ({ rId, detail }))
        )
      );
      for (const result of detailResults) {
        if (result.status === "fulfilled" && result.value.detail) {
          const m = recruiterMap.get(result.value.rId);
          if (m) m.latestPlacement = result.value.detail;
        }
      }
    }

    // ── Process YTD placements → placementsYTD ────────────────────────────────
    for (const pl of ytdPlacements) {
      let plRecruiterId: string | null = null;
      if (pl.recruiterEmail) {
        const cu = ceipalUserByEmail.get(pl.recruiterEmail.toLowerCase());
        if (cu) {
          plRecruiterId = cu.id;
        } else if (isLocalRecruiter(pl.recruiterEmail)) {
          plRecruiterId = pl.recruiterEmail;
        }
      }
      if (!plRecruiterId && pl.recruiterId) {
        const cu = ceipalUserById.get(pl.recruiterId);
        if (cu) plRecruiterId = cu.id;
      }
      if (!plRecruiterId && pl.jobSeekerId) {
        plRecruiterId = jobSeekerIdToRecruiterId.get(pl.jobSeekerId) ?? null;
      }
      if (!plRecruiterId) continue;
      if (recruiterId && plRecruiterId !== recruiterId) continue;
      const mExisting = recruiterMap.get(plRecruiterId);
      if (mExisting) mExisting.placementsYTD++;
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

    // ── Ceipal v2 enrichment — team/BU + interviews + placement bill/pay rates ──
    // Best-effort: uses v2 helpers added in this release. If the Ceipal account
    // does not expose v2 endpoints the helpers return null and metrics are unchanged.
    if (recruiterMap.size > 0) {
      await Promise.allSettled([
        // 1. Enrich each recruiter with team and business unit (from v2 user details)
        ...Array.from(recruiterMap.values()).map(async (m) => {
          const ceipalId = recruiterCeipalId.get((m.email || "").toLowerCase());
          if (!ceipalId) return;
          const details = await getCeipalUserDetails(ceipalId);
          if (!details) return;
          if (details.team) m.team = details.team;
          if (details.businessUnit) m.businessUnit = details.businessUnit;
        }),

        // 2. Resolve interview counts using real v2 interview records.
        //    For each recruiter that has actual interview IDs collected from submissions,
        //    fetch the v2 detail and count only confirmed records. Submissions with an
        //    interview-stage label but no interview_id fall back to stage-detection count.
        ...Array.from(recruiterInterviewIds.entries()).map(async ([emailKey, ids]) => {
          const m = Array.from(recruiterMap.values()).find(r => (r.email || "").toLowerCase() === emailKey);
          if (!m) return;
          const interviewResults = await Promise.allSettled(
            Array.from(ids).slice(0, 20).map(iid => getCeipalInterviewDetails(iid))
          );
          const confirmed: Array<{ mode?: string; outcome?: string }> = [];
          for (const r of interviewResults) {
            if (r.status === "fulfilled" && r.value) {
              confirmed.push({ mode: r.value.type, outcome: r.value.status });
            }
          }
          // Real v2 count replaces the stage-guess count; add fallback for subs with no ID
          const fallback = recruiterInterviewsFallback.get(emailKey) ?? 0;
          m.interviews = confirmed.length + fallback;
          if (confirmed.length > 0) m.interviewDetails = confirmed;
        }),

        // 3. Apply fallback interview counts for recruiters with NO v2 interview IDs at all
        //    (entire account may not expose interview_id in submission payloads).
        ...Array.from(recruiterInterviewsFallback.entries())
          .filter(([emailKey]) => !recruiterInterviewIds.has(emailKey))
          .map(([emailKey, count]) => {
            const m = Array.from(recruiterMap.values()).find(r => (r.email || "").toLowerCase() === emailKey);
            if (m) m.interviews = count;
          }),

        // 4. Resolve placement counts using real v2 placement records.
        //    For each recruiter with actual placement IDs, fetch v2 detail for confirmation.
        //    Submissions with a placed-stage label but no placement_id fall back to stage-detection count.
        ...Array.from(recruiterPlacementIds.entries()).map(async ([emailKey, ids]) => {
          const m = Array.from(recruiterMap.values()).find(r => (r.email || "").toLowerCase() === emailKey);
          if (!m) return;
          const placementResults = await Promise.allSettled(
            Array.from(ids).slice(0, 10).map(pid => getCeipalPlacementDetails(pid))
          );
          const billRates: number[] = [];
          const payRates: number[] = [];
          let confirmedCount = 0;
          for (const r of placementResults) {
            if (r.status === "fulfilled" && r.value) {
              confirmedCount++;
              if (r.value.billRate != null) billRates.push(r.value.billRate);
              if (r.value.payRate != null) payRates.push(r.value.payRate);
            }
          }
          // Real v2 count replaces the stage-guess count; add fallback for subs with no ID
          const fallback = recruiterPlacementsFallback.get(emailKey) ?? 0;
          m.placements = confirmedCount + fallback;
          if (billRates.length > 0) m.billRates = billRates;
          if (payRates.length > 0) m.payRates = payRates;
        }),

        // 5. Apply fallback placement counts for recruiters with NO v2 placement IDs at all
        //    (entire account may not expose placement_id in submission payloads).
        ...Array.from(recruiterPlacementsFallback.entries())
          .filter(([emailKey]) => !recruiterPlacementIds.has(emailKey))
          .map(([emailKey, count]) => {
            const m = Array.from(recruiterMap.values()).find(r => (r.email || "").toLowerCase() === emailKey);
            if (m) m.placements = count;
          }),
      ]);
    }
    // ── end Ceipal v2 enrichment ───────────────────────────────────────────────

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
