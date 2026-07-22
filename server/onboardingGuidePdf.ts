/**
 * Onboarding Guide PDF Generator
 * ---------------------------------------------------------------------------
 * Generates a downloadable PDF from onboarding step data using pdfkit.
 * Mirrors the source doc structure: one section per step with all fields.
 * HIGH RISK steps get a visible banner.
 */

import PDFDocument from "pdfkit";

interface KnowledgeCheckItem {
  question: string;
  answer: string;
}

interface OnboardingStepForPdf {
  stepNumber: number;
  title: string;
  isHighRisk?: boolean | null;
  purpose?: string | null;
  whereToFind?: string | null;
  navRoute?: string | null;
  howToUse?: string | null;
  importantRules?: string[] | null;
  commonMistake?: string | null;
  scenario?: string | null;
  practicalExercise?: string | null;
  knowledgeCheck?: KnowledgeCheckItem[] | null;
  whereToGetHelp?: string | null;
}

const BRAND_NAVY = "#1F3A6E";
const BRAND_ORANGE = "#F47C20";
const HIGH_RISK_RED = "#DC2626";

const TRACK_LABELS: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR Administrator",
  executive: "Executive / Finance",
  admin: "Administrator",
};

function trackDisplayName(track: string): string {
  return TRACK_LABELS[track] ?? track.charAt(0).toUpperCase() + track.slice(1);
}

/**
 * Strip markdown syntax for plain PDF text.
 * Handles: **bold**, *italic*, `code`, | table separators, leading #/## headings.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^\|.+\|$/gm, (line) =>
      line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
        .join("  |  "),
    )
    .replace(/^[-]{3,}$/gm, "")
    .trim();
}

/**
 * Render a labelled section block.
 */
function renderSection(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  content: string,
  opts: { color?: string } = {},
) {
  doc
    .fontSize(9)
    .fillColor(opts.color ?? "#6B7280")
    .font("Helvetica-Bold")
    .text(label.toUpperCase(), { continued: false });

  doc
    .moveDown(0.2)
    .fontSize(10)
    .fillColor("#111827")
    .font("Helvetica")
    .text(stripMarkdown(content), { lineGap: 2 });

  doc.moveDown(0.7);
}

