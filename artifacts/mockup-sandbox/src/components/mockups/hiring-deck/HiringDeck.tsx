import React from "react";
import {
  Brain,
  Building2,
  CheckCircle,
  ChevronRight,
  Clock,
  Code2,
  Cloud,
  Database,
  Download,
  FileSearch,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Monitor,
  Phone,
  Shield,
  ShieldCheck,
  Smartphone,
  Star,
  Target,
  TestTube,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import html2canvas from "html2canvas";
import pptxgen from "pptxgenjs";

const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";
const ORANGE2 = "#F96D3E";
const WHITE = "#FFFFFF";
const LIGHT_BG = "#F5F7FA";
const LIGHT2 = "#EEF2F8";
const SlideNumberContext = React.createContext({ slideNumber: 0, totalSlides: 11 });

function HISLogo({ size = 40, light = false }: { size?: number; light?: boolean }) {
  return (
    <img
      src="/__mockup/images/his-logo.jpg"
      alt="Hire'in Solutions"
      style={{
        height: size * 1.1,
        width: "auto",
        display: "block",
        flexShrink: 0,
        objectFit: "contain",
        mixBlendMode: light ? "screen" : "normal",
        borderRadius: 4,
      }}
    />
  );
}

function RayomindBadge({ size = 28, light = false }: { size?: number; light?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        opacity: 0.85,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: light ? "rgba(255,255,255,0.15)" : NAVY2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: size * 0.44,
          color: ORANGE,
          fontFamily: "'Segoe UI', Arial, sans-serif",
        }}
      >
        R
      </div>
      <span
        style={{
          fontWeight: 700,
          fontSize: size * 0.5,
          color: light ? "rgba(255,255,255,0.75)" : NAVY,
          fontFamily: "'Segoe UI', Arial, sans-serif",
          letterSpacing: 0.3,
        }}
      >
        Rayomind
      </span>
    </div>
  );
}

function SlideFooter() {
  const { slideNumber, totalSlides } = React.useContext(SlideNumberContext);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 36px",
        background: NAVY,
        marginTop: "auto",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <HISLogo size={22} light />
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
            color: "rgba(255,255,255,0.45)",
            fontSize: 10,
            fontFamily: "'Segoe UI', Arial, sans-serif",
          }}
        >
          US IT Staffing · hire-in.com
        </span>
        {slideNumber > 0 && (
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
  );
}

function SlideWrapper({
  children,
  bg = WHITE,
  noFooter = false,
}: {
  children: React.ReactNode;
  bg?: string;
  noFooter?: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 4px 32px rgba(31,58,110,0.18)",
        borderRadius: 6,
        position: "relative",
      }}
    >
      {children}
      {!noFooter && <SlideFooter />}
    </div>
  );
}

