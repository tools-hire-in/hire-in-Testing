import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const WHITE = "#FFFFFF";
const LIGHT_BG = "#F5F7FA";

const DOMAIN_CONTEXT_LABELS: Record<string, string> = {
  healthcare: "US Healthcare Staffing",
  it: "US IT Staffing",
  engineering: "Engineering Staffing",
  professional_services: "Professional Services",
  general: "General Capability Deck",
};

interface BrandedSlideShellProps {
  slideTitle: string;
  bullets: string[];
  slideNumber: number;
  totalSlides: number;
  contextLabel?: string;
  domain?: string;
}

export function BrandedSlideShell({
  slideTitle,
  bullets,
  slideNumber,
  totalSlides,
  contextLabel,
  domain,
}: BrandedSlideShellProps) {
  const footerLabel = contextLabel ?? (domain ? (DOMAIN_CONTEXT_LABELS[domain] ?? "Hire'in Solutions") : "Hire'in Solutions");

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: LIGHT_BG,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 4px 32px rgba(31,58,110,0.18)",
        borderRadius: 6,
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: NAVY,
          padding: "14px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <p
            style={{
              color: ORANGE,
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontFamily: "'Segoe UI', Arial, sans-serif",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {slideTitle}
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 10.5,
              fontFamily: "'Segoe UI', Arial, sans-serif",
              margin: "3px 0 0",
              letterSpacing: 0.3,
            }}
          >
            {footerLabel} &middot; hire-in.com
          </p>
        </div>
        <img
          src={logoImage}
          alt="Hire'in Solutions"
          style={{
            height: 38,
            width: "auto",
            display: "block",
            objectFit: "contain",
            mixBlendMode: "screen",
            borderRadius: 4,
          }}
        />
      </div>

      {/* Orange accent bar */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${ORANGE} 0%, #F96D3E 100%)`,
          flexShrink: 0,
        }}
      />

      {/* Body — bullets */}
      <div
        style={{
          flex: 1,
          padding: "18px 40px 14px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          justifyContent: "center",
        }}
      >
        {bullets.map((bullet, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: ORANGE,
                flexShrink: 0,
                marginTop: 6,
              }}
            />
            <p
              style={{
                color: "#1a1a1a",
                fontSize: 13,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {bullet}
            </p>
          </div>
        ))}
        {bullets.length === 0 && (
          <p style={{ color: "#9CA3AF", fontSize: 13, fontFamily: "'Segoe UI', Arial, sans-serif", fontStyle: "italic" }}>
            No content yet.
          </p>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 36px",
          background: NAVY,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={logoImage}
            alt="Hire'in Solutions"
            style={{
              height: 22,
              width: "auto",
              display: "block",
              objectFit: "contain",
              mixBlendMode: "screen",
              borderRadius: 4,
            }}
          />
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>|</span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
            <span
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                letterSpacing: 0.1,
              }}
            >
              Hire&apos;in Solutions
            </span>
            <span
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 9.5,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                letterSpacing: 0.3,
              }}
            >
              A Rayomind Company
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 10,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            {footerLabel}
          </span>
          {slideNumber > 0 && totalSlides > 0 && (
            <span
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 9.5,
                fontWeight: 600,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                letterSpacing: 0.5,
              }}
            >
              {slideNumber} / {totalSlides}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
