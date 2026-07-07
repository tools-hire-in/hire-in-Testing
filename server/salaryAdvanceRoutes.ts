import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { db } from "./db";
import { resolveRoles } from "@shared/accessControl";
import {
  DEFAULT_SALARY_ADVANCE_POLICY,
  SALARY_ADVANCE_POLICY_KEY,
  salaryAdvanceRequests,
  salaryAdvanceRepayments,
  salaryReportRuns,
  type SalaryAdvancePolicy,
  type SalaryAdvanceRequest,
} from "@shared/schema";

// ── Secure upload token helpers ──────────────────────────────────────────────
// Server signs (advanceId + objectPath + timestamp) with HMAC-SHA256 so the
// client can NEVER substitute an arbitrary objectPath.  The token is opaque to
// the client and expires after 15 minutes.
function _uploadTokenSecret(): string {
  return process.env.SESSION_SECRET || "advance-upload-token-secret-fallback";
}

function signUploadToken(advanceId: string, objectPath: string): string {
  const payload = JSON.stringify({ advanceId, objectPath, ts: Date.now() });
  const sig = crypto.createHmac("sha256", _uploadTokenSecret()).update(payload).digest("hex").slice(0, 20);
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

function verifyUploadToken(token: string, advanceId: string): string | null {
  try {
    const lastDot = token.lastIndexOf(".");
    if (lastDot < 0) return null;
    const payloadB64 = token.slice(0, lastDot);
    const sig = token.slice(lastDot + 1);
    const payloadStr = Buffer.from(payloadB64, "base64url").toString();
    const expectedSig = crypto.createHmac("sha256", _uploadTokenSecret()).update(payloadStr).digest("hex").slice(0, 20);
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(payloadStr) as { advanceId: string; objectPath: string; ts: number };
    if (payload.advanceId !== advanceId) return null;
    if (Date.now() - payload.ts > 15 * 60 * 1000) return null;
    return payload.objectPath;
  } catch { return null; }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// Mirror of routes.ts requirePermission so access-control parity holds.
export function requirePermission(featureKey: string, ...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    // Use ONLY the explicit fallback roles (which mirror the access registry).
    // Do NOT auto-inject super_admin/admin — final-approval routes must stay
    // restricted to super_admin exactly as the registry declares.
    const allowed = resolveRoles(featureKey, allowedRoles);
    if (allowed.includes(req.session.role!)) return next();
    return res.status(403).json({ error: "Insufficient permissions" });
  };
}

// In-app notification, gated by the global notifications feature flag.
async function notify(opts: { userId: string; type: string; title: string; message: string; link?: string }) {
  try {
    const flagsSetting = await storage.getSystemSetting("feature_flags");
    const flags = (flagsSetting?.value as Record<string, any>) || {};
    if (flags.notifications_enabled === false) return;
    await storage.createNotification({
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      metadata: opts.link ? { link: opts.link } : null,
    } as any);
  } catch {
    /* best-effort */
  }
}

async function getPolicy(): Promise<SalaryAdvancePolicy> {
  const setting = await storage.getSystemSetting(SALARY_ADVANCE_POLICY_KEY);
  if (!setting?.value) return { ...DEFAULT_SALARY_ADVANCE_POLICY };
  return { ...DEFAULT_SALARY_ADVANCE_POLICY, ...(setting.value as Partial<SalaryAdvancePolicy>) };
}

const EMPLOYEE_LINK = "/admin/salary-advance?tab=mine";
const MANAGER_LINK = "/admin/salary-advance?tab=approvals";

// Resolve the routing manager for a requester, walking up the chain past anyone
// who is on leave today; falls back to the first HR user when no manager is found.
async function resolveApprover(requesterId: string): Promise<string | null> {
  let currentId: string | undefined = requesterId;
  const seen = new Set<string>();
  for (let i = 0; i < 10 && currentId; i++) {
    const user = await storage.getAdminUser(currentId);
    const managerId = user?.managerId || null;
    if (!managerId || seen.has(managerId)) break;
    seen.add(managerId);
    const onLeave = await storage.isUserOnLeaveToday(managerId);
    if (!onLeave) return managerId;
    currentId = managerId;
  }
  // Fallback: first active HR user
  const users = await storage.getAdminUsers();
  const hr = users.find(u => u.role === "hr" && u.isActive);
  return hr?.id || null;
}

// Build the month-by-month repayment schedule for an approved advance.
//
// ROOT-CAUSE NOTE — deduction misses:
// A deduction miss occurs when the salary run's (year, month) does not match any
// row in salary_advance_repayments for that advance.  The most common cause is
// that repaymentStartYear/Month on the advance was recorded incorrectly (e.g.,
// August when the intent was July), so no scheduled row exists for the current
// run month.  Always call resolveStartMonth() before buildSchedule to detect and
// auto-bump locked salary runs; and use the /reschedule endpoint (or the
// "Adjust start month" UI action) to correct historically recorded advances.
function buildSchedule(opts: {
  advanceId: string;
  userId: string;
  amount: number;
  months: number;
  startYear: number;
  startMonth: number;
}): Array<{ advanceId: string; userId: string; installmentNo: number; year: number; month: number; scheduledAmount: string }> {
  const { advanceId, userId, amount, months, startYear, startMonth } = opts;
  const base = Math.floor((amount / months) * 100) / 100;
  const rows: Array<{ advanceId: string; userId: string; installmentNo: number; year: number; month: number; scheduledAmount: string }> = [];
  let remaining = Math.round(amount * 100) / 100;
  for (let i = 0; i < months; i++) {
    const isLast = i === months - 1;
    const amt = isLast ? remaining : base;
    remaining = Math.round((remaining - amt) * 100) / 100;
    const monthIndex = startMonth - 1 + i;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    rows.push({
      advanceId,
      userId,
      installmentNo: i + 1,
      year,
      month,
      scheduledAmount: amt.toFixed(2),
    });
  }
  return rows;
}

// Advance to the next calendar month.
function advanceOneMonth(y: number, m: number): { year: number; month: number } {
  const idx = m; // m is 1-based, adding 1 gives next month index (0-based Jan=0 → 1-based)
  return { year: y + Math.floor(idx / 12), month: (idx % 12) + 1 };
}

// Check whether the salary run for (year, month) is locked (approved or sent).
// Returns true if locked, false if open or not yet created.
async function isRunLocked(year: number, month: number): Promise<boolean> {
  const rows = await db.select({ status: salaryReportRuns.status })
    .from(salaryReportRuns)
    .where(and(eq(salaryReportRuns.year, year), eq(salaryReportRuns.month, month)))
    .limit(1);
  if (rows.length === 0) return false;
  return rows[0].status !== "pending_approval";
}

// Check whether the user-chosen start month is already locked, and return a warning flag.
// Unlike the old resolveStartMonth(), this NEVER bumps the chosen month — the user's
// explicit choice is always honoured. The warning flag tells the frontend to show an
// amber advisory so HR knows to regenerate the salary run.
async function checkStartMonthLocked(
  requested: { year: number; month: number }
): Promise<{ year: number; month: number; locked: boolean }> {
  const { year, month } = requested;
  const locked = await isRunLocked(year, month);
  return { year, month, locked };
}

function nextMonth(): { year: number; month: number } {
  const now = new Date();
  const monthIndex = now.getMonth() + 1; // 0-based -> next month is +1 (current+1)
  const year = now.getFullYear() + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return { year, month };
}

function currentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// Format a month number as a short name for error messages.
const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Compute the employee's net monthly salary for cap checks.
async function getNetSalary(userId: string): Promise<number> {
  const user = await storage.getAdminUser(userId);
  return Number(user?.salary || 0);
}

// Soft eligibility evaluation — returns warnings, never blocks.
async function evaluateEligibility(userId: string, amount: number, policy: SalaryAdvancePolicy): Promise<{ warnings: string[]; netSalary: number; cap: number; ceiling: number }> {
  const warnings: string[] = [];
  const netSalary = await getNetSalary(userId);
  const cap = Math.round(netSalary * (policy.maxAdvancePctOfNet / 100) * 100) / 100;
  const ceiling = Math.round(netSalary * (policy.exceptionCeilingPct / 100) * 100) / 100;

  if (netSalary <= 0) {
    warnings.push("No monthly salary is configured for this employee — cap checks cannot be applied.");
  } else if (amount > ceiling) {
    warnings.push(`Requested amount exceeds the absolute ceiling of ${policy.exceptionCeilingPct}% of net salary (${ceiling.toFixed(2)}).`);
  } else if (amount > cap) {
    warnings.push(`Requested amount exceeds the standard cap of ${policy.maxAdvancePctOfNet}% of net salary (${cap.toFixed(2)}). Requires exception approval.`);
  }

  if (policy.oneActiveAdvanceOnly) {
    const existing = await storage.getActiveAdvanceForUser(userId);
    if (existing) {
      warnings.push(`Employee already has an active or pending advance (${existing.requestNumber}).`);
    }
  }

  if (policy.requireProbationComplete) {
    const user = await storage.getAdminUser(userId);
    const status = (user as any)?.employmentStatus;
    if (status && String(status).toLowerCase().includes("probation")) {
      warnings.push("Employee is still on probation; policy expects probation to be complete.");
    }
  }

  if (policy.minTenureMonths > 0) {
    const user = await storage.getAdminUser(userId);
    const joining = (user as any)?.joiningDate;
    if (!joining) {
      warnings.push(`No joining date is on record; policy expects at least ${policy.minTenureMonths} month(s) of tenure.`);
    } else {
      const joinDate = new Date(joining);
      const now = new Date();
      const tenureMonths = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth()) - (now.getDate() < joinDate.getDate() ? 1 : 0);
      if (tenureMonths < policy.minTenureMonths) {
        warnings.push(`Employee tenure is ${Math.max(0, tenureMonths)} month(s); policy expects a minimum of ${policy.minTenureMonths} month(s).`);
      }
    }
  }

  return { warnings, netSalary, cap, ceiling };
}

async function enrichUsers(advances: SalaryAdvanceRequest[]) {
  const ids = new Set<string>();
  for (const a of advances) {
    if (a.requesterId) ids.add(a.requesterId);
    if (a.managerId) ids.add(a.managerId);
  }
  const map: Record<string, any> = {};
  for (const id of ids) {
    const u = await storage.getAdminUser(id);
    if (u) map[id] = { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role };
  }
  return advances.map(a => ({
    ...a,
    requester: a.requesterId ? map[a.requesterId] : null,
    manager: a.managerId ? map[a.managerId] : null,
  }));
}

