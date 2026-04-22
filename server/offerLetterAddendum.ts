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

export interface AddendumData {
  candidateName: string;
  originalOfferDate: string;
  originalDesignation: string;
  effectiveDate: string;
  hrManagerName: string;
  addendumType: "salary_revision" | "role_change" | "probation_extension" | "combined" | "custom";

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
  reason?: string;
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

  if (data.reason) {
    bodyParagraphs.push(heading("2. Reason / Remarks"));
    bodyParagraphs.push(bodyText(data.reason));
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
          heading("3. Continuity of Other Terms"),
          bodyText(
            "All other terms and conditions of the original Offer Letter (and any prior addendums) remain in full force and effect. This Addendum constitutes a binding amendment to the original Offer Letter and supersedes any prior oral or written representations regarding the specific terms amended herein."
          ),

          new Paragraph({ spacing: { before: 400 }, children: [] }),
          heading("Acceptance"),
          bodyText("By signing below, both parties acknowledge receipt and acceptance of this Addendum."),

          new Paragraph({ spacing: { before: 300 }, children: [] }),

          signatureTable,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}
