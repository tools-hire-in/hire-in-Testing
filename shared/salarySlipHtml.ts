/**
 * Canonical salary-slip HTML generator — single source of truth used by:
 *  - Client (View in New Tab): SalarySlips.tsx
 *  - Server (Download PDF + Email to Me): routes.ts salary slip endpoints
 *
 * Keeping one template guarantees on-screen, PDF, and email all match exactly.
 */

export interface ComputationSnapshotComponent {
  name: string;
  prelopPaise: number;
  postlopPaise: number;
  lopMode: string;
  /** Human-readable formula, e.g. "40% of Gross" or "₹1,600 fixed" */
  basisLabel?: string;
}

export interface ComputationSnapshotStatutoryLine {
  key: string;
  labelEn: string;
  amountPaise: number;
  isEmployerContribution: boolean;
  scheme?: string;
  flags?: string[];
  /** Short footnote explaining basis, e.g. "12% of PF wages (cap ₹15,000)" */
  footnote?: string;
}

export interface ComputationSnapshotWaterfall {
  netPayPaise: number;
  totalStatutoryDeductionsPaise: number;
  advanceRecoveredPaise: number;
  otherDeductionsPaise?: number;
}

export interface ComputationSnapshot {
  engine?: string;
  salaryStructureId?: string;
  grossRupees?: number;
  grossAfterLopPaise?: number;
  components?: ComputationSnapshotComponent[];
  statutoryLines?: ComputationSnapshotStatutoryLine[];
  waterfall?: ComputationSnapshotWaterfall;
  frozenRates?: Array<{ levy: string; key: string; valueBps: number; effectiveFrom: string }>;
  frozenRules?: Array<{ componentName: string; ruleType: string; valuePct?: number | null; valueFixed?: number | null; referenceComponent?: string | null }>;
  lopDays?: number;
  workingDays?: number;
  presentDays?: number;
}

export interface SalarySlipData {
  userId: string;
  employeeName: string;
  email: string;
  designation: string;
  department: string;
  year: number;
  month: number;
  salary: number;
  grossSalary: number;
  deductions: number;
  advanceRecovery: number;
  advanceRecoveryBreakdown?: { advance: number; overpayment: number } | null;
  salaryCredit?: number | null;
  netPayable: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  paidLeaves: number;
  lopLeaves: number;
  totalHours: number;
  attendancePercentage: number;
  adjusted: boolean;
  adjustmentComment: string | null;
  salaryRunId: string;
  approvedAt: string | null;
  /** When present, enables itemized earnings/deductions/employer sections */
  computationSnapshot?: ComputationSnapshot | null;
  /** Whether to render employer contribution section in the PDF */
  showEmployerContribution?: boolean;
}

export const SLIP_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatSlipCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rupeesFromPaise(paise: number): number {
  return paise / 100;
}

