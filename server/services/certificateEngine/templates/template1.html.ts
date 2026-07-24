import fs from "fs";
import path from "path";

function getFontBase64(): string {
  try {
    const fontPath = path.resolve("server/fonts/DancingScript.ttf");
    if (fs.existsSync(fontPath)) {
      return fs.readFileSync(fontPath).toString("base64");
    }
  } catch {}
  return "";
}

export interface Template1Data {
  employeeName: string;
  badgeName: string;
  badgeEmoji: string;
  publicCitation: string;
  issueDate: string;
  recognitionDate: string;
  certificateId: string;
  approverName: string;
  approverTitle: string;
  qrDataUrl: string;
  verifyUrl: string;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplate1(data: Template1Data): string {
  const fontBase64 = getFontBase64();
  const d = {
    employeeName: escHtml(data.employeeName),
    badgeName: escHtml(data.badgeName),
    badgeEmoji: data.badgeEmoji,
    publicCitation: escHtml(data.publicCitation),
    issueDate: escHtml(data.issueDate),
    recognitionDate: escHtml(data.recognitionDate),
    certificateId: escHtml(data.certificateId),
    approverName: escHtml(data.approverName),
    approverTitle: escHtml(data.approverTitle),
    qrDataUrl: data.qrDataUrl,
    verifyUrl: escHtml(data.verifyUrl),
  };
  const cursiveFont = fontBase64
    ? `@font-face { font-family: 'DancingScript'; src: url('data:font/truetype;base64,${fontBase64}') format('truetype'); }`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${cursiveFont}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 11in 8.5in landscape; margin: 0; }
  body {
    width: 11in;
    height: 8.5in;
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    background: #ffffff;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .corner {
    position: absolute;
    width: 80px;
    height: 80px;
    z-index: 10;
  }
  .corner-tl { top: 0; left: 0; background: linear-gradient(135deg, #1F3A6E 50%, transparent 50%); }
  .corner-tr { top: 0; right: 0; background: linear-gradient(225deg, #1F3A6E 50%, transparent 50%); }
  .corner-bl { bottom: 0; left: 0; background: linear-gradient(45deg, #1F3A6E 50%, transparent 50%); }
  .corner-br { bottom: 0; right: 0; background: linear-gradient(315deg, #1F3A6E 50%, transparent 50%); }

  .border-frame {
    position: absolute;
    top: 24px; left: 24px; right: 24px; bottom: 24px;
    border: 2px solid #1F3A6E;
    pointer-events: none;
  }
  .border-frame-inner {
    position: absolute;
    top: 30px; left: 30px; right: 30px; bottom: 30px;
    border: 0.5px solid rgba(31,58,110,0.25);
    pointer-events: none;
  }

  .content {
    text-align: center;
    padding: 40px 80px;
    width: 100%;
    max-width: 900px;
  }

  .logo-circle {
    width: 72px;
    height: 72px;
    background: #1F3A6E;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
    color: white;
    font-size: 32px;
    font-weight: 900;
  }

  .cert-title {
    font-size: 56px;
    font-weight: 900;
    color: #1F3A6E;
    letter-spacing: -1px;
    text-transform: uppercase;
    line-height: 1;
  }

  .orange-rule {
    height: 3px;
    background: linear-gradient(90deg, transparent, #F47C20, transparent);
    margin: 10px auto;
    width: 220px;
  }
  .cert-subtitle {
    font-size: 13px;
    color: #6B7280;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  .presented-to {
    font-size: 11px;
    color: #9CA3AF;
    font-style: italic;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .employee-name {
    font-family: ${fontBase64 ? "'DancingScript'" : "Georgia, serif"};
    font-size: 54px;
    color: #1F3A6E;
    line-height: 1.1;
    margin-bottom: 12px;
  }
  .orange-rule-thin {
    height: 1px;
    background: #F47C20;
    width: 160px;
    margin: 0 auto 12px;
  }

  .badge-row {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: #FFF7ED;
    border: 1px solid #FED7AA;
    border-radius: 100px;
    padding: 8px 18px;
    margin-bottom: 16px;
  }
  .badge-emoji-big { font-size: 22px; }
  .badge-name { font-size: 14px; font-weight: 700; color: #EA580C; }

  .citation-box {
    background: #F9FAFB;
    border-left: 3px solid #F47C20;
    padding: 12px 20px;
    text-align: left;
    border-radius: 0 6px 6px 0;
    margin: 0 auto 16px;
    max-width: 640px;
  }
  .citation-text {
    font-size: 11px;
    color: #374151;
    font-style: italic;
    line-height: 1.6;
  }

  .footer-cols {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    align-items: center;
    border-top: 1px solid #E5E7EB;
    padding-top: 14px;
    margin-top: 4px;
  }
  .footer-col { text-align: center; }
  .footer-label { font-size: 7.5px; color: #9CA3AF; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 3px; }
  .footer-value { font-size: 10px; font-weight: 600; color: #1F3A6E; }
  .footer-value-cursive {
    font-family: ${fontBase64 ? "'DancingScript'" : "Georgia, serif"};
    font-size: 18px;
    color: #1F3A6E;
  }
  .qr-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .qr-center img { width: 56px; height: 56px; display: block; }
  .qr-url { font-size: 7px; color: #6B7280; word-break: break-all; max-width: 140px; }
  .cert-id-mono { font-family: monospace; font-size: 8px; color: #6B7280; }
</style>
</head>
<body>

<div class="corner corner-tl"></div>
<div class="corner corner-tr"></div>
<div class="corner corner-bl"></div>
<div class="corner corner-br"></div>
<div class="border-frame"></div>
<div class="border-frame-inner"></div>

<div class="content">
  <div class="logo-circle">H</div>

  <div class="cert-title">Certificate</div>
  <div class="orange-rule"></div>
  <div class="cert-subtitle">Of Verified Recognition — Hire'in Solutions</div>

  <div class="presented-to">This certificate is proudly presented to</div>
  <div class="employee-name">${d.employeeName}</div>
  <div class="orange-rule-thin"></div>

  <div class="badge-row">
    <span class="badge-emoji-big">${d.badgeEmoji}</span>
    <span class="badge-name">${d.badgeName} Badge</span>
  </div>

  <div class="citation-box">
    <div class="citation-text">&ldquo;${d.publicCitation}&rdquo;</div>
  </div>

  <div class="footer-cols">
    <div class="footer-col">
      <div class="footer-label">Issue Date</div>
      <div class="footer-value">${d.issueDate}</div>
      <div class="footer-label" style="margin-top:6px">Recognition Date</div>
      <div class="footer-value">${d.recognitionDate}</div>
      <div class="footer-label" style="margin-top:6px">Certificate ID</div>
      <div class="cert-id-mono">${d.certificateId}</div>
    </div>
    <div class="footer-col">
      <div class="footer-label">Approved & Verified By</div>
      <div class="footer-value-cursive">${d.approverName}</div>
      <div class="footer-value" style="font-size:9px;color:#6B7280">${d.approverTitle}</div>
      <div style="height:1px;background:#E5E7EB;margin:8px auto;width:80px"></div>
      <div style="font-size:7.5px;color:#9CA3AF;">Hire'in Solutions</div>
    </div>
    <div class="footer-col">
      <div class="qr-center">
        <div class="footer-label">Verify This Certificate</div>
        <img src="${d.qrDataUrl}" alt="QR" />
        <div class="qr-url">${d.verifyUrl}</div>
      </div>
    </div>
  </div>
</div>

</body>
</html>`;
}
