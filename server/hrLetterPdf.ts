import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import type { HrLetter } from "@shared/schema";
import type { AnnexureItem } from "./offerLetterAddendum";
import { renderLetter, flattenPara, type LetterRenderData } from "@shared/letterRenderer";

const DANCING_SCRIPT_PATH = path.resolve("server/fonts/DancingScript.ttf");
const hasCursiveFont = fs.existsSync(DANCING_SCRIPT_PATH);

export interface HrLetterSentences {
  performance_band?: Record<string, string>;
  conduct_band?: Record<string, string>;
  completion_band?: Record<string, string>;
  closing_line?: Record<string, string>;
}

export async function generateHrLetterPdf(letter: HrLetter, customSentences?: HrLetterSentences): Promise<Buffer> {
  const renderData: LetterRenderData = {
    templateType: letter.templateType,
    employeeName: letter.employeeName,
    employeeCode: letter.employeeCode,
    designation: letter.designation,
    department: letter.department,
    startDate: letter.startDate,
    endDate: letter.endDate,
    lastWorkingDay: letter.lastWorkingDay,
    performanceBand: letter.performanceBand,
    conductBand: letter.conductBand,
    completionBand: letter.completionBand,
    closingLine: letter.closingLine,
    includeResponsibilities: letter.includeResponsibilities,
    responsibilitiesSummary: letter.responsibilitiesSummary,
    includeProject: letter.includeProject,
    projectName: letter.projectName,
    customOverrideText: letter.customOverrideText,
    signatoryName: letter.signatoryName,
    signatoryDesignation: letter.signatoryDesignation,
    issueDate: letter.issueDate,
    referenceNumber: letter.referenceNumber,
    authCode: letter.authCode,
    includeSeal: letter.includeSeal,
    sentencesOverride: customSentences ? {
      performance_band: customSentences.performance_band,
      conduct_band: customSentences.conduct_band,
      completion_band: customSentences.completion_band,
      closing_line: customSentences.closing_line,
    } : undefined,
  };

  const rendered = renderLetter(renderData);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const orangeColor = "#F96D3E";
    const textColor = "#1a1a1a";
    const mutedColor = "#666666";

    if (hasCursiveFont) {
      doc.registerFont("DancingScript", DANCING_SCRIPT_PATH);
    }

    const logoPath = path.resolve("client/public/rayomind-logo.png");
    let hasLogo = false;
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, doc.page.margins.left + pageWidth / 2 - 70, 50, { width: 140 });
        hasLogo = true;
      }
    } catch {}

    let y = hasLogo ? 110 : 60;

    doc.fontSize(14).font("Helvetica-Bold").fillColor(textColor);
    doc.text("Rayomind Solutions LLP", doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 20;

    doc.fontSize(8).font("Helvetica").fillColor(mutedColor);
    doc.text("Suite No-101, Pocket-6, Sector-2, Rohini, New Delhi – 110085, India", doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 20;

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).lineWidth(3).strokeColor(orangeColor).stroke();
    y += 20;

    doc.fontSize(9).font("Helvetica").fillColor(mutedColor);
    doc.text(rendered.refText, doc.page.margins.left, y);
    doc.text(rendered.dateText, doc.page.margins.left, y, { align: "right", width: pageWidth });
    y += 30;

    doc.fontSize(16).font("Helvetica-Bold").fillColor(textColor);
    doc.text(rendered.title, doc.page.margins.left, y, { align: "center", width: pageWidth, underline: true });
    y += 35;

    doc.fontSize(11).font("Helvetica").fillColor(textColor);

    function addParagraph(text: string, opts?: { bold?: boolean; spacing?: number }) {
      if (opts?.bold) doc.font("Helvetica-Bold");
      else doc.font("Helvetica");
      doc.text(text, doc.page.margins.left, y, { width: pageWidth, lineGap: 4 });
      y = doc.y + (opts?.spacing || 12);
    }

    addParagraph(rendered.greeting, { spacing: 20 });

    for (const para of rendered.body) {
      addParagraph(flattenPara(para));
    }

    y += 30;
    const sigX = doc.page.margins.left;
    const sealX = doc.page.margins.left + pageWidth - 100;

    doc.font("Helvetica-Bold").fontSize(11).fillColor(textColor);
    doc.text("For Rayomind Solutions LLP", sigX, y, { width: pageWidth - 120 });
    y += 10;

    if (hasCursiveFont) {
      doc.font("DancingScript").fontSize(32).fillColor("#1a1a2e");
      doc.text(rendered.signatoryName, sigX, y, { width: 220 });
      y += 36;
    } else {
      y += 30;
    }

    doc.moveTo(sigX, y).lineTo(sigX + 180, y).lineWidth(0.5).strokeColor("#999999").stroke();
    y += 6;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(textColor);
    doc.text(rendered.signatoryName, sigX, y);
    y += 14;
    doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
    doc.text(rendered.signatoryDesignation, sigX, y);

    if (rendered.includeSeal) {
      const sealY = y - 50;
      const cx = sealX + 40;
      const cy = sealY + 40;
      doc.save();
      doc.circle(cx, cy, 38).lineWidth(2).strokeColor(orangeColor).stroke();
      doc.circle(cx, cy, 33).lineWidth(0.75).strokeColor(orangeColor).stroke();
      doc.fontSize(9).font("Helvetica-Bold").fillColor(orangeColor);
      doc.text("RAYOMIND", cx - 28, cy - 14, { width: 56, align: "center" });
      doc.moveTo(cx - 18, cy).lineTo(cx + 18, cy).lineWidth(0.5).strokeColor(orangeColor).stroke();
      doc.fontSize(6).font("Helvetica").fillColor(orangeColor);
      doc.text("SOLUTIONS LLP", cx - 28, cy + 5, { width: 56, align: "center" });
      doc.restore();
    }

    y += 40;

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).lineWidth(2).strokeColor(orangeColor).stroke();
    y += 8;

    doc.fontSize(7).font("Helvetica").fillColor("#999999");
    doc.text("Digitally Generated Document — No physical signature required", doc.page.margins.left, y, { width: pageWidth * 0.5 });

    if (rendered.referenceNumber && rendered.authCode) {
      doc.font("Courier").fontSize(7).fillColor("#666666");
      doc.text(`Ref: ${rendered.referenceNumber}`, doc.page.margins.left + pageWidth * 0.55, y, { width: pageWidth * 0.45, align: "right" });
      y += 10;
      doc.text(`Auth: ${rendered.authCode}`, doc.page.margins.left + pageWidth * 0.55, y, { width: pageWidth * 0.45, align: "right" });
      y += 12;
      doc.fontSize(7).font("Helvetica-Oblique").fillColor("#AAAAAA");
      doc.text("Verify authenticity at hire-in.com/verify using the reference and auth code above", doc.page.margins.left, y, { align: "center", width: pageWidth });
    } else {
      y += 10;
      doc.fontSize(7).font("Helvetica-Oblique").fillColor("#AAAAAA");
      doc.text("Draft — cryptographic verification will be assigned upon issuance", doc.page.margins.left, y, { align: "center", width: pageWidth });
    }

    const annexures = (letter as any).annexureData;
    if (Array.isArray(annexures) && annexures.length > 0) {
      const LABELS = ["A", "B", "C", "D", "E"];
      for (let i = 0; i < annexures.length; i++) {
        const ann = annexures[i] as AnnexureItem;
        if (!ann?.title && !ann?.body) continue;
        const label = LABELS[i] || String(i + 1);

        doc.addPage();
        const pw = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        let ay = doc.page.margins.top;

        doc.fontSize(14).font("Helvetica-Bold").fillColor(textColor);
        doc.text(`Annexure ${label}: ${ann.title}`, doc.page.margins.left, ay, { width: pw });
        ay = doc.y + 16;

        doc.moveTo(doc.page.margins.left, ay).lineTo(doc.page.margins.left + pw, ay).lineWidth(1).strokeColor(orangeColor).stroke();
        ay += 12;

        doc.fontSize(11).font("Helvetica").fillColor(textColor);
        const lines = (ann.body || "").split(/\r?\n/);
        for (const line of lines) {
          doc.text(line || " ", doc.page.margins.left, ay, { width: pw, lineGap: 4 });
          ay = doc.y + 6;
        }
      }
    }

    doc.end();
  });
}
