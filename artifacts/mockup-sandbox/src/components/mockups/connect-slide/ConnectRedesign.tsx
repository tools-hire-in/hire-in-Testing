import { Mail, Globe, Linkedin, MapPin, Brain } from "lucide-react";

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const ORANGE2 = "#F96D3E";
const WHITE = "#FFFFFF";

const CONTINENT_PATHS = [
  "M 22,56 L 56,38 L 100,36 L 156,36 L 200,40 L 240,52 L 268,68 L 280,88 L 268,98 L 250,104 L 236,112 L 224,136 L 220,148 L 207,153 L 196,156 L 184,160 L 178,166 L 166,178 L 156,168 L 148,156 L 140,142 L 136,132 L 129,118 L 124,100 L 118,86 L 108,78 L 88,68 L 64,60 L 38,56 Z",
  "M 200,192 L 222,184 L 252,188 L 278,200 L 302,214 L 318,232 L 326,256 L 322,280 L 310,304 L 292,322 L 270,338 L 254,348 L 244,336 L 236,316 L 228,292 L 222,268 L 216,244 L 210,224 L 204,208 Z",
  "M 382,118 L 396,96 L 406,78 L 420,66 L 444,56 L 470,56 L 490,66 L 494,82 L 486,96 L 476,106 L 462,114 L 446,120 L 428,118 L 410,118 L 396,120 Z",
  "M 388,130 L 412,124 L 442,126 L 470,134 L 492,142 L 511,158 L 518,174 L 516,196 L 508,218 L 496,240 L 480,260 L 462,278 L 444,286 L 426,280 L 408,264 L 394,244 L 384,222 L 376,198 L 374,174 L 378,150 Z",
  "M 494,66 L 530,48 L 580,38 L 640,36 L 700,40 L 750,44 L 790,54 L 790,68 L 778,80 L 750,90 L 720,100 L 696,108 L 672,112 L 648,114 L 622,118 L 600,122 L 582,128 L 570,136 L 562,152 L 558,168 L 552,182 L 544,192 L 534,188 L 526,178 L 520,164 L 516,148 L 510,136 L 498,128 L 490,118 L 484,106 L 482,92 L 486,78 Z",
  "M 560,138 L 576,132 L 592,138 L 598,152 L 594,168 L 584,180 L 572,188 L 560,182 L 552,170 L 548,156 L 552,146 Z",
  "M 504,136 L 520,132 L 536,140 L 540,154 L 534,168 L 524,176 L 512,172 L 506,158 L 502,146 Z",
  "M 626,150 L 648,144 L 668,148 L 682,160 L 688,174 L 680,184 L 664,186 L 648,180 L 634,172 L 628,160 Z",
  "M 616,196 L 636,192 L 660,194 L 684,198 L 706,204 L 716,212 L 708,218 L 688,216 L 664,212 L 640,208 L 622,204 Z",
  "M 656,242 L 688,230 L 720,228 L 746,240 L 750,260 L 740,278 L 722,290 L 698,294 L 676,286 L 662,272 L 656,256 Z",
  "M 710,96 L 718,90 L 726,96 L 724,108 L 718,118 L 710,112 Z",
  "M 394,76 L 402,70 L 410,76 L 408,86 L 400,90 L 392,84 Z",
  "M 250,24 L 270,18 L 296,18 L 316,24 L 320,36 L 312,48 L 296,52 L 276,52 L 260,46 L 252,36 Z",
];

function WorldMapSVG() {
  const sjX = 129, sjY = 117;
  const ndX = 572, ndY = 136;
  const midX = (sjX + ndX) / 2;
  const midY = Math.min(sjY, ndY) - 50;

  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="cr-glow1" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.7" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cr-glow2" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.7" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </radialGradient>
      </defs>

      {CONTINENT_PATHS.map((d, i) => (
        <path key={i} d={d} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
      ))}

      <path d={`M ${sjX},${sjY} Q ${midX},${midY} ${ndX},${ndY}`} fill="none" stroke={ORANGE} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.35" />

      <circle cx={sjX} cy={sjY} r="24" fill="url(#cr-glow1)" />
      <circle cx={sjX} cy={sjY} r="6" fill={ORANGE} />
      <circle cx={sjX} cy={sjY} r="12" fill="none" stroke={ORANGE} strokeWidth="0.8" opacity="0.4">
        <animate attributeName="r" values="12;20;12" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
      </circle>

      <circle cx={ndX} cy={ndY} r="24" fill="url(#cr-glow2)" />
      <circle cx={ndX} cy={ndY} r="6" fill={ORANGE} />
      <circle cx={ndX} cy={ndY} r="12" fill="none" stroke={ORANGE} strokeWidth="0.8" opacity="0.4">
        <animate attributeName="r" values="12;20;12" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
      </circle>

      <text x={sjX} y={sjY + 24} textAnchor="middle" fill={WHITE} fontSize="10" fontWeight="700" fontFamily="'Segoe UI', Arial, sans-serif">San Jose, CA</text>
      <text x={ndX} y={ndY + 24} textAnchor="middle" fill={WHITE} fontSize="10" fontWeight="700" fontFamily="'Segoe UI', Arial, sans-serif">New Delhi, India</text>
    </svg>
  );
}

function HISLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/__mockup/images/his-logo.jpg"
      alt="Hire'in Solutions"
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: 6,
        mixBlendMode: "screen",
      }}
    />
  );
}

const QR_SVG = `M0 0.5h7m6 0h1m2 0h6m1 0h1m2 0h7M0 1.5h1m5 0h1m2 0h1m1 0h1m1 0h3m1 0h1m3 0h2m1 0h1m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1m1 0h5m4 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h2m4 0h3m2 0h2m1 0h2m2 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h2m1 0h2m2 0h1m2 0h1m4 0h1m2 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h1m3 0h1m2 0h4m1 0h2m4 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h1m1 0h3m1 0h2m5 0h2M0 8.5h1m1 0h5m2 0h1m1 0h1m1 0h5m4 0h1m1 0h1m1 0h5`;

export function ConnectRedesign() {
  return (
    <div
      style={{
        width: 960,
        height: 540,
        background: NAVY,
        fontFamily: "'Segoe UI', Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: -80, bottom: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(244,124,32,0.06)" }} />
      <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.02)" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px 0", position: "relative", zIndex: 1 }}>
        <HISLogo size={40} />
        <div style={{ textAlign: "center", flex: 1 }}>
          <h2 style={{ color: ORANGE, fontSize: 28, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1, margin: 0 }}>Let&apos;s Connect</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontStyle: "italic", margin: "4px 0 0" }}>&ldquo;The Right Tech Talent, Right Now&rdquo;</p>
        </div>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, display: "flex", gap: 0, padding: "8px 28px 8px", position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: "100%", maxWidth: 440 }}>
            <WorldMapSVG />
          </div>
          <div style={{ display: "flex", gap: 40, marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE, boxShadow: `0 0 8px ${ORANGE}` }} />
              <span style={{ color: WHITE, fontSize: 11, fontWeight: 600 }}>US Headquarters</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE, boxShadow: `0 0 8px ${ORANGE}` }} />
              <span style={{ color: WHITE, fontSize: 11, fontWeight: 600 }}>India Office</span>
            </div>
          </div>
        </div>

        <div style={{ width: 1, background: "rgba(255,255,255,0.08)", margin: "10px 16px" }} />

        <div style={{ flex: 0.8, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, paddingLeft: 8 }}>
          {[
            { icon: Mail, label: "contact@hire-in.com", sub: "Email Us" },
            { icon: Globe, label: "hire-in.com", sub: "Website" },
            { icon: MapPin, label: "San Jose, CA · USA", sub: "US Headquarters" },
            { icon: MapPin, label: "New Delhi · India", sub: "India Office" },
          ].map(({ icon: Icon, label, sub }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color={WHITE} />
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 8.5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", margin: 0 }}>{sub}</p>
                <p style={{ color: WHITE, fontSize: 12.5, fontWeight: 700, margin: 0 }}>{label}</p>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <a href="https://www.linkedin.com/company/hirein-solutions/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Linkedin size={16} color={WHITE} />
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 8.5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", margin: 0 }}>LinkedIn</p>
                <p style={{ color: WHITE, fontSize: 12.5, fontWeight: 700, margin: 0 }}>Connect with us</p>
              </div>
            </a>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, marginLeft: "auto" }}>
              <div style={{ background: "white", borderRadius: 6, padding: 4, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 33 33" shapeRendering="crispEdges">
                  <path stroke="#000000" d={QR_SVG} />
                </svg>
              </div>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 7, textAlign: "center" }}>Scan for LinkedIn</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 32px", background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HISLogo size={18} />
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>|</span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: 600 }}>Hire&apos;in Solutions</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 8.5 }}>A Rayomind Company</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(244,124,32,0.12)", border: "1px solid rgba(244,124,32,0.3)", borderRadius: 16, padding: "3px 12px" }}>
            <Brain size={10} color={ORANGE} />
            <span style={{ color: ORANGE, fontSize: 8.5, fontWeight: 600, letterSpacing: 0.5 }}>AI-Enhanced Recruiting</span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8.5 }}>© 2026 Hire&apos;in Solutions · US IT Staffing · Confidential</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8.5, fontWeight: 600, letterSpacing: 0.5 }}>11 / 11</span>
        </div>
      </div>
    </div>
  );
}
