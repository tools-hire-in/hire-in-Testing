import { db } from "./db";
import { jobs, applications } from "@shared/schema";
import { eq } from "drizzle-orm";

const CEIPAL_AUTH_URL = "https://api.ceipal.com/v1/createAuthtoken";
const CEIPAL_REFRESH_URL = "https://api.ceipal.com/v1/refreshToken/";

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;
let isSyncing = false;

function parseXmlToken(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return match ? match[1] : null;
}

function parseTokenResponse(text: string): { access_token?: string; refresh_token?: string } {
  try {
    return JSON.parse(text);
  } catch {
    return {
      access_token: parseXmlToken(text, "access_token") || undefined,
      refresh_token: parseXmlToken(text, "refresh_token") || undefined,
    };
  }
}

async function authenticate(): Promise<string> {
  const now = Date.now();
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
          tokenExpiresAt = now + 55 * 60 * 1000;
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

  const res = await fetch(CEIPAL_AUTH_URL, {
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
  tokenExpiresAt = now + 55 * 60 * 1000;

  return cachedToken;
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

export async function fetchCeipalJobs(): Promise<CeipalJob[]> {
  const endpoint = process.env.CEIPAL_JOBS_ENDPOINT;
  if (!endpoint) {
    throw new Error("CEIPAL_JOBS_ENDPOINT not configured");
  }

  const token = await authenticate();

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ceipal jobs fetch failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();

  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.results)) {
    return data.results;
  }

  return [];
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
    isActive: true,
    isHot: false,
    rawData: ceipalJob,
    source: "ceipal" as const,
    ceipalJobCode: ceipalJob.job_code,
    ceipalJobId: ceipalJob.id,
  };
}

export async function syncCeipalJobs(): Promise<{ created: number; updated: number; total: number }> {
  if (isSyncing) {
    throw new Error("A Ceipal sync is already in progress");
  }

  isSyncing = true;
  try {
    const ceipalJobs = await fetchCeipalJobs();
    let created = 0;
    let updated = 0;

    for (const cJob of ceipalJobs) {
      if (!cJob.job_code) continue;
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

    return { created, updated, total: ceipalJobs.length };
  } finally {
    isSyncing = false;
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

    const applicantData: Record<string, any> = {
      first_name: firstName,
      last_name: lastName,
      email: application.email,
      phone: application.phone || "",
      current_employer: application.currentEmployer || "",
      experience: application.yearsExperience ? `${application.yearsExperience} years` : "",
      linkedin_url: application.linkedinUrl || "",
      source: "Website",
    };

    if (ceipalJobId) {
      applicantData.job_id = ceipalJobId;
    }

    const token = await authenticate();

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(applicantData),
    });

    const responseText = await res.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (res.ok) {
      const ceipalApplicantId = responseData?.id || responseData?.applicant_id || null;

      await db.update(applications)
        .set({
          ceipalSyncStatus: "synced",
          ceipalApplicantId: ceipalApplicantId ? String(ceipalApplicantId) : null,
          updatedAt: new Date(),
        })
        .where(eq(applications.id, applicationId));

      return { success: true, ceipalId: ceipalApplicantId ? String(ceipalApplicantId) : undefined };
    } else {
      console.error("Ceipal applicant push failed:", res.status, responseData);

      await db.update(applications)
        .set({
          ceipalSyncStatus: "failed",
          updatedAt: new Date(),
        })
        .where(eq(applications.id, applicationId));

      return { success: false, error: `Ceipal returned ${res.status}: ${JSON.stringify(responseData)}` };
    }
  } catch (err: any) {
    console.error("Ceipal applicant push error:", err);

    await db.update(applications)
      .set({
        ceipalSyncStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId));

    return { success: false, error: err.message };
  }
}
