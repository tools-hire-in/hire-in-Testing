import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, or, gte, sql } from "drizzle-orm";
import { travelQuotes, travelQuoteOutputs, travelMarginFloors, gsaRateSnapshots, adminUsers } from "@shared/schema";
import { getGsaRate } from "./gsaRateService";
import { runTravelCalc } from "./travelCalculation";
import { z } from "zod";
import { execSync } from "child_process";
import puppeteer, { type Browser } from "puppeteer-core";

let pdfBrowserPromise: Promise<Browser> | null = null;
function getPdfBrowser(): Promise<Browser> {
  if (pdfBrowserPromise) {
    return pdfBrowserPromise.then(async b => {
      if (b.connected) return b;
      pdfBrowserPromise = null;
      return getPdfBrowser();
    }).catch(() => { pdfBrowserPromise = null; return getPdfBrowser(); });
  }
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || (() => {
    try { return execSync("which chromium", { encoding: "utf8" }).trim(); } catch { return null; }
  })();
  if (!execPath) throw new Error("Chromium not found");
  pdfBrowserPromise = puppeteer.launch({
    executablePath: execPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  return pdfBrowserPromise;
}

function computeGsaCap(dailyMie: any, dailyLodging: any, awayDays: any): number {
  return (parseFloat(String(dailyMie || "0")) + parseFloat(String(dailyLodging || "0"))) * (parseInt(String(awayDays || "5"), 10));
}

function checkStipendCompliance(body: any): { overCap: boolean; proposed: number; cap: number } {
  const cap = computeGsaCap(body.dailyMie, body.dailyLodging, body.awayDays);
  const proposed = body.decreasedStipendOverride != null && body.decreasedStipendOverride !== "" && body.decreasedStipendOverride !== undefined
    ? parseFloat(String(body.decreasedStipendOverride))
    : cap;
  return { overCap: cap > 0 && proposed > cap, proposed, cap };
}

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: Function) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const role = req.session.role as string;
    if (role === "super_admin" || role === "admin") return next();
    if (roles.includes(role)) return next();
    return res.status(403).json({ error: "Insufficient permissions" });
  };
}

async function getMarginFloor(roleType: string) {
  const rows = await db.select().from(travelMarginFloors).where(eq(travelMarginFloors.roleType, roleType)).limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    roleType: r.roleType,
    redThresholdPct: parseFloat(r.redThresholdPct as string),
    yellowThresholdPct: parseFloat(r.yellowThresholdPct as string),
  };
}