export async function generateOnboardingGuidePdf(
  steps: OnboardingStepForPdf[],
  track: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      info: {
        Title: `${trackDisplayName(track)} Onboarding Guide`,
        Author: "Hire'in Solutions",
        Subject: "Onboarding Reference Guide",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ── Cover page ────────────────────────────────────────────────────────────
    doc
      .rect(0, 0, doc.page.width, 180)
      .fill(BRAND_NAVY);

    doc
      .fillColor("#FFFFFF")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Hire'in Solutions", doc.page.margins.left, 55, { width: pageWidth });

    doc
      .fontSize(14)
      .font("Helvetica")
      .fillColor("#CBD5E1")
      .text(`${trackDisplayName(track)} Onboarding Guide`, doc.page.margins.left, 90, {
        width: pageWidth,
      });

    doc
      .fillColor("#94A3B8")
      .fontSize(9)
      .text(
        `Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}   •   ${steps.length} steps   •   Role track: ${track}`,
        doc.page.margins.left,
        120,
        { width: pageWidth },
      );

    // Disclaimer box
    doc
      .fillColor("#F8FAFC")
      .roundedRect(doc.page.margins.left, 155, pageWidth, 30, 4)
      .fill();

    doc
      .fillColor("#475569")
      .fontSize(8)
      .font("Helvetica")
      .text(
        "This PDF reflects your current portal setup. Re-download after any major content update.",
        doc.page.margins.left + 10,
        163,
        { width: pageWidth - 20 },
      );

    doc.moveDown(8);

    // ── Table of Contents ─────────────────────────────────────────────────────
    doc
      .fillColor(BRAND_NAVY)
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Table of Contents", { underline: false });

    doc.moveDown(0.4);

    for (const step of steps) {
      const risk = step.isHighRisk ? "  ⚠ HIGH RISK" : "";
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#374151")
        .text(`${step.stepNumber}. ${step.title}${risk}`, { lineGap: 1 });
    }

    doc.addPage();

    // ── Steps ─────────────────────────────────────────────────────────────────
    for (const step of steps) {
      // Step header bar
      doc
        .rect(doc.page.margins.left, doc.y, pageWidth, 28)
        .fill(BRAND_NAVY);

      const headerY = doc.y - 24;
      doc
        .fillColor("#FFFFFF")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(`Step ${step.stepNumber}: ${step.title}`, doc.page.margins.left + 8, headerY + 7, {
          width: pageWidth - 16,
          lineGap: 0,
        });

      doc.moveDown(0.4);

      // HIGH RISK banner
      if (step.isHighRisk) {
        doc
          .rect(doc.page.margins.left, doc.y, pageWidth, 22)
          .fill(HIGH_RISK_RED);

        doc
          .fillColor("#FFFFFF")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(
            "⚠  HIGH RISK — Read carefully. Errors here can impact payroll accuracy or financial reporting.",
            doc.page.margins.left + 8,
            doc.y - 17,
            { width: pageWidth - 16 },
          );

        doc.moveDown(0.5);
      }

      doc.moveDown(0.3);

      // Purpose
      if (step.purpose) {
        renderSection(doc, "Purpose", step.purpose);
      }

      // Where to find
      if (step.whereToFind) {
        const where = step.navRoute ? `${step.whereToFind}  →  ${step.navRoute}` : step.whereToFind;
        renderSection(doc, "Where to Find It", where);
      }

      // How to use
      if (step.howToUse) {
        renderSection(doc, "How to Use It", step.howToUse);
      }

      // Important rules
      if (Array.isArray(step.importantRules) && step.importantRules.length > 0) {
        doc
          .fontSize(9)
          .fillColor("#6B7280")
          .font("Helvetica-Bold")
          .text("IMPORTANT RULES");
        doc.moveDown(0.2);
        for (const rule of step.importantRules) {
          doc
            .fontSize(10)
            .fillColor("#111827")
            .font("Helvetica")
            .text(`• ${rule}`, { lineGap: 2, indent: 10 });
        }
        doc.moveDown(0.7);
      }

      // Common Mistake callout
      if (step.commonMistake) {
        doc
          .rect(doc.page.margins.left, doc.y, pageWidth, 14)
          .fill("#FEF3C7");
        doc
          .fillColor("#92400E")
          .fontSize(8)
          .font("Helvetica-Bold")
          .text("⚠  COMMON MISTAKE", doc.page.margins.left + 6, doc.y - 11);
        doc.moveDown(0.1);
        doc
          .rect(doc.page.margins.left, doc.y, pageWidth, 1)
          .fill("#FDE68A");
        doc.moveDown(0.2);
        doc
          .fontSize(9.5)
          .fillColor("#78350F")
          .font("Helvetica")
          .text(stripMarkdown(step.commonMistake), doc.page.margins.left + 6, doc.y, {
            width: pageWidth - 12,
            lineGap: 2,
          });
        doc.moveDown(0.7);
      }

      // Practical Exercise
      if (step.practicalExercise) {
        doc
          .rect(doc.page.margins.left, doc.y, pageWidth, 14)
          .fill("#DBEAFE");
        doc
          .fillColor("#1E40AF")
          .fontSize(8)
          .font("Helvetica-Bold")
          .text("PRACTICAL EXERCISE", doc.page.margins.left + 6, doc.y - 11);
        doc.moveDown(0.1);
        doc
          .rect(doc.page.margins.left, doc.y, pageWidth, 1)
          .fill("#BFDBFE");
        doc.moveDown(0.2);
        doc
          .fontSize(9.5)
          .fillColor("#1E3A8A")
          .font("Helvetica")
          .text(stripMarkdown(step.practicalExercise), doc.page.margins.left + 6, doc.y, {
            width: pageWidth - 12,
            lineGap: 2,
          });
        doc.moveDown(0.7);
      }

      // Scenario
      if (step.scenario) {
        renderSection(doc, "Scenario", step.scenario, { color: "#7C3AED" });
      }

      // Knowledge Check
      if (Array.isArray(step.knowledgeCheck) && step.knowledgeCheck.length > 0) {
        doc
          .fontSize(9)
          .fillColor("#6B7280")
          .font("Helvetica-Bold")
          .text("KNOWLEDGE CHECK");
        doc.moveDown(0.2);
        for (let i = 0; i < step.knowledgeCheck.length; i++) {
          const kc = step.knowledgeCheck[i];
          doc
            .fontSize(9.5)
            .font("Helvetica-Bold")
            .fillColor("#111827")
            .text(`Q${i + 1}: ${kc.question}`, { lineGap: 1 });
          doc
            .fontSize(9.5)
            .font("Helvetica")
            .fillColor("#059669")
            .text(`A: ${kc.answer}`, { lineGap: 1, indent: 12 });
          doc.moveDown(0.3);
        }
        doc.moveDown(0.4);
      }

      // Where to get help
      if (step.whereToGetHelp) {
        doc
          .fontSize(8)
          .fillColor("#6B7280")
          .font("Helvetica-Oblique")
          .text(`Help: ${stripMarkdown(step.whereToGetHelp)}`, {
            lineGap: 1,
          });
        doc.moveDown(0.5);
      }

      // Divider between steps
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + pageWidth, doc.y)
        .strokeColor("#E5E7EB")
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(1);

      // Page break if not enough space for next step header
      if (doc.y > doc.page.height - 120 && step !== steps[steps.length - 1]) {
        doc.addPage();
      }
    }

    // ── Footer on all pages ───────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor("#9CA3AF")
        .text(
          `Hire'in Solutions — ${trackDisplayName(track)} Onboarding Guide  |  Page ${i + 1} of ${range.count}`,
          doc.page.margins.left,
          doc.page.height - 35,
          { width: pageWidth, align: "center" },
        );
    }

    doc.end();
  });
}
