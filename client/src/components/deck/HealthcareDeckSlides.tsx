import { createContext, useContext, Fragment } from "react";
import {
  Activity,
  Award,
  Brain,
  Building2,
  CheckCircle,
  ChevronRight,
  Clock,
  ClipboardCheck,
  FileSearch,
  Globe,
  Heart,
  HeartPulse,
  Linkedin,
  Mail,
  MapPin,
  Monitor,
  Phone,
  Shield,
  ShieldCheck,
  Star,
  Stethoscope,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";
import worldMapImage from "@assets/worldMap_cropped.png";

const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";
const ORANGE2 = "#F96D3E";
const WHITE = "#FFFFFF";
const LIGHT_BG = "#F5F7FA";
const LIGHT2 = "#EEF2F8";

export const HealthcareSlideNumberContext = createContext({ slideNumber: 0, totalSlides: 11 });

function HISLogo({ size = 40, light = false }: { size?: number; light?: boolean }) {
  return (
    <img
      src={logoImage}
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

function SlideFooter() {
  const { slideNumber, totalSlides } = useContext(HealthcareSlideNumberContext);
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
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.1 }}>
            Hire&apos;in Solutions
          </span>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.3 }}>
            A Rayomind Company
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
          US Healthcare Staffing · hire-in.com
        </span>
        {slideNumber > 0 && (
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.5 }}>
            {slideNumber} / {totalSlides}
          </span>
        )}
      </div>
    </div>
  );
}

