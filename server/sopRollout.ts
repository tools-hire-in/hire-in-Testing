// ─────────────────────────────────────────────────────────────────────────────
// SOP wave rollout & enforcement engine (Task #662)
//
// Operationalizes the successive wave rollout (Wave 0-5) of the SOP launch
// playbook. A wave is a phase; its member SOPs are made "operational" one or two
// at a time to honor the "max 2 operational SOPs per week" cadence guardrail.
// Enforcement escalates per wave: 'soft' shows a coaching banner, 'measured'
// adds audit visibility (no lock), and 'full' folds overdue un-acknowledged
// operational SOPs into the existing training compliance lock (Wave 5
// milestone). Every employee-facing surface and the compliance integration are gated by
// resolveSopAccessForUser so users outside the rollout pilot are never affected.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./db";
import { storage } from "./storage";
import { rolloutWaves, waveSops, sopDocuments, sopRoleAssignments, waveScheduledLaunches, waveReadinessSignals, adminUsers } from "@shared/schema";
import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";

// ── Governance cadence helpers ────────────────────────────────────────────────
// Read a numeric governance setting from system_settings at call time, falling
// back to the supplied constant when the key is missing or unreadable. This
// keeps the hardcoded constants as a safe fallback so behaviour is identical if
// no one has ever changed the setting.
async function getGovernanceIntSetting(key: string, fallback: number): Promise<number> {
  try {
    const row = await storage.getSystemSetting(key);
    if (row?.value !== undefined && row.value !== null) {
      const n = parseInt(String(row.value), 10);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  } catch { /* ignore — use fallback */ }
  return fallback;
}

// Lifecycle states at which a SOP is "live enough" to create employee obligations.
const IMPACTING_STATUSES = ["published", "training_assigned", "acknowledged", "active"];

// Cadence guardrail: no more than this many operational SOP activations within
// the same calendar week (foundation wave 0 is always-on and exempt).
export const CADENCE_MAX_PER_WEEK = 2;

// Grace period (days) after a SOP becomes operational before a missing
// acknowledgment is treated as overdue for full enforcement.
export const SOP_ACK_GRACE_DAYS = 15;

// Enforcement modes per the playbook: soft = coaching banner only;
// measured = coaching + audit (no lock); full = compliance lock on overdue acks.
export type WaveEnforcement = "soft" | "measured" | "full";
export type WaveStatus = "planned" | "active" | "completed";

// Single source of truth for the playbook waves + memberships (Task #662).
// Wave 0 is the always-on foundation/governance set; waves 1-5 roll out
// successively. Wave 5 carries the remaining SOPs as the full-enforcement
// milestone. Codes reconciled against the seeded 21-SOP library.
export interface WaveDef {
  waveNumber: number;
  name: string;
  description: string;
  audience: string;
  // Default enforcement mode this wave seeds with.
  enforcement: WaveEnforcement;
  sops: string[];
  // When true, the wave's membership is "all active SOPs" — resolved
  // dynamically at seed time from the SOP library rather than a fixed list.
  allActiveSops?: boolean;
}

export const WAVE_DEFS: WaveDef[] = [
  {
    waveNumber: 0,
    name: "Foundation & Governance",
    description: "Always-on governance, HR linkage, and audit backbone. Available from day one.",
    audience: "All employees",
    enforcement: "soft",
    sops: ["GOV-001", "HR-001", "AUDIT-001"],
  },
  {
    waveNumber: 1,
    name: "Core Recruitment & Operations",
    description: "Requisition intake, core TA workflows, tool access control, and sales motion.",
    audience: "Recruitment, Operations & Sales",
    enforcement: "soft",
    sops: ["REQ-001", "TA-001", "TA-003", "OPS-001", "SALES-001"],
  },
  {
    waveNumber: 2,
    name: "Delivery & Client Experience",
    description: "Submission/interview flows, healthcare compliance, client experience, and platform ops.",
    audience: "Delivery, Healthcare & Client teams",
    enforcement: "soft",
    sops: ["TA-002", "TA-004", "HC-001", "CX-001", "PLAT-001"],
  },
  {
    waveNumber: 3,
    name: "Growth & Engineering",
    description: "Marketing, business development, and engineering practices.",
    audience: "Marketing, BD & Engineering",
    enforcement: "measured",
    sops: ["MKT-001", "BD-001", "ENG-001"],
  },
  {
    waveNumber: 4,
    name: "Corporate & Enablement",
    description: "Legal, finance controls, training curriculum, and field templates.",
    audience: "Legal, Finance & Enablement",
    enforcement: "measured",
    sops: ["LEGAL-001", "FIN-001", "TRAIN-001", "TPL-001"],
  },
  {
    waveNumber: 5,
    name: "Full Enforcement",
    description: "Org-wide full-enforcement milestone — every active SOP becomes mandatory.",
    audience: "All employees",
    enforcement: "full",
    sops: [],
    allActiveSops: true,
  },
];

// Resolve the full membership for a wave at seed time. Wave 5 ("all active
// SOPs") expands to every current SOP code in the library.
export async function resolveWaveMembership(def: WaveDef): Promise<string[]> {
  if (!def.allActiveSops) return def.sops;
  const docs = await db
    .select({ code: sopDocuments.sopMasterId })
    .from(sopDocuments)
    .where(eq(sopDocuments.isCurrent, true));
  return Array.from(new Set(docs.map((d) => d.code)));
}

// ── Rollout scope (two-tier gate, shared with routes.ts) ─────────────────────
export interface SopRolloutScope {
  mode: "pilot" | "all";
  roles: string[];
  userIds: string[];
}

export async function getSopRolloutScope(): Promise<SopRolloutScope> {
  const setting = await storage.getSystemSetting("process_governance_rollout");
  const raw = (setting?.value as Partial<SopRolloutScope>) || {};
  return {
    mode: raw.mode === "all" ? "all" : "pilot",
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    userIds: Array.isArray(raw.userIds) ? raw.userIds : [],
  };
}

export async function resolveSopAccessForUser(
  userId: string | undefined,
  role: string | undefined,
): Promise<{ masterOn: boolean; enabled: boolean; rollout: SopRolloutScope }> {
  const flagSetting = await storage.getSystemSetting("feature_flags");
  const flags = (flagSetting?.value as Record<string, boolean>) || {};
  const masterOn = flags.process_governance === true;
  const rollout = await getSopRolloutScope();
  let enabled = false;
  if (masterOn) {
    if (role === "super_admin" || role === "admin") enabled = true;
    else if (rollout.mode === "all") enabled = true;
    else if (role && rollout.roles.includes(role)) enabled = true;
    else if (userId && rollout.userIds.includes(userId)) enabled = true;
  }
  return { masterOn, enabled, rollout };
}

// ── Wave read model ──────────────────────────────────────────────────────────
export interface WaveSopRow {
  sopMasterId: string;
  sopId: string | null;
  code: string;
  title: string | null;
  category: string | null;
  lifecycleStatus: string | null;
  operational: boolean;
  operationalAt: Date | null;
}

export interface WaveView {
  waveNumber: number;
  name: string;
  description: string | null;
  audience: string | null;
  status: WaveStatus;
  enforcement: WaveEnforcement;
  activatedAt: Date | null;
  sops: WaveSopRow[];
  operationalCount: number;
  totalCount: number;
}

export async function getWavesWithSops(): Promise<{ waves: WaveView[]; cadence: { windowCount: number; max: number } }> {
  const waves = await db.select().from(rolloutWaves).orderBy(rolloutWaves.waveNumber);
  const memberships = await db.select().from(waveSops);
  const codes = Array.from(new Set(memberships.map((m) => m.sopMasterId)));
  const docs = codes.length
    ? await db.select().from(sopDocuments).where(and(eq(sopDocuments.isCurrent, true), inArray(sopDocuments.sopMasterId, codes)))
    : [];
  const docByMaster = new Map(docs.map((d) => [d.sopMasterId, d]));

  const views: WaveView[] = waves.map((w) => {
    const members = memberships.filter((m) => m.waveNumber === w.waveNumber);
    const sops: WaveSopRow[] = members.map((m) => {
      const doc = docByMaster.get(m.sopMasterId);
      return {
        sopMasterId: m.sopMasterId,
        sopId: doc?.id ?? null,
        code: m.sopMasterId,
        title: doc?.title ?? null,
        category: doc?.category ?? null,
        lifecycleStatus: doc?.lifecycleStatus ?? null,
        operational: !!m.operationalAt,
        operationalAt: m.operationalAt ?? null,
      };
    }).sort((a, b) => a.code.localeCompare(b.code));
    return {
      waveNumber: w.waveNumber,
      name: w.name,
      description: w.description,
      audience: w.audience ?? null,
      status: w.status as WaveStatus,
      enforcement: w.enforcement as WaveEnforcement,
      activatedAt: w.activatedAt ?? null,
      sops,
      operationalCount: sops.filter((s) => s.operational).length,
      totalCount: sops.length,
    };
  });

  const cadenceMax = await getGovernanceIntSetting("governance_sop_cadence_max_per_week", CADENCE_MAX_PER_WEEK);
  return { waves: views, cadence: { windowCount: await cadenceWindowCount(), max: cadenceMax } };
}

// Start of the current calendar week (Monday 00:00 local time).
function startOfCalendarWeek(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

// Count operational activations (excluding the always-on foundation wave 0)
// within the current calendar week — the basis for the cadence guardrail.
export async function cadenceWindowCount(): Promise<number> {
  const since = startOfCalendarWeek();
  const rows = await db
    .select({ id: waveSops.id })
    .from(waveSops)
    .where(and(gte(waveSops.waveNumber, 1), gte(waveSops.operationalAt, since)));
  return rows.length;
}

// ── Wave mutations ───────────────────────────────────────────────────────────
export async function activateWave(waveNumber: number, userId: string): Promise<void> {
  await db
    .update(rolloutWaves)
    .set({ status: "active", activatedAt: new Date(), activatedBy: userId, updatedAt: new Date() })
    .where(eq(rolloutWaves.waveNumber, waveNumber));
}

// Member SOP master IDs (codes) of a wave — used when activating a wave to
// publish its SOPs into the training-assignment lifecycle.
export async function getWaveMemberMasterIds(waveNumber: number): Promise<string[]> {
  const rows = await db
    .select({ code: waveSops.sopMasterId })
    .from(waveSops)
    .where(eq(waveSops.waveNumber, waveNumber));
  return rows.map((r) => r.code);
}

export async function updateWave(
  waveNumber: number,
  updates: { status?: WaveStatus; enforcement?: WaveEnforcement },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.status) set.status = updates.status;
  if (updates.enforcement) set.enforcement = updates.enforcement;
  await db.update(rolloutWaves).set(set).where(eq(rolloutWaves.waveNumber, waveNumber));
}

export interface ActivateSopResult {
  ok: boolean;
  cadenceBlocked?: boolean;
  windowCount?: number;
  error?: string;
  overridden?: boolean;
}

// Make a single SOP operational within its wave, enforcing the cadence guardrail.
// When force is true an admin may override the ≤2/week cap (the override is
// reported back so the route can audit-log it).
export async function activateSop(
  waveNumber: number,
  code: string,
  userId: string,
  force = false,
): Promise<ActivateSopResult> {
  const [wave] = await db.select().from(rolloutWaves).where(eq(rolloutWaves.waveNumber, waveNumber));
  if (!wave) return { ok: false, error: "Wave not found" };
  if (wave.status !== "active") return { ok: false, error: "Activate the wave before making its SOPs operational" };

  const [member] = await db
    .select()
    .from(waveSops)
    .where(and(eq(waveSops.waveNumber, waveNumber), eq(waveSops.sopMasterId, code)));
  if (!member) return { ok: false, error: "SOP is not a member of this wave" };
  if (member.operationalAt) return { ok: true }; // already operational — idempotent

  const windowCount = await cadenceWindowCount();
  const cadenceMax = await getGovernanceIntSetting("governance_sop_cadence_max_per_week", CADENCE_MAX_PER_WEEK);
  let overridden = false;
  if (waveNumber >= 1 && windowCount >= cadenceMax) {
    if (!force) return { ok: false, cadenceBlocked: true, windowCount };
    overridden = true;
  }

  await db
    .update(waveSops)
    .set({ operationalAt: new Date(), operationalBy: userId })
    .where(eq(waveSops.id, member.id));
  return { ok: true, overridden, windowCount: windowCount + 1 };
}

// ── Employee-facing assignment view + enforcement helpers ────────────────────
export interface MySopAssignment {
  sopId: string;
  sopMasterId: string;
  code: string;
  title: string;
  category: string;
  lifecycleStatus: string;
  version: number;
  learningTrackId: string | null;
  trainingCompletedAt: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedCurrentVersion: boolean;
  waveNumber: number | null;
  waveStatus: WaveStatus | null;
  enforcement: WaveEnforcement | null;
  operational: boolean;
  operationalAt: Date | null;
  dueAt: Date | null;
  overdue: boolean;
  state: "queued" | "training_pending" | "ready" | "acknowledged";
  evidenceText: string | null;
  evidenceFileUrl: string | null;
  evidenceDescription: string | null;
  // Quiz fields (Task #1419)
  quizRequired: boolean;
  quizPassed: boolean;
  quizAttempts: number;
  quizPassedAt: Date | null;
}

async function buildAssignmentRows(userId: string, role?: string): Promise<MySopAssignment[]> {
  const progress = await storage.getSopEmployeeProgressForUser(userId);
  if (progress.length === 0) return [];
  const masterIds = Array.from(new Set(progress.map((p) => p.sopMasterId)));

  const docs = await db
    .select()
    .from(sopDocuments)
    .where(and(eq(sopDocuments.isCurrent, true), inArray(sopDocuments.sopMasterId, masterIds)));
  const docByMaster = new Map(docs.map((d) => [d.sopMasterId, d]));

  // Fetch role assignments for evidenceDescription (per user's role).
  const roleAssignmentRows = role
    ? await db.select().from(sopRoleAssignments).where(
        and(inArray(sopRoleAssignments.sopMasterId, masterIds), eq(sopRoleAssignments.role, role))
      )
    : [];
  const evidenceDescByMaster = new Map(roleAssignmentRows.map((r) => [r.sopMasterId, r.evidenceDescription ?? null]));

  const members = await db.select().from(waveSops).where(inArray(waveSops.sopMasterId, masterIds));
  const waveNumbers = Array.from(new Set(members.map((m) => m.waveNumber)));
  const waves = waveNumbers.length
    ? await db.select().from(rolloutWaves).where(inArray(rolloutWaves.waveNumber, waveNumbers))
    : [];
  const waveByNumber = new Map(waves.map((w) => [w.waveNumber, w]));

  // A SOP can belong to multiple waves (its launch wave AND the Wave 5
  // full-enforcement milestone). Resolve, per SOP, the membership that drives
  // the employee's current obligation: prefer the operational membership whose
  // wave is active with the strongest enforcement; otherwise the lowest wave
  // (its launch wave) for display.
  const ENFORCEMENT_RANK: Record<WaveEnforcement, number> = { soft: 0, measured: 1, full: 2 };
  const membersByMaster = new Map<string, typeof members>();
  for (const m of members) {
    const list = membersByMaster.get(m.sopMasterId) ?? [];
    list.push(m);
    membersByMaster.set(m.sopMasterId, list);
  }
  const resolveMembership = (masterId: string) => {
    const list = membersByMaster.get(masterId) ?? [];
    if (list.length === 0) return undefined;
    const operationalActive = list.filter((m) => m.operationalAt && waveByNumber.get(m.waveNumber)?.status === "active");
    if (operationalActive.length > 0) {
      return operationalActive.sort((a, b) => {
        const ra = ENFORCEMENT_RANK[(waveByNumber.get(a.waveNumber)?.enforcement as WaveEnforcement) ?? "soft"];
        const rb = ENFORCEMENT_RANK[(waveByNumber.get(b.waveNumber)?.enforcement as WaveEnforcement) ?? "soft"];
        return rb - ra; // strongest enforcement first
      })[0];
    }
    return list.slice().sort((a, b) => a.waveNumber - b.waveNumber)[0]; // launch wave
  };

  const sopGraceDays = await getGovernanceIntSetting("governance_sop_grace_days", SOP_ACK_GRACE_DAYS);
  const now = Date.now();
  const rows: MySopAssignment[] = [];
  for (const p of progress) {
    const doc = docByMaster.get(p.sopMasterId);
    if (!doc) continue;
    if (!IMPACTING_STATUSES.includes(doc.lifecycleStatus as string)) continue;

    const member = resolveMembership(p.sopMasterId);
    const wave = member ? waveByNumber.get(member.waveNumber) : undefined;
    const operational = !!member?.operationalAt;
    const enforcement = (wave?.enforcement as WaveEnforcement) ?? null;
    const acknowledgedCurrentVersion = !!p.acknowledgedAt && p.sopVersion === doc.version;

    // Use timer_started_at as the ONLY deadline anchor. Queued SOPs (timer_started_at
    // IS NULL) have no running clock and CANNOT be overdue — falling back to
    // operationalAt would allow a compliance-lock on a SOP whose timer has never
    // been activated, which violates the queue/ceiling semantics.
    const timerAnchor: Date | null = (p as any).timerStartedAt
      ? new Date((p as any).timerStartedAt)
      : null;
    const dueAt = operational && timerAnchor
      ? new Date(timerAnchor.getTime() + sopGraceDays * 24 * 60 * 60 * 1000)
      : null;
    const overdue = !acknowledgedCurrentVersion && !!dueAt && dueAt.getTime() < now;

    const trainingPending = !!doc.learningTrackId && !p.trainingCompletedAt;
    let state: MySopAssignment["state"];
    if (acknowledgedCurrentVersion) state = "acknowledged";
    else if (!operational) state = "queued";
    else if (trainingPending) state = "training_pending";
    else state = "ready";

    rows.push({
      sopId: doc.id,
      sopMasterId: p.sopMasterId,
      code: doc.code,
      title: doc.title,
      category: doc.category,
      lifecycleStatus: doc.lifecycleStatus as string,
      version: doc.version,
      learningTrackId: doc.learningTrackId ?? null,
      trainingCompletedAt: p.trainingCompletedAt ?? null,
      acknowledgedAt: p.acknowledgedAt ?? null,
      acknowledgedCurrentVersion,
      waveNumber: member?.waveNumber ?? null,
      waveStatus: (wave?.status as WaveStatus) ?? null,
      enforcement,
      operational,
      operationalAt: member?.operationalAt ?? null,
      dueAt,
      overdue,
      state,
      evidenceText: (p as any).evidenceText ?? null,
      evidenceFileUrl: (p as any).evidenceFileUrl ?? null,
      evidenceDescription: evidenceDescByMaster.get(p.sopMasterId) ?? null,
      // Quiz fields — enriched below after the loop
      quizRequired: false,
      quizPassed: false,
      quizAttempts: 0,
      quizPassedAt: null,
    });
  }

  // ── Enrich quiz state for all rows in one SQL query (Task #1419) ─────────
  if (rows.length > 0) {
    try {
      const sopIds = rows.map((r) => r.sopId);
      const quizCheckCounts = await db.execute(sql`
        SELECT sop_id, COUNT(*)::int AS q_count
        FROM sop_knowledge_checks
        WHERE sop_id = ANY(${sopIds})
        GROUP BY sop_id
      `).catch(() => ({ rows: [] }));
      const qCountBySopId = new Map<string, number>(
        (quizCheckCounts.rows as any[]).map((r) => [r.sop_id, Number(r.q_count)])
      );

      const quizResults = await db.execute(sql`
        SELECT sop_id, COUNT(*)::int AS attempts,
               BOOL_OR(passed) AS passed,
               MAX(CASE WHEN passed THEN attempted_at END) AS passed_at
        FROM sop_employee_quiz_responses
        WHERE user_id = ${userId}
          AND sop_id = ANY(${sopIds})
        GROUP BY sop_id
      `).catch(() => ({ rows: [] }));
      const quizBySopId = new Map<string, { attempts: number; passed: boolean; passedAt: Date | null }>(
        (quizResults.rows as any[]).map((r) => [r.sop_id, {
          attempts: Number(r.attempts),
          passed: Boolean(r.passed),
          passedAt: r.passed_at ? new Date(r.passed_at) : null,
        }])
      );

      for (const row of rows) {
        const qCount = qCountBySopId.get(row.sopId) ?? 0;
        const quizData = quizBySopId.get(row.sopId);
        row.quizRequired = qCount > 0;
        row.quizPassed = quizData?.passed ?? false;
        row.quizAttempts = quizData?.attempts ?? 0;
        row.quizPassedAt = quizData?.passedAt ?? null;
      }
    } catch (quizErr) {
      // Non-fatal: quiz tables might not exist yet in dev
      console.warn("[sopRollout] Quiz enrichment failed (non-fatal):", quizErr instanceof Error ? quizErr.message : quizErr);
    }
  }

  return rows;
}

export async function getMySopAssignments(
  userId: string | undefined,
  role: string | undefined,
): Promise<{ enabled: boolean; assignments: MySopAssignment[] }> {
  if (!userId) return { enabled: false, assignments: [] };
  const { enabled } = await resolveSopAccessForUser(userId, role);
  if (!enabled) return { enabled: false, assignments: [] };
  const assignments = await buildAssignmentRows(userId, role);
  return { enabled: true, assignments };
}

// Pure predicate: does this assignment row lock the individual employee?
// Enforcement is a PER-USER obligation, not a document-completion state: the
// lock fires when the SOP is live for the individual (full-enforced wave +
// operational, i.e. past its go-live) AND past its grace deadline AND this user
// has not acknowledged the current version. We deliberately do NOT gate on the
// document's terminal lifecycle enum "active" — that enum only flips once EVERY
// impacted user has acknowledged, so gating on it would make the lock
// unreachable for the exact straggler it exists to compel. buildAssignmentRows
// already excludes non-impacting statuses (draft/in_review/approved/retired)
// via IMPACTING_STATUSES.
export function isSopLockEligible(row: {
  enforcement: WaveEnforcement | null;
  operational: boolean;
  overdue: boolean;
  acknowledgedCurrentVersion: boolean;
}): boolean {
  return (
    row.enforcement === "full" &&
    row.operational &&
    row.overdue &&
    !row.acknowledgedCurrentVersion
  );
}

// SOPs that should fold into the compliance lock for this user.
// Returns [] for any user outside the rollout pilot (gating invariant).
export async function getEnforceableOverdueSopsForUser(
  userId: string | undefined,
  role: string | undefined,
): Promise<{ code: string; title: string }[]> {
  if (!userId) return [];
  const { enabled } = await resolveSopAccessForUser(userId, role);
  if (!enabled) return [];

  // ── Circuit-breaker gate ─────────────────────────────────────────────────
  // When the mass-lockout circuit breaker is tripped (written by syncGovernanceObligations
  // on every sweep), we pause NEW lock activations in this enforcement path.
  // This satisfies the safety guarantee: the CB pauses both timer starts (in sync)
  // AND lock activations (here) whenever projected lockouts exceed the threshold.
  try {
    const cbSetting = await storage.getSystemSetting("sop_circuit_breaker_active");
    if (cbSetting?.value === "true") return [];
  } catch { /* non-fatal — proceed with enforcement if setting is unreadable */ }

  const rows = await buildAssignmentRows(userId);
  return rows
    .filter(isSopLockEligible)
    .map((r) => ({ code: r.code, title: r.title }));
}

// Soft-enforcement coaching signal: operational SOPs in soft/measured-enforced
// waves the user has not yet acknowledged (no lock — banner only). Full-
// enforcement SOPs are excluded here; they go through the compliance lock.
export async function getPendingSoftSopsForUser(
  userId: string | undefined,
  role: string | undefined,
): Promise<{ count: number; titles: string[] }> {
  if (!userId) return { count: 0, titles: [] };
  const { enabled } = await resolveSopAccessForUser(userId, role);
  if (!enabled) return { count: 0, titles: [] };
  const rows = await buildAssignmentRows(userId);
  const pending = rows.filter(
    (r) => (r.enforcement === "soft" || r.enforcement === "measured") && r.operational && !r.acknowledgedCurrentVersion,
  );
  return { count: pending.length, titles: pending.map((r) => r.title) };
}

// ── Wave Scheduled Launch helpers ────────────────────────────────────────────

/** ISO week string "YYYY-Www" for a given date. */
function isoWeekKey(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7; // Mon=1 … Sun=7
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export interface CadenceCheckResult {
  /** True if a hard block exists (an approved/active schedule already owns that week). */
  blocked: boolean;
  /**
   * Wave number of the conflicting or warning schedule in that week.
   * Present for both hard blocks (blocked=true) and soft warnings (warning=true).
   */
  conflictingWave?: number;
  /** True if a soft warning applies (total approved+pending launches in that week exceeds CADENCE_MAX_PER_WEEK). */
  warning: boolean;
}

/**
 * Checks whether scheduling waveNumber on goLiveDate would violate cadence rules.
 *
 * Hard block: another approved or active launch already occupies that ISO week.
 * Soft warning: counting the proposed launch, the week would exceed CADENCE_MAX_PER_WEEK
 *   (applies only to waves 1-5; wave 0 is always-on and exempt).
 *
 * @param waveNumber  Wave being scheduled.
 * @param goLiveDate  ISO date string (YYYY-MM-DD).
 * @param excludeId   Optional existing row id to exclude (for edits).
 */
export async function checkCadenceConflict(
  waveNumber: number,
  goLiveDate: string,
  excludeId?: string,
): Promise<CadenceCheckResult> {
  const target = new Date(goLiveDate);
  const targetWeek = isoWeekKey(target);
  const cadenceMax = await getGovernanceIntSetting("governance_sop_cadence_max_per_week", CADENCE_MAX_PER_WEEK);

  // Fetch all non-cancelled scheduled launches
  const rows = await db
    .select({
      id: waveScheduledLaunches.id,
      waveNumber: waveScheduledLaunches.waveNumber,
      goLiveDate: waveScheduledLaunches.goLiveDate,
      status: waveScheduledLaunches.status,
    })
    .from(waveScheduledLaunches)
    .where(
      and(
        or(
          eq(waveScheduledLaunches.status, "approved"),
          eq(waveScheduledLaunches.status, "active"),
          eq(waveScheduledLaunches.status, "pending_approval"),
        ),
      ),
    );

  const sameWeek = rows.filter((r) => {
    if (excludeId && r.id === excludeId) return false;
    return isoWeekKey(new Date(r.goLiveDate as string)) === targetWeek;
  });

  // Hard block: any approved or active launch in the same week
  const hardConflict = sameWeek.find(
    (r) => r.status === "approved" || r.status === "active",
  );
  if (hardConflict) {
    return { blocked: true, conflictingWave: hardConflict.waveNumber, warning: false };
  }

  // Soft warning: wave 0 is exempt; count pending+approved+this proposal
  if (waveNumber >= 1) {
    const countInWeek = sameWeek.length + 1; // +1 for the proposed launch
    if (countInWeek > cadenceMax) {
      const warningRow = sameWeek[0];
      return {
        blocked: false,
        warning: true,
        conflictingWave: warningRow?.waveNumber,
      };
    }
  }

  return { blocked: false, warning: false };
}

/**
 * Cron handler — fires daily at 07:00 IST.
 * Picks up all `approved` rows where go_live_date <= today, calls activateWave,
 * and marks each row `active`.
 */
export async function fireScheduledWaveLaunches(): Promise<{
  fired: number;
  errors: number;
}> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const due = await db
    .select()
    .from(waveScheduledLaunches)
    .where(
      and(
        eq(waveScheduledLaunches.status, "approved"),
        lte(waveScheduledLaunches.goLiveDate, todayIso),
      ),
    );

  let fired = 0;
  let errors = 0;

  for (const row of due) {
    try {
      await activateWave(row.waveNumber, row.scheduledByUserId);

      await db
        .update(waveScheduledLaunches)
        .set({ status: "active" })
        .where(eq(waveScheduledLaunches.id, row.id));

      await storage.createAuditLog({
        actorId: row.scheduledByUserId,
        targetId: String(row.waveNumber),
        action: "sop_wave_scheduled_launch_fired",
        changes: {
          waveNumber: row.waveNumber,
          goLiveDate: row.goLiveDate,
          scheduledLaunchId: row.id,
        },
      });

      fired += 1;
    } catch (err) {
      console.error(`[sopRollout] fireScheduledWaveLaunches: wave ${row.waveNumber} failed:`, err);
      errors += 1;
    }
  }

  return { fired, errors };
}
