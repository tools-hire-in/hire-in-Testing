// ===========================================================================
// Hire'in Solutions — Social Card template generator (family: hirein-v1)
// ---------------------------------------------------------------------------
// Produces SELF-CONTAINED HTML files (inline CSS + base64-embedded fonts and
// logo, no external fetches) for the Content Studio card engine.
//
// One token change here re-skins every card (a future brand swap is a single
// edit to the BRAND / FONTS / LOGO constants below).
//
// Run:  node templates/social-cards/hirein-v1/_src/build.mjs
// ===========================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "_assets");
const FONTS = path.join(ASSETS, "fonts");

// ---------------------------------------------------------------------------
// Brand tokens — LIVE website standard (supersedes the social-kit document).
// ---------------------------------------------------------------------------
const BRAND = {
  navy: "#1F3A6E",
  navyTop: "#274a86",      // subtle gradient top for depth
  navyBottom: "#1a3261",   // subtle gradient bottom
  orange: "#F47C20",       // primary accent (pills)
  orangeAccent: "#F96D3E", // --primary in codebase (CTAs / checks / accent line)
  white: "#FFFFFF",
  softGray: "#F2F4F7",
  cardText: "#1F3A6E",
  bodyGray: "#5A6473",
  tagline: "SMART SOLUTIONS. STRONGER TEAMS.",
};

// 8px spacing scale + corner radii (4 / 8 / 12 / 16) documented for reuse.
const RADII = { xs: 4, sm: 8, md: 12, lg: 16 };

// Category -> pill colour map. Brand standard keeps pills in the orange family;
// {{category_color}} overrides per card at render time.
const CATEGORY_COLORS = {
  Insights: BRAND.orange,
  "Candidate Tips": BRAND.orangeAccent,
  "Healthcare Staffing": BRAND.orange,
  "Recruiter Playbook": BRAND.orangeAccent,
  "Employer Guide": BRAND.orange,
  IT: BRAND.orange,
  Engineering: BRAND.orange,
  "Professional Services": BRAND.orange,
};

// ---------------------------------------------------------------------------
// Embedded assets (base64) — guarantees zero external fetches in headless.
// ---------------------------------------------------------------------------
function b64(file) {
  return fs.readFileSync(file).toString("base64");
}
const FONT_FILES = {
  inter400: b64(path.join(FONTS, "inter-400.woff2")),
  inter600: b64(path.join(FONTS, "inter-600.woff2")),
  inter700: b64(path.join(FONTS, "inter-700.woff2")),
  playfair700: b64(path.join(FONTS, "playfair-700.woff2")),
  playfair800: b64(path.join(FONTS, "playfair-800.woff2")),
};
const LOGO_MONO = `data:image/png;base64,${b64(path.join(ASSETS, "logo-monogram-white.png"))}`;

// Generic avatar fallback (white circle + navy silhouette) as an inline SVG URI.
const AVATAR_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#ffffff"/><circle cx="50" cy="40" r="17" fill="#1F3A6E"/><path d="M18 86c0-17 14-29 32-29s32 12 32 29z" fill="#1F3A6E"/></svg>`,
);
const AVATAR_URI = `data:image/svg+xml,${AVATAR_SVG}`;

const FONT_FACE = `
@font-face{font-family:'Inter';font-style:normal;font-weight:400;font-display:block;src:url(data:font/woff2;base64,${FONT_FILES.inter400}) format('woff2');}
@font-face{font-family:'Inter';font-style:normal;font-weight:600;font-display:block;src:url(data:font/woff2;base64,${FONT_FILES.inter600}) format('woff2');}
@font-face{font-family:'Inter';font-style:normal;font-weight:700;font-display:block;src:url(data:font/woff2;base64,${FONT_FILES.inter700}) format('woff2');}
@font-face{font-family:'Playfair Display';font-style:normal;font-weight:700;font-display:block;src:url(data:font/woff2;base64,${FONT_FILES.playfair700}) format('woff2');}
@font-face{font-family:'Playfair Display';font-style:normal;font-weight:800;font-display:block;src:url(data:font/woff2;base64,${FONT_FILES.playfair800}) format('woff2');}`;

// ---------------------------------------------------------------------------
// Inline SVG icons (no fetch).
// ---------------------------------------------------------------------------
const ICONS = {
  globe: (c) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>`,
  check: (c) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`,
  arrowRight: (c) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  arrowUpRight: (c) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>`,
  bulb: (c) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>`,
  plus: (c) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
};

