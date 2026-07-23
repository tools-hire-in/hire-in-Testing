import { createContext, useContext } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Brain,
  CheckCircle,
  ChevronRight,
  Clock,
  Cloud,
  Code2,
  Cpu,
  Database,
  FileCheck,
  Globe,
  Handshake,
  Linkedin,
  Mail,
  MapPin,
  Search,
  Shield,
  ShieldCheck,
  Star,
  Stethoscope,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

/* ── Tokens ─────────────────────────────────────────────────────────────── */
const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";
const ORANGE2 = "#F96D3E";
const WHITE = "#FFFFFF";
const LIGHT_BG = "#F5F7FA";
const FONT = "'Segoe UI', Arial, sans-serif";

/* ── Slide data types ───────────────────────────────────────────────────── */
export interface CoverSlide {
  slide_type: "cover";
  badge: string;
  title: string;
  subtitle: string;
  tagline: string;
  stats: Array<{ value: string; label: string }>;
  right_icons: Array<{ icon: LucideIcon; label: string }>;
}
export interface StatsSlide {
  slide_type: "stats";
  title: string;
  metrics: Array<{ value: string; label: string; sub: string }>;
}
export interface AboutSlide {
  slide_type: "about";
  title: string;
  mission_label: string;
  mission_text: string;
  navy_block_label: string;
  navy_block_text: string;
  right_items: Array<{ icon: LucideIcon; title: string; sub: string }>;
}
export interface ServicesSlide {
  slide_type: "services";
  title: string;
  cards: Array<{ icon: LucideIcon; icon_bg: string; title: string; description: string; checks: string[] }>;
}
export interface ComparisonTableSlide {
  slide_type: "comparison_table";
  title: string;
  columns: string[];
  rows: Array<{ label: string; checks: boolean[] }>;
  banner: string;
}
export interface FeatureGridSlide {
  slide_type: "feature_grid";
  badge: string;
  title: string;
  subtitle: string;
  cells: Array<{ icon: LucideIcon; title: string; desc: string }>;
}
export interface WhyUsSlide {
  slide_type: "why_us";
  title: string;
  cards: Array<{ icon: LucideIcon; title: string; description: string; badge: string }>;
}
export interface ProcessFlowSlide {
  slide_type: "process_flow";
  title: string;
  steps: Array<{ icon: LucideIcon; name: string; desc: string; highlight?: boolean; highlight_label?: string }>;
  banner: string;
}
export interface DemandFlowSlide {
  slide_type: "demand_flow";
  title: string;
  steps: Array<{ icon: LucideIcon; name: string; desc: string }>;
  metrics: Array<{ value: string; label: string; orange?: boolean }>;
}
export interface DomainMatrixSlide {
  slide_type: "domain_matrix";
  title: string;
  domains: Array<{ icon: LucideIcon; label: string }>;
  column_headers: string[];
}
export interface ContactSlide {
  slide_type: "contact";
  tagline: string;
  subtitle: string;
  contacts: Array<{ icon: LucideIcon; label: string; value: string }>;
}

export type TypedSlide =
  | CoverSlide | StatsSlide | AboutSlide | ServicesSlide | ComparisonTableSlide
  | FeatureGridSlide | WhyUsSlide | ProcessFlowSlide | DemandFlowSlide | DomainMatrixSlide | ContactSlide;

/* ── Deck context ────────────────────────────────────────────────────────── */
export interface DeckCtx { slideNumber: number; totalSlides: number; deckLabel: string; }
export const DeckContext = createContext<DeckCtx>({ slideNumber: 1, totalSlides: 11, deckLabel: "US IT Staffing" });

/* ── Shared sub-components ──────────────────────────────────────────────── */
function HISLogo({ h = 36 }: { h?: number }) {
  return (
    <img src={logoImage} alt="Hire'in Solutions"
      style={{ height: h, width: "auto", display: "block", objectFit: "contain", mixBlendMode: "screen", borderRadius: 4, flexShrink: 0 }} />
  );
}