async function recalcAndSaveOutputs(quoteId: string) {
  const rows = await db.select().from(travelQuotes).where(eq(travelQuotes.id, quoteId)).limit(1);
  if (!rows.length) return null;
  const q = rows[0];

  const marginFloor = await getMarginFloor(q.roleType);

  const calcInput = {
    w2Hourly: parseFloat(q.w2Hourly as string) || 0,
    totalHours: parseFloat(q.totalHours as string) || 36,
    otMultiplier: parseFloat(q.otMultiplier as string) || 1.5,
    masterBillRate: parseFloat(q.masterBillRate as string) || 0,
    otBillRate: parseFloat(q.otBillRate as string || "0") || 0,
    clientOtMultiplier: parseFloat(q.clientOtMultiplier as string) || 1.5,
    vmsFeePct: parseFloat(q.vmsFeePct as string) || 3,
    weeksInAssignment: q.weeksInAssignment || 13,
    awayDays: q.awayDays || 5,
    dailyLodging: parseFloat(q.dailyLodging as string || "0") || 0,
    dailyMie: parseFloat(q.dailyMie as string || "0") || 0,
    firstLastDayMie: parseFloat(q.dailyMie as string || "0") * 0.75,
    decreasedStipendOverride: q.decreasedStipendOverride !== null ? parseFloat(q.decreasedStipendOverride as string) : null,
    orientationHoursTotal: parseFloat(q.orientationHoursTotal as string || "0") || 0,
    orientationHoursBillable: parseFloat(q.orientationHoursBillable as string || "0") || 0,
    orientationPayRate: parseFloat(q.orientationPayRate as string || q.w2Hourly as string || "0") || 0,
    orientationOtMultiplier: parseFloat(q.orientationOtMultiplier as string) || 1,
    completionBonus: parseFloat(q.completionBonus as string || "0") || 0,
    payrollBurdenPct: parseFloat(q.payrollBurdenPct as string) || 18.8,
    onCallRate: parseFloat(q.onCallRate as string || "0") || 0,
    callbackRate: parseFloat(q.callbackRate as string || "0") || 0,
    holidayRate: parseFloat(q.holidayRate as string || "0") || 0,
    roleType: q.roleType,
    marginFloors: marginFloor,
  };

  const out = runTravelCalc(calcInput);

  const existing = await db.select({ id: travelQuoteOutputs.id }).from(travelQuoteOutputs).where(eq(travelQuoteOutputs.quoteId, quoteId)).limit(1);

  const vals = {
    quoteId,
    weeklyTaxable: String(Math.round(out.weeklyTaxable * 100) / 100),
    weeklyNonTaxable: String(Math.round(out.weeklyNonTaxableOut * 100) / 100),
    weeklyGross: String(Math.round(out.weeklyGross * 100) / 100),
    hourlyTaxable: String(Math.round(out.hourlyTaxable * 100) / 100),
    hourlyBlended: String(Math.round(out.hourlyBlended * 100) / 100),
    otRate: String(Math.round(out.otRate * 100) / 100),
    wagePayableWeekly: String(Math.round(out.wagePayableWeekly * 100) / 100),
    payrollTaxesWeekly: String(Math.round(out.payrollTaxesWeekly * 100) / 100),
    nonTaxableWeekly: String(Math.round(out.weeklyNonTaxableOut * 100) / 100),
    orientationRevenue: String(Math.round(out.orientationRevenue * 100) / 100),
    orientationCandidateCost: String(Math.round(out.orientationCandidateCost * 100) / 100),
    orientationNet: String(Math.round(out.orientationNet * 100) / 100),
    totalBillingWeekly: String(Math.round(out.totalBillingWeekly * 100) / 100),
    totalBillingContract: String(Math.round(out.totalBillingContract * 100) / 100),
    totalExpenseWeekly: String(Math.round(out.totalExpenseWeekly * 100) / 100),
    totalExpenseContract: String(Math.round(out.totalExpenseContract * 100) / 100),
    grossProfitWeekly: String(Math.round(out.grossProfitWeekly * 100) / 100),
    netMarginPerHour: String(Math.round(out.netMarginPerHour * 100) / 100),
    netMarginPerWeek: String(Math.round(out.netMarginPerWeek * 100) / 100),
    netMarginPerContract: String(Math.round(out.netMarginPerContract * 100) / 100),
    netMarginPct: String(Math.round(out.netMarginPct * 100) / 100),
    // Preserve override_pending/override_approved if a human override is already on record
    stipendComplianceStatus: q.complianceOverrideBy
      ? "override_pending"
      : out.stipendCompliance as "compliant" | "over_cap",
    marginStatus: out.marginStatus,
    calculatedAt: new Date(),
  };

  if (existing.length > 0) {
    await db.update(travelQuoteOutputs).set(vals).where(eq(travelQuoteOutputs.quoteId, quoteId));
  } else {
    await db.insert(travelQuoteOutputs).values(vals);
  }

  return { quote: q, outputs: out };
}

