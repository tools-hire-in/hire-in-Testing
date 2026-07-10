import { createContext, useContext, Fragment } from "react";
import {
  BadgeCheck,
  Brain,
  Briefcase,
  Building2,
  CheckCircle,
  Clock,
  Code2,
  Cpu,
  Factory,
  FileCheck,
  Globe,
  Handshake,
  Landmark,
  Layers,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";
import { useCompanyProfile } from "@/hooks/use-company-profile";
import { FederalCredentialsBar } from "./FederalCredentials";

const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";
const ORANGE2 = "#F96D3E";
const WHITE = "#FFFFFF";
const LIGHT_BG = "#F5F7FA";
const LIGHT2 = "#EEF2F8";

export const CapabilitySlideNumberContext = createContext({ slideNumber: 0, totalSlides: 11 });

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
  const { slideNumber, totalSlides } = useContext(CapabilitySlideNumberContext);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 36px", background: NAVY, marginTop: "auto", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <HISLogo size={22} light />
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>|</span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.1 }}>Hire&apos;in Solutions</span>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.3 }}>A Rayomind Company</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif" }}>General Capability Deck · hire-in.com</span>
        {slideNumber > 0 && (
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.5 }}>{slideNumber} / {totalSlides}</span>
        )}
      </div>
    </div>
  );
}