// ---------------------------------------------------------------------------
// Size matrix.
// ---------------------------------------------------------------------------
const SIZES = {
  linkedin: { w: 1200, h: 627, kind: "landscape", label: "LinkedIn / Facebook (1200×627)" },
  twitter: { w: 1600, h: 900, kind: "landscape", label: "X / Twitter (1600×900)" },
  "instagram-square": { w: 1080, h: 1080, kind: "square", label: "Instagram square (1080×1080)" },
  "instagram-story": { w: 1080, h: 1920, kind: "story", label: "Instagram / Facebook story (1080×1920)" },
};

// ---------------------------------------------------------------------------
// Shared building blocks (return HTML strings).
// ---------------------------------------------------------------------------
function watermark(size) {
  // huge faint monogram on the right edge
  const s = size.kind === "story" ? size.w * 0.82 : size.h * 1.15;
  const right = size.kind === "story" ? -size.w * 0.18 : -size.w * 0.03;
  const top = size.kind === "story" ? size.h * 0.02 : "50%";
  const ty = size.kind === "story" ? "0" : "-50%";
  return `<img class="watermark" src="${LOGO_MONO}" alt="" style="width:${Math.round(s)}px;right:${Math.round(right)}px;top:${typeof top === "number" ? Math.round(top) + "px" : top};transform:translateY(${ty});" />`;
}

function dotGrid(cls, color, style) {
  return `<div class="dot-grid ${cls}" style="--dot:${color};${style}"></div>`;
}

function headerLockup(size, { stacked = false, color = BRAND.white, taglineColor = BRAND.orangeAccent } = {}) {
  const mono = stacked ? size.w * 0.13 : size.h * 0.092;
  const wm = stacked ? size.w * 0.045 : size.h * 0.05;
  const tg = stacked ? size.w * 0.018 : size.h * 0.021;
  if (stacked) {
    return `<div class="lockup stacked">
      <img class="lockup-mono" src="${LOGO_MONO}" alt="Hire'in Solutions" style="width:${Math.round(mono)}px" />
      <div class="lockup-word" style="color:${color};font-size:${Math.round(wm)}px">Hire'in Solutions</div>
      <div class="lockup-tag" style="color:${taglineColor};font-size:${Math.round(tg)}px">${BRAND.tagline}</div>
    </div>`;
  }
  return `<div class="lockup">
    <img class="lockup-mono" src="${LOGO_MONO}" alt="Hire'in Solutions" style="height:${Math.round(mono)}px" />
    <div class="lockup-divider" style="height:${Math.round(mono * 0.82)}px;color:${color}"></div>
    <div class="lockup-text">
      <div class="lockup-word" style="color:${color};font-size:${Math.round(wm)}px">Hire'in Solutions</div>
      <div class="lockup-tag" style="color:${taglineColor};font-size:${Math.round(tg)}px">${BRAND.tagline}</div>
    </div>
  </div>`;
}

function pill(size, { icon = "" } = {}) {
  const fs2 = Math.round(size.h * (size.kind === "landscape" ? 0.028 : 0.024));
  const ico = icon ? `<span class="pill-icon">${ICONS[icon](BRAND.white)}</span>` : "";
  return `<div class="pill" style="background:var(--cat,${BRAND.orange});font-size:${fs2}px">${ico}<span>{{category}}</span></div>`;
}

function authorBlock(size, { color = BRAND.white, sub = BRAND.bodyGray, av = 0.075 } = {}) {
  const avs = Math.round(size.h * av);
  const name = Math.round(size.h * (size.kind === "landscape" ? 0.034 : 0.029));
  return `<div class="author">
    <div class="avatar" style="width:${avs}px;height:${avs}px"><img class="avatar-photo" src="{{author_photo_url}}" alt="" onerror="this.remove()" /></div>
    <div class="author-meta">
      <div class="author-name" style="color:${color};font-size:${name}px"><span class="an">{{author_name}}</span><span class="adash"> — </span><span class="at" style="color:${sub}">{{author_title}}</span></div>
    </div>
  </div>`;
}

