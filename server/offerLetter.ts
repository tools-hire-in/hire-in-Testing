import fs from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageBreak,
} from "docx";
import type { AnnexureItem } from "./offerLetterAddendum";
import { POLICY_ANNEXURES, ENGINEERING_ANNEXURE_KEYS, type PolicyAnnexureKey } from "./annexureContent";

export interface OfferLetterData {
  candidateTitle: string;
  candidateName: string;
  candidateAddress: string;
  designation: string;
  subjectDesignation: string;
  reportingTo: string;
  employmentType: string;
  proposedStartDate: string;
  salary: number;
  salaryInWords: string;
  location: string;
  jurisdiction: string;
  department: string;
  hrManagerName: string;
  offerDate: string;
  annexures?: AnnexureItem[];
  policyAnnexures?: string[];
  annexureInitials?: Record<string, string>;
  probationSalary?: number;
  probationSalaryInWords?: string;
  postProbationSalary?: number;
  postProbationSalaryInWords?: string;
  probationPeriodMonths?: number;
  extendedProbationMonths?: number;
  performanceProbationReview?: boolean;
  performanceClauseText?: string;
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22 })],
  });
}

function bodyText(text: string, options?: { bold?: boolean; spacing?: { before?: number; after?: number } }): Paragraph {
  return new Paragraph({
    spacing: options?.spacing || { after: 100 },
    children: [new TextRun({ text, size: 20, bold: options?.bold })],
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 20 })],
  });
}

function buildAnnexureChildren(annexures?: AnnexureItem[]): Paragraph[] {
  if (!annexures || annexures.length === 0) return [];
  const LABELS = ["A", "B", "C", "D", "E"];
  const result: Paragraph[] = [];
  for (let i = 0; i < annexures.length; i++) {
    const ann = annexures[i];
    const label = LABELS[i] || String(i + 1);
    result.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    result.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: `Annexure ${label}: ${ann.title}`, bold: true, size: 26, underline: {} })],
    }));
    const lines = ann.body.split(/\r?\n/);
    for (const line of lines) {
      result.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: line, size: 20 })],
      }));
    }
  }
  return result;
}

function buildEngSignatureTable(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.NONE, size: 0 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
            children: [
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Employee / Signatory", bold: true, size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Employee Name: ___________________________", size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Signature: _______________________________", size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Date: ___________________________________", size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Personal Email: __________________________", size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Employee Initials: _______________________", size: 20 })] }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
            children: [
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "For Hire'in Solutions", bold: true, size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Authorized Signature: ____________________", size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Date: ___________________________________", size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Name & Title: ___________________________", size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Company Seal:", size: 20 })] }),
              new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: " ", size: 20 })] }),
            ],
          }),
        ],
      }),
    ],
  });
}

function buildPolicyAnnexureChildren(policyAnnexures?: string[], annexureInitials?: Record<string, string>): (Paragraph | Table)[] {
  if (!policyAnnexures || policyAnnexures.length === 0) return [];
  const result: (Paragraph | Table)[] = [];
  for (const key of policyAnnexures) {
    const policy = POLICY_ANNEXURES[key as PolicyAnnexureKey];
    if (!policy) continue;
    result.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    result.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: policy.title, bold: true, size: 26, underline: {} })],
    }));
    const initials = annexureInitials?.[key]?.trim();
    if (initials) {
      result.push(new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: `Reviewed & acknowledged — Candidate Initials: ${initials}`, italics: true, size: 18 })],
      }));
    }
    const lines = policy.body.split(/\r?\n/);
    for (const line of lines) {
      if (line.trim() === "") {
        result.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
      } else {
        result.push(new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: line, size: 20 })],
        }));
      }
    }
    if (ENGINEERING_ANNEXURE_KEYS.includes(key)) {
      result.push(new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: "Execution / Signature Block", bold: true, size: 20 })] }));
      result.push(buildEngSignatureTable());
      result.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    }
  }
  return result;
}

