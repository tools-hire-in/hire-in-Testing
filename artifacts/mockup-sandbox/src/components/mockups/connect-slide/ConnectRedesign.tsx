import { Mail, Globe, Linkedin, MapPin, Brain } from "lucide-react";

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const ORANGE2 = "#F96D3E";
const WHITE = "#FFFFFF";

function WorldMapWithPins() {
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1816/740" }}>
      <img
        src="/__mockup/images/world-map.png"
        alt="World Map"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: 0.18,
          filter: "brightness(2.5)",
        }}
      />
      <svg
        viewBox="0 0 1816 740"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
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

        <path d="M 480,460 Q 780,350 1110,550" fill="none" stroke={ORANGE} strokeWidth="1.8" strokeDasharray="8 6" opacity="0.35" />

        <circle cx="480" cy="460" r="50" fill="url(#cr-glow1)" />
        <circle cx="480" cy="460" r="12" fill={ORANGE} />
        <circle cx="480" cy="460" r="24" fill="none" stroke={ORANGE} strokeWidth="1.5" opacity="0.4">
          <animate attributeName="r" values="24;42;24" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
        </circle>

        <circle cx="1110" cy="550" r="50" fill="url(#cr-glow2)" />
        <circle cx="1110" cy="550" r="12" fill={ORANGE} />
        <circle cx="1110" cy="550" r="24" fill="none" stroke={ORANGE} strokeWidth="1.5" opacity="0.4">
          <animate attributeName="r" values="24;42;24" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
        </circle>

        <text x="480" y="510" textAnchor="middle" fill={WHITE} fontSize="22" fontWeight="700" fontFamily="'Segoe UI', Arial, sans-serif">San Jose, CA</text>
        <text x="1110" y="600" textAnchor="middle" fill={WHITE} fontSize="22" fontWeight="700" fontFamily="'Segoe UI', Arial, sans-serif">New Delhi, India</text>
      </svg>
    </div>
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
            <WorldMapWithPins />
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
