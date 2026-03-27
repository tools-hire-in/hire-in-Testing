import { Mail, Globe, Linkedin, MapPin, Brain } from "lucide-react";

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const ORANGE2 = "#F96D3E";
const WHITE = "#FFFFFF";

function WorldMapSVG() {
  return (
    <svg viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="glow-sj" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.6" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-nd" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.6" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </radialGradient>
      </defs>

      <path
        d="M120,120 L130,115 L140,118 L148,110 L155,108 L160,100 L165,95 L175,90 L180,92 L185,88 L195,85 L200,82 L205,78 L210,80 L215,85 L220,90 L218,95 L215,100 L210,105 L205,110 L200,115 L195,120 L190,130 L185,140 L180,150 L175,160 L172,170 L170,175 L168,180 L165,185 L160,188 L155,190 L150,192 L145,190 L140,188 L135,185 L130,180 L125,175 L120,170 L118,165 L115,160 L112,155 L110,150 L108,145 L106,140 L105,135 L108,130 L112,125 Z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
      />

      <path
        d="M195,88 L200,85 L210,82 L220,80 L230,78 L235,82 L240,88 L238,92 L235,95 L230,98 L225,100 L220,105 L218,110 L215,115 L210,118 L205,115 L200,112 L195,108 L192,100 L195,95 Z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
      />

      <path
        d="M100,170 L110,165 L118,168 L125,172 L130,178 L135,185 L140,192 L145,198 L148,205 L152,215 L155,225 L158,235 L160,245 L162,250 L160,258 L155,265 L150,270 L145,275 L140,278 L135,280 L130,278 L125,275 L120,272 L115,268 L112,262 L110,255 L108,248 L106,240 L105,232 L103,225 L100,218 L98,210 L96,200 L95,192 L94,185 L95,178 L98,172 Z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
      />

      <path
        d="M145,198 L155,195 L165,192 L175,190 L180,195 L185,200 L188,208 L190,215 L192,225 L194,235 L192,245 L190,252 L185,260 L180,265 L175,268 L170,270 L168,272 L165,275 L160,278 L155,280 L150,282 L148,285 L145,290 L142,295 L140,298 L138,295 L135,290 L133,285 L132,280 L130,275 L128,268 L127,260 L126,252 L128,245 L130,238 L132,230 L135,222 L138,215 L140,208 L142,202 Z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
      />

      <path
        d="M340,55 L355,52 L370,50 L385,48 L400,45 L415,42 L430,40 L445,38 L460,40 L470,42 L478,45 L485,48 L490,52 L495,56 L500,60 L505,65 L510,70 L515,75 L520,78 L525,82 L530,85 L535,88 L540,90 L545,92 L548,95 L550,98 L552,102 L555,108 L560,115 L562,120 L560,125 L555,130 L550,135 L545,138 L540,140 L535,142 L530,144 L525,145 L520,146 L510,148 L505,150 L500,152 L495,155 L490,158 L485,160 L480,162 L475,160 L470,158 L465,155 L460,152 L455,150 L450,148 L445,146 L440,144 L435,142 L430,140 L425,138 L420,136 L415,134 L410,132 L405,130 L400,128 L395,125 L390,122 L385,120 L380,118 L375,115 L370,112 L365,108 L360,105 L355,102 L350,98 L348,95 L345,90 L342,85 L340,80 L338,75 L335,70 L333,65 L335,60 Z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
      />

      <path
        d="M345,145 L350,142 L360,140 L370,138 L380,136 L390,135 L400,134 L410,135 L420,136 L425,138 L430,140 L435,145 L438,150 L440,155 L442,162 L445,170 L448,180 L450,190 L448,200 L445,210 L440,218 L435,225 L430,230 L425,235 L418,240 L412,245 L405,248 L398,250 L390,252 L382,250 L375,248 L370,245 L365,240 L360,235 L358,228 L355,220 L352,212 L350,205 L348,198 L345,190 L343,182 L342,175 L340,168 L338,160 L340,152 Z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
      />

      <path
        d="M555,65 L565,60 L575,55 L585,52 L595,50 L605,48 L615,50 L625,52 L635,55 L642,58 L648,62 L652,68 L655,75 L658,82 L660,90 L662,98 L665,108 L668,118 L670,128 L672,135 L675,140 L680,145 L685,148 L690,150 L695,152 L700,155 L702,158 L700,162 L695,165 L690,168 L685,170 L680,172 L675,175 L670,180 L665,185 L660,190 L655,195 L650,198 L645,200 L640,202 L635,205 L630,208 L625,210 L620,212 L615,215 L610,218 L605,220 L600,222 L595,225 L590,228 L585,230 L580,228 L575,225 L570,222 L565,218 L560,215 L558,210 L555,205 L552,200 L550,195 L548,190 L545,185 L542,180 L540,175 L538,170 L540,165 L542,160 L545,155 L548,150 L550,145 L548,140 L545,135 L542,130 L540,125 L538,118 L540,110 L542,105 L545,98 L548,92 L550,85 L552,78 L555,72 Z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
      />

      <path
        d="M620,260 L640,255 L660,250 L680,248 L700,245 L720,242 L735,240 L745,242 L752,245 L758,250 L762,258 L765,265 L768,275 L770,285 L768,295 L765,305 L760,312 L752,318 L745,322 L735,325 L725,328 L715,330 L705,332 L695,330 L685,328 L675,325 L665,320 L658,315 L652,310 L648,305 L645,298 L642,290 L638,282 L635,275 L632,268 L628,265 L625,262 Z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
      />

      <circle cx="148" cy="130" r="18" fill="url(#glow-sj)" />
      <circle cx="148" cy="130" r="5" fill={ORANGE} />
      <circle cx="148" cy="130" r="8" fill="none" stroke={ORANGE} strokeWidth="1" opacity="0.5">
        <animate attributeName="r" values="8;14;8" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite" />
      </circle>

      <circle cx="610" cy="155" r="18" fill="url(#glow-nd)" />
      <circle cx="610" cy="155" r="5" fill={ORANGE} />
      <circle cx="610" cy="155" r="8" fill="none" stroke={ORANGE} strokeWidth="1" opacity="0.5">
        <animate attributeName="r" values="8;14;8" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite" />
      </circle>

      <line x1="148" y1="130" x2="610" y2="155" stroke={ORANGE} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.3" />

      <text x="148" y="158" textAnchor="middle" fill={WHITE} fontSize="11" fontWeight="700" fontFamily="'Segoe UI', Arial, sans-serif">San Jose, CA</text>
      <text x="610" y="183" textAnchor="middle" fill={WHITE} fontSize="11" fontWeight="700" fontFamily="'Segoe UI', Arial, sans-serif">New Delhi, India</text>
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

      <div style={{ flex: 1, display: "flex", gap: 0, padding: "12px 28px 8px", position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: "100%", maxWidth: 420, position: "relative" }}>
            <WorldMapSVG />
          </div>
          <div style={{ display: "flex", gap: 40, marginTop: 8 }}>
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
