/**
 * CEO Intelligence Layer Routes (Task #1118)
 *
 * GET  /api/ceo/rate-targets                 — list rate targets grouped by specialty
 * POST /api/ceo/rate-targets                 — create a rate target (super_admin)
 * GET  /api/ceo/rate-intelligence            — actuals vs targets per specialty
 * GET  /api/ceo/copilot/signals              — proactive exception + rate signals
 * GET  /api/ceo/copilot/audit               — system completeness audit (gap list)
 * PATCH /api/contracts/:id/rate-fields       — backfill rate fields on existing contract
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { buildCeoReportData } from "./governanceService";

function requireSuperAdmin(req: Request, res: Response): string | null {
  if (!req.session?.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  if (req.session.role !== "super_admin") { res.status(403).json({ error: "Super admin only" }); return null; }
  return req.session.userId;
}

function requireAuth(req: Request, res: Response): string | null {
  if (!req.session?.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return req.session.userId;
}

// ── Linear regression helper (least-squares slope) ───────────────────────────
function linearProjection(points: Array<{ week: number; avg: number }>): number | null {
  if (points.length < 2) return null;
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of points) {
    sumX += p.week;
    sumY += p.avg;
    sumXY += p.week * p.avg;
    sumX2 += p.week * p.week;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const lastWeek = points[points.length - 1].week;
  // Project to end-of-year: approx 52 weeks from start of year
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weeksToEoy = Math.ceil((new Date(now.getFullYear(), 11, 31).getTime() - startOfYear.getTime()) / 604800000);
  return slope * weeksToEoy + intercept;
}

const SPECIALTIES = ["Healthcare", "IT", "Engineering", "Professional Services", "Other"] as const;

export function registerCeoRoutes(app: Express): void {

  // ── Rate Targets — list ────────────────────────────────────────────────────
  app.get("/api/ceo/rate-targets", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;
    try {
      const rows = await db.execute(sql`
        SELECT rt.*, au.first_name || ' ' || au.last_name AS set_by_name
        FROM rate_targets rt
        LEFT JOIN admin_users au ON au.id = rt.set_by
        ORDER BY rt.created_at DESC
      `);
      // Group by specialty
      const grouped: Record<string, any[]> = {};
      for (const r of rows.rows as any[]) {
        if (!grouped[r.specialty]) grouped[r.specialty] = [];
        grouped[r.specialty].push(r);
      }
      res.json({ targets: rows.rows, grouped });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Rate Targets — create ──────────────────────────────────────────────────
  app.post("/api/ceo/rate-targets", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;
    const { specialty, targetBillRateUsd, periodType, periodLabel, notes } = req.body;
    if (!specialty || !targetBillRateUsd || !periodType || !periodLabel) {
      return res.status(400).json({ error: "specialty, targetBillRateUsd, periodType, periodLabel are required" });
    }
    if (!["quarterly", "annual"].includes(periodType)) {
      return res.status(400).json({ error: "periodType must be quarterly or annual" });
    }
    try {
      const result = await db.execute(sql`
        INSERT INTO rate_targets (specialty, target_bill_rate_usd, period_type, period_label, set_by, notes)
        VALUES (${specialty}, ${Number(targetBillRateUsd)}, ${periodType}, ${periodLabel}, ${userId}, ${notes ?? null})
        RETURNING *
      `);
      res.status(201).json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Rate Targets — delete ──────────────────────────────────────────────────
  app.delete("/api/ceo/rate-targets/:id", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;
    try {
      await db.execute(sql`DELETE FROM rate_targets WHERE id = ${req.params.id}`);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Rate Intelligence — actuals vs targets ─────────────────────────────────
  app.get("/api/ceo/rate-intelligence", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      // Quarter bounds
      const quarterStart = new Date(year, Math.floor((month - 1) / 3) * 3, 1);
      const ytdStart = new Date(year, 0, 1);

      // This-month avg per specialty from contracts
      const thisMonthRows = await db.execute(sql`
        SELECT specialty,
               AVG(bill_rate::numeric) AS avg_rate,
               COUNT(*) AS n
        FROM contracts
        WHERE specialty IS NOT NULL
          AND bill_rate IS NOT NULL
          AND (
            (contract_start_date IS NOT NULL AND EXTRACT(YEAR FROM contract_start_date::date) = ${year}
             AND EXTRACT(MONTH FROM contract_start_date::date) = ${month})
            OR
            (created_at >= ${new Date(year, month - 1, 1).toISOString()}::timestamp
             AND created_at < ${new Date(year, month, 1).toISOString()}::timestamp)
          )
        GROUP BY specialty
      `);

      // QTD avg
      const qtdRows = await db.execute(sql`
        SELECT specialty,
               AVG(bill_rate::numeric) AS avg_rate,
               COUNT(*) AS n
        FROM contracts
        WHERE specialty IS NOT NULL
          AND bill_rate IS NOT NULL
          AND (
            (contract_start_date IS NOT NULL AND contract_start_date::date >= ${quarterStart.toISOString().slice(0, 10)}::date)
            OR
            (contract_start_date IS NULL AND created_at >= ${quarterStart.toISOString()}::timestamp)
          )
        GROUP BY specialty
      `);

      // YTD avg
      const ytdRows = await db.execute(sql`
        SELECT specialty,
               AVG(bill_rate::numeric) AS avg_rate,
               COUNT(*) AS n
        FROM contracts
        WHERE specialty IS NOT NULL
          AND bill_rate IS NOT NULL
          AND (
            (contract_start_date IS NOT NULL AND contract_start_date::date >= ${ytdStart.toISOString().slice(0, 10)}::date)
            OR
            (contract_start_date IS NULL AND created_at >= ${ytdStart.toISOString()}::timestamp)
          )
        GROUP BY specialty
      `);

      // Weekly trend — last 12 weeks
      const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 3600000);
      const trendRows = await db.execute(sql`
        SELECT specialty,
               EXTRACT(WEEK FROM COALESCE(contract_start_date::date, created_at::date))::int AS week_num,
               AVG(bill_rate::numeric) AS avg_rate,
               COUNT(*) AS n
        FROM contracts
        WHERE specialty IS NOT NULL
          AND bill_rate IS NOT NULL
          AND COALESCE(contract_start_date::date, created_at::date) >= ${twelveWeeksAgo.toISOString().slice(0, 10)}::date
        GROUP BY specialty, week_num
        ORDER BY specialty, week_num
      `);

      // Rate targets
      const targetsRows = await db.execute(sql`
        SELECT specialty, target_bill_rate_usd, period_type, period_label
        FROM rate_targets
        ORDER BY created_at DESC
      `);

      // Build lookup maps
      const bySpec = (rows: any[]): Map<string, { avg: number; n: number }> => {
        const m = new Map();
        for (const r of rows) {
          m.set(r.specialty, { avg: parseFloat(r.avg_rate) || 0, n: Number(r.n) });
        }
        return m;
      };

      const thisMonth = bySpec(thisMonthRows.rows as any[]);
      const qtd = bySpec(qtdRows.rows as any[]);
      const ytd = bySpec(ytdRows.rows as any[]);

      // Trend data per specialty
      const trendBySpec: Record<string, Array<{ week: number; avg: number; n: number }>> = {};
      for (const r of trendRows.rows as any[]) {
        if (!trendBySpec[r.specialty]) trendBySpec[r.specialty] = [];
        trendBySpec[r.specialty].push({ week: r.week_num, avg: parseFloat(r.avg_rate) || 0, n: Number(r.n) });
      }

      // Latest targets per specialty × period_type
      const latestTargets: Record<string, Record<string, number>> = {};
      for (const r of (targetsRows.rows as any[])) {
        if (!latestTargets[r.specialty]) latestTargets[r.specialty] = {};
        if (!latestTargets[r.specialty][r.period_type]) {
          latestTargets[r.specialty][r.period_type] = parseFloat(r.target_bill_rate_usd);
        }
      }

      // Build result rows for all known specialties + any with data
      const allSpecs = new Set([
        ...SPECIALTIES,
        ...Array.from(thisMonth.keys()),
        ...Array.from(ytd.keys()),
      ]);

      const result = Array.from(allSpecs).map((spec) => {
        const tm = thisMonth.get(spec);
        const q = qtd.get(spec);
        const y = ytd.get(spec);
        const trend = trendBySpec[spec] || [];
        const projection = linearProjection(trend);
        const quarterlyTarget = latestTargets[spec]?.quarterly ?? null;
        const annualTarget = latestTargets[spec]?.annual ?? null;

        // Trend direction from first to last weekly avg
        let trendDir: "up" | "down" | "flat" = "flat";
        let trendPct: number | null = null;
        if (trend.length >= 2) {
          const first = trend[0].avg;
          const last = trend[trend.length - 1].avg;
          if (first > 0) {
            trendPct = ((last - first) / first) * 100;
            trendDir = trendPct > 0.5 ? "up" : trendPct < -0.5 ? "down" : "flat";
          }
        }

        return {
          specialty: spec,
          quarterlyTarget,
          annualTarget,
          thisMonth: tm ? { avg: tm.avg, n: tm.n } : null,
          qtd: q ? { avg: q.avg, n: q.n } : null,
          ytd: y ? { avg: y.avg, n: y.n } : null,
          trendData: trend,
          trendDir,
          trendPct,
          yearEndProjection: projection,
        };
      });

      res.json({ rows: result, asOf: now.toISOString() });
    } catch (e: any) {
      console.error("[ceo/rate-intelligence]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── CEO Signals — proactive exception + rate signals ──────────────────────
  app.get("/api/ceo/copilot/signals", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    const signals: Array<{
      severity: "critical" | "warning" | "info";
      message: string;
      linkType: string;
      linkId: string | null;
    }> = [];

    try {
      // 1. Governance exception report
      let ceoReport;
      try {
        ceoReport = await buildCeoReportData();
      } catch (e) {
        console.error("[signals] buildCeoReportData failed:", e);
        ceoReport = null;
      }

      if (ceoReport) {
        // PIP/probation at risk
        const pipAtRisk = ceoReport.exceptionCategories.find(c => c.label.includes("PIP"));
        if (pipAtRisk && pipAtRisk.count > 0) {
          signals.push({
            severity: "critical",
            message: `${pipAtRisk.count} PIP case${pipAtRisk.count > 1 ? "s" : ""} need your attention — no coaching recorded recently`,
            linkType: "page",
            linkId: "/admin/hr/my-team",
          });
        }

        // Manager check-in breaches
        const checkInBreach = ceoReport.exceptionCategories.find(c => c.label.includes("Check-In"));
        if (checkInBreach && checkInBreach.count > 0) {
          signals.push({
            severity: "warning",
            message: `${checkInBreach.count} manager${checkInBreach.count > 1 ? "s" : ""} missed check-ins — team${checkInBreach.count > 1 ? "s" : ""} at risk`,
            linkType: "page",
            linkId: "/admin/hr/my-team",
          });
        }

        // Probation at risk
        const probAtRisk = ceoReport.exceptionCategories.find(c => c.label.includes("Probation"));
        if (probAtRisk && probAtRisk.count > 0) {
          signals.push({
            severity: "warning",
            message: `${probAtRisk.count} probation plan${probAtRisk.count > 1 ? "s" : ""} at risk — decision point approaching`,
            linkType: "page",
            linkId: "/admin/hr/my-team",
          });
        }

        // Escalated controls
        if (ceoReport.totalEscalated > 0) {
          signals.push({
            severity: "warning",
            message: `${ceoReport.totalEscalated} governance obligation${ceoReport.totalEscalated > 1 ? "s" : ""} escalated beyond manager level`,
            linkType: "page",
            linkId: "/admin/hr/my-team",
          });
        }
      }

      // 2. Rate intelligence signals — below-target specialties
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const contractRates = await db.execute(sql`
          SELECT specialty, AVG(bill_rate::numeric) AS avg_rate, COUNT(*) AS n
          FROM contracts
          WHERE specialty IS NOT NULL AND bill_rate IS NOT NULL
            AND COALESCE(contract_start_date::date, created_at::date) >= ${new Date(year, month - 1, 1).toISOString().slice(0, 10)}::date
          GROUP BY specialty
        `);

        const targets = await db.execute(sql`
          SELECT DISTINCT ON (specialty) specialty, target_bill_rate_usd
          FROM rate_targets
          WHERE period_type = 'quarterly'
          ORDER BY specialty, created_at DESC
        `);

        const targetMap: Record<string, number> = {};
        for (const t of targets.rows as any[]) {
          targetMap[t.specialty] = parseFloat(t.target_bill_rate_usd);
        }

        for (const r of contractRates.rows as any[]) {
          const avg = parseFloat(r.avg_rate) || 0;
          const n = Number(r.n);
          const target = targetMap[r.specialty];
          if (target && avg > 0 && n >= 2) {
            const gapPct = ((target - avg) / target) * 100;
            if (gapPct > 5) {
              signals.push({
                severity: "warning",
                message: `${r.specialty} rate trending below Q target ($${avg.toFixed(0)}/hr vs $${target}/hr target)`,
                linkType: "page",
                linkId: "/admin/command-center",
              });
            }
          }
        }
      } catch (e) {
        console.error("[signals] rate intelligence check failed:", e);
      }

      res.json({ signals });
    } catch (e: any) {
      console.error("[ceo/signals]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── System Audit — completeness gap list ──────────────────────────────────
  app.get("/api/ceo/copilot/audit", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    try {
      const gaps: Array<{
        severity: "critical" | "warning" | "info";
        message: string;
        count: number;
        deepLink: string;
        canAssign: boolean;
        category: string;
      }> = [];

      // Run all audit queries concurrently
      const [
        contractsNoRate,
        contractsNoSpecialty,
        noRateTargets,
        noManagerRows,
        recruiterNoActivity,
        goalsNoOwner,
        pipNoCoaching,
        appsNoRecruiter,
        checkInsNoCompletion,
      ] = await Promise.allSettled([
        // Contracts with no bill_rate
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM contracts
          WHERE source = 'imported' AND bill_rate IS NULL
        `),
        // Contracts with no specialty
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM contracts
          WHERE specialty IS NULL
        `),
        // Specialties with no rate target set (quarterly)
        db.execute(sql`
          SELECT COUNT(*) AS cnt FROM (
            VALUES ('Healthcare'), ('IT'), ('Engineering'), ('Professional Services')
          ) AS specs(s)
          WHERE s NOT IN (
            SELECT DISTINCT specialty FROM rate_targets WHERE period_type = 'quarterly'
          )
        `),
        // Employees with no manager_id
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM admin_users
          WHERE is_active = true AND deleted_at IS NULL
            AND role NOT IN ('super_admin', 'admin')
            AND manager_id IS NULL
        `),
        // Recruiters with no activity in 7 days
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM admin_users au
          WHERE au.role = 'recruiter' AND au.is_active = true AND au.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM applications a
              WHERE a.recruiter_id = au.id::text
                AND a.created_at >= NOW() - INTERVAL '7 days'
            )
        `),
        // Company goals with no owner (employee_id = set-by user, meaning no assignee)
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM performance_goals
          WHERE category = 'company' AND status NOT IN ('cancelled', 'completed')
            AND parent_goal_id IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM company_goal_actions cga
              WHERE cga.goal_id = performance_goals.id AND cga.completed_at IS NULL
            )
        `),
        // Employees on active PIP with no coaching note in 10+ days
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM governance_controls gc
          WHERE gc.control_type = 'pip'::governance_control_type
            AND gc.status NOT IN ('closed', 'completed')
            AND gc.updated_at < NOW() - INTERVAL '10 days'
        `),
        // Applications with no recruiter_id
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM applications
          WHERE recruiter_id IS NULL
        `),
        // Scheduled check-ins past due with no completion
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM performance_check_ins
          WHERE status NOT IN ('completed', 'cancelled')
            AND scheduled_date < CURRENT_DATE
        `),
      ]);

      const safeCount = (result: PromiseSettledResult<any>): number => {
        if (result.status === "rejected") return 0;
        return Number((result.value.rows?.[0] as any)?.cnt ?? 0);
      };

      const contractsNoRateCount = safeCount(contractsNoRate);
      const contractsNoSpecCount = safeCount(contractsNoSpecialty);
      const noRateTargetCount = safeCount(noRateTargets);
      const noManagerCount = safeCount(noManagerRows);
      const recruiterNoActCount = safeCount(recruiterNoActivity);
      const goalsNoOwnerCount = safeCount(goalsNoOwner);
      const pipNoCoachingCount = safeCount(pipNoCoaching);
      const appsNoRecruiterCount = safeCount(appsNoRecruiter);
      const checkInsCount = safeCount(checkInsNoCompletion);

      if (contractsNoRateCount > 0) {
        gaps.push({
          severity: "warning",
          message: `${contractsNoRateCount} imported contract${contractsNoRateCount > 1 ? "s" : ""} missing bill rate — excluded from rate dashboard`,
          count: contractsNoRateCount,
          deepLink: "/admin/finance",
          canAssign: true,
          category: "Contracts",
        });
      }
      if (contractsNoSpecCount > 0) {
        gaps.push({
          severity: "warning",
          message: `${contractsNoSpecCount} contract${contractsNoSpecCount > 1 ? "s" : ""} missing specialty — excluded from rate reporting`,
          count: contractsNoSpecCount,
          deepLink: "/admin/finance",
          canAssign: true,
          category: "Contracts",
        });
      }
      if (noRateTargetCount > 0) {
        gaps.push({
          severity: "info",
          message: `${noRateTargetCount} specialty${noRateTargetCount > 1 ? " areas have" : " area has"} no quarterly rate target set`,
          count: noRateTargetCount,
          deepLink: "/admin/command-center",
          canAssign: false,
          category: "Rate Targets",
        });
      }
      if (noManagerCount > 0) {
        gaps.push({
          severity: "critical",
          message: `${noManagerCount} employee${noManagerCount > 1 ? "s" : ""} missing from manager hierarchy — governance won't reach them`,
          count: noManagerCount,
          deepLink: "/admin/hr/people",
          canAssign: true,
          category: "Hierarchy",
        });
      }
      if (recruiterNoActCount > 0) {
        gaps.push({
          severity: "warning",
          message: `${recruiterNoActCount} recruiter${recruiterNoActCount > 1 ? "s" : ""} haven't logged submissions in 7 days — conversion data incomplete`,
          count: recruiterNoActCount,
          deepLink: "/admin/hr/people",
          canAssign: true,
          category: "Recruiters",
        });
      }
      if (goalsNoOwnerCount > 0) {
        gaps.push({
          severity: "info",
          message: `${goalsNoOwnerCount} company goal${goalsNoOwnerCount > 1 ? "s" : ""} ${goalsNoOwnerCount > 1 ? "have" : "has"} no action items assigned`,
          count: goalsNoOwnerCount,
          deepLink: "/admin/command-center",
          canAssign: true,
          category: "Goals",
        });
      }
      if (pipNoCoachingCount > 0) {
        gaps.push({
          severity: "critical",
          message: `${pipNoCoachingCount} PIP employee${pipNoCoachingCount > 1 ? "s" : ""} with no coaching note in 10+ days`,
          count: pipNoCoachingCount,
          deepLink: "/admin/hr/my-team",
          canAssign: true,
          category: "Governance",
        });
      }
      if (appsNoRecruiterCount > 0) {
        gaps.push({
          severity: "warning",
          message: `${appsNoRecruiterCount} submission${appsNoRecruiterCount > 1 ? "s" : ""} ${appsNoRecruiterCount > 1 ? "have" : "has"} no recruiter owner — can't compute individual conversion`,
          count: appsNoRecruiterCount,
          deepLink: "/admin/recruitment",
          canAssign: true,
          category: "Recruitment",
        });
      }
      if (checkInsCount > 0) {
        gaps.push({
          severity: "warning",
          message: `${checkInsCount} scheduled check-in${checkInsCount > 1 ? "s" : ""} past due with no manager completion`,
          count: checkInsCount,
          deepLink: "/admin/hr/my-team",
          canAssign: true,
          category: "Check-Ins",
        });
      }

      // Health score: weight by severity
      const severityWeight: Record<string, number> = { critical: 3, warning: 2, info: 1 };
      const totalWeight = gaps.reduce((s, g) => s + severityWeight[g.severity], 0);
      const maxPossibleWeight = 9 * 3; // assume 9 checks, worst case all critical
      const healthScore = Math.max(0, Math.round(100 - (totalWeight / maxPossibleWeight) * 100));

      res.json({ gaps, healthScore, asOf: new Date().toISOString() });
    } catch (e: any) {
      console.error("[ceo/audit]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Contract backfill — rate fields on existing contracts ─────────────────
  app.patch("/api/contracts/:id/rate-fields", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;
    const { specialty, billRate, payRate } = req.body;
    try {
      const result = await db.execute(sql`
        UPDATE contracts
        SET specialty = COALESCE(${specialty ?? null}, specialty),
            bill_rate = COALESCE(${billRate ? Number(billRate) : null}, bill_rate),
            pay_rate  = COALESCE(${payRate ? Number(payRate) : null}, pay_rate),
            updated_at = NOW()
        WHERE id = ${req.params.id}
        RETURNING id, specialty, bill_rate, pay_rate, client_name
      `);
      if (!result.rows.length) return res.status(404).json({ error: "Contract not found" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
