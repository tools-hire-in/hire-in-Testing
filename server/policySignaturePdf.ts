import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const DANCING_SCRIPT_PATH = path.resolve("server/fonts/DancingScript.ttf");
const hasCursiveFont = fs.existsSync(DANCING_SCRIPT_PATH);

export interface PageInitial {
  page: number;
  initial: string;
}

export interface PolicyPdfData {
  policyTitle: string;
  policyVersion: number;
  employeeName: string;
  employeeId: string | null;
  signedAt: Date;
  ipAddress: string;
  pageInitials: PageInitial[];
  finalSignature: string;
  pages: Array<{ page: number; body: string }>;
}

export async function generatePolicySignaturePdf(data: PolicyPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 60, left: 60, right: 60 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const navyColor = "#1F3A6E";
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

    function drawHeader(y: number): number {
      doc.fontSize(10).font("Helvetica-Bold").fillColor(navyColor);
      doc.text("Rayomind Solutions LLP", doc.page.margins.left, y, { align: "center", width: pageWidth });
      y += 16;
      doc.fontSize(7).font("Helvetica").fillColor(mutedColor);
      doc.text("Suite No-101, Pocket-6, Sector-2, Rohini, New Delhi – 110085", doc.page.margins.left, y, { align: "center", width: pageWidth });
      y += 12;
      doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).lineWidth(2).strokeColor(orangeColor).stroke();
      return y + 14;
    }

    function drawPageFooter(pageNum: number, totalPages: number, initial?: string) {
      const footerY = doc.page.height - doc.page.margins.bottom;
      doc.moveTo(doc.page.margins.left, footerY - 20)
        .lineTo(doc.page.margins.left + pageWidth, footerY - 20)
        .lineWidth(0.5).strokeColor("#cccccc").stroke();
      doc.fontSize(7).font("Helvetica").fillColor(mutedColor);
      doc.text(`Page ${pageNum} of ${totalPages}`, doc.page.margins.left, footerY - 12, { width: pageWidth / 3 });
      doc.text(`${data.policyTitle} — v${data.policyVersion}`, doc.page.margins.left, footerY - 12, { width: pageWidth, align: "center" });
      if (initial) {
        doc.fontSize(7).font("Helvetica-Bold").fillColor(mutedColor);
        doc.text(`Initialled: ${initial}`, doc.page.margins.left + pageWidth - 80, footerY - 12, { width: 80, align: "right" });
      }
    }

    const totalDocPages = data.pages.length + 2; // cover + policy pages + signature page

    // === COVER PAGE ===
    let y = hasLogo ? 110 : 60;
    y = drawHeader(y);

    y += 30;
    doc.fontSize(20).font("Helvetica-Bold").fillColor(navyColor);
    doc.text("POLICY ACKNOWLEDGEMENT RECORD", doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 30;

    doc.moveTo(doc.page.margins.left + pageWidth / 4, y)
      .lineTo(doc.page.margins.left + (3 * pageWidth) / 4, y)
      .lineWidth(1).strokeColor(orangeColor).stroke();
    y += 20;

    doc.fontSize(16).font("Helvetica-Bold").fillColor(textColor);
    doc.text(data.policyTitle, doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 24;

    doc.fontSize(10).font("Helvetica").fillColor(mutedColor);
    doc.text(`Version ${data.policyVersion}`, doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 40;

    const boxX = doc.page.margins.left + pageWidth * 0.1;
    const boxW = pageWidth * 0.8;
    doc.rect(boxX, y, boxW, 160).lineWidth(1).strokeColor("#e2e8f0").stroke();
    y += 20;

    function infoRow(label: string, value: string, rowY: number) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(mutedColor);
      doc.text(label, boxX + 16, rowY, { width: 120 });
      doc.fontSize(9).font("Helvetica").fillColor(textColor);
      doc.text(value, boxX + 140, rowY, { width: boxW - 156 });
      return rowY + 22;
    }

    y = infoRow("Employee Name:", data.employeeName, y);
    y = infoRow("Employee ID:", data.employeeId || "—", y);
    y = infoRow("Signed On:", data.signedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long", timeStyle: "short" }) + " IST", y);
    y = infoRow("IP Address:", data.ipAddress, y);
    y = infoRow("Policy Version:", String(data.policyVersion), y);
    y += 10;

    doc.fontSize(8).font("Helvetica-Oblique").fillColor("#999999");
    doc.text("This document is a legally binding acknowledgement record generated by Rayomind Solutions HR System.", doc.page.margins.left, y, { align: "center", width: pageWidth });

    drawPageFooter(1, totalDocPages);

    // === POLICY PAGES ===
    for (let i = 0; i < data.pages.length; i++) {
      const pg = data.pages[i];
      const pageNum = i + 2;
      const initial = data.pageInitials.find(pi => pi.page === pg.page)?.initial || "";

      doc.addPage();
      let py = hasLogo ? 110 : 60;
      py = drawHeader(py);
      py += 10;

      doc.fontSize(9).font("Helvetica-Bold").fillColor(navyColor);
      doc.text(`${data.policyTitle} — Page ${pg.page}`, doc.page.margins.left, py, { width: pageWidth });
      py += 18;

      doc.moveTo(doc.page.margins.left, py).lineTo(doc.page.margins.left + pageWidth, py)
        .lineWidth(0.5).strokeColor("#e2e8f0").stroke();
      py += 12;

      doc.fontSize(10).font("Helvetica").fillColor(textColor);
      const lines = pg.body.split(/\r?\n/);
      for (const line of lines) {
        if (py > doc.page.height - doc.page.margins.bottom - 60) break;
        if (line.trim() === "") {
          py += 8;
        } else {
          doc.text(line, doc.page.margins.left, py, { width: pageWidth, lineGap: 3 });
          py = doc.y + 8;
        }
      }

      // Initials box at bottom of page
      const initialsBoxY = doc.page.height - doc.page.margins.bottom - 45;
      doc.rect(doc.page.margins.left + pageWidth - 180, initialsBoxY, 180, 38)
        .lineWidth(0.5).strokeColor("#e2e8f0").fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fontSize(7).font("Helvetica").fillColor(mutedColor);
      doc.text("Employee Initials (Page " + pg.page + "):", doc.page.margins.left + pageWidth - 175, initialsBoxY + 6, { width: 175 });

      if (initial && hasCursiveFont) {
        doc.font("DancingScript").fontSize(18).fillColor(navyColor);
        doc.text(initial, doc.page.margins.left + pageWidth - 175, initialsBoxY + 14, { width: 175 });
      } else if (initial) {
        doc.font("Helvetica-Bold").fontSize(14).fillColor(navyColor);
        doc.text(initial, doc.page.margins.left + pageWidth - 175, initialsBoxY + 14, { width: 175 });
      }

      drawPageFooter(pageNum, totalDocPages, initial);
    }

    // === SIGNATURE PAGE ===
    doc.addPage();
    let sy = hasLogo ? 110 : 60;
    sy = drawHeader(sy);
    sy += 20;

    doc.fontSize(14).font("Helvetica-Bold").fillColor(navyColor);
    doc.text("FINAL ACKNOWLEDGEMENT & SIGNATURE", doc.page.margins.left, sy, { align: "center", width: pageWidth });
    sy += 30;

    doc.fontSize(10).font("Helvetica").fillColor(textColor);
    const declaration = `I, ${data.employeeName}, hereby confirm that I have read and understood the entire "${data.policyTitle}" policy document (Version ${data.policyVersion}) of Rayomind Solutions LLP, comprising ${data.pages.length} page(s), and have initialled each page as evidence of having reviewed its contents. I agree to comply with the terms and requirements set out in this policy throughout the course of my employment.`;
    doc.text(declaration, doc.page.margins.left, sy, { width: pageWidth, lineGap: 4 });
    sy = doc.y + 20;

    // Summary of initials
    doc.fontSize(9).font("Helvetica-Bold").fillColor(mutedColor);
    doc.text("Page Initials Summary:", doc.page.margins.left, sy);
    sy += 16;

    for (const pi of data.pageInitials) {
      doc.fontSize(9).font("Helvetica").fillColor(textColor);
      doc.text(`  Page ${pi.page}: "${pi.initial}"`, doc.page.margins.left, sy, { width: pageWidth / 2 });
      sy += 14;
    }
    sy += 10;

    // Signature block
    doc.moveTo(doc.page.margins.left, sy).lineTo(doc.page.margins.left + pageWidth, sy)
      .lineWidth(0.5).strokeColor("#e2e8f0").stroke();
    sy += 20;

    doc.fontSize(9).font("Helvetica-Bold").fillColor(mutedColor);
    doc.text("Digital Signature:", doc.page.margins.left, sy);
    sy += 14;

    if (hasCursiveFont) {
      doc.font("DancingScript").fontSize(32).fillColor(navyColor);
      doc.text(data.finalSignature, doc.page.margins.left, sy, { width: 250 });
      sy += 38;
    } else {
      doc.font("Helvetica-Bold").fontSize(18).fillColor(navyColor);
      doc.text(data.finalSignature, doc.page.margins.left, sy, { width: 250 });
      sy += 28;
    }

    doc.moveTo(doc.page.margins.left, sy).lineTo(doc.page.margins.left + 200, sy)
      .lineWidth(0.5).strokeColor("#999999").stroke();
    sy += 6;

    doc.fontSize(9).font("Helvetica-Bold").fillColor(textColor);
    doc.text(data.employeeName, doc.page.margins.left, sy);
    sy += 14;
    doc.fontSize(8).font("Helvetica").fillColor(mutedColor);
    doc.text(`Employee ID: ${data.employeeId || "—"}`, doc.page.margins.left, sy);
    sy += 12;
    doc.text(`Date & Time: ${data.signedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long", timeStyle: "short" })} IST`, doc.page.margins.left, sy);
    sy += 12;
    doc.text(`IP Address: ${data.ipAddress}`, doc.page.margins.left, sy);

    sy += 30;
    doc.moveTo(doc.page.margins.left, sy).lineTo(doc.page.margins.left + pageWidth, sy)
      .lineWidth(2).strokeColor(orangeColor).stroke();
    sy += 8;
    doc.fontSize(7).font("Helvetica").fillColor("#999999");
    doc.text("This is a digitally generated acknowledgement record. It is legally binding under applicable Indian law.", doc.page.margins.left, sy, { align: "center", width: pageWidth });

    drawPageFooter(totalDocPages, totalDocPages, data.finalSignature);

    doc.end();
  });
}