function footer(size, { color = BRAND.white, line = "rgba(255,255,255,0.18)" } = {}) {
  const fs2 = Math.round(size.h * (size.kind === "landscape" ? 0.03 : 0.024));
  const ic = Math.round(fs2 * 1.05);
  return `<div class="footer" style="border-top:1px solid ${line}">
    <div class="footer-url" style="color:${color};font-size:${fs2}px"><span class="footer-icon" style="width:${ic}px;height:${ic}px">${ICONS.globe(color)}</span>{{footer_url}}</div>
    <div class="footer-date" style="color:${color};font-size:${Math.round(fs2 * 0.92)}px">{{publish_date}}</div>
  </div>`;
}

function cornerLogo(size) {
  const s = Math.round(size.h * (size.kind === "story" ? 0.11 : 0.19));
  const mono = Math.round(s * 0.62);
  return `<div class="corner-logo" style="width:${s}px;height:${s}px;background:var(--brand,${BRAND.orangeAccent})"><img src="${LOGO_MONO}" alt="" style="width:${mono}px" /></div>`;
}

// ---------------------------------------------------------------------------
// Common CSS.
// ---------------------------------------------------------------------------
function commonCss(size) {
  return `
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${size.w}px;height:${size.h}px;}
body{font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
.card{position:relative;width:${size.w}px;height:${size.h}px;overflow:hidden;}
.serif{font-family:'Playfair Display',Georgia,serif;}
.watermark{position:absolute;opacity:.06;pointer-events:none;user-select:none;}
.dot-grid{position:absolute;background-image:radial-gradient(var(--dot) 2px,transparent 2.2px);background-size:${Math.round(size.h * 0.03)}px ${Math.round(size.h * 0.03)}px;}
.lockup{display:flex;align-items:center;gap:${Math.round(size.h * 0.022)}px;}
.lockup.stacked{flex-direction:column;align-items:flex-start;gap:${Math.round(size.h * 0.01)}px;}
.lockup-divider{width:2px;background:currentColor;opacity:.35;}
.lockup-word{font-family:'Playfair Display',serif;font-weight:700;letter-spacing:.2px;line-height:1;}
.lockup-tag{font-weight:600;letter-spacing:.16em;margin-top:${Math.round(size.h * 0.006)}px;}
.pill{display:inline-flex;align-self:flex-start;align-items:center;gap:.5em;color:#fff;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:.62em 1.05em;border-radius:999px;}
.pill-icon{display:inline-flex;width:1.15em;height:1.15em;}
.pill-icon svg{width:100%;height:100%;}
.title{font-family:'Playfair Display',serif;font-weight:800;color:#fff;line-height:1.04;letter-spacing:-.5px;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;}
.accent{background:var(--brand,${BRAND.orangeAccent});border-radius:2px;}
.support{font-weight:400;line-height:1.4;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;}
.author{display:flex;align-items:center;gap:${Math.round(size.h * 0.018)}px;}
.avatar{position:relative;border-radius:999px;flex:none;background:#fff center/cover no-repeat url("${AVATAR_URI}");overflow:hidden;}
.avatar-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.author-meta{min-width:0;}
.author-name{font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.author-name .at{font-weight:400;}
.footer{display:flex;align-items:center;justify-content:space-between;width:100%;}
.footer-url{display:flex;align-items:center;gap:.5em;font-weight:600;}
.footer-icon{display:inline-flex;}
.footer-icon svg{width:100%;height:100%;}
.corner-logo{position:absolute;right:0;bottom:0;z-index:1;display:flex;align-items:center;justify-content:center;border-radius:${RADII.md}px 0 0 0;}
`;
}

