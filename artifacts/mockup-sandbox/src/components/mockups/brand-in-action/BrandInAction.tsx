const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const ORANGE_ACCENT = "#F96D3E";
const WHITE = "#FFFFFF";
const SOFT_GRAY = "#F2F4F7";
const LOGO_URL = "/brand/hirein-logo.svg";
const LOGO_MARK_URL = "/brand/hirein-logo-mark.svg";

const TEAL = "#0E9F8E";
const BLUE = "#2563EB";

function JobListingCard() {
  return (
    <div
      style={{
        background: WHITE,
        border: `1px solid #E2E8F0`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(31,58,110,0.10)",
        fontFamily: "Inter, sans-serif",
        width: "100%",
        maxWidth: 360,
      }}
    >
      <div
        style={{
          background: NAVY,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: ORANGE, fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>
          HEALTHCARE
        </span>
        <span
          style={{
            background: TEAL,
            color: WHITE,
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 20,
          }}
        >
          FULL-TIME
        </span>
      </div>
      <div style={{ padding: "16px 18px" }}>
        <h3
          style={{
            margin: "0 0 4px",
            fontSize: 17,
            fontWeight: 700,
            color: NAVY,
            fontFamily: "'Playfair Display', Georgia, serif",
          }}
        >
          Registered Nurse — ICU
        </h3>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748B" }}>
          📍 San Jose, CA &nbsp;·&nbsp; Posted 2 days ago
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          Join a leading regional medical centre. You'll work in a high-acuity ICU environment with a collaborative, patient-first team.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {["$95k–$115k/yr", "Joint Commission", "HIPAA Ready"].map((tag) => (
            <span
              key={tag}
              style={{
                background: SOFT_GRAY,
                color: "#334155",
                fontSize: 11,
                fontWeight: 500,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <button
          style={{
            background: `linear-gradient(90deg, ${ORANGE} 0%, ${ORANGE_ACCENT} 100%)`,
            color: WHITE,
            border: "none",
            borderRadius: 8,
            padding: "9px 0",
            width: "100%",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            letterSpacing: 0.3,
          }}
        >
          Apply Now →
        </button>
      </div>
    </div>
  );
}

function SocialHookCard() {
  return (
    <div
      style={{
        background: NAVY,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(31,58,110,0.25)",
        fontFamily: "Inter, sans-serif",
        width: "100%",
        maxWidth: 360,
        minHeight: 200,
        position: "relative",
      }}
    >
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${ORANGE} 0%, ${ORANGE_ACCENT} 100%)`,
        }}
      />
      <div style={{ padding: "20px 22px" }}>
        <span
          style={{
            background: ORANGE,
            color: WHITE,
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 20,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Insight · IT Staffing
        </span>
        <h2
          style={{
            margin: "14px 0 10px",
            color: WHITE,
            fontSize: 19,
            fontWeight: 700,
            lineHeight: 1.35,
            fontFamily: "'Playfair Display', Georgia, serif",
          }}
        >
          Your best candidate just accepted another offer. Here's why.
        </h2>
        <p style={{ margin: "0 0 18px", color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.55 }}>
          The 48-hour window most hiring teams miss — and how to close it.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: ORANGE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: WHITE,
              }}
            >
              PN
            </div>
            <div>
              <p style={{ margin: 0, color: WHITE, fontSize: 12, fontWeight: 600 }}>Priya Nair</p>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Director of Talent Solutions</p>
            </div>
          </div>
          <img
            src={LOGO_MARK_URL}
            alt="Hire'in"
            style={{ height: 28, width: "auto", opacity: 0.6, filter: "brightness(10)" }}
          />
        </div>
      </div>
    </div>
  );
}

function DashboardHeaderStrip() {
  return (
    <div
      style={{
        background: WHITE,
        border: `1px solid #E2E8F0`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(31,58,110,0.08)",
        fontFamily: "Inter, sans-serif",
        width: "100%",
        maxWidth: 360,
      }}
    >
      <div
        style={{
          background: NAVY,
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <img src={LOGO_URL} alt="Hire'in Solutions" style={{ height: 28, width: "auto" }} />
        <div style={{ display: "flex", gap: 8 }}>
          {["Dashboard", "Candidates", "Jobs"].map((item) => (
            <span key={item} style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, cursor: "pointer" }}>
              {item}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${ORANGE} 0%, ${ORANGE_ACCENT} 100%)`,
        }}
      />
      <div style={{ padding: "16px 18px" }}>
        <p style={{ margin: "0 0 2px", fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Welcome back
        </p>
        <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 700, color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }}>
          Good morning, Priya
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Active Jobs", value: "24", color: NAVY },
            { label: "Candidates", value: "138", color: BLUE },
            { label: "Placed (MTD)", value: "12", color: TEAL },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: SOFT_GRAY,
                borderRadius: 8,
                padding: "10px 12px",
                borderTop: `3px solid ${color}`,
              }}
            >
              <p style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 700, color }}>{value}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OfferLetterHeader() {
  return (
    <div
      style={{
        background: WHITE,
        border: `1px solid #E2E8F0`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(31,58,110,0.08)",
        fontFamily: "Inter, sans-serif",
        width: "100%",
        maxWidth: 360,
      }}
    >
      <div
        style={{
          background: NAVY,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <img src={LOGO_URL} alt="Hire'in Solutions" style={{ height: 32, width: "auto", marginBottom: 4 }} />
          <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: 0.5 }}>
            A Rayomind Company · hire-in.com
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: "0 0 2px", color: ORANGE, fontSize: 11, fontWeight: 600 }}>OFFER LETTER</p>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: 11 }}>Ref: HL-2026-0042</p>
        </div>
      </div>
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${ORANGE} 0%, ${ORANGE_ACCENT} 100%)`,
        }}
      />
      <div style={{ padding: "16px 20px" }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#94A3B8" }}>July 15, 2026</p>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#334155" }}>
          Dear <strong>Jordan Smith</strong>,
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
          We are pleased to extend an offer of employment for the position of{" "}
          <strong style={{ color: NAVY }}>Senior Software Engineer</strong> at{" "}
          <strong style={{ color: NAVY }}>Hire'in Solutions</strong>.
        </p>
        <div
          style={{
            background: SOFT_GRAY,
            borderRadius: 8,
            padding: "10px 14px",
            borderLeft: `3px solid ${ORANGE}`,
          }}
        >
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#64748B" }}>Annual Compensation</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NAVY }}>$145,000 / year</p>
        </div>
      </div>
    </div>
  );
}

export default function BrandInAction() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: SOFT_GRAY,
        padding: "32px 24px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ marginBottom: 28, borderBottom: `3px solid ${ORANGE}`, paddingBottom: 16 }}>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 11,
              fontWeight: 700,
              color: ORANGE,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            Brand in Action
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: NAVY,
              fontFamily: "'Playfair Display', Georgia, serif",
            }}
          >
            Hire'in Solutions — Brand Canvas
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>
            How the brand looks across real product surfaces: job listings, social cards, dashboards, and documents.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 600,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Job Listing Card
            </p>
            <JobListingCard />
          </div>

          <div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 600,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Social Hook Card
            </p>
            <SocialHookCard />
          </div>

          <div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 600,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Dashboard Header Strip
            </p>
            <DashboardHeaderStrip />
          </div>

          <div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 600,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Offer Letter Header
            </p>
            <OfferLetterHeader />
          </div>
        </div>

        <div
          style={{
            marginTop: 32,
            padding: "14px 20px",
            background: NAVY,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <img src={LOGO_MARK_URL} alt="" style={{ height: 24, width: "auto", opacity: 0.7, filter: "brightness(10)" }} />
          <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            All surfaces use <strong style={{ color: WHITE }}>Navy #1F3A6E</strong>,{" "}
            <strong style={{ color: ORANGE }}>Orange #F47C20</strong>, Playfair Display (headings), and Inter (body).
          </p>
        </div>
      </div>
    </div>
  );
}
