import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import type { HrLetter } from "@shared/schema";

const DANCING_SCRIPT_PATH = path.resolve("server/fonts/DancingScript.ttf");
const hasCursiveFont = fs.existsSync(DANCING_SCRIPT_PATH);
import {
  PERFORMANCE_BAND_SENTENCES as DEFAULT_PERFORMANCE_SENTENCES,
  CONDUCT_BAND_SENTENCES as DEFAULT_CONDUCT_SENTENCES,
  COMPLETION_BAND_SENTENCES as DEFAULT_COMPLETION_PHRASES,
  CLOSING_LINE_SENTENCES as DEFAULT_CLOSING_SENTENCES,
} from "@shared/hrLetterConstants";

export interface HrLetterSentences {
  performance_band?: Record<string, string>;
  conduct_band?: Record<string, string>;
  completion_band?: Record<string, string>;
  closing_line?: Record<string, string>;
}

const TEMPLATE_TITLES: Record<string, string> = {
  experience: "EXPERIENCE LETTER",
  internship_completion: "INTERNSHIP COMPLETION LETTER",
  internship_certificate: "INTERNSHIP CERTIFICATE",
  relieving: "RELIEVING LETTER",
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function interpolate(sentence: string, letter: HrLetter): string {
  return sentence
    .replace(/\[Name\]/g, letter.employeeName)
    .replace(/\[Company\]/g, "Rayomind Solutions LLP")
    .replace(/\[Role\]/g, letter.designation)
    .replace(/\[Department\]/g, letter.department || "the assigned");
}

export async function generateHrLetterPdf(letter: HrLetter, customSentences?: HrLetterSentences): Promise<Buffer> {
  const PERFORMANCE_SENTENCES = { ...DEFAULT_PERFORMANCE_SENTENCES, ...(customSentences?.performance_band || {}) };
  const CONDUCT_SENTENCES = { ...DEFAULT_CONDUCT_SENTENCES, ...(customSentences?.conduct_band || {}) };
  const COMPLETION_PHRASES = { ...DEFAULT_COMPLETION_PHRASES, ...(customSentences?.completion_band || {}) };
  const CLOSING_SENTENCES = { ...DEFAULT_CLOSING_SENTENCES, ...(customSentences?.closing_line || {}) };
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
    const refText = letter.referenceNumber ? `Ref: ${letter.referenceNumber}` : "Draft";
    const dateText = `Date: ${formatDate(letter.issueDate)}`;
    doc.text(refText, doc.page.margins.left, y);
    doc.text(dateText, doc.page.margins.left, y, { align: "right", width: pageWidth });
    y += 30;

    const title = TEMPLATE_TITLES[letter.templateType] || "HR LETTER";
    doc.fontSize(16).font("Helvetica-Bold").fillColor(textColor);
    doc.text(title, doc.page.margins.left, y, { align: "center", width: pageWidth, underline: true });
    y += 35;

    doc.fontSize(11).font("Helvetica").fillColor(textColor);

    function addParagraph(text: string, opts?: { bold?: boolean; spacing?: number }) {
      if (opts?.bold) doc.font("Helvetica-Bold");
      else doc.font("Helvetica");
      doc.text(text, doc.page.margins.left, y, { width: pageWidth, lineGap: 4 });
      y = doc.y + (opts?.spacing || 12);
    }

    addParagraph("To Whom It May Concern,", { spacing: 20 });

    if (letter.templateType === "experience") {
      addParagraph(
        `This is to certify that ${letter.employeeName}${letter.employeeCode ? ` (Employee ID: ${letter.employeeCode})` : ""} was employed with Rayomind Solutions LLP as ${letter.designation}${letter.department ? ` in the ${letter.department} department` : ""} from ${formatDate(letter.startDate)} to ${formatDate(letter.endDate)}.`
      );
      if (letter.performanceBand && PERFORMANCE_SENTENCES[letter.performanceBand]) {
        addParagraph(interpolate(PERFORMANCE_SENTENCES[letter.performanceBand], letter));
      }
      if (letter.conductBand && CONDUCT_SENTENCES[letter.conductBand]) {
        addParagraph(CONDUCT_SENTENCES[letter.conductBand]);
      }
    } else if (letter.templateType === "internship_completion") {
      const completionPhrase = letter.completionBand ? COMPLETION_PHRASES[letter.completionBand] || "completed" : "completed";
      addParagraph(
        `This is to certify that ${letter.employeeName}${letter.employeeCode ? ` (Intern ID: ${letter.employeeCode})` : ""} has ${completionPhrase} an internship with Rayomind Solutions LLP${letter.department ? ` in the ${letter.department} department` : ""} from ${formatDate(letter.startDate)} to ${formatDate(letter.endDate)}.`
      );
      if (letter.includeProject && letter.projectName) {
        addParagraph(`During the internship, the intern worked on the project: ${letter.projectName}.`);
      }
      if (letter.performanceBand && PERFORMANCE_SENTENCES[letter.performanceBand]) {
        addParagraph(interpolate(PERFORMANCE_SENTENCES[letter.performanceBand], letter));
      }
      addParagraph("This letter is issued for academic/employment/record purposes.");
    } else if (letter.templateType === "internship_certificate") {
      const completionPhrase = letter.completionBand ? COMPLETION_PHRASES[letter.completionBand] || "completed" : "completed";
      addParagraph(
        `This is to certify that ${letter.employeeName} has ${completionPhrase} an internship with Rayomind Solutions LLP${letter.department ? ` in the ${letter.department} department` : ""} as ${letter.designation} from ${formatDate(letter.startDate)} to ${formatDate(letter.endDate)}.`
      );
    } else if (letter.templateType === "relieving") {
      addParagraph(
        `This is to confirm that ${letter.employeeName}${letter.employeeCode ? ` (Employee ID: ${letter.employeeCode})` : ""} was employed with Rayomind Solutions LLP as ${letter.designation}${letter.department ? ` in the ${letter.department} department` : ""} from ${formatDate(letter.startDate)}.`
      );
      addParagraph(
        `The resignation submitted has been accepted and ${letter.employeeName} has duly served the notice period and has been relieved from duties effective ${formatDate(letter.lastWorkingDay || letter.endDate)}.`
      );
      addParagraph("All company dues have been settled and all company property has been returned.");
      addParagraph(`The company has no objection to ${letter.employeeName} seeking employment elsewhere.`);
      addParagraph("This letter is issued at the request of the employee for record and employment/background verification purposes.");
    }

    if (letter.includeResponsibilities && letter.responsibilitiesSummary) {
      addParagraph(letter.responsibilitiesSummary);
    }

    if (letter.customOverrideText) {
      addParagraph(letter.customOverrideText);
    }

    if (letter.closingLine && CLOSING_SENTENCES[letter.closingLine]) {
      y += 10;
      addParagraph(CLOSING_SENTENCES[letter.closingLine]);
    }

    y += 30;
    const sigX = doc.page.margins.left;
    const sealX = doc.page.margins.left + pageWidth - 100;

    doc.font("Helvetica-Bold").fontSize(11).fillColor(textColor);
    doc.text("For Rayomind Solutions LLP", sigX, y, { width: pageWidth - 120 });
    y += 10;

    if (hasCursiveFont) {
      doc.font("DancingScript").fontSize(32).fillColor("#1a1a2e");
      doc.text(letter.signatoryName || "Authorized Signatory", sigX, y, { width: 220 });
      y += 36;
    } else {
      y += 30;
    }

    doc.moveTo(sigX, y).lineTo(sigX + 180, y).lineWidth(0.5).strokeColor("#999999").stroke();
    y += 6;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(textColor);
    doc.text(letter.signatoryName || "Authorized Signatory", sigX, y);
    y += 14;
    doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
    doc.text(letter.signatoryDesignation || "Authorized Signatory", sigX, y);

    if (letter.includeSeal) {
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

    if (letter.referenceNumber && letter.authCode) {
      doc.font("Courier").fontSize(7).fillColor("#666666");
      doc.text(`Ref: ${letter.referenceNumber}`, doc.page.margins.left + pageWidth * 0.55, y, { width: pageWidth * 0.45, align: "right" });
      y += 10;
      doc.text(`Auth: ${letter.authCode}`, doc.page.margins.left + pageWidth * 0.55, y, { width: pageWidth * 0.45, align: "right" });
      y += 12;
      doc.fontSize(7).font("Helvetica-Oblique").fillColor("#AAAAAA");
      doc.text("Verify authenticity at hire-in.com/verify using the reference and auth code above", doc.page.margins.left, y, { align: "center", width: pageWidth });
    } else {
      y += 10;
      doc.fontSize(7).font("Helvetica-Oblique").fillColor("#AAAAAA");
      doc.text("Draft — cryptographic verification will be assigned upon issuance", doc.page.margins.left, y, { align: "center", width: pageWidth });
    }

    doc.end();
  });
}
