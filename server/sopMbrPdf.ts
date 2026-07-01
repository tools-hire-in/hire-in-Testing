import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// Monthly Business Review (MBR) PDF for SOP governance (Task #664). Mirrors the
// branding conventions of server/hrLetterPdf.ts: A4, Rayomind orange accents,
// centered logo/header, footer with page numbers.

export interface MbrSopRow {
  code: string;
  title: string;
  category: string;
  launchWave: number;
  lifecycleStatus: string;
  adoptionPct: number;
  impacted: number;
  acknowledged: number;
  openFindings: number;
  lastAuditWeek: string | null;
  lastAuditScore: number | null;
  linkedGoals: number;
  linkedGoalsAvgProgress: number | null;
  linkedGoalsCompleted: number;
}

export interface MbrSummary {
  totalSops: number;
  adoptionPct: number;
  trainingPct: number;
  ackGaps: number;
  openFindings: number;
  overdueReviews: number;
  auditedThisWeek: number;
  auditCoveragePct: number;
}

export interface MbrData {
  generatedAt: Date;
  summary: MbrSummary;
  sops: MbrSopRow[];
}

const LIFECYCLE_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  published: "Published",
  training_assigned: "Training Assigned",
  acknowledged: "Acknowledged",
  active: "Active",
  under_revision: "Under Revision",
  retired: "Retired",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateSopMbrPdf(data: MbrData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const orangeColor = "#F96D3E";
    const navyColor = "#1F3A6E";
    const textColor = "#1a1a1a";
    const mutedColor = "#666666";

    // ── Header ────────────────────────────────────────────────────────────────
    const logoPath = path.resolve("client/public/rayomind-logo.png");
    let hasLogo = false;
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, left + pageWidth / 2 - 60, 40, { width: 120 });
        hasLogo = true;
      }
    } catch {}

    let y = hasLogo ? 95 : 50;
    doc.fontSize(14).font("Helvetica-Bold").fillColor(textColor);
    doc.text("Rayomind Solutions LLP", left, y, { align: "center", width: pageWidth });
    y += 20;
    doc.fontSize(16).font("Helvetica-Bold").fillColor(navyColor);
    doc.text("SOP Monthly Business Review", left, y, { align: "center", width: pageWidth });
    y += 22;
    doc.fontSize(9).font("Helvetica").fillColor(mutedColor);
    doc.text(`Generated: ${formatDate(data.generatedAt)}`, left, y, { align: "center", width: pageWidth });
    y += 18;
    doc.moveTo(left, y).lineTo(left + pageWidth, y).lineWidth(3).strokeColor(orangeColor).stroke();
    y += 18;

    // ── Executive summary ───────────────────────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").fillColor(navyColor);
    doc.text("Executive Summary", left, y);
    y += 18;

    const s = data.summary;
    const summaryPairs: [string, string][] = [
      ["Live SOPs", String(s.totalSops)],
      ["Adoption", `${s.adoptionPct}%`],
      ["Training", `${s.trainingPct}%`],
      ["Acknowledgement gaps", String(s.ackGaps)],
      ["Open findings", String(s.openFindings)],
      ["Overdue reviews", String(s.overdueReviews)],
      ["Audited this week", String(s.auditedThisWeek)],
      ["Audit coverage", `${s.auditCoveragePct}%`],
    ];
    const colW = pageWidth / 4;
    for (let i = 0; i < summaryPairs.length; i++) {
      const col = i % 4;
      const rowY = y + Math.floor(i / 4) * 38;
      const x = left + col * colW;
      doc.fontSize(15).font("Helvetica-Bold").fillColor(orangeColor);
      doc.text(summaryPairs[i][1], x, rowY, { width: colW - 6 });
      doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor);
      doc.text(summaryPairs[i][0], x, rowY + 19, { width: colW - 6 });
    }
    y += Math.ceil(summaryPairs.length / 4) * 38 + 8;
    doc.moveTo(left, y).lineTo(left + pageWidth, y).lineWidth(0.5).strokeColor("#DDDDDD").stroke();
    y += 14;

    // ── Per-category sections ───────────────────────────────────────────────────
    // Column layout for the per-SOP table.
    const cols = [
      { key: "code", label: "Code", w: 0.10 },
      { key: "title", label: "SOP", w: 0.26 },
      { key: "wave", label: "Wave", w: 0.06 },
      { key: "status", label: "Status", w: 0.14 },
      { key: "adoption", label: "Adopt.", w: 0.08 },
      { key: "audit", label: "Audit", w: 0.08 },
      { key: "findings", label: "Open", w: 0.07 },
      { key: "kpi", label: "KPIs", w: 0.15 },
    ] as const;
    const colX: number[] = [];
    let acc = left;
    for (const c of cols) { colX.push(acc); acc += c.w * pageWidth; }

    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;

    const ensureSpace = (needed: number) => {
      if (y + needed > bottomLimit()) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    };

    const drawTableHeader = () => {
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#FFFFFF");
      doc.rect(left, y, pageWidth, 16).fill(navyColor);
      cols.forEach((c, i) => {
        doc.fillColor("#FFFFFF").text(c.label, colX[i] + 3, y + 4.5, { width: c.w * pageWidth - 6 });
      });
      y += 16;
    };

    const grouped = new Map<string, MbrSopRow[]>();
    for (const sop of data.sops) {
      const cat = sop.category || "Uncategorized";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(sop);
    }
    const categories = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

    if (data.sops.length === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").fillColor(mutedColor);
      doc.text("No live SOPs match the selected filters.", left, y);
      y += 20;
    }

    for (const cat of categories) {
      const rows = grouped.get(cat)!.sort((a, b) => a.code.localeCompare(b.code));
      ensureSpace(50);
      doc.fontSize(11).font("Helvetica-Bold").fillColor(navyColor);
      doc.text(titleCase(cat), left, y);
      y += 16;
      drawTableHeader();

      let alt = false;
      for (const sop of rows) {
        const kpiText = sop.linkedGoals === 0
          ? "—"
          : `${sop.linkedGoals} goal${sop.linkedGoals === 1 ? "" : "s"}${sop.linkedGoalsAvgProgress !== null ? `, ${sop.linkedGoalsAvgProgress}% avg` : ""}`;
        const cells: Record<string, string> = {
          code: sop.code,
          title: sop.title,
          wave: `W${sop.launchWave}`,
          status: LIFECYCLE_LABELS[sop.lifecycleStatus] ?? sop.lifecycleStatus,
          adoption: `${sop.adoptionPct}%`,
          audit: sop.lastAuditScore !== null ? String(sop.lastAuditScore) : "—",
          findings: String(sop.openFindings),
          kpi: kpiText,
        };
        // Compute row height from the tallest wrapping cell (title/kpi).
        doc.fontSize(7.5).font("Helvetica");
        const titleH = doc.heightOfString(cells.title, { width: cols[1].w * pageWidth - 6 });
        const kpiH = doc.heightOfString(cells.kpi, { width: cols[7].w * pageWidth - 6 });
        const rowH = Math.max(15, titleH + 6, kpiH + 6);
        ensureSpace(rowH + 2);
        if (alt) { doc.rect(left, y, pageWidth, rowH).fill("#F5F6F8"); }
        cols.forEach((c, i) => {
          const isFindingCol = c.key === "findings";
          const color = isFindingCol && sop.openFindings > 0 ? "#C0392B" : textColor;
          doc.fontSize(7.5).font("Helvetica").fillColor(color);
          doc.text(cells[c.key], colX[i] + 3, y + 3.5, { width: c.w * pageWidth - 6 });
        });
        y += rowH;
        alt = !alt;
      }
      y += 12;
    }

    // ── Footer with page numbers ────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - doc.page.margins.bottom + 18;
      doc.moveTo(left, footerY - 6).lineTo(left + pageWidth, footerY - 6).lineWidth(1).strokeColor(orangeColor).stroke();
      doc.fontSize(7).font("Helvetica").fillColor("#999999");
      doc.text("Rayomind Solutions LLP — Confidential | SOP Monthly Business Review", left, footerY, { width: pageWidth * 0.7 });
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, left, footerY, { width: pageWidth, align: "right" });
    }

    doc.end();
  });
}