export function registerTravelRoutes(app: Express) {

  app.post("/api/travel/gsa-rate", requireAuth, async (req, res) => {
    try {
      const { zip, month, year } = req.body;
      if (!zip || !month || !year) return res.status(400).json({ error: "zip, month, year required" });
      const result = await getGsaRate(String(zip).trim(), Number(month), Number(year));
      if (!result) return res.status(404).json({ error: "GSA rate not found for this ZIP / period. Try a nearby ZIP or check the GSA website." });
      res.json(result);
    } catch (err) {
      console.error("GSA rate error:", err);
      res.status(500).json({ error: "Failed to fetch GSA rate" });
    }
  });

  app.get("/api/travel/defaults", requireAuth, async (req, res) => {
    try {
      const floors = await db.select().from(travelMarginFloors);
      res.json(floors);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch defaults" });
    }
  });

  app.post("/api/travel/quotes", requireRole("hr", "operations", "manager", "recruiter", "employee"), async (req, res) => {
    try {
      const recruiterId = req.session.userId!;
      const body = req.body;

      const { overCap, proposed, cap } = checkStipendCompliance(body);
      if (overCap && !body.overrideReason?.trim()) {
        return res.status(400).json({
          error: `Stipend ($${proposed.toFixed(2)}/wk) exceeds GSA cap ($${cap.toFixed(2)}/wk). Provide a compliance override reason to save.`,
          code: "STIPEND_OVER_CAP",
        });
      }

      const [quote] = await db.insert(travelQuotes).values({
        recruiterId,
        candidateName: body.candidateName || "",
        facilityClientName: body.facilityClientName || "",
        label: body.label,
        assignmentZip: body.assignmentZip || "",
        state: body.state,
        county: body.county,
        city: body.city,
        roleType: body.roleType || "healthcare_travel",
        weeksInAssignment: Number(body.weeksInAssignment) || 13,
        month: Number(body.month) || new Date().getMonth() + 1,
        year: Number(body.year) || new Date().getFullYear(),
        awayDays: Number(body.awayDays) || 5,
        scheduledHours: String(body.scheduledHours || "36"),
        w2Hourly: String(body.w2Hourly || "0"),
        otMultiplier: String(body.otMultiplier || "1.5"),
        totalHours: String(body.totalHours || "36"),
        masterBillRate: String(body.masterBillRate || "0"),
        otBillRate: body.otBillRate ? String(body.otBillRate) : null,
        clientOtMultiplier: String(body.clientOtMultiplier || "1.5"),
        vmsFeePct: String(body.vmsFeePct || "3"),
        orientationHoursTotal: String(body.orientationHoursTotal || "0"),
        orientationHoursBillable: String(body.orientationHoursBillable || "0"),
        orientationHoursFree: String(body.orientationHoursFree || "0"),
        orientationPayRate: body.orientationPayRate ? String(body.orientationPayRate) : null,
        orientationOtMultiplier: String(body.orientationOtMultiplier || "1"),
        completionBonus: String(body.completionBonus || "0"),
        dailyMie: body.dailyMie ? String(body.dailyMie) : null,
        dailyLodging: body.dailyLodging ? String(body.dailyLodging) : null,
        decreasedStipendOverride: body.decreasedStipendOverride !== undefined && body.decreasedStipendOverride !== "" && body.decreasedStipendOverride !== null ? String(body.decreasedStipendOverride) : null,
        payrollBurdenPct: String(body.payrollBurdenPct || "18.8"),
        onCallRate: String(body.onCallRate || "0"),
        callbackRate: String(body.callbackRate || "0"),
        holidayRate: String(body.holidayRate || "0"),
        gsaSnapshotId: body.gsaSnapshotId || null,
        status: "draft",
        ...(overCap && body.overrideReason?.trim() ? {
          complianceOverrideBy: recruiterId,
          complianceOverrideReason: body.overrideReason.trim(),
        } : {}),
      }).returning();

      await recalcAndSaveOutputs(quote.id);

      const [fullQuote] = await db.select().from(travelQuotes).where(eq(travelQuotes.id, quote.id));
      const [outputs] = await db.select().from(travelQuoteOutputs).where(eq(travelQuoteOutputs.quoteId, quote.id));

      res.status(201).json({ quote: fullQuote, outputs });
    } catch (err) {
      console.error("Create travel quote error:", err);
      res.status(500).json({ error: "Failed to create quote" });
    }
  });

  app.get("/api/travel/quotes", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role as string;
      const isAdmin = ["super_admin", "admin", "hr"].includes(role);

      const quotesQuery = isAdmin
        ? db.select({
            quote: travelQuotes,
            outputs: travelQuoteOutputs,
            recruiterName: sql<string>`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`,
          })
          .from(travelQuotes)
          .leftJoin(travelQuoteOutputs, eq(travelQuoteOutputs.quoteId, travelQuotes.id))
          .leftJoin(adminUsers, eq(adminUsers.id, travelQuotes.recruiterId))
          .orderBy(desc(travelQuotes.createdAt))
        : db.select({
            quote: travelQuotes,
            outputs: travelQuoteOutputs,
            recruiterName: sql<string>`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`,
          })
          .from(travelQuotes)
          .leftJoin(travelQuoteOutputs, eq(travelQuoteOutputs.quoteId, travelQuotes.id))
          .leftJoin(adminUsers, eq(adminUsers.id, travelQuotes.recruiterId))
          .where(eq(travelQuotes.recruiterId, userId))
          .orderBy(desc(travelQuotes.createdAt));

      const rows = await quotesQuery;
      res.json(rows);
    } catch (err) {
      console.error("List travel quotes error:", err);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.get("/api/travel/quotes/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role as string;
      const isAdmin = ["super_admin", "admin", "hr"].includes(role);

      const [quote] = await db.select().from(travelQuotes).where(eq(travelQuotes.id, req.params.id));
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (!isAdmin && quote.recruiterId !== userId) return res.status(403).json({ error: "Not your quote" });

      const [outputs] = await db.select().from(travelQuoteOutputs).where(eq(travelQuoteOutputs.quoteId, req.params.id));
      res.json({ quote, outputs: outputs || null });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.patch("/api/travel/quotes/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role as string;
      const isAdmin = ["super_admin", "admin", "hr"].includes(role);

      const [quote] = await db.select().from(travelQuotes).where(eq(travelQuotes.id, req.params.id));
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (!isAdmin && quote.recruiterId !== userId) return res.status(403).json({ error: "Not your quote" });
      if (quote.status === "approved") return res.status(400).json({ error: "Approved quotes cannot be edited" });

      const body = req.body;

      // Compliance gate on PATCH: if stipend changes to over-cap and no override reason → block
      const { overCap } = checkStipendCompliance({
        dailyMie: body.dailyMie ?? quote.dailyMie,
        dailyLodging: body.dailyLodging ?? quote.dailyLodging,
        awayDays: body.awayDays ?? quote.awayDays,
        decreasedStipendOverride: body.decreasedStipendOverride !== undefined ? body.decreasedStipendOverride : quote.decreasedStipendOverride,
      });
      const hasExistingOverride = !!quote.complianceOverrideBy;
      if (overCap && !hasExistingOverride && !body.overrideReason?.trim()) {
        const { proposed, cap } = checkStipendCompliance({
          dailyMie: body.dailyMie ?? quote.dailyMie,
          dailyLodging: body.dailyLodging ?? quote.dailyLodging,
          awayDays: body.awayDays ?? quote.awayDays,
          decreasedStipendOverride: body.decreasedStipendOverride !== undefined ? body.decreasedStipendOverride : quote.decreasedStipendOverride,
        });
        return res.status(400).json({
          error: `Stipend ($${proposed.toFixed(2)}/wk) exceeds GSA cap ($${cap.toFixed(2)}/wk). Provide a compliance override reason to save.`,
          code: "STIPEND_OVER_CAP",
        });
      }

      const updateData: Record<string, any> = { updatedAt: new Date() };

      // Apply override reason if provided with over-cap save
      if (overCap && body.overrideReason?.trim()) {
        updateData.complianceOverrideBy = userId;
        updateData.complianceOverrideReason = body.overrideReason.trim();
      }

      const fields = [
        "candidateName", "facilityClientName", "label", "assignmentZip", "state", "county", "city",
        "roleType", "weeksInAssignment", "month", "year", "awayDays", "scheduledHours", "w2Hourly",
        "otMultiplier", "totalHours", "masterBillRate", "otBillRate", "clientOtMultiplier", "vmsFeePct",
        "orientationHoursTotal", "orientationHoursBillable", "orientationHoursFree", "orientationPayRate",
        "orientationOtMultiplier", "completionBonus", "dailyMie", "dailyLodging", "decreasedStipendOverride",
        "payrollBurdenPct", "onCallRate", "callbackRate", "holidayRate", "gsaSnapshotId",
      ];

      for (const f of fields) {
        if (body[f] !== undefined) {
          const numericFields = ["weeksInAssignment", "month", "year", "awayDays"];
          if (numericFields.includes(f)) {
            updateData[f] = Number(body[f]);
          } else {
            updateData[f] = body[f] !== null && body[f] !== "" ? String(body[f]) : (body[f] === null ? null : body[f]);
          }
        }
      }

      await db.update(travelQuotes).set(updateData).where(eq(travelQuotes.id, req.params.id));
      await recalcAndSaveOutputs(req.params.id);

      const [updated] = await db.select().from(travelQuotes).where(eq(travelQuotes.id, req.params.id));
      const [outputs] = await db.select().from(travelQuoteOutputs).where(eq(travelQuoteOutputs.quoteId, req.params.id));
      res.json({ quote: updated, outputs: outputs || null });
    } catch (err) {
      console.error("Update travel quote error:", err);
      res.status(500).json({ error: "Failed to update quote" });
    }
  });

  app.post("/api/travel/quotes/:id/submit", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role as string;
      const isAdmin = ["super_admin", "admin", "hr"].includes(role);

      const [quote] = await db.select().from(travelQuotes).where(eq(travelQuotes.id, req.params.id));
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (!isAdmin && quote.recruiterId !== userId) return res.status(403).json({ error: "Not your quote" });

      const [outputs] = await db.select().from(travelQuoteOutputs).where(eq(travelQuoteOutputs.quoteId, req.params.id));
      if (outputs?.stipendComplianceStatus === "over_cap") {
        return res.status(400).json({ error: "Cannot submit: stipend exceeds GSA cap. Request compliance override first." });
      }

      await db.update(travelQuotes).set({ status: "submitted", updatedAt: new Date() }).where(eq(travelQuotes.id, req.params.id));
      const [updated] = await db.select().from(travelQuotes).where(eq(travelQuotes.id, req.params.id));
      res.json({ quote: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to submit quote" });
    }
  });

  app.post("/api/travel/quotes/:id/approve", requireRole("hr"), async (req, res) => {
    try {
      await db.update(travelQuotes).set({ status: "approved", updatedAt: new Date() }).where(eq(travelQuotes.id, req.params.id));
      const [updated] = await db.select().from(travelQuotes).where(eq(travelQuotes.id, req.params.id));
      if (!updated) return res.status(404).json({ error: "Quote not found" });
      res.json({ quote: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to approve quote" });
    }
  });

  app.post("/api/travel/quotes/:id/compliance-override", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role as string;
      const isAdmin = ["super_admin", "admin", "hr"].includes(role);
      const [quote] = await db.select().from(travelQuotes).where(eq(travelQuotes.id, req.params.id));
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (!isAdmin && quote.recruiterId !== userId) return res.status(403).json({ error: "Not your quote" });

      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ error: "Override reason required" });

      await db.update(travelQuotes).set({
        complianceOverrideBy: userId,
        complianceOverrideReason: reason.trim(),
        updatedAt: new Date(),
      }).where(eq(travelQuotes.id, req.params.id));

      await db.update(travelQuoteOutputs).set({
        stipendComplianceStatus: "override_pending",
      }).where(eq(travelQuoteOutputs.quoteId, req.params.id));

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to record override" });
    }
  });

  app.get("/api/travel/margin-floors", requireAuth, async (req, res) => {
    try {
      const floors = await db.select().from(travelMarginFloors);
      res.json(floors);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch margin floors" });
    }
  });

  app.put("/api/travel/margin-floors/:roleType", requireRole("hr"), async (req, res) => {
    try {
      const { roleType } = req.params;
      const body = req.body;
      const existing = await db.select().from(travelMarginFloors).where(eq(travelMarginFloors.roleType, roleType)).limit(1);

      const vals = {
        roleType,
        redThresholdPct: String(body.redThresholdPct),
        yellowThresholdPct: String(body.yellowThresholdPct),
        payrollBurdenPct: String(body.payrollBurdenPct || "18.8"),
        defaultOtMultiplier: String(body.defaultOtMultiplier || "1.5"),
        defaultCallbackRate: String(body.defaultCallbackRate || "0"),
        defaultHolidayRate: String(body.defaultHolidayRate || "0"),
        defaultOnCallRate: String(body.defaultOnCallRate || "0"),
        defaultVmsFeePct: String(body.defaultVmsFeePct || "3"),
        updatedBy: req.session.userId!,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        await db.update(travelMarginFloors).set(vals).where(eq(travelMarginFloors.roleType, roleType));
      } else {
        await db.insert(travelMarginFloors).values(vals);
      }

      const [updated] = await db.select().from(travelMarginFloors).where(eq(travelMarginFloors.roleType, roleType));
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to update margin floor" });
    }
  });

  app.get("/api/travel/quotes/:id/pdf", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role as string;
      const isAdmin = ["super_admin", "admin", "hr"].includes(role);

      const [quote] = await db.select().from(travelQuotes).where(eq(travelQuotes.id, req.params.id));
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (!isAdmin && quote.recruiterId !== userId) return res.status(403).json({ error: "Not your quote" });

      const [outputs] = await db.select().from(travelQuoteOutputs).where(eq(travelQuoteOutputs.quoteId, req.params.id));

      // HTML-escape all user-supplied strings to prevent injection / SSRF via Puppeteer
      const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

      const q = quote;
      const o = outputs;
      const loc = [q.city, q.state].filter(Boolean).map(esc).join(", ") || esc(q.assignmentZip) || "—";
      const f = (v: any) => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
      const fp = (v: any) => Number(v || 0).toFixed(2) + "%";
      const ms = o?.marginStatus ?? "red";
      const msColor = ms === "green" ? "#16a34a" : ms === "yellow" ? "#ca8a04" : "#dc2626";
      const compBadge = o?.stipendComplianceStatus === "over_cap"
        ? `<span style="color:#dc2626;font-weight:bold">⚠ OVER CAP</span>`
        : `<span style="color:#16a34a">✔ Compliant</span>`;

      const roleLabel: Record<string, string> = {
        healthcare_travel: "Healthcare Travel (RN, Allied)",
        it_engineering: "IT / Engineering",
        professional_services: "Professional Services",
      };

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Travel Quote — ${esc(q.candidateName) || "Unknown"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;padding:32px;max-width:820px;margin:auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1F3A6E;padding-bottom:16px;margin-bottom:24px}
  .logo{font-size:22px;font-weight:700;color:#1F3A6E}
  .logo span{color:#F47C20}
  .meta{text-align:right;font-size:12px;color:#64748b}
  h2{font-size:16px;font-weight:600;color:#1F3A6E;margin:20px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
  th{background:#f1f5f9;text-align:left;padding:6px 10px;font-weight:600;color:#475569;border:1px solid #e2e8f0}
  td{padding:6px 10px;border:1px solid #e2e8f0}
  tr:nth-child(even) td{background:#f8fafc}
  .highlight td{background:#eff6ff!important;font-weight:600}
  .section{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
  .card{border:1px solid #e2e8f0;border-radius:8px;padding:14px}
  .card-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
  .card-value{font-size:18px;font-weight:700;color:#1F3A6E;margin-top:2px}
  .margin-badge{display:inline-block;background:${msColor};color:#fff;border-radius:4px;padding:2px 10px;font-weight:700;font-size:16px}
  .footer{border-top:1px solid #e2e8f0;margin-top:24px;padding-top:12px;font-size:11px;color:#94a3b8}
  @media print{body{padding:16px}.no-print{display:none}}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Hire<span>'</span>in <span style="color:#F96D3E">Solutions</span></div>
    <div style="font-size:12px;color:#64748b;margin-top:4px">Travel Pay Quote</div>
  </div>
  <div class="meta">
    Quote ID: ${q.id.substring(0, 8).toUpperCase()}<br/>
    Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}<br/>
    Status: <strong>${q.status.toUpperCase()}</strong><br/>
    Compliance: ${compBadge}
  </div>
</div>

<div class="section">
  <div class="card">
    <div class="card-label">Candidate</div>
    <div class="card-value" style="font-size:15px">${esc(q.candidateName) || "—"}</div>
  </div>
  <div class="card">
    <div class="card-label">Facility / Client</div>
    <div class="card-value" style="font-size:15px">${esc(q.facilityClientName) || "—"}</div>
  </div>
  <div class="card">
    <div class="card-label">Location</div>
    <div class="card-value" style="font-size:14px">${loc}</div>
  </div>
  <div class="card">
    <div class="card-label">Role Type</div>
    <div class="card-value" style="font-size:13px">${esc(roleLabel[q.roleType] || q.roleType)}</div>
  </div>
  <div class="card">
    <div class="card-label">Assignment Duration</div>
    <div class="card-value" style="font-size:14px">${esc(String(q.weeksInAssignment))} weeks · ${esc(String(q.totalHours))} hrs/week</div>
  </div>
  <div class="card">
    <div class="card-label">Net Margin</div>
    <div><span class="margin-badge">${fp(o?.netMarginPct)}</span></div>
  </div>
</div>

<h2>Candidate's Weekly Pay</h2>
<table>
  <tr><th>Description</th><th style="text-align:right">Per Week</th><th style="text-align:right">Per Contract</th></tr>
  <tr><td>Hourly Taxable (W2)</td><td style="text-align:right">${f(o?.hourlyTaxable)}/hr</td><td></td></tr>
  <tr><td>Weekly Taxable</td><td style="text-align:right">${f(o?.weeklyTaxable)}</td><td></td></tr>
  <tr><td>Weekly Non-Taxable (Per Diem)</td><td style="text-align:right">${f(o?.weeklyNonTaxable)}</td><td></td></tr>
  <tr class="highlight"><td>Weekly Gross</td><td style="text-align:right">${f(o?.weeklyGross)}</td><td></td></tr>
  <tr><td>Hourly Blended (Gross / Total Hrs)</td><td style="text-align:right">${f(o?.hourlyBlended)}/hr</td><td></td></tr>
  <tr><td>Overtime Rate</td><td style="text-align:right">${f(o?.otRate)}/hr</td><td></td></tr>
</table>

<h2>Revenue & Expense Summary</h2>
<table>
  <tr><th>Item</th><th style="text-align:right">Per Week</th><th style="text-align:right">Per Contract</th></tr>
  <tr><td>Total Billing (after VMS fee)</td><td style="text-align:right">${f(o?.totalBillingWeekly)}</td><td style="text-align:right">${f(o?.totalBillingContract)}</td></tr>
  <tr><td>Wage Payable</td><td style="text-align:right">${f(o?.wagePayableWeekly)}</td><td></td></tr>
  <tr><td>Payroll Taxes (burden)</td><td style="text-align:right">${f(o?.payrollTaxesWeekly)}</td><td></td></tr>
  <tr><td>Non-Taxable Stipend</td><td style="text-align:right">${f(o?.weeklyNonTaxable)}</td><td></td></tr>
  <tr class="highlight"><td>Total Expense</td><td style="text-align:right">${f(o?.totalExpenseWeekly)}</td><td style="text-align:right">${f(o?.totalExpenseContract)}</td></tr>
  <tr class="highlight"><td>Gross Profit</td><td style="text-align:right">${f(o?.grossProfitWeekly)}</td><td style="text-align:right">${f(Number(o?.grossProfitWeekly || 0) * q.weeksInAssignment)}</td></tr>
</table>

<h2>Margin Details</h2>
<table>
  <tr><th>Metric</th><th style="text-align:right">Value</th></tr>
  <tr><td>Net Margin %</td><td style="text-align:right;font-weight:700;color:${msColor}">${fp(o?.netMarginPct)}</td></tr>
  <tr><td>Net Margin / Hour</td><td style="text-align:right">${f(o?.netMarginPerHour)}</td></tr>
  <tr><td>Net Margin / Week</td><td style="text-align:right">${f(o?.netMarginPerWeek)}</td></tr>
  <tr><td>Net Margin / Contract</td><td style="text-align:right">${f(o?.netMarginPerContract)}</td></tr>
</table>

<h2>Per Diem (GSA) Information</h2>
<table>
  <tr><th>Item</th><th style="text-align:right">Value</th></tr>
  <tr><td>Daily Lodging Rate</td><td style="text-align:right">${f(q.dailyLodging)}</td></tr>
  <tr><td>Daily M&amp;IE Rate</td><td style="text-align:right">${f(q.dailyMie)}</td></tr>
  <tr><td>Away Days / Week</td><td style="text-align:right">${q.awayDays}</td></tr>
  <tr><td>GSA Weekly Cap</td><td style="text-align:right">${f((Number(q.dailyLodging || 0) + Number(q.dailyMie || 0)) * q.awayDays)}</td></tr>
  <tr><td>IRS Compliance Status</td><td style="text-align:right">${compBadge}</td></tr>
</table>

<div class="footer">
  <p>This quote is for internal planning purposes only. Non-taxable per diem amounts are subject to IRS accountable plan requirements (IRC §62(a)(2)(A)) and GSA per diem limits for the assignment location. Rates are not guaranteed and subject to final approval.</p>
  <p style="margin-top:6px">Hire'in Solutions · Quote Ref: ${q.id.substring(0, 8).toUpperCase()} · Generated ${new Date().toISOString().substring(0, 10)}</p>
</div>
</body>
</html>`;

      let browser: Browser | null = null;
      let page: any = null;
      try {
        browser = await getPdfBrowser();
        page = await browser.newPage();
        await page.setContent(html, { waitUntil: "domcontentloaded" });
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
        });
        const candidateSlug = (q.candidateName || q.id.substring(0, 8)).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="travel-quote-${candidateSlug}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        res.send(Buffer.from(pdfBuffer));
      } finally {
        if (page) await page.close().catch(() => {});
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ error: "Failed to generate quote PDF" });
    }
  });

  app.post("/api/travel/calculate", requireAuth, async (req, res) => {
    try {
      const body = req.body;
      const marginFloor = await getMarginFloor(body.roleType || "healthcare_travel");

      const input = {
        w2Hourly: Number(body.w2Hourly) || 0,
        totalHours: Number(body.totalHours) || 36,
        otMultiplier: Number(body.otMultiplier) || 1.5,
        masterBillRate: Number(body.masterBillRate) || 0,
        otBillRate: Number(body.otBillRate) || 0,
        clientOtMultiplier: Number(body.clientOtMultiplier) || 1.5,
        vmsFeePct: Number(body.vmsFeePct) || 3,
        weeksInAssignment: Number(body.weeksInAssignment) || 13,
        awayDays: Number(body.awayDays) || 5,
        dailyLodging: Number(body.dailyLodging) || 0,
        dailyMie: Number(body.dailyMie) || 0,
        firstLastDayMie: Number(body.firstLastDayMie) || (Number(body.dailyMie) * 0.75) || 0,
        decreasedStipendOverride: body.decreasedStipendOverride !== undefined && body.decreasedStipendOverride !== "" && body.decreasedStipendOverride !== null ? Number(body.decreasedStipendOverride) : null,
        orientationHoursTotal: Number(body.orientationHoursTotal) || 0,
        orientationHoursBillable: Number(body.orientationHoursBillable) || 0,
        orientationPayRate: Number(body.orientationPayRate) || Number(body.w2Hourly) || 0,
        orientationOtMultiplier: Number(body.orientationOtMultiplier) || 1,
        completionBonus: Number(body.completionBonus) || 0,
        payrollBurdenPct: Number(body.payrollBurdenPct) || 18.8,
        onCallRate: Number(body.onCallRate) || 0,
        callbackRate: Number(body.callbackRate) || 0,
        holidayRate: Number(body.holidayRate) || 0,
        roleType: body.roleType || "healthcare_travel",
        marginFloors: marginFloor,
      };

      const outputs = runTravelCalc(input);
      res.json(outputs);
    } catch (err) {
      console.error("Calculate error:", err);
      res.status(500).json({ error: "Calculation failed" });
    }
  });
}