function SlideFooter({ dark = false }: { dark?: boolean }) {
  const { slideNumber, totalSlides, deckLabel } = useContext(DeckContext);
  const bg = dark ? "rgba(255,255,255,0.05)" : NAVY;
  const borderTop = dark ? "1px solid rgba(255,255,255,0.08)" : "none";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 36px", background: bg, borderTop, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <HISLogo h={22} />
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>|</span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, fontFamily: FONT }}>Hire&apos;in Solutions</span>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 9.5, fontFamily: FONT }}>A Rayomind Company</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: FONT }}>{deckLabel} · hire-in.com</span>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9.5, fontWeight: 600, fontFamily: FONT, letterSpacing: 0.5 }}>{slideNumber} / {totalSlides}</span>
      </div>
    </div>
  );
}

function SlideWrapper({ children, bg = WHITE, dark = false }: { children: React.ReactNode; bg?: string; dark?: boolean }) {
  return (
    <div style={{ width: "100%", aspectRatio: "16/9", background: bg, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 4px 32px rgba(31,58,110,0.18)", borderRadius: 6 }}>
      {children}
      <SlideFooter dark={dark} />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ background: NAVY, padding: "14px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <p style={{ color: ORANGE, fontSize: 17, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", fontFamily: FONT, margin: 0 }}>{title}</p>
      <HISLogo h={30} />
    </div>
  );
}

