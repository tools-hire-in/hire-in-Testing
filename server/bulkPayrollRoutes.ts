/**
 * Bulk Payroll Routes
 *
 * Adds the bulk payroll run workflow endpoints:
 * - GET  /api/hr/payroll-runs/validate                    — pre-run gate checks + estimates
 * - POST /api/hr/payroll-runs/:year/:month/generate-all   — bootstrap slip rows + engine per employee
 * - GET  /api/hr/payroll-runs/executive-summary           — KPI aggregates (approved runs only)
 * - GET  /api/hr/payroll-runs/trend                       — 6-month trend (approved runs only)
 * - GET  /api/hr/payroll-runs/:year/:month/statutory-export — CSV for filing
 * - GET  /api/payroll/runs/:runId/compliance/status       — readiness check per file type
 * - GET  /api/payroll/runs/:runId/compliance/:type        — download PF ECR / ESI return / PT challan
 *
 * All permission checks use the ACCESS_REGISTRY via requirePermission(key) —
 * no hard-coded role arrays in this file.
 */

import { Express, Request, Response } from "express";
import { db } from "./db";
import { departments, salaryReportRuns, salarySlips } from "../shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { requireAuth, requirePermission } from "./auth";
import { storage } from "./storage";
import {
  IndiaStatutoryEngine,
  computeComponentsFromGross,
  applyWaterfall,
  rupeesToPaise,
  type IndiaEmployeeConfig,
  type CoverageConfig,
  type ResolvedRate,
  type StructureRule,
  type WaterfallInput,
  type StateDeductionConfig,
} from "./payrollEngine";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LOP_ALERT_THRESHOLD = 3; // Flag employees with > 3 LOP days

