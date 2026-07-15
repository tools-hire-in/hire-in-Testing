import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, ChevronDown, ChevronRight } from "lucide-react";

// ─── Colour helpers ──────────────────────────────────────────────────────────
const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";

// ─── Feature matrix data ──────────────────────────────────────────────────────
type Rating = "WIN+" | "WIN" | "PARTIAL" | "PARTIAL(i)" | "WIN(i)" | "LOSE";
interface Feature {
  name: string;
  weight: number;
  hirein: Rating;
  darwinbox: Rating;
  keka: Rating;
  greyhr: Rating;
  sumhr: Rating;
  rippling: Rating;
  bamboohr: Rating;
}

const FEATURES: Feature[] = [
  { name: "India payroll (PF/ESI/TDS/LWF/PT)", weight: 5, hirein: "WIN", darwinbox: "WIN", keka: "WIN", greyhr: "WIN", sumhr: "WIN", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "Leave management + accrual engine", weight: 5, hirein: "WIN", darwinbox: "WIN", keka: "WIN", greyhr: "WIN", sumhr: "WIN", rippling: "WIN", bamboohr: "WIN" },
  { name: "Attendance management", weight: 5, hirein: "WIN", darwinbox: "WIN", keka: "WIN", greyhr: "WIN", sumhr: "WIN", rippling: "WIN", bamboohr: "WIN" },
  { name: "Mobile app (iOS/Android native or PWA)", weight: 5, hirein: "LOSE", darwinbox: "WIN", keka: "WIN", greyhr: "WIN", sumhr: "WIN", rippling: "WIN", bamboohr: "WIN" },
  { name: "GPS / biometric attendance hardware", weight: 4, hirein: "LOSE", darwinbox: "WIN", keka: "PARTIAL(i)", greyhr: "WIN(i)", sumhr: "WIN", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "HR document generation (letters)", weight: 4, hirein: "WIN+", darwinbox: "PARTIAL", keka: "PARTIAL", greyhr: "PARTIAL", sumhr: "PARTIAL", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "Cryptographic document verification", weight: 3, hirein: "WIN+", darwinbox: "LOSE", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "SOP + systemic governance (evidence, escalations, exceptions)", weight: 4, hirein: "WIN+", darwinbox: "PARTIAL(i)", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "ATS integration (Ceipal, bi-directional) + job pipeline", weight: 4, hirein: "WIN", darwinbox: "PARTIAL", keka: "WIN", greyhr: "LOSE", sumhr: "LOSE", rippling: "PARTIAL", bamboohr: "WIN" },
  { name: "Structured 90-day probation framework", weight: 3, hirein: "WIN", darwinbox: "PARTIAL(i)", keka: "PARTIAL(i)", greyhr: "LOSE", sumhr: "LOSE", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "Performance mgmt (goals/reviews/360)", weight: 4, hirein: "WIN", darwinbox: "WIN", keka: "PARTIAL", greyhr: "LOSE", sumhr: "LOSE", rippling: "WIN", bamboohr: "WIN" },
  { name: "Structured training + LMS + compliance", weight: 3, hirein: "WIN", darwinbox: "WIN", keka: "PARTIAL(i)", greyhr: "LOSE", sumhr: "LOSE", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "AI-powered HR operations features", weight: 4, hirein: "WIN", darwinbox: "WIN", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "WIN", bamboohr: "LOSE" },
  { name: "AI content & BD engine (Content Studio, outreach, campaigns)", weight: 3, hirein: "WIN+", darwinbox: "LOSE", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "AI PII/HIPAA compliance layer (automated guard, unit-tested)", weight: 4, hirein: "WIN+", darwinbox: "LOSE", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "CEO/Exec AI cockpit (action from one place, allowlisted payload)", weight: 3, hirein: "WIN+", darwinbox: "PARTIAL(i)", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "Content safety gate (hard-block, domain-specific, source-ledger)", weight: 3, hirein: "WIN+", darwinbox: "LOSE", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "LOSE", bamboohr: "LOSE" },
  { name: "Travel quote engine (GSA per-diem, margin floors)", weight: 2, hirein: "WIN+", darwinbox: "LOSE", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "PARTIAL", bamboohr: "LOSE" },
  { name: "Secrets vault (grants + audit log)", weight: 2, hirein: "WIN+", darwinbox: "LOSE", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "WIN", bamboohr: "LOSE" },
  { name: "Integration marketplace (10+ connectors)", weight: 5, hirein: "LOSE", darwinbox: "WIN", keka: "PARTIAL", greyhr: "PARTIAL", sumhr: "LOSE", rippling: "WIN+", bamboohr: "WIN" },
  { name: "Multi-entity / multi-country payroll", weight: 3, hirein: "LOSE", darwinbox: "WIN", keka: "LOSE", greyhr: "PARTIAL", sumhr: "LOSE", rippling: "WIN", bamboohr: "LOSE" },
  { name: "Benefits administration", weight: 3, hirein: "LOSE", darwinbox: "PARTIAL", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "WIN", bamboohr: "WIN" },
  { name: "Workforce analytics + ad-hoc reporting", weight: 4, hirein: "PARTIAL", darwinbox: "WIN", keka: "PARTIAL", greyhr: "PARTIAL", sumhr: "LOSE", rippling: "WIN", bamboohr: "PARTIAL" },
  { name: "Shift system (multi-timezone, DST-aware, night-shift consent)", weight: 4, hirein: "WIN", darwinbox: "WIN", keka: "PARTIAL", greyhr: "LOSE", sumhr: "PARTIAL", rippling: "WIN", bamboohr: "LOSE" },
  { name: "Client-site roster calendar (staffing-specific)", weight: 3, hirein: "LOSE", darwinbox: "LOSE", keka: "LOSE", greyhr: "LOSE", sumhr: "LOSE", rippling: "PARTIAL", bamboohr: "LOSE" },
  { name: "Self-serve trial + SaaS packaging", weight: 5, hirein: "LOSE", darwinbox: "LOSE", keka: "WIN", greyhr: "WIN", sumhr: "WIN", rippling: "WIN", bamboohr: "WIN" },
  { name: "TOTP 2FA + session security", weight: 3, hirein: "WIN", darwinbox: "WIN", keka: "PARTIAL(i)", greyhr: "LOSE", sumhr: "LOSE", rippling: "WIN", bamboohr: "PARTIAL" },
  { name: "Internal helpdesk / ticketing", weight: 3, hirein: "WIN", darwinbox: "PARTIAL(i)", keka: "LOSE", greyhr: "LOSE", sumhr: "WIN", rippling: "PARTIAL", bamboohr: "LOSE" },
  { name: "Salary advance management", weight: 2, hirein: "WIN", darwinbox: "PARTIAL(i)", keka: "PARTIAL(i)", greyhr: "PARTIAL(i)", sumhr: "LOSE", rippling: "LOSE", bamboohr: "LOSE" },
];

function ratingColor(r: Rating): string {
  if (r === "WIN+") return "bg-emerald-700 text-white";
  if (r === "WIN" || r === "WIN(i)") return "bg-green-500 text-white";
  if (r === "PARTIAL" || r === "PARTIAL(i)") return "bg-amber-400 text-white";
  return "bg-red-500 text-white";
}

function ratingLabel(r: Rating): string {
  if (r === "WIN+") return "WIN+";
  if (r === "WIN(i)") return "WIN (i)";
  if (r === "PARTIAL(i)") return "PARTIAL (i)";
  return r;
}

// ─── Scorecard data ───────────────────────────────────────────────────────────
const SCORES = [
  { label: "India SMB HRMS depth", score: 8 },
  { label: "Document & compliance engine", score: 8 },
  { label: "Process governance (SOPs + systemic controls)", score: 9 },
  { label: "AI / smart layer maturity", score: 8 },
  { label: "AI compliance & governance (PII/HIPAA guard, safety gate)", score: 9 },
  { label: "Mobile / accessibility", score: 2 },
  { label: "Integrations ecosystem", score: 2 },
  { label: "US market readiness", score: 2 },
  { label: "Overall", score: 7.5 },
];

function scoreColor(s: number): string {
  if (s < 4) return "bg-red-500";
  if (s <= 6) return "bg-amber-400";
  return "bg-green-500";
}

// ─── Positioning map dots ─────────────────────────────────────────────────────
interface MapDot { label: string; x: number; y: number; color: string; isHirein?: boolean; }
const MAP_DOTS: MapDot[] = [
  { label: "Hire'in ★", x: 80, y: 50, color: "#F47C20", isHirein: true },
  { label: "Darwinbox", x: 90, y: 80, color: "#dc2626" },
  { label: "Keka", x: 85, y: 35, color: "#ea580c" },
  { label: "GreytHR", x: 95, y: 15, color: "#6b7280" },
  { label: "SumHR", x: 65, y: 10, color: "#6b7280" },
  { label: "Rippling", x: 10, y: 75, color: "#2563eb" },
  { label: "BambooHR", x: 20, y: 40, color: "#2563eb" },
  { label: "Workday", x: 25, y: 90, color: "#2563eb" },
];