export function generateSalarySlipHtml(slip: SalarySlipData): string {
  const monthName = SLIP_MONTH_NAMES[slip.month - 1];
  const approvedDate = slip.approvedAt
    ? new Date(slip.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";
  const generatedDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const adjNote = slip.adjusted && slip.adjustmentComment
    ? `<div class="adj-note">&#9888; This slip contains a manual adjustment: ${slip.adjustmentComment}</div>`
    : "";

  const snap = slip.computationSnapshot;
  const hasSnapshot = !!(snap?.components?.length && snap?.statutoryLines);

  // -------------------------------------------------------------------------
  // Build earnings section
  // -------------------------------------------------------------------------
  let earningsSection = "";
  let deductionsSection = "";
  let employerSection = "";

  if (hasSnapshot && snap) {
    const components = snap.components!;
    const statutoryLines = snap.statutoryLines!;
    const grossAfterLop = snap.grossAfterLopPaise ?? 0;

    // Earnings rows (employee-visible components)
    const componentRows = components.map(c => {
      const hasLop = c.prelopPaise !== c.postlopPaise;
      const lopNote = hasLop
        ? ` <span style="font-size:10px;color:#718096;">(pre-LOP: &#8377;${formatSlipCurrency(rupeesFromPaise(c.prelopPaise))})</span>`
        : "";
      const basisNote = c.basisLabel
        ? `<br/><span style="font-size:10px;color:#718096;">Formula: ${c.basisLabel}</span>`
        : "";
      return `<tr>
        <td>${c.name}${lopNote}${basisNote}</td>
        <td class="amount">&#8377; ${formatSlipCurrency(rupeesFromPaise(c.postlopPaise))}</td>
      </tr>`;
    }).join("");

    const grossAfterLopRs = formatSlipCurrency(rupeesFromPaise(grossAfterLop));

    earningsSection = `
  <div class="section">
    <div class="section-title">Earnings</div>
    <table>
      <tr><th>Component</th><th class="amount">Amount (&#8377;)</th></tr>
      ${componentRows}
      <tr class="total-row"><td>Gross (after LOP)</td><td class="amount">&#8377; ${grossAfterLopRs}</td></tr>
    </table>
  </div>`;

    // Employee deduction lines
    const empLines = statutoryLines.filter(l => !l.isEmployerContribution);
    const footnotes: Array<{ num: number; text: string }> = [];
    let fnCounter = 0;
    const empRows = empLines.map(l => {
      let fnMark = "";
      if (l.footnote) {
        fnCounter++;
        footnotes.push({ num: fnCounter, text: l.footnote });
        fnMark = `<sup style="color:#718096;">${fnCounter}</sup>`;
      }
      const basisNote = l.footnote
        ? `<br/><span style="font-size:10px;color:#718096;">${l.footnote}</span>`
        : "";
      return `<tr><td>${l.labelEn}${basisNote}</td><td class="amount">&#8722; &#8377; ${formatSlipCurrency(rupeesFromPaise(l.amountPaise))}</td></tr>`;
    }).join("");

    const totalStatDed = rupeesFromPaise(snap.waterfall?.totalStatutoryDeductionsPaise ?? 0);
    const advRec = rupeesFromPaise(snap.waterfall?.advanceRecoveredPaise ?? 0);
    const netPay = rupeesFromPaise(snap.waterfall?.netPayPaise ?? 0);

    let advRows = "";
    if (slip.advanceRecoveryBreakdown) {
      if (slip.advanceRecoveryBreakdown.advance > 0) {
        advRows += `<tr><td>Salary Advance Recovery</td><td class="amount">&#8722; &#8377; ${formatSlipCurrency(slip.advanceRecoveryBreakdown.advance)}</td></tr>`;
      }
      if (slip.advanceRecoveryBreakdown.overpayment > 0) {
        advRows += `<tr><td>Overpayment Recovery</td><td class="amount">&#8722; &#8377; ${formatSlipCurrency(slip.advanceRecoveryBreakdown.overpayment)}</td></tr>`;
      }
    } else if (advRec > 0) {
      advRows = `<tr><td>Salary Advance Recovery</td><td class="amount">&#8722; &#8377; ${formatSlipCurrency(advRec)}</td></tr>`;
    }

    const creditRow = (slip.salaryCredit ?? 0) > 0
      ? `<tr><td>Salary Adjustment Credit</td><td class="amount">+ &#8377; ${formatSlipCurrency(slip.salaryCredit!)}</td></tr>`
      : "";

    deductionsSection = `
  <div class="section">
    <div class="section-title">Deductions</div>
    <table>
      <tr><th>Description</th><th class="amount">Amount (&#8377;)</th></tr>
      ${empRows}
      ${advRows}
      ${creditRow}
      <tr style="background:#f7fafc;"><td style="font-weight:600;">Total Statutory Deductions</td><td class="amount" style="font-weight:600;">&#8722; &#8377; ${formatSlipCurrency(totalStatDed)}</td></tr>
      <tr class="total-row"><td>Net Payable</td><td class="amount">&#8377; ${formatSlipCurrency(netPay)}</td></tr>
    </table>
  </div>`;

    // Employer contribution section
    if (slip.showEmployerContribution !== false) {
      const emplLines = statutoryLines.filter(l => l.isEmployerContribution);
      if (emplLines.length > 0) {
        const emplRows = emplLines.map(l =>
          `<tr><td>${l.labelEn}</td><td class="amount">&#8377; ${formatSlipCurrency(rupeesFromPaise(l.amountPaise))}</td></tr>`
        ).join("");
        const totalEmpl = emplLines.reduce((s, l) => s + l.amountPaise, 0);
        const ctc = rupeesFromPaise(grossAfterLop + totalEmpl);

        employerSection = `
  <div class="section">
    <div class="section-title">Employer Contributions (for reference)</div>
    <table>
      <tr><th>Description</th><th class="amount">Amount (&#8377;)</th></tr>
      ${emplRows}
      <tr class="total-row"><td>Cost to Company (CTC) this month</td><td class="amount">&#8377; ${formatSlipCurrency(ctc)}</td></tr>
    </table>
  </div>`;
      }
    }
  } else {
    // Legacy format — no snapshot
    const advanceRows = (() => {
      if (slip.advanceRecoveryBreakdown) {
        const parts: string[] = [];
        if (slip.advanceRecoveryBreakdown.advance > 0) {
          parts.push(`<tr><td>Salary Advance Recovery</td><td class="amount">&#8722; ${formatSlipCurrency(slip.advanceRecoveryBreakdown.advance)}</td></tr>`);
        }
        if (slip.advanceRecoveryBreakdown.overpayment > 0) {
          parts.push(`<tr><td>Overpayment Recovery</td><td class="amount">&#8722; ${formatSlipCurrency(slip.advanceRecoveryBreakdown.overpayment)}</td></tr>`);
        }
        return parts.join("");
      }
      if (slip.advanceRecovery > 0) {
        return `<tr><td>Salary Advance Recovery</td><td class="amount">&#8722; ${formatSlipCurrency(slip.advanceRecovery)}</td></tr>`;
      }
      return "";
    })();

    const creditRow = (slip.salaryCredit ?? 0) > 0
      ? `<tr><td>Salary Adjustment Credit</td><td class="amount">+ ${formatSlipCurrency(slip.salaryCredit!)}</td></tr>`
      : "";

    deductionsSection = `
  <div class="section">
    <div class="section-title">Earnings &amp; Deductions</div>
    <table>
      <tr><th>Description</th><th class="amount">Amount (INR)</th></tr>
      <tr><td>Basic Salary</td><td class="amount">${formatSlipCurrency(slip.salary)}</td></tr>
      <tr><td>Gross Salary</td><td class="amount">${formatSlipCurrency(slip.grossSalary)}</td></tr>
      <tr><td>Deductions (Unauthorized Absences)</td><td class="amount">&#8722; ${formatSlipCurrency(slip.deductions)}</td></tr>
      ${creditRow}
      ${advanceRows}
      <tr class="total-row"><td>Net Payable</td><td class="amount">${formatSlipCurrency(slip.netPayable)}</td></tr>
    </table>
  </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Salary Slip - ${monthName} ${slip.year}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; }
  .slip { max-width: 800px; margin: 0 auto; border: 2px solid #1a365d; }
  .header { background: #1a365d; color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header .period { font-size: 14px; opacity: 0.9; }
  .sub-header { background: #edf2f7; padding: 16px 32px; font-size: 13px; color: #4a5568; text-align: center; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .employee-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 20px 32px; border-bottom: 1px solid #e2e8f0; }
  .info-item { display: flex; gap: 8px; font-size: 13px; }
  .info-label { color: #718096; min-width: 100px; }
  .info-value { font-weight: 600; color: #1a202c; }
  .section { padding: 20px 32px; }
  .section-title { font-size: 14px; font-weight: 700; color: #1a365d; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 16px; text-align: left; font-size: 13px; }
  th { background: #f7fafc; color: #4a5568; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
  td { border-bottom: 1px solid #edf2f7; }
  .amount { text-align: right; font-family: 'Courier New', monospace; }
  .total-row { background: #f7fafc; font-weight: 700; }
  .total-row td { border-top: 2px solid #1a365d; border-bottom: none; }
  .net-pay { background: #1a365d; color: #fff; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; }
  .net-pay .label { font-size: 16px; font-weight: 600; }
  .net-pay .value { font-size: 24px; font-weight: 700; }
  .footer { padding: 16px 32px; font-size: 11px; color: #a0aec0; text-align: center; border-top: 1px solid #e2e8f0; }
  .adj-note { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 10px 16px; margin: 0 32px 12px; font-size: 12px; color: #c2410c; }
  @media print { body { padding: 0; } .slip { border: none; } }
</style>
</head>
<body>
<div class="slip">
  <div class="header">
    <div>
      <h1>Hire-In Solutions</h1>
      <div style="font-size:12px;opacity:0.8;margin-top:4px;">Professional Staffing Services</div>
    </div>
    <div style="text-align:right;">
      <div class="period">${monthName} ${slip.year}</div>
      <div style="font-size:11px;opacity:0.7;margin-top:2px;">Pay Slip</div>
    </div>
  </div>
  <div class="sub-header">Salary Slip for the month of ${monthName} ${slip.year}</div>
  <div class="employee-info">
    <div class="info-item"><span class="info-label">Employee Name:</span><span class="info-value">${slip.employeeName}</span></div>
    <div class="info-item"><span class="info-label">Email:</span><span class="info-value">${slip.email}</span></div>
    <div class="info-item"><span class="info-label">Designation:</span><span class="info-value">${slip.designation || "N/A"}</span></div>
    <div class="info-item"><span class="info-label">Department:</span><span class="info-value">${slip.department || "N/A"}</span></div>
    <div class="info-item"><span class="info-label">Pay Period:</span><span class="info-value">${monthName} ${slip.year}</span></div>
    <div class="info-item"><span class="info-label">Approved On:</span><span class="info-value">${approvedDate}</span></div>
  </div>
  ${adjNote}
  <div class="section">
    <div class="section-title">Attendance Summary</div>
    <table>
      <tr><th>Description</th><th class="amount">Value</th></tr>
      <tr><td>Total Working Days</td><td class="amount">${slip.workingDays}</td></tr>
      <tr><td>Days Present</td><td class="amount">${slip.presentDays}</td></tr>
      <tr><td>Days Absent</td><td class="amount">${slip.absentDays}</td></tr>
      <tr><td>Approved Leaves</td><td class="amount">${slip.paidLeaves}</td></tr>
      <tr><td>LOP (Unpaid) Leaves</td><td class="amount">${slip.lopLeaves}</td></tr>
      <tr><td>Total Hours Worked</td><td class="amount">${Number(slip.totalHours).toFixed(1)}</td></tr>
      <tr><td>Attendance Percentage</td><td class="amount">${Number(slip.attendancePercentage).toFixed(1)}%</td></tr>
    </table>
  </div>
  ${earningsSection}
  ${deductionsSection}
  ${employerSection}
  <div class="net-pay">
    <span class="label">Net Pay</span>
    <span class="value">&#8377; ${formatSlipCurrency(slip.netPayable)}</span>
  </div>
  <div class="footer">
    This is a system-generated salary slip based on approved payroll run. Generated on ${generatedDate}.
  </div>
</div>
</body>
</html>`;
}
