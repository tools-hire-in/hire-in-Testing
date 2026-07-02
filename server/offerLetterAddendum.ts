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
} from "docx";
import { POLICY_ANNEXURES, ENGINEERING_ANNEXURE_KEYS, type PolicyAnnexureKey } from "./annexureContent";

export interface DeviceItem {
  description: string;
  serialNumber?: string;
  assetTag?: string;
  condition?: string;
}

export interface AnnexureTable {
  col1Header: string;
  col2Header: string;
  rows: [string, string][];
}

export interface AnnexureItem {
  title: string;
  body: string;
  table?: AnnexureTable;
}

export interface AddendumData {
  candidateName: string;
  originalOfferDate: string;
  originalDesignation: string;
  effectiveDate: string;
  hrManagerName: string;
  addendumType: "salary_revision" | "role_change" | "probation_extension" | "combined" | "custom" | "device_allocation";

  oldDesignation?: string;
  newDesignation?: string;
  oldDepartment?: string;
  newDepartment?: string;
  oldSalary?: string;
  newSalary?: string;
  oldSalaryInWords?: string;
  newSalaryInWords?: string;
  oldConfirmationDate?: string;
  newConfirmationDate?: string;
  customClauseTitle?: string;
  customClauseText?: string;
  deviceItems?: DeviceItem[];
  reason?: string;
  annexures?: AnnexureItem[];
  growthPlanClauseText?: string;
  policyAnnexures?: string[];
  annexureInitials?: Record<string, string>;
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22 })],
  });
}

function bodyText(text: string, options?: { bold?: boolean }): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 20, bold: options?.bold })],
  });
}