export function registerSalaryAdvanceRoutes(app: Express) {
  // ── Feature gate ───────────────────────────────────────────────────────────
  // The entire self-service Salary Advance feature is hidden behind the
  // `salary_advance_enabled` feature flag (default OFF). When the flag is not
  // explicitly true, every endpoint returns 403 so the feature is fully off, not
  // just hidden in the UI. The route handlers below are kept intact so the flag
  // can re-enable the feature without rebuilding it.
  // The manual HR recording tool (backfill advance / record overpayment) must
  // work regardless of the self-service flag — its whole point is to let HR/admin
  // record entries even when the request workflow is off. So when the flag is
  // OFF we still let trusted roles reach the backfill route and the read
  // endpoints the recording UI depends on; everything else stays fully disabled.
  const FLAG_OFF_PRIVILEGED_ROLES = ["super_admin", "admin", "hr"];
  // Managers and finance can read employee advances (read-only card in My Team)
  // even when the self-service flag is off.
  const FLAG_OFF_MANAGER_READ_ROLES = ["manager", "finance"];
  const isAdminToolRequest = (method: string, subPath: string): boolean => {
    if (method === "POST" && subPath === "/backfill") return true;
    if (method === "POST" && subPath === "/request-upload") return true;
    if (method === "GET") {
      if (subPath === "/active" || subPath === "/stats" || subPath === "/policy") return true;
      if (subPath === "/pending-adjustments" || subPath === "/my-submissions") return true;
      if (subPath === "/pending/ceo") return true;
      if (subPath === "/preview-schedule") return true;
      if (subPath === "/eligibility-check") return true;
      if (subPath === "/snapshot-gap") return true;
      // GET /employee/:userId
      if (/^\/employee\/[^/]+$/.test(subPath)) return true;
      // Detail dialog: GET /api/salary-advances/:id (uuid-shaped, no extra segment).
      if (/^\/[0-9a-fA-F-]{16,}$/.test(subPath)) return true;
      // Schedule: GET /api/salary-advances/:id/schedule
      if (/^\/[0-9a-fA-F-]{16,}\/schedule$/.test(subPath)) return true;
      // Attachments: GET /api/salary-advances/:id/attachments
      if (/^\/[0-9a-fA-F-]{16,}\/attachments$/.test(subPath)) return true;
    }
    // HR-recorded adjustment review & resubmit actions
    if (method === "PATCH" && /\/(approve-adjustment|return-adjustment|reject-adjustment|resubmit-adjustment)$/.test(subPath)) return true;
    // Reschedule repayments
    if (method === "PATCH" && /^\/[0-9a-fA-F-]{16,}\/reschedule$/.test(subPath)) return true;
    // Attachment record + delete
    if (method === "POST" && /^\/[0-9a-fA-F-]{16,}\/attachments$/.test(subPath)) return true;
    if (method === "DELETE" && /^\/[0-9a-fA-F-]{16,}\/attachments\/[^/]+$/.test(subPath)) return true;
    // CEO approval
    if (method === "POST" && /\/(ceo-approve|ceo-reject)$/.test(subPath)) return true;
    return false;
  };
  const isManagerReadRequest = (method: string, subPath: string): boolean => {
    // Managers only get read access to per-employee advances (My Team card)
    return method === "GET" && /^\/employee\/[^/]+$/.test(subPath);
  };
  app.use("/api/salary-advances", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const setting = await storage.getSystemSetting("feature_flags");
      const flags = (setting?.value as Record<string, boolean>) || {};
      if (flags.salary_advance_enabled === true) return next();
      const role = req.session?.role || "";
      // req.path is relative to the "/api/salary-advances" mount point here.
      if (FLAG_OFF_PRIVILEGED_ROLES.includes(role) && isAdminToolRequest(req.method, req.path)) {
        return next();
      }
      if (FLAG_OFF_MANAGER_READ_ROLES.includes(role) && isManagerReadRequest(req.method, req.path)) {
        return next();
      }
    } catch {
      // fall through to disabled response
    }
    return res.status(403).json({ error: "Salary advance feature is disabled" });
  });

  // ── Policy (read) — any authenticated user may read the policy page
  app.get("/api/salary-advances/policy", requireAuth, async (_req: Request, res: Response) => {
    try {
      res.json(await getPolicy());
    } catch {
      res.status(500).json({ error: "Failed to load policy" });
    }
  });

  // ── Policy (update) — HR/admin
  app.put("/api/salary-advances/policy", requireAuth, requirePermission("salaryAdvance.policy.manage", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        enabled: z.boolean(),
        maxAdvancePctOfNet: z.number().min(0).max(100),
        exceptionCeilingPct: z.number().min(0).max(200),
        defaultMaxMonths: z.number().int().min(1).max(36),
        managerMaxMonths: z.number().int().min(1).max(36),
        ceoMaxMonths: z.number().int().min(1).max(36),
        requireProbationComplete: z.boolean(),
        minTenureMonths: z.number().int().min(0).max(120),
        oneActiveAdvanceOnly: z.boolean(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid policy", errors: parsed.error.errors });
      const saved = await storage.upsertSystemSetting(SALARY_ADVANCE_POLICY_KEY, parsed.data, req.session.userId!);
      res.json(saved.value);
    } catch {
      res.status(500).json({ error: "Failed to save policy" });
    }
  });

  // ── Stats — sidebar/queue counts
  app.get("/api/salary-advances/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getSalaryAdvanceStats(req.session.userId!, req.session.role || "employee");
      res.json(stats);
    } catch (error) {
      console.error("Salary advance stats error:", error);
      res.status(500).json({ error: "Failed to load stats" });
    }
  });

  // ── Eligibility check (soft warnings) for a prospective amount
  app.get("/api/salary-advances/eligibility", requireAuth, async (req: Request, res: Response) => {
    try {
      const amount = Number(req.query.amount || 0);
      const policy = await getPolicy();
      const result = await evaluateEligibility(req.session.userId!, amount, policy);
      res.json({ ...result, policy });
    } catch {
      res.status(500).json({ error: "Failed to evaluate eligibility" });
    }
  });

  // ── My advances
  app.get("/api/salary-advances/mine", requireAuth, requirePermission("salaryAdvance.viewOwn", "super_admin", "admin", "hr", "finance", "operations", "manager", "recruiter", "employee"), async (req: Request, res: Response) => {
    try {
      const rows = await storage.listSalaryAdvancesByRequester(req.session.userId!);
      res.json(await enrichUsers(rows));
    } catch {
      res.status(500).json({ error: "Failed to load advances" });
    }
  });

  // ── Manager queue (advances routed to me as approver)
  app.get("/api/salary-advances/pending/manager", requireAuth, requirePermission("salaryAdvance.managerApprove", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const rows = await storage.listSalaryAdvancesForManager(req.session.userId!);
      res.json(await enrichUsers(rows));
    } catch {
      res.status(500).json({ error: "Failed to load queue" });
    }
  });

  // ── Final approval queue (super admin)
  app.get("/api/salary-advances/pending/final", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listSalaryAdvancesByStatus(["pending_final"]);
      res.json(await enrichUsers(rows));
    } catch {
      res.status(500).json({ error: "Failed to load queue" });
    }
  });

  // ── CEO Exceptions queue — advances that exceed 50% of salary require CEO sign-off
  // Restricted to super_admin (CEO) only — HR must not see this queue.
  app.get("/api/salary-advances/pending/ceo", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listSalaryAdvancesByStatus(["pending_ceo"]);
      res.json(await enrichUsers(rows));
    } catch {
      res.status(500).json({ error: "Failed to load CEO queue" });
    }
  });

  // ── Preview repayment schedule (non-committing)
  app.get("/api/salary-advances/preview-schedule", requireAuth, async (req: Request, res: Response) => {
    try {
      const amount = Number(req.query.amount || 0);
      const months = Number(req.query.months || 1);
      if (!amount || amount <= 0 || !months || months < 1) {
        return res.status(400).json({ error: "Valid amount and months are required" });
      }
      const smParam = Number(req.query.startMonth || 0);
      const syParam = Number(req.query.startYear || 0);
      const { year, month } = (smParam >= 1 && smParam <= 12 && syParam >= 2000) ? { year: syParam, month: smParam } : nextMonth();
      const schedule = buildSchedule({ advanceId: "preview", userId: "preview", amount, months, startYear: year, startMonth: month });
      res.json({ schedule, startYear: year, startMonth: month });
    } catch {
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // ── Eligibility check for the current session user (used by the Service Desk form)
  app.get("/api/salary-advances/eligibility-check", requireAuth, async (req: Request, res: Response) => {
    try {
      const amount = Number(req.query.amount || 0);
      if (!amount || amount <= 0) return res.json({ warnings: [], exceedsCap50: false, netSalary: 0, cap: 0 });
      const policy = await getPolicy();
      const eligibility = await evaluateEligibility(req.session.userId!, amount, policy);
      const netSalary = await getNetSalary(req.session.userId!);
      const exceedsCap50 = netSalary > 0 && amount > netSalary * 0.5;
      res.json({ warnings: eligibility.warnings, exceedsCap50, netSalary, cap: eligibility.cap });
    } catch {
      res.status(500).json({ error: "Failed to evaluate eligibility" });
    }
  });

  // ── Pre-flight: check whether a payroll month is already locked (salary run exists
  // and is not in pending_approval state).  Used by the PendingAdjustmentsTab to
  // warn the approver before they commit an overpayment to a locked month.
  app.get("/api/salary-advances/month-locked", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (req: Request, res: Response) => {
    const year = parseInt(String(req.query.year || ""), 10);
    const month = parseInt(String(req.query.month || ""), 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: "year and month (1-12) are required" });
    }
    const locked = await isRunLocked(year, month);
    return res.json({ locked });
  });

  // ── Pre-flight: count scheduled repayments for a given month whose advance was
  // recorded after the salary run's generatedAt (i.e. missing from the snapshot).
  app.get("/api/salary-advances/snapshot-gap", requireAuth, requirePermission("salaryAdvance.accounts", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const year = parseInt(String(req.query.year || ""), 10);
      const month = parseInt(String(req.query.month || ""), 10);
      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({ error: "year and month (1-12) are required query params" });
      }
      // Find the salary run for this period
      const runsResult = await db
        .select()
        .from(salaryReportRuns)
        .where(and(eq(salaryReportRuns.year, year), eq(salaryReportRuns.month, month)))
        .limit(1);
      if (runsResult.length === 0) {
        return res.json({ count: 0, missedAmount: 0 });
      }
      const run = runsResult[0];
      const generatedAt = run.generatedAt ? new Date(run.generatedAt) : null;
      if (!generatedAt) {
        return res.json({ count: 0, missedAmount: 0 });
      }
      // Count scheduled repayments for this month whose repayment row was created after the
      // run was generated.  We intentionally use salaryAdvanceRepayments.createdAt (when the
      // repayment schedule was built — i.e. at approval/disbursement time) rather than the
      // originating request's createdAt.  An advance may have been requested weeks ago but
      // only approved & scheduled after the report snapshot, so the request timestamp would
      // under-count the real gap.
      const gapRows = await db
        .select({
          repaymentId: salaryAdvanceRepayments.id,
          scheduledAmount: salaryAdvanceRepayments.scheduledAmount,
        })
        .from(salaryAdvanceRepayments)
        .where(
          and(
            eq(salaryAdvanceRepayments.year, year),
            eq(salaryAdvanceRepayments.month, month),
            eq(salaryAdvanceRepayments.status, "scheduled"),
            gt(salaryAdvanceRepayments.createdAt, generatedAt),
          )
        );
      const count = gapRows.length;
      const missedAmount = gapRows.reduce((s, r) => s + Number(r.scheduledAmount || 0), 0);
      return res.json({ count, missedAmount });
    } catch (err) {
      console.error("Snapshot gap error:", err);
      res.status(500).json({ error: "Failed to compute snapshot gap" });
    }
  });

  // ── Accounts: all active advances with outstanding balances
  app.get("/api/salary-advances/active", requireAuth, requirePermission("salaryAdvance.accounts", "super_admin", "admin", "hr", "finance"), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listActiveSalaryAdvances();
      const enriched = await enrichUsers(rows);
      // Attach first 2 installments per advance so the client can render a
      // repayment-schedule tooltip on the "Check recovery start" badge without
      // opening the detail dialog.
      const withRepayments = await Promise.all(enriched.map(async (a) => {
        const repayments = await storage.getSalaryAdvanceRepayments((a as any).id);
        return { ...a, repayments: repayments.slice(0, 2) };
      }));
      res.json(withRepayments);
    } catch {
      res.status(500).json({ error: "Failed to load active advances" });
    }
  });

  // ── HR/admin: manually record an entry for an employee.
  // Three kinds:
  //   • advance      — backfill an already-active advance, skipping the
  //                    request/approval chain (HR picks amount, repayment months,
  //                    and the start month of recovery). Created as disbursed.
  //   • overpayment  — HR-recorded deduction for any reason with configurable
  //                    repayment months. Lands in pending_review for super_admin
  //                    approval before affecting payroll.
  //   • salary_credit — HR-recorded one-time positive correction for a specific
  //                     month. Lands in pending_review for super_admin approval.
  // Works regardless of the self-service feature flag (see the feature gate above).
  app.post("/api/salary-advances/backfill", requireAuth, requirePermission("salaryAdvance.backfill", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        employeeId: z.string().min(1, "Employee is required"),
        kind: z.enum(["advance", "overpayment", "salary_credit"]),
        amount: z.number().positive("Amount must be greater than zero"),
        reason: z.string().optional(),
        repaymentMonths: z.number().int().min(1).max(36).optional(),
        startYear: z.number().int().min(2000).max(2100).optional(),
        startMonth: z.number().int().min(1).max(12).optional(),
        targetMonth: z.number().int().min(1).max(12).optional(),
        targetYear: z.number().int().min(2000).max(2100).optional(),
        disbursedAt: z.string().optional(),
      }).superRefine((data, ctx) => {
        if (data.kind === "advance" || data.kind === "overpayment") {
          if (!data.startYear) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "First Recovery Month year is required", path: ["startYear"] });
          if (!data.startMonth) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "First Recovery Month is required", path: ["startMonth"] });
        }
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });

      const { employeeId, kind } = parsed.data;
      const actorId = req.session.userId!;
      const amount = Math.round(parsed.data.amount * 100) / 100;

      const target = await storage.getAdminUser(employeeId);
      if (!target) return res.status(404).json({ error: "Employee not found" });

      const defaultReason = kind === "overpayment"
        ? "Overpayment recovery recorded by HR"
        : kind === "salary_credit"
          ? "Salary credit recorded by HR"
          : "Salary advance recorded by HR";
      const reason = parsed.data.reason && parsed.data.reason.trim().length > 0
        ? parsed.data.reason.trim()
        : defaultReason;

      const now = new Date();

      if (kind === "advance") {
        // Advance: bypass approval chain, create disbursed immediately.
        // The HR user MUST explicitly pick the First Recovery Month — no silent auto-bump.
        const months = parsed.data.repaymentMonths || 1;
        const requestedStart = { year: parsed.data.startYear!, month: parsed.data.startMonth! };

        // Check if the chosen month is already locked. If so, return a warning
        // but still honour the user's explicit choice — they can regenerate the run.
        const startCheck = await checkStartMonthLocked(requestedStart);
        const start = { year: startCheck.year, month: startCheck.month };
        const startMonthWarning = startCheck.locked;

        const monthlyDeduction = Math.ceil((amount / months) * 100) / 100;
        const disbursedAtDate = parsed.data.disbursedAt ? new Date(parsed.data.disbursedAt) : now;

        const created = await storage.createSalaryAdvanceWithNumber({
          requesterId: employeeId,
          managerId: null,
          requestedAmount: amount.toFixed(2),
          reason,
          kind,
          backfilled: true,
          status: "disbursed",
          approvedAmount: amount.toFixed(2),
          repaymentMonths: months,
          monthlyDeduction: monthlyDeduction.toFixed(2),
          repaymentStartYear: start.year,
          repaymentStartMonth: start.month,
          totalRepaid: "0",
          outstandingBalance: amount.toFixed(2),
          managerApprovedBy: actorId,
          managerApprovedAt: now,
          finalApprovedBy: actorId,
          finalApprovedAt: now,
          disbursedBy: actorId,
          disbursedAt: disbursedAtDate,
          recordedById: actorId,
        } as any);

        const schedule = buildSchedule({ advanceId: created.id, userId: employeeId, amount, months, startYear: start.year, startMonth: start.month });
        await storage.createSalaryAdvanceRepayments(schedule as any);
        await storage.addSalaryAdvanceAuditEntry({
          advanceId: created.id, actorId, action: "backfilled",
          oldStatus: null, newStatus: "disbursed",
          metadata: { kind, amount, months, monthlyDeduction, scheduleStart: start, startMonthWarning, recordedManually: true },
        } as any);
        await notify({
          userId: employeeId, type: "salary_advance_recorded", title: "Salary advance recorded",
          message: `A salary advance of ${amount.toFixed(2)} has been recorded and will be recovered over ${months} month(s).`,
          link: EMPLOYEE_LINK,
        });
        return res.status(201).json({ ...created, repayments: schedule, startMonthWarning, effectiveStart: start });
      }

      // Overpayment or Salary Credit: enter pending_review for super_admin approval.
      const created = await storage.createSalaryAdvanceWithNumber({
        requesterId: employeeId,
        managerId: null,
        requestedAmount: amount.toFixed(2),
        reason,
        kind,
        backfilled: true,
        status: "pending_review",
        approvedAmount: null,
        repaymentMonths: kind === "overpayment" ? (parsed.data.repaymentMonths || 1) : null,
        repaymentStartMonth: kind === "overpayment" ? (parsed.data.startMonth ?? null) : null,
        repaymentStartYear: kind === "overpayment" ? (parsed.data.startYear ?? null) : null,
        totalRepaid: "0",
        outstandingBalance: amount.toFixed(2),
        targetMonth: kind === "salary_credit" ? (parsed.data.targetMonth || null) : null,
        targetYear: kind === "salary_credit" ? (parsed.data.targetYear || null) : null,
        recordedById: actorId,
      } as any);

      await storage.addSalaryAdvanceAuditEntry({
        advanceId: created.id, actorId, action: "submitted_for_review",
        oldStatus: null, newStatus: "pending_review",
        metadata: { kind, amount, recordedManually: true },
      } as any);

      // Notify super admins that an adjustment needs review.
      const allUsers = await storage.getAdminUsers();
      for (const u of allUsers.filter(x => x.role === "super_admin" && x.isActive)) {
        await notify({
          userId: u.id, type: "salary_adjustment_pending_review",
          title: kind === "salary_credit" ? "Salary credit needs approval" : "Overpayment record needs approval",
          message: `${target.firstName} ${target.lastName} — ${kind === "salary_credit" ? "salary credit" : "overpayment"} of ${amount.toFixed(2)} recorded by HR and awaits your approval.`,
          link: "/admin/salary-advance?tab=pending-adjustments",
        });
      }

      res.status(201).json(created);
    } catch (err) {
      console.error("Salary advance backfill error:", err);
      res.status(500).json({ error: "Failed to record entry" });
    }
  });

  // ── Scoped employee read — returns all salary advance/adjustment records for
  // one employee. Access: manager for their reports, HR/admin/super_admin for all.
  app.get("/api/salary-advances/employee/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId: targetUserId } = req.params;
      const actorId = req.session.userId!;
      const role = req.session.role || "employee";

      // Access check
      const privileged = ["super_admin", "admin", "hr", "finance"].includes(role);
      if (!privileged) {
        // Managers may see their direct/indirect reports
        const target = await storage.getAdminUser(targetUserId);
        if (!target) return res.status(404).json({ error: "Employee not found" });
        // Walk manager chain from target upwards
        let current = target;
        let found = false;
        const seen = new Set<string>();
        while (current.managerId && !seen.has(current.managerId)) {
          seen.add(current.managerId);
          if (current.managerId === actorId) { found = true; break; }
          const next = await storage.getAdminUser(current.managerId);
          if (!next) break;
          current = next;
        }
        if (!found && role !== "manager") return res.status(403).json({ error: "Forbidden" });
        if (!found) return res.status(403).json({ error: "Employee is not in your team" });
      }

      const rows = await storage.listSalaryAdvancesByRequester(targetUserId);

      // Enrich with full repayment schedule and submitter info.
      // Full repayments are included so the EmployeeAdvancesCard can render
      // the accordion schedule without an extra round-trip per advance.
      const enriched = await Promise.all(rows.map(async (a) => {
        const repayments = await storage.getSalaryAdvanceRepayments(a.id);
        const scheduled = repayments.filter(r => r.status === "scheduled");
        const nextRep = scheduled.sort((x, y) => x.year !== y.year ? x.year - y.year : x.month - y.month)[0];
        let recordedBy = null;
        if ((a as any).recordedById) {
          const u = await storage.getAdminUser((a as any).recordedById);
          if (u) recordedBy = { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email };
        }
        return {
          ...a,
          recordedBy,
          repayments,
          nextRepaymentMonth: nextRep ? nextRep.month : null,
          nextRepaymentYear: nextRep ? nextRep.year : null,
          nextRepaymentAmount: nextRep ? nextRep.scheduledAmount : null,
          monthsRemaining: scheduled.length,
        };
      }));

      res.json(enriched);
    } catch (err) {
      console.error("Employee advances read error:", err);
      res.status(500).json({ error: "Failed to load advances" });
    }
  });

  // ── My Submissions — HR/Admin: their own submitted (recorded) adjustments.
  app.get("/api/salary-advances/my-submissions", requireAuth, requirePermission("salaryAdvance.backfill", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const actorId = req.session.userId!;
      // Find all records where this actor is the recordedById
      const allRows = await storage.listSalaryAdvancesByRecordedBy(actorId);
      const enriched = await enrichUsers(allRows);
      res.json(enriched);
    } catch {
      res.status(500).json({ error: "Failed to load submissions" });
    }
  });

  // ── Repayment schedule for a single advance (used by EmployeeAdvancesCard accordion)
  app.get("/api/salary-advances/:id/schedule", requireAuth, async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });

      const role = req.session.role || "employee";
      const actorId = req.session.userId!;
      const isPrivileged = ["super_admin", "admin", "hr", "finance"].includes(role);
      const isOwner = advance.requesterId === actorId;
      const isManager = advance.managerId === actorId;
      if (!isOwner && !isManager && !isPrivileged) return res.status(403).json({ error: "Forbidden" });

      const repayments = await storage.getSalaryAdvanceRepayments(advance.id);
      res.json(repayments);
    } catch {
      res.status(500).json({ error: "Failed to load schedule" });
    }
  });

  // ── Reschedule repayments — HR/admin can shift all pending (scheduled) installments
  // to a new start month. Used when the original start month was set incorrectly.
  app.patch("/api/salary-advances/:id/reschedule", requireAuth, requirePermission("salaryAdvance.backfill", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });

      if (!["disbursed", "repaying"].includes(advance.status)) {
        return res.status(400).json({ error: "Only disbursed or repaying advances can be rescheduled." });
      }

      const schema = z.object({
        startYear: z.number().int().min(2020).max(2100),
        startMonth: z.number().int().min(1).max(12),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });

      const { startYear, startMonth } = parsed.data;

      // Check the new start month is not locked
      const lockedRunCheck = await db.select({ id: salaryReportRuns.id, status: salaryReportRuns.status })
        .from(salaryReportRuns)
        .where(and(eq(salaryReportRuns.year, startYear), eq(salaryReportRuns.month, startMonth)))
        .limit(1);
      if (lockedRunCheck.length > 0 && lockedRunCheck[0].status !== "pending_approval") {
        return res.status(400).json({
          error: `The ${startMonth}/${startYear} salary run is already locked (${lockedRunCheck[0].status}). Choose a later month.`,
        });
      }

      // Count remaining scheduled installments BEFORE deleting, so we rebuild exactly
      // the right number of rows — for a partially-repaid advance the remaining count
      // is less than the original repaymentMonths.
      const existingRepayments = await storage.getSalaryAdvanceRepayments(advance.id);
      const remainingScheduled = existingRepayments.filter(r => r.status === "scheduled");
      const deductedInstallments = existingRepayments.filter(r => r.status === "deducted");
      const months = remainingScheduled.length > 0 ? remainingScheduled.length : (Number(advance.repaymentMonths) || 1);

      // Guard against overlapping with already-deducted months.
      // Build the set of months the new schedule would occupy and check for conflicts.
      if (deductedInstallments.length > 0) {
        const newMonthKeys = new Set<string>();
        let y = startYear, m = startMonth;
        for (let i = 0; i < months; i++) {
          newMonthKeys.add(`${y}-${m}`);
          const next = advanceOneMonth(y, m);
          y = next.year;
          m = next.month;
        }
        const conflict = deductedInstallments.find(d => newMonthKeys.has(`${d.year}-${d.month}`));
        if (conflict) {
          return res.status(400).json({
            error: `Cannot place an installment in ${MONTH_NAMES[conflict.month]} ${conflict.year} — a deduction has already been processed for that month. Choose a start month after ${MONTH_NAMES[conflict.month]} ${conflict.year}.`,
          });
        }
      }

      // Delete existing scheduled (not yet deducted) rows and rebuild.
      await storage.deleteScheduledRepaymentsForAdvance(advance.id);

      const amount = Number(advance.outstandingBalance || advance.approvedAmount || advance.requestedAmount);
      const schedule = buildSchedule({ advanceId: advance.id, userId: advance.requesterId, amount, months, startYear, startMonth });
      await storage.createSalaryAdvanceRepayments(schedule as any);

      // Update the advance's stored start month
      await storage.updateSalaryAdvance(advance.id, {
        repaymentStartYear: startYear,
        repaymentStartMonth: startMonth,
      });

      const actorId = req.session.userId!;
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId, action: "rescheduled",
        oldStatus: advance.status, newStatus: advance.status,
        metadata: { newStartYear: startYear, newStartMonth: startMonth },
      } as any);

      res.json({ success: true, schedule });
    } catch (err) {
      console.error("Reschedule error:", err);
      res.status(500).json({ error: "Failed to reschedule" });
    }
  });

  // ── Edit a single scheduled installment's amount for a specific month.
  // Unlike /reschedule (which shifts the whole schedule), this adjusts how much is
  // recovered in ONE month while preserving the outstanding balance: the difference
  // is redistributed across the remaining scheduled installments (pushed to / pulled
  // from later months). Used inline from the salary-run approval screen.
  app.patch("/api/salary-advances/:id/installment", requireAuth, requirePermission("salaryAdvance.backfill", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (!["disbursed", "repaying"].includes(advance.status)) {
        return res.status(400).json({ error: "Only disbursed or repaying advances can be edited." });
      }

      const schema = z.object({
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
        newAmount: z.number().min(0),
        reason: z.string().trim().min(1, "A reason is required"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });
      const { year, month, reason } = parsed.data;

      const r2 = (n: number) => Math.round(n * 100) / 100;

      // The target month's run must not already be locked.
      if (await isRunLocked(year, month)) {
        return res.status(400).json({ error: `The ${MONTH_NAMES[month]} ${year} salary run is already locked. Use the reverse flow instead.` });
      }

      const repayments = await storage.getSalaryAdvanceRepayments(advance.id);
      const sortKey = (r: { year: number; month: number }) => r.year * 12 + r.month;
      const scheduled = repayments.filter(r => r.status === "scheduled").sort((a, b) => sortKey(a) - sortKey(b));
      const target = scheduled.find(r => r.year === year && r.month === month);
      if (!target) return res.status(400).json({ error: "No scheduled installment exists for that month on this advance." });

      const oldAmount = r2(Number(target.scheduledAmount));
      const later = scheduled.filter(r => sortKey(r) > sortKey(target));
      const sumLater = r2(later.reduce((s, r) => s + Number(r.scheduledAmount), 0));
      // Cannot recover more this month than this month + everything scheduled after it.
      const maxN = r2(oldAmount + sumLater);
      const newAmount = r2(Math.min(Math.max(parsed.data.newAmount, 0), maxN));
      const delta = r2(oldAmount - newAmount); // >0: reduce now, push later; <0: pull from later

      if (delta === 0) {
        return res.json({ success: true, oldAmount, newAmount, unchanged: true });
      }

      await storage.updateSalaryAdvanceRepayment(target.id, { scheduledAmount: newAmount.toFixed(2) } as any);

      if (delta > 0) {
        // Reducing this month — push the freed amount to later installments.
        if (later.length > 0) {
          const last = later[later.length - 1];
          await storage.updateSalaryAdvanceRepayment(last.id, { scheduledAmount: r2(Number(last.scheduledAmount) + delta).toFixed(2) } as any);
        } else {
          // No later installment — create a trailing one in the next free month.
          const nextInstNo = Math.max(0, ...repayments.map(r => Number(r.installmentNo) || 0)) + 1;
          const occupied = new Set(repayments.map(r => `${r.year}-${r.month}`));
          let { year: ny, month: nm } = advanceOneMonth(year, month);
          while (occupied.has(`${ny}-${nm}`)) ({ year: ny, month: nm } = advanceOneMonth(ny, nm));
          await storage.createSalaryAdvanceRepayments([{
            advanceId: advance.id, userId: advance.requesterId, installmentNo: nextInstNo,
            year: ny, month: nm, scheduledAmount: delta.toFixed(2),
          }] as any);
        }
      } else {
        // Increasing this month — pull the extra from later installments, from the end backwards.
        let pull = r2(-delta);
        for (const r of [...later].reverse()) {
          if (pull <= 0) break;
          const amt = r2(Number(r.scheduledAmount));
          if (amt <= pull + 0.005) {
            await storage.deleteSalaryAdvanceRepayment(r.id);
            pull = r2(pull - amt);
          } else {
            await storage.updateSalaryAdvanceRepayment(r.id, { scheduledAmount: r2(amt - pull).toFixed(2) } as any);
            pull = 0;
          }
        }
      }

      const actorId = req.session.userId!;
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId, action: "installment_adjusted",
        oldStatus: advance.status, newStatus: advance.status,
        metadata: { year, month, oldAmount, newAmount, reason, recordedManually: true },
      } as any);

      res.json({ success: true, oldAmount, newAmount });
    } catch (err) {
      console.error("Installment edit error:", err);
      res.status(500).json({ error: "Failed to edit installment" });
    }
  });

  // ── Remove (defer) a not-yet-recovered scheduled installment for a month so it
  // won't apply to this run. The outstanding balance is preserved: the amount is
  // pushed to a new trailing installment. Deducted installments cannot be removed
  // here — those require the existing super-admin reverse flow.
  app.post("/api/salary-advances/:id/installment/remove", requireAuth, requirePermission("salaryAdvance.backfill", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (!["disbursed", "repaying"].includes(advance.status)) {
        return res.status(400).json({ error: "Only disbursed or repaying advances can be edited." });
      }

      const schema = z.object({
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
        reason: z.string().trim().min(1, "A reason is required"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });
      const { year, month, reason } = parsed.data;

      const r2 = (n: number) => Math.round(n * 100) / 100;

      if (await isRunLocked(year, month)) {
        return res.status(400).json({ error: `The ${MONTH_NAMES[month]} ${year} salary run is already locked. Use the reverse flow instead.` });
      }

      const repayments = await storage.getSalaryAdvanceRepayments(advance.id);
      const target = repayments.find(r => r.status === "scheduled" && r.year === year && r.month === month);
      if (!target) return res.status(400).json({ error: "No scheduled installment exists for that month on this advance." });

      const amount = r2(Number(target.scheduledAmount));

      // Delete this month's installment and defer the amount to a new trailing month
      // so the outstanding balance is preserved.
      await storage.deleteSalaryAdvanceRepayment(target.id);

      const remaining = repayments.filter(r => r.id !== target.id);
      const sortKey = (r: { year: number; month: number }) => r.year * 12 + r.month;
      const latest = remaining.length > 0
        ? remaining.reduce((a, b) => (sortKey(a) >= sortKey(b) ? a : b))
        : { year, month };
      const occupied = new Set(remaining.map(r => `${r.year}-${r.month}`));
      let { year: ny, month: nm } = advanceOneMonth(latest.year, latest.month);
      while (occupied.has(`${ny}-${nm}`)) ({ year: ny, month: nm } = advanceOneMonth(ny, nm));
      const nextInstNo = Math.max(0, ...repayments.map(r => Number(r.installmentNo) || 0)) + 1;
      await storage.createSalaryAdvanceRepayments([{
        advanceId: advance.id, userId: advance.requesterId, installmentNo: nextInstNo,
        year: ny, month: nm, scheduledAmount: amount.toFixed(2),
      }] as any);

      const actorId = req.session.userId!;
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId, action: "installment_removed",
        oldStatus: advance.status, newStatus: advance.status,
        metadata: { year, month, amount, deferredTo: { year: ny, month: nm }, reason, recordedManually: true },
      } as any);

      res.json({ success: true, amount, deferredTo: { year: ny, month: nm } });
    } catch (err) {
      console.error("Installment remove error:", err);
      res.status(500).json({ error: "Failed to remove installment" });
    }
  });

  // ── Pending Adjustments — super_admin: global queue of pending_review overpayments/credits.
  app.get("/api/salary-advances/pending-adjustments", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listSalaryAdvancesByStatus(["pending_review"]);
      const enriched = await Promise.all(rows.map(async (a) => {
        let recordedBy = null;
        if ((a as any).recordedById) {
          const u = await storage.getAdminUser((a as any).recordedById);
          if (u) recordedBy = { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email };
        }
        const target = await storage.getAdminUser(a.requesterId);
        return {
          ...a,
          recordedBy,
          requester: target ? { id: target.id, firstName: target.firstName, lastName: target.lastName, email: target.email } : null,
        };
      }));
      res.json(enriched);
    } catch {
      res.status(500).json({ error: "Failed to load pending adjustments" });
    }
  });

  // ── Super admin: approve an HR-recorded adjustment (overpayment or salary_credit).
  app.patch("/api/salary-advances/:id/approve-adjustment", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (!["overpayment", "salary_credit"].includes(advance.kind || "")) {
        return res.status(400).json({ error: "Only overpayment or salary_credit records can be approved via this route." });
      }
      if (advance.status !== "pending_review") {
        return res.status(400).json({ error: "Record is not pending review." });
      }

      const actorId = req.session.userId!;
      const amount = Number(advance.requestedAmount);
      const now = new Date();

      if (advance.kind === "salary_credit") {
        // Credit: mark approved; payroll engine will apply and mark applied.
        const updated = await storage.updateSalaryAdvance(advance.id, {
          status: "approved",
          approvedAmount: amount.toFixed(2),
          finalApprovedBy: actorId,
          finalApprovedAt: now,
          reviewerComment: null,
        });
        await storage.addSalaryAdvanceAuditEntry({
          advanceId: advance.id, actorId, action: "adjustment_approved",
          oldStatus: "pending_review", newStatus: "approved",
          metadata: { kind: advance.kind, amount },
        } as any);
        await notify({
          userId: advance.requesterId, type: "salary_credit_approved",
          title: "Salary credit approved",
          message: `A salary credit of ${amount.toFixed(2)} has been approved and will be applied to the target payroll month.`,
          link: EMPLOYEE_LINK,
        });
        if ((advance as any).recordedById) {
          await notify({
            userId: (advance as any).recordedById, type: "salary_adjustment_approved",
            title: "Adjustment approved",
            message: `Your salary credit submission for ${amount.toFixed(2)} has been approved.`,
            link: "/admin/salary-advance?tab=my-submissions",
          });
        }
        return res.json(updated);
      }

      // Overpayment: resolve the First Recovery Month from the caller, falling back
      // to the value captured when the record was created (backfill / record dialog).
      const ovpSchema = z.object({
        startYear: z.number().int().min(2000).max(2100).optional(),
        startMonth: z.number().int().min(1).max(12).optional(),
      });
      const ovpParsed = ovpSchema.safeParse(req.body);
      const resolvedStartYear = ovpParsed.success && ovpParsed.data.startYear != null
        ? ovpParsed.data.startYear
        : (advance.repaymentStartYear ?? null);
      const resolvedStartMonth = ovpParsed.success && ovpParsed.data.startMonth != null
        ? ovpParsed.data.startMonth
        : (advance.repaymentStartMonth ?? null);
      if (resolvedStartYear == null || resolvedStartMonth == null) {
        return res.status(400).json({ error: "First Recovery Month (startYear + startMonth) is required to approve an overpayment." });
      }
      const months = Number(advance.repaymentMonths) || 1;
      // Check if the chosen month is already locked — warn but honour the choice.
      const ovpStartCheck = await checkStartMonthLocked({ year: resolvedStartYear, month: resolvedStartMonth });
      const start = { year: ovpStartCheck.year, month: ovpStartCheck.month };
      const startMonthWarning = ovpStartCheck.locked;
      const monthlyDeduction = Math.ceil((amount / months) * 100) / 100;

      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "disbursed",
        approvedAmount: amount.toFixed(2),
        repaymentMonths: months,
        monthlyDeduction: monthlyDeduction.toFixed(2),
        repaymentStartYear: start.year,
        repaymentStartMonth: start.month,
        outstandingBalance: amount.toFixed(2),
        finalApprovedBy: actorId,
        finalApprovedAt: now,
        reviewerComment: null,
      });

      const schedule = buildSchedule({ advanceId: advance.id, userId: advance.requesterId, amount, months, startYear: start.year, startMonth: start.month });
      await storage.createSalaryAdvanceRepayments(schedule as any);

      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId, action: "adjustment_approved",
        oldStatus: "pending_review", newStatus: "disbursed",
        metadata: { kind: advance.kind, amount, months, scheduleStart: start },
      } as any);

      await notify({
        userId: advance.requesterId, type: "salary_overpayment_approved",
        title: "Overpayment recovery scheduled",
        message: `An overpayment recovery of ${amount.toFixed(2)} has been approved and will be deducted over ${months} month(s).`,
        link: EMPLOYEE_LINK,
      });
      if ((advance as any).recordedById) {
        await notify({
          userId: (advance as any).recordedById, type: "salary_adjustment_approved",
          title: "Adjustment approved",
          message: `Your overpayment submission for ${amount.toFixed(2)} has been approved.`,
          link: "/admin/salary-advance?tab=my-submissions",
        });
      }
      return res.json({ ...updated, repayments: schedule, startMonthWarning });
    } catch (err) {
      console.error("Approve adjustment error:", err);
      res.status(500).json({ error: "Failed to approve adjustment" });
    }
  });

  // ── Super admin: return an HR-recorded adjustment for edit.
  app.patch("/api/salary-advances/:id/return-adjustment", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "pending_review") return res.status(400).json({ error: "Record is not pending review." });

      const schema = z.object({ comment: z.string().min(1, "A comment is required") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A comment is required" });

      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "returned",
        reviewerComment: parsed.data.comment,
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "adjustment_returned",
        oldStatus: "pending_review", newStatus: "returned",
        metadata: { comment: parsed.data.comment },
      } as any);
      if ((advance as any).recordedById) {
        await notify({
          userId: (advance as any).recordedById, type: "salary_adjustment_returned",
          title: "Adjustment returned for edit",
          message: `Your ${advance.kind === "salary_credit" ? "salary credit" : "overpayment"} submission was returned: ${parsed.data.comment}`,
          link: "/admin/salary-advance?tab=my-submissions",
        });
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to return adjustment" });
    }
  });

  // ── Super admin: permanently reject an HR-recorded adjustment.
  app.patch("/api/salary-advances/:id/reject-adjustment", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "pending_review") return res.status(400).json({ error: "Record is not pending review." });

      const schema = z.object({ comment: z.string().min(1, "A rejection reason is required") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A rejection reason is required" });

      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "rejected",
        reviewerComment: parsed.data.comment,
        rejectedBy: req.session.userId!,
        rejectedAt: new Date(),
        rejectionReason: parsed.data.comment,
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "adjustment_rejected",
        oldStatus: "pending_review", newStatus: "rejected",
        metadata: { comment: parsed.data.comment },
      } as any);
      if ((advance as any).recordedById) {
        await notify({
          userId: (advance as any).recordedById, type: "salary_adjustment_rejected",
          title: "Adjustment rejected",
          message: `Your ${advance.kind === "salary_credit" ? "salary credit" : "overpayment"} submission was rejected: ${parsed.data.comment}`,
          link: "/admin/salary-advance?tab=my-submissions",
        });
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to reject adjustment" });
    }
  });

  // ── HR/Admin: resubmit a returned adjustment with edits.
  app.patch("/api/salary-advances/:id/resubmit-adjustment", requireAuth, requirePermission("salaryAdvance.backfill", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      // A returned adjustment (sent back for edit) or a rejected one (re-opened
      // so it is not a dead end) can both be edited and resubmitted for approval.
      if (!["returned", "rejected"].includes(advance.status)) {
        return res.status(400).json({ error: "Only a returned or rejected adjustment can be resubmitted." });
      }
      const priorStatus = advance.status;

      // Only the original submitter (or super_admin/admin) may resubmit
      const actorId = req.session.userId!;
      const role = req.session.role || "";
      const isOriginal = (advance as any).recordedById === actorId;
      if (!isOriginal && !["super_admin", "admin"].includes(role)) {
        return res.status(403).json({ error: "Only the original submitter can resubmit this adjustment." });
      }

      const schema = z.object({
        amount: z.number().positive().optional(),
        reason: z.string().min(1).optional(),
        repaymentMonths: z.number().int().min(1).max(36).optional(),
        targetMonth: z.number().int().min(1).max(12).optional(),
        targetYear: z.number().int().min(2000).max(2100).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });

      const updates: any = {
        status: "pending_review",
        reviewerComment: null,
        returnNote: null,
        // A re-opened rejected record clears its rejection metadata so the row
        // is treated as a fresh pending submission again.
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      };
      if (parsed.data.amount !== undefined) {
        updates.requestedAmount = parsed.data.amount.toFixed(2);
        updates.outstandingBalance = parsed.data.amount.toFixed(2);
      }
      if (parsed.data.reason !== undefined) updates.reason = parsed.data.reason;
      if (parsed.data.repaymentMonths !== undefined) updates.repaymentMonths = parsed.data.repaymentMonths;
      if (parsed.data.targetMonth !== undefined) updates.targetMonth = parsed.data.targetMonth;
      if (parsed.data.targetYear !== undefined) updates.targetYear = parsed.data.targetYear;

      const updated = await storage.updateSalaryAdvance(advance.id, updates);
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId, action: priorStatus === "rejected" ? "adjustment_reopened" : "adjustment_resubmitted",
        oldStatus: priorStatus, newStatus: "pending_review",
        metadata: { changes: parsed.data, reopenedFrom: priorStatus },
      } as any);

      // Notify super admins
      const allUsers = await storage.getAdminUsers();
      for (const u of allUsers.filter(x => x.role === "super_admin" && x.isActive)) {
        await notify({
          userId: u.id, type: "salary_adjustment_pending_review",
          title: "Adjustment resubmitted for approval",
          message: `A ${advance.kind === "salary_credit" ? "salary credit" : "overpayment"} adjustment has been resubmitted and awaits your approval.`,
          link: "/admin/salary-advance?tab=pending-adjustments",
        });
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to resubmit adjustment" });
    }
  });

  // ── Super admin: reverse (undo) an ALREADY-APPROVED HR-recorded adjustment.
  // Sends the record back to the editable "returned" state so a mistake (wrong
  // amount / employee / month) can be corrected and resubmitted. Blocks the
  // action outright when money has already moved.
  app.patch("/api/salary-advances/:id/reverse-adjustment", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (!["overpayment", "salary_credit"].includes(advance.kind || "")) {
        return res.status(400).json({ error: "Only overpayment or salary credit adjustments can be reversed." });
      }

      const schema = z.object({ comment: z.string().min(1, "A reason is required") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A reason is required to reverse an approval." });
      const comment = parsed.data.comment;
      const actorId = req.session.userId!;

      if (advance.kind === "overpayment") {
        // An approved overpayment sits in "disbursed" with a generated recovery
        // schedule. It can only be reversed while NO installment has moved.
        if (advance.status !== "disbursed") {
          return res.status(400).json({ error: `Only an approved (disbursed) overpayment can be reversed. This record is "${advance.status.replace(/_/g, " ")}".` });
        }
        const repayments = await storage.getSalaryAdvanceRepayments(advance.id);
        const recovered = repayments.some(r => r.status === "deducted");
        const repaidSoFar = Number(advance.totalRepaid || 0);
        if (recovered || repaidSoFar > 0) {
          return res.status(400).json({
            error: "This overpayment already has at least one installment recovered from the employee's pay, so it cannot be reversed. Record a compensating salary credit instead to return the recovered amount.",
          });
        }
        // Guard the generated-but-not-finalized case: if any scheduled installment
        // falls in a salary run that has already been generated (pending_approval)
        // or locked, its recovery figure is already baked into that run.
        const scheduled = repayments.filter(r => r.status === "scheduled");
        for (const r of scheduled) {
          const runs = await db.select({ status: salaryReportRuns.status })
            .from(salaryReportRuns)
            .where(and(eq(salaryReportRuns.year, r.year), eq(salaryReportRuns.month, r.month)))
            .limit(1);
          if (runs.length > 0) {
            return res.status(400).json({
              error: `The ${MONTH_NAMES[r.month]} ${r.year} salary run has already been generated with this recovery included. Regenerate that salary run first, then reverse this overpayment.`,
            });
          }
        }

        // Safe to reverse: drop the pending schedule and return for edit.
        await storage.deleteScheduledRepaymentsForAdvance(advance.id);
        const updated = await storage.updateSalaryAdvance(advance.id, {
          status: "returned",
          approvedAmount: null,
          monthlyDeduction: null,
          finalApprovedBy: null,
          finalApprovedAt: null,
          outstandingBalance: "0",
          totalRepaid: "0",
          reviewerComment: comment,
        });
        await storage.addSalaryAdvanceAuditEntry({
          advanceId: advance.id, actorId, action: "adjustment_reversed",
          oldStatus: "disbursed", newStatus: "returned",
          metadata: { kind: advance.kind, comment },
        } as any);
        if ((advance as any).recordedById) {
          await notify({
            userId: (advance as any).recordedById, type: "salary_adjustment_returned",
            title: "Approved overpayment reversed",
            message: `An approved overpayment for ${Number(advance.requestedAmount).toFixed(2)} was reversed and returned for edit: ${comment}`,
            link: "/admin/salary-advance?tab=my-submissions",
          });
        }
        return res.json(updated);
      }

      // salary_credit: an approved credit waits in "approved" until a salary run
      // applies it (→ "applied"). It can only be reversed while still unapplied
      // AND not already snapshotted into a generated run.
      if (advance.status !== "approved") {
        if (advance.status === "applied") {
          return res.status(400).json({
            error: "This salary credit has already been paid out in a completed salary run, so it cannot be reversed. Record a compensating overpayment instead to recover it.",
          });
        }
        return res.status(400).json({ error: `Only an approved salary credit can be reversed. This record is "${advance.status.replace(/_/g, " ")}".` });
      }
      // A credit with status "approved" is provably NOT yet applied — the salary
      // run finalize path (applyCreditsForRun) flips any included credit to
      // "applied". So the mere existence of a run for the target month does NOT
      // block reversal; a credit approved AFTER a run was generated/finalized is
      // simply excluded from that run and remains reversible. We only block when
      // this specific credit is baked into a run's snapshot.
      const tYear = (advance as any).targetYear as number | null;
      const tMonth = (advance as any).targetMonth as number | null;
      if (tYear && tMonth) {
        const runs = await db.select({ status: salaryReportRuns.status, adjustments: salaryReportRuns.adjustments })
          .from(salaryReportRuns)
          .where(and(eq(salaryReportRuns.year, tYear), eq(salaryReportRuns.month, tMonth)))
          .limit(1);
        if (runs.length > 0) {
          const run = runs[0];
          const snapshot = (run.adjustments as any)?.__creditSnapshot__ as string[] | undefined;
          const included = Array.isArray(snapshot) && snapshot.includes(advance.id);
          if (included) {
            // The credit's amount is already reflected in this run's gross-pay
            // computation. For a pending run, finalizing it would apply the credit.
            // For a finalized run that still shows the credit as "approved" (i.e.
            // apply failed), the figure is nonetheless baked in. Either way,
            // regenerate the run before reversing so the numbers stay consistent.
            return res.status(400).json({
              error: `The ${MONTH_NAMES[tMonth]} ${tYear} salary run has already been generated with this credit included. Regenerate that salary run first, then reverse this credit.`,
            });
          }
        }
      }

      const updatedCredit = await storage.updateSalaryAdvance(advance.id, {
        status: "returned",
        approvedAmount: null,
        finalApprovedBy: null,
        finalApprovedAt: null,
        reviewerComment: comment,
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId, action: "adjustment_reversed",
        oldStatus: "approved", newStatus: "returned",
        metadata: { kind: advance.kind, comment },
      } as any);
      if ((advance as any).recordedById) {
        await notify({
          userId: (advance as any).recordedById, type: "salary_adjustment_returned",
          title: "Approved salary credit reversed",
          message: `An approved salary credit for ${Number(advance.requestedAmount).toFixed(2)} was reversed and returned for edit: ${comment}`,
          link: "/admin/salary-advance?tab=my-submissions",
        });
      }
      return res.json(updatedCredit);
    } catch (err) {
      console.error("Reverse adjustment error:", err);
      res.status(500).json({ error: "Failed to reverse adjustment" });
    }
  });

  // ── Create a request
  app.post("/api/salary-advances", requireAuth, requirePermission("salaryAdvance.create", "super_admin", "admin", "hr", "finance", "operations", "manager", "recruiter", "employee"), async (req: Request, res: Response) => {
    try {
      const policy = await getPolicy();
      if (!policy.enabled) return res.status(403).json({ error: "Salary advances are currently disabled by policy." });

      const schema = z.object({
        requestedAmount: z.number().positive("Amount must be greater than zero"),
        reason: z.string().min(5, "Please provide a reason (at least 5 characters)"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });

      const userId = req.session.userId!;
      const { requestedAmount, reason } = parsed.data;

      const eligibility = await evaluateEligibility(userId, requestedAmount, policy);
      const managerId = await resolveApprover(userId);

      // Pre-compute the CEO-escalation flag so it's visible immediately on the advance record.
      const netSalaryForCap = await getNetSalary(userId);
      const exceedsSalaryCap = netSalaryForCap > 0 && requestedAmount > netSalaryForCap * 0.5;

      const created = await storage.createSalaryAdvanceWithNumber({
        requesterId: userId,
        managerId: managerId || undefined,
        requestedAmount: requestedAmount.toFixed(2),
        reason,
        outstandingBalance: "0",
        totalRepaid: "0",
        policySnapshot: policy,
        exceedsSalaryCap,
      } as any);

      await storage.addSalaryAdvanceAuditEntry({
        advanceId: created.id,
        actorId: userId,
        action: "created",
        newStatus: "pending_manager",
        metadata: { requestNumber: created.requestNumber, requestedAmount, warnings: eligibility.warnings },
      } as any);

      await notify({
        userId,
        type: "salary_advance_submitted",
        title: "Advance request submitted",
        message: `Your salary advance ${created.requestNumber} is pending manager approval.`,
        link: EMPLOYEE_LINK,
      });
      if (managerId) {
        const requester = await storage.getAdminUser(userId);
        await notify({
          userId: managerId,
          type: "salary_advance_approval_needed",
          title: "Advance request needs approval",
          message: `${requester?.firstName || "An employee"} requested a salary advance (${created.requestNumber}).`,
          link: MANAGER_LINK,
        });
      }

      res.status(201).json({ ...created, warnings: eligibility.warnings });
    } catch (err) {
      console.error("Salary advance create error:", err);
      res.status(500).json({ error: "Failed to create advance request" });
    }
  });

  // ── Detail
  app.get("/api/salary-advances/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });

      const userId = req.session.userId!;
      const role = req.session.role || "employee";
      const isOwner = advance.requesterId === userId;
      const isManager = advance.managerId === userId;
      const isPrivileged = ["super_admin", "admin", "hr", "finance"].includes(role);
      if (!isOwner && !isManager && !isPrivileged) return res.status(403).json({ error: "Forbidden" });

      const [repayments, auditLog] = await Promise.all([
        storage.getSalaryAdvanceRepayments(advance.id),
        storage.getSalaryAdvanceAuditLog(advance.id),
      ]);

      const ids = new Set<string>([advance.requesterId]);
      if (advance.managerId) ids.add(advance.managerId);
      for (const a of auditLog) ids.add(a.actorId);
      const userMap: Record<string, any> = {};
      for (const id of ids) {
        const u = await storage.getAdminUser(id);
        if (u) userMap[id] = { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role };
      }

      // Re-evaluate soft eligibility so approvers see the same policy warnings
      // the employee saw at request time (cap/ceiling/tenure/probation/active).
      let eligibilityWarnings: string[] = [];
      try {
        const policy = await getPolicy();
        const evalAmount = Number(advance.approvedAmount ?? advance.requestedAmount ?? 0);
        const elig = await evaluateEligibility(advance.requesterId, evalAmount, policy);
        eligibilityWarnings = elig.warnings;
      } catch { /* warnings are advisory; never block the detail view */ }

      res.json({
        ...advance,
        requester: userMap[advance.requesterId] || null,
        manager: advance.managerId ? userMap[advance.managerId] || null : null,
        repayments,
        auditLog: auditLog.map(a => ({ ...a, actor: userMap[a.actorId] || null })),
        eligibilityWarnings,
      });
    } catch {
      res.status(500).json({ error: "Failed to load advance" });
    }
  });

  // ── Cancel (owner, while still pending/returned)
  app.post("/api/salary-advances/:id/cancel", requireAuth, async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.requesterId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
      if (!["pending_manager", "pending_final", "returned"].includes(advance.status)) {
        return res.status(400).json({ error: "Only a pending request can be cancelled." });
      }
      const updated = await storage.updateSalaryAdvance(advance.id, { status: "cancelled" });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "cancelled",
        oldStatus: advance.status, newStatus: "cancelled", metadata: null,
      } as any);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to cancel" });
    }
  });

  // ── Resubmit (owner, after a return for clarification)
  app.post("/api/salary-advances/:id/resubmit", requireAuth, async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.requesterId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
      if (advance.status !== "returned") return res.status(400).json({ error: "Only a returned request can be resubmitted." });

      const schema = z.object({
        requestedAmount: z.number().positive(),
        reason: z.string().min(5),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });

      const updated = await storage.updateSalaryAdvance(advance.id, {
        requestedAmount: parsed.data.requestedAmount.toFixed(2),
        reason: parsed.data.reason,
        status: "pending_manager",
        returnNote: null,
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "resubmitted",
        oldStatus: "returned", newStatus: "pending_manager",
        metadata: { requestedAmount: parsed.data.requestedAmount },
      } as any);
      if (advance.managerId) {
        await notify({
          userId: advance.managerId, type: "salary_advance_approval_needed",
          title: "Advance request resubmitted",
          message: `${advance.requestNumber} was updated and resubmitted for your approval.`,
          link: MANAGER_LINK,
        });
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to resubmit" });
    }
  });

  // ── Manager: return for clarification
  app.post("/api/salary-advances/:id/return", requireAuth, requirePermission("salaryAdvance.managerApprove", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "pending_manager") return res.status(400).json({ error: "Request is not pending manager approval." });
      const role = req.session.role || "";
      const isApprover = role === "super_admin" || role === "admin" || advance.managerId === req.session.userId;
      if (!isApprover) return res.status(403).json({ error: "Only the routed manager may return this request." });

      const schema = z.object({ note: z.string().min(1, "A note is required") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A note is required" });

      const updated = await storage.updateSalaryAdvance(advance.id, { status: "returned", returnNote: parsed.data.note });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "returned_for_info",
        oldStatus: advance.status, newStatus: "returned", metadata: { note: parsed.data.note },
      } as any);
      await notify({
        userId: advance.requesterId, type: "salary_advance_returned",
        title: "Advance request needs more info",
        message: `${advance.requestNumber} was returned: ${parsed.data.note}`,
        link: EMPLOYEE_LINK,
      });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to return request" });
    }
  });

  // ── Manager: reject
  app.post("/api/salary-advances/:id/manager-reject", requireAuth, requirePermission("salaryAdvance.managerApprove", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "pending_manager") return res.status(400).json({ error: "Request is not pending manager approval." });
      const role = req.session.role || "";
      const isApprover = role === "super_admin" || role === "admin" || advance.managerId === req.session.userId;
      if (!isApprover) return res.status(403).json({ error: "Only the routed manager may reject this request." });

      const schema = z.object({ reason: z.string().min(1, "A rejection reason is required") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A rejection reason is required" });

      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "rejected", rejectedBy: req.session.userId!, rejectedAt: new Date(), rejectionReason: parsed.data.reason,
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "manager_rejected",
        oldStatus: advance.status, newStatus: "rejected", metadata: { reason: parsed.data.reason },
      } as any);
      await notify({
        userId: advance.requesterId, type: "salary_advance_rejected",
        title: "Advance request rejected",
        message: `${advance.requestNumber} was rejected by your manager: ${parsed.data.reason}`,
        link: EMPLOYEE_LINK,
      });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to reject" });
    }
  });

  // ── Manager: approve (with proposed repayment plan) -> pending_final
  app.post("/api/salary-advances/:id/manager-approve", requireAuth, requirePermission("salaryAdvance.managerApprove", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "pending_manager") return res.status(400).json({ error: "Request is not pending manager approval." });
      const role = req.session.role || "";
      const isApprover = role === "super_admin" || role === "admin" || advance.managerId === req.session.userId;
      if (!isApprover) return res.status(403).json({ error: "Only the routed manager may approve this request." });

      const policy = await getPolicy();
      const schema = z.object({
        approvedAmount: z.number().positive(),
        repaymentMonths: z.number().int().min(1),
        isException: z.boolean().optional(),
        exceptionReason: z.string().optional(),
        note: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });
      const { approvedAmount, repaymentMonths, isException, exceptionReason, note } = parsed.data;

      if (approvedAmount > Number(advance.requestedAmount)) {
        return res.status(400).json({ error: "Approved amount cannot exceed the requested amount." });
      }
      // Manager stage is capped at the manager-stage ceiling for EVERY approver
      // role (manager/hr/admin acting here). The higher CEO ceiling only applies
      // at the final super-admin stage.
      const maxMonths = policy.managerMaxMonths;
      if (repaymentMonths > maxMonths) {
        return res.status(400).json({ error: `Repayment months cannot exceed ${maxMonths} at the manager approval stage.` });
      }

      const monthlyDeduction = Math.ceil((approvedAmount / repaymentMonths) * 100) / 100;

      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "pending_final",
        approvedAmount: approvedAmount.toFixed(2),
        repaymentMonths,
        monthlyDeduction: monthlyDeduction.toFixed(2),
        isException: !!isException,
        exceptionReason: isException ? (exceptionReason || null) : null,
        managerApprovedBy: req.session.userId!,
        managerApprovedAt: new Date(),
        managerNote: note || null,
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "manager_approved",
        oldStatus: advance.status, newStatus: "pending_final",
        metadata: { approvedAmount, repaymentMonths, monthlyDeduction, isException: !!isException },
      } as any);

      // Notify super admins for final approval
      const users = await storage.getAdminUsers();
      for (const u of users.filter(x => x.role === "super_admin" && x.isActive)) {
        await notify({
          userId: u.id, type: "salary_advance_final_needed",
          title: "Advance request needs final approval",
          message: `${advance.requestNumber} was approved by the manager and awaits your final sign-off.`,
          link: "/admin/salary-advance?tab=final",
        });
      }
      await notify({
        userId: advance.requesterId, type: "salary_advance_manager_approved",
        title: "Advance approved by manager",
        message: `${advance.requestNumber} was approved by your manager and is awaiting final approval.`,
        link: EMPLOYEE_LINK,
      });
      res.json(updated);
    } catch (err) {
      console.error("Manager approve error:", err);
      res.status(500).json({ error: "Failed to approve" });
    }
  });

  // ── Super admin: final reject
  app.post("/api/salary-advances/:id/final-reject", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "pending_final") return res.status(400).json({ error: "Request is not pending final approval." });

      const schema = z.object({ reason: z.string().min(1, "A rejection reason is required") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A rejection reason is required" });

      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "rejected", rejectedBy: req.session.userId!, rejectedAt: new Date(), rejectionReason: parsed.data.reason,
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "final_rejected",
        oldStatus: advance.status, newStatus: "rejected", metadata: { reason: parsed.data.reason },
      } as any);
      await notify({
        userId: advance.requesterId, type: "salary_advance_rejected",
        title: "Advance request rejected",
        message: `${advance.requestNumber} was rejected at final approval: ${parsed.data.reason}`,
        link: EMPLOYEE_LINK,
      });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to reject" });
    }
  });

  // ── Super admin: final approve (generate repayment schedule)
  app.post("/api/salary-advances/:id/final-approve", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "pending_final") return res.status(400).json({ error: "Request is not pending final approval." });

      const policy = await getPolicy();
      const schema = z.object({
        approvedAmount: z.number().positive().optional(),
        repaymentMonths: z.number().int().min(1).optional(),
        note: z.string().optional(),
        startMonth: z.number().int().min(1).max(12),
        startYear: z.number().int().min(2000).max(2100),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "First Recovery Month (startYear + startMonth) is required", errors: parsed.error.errors });

      const approvedAmount = parsed.data.approvedAmount ?? Number(advance.approvedAmount || advance.requestedAmount);
      const repaymentMonths = parsed.data.repaymentMonths ?? Number(advance.repaymentMonths || policy.defaultMaxMonths);

      if (approvedAmount > Number(advance.requestedAmount)) {
        return res.status(400).json({ error: "Approved amount cannot exceed the requested amount." });
      }
      if (repaymentMonths > policy.ceoMaxMonths) {
        return res.status(400).json({ error: `Repayment months cannot exceed ${policy.ceoMaxMonths}.` });
      }

      const monthlyDeduction = Math.ceil((approvedAmount / repaymentMonths) * 100) / 100;
      // The HR approver explicitly picks a First Recovery Month — we never auto-bump.
      // Check if the chosen month is already locked and warn, but still honour the choice.
      const finalCheck = await checkStartMonthLocked({ year: parsed.data.startYear, month: parsed.data.startMonth });
      const start = { year: finalCheck.year, month: finalCheck.month };
      const startMonthWarning = finalCheck.locked;
      const now = new Date();

      // CEO escalation: if the advance exceeds 50% of the employee's monthly salary,
      // route to pending_ceo instead of disbursing immediately.
      const netSalary = await getNetSalary(advance.requesterId);
      const halfSalary = netSalary > 0 ? netSalary * 0.5 : Infinity;
      const needsCeoApproval = approvedAmount > halfSalary;

      if (needsCeoApproval) {
        // Store the schedule parameters on the advance but don't create repayments yet.
        const updated = await storage.updateSalaryAdvance(advance.id, {
          status: "pending_ceo",
          approvedAmount: approvedAmount.toFixed(2),
          repaymentMonths,
          monthlyDeduction: monthlyDeduction.toFixed(2),
          repaymentStartYear: start.year,
          repaymentStartMonth: start.month,
          outstandingBalance: approvedAmount.toFixed(2),
          finalApprovedBy: req.session.userId!,
          finalApprovedAt: now,
          finalNote: parsed.data.note || null,
          exceedsSalaryCap: true,
        } as any);

        await storage.addSalaryAdvanceAuditEntry({
          advanceId: advance.id, actorId: req.session.userId!, action: "escalated_to_ceo",
          oldStatus: advance.status, newStatus: "pending_ceo",
          metadata: { approvedAmount, repaymentMonths, netSalary, halfSalary },
        } as any);

        // Notify all parties: CEO (super_admin), HR users, manager, and requester
        const allUsers = await storage.getAdminUsers();
        const activeUsers = allUsers.filter((x: any) => x.isActive !== false);
        for (const u of activeUsers.filter((x: any) => x.role === "super_admin")) {
          await notify({
            userId: u.id, type: "salary_advance_ceo_needed",
            title: "CEO approval required for salary advance",
            message: `${advance.requestNumber} exceeds 50% of net salary — requires CEO sign-off.`,
            link: "/admin/salary-advance?tab=ceo",
          });
        }
        for (const u of activeUsers.filter((x: any) => x.role === "hr")) {
          await notify({
            userId: u.id, type: "salary_advance_ceo_needed",
            title: "Advance escalated to CEO",
            message: `${advance.requestNumber} exceeds the 50% cap and has been forwarded to CEO.`,
            link: "/admin/salary-advance?tab=final",
          });
        }
        if (advance.managerId) {
          await notify({
            userId: advance.managerId, type: "salary_advance_ceo_needed",
            title: "Advance escalated to CEO",
            message: `${advance.requestNumber} (team member) exceeds the 50% cap and is awaiting CEO approval.`,
            link: "/admin/salary-advance?tab=approvals",
          });
        }
        await notify({
          userId: advance.requesterId, type: "salary_advance_ceo_pending",
          title: "Advance escalated for CEO approval",
          message: `${advance.requestNumber} exceeds the standard cap and is pending CEO approval.`,
          link: EMPLOYEE_LINK,
        });

        return res.json(updated);
      }

      // Centralized lifecycle: final approval auto-disburses the advance so the
      // payroll recovery engine (which acts on disbursed/repaying advances) picks
      // it up immediately — no separate manual "disburse" step required.
      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "disbursed",
        approvedAmount: approvedAmount.toFixed(2),
        repaymentMonths,
        monthlyDeduction: monthlyDeduction.toFixed(2),
        repaymentStartYear: start.year,
        repaymentStartMonth: start.month,
        outstandingBalance: approvedAmount.toFixed(2),
        finalApprovedBy: req.session.userId!,
        finalApprovedAt: now,
        finalNote: parsed.data.note || null,
        disbursedBy: req.session.userId!,
        disbursedAt: now,
      });

      const schedule = buildSchedule({
        advanceId: advance.id,
        userId: advance.requesterId,
        amount: approvedAmount,
        months: repaymentMonths,
        startYear: start.year,
        startMonth: start.month,
      });
      await storage.createSalaryAdvanceRepayments(schedule as any);

      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "final_approved",
        oldStatus: advance.status, newStatus: "disbursed",
        metadata: { approvedAmount, repaymentMonths, monthlyDeduction, scheduleStart: start, autoDisbursed: true },
      } as any);

      // Record the disbursement in the centralized salary ledger (does not change
      // base salary). Idempotent per advance.
      try {
        const { recordAdvanceLedgerEntry } = await import("./salaryLedger");
        await recordAdvanceLedgerEntry({
          employeeId: advance.requesterId,
          advanceId: advance.id,
          amount: approvedAmount,
          reason: `Salary advance ${advance.requestNumber} disbursed`,
          effectiveDate: now,
          initiatedBy: req.session.userId!,
        });
      } catch (ledgerErr) {
        console.error("Advance ledger entry failed (non-fatal):", ledgerErr);
      }

      await notify({
        userId: advance.requesterId, type: "salary_advance_approved",
        title: "Advance request approved & disbursed",
        message: `${advance.requestNumber} approved for ${approvedAmount.toFixed(2)} and disbursed. Repayment over ${repaymentMonths} month(s) begins via payroll.`,
        link: EMPLOYEE_LINK,
      });
      res.json({ ...updated, repayments: schedule, startMonthWarning });
    } catch (err) {
      console.error("Final approve error:", err);
      res.status(500).json({ error: "Failed to approve" });
    }
  });

  // ── CEO: approve a pending_ceo advance (disburse with the already-computed schedule)
  app.post("/api/salary-advances/:id/ceo-approve", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "pending_ceo") return res.status(400).json({ error: "Request is not pending CEO approval." });

      const schema = z.object({ note: z.string().optional() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

      const actorId = req.session.userId!;
      const approvedAmount = Number(advance.approvedAmount || advance.requestedAmount);
      const repaymentMonths = Number(advance.repaymentMonths || 1);
      // Use the start month already chosen and stored at final-approve time — no re-bump.
      const startYear = Number(advance.repaymentStartYear) || nextMonth().year;
      const startMonth = Number(advance.repaymentStartMonth) || nextMonth().month;
      const now = new Date();

      const schedule = buildSchedule({
        advanceId: advance.id,
        userId: advance.requesterId,
        amount: approvedAmount,
        months: repaymentMonths,
        startYear,
        startMonth,
      });

      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "disbursed",
        repaymentStartYear: startYear,
        repaymentStartMonth: startMonth,
        disbursedBy: actorId,
        disbursedAt: now,
        finalNote: parsed.data.note || (advance.finalNote as string | null) || null,
      });
      await storage.createSalaryAdvanceRepayments(schedule as any);

      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId, action: "ceo_approved",
        oldStatus: "pending_ceo", newStatus: "disbursed",
        metadata: { approvedAmount, repaymentMonths, scheduleStart: { year: startYear, month: startMonth } },
      } as any);

      try {
        const { recordAdvanceLedgerEntry } = await import("./salaryLedger");
        await recordAdvanceLedgerEntry({
          employeeId: advance.requesterId,
          advanceId: advance.id,
          amount: approvedAmount,
          reason: `Salary advance ${advance.requestNumber} disbursed (CEO-approved)`,
          effectiveDate: now,
          initiatedBy: actorId,
        });
      } catch (ledgerErr) {
        console.error("CEO advance ledger entry failed (non-fatal):", ledgerErr);
      }

      // Notify all chain members of the CEO approval outcome
      await notify({
        userId: advance.requesterId, type: "salary_advance_approved",
        title: "Advance approved by CEO & disbursed",
        message: `${advance.requestNumber} has been approved and disbursed. Repayment over ${repaymentMonths} month(s) begins via payroll.`,
        link: EMPLOYEE_LINK,
      });
      try {
        const allU = await storage.getAdminUsers();
        const activeU = allU.filter((x: any) => x.isActive !== false);
        for (const u of activeU.filter((x: any) => x.role === "hr")) {
          await notify({ userId: u.id, type: "salary_advance_approved",
            title: "Advance approved by CEO",
            message: `${advance.requestNumber} CEO-approved and disbursed.`,
            link: "/admin/salary-advance?tab=final" });
        }
        if (advance.managerId) {
          await notify({ userId: advance.managerId, type: "salary_advance_approved",
            title: "Team advance CEO-approved",
            message: `${advance.requestNumber} has been approved by the CEO and disbursed.`,
            link: "/admin/salary-advance?tab=approvals" });
        }
      } catch { /* notification fanout errors are non-fatal */ }
      res.json({ ...updated, repayments: schedule });
    } catch (err) {
      console.error("CEO approve error:", err);
      res.status(500).json({ error: "Failed to approve" });
    }
  });

  // ── CEO: reject a pending_ceo advance
  app.post("/api/salary-advances/:id/ceo-reject", requireAuth, requirePermission("salaryAdvance.finalApprove", "super_admin"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "pending_ceo") return res.status(400).json({ error: "Request is not pending CEO approval." });

      const schema = z.object({ reason: z.string().min(1, "A rejection reason is required") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A rejection reason is required" });

      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "rejected",
        rejectedBy: req.session.userId!,
        rejectedAt: new Date(),
        rejectionReason: parsed.data.reason,
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "ceo_rejected",
        oldStatus: "pending_ceo", newStatus: "rejected",
        metadata: { reason: parsed.data.reason },
      } as any);
      // Notify all chain members of the CEO rejection outcome
      await notify({
        userId: advance.requesterId, type: "salary_advance_rejected",
        title: "Advance request rejected by CEO",
        message: `${advance.requestNumber} was rejected: ${parsed.data.reason}`,
        link: EMPLOYEE_LINK,
      });
      try {
        const allU = await storage.getAdminUsers();
        const activeU = allU.filter((x: any) => x.isActive !== false);
        for (const u of activeU.filter((x: any) => x.role === "hr")) {
          await notify({ userId: u.id, type: "salary_advance_rejected",
            title: "Advance rejected by CEO",
            message: `${advance.requestNumber} was rejected by the CEO: ${parsed.data.reason}`,
            link: "/admin/salary-advance?tab=final" });
        }
        if (advance.managerId) {
          await notify({ userId: advance.managerId, type: "salary_advance_rejected",
            title: "Team advance rejected by CEO",
            message: `${advance.requestNumber} was rejected: ${parsed.data.reason}`,
            link: "/admin/salary-advance?tab=approvals" });
        }
      } catch { /* notification fanout errors are non-fatal */ }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to reject" });
    }
  });

  // ── Attachments: request presigned upload URL (server-scoped + HMAC-signed token)
  // The client must supply advanceId so the server can scope the token to that
  // specific advance and verify ownership.  The returned `uploadToken` encodes
  // the server-generated objectPath + HMAC; it is the only value accepted by
  // the record endpoint — the client never controls objectPath directly.
  app.post("/api/salary-advances/request-upload", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = z.object({ advanceId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "advanceId is required" });
      const { advanceId } = parsed.data;
      const advance = await storage.getSalaryAdvance(advanceId);
      if (!advance) return res.status(404).json({ error: "Advance not found" });
      const userId = req.session.userId!;
      const role = req.session.role || "employee";
      const isPrivileged = ["super_admin", "admin", "hr"].includes(role);
      const isOwner = advance.requesterId === userId;
      const isManager = advance.managerId === userId;
      if (!isOwner && !isManager && !isPrivileged) return res.status(403).json({ error: "Forbidden" });
      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const svc = new ObjectStorageService();
      const uploadURL = await svc.getObjectEntityUploadURL();
      const objectPath = svc.normalizeObjectEntityPath(uploadURL);
      const uploadToken = signUploadToken(advanceId, objectPath);
      res.json({ uploadURL, uploadToken });
    } catch (err: any) {
      console.error("Advance upload URL error:", err);
      res.status(500).json({ error: err?.message || "Failed to get upload URL" });
    }
  });

  // ── Attachments: record an uploaded file against an advance
  app.post("/api/salary-advances/:id/attachments", requireAuth, async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });

      const userId = req.session.userId!;
      const role = req.session.role || "employee";
      const isPrivileged = ["super_admin", "admin", "hr"].includes(role);
      const isOwner = advance.requesterId === userId;
      const isManager = advance.managerId === userId;
      if (!isOwner && !isManager && !isPrivileged) return res.status(403).json({ error: "Forbidden" });

      const schema = z.object({
        uploadToken: z.string().min(1),
        fileName: z.string().min(1),
        contentType: z.string().optional(),
        sizeBytes: z.number().int().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });

      // Verify the HMAC-signed token; extracts the server-generated objectPath.
      // The client never controls objectPath — it comes from the signed token only.
      const objectPath = verifyUploadToken(parsed.data.uploadToken, advance.id);
      if (!objectPath) return res.status(400).json({ error: "Invalid or expired upload token" });

      const attachment = await storage.createSalaryAdvanceAttachment({
        advanceId: advance.id,
        uploadedById: userId,
        fileName: parsed.data.fileName,
        objectPath,
        contentType: parsed.data.contentType || null,
        sizeBytes: parsed.data.sizeBytes || null,
      } as any);

      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: userId, action: "attachment_added",
        oldStatus: advance.status, newStatus: advance.status,
        metadata: { fileName: parsed.data.fileName },
      } as any);

      res.status(201).json(attachment);
    } catch (err) {
      console.error("Attachment record error:", err);
      res.status(500).json({ error: "Failed to record attachment" });
    }
  });

  // ── Attachments: list attachments with signed download URLs
  app.get("/api/salary-advances/:id/attachments", requireAuth, async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });

      const userId = req.session.userId!;
      const role = req.session.role || "employee";
      const isPrivileged = ["super_admin", "admin", "hr", "finance"].includes(role);
      const isOwner = advance.requesterId === userId;
      const isManager = advance.managerId === userId;
      if (!isOwner && !isManager && !isPrivileged) return res.status(403).json({ error: "Forbidden" });

      const attachments = await storage.listSalaryAdvanceAttachments(advance.id);

      // Generate signed URLs for each attachment
      let signed: any[] = [];
      try {
        const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
        const svc = new ObjectStorageService();
        signed = await Promise.all(attachments.map(async (att) => {
          try {
            const file = await svc.getObjectEntityFile(att.objectPath);
            const { signObjectURL, parseObjectPath } = await import("./replit_integrations/object_storage/objectStorage") as any;
            const { bucketName, objectName } = (parseObjectPath || ((p: string) => {
              const parts = p.replace(/^\/objects\//, "").split("/");
              return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
            }))(att.objectPath);
            const downloadUrl = await (file as any).getSignedUrl({ action: "read", expires: Date.now() + 3600000 }).then((r: any) => r[0]);
            return { ...att, downloadUrl };
          } catch {
            return { ...att, downloadUrl: null };
          }
        }));
      } catch {
        signed = attachments.map(a => ({ ...a, downloadUrl: null }));
      }

      res.json(signed);
    } catch (err) {
      console.error("Attachment list error:", err);
      res.status(500).json({ error: "Failed to list attachments" });
    }
  });

  // ── Attachments: delete an attachment
  app.delete("/api/salary-advances/:id/attachments/:attId", requireAuth, async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });

      const userId = req.session.userId!;
      const role = req.session.role || "employee";
      const isPrivileged = ["super_admin", "admin", "hr"].includes(role);
      const isOwner = advance.requesterId === userId;
      if (!isOwner && !isPrivileged) return res.status(403).json({ error: "Forbidden" });

      // IDOR guard: ensure attachment belongs to this advance, not another one
      const attachment = await storage.getSalaryAdvanceAttachment(req.params.attId);
      if (!attachment) return res.status(404).json({ error: "Attachment not found" });
      if (attachment.advanceId !== advance.id) return res.status(403).json({ error: "Attachment does not belong to this advance" });

      await storage.deleteSalaryAdvanceAttachment(req.params.attId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  });

  // ── Accounts: mark disbursed
  app.post("/api/salary-advances/:id/disburse", requireAuth, requirePermission("salaryAdvance.accounts", "super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (advance.status !== "approved") return res.status(400).json({ error: "Only an approved advance can be disbursed." });
      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "disbursed", disbursedBy: req.session.userId!, disbursedAt: new Date(),
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "disbursed",
        oldStatus: advance.status, newStatus: "disbursed", metadata: null,
      } as any);
      await notify({
        userId: advance.requesterId, type: "salary_advance_disbursed",
        title: "Advance disbursed",
        message: `${advance.requestNumber} has been disbursed. Repayment will begin via payroll.`,
        link: EMPLOYEE_LINK,
      });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to disburse" });
    }
  });

  // ── Department head: flag an advance for urgent payout. Gated to the requester's
  // manager (de-facto department head) or super_admin/admin. Once flagged, final
  // approval starts recovery in the current payroll month instead of the next.
  app.post("/api/salary-advances/:id/urgent-process", requireAuth, requirePermission("salaryAdvance.managerApprove", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const advance = await storage.getSalaryAdvance(req.params.id);
      if (!advance) return res.status(404).json({ error: "Not found" });
      if (["disbursed", "repaying", "closed", "rejected", "cancelled"].includes(advance.status)) {
        return res.status(400).json({ error: "This advance can no longer be marked urgent." });
      }

      const role = req.session.role || "";
      // Only the requester's department head (their routing manager) or a
      // super_admin/admin may authorize an urgent payout.
      const isDeptHead = advance.managerId === req.session.userId;
      if (!isDeptHead && role !== "super_admin" && role !== "admin") {
        return res.status(403).json({ error: "Only the department head can authorize urgent processing." });
      }

      const now = new Date();
      const updated = await storage.updateSalaryAdvance(advance.id, {
        urgentProcessing: true,
        urgentApprovedBy: req.session.userId!,
        urgentApprovedAt: now,
      } as any);
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: req.session.userId!, action: "urgent_flagged",
        oldStatus: advance.status, newStatus: advance.status, metadata: { urgent: true },
      } as any);

      // Alert final approvers that an urgent payout is awaiting them.
      try {
        const users = await storage.getAdminUsers();
        for (const u of users.filter(x => x.role === "super_admin" && x.isActive)) {
          await notify({
            userId: u.id, type: "salary_advance_urgent",
            title: "Urgent advance payout flagged",
            message: `${advance.requestNumber} was flagged for urgent processing and needs final approval.`,
            link: "/admin/salary-advance?tab=final",
          });
        }
      } catch { /* best-effort */ }

      res.json(updated);
    } catch (err) {
      console.error("Urgent process error:", err);
      res.status(500).json({ error: "Failed to flag urgent processing" });
    }
  });
}

