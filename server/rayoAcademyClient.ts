import { db } from "./db";
import { systemSettings, learningTracks, trackAssignments, trackSections, sectionProgress, sectionAcknowledgements, trackCompletions, adminUsers } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export interface RayoTrack {
  id: string;
  title: string;
  description: string;
  category: string;
  estimatedHours: number;
  status: string;
}

export interface RayoAssignment {
  id: string;
  trackId: string;
  trackTitle: string;
  trackDescription: string;
  userId: string;
  status: string;
  progressPct: number;
  dueDate: string | null;
  completedAt: string | null;
  certificateUrl: string | null;
  totalSections: number;
  completedSections: number;
}

export interface RayoTeamProgress {
  tracks: { id: string; title: string }[];
  matrix: {
    user: { id: string; firstName: string; lastName: string; email: string; role: string; employeeId: string | null };
    trackProgress: {
      trackId: string;
      trackTitle: string;
      status: string;
      progressPct: number;
      dueDate: string | null;
      completedAt: string | null;
      assignmentId?: string;
    }[];
  }[];
}

export interface RayoComplianceStatus {
  locked: boolean;
  overdueCount: number;
  trackTitles: string[];
}

export interface RayoProvisionResult {
  success: boolean;
  rayoUserId?: string;
  tempPassword?: string;
  error?: string;
}

export interface RayoTrackProgress {
  trackId: string;
  progressPct: number;
  status: string;
}

async function getRayoSettings(): Promise<{ enabled: boolean; apiUrl: string; apiKey: string }> {
  try {
    const [enabledSetting] = await db.select().from(systemSettings).where(eq(systemSettings.key, "rayo_academy_enabled"));
    const [urlSetting] = await db.select().from(systemSettings).where(eq(systemSettings.key, "rayo_academy_api_url"));
    const [keySetting] = await db.select().from(systemSettings).where(eq(systemSettings.key, "rayo_academy_api_key"));

    return {
      enabled: enabledSetting?.value === true || enabledSetting?.value === "true",
      apiUrl: (urlSetting?.value as string) || "",
      apiKey: (keySetting?.value as string) || "",
    };
  } catch {
    return { enabled: false, apiUrl: "", apiKey: "" };
  }
}

async function rayoFetch(path: string, options: { method?: string; body?: any } = {}): Promise<Response | null> {
  const settings = await getRayoSettings();
  if (!settings.enabled || !settings.apiUrl || !settings.apiKey) {
    return null;
  }

  try {
    const url = `${settings.apiUrl.replace(/\/$/, "")}${path}`;
    const res = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    return res;
  } catch (err) {
    console.error(`Rayo Academy API call failed: ${path}`, err);
    return null;
  }
}

export async function isRayoEnabled(): Promise<boolean> {
  const settings = await getRayoSettings();
  return settings.enabled && !!settings.apiUrl && !!settings.apiKey;
}

export async function provisionRayoUser(email: string, firstName: string, lastName: string, role: string): Promise<RayoProvisionResult> {
  const res = await rayoFetch("/api/v1/users/provision", {
    method: "POST",
    body: { email, firstName, lastName, role },
  });

  if (res && res.ok) {
    const data = await res.json();
    return {
      success: true,
      rayoUserId: data.userId,
      tempPassword: data.tempPassword,
    };
  }

  return {
    success: false,
    error: res ? `API returned ${res.status}` : "Rayo Academy API unavailable",
  };
}

export async function deactivateRayoUser(email: string): Promise<boolean> {
  const res = await rayoFetch("/api/v1/users/deactivate", {
    method: "POST",
    body: { email },
  });
  return res?.ok === true;
}

export async function getRayoTracks(): Promise<{ tracks: RayoTrack[]; fromApi: boolean }> {
  const res = await rayoFetch("/api/v1/tracks");

  if (res && res.ok) {
    const data = await res.json();
    return { tracks: data.tracks || data, fromApi: true };
  }

  const localTracks = await db.select().from(learningTracks)
    .where(eq(learningTracks.status, "published"))
    .orderBy(learningTracks.createdAt);

  return {
    tracks: localTracks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
      category: t.targetRole || "general",
      estimatedHours: 0,
      status: t.status,
    })),
    fromApi: false,
  };
}