// ---------------------------------------------------------------------------
// Layout: STANDARD ARTICLE
// ---------------------------------------------------------------------------
function standard(size) {
  const pad = Math.round(size.h * (size.kind === "story" ? 0.05 : 0.09));
  const stacked = size.kind === "story";
  const titleSize =
    size.kind === "landscape" ? Math.round(size.h * 0.1) :
    size.kind === "square" ? Math.round(size.h * 0.082) :
    Math.round(size.h * 0.052);
  const clamp = size.kind === "landscape" ? 3 : 4;
  const supSize = Math.round(size.h * (size.kind === "landscape" ? 0.035 : 0.028));
  const contentTop = stacked ? Math.round(size.h * 0.04) : Math.round(size.h * 0.02);
  const pillIcon = "";
  const cta = stacked
    ? `<a class="cta"><span>Read More</span><span class="cta-arrow">${ICONS.arrowRight(BRAND.orangeAccent)}</span></a>`
    : "";

  const css = `
.card{background:linear-gradient(155deg,${BRAND.navyTop} 0%,${BRAND.navy} 55%,${BRAND.navyBottom} 100%);padding:${pad}px;display:flex;flex-direction:column;}
.body{position:relative;z-index:2;display:flex;flex-direction:column;height:100%;${stacked ? "align-items:flex-start;" : ""}}
.head{margin-bottom:${Math.round(size.h * 0.03)}px;}
.content{margin-top:${contentTop}px;flex:1;display:flex;flex-direction:column;justify-content:center;max-width:${stacked ? "100%" : "72%"};}
.pill{margin-bottom:${Math.round(size.h * 0.03)}px;}
.title{font-size:${titleSize}px;-webkit-line-clamp:${clamp};max-width:${stacked ? "94%" : "100%"};}
.accent{width:${Math.round(size.h * 0.11)}px;height:${Math.round(size.h * 0.0095)}px;margin:${Math.round(size.h * 0.034)}px 0;}
.support{color:rgba(255,255,255,.82);font-size:${supSize}px;max-width:${stacked ? "92%" : "100%"};margin-bottom:${Math.round(size.h * 0.03)}px;}
.cta{display:inline-flex;align-items:center;gap:.7em;margin-top:${Math.round(size.h * 0.028)}px;padding:.7em 1.4em;border:2px solid ${BRAND.orangeAccent};border-radius:${RADII.sm}px;color:#fff;font-weight:700;font-size:${Math.round(size.h * 0.026)}px;}
.cta-arrow{display:inline-flex;width:1.2em;height:1.2em;}
.cta-arrow svg{width:100%;height:100%;}
.footer{margin-top:${Math.round(size.h * 0.02)}px;padding-top:${Math.round(size.h * 0.022)}px;}
`;

  const body = `
  ${watermark(size)}
  ${dotGrid("dg1", "rgba(255,255,255,.45)", `top:${Math.round(size.h * 0.07)}px;right:${Math.round(size.w * 0.05)}px;width:${Math.round(size.w * 0.075)}px;height:${Math.round(size.h * 0.11)}px;opacity:.5;`)}
  <div class="body">
    <div class="head">${headerLockup(size, { stacked })}</div>
    <div class="content">
      ${pill(size, { icon: pillIcon })}
      <h1 class="title">{{title}}</h1>
      <div class="accent"></div>
      <p class="support">{{supporting_line}}</p>
      ${authorBlock(size, { sub: "rgba(255,255,255,.72)" })}
      ${cta}
    </div>
    ${footer(size)}
  </div>
  ${cornerLogo(size)}`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Layout: CHECKLIST / PLAYBOOK
// ---------------------------------------------------------------------------
function checklist(size) {
  const land = size.kind === "landscape";
  const maxTips = land ? 4 : 5;
  const outerPad = Math.round(size.h * (land ? 0.045 : 0.05));
  const cardPad = Math.round(size.h * (land ? 0.045 : 0.05));
  const titleSize = land ? Math.round(size.h * 0.062) : Math.round(size.h * 0.064);
  const titleClamp = land ? 2 : 3;
  const tipTitle = Math.round(size.h * (land ? 0.03 : 0.026));
  const tipDesc = Math.round(size.h * (land ? 0.024 : 0.021));
  const check = Math.round(size.h * (land ? 0.05 : 0.046));
  const tipPadV = Math.round(size.h * (land ? 0.013 : 0.018));

  // Repeatable tip row. Engine expands {{#tips}}...{{/tips}}; default sample left
  // collapses cleanly when fewer than max rows are provided.
  const tipRow = `        <div class="tip" data-row="tip">
          <div class="tip-check" style="width:${check}px;height:${check}px;border:2px solid var(--brand,${BRAND.orangeAccent})"><span style="width:55%;height:55%">${ICONS.check(BRAND.orangeAccent)}</span></div>
          <div class="tip-body">
            <div class="tip-title" style="font-size:${tipTitle}px">{{tip_title}}</div>
            <div class="tip-desc" style="font-size:${tipDesc}px">{{tip_desc}}</div>
          </div>
        </div>`;
  const tips = `{{#tips}}\n${tipRow}\n{{/tips}}`;

  const css = `
.card{background:${BRAND.navy};padding:${outerPad}px;}
.arc{position:absolute;border:${Math.round(size.h * 0.006)}px solid ${BRAND.orangeAccent};border-radius:50%;opacity:.85;}
.dot-grid{opacity:.4;}
.sheet{position:relative;z-index:3;width:100%;height:100%;background:#fff;border-radius:${RADII.lg + 6}px;padding:${cardPad}px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.25);}
.sheet-head{flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:${cardPad}px;}
.pill{font-size:${Math.round(size.h * 0.026)}px;}
.brandbox{display:flex;flex-direction:column;align-items:flex-end;gap:${Math.round(size.h * 0.008)}px;}
.brandbox-sq{width:${Math.round(size.h * 0.11)}px;height:${Math.round(size.h * 0.11)}px;background:${BRAND.navy};border-radius:${RADII.md}px;display:flex;align-items:center;justify-content:center;}
.brandbox-sq img{width:62%;}
.brandbox-word{font-family:'Playfair Display',serif;font-weight:700;color:${BRAND.navy};font-size:${Math.round(size.h * 0.026)}px;line-height:1;}
.brandbox-tag{color:${BRAND.orangeAccent};font-weight:600;font-size:${Math.round(size.h * 0.013)}px;letter-spacing:.12em;}
.c-title{flex:none;font-family:'Playfair Display',serif;font-weight:800;color:${BRAND.navy};font-size:${titleSize}px;line-height:1.02;letter-spacing:-.5px;margin-top:${Math.round(size.h * (land ? 0.022 : 0.03))}px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${titleClamp};overflow:hidden;max-width:78%;}
.c-accent{flex:none;width:${Math.round(size.h * 0.09)}px;height:${Math.round(size.h * 0.008)}px;background:var(--brand,${BRAND.orangeAccent});border-radius:2px;margin:${Math.round(size.h * (land ? 0.02 : 0.028))}px 0;}
.tips{display:flex;flex-direction:column;flex:1;min-height:0;justify-content:center;gap:0;overflow:hidden;}
.tip{display:flex;align-items:flex-start;gap:${Math.round(size.h * 0.025)}px;padding:${tipPadV}px 0;border-bottom:1px solid #E7EAF0;}
.tip:last-child{border-bottom:none;}
.tip-check{flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;margin-top:${Math.round(size.h * 0.004)}px;}
.tip-check span{display:inline-flex;}
.tip-check span svg{width:100%;height:100%;}
.tip-title{font-weight:700;color:${BRAND.navy};letter-spacing:.01em;}
.tip-desc{color:${BRAND.bodyGray};margin-top:${Math.round(size.h * 0.006)}px;line-height:1.35;}
.cfooter{flex:none;margin-top:${Math.round(size.h * (land ? 0.018 : 0.028))}px;background:${BRAND.softGray};border-radius:${RADII.md}px;padding:${Math.round(size.h * 0.022)}px ${Math.round(size.h * 0.026)}px;display:flex;align-items:center;gap:${Math.round(size.h * 0.022)}px;}
.cf-mono{width:${Math.round(size.h * 0.066)}px;height:${Math.round(size.h * 0.066)}px;border-radius:999px;background:${BRAND.navy};display:flex;align-items:center;justify-content:center;flex:none;}
.cf-mono img{width:60%;}
.cf-sep{width:1px;align-self:stretch;background:#D7DCE6;}
.cf-author{display:flex;align-items:center;gap:${Math.round(size.h * 0.016)}px;flex:1;min-width:0;}
.cf-avatar{width:${Math.round(size.h * 0.055)}px;height:${Math.round(size.h * 0.055)}px;border-radius:999px;flex:none;position:relative;background:${BRAND.navy} center/cover no-repeat url("${AVATAR_URI}");overflow:hidden;}
.cf-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.cf-name{font-weight:700;color:${BRAND.navy};font-size:${Math.round(size.h * 0.022)}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cf-name .at{font-weight:400;color:${BRAND.bodyGray};}
.cf-sub{color:${BRAND.bodyGray};font-size:${Math.round(size.h * 0.017)}px;}
.cf-more{text-align:right;color:${BRAND.bodyGray};font-size:${Math.round(size.h * 0.018)}px;line-height:1.3;}
.cf-more b{color:${BRAND.navy};font-weight:700;}
.cf-arrow{width:${Math.round(size.h * 0.058)}px;height:${Math.round(size.h * 0.058)}px;border-radius:${RADII.sm}px;background:var(--brand,${BRAND.orangeAccent});display:flex;align-items:center;justify-content:center;flex:none;}
.cf-arrow span{width:50%;height:50%;display:inline-flex;}
.cf-arrow span svg{width:100%;height:100%;}
`;

  const body = `
  <div class="arc" style="width:${Math.round(size.w * 0.5)}px;height:${Math.round(size.w * 0.5)}px;top:${-Math.round(size.w * 0.3)}px;right:${-Math.round(size.w * 0.18)}px;"></div>
  <div class="arc" style="width:${Math.round(size.w * 0.42)}px;height:${Math.round(size.w * 0.42)}px;bottom:${-Math.round(size.w * 0.26)}px;left:${-Math.round(size.w * 0.2)}px;"></div>
  ${dotGrid("dg1", "rgba(255,255,255,.5)", `top:${Math.round(size.h * 0.46)}px;left:${Math.round(size.w * 0.012)}px;width:${Math.round(size.w * 0.05)}px;height:${Math.round(size.h * 0.09)}px;`)}
  ${dotGrid("dg2", "rgba(255,255,255,.5)", `bottom:${Math.round(size.h * 0.22)}px;right:${Math.round(size.w * 0.012)}px;width:${Math.round(size.w * 0.05)}px;height:${Math.round(size.h * 0.09)}px;`)}
  <div class="sheet">
    <div class="sheet-head">
      <div class="pill" style="background:var(--cat,${BRAND.orange})">{{category}}</div>
      <div class="brandbox">
        <div class="brandbox-sq"><img src="${LOGO_MONO}" alt="Hire'in Solutions" /></div>
        <div class="brandbox-word">Hire'in Solutions</div>
        <div class="brandbox-tag">${BRAND.tagline}</div>
      </div>
    </div>
    <h1 class="c-title">{{title}}</h1>
    <div class="c-accent"></div>
    <div class="tips">
${tips}
    </div>
    <div class="cfooter">
      <div class="cf-mono"><img src="${LOGO_MONO}" alt="" /></div>
      <div class="cf-sep"></div>
      <div class="cf-author">
        <div class="cf-avatar"><img src="{{author_photo_url}}" alt="" onerror="this.remove()" /></div>
        <div style="min-width:0">
          <div class="cf-name"><span>{{author_name}}</span><span class="at"> — {{author_title}}</span></div>
          <div class="cf-sub">{{supporting_line}}</div>
        </div>
      </div>
      <div class="cf-sep"></div>
      <div class="cf-more">More insights at<br><b>{{footer_url}}</b></div>
      <div class="cf-arrow"><span>${ICONS.arrowUpRight(BRAND.white)}</span></div>
    </div>
  </div>`;
  return { css, body, maxTips };
}

// ---------------------------------------------------------------------------
// Layout: QUOTE / KEY INSIGHT
// ---------------------------------------------------------------------------
function quote(size) {
  const pad = Math.round(size.h * 0.09);
  const stacked = size.kind === "square";
  const quoteSize =
    size.kind === "landscape" ? Math.round(size.h * 0.092) : Math.round(size.h * 0.076);
  const markSize = Math.round(quoteSize * 1.5);
  const clamp = size.kind === "landscape" ? 3 : 4;

  const css = `
.card{background:linear-gradient(155deg,${BRAND.navyTop} 0%,${BRAND.navy} 55%,${BRAND.navyBottom} 100%);padding:${pad}px;display:flex;flex-direction:column;}
.body{position:relative;z-index:2;display:flex;flex-direction:column;height:100%;}
.head{margin-bottom:${Math.round(size.h * 0.03)}px;}
.content{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:${stacked ? "92%" : "74%"};}
.pill{margin-bottom:${Math.round(size.h * 0.028)}px;font-size:${Math.round(size.h * 0.026)}px;}
.qmark{font-family:'Playfair Display',serif;font-weight:800;color:var(--brand,${BRAND.orangeAccent});font-size:${markSize}px;line-height:.6;height:${Math.round(markSize * 0.45)}px;display:block;}
.quote{font-family:'Playfair Display',serif;font-weight:800;color:#fff;font-size:${quoteSize}px;line-height:1.08;letter-spacing:-.5px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${clamp};overflow:hidden;}
.quote .qclose{color:var(--brand,${BRAND.orangeAccent});}
.accent{width:${Math.round(size.h * 0.1)}px;height:${Math.round(size.h * 0.0095)}px;margin:${Math.round(size.h * 0.03)}px 0;}
.footer{margin-top:${Math.round(size.h * 0.02)}px;padding-top:${Math.round(size.h * 0.022)}px;margin-bottom:${Math.round(size.h * 0.016)}px;}
.bottom-strip{position:absolute;left:0;right:0;bottom:0;height:${Math.round(size.h * 0.014)}px;background:var(--brand,${BRAND.orangeAccent});z-index:3;}
`;

  const body = `
  ${watermark(size)}
  ${dotGrid("dg1", "rgba(255,255,255,.45)", `top:${Math.round(size.h * 0.06)}px;right:${Math.round(size.w * 0.06)}px;width:${Math.round(size.w * 0.08)}px;height:${Math.round(size.h * 0.12)}px;opacity:.5;`)}
  <div class="body">
    <div class="head">${headerLockup(size, { stacked })}</div>
    <div class="content">
      ${pill(size)}
      <span class="qmark">&#8220;</span>
      <div class="quote">{{title}}<span class="qclose">&#8221;</span></div>
      <div class="accent"></div>
      ${authorBlockQuote(size)}
    </div>
    ${footer(size)}
  </div>
  ${cornerLogo(size)}
  <div class="bottom-strip"></div>`;
  return { css, body };
}

function authorBlockQuote(size) {
  const avs = Math.round(size.h * 0.08);
  const name = Math.round(size.h * (size.kind === "landscape" ? 0.036 : 0.03));
  const title = Math.round(name * 0.74);
  return `<div class="author">
    <div class="avatar" style="width:${avs}px;height:${avs}px"><img class="avatar-photo" src="{{author_photo_url}}" alt="" onerror="this.remove()" /></div>
    <div class="author-meta">
      <div class="author-name" style="color:#fff;font-size:${name}px;white-space:normal">{{author_name}}</div>
      <div class="at" style="color:rgba(255,255,255,.72);font-size:${title}px;font-weight:400">{{author_title}}</div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Assemble + write.
// ---------------------------------------------------------------------------
function page(size, layoutCss, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${size.w}, initial-scale=1" />
<title>Hire'in social card</title>
<!--
  Variable slots (Mustache): {{title}} {{excerpt}} {{supporting_line}} {{category}}
  {{category_color}} {{author_name}} {{author_title}} {{author_photo_url}}
  {{brand_color}} {{logo_url}} {{footer_url}} {{publish_date}}  (+ {{#tips}}{{tip_title}}/{{tip_desc}}{{/tips}} for checklist)
  Colours fall back to brand defaults when a slot is left unsubstituted (var() fallback).
  The Hire'in monogram + fonts are embedded as base64 so rendering needs zero external fetches.
-->
<style>${FONT_FACE}
${commonCss(size)}
${layoutCss}</style>
</head>
<body data-logo-slot="{{logo_url}}" data-excerpt="{{excerpt}}">
<div class="card" style="{{#brand_color}}--brand:{{brand_color}};{{/brand_color}}{{#category_color}}--cat:{{category_color}};{{/category_color}}">
${body}
</div>
</body>
</html>
`;
}

const TEMPLATES = [
  { layout: "standard", platforms: ["linkedin", "instagram-square", "instagram-story", "twitter"], fn: standard },
  { layout: "checklist", platforms: ["linkedin", "instagram-square"], fn: checklist },
  { layout: "quote", platforms: ["linkedin", "instagram-square", "twitter"], fn: quote },
];

const manifest = [];
for (const t of TEMPLATES) {
  for (const platform of t.platforms) {
    const size = SIZES[platform];
    const { css, body, maxTips } = t.fn(size);
    const html = page(size, css, body);
    const file = `${t.layout}-${platform}.html`;
    fs.writeFileSync(path.join(ROOT, file), html);
    manifest.push({
      file,
      family: "hirein-v1",
      layout: t.layout,
      platform,
      label: size.label,
      width: size.w,
      height: size.h,
      ...(maxTips ? { maxTips } : {}),
    });
    console.log("wrote", file, `(${size.w}x${size.h}, ${Math.round(html.length / 1024)}KB)`);
  }
}
fs.writeFileSync(path.join(ROOT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("wrote manifest.json with", manifest.length, "templates");