// Apply scheduled advance recoveries for a finalized salary run. Called from the
// salary-run approve handler. Marks the month's scheduled repayments as deducted,
// decrements outstanding balances, and auto-closes fully-repaid advances.
export async function applyAdvanceRecoveriesForRun(opts: {
  year: number;
  month: number;
  salaryRunId: string;
  rows: Array<{ email: string; advanceRecovery?: number }>;
  userEmailMap: Map<string, string>;
  actorId: string;
}): Promise<number> {
  const { year, month, salaryRunId, rows, userEmailMap } = opts;
  // Map each user to the ACTUAL recovery amount taken from their salary run row.
  // salaryReport.ts caps this at net-pay-after-attendance so net never goes
  // negative, so it can be LESS than the sum of scheduled installments. We must
  // reconcile against this capped figure — not the raw scheduledAmount — or we
  // would understate outstanding balances and close advances prematurely.
  const cappedByUser = new Map<string, number>();
  for (const r of rows) {
    if (!r.advanceRecovery || r.advanceRecovery <= 0) continue;
    const uid = userEmailMap.get(r.email);
    if (uid) cappedByUser.set(uid, Math.round(((cappedByUser.get(uid) || 0) + r.advanceRecovery) * 100) / 100);
  }
  if (cappedByUser.size === 0) return 0;

  const scheduled = await storage.getScheduledRepaymentsForMonth(year, month);
  const byUser = new Map<string, typeof scheduled>();
  for (const rep of scheduled) {
    if (!cappedByUser.has(rep.userId)) continue;
    if (!byUser.has(rep.userId)) byUser.set(rep.userId, []);
    byUser.get(rep.userId)!.push(rep);
  }

  let applied = 0;
  for (const [userId, reps] of byUser) {
    // Allocate the capped recovery across this user's installments, oldest first.
    let remaining = Math.round((cappedByUser.get(userId) || 0) * 100) / 100;
    reps.sort((a, b) => a.installmentNo - b.installmentNo);
    for (const rep of reps) {
      const advance = await storage.getSalaryAdvance(rep.advanceId);
      if (!advance) continue;
      // Only recover once funds are actually disbursed. An approved-but-not-yet-
      // disbursed advance must never have payroll deductions taken against it.
      if (!["disbursed", "repaying"].includes(advance.status)) continue;

      const scheduledAmt = Number(rep.scheduledAmount || 0);
      const amount = Math.round(Math.min(Math.max(remaining, 0), scheduledAmt) * 100) / 100;
      const shortfall = Math.round((scheduledAmt - amount) * 100) / 100;

      if (amount <= 0) {
        // Nothing recoverable this month — push the whole installment to the
        // next free month so it is recovered in a future payroll run.
        await rescheduleRemainder(rep.advanceId, rep.id, scheduledAmt, opts.actorId);
        continue;
      }

      remaining = Math.round((remaining - amount) * 100) / 100;
      const partial = shortfall > 0.001;

      // Record the actual amount deducted (may be a partial installment).
      await storage.markRepaymentDeducted(rep.id, amount.toFixed(2), salaryRunId);

      // Carry the unrecovered remainder of a partial installment forward as a
      // fresh scheduled row so outstanding is eventually fully recovered.
      if (partial) {
        await rescheduleRemainder(rep.advanceId, null, shortfall, opts.actorId);
      }

      const newRepaid = Math.round((Number(advance.totalRepaid || 0) + amount) * 100) / 100;
      const newOutstanding = Math.max(0, Math.round((Number(advance.outstandingBalance || 0) - amount) * 100) / 100);
      const closing = newOutstanding <= 0.001;

      await storage.updateSalaryAdvance(advance.id, {
        totalRepaid: newRepaid.toFixed(2),
        outstandingBalance: newOutstanding.toFixed(2),
        status: closing ? "closed" : "repaying",
        closedAt: closing ? new Date() : null,
      });
      await storage.addSalaryAdvanceAuditEntry({
        advanceId: advance.id, actorId: opts.actorId,
        action: closing ? "repayment_deducted_closed" : (partial ? "repayment_deducted_partial" : "repayment_deducted"),
        oldStatus: advance.status, newStatus: closing ? "closed" : "repaying",
        metadata: { year, month, amount, scheduledAmount: scheduledAmt, shortfall, partial, salaryRunId, outstanding: newOutstanding },
      } as any);
      applied++;
    }
  }
  return applied;
}

