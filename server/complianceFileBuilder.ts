/**
 * Compliance File Builder — India Statutory Filing
 *
 * Builds PF ECR, ESI monthly return, and PT challan files from the
 * computation_snapshot stored on salary slips. Pure data transformation —
 * no DB writes, no side effects. All monetary values in rupees (rounded
 * to nearest rupee) for the output files.
 */

import { db } from "./db";
import { adminUsers, salarySlips, salaryReportRuns } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplianceRow {
  userId: string;
  employeeName: string;
  employeeId: string | null;
  uan: string | null;
  esicIpNumber: string | null;
  ptState: string | null;
  grossAfterLopRupees: number;
  pfBasisRupees: number;
  epsBasisRupees: number;
  employeePfRupees: number;
  employerEpfRupees: number;
  employerEpsRupees: number;
  employerEdliRupees: number;
  employeeEsiRupees: number;
  employerEsiRupees: number;
  ptRupees: number;
  ncpDays: number;
  hasSnapshot: boolean;
}

export interface ComplianceStatusResult {
  runId: string;
  year: number;
  month: number;
  totalEmployees: number;
  pf: {
    eligible: number;
    missingUan: number;
    canGenerate: boolean;
  };
  esi: {
    eligible: number;
    missingIpNumber: number;
    canGenerate: boolean;
  };
  pt: {
    eligible: number;
    missingPtState: number;
    unregisteredStates: string[];
    canGenerate: boolean;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function pToR(paise: number): number {
  return Math.round(paise / 100);
}

/**
 * Load PT registration status from the state_deductions table.
 *
 * Returns a Map<ptStateKey, { isRegistered: boolean; label: string }> where
 * ptStateKey is the lowercase-with-underscores format stored in admin_users.pt_state
 * (e.g. "maharashtra", "west_bengal") and label is the human-readable state name.
 *
 * The bridge between state_deductions.state ("Maharashtra") and pt_state keys
 * ("maharashtra") is done via PT_STATE_LABELS — if a DB state name doesn't appear
 * in PT_STATE_LABELS values, it cannot be matched and is ignored.
 */
export async function loadPtRegistrations(): Promise<Map<string, { isRegistered: boolean; label: string }>> {
  const rows = (await db.execute(sql`
    SELECT state, is_registered
    FROM state_deductions
    WHERE levy_type = 'PT' AND jurisdiction = 'IN'
  `)).rows as Array<{ state: string; is_registered: boolean }>;

  // Reverse lookup: "Maharashtra" (lowercase) → "maharashtra" (pt_state key)
  const nameToPtKey = new Map<string, string>();
  for (const [key, label] of Object.entries(PT_STATE_LABELS)) {
    nameToPtKey.set(label.toLowerCase(), key);
  }

  const result = new Map<string, { isRegistered: boolean; label: string }>();
  for (const row of rows) {
    const ptKey = nameToPtKey.get(row.state.toLowerCase());
    if (!ptKey) continue; // unknown state not in PT_STATE_LABELS — skip
    result.set(ptKey, { isRegistered: row.is_registered, label: row.state });
  }
  return result;
}

function csvEscape(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

// ---------------------------------------------------------------------------
// Core: load rows for a run
// ---------------------------------------------------------------------------

export async function loadComplianceRows(runId: string): Promise<ComplianceRow[]> {
  // Load the run to verify it exists and is executed
  const runs = await db
    .select()
    .from(salaryReportRuns)
    .where(eq(salaryReportRuns.id, runId))
    .limit(1);
  const run = runs[0];
  if (!run) throw new Error("Run not found");

  // Load all salary slips for this run
  const slips = await db
    .select()
    .from(salarySlips)
    .where(eq(salarySlips.salaryRunId, runId));

  if (!slips.length) return [];

  // Load user data (including UAN, ESIC IP, ptState)
  const userRows = (await db.execute(sql`
    SELECT id, first_name, last_name, employee_id, uan, esic_ip_number, pt_state
    FROM admin_users
    WHERE id = ANY(${slips.map(s => s.userId)})
  `)).rows as Array<{
    id: string;
    first_name: string;
    last_name: string;
    employee_id: string | null;
    uan: string | null;
    esic_ip_number: string | null;
    pt_state: string | null;
  }>;

  const userMap = new Map(userRows.map(u => [u.id, u]));

  const rows: ComplianceRow[] = [];

  for (const slip of slips) {
    const user = userMap.get(slip.userId);
    if (!user) continue;

    const snap = slip.computationSnapshot as Record<string, any> | null;
    const hasSnapshot = !!snap && snap.engine === "IndiaStatutoryEngine@v1";

    let grossAfterLopPaise = 0;
    let pfBasisPaise = 0;
    let epsBasisPaise = 0; // always capped at ₹15,000; kept separate from pfBasisPaise
    let employeePfPaise = 0;
    let employerEpfPaise = 0;
    let employerEpsPaise = 0;
    let employerEdliPaise = 0;
    let employeeEsiPaise = 0;
    let employerEsiPaise = 0;
    let ptPaise = 0;
    let ncpDays = 0;

    if (hasSnapshot) {
      grossAfterLopPaise = Number(snap.grossAfterLopPaise ?? 0);
      ncpDays = Number(snap.lopDays ?? 0);

      // Derive PF basis from components (same logic as engine)
      const components = (snap.components ?? []) as Array<{
        name: string;
        postlopPaise: number;
        prelopPaise: number;
      }>;
      const basicComp = components.find(c => c.name.toLowerCase() === "basic");
      const basicAfterLopPaise = basicComp?.postlopPaise ?? 0;
      const pfBasisRaw = Math.max(basicAfterLopPaise, Math.round(grossAfterLopPaise * 0.5));
      const pfMode = snap.pfMode ?? "restricted";
      // PF basis respects mode (restricted → capped at ₹15,000; unrestricted → actual wages)
      pfBasisPaise = pfMode === "restricted" ? Math.min(pfBasisRaw, 1500000) : pfBasisRaw;
      // EPS basis is always capped at ₹15,000 regardless of PF mode
      epsBasisPaise = Math.min(pfBasisPaise, 1500000);

      const statutoryLines = (snap.statutoryLines ?? []) as Array<{
        key: string;
        amountPaise: number;
        scheme: string;
        flags: string[];
        isEmployerContribution: boolean;
      }>;

      for (const line of statutoryLines) {
        switch (line.key) {
          case "epf_employee": employeePfPaise = line.amountPaise; break;
          case "epf_employer": employerEpfPaise = line.amountPaise; break;
          // NOTE: do NOT overwrite pfBasisPaise here — EPS basis ≠ EPF basis for unrestricted mode
          case "eps_employer": employerEpsPaise = line.amountPaise; break;
          case "edli_employer": employerEdliPaise = line.amountPaise; break;
          case "esi_employee": employeeEsiPaise = line.amountPaise; break;
          case "esi_employer": employerEsiPaise = line.amountPaise; break;
          case "state_deduction": ptPaise = line.amountPaise; break;
        }
      }
    } else {
      // Fall back to slip-level fields (legacy non-engine slips)
      grossAfterLopPaise = Math.round(parseFloat(String(slip.grossSalary ?? "0")) * 100);
      ncpDays = Math.round(parseFloat(String(slip.lopLeaves ?? "0")));
    }

    rows.push({
      userId: slip.userId,
      employeeName: `${user.first_name} ${user.last_name}`,
      employeeId: user.employee_id,
      uan: user.uan,
      esicIpNumber: user.esic_ip_number,
      ptState: user.pt_state,
      grossAfterLopRupees: pToR(grossAfterLopPaise),
      pfBasisRupees: pToR(pfBasisPaise),
      epsBasisRupees: pToR(epsBasisPaise), // use the separately tracked EPS basis
      employeePfRupees: pToR(employeePfPaise),
      employerEpfRupees: pToR(employerEpfPaise),
      employerEpsRupees: pToR(employerEpsPaise),
      employerEdliRupees: pToR(employerEdliPaise),
      employeeEsiRupees: pToR(employeeEsiPaise),
      employerEsiRupees: pToR(employerEsiPaise),
      ptRupees: pToR(ptPaise),
      ncpDays,
      hasSnapshot,
    });
  }

  return rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

// ---------------------------------------------------------------------------
// PF ECR (EPFO Electronic Challan cum Return 2.0)
// ---------------------------------------------------------------------------

/**
 * Builds the EPFO ECR 2.0 text file for upload at the EPFO Unified Portal.
 *
 * Format: header `#~#` then one `~`-delimited row per EPF-covered employee.
 * Columns:
 *   UAN ~ Member_ID ~ Name ~ Gross_Wages ~ EPF_Wages ~ EPS_Wages ~ EDLI_Wages
 *   ~ EE_EPF_Contrib ~ ER_EPF_Contrib ~ ER_EPS_Contrib ~ ER_EDLI_Contrib
 *   ~ NCP_Days ~ Refund_of_Advances
 *
 * Employees with EPF = 0 and no snapshot are excluded.
 * Employees missing UAN get placeholder "MISSING_UAN_<employeeId>" and are
 * flagged in the `warnings` return value.
 */
export function buildPfEcr(rows: ComplianceRow[]): {
  content: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines: string[] = ["#~#"];

  for (const row of rows) {
    // Only include employees with PF deductions or who have a snapshot showing EPF active
    // (employee PF > 0 OR employer PF > 0 OR employer EPS > 0 means EPF active)
    const hasEpf =
      row.employeePfRupees > 0 ||
      row.employerEpfRupees > 0 ||
      row.employerEpsRupees > 0;
    if (!hasEpf && row.pfBasisRupees === 0) continue;

    let uan = row.uan?.trim() || "";
    if (!uan) {
      uan = `MISSING_UAN`;
      warnings.push(`${row.employeeName} (${row.employeeId ?? row.userId}): UAN not set — row marked with placeholder`);
    }

    const memberId = row.employeeId ?? row.userId;
    const gross = row.grossAfterLopRupees;
    const epfWages = row.pfBasisRupees;
    const epsWages = row.epsBasisRupees;
    const edliWages = row.epsBasisRupees; // EDLI basis same as EPS basis
    const eeEpf = row.employeePfRupees;
    const erEpf = row.employerEpfRupees;
    const erEps = row.employerEpsRupees;
    const erEdli = row.employerEdliRupees;
    const ncpDays = row.ncpDays;
    const refundAdvances = 0;

    lines.push(
      [uan, memberId, row.employeeName, gross, epfWages, epsWages, edliWages,
        eeEpf, erEpf, erEps, erEdli, ncpDays, refundAdvances].join("~")
    );
  }

  return { content: lines.join("\r\n"), warnings };
}

// ---------------------------------------------------------------------------
// ESI Monthly Return (ESIC portal CSV)
// ---------------------------------------------------------------------------

/**
 * Builds the ESIC monthly contribution CSV for upload at esic.in.
 *
 * Format: CSV with header row, one row per ESI-covered employee.
 * Employees with ESI contributions of ₹0 are skipped.
 * Employees missing IP Number get placeholder and are flagged.
 */
export function buildEsiReturn(rows: ComplianceRow[]): {
  content: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const csvRows: string[] = [
    "IP Number,Insured Person Name,Employee ID,Gross Wages,Employee ESI,Employer ESI,Total ESI",
  ];

  for (const row of rows) {
    if (row.employeeEsiRupees === 0 && row.employerEsiRupees === 0) continue;

    let ipNumber = row.esicIpNumber?.trim() || "";
    if (!ipNumber) {
      ipNumber = "MISSING_IP";
      warnings.push(
        `${row.employeeName} (${row.employeeId ?? row.userId}): ESIC IP Number not set — row marked with placeholder`
      );
    }

    const total = row.employeeEsiRupees + row.employerEsiRupees;
    csvRows.push(
      [
        csvEscape(ipNumber),
        csvEscape(row.employeeName),
        csvEscape(row.employeeId ?? ""),
        row.grossAfterLopRupees,
        row.employeeEsiRupees,
        row.employerEsiRupees,
        total,
      ].join(",")
    );
  }

  return { content: csvRows.join("\r\n"), warnings };
}

// ---------------------------------------------------------------------------
// PT Challan (state-wise summary)
// ---------------------------------------------------------------------------

const PT_STATE_LABELS: Record<string, string> = {
  maharashtra: "Maharashtra",
  karnataka: "Karnataka",
  telangana: "Telangana",
  andhra_pradesh: "Andhra Pradesh",
  tamil_nadu: "Tamil Nadu",
  west_bengal: "West Bengal",
  gujarat: "Gujarat",
  kerala: "Kerala",
  madhya_pradesh: "Madhya Pradesh",
  odisha: "Odisha",
  assam: "Assam",
  meghalaya: "Meghalaya",
  tripura: "Tripura",
  sikkim: "Sikkim",
  bihar: "Bihar",
};

/**
 * Builds the PT/PSDT challan text file grouped by state.
 *
 * Only includes states that appear in the employee data with PT > 0 AND are
 * registered in the DB (registeredPtStateKeys). States with employees but not
 * registered are excluded with a note.
 *
 * @param registeredPtStateKeys - Set of pt_state keys (e.g. "maharashtra") that
 *   have isRegistered=true in state_deductions. When omitted, all states are included
 *   (backwards-compatible, for cases where DB is not consulted).
 */
export function buildPtChallan(
  rows: ComplianceRow[],
  period: { year: number; month: number },
  registeredPtStateKeys?: Set<string>
): {
  content: string;
  warnings: string[];
  excludedStates: string[];
} {
  const warnings: string[] = [];
  const excludedStates: string[] = [];

  // Group rows by ptState, skipping unregistered states
  const byState = new Map<string, ComplianceRow[]>();
  for (const row of rows) {
    if (!row.ptState || row.ptState === "none") continue;
    // Skip states not registered in DB (when registration data is provided)
    if (registeredPtStateKeys && !registeredPtStateKeys.has(row.ptState)) {
      const label = PT_STATE_LABELS[row.ptState] ?? row.ptState;
      if (!excludedStates.includes(label)) {
        excludedStates.push(label);
        warnings.push(`${label}: state not registered for PT — excluded from challan`);
      }
      continue;
    }
    if (!byState.has(row.ptState)) byState.set(row.ptState, []);
    byState.get(row.ptState)!.push(row);
  }

  const monthName = new Date(period.year, period.month - 1, 1).toLocaleString("en-IN", {
    month: "long",
  });

  const sections: string[] = [];

  sections.push(`PROFESSIONAL TAX / PSDT CHALLAN`);
  sections.push(`Period: ${monthName} ${period.year}`);
  sections.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
  sections.push(`${"=".repeat(80)}`);
  sections.push("");

  if (byState.size === 0) {
    sections.push("No employees with Professional Tax applicable for this period.");
    return { content: sections.join("\n"), warnings, excludedStates };
  }

  for (const [state, stateRows] of byState.entries()) {
    const stateLabel = PT_STATE_LABELS[state] ?? state;
    const stateTotal = stateRows.reduce((s, r) => s + r.ptRupees, 0);

    if (stateTotal === 0) {
      excludedStates.push(stateLabel);
      continue;
    }

    sections.push(`STATE: ${stateLabel.toUpperCase()}`);
    sections.push(`${"─".repeat(80)}`);
    sections.push(
      `${"Employee Name".padEnd(35)}${"Employee ID".padEnd(20)}${"Gross Wages".padStart(14)}${"PT Amount".padStart(12)}`
    );
    sections.push(`${"─".repeat(80)}`);

    for (const row of stateRows) {
      if (row.ptRupees === 0) continue;
      const name = row.employeeName.substring(0, 34).padEnd(35);
      const empId = (row.employeeId ?? "").substring(0, 19).padEnd(20);
      const gross = `₹${row.grossAfterLopRupees.toLocaleString("en-IN")}`.padStart(14);
      const pt = `₹${row.ptRupees.toLocaleString("en-IN")}`.padStart(12);
      sections.push(`${name}${empId}${gross}${pt}`);
    }

    sections.push(`${"─".repeat(80)}`);
    sections.push(
      `${"TOTAL PT PAYABLE TO " + stateLabel.toUpperCase()}`.padEnd(69) +
        `₹${stateTotal.toLocaleString("en-IN")}`.padStart(12)
    );
    sections.push("");
  }

  return { content: sections.join("\n"), warnings, excludedStates };
}

// ---------------------------------------------------------------------------
// Compliance status check (pre-download readiness)
// ---------------------------------------------------------------------------

export async function getComplianceStatus(runId: string): Promise<ComplianceStatusResult> {
  const runs = await db
    .select({ id: salaryReportRuns.id, year: salaryReportRuns.year, month: salaryReportRuns.month })
    .from(salaryReportRuns)
    .where(eq(salaryReportRuns.id, runId))
    .limit(1);
  const run = runs[0];
  if (!run) throw new Error("Run not found");

  const rows = await loadComplianceRows(runId);

  // PF: employees where EPF is active (employee PF > 0 or employer EPF/EPS > 0)
  const pfRows = rows.filter(
    r => r.employeePfRupees > 0 || r.employerEpfRupees > 0 || r.employerEpsRupees > 0
  );
  const missingUan = pfRows.filter(r => !r.uan?.trim()).length;

  // ESI: employees where ESI > 0
  const esiRows = rows.filter(r => r.employeeEsiRupees > 0 || r.employerEsiRupees > 0);
  const missingIpNumber = esiRows.filter(r => !r.esicIpNumber?.trim()).length;

  // PT: load registration status from DB (single source of truth)
  const ptRegistrations = await loadPtRegistrations();
  const registeredPtStateKeys = new Set(
    [...ptRegistrations.entries()]
      .filter(([, v]) => v.isRegistered)
      .map(([k]) => k)
  );

  // Employees with no ptState set among those who are in a registered PT state
  // (or who have ptRupees > 0 but no ptState — they clearly should have one)
  const ptApplicableRows = rows.filter(
    r => r.ptRupees > 0 || (r.ptState && r.ptState !== "none" && registeredPtStateKeys.has(r.ptState))
  );
  const missingPtState = ptApplicableRows.filter(
    r => !r.ptState || r.ptState === "none"
  ).length;

  // Employees with a set ptState but the state is NOT registered in DB
  const allEmployeeStates = [...new Set(
    rows.filter(r => r.ptState && r.ptState !== "none").map(r => r.ptState as string)
  )];
  const unregisteredStates = allEmployeeStates
    .filter(s => !registeredPtStateKeys.has(s))
    .map(s => ptRegistrations.get(s)?.label ?? PT_STATE_LABELS[s] ?? s);

  // Eligible = employees with ptRupees > 0 in a registered state
  const ptRows = rows.filter(r => r.ptRupees > 0 && r.ptState && registeredPtStateKeys.has(r.ptState));

  return {
    runId,
    year: run.year,
    month: run.month,
    totalEmployees: rows.length,
    pf: {
      eligible: pfRows.length,
      missingUan,
      canGenerate: pfRows.length > 0,
    },
    esi: {
      eligible: esiRows.length,
      missingIpNumber,
      canGenerate: esiRows.length > 0,
    },
    pt: {
      eligible: ptRows.length,
      missingPtState,
      unregisteredStates,
      canGenerate: ptRows.length > 0,
    },
  };
}