// ---------------------------------------------------------------------------
// buildComputationSnapshot — mirrors the same function in routes.ts.
// Loads payroll config from DB, resolves salary structure as-of the period,
// and runs the India statutory engine. Returns a fully self-contained frozen
// snapshot or null on missing config.
// ---------------------------------------------------------------------------
async function buildComputationSnapshot(
  userId: string,
  grossRupees: number,
  periodYear: number,
  periodMonth: number,
  lopDays: number,
  workingDays: number,
): Promise<Record<string, unknown> | null> {
  try {
    const empRows = (await db.execute(sql`
      SELECT salary_structure_id, pf_exempt, pt_state,
             esi_disability, esi_applicable, esi_covered_until, esi_daily_wage_exempt
      FROM admin_users WHERE id = ${userId} LIMIT 1
    `)).rows as Array<{
      salary_structure_id: string | null;
      pf_exempt: boolean;
      pt_state: string | null;
      esi_disability: boolean;
      esi_applicable: boolean;
      esi_covered_until: string | Date | null;
      esi_daily_wage_exempt: boolean;
    }>;
    if (!empRows.length) return null;
    const emp = empRows[0];

    const periodStartDate = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;

    // Resolve salary structure as-of period start (history → current assignment).
    const histRows = (await db.execute(sql`
      SELECT structure_id FROM salary_structure_history
      WHERE user_id = ${userId}
        AND effective_from <= ${periodStartDate}
      ORDER BY effective_from DESC
      LIMIT 1
    `)).rows as Array<{ structure_id: string | null }>;
    const resolvedStructureId = histRows[0]?.structure_id ?? emp.salary_structure_id ?? null;
    if (!resolvedStructureId) return null;

    const esiCoveredUntil = emp.esi_covered_until
      ? (emp.esi_covered_until instanceof Date
        ? emp.esi_covered_until.toISOString().slice(0, 10)
        : String(emp.esi_covered_until).slice(0, 10))
      : null;

    // Salary structure rules.
    const structureRows = (await db.execute(sql`
      SELECT s.pf_mode,
             r.component_name, r.rule_type, r.value_pct, r.value_fixed,
             r.reference_component, r.lop_mode, r.sort_order
      FROM salary_structures s
      JOIN salary_structure_rules r ON r.structure_id = s.id
      WHERE s.id = ${resolvedStructureId}
      ORDER BY r.sort_order ASC
    `)).rows as Array<{
      pf_mode: string; component_name: string; rule_type: string;
      value_pct: number | null; value_fixed: number | null;
      reference_component: string | null; lop_mode: string; sort_order: number;
    }>;
    if (!structureRows.length) return null;

    const pfMode = (structureRows[0].pf_mode ?? "restricted") as "restricted" | "unrestricted";
    const rules: StructureRule[] = structureRows.map(r => ({
      componentName: r.component_name,
      ruleType: r.rule_type as StructureRule["ruleType"],
      valuePct: r.value_pct,
      valueFixed: r.value_fixed,
      referenceComponent: r.reference_component,
      lopMode: (r.lop_mode ?? "proportional") as "proportional" | "fixed",
      sortOrder: r.sort_order,
    }));

    // Establishment coverage.
    const covRows = (await db.execute(sql`
      SELECT scheme, status, applicable_from FROM establishment_coverage WHERE jurisdiction = 'IN'
    `)).rows as Array<{ scheme: string; status: string; applicable_from: string | Date | null }>;
    const getCoverage = (scheme: string): CoverageConfig => {
      const c = covRows.find(r => r.scheme === scheme);
      const af = c?.applicable_from;
      return {
        status: (c?.status ?? "not_applicable") as CoverageConfig["status"],
        applicableFrom: af
          ? (af instanceof Date ? af.toISOString().slice(0, 10) : String(af).slice(0, 10))
          : null,
      };
    };

    // Statutory rates as-of end of period.
    const daysInPayMonth = new Date(periodYear, periodMonth, 0).getDate();
    const periodEndDate = `${periodYear}-${String(periodMonth).padStart(2, "0")}-${String(daysInPayMonth).padStart(2, "0")}`;
    const rateRows = (await db.execute(sql`
      SELECT DISTINCT ON (jurisdiction, levy, key)
             levy, key, value_bps, minimum_paise, maximum_paise, rounding, effective_from
      FROM statutory_rates
      WHERE jurisdiction = 'IN'
        AND effective_from <= ${periodEndDate}
        AND (effective_to IS NULL OR effective_to >= ${periodEndDate})
      ORDER BY jurisdiction, levy, key, effective_from DESC
    `)).rows as Array<{
      levy: string; key: string; value_bps: number;
      minimum_paise: number | null; maximum_paise: number | null;
      rounding: string; effective_from: string | Date;
    }>;

    const frozenRates = rateRows.map(r => ({
      levy: r.levy, key: r.key, valueBps: Number(r.value_bps),
      minimumPaise: r.minimum_paise != null ? Number(r.minimum_paise) : null,
      maximumPaise: r.maximum_paise != null ? Number(r.maximum_paise) : null,
      rounding: r.rounding,
      effectiveFrom: r.effective_from instanceof Date
        ? r.effective_from.toISOString().slice(0, 10)
        : String(r.effective_from).slice(0, 10),
    }));
    const rates: ResolvedRate[] = frozenRates.map(r => ({
      levy: r.levy, key: r.key, valueBps: r.valueBps,
      minimumPaise: r.minimumPaise, maximumPaise: r.maximumPaise,
      rounding: r.rounding as "nearest" | "up",
    }));

    // State deduction config.
    let stateDeductionConfig: StateDeductionConfig | null = null;
    if (emp.pt_state) {
      const sdRows = (await db.execute(sql`
        SELECT state, levy_type, amount_paise, feb_amount_paise,
               is_flat, is_registered, deduction_months, threshold_paise, psdt_annual_threshold_paise
        FROM state_deductions
        WHERE state = ${emp.pt_state} AND jurisdiction = 'IN'
        ORDER BY is_registered DESC LIMIT 1
      `)).rows as Array<{
        state: string; levy_type: string; amount_paise: number;
        feb_amount_paise: number | null; is_flat: boolean; is_registered: boolean;
        deduction_months: number[] | null; threshold_paise: number | null;
        psdt_annual_threshold_paise: number | null;
      }>;
      if (sdRows.length) {
        const sd = sdRows[0];
        stateDeductionConfig = {
          state: sd.state, levyType: sd.levy_type,
          amountPaise: Number(sd.amount_paise),
          febAmountPaise: sd.feb_amount_paise != null ? Number(sd.feb_amount_paise) : null,
          isFlat: sd.is_flat, isRegistered: sd.is_registered,
          deductionMonths: sd.deduction_months,
          thresholdPaise: sd.threshold_paise != null ? Number(sd.threshold_paise) : null,
          psdtAnnualThresholdPaise: sd.psdt_annual_threshold_paise != null ? Number(sd.psdt_annual_threshold_paise) : null,
        };
      }
    }

    // Active advances (FIFO oldest-first).
    const advRows = (await db.execute(sql`
      SELECT id, outstanding_paise FROM salary_advances
      WHERE employee_id = ${userId} AND status IN ('disbursed', 'partial')
      ORDER BY created_at ASC
    `)).rows as Array<{ id: string; outstanding_paise: number }>;
    const advancesPaise: WaterfallInput["advancesPaise"] = advRows.map(a => ({
      id: a.id, outstandingPaise: Number(a.outstanding_paise),
    }));

    // Run engine.
    const grossPaise = rupeesToPaise(grossRupees);
    const period = { year: periodYear, month: periodMonth };
    const presentDays = Math.max(0, workingDays - lopDays);
    const componentResult = computeComponentsFromGross(grossPaise, rules, presentDays, workingDays);

    const empConfig: IndiaEmployeeConfig = {
      pfMode, pfExempt: Boolean(emp.pf_exempt), state: emp.pt_state,
      esiCoveredUntil, esiApplicable: Boolean(emp.esi_applicable),
      esiDisability: Boolean(emp.esi_disability),
      esiDailyWageExempt: Boolean(emp.esi_daily_wage_exempt),
      epfCoverage: getCoverage("EPF"), esiCoverage: getCoverage("ESI"),
    };

    const statutoryLines = IndiaStatutoryEngine.compute(
      period, componentResult.components, componentResult.grossAfterLopPaise,
      empConfig, rates, stateDeductionConfig,
    );

    const waterfallResult = applyWaterfall({
      grossAfterLopPaise: componentResult.grossAfterLopPaise,
      statutoryDeductionLines: statutoryLines,
      advancesPaise,
      otherDeductionsPaise: 0,
    });

    return {
      engine: "IndiaStatutoryEngine@v1",
      salaryStructureId: resolvedStructureId,
      frozenRules: rules, frozenRates, period,
      grossRupees, lopDays, workingDays, presentDays, pfMode,
      grossAfterLopPaise: componentResult.grossAfterLopPaise,
      componentFlags: componentResult.flags,
      components: componentResult.components.map(c => ({
        name: c.name, prelopPaise: c.prelopPaise, postlopPaise: c.postlopPaise, lopMode: c.lopMode,
      })),
      statutoryLines: statutoryLines.map(l => ({
        key: l.key, labelEn: l.labelEn, amountPaise: l.amountPaise,
        isEmployerContribution: l.isEmployerContribution, scheme: l.scheme, flags: l.flags,
      })),
      waterfall: {
        netPayPaise: waterfallResult.netPayPaise,
        totalStatutoryDeductionsPaise: waterfallResult.totalStatutoryDeductionsPaise,
        advanceRecoveredPaise: waterfallResult.advanceRecoveredPaise,
        advanceShortfallByIdPaise: waterfallResult.advanceShortfallByIdPaise,
        otherDeductionsPaise: waterfallResult.otherDeductionsPaise,
        employerPfPaise: statutoryLines.filter(l => l.isEmployerContribution && l.scheme === "EPF")
          .reduce((s, l) => s + l.amountPaise, 0),
        employerEsiPaise: statutoryLines.filter(l => l.isEmployerContribution && l.scheme === "ESI")
          .reduce((s, l) => s + l.amountPaise, 0),
      },
    };
  } catch (err) {
    console.error("[bulk-payroll] Engine error (non-fatal):", err);
    return null;
  }
}