// Mark salary credits as `applied` after the payroll run they target is approved.
// Called from the salary-run approve handler alongside applyAdvanceRecoveriesForRun.
//
// Pass `creditIds` to restrict application to only the credits that were
// included when the run was generated (snapshot-safe). If `creditIds` is
// empty or omitted (e.g. legacy runs created before snapshotting was added),
// falls back to querying by month/year — this is safe for old runs because
// those credits were necessarily approved before the run existed.
export async function applyCreditsForRun(opts: {
  year: number;
  month: number;
  salaryRunId: string;
  actorId: string;
  creditIds?: string[];
}): Promise<number> {
  const { year, month, actorId, creditIds } = opts;
  const { inArray } = await import("drizzle-orm");

  let credits: any[];
  if (creditIds && creditIds.length > 0) {
    // Snapshot path: only apply the specific credits that were included in the
    // run's gross-pay computation. Credits approved after generation are excluded.
    credits = await db.select().from(salaryAdvanceRequests)
      .where(and(
        inArray(salaryAdvanceRequests.id, creditIds),
        eq(salaryAdvanceRequests.kind, "salary_credit" as any),
        eq(salaryAdvanceRequests.status, "approved" as any),
      ));
  } else if (creditIds && creditIds.length === 0) {
    // Explicit empty snapshot: no credits were included in this run.
    credits = [];
  } else {
    // Legacy/fallback path: no snapshot stored, query by month/year.
    credits = await db.select().from(salaryAdvanceRequests)
      .where(and(
        eq(salaryAdvanceRequests.kind, "salary_credit" as any),
        eq(salaryAdvanceRequests.status, "approved" as any),
        eq((salaryAdvanceRequests as any).targetMonth, month),
        eq((salaryAdvanceRequests as any).targetYear, year),
      ));
  }

  let count = 0;
  for (const credit of credits) {
    await storage.updateSalaryAdvance(credit.id, {
      status: "applied" as any,
      totalRepaid: credit.requestedAmount,
      outstandingBalance: "0",
      closedAt: new Date(),
    });
    await storage.addSalaryAdvanceAuditEntry({
      advanceId: credit.id, actorId, action: "salary_credit_applied",
      oldStatus: "approved", newStatus: "applied",
      metadata: { year, month, amount: credit.requestedAmount },
    } as any);
    count++;
  }
  return count;
}