function noBorderCell(children: (Paragraph)[]) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
    },
    children,
  });
}

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const formatIndian = (n: number): string => {
    let str = "";
    if (n >= 10000000) {
      str += formatIndian(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      str += formatIndian(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      str += formatIndian(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 0) {
      if (str !== "") str += "and ";
      if (n < 20) str += a[n];
      else {
        str += b[Math.floor(n / 10)];
        if (n % 10 > 0) str += " " + a[n % 10];
      }
    }
    return str.trim();
  };

  return formatIndian(Math.floor(num)) + " Rupees Only";
}

export async function generateOfferLetterDocx(data: OfferLetterData): Promise<Buffer> {
  const annualSalary = data.salary * 12;
  const salaryStr = `₹${annualSalary.toLocaleString("en-IN")} (${numberToWords(annualSalary)}) per annum`;

  const logoPath = path.resolve("attached_assets/HS_logo_500_1769977401589.jpg");
  let logoImageRun: ImageRun | null = null;
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoImageRun = new ImageRun({
      data: logoBuffer,
      transformation: { width: 140, height: 60 },
      type: "jpg",
    });
  } catch {
    // if logo file not found, skip it
  }

  const headerParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 50 },
    children: logoImageRun
      ? [logoImageRun]
      : [new TextRun({ text: "Rayomind Solutions", bold: true, size: 36, font: "Calibri" })],
  });

  const companyNameParagraph = logoImageRun
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "Rayomind Solutions", bold: true, size: 28, font: "Calibri" })],
      })
    : new Paragraph({ children: [] });

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
      insideHorizontal: { style: BorderStyle.NONE, size: 0 },
      insideVertical: { style: BorderStyle.NONE, size: 0 },
    },
    rows: [
      new TableRow({
        children: [
          noBorderCell([
            new Paragraph({
              children: [new TextRun({ text: "For Rayomind Solutions", bold: true, size: 20 })],
            }),
            new Paragraph({
              spacing: { before: 100 },
              children: [new TextRun({ text: `Name: ${data.hrManagerName}`, size: 20 })],
            }),
            new Paragraph({
              spacing: { before: 100 },
              children: [new TextRun({ text: "Title: HR Manager", size: 20 })],
            }),
            new Paragraph({
              spacing: { before: 400 },
              children: [new TextRun({ text: "Signature: _______________________", size: 20 })],
            }),
            new Paragraph({
              spacing: { before: 200 },
              children: [new TextRun({ text: "Date: ____________________________", size: 20 })],
            }),
          ]),
          noBorderCell([
            new Paragraph({
              children: [new TextRun({ text: "Accepted & Agreed by Employee", bold: true, size: 20 })],
            }),
            new Paragraph({
              spacing: { before: 100 },
              children: [new TextRun({ text: `Name: ${data.candidateTitle} ${data.candidateName}`, size: 20 })],
            }),
            new Paragraph({
              spacing: { before: 100 },
              children: [new TextRun({ text: " ", size: 20 })],
            }),
            new Paragraph({
              spacing: { before: 400 },
              children: [new TextRun({ text: "Signature: _______________________", size: 20 })],
            }),
            new Paragraph({
              spacing: { before: 200 },
              children: [new TextRun({ text: "Date: ____________________________", size: 20 })],
            }),
          ]),
        ],
      }),
    ],
  });

  const compensationParagraphs: Paragraph[] = (() => {
    if (data.performanceProbationReview && data.performanceClauseText) {
      const paras: Paragraph[] = [];
      for (const line of data.performanceClauseText.split(/\r?\n/)) {
        if (line.trim() === "") {
          paras.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        } else {
          paras.push(bodyText(line));
        }
      }
      paras.push(bodyText("Salary will be credited to your registered bank account by the 10th of the following calendar month."));
      return paras;
    }

    if (data.probationSalary && data.postProbationSalary) {
      const probMonths = data.probationPeriodMonths ?? 3;
      const probMonthLabel = probMonths === 1 ? "1 month" : `${probMonths} months`;
      const probSalaryStr = `₹${data.probationSalary.toLocaleString("en-IN")}${data.probationSalaryInWords ? ` (${data.probationSalaryInWords})` : ""}`;
      const postSalaryStr = `₹${data.postProbationSalary.toLocaleString("en-IN")}${data.postProbationSalaryInWords ? ` (${data.postProbationSalaryInWords})` : ""}`;
      return [
        subHeading("During Probation Period"),
        bodyText(`Probation Duration: ${probMonthLabel}`),
        bodyText(`Monthly Compensation: ${probSalaryStr} per month`),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
        subHeading("Post-Probation (subject to performance review)"),
        bodyText(`Monthly Compensation: ${postSalaryStr} per month`),
        bodyText("The above post-probation compensation is conditional upon satisfactory completion of the probationary period and achievement of agreed performance milestones. Any salary revision shall be confirmed separately in writing."),
        bodyText("Salary will be credited to your registered bank account by the 10th of the following calendar month."),
      ];
    }

    return [
      bodyText(`Your Annual Cost to Company (CTC) will be ${salaryStr}.`),
      bodyText("Salary will be credited to your registered bank account by the 10th of the following calendar month."),
    ];
  })();

  const probationParagraphs: Paragraph[] = [
    subHeading("2a. Probationary Period and Performance Review"),
    bodyText(
      "Your employment will commence with an initial probation period of three (3) months from your date of joining. During this probation period, either party may terminate the employment by providing one (1) week's written notice."
    ),
    new Paragraph({ spacing: { after: 80 }, children: [] }),
    bodyText(
      "Upon completion of the initial probation period, the Company will conduct a performance and delivery review. Subject to your performance, achievement of assigned goals, quality of delivery, consistency, professional conduct, and overall contribution, your compensation may be reconsidered."
    ),
    new Paragraph({ spacing: { after: 80 }, children: [] }),
    bodyText(
      "Employees who significantly exceed the expected goals and demonstrate strong ownership, consistent delivery, and measurable business impact may be considered for a salary revision up to the post-probation amount stated above. Any salary revision shall not be automatic and will be at the sole discretion of the Company, subject to management review, business requirements, and confirmed separately in writing. Mention of a review amount does not constitute a guarantee or automatic entitlement to a salary increase."
    ),
    new Paragraph({ spacing: { after: 80 }, children: [] }),
    bodyText(
      "The Company may extend the probation period up to six (6) months if required, based on performance, delivery, conduct, or business needs."
    ),
  ];

  const policyAnnexureListParagraphs: Paragraph[] = (() => {
    if (!data.policyAnnexures || data.policyAnnexures.length === 0) return [];
    const result: Paragraph[] = [
      new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Attached Policy Annexures:", bold: true, size: 20 })] }),
    ];
    for (const key of data.policyAnnexures) {
      const policy = POLICY_ANNEXURES[key as PolicyAnnexureKey];
      if (policy) {
        result.push(bodyText(`  • ${policy.title}`));
      }
    }
    result.push(bodyText("The above policy documents are attached to this offer letter and form an integral part of your terms of employment."));
    return result;
  })();

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          headerParagraph,
          companyNameParagraph,

          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: `Date: ${data.offerDate}`, size: 20 })],
          }),
          new Paragraph({
            spacing: { after: 50 },
            children: [new TextRun({ text: "To:", size: 20 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: `${data.candidateTitle} ${data.candidateName}`, size: 20 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: data.candidateAddress, size: 20 })],
          }),

          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: `Subject: Offer of Employment, ${data.subjectDesignation || data.designation}`, bold: true, size: 22, underline: {} }),
            ],
          }),

          bodyText(`Dear ${data.candidateName}`),
          bodyText(
            `We are pleased to extend this formal offer of employment with Rayomind Solutions ("Company") for the position of ${data.designation}. The detailed terms and conditions are as follows:`
          ),

          heading("1. Position, Reporting & Start Date"),
          bodyText(`Designation: ${data.designation}`),
          ...(data.department ? [bodyText(`Department: ${data.department}`)] : []),
          bodyText(`Reporting To: ${data.reportingTo}`),
          bodyText(`Employment Type: ${data.employmentType}`),
          bodyText(`Proposed Start Date: ${data.proposedStartDate}`),

          heading("2. Probation Period, Leave Entitlement & Holiday Policy"),
          ...probationParagraphs,

          subHeading("2b. Leave Entitlements During the Probation Period"),
          bodyText(
            "No leave accrual (Earned Leave or Sick Leave) shall commence, and no employment benefits dependent on confirmed service shall be activated, during the probation period. All leave entitlements and accrual cycles described in sections 2c–2e below take effect exclusively upon the successful completion and formal confirmation of the probation period. Any leave taken during the probation period will be treated as Leave Without Pay unless otherwise approved in writing by HR."
          ),

          subHeading("2c. Earned Leave (EL)"),
          bodyText(
            "You are entitled to fifteen (15) days of Earned Leave per calendar year. EL accrues at the rate of 1.25 days per completed calendar month commencing from the first day of the month immediately following the successful completion and confirmation of your probation period; no EL accrues during the probation period. EL cannot be taken during probation. Unused EL up to the Company's defined carry-forward cap may be carried over to the following calendar year; any balance in excess of the cap will lapse on 31 December each year."
          ),

          subHeading("2d. Sick Leave (SL)"),
          bodyText(
            "You are entitled to eight (8) days of Sick Leave per calendar year, accruing at approximately 0.67 days per completed calendar month. Accrual commences upon successful completion and confirmation of the probation period; no SL accrues during the probation period. SL does not carry forward and any unused balance lapses at the end of each calendar year. A medical certificate from a registered medical practitioner may be required for any absence exceeding two (2) consecutive days."
          ),

          subHeading("2e. Emergency Leave"),
          bodyText(
            "You are entitled to three (3) days of Emergency Leave per calendar year. This is a flat grant — not accrual-based — and becomes available upon confirmation (i.e., after successful completion of probation). Emergency Leave does not carry forward and any unused balance lapses at the end of the calendar year. It is subject to prior manager approval except in genuine emergencies, in which case you must notify your reporting manager at the earliest opportunity."
          ),

          subHeading("2f. Leave Without Pay (LWP)"),
          bodyText(
            "Once all applicable leave balances (EL, SL, and Emergency Leave) have been exhausted, any further approved absence will be treated as Leave Without Pay. LWP days result in a proportional deduction from the monthly salary for the period of absence. LWP requires manager and HR approval and will be reflected in the payroll for the relevant month."
          ),

          subHeading("2g. Holiday Calendar"),
          bodyText(
            "HR will issue an annual holiday calendar at the commencement of each calendar year listing all declared national holidays and applicable state/regional holidays. Saturdays and Sundays, as well as all declared public holidays appearing on the Company's holiday calendar, are treated as non-working days and are therefore excluded from leave day counts. The holiday calendar may be updated during the year to reflect any Government notifications; employees will be informed of any changes promptly."
          ),

          heading("3. Place of Work & Jurisdiction"),
          bodyText(
            `This is a remote-first role. For legal, payroll, and compliance purposes, your base establishment shall be ${data.location} (India), and the ${data.jurisdiction} Shops & Establishments Act will apply. You are expected to work from your registered residence unless otherwise approved in writing.`
          ),

          heading("4. Work Hours & Schedule"),
          bodyText(
            "Your standard working hours are 8 hours per day, 5 days per week. Your working days, shift timing, and schedule are not fixed and will be aligned to the client/project you are assigned to and the prevailing business requirements. Specific shift details will be communicated to you and may be adjusted from time to time with reasonable notice."
          ),

          heading("5. Compensation & Structure"),
          ...compensationParagraphs,

          heading("6. Tools, Infrastructure & Reimbursements"),
          bodyText(
            "You will use a personal laptop and phone under the BYOD Addendum (Annexure‑R). The Company will provide access to VOIP, ATS, and licensed job portals."
          ),

          heading("7. Confidentiality, IP & Non‑Solicit"),
          bodyText(
            "You shall maintain strict confidentiality of Company information (including AI tools, prompts, datasets, client lists, business strategies, and candidate PII). All IP created during employment shall belong exclusively to the Company. A 12‑month non‑solicitation applies to employees and active clients/prospects you directly handle. No post‑employment non‑compete is imposed."
          ),

          heading("8. Code of Conduct, POSH & Data Protection"),
          bodyText(
            "Compliance with the Code of Conduct, POSH policy, and InfoSec/Acceptable Use policies is mandatory. MFA, VPN/SSO, approved apps, and no local storage of PII are required. Incident reporting within 24 hours applies."
          ),

          heading("9. Background Verification"),
          bodyText(
            "This offer is conditional on satisfactory background verification, reference checks, and document validation (education, experience, PAN/Aadhaar, etc.). Misrepresentation may lead to immediate termination."
          ),

          heading("10. Termination, Garden Leave & Exit"),
          bodyText(
            "Post‑confirmation, the Company may terminate your employment at any time, with immediate effect, without notice or payment in lieu of notice. Should you wish to resign, you must provide the Company with two (2) months' (60 days') prior written notice. The Company may, at its discretion, place you on garden leave during any notice period with full pay and restricted access. On exit, you must return/delete Company data and submit a Data Deletion Certificate; final dues shall be settled per law."
          ),

          heading("11. General"),
          bodyText(
            "This letter (with Annexures) constitutes the entire agreement and supersedes any prior discussions. Any amendment requires written approval by authorized signatories. Electronic signatures and counterparts are accepted."
          ),

          heading("12. Governing Law, Arbitration & Jurisdiction"),
          bodyText(
            `This letter is governed by the laws of India. Disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996 (seat: ${data.jurisdiction}) before a sole arbitrator. Subject to arbitration, courts at ${data.jurisdiction} shall have exclusive jurisdiction.`
          ),

          ...(policyAnnexureListParagraphs.length > 0 ? [
            heading("13. Policy Annexures"),
            ...policyAnnexureListParagraphs,
          ] : []),

          new Paragraph({ spacing: { before: 400 }, children: [] }),
          heading("Acceptance"),
          bodyText("Please sign the offer letter."),

          new Paragraph({ spacing: { before: 300 }, children: [] }),

          signatureTable,

          new Paragraph({ spacing: { before: 600 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Annexure‑R — Remote‑Work & BYOD Addendum", bold: true, size: 24, underline: {} }),
            ],
          }),

          bodyText("• Register personal devices; maintain OS/security updates, disk encryption, and anti‑malware."),
          bodyText("• Use only Company‑approved systems; no local storage of resumes/PII; printing prohibited without approval."),
          bodyText("• Enforce MFA; connect via VPN/SSO; personal Wi‑Fi must be WPA2/WPA3 secured."),
          bodyText("• Consent to limited telemetry of work data/containers; Company may remotely wipe Company data on exit/incidents."),
          bodyText("• Report device loss/breach within 24 hours; cooperate with investigation and remediation."),

          // User-supplied custom annexures (performance KPI tables etc.)
          ...buildAnnexureChildren(data.annexures),

          // Policy annexures (Leave Policy, Attendance, Code of Conduct, NDA)
          ...buildPolicyAnnexureChildren(data.policyAnnexures, data.annexureInitials),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}