// ─── TOC sections ──────────────────────────────────────────────────────────────
const TOC = [
  { id: "executive-summary", label: "Executive Summary" },
  { id: "flywheel", label: "The Flywheel" },
  { id: "pillars-pricing", label: "360 Pillars & Pricing" },
  { id: "strategic-choice", label: "The Strategic Choice" },
  { id: "competitive-landscape", label: "Competitive Landscape" },
  { id: "feature-matrix", label: "Feature Matrix" },
  { id: "positioning-map", label: "Positioning Map" },
  { id: "white-space", label: "White Space" },
  { id: "ceo-copilot", label: "CEO Copilot & Exec Cockpit" },
  { id: "ai-compliance", label: "AI Compliance Architecture" },
  { id: "action-plan", label: "Action Plan" },
  { id: "brand-log", label: "Brand Decision Log" },
];

// ─── Section header component ─────────────────────────────────────────────────
function SectionHeader({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      className="px-5 py-3 mb-6 rounded-md"
      style={{ backgroundColor: NAVY, color: "white", letterSpacing: "0.08em", fontSize: "13px", textTransform: "uppercase", fontWeight: 700 }}
    >
      {children}
    </div>
  );
}

// ─── Methodology collapse ─────────────────────────────────────────────────────
const METHODOLOGY = [
  { source: "Darwinbox features", method: "Homepage JS bundle extraction, July 2026", confidence: "High" },
  { source: "Darwinbox India payroll depth", method: "Product page HTML + JS, July 2026", confidence: "High" },
  { source: "Darwinbox funding/customers", method: "Public announcements + case studies", confidence: "High" },
  { source: "Keka pricing", method: "JS bundle extraction from pricing page, July 2026", confidence: "High" },
  { source: "Keka roadmap direction", method: "Blog content analysis, July 2026", confidence: "Medium (inferred)" },
  { source: "GreytHR pricing", method: "JS bundle extraction, July 2026", confidence: "High" },
  { source: "SumHR features", method: "Homepage HTML analysis, July 2026", confidence: "High" },
  { source: "Rippling features/positioning", method: "Homepage JS string extraction, July 2026", confidence: "High" },
  { source: "BambooHR features", method: "Homepage + pricing page HTML, July 2026", confidence: "High" },
  { source: "Workday features", method: "HCM product page HTML + JS, July 2026", confidence: "High" },
  { source: "Hire'in features", method: "First-party codebase audit (schema.ts, server/, client/), July 2026", confidence: "Definitive" },
  { source: "Hire'in features (rev. 2)", method: "Deep-dive re-audit after factual corrections: shift system, Ceipal ATS integration, Content Studio / BD Agent, governance controls, vault, travel engine — July 2026", confidence: "Definitive" },
  { source: "Hire'in AI layer (rev. 3)", method: "Full deep-dive: aiPrivacyGuard.ts, staffingSafetyGate.ts, aiDraftService.ts, ExecCockpit.tsx, GOVERNANCE-MVP-READINESS.md, post-brainstorm CMO/CBDO session — July 15, 2026", confidence: "Definitive" },
  { source: "Market size estimates", method: "Industry inference from NASSCOM/CRISIL public reports", confidence: "Low — directional only" },
  { source: "Competitor customer counts", method: "Public press releases / company statements", confidence: "Medium" },
  { source: "Competitor weaknesses", method: "Inferred from product positioning + known G2 review patterns", confidence: "Medium — flagged (i)" },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function CompetitiveAudit() {
  const [activeSection, setActiveSection] = useState("executive-summary");
  const [sortAsc, setSortAsc] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Feature matrix sort
  const sortedFeatures = [...FEATURES].sort((a, b) => sortAsc ? a.weight - b.weight : b.weight - a.weight);

  // Feature stats
  const winPlus = FEATURES.filter(f => f.hirein === "WIN+").length;
  const wins = FEATURES.filter(f => f.hirein === "WIN").length;
  const partials = FEATURES.filter(f => f.hirein === "PARTIAL").length;
  const loses = FEATURES.filter(f => f.hirein === "LOSE").length;

  // CSV export
  function exportCSV() {
    const header = ["Capability", "Weight", "Hire'in", "Darwinbox", "Keka", "GreytHR", "SumHR", "Rippling", "BambooHR"];
    const rows = FEATURES.map(f => [
      f.name, f.weight, f.hirein, f.darwinbox, f.keka, f.greyhr, f.sumhr, f.rippling, f.bamboohr
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hirein-competitive-matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Positioning map math
  const MARGIN = 80;
  const SVG_W = 600;
  const SVG_H = 500;
  const plotW = SVG_W - 2 * MARGIN;
  const plotH = SVG_H - 2 * MARGIN;

  function dotX(pct: number) { return MARGIN + (pct / 100) * plotW; }
  function dotY(pct: number) { return MARGIN + ((100 - pct) / 100) * plotH; }

  return (
    <div className="min-h-screen bg-background" data-testid="page-competitive-audit">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { width: 100% !important; margin: 0 !important; max-width: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Page header */}
      <div className="sticky top-0 z-30 no-print border-b bg-background/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Internal Strategy Document · Version 3.0 · July 15, 2026</p>
          <h1 className="text-lg font-bold" style={{ color: NAVY }}>Hire'in 360 — Competitive Audit</h1>
        </div>
        <button
          onClick={() => window.print()}
          data-testid="button-print-audit"
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: NAVY }}
        >
          <Printer size={15} />
          Export / Print
        </button>
      </div>

      <div className="flex gap-0">
        {/* ── Sticky TOC sidebar ── */}
        <aside className="no-print hidden lg:block w-52 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r bg-sidebar py-6 px-3">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 px-2">Sections</p>
          <nav className="flex flex-col gap-0.5">
            {TOC.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                data-testid={`toc-link-${id}`}
                className={`text-left text-sm px-3 py-2 rounded-md transition-colors ${
                  activeSection === id
                    ? "font-semibold text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                style={activeSection === id ? { backgroundColor: NAVY } : {}}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile TOC */}
        <div className="no-print lg:hidden w-full overflow-x-auto border-b bg-sidebar">
          <div className="flex gap-1 px-4 py-2">
            {TOC.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
                  activeSection === id ? "text-white" : "text-muted-foreground hover:bg-accent"
                }`}
                style={activeSection === id ? { backgroundColor: NAVY } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main content ── */}
        <main className="flex-1 px-6 py-8 max-w-5xl print-full">

          {/* Report meta */}
          <div className="mb-8 pb-6 border-b">
            <h2 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>
              Hire'in 360 — The Complete Operating Platform for Staffing Agencies
            </h2>
            <p className="text-sm text-muted-foreground mb-1">People. Brand. Business. All connected.</p>
            <div className="flex flex-wrap gap-3 mt-2">
              <span className="text-xs px-2.5 py-1 rounded border text-muted-foreground">Version 3.0</span>
              <span className="text-xs px-2.5 py-1 rounded border text-muted-foreground">July 15, 2026</span>
              <span className="text-xs px-2.5 py-1 rounded border text-muted-foreground">Post-brainstorm strategic update — AI compliance layer, CEO Copilot & GTM</span>
            </div>
          </div>

          {/* ═══ SECTION 1: EXECUTIVE SUMMARY ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="executive-summary">1 — Executive Summary</SectionHeader>

            {/* Positioning statement */}
            <blockquote
              className="border-l-4 pl-5 py-3 mb-6 rounded-r-md italic text-foreground"
              style={{ borderColor: ORANGE, backgroundColor: "#FFF7F0" }}
              data-testid="text-positioning-statement"
            >
              <p className="text-sm leading-relaxed">
                For <strong>Indian staffing agencies (10–200 employees) running back-office operations for US clients</strong> — needing India statutory compliance AND US-client-facing professionalism in one connected platform — <strong>Hire'in 360 is the only purpose-built Staffing Agency OS on the Indian market.</strong> Unlike the default approach — running Keka for HR, Ceipal for ATS, and Word templates for letters — Hire'in 360 unifies employee lifecycle, India-compliant payroll, cryptographically-verifiable document generation, SOP + systemic governance, a DST-aware multi-timezone shift system, a deep bi-directional Ceipal ATS integration, production-grade AI content with a hard-block safety gate, and a PII/HIPAA-compliant AI architecture in a single connected platform. Unlike Darwinbox, it is not enterprise-priced or 6-month-to-implement. Unlike Keka, it is built for the staffing workflow, not the generic employer.
              </p>
            </blockquote>

            {/* Score card */}
            <Card className="mb-6" data-testid="card-scorecard">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Platform Score Card</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {SCORES.map(({ label, score }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={label === "Overall" ? "font-bold" : ""}>{label}</span>
                      <span className={`font-semibold ${label === "Overall" ? "text-base" : ""}`}>{score}/10</span>
                    </div>
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${scoreColor(score)}`}
                        style={{ width: `${score * 10}%` }}
                        data-testid={`progress-score-${label.toLowerCase().replace(/\W+/g, "-")}`}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Honest verdict */}
            <Card className="mb-6" data-testid="card-verdict">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Honest Verdict</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Hire'in 360 is a technically capable, deeply integrated staffing operations platform. The payroll engine is production-grade (pure-paise, India-statutory with PF/ESI/TDS). The governance stack goes beyond SOPs — a systemic controls engine spanning goals, check-ins, training, probation, and PIPs with evidence requirements, automated escalation levels, and executive exception handling. The shift system is genuinely strong: multi-timezone US-coverage shifts with DST-aware IST timings, per-shift grace periods, assignment audit logs, and night-shift consent compliance. Recruitment runs on a built-in job/application pipeline with a deep bi-directional Ceipal ATS integration. The AI layer has been <strong>significantly underrated in prior versions of this report.</strong> The platform's AI architecture is not just Content Studio — it includes a production-grade, unit-tested PII guard that prevents employee salary, medical, bank, and identity data from ever leaving the platform into external AI calls; a domain-specific Staffing Safety Gate that hard-blocks invented facts, clinical advice, clearance claims, and company superlatives before publishing; a CEO allowlisted payload builder that is fail-closed by design; and an Exec Cockpit that gives senior management a unified action layer without navigating multiple modules. This AI compliance architecture is ahead of what most vendors at 10× the price have published. Add the secrets vault, travel quote engine with GSA per-diem compliance, probation framework, salary advance management, and internal ticketing — all ahead of what Keka or GreytHR offer. However, Hire'in 360 has three gaps that are deal-killers in competitive sales situations: <strong>no mobile app, no biometric/GPS attendance, and no self-serve packaging.</strong> Against US platforms (Rippling, BambooHR, Workday), it is not competitive — not because the product is weak, but because the market context simply does not translate. Hire'in 360's opportunity is not to compete broadly. It is to own the niche nobody else has bothered to build: the Indian staffing agency OS.
                </p>
              </CardContent>
            </Card>

            {/* Top 3 recommendations */}
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  n: "01", title: "Build the mobile app (PWA)",
                  body: "This is the single biggest revenue-protection move. Every competitor has a mobile app. Every manager uses a phone. This is currently a deal-killer in every competitive sales conversation."
                },
                {
                  n: "02", title: "Productize for multi-tenancy",
                  body: "The platform is 70% of the way to being sellable to other staffing firms. Multi-tenancy + self-serve trial + pricing page is the path from 'custom tool' to 'SaaS product.'"
                },
                {
                  n: "03", title: "Publish the AI compliance architecture as a feature, not a footnote",
                  body: "The PII guard, safety gate, HIPAA-aligned CEO payload, and Exec Cockpit are enterprise-grade capabilities most buyers don't know exist. A single-page 'How Hire'in 360 protects employee data in AI' trust document would close deals, not just check a box."
                },
                {
                  n: "04", title: "Build the custom rule authoring UI for the Safety Gate",
                  body: "Letting buyers add their own compliance rules is the path to regulated-industry verticals (government, hospital networks, financial services) where off-the-shelf AI content tools are legally unusable."
                },
              ].map(({ n, title, body }) => (
                <Card key={n} data-testid={`card-recommendation-${n}`} className="border-t-4" style={{ borderTopColor: ORANGE }}>
                  <CardContent className="pt-4">
                    <p className="text-2xl font-black mb-2 opacity-20" style={{ color: NAVY }}>{n}</p>
                    <p className="font-semibold text-sm mb-2">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ═══ SECTION 2: THE FLYWHEEL ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="flywheel">2 — The Hire'in 360 Flywheel</SectionHeader>
            <p className="text-sm text-muted-foreground mb-6 italic">The core growth loop that competitors cannot replicate without rebuilding from scratch.</p>

            <div className="relative">
              {/* Flywheel callout */}
              <div
                className="mb-6 p-4 rounded-lg border-l-4"
                style={{ borderColor: ORANGE, backgroundColor: "#FFF7F0" }}
                data-testid="card-flywheel-moat"
              >
                <p className="text-sm font-bold mb-1" style={{ color: NAVY }}>The Moat</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This loop is the moat. No competitor connects job data, HR operations, content generation, and BD pipeline in a single platform. Each component reinforces the others — breaking out of the loop requires switching three or four separate systems simultaneously.
                </p>
              </div>

              {/* Flywheel steps */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { step: "1", icon: "💼", title: "Jobs Posted", desc: "Live job data enters the platform via Ceipal sync or direct posting." },
                  { step: "2", icon: "🤖", title: "AI Suggests Content", desc: "Content Studio uses live job data to suggest articles, social kits, and BD outreach." },
                  { step: "3", icon: "📣", title: "Content Published", desc: "Recruiter personal brand content goes live — building trust and authority in target verticals." },
                  { step: "4", icon: "📥", title: "Inbound Inquiries", desc: "Personal brand drives inbound client inquiries — lower CAC, warmer leads." },
                  { step: "5", icon: "🤝", title: "BD Agent Converts", desc: "BD Agent converts inquiry to proposal deck, SOW template, and signed contract." },
                  { step: "6", icon: "✍️", title: "Contract Signed", desc: "Offer letter generated, countersigned, and cryptographically verified — all inside the platform." },
                  { step: "7", icon: "🏢", title: "New Hire Onboarded", desc: "Employee joins via the same platform: payroll, training, SOPs, probation, and growth plan all start." },
                  { step: "8", icon: "🔁", title: "Loop Restarts", desc: "Active headcount generates more jobs. Platform data enriches the next content cycle. Loop accelerates." },
                ].map(({ step, icon, title, desc }) => (
                  <div
                    key={step}
                    className="p-4 rounded-lg border bg-background"
                    data-testid={`card-flywheel-step-${step}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-black opacity-20" style={{ color: NAVY }}>{step}</span>
                      <span className="text-xl">{icon}</span>
                    </div>
                    <p className="text-sm font-semibold mb-1">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ SECTION 3: 360 PILLARS & PRICING ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="pillars-pricing">3 — The 360 Pillars & Packaging</SectionHeader>
            <p className="text-sm text-muted-foreground mb-6 italic">Three modular product tiers — mix and match for each customer's maturity level.</p>

            <div className="grid md:grid-cols-3 gap-5">
              {/* 360 People */}
              <Card className="border-t-4" style={{ borderTopColor: NAVY }} data-testid="card-pillar-people">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base" style={{ color: NAVY }}>360 People</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">Base tier — always required</p>
                    </div>
                    <span className="text-sm font-bold" style={{ color: NAVY }}>~₹15,000/mo</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    {["HR + Payroll (India statutory: PF/ESI/TDS/PT/LWF)", "Onboarding & document management", "Leave & attendance management", "SOP + systemic governance", "Training & compliance LMS", "Performance management (goals, check-ins, reviews)", "Probation & PIP frameworks", "Cryptographic document verification", "Internal ticketing & helpdesk"].map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <span className="text-green-500 font-bold mt-0.5 shrink-0">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* 360 Studio */}
              <Card className="border-t-4" style={{ borderTopColor: ORANGE }} data-testid="card-pillar-studio">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base" style={{ color: ORANGE }}>360 Studio</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">Add-on — content & BD engine</p>
                    </div>
                    <span className="text-sm font-bold" style={{ color: ORANGE }}>~₹12,000/mo</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    {["AI Content Studio (articles, social kits, outreach)", "Brand Voice engine + guardrails", "Content Safety Gate (hard-block, domain-specific)", "BD Agent (proposals, campaigns, decks)", "Newsletter + subscriber management", "Social card generation (LinkedIn, Twitter)", "Staffing Safety Gate (source-ledger, banned phrases)", "Insights Blog (public-facing content hub)"].map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <span className="text-orange-500 font-bold mt-0.5 shrink-0">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* 360 Growth */}
              <Card className="border-t-4" style={{ borderTopColor: "#059669" }} data-testid="card-pillar-growth">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base" style={{ color: "#059669" }}>360 Growth</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">Add-on — exec intelligence</p>
                    </div>
                    <span className="text-sm font-bold" style={{ color: "#059669" }}>~₹10,000/mo</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    {["Exec Cockpit (unified command view)", "CEO AI Copilot (allowlisted, PII-safe payload)", "Advanced workforce analytics", "Document & policy compliance dashboards", "Governance controls + escalation layer", "Exception management for senior review", "Payroll oversight + disbursement control", "CSV export of full employee directory"].map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <span className="font-bold mt-0.5 shrink-0" style={{ color: "#059669" }}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground mt-4 italic">
              Indicative pricing only. Final pricing to be set during multi-tenancy productization phase. Base + all add-ons = ~₹37,000/mo for a 25-person agency — less than the cost of one subscription to Darwinbox enterprise.
            </p>
          </section>

          {/* ═══ SECTION 4: STRATEGIC CHOICE ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="strategic-choice">4 — The Strategic Choice</SectionHeader>
            <p className="text-sm text-muted-foreground mb-6 italic">This section is unique to this report and is the most important one to read.</p>
            <p className="text-sm leading-relaxed mb-6">
              Hire'in has built something real. The question is not "how do we fix the feature gaps" — it is <strong>what game are we playing?</strong> There are exactly three coherent strategic options. Picking the wrong one wastes the next 2 years.
            </p>

            <div className="grid md:grid-cols-3 gap-5">
              {/* Option A */}
              <Card data-testid="card-option-a">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-bold">Option A: Stay Internal</CardTitle>
                    <Badge variant="secondary" className="shrink-0">Valid</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Optimize as operational backbone</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Pros</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      <li>No multi-tenancy complexity or customer support overhead</li>
                      <li>Full focus on operational excellence for the current team</li>
                      <li>Deep customization stays a feature, not a liability</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Cons</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      <li>Leaves a large market opportunity on the table</li>
                      <li>Competitive benchmarking becomes irrelevant</li>
                      <li>Mobile app is still needed regardless</li>
                    </ul>
                  </div>
                  <p className="text-xs italic text-muted-foreground border-t pt-2">Valid, but undersells what has been built. Choose only if the firm has no interest in becoming a software company.</p>
                </CardContent>
              </Card>

              {/* Option B — RECOMMENDED */}
              <Card
                data-testid="card-option-b"
                className="ring-2"
                style={{ ringColor: NAVY, borderColor: NAVY, backgroundColor: "#F0F4FA" }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-bold" style={{ color: NAVY }}>Option B: Vertical SaaS</CardTitle>
                    <Badge className="shrink-0 text-white" style={{ backgroundColor: NAVY }}>RECOMMENDED</Badge>
                  </div>
                  <p className="text-xs" style={{ color: NAVY }}>Package and sell to Indian staffing agencies</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Pros</p>
                    <ul className="text-xs space-y-1 list-disc pl-4" style={{ color: "#1F3A6E" }}>
                      <li>First-mover advantage in an unserved niche</li>
                      <li>Platform already 70% product-complete</li>
                      <li>Conservative ₹9Cr+ ARR at just 500 customers</li>
                      <li>Healthcare compliance complexity = high willingness to pay</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Cons</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      <li>Requires multi-tenancy architecture (8–12 wks)</li>
                      <li>Needs mobile PWA before any sales motion</li>
                    </ul>
                  </div>
                  <p className="text-xs italic font-semibold border-t pt-2" style={{ color: NAVY }}>This is the right game to play. Product is already 70% there.</p>
                </CardContent>
              </Card>

              {/* Option C */}
              <Card data-testid="card-option-c">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-bold">Option C: Compete Broadly</CardTitle>
                    <Badge variant="destructive" className="shrink-0">Avoid</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Against Keka / GreytHR</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Pros</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      <li>Larger TAM</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Cons</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      <li>Keka has $57M funding, 4,000+ customers, 7-year UX head start</li>
                      <li>GreytHR has 20,000+ customers and India's most mature payroll engine</li>
                      <li>Wrong leverage — generic SMB HR is not your moat</li>
                      <li>Would require rebuilding the ATS-HR integration story</li>
                    </ul>
                  </div>
                  <p className="text-xs italic text-muted-foreground border-t pt-2">Do not play this game. You will lose on distribution, UX polish, and pricing.</p>
                </CardContent>
              </Card>
            </div>

            {/* Market size callout */}
            <div className="mt-5 p-4 rounded-md border text-sm" style={{ backgroundColor: "#EEF2FA", borderColor: "#C7D3EC" }}>
              <p className="font-semibold mb-1" style={{ color: NAVY }}>Addressable market (conservative, Option B)</p>
              <p className="text-muted-foreground text-xs">
                500 Indian staffing firms × ₹15,000/mo = <strong>₹9 crore ARR (~$1M+)</strong>. At 2,000 firms = <strong>₹36 crore ARR (~$4M+)</strong>. Neither number requires any US market entry. Market size flagged as inferred from NASSCOM/CRISIL public reports — treat as directional.
              </p>
            </div>
          </section>

          {/* ═══ SECTION 3: COMPETITIVE LANDSCAPE ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="competitive-landscape">5 — Competitive Landscape</SectionHeader>
            <p className="text-xs text-muted-foreground mb-6 italic">7 competitor profiles. Source confidence noted per profile. (i) = inferred.</p>

            <div className="space-y-5">
              {/* Darwinbox */}
              <CompetitorCard
                name="Darwinbox" flag="🇮🇳"
                meta="Series C · ~$120M raised (Salesforce Ventures, Microsoft) · 900+ enterprises · Verified from public statements, July 2026"
                pricing="Enterprise contract, custom pricing. Estimated ₹200–500+/employee/mo (inferred)"
                markets="India, SEA, GCC, Philippines, Indonesia, Malaysia, Singapore, Thailand"
                strengths={["75+ statutory compliance reports (TDS, PF, NPS, Form 16, Form 24Q)", "AI chatbot for payroll queries, payslip access, approvals", "WhatsApp notifications for leaves, attendance, rewards", "End-to-end multi-country payroll across 7+ APAC countries", "Effective-dated audit trails; 40+ standard + statutory reports"]}
                weaknesses={["Overkill for companies under 200 headcount — months-long implementation (i)", "Expensive; SMBs regularly cite 'too much product, too little budget' (i)", "No staffing-agency-native features (ATS + HR for contingent workforce absent)"]}
                threat="HIGH if Hire'in targets 200+ headcount. LOW if staying under 150."
                threatLevel="high"
              />
              {/* Keka */}
              <CompetitorCard
                name="Keka HR" flag="🇮🇳"
                meta="Series A · $57M raised (WestBridge Capital, 2022) · 4,000+ customers (inferred)"
                pricing="₹6,999–9,999/mo base + per-employee · Hire module ₹2,500/recruiter/mo · Verified from JS bundle, July 2026"
                markets="India-first; moving upmarket toward global enterprise"
                strengths={["Best UX in Indian SMB HRMS market (widely cited — inferred from market position)", "Native ATS (Hire module) bundled with HRMS", "Strong India payroll + attendance", "Active product development; large content/SEO investment"]}
                weaknesses={["Performance module basic vs. Hire'in's full goal/check-in/review cycle system (i)", "Training/LMS basic or non-existent (i)", "Zero SOP governance or compliance lock capability", "No document verification system", "No salary advance management module (i)"]}
                threat="HIGHEST — same ICP, overlapping features, better UX and distribution."
                threatLevel="critical"
              />
              {/* GreytHR */}
              <CompetitorCard
                name="GreytHR" flag="🇮🇳"
                meta="~$25M raised · 20,000+ customers · Verified from public statements"
                pricing="₹20/user/mo (Foundation) · ₹35–140/emp/mo plans · Recruiter add-on ₹2,500/mo · Verified from JS bundle, July 2026"
                markets="India, Middle East"
                strengths={["India's most mature payroll engine — 20+ years statutory compliance refinement", "20,000+ customers = massive word-of-mouth and trust signal", "Lowest pricing of any comparable platform", "greytHR Academy for HR professional training"]}
                weaknesses={["UI visibly dated — 2014–2016 era design language (i)", "No performance management module", "No structured training / LMS", "No AI features", "No SOP governance or document verification system"]}
                threat="MEDIUM — overlapping on payroll and leave; Hire'in clearly superior on governance, performance, training. GreytHR wins on price and trust."
                threatLevel="medium"
              />
              {/* SumHR */}
              <CompetitorCard
                name="SumHR" flag="🇮🇳"
                meta="Bootstrapped (no public funding found — inferred) · Free tier available · Paid from ₹2,999/mo · Verified from homepage, July 2026"
                pricing="Free tier · Paid from ₹2,999/mo"
                markets="India SMB"
                strengths={["Biometric + GPS attendance integration", "Leave management, India payroll, letter generation", "HR helpdesk / internal ticketing", "Onboarding and exit workflows"]}
                weaknesses={["No performance management", "No SOP governance or compliance lock", "No probation framework", "No salary advance management", "No document verification system", "Small team; limited enterprise depth (i)"]}
                threat="LOW-MEDIUM — free tier makes it a starter competitor but it tops out early for growing firms."
                threatLevel="low"
              />
              {/* Rippling */}
              <CompetitorCard
                name="Rippling" flag="🇺🇸"
                meta="Series F · $13.5B valuation (2024) · Unified HR + IT + Finance platform · Verified from homepage JS, July 2026"
                pricing="$8–$35/employee/mo (industry range — inferred)"
                markets="US-primary; expanding globally"
                strengths={["Unified HR + IT management (device provisioning, payroll in one)", "600+ app integrations — widest moat in the market", "Fastest new-hire-to-productive workflow in US market", "Global payroll capabilities"]}
                weaknesses={["US-centric — India statutory compliance (PF/ESI/TDS/LWF) absent or minimal", "No staffing-agency-specific features", "No document generation or verification system", "No SOP governance"]}
                threat="VERY LOW for India operations. HIGH only if targeting US-based staffing firms with Indian delivery centers."
                threatLevel="low"
              />
              {/* BambooHR */}
              <CompetitorCard
                name="BambooHR" flag="🇺🇸"
                meta="PE-backed (investor group acquisition) · ~$100M+ ARR (inferred from industry reports)"
                pricing="Estimated $6–9/employee/mo (industry-known range — inferred)"
                markets="US and Canada primarily"
                strengths={["Strong HRIS, Payroll, Benefits, Performance, Hiring, Onboarding suite", "Well-regarded UX in US SMB market", "Established brand trust"]}
                weaknesses={["No India statutory compliance (PF/ESI/TDS)", "No document generation or verification", "No SOP governance or compliance lock", "No probation framework for Indian labor law requirements"]}
                threat="VERY LOW — different geography, different compliance context."
                threatLevel="low"
              />
              {/* Workday */}
              <CompetitorCard
                name="Workday" flag="🇺🇸"
                meta="Public company (NASDAQ: WDAY) · $6B+ ARR · HCM product page verified July 2026"
                pricing="$150–300+/employee/year (analyst estimates — inferred); implementation often ₹1 crore+"
                markets="Global enterprise"
                strengths={["Comprehensive HCM: Core HR, Payroll, Talent, Learning, Workforce Planning, Analytics", "2026 product narrative: AI skills intelligence", "Industry-leading reporting and analytics depth"]}
                weaknesses={["6–18 month implementation timeline", "Not relevant for any company under 1,000 employees", "Cost prohibitive for all SMB segments"]}
                threat="ZERO — completely different market segment."
                threatLevel="low"
              />
            </div>
          </section>

          {/* ═══ SECTION 4: FEATURE MATRIX ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="feature-matrix">6 — Feature Matrix</SectionHeader>
            <p className="text-xs text-muted-foreground mb-4 italic">Hire'in scored first-hand from codebase audit (July 2026). Competitor scores verified where possible; inferred scores flagged with (i).</p>

            {/* Legend + controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-2 text-xs">
                {[["WIN+", "bg-emerald-700 text-white"], ["WIN", "bg-green-500 text-white"], ["PARTIAL", "bg-amber-400 text-white"], ["LOSE", "bg-red-500 text-white"]].map(([label, cls]) => (
                  <span key={label} className={`px-2 py-1 rounded font-medium ${cls}`}>{label}</span>
                ))}
                <span className="text-muted-foreground self-center">(i) = inferred</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortAsc(v => !v)}
                  data-testid="button-sort-matrix"
                  className="text-xs px-3 py-1.5 rounded border hover:bg-accent transition-colors"
                >
                  Sort by Weight {sortAsc ? "↑" : "↓"}
                </button>
                <button
                  onClick={exportCSV}
                  data-testid="button-export-csv"
                  className="text-xs px-3 py-1.5 rounded border hover:bg-accent transition-colors"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs border-collapse min-w-[800px]">
                <thead>
                  <tr style={{ backgroundColor: NAVY, color: "white" }}>
                    <th className="text-left px-3 py-2 font-semibold">Capability</th>
                    <th className="text-center px-3 py-2 font-semibold w-12">Wt</th>
                    <th className="text-center px-2 py-2 font-semibold">Hire'in</th>
                    <th className="text-center px-2 py-2 font-semibold">Darwin</th>
                    <th className="text-center px-2 py-2 font-semibold">Keka</th>
                    <th className="text-center px-2 py-2 font-semibold">GreytHR</th>
                    <th className="text-center px-2 py-2 font-semibold">SumHR</th>
                    <th className="text-center px-2 py-2 font-semibold">Rippling</th>
                    <th className="text-center px-2 py-2 font-semibold">Bamboo</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFeatures.map((f, i) => (
                    <tr key={f.name} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                      <td className="px-3 py-2 font-medium">{f.name}</td>
                      <td className="text-center px-3 py-2">
                        <span className="font-bold" style={{ color: f.weight >= 5 ? "#dc2626" : f.weight >= 4 ? ORANGE : "#6b7280" }}>{f.weight}</span>
                      </td>
                      {([f.hirein, f.darwinbox, f.keka, f.greyhr, f.sumhr, f.rippling, f.bamboohr] as Rating[]).map((r, j) => (
                        <td key={j} className="text-center px-1 py-1.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${ratingColor(r)}`}>
                            {ratingLabel(r)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-3 mt-4">
              <StatChip color="bg-emerald-700" label="WIN+ (best-in-class)" value={`${winPlus} features`} />
              <StatChip color="bg-green-500" label="WIN (functional)" value={`${wins} features`} />
              <StatChip color="bg-amber-400" label="PARTIAL" value={`${partials} features`} />
              <StatChip color="bg-red-500" label="LOSE" value={`${loses} features`} />
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              Note: 4 of the {loses} LOSE ratings are weight-5 or weight-4 (mobile, integrations, GPS attendance, self-serve packaging). These are the most commercially damaging gaps. Shift scheduling was previously mis-scored as a LOSE — the platform has a full multi-timezone, DST-aware shift system; the remaining gap is a client-site roster calendar, which no Indian competitor has either.
            </p>
          </section>

          {/* ═══ SECTION 5: POSITIONING MAP ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="positioning-map">7 — Positioning Map</SectionHeader>
            <p className="text-xs text-muted-foreground mb-4 italic">SVG positioning chart — no external charting library.</p>

            <Card>
              <CardContent className="pt-4 overflow-x-auto">
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full max-w-2xl mx-auto" style={{ minWidth: 480 }}>
                  {/* Quadrant fills */}
                  <rect x={MARGIN} y={MARGIN} width={plotW / 2} height={plotH / 2} fill="#EEF2FA" fillOpacity={0.6} />
                  <rect x={MARGIN + plotW / 2} y={MARGIN} width={plotW / 2} height={plotH / 2} fill="#E8F5E9" fillOpacity={0.6} />
                  <rect x={MARGIN} y={MARGIN + plotH / 2} width={plotW / 2} height={plotH / 2} fill="#FFF3E0" fillOpacity={0.4} />
                  <rect x={MARGIN + plotW / 2} y={MARGIN + plotH / 2} width={plotW / 2} height={plotH / 2} fill="#FFF8E1" fillOpacity={0.5} />

                  {/* Axes */}
                  <line x1={MARGIN} y1={MARGIN} x2={MARGIN} y2={MARGIN + plotH} stroke="#999" strokeWidth={1.5} />
                  <line x1={MARGIN} y1={MARGIN + plotH} x2={MARGIN + plotW} y2={MARGIN + plotH} stroke="#999" strokeWidth={1.5} />
                  {/* Mid lines */}
                  <line x1={MARGIN + plotW / 2} y1={MARGIN} x2={MARGIN + plotW / 2} y2={MARGIN + plotH} stroke="#ccc" strokeWidth={1} strokeDasharray="4 4" />
                  <line x1={MARGIN} y1={MARGIN + plotH / 2} x2={MARGIN + plotW} y2={MARGIN + plotH / 2} stroke="#ccc" strokeWidth={1} strokeDasharray="4 4" />

                  {/* Axis labels */}
                  <text x={MARGIN + plotW / 2} y={SVG_H - 12} textAnchor="middle" fontSize={12} fill="#555" fontWeight="600">India-native Depth →</text>
                  <text x={18} y={MARGIN + plotH / 2} textAnchor="middle" fontSize={12} fill="#555" fontWeight="600" transform={`rotate(-90, 18, ${MARGIN + plotH / 2})`}>AI / Smart Layer Maturity →</text>

                  {/* Quadrant labels */}
                  <text x={MARGIN + plotW * 0.25} y={MARGIN + 18} textAnchor="middle" fontSize={10} fill="#6b7280" fontWeight="600">Global AI / No India</text>
                  <text x={MARGIN + plotW * 0.25} y={MARGIN + 30} textAnchor="middle" fontSize={9} fill="#9ca3af">(Rippling / Workday zone)</text>
                  <text x={MARGIN + plotW * 0.75} y={MARGIN + 18} textAnchor="middle" fontSize={10} fill="#15803d" fontWeight="600">Enterprise AI + India Depth</text>
                  <text x={MARGIN + plotW * 0.75} y={MARGIN + 30} textAnchor="middle" fontSize={9} fill="#9ca3af">(Darwinbox zone)</text>
                  <text x={MARGIN + plotW * 0.25} y={MARGIN + plotH - 10} textAnchor="middle" fontSize={10} fill="#6b7280" fontWeight="600">Generic Global SMB</text>
                  <text x={MARGIN + plotW * 0.75} y={MARGIN + plotH - 10} textAnchor="middle" fontSize={10} fill="#92400e" fontWeight="600">India Depth / Legacy UI</text>

                  {/* Annotation arrows — simplified lines */}
                  {/* Hire'in annotation */}
                  <line x1={dotX(80)} y1={dotY(50) - 20} x2={dotX(80) - 60} y2={dotY(50) - 50} stroke={ORANGE} strokeWidth={1.5} markerEnd="url(#arrow-orange)" />
                  <text x={dotX(80) - 65} y={dotY(50) - 58} textAnchor="end" fontSize={9} fill={ORANGE} fontWeight="600">Hire'in's uncontested position</text>
                  <text x={dotX(80) - 65} y={dotY(50) - 47} textAnchor="end" fontSize={8} fill="#555">High India depth + emerging AI</text>

                  {/* Darwinbox annotation */}
                  <line x1={dotX(90)} y1={dotY(80)} x2={dotX(90) + 40} y2={dotY(80) - 30} stroke="#dc2626" strokeWidth={1} markerEnd="url(#arrow-red)" />
                  <text x={dotX(90) + 44} y={dotY(80) - 30} textAnchor="start" fontSize={8} fill="#dc2626">Primary threat</text>

                  {/* Keka annotation */}
                  <line x1={dotX(85)} y1={dotY(35)} x2={dotX(85) + 40} y2={dotY(35) + 30} stroke="#ea580c" strokeWidth={1} markerEnd="url(#arrow-orange-sm)" />
                  <text x={dotX(85) + 44} y={dotY(35) + 30} textAnchor="start" fontSize={8} fill="#ea580c">Highest-priority competitor</text>

                  {/* Arrow markers */}
                  <defs>
                    <marker id="arrow-orange" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill={ORANGE} />
                    </marker>
                    <marker id="arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill="#dc2626" />
                    </marker>
                    <marker id="arrow-orange-sm" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill="#ea580c" />
                    </marker>
                  </defs>

                  {/* Dots */}
                  {MAP_DOTS.map((dot) => (
                    <g key={dot.label}>
                      {dot.isHirein ? (
                        <text x={dotX(dot.x)} y={dotY(dot.y) + 5} textAnchor="middle" fontSize={18} fill={dot.color}>★</text>
                      ) : (
                        <circle cx={dotX(dot.x)} cy={dotY(dot.y)} r={7} fill={dot.color} fillOpacity={0.85} />
                      )}
                      <text
                        x={dotX(dot.x) + (dot.x > 50 ? -10 : 10)}
                        y={dotY(dot.y) - 10}
                        textAnchor={dot.x > 50 ? "end" : "start"}
                        fontSize={10}
                        fontWeight="600"
                        fill={dot.color}
                      >
                        {dot.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </CardContent>
            </Card>
          </section>

          {/* ═══ SECTION 6: WHITE SPACE ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="white-space">8 — White Space & Opportunities</SectionHeader>

            <div className="space-y-5">
              <WhiteSpaceCard
                n="1"
                icon="🎯"
                title="The Staffing Agency OS Gap — This is the opportunity"
                paras={[
                  "No current market player combines internal HRMS + India payroll + document generation + ATS integration + SOP governance in a single product priced and designed for staffing firms with 50–500 employees. Ceipal and Bullhorn are ATS-only products — they do not touch payroll or internal HR. Keka's ATS (Hire) costs ₹2,500/recruiter/mo on top of the base platform and is designed for permanent hiring, not contingent/staffing workflows. GreytHR and SumHR have no ATS at all.",
                  "Hire'in already has all five components. The gap is not product — it is packaging, multi-tenancy, and go-to-market. This combination is a defensible moat if protected. The first competitor to copy it will be Keka (they have the distribution and resources). Estimated time before Keka adds staffing-specific SOP governance: 18–24 months, based on current blog positioning toward enterprise upmarket.",
                  "Action: Package and launch before the window closes. 12–18 months of competitive air cover remain."
                ]}
              />
              <WhiteSpaceCard
                n="2"
                icon="🏥"
                title="Healthcare Staffing Compliance is Completely Unserved"
                paras={[
                  "Not a single Indian HRMS — Darwinbox, Keka, GreytHR, or SumHR — offers credentialing management (nurse license tracking, certification expiry alerts), client-site-specific shift rostering, or per-client SLA compliance reporting. These are non-negotiable requirements for healthcare staffing operations.",
                  "Hire'in is architecturally closer to this than any competitor — and closer than the first draft of this report credited. The shift engine already exists: multi-timezone shift definitions with DST-aware IST timings, per-shift grace periods and scheduled hours, assignment audit logs, and night-shift consent tracking. What is missing is the client-site roster calendar layer on top of it — assigning those shifts to specific client sites on specific dates. The SOP + systemic governance engine, the probation framework, and the document generation layer all exist and could extend to credentialing. The payroll engine already handles the healthcare staffing context (LOP, shift-based attendance). The healthcare staffing HRMS niche in India is currently served by: manual Excel, generic Zoho People configurations, and standalone credential management tools. No purpose-built solution exists.",
                  "Action: Healthcare staffing compliance as a feature bundle (credential management + client-site rostering) would be a genuine market-first. This is the 6–12 month product roadmap bet."
                ]}
              />
              <WhiteSpaceCard
                n="3"
                icon="🔐"
                title="Cryptographic Document Verification is an Underused Differentiator"
                paras={[
                  "The /verify page with unique reference numbers and document hash verification is more sophisticated than anything GreytHR, Keka, SumHR, or BambooHR has built. This feature addresses a real pain point: Indian staffing clients and enterprises frequently need to verify the authenticity of experience letters, offer letters, and salary revision letters during background checks.",
                  "Zero competitors have replicated this. It takes perhaps 30 seconds to demo and immediately signals product maturity to any enterprise buyer. It is currently invisible in any marketing or sales materials.",
                  "Action: Lead every demo with the /verify flow. Add it to the company website. Position it explicitly against 'printed letters with no way to verify authenticity' — a real pain point that candidates and HR teams deal with constantly."
                ]}
              />
              <WhiteSpaceCard
                n="4"
                icon="🤖"
                title="Operational AI is the 12-Month Battleground — Hire'in is 18 Months Behind"
                paras={[
                  "Darwinbox has an AI chatbot for payroll queries, live in production as of their July 2026 product page. Rippling has AI HR automation tools. Workday's entire 2026 product narrative is 'AI skills intelligence.' Keka's blog shows no current AI investment but has the distribution to launch fast.",
                  "Hire'in's current AI investment is in Content Studio and BD Agent. These are valuable but not what enterprise HR buyers evaluate. The operational AI gap: no AI-assisted candidate matching (most wanted feature in staffing), no attrition prediction (Hire'in already has the raw data: attendance patterns, leave frequency, performance scores, tenure — a logistic model on this data is a 4–6 week build), no AI-drafted performance review summaries, no AI chatbot for employee self-service payroll queries.",
                  "Action: Redirect AI investment toward operational HR features. The three builds above have immediate, measurable ROI for both the internal use case and the product use case."
                ]}
              />
            </div>
          </section>

          {/* ═══ SECTION 9: CEO COPILOT & EXEC COCKPIT ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="ceo-copilot">9 — CEO Copilot & Exec Cockpit</SectionHeader>
            <p className="text-sm text-muted-foreground mb-6 italic">
              The <code className="text-xs bg-muted px-1 rounded">/admin/executive-cockpit</code> page and its AI payload builder. Accessible to <strong>executive</strong> and <strong>super_admin</strong> roles only.
            </p>

            <div className="space-y-5">
              {/* What it is */}
              <Card data-testid="card-exec-cockpit-overview">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Senior Management Unified Command View</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The Exec Cockpit gives the CEO or senior principal a single page to see the entire people operation — without drilling into individual modules. Three tabs, all from one place:
                  </p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { tab: "People", desc: "Full employee directory with search, department filter, and CSV export of the complete workforce." },
                      { tab: "Document Compliance", desc: "Which employees have outstanding document requirements — and at what stage." },
                      { tab: "Policy Compliance", desc: "Which employees have not yet signed required policy documents — with escalation visibility." },
                    ].map(({ tab, desc }) => (
                      <div key={tab} className="p-3 rounded-md border bg-muted/20">
                        <p className="text-xs font-bold mb-1" style={{ color: NAVY }}>{tab}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI payload */}
              <Card data-testid="card-ceo-ai-payload">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">AI-Powered Executive Summary — <code className="text-xs bg-muted px-1 rounded font-mono">buildAllowlistedCeoPayload()</code></CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    When the CEO requests an AI governance summary, the system does <strong>not</strong> pass employee records to the AI. Instead, <code className="text-xs bg-muted px-1 rounded">buildAllowlistedCeoPayload()</code> constructs an explicit-allowlist report — only approved non-identifying operational values reach the external model.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground">What the AI sees</p>
                      <ul className="text-muted-foreground space-y-1 list-disc pl-4">
                        <li>Counts: total open, overdue, escalated, disputed controls</li>
                        <li>By-type breakdowns (goal, training, SOP, etc.)</li>
                        <li>Exception categories with department aggregates</li>
                        <li>High-priority items: control type, role category, department, days overdue, escalation level</li>
                        <li>Semantic summary: employees with no active goal, multiple overdue obligations, explicit blockers</li>
                      </ul>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground">What the AI never sees</p>
                      <ul className="text-muted-foreground space-y-1 list-disc pl-4">
                        <li>Employee names, emails, or phone numbers</li>
                        <li>Salary, compensation, or bank details</li>
                        <li>Medical flags, disability status</li>
                        <li>National IDs, PAN, Aadhaar</li>
                        <li>Authentication tokens or passwords</li>
                        <li>Grievance or complaint free text</li>
                      </ul>
                    </div>
                  </div>
                  <div
                    className="p-3 rounded-md border-l-4 text-xs"
                    style={{ borderColor: ORANGE, backgroundColor: "#FFF7F0" }}
                  >
                    <p className="font-bold mb-1" style={{ color: ORANGE }}>Fail-Closed by Design</p>
                    <p className="text-muted-foreground">Any field not in the explicit allowlist is silently excluded. The payload is constructed by field picking — not by redacting a full object. If a new field is added to the employee record, it does not automatically reach the AI unless a developer adds it to the allowlist.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Competitive callout */}
              <Card data-testid="card-exec-cockpit-competitive">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Competitive Callout — WIN+ Against Every Indian SMB Competitor</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    No Indian HR SMB competitor — Keka, GreytHR, SumHR, or even Darwinbox's SMB tier — offers an AI-driven executive command layer with a purpose-built PII-safe CEO payload. Darwinbox has an AI chatbot for employee payroll queries; it does not have an executive governance intelligence layer. This is enterprise-grade thinking at SMB price — and it is live in production, not on a roadmap.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ═══ SECTION 10: AI COMPLIANCE ARCHITECTURE ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="ai-compliance">10 — AI Compliance Architecture (PII + HIPAA Protection Layer)</SectionHeader>
            <p className="text-sm text-muted-foreground mb-2 italic">
              Production, unit-tested. This is a genuine WIN+ that was previously unscored.
            </p>
            <div
              className="mb-5 p-3 rounded-md border-l-4 text-xs"
              style={{ borderColor: "#059669", backgroundColor: "#F0FDF4" }}
              data-testid="card-ai-compliance-callout"
            >
              <p className="font-bold text-green-700 mb-1">Both systems below are live in production — not roadmap items.</p>
              <p className="text-green-800">Unit tests exist in <code className="bg-green-100 px-1 rounded">tests/aiPrivacyGuard.test.ts</code>. Any regression in PII protection is caught by the automated test suite before it can reach a deployed environment.</p>
            </div>

            <div className="space-y-5">
              {/* aiPrivacyGuard */}
              <Card data-testid="card-ai-privacy-guard">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="text-sm"><code className="bg-muted px-1 rounded font-mono text-xs">aiPrivacyGuard.ts</code> — Production, Unit-Tested</CardTitle>
                    <span className="shrink-0 text-xs px-2 py-1 rounded bg-emerald-700 text-white font-semibold">WIN+</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    30+ prohibited field names hardcoded. Any object containing these fields — at any nesting depth — is sanitized before reaching an external AI call.
                  </p>
                  <div className="overflow-x-auto">
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {[
                        "firstName", "lastName", "email", "phone", "salary", "basicSalary", "grossSalary",
                        "netPayable", "esiDisability", "medicalFlag", "totpSecret", "password",
                        "accountNumber", "ifscCode", "bankName", "nationalId", "panNumber", "aadhar",
                        "grievanceText", "compensation", "disability", "passwordResetToken"
                      ].map((f) => (
                        <code key={f} className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{f}</code>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    {[
                      { fn: "sanitizeEmployee()", desc: "Replaces any employee record with an opaque reference code (EMP-001, EMP-002) — role category and department only, no identity." },
                      { fn: "sanitizeObjectForAI()", desc: "Deep recursive object sanitization — catches prohibited fields at any nesting depth." },
                      { fn: "redactFreeTextForAI()", desc: "Regex scrubbing: email patterns, Indian and international phone patterns, name-prefixed patterns → [EMAIL], [PHONE], [NAME]." },
                      { fn: "auditPromptForPII()", desc: "Unit-testable assertion function — returns a list of prohibited fields found in a prompt string. Used in automated tests." },
                      { fn: "buildAnonymizedControlSummary()", desc: "Anonymizes governance control records before AI consumption — control type, role category, department, days overdue, escalation level only." },
                      { fn: "buildAllowlistedCeoPayload()", desc: "Fail-closed explicit field picker for CEO AI reports — constructed by field allowlist, not by redacting a full object." },
                    ].map(({ fn, desc }) => (
                      <div key={fn} className="p-2.5 rounded border bg-muted/20">
                        <code className="text-[10px] font-mono font-bold text-foreground">{fn}</code>
                        <p className="text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* staffingSafetyGate */}
              <Card data-testid="card-safety-gate">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="text-sm"><code className="bg-muted px-1 rounded font-mono text-xs">staffingSafetyGate.ts</code> — Production, Hard-Block</CardTitle>
                    <span className="shrink-0 text-xs px-2 py-1 rounded bg-emerald-700 text-white font-semibold">WIN+</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    7 failure codes. Source ledger system: user-supplied facts are tokenized; any AI-generated claim not traceable to the ledger triggers a hard failure — blocks approval and publishing. Not advisory.
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {["JOB_FACT_INVENTED", "HEALTHCARE_FACT_INVENTED", "IT_FACT_INVENTED", "GOVERNMENT_CLAIM_INVENTED", "COMPANY_CLAIM_INVENTED", "PLACEHOLDER_LEAKED", "BANNED_PHRASE"].map((code) => (
                      <code key={code} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{code}</code>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded border bg-muted/20">
                      <p className="font-semibold text-foreground mb-2">Banned Phrase Dictionary (hard-block)</p>
                      <div className="flex flex-wrap gap-1">
                        {["game-changer", "in today's fast-paced world", "the landscape of", "unlock", "unleash", "delve into", "navigate the complexities", "war for talent", "people are our greatest asset", "rockstar", "ninja", "guru"].map((phrase) => (
                          <span key={phrase} className="text-[10px] px-1 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">"{phrase}"</span>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 rounded border bg-muted/20 space-y-2">
                      <p className="font-semibold text-foreground">Domain-Specific Checks</p>
                      <div className="space-y-1.5 text-muted-foreground">
                        <div><span className="font-medium text-foreground">Healthcare: </span>Recency language blocked unless in source ledger; clinical advice (diagnose, prescribe, treat) always blocked.</div>
                        <div><span className="font-medium text-foreground">IT Staffing: </span>Security clearance (TS/SCI, FedRAMP) and certifications (AWS-Certified, CISSP) blocked unless in source ledger.</div>
                        <div><span className="font-medium text-foreground">Government: </span>GSA schedule, GWAC, CMMC, FedRAMP, DOD approved claims blocked unless verified.</div>
                        <div><span className="font-medium text-foreground">Company: </span>Hire'in placement rates, fill rates, "#1 staffing" claims — all blocked unless user-supplied.</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Roadmap items */}
              <Card data-testid="card-ai-compliance-roadmap">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Roadmap Items — Announced, Not Yet Built</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded border">
                      <p className="font-semibold text-foreground mb-1">Custom Rule Authoring</p>
                      <p className="text-muted-foreground">Users will be able to add their own rules to the Safety Gate — organization-specific banned phrases, domain-specific claim restrictions, or custom compliance policies.</p>
                    </div>
                    <div className="p-3 rounded border">
                      <p className="font-semibold text-foreground mb-1">Custom Regex Patterns</p>
                      <p className="text-muted-foreground">Organizations can define their own regex-based content rules per document type — enabling regulated industries (healthcare, government, legal) to enforce custom compliance patterns without code changes.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ═══ SECTION 7: ACTION PLAN ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="action-plan">11 — Action Plan</SectionHeader>

            <div className="space-y-5">
              <ActionCard
                n={1}
                priority="CRITICAL"
                timeframe="Within 90 days"
                effort="4–6 weeks engineering"
                title="Build a Progressive Web App (PWA) for mobile"
                paras={[
                  "This is the single highest-return investment available to the platform right now. Every manager — whether at Hire'in or at a future customer — approves leaves, checks team attendance, views payslips, and manages shift issues from a phone. Without a mobile experience, any sales conversation that includes the question 'do you have an app?' ends badly.",
                  "Hire'in already has a responsive UI. Converting to a true PWA requires: adding a manifest.json (app name, icons, theme color), registering a service worker (for offline caching and install prompt), and fixing any viewport/touch issues. This is not a rebuild — it is 4–6 weeks of focused frontend work and should be treated as the most urgent engineering priority after any critical bugs."
                ]}
                battlecard="What's the G2 rating for your current HR tool's mobile app, and how many of your managers have it actually installed? — Most competitors have 2–3 star mobile app reviews on G2. Lead with UX quality, not just app existence."
              />
              <ActionCard
                n={2}
                priority="CRITICAL"
                timeframe="Within 90 days"
                effort="3–5 weeks"
                title="Integrate one biometric/GPS attendance vendor"
                paras={[
                  "Healthcare staffing clients cannot operate without field and shift attendance tracking. Asking a ward nurse to 'punch in on the web portal' is a non-starter. Keka integrates with ZKTeco and eSSL biometric devices. GreytHR integrates with multiple biometric vendors. SumHR has GPS-based mobile attendance.",
                  "The fastest path: build a webhook/API integration with ZKTeco's cloud attendance platform (the most common hardware in Indian hospitals and corporate offices). A single integration closes the objection for 80% of the use cases. Alternatively, a GPS-based mobile punch-in (part of the PWA build above) covers field staff."
                ]}
                battlecard="How do your nurses and field staff record attendance when they're not near a computer? — This question currently has no good answer. After this build, it does."
              />
              <ActionCard
                n={3}
                priority="HIGH"
                timeframe="4–6 months"
                effort="8–12 weeks engineering"
                title="Productize for multi-tenancy"
                paras={[
                  "The platform is a single-tenant custom system. Selling it to a second staffing firm requires: row-level tenant isolation in the database, a tenant-scoped authentication system, a self-serve signup and onboarding flow, and a pricing page. Without these, every new customer requires manual setup — which does not scale.",
                  "The revenue math: 50 staffing firms paying ₹15,000/mo = ₹90L/year ARR. 200 firms = ₹3.6 crore/year. The engineering investment (8–12 weeks) has the clearest ROI of any item on this list. Note: multi-tenancy does not mean rebuilding the app. It means adding tenant_id scoping to queries, separating storage buckets, and wrapping auth in a per-tenant context. The existing schema and architecture support this without fundamental restructuring."
                ]}
              />
              <ActionCard
                n={4}
                priority="HIGH"
                timeframe="6–9 months"
                effort="8–10 weeks"
                title="Extend the existing shift system into client-site rostering"
                paras={[
                  "Healthcare staffing's operational core is: 'Who is working at which client site, on which shift, on which date?' Today this is managed in Excel or WhatsApp groups by every healthcare staffing firm in India. No Indian HRMS has a purpose-built rostering module for the staffing context.",
                  "Hire'in already has the hard part built: a multi-timezone, DST-aware shift engine with per-shift grace periods, scheduled hours, assignment audit logs, and night-shift consent compliance. The remaining build is the roster calendar layer on top — a weekly view where an HR/operations user assigns employees (and their existing shifts) to client sites and dates, with those assignments feeding expected attendance records. Because the shift foundation exists, this is an extension, not a greenfield module — and it is completely unserved by any competitor."
                ]}
              />
              <ActionCard
                n={5}
                priority="MEDIUM"
                timeframe="6–9 months"
                effort="4–6 weeks per integration"
                title="Build 5 targeted integrations"
                paras={[
                  "Rippling's 600+ integrations are a moat you cannot match. But SMB buyers don't need 600 integrations — they need 5 specific ones. In priority order: (1) WhatsApp Business (Meta API) — Darwinbox already does this; leave approvals and payslip delivery via WhatsApp drives adoption immediately. (2) Slack — Leave/approval notifications for tech-forward staffing firms. (3) Google Workspace — Calendar sync for approved leaves. (4) Tally / QuickBooks — Salary journal export for finance teams. (5) Naukri.com — Direct job posting from the system, closing the ATS gap for firms using Naukri as primary sourcing channel.",
                  "Each integration is relatively low-effort (4–6 weeks each) and directly answers a common objection in competitive deals. Combined, they shift Hire'in from 'no integrations' to 'the integrations that actually matter.'"
                ]}
              />
              <ActionCard
                n={6}
                priority="MEDIUM"
                timeframe="9–12 months"
                effort="6–8 weeks"
                title="Move AI investment from marketing to HR operations"
                paras={[
                  "Three operational AI features with the highest ROI, using data the system already has: (a) Attrition prediction score — Use existing attendance patterns (absenteeism spikes), leave frequency, performance trends, and tenure data to produce a monthly 'flight risk' score per employee. A simple rule-based scoring (no LLM required) would be a genuine differentiator vs every Indian SMB competitor. (b) AI performance review draft — Pre-populate the review form with a draft based on check-in notes, goal completion %, attendance record, and leave history. Saves 30–45 minutes per manager per review cycle. (c) AI candidate context for offer letters — Pre-fill suggested compensation based on role/level/department benchmarks and flag if the proposed salary is below the team median.",
                  "These three features use existing infrastructure (OpenAI integration, salary_changes ledger, check-in data, attendance records) and address the operational AI gap that buyers will evaluate in the next 12 months."
                ]}
              />
            </div>
          </section>

          {/* ═══ BRAND DECISION LOG ═══ */}
          <section className="mb-16 scroll-mt-16">
            <SectionHeader id="brand-log">12 — Brand Decision Log</SectionHeader>
            <p className="text-sm text-muted-foreground mb-5 italic">
              Record of the July 15, 2026 naming session. Documented here for institutional memory and future brand consistency.
            </p>

            <Card data-testid="card-brand-decision-log">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Naming Session — July 15, 2026</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Options Evaluated</p>
                  <div className="flex flex-wrap gap-2">
                    {["StaffOS", "AgencyOS", "Hire'in OS", "Hire'in HQ", "TalentStack", "PipelineHQ", "Hire'in Suite", "Hire'in Pro", "Hire'in 360"].map((name) => (
                      <span
                        key={name}
                        className={`text-xs px-2.5 py-1 rounded border font-medium ${name === "Hire'in 360" ? "text-white" : "text-muted-foreground"}`}
                        style={name === "Hire'in 360" ? { backgroundColor: NAVY, borderColor: NAVY } : {}}
                        data-testid={name === "Hire'in 360" ? "badge-brand-chosen" : undefined}
                      >
                        {name === "Hire'in 360" ? "★ " : ""}{name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Chosen Name</p>
                    <p className="text-xl font-bold" style={{ color: NAVY }}>Hire'in 360</p>
                    <p className="text-xs text-muted-foreground mt-1">Decided: July 15, 2026</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rationale</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      <li>Most relatable, marketable, and equitable option evaluated</li>
                      <li>Preserves Hire'in brand equity built to date</li>
                      <li>360 implies completeness and full-circle coverage</li>
                      <li>Differentiates from generic "OS" naming trend without losing clarity</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Domain Targets</p>
                  <div className="flex gap-3 flex-wrap">
                    <code className="text-xs px-2 py-1 rounded border bg-muted">hire-in360.com</code>
                    <code className="text-xs px-2 py-1 rounded border bg-muted">hirein360.com</code>
                    <span className="text-xs text-muted-foreground self-center">(to be registered)</span>
                  </div>
                </div>

                <div
                  className="p-3 rounded-md border-l-4 text-xs"
                  style={{ borderColor: ORANGE, backgroundColor: "#FFF7F0" }}
                >
                  <p className="font-bold mb-1" style={{ color: ORANGE }}>Brand Consistency Rule</p>
                  <p className="text-muted-foreground">All new external-facing materials, product screenshots, sales decks, and domain registrations should use <strong>Hire'in 360</strong> going forward. The internal admin app retains its current branding until a coordinated rebrand launch is planned.</p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══ METHODOLOGY ═══ */}
          <section className="mb-16 scroll-mt-16">
            <button
              onClick={() => setShowMethodology(v => !v)}
              data-testid="button-toggle-methodology"
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              {showMethodology ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Methodology & Data Provenance
            </button>
            {showMethodology && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: NAVY, color: "white" }}>
                      <th className="text-left px-3 py-2">Source</th>
                      <th className="text-left px-3 py-2">Method</th>
                      <th className="text-left px-3 py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METHODOLOGY.map((r, i) => (
                      <tr key={r.source} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                        <td className="px-3 py-2 font-medium">{r.source}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.method}</td>
                        <td className="px-3 py-2">
                          <span className={`font-semibold ${
                            r.confidence === "High" ? "text-green-600" :
                            r.confidence === "Definitive" ? "text-emerald-700" :
                            r.confidence.startsWith("Low") ? "text-red-500" : "text-amber-600"
                          }`}>{r.confidence}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground p-3 italic border-t">
                  G2 and Capterra review data could not be directly extracted (sites behind Cloudflare/JS rendering as of July 2026). Weakness assessments marked (i) are inferred from product gaps, not direct customer review data.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-3 h-3 rounded-sm ${color}`} />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

interface CompetitorCardProps {
  name: string; flag: string; meta: string; pricing: string; markets: string;
  strengths: string[]; weaknesses: string[]; threat: string; threatLevel: "critical" | "high" | "medium" | "low";
}

function CompetitorCard({ name, flag, meta, pricing, markets, strengths, weaknesses, threat, threatLevel }: CompetitorCardProps) {
  const threatColors: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-amber-400 text-white",
    low: "bg-green-500 text-white",
  };
  return (
    <Card data-testid={`card-competitor-${name.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{flag} {name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{meta}</p>
          </div>
          <span className={`shrink-0 text-xs px-2 py-1 rounded font-semibold whitespace-nowrap ${threatColors[threatLevel]}`}>
            {threatLevel.toUpperCase()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div><span className="font-semibold text-foreground">Pricing: </span>{pricing}</div>
          <div><span className="font-semibold text-foreground">Markets: </span>{markets}</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Strengths</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              {strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1.5">Weaknesses</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              {weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
        <div className="text-xs border-t pt-2">
          <span className="font-semibold">Threat to Hire'in: </span>
          <span className="text-muted-foreground">{threat}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function WhiteSpaceCard({ n, icon, title, paras }: { n: string; icon: string; title: string; paras: string[] }) {
  return (
    <Card data-testid={`card-whitespace-${n}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-start gap-3">
          <span className="text-xl">{icon}</span>
          <span>Finding {n}: {title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {paras.map((p, i) => (
          <p key={i} className={`text-sm leading-relaxed ${i === paras.length - 1 ? "font-medium" : "text-muted-foreground"}`}>{p}</p>
        ))}
      </CardContent>
    </Card>
  );
}

function ActionCard({
  n, priority, timeframe, effort, title, paras, battlecard
}: {
  n: number; priority: "CRITICAL" | "HIGH" | "MEDIUM"; timeframe: string; effort: string;
  title: string; paras: string[]; battlecard?: string;
}) {
  const priorityColors: Record<string, string> = {
    CRITICAL: "bg-red-600 text-white",
    HIGH: "bg-orange-500 text-white",
    MEDIUM: "bg-yellow-500 text-black",
  };
  return (
    <Card data-testid={`card-action-${n}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black opacity-25" style={{ color: NAVY }}>{String(n).padStart(2, "0")}</span>
            <CardTitle className="text-sm font-bold">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded font-bold ${priorityColors[priority]}`}>{priority}</span>
            <span className="text-xs px-2.5 py-1 rounded border text-muted-foreground">{timeframe}</span>
            <span className="text-xs px-2.5 py-1 rounded border text-muted-foreground">⏱ {effort}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {paras.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
        ))}
        {battlecard && (
          <div
            className="mt-3 p-3 rounded-md border-l-4 text-sm"
            style={{ borderColor: ORANGE, backgroundColor: "#FFF7F0" }}
            data-testid={`text-battlecard-${n}`}
          >
            <p className="text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: ORANGE }}>Battlecard Question</p>
            <p className="text-muted-foreground italic text-xs">"{battlecard}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