// Reschedule an unrecovered installment (or the remainder of a partial one) into
// the next free month after the advance's last scheduled row. When `moveRepId`
// is provided the existing row is moved in place (full skip); otherwise a new
// carry-forward installment is created (partial remainder).
async function rescheduleRemainder(
  advanceId: string,
  moveRepId: string | null,
  amount: number,
  actorId: string,
): Promise<void> {
  if (amount <= 0.001) return;
  const all = await storage.getSalaryAdvanceRepayments(advanceId);
  let maxKey = -1;
  let maxInstallment = 0;
  for (const r of all) {
    const key = r.year * 12 + (r.month - 1);
    if (key > maxKey) maxKey = key;
    if (r.installmentNo > maxInstallment) maxInstallment = r.installmentNo;
  }
  const nextKey = maxKey + 1;
  const nextYear = Math.floor(nextKey / 12);
  const nextMonth = (nextKey % 12) + 1;

  if (moveRepId) {
    await storage.rescheduleRepayment(moveRepId, nextYear, nextMonth);
  } else {
    await storage.createSalaryAdvanceRepayments([{
      advanceId,
      userId: all[0]?.userId,
      installmentNo: maxInstallment + 1,
      year: nextYear,
      month: nextMonth,
      scheduledAmount: amount.toFixed(2),
    } as any]);
  }
  await storage.addSalaryAdvanceAuditEntry({
    advanceId, actorId, action: "repayment_rescheduled",
    oldStatus: null, newStatus: null,
    metadata: { amount, toYear: nextYear, toMonth: nextMonth, moved: !!moveRepId },
  } as any);
}