/* ── 1. Cover ────────────────────────────────────────────────────────────── */
export function CoverSlideLayout({ data }: { data: CoverSlide }) {
  return (
    <SlideWrapper bg={NAVY} dark>
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", right: -100, top: -100, width: 500, height: 500, borderRadius: "50%", border: "80px solid rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 0, top: 50, width: 320, height: 320, borderRadius: "50%", border: "60px solid rgba(255,255,255,0.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -50, bottom: -80, width: 280, height: 280, borderRadius: "50%", border: "50px solid rgba(244,124,32,0.05)", pointerEvents: "none" }} />

        {/* Left 2/3 */}
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column", justifyContent: "center", padding: "28px 40px" }}>
          <div style={{ marginBottom: 18 }}><HISLogo h={48} /></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(244,124,32,0.18)", border: "1px solid rgba(244,124,32,0.35)", borderRadius: 20, padding: "4px 14px", marginBottom: 14, width: "fit-content" }}>
            <Zap size={11} color={ORANGE} />
            <span style={{ color: ORANGE, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5, fontFamily: FONT, textTransform: "uppercase" }}>{data.badge}</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: WHITE, fontFamily: FONT, lineHeight: 1.1, letterSpacing: -0.5, margin: "0 0 6px" }}>{data.title}</h1>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: ORANGE, fontFamily: FONT, letterSpacing: 0.3, margin: "0 0 10px" }}>{data.subtitle}</h2>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", fontFamily: FONT, fontStyle: "italic", margin: "0 0 18px" }}>&ldquo;{data.tagline}&rdquo;</p>
          {/* Stats bar */}
          <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 0", width: "fit-content" }}>
            {data.stats.flatMap((s, i) => [
              ...(i > 0 ? [<div key={`div-${i}`} style={{ width: 1, height: 28, background: "rgba(244,124,32,0.4)" }} />] : []),
              <div key={`stat-${i}`} style={{ padding: "0 18px", textAlign: "center" }}>
                <div style={{ color: ORANGE, fontSize: 16, fontWeight: 900, fontFamily: FONT, lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, fontFamily: FONT, marginTop: 2 }}>{s.label}</div>
              </div>,
            ])}
          </div>
        </div>

        {/* Right 1/3 */}
        <div style={{ width: 220, background: "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 16, padding: 24 }}>
          {data.right_icons.map(({ icon: Icon, label }, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(244,124,32,0.15)", border: "1px solid rgba(244,124,32,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} color={ORANGE} />
              </div>
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 9.5, fontWeight: 500, textAlign: "center", fontFamily: FONT, lineHeight: 1.3 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── 2. Stats Grid ───────────────────────────────────────────────────────── */
export function StatsSlideLayout({ data }: { data: StatsSlide }) {
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader title={data.title} />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: "16px 36px 12px", alignContent: "center" }}>
        {data.metrics.map(({ value, label, sub }, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 10, padding: "18px 16px", boxShadow: "0 2px 10px rgba(31,58,110,0.09)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 3, borderTop: `3px solid ${i % 2 === 0 ? ORANGE : NAVY}` }}>
            <p style={{ color: i % 2 === 0 ? ORANGE : NAVY, fontSize: 26, fontWeight: 900, fontFamily: FONT, lineHeight: 1, margin: 0 }}>{value}</p>
            <p style={{ color: NAVY, fontSize: 11.5, fontWeight: 800, fontFamily: FONT, margin: 0 }}>{label}</p>
            <p style={{ color: "#6B7280", fontSize: 9, fontFamily: FONT, lineHeight: 1.4, margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}

/* ── 3. About ────────────────────────────────────────────────────────────── */
export function AboutSlideLayout({ data }: { data: AboutSlide }) {
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader title={data.title} />
      <div style={{ flex: 1, display: "flex", gap: 18, padding: "14px 36px 12px", overflow: "hidden", alignItems: "center" }}>
        {/* Left ~60% */}
        <div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: 12, height: "100%", justifyContent: "center" }}>
          <div style={{ background: WHITE, borderRadius: 10, padding: "14px 18px", borderLeft: `4px solid ${ORANGE}`, boxShadow: "0 2px 10px rgba(31,58,110,0.08)" }}>
            <p style={{ color: ORANGE, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: FONT, margin: "0 0 6px" }}>{data.mission_label}</p>
            <p style={{ color: NAVY, fontSize: 12, fontWeight: 600, lineHeight: 1.55, fontFamily: FONT, margin: 0 }}>{data.mission_text}</p>
          </div>
          <div style={{ background: NAVY, borderRadius: 10, padding: "14px 18px", boxShadow: "0 2px 10px rgba(31,58,110,0.12)" }}>
            <p style={{ color: ORANGE, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: FONT, margin: "0 0 6px" }}>{data.navy_block_label}</p>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5, lineHeight: 1.55, fontFamily: FONT, margin: 0 }}>{data.navy_block_text}</p>
          </div>
        </div>
        {/* Right ~40% */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, height: "100%", justifyContent: "center" }}>
          {data.right_items.map(({ icon: Icon, title, sub }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: WHITE, borderRadius: 8, padding: "10px 12px", boxShadow: "0 1px 6px rgba(31,58,110,0.07)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `rgba(244,124,32,0.12)`, border: `1.5px solid ${ORANGE}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={15} color={ORANGE} />
              </div>
              <div>
                <p style={{ color: NAVY, fontSize: 11, fontWeight: 700, fontFamily: FONT, margin: "0 0 2px" }}>{title}</p>
                <p style={{ color: "#6B7280", fontSize: 9.5, fontFamily: FONT, margin: 0, lineHeight: 1.4 }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── 4. Services ─────────────────────────────────────────────────────────── */
export function ServicesSlideLayout({ data }: { data: ServicesSlide }) {
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader title={data.title} />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "14px 36px 12px" }}>
        {data.cards.map(({ icon: Icon, icon_bg, title, description, checks }, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 10, padding: "14px 16px", boxShadow: "0 2px 10px rgba(31,58,110,0.09)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: icon_bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={18} color={WHITE} />
              </div>
              <p style={{ color: NAVY, fontSize: 13, fontWeight: 800, fontFamily: FONT, margin: 0 }}>{title}</p>
            </div>
            <p style={{ color: "#4B5563", fontSize: 10, fontFamily: FONT, margin: 0, lineHeight: 1.5 }}>{description}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {checks.map((c, j) => (
                <div key={j} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle size={11} color={ORANGE} style={{ flexShrink: 0 }} />
                  <span style={{ color: "#374151", fontSize: 10, fontFamily: FONT }}>{c}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}

/* ── 5. Comparison Table ─────────────────────────────────────────────────── */
export function ComparisonTableSlideLayout({ data }: { data: ComparisonTableSlide }) {
  const colColors = [NAVY, NAVY2, ORANGE, ORANGE2];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader title={data.title} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 36px 0" }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: `1.5fr ${data.columns.map(() => "1fr").join(" ")}`, gap: 6, marginBottom: 8 }}>
          <div />
          {data.columns.map((col, i) => (
            <div key={i} style={{ background: colColors[i] || NAVY, borderRadius: 20, padding: "5px 10px", textAlign: "center" }}>
              <span style={{ color: WHITE, fontSize: 10, fontWeight: 700, fontFamily: FONT, whiteSpace: "nowrap" }}>{col}</span>
            </div>
          ))}
        </div>
        {/* Rows */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {data.rows.map(({ label, checks }, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: `1.5fr ${data.columns.map(() => "1fr").join(" ")}`, gap: 6, background: i % 2 === 0 ? WHITE : "#EEF2F8", borderRadius: 8, padding: "8px 12px", alignItems: "center" }}>
              <span style={{ color: ORANGE, fontSize: 11, fontWeight: 700, fontFamily: FONT }}>{label}</span>
              {checks.map((c, j) => (
                <div key={j} style={{ display: "flex", justifyContent: "center" }}>
                  {c ? <CheckCircle size={16} color={i % 2 === 0 ? NAVY : ORANGE} /> : <span style={{ color: "#D1D5DB", fontSize: 14 }}>—</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* Banner */}
        <div style={{ background: NAVY, borderRadius: "0 0 6px 6px", padding: "8px 20px", marginTop: 8 }}>
          <p style={{ color: WHITE, fontSize: 10, fontFamily: FONT, margin: 0, textAlign: "center" }}>
            <span style={{ color: ORANGE, fontWeight: 700 }}>{data.banner.split("—")[0]}</span>
            {data.banner.includes("—") ? `—${data.banner.split("—").slice(1).join("—")}` : ""}
          </p>
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── 6. Feature Grid ─────────────────────────────────────────────────────── */
export function FeatureGridSlideLayout({ data }: { data: FeatureGridSlide }) {
  return (
    <SlideWrapper bg={NAVY} dark>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 36px 8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(244,124,32,0.2)", border: "1px solid rgba(244,124,32,0.4)", borderRadius: 20, padding: "3px 12px", marginBottom: 7 }}>
              <Zap size={10} color={ORANGE} />
              <span style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", fontFamily: FONT }}>{data.badge}</span>
            </div>
            <h2 style={{ color: ORANGE, fontSize: 18, fontWeight: 900, fontFamily: FONT, margin: "0 0 3px" }}>{data.title}</h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, fontFamily: FONT, margin: 0 }}>{data.subtitle}</p>
          </div>
          <HISLogo h={32} />
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "6px 36px 12px" }}>
          {data.cells.map(({ icon: Icon, title, desc }, i) => {
            const isLast = i === data.cells.length - 1;
            return (
              <div key={i} style={{ background: isLast ? ORANGE : "rgba(255,255,255,0.06)", border: isLast ? "none" : "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: isLast ? "rgba(255,255,255,0.2)" : "rgba(244,124,32,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} color={WHITE} />
                </div>
                <p style={{ color: WHITE, fontSize: 11.5, fontWeight: 700, fontFamily: FONT, margin: 0 }}>{title}</p>
                <p style={{ color: isLast ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.6)", fontSize: 9.5, fontFamily: FONT, margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── 7. Why Us ───────────────────────────────────────────────────────────── */
export function WhyUsSlideLayout({ data }: { data: WhyUsSlide }) {
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader title={data.title} />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "14px 36px 12px" }}>
        {data.cards.map(({ icon: Icon, title, description, badge }, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 10, padding: "16px", boxShadow: "0 2px 10px rgba(31,58,110,0.09)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={18} color={WHITE} />
            </div>
            <p style={{ color: NAVY, fontSize: 13, fontWeight: 800, fontFamily: FONT, margin: 0 }}>{title}</p>
            <p style={{ color: "#4B5563", fontSize: 10.5, fontFamily: FONT, margin: 0, lineHeight: 1.55, flex: 1 }}>{description}</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1.5px solid ${ORANGE}`, borderRadius: 20, padding: "3px 10px", width: "fit-content", marginTop: "auto" }}>
              <Star size={10} color={ORANGE} />
              <span style={{ color: ORANGE, fontSize: 9.5, fontWeight: 700, fontFamily: FONT }}>{badge}</span>
            </div>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}

/* ── 8. Process Flow ─────────────────────────────────────────────────────── */
export function ProcessFlowSlideLayout({ data }: { data: ProcessFlowSlide }) {
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader title={data.title} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 36px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 4, justifyContent: "center", flex: 1 }}>
          {data.steps.flatMap(({ icon: Icon, name, desc, highlight, highlight_label }, i) => [
            <div key={`step-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: highlight ? ORANGE : NAVY, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: highlight ? `0 0 0 4px rgba(244,124,32,0.2)` : "none", flexShrink: 0 }}>
                <Icon size={22} color={WHITE} />
              </div>
              {highlight && highlight_label && (
                <div style={{ background: "rgba(244,124,32,0.15)", border: "1px solid rgba(244,124,32,0.3)", borderRadius: 12, padding: "2px 8px" }}>
                  <span style={{ color: ORANGE, fontSize: 8.5, fontWeight: 700, fontFamily: FONT }}>{highlight_label}</span>
                </div>
              )}
              <p style={{ color: NAVY, fontSize: 11, fontWeight: 700, fontFamily: FONT, textAlign: "center", margin: 0 }}>{name}</p>
              <p style={{ color: "#6B7280", fontSize: 9.5, fontFamily: FONT, textAlign: "center", margin: 0, lineHeight: 1.4 }}>{desc}</p>
            </div>,
            ...(i < data.steps.length - 1 ? [
              <div key={`chevron-${i}`} style={{ paddingTop: 16, flexShrink: 0 }}>
                <ChevronRight size={20} color="rgba(31,58,110,0.3)" />
              </div>
            ] : []),
          ])}
        </div>
        {/* Banner */}
        <div style={{ background: NAVY, borderRadius: "0 0 6px 6px", padding: "8px 20px", marginTop: 10 }}>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontFamily: FONT, margin: 0, textAlign: "center" }}>{data.banner}</p>
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── 9. Demand Flow ──────────────────────────────────────────────────────── */
export function DemandFlowSlideLayout({ data }: { data: DemandFlowSlide }) {
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader title={data.title} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 36px 12px" }}>
        {/* Steps */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 3, justifyContent: "center", marginBottom: 12 }}>
          {data.steps.flatMap(({ icon: Icon, name, desc }, i) => [
            <div key={`step-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: i % 2 === 0 ? NAVY : ORANGE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} color={WHITE} />
              </div>
              <p style={{ color: NAVY, fontSize: 9.5, fontWeight: 700, fontFamily: FONT, textAlign: "center", margin: 0 }}>{name}</p>
              <p style={{ color: "#6B7280", fontSize: 8.5, fontFamily: FONT, textAlign: "center", margin: 0, lineHeight: 1.35 }}>{desc}</p>
            </div>,
            ...(i < data.steps.length - 1 ? [
              <div key={`chevron-${i}`} style={{ paddingTop: 12, flexShrink: 0 }}>
                <ChevronRight size={16} color="rgba(31,58,110,0.3)" />
              </div>
            ] : []),
          ])}
        </div>
        {/* Metric boxes */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.metrics.length}, 1fr)`, gap: 10 }}>
          {data.metrics.map(({ value, label, orange }, i) => (
            <div key={i} style={{ background: orange ? ORANGE : NAVY, borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
              <p style={{ color: WHITE, fontSize: 18, fontWeight: 900, fontFamily: FONT, margin: "0 0 4px" }}>{value}</p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, fontFamily: FONT, margin: 0, lineHeight: 1.4 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── 10. Domain Matrix ───────────────────────────────────────────────────── */
export function DomainMatrixSlideLayout({ data }: { data: DomainMatrixSlide }) {
  const colColors = [NAVY, "#1A5276", ORANGE, ORANGE2];
  return (
    <SlideWrapper bg={LIGHT_BG}>
      <SectionHeader title={data.title} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 36px 12px" }}>
        {/* Domain chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {data.domains.map(({ icon: Icon, label }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, border: `1.5px solid ${NAVY}`, borderRadius: 8, padding: "4px 10px", background: WHITE }}>
              <Icon size={12} color={NAVY} />
              <span style={{ color: NAVY, fontSize: 9.5, fontWeight: 600, fontFamily: FONT }}>{label}</span>
            </div>
          ))}
        </div>
        {/* Grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: `1.8fr ${data.column_headers.map(() => "1fr").join(" ")}`, gap: 6 }}>
            <div />
            {data.column_headers.map((h, i) => (
              <div key={i} style={{ background: colColors[i] || NAVY, borderRadius: 20, padding: "4px 8px", textAlign: "center" }}>
                <span style={{ color: WHITE, fontSize: 9.5, fontWeight: 700, fontFamily: FONT }}>{h}</span>
              </div>
            ))}
          </div>
          {/* Data rows */}
          {data.domains.map(({ icon: Icon, label }, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: `1.8fr ${data.column_headers.map(() => "1fr").join(" ")}`, gap: 6, background: i % 2 === 0 ? WHITE : "#EEF2F8", borderRadius: 6, padding: "6px 10px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon size={12} color={NAVY} />
                <span style={{ color: NAVY, fontSize: 10, fontWeight: 600, fontFamily: FONT }}>{label}</span>
              </div>
              {data.column_headers.map((_, j) => (
                <div key={j} style={{ display: "flex", justifyContent: "center" }}>
                  <CheckCircle size={14} color={j % 2 === 0 ? NAVY : ORANGE} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── 11. Contact ─────────────────────────────────────────────────────────── */
function WorldMapSVG() {
  return (
    <svg viewBox="0 0 380 210" style={{ width: "100%", height: "100%", opacity: 0.6 }}>
      {/* Ocean glow */}
      <ellipse cx="190" cy="105" rx="185" ry="100" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {/* Simplified continent shapes - lighter navy */}
      <g fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5">
        {/* North America */}
        <path d="M30,35 Q50,20 80,28 L105,42 Q125,55 118,75 L100,88 Q85,95 68,88 L45,70 Q28,55 30,35Z" />
        {/* South America */}
        <path d="M72,102 Q88,95 103,105 L115,130 Q120,160 108,178 Q95,192 80,185 L68,165 Q58,145 60,125 Z" />
        {/* Europe */}
        <path d="M160,28 Q175,20 195,28 L205,45 Q200,60 185,65 L168,55 Q158,45 160,28Z" />
        {/* Africa */}
        <path d="M168,75 Q183,68 200,75 L215,100 Q220,130 210,155 Q198,175 182,178 L165,158 Q155,132 158,105 Z" />
        {/* Asia */}
        <path d="M205,25 Q240,12 290,20 L320,38 Q335,55 318,70 L285,78 L255,72 L225,62 L208,48 Z" />
        {/* Australia */}
        <path d="M290,135 Q312,128 332,138 L342,160 Q338,178 320,182 L298,175 Q282,165 285,148 Z" />
        {/* India peninsula */}
        <path d="M248,75 L260,78 L265,105 Q260,120 252,118 L244,100 Z" />
      </g>
      {/* San Jose CA dot */}
      <circle cx="65" cy="82" r="5" fill="#F47C20" opacity="0.9" />
      <circle cx="65" cy="82" r="9" fill="#F47C20" opacity="0.2" />
      {/* New Delhi India dot */}
      <circle cx="262" cy="68" r="5" fill="#F47C20" opacity="0.9" />
      <circle cx="262" cy="68" r="9" fill="#F47C20" opacity="0.2" />
      {/* Dotted arc connecting them */}
      <path d="M70,80 Q165,15 258,70" fill="none" stroke="#F47C20" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.55" />
    </svg>
  );
}

export function ContactSlideLayout({ data }: { data: ContactSlide }) {
  return (
    <SlideWrapper bg={NAVY} dark>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top title */}
        <div style={{ textAlign: "center", padding: "18px 36px 8px", flexShrink: 0 }}>
          <HISLogo h={36} />
          <h1 style={{ color: ORANGE, fontSize: 26, fontWeight: 900, fontFamily: FONT, margin: "10px 0 4px" }}>Let&apos;s Connect</h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: FONT, fontStyle: "italic", margin: 0 }}>{data.tagline}</p>
        </div>
        {/* Body */}
        <div style={{ flex: 1, display: "flex", gap: 24, padding: "8px 36px 8px" }}>
          {/* Left: world map */}
          <div style={{ flex: 1.3, position: "relative" }}>
            <WorldMapSVG />
            {/* City labels */}
            <div style={{ position: "absolute", left: "14%", top: "48%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, fontFamily: FONT, fontWeight: 600, textAlign: "center", background: "rgba(31,58,110,0.6)", padding: "2px 6px", borderRadius: 4 }}>San Jose, CA</span>
            </div>
            <div style={{ position: "absolute", right: "18%", top: "25%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, fontFamily: FONT, fontWeight: 600, textAlign: "center", background: "rgba(31,58,110,0.6)", padding: "2px 6px", borderRadius: 4 }}>New Delhi, India</span>
            </div>
          </div>
          {/* Right: contact cards */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, justifyContent: "center" }}>
            {data.contacts.map(({ icon: Icon, label, value }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} color={WHITE} />
                </div>
                <div>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 8.5, fontFamily: FONT, margin: "0 0 1px", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</p>
                  <p style={{ color: WHITE, fontSize: 11, fontWeight: 600, fontFamily: FONT, margin: 0 }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}