function SlideWrapper({ children, bg = WHITE, noFooter = false }: { children: React.ReactNode; bg?: string; noFooter?: boolean }) {
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

function Slide1Cover() {
  const { slideNumber, totalSlides } = useContext(HealthcareSlideNumberContext);
  return (
    <SlideWrapper bg={NAVY} noFooter>
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: `linear-gradient(180deg, ${ORANGE} 0%, ${ORANGE2} 100%)` }} />
        <div style={{ position: "absolute", right: -80, top: -80, width: 420, height: 420, borderRadius: "50%", background: "rgba(244,124,32,0.07)" }} />
        <div style={{ position: "absolute", right: 60, bottom: -120, width: 320, height: 320, borderRadius: "50%", background: "rgba(244,124,32,0.05)" }} />
        <div style={{ position: "absolute", right: 180, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.12 }}>
          {[Stethoscope, Heart, Shield, Activity, HeartPulse].map((Icon, i) => (
            <Icon key={i} size={38} color={ORANGE} />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "36px 56px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
            <HISLogo size={52} light />
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(244,124,32,0.18)", border: "1px solid rgba(244,124,32,0.35)", borderRadius: 20, padding: "4px 14px", marginBottom: 18, width: "fit-content" }}>
            <Stethoscope size={12} color={ORANGE} />
            <span style={{ color: ORANGE, fontSize: 11, fontWeight: 600, letterSpacing: 1.2, fontFamily: "'Segoe UI', Arial, sans-serif", textTransform: "uppercase" }}>AI + Compliance Healthcare Staffing</span>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 900, color: WHITE, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.08, letterSpacing: -1, marginBottom: 6 }}>Hire&apos;in Solutions</h1>
          <h2 style={{ fontSize: 26, fontWeight: 600, color: ORANGE, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.4, marginBottom: 20 }}>US Healthcare Staffing · AI + Compliance</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.72)", fontFamily: "'Segoe UI', Arial, sans-serif", fontStyle: "italic", letterSpacing: 0.3 }}>&ldquo;The Right Clinical Talent, Right Now&rdquo;</p>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 22, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 0", width: "fit-content" }}>
            {["Joint Commission-Aligned Process", "Verified Documents & Compliant Submissions", "All 50 US States"].map((stat, i) => (
              <Fragment key={i}>
                {i > 0 && <div style={{ width: 1, height: 20, background: "rgba(244,124,32,0.4)", flexShrink: 0 }} />}
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.3, padding: "0 16px", whiteSpace: "nowrap" }}>{stat}</span>
              </Fragment>
            ))}
          </div>
        </div>
        <div style={{ width: 280, background: "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 24, padding: 28 }}>
          {[
            { icon: Stethoscope, label: "Clinical Specialists" },
            { icon: ShieldCheck, label: "TJC-Aligned Process" },
            { icon: Brain, label: "proKred.com Powered" },
            { icon: Zap, label: "Compliant Submissions" },
          ].map(({ icon: Icon, label }, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(244,124,32,0.15)", border: "1px solid rgba(244,124,32,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} color={ORANGE} />
              </div>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: 500, textAlign: "center", fontFamily: "'Segoe UI', Arial, sans-serif" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 36px", background: "rgba(255,255,255,0.05)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HISLogo size={22} light />
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>|</span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Hire&apos;in Solutions</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>A Rayomind Company</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif" }}>hire-in.com · contact@hire-in.com</span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: ORANGE, opacity: 0.6 }} />
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Confidential · 2026</span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: ORANGE, opacity: 0.6 }} />
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.5 }}>{slideNumber} / {totalSlides}</span>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide2ByTheNumbers() {
  const metrics = [
    { value: "TJC", label: "Joint Commission Aligned", sub: "Workflows built around TJC standards" },
    { value: "AI+", label: "proKred.com Credentialing", sub: "Automated license & compliance verification" },
    { value: "50", label: "US States Covered", sub: "True coast-to-coast clinical reach" },
    { value: "RN/LPN", label: "Clinical Specializations", sub: "Nursing, allied health & physician roles" },
    { value: "Fast", label: "Compliance Turnaround", sub: "From intake to compliant submission package" },
    { value: "MSP", label: "Managed Service Ready", sub: "VMS-integrated staffing programs" },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div style={{ background: NAVY, padding: "16px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ color: ORANGE, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif" }}>By the Numbers</p>
        </div>
        <HISLogo size={32} light />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: "20px 36px 14px", alignContent: "center" }}>
        {metrics.map(({ value, label, sub }, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 12, padding: "20px 18px", boxShadow: "0 2px 12px rgba(31,58,110,0.09)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 4, borderTop: `3px solid ${i % 2 === 0 ? ORANGE : NAVY}` }}>
            <p style={{ color: i % 2 === 0 ? ORANGE : NAVY, fontSize: 28, fontWeight: 900, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1 }}>{value}</p>
            <p style={{ color: NAVY, fontSize: 12.5, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif", marginTop: 2 }}>{label}</p>
            <p style={{ color: "#6B7280", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.4 }}>{sub}</p>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}

function Slide3About() {
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div style={{ background: NAVY, padding: "16px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ color: ORANGE, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif" }}>About Us</p>
        </div>
        <HISLogo size={32} light />
      </div>
      <div style={{ flex: 1, display: "flex", gap: 20, padding: "18px 36px 12px", overflow: "hidden", alignItems: "center" }}>
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: WHITE, borderRadius: 10, padding: "16px 20px", borderLeft: `4px solid ${ORANGE}`, boxShadow: "0 2px 12px rgba(31,58,110,0.08)" }}>
            <p style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Our Healthcare Mission</p>
            <p style={{ color: NAVY, fontSize: 14, fontWeight: 600, lineHeight: 1.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Est. 2014 · 10+ years in healthcare staffing. We connect hospital systems, health networks, and clinical facilities with compliance-verified talent that fits. Headquartered in San Jose, CA, serving all 50 states.</p>
          </div>
          <div style={{ background: NAVY, borderRadius: 10, padding: "16px 20px", boxShadow: "0 2px 12px rgba(31,58,110,0.12)" }}>
            <p style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'Segoe UI', Arial, sans-serif" }}>The Rayomind Family</p>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, lineHeight: 1.55, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
              Hire&apos;in Solutions is a US-based staffing firm and proud member of the <strong style={{ color: ORANGE }}>Rayomind</strong> group, a technology-driven ecosystem building next-generation workforce solutions. Our healthcare division uses <strong style={{ color: ORANGE }}>proKred.com</strong> for credentialing automation and <strong style={{ color: ORANGE }}>KlerHire AI</strong> for clinical skills matching, so every placement is document-verified and submission-compliant.
              <span style={{ display: "block", marginTop: 6, fontSize: 9.5, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>A subsidiary of Rayomind Inc.</span>
            </p>
          </div>
        </div>
        <div style={{ flex: 0.8, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { icon: Heart, label: "Healthcare-Exclusive Division", desc: "Dedicated clinical staffing expertise" },
            { icon: ShieldCheck, label: "proKred.com Platform", desc: "Proprietary credentialing automation" },
            { icon: Users, label: "60+ Clinical Recruiters", desc: "Specialty-trained healthcare teams" },
            { icon: Globe, label: "All 50 US States", desc: "Coast-to-coast clinical coverage" },
          ].map(({ icon: Icon, label, desc }, i) => (
            <div key={i} style={{ background: WHITE, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10, boxShadow: "0 1px 6px rgba(31,58,110,0.07)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: LIGHT2, border: `1.5px solid ${ORANGE}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={15} color={ORANGE} />
              </div>
              <div>
                <p style={{ color: NAVY, fontSize: 11.5, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", marginBottom: 1 }}>{label}</p>
                <p style={{ color: "#6B7280", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide4Services() {
  const services = [
    { icon: Stethoscope, title: "Travel Nursing", desc: "Compliance-verified travel nurses deployed nationwide with complete submission packages for hospitals, clinics, and healthcare systems.", bullets: ["13/26-week contracts", "Multi-state licensure support", "Housing coordination"] },
    { icon: UserCheck, title: "Permanent Clinical Hiring", desc: "Full-time placement of nurses, physicians, and allied health professionals matched via AI and credential verification.", bullets: ["Culture-fit scoring", "Clinical assessment", "End-to-end onboarding"] },
    { icon: Clock, title: "Locum Tenens / Temp Staffing", desc: "Temporary physicians and specialists for coverage gaps, seasonal surges, or facility expansion needs.", bullets: ["Rapid deployment", "Per diem & short-term", "Verified & compliant"] },
    { icon: HeartPulse, title: "Allied Health & Therapy Staffing", desc: "Physical therapists, occupational therapists, respiratory therapists, and medical technologists placed with precision.", bullets: ["Specialty matching", "License verification", "Therapy team builds"] },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div style={{ background: NAVY, padding: "16px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ color: ORANGE, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif" }}>Healthcare Staffing Services</p>
        </div>
        <HISLogo size={32} light />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "16px 36px 12px" }}>
        {services.map(({ icon: Icon, title, desc, bullets }, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 10, padding: "14px 16px", boxShadow: "0 2px 10px rgba(31,58,110,0.09)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} color={WHITE} />
              </div>
              <h3 style={{ color: NAVY, fontSize: 13.5, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{title}</h3>
            </div>
            <p style={{ color: "#4B5563", fontSize: 10.5, lineHeight: 1.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{desc}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {bullets.map((b, j) => (
                <div key={j} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle size={11} color={ORANGE} />
                  <span style={{ color: "#374151", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}

function Slide5Models() {
  const models = [
    { name: "Per Diem", color: NAVY, benefits: ["Shift-based engagement", "Daily/hourly billing", "48-hour deployment", "Compliant pool ready"] },
    { name: "Travel Contract", color: "#1E5C9C", benefits: ["13/26-week assignments", "All-inclusive bill rate", "Housing & travel included", "Multi-state licensure"] },
    { name: "Direct Hire", color: ORANGE, benefits: ["Full-time permanent", "Flat placement fee", "90-day guarantee", "Comprehensive onboarding"] },
    { name: "MSP/VMS", color: ORANGE2, benefits: ["Managed service program", "Consolidated billing", "SLA-backed delivery", "Full compliance coverage"] },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div style={{ background: NAVY, padding: "16px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ color: ORANGE, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif" }}>Staffing Models</p>
        </div>
        <HISLogo size={32} light />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 36px 12px", gap: 12, justifyContent: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 1fr 1fr", gap: 10 }}>
          <div />
          {models.map((m, i) => (
            <div key={i} style={{ background: m.color, borderRadius: 8, padding: "10px 10px", textAlign: "center" }}>
              <span style={{ color: WHITE, fontSize: 13, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{m.name}</span>
            </div>
          ))}
        </div>
        {[0, 1, 2, 3].map((rowIdx) => (
          <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 1fr 1fr", gap: 10 }}>
            <div style={{ background: WHITE, borderRadius: 6, padding: "10px 12px", display: "flex", alignItems: "center" }}>
              <span style={{ color: NAVY, fontSize: 11, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
                {["Engagement Type", "Billing Model", "Guarantee / SLA", "Deployment Speed"][rowIdx]}
              </span>
            </div>
            {models.map((m, colIdx) => (
              <div key={colIdx} style={{ background: WHITE, borderRadius: 6, padding: "10px 10px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 1px 4px rgba(31,58,110,0.06)" }}>
                <CheckCircle size={11} color={m.color} style={{ flexShrink: 0 }} />
                <span style={{ color: "#374151", fontSize: 10.5, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.4 }}>{m.benefits[rowIdx]}</span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ background: NAVY, borderRadius: 8, padding: "11px 16px", display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <ShieldCheck size={14} color={ORANGE} />
          <span style={{ color: "rgba(255,255,255,0.88)", fontSize: 11.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
            All models include <strong style={{ color: ORANGE }}>Joint Commission-aligned workflows</strong>, proKred.com verification, and healthcare-specific background checks.
          </span>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide6AICredentialing() {
  const features = [
    { icon: ClipboardCheck, title: "License Verification", desc: "Automated real-time verification of nursing licenses, medical licenses, and specialty certifications across all 50 states." },
    { icon: Shield, title: "Privilege Delineation", desc: "Maps clinical privileges to facility requirements so each provider is authorized for the specific procedures and departments they serve." },
    { icon: Target, title: "Compliance Automation", desc: "Continuous monitoring of expiration dates, CEU requirements, and regulatory changes. You get automated alerts before any credential lapses." },
    { icon: Brain, title: "Clinical Skills Matching", desc: "KlerHire AI scores candidates on EMR proficiency (Epic, Cerner, Meditech), specialty alignment, and clinical competency fit." },
    { icon: Star, title: "EMR Proficiency Scoring", desc: "Evaluates depth of experience with specific EHR systems, charting workflows, and clinical documentation standards." },
  ];
  return (
    <SlideWrapper bg={NAVY} noFooter>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 36px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(244,124,32,0.2)", border: "1px solid rgba(244,124,32,0.4)", borderRadius: 20, padding: "3px 12px", marginBottom: 8 }}>
              <ShieldCheck size={11} color={ORANGE} />
              <span style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif" }}>AI + Credentialing</span>
            </div>
            <h2 style={{ color: ORANGE, fontSize: 22, fontWeight: 900, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.1 }}>AI &amp; Credentialing Tools</h2>
            <p style={{ color: ORANGE, fontSize: 15, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", marginTop: 2 }}>proKred.com + KlerHire AI — Verified Documents &amp; Compliant Submissions</p>
          </div>
          <HISLogo size={34} light />
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: "0 36px 14px" }}>
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(244,124,32,0.25)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, gridColumn: i === 4 ? "2 / 3" : undefined }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={18} color={WHITE} />
              </div>
              <h4 style={{ color: WHITE, fontSize: 13, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.2 }}>{title}</h4>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10.5, lineHeight: 1.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{desc}</p>
            </div>
          ))}
          <div style={{ background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
            <Zap size={22} color={WHITE} />
            <h4 style={{ color: WHITE, fontSize: 13, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Why AI + Credentialing Wins</h4>
            <p style={{ color: "rgba(255,255,255,0.9)", fontSize: 10, lineHeight: 1.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>By combining proKred.com with KlerHire AI, we deliver candidates with fully verified documents and compliant submission packages faster than any traditional healthcare staffing firm.</p>
          </div>
        </div>
        <SlideFooter />
      </div>
    </SlideWrapper>
  );
}

function Slide7Advantage() {
  const advantages = [
    { icon: ShieldCheck, title: "Joint Commission-Aligned", desc: "Our credentialing workflows are built around TJC standards, covering everything from primary source verification to ongoing monitoring, so your placements are audit-ready.", highlight: "TJC-Ready Process" },
    { icon: ClipboardCheck, title: "proKred.com-Powered Verification", desc: "Our proKred.com platform automates license verification, privilege delineation, and compliance tracking — delivering verified documents and compliant submission packages.", highlight: "Verified & Compliant" },
    { icon: Stethoscope, title: "Clinical Domain Experts", desc: "Our recruiters specialize in clinical staffing across RN, LPN, CNA, allied health, and physician placements. They understand unit-level needs, shift patterns, and patient acuity.", highlight: "RN / LPN / CNA Specialists" },
    { icon: Zap, title: "Rapid Compliance Turnaround", desc: "With proKred.com running continuous verification, we deliver candidates with verified documents and compliant submission packages faster than traditional healthcare staffing firms.", highlight: "Compliant Packages" },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div style={{ background: NAVY, padding: "16px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ color: ORANGE, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif" }}>Why Hire&apos;in Healthcare</p>
        </div>
        <HISLogo size={32} light />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "16px 36px 12px" }}>
        {advantages.map(({ icon: Icon, title, desc, highlight }, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 10, padding: "16px 18px", boxShadow: "0 2px 12px rgba(31,58,110,0.09)", display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: "rgba(244,124,32,0.05)", borderRadius: "0 10px 0 80px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={18} color={ORANGE} />
              </div>
              <h3 style={{ color: NAVY, fontSize: 14, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{title}</h3>
            </div>
            <p style={{ color: "#4B5563", fontSize: 10.5, lineHeight: 1.55, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{desc}</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(244,124,32,0.12)", border: `1px solid ${ORANGE}`, borderRadius: 6, padding: "3px 10px", width: "fit-content" }}>
              <Star size={10} color={ORANGE} />
              <span style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{highlight}</span>
            </div>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}

function Slide8CredentialingProcess() {
  const steps = [
    { icon: Building2, label: "Intake", sub: undefined as string | undefined, desc: "Understand facility needs, unit requirements & acuity level", color: NAVY },
    { icon: ClipboardCheck, label: "Credential Verify", sub: "proKred.com", desc: "Automated license & certification verification", color: ORANGE },
    { icon: Shield, label: "License Check", sub: undefined as string | undefined, desc: "Multi-state nursing license & DEA verification", color: NAVY },
    { icon: Stethoscope, label: "Clinical Screen", sub: undefined as string | undefined, desc: "Skills assessment, EMR proficiency & clinical competency", color: ORANGE },
    { icon: ShieldCheck, label: "Compliance", sub: undefined as string | undefined, desc: "TJC-aligned review & background clearance", color: NAVY },
    { icon: CheckCircle, label: "Onboard", sub: undefined as string | undefined, desc: "Facility orientation & privileging completion", color: ORANGE },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div style={{ background: NAVY, padding: "16px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ color: ORANGE, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif" }}>Credentialing &amp; Compliance Process</p>
        </div>
        <HISLogo size={32} light />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 36px 12px", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
          {steps.map(({ icon: Icon, label, sub, color }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 54, height: 54, borderRadius: 14, background: color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 16px ${color}44` }}>
                  <Icon size={24} color={WHITE} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: NAVY, fontSize: 11, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{label}</p>
                  {sub && <p style={{ color: ORANGE, fontSize: 9, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{sub}</p>}
                </div>
              </div>
              {i < steps.length - 1 && <ChevronRight size={20} color={ORANGE} style={{ flexShrink: 0, opacity: 0.7 }} />}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {steps.map(({ desc, color }, i) => (
            <div key={i} style={{ flex: 1, background: WHITE, borderRadius: 8, padding: "10px 10px", borderTop: `3px solid ${color}`, boxShadow: "0 1px 6px rgba(31,58,110,0.07)" }}>
              <p style={{ color: "#374151", fontSize: 9, lineHeight: 1.45, fontFamily: "'Segoe UI', Arial, sans-serif", textAlign: "center" }}>{desc}</p>
            </div>
          ))}
        </div>
        <div style={{ background: NAVY, borderRadius: 8, padding: "10px 18px", display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={15} color={ORANGE} />
          <span style={{ color: "rgba(255,255,255,0.88)", fontSize: 11, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
            <strong style={{ color: ORANGE }}>proKred.com</strong> automates verification at every stage, aligning with Joint Commission standards and eliminating manual credential gaps.
          </span>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide9Fulfillment() {
  const stages = [
    { label: "Demand", icon: Building2, desc: "Facility raises clinical requisition" },
    { label: "Triage", icon: Activity, desc: "Urgency classification (ER/ICU/Floor)" },
    { label: "Credential", icon: ClipboardCheck, desc: "proKred.com verification" },
    { label: "Match", icon: Brain, desc: "KlerHire AI clinical matching" },
    { label: "Submit", icon: UserCheck, desc: "Compliant submission packages delivered" },
    { label: "Compliance", icon: ShieldCheck, desc: "TJC-aligned review & clearance" },
    { label: "Deploy", icon: Star, desc: "Onboarding & shift start" },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div style={{ background: NAVY, padding: "16px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ color: ORANGE, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif" }}>Demand Fulfillment</p>
        </div>
        <HISLogo size={32} light />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "16px 36px 12px", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {stages.map(({ label, icon: Icon }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: i % 2 === 0 ? NAVY : `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(31,58,110,0.2)" }}>
                  <Icon size={20} color={WHITE} />
                </div>
                <span style={{ color: NAVY, fontSize: 10, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", textAlign: "center" }}>{label}</span>
              </div>
              {i < stages.length - 1 && <ChevronRight size={16} color={ORANGE} style={{ flexShrink: 0, opacity: 0.6 }} />}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {stages.map(({ desc }, i) => (
            <div key={i} style={{ background: WHITE, borderRadius: 7, padding: "8px 8px", textAlign: "center", boxShadow: "0 1px 5px rgba(31,58,110,0.07)" }}>
              <p style={{ color: "#4B5563", fontSize: 9, lineHeight: 1.4, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{desc}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            { metric: "Rapid", label: "ER/ICU Priority Fill" },
            { metric: "Fast", label: "Compliant Submissions" },
            { metric: "TJC", label: "Joint Commission Aligned" },
            { metric: "Scalable", label: "Census-Based Coverage" },
          ].map(({ metric, label }, i) => (
            <div key={i} style={{ background: NAVY, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ color: ORANGE, fontSize: 18, fontWeight: 900, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1 }}>{metric}</p>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, marginTop: 3, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide10ClinicalDomains() {
  const domains = [
    { icon: Stethoscope, label: "Nursing (RN/LPN/CNA)", color: "#1565C0" },
    { icon: Award, label: "Physicians & Surgeons", color: "#0277BD" },
    { icon: HeartPulse, label: "Allied Health & Therapy", color: "#283593" },
    { icon: Monitor, label: "Telehealth & Remote Care", color: "#B71C1C" },
    { icon: Brain, label: "Healthcare IT (EMR/EHR)", color: "#1B5E20" },
    { icon: ClipboardCheck, label: "Admin & Compliance", color: "#4A148C" },
  ];
  const models = ["Travel", "Per Diem", "Direct Hire", "MSP/VMS"];
  const modelColors = [NAVY, "#1E5C9C", ORANGE, ORANGE2];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <div style={{ background: NAVY, padding: "16px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ color: ORANGE, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif" }}>Clinical Domains</p>
        </div>
        <HISLogo size={32} light />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 36px 12px", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          {domains.map(({ icon: Icon, label, color }, i) => (
            <div key={i} style={{ flex: 1, background: WHITE, borderRadius: 8, padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, boxShadow: "0 1px 6px rgba(31,58,110,0.08)", borderTop: `3px solid ${color}` }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={16} color={color} />
              </div>
              <span style={{ color: NAVY, fontSize: 9, fontWeight: 700, textAlign: "center", fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.3 }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 6 }}>
            <div style={{ background: NAVY, borderRadius: 6, padding: "7px 10px", textAlign: "center" }}>
              <span style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Domain</span>
            </div>
            {models.map((m, i) => (
              <div key={i} style={{ background: modelColors[i], borderRadius: 6, padding: "7px 6px", textAlign: "center" }}>
                <span style={{ color: WHITE, fontSize: 9.5, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{m}</span>
              </div>
            ))}
          </div>
          {domains.map(({ label }, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 6 }}>
              <div style={{ background: WHITE, borderRadius: 5, padding: "5px 10px", display: "flex", alignItems: "center" }}>
                <span style={{ color: NAVY, fontSize: 9.5, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{label}</span>
              </div>
              {models.map((_, j) => (
                <div key={j} style={{ background: WHITE, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", padding: "5px" }}>
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

function Slide11WorldMap() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <img
        src={worldMapImage}
        alt="World Map"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center center",
          opacity: 0.18,
          filter: "brightness(2.5)",
        }}
      />
      <svg
        viewBox="0 0 1816 740"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <defs>
          <radialGradient id="hc11g1" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={ORANGE} stopOpacity="0.7" />
            <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hc11g2" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={ORANGE} stopOpacity="0.7" />
            <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M 480,460 Q 780,350 1110,565" fill="none" stroke={ORANGE} strokeWidth="1.8" strokeDasharray="8 6" opacity="0.35" />
        <circle cx="480" cy="460" r="50" fill="url(#hc11g1)" />
        <circle cx="480" cy="460" r="12" fill={ORANGE} />
        <circle cx="480" cy="460" r="24" fill="none" stroke={ORANGE} strokeWidth="1.5" opacity="0.4">
          <animate attributeName="r" values="24;42;24" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="1110" cy="565" r="50" fill="url(#hc11g2)" />
        <circle cx="1110" cy="565" r="12" fill={ORANGE} />
        <circle cx="1110" cy="565" r="24" fill="none" stroke={ORANGE} strokeWidth="1.5" opacity="0.4">
          <animate attributeName="r" values="24;42;24" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
        </circle>
        <text x="480" y="510" textAnchor="middle" fill={WHITE} fontSize="22" fontWeight="700" fontFamily="'Segoe UI', Arial, sans-serif">San Jose, CA</text>
        <text x="1110" y="615" textAnchor="middle" fill={WHITE} fontSize="22" fontWeight="700" fontFamily="'Segoe UI', Arial, sans-serif">New Delhi, India</text>
      </svg>
    </div>
  );
}

function Slide11Connect() {
  const { slideNumber, totalSlides } = useContext(HealthcareSlideNumberContext);
  return (
    <SlideWrapper bg={NAVY} noFooter>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -100, bottom: -100, width: 400, height: 400, borderRadius: "50%", background: "rgba(244,124,32,0.07)" }} />
        <div style={{ position: "absolute", right: -60, top: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px 0", position: "relative", zIndex: 1 }}>
          <HISLogo size={40} light />
          <div style={{ textAlign: "center", flex: 1 }}>
            <h2 style={{ color: ORANGE, fontSize: 30, fontWeight: 900, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.1, letterSpacing: -0.5, margin: 0 }}>Let&apos;s Connect</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "'Segoe UI', Arial, sans-serif", fontStyle: "italic", margin: "4px 0 0" }}>&ldquo;The Right Clinical Talent, Right Now&rdquo;</p>
          </div>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ flex: 1, display: "flex", gap: 0, padding: "0px 16px 4px", position: "relative", zIndex: 1 }}>
          <div style={{ flex: 1.5, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
            <div style={{ width: "115%", flex: 1, minHeight: 0, marginTop: -35, marginLeft: "-7.5%" }}>
              <Slide11WorldMap />
            </div>
            <div style={{ display: "flex", gap: 40, marginTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE, boxShadow: `0 0 8px ${ORANGE}` }} />
                <span style={{ color: WHITE, fontSize: 11, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif" }}>US Headquarters</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE, boxShadow: `0 0 8px ${ORANGE}` }} />
                <span style={{ color: WHITE, fontSize: 11, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif" }}>India Office</span>
              </div>
            </div>
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)", margin: "10px 12px" }} />
          <div style={{ flex: 0.8, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, paddingLeft: 4 }}>
            {[
              { icon: Phone, label: "+1 (408) 892-9656", sub: "Healthcare Line" },
              { icon: Mail, label: "contact@hire-in.com", sub: "Email Us" },
              { icon: Globe, label: "hire-in.com", sub: "Website" },
              { icon: MapPin, label: "San Jose, CA · USA", sub: "US Headquarters" },
              { icon: MapPin, label: "New Delhi · India", sub: "India Office" },
            ].map(({ icon: Icon, label, sub }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }} data-testid={`hc-contact-item-${i}`}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color={WHITE} />
                </div>
                <div>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>{sub}</p>
                  <p style={{ color: WHITE, fontSize: 13, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>{label}</p>
                </div>
              </div>
            ))}
            <a href="https://www.linkedin.com/company/hirein-solutions/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }} data-testid="hc-link-linkedin">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Linkedin size={16} color={WHITE} />
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>LinkedIn</p>
                <p style={{ color: WHITE, fontSize: 13, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>Connect with us</p>
              </div>
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
              <div style={{ background: "white", borderRadius: 8, padding: 5, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} data-testid="hc-img-linkedin-qr">
                <svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 33 33" shapeRendering="crispEdges"><path stroke="#000000" d="M0 0.5h7m6 0h1m2 0h6m1 0h1m2 0h7M0 1.5h1m5 0h1m2 0h1m1 0h1m1 0h3m1 0h1m3 0h2m1 0h1m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1m1 0h5m4 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h2m4 0h3m2 0h2m1 0h2m2 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h2m1 0h2m2 0h1m2 0h1m4 0h1m2 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h1m3 0h1m2 0h4m1 0h2m4 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h1m1 0h3m1 0h2m5 0h2M0 8.5h1m1 0h5m2 0h1m1 0h1m1 0h5m4 0h1m1 0h1m1 0h5M1 9.5h1m1 0h2m2 0h2m7 0h1m1 0h2m3 0h1m2 0h2m1 0h2m1 0h1M2 10.5h1m2 0h2m1 0h3m4 0h2m1 0h1m2 0h1m2 0h3m1 0h1m1 0h2M1 11.5h1m1 0h1m1 0h1m1 0h3m2 0h1m1 0h3m2 0h5m2 0h1m1 0h5M3 12.5h4m1 0h1m1 0h1m7 0h2m2 0h2m3 0h3m1 0h2M1 13.5h3m1 0h1m3 0h2m1 0h6m2 0h1m2 0h1m2 0h1m4 0h2M0 14.5h1m1 0h5m1 0h1m2 0h2m4 0h1m1 0h1m2 0h1m1 0h3m3 0h2M2 15.5h1m1 0h2m4 0h3m3 0h1m2 0h3m3 0h6M0 16.5h3m2 0h5m1 0h4m2 0h1m1 0h1m2 0h4m1 0h2m3 0h1M0 17.5h1m6 0h2m4 0h1m2 0h5m2 0h5m1 0h2m1 0h1M0 18.5h1m3 0h1m1 0h3m4 0h5m2 0h1m1 0h1m2 0h4m1 0h1M0 19.5h2m1 0h1m1 0h1m1 0h1m1 0h2m5 0h3m2 0h3m1 0h1m1 0h5M0 20.5h1m5 0h3m2 0h3m2 0h1m2 0h1m2 0h1m1 0h2m1 0h3m2 0h1M0 21.5h1m2 0h1m1 0h1m1 0h4m3 0h2m1 0h2m4 0h1m1 0h2m5 0h1M0 22.5h1m1 0h2m2 0h3m4 0h4m3 0h1m4 0h1m3 0h3M0 23.5h1m1 0h2m1 0h1m1 0h1m1 0h1m1 0h2m2 0h1m3 0h5m1 0h2m2 0h2m1 0h1M0 24.5h1m3 0h3m1 0h3m1 0h1m2 0h1m1 0h3m2 0h8M8 25.5h6m2 0h1m1 0h3m2 0h2m3 0h1m1 0h3M0 26.5h7m2 0h2m4 0h2m1 0h1m3 0h3m1 0h1m1 0h1m1 0h2M0 27.5h1m5 0h1m1 0h1m5 0h1m5 0h2m1 0h2m3 0h3m1 0h1M0 28.5h1m1 0h3m1 0h1m1 0h1m2 0h2m2 0h1m2 0h1m3 0h1m1 0h6m1 0h2M0 29.5h1m1 0h3m1 0h1m1 0h2m2 0h1m1 0h4m1 0h1m1 0h3m1 0h1m2 0h1m1 0h3M0 30.5h1m1 0h3m1 0h1m1 0h1m1 0h2m2 0h1m2 0h1m2 0h8M0 31.5h1m5 0h1m2 0h2m2 0h2m1 0h1m2 0h1m1 0h2m5 0h3M0 32.5h7m1 0h4m1 0h2m2 0h1m4 0h6m3 0h1"/></svg>
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>Scan QR Code</p>
                <p style={{ color: WHITE, fontSize: 13, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>LinkedIn Profile</p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 24px", background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HISLogo size={22} light />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>|</span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Hire&apos;in Solutions</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>A Rayomind Company</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>© 2026 Hire&apos;in Solutions · US Healthcare Staffing · Confidential</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.5 }}>{slideNumber} / {totalSlides}</span>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

export const HEALTHCARE_SLIDES = [
  { id: 1, title: "Cover", component: <Slide1Cover /> },
  { id: 2, title: "By the Numbers", component: <Slide2ByTheNumbers /> },
  { id: 3, title: "About Us", component: <Slide3About /> },
  { id: 4, title: "Healthcare Services", component: <Slide4Services /> },
  { id: 5, title: "Staffing Models", component: <Slide5Models /> },
  { id: 6, title: "AI & Credentialing Tools", component: <Slide6AICredentialing /> },
  { id: 7, title: "Why Hire'in Healthcare", component: <Slide7Advantage /> },
  { id: 8, title: "Credentialing Process", component: <Slide8CredentialingProcess /> },
  { id: 9, title: "Demand Fulfillment", component: <Slide9Fulfillment /> },
  { id: 10, title: "Clinical Domains", component: <Slide10ClinicalDomains /> },
  { id: 11, title: "Let's Connect", component: <Slide11Connect /> },
];

export const HEALTHCARE_TOTAL_SLIDES = HEALTHCARE_SLIDES.length;