export function registerBulkPayrollRoutes(app: Express) {

  // ─── Pre-run validation ────────────────────────────────────────────────────
  app.get(
    "/api/hr/payroll-runs/validate",
    requireAuth,
    requirePermission("payroll.bulkRun.validate"),
    async (req: Request, res: Response) => {
      try {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);

        const monthStr = `${year}-${String(month).padStart(2, "0")}-01`;
        const nextMonthNum = month === 12 ? 1 : month + 1;
        const nextMonthYear = month === 12 ? year + 1 : year;
        const nextMonthStr = `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}-01`;

        // 1. Attendance run status
        const attRunRows = (await db.execute(sql`
          SELECT id, status FROM attendance_report_runs
          WHERE month = ${month} AND year = ${year} AND is_active = true
          ORDER BY version DESC, created_at DESC LIMIT 1
        `)).rows as any[];
        const attRun = attRunRows[0] ?? null;
        const attendanceReady = attRun?.status === "approved" || attRun?.status === "overridden";

        // 2. Pending punch regularizations
        const pendingRegRows = (await db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM attendance_regularizations
          WHERE attendance_date >= ${monthStr} AND attendance_date < ${nextMonthStr} AND status = 'pending'
        `)).rows as any[];
        const pendingRegularizations = parseInt(pendingRegRows[0]?.cnt ?? "0", 10);

        // 3. Pending leave requests that may affect LOP for the period
        const pendingLeaveRows = (await db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM leave_requests
          WHERE status = 'pending'
            AND ((start_date >= ${monthStr} AND start_date < ${nextMonthStr})
              OR (end_date >= ${monthStr} AND end_date < ${nextMonthStr}))
        `)).rows as any[];
        const pendingLeaveRequests = parseInt(pendingLeaveRows[0]?.cnt ?? "0", 10);

        // 4. Active salary advances (affects recovery calculation)
        const activeAdvanceRows = (await db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM salary_advance_requests
          WHERE status IN ('disbursed', 'repaying', 'partial')
        `)).rows as any[];
        const activeAdvances = parseInt(activeAdvanceRows[0]?.cnt ?? "0", 10);

        // 5. Employees without salary structure
        const allUsers = await storage.getAdminUsers();
        const activeEmployees = allUsers.filter(u => u.isActive && !u.deletedAt);
        const missingStructure = activeEmployees
          .filter(u => !(u as any).salaryStructureId)
          .map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email }));

        // 6. Existing salary report run for this period
        const existingRuns = await db
          .select({ id: salaryReportRuns.id, status: salaryReportRuns.status, generatedAt: salaryReportRuns.generatedAt })
          .from(salaryReportRuns)
          .where(and(eq(salaryReportRuns.year, year), eq(salaryReportRuns.month, month)))
          .orderBy(desc(salaryReportRuns.generatedAt))
          .limit(1);
        const existingRun = existingRuns[0] ?? null;

        // 7. Existing salary slips
        const existingSlips = await storage.getSalarySlipsByMonth(year, month);

        // 8. Pre-run estimates (from existing run's reportData or active employee salaries)
        let estimatedHeadcount = activeEmployees.length - missingStructure.length;
        let estimatedGross = 0;
        let estimatedEmployerPf = 0;
        let estimatedEmployerEsi = 0;
        let lopAlertEmployees: { name: string; lopDays: number }[] = [];

        if (existingRun) {
          // Source estimates from existing run reportData (more accurate)
          const runRows = await db
            .select()
            .from(salaryReportRuns)
            .where(eq(salaryReportRuns.id, existingRun.id))
            .limit(1);
          const reportData: any[] = (runRows[0]?.reportData as any[]) ?? [];
          estimatedHeadcount = reportData.length;
          for (const row of reportData) {
            const gross = parseFloat(row.grossSalary ?? row.salary ?? 0);
            estimatedGross += gross;
            // Standard employer contributions: EPF ≈ 12% of PF-eligible basic (≈ 30-40% of gross),
            // ESI ≈ 3.25% of gross for eligible employees. Use conservative estimates.
            estimatedEmployerPf += gross * 0.04; // ≈ 12% of ~33% basic
            estimatedEmployerEsi += gross * 0.0325; // full ESI gross assumption
            // LOP threshold alerts
            const lop = parseFloat(row.lopLeaves ?? 0);
            if (lop > LOP_ALERT_THRESHOLD) {
              lopAlertEmployees.push({ name: row.name ?? row.email, lopDays: lop });
            }
          }
        } else {
          // Estimate from active employee salaries
          for (const u of activeEmployees) {
            if ((u as any).salaryStructureId) {
              const salary = parseFloat(String((u as any).salary ?? 0));
              estimatedGross += salary;
              estimatedEmployerPf += salary * 0.04;
              estimatedEmployerEsi += salary * 0.0325;
            }
          }
        }

        const warnings: string[] = [];
        if (!attendanceReady)
          warnings.push(`Attendance not yet approved (status: ${attRun?.status ?? "not_created"})`);
        if (pendingRegularizations > 0)
          warnings.push(`${pendingRegularizations} pending punch regularization(s)`);
        if (pendingLeaveRequests > 0)
          warnings.push(`${pendingLeaveRequests} pending leave request(s) may affect LOP`);
        if (missingStructure.length > 0)
          warnings.push(`${missingStructure.length} employee(s) have no salary structure (will be skipped)`);
        if (activeAdvances > 0)
          warnings.push(`${activeAdvances} active advance(s) — recovery amounts will apply`);
        if (lopAlertEmployees.length > 0)
          warnings.push(`${lopAlertEmployees.length} employee(s) have LOP > ${LOP_ALERT_THRESHOLD} days`);
        if (existingSlips.length > 0)
          warnings.push(`${existingSlips.length} salary slip(s) already exist for this period`);

        res.json({
          year,
          month,
          checks: {
            attendanceReady,
            attendanceStatus: attRun?.status ?? "not_created",
            pendingRegularizations,
            pendingLeaveRequests,
            activeAdvances,
            missingStructure,
            missingStructureCount: missingStructure.length,
            existingRun: existingRun
              ? { id: existingRun.id, status: existingRun.status, generatedAt: existingRun.generatedAt }
              : null,
            existingSlipsCount: existingSlips.length,
          },
          estimates: {
            headcount: estimatedHeadcount,
            estimatedGross,
            estimatedEmployerPf,
            estimatedEmployerEsi,
            estimatedEmployerTotal: estimatedEmployerPf + estimatedEmployerEsi,
            lopAlertCount: lopAlertEmployees.length,
            lopAlertEmployees: lopAlertEmployees.slice(0, 10), // cap list at 10
          },
          canProceed: attendanceReady && pendingRegularizations === 0,
          warnings,
        });
      } catch (error) {
        console.error("Payroll validate error:", error);
        res.status(500).json({ error: "Failed to run validation sweep" });
      }
    }
  );

  // ─── Bulk generate-all ─────────────────────────────────────────────────────
  // Bootstraps salary_slips rows for all employees in the run AND runs the
  // India statutory engine per employee so snapshots are immediately available.
  //
  // State gate: any non-rejected run state is allowed. The slip-level idempotency
  // check prevents double-writing if the endpoint is called again. Once a run
  // is approved/sent, slips already written are not overwritten (idempotent).
  app.post(
    "/api/hr/payroll-runs/:year/:month/generate-all",
    requireAuth,
    requirePermission("payroll.bulkRun.generate"),
    async (req: Request, res: Response) => {
      try {
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);
        if (!year || !month || month < 1 || month > 12) {
          return res.status(400).json({ error: "Invalid year or month" });
        }
        const actor = req.session.userId!;

        // Find the most-recent run for this period.
        const runRows = await db
          .select()
          .from(salaryReportRuns)
          .where(and(eq(salaryReportRuns.year, year), eq(salaryReportRuns.month, month)))
          .orderBy(desc(salaryReportRuns.generatedAt))
          .limit(1);
        const run = runRows[0] ?? null;
        if (!run) {
          return res.status(400).json({
            error: "No salary report run exists for this period. Generate a report run first.",
          });
        }
        // Only block on explicitly rejected runs.
        if (run.status === "rejected") {
          return res.status(400).json({
            error: "Run has been rejected. Generate a new report run before creating slips.",
          });
        }

        const reportData: any[] = (run.reportData as any[]) ?? [];
        const allUsers = await storage.getAdminUsers();
        const userByEmail = new Map(allUsers.map(u => [u.email, u]));

        let processed = 0;
        let skipped = 0;
        const errors: { email: string; reason: string }[] = [];

        for (const row of reportData) {
          const user = userByEmail.get(row.email);
          if (!user) {
            errors.push({ email: row.email ?? "(unknown)", reason: "User not found" });
            continue;
          }
          if (!(user as any).salaryStructureId) {
            skipped++;
            continue;
          }

          try {
            // Idempotent: skip if any slip already exists for this user/period.
            // The unique index on (userId, year, month, jurisdiction) means even
            // a slip from a prior run blocks re-insert — check broadly.
            const existingRows = await db
              .select({ id: salarySlips.id })
              .from(salarySlips)
              .where(and(
                eq(salarySlips.userId, user.id),
                eq(salarySlips.year, year),
                eq(salarySlips.month, month),
              ))
              .limit(1);
            if (existingRows.length > 0) {
              skipped++;
              continue;
            }

            // Run the statutory engine per employee to produce a frozen snapshot.
            const grossRupees = parseFloat(row.grossSalary ?? row.salary ?? 0);
            const lopDays = parseFloat(row.lopLeaves ?? 0);
            const workingDays = parseInt(row.workingDays ?? 26);

            const computationSnapshot = await buildComputationSnapshot(
              user.id, grossRupees, year, month, lopDays, workingDays,
            );

            // Pull waterfall figures from snapshot if available.
            const snap = computationSnapshot as Record<string, any> | null;
            const wf = snap?.waterfall as Record<string, number> | undefined;
            const deductions = wf
              ? (wf.totalStatutoryDeductionsPaise ?? 0) / 100
              : parseFloat(row.deductions ?? 0);
            const advanceRecovery = wf
              ? (wf.advanceRecoveredPaise ?? 0) / 100
              : parseFloat(row.advanceRecovery ?? 0);
            const netPayable = wf
              ? (wf.netPayPaise ?? 0) / 100
              : parseFloat(row.netPayable ?? 0);

            await db.insert(salarySlips).values({
              userId: user.id,
              year,
              month,
              version: 1,
              salaryRunId: run.id,
              basicSalary: String(row.salary ?? 0),
              grossSalary: String(grossRupees),
              deductions: String(deductions),
              salaryAdvanceRecovery: String(advanceRecovery),
              netPayable: String(netPayable),
              totalWorkingDays: workingDays,
              daysPresent: parseInt(row.presentDays ?? 0),
              daysAbsent: parseInt(row.absentDays ?? 0),
              approvedLeaves: String(row.paidLeaves ?? 0),
              lopLeaves: String(lopDays),
              totalHours: String(row.totalHours ?? 0),
              attendancePercentage: String(row.attendancePercentage ?? 0),
              generatedBy: actor,
              computationSnapshot: computationSnapshot ?? undefined,
              jurisdiction: "IN",
            }).onConflictDoNothing();
            processed++;
          } catch (err: any) {
            errors.push({ email: row.email, reason: err?.message ?? "Insert failed" });
          }
        }

        res.json({
          runId: run.id,
          runStatus: run.status,
          year,
          month,
          totalInRun: reportData.length,
          processed,
          skipped,
          errors,
        });
      } catch (error) {
        console.error("Bulk generate-all error:", error);
        res.status(500).json({ error: "Failed to bulk-generate salary slips" });
      }
    }
  );

  // ─── Executive summary ─────────────────────────────────────────────────────
  // Sources exclusively from approved salary_report_runs.
  app.get(
    "/api/hr/payroll-runs/executive-summary",
    requireAuth,
    requirePermission("payroll.executiveDashboard"),
    async (req: Request, res: Response) => {
      try {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);

        const approvedRunRows = await db
          .select()
          .from(salaryReportRuns)
          .where(and(
            eq(salaryReportRuns.year, year),
            eq(salaryReportRuns.month, month),
            inArray(salaryReportRuns.status, ["approved", "sent"])
          ))
          .orderBy(desc(salaryReportRuns.generatedAt))
          .limit(1);
        const approvedRun = approvedRunRows[0] ?? null;

        const emptyResponse = {
          year, month, runStatus: null, dataSource: "none",
          employeeCount: 0, totalGross: 0, totalNet: 0,
          totalDeductions: 0, totalLopDays: 0, totalAdvanceRecovery: 0,
          statutory: {
            employeePf: 0, employerPf: 0, employeeEsi: 0, employerEsi: 0,
            professionalTax: 0, totalEmployeeContributions: 0, totalEmployerContributions: 0,
          },
          departmentBreakdown: [],
        };
        if (!approvedRun) return res.json(emptyResponse);

        const slips = await db
          .select()
          .from(salarySlips)
          .where(and(
            eq(salarySlips.year, year),
            eq(salarySlips.month, month),
            eq(salarySlips.salaryRunId, approvedRun.id),
          ));

        const reportData: any[] = (approvedRun.reportData as any[]) ?? [];
        const useReportData = slips.length === 0;

        const allUsers = await storage.getAdminUsers();
        const userMap = new Map(allUsers.map(u => [u.id, u]));
        const userByEmail = new Map(allUsers.map(u => [u.email, u]));
        const deptRows = await db.select().from(departments);
        const deptNameMap = new Map(deptRows.map(d => [d.id, d.name]));

        let totalGross = 0, totalNet = 0, totalDeductions = 0;
        let totalLopDays = 0, totalAdvanceRecovery = 0;
        let totalEmployeePf = 0, totalEmployerPf = 0;
        let totalEmployeeEsi = 0, totalEmployerEsi = 0, totalPt = 0;
        const deptBreakdown: Record<string, { gross: number; net: number; count: number; deptName: string }> = {};

        if (useReportData) {
          for (const row of reportData) {
            const user = userByEmail.get(row.email);
            const gross = parseFloat(row.grossSalary ?? row.salary ?? 0);
            const net = parseFloat(row.netPayable ?? 0);
            totalGross += gross; totalNet += net;
            totalDeductions += parseFloat(row.deductions ?? 0);
            totalLopDays += parseFloat(row.lopLeaves ?? 0);
            totalAdvanceRecovery += parseFloat(row.advanceRecovery ?? 0);
            const deptId = user?.departmentId ?? "__unknown__";
            const deptName = deptId !== "__unknown__" ? (deptNameMap.get(deptId) ?? "Unknown") : "Unknown";
            if (!deptBreakdown[deptId]) deptBreakdown[deptId] = { gross: 0, net: 0, count: 0, deptName };
            deptBreakdown[deptId].gross += gross;
            deptBreakdown[deptId].net += net;
            deptBreakdown[deptId].count++;
          }
        } else {
          for (const slip of slips) {
            const user = userMap.get(slip.userId);
            const gross = parseFloat(slip.grossSalary ?? "0");
            const net = parseFloat(slip.netPayable ?? "0");
            totalGross += gross; totalNet += net;
            totalDeductions += parseFloat(slip.deductions ?? "0");
            totalLopDays += parseFloat((slip.lopLeaves as any) ?? "0");
            totalAdvanceRecovery += parseFloat(slip.salaryAdvanceRecovery ?? "0");

            const snap = slip.computationSnapshot as Record<string, any> | null;
            const wf = snap?.waterfall as Record<string, number> | undefined;
            if (wf) {
              totalEmployeePf += (wf.employeePfPaise ?? 0) / 100;
              totalEmployerPf += ((wf.employerEpfPaise ?? 0) + (wf.employerEpsPaise ?? 0) + (wf.employerPfPaise ?? 0)) / 100;
              totalEmployeeEsi += (wf.employeeEsiPaise ?? 0) / 100;
              totalEmployerEsi += ((wf.employerEsiPaise ?? 0) + (wf.employerPfPaise ?? 0)) / 100;
              totalPt += (wf.ptPaise ?? 0) / 100;
            } else {
              const comps = slip.components as any;
              if (comps?.statutory) {
                totalEmployeePf += comps.statutory.employeePf ?? 0;
                totalEmployerPf += (comps.statutory.employerEpf ?? 0) + (comps.statutory.employerEps ?? 0);
                totalEmployeeEsi += comps.statutory.employeeEsi ?? 0;
                totalEmployerEsi += comps.statutory.employerEsi ?? 0;
                totalPt += comps.statutory.professionalTax ?? 0;
              }
            }

            const deptId = user?.departmentId ?? "__unknown__";
            const deptName = deptId !== "__unknown__" ? (deptNameMap.get(deptId) ?? "Unknown") : "Unknown";
            if (!deptBreakdown[deptId]) deptBreakdown[deptId] = { gross: 0, net: 0, count: 0, deptName };
            deptBreakdown[deptId].gross += gross;
            deptBreakdown[deptId].net += net;
            deptBreakdown[deptId].count++;
          }
        }

        res.json({
          year, month,
          runStatus: approvedRun.status,
          dataSource: useReportData ? "report_run" : "salary_slips",
          employeeCount: useReportData ? reportData.length : slips.length,
          totalGross, totalNet, totalDeductions, totalLopDays, totalAdvanceRecovery,
          statutory: {
            employeePf: totalEmployeePf, employerPf: totalEmployerPf,
            employeeEsi: totalEmployeeEsi, employerEsi: totalEmployerEsi,
            professionalTax: totalPt,
            totalEmployeeContributions: totalEmployeePf + totalEmployeeEsi + totalPt,
            totalEmployerContributions: totalEmployerPf + totalEmployerEsi,
          },
          departmentBreakdown: Object.values(deptBreakdown).sort((a, b) => b.gross - a.gross),
        });
      } catch (error) {
        console.error("Executive summary error:", error);
        res.status(500).json({ error: "Failed to load executive summary" });
      }
    }
  );

  // ─── 6-month payroll trend ─────────────────────────────────────────────────
  app.get(
    "/api/hr/payroll-runs/trend",
    requireAuth,
    requirePermission("payroll.executiveDashboard"),
    async (req: Request, res: Response) => {
      try {
        const rows = (await db.execute(sql`
          WITH approved_runs AS (
            SELECT DISTINCT ON (year, month)
              id, year, month, status, report_data
            FROM salary_report_runs
            WHERE status IN ('approved', 'sent')
            ORDER BY year, month, generated_at DESC
          ),
          slip_totals AS (
            SELECT
              ss.salary_run_id,
              COUNT(DISTINCT ss.user_id)::int AS employee_count,
              SUM(CAST(ss.gross_salary AS numeric)) AS total_gross,
              SUM(CAST(ss.net_payable AS numeric)) AS total_net,
              SUM(CAST(COALESCE(ss.lop_leaves::text, '0') AS numeric)) AS total_lop_days
            FROM salary_slips ss
            INNER JOIN approved_runs ar ON ar.id = ss.salary_run_id
            GROUP BY ss.salary_run_id
          )
          SELECT
            ar.year, ar.month,
            COALESCE(st.employee_count, jsonb_array_length(ar.report_data))::int AS employee_count,
            COALESCE(st.total_gross, 0) AS total_gross,
            COALESCE(st.total_net, 0) AS total_net,
            COALESCE(st.total_lop_days, 0) AS total_lop_days,
            (ar.year * 100 + ar.month) AS sort_key
          FROM approved_runs ar
          LEFT JOIN slip_totals st ON st.salary_run_id = ar.id
          ORDER BY sort_key DESC
          LIMIT 6
        `)).rows as any[];

        const trend = rows.reverse().map(r => ({
          year: parseInt(r.year),
          month: parseInt(r.month),
          monthLabel: `${MONTH_NAMES[(parseInt(r.month) - 1)] ?? r.month} ${r.year}`,
          employeeCount: parseInt(r.employee_count ?? "0"),
          totalGross: parseFloat(r.total_gross ?? "0"),
          totalNet: parseFloat(r.total_net ?? "0"),
          totalLopDays: parseFloat(r.total_lop_days ?? "0"),
        }));

        res.json(trend);
      } catch (error) {
        console.error("Payroll trend error:", error);
        res.status(500).json({ error: "Failed to load payroll trend" });
      }
    }
  );

  // ─── Statutory CSV export ──────────────────────────────────────────────────
  // Route params per spec. Approved run only. Includes UAN + ESIC IP Number columns.
  app.get(
    "/api/hr/payroll-runs/:year/:month/statutory-export",
    requireAuth,
    requirePermission("payroll.statutoryExport"),
    async (req: Request, res: Response) => {
      try {
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);
        if (!year || !month || month < 1 || month > 12) {
          return res.status(400).json({ error: "Invalid year or month" });
        }

        const runRows = await db
          .select()
          .from(salaryReportRuns)
          .where(and(
            eq(salaryReportRuns.year, year),
            eq(salaryReportRuns.month, month),
            inArray(salaryReportRuns.status, ["approved", "sent"])
          ))
          .orderBy(desc(salaryReportRuns.generatedAt))
          .limit(1);
        const approvedRun = runRows[0] ?? null;
        if (!approvedRun) {
          return res.status(404).json({ error: "No approved payroll run found for this period" });
        }

        const reportData: any[] = (approvedRun.reportData as any[]) ?? [];
        const slips = await db
          .select()
          .from(salarySlips)
          .where(and(
            eq(salarySlips.year, year),
            eq(salarySlips.month, month),
            eq(salarySlips.salaryRunId, approvedRun.id),
          ));
        const slipByUserId = new Map(slips.map(s => [s.userId, s]));

        const allUsers = await storage.getAdminUsers();
        const userByEmail = new Map(allUsers.map(u => [u.email, u]));

        const monthName = MONTH_NAMES[month - 1] ?? String(month);
        const escape = (v: string | null | undefined) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const headers = [
          "Employee Name", "Employee ID",
          "UAN",            // Universal Account Number (PF — placeholder)
          "ESIC IP Number", // ESIC IP Number (placeholder)
          "Gross Salary", "Basic Salary",
          "Employee PF (12%)", "Employer EPF (3.67%)", "Employer EPS (8.33%)", "Total Employer PF",
          "Employee ESI (0.75%)", "Employer ESI (3.25%)",
          "Professional Tax", "LOP Days", "Advance Recovery", "Net Payable",
        ];

        const csvRows: string[] = [headers.join(",")];

        for (const row of reportData) {
          const user = userByEmail.get(row.email);
          if (!user) continue;
          const slip = slipByUserId.get(user.id);

          let employeePf = 0, employerEpf = 0, employerEps = 0;
          let employeeEsi = 0, employerEsi = 0, pt = 0;

          if (slip) {
            const snap = slip.computationSnapshot as Record<string, any> | null;
            const wf = snap?.waterfall as Record<string, number> | undefined;
            const comps = slip.components as any;
            if (wf) {
              employeePf  = (wf.employeePfPaise ?? 0) / 100;
              employerEpf = (wf.employerEpfPaise ?? 0) / 100;
              employerEps = (wf.employerEpsPaise ?? 0) / 100;
              employeeEsi = (wf.employeeEsiPaise ?? 0) / 100;
              employerEsi = (wf.employerEsiPaise ?? 0) / 100;
              pt          = (wf.ptPaise ?? 0) / 100;
            } else if (comps?.statutory) {
              employeePf  = comps.statutory.employeePf ?? 0;
              employerEpf = comps.statutory.employerEpf ?? 0;
              employerEps = comps.statutory.employerEps ?? 0;
              employeeEsi = comps.statutory.employeeEsi ?? 0;
              employerEsi = comps.statutory.employerEsi ?? 0;
              pt          = comps.statutory.professionalTax ?? 0;
            }
          }

          const gross   = slip ? parseFloat(slip.grossSalary ?? "0")               : parseFloat(row.grossSalary ?? row.salary ?? 0);
          const basic   = slip ? parseFloat(slip.basicSalary ?? "0")               : parseFloat(row.salary ?? 0);
          const lop     = slip ? parseFloat((slip.lopLeaves as any) ?? "0")        : parseFloat(row.lopLeaves ?? 0);
          const advance = slip ? parseFloat(slip.salaryAdvanceRecovery ?? "0")     : parseFloat(row.advanceRecovery ?? 0);
          const net     = slip ? parseFloat(slip.netPayable ?? "0")                : parseFloat(row.netPayable ?? 0);

          // UAN / ESIC IP: columns are placeholders until DB schema gains statutory identifier fields.
          const csvRow = [
            escape(`${user.firstName} ${user.lastName}`),
            escape(user.employeeId ?? ""),
            escape(""), // UAN — placeholder
            escape(""), // ESIC IP Number — placeholder
            gross.toFixed(2), basic.toFixed(2),
            employeePf.toFixed(2), employerEpf.toFixed(2), employerEps.toFixed(2),
            (employerEpf + employerEps).toFixed(2),
            employeeEsi.toFixed(2), employerEsi.toFixed(2),
            pt.toFixed(2), lop.toFixed(1), advance.toFixed(2), net.toFixed(2),
          ];
          csvRows.push(csvRow.join(","));
        }

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="statutory-${monthName}-${year}.csv"`);
        res.send(csvRows.join("\n"));
      } catch (error) {
        console.error("Statutory export error:", error);
        res.status(500).json({ error: "Failed to export statutory data" });
      }
    }
  );

  // ─── Compliance file status ────────────────────────────────────────────────
  // Returns readiness for each file type (missing UAN / IP counts etc.)
  app.get(
    "/api/payroll/runs/:runId/compliance/status",
    requireAuth,
    requirePermission("payroll.compliance.download"),
    async (req: Request, res: Response) => {
      try {
        const { runId } = req.params;
        const { getComplianceStatus } = await import("./complianceFileBuilder");
        const status = await getComplianceStatus(runId);
        res.json(status);
      } catch (error: any) {
        if (error?.message === "Run not found") {
          return res.status(404).json({ error: "Run not found" });
        }
        console.error("Compliance status error:", error);
        res.status(500).json({ error: "Failed to check compliance status" });
      }
    }
  );

  // ─── Compliance file downloads ─────────────────────────────────────────────
  // type = pf-ecr | esi-return | pt-challan
  app.get(
    "/api/payroll/runs/:runId/compliance/:type",
    requireAuth,
    requirePermission("payroll.compliance.download"),
    async (req: Request, res: Response) => {
      try {
        const { runId, type } = req.params;
        if (!["pf-ecr", "esi-return", "pt-challan"].includes(type)) {
          return res.status(400).json({ error: "Invalid compliance file type. Use pf-ecr, esi-return, or pt-challan." });
        }

        // Verify run exists and is executed
        const runRows = await db
          .select({ id: salaryReportRuns.id, status: salaryReportRuns.status, year: salaryReportRuns.year, month: salaryReportRuns.month })
          .from(salaryReportRuns)
          .where(eq(salaryReportRuns.id, runId))
          .limit(1);
        const run = runRows[0];
        if (!run) return res.status(404).json({ error: "Run not found" });
        if (run.status !== "executed") {
          return res.status(400).json({ error: "Compliance files are only available for executed runs" });
        }

        const {
          loadComplianceRows,
          buildPfEcr,
          buildEsiReturn,
          buildPtChallan,
        } = await import("./complianceFileBuilder");

        const rows = await loadComplianceRows(runId);
        const period = { year: run.year, month: run.month };
        const monthLabel = MONTH_NAMES[(run.month - 1)] ?? String(run.month);

        if (type === "pf-ecr") {
          const { content, warnings } = buildPfEcr(rows);
          const filename = `PF_ECR_${monthLabel}_${run.year}.txt`;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          if (warnings.length) {
            res.setHeader("X-Compliance-Warnings", String(warnings.length));
          }
          return res.send(content);
        }

        if (type === "esi-return") {
          const { content, warnings } = buildEsiReturn(rows);
          const filename = `ESI_Return_${monthLabel}_${run.year}.csv`;
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          if (warnings.length) {
            res.setHeader("X-Compliance-Warnings", String(warnings.length));
          }
          return res.send(content);
        }

        if (type === "pt-challan") {
          // Load PT registration from DB so the challan only includes registered states
          const { loadPtRegistrations } = await import("./complianceFileBuilder");
          const ptReg = await loadPtRegistrations();
          const registeredPtStateKeys = new Set(
            [...ptReg.entries()].filter(([, v]) => v.isRegistered).map(([k]) => k)
          );
          const { content, warnings } = buildPtChallan(rows, period, registeredPtStateKeys);
          const filename = `PT_Challan_${monthLabel}_${run.year}.txt`;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          if (warnings.length) {
            res.setHeader("X-Compliance-Warnings", String(warnings.length));
          }
          return res.send(content);
        }
      } catch (error: any) {
        if (error?.message === "Run not found") {
          return res.status(404).json({ error: "Run not found" });
        }
        console.error("Compliance download error:", error);
        res.status(500).json({ error: "Failed to generate compliance file" });
      }
    }
  );
}