/* ── SLIDE 1: COVER ── */
function Slide1Cover() {
  const { slideNumber, totalSlides } = React.useContext(SlideNumberContext);
  return (
    <SlideWrapper bg={NAVY} noFooter>
      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Left decorative accent */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: `linear-gradient(180deg, ${ORANGE} 0%, ${ORANGE2} 100%)`,
          }}
        />
        {/* Geometric BG shapes */}
        <div
          style={{
            position: "absolute",
            right: -80,
            top: -80,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "rgba(244,124,32,0.07)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 60,
            bottom: -120,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "rgba(244,124,32,0.05)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 180,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            opacity: 0.12,
          }}
        >
          {[Brain, Users, Code2, Shield, Zap].map((Icon, i) => (
            <Icon key={i} size={38} color={ORANGE} />
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "36px 56px",
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 32,
            }}
          >
            <HISLogo size={52} light />
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(244,124,32,0.18)",
              border: "1px solid rgba(244,124,32,0.35)",
              borderRadius: 20,
              padding: "4px 14px",
              marginBottom: 18,
              width: "fit-content",
            }}
          >
            <Brain size={12} color={ORANGE} />
            <span
              style={{
                color: ORANGE,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1.2,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                textTransform: "uppercase",
              }}
            >
              AI-Enhanced Recruiting
            </span>
          </div>

          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: WHITE,
              fontFamily: "'Segoe UI', Arial, sans-serif",
              lineHeight: 1.08,
              letterSpacing: -1,
              marginBottom: 6,
            }}
          >
            Hire&apos;in Solutions
          </h1>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: ORANGE,
              fontFamily: "'Segoe UI', Arial, sans-serif",
              letterSpacing: 0.4,
              marginBottom: 20,
            }}
          >
            US IT Staffing · Powered by AI
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.72)",
              fontFamily: "'Segoe UI', Arial, sans-serif",
              fontStyle: "italic",
              letterSpacing: 0.3,
            }}
          >
            &ldquo;The Right Tech Talent, Right Now&rdquo;
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              marginTop: 22,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "8px 0",
              width: "fit-content",
            }}
          >
            {[
              "500+ IT Placements",
              "48-Hour First Submissions",
              "95% Client Retention",
            ].map((stat, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <div
                    style={{
                      width: 1,
                      height: 20,
                      background: "rgba(244,124,32,0.4)",
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 11.5,
                    fontWeight: 700,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    letterSpacing: 0.3,
                    padding: "0 16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stat}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div
          style={{
            width: 280,
            background: "rgba(255,255,255,0.04)",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
            padding: 28,
          }}
        >
          {[
            { icon: Brain, label: "AI-Powered Matching" },
            { icon: Code2, label: "IT Specialists" },
            { icon: Zap, label: "Fastest Fill Time" },
            { icon: ShieldCheck, label: "Compliance-First" },
          ].map(({ icon: Icon, label }, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: "rgba(244,124,32,0.15)",
                  border: "1px solid rgba(244,124,32,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={20} color={ORANGE} />
              </div>
              <span
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 9.5,
                  fontWeight: 500,
                  textAlign: "center",
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 36px",
          background: "rgba(255,255,255,0.05)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HISLogo size={22} light />
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>|</span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Hire&apos;in Solutions</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>A Rayomind Company</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 10,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            hire-in.com · hello@hire-in.com
          </span>
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: ORANGE,
              opacity: 0.6,
            }}
          />
          <span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 10,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            Confidential · 2026
          </span>
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: ORANGE,
              opacity: 0.6,
            }}
          />
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
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── SLIDE 2: BY THE NUMBERS ── */
function Slide2ByTheNumbers() {
  const metrics = [
    { value: "500+", label: "IT Placements", sub: "Across all technology verticals" },
    { value: "< 5 Days", label: "Avg Fill Time", sub: "From intake to qualified submission" },
    { value: "95%+", label: "Client Retention", sub: "Year-over-year partnership renewals" },
    { value: "50", label: "US States Covered", sub: "True coast-to-coast reach" },
    { value: "25K+", label: "Candidate Database", sub: "Pre-vetted IT professionals" },
    { value: "92%", label: "AI Match Accuracy", sub: "Powered by Kleriq AI scoring" },
  ];

  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div
        style={{
          background: NAVY,
          padding: "16px 36px",
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
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            Proven Track Record
          </p>
          <h2
            style={{
              color: WHITE,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            By the Numbers
          </h2>
        </div>
        <HISLogo size={32} light />
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          padding: "20px 36px 14px",
          alignContent: "center",
        }}
      >
        {metrics.map(({ value, label, sub }, i) => (
          <div
            key={i}
            style={{
              background: WHITE,
              borderRadius: 12,
              padding: "20px 18px",
              boxShadow: "0 2px 12px rgba(31,58,110,0.09)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 4,
              borderTop: `3px solid ${i % 2 === 0 ? ORANGE : NAVY}`,
            }}
          >
            <p
              style={{
                color: i % 2 === 0 ? ORANGE : NAVY,
                fontSize: 28,
                fontWeight: 900,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                lineHeight: 1,
              }}
            >
              {value}
            </p>
            <p
              style={{
                color: NAVY,
                fontSize: 12.5,
                fontWeight: 800,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                marginTop: 2,
              }}
            >
              {label}
            </p>
            <p
              style={{
                color: "#6B7280",
                fontSize: 9.5,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                lineHeight: 1.4,
              }}
            >
              {sub}
            </p>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}

/* ── SLIDE 3: ABOUT US ── */
function Slide3About() {
  return (
    <SlideWrapper bg={LIGHT_BG}>
      {/* Header */}
      <div
        style={{
          background: NAVY,
          padding: "16px 36px",
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
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            Who We Are
          </p>
          <h2
            style={{
              color: WHITE,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Segoe UI', Arial, sans-serif",
              lineHeight: 1.1,
            }}
          >
            About Hire&apos;in Solutions
          </h2>
        </div>
        <HISLogo size={32} light />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 20,
          padding: "18px 36px 12px",
          overflow: "hidden",
        }}
      >
        {/* Mission card */}
        <div
          style={{
            flex: 1.2,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              background: WHITE,
              borderRadius: 10,
              padding: "16px 20px",
              borderLeft: `4px solid ${ORANGE}`,
              boxShadow: "0 2px 12px rgba(31,58,110,0.08)",
            }}
          >
            <p
              style={{
                color: ORANGE,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 6,
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              Our Mission
            </p>
            <p
              style={{
                color: NAVY,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.5,
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              Est. 2014 · 60+ recruiters nationwide. We connect US enterprises with elite IT talent — faster, smarter, and more precisely than any traditional staffing firm. Headquartered in San Jose, CA, serving clients coast to coast.
            </p>
          </div>

          <div
            style={{
              background: NAVY,
              borderRadius: 10,
              padding: "16px 20px",
              boxShadow: "0 2px 12px rgba(31,58,110,0.12)",
            }}
          >
            <p
              style={{
                color: ORANGE,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 8,
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              The Rayomind Family
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 12.5,
                lineHeight: 1.55,
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              Hire&apos;in Solutions is a US-based staffing firm and proud member of the <strong style={{ color: ORANGE }}>Rayomind</strong> group — a technology-driven ecosystem building next-generation workforce solutions. We leverage best-in-class AI tools including <strong style={{ color: ORANGE }}>Kleriq AI</strong> for job analysis, resume matching, and candidate screening — ensuring every submission is a strong fit.
              <span style={{ display: "block", marginTop: 6, fontSize: 9.5, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>A subsidiary of Rayomind Inc.</span>
            </p>
          </div>
        </div>

        {/* Stats + values */}
        <div
          style={{
            flex: 0.8,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {[
            { icon: Target, label: "IT-Exclusive Focus", desc: "100% dedicated to technology staffing" },
            { icon: Brain, label: "AI-Powered Matching", desc: "92% match accuracy via Kleriq AI" },
            { icon: Users, label: "60+ Expert Recruiters", desc: "Domain-specialist IT recruitment teams" },
            { icon: Globe, label: "All 50 US States", desc: "True coast-to-coast talent coverage" },
          ].map(({ icon: Icon, label, desc }, i) => (
            <div
              key={i}
              style={{
                background: WHITE,
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                boxShadow: "0 1px 6px rgba(31,58,110,0.07)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: LIGHT2,
                  border: `1.5px solid ${ORANGE}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={15} color={ORANGE} />
              </div>
              <div>
                <p
                  style={{
                    color: NAVY,
                    fontSize: 11.5,
                    fontWeight: 700,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    marginBottom: 1,
                  }}
                >
                  {label}
                </p>
                <p
                  style={{
                    color: "#6B7280",
                    fontSize: 10,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                  }}
                >
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </SlideWrapper>
  );
}

/* ── SLIDE 4: IT SERVICES ── */
function Slide4Services() {
  const services = [
    {
      icon: UserCheck,
      title: "Permanent IT Hiring",
      desc: "Full-time placement of vetted IT professionals matched via AI-powered tools to your exact role requirements.",
      bullets: ["Culture-fit scoring", "Technical assessment", "End-to-end onboarding"],
    },
    {
      icon: Clock,
      title: "Contract IT Staffing",
      desc: "Flexible contract talent for project peaks, product launches, or technology transitions.",
      bullets: ["Short & long-term contracts", "Bench-ready talent", "Rapid deployment"],
    },
    {
      icon: Code2,
      title: "Project-Based IT",
      desc: "Dedicated teams assembled for specific deliverables — from MVPs to enterprise transformation.",
      bullets: ["Team composition by need", "Milestone-based engagement", "Full accountability"],
    },
    {
      icon: TrendingUp,
      title: "RPO (Recruitment Process Outsourcing)",
      desc: "End-to-end outsourcing of your IT hiring pipeline — AI-assisted from intake to offer.",
      bullets: ["SLA-backed delivery", "Dedicated talent desk", "ATS integration"],
    },
  ];

  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div
        style={{
          background: NAVY,
          padding: "16px 36px",
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
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            What We Offer
          </p>
          <h2
            style={{
              color: WHITE,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            IT Staffing Services
          </h2>
        </div>
        <HISLogo size={32} light />
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          padding: "16px 36px 12px",
        }}
      >
        {services.map(({ icon: Icon, title, desc, bullets }, i) => (
          <div
            key={i}
            style={{
              background: WHITE,
              borderRadius: 10,
              padding: "14px 16px",
              boxShadow: "0 2px 10px rgba(31,58,110,0.09)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={17} color={WHITE} />
              </div>
              <h3
                style={{
                  color: NAVY,
                  fontSize: 13.5,
                  fontWeight: 800,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                {title}
              </h3>
            </div>
            <p
              style={{
                color: "#4B5563",
                fontSize: 10.5,
                lineHeight: 1.5,
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              {desc}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {bullets.map((b, j) => (
                <div
                  key={j}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <CheckCircle size={11} color={ORANGE} />
                  <span
                    style={{
                      color: "#374151",
                      fontSize: 10,
                      fontFamily: "'Segoe UI', Arial, sans-serif",
                    }}
                  >
                    {b}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </SlideWrapper>
  );
}

/* ── SLIDE 5: STAFFING MODELS ── */
function Slide5Models() {
  const models = [
    {
      name: "Permanent",
      color: NAVY,
      benefits: [
        "Full-time employment",
        "AI-matched culture fit",
        "90-day replacement guarantee",
        "Background verification included",
      ],
    },
    {
      name: "Contract",
      color: "#1E5C9C",
      benefits: [
        "Flexible contract durations",
        "Bench-ready talent pool",
        "Weekly/fortnightly billing",
        "Rapid < 72-hour deployment",
      ],
    },
    {
      name: "Project-Based",
      color: ORANGE,
      benefits: [
        "Dedicated project teams",
        "Milestone billing model",
        "Technical lead included",
        "End-to-end accountability",
      ],
    },
    {
      name: "RPO",
      color: ORANGE2,
      benefits: [
        "Full pipeline outsourcing",
        "SLA-guaranteed delivery",
        "Dedicated talent desk",
        "AI-driven automation",
      ],
    },
  ];

  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div
        style={{
          background: NAVY,
          padding: "16px 36px",
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
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            Engagement Models
          </p>
          <h2
            style={{
              color: WHITE,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            Our Staffing Models
          </h2>
        </div>
        <HISLogo size={32} light />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "16px 36px 12px",
          gap: 10,
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 1fr 1fr 1fr",
            gap: 8,
          }}
        >
          <div />
          {models.map((m, i) => (
            <div
              key={i}
              style={{
                background: m.color,
                borderRadius: 8,
                padding: "8px 10px",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  color: WHITE,
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                {m.name}
              </span>
            </div>
          ))}
        </div>

        {/* Benefit rows */}
        {[0, 1, 2, 3].map((rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr 1fr 1fr 1fr",
              gap: 8,
            }}
          >
            <div
              style={{
                background: WHITE,
                borderRadius: 6,
                padding: "7px 12px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  color: NAVY,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                {["Engagement Type", "Billing Model", "Guarantee", "Deployment Speed"][rowIdx]}
              </span>
            </div>
            {models.map((m, colIdx) => (
              <div
                key={colIdx}
                style={{
                  background: WHITE,
                  borderRadius: 6,
                  padding: "7px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 1px 4px rgba(31,58,110,0.06)",
                }}
              >
                <CheckCircle size={11} color={m.color} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    color: "#374151",
                    fontSize: 9.5,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    lineHeight: 1.35,
                  }}
                >
                  {m.benefits[rowIdx]}
                </span>
              </div>
            ))}
          </div>
        ))}

        {/* Bottom note */}
        <div
          style={{
            background: NAVY,
            borderRadius: 8,
            padding: "9px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Brain size={14} color={ORANGE} />
          <span
            style={{
              color: "rgba(255,255,255,0.88)",
              fontSize: 11,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            All models are supported by{" "}
            <strong style={{ color: ORANGE }}>AI-driven tools</strong> — ensuring
            precision matching, faster screening, and compliance-first
            workflows.
          </span>
        </div>
      </div>

    </SlideWrapper>
  );
}

/* ── SLIDE 6: AI TOOLS ── */
function Slide6KleriqAI() {
  const features = [
    {
      icon: FileSearch,
      title: "Resume Parsing & Analysis",
      desc: "AI scans and structures candidate resumes to extract skills, experience, and role fit in seconds.",
    },
    {
      icon: Target,
      title: "Job Description Matching",
      desc: "Semantically aligns job requirements to candidate profiles — far beyond simple keyword search.",
    },
    {
      icon: MessageSquare,
      title: "Candidate Pre-Screening",
      desc: "AI-driven screening conversations that qualify candidates at scale before human review.",
    },
    {
      icon: Shield,
      title: "Bias-Free Shortlisting",
      desc: "Evaluates candidates purely on skills, experience, and role fit — removing demographic bias.",
    },
    {
      icon: Star,
      title: "Fit Scoring & Ranking",
      desc: "Dynamic candidate ranking updated in real time as new information is captured through the pipeline.",
    },
  ];

  return (
    <SlideWrapper bg={NAVY} noFooter>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 36px 14px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(244,124,32,0.2)",
                border: "1px solid rgba(244,124,32,0.4)",
                borderRadius: 20,
                padding: "3px 12px",
                marginBottom: 8,
              }}
            >
              <Brain size={11} color={ORANGE} />
              <span
                style={{
                  color: ORANGE,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                Smarter Hiring
              </span>
            </div>
            <h2
              style={{
                color: WHITE,
                fontSize: 26,
                fontWeight: 900,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                lineHeight: 1.1,
              }}
            >
              AI Tools We Leverage
            </h2>
            <p
              style={{
                color: ORANGE,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                marginTop: 2,
              }}
            >
              Including Kleriq AI for job analysis, matching & screening
            </p>
          </div>
          <HISLogo size={34} light />
        </div>

        {/* Feature grid */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            padding: "0 36px 14px",
          }}
        >
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(244,124,32,0.25)",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                gridColumn: i === 4 ? "2 / 3" : undefined,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={18} color={WHITE} />
              </div>
              <h4
                style={{
                  color: WHITE,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h4>
              <p
                style={{
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 10.5,
                  lineHeight: 1.5,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                {desc}
              </p>
            </div>
          ))}

          {/* CTA box */}
          <div
            style={{
              background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`,
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Zap size={22} color={WHITE} />
            <h4
              style={{
                color: WHITE,
                fontSize: 13,
                fontWeight: 800,
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              Why AI-Assisted Hiring Wins
            </h4>
            <p
              style={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 10,
                lineHeight: 1.5,
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              By partnering with leading AI tools, we bring enterprise-grade intelligence to every search — delivering better candidates, faster.
            </p>
          </div>
        </div>

        <SlideFooter />
      </div>
    </SlideWrapper>
  );
}

/* ── SLIDE 7: HIRE'IN ADVANTAGE ── */
function Slide7Advantage() {
  const advantages = [
    {
      icon: Brain,
      title: "AI-Assisted Matching",
      desc: "We leverage best-in-class AI tools to parse, score, and rank candidates with precision — reducing mis-hires and cutting time-to-shortlist by up to 70%.",
      highlight: "70% Faster Shortlisting",
    },
    {
      icon: Code2,
      title: "IT Domain Experts",
      desc: "Every recruiter on our team is an IT-specialist. We speak your tech stack fluently — from Java to Kubernetes, from React to SAP.",
      highlight: "60+ IT-Only Recruiters",
    },
    {
      icon: ShieldCheck,
      title: "Compliance-First",
      desc: "Built-in US compliance workflows covering I-9 verification, E-Verify, background checks, and federal/state employment law — so you hire with zero legal risk.",
      highlight: "Zero-Risk: I-9 + E-Verify",
    },
    {
      icon: Zap,
      title: "Fastest Time-to-Fill",
      desc: "With AI-assisted pre-screening running continuously, we deliver qualified submissions in as few as 48 hours for most IT roles.",
      highlight: "First Profiles in 48 Hours",
    },
  ];

  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div
        style={{
          background: NAVY,
          padding: "16px 36px",
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
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            Why Choose Us
          </p>
          <h2
            style={{
              color: WHITE,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            The Hire&apos;in Advantage
          </h2>
        </div>
        <HISLogo size={32} light />
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          padding: "16px 36px 12px",
        }}
      >
        {advantages.map(({ icon: Icon, title, desc, highlight }, i) => (
          <div
            key={i}
            style={{
              background: WHITE,
              borderRadius: 10,
              padding: "16px 18px",
              boxShadow: "0 2px 12px rgba(31,58,110,0.09)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 80,
                height: 80,
                background: `rgba(244,124,32,0.05)`,
                borderRadius: "0 10px 0 80px",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: NAVY,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} color={ORANGE} />
              </div>
              <h3
                style={{
                  color: NAVY,
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                {title}
              </h3>
            </div>
            <p
              style={{
                color: "#4B5563",
                fontSize: 10.5,
                lineHeight: 1.55,
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              {desc}
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: `rgba(244,124,32,0.12)`,
                border: `1px solid ${ORANGE}`,
                borderRadius: 6,
                padding: "3px 10px",
                width: "fit-content",
              }}
            >
              <Star size={10} color={ORANGE} />
              <span
                style={{
                  color: ORANGE,
                  fontSize: 9.5,
                  fontWeight: 700,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                {highlight}
              </span>
            </div>
          </div>
        ))}
      </div>

    </SlideWrapper>
  );
}

/* ── SLIDE 8: SOURCING PROCESS ── */
function Slide8Process() {
  const steps = [
    { icon: Building2, label: "Intake", desc: "Understand role, team, culture & tech stack", color: NAVY },
    { icon: Brain, label: "AI Sourcing", sub: "AI-powered", desc: "AI-driven sourcing & intelligent matching", color: ORANGE },
    { icon: UserCheck, label: "Screening", desc: "Technical + cultural fit validation", color: NAVY },
    { icon: FileSearch, label: "Submit", desc: "Curated shortlist with score cards", color: ORANGE },
    { icon: CheckCircle, label: "Onboard", desc: "Seamless joining & compliance closure", color: NAVY },
  ];

  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div
        style={{
          background: NAVY,
          padding: "16px 36px",
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
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            How It Works
          </p>
          <h2
            style={{
              color: WHITE,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            Our Sourcing Process
          </h2>
        </div>
        <HISLogo size={32} light />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "20px 36px 12px",
          gap: 20,
        }}
      >
        {/* Pipeline */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
          }}
        >
          {steps.map(({ icon: Icon, label, sub, desc, color }, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 14,
                    background: color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 4px 16px ${color}44`,
                  }}
                >
                  <Icon size={26} color={WHITE} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p
                    style={{
                      color: NAVY,
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: "'Segoe UI', Arial, sans-serif",
                    }}
                  >
                    {label}
                  </p>
                  {sub && (
                    <p
                      style={{
                        color: ORANGE,
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: "'Segoe UI', Arial, sans-serif",
                      }}
                    >
                      {sub}
                    </p>
                  )}
                </div>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight size={22} color={ORANGE} style={{ flexShrink: 0, opacity: 0.7 }} />
              )}
            </div>
          ))}
        </div>

        {/* Step details */}
        <div style={{ display: "flex", gap: 10 }}>
          {steps.map(({ desc, label, color }, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: WHITE,
                borderRadius: 8,
                padding: "10px 12px",
                borderTop: `3px solid ${color}`,
                boxShadow: "0 1px 6px rgba(31,58,110,0.07)",
              }}
            >
              <p
                style={{
                  color: "#374151",
                  fontSize: 9.5,
                  lineHeight: 1.45,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                  textAlign: "center",
                }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>

        {/* Kleriq AI note */}
        <div
          style={{
            background: NAVY,
            borderRadius: 8,
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Brain size={15} color={ORANGE} />
          <span
            style={{
              color: "rgba(255,255,255,0.88)",
              fontSize: 11,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            <strong style={{ color: ORANGE }}>AI-powered tools</strong> are active throughout the pipeline — continuously scoring, ranking, and surfacing the best-fit candidates automatically.
          </span>
        </div>
      </div>

    </SlideWrapper>
  );
}

/* ── SLIDE 9: DEMAND FULFILLMENT ── */
function Slide9Fulfillment() {
  const stages = [
    { label: "Demand", icon: Building2, desc: "Client raises requisition" },
    { label: "Review", icon: FileSearch, desc: "JD analysis by talent team" },
    { label: "Priorities", icon: Target, desc: "Role classification & urgency" },
    { label: "Allocation", icon: Users, desc: "Recruiter + AI tools assigned" },
    { label: "Submissions", icon: UserCheck, desc: "Vetted profiles delivered" },
    { label: "Quality", icon: ShieldCheck, desc: "Score validation & review" },
    { label: "Client", icon: Star, desc: "Offer & onboarding stage" },
  ];

  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div
        style={{
          background: NAVY,
          padding: "16px 36px",
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
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            SLA-Driven Model
          </p>
          <h2
            style={{
              color: WHITE,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            Demand Fulfillment Framework
          </h2>
        </div>
        <HISLogo size={32} light />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "16px 36px 12px",
          gap: 16,
        }}
      >
        {/* Flow */}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {stages.map(({ label, icon: Icon }, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", flex: 1 }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background:
                      i % 2 === 0
                        ? NAVY
                        : `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 3px 10px rgba(31,58,110,0.2)",
                  }}
                >
                  <Icon size={20} color={WHITE} />
                </div>
                <span
                  style={{
                    color: NAVY,
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    textAlign: "center",
                  }}
                >
                  {label}
                </span>
              </div>
              {i < stages.length - 1 && (
                <ChevronRight
                  size={16}
                  color={ORANGE}
                  style={{ flexShrink: 0, opacity: 0.6 }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Detail cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {stages.map(({ desc }, i) => (
            <div
              key={i}
              style={{
                background: WHITE,
                borderRadius: 7,
                padding: "8px 8px",
                textAlign: "center",
                boxShadow: "0 1px 5px rgba(31,58,110,0.07)",
              }}
            >
              <p
                style={{
                  color: "#4B5563",
                  fontSize: 9,
                  lineHeight: 1.4,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>

        {/* SLA metrics */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 10,
          }}
        >
          {[
            { metric: "< 24 hrs", label: "Demand Acknowledgement" },
            { metric: "48–72 hrs", label: "First Submissions" },
            { metric: "≥ 95%", label: "Submission Quality Score" },
            { metric: "100%", label: "Compliance Coverage" },
          ].map(({ metric, label }, i) => (
            <div
              key={i}
              style={{
                background: NAVY,
                borderRadius: 8,
                padding: "10px 12px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  color: ORANGE,
                  fontSize: 18,
                  fontWeight: 900,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                  lineHeight: 1,
                }}
              >
                {metric}
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 9,
                  marginTop: 3,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

    </SlideWrapper>
  );
}

/* ── SLIDE 10: IT DOMAINS ── */
function Slide10Domains() {
  const domains = [
    { icon: Code2, label: "Java / Microsoft", color: "#1565C0" },
    { icon: Cloud, label: "Cloud & DevOps", color: "#0277BD" },
    { icon: Database, label: "Data & AI", color: "#283593" },
    { icon: Shield, label: "Cybersecurity", color: "#B71C1C" },
    { icon: Smartphone, label: "Mobility", color: "#1B5E20" },
    { icon: TestTube, label: "QA & Testing", color: "#4A148C" },
    { icon: Monitor, label: "Project Mgmt", color: "#E65100" },
  ];

  const models = ["Permanent", "Contract", "Project", "RPO"];
  const modelColors = [NAVY, "#1E5C9C", ORANGE, ORANGE2];

  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div
        style={{
          background: NAVY,
          padding: "16px 36px",
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
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            Technology Verticals
          </p>
          <h2
            style={{
              color: WHITE,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            IT Domains We Cover
          </h2>
        </div>
        <HISLogo size={32} light />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "14px 36px 12px",
          gap: 12,
        }}
      >
        {/* Domain cards */}
        <div style={{ display: "flex", gap: 10 }}>
          {domains.map(({ icon: Icon, label, color }, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: WHITE,
                borderRadius: 8,
                padding: "10px 8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 1px 6px rgba(31,58,110,0.08)",
                borderTop: `3px solid ${color}`,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: `${color}18`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={16} color={color} />
              </div>
              <span
                style={{
                  color: NAVY,
                  fontSize: 9.5,
                  fontWeight: 700,
                  textAlign: "center",
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                  lineHeight: 1.3,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Grid matrix */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
              gap: 6,
            }}
          >
            <div
              style={{
                background: NAVY,
                borderRadius: 6,
                padding: "7px 10px",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  color: ORANGE,
                  fontSize: 9.5,
                  fontWeight: 700,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              >
                Domain
              </span>
            </div>
            {models.map((m, i) => (
              <div
                key={i}
                style={{
                  background: modelColors[i],
                  borderRadius: 6,
                  padding: "7px 6px",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    color: WHITE,
                    fontSize: 9.5,
                    fontWeight: 700,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                  }}
                >
                  {m}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {domains.map(({ label }, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
                gap: 6,
              }}
            >
              <div
                style={{
                  background: WHITE,
                  borderRadius: 5,
                  padding: "5px 10px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    color: NAVY,
                    fontSize: 9.5,
                    fontWeight: 600,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                  }}
                >
                  {label}
                </span>
              </div>
              {models.map((_, j) => (
                <div
                  key={j}
                  style={{
                    background: WHITE,
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "5px",
                  }}
                >
                  <CheckCircle size={13} color={modelColors[j]} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

    </SlideWrapper>
  );
}

/* ── SLIDE 11: LET'S CONNECT ── */
function Slide11Connect() {
  const { slideNumber, totalSlides } = React.useContext(SlideNumberContext);
  return (
    <SlideWrapper bg={NAVY} noFooter>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* BG shapes */}
        <div
          style={{
            position: "absolute",
            left: -100,
            bottom: -100,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(244,124,32,0.07)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -60,
            top: -60,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.03)",
          }}
        />

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: "24px 36px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <HISLogo size={50} light />
          </div>

          <div style={{ textAlign: "center" }}>
            <p
              style={{
                color: ORANGE,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontFamily: "'Segoe UI', Arial, sans-serif",
                marginBottom: 8,
              }}
            >
              Ready to Hire Smarter?
            </p>
            <h2
              style={{
                color: WHITE,
                fontSize: 34,
                fontWeight: 900,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                lineHeight: 1.1,
                letterSpacing: -0.5,
                marginBottom: 6,
              }}
            >
              Let&apos;s Connect
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 13,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                fontStyle: "italic",
              }}
            >
              &ldquo;The Right Tech Talent, Right Now&rdquo;
            </p>
          </div>

          {/* Contact items */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { icon: Globe, label: "hire-in.com", sub: "Website" },
              { icon: Mail, label: "hello@hire-in.com", sub: "Email" },
              { icon: MapPin, label: "San Jose, CA · USA", sub: "Headquarters" },
              { icon: Phone, label: "LinkedIn", sub: "Connect with us" },
            ].map(({ icon: Icon, label, sub }, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(244,124,32,0.3)",
                  borderRadius: 12,
                  padding: "16px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minWidth: 200,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={WHITE} />
                </div>
                <div>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      fontFamily: "'Segoe UI', Arial, sans-serif",
                    }}
                  >
                    {sub}
                  </p>
                  <p
                    style={{
                      color: WHITE,
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "'Segoe UI', Arial, sans-serif",
                    }}
                  >
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Kleriq AI badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(244,124,32,0.15)",
              border: "1px solid rgba(244,124,32,0.35)",
              borderRadius: 24,
              padding: "6px 18px",
            }}
          >
            <Brain size={13} color={ORANGE} />
            <span
              style={{
                color: ORANGE,
                fontSize: 10.5,
                fontWeight: 600,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                letterSpacing: 0.5,
              }}
            >
              AI-Enhanced Recruiting
            </span>
          </div>
        </div>

        {/* Footer bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 36px",
            background: "rgba(255,255,255,0.04)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HISLogo size={22} light />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>|</span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Hire&apos;in Solutions</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>A Rayomind Company</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 9.5,
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              © 2026 Hire&apos;in Solutions · US IT Staffing · Confidential
            </span>
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
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── MAIN DECK ── */
export function HiringDeck() {
  const [downloading, setDownloading] = React.useState(false);
  const slideRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  const slides = [
    { id: 1, title: "Cover", component: <Slide1Cover /> },
    { id: 2, title: "By the Numbers", component: <Slide2ByTheNumbers /> },
    { id: 3, title: "About Us", component: <Slide3About /> },
    { id: 4, title: "IT Services", component: <Slide4Services /> },
    { id: 5, title: "Staffing Models", component: <Slide5Models /> },
    { id: 6, title: "AI Tools We Leverage", component: <Slide6KleriqAI /> },
    { id: 7, title: "The Hire'in Advantage", component: <Slide7Advantage /> },
    { id: 8, title: "Sourcing Process", component: <Slide8Process /> },
    { id: 9, title: "Demand Fulfillment", component: <Slide9Fulfillment /> },
    { id: 10, title: "IT Domains", component: <Slide10Domains /> },
    { id: 11, title: "Let's Connect", component: <Slide11Connect /> },
  ];

  async function downloadPPT() {
    setDownloading(true);
    try {
      const pptx = new pptxgen();
      pptx.layout = "LAYOUT_WIDE";

      for (let i = 0; i < slideRefs.current.length; i++) {
        const el = slideRefs.current[i];
        if (!el) continue;
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: null,
          logging: false,
        });
        const imgData = canvas.toDataURL("image/png");
        const slide = pptx.addSlide();
        slide.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%" });
      }

      await pptx.writeFile({ fileName: "HireIn_Solutions_IT_Staffing_Deck.pptx" });
    } catch (err) {
      console.error("PPT generation failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#E8EDF4",
        fontFamily: "'Segoe UI', 'Inter', Arial, sans-serif",
        padding: "32px 24px",
      }}
    >
      {/* Deck header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <HISLogo size={40} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontSize: 10, color: "rgba(31,58,110,0.45)", fontFamily: "'Segoe UI', Arial, sans-serif" }}>A Rayomind Company</span>
          </div>
        </div>
        <h1
          style={{
            color: NAVY,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: -0.3,
            marginTop: 8,
          }}
        >
          US IT Staffing · Marketing Deck
        </h1>
        <p style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
          {slides.length} Slides · Confidential · 2026
        </p>
        <button
          onClick={downloadPPT}
          disabled={downloading}
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: downloading ? "#9CA3AF" : NAVY,
            color: WHITE,
            border: "none",
            borderRadius: 8,
            padding: "9px 20px",
            fontSize: 12.5,
            fontWeight: 700,
            fontFamily: "'Segoe UI', Arial, sans-serif",
            cursor: downloading ? "not-allowed" : "pointer",
            boxShadow: "0 2px 10px rgba(31,58,110,0.25)",
            transition: "background 0.2s",
          }}
        >
          <Download size={14} />
          {downloading ? "Generating PPT…" : "Download PPT"}
        </button>
      </div>

      {/* Slides */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {slides.map(({ id, title, component }, idx) => (
          <SlideNumberContext.Provider key={id} value={{ slideNumber: id, totalSlides: slides.length }}>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: NAVY,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: ORANGE,
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {id}
                  </span>
                </div>
                <span
                  style={{
                    color: NAVY,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                  }}
                >
                  {title}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "rgba(31,58,110,0.12)",
                  }}
                />
              </div>
              <div ref={(el) => { slideRefs.current[idx] = el; }}>
                {component}
              </div>
            </div>
          </SlideNumberContext.Provider>
        ))}
      </div>

      {/* Footer note */}
      <div style={{ textAlign: "center", marginTop: 36, paddingBottom: 16 }}>
        <p style={{ color: "#9CA3AF", fontSize: 10.5 }}>
          Hire&apos;in Solutions · A Rayomind Company · hire-in.com ·
          hello@hire-in.com
        </p>
      </div>
    </div>
  );
}

export default HiringDeck;
