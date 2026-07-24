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

export interface Template4Data {
  employeeName: string;
  badgeName: string;
  badgeEmoji: string;
  recognitionDescription: string;
  contributionSummary: string;
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

export function renderTemplate4(data: Template4Data): string {
  const fontBase64 = getFontBase64();
  const d = {
    employeeName: escHtml(data.employeeName),
    badgeName: escHtml(data.badgeName),
    badgeEmoji: data.badgeEmoji,
    recognitionDescription: escHtml(data.recognitionDescription),
    contributionSummary: escHtml(data.contributionSummary),
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
  }

  /* Corner decorations */
  .corner {
    position: absolute;
    width: 90px;
    height: 90px;
    z-index: 10;
  }
  .corner-tl {
    top: 0; left: 0;
    background: linear-gradient(135deg, #1F3A6E 50%, transparent 50%);
  }
  .corner-tr {
    top: 0; right: 0;
    background: linear-gradient(225deg, #1F3A6E 50%, transparent 50%);
  }
  .corner-bl {
    bottom: 0; left: 0;
    background: linear-gradient(45deg, #1F3A6E 50%, transparent 50%);
  }
  .corner-br {
    bottom: 0; right: 0;
    background: linear-gradient(315deg, #1F3A6E 50%, transparent 50%);
  }
  .corner-accent-tl {
    position: absolute; top: 0; left: 0;
    width: 18px; height: 18px;
    background: #F47C20;
    z-index: 11;
  }
  .corner-accent-tr {
    position: absolute; top: 0; right: 0;
    width: 18px; height: 18px;
    background: #F47C20;
    z-index: 11;
  }
  .corner-accent-bl {
    position: absolute; bottom: 0; left: 0;
    width: 18px; height: 18px;
    background: #F47C20;
    z-index: 11;
  }
  .corner-accent-br {
    position: absolute; bottom: 0; right: 0;
    width: 18px; height: 18px;
    background: #F47C20;
    z-index: 11;
  }

  /* Main layout */
  .main-content {
    position: absolute;
    top: 0; left: 0; right: 0;
    bottom: 120px;
    display: flex;
  }

  /* Left column */
  .left-col {
    width: 55%;
    padding: 52px 40px 24px 52px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .brand-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand-cube {
    width: 36px;
    height: 36px;
    background: #1F3A6E;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 900;
    font-size: 20px;
  }
  .brand-name {
    font-size: 15px;
    font-weight: 700;
    color: #1F3A6E;
    letter-spacing: 0.5px;
  }
  .brand-sub {
    font-size: 9px;
    color: #6B7280;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .cert-title {
    margin-top: 20px;
  }
  .cert-main {
    font-size: 64px;
    font-weight: 900;
    color: #1F3A6E;
    line-height: 1;
    letter-spacing: -1px;
    text-transform: uppercase;
  }
  .cert-sub {
    font-size: 20px;
    font-weight: 700;
    color: #F47C20;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .cert-rule {
    height: 1px;
    background: #E5E7EB;
    margin: 14px 0 12px;
  }

  .presented-to {
    font-size: 10px;
    color: #9CA3AF;
    font-style: italic;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .employee-name {
    font-family: ${fontBase64 ? "'DancingScript'" : "Georgia, serif"};
    font-size: 48px;
    color: #1F3A6E;
    line-height: 1.1;
    margin-top: 4px;
  }

  .diamond-sep {
    color: #F47C20;
    font-size: 14px;
    margin: 8px 0;
  }
  .for-badge-label {
    font-size: 10px;
    color: #9CA3AF;
    font-style: italic;
    letter-spacing: 0.5px;
  }
  .badge-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .badge-circle {
    width: 32px;
    height: 32px;
    background: #1F3A6E;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  .badge-name-text {
    font-size: 18px;
    font-weight: 800;
    color: #F47C20;
    letter-spacing: 1px;
  }

  /* Metadata row */
  .meta-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #E5E7EB;
  }
  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .meta-icon {
    font-size: 14px;
    margin-bottom: 2px;
  }
  .meta-label {
    font-size: 7px;
    color: #9CA3AF;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    font-weight: 600;
  }
  .meta-value {
    font-size: 10px;
    color: #1F3A6E;
    font-weight: 600;
  }
  .meta-value-cursive {
    font-family: ${fontBase64 ? "'DancingScript'" : "Georgia, serif"};
    font-size: 16px;
    color: #1F3A6E;
    line-height: 1.1;
  }
  .meta-value-sub {
    font-size: 8px;
    color: #6B7280;
  }

  /* Right ribbon icon area */
  .right-ribbon {
    position: absolute;
    top: 28px;
    right: 48px;
    font-size: 32px;
    opacity: 0.15;
  }

  /* Right column */
  .right-col {
    width: 45%;
    padding: 52px 40px 24px 32px;
    border-left: 1px solid #E5E7EB;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .right-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .right-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-icon {
    width: 26px;
    height: 26px;
    background: #F3F4F6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    flex-shrink: 0;
  }
  .section-label {
    font-size: 8px;
    font-weight: 700;
    color: #6B7280;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .section-text {
    font-size: 10.5px;
    color: #374151;
    line-height: 1.55;
    padding-left: 34px;
    font-style: italic;
  }
  .section-divider {
    height: 1px;
    background: #F3F4F6;
    margin: 2px 0;
  }

  /* Bottom verification bar */
  .verify-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 120px;
    background: #1F3A6E;
    display: flex;
    flex-direction: column;
  }
  .verify-main {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 0 40px;
    gap: 32px;
  }
  .verify-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }
  .shield-icon {
    font-size: 28px;
    flex-shrink: 0;
  }
  .verified-text {
    color: white;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 2px;
  }
  .verified-sub {
    color: rgba(255,255,255,0.7);
    font-size: 9px;
    margin-top: 2px;
    max-width: 200px;
  }
  .verify-center {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .qr-wrapper {
    background: white;
    padding: 4px;
    border-radius: 4px;
  }
  .qr-wrapper img {
    width: 72px;
    height: 72px;
    display: block;
  }
  .qr-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .qr-label {
    font-size: 8px;
    font-weight: 700;
    color: #F47C20;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .qr-desc {
    font-size: 7.5px;
    color: rgba(255,255,255,0.75);
    max-width: 140px;
    line-height: 1.4;
  }
  .qr-url {
    font-size: 8px;
    color: rgba(255,255,255,0.9);
    font-weight: 600;
    word-break: break-all;
    max-width: 140px;
  }
  .verify-right {
    flex-shrink: 0;
    font-size: 24px;
    opacity: 0.4;
  }
  .verify-footer {
    background: #162d58;
    padding: 6px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-text {
    font-size: 7.5px;
    color: rgba(255,255,255,0.55);
  }
  .footer-brand {
    font-size: 7.5px;
    color: rgba(255,255,255,0.4);
    font-weight: 600;
  }
</style>
</head>
<body>

<!-- Corner decorations -->
<div class="corner corner-tl"></div>
<div class="corner corner-tr"></div>
<div class="corner corner-bl"></div>
<div class="corner corner-br"></div>
<div class="corner-accent-tl"></div>
<div class="corner-accent-tr"></div>
<div class="corner-accent-bl"></div>
<div class="corner-accent-br"></div>

<!-- Ribbon icon top-right -->
<div class="right-ribbon">🎖️</div>

<!-- Main content -->
<div class="main-content">

  <!-- LEFT COLUMN -->
  <div class="left-col">
    <div>
      <!-- Brand -->
      <div class="brand-header">
        <div class="brand-cube">H</div>
        <div>
          <div class="brand-name">Hire'in Solutions</div>
          <div class="brand-sub">Staffing & Talent Acquisition</div>
        </div>
      </div>

      <!-- Title -->
      <div class="cert-title">
        <div class="cert-main">Certificate</div>
        <div class="cert-sub">Of Verified Recognition</div>
        <div class="cert-rule"></div>
      </div>

      <!-- Recipient -->
      <div class="presented-to">This certificate is proudly presented to</div>
      <div class="employee-name">${d.employeeName}</div>

      <div class="diamond-sep">&#9670;</div>
      <div class="for-badge-label">for earning the badge</div>
      <div class="badge-row">
        <div class="badge-circle">${d.badgeEmoji}</div>
        <div class="badge-name-text">${d.badgeName}</div>
      </div>
    </div>

    <!-- Metadata row -->
    <div class="meta-row">
      <div class="meta-item">
        <div class="meta-icon">📅</div>
        <div class="meta-label">Issued On</div>
        <div class="meta-value">${d.issueDate}</div>
      </div>
      <div class="meta-item">
        <div class="meta-icon">🏆</div>
        <div class="meta-label">Recognized On</div>
        <div class="meta-value">${d.recognitionDate}</div>
      </div>
      <div class="meta-item">
        <div class="meta-icon">🔖</div>
        <div class="meta-label">Certificate ID</div>
        <div class="meta-value" style="font-size:8px;word-break:break-all">${d.certificateId}</div>
      </div>
      <div class="meta-item">
        <div class="meta-icon">✅</div>
        <div class="meta-label">Approved By</div>
        <div class="meta-value-cursive">${d.approverName}</div>
        <div class="meta-value-sub">${d.approverTitle}</div>
      </div>
    </div>
  </div>

  <!-- RIGHT COLUMN -->
  <div class="right-col">
    <div class="right-section">
      <div class="right-section-header">
        <div class="section-icon">🏆</div>
        <div class="section-label">Recognition Description</div>
      </div>
      <div class="section-text">${d.recognitionDescription}</div>
    </div>

    <div class="section-divider"></div>

    <div class="right-section">
      <div class="right-section-header">
        <div class="section-icon">📈</div>
        <div class="section-label">Contribution Summary</div>
      </div>
      <div class="section-text">${d.contributionSummary}</div>
    </div>

    <div class="section-divider"></div>

    <div class="right-section">
      <div class="right-section-header">
        <div class="section-icon">💬</div>
        <div class="section-label">Recognition Citation</div>
      </div>
      <div class="section-text">&ldquo;${d.publicCitation}&rdquo;</div>
    </div>
  </div>
</div>

<!-- VERIFICATION BAR -->
<div class="verify-bar">
  <div class="verify-main">
    <div class="verify-left">
      <div class="shield-icon">🛡️</div>
      <div>
        <div class="verified-text">★ VERIFIED ★</div>
        <div class="verified-sub">This recognition is verified and secured on the Hire'in platform.</div>
      </div>
    </div>
    <div class="verify-center">
      <div class="qr-wrapper">
        <img src="${d.qrDataUrl}" alt="QR Code" />
      </div>
      <div class="qr-text">
        <div class="qr-label">Verify Digital Authenticity</div>
        <div class="qr-desc">Scan the QR code or visit the link below to verify this certificate.</div>
        <div class="qr-url">${d.verifyUrl}</div>
      </div>
    </div>
    <div class="verify-right">🔒</div>
  </div>
  <div class="verify-footer">
    <div class="footer-text">This is a digitally issued certificate and does not require a physical signature.</div>
    <div class="footer-text">Trusted. Transparent. Tamper-Proof.</div>
    <div class="footer-brand">Powered by Hire'in Solutions</div>
  </div>
</div>

</body>
</html>`;
}
