import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  TabStopPosition,
  TabStopType,
} from "docx";

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
  hrManagerName: string;
  offerDate: string;
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

function signatureLine(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ text: `${label}: _____________________________`, size: 20 })],
  });
}

export async function generateOfferLetterDocx(data: OfferLetterData): Promise<Buffer> {
  const salaryStr = `₹${data.salary.toLocaleString("en-IN")} (${data.salaryInWords}) monthly`;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Hire'in Solutions", bold: true, size: 36, font: "Calibri" }),
            ],
          }),

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
          bodyText(`Reporting To: ${data.reportingTo}`),
          bodyText(`Employment Type: ${data.employmentType}`),
          bodyText(`Proposed Start Date: ${data.proposedStartDate}`),

          heading("3. Place of Work & Jurisdiction"),
          bodyText(
            `This is a remote-first role. For legal, payroll, and compliance purposes, your base establishment shall be ${data.location} (India), and the ${data.jurisdiction} Shops & Establishments Act will apply. You are expected to work from your registered residence unless otherwise approved in writing.`
          ),

          heading("4. Work Hours & Schedule"),
          bodyText(
            "You will operate primarily in alignment with U.S. time zones to oversee the U.S. Healthcare Recruitment vertical. Standard working hours shall not exceed 9 hours/day or 48 hours/week. Business exigencies may require flexibility in schedule or availability."
          ),

          heading("5. Compensation & Structure"),
          bodyText(
            `Your Annual Cost to Company (CTC) will be ${salaryStr}.`
          ),
          bodyText("Note: Salary will be credited by the 10th of the following month."),

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
            "Post‑confirmation, either party may terminate with 60 days' written notice or salary in lieu. The Company may terminate for cause with immediate effect. During notice, the Company may place you on garden leave with full pay and restricted access. On exit, you must return/delete Company data and submit a Data Deletion Certificate; final dues shall be settled per law."
          ),

          heading("11. General"),
          bodyText(
            "This letter (with Annexures) constitutes the entire agreement and supersedes any prior discussions. Any amendment requires written approval by authorized signatories. Electronic signatures and counterparts are accepted."
          ),

          heading("12. Governing Law, Arbitration & Jurisdiction"),
          bodyText(
            `This letter is governed by the laws of India. Disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996 (seat: ${data.jurisdiction}) before a sole arbitrator. Subject to arbitration, courts at ${data.jurisdiction} shall have exclusive jurisdiction.`
          ),

          new Paragraph({ spacing: { before: 400 }, children: [] }),
          heading("Acceptance"),
          bodyText("Please sign the offer letter."),

          new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun({ text: "For Hire'in Solutions", bold: true, size: 20 })],
          }),
          bodyText(`Name: ${data.hrManagerName}`),
          bodyText("Title: HR Manager"),
          signatureLine("Signature"),
          signatureLine("Date"),

          new Paragraph({ spacing: { before: 300 }, children: [] }),
          new Paragraph({
            children: [new TextRun({ text: "Accepted & Agreed by Employee", bold: true, size: 20 })],
          }),
          bodyText(`Name: ${data.candidateTitle} ${data.candidateName}`),
          signatureLine("Signature"),
          signatureLine("Date"),

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
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}