function noBorderCell(children: Paragraph[]) {
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

function borderedCell(children: Paragraph[], header = false) {
  return new TableCell({
    shading: header ? { fill: "F3F4F6" } : undefined,
    children,
  });
}

function changesTable(rows: Array<{ label: string; oldValue: string; newValue: string }>): Table {
  const headerRow = new TableRow({
    children: [
      borderedCell([new Paragraph({ children: [new TextRun({ text: "Field", bold: true, size: 20 })] })], true),
      borderedCell([new Paragraph({ children: [new TextRun({ text: "Previous Value", bold: true, size: 20 })] })], true),
      borderedCell([new Paragraph({ children: [new TextRun({ text: "New Value", bold: true, size: 20 })] })], true),
    ],
  });

  const dataRows = rows.map(row => new TableRow({
    children: [
      borderedCell([new Paragraph({ children: [new TextRun({ text: row.label, size: 20, bold: true })] })]),
      borderedCell([new Paragraph({ children: [new TextRun({ text: row.oldValue, size: 20 })] })]),
      borderedCell([new Paragraph({ children: [new TextRun({ text: row.newValue, size: 20 })] })]),
    ],
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

const ADDENDUM_TYPE_LABELS: Record<string, string> = {
  salary_revision: "Salary Revision",
  role_change: "Role / Title Change",
  probation_extension: "Probation Extension",
  combined: "Combined Role & Salary Change",
  custom: "Custom Amendment",
  device_allocation: "Company Device & Asset Allocation",
};

export async function generateAddendumDocx(data: AddendumData): Promise<Buffer> {
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
    // logo not found, skip
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

  const typeLabel = ADDENDUM_TYPE_LABELS[data.addendumType] || "Amendment";

  // Opening paragraph
  const openingText = `This Addendum to the Offer Letter dated ${data.originalOfferDate} issued to ${data.candidateName} for the position of ${data.originalDesignation} is effective ${data.effectiveDate}.`;

  // Build changed-terms content
  const changedTermsRows: Array<{ label: string; oldValue: string; newValue: string }> = [];
  const bodyParagraphs: (Paragraph | Table)[] = [];

  bodyParagraphs.push(heading("1. Amended Terms"));

  if (data.addendumType === "salary_revision" || data.addendumType === "combined") {
    changedTermsRows.push({
      label: "Annual CTC",
      oldValue: data.oldSalary ? `${data.oldSalary}${data.oldSalaryInWords ? ` (${data.oldSalaryInWords})` : ""}` : "—",
      newValue: data.newSalary ? `${data.newSalary}${data.newSalaryInWords ? ` (${data.newSalaryInWords})` : ""}` : "—",
    });
  }

  if (data.addendumType === "role_change" || data.addendumType === "combined") {
    if (data.oldDesignation || data.newDesignation) {
      changedTermsRows.push({
        label: "Designation / Title",
        oldValue: data.oldDesignation || "—",
        newValue: data.newDesignation || "—",
      });
    }
    if (data.oldDepartment || data.newDepartment) {
      changedTermsRows.push({
        label: "Department",
        oldValue: data.oldDepartment || "—",
        newValue: data.newDepartment || "—",
      });
    }
  }

  if (data.addendumType === "probation_extension") {
    changedTermsRows.push({
      label: "Confirmation Date",
      oldValue: data.oldConfirmationDate || "—",
      newValue: data.newConfirmationDate || "—",
    });
  }

  if (changedTermsRows.length > 0) {
    bodyParagraphs.push(changesTable(changedTermsRows));
    bodyParagraphs.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
  }

  if (data.addendumType === "custom" && data.customClauseTitle) {
    bodyParagraphs.push(heading(data.customClauseTitle));
    if (data.customClauseText) {
      bodyParagraphs.push(bodyText(data.customClauseText));
    }
  }

  if (data.addendumType === "device_allocation" && data.deviceItems && data.deviceItems.length > 0) {
    const deviceHeaderRow = new TableRow({
      children: [
        borderedCell([new Paragraph({ children: [new TextRun({ text: "S.No", bold: true, size: 20 })] })], true),
        borderedCell([new Paragraph({ children: [new TextRun({ text: "Description / Item", bold: true, size: 20 })] })], true),
        borderedCell([new Paragraph({ children: [new TextRun({ text: "Asset Tag / Serial #", bold: true, size: 20 })] })], true),
        borderedCell([new Paragraph({ children: [new TextRun({ text: "Condition", bold: true, size: 20 })] })], true),
      ],
    });

    const deviceDataRows = data.deviceItems.map((item, idx) =>
      new TableRow({
        children: [
          borderedCell([new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 20 })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: item.description || "—", size: 20 })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: [item.assetTag, item.serialNumber].filter(Boolean).join(" / ") || "—", size: 20 })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: item.condition || "—", size: 20 })] })]),
        ],
      })
    );

    const deviceTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [deviceHeaderRow, ...deviceDataRows],
    });

    bodyParagraphs.push(deviceTable);
    bodyParagraphs.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

    bodyParagraphs.push(heading("2. Conditions of Use"));
    bodyParagraphs.push(bodyText(
      `The above devices and assets are the sole property of Rayomind Solutions LLP / Hire'in Solutions and are provided exclusively for work purposes on behalf of Rayomind Solutions LLP and Hire'in Solutions. The employee agrees to the following conditions:`
    ));
    bodyParagraphs.push(bodyText("• Devices must be used solely for company-authorised work activities. Personal use is prohibited unless expressly approved in writing."));
    bodyParagraphs.push(bodyText("• The employee is responsible for the safe custody and maintenance of all devices listed above."));
    bodyParagraphs.push(bodyText("• Loss, damage, or theft must be reported to the IT / HR team within 24 hours."));
    bodyParagraphs.push(bodyText("• All company data stored on or accessed via the above devices remains the exclusive intellectual property of Rayomind Solutions LLP / Hire'in Solutions."));
    bodyParagraphs.push(bodyText("• Upon resignation, termination, or contract end, all listed devices must be returned in good working condition within 3 working days. Failure to return may result in cost recovery from final settlement."));
    bodyParagraphs.push(bodyText("• The company reserves the right to remotely wipe company data and disable access to company systems on these devices at any time."));
  }

  // Dynamic section counter — section 1 is always "Amended Terms".
  // device_allocation already pushes heading("2. Conditions of Use") above, so start at 3.
  let nextSectionNum = data.addendumType === "device_allocation" ? 3 : 2;

  if (data.reason) {
    bodyParagraphs.push(heading(`${nextSectionNum}. Reason / Remarks`));
    bodyParagraphs.push(bodyText(data.reason));
    nextSectionNum++;
  }

  if (data.growthPlanClauseText && data.growthPlanClauseText.trim()) {
    bodyParagraphs.push(heading(`${nextSectionNum}. 90-Day Growth Plan Review & Salary Revision Eligibility`));
    for (const line of data.growthPlanClauseText.split(/\r?\n/)) {
      if (line.trim() === "") {
        bodyParagraphs.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
      } else {
        bodyParagraphs.push(bodyText(line));
      }
    }
    nextSectionNum++;
  }

  // Policy annexures (engineering pack + general policy annexures)
  const policyAnnexureChildren: (Paragraph | Table)[] = [];
  if (data.policyAnnexures && data.policyAnnexures.length > 0) {
    for (const key of data.policyAnnexures) {
      const policy = POLICY_ANNEXURES[key as PolicyAnnexureKey];
      if (!policy) continue;
      policyAnnexureChildren.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      policyAnnexureChildren.push(new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: policy.title, bold: true, size: 26, underline: {} })],
      }));
      const initials = data.annexureInitials?.[key]?.trim();
      if (initials) {
        policyAnnexureChildren.push(new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: `Reviewed & acknowledged — Initials: ${initials}`, italics: true, size: 18 })],
        }));
      }
      const lines = policy.body.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim() === "") {
          policyAnnexureChildren.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        } else {
          policyAnnexureChildren.push(new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: line, size: 20 })],
          }));
        }
      }
      if (ENGINEERING_ANNEXURE_KEYS.includes(key)) {
        policyAnnexureChildren.push(new Paragraph({
          spacing: { before: 300, after: 100 },
          children: [new TextRun({ text: "Execution / Signature Block", bold: true, size: 20 })],
        }));
        policyAnnexureChildren.push(new Table({
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
        }));
        policyAnnexureChildren.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      }
    }
  }

  // Annexure sections (appended after signature via extra section children)
  const annexureChildren: (Paragraph | Table)[] = [];
  if (data.annexures && data.annexures.length > 0) {
    const LABELS = ["A", "B", "C", "D", "E"];
    for (let i = 0; i < data.annexures.length; i++) {
      const ann = data.annexures[i];
      const label = LABELS[i] || String(i + 1);
      // Page break before each annexure
      annexureChildren.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      annexureChildren.push(new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: `Annexure ${label}: ${ann.title}`, bold: true, size: 26, underline: {} })],
      }));
      // Split body on newlines and emit each line as a paragraph
      if (ann.body) {
        const lines = ann.body.split(/\r?\n/);
        for (const line of lines) {
          annexureChildren.push(new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: line, size: 20 })],
          }));
        }
      }
      // Optional two-column table
      if (ann.table) {
        const { col1Header, col2Header, rows } = ann.table;
        annexureChildren.push(new Paragraph({ spacing: { before: 160, after: 80 }, children: [] }));
        const headerRow = new TableRow({
          children: [
            borderedCell([new Paragraph({ children: [new TextRun({ text: col1Header || "Column 1", bold: true, size: 20 })] })], true),
            borderedCell([new Paragraph({ children: [new TextRun({ text: col2Header || "Column 2", bold: true, size: 20 })] })], true),
          ],
        });
        const dataRows = rows.map(([c1, c2]) =>
          new TableRow({
            children: [
              borderedCell([new Paragraph({ children: [new TextRun({ text: c1, size: 20 })] })]),
              borderedCell([new Paragraph({ children: [new TextRun({ text: c2, size: 20 })] })]),
            ],
          })
        );
        annexureChildren.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        }));
        annexureChildren.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      }
    }
  }

  // Signature block
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
            new Paragraph({ children: [new TextRun({ text: "For Rayomind Solutions", bold: true, size: 20 })] }),
            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: `Name: ${data.hrManagerName}`, size: 20 })] }),
            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Title: HR Manager", size: 20 })] }),
            new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "Signature: _______________________", size: 20 })] }),
            new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Date: ____________________________", size: 20 })] }),
          ]),
          noBorderCell([
            new Paragraph({ children: [new TextRun({ text: "Accepted & Agreed by Employee", bold: true, size: 20 })] }),
            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: `Name: ${data.candidateName}`, size: 20 })] }),
            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: " ", size: 20 })] }),
            new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "Signature: _______________________", size: 20 })] }),
            new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Date: ____________________________", size: 20 })] }),
          ]),
        ],
      }),
    ],
  });

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
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: `ADDENDUM TO OFFER LETTER — ${typeLabel.toUpperCase()}`, bold: true, size: 26, underline: {} }),
            ],
          }),

          bodyText(openingText),

          new Paragraph({ spacing: { after: 100 }, children: [] }),

          ...bodyParagraphs,

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          heading(`${nextSectionNum}. Continuity of Other Terms`),
          bodyText(
            "All other terms and conditions of the original Offer Letter (and any prior addendums) remain in full force and effect. This Addendum constitutes a binding amendment to the original Offer Letter and supersedes any prior oral or written representations regarding the specific terms amended herein."
          ),

          new Paragraph({ spacing: { before: 400 }, children: [] }),
          heading("Acceptance"),
          bodyText("By signing below, both parties acknowledge receipt and acceptance of this Addendum."),

          new Paragraph({ spacing: { before: 300 }, children: [] }),

          signatureTable,

          ...annexureChildren,
          ...policyAnnexureChildren,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}

export async function generateClauseDocx(title: string, clauseText: string): Promise<Buffer> {
  const children: Paragraph[] = [];
  children.push(new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text: title, bold: true, size: 28 })],
  }));
  for (const line of (clauseText || "").split(/\r?\n/)) {
    if (line.trim() === "") {
      children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    } else {
      children.push(new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: line, size: 22 })],
      }));
    }
  }
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}