export async function getRayoUserAssignments(userId: string): Promise<{ assignments: RayoAssignment[]; fromApi: boolean }> {
  const [user] = await db.select({ email: adminUsers.email }).from(adminUsers).where(eq(adminUsers.id, userId));
  if (!user) return { assignments: [], fromApi: false };

  const res = await rayoFetch(`/api/v1/users/${encodeURIComponent(user.email)}/assignments`);

  if (res && res.ok) {
    const data = await res.json();
    return { assignments: data.assignments || data, fromApi: true };
  }

  const assignments = await db.select({
    assignment: trackAssignments,
    track: learningTracks,
  }).from(trackAssignments)
    .innerJoin(learningTracks, eq(learningTracks.id, trackAssignments.trackId))
    .where(eq(trackAssignments.userId, userId));

  const enriched = await Promise.all(assignments.map(async ({ assignment, track }) => {
    const sections = await db.select({ id: trackSections.id })
      .from(trackSections).where(eq(trackSections.trackId, track.id));
    const total = sections.length;
    const completedProgress = await db.select().from(sectionProgress)
      .where(and(
        eq(sectionProgress.assignmentId, assignment.id),
        eq(sectionProgress.status, "completed")
      ));

    const [completion] = await db.select().from(trackCompletions)
      .where(eq(trackCompletions.assignmentId, assignment.id));

    return {
      id: assignment.id,
      trackId: track.id,
      trackTitle: track.title,
      trackDescription: track.description || "",
      userId: assignment.userId,
      status: assignment.status,
      progressPct: total > 0 ? Math.round((completedProgress.length / total) * 100) : 0,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString() : null,
      completedAt: assignment.completedAt ? new Date(assignment.completedAt).toISOString() : null,
      certificateUrl: null,
      totalSections: total,
      completedSections: completedProgress.length,
    };
  }));

  return { assignments: enriched, fromApi: false };
}

export async function assignRayoTrack(userEmail: string, trackId: string, dueDate?: string): Promise<{ success: boolean; error?: string }> {
  const res = await rayoFetch("/api/v1/assignments", {
    method: "POST",
    body: { userEmail, trackId, dueDate },
  });

  if (res && res.ok) {
    return { success: true };
  }

  return {
    success: false,
    error: res ? `API returned ${res.status}` : "Rayo Academy API unavailable",
  };
}

export async function getRayoTeamProgress(userIds: string[]): Promise<{ data: RayoTeamProgress | null; fromApi: boolean }> {
  const users = await db.select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers).where(inArray(adminUsers.id, userIds));
  const emailMap = Object.fromEntries(users.map(u => [u.id, u.email]));
  const emails = users.map(u => u.email);

  const res = await rayoFetch("/api/v1/team/progress", {
    method: "POST",
    body: { userEmails: emails, userIds },
  });

  if (res && res.ok) {
    const data = await res.json();
    return { data, fromApi: true };
  }

  return { data: null, fromApi: false };
}

export async function getRayoComplianceStatus(userEmail: string): Promise<{ status: RayoComplianceStatus | null; fromApi: boolean }> {
  const res = await rayoFetch(`/api/v1/users/${encodeURIComponent(userEmail)}/compliance`);

  if (res && res.ok) {
    const data = await res.json();
    return { status: data, fromApi: true };
  }

  return { status: null, fromApi: false };
}

export async function getRayoTrackProgress(trackId: string, userEmail: string): Promise<RayoTrackProgress | null> {
  const res = await rayoFetch(`/api/v1/tracks/${trackId}/progress/${encodeURIComponent(userEmail)}`);

  if (res && res.ok) {
    const data = await res.json();
    return data;
  }

  return null;
}

export async function getRayoCertificates(userEmail: string): Promise<{ certificates: any[]; fromApi: boolean }> {
  const res = await rayoFetch(`/api/v1/users/${encodeURIComponent(userEmail)}/certificates`);

  if (res && res.ok) {
    const data = await res.json();
    return { certificates: data.certificates || data, fromApi: true };
  }

  return { certificates: [], fromApi: false };
}
