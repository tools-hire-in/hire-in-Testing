import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { resolveRoles } from "@shared/accessControl";
import {
  DEFAULT_SALARY_ADVANCE_POLICY,
  SALARY_ADVANCE_POLICY_KEY,
  type SalaryAdvancePolicy,
  type SalaryAdvanceRequest,
} from "@shared/schema";

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

function nextMonth(): { year: number; month: number } {
  const now = new Date();
  const monthIndex = now.getMonth() + 1; // 0-based -> next month is +1 (current+1)
  const year = now.getFullYear() + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return { year, month };
}

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
  const isAdminToolRequest = (method: string, subPath: string): boolean => {
    if (method === "POST" && subPath === "/backfill") return true;
    if (method !== "GET") return false;
    if (subPath === "/active" || subPath === "/stats" || subPath === "/policy") return true;
    // Detail dialog: GET /api/salary-advances/:id (uuid-shaped, no extra segment).
    if (/^\/[0-9a-fA-F-]{16,}$/.test(subPath)) return true;
    return false;
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
    } catch {
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

  // ── Accounts: all active advances with outstanding balances
  app.get("/api/salary-advances/active", requireAuth, requirePermission("salaryAdvance.accounts", "super_admin", "admin", "hr", "finance"), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listActiveSalaryAdvances();
      res.json(await enrichUsers(rows));
    } catch {
      res.status(500).json({ error: "Failed to load active advances" });
    }
  });

  // ── HR/admin: manually record an entry for an employee.
  // Two kinds:
  //   • advance     — backfill an already-active advance, skipping the
  //                   request/approval chain (HR picks amount, repayment months,
  //                   and the start month of recovery).
  //   • overpayment — record an overpayment to be recovered in full next cycle
  //                   (single installment); any shortfall carries forward via the
  //                   existing monthly recovery engine.
  // The record is created in `disbursed` status with a repayment schedule, so the
  // standard payroll recovery picks it up automatically. Works regardless of the
  // self-service feature flag (see the feature gate above).
  app.post("/api/salary-advances/backfill", requireAuth, requirePermission("salaryAdvance.backfill", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        employeeId: z.string().min(1, "Employee is required"),
        kind: z.enum(["advance", "overpayment"]),
        amount: z.number().positive("Amount must be greater than zero"),
        reason: z.string().optional(),
        repaymentMonths: z.number().int().min(1).max(36).optional(),
        startYear: z.number().int().min(2000).max(2100).optional(),
        startMonth: z.number().int().min(1).max(12).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });

      const { employeeId, kind } = parsed.data;
      const actorId = req.session.userId!;
      const amount = Math.round(parsed.data.amount * 100) / 100;

      const target = await storage.getAdminUser(employeeId);
      if (!target) return res.status(404).json({ error: "Employee not found" });

      // Resolve schedule parameters. Overpayment = single installment next cycle.
      let months: number;
      let start: { year: number; month: number };
      if (kind === "overpayment") {
        months = 1;
        start = nextMonth();
      } else {
        months = parsed.data.repaymentMonths || 1;
        start = (parsed.data.startYear && parsed.data.startMonth)
          ? { year: parsed.data.startYear, month: parsed.data.startMonth }
          : nextMonth();
      }
      const monthlyDeduction = Math.ceil((amount / months) * 100) / 100;

      const defaultReason = kind === "overpayment"
        ? "Overpayment recovery recorded by HR"
        : "Salary advance recorded by HR";
      const reason = parsed.data.reason && parsed.data.reason.trim().length > 0
        ? parsed.data.reason.trim()
        : defaultReason;

      const now = new Date();
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
        disbursedAt: now,
      } as any);

      const schedule = buildSchedule({
        advanceId: created.id,
        userId: employeeId,
        amount,
        months,
        startYear: start.year,
        startMonth: start.month,
      });
      await storage.createSalaryAdvanceRepayments(schedule as any);

      await storage.addSalaryAdvanceAuditEntry({
        advanceId: created.id, actorId, action: "backfilled",
        oldStatus: null, newStatus: "disbursed",
        metadata: { kind, amount, months, monthlyDeduction, scheduleStart: start, recordedManually: true },
      } as any);

      await notify({
        userId: employeeId,
        type: kind === "overpayment" ? "salary_overpayment_recorded" : "salary_advance_recorded",
        title: kind === "overpayment" ? "Overpayment recovery scheduled" : "Salary advance recorded",
        message: kind === "overpayment"
          ? `An overpayment of ${amount.toFixed(2)} will be recovered from your upcoming salary.`
          : `A salary advance of ${amount.toFixed(2)} has been recorded and will be recovered over ${months} month(s).`,
        link: EMPLOYEE_LINK,
      });

      res.status(201).json({ ...created, repayments: schedule });
    } catch (err) {
      console.error("Salary advance backfill error:", err);
      res.status(500).json({ error: "Failed to record entry" });
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

      const created = await storage.createSalaryAdvanceWithNumber({
        requesterId: userId,
        managerId: managerId || undefined,
        requestedAmount: requestedAmount.toFixed(2),
        reason,
        outstandingBalance: "0",
        totalRepaid: "0",
        policySnapshot: policy,
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
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });

      const approvedAmount = parsed.data.approvedAmount ?? Number(advance.approvedAmount || advance.requestedAmount);
      const repaymentMonths = parsed.data.repaymentMonths ?? Number(advance.repaymentMonths || policy.defaultMaxMonths);

      if (approvedAmount > Number(advance.requestedAmount)) {
        return res.status(400).json({ error: "Approved amount cannot exceed the requested amount." });
      }
      if (repaymentMonths > policy.ceoMaxMonths) {
        return res.status(400).json({ error: `Repayment months cannot exceed ${policy.ceoMaxMonths}.` });
      }

      const monthlyDeduction = Math.ceil((approvedAmount / repaymentMonths) * 100) / 100;
      const start = nextMonth();

      const updated = await storage.updateSalaryAdvance(advance.id, {
        status: "approved",
        approvedAmount: approvedAmount.toFixed(2),
        repaymentMonths,
        monthlyDeduction: monthlyDeduction.toFixed(2),
        repaymentStartYear: start.year,
        repaymentStartMonth: start.month,
        outstandingBalance: approvedAmount.toFixed(2),
        finalApprovedBy: req.session.userId!,
        finalApprovedAt: new Date(),
        finalNote: parsed.data.note || null,
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
        oldStatus: advance.status, newStatus: "approved",
        metadata: { approvedAmount, repaymentMonths, monthlyDeduction, scheduleStart: start },
      } as any);
      await notify({
        userId: advance.requesterId, type: "salary_advance_approved",
        title: "Advance request approved",
        message: `${advance.requestNumber} approved for ${approvedAmount.toFixed(2)}, repaid over ${repaymentMonths} month(s).`,
        link: EMPLOYEE_LINK,
      });
      res.json({ ...updated, repayments: schedule });
    } catch (err) {
      console.error("Final approve error:", err);
      res.status(500).json({ error: "Failed to approve" });
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