function SlideWrapper({ children, bg = WHITE, noFooter = false }: { children: React.ReactNode; bg?: string; noFooter?: boolean }) {
  return (
    <div style={{ width: "100%", aspectRatio: "16/9", background: bg, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 4px 32px rgba(31,58,110,0.18)", borderRadius: 6, position: "relative" }}>
      {children}
      {!noFooter && <SlideFooter />}
    </div>
  );
}

function SectionHeader({ label, title, light = false }: { label: string; title: string; light?: boolean }) {
  return (
    <div style={{ background: NAVY, padding: "16px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <div>
        <p style={{ color: ORANGE, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" as const, fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>{label}</p>
        {title && <p style={{ color: light ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "'Segoe UI', Arial, sans-serif", margin: "2px 0 0", letterSpacing: 0.3 }}>{title}</p>}
      </div>
      <HISLogo size={32} light />
    </div>
  );
}

function Slide1Cover() {
  const { slideNumber, totalSlides } = useContext(CapabilitySlideNumberContext);
  const profile = useCompanyProfile();
  return (
    <SlideWrapper bg={NAVY} noFooter>
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: `linear-gradient(180deg, ${ORANGE} 0%, ${ORANGE2} 100%)` }} />
        <div style={{ position: "absolute", right: -80, top: -80, width: 420, height: 420, borderRadius: "50%", background: "rgba(244,124,32,0.07)" }} />
        <div style={{ position: "absolute", right: 60, bottom: -120, width: 320, height: 320, borderRadius: "50%", background: "rgba(244,124,32,0.05)" }} />
        <div style={{ position: "absolute", right: 180, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.12 }}>
          {[Brain, Users, Stethoscope, Shield, Zap].map((Icon, i) => (
            <Icon key={i} size={38} color={ORANGE} />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "36px 56px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
            <HISLogo size={52} light />
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(244,124,32,0.18)", border: "1px solid rgba(244,124,32,0.35)", borderRadius: 20, padding: "4px 14px", marginBottom: 18, width: "fit-content" }}>
            <Zap size={12} color={ORANGE} />
            <span style={{ color: ORANGE, fontSize: 11, fontWeight: 600, letterSpacing: 1.2, fontFamily: "'Segoe UI', Arial, sans-serif", textTransform: "uppercase" as const }}>General Capability Deck · 2026</span>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 900, color: WHITE, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.08, letterSpacing: -1, marginBottom: 6 }}>Hire&apos;in Solutions</h1>
          <h2 style={{ fontSize: 24, fontWeight: 600, color: ORANGE, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.4, marginBottom: 20 }}>Where AI Meets Human Intuition</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", fontFamily: "'Segoe UI', Arial, sans-serif", fontStyle: "italic", letterSpacing: 0.3 }}>&ldquo;We engineer perfect matches — faster, smarter, with complete confidence&rdquo;</p>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 22, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 0", width: "fit-content" }}>
            {["Healthcare", "IT & Engineering", "Professional Services"].map((label, i) => (
              <Fragment key={i}>
                {i > 0 && <div style={{ width: 1, height: 20, background: "rgba(244,124,32,0.4)", flexShrink: 0 }} />}
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.3, padding: "0 16px", whiteSpace: "nowrap" as const }}>{label}</span>
              </Fragment>
            ))}
          </div>
        </div>
        <div style={{ width: 260, background: "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 22, padding: 28 }}>
          {[
            { icon: Brain, label: "AI-Powered Matching" },
            { icon: Stethoscope, label: "Healthcare Staffing" },
            { icon: ShieldCheck, label: "100% Compliance" },
            { icon: TrendingUp, label: "95% Retention" },
          ].map(({ icon: Icon, label }, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(244,124,32,0.15)", border: "1px solid rgba(244,124,32,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} color={ORANGE} />
              </div>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: 500, textAlign: "center" as const, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{label}</span>
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
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>UEI: {profile.uei} · CAGE: {profile.cage}</span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: ORANGE, opacity: 0.6 }} />
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.5 }}>{slideNumber} / {totalSlides}</span>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide2ByTheNumbers() {
  const metrics = [
    { value: "10+", label: "Years in Business", sub: "Est. 2014 under Rayomind" },
    { value: "95%", label: "Client Retention", sub: "Year-over-year renewals" },
    { value: "90%", label: "AI Match Accuracy", sub: "Powered by KleriQ.ai" },
    { value: "50%", label: "Faster Placements", sub: "vs. industry average" },
    { value: "100%", label: "Compliance Rate", sub: "Healthcare verified" },
    { value: "98%", label: "Client Satisfaction", sub: "Client surveys" },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader label="By the Numbers" title="Performance that speaks for itself" />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: "20px 36px 14px", alignContent: "center" }}>
        {metrics.map(({ value, label, sub }, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 12, padding: "20px 18px", boxShadow: "0 2px 12px rgba(31,58,110,0.09)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" as const, gap: 4, borderTop: `3px solid ${i % 2 === 0 ? ORANGE : NAVY}` }}>
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
      <SectionHeader label="About Us" title="Who we are and what drives us" />
      <div style={{ flex: 1, display: "flex", gap: 20, padding: "18px 36px 12px", overflow: "hidden", alignItems: "center" }}>
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: WHITE, borderRadius: 10, padding: "16px 20px", borderLeft: `4px solid ${ORANGE}`, boxShadow: "0 2px 12px rgba(31,58,110,0.08)" }}>
            <p style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 6, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Our Mission</p>
            <p style={{ color: NAVY, fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Est. 2014 — Hire&apos;in Solutions was built as a tech-forward startup under <strong>Rayomind</strong> with a singular purpose: to revolutionize recruitment by merging AI precision with genuine human understanding across Healthcare, IT, Engineering &amp; Professional Services.</p>
          </div>
          <div style={{ background: NAVY, borderRadius: 10, padding: "16px 20px", boxShadow: "0 2px 12px rgba(31,58,110,0.12)" }}>
            <p style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 8, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Our Edge</p>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, lineHeight: 1.55, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
              We deploy proprietary AI tools — <strong style={{ color: ORANGE }}>KleriQ.ai</strong> for recruiter intelligence and job-fit analysis, and <strong style={{ color: ORANGE }}>proKred.com</strong> for healthcare compliance submission packets and credential sharing. Tools built in-house by our founder. Not licensed. Shipped.
              <span style={{ display: "block", marginTop: 6, fontSize: 9.5, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>San Jose, CA · US Headquarters</span>
            </p>
          </div>
        </div>
        <div style={{ flex: 0.8, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { icon: ShieldCheck, label: "Compliance-First Delivery", desc: "I-9, E-Verify, background screening and federal employment law built into every placement" },
            { icon: Brain, label: "AI-Powered Talent Matching", desc: "KleriQ.ai analyzes job requirements and matches candidates with 90%+ accuracy" },
            { icon: Star, label: "Dedicated Client Success", desc: "Named partner for every account — single point of contact from intake through onboarding" },
            { icon: Zap, label: "Fastest Fill Time in Class", desc: "Bench-ready talent and pre-vetted pipelines enabling rapid deployment for urgent roles" },
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

function Slide4Industries() {
  const industries = [
    { icon: Stethoscope, label: "Healthcare", sub: "Hospitals, clinics, telehealth, home health" },
    { icon: Code2, label: "Information Technology", sub: "Software, cloud, data, cybersecurity" },
    { icon: Factory, label: "Engineering", sub: "Industrial, mechanical, civil, chemical" },
    { icon: Landmark, label: "Finance & Banking", sub: "Financial services, risk, compliance" },
    { icon: Building2, label: "Professional Services", sub: "Consulting, legal, HR, operations" },
    { icon: Layers, label: "Enterprise & Retail", sub: "Operations, logistics, e-commerce" },
  ];
  const staffingTypes = [
    { label: "Contract Staffing", desc: "Flexible, scalable talent on demand" },
    { label: "Contract-to-Hire", desc: "Trial period leading to permanent placement" },
    { label: "Direct Placement", desc: "Permanent hires sourced and placed end-to-end" },
    { label: "Executive Search", desc: "Senior and C-suite leadership recruitment" },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader label="Industries & Services" title="Where we deliver" />
      <div style={{ flex: 1, display: "flex", gap: 20, padding: "16px 36px 12px", overflow: "hidden" }}>
        <div style={{ flex: 1.1, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 4, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Industries We Serve</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {industries.map(({ icon: Icon, label, sub }, i) => (
              <div key={i} style={{ background: WHITE, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 6px rgba(31,58,110,0.07)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: LIGHT2, border: `1.5px solid ${NAVY}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={14} color={NAVY} />
                </div>
                <div>
                  <p style={{ color: NAVY, fontSize: 11, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.2 }}>{label}</p>
                  <p style={{ color: "#6B7280", fontSize: 9, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 0.85, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 4, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Staffing Models</p>
          {staffingTypes.map(({ label, desc }, i) => (
            <div key={i} style={{ background: i % 2 === 0 ? NAVY : WHITE, borderRadius: 8, padding: "12px 16px", boxShadow: "0 1px 6px rgba(31,58,110,0.08)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <p style={{ color: i % 2 === 0 ? ORANGE : NAVY, fontSize: 12, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif", marginBottom: 3 }}>{label}</p>
              <p style={{ color: i % 2 === 0 ? "rgba(255,255,255,0.65)" : "#6B7280", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide5Services() {
  const services = [
    {
      icon: Stethoscope,
      title: "Healthcare Recruitment",
      color: NAVY,
      items: ["Physicians & Surgeons", "Registered Nurses", "Allied Health", "Telehealth Specialists"],
      highlight: "Compliance packets via proKred.com · HIPAA-ready",
    },
    {
      icon: Code2,
      title: "IT & Software Staffing",
      color: ORANGE,
      items: ["Software Engineers", "DevOps & Cloud", "Data Scientists", "Cybersecurity"],
      highlight: "AI-matched via KleriQ.ai · 92% accuracy",
    },
    {
      icon: Factory,
      title: "Engineering & Technical",
      color: NAVY,
      items: ["Mechanical Engineers", "Civil Engineers", "Industrial Tech", "Project Managers"],
      highlight: "Domain-specialist recruiters",
    },
    {
      icon: Building2,
      title: "Professional Services",
      color: ORANGE,
      items: ["Finance & Accounting", "HR & Operations", "Marketing", "Executive Search"],
      highlight: "Senior talent, fast fills",
    },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader label="Services & Specializations" title="End-to-end talent solutions" />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "16px 36px 12px" }}>
        {services.map(({ icon: Icon, title, color, items, highlight }, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 10, padding: "14px 16px", boxShadow: "0 2px 10px rgba(31,58,110,0.09)", borderTop: `3px solid ${color}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: LIGHT2, border: `1.5px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <p style={{ color: NAVY, fontSize: 13, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{title}</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
              {items.map((item, j) => (
                <span key={j} style={{ background: LIGHT2, color: NAVY, fontSize: 9.5, fontWeight: 600, padding: "3px 8px", borderRadius: 4, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{item}</span>
              ))}
            </div>
            <p style={{ color: color, fontSize: 9, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", fontStyle: "italic", marginTop: "auto" }}>{highlight}</p>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}

function Slide6Technology() {
  return (
    <SlideWrapper bg={NAVY}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 36px 10px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(244,124,32,0.2)", border: "1px solid rgba(244,124,32,0.4)", borderRadius: 20, padding: "3px 12px", marginBottom: 7 }}>
              <Brain size={11} color={ORANGE} />
              <span style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Proprietary AI Stack</span>
            </div>
            <h2 style={{ color: WHITE, fontSize: 20, fontWeight: 900, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.1, margin: 0 }}>Tools We Built. Advantages You Get.</h2>
          </div>
          <HISLogo size={34} light />
        </div>
        <div style={{ flex: 1, display: "flex", gap: 14, padding: "8px 36px 10px", overflow: "hidden" }}>
          {[
            {
              name: "KleriQ.ai",
              tagline: "Recruiter Intelligence Engine",
              color: ORANGE,
              desc: "Transforms complex job descriptions into plain-language insights, structured intake questions, sourcing logic, and recruiter-ready guidance. Helps every recruiter understand the role deeply and submit stronger candidates.",
              features: ["JD-to-insights in seconds", "Structured intake questions", "Sourcing logic & role-family intelligence", "Resume match scoring", "Requirement gap detection"],
            },
            {
              name: "proKred.com",
              tagline: "Compliance Packets & Skill Checklists",
              color: "#4CAF50",
              desc: "Purpose-built compliance submission packet, credential sharing, and skill checklist tool that simplifies credential collection, compiles audit-ready submission packets, and enables secure credential sharing for healthcare professionals, staffing agencies, MSPs, and facilities.",
              features: ["Compliant submission packets", "Public-directory license & exclusion checks", "Secure credential sharing", "Gold-standard skill checklists", "HIPAA-ready workflows"],
            },
            {
              name: "Ceipal ATS",
              tagline: "Enterprise Applicant Tracking",
              color: "#2196F3",
              desc: "Fully integrated with Ceipal's enterprise ATS for seamless job posting synchronization, candidate management, and end-to-end recruitment workflow automation across all verticals.",
              features: ["Bidirectional job sync", "Automated candidate push", "Pipeline visibility", "Workflow automation", "Enterprise reporting"],
            },
          ].map(({ name, tagline, color, desc, features }, i) => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${color}33`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 12, padding: "3px 10px", marginBottom: 6 }}>
                  <span style={{ color, fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" as const, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Built by Escanor</span>
                </div>
                <p style={{ color: WHITE, fontSize: 16, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif", margin: "0 0 2px" }}>{name}</p>
                <p style={{ color, fontSize: 10, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>{tagline}</p>
              </div>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10.5, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.5, flex: 1 }}>{desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {features.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <SlideFooter />
    </SlideWrapper>
  );
}

function Slide7Process() {
  const steps = [
    { step: "01", icon: Search, title: "Discovery", desc: "Deep-dive into requirements, culture, and goals. KleriQ.ai creates intelligent candidate profiles and sourcing logic from the JD." },
    { step: "02", icon: Brain, title: "AI Sourcing", desc: "KleriQ.ai matches candidates by skills, fit, and experience with 90%+ accuracy — reducing noise and surfacing only the strongest profiles." },
    { step: "03", icon: UserCheck, title: "Validation", desc: "Expert recruiters assess cultural fit, soft skills, communication, and career alignment — the human layer AI cannot replace." },
    { step: "04", icon: FileCheck, title: "Credentials", desc: "Our compliance team runs background and credential checks; proKred.com compiles everything into a compliant, audit-ready submission packet for every placement." },
    { step: "05", icon: Handshake, title: "Placement", desc: "Pre-vetted candidates delivered with complete documentation, compliance packages, and onboarding readiness confirmed." },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader label="Our Process" title="Five steps from intake to onboarded" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "16px 36px 12px", gap: 0, overflow: "hidden" }}>
        {steps.map(({ step, icon: Icon, title, desc }, i) => (
          <Fragment key={i}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" as const, gap: 8, padding: "0 10px" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: i % 2 === 0 ? NAVY : ORANGE, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(31,58,110,0.2)", flexShrink: 0 }}>
                <Icon size={22} color={WHITE} />
              </div>
              <div style={{ background: i % 2 === 0 ? NAVY : ORANGE, color: WHITE, fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 10, letterSpacing: 1, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{step}</div>
              <p style={{ color: NAVY, fontSize: 12.5, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.2, margin: 0 }}>{title}</p>
              <p style={{ color: "#6B7280", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.45, maxWidth: 140 }}>{desc}</p>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 20, height: 2, background: `linear-gradient(90deg, ${NAVY} 0%, ${ORANGE} 100%)`, borderRadius: 2 }} />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </SlideWrapper>
  );
}

function Slide8Clients() {
  const clients = [
    { name: "Abbott", industry: "Healthcare" },
    { name: "McKesson", industry: "Healthcare" },
    { name: "Wells Fargo", industry: "Banking" },
    { name: "Walmart", industry: "Retail" },
    { name: "American Airlines", industry: "Aviation" },
    { name: "Wipro", industry: "IT Services" },
    { name: "TCS", industry: "IT Services" },
    { name: "Accenture", industry: "Consulting" },
    { name: "22nd Century", industry: "Technology" },
    { name: "Bentley", industry: "Engineering" },
    { name: "RC4Vet", industry: "Healthcare" },
    { name: "AYA", industry: "Healthcare" },
    { name: "NYCHH", industry: "Healthcare" },
    { name: "Edmodo", industry: "EdTech" },
    { name: "Mathison", industry: "AI/HR Tech" },
  ];
  const highlights = [
    { icon: Building2, label: "Fortune 500 Clients", desc: "Abbott, McKesson, Wells Fargo, Walmart, American Airlines and more" },
    { icon: Globe, label: "All 50 US States", desc: "Coast-to-coast staffing coverage across every vertical" },
    { icon: Clock, label: "< 5 Day Avg Fill", desc: "From intake to qualified submission across most roles" },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader label="Clients & Partners" title="Trusted across industries" />
      <div style={{ flex: 1, display: "flex", gap: 20, padding: "16px 36px 12px", overflow: "hidden" }}>
        <div style={{ flex: 1.3, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: "#6B7280", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif", marginBottom: 4, fontStyle: "italic" }}>Talent placed at and clients served by Hire&apos;in Solutions and its founder</p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
            {clients.map(({ name, industry }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: WHITE, border: `1px solid ${LIGHT2}`, borderRadius: 6, padding: "5px 10px", boxShadow: "0 1px 4px rgba(31,58,110,0.07)" }}>
                <span style={{ color: NAVY, fontSize: 11, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{name}</span>
                <span style={{ color: "#6B7280", fontSize: 9, fontFamily: "'Segoe UI', Arial, sans-serif", background: LIGHT2, padding: "1px 5px", borderRadius: 3 }}>{industry}</span>
              </div>
            ))}
          </div>
          <p style={{ color: "#6B7280", fontSize: 9, fontFamily: "'Segoe UI', Arial, sans-serif", fontStyle: "italic", marginTop: 2 }}>...and many more across Healthcare, IT, Engineering &amp; Professional Services</p>
        </div>
        <div style={{ flex: 0.65, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
          {highlights.map(({ icon: Icon, label, desc }, i) => (
            <div key={i} style={{ background: i === 0 ? NAVY : WHITE, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12, boxShadow: "0 2px 10px rgba(31,58,110,0.09)", borderLeft: i !== 0 ? `4px solid ${ORANGE}` : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: i === 0 ? "rgba(244,124,32,0.2)" : LIGHT2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} color={i === 0 ? ORANGE : NAVY} />
              </div>
              <div>
                <p style={{ color: i === 0 ? WHITE : NAVY, fontSize: 12, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif", marginBottom: 3 }}>{label}</p>
                <p style={{ color: i === 0 ? "rgba(255,255,255,0.65)" : "#6B7280", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.4 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide9WhyUs() {
  const differentiators = [
    { icon: Sparkles, title: "Tech-Forward DNA", desc: "Born from a software engineering company — we build like technologists, not traditional staffing firms." },
    { icon: Brain, title: "Best-in-Class AI Tools", desc: "KleriQ.ai and proKred.com — proprietary tools built and shipped by our founder, not licensed from vendors." },
    { icon: Clock, title: "50% Faster Placements", desc: "AI pre-screening cuts time-to-hire in half while improving the quality of every submission." },
    { icon: Shield, title: "100% Compliance Rate", desc: "Zero-compromise credential verification and compliance documentation for every single placement." },
    { icon: Target, title: "Founder-Led Quality", desc: "Our CEO has personally shipped FDA-regulated software. That same standard applies to every candidate we place." },
    { icon: TrendingUp, title: "95% Client Retention", desc: "Clients stay because we consistently deliver quality talent on time, every time." },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader label="Why Hire'in Solutions" title="The edge that matters" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 36px 12px", gap: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, flex: 1, alignContent: "center" }}>
          {differentiators.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} style={{ background: WHITE, borderRadius: 10, padding: "14px 14px", boxShadow: "0 2px 10px rgba(31,58,110,0.08)", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: LIGHT2, border: `1.5px solid ${i % 3 === 0 ? ORANGE : NAVY}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={15} color={i % 3 === 0 ? ORANGE : NAVY} />
              </div>
              <div>
                <p style={{ color: NAVY, fontSize: 11.5, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif", marginBottom: 3 }}>{title}</p>
                <p style={{ color: "#6B7280", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.45 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: NAVY, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(244,124,32,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BadgeCheck size={18} color={ORANGE} />
          </div>
          <div>
            <p style={{ color: WHITE, fontSize: 12, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif", marginBottom: 2 }}>Compliance & Credentialing Guarantee</p>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Every healthcare placement includes a proKred.com compliant submission packet with public-directory license checks — HIPAA-ready, TJC-HCSS aligned. Zero exceptions.</p>
          </div>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexShrink: 0 }}>
            {["HIPAA", "TJC", "E-Verify"].map((b, i) => (
              <span key={i} style={{ background: "rgba(244,124,32,0.2)", color: ORANGE, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.5 }}>{b}</span>
            ))}
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide10Founder() {
  const highlights = [
    { icon: Cpu, title: "FDA-Regulated MedTech at Abbott", desc: "Led quality & release engineering for Abbott Lingo CGM bio-wearable — FDA QSR & 21 CFR aligned." },
    { icon: Landmark, title: "Industry-First at Wells Fargo", desc: "Delivered end-to-end engineering validation for the first mobile wallet launched by a major U.S. bank." },
    { icon: Users, title: "500K-Student Platform at Edmodo", desc: "Led 25-person global team supporting national-scale exam infrastructure for half a million students." },
    { icon: Brain, title: "AI & GenAI at the Frontier", desc: "ML-driven physician note automation and clinical trials management at McKesson; GenAI governance and automation at Mathison and Abbott — before enterprise AI went mainstream." },
  ];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader label="Meet the Founder" title="The engineering discipline behind every placement" />
      <div style={{ flex: 1, display: "flex", gap: 20, padding: "14px 36px 12px", overflow: "hidden" }}>
        <div style={{ flex: 1.1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: WHITE, borderRadius: 10, padding: "14px 16px", borderLeft: `4px solid ${ORANGE}`, boxShadow: "0 2px 10px rgba(31,58,110,0.08)" }}>
            <p style={{ color: NAVY, fontSize: 14.5, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif", marginBottom: 4 }}>Simranjeet Sidana</p>
            <p style={{ color: ORANGE, fontSize: 10, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.5, marginBottom: 8 }}>CEO &amp; Founder · Hire&apos;in Solutions / Escanor Technologies</p>
            <p style={{ color: "#4B5563", fontSize: 10.5, lineHeight: 1.55, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
              14+ years shipping high-stakes software across regulated medical devices, financial platforms, precision oncology patient care software, enterprise retail, airline technology, and national-scale education infrastructure. Founded Escanor Technologies and built the AI tools Hire&apos;in runs on — <strong style={{ color: NAVY }}>KleriQ.ai</strong> and <strong style={{ color: NAVY }}>proKred.com</strong> — from scratch.
            </p>
          </div>
          <div style={{ background: NAVY, borderRadius: 10, padding: "12px 16px", boxShadow: "0 2px 10px rgba(31,58,110,0.12)" }}>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 10.5, fontStyle: "italic", lineHeight: 1.55, fontFamily: "'Segoe UI', Arial, sans-serif", marginBottom: 6 }}>
              &ldquo;Every placement we make is an engineering decision. You define the requirements. We build the match — with the same precision, accountability, and quality gates I&apos;ve applied to regulated systems my entire career.&rdquo;
            </p>
            <p style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif" }}>— Simranjeet Sidana, CEO &amp; Founder</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
            {["Wharton 2024", "PSM II", "ISTQB Advanced", "14+ Years", "B.E. Computer Science"].map((b, i) => (
              <span key={i} style={{ background: LIGHT2, color: NAVY, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, fontFamily: "'Segoe UI', Arial, sans-serif", border: `1px solid ${LIGHT2}` }}>{b}</span>
            ))}
            <a href="https://linkedin.com/in/simranjeetsidana" style={{ display: "flex", alignItems: "center", gap: 4, background: "#0A66C2", color: WHITE, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, fontFamily: "'Segoe UI', Arial, sans-serif", textDecoration: "none" }}>
              <Linkedin size={9} color={WHITE} /> LinkedIn
            </a>
          </div>
        </div>
        <div style={{ flex: 0.85, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start" }}>
          {highlights.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} style={{ background: WHITE, borderRadius: 8, padding: "11px 12px", boxShadow: "0 1px 6px rgba(31,58,110,0.08)", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: LIGHT2, border: `1.5px solid ${i % 2 === 0 ? ORANGE : NAVY}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={14} color={i % 2 === 0 ? ORANGE : NAVY} />
              </div>
              <p style={{ color: NAVY, fontSize: 10.5, fontWeight: 800, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.3 }}>{title}</p>
              <p style={{ color: "#6B7280", fontSize: 9, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.4 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide11Contact() {
  const { slideNumber, totalSlides } = useContext(CapabilitySlideNumberContext);
  const profile = useCompanyProfile();
  return (
    <SlideWrapper bg={NAVY} noFooter>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "36px 56px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -80, top: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(244,124,32,0.07)" }} />
        <div style={{ position: "absolute", right: -80, bottom: -80, width: 400, height: 400, borderRadius: "50%", background: "rgba(244,124,32,0.05)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: `linear-gradient(180deg, ${ORANGE} 0%, ${ORANGE2} 100%)` }} />
        <div style={{ position: "relative", textAlign: "center" as const, maxWidth: 700 }}>
          <HISLogo size={48} light />
          <div style={{ marginTop: 20, marginBottom: 10 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(244,124,32,0.18)", border: "1px solid rgba(244,124,32,0.35)", borderRadius: 20, padding: "4px 14px", marginBottom: 16 }}>
              <Zap size={11} color={ORANGE} />
              <span style={{ color: ORANGE, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, fontFamily: "'Segoe UI', Arial, sans-serif" }}>Ready to Transform Your Hiring?</span>
            </div>
            <h2 style={{ color: WHITE, fontSize: 32, fontWeight: 900, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.1, margin: "0 0 10px" }}>Let&apos;s Build Your Dream Team</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "'Segoe UI', Arial, sans-serif", lineHeight: 1.5, margin: "0 0 24px" }}>
              Hire&apos;in Solutions brings together recruiting expertise, AI-enabled tooling, and founder-led quality discipline to help clients hire with more clarity, speed, and confidence.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" as const }}>
            {[
              { icon: Phone, label: "+1 (408) 412-9890", sub: "Call us" },
              { icon: Mail, label: "contact@hire-in.com", sub: "Email us" },
              { icon: MapPin, label: "San Jose, CA", sub: "Headquarters" },
              { icon: Globe, label: "hire-in.com", sub: "Website" },
            ].map(({ icon: Icon, label, sub }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 16px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(244,124,32,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} color={ORANGE} />
                </div>
                <div style={{ textAlign: "left" as const }}>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontFamily: "'Segoe UI', Arial, sans-serif", margin: "0 0 1px" }}>{sub}</p>
                  <p style={{ color: WHITE, fontSize: 11, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <FederalCredentialsBar />
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
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontFamily: "'Segoe UI', Arial, sans-serif" }}>UEI: {profile.uei} · CAGE: {profile.cage}</span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: ORANGE, opacity: 0.6 }} />
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontWeight: 600, fontFamily: "'Segoe UI', Arial, sans-serif", letterSpacing: 0.5 }}>{slideNumber} / {totalSlides}</span>
        </div>
      </div>
    </SlideWrapper>
  );
}

export const CAPABILITY_TOTAL_SLIDES = 11;

export const CAPABILITY_SLIDES = [
  { id: 1, title: "Cover", component: <Slide1Cover /> },
  { id: 2, title: "By the Numbers", component: <Slide2ByTheNumbers /> },
  { id: 3, title: "About Us", component: <Slide3About /> },
  { id: 4, title: "Industries & Services", component: <Slide4Industries /> },
  { id: 5, title: "Services", component: <Slide5Services /> },
  { id: 6, title: "AI Technology", component: <Slide6Technology /> },
  { id: 7, title: "Our Process", component: <Slide7Process /> },
  { id: 8, title: "Clients & Partners", component: <Slide8Clients /> },
  { id: 9, title: "Why Hire'in", component: <Slide9WhyUs /> },
  { id: 10, title: "Meet the Founder", component: <Slide10Founder /> },
  { id: 11, title: "Contact / CTA", component: <Slide11Contact /> },
];
