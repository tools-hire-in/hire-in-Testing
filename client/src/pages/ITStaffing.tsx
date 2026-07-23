import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Brain,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Code2,
  Cpu,
  Database,
  Download,
  Expand,
  FileCheck,
  Globe,
  Handshake,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Minimize2,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { Button } from "@/components/ui/button";
import { TypedSlideRenderer } from "@/components/deck/TypedSlideRenderer";
import type { TypedSlide } from "@/components/deck/ITSlideLayouts";
import { CONTACT } from "@/lib/constants";

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "IT Staffing Services",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "IT Staffing",
  description: "AI-powered IT staffing with 500+ successful talent engagements, 24-hour submissions, and 95% client retention.",
  areaServed: { "@type": "Country", name: "United States" },
};

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const WHITE = "#FFFFFF";

const IT_SLIDES: TypedSlide[] = [
  {
    slide_type: "cover",
    badge: "AI-ENHANCED RECRUITING",
    title: "Hire'in Solutions — US IT Staffing · Powered by AI",
    subtitle: "The Right Tech Talent, Right Now",
    tagline: "Right Tech Talent, Right Now — Faster Than Anyone Else",
    stats: [
      { value: "500+", label: "IT Placements" },
      { value: "24-Hour", label: "First Submissions" },
      { value: "95%", label: "Client Retention" },
    ],
    right_icons: [
      { icon: Brain, label: "AI-Powered Matching" },
      { icon: Code2, label: "IT Specialists" },
      { icon: Zap, label: "Fastest Fill Time" },
      { icon: ShieldCheck, label: "Compliance-First" },
    ],
  },
  {
    slide_type: "stats",
    title: "By the Numbers",
    metrics: [
      { value: "500+", label: "IT Placements", sub: "Across all technology verticals" },
      { value: "<5 Days", label: "Avg Fill Time", sub: "From intake to qualified submission" },
      { value: "95%+", label: "Client Retention", sub: "Year-over-year partnership renewals" },
      { value: "50 States", label: "US Coverage", sub: "True coast-to-coast reach" },
      { value: "25K+", label: "Candidate Database", sub: "Pre-vetted IT professionals" },
      { value: "92%", label: "AI Match Accuracy", sub: "Powered by Kleriq AI scoring" },
    ],
  },
  {
    slide_type: "about",
    title: "About Us",
    mission_label: "Our Mission",
    mission_text: "Est. 2014 · 60+ recruiters nationwide. We connect US enterprises with elite IT talent — faster, smarter, and more precisely than any traditional staffing firm. Headquartered in San Jose, CA, serving clients coast to coast.",
    navy_block_label: "Rayomind Family",
    navy_block_text: "Hire'in Solutions is a Rayomind company. Together with KleriQ.ai and proKred.com, we deliver an AI-powered ecosystem built to solve the hardest recruitment challenges in technology and healthcare staffing.",
    right_items: [
      { icon: Code2, title: "IT-Exclusive Focus", sub: "Specialists in technology — not a generalist agency" },
      { icon: Brain, title: "AI-Powered Matching", sub: "92% match accuracy via Kleriq AI scoring" },
      { icon: Users, title: "60+ Expert Recruiters", sub: "Domain-specialist team across all tech stacks" },
      { icon: Globe, title: "All 50 US States", sub: "Remote-first and on-site placements nationwide" },
    ],
  },
  {
    slide_type: "services",
    title: "IT Staffing Services",
    cards: [
      {
        icon: Users,
        icon_bg: NAVY,
        title: "Permanent IT Hiring",
        description: "Full-cycle direct placement for permanent IT roles with AI-powered culture-fit scoring and technical assessment.",
        checks: ["Culture-fit scoring & technical assessment", "End-to-end onboarding support", "90-day placement guarantee"],
      },
      {
        icon: Zap,
        icon_bg: ORANGE,
        title: "Contract IT Staffing",
        description: "Short & long-term contract IT talent from a bench-ready pool for rapid deployment on any technology initiative.",
        checks: ["Bench-ready, pre-vetted talent", "Rapid deployment within 24 hours", "All tech stacks covered"],
      },
      {
        icon: Brain,
        icon_bg: NAVY,
        title: "Project-Based IT",
        description: "Build dedicated project squads composed by need with full milestone accountability and AI-matched teams.",
        checks: ["Team composition by project need", "Milestone-based accountability", "Full stack project squads"],
      },
      {
        icon: Shield,
        icon_bg: ORANGE,
        title: "RPO (Recruitment Process Outsourcing)",
        description: "Fully managed SLA-backed talent delivery with a dedicated talent desk and ATS integration for enterprise scale.",
        checks: ["SLA-backed delivery model", "Dedicated embedded talent desk", "Ceipal ATS integration"],
      },
    ],
  },
  {
    slide_type: "comparison_table",
    title: "Staffing Models",
    columns: ["Permanent", "Contract", "Project-Based", "RPO"],
    rows: [
      { label: "Engagement Type", checks: [true, true, true, true] },
      { label: "Billing Model", checks: [true, true, true, true] },
      { label: "Placement Guarantee", checks: [true, false, true, true] },
      { label: "Rapid Deployment", checks: [false, true, true, true] },
    ],
    banner: "All models are supported by AI-driven tools — ensuring precision matching, faster screening, and compliance-first workflows.",
  },
  {
    slide_type: "feature_grid",
    badge: "SMARTER HIRING",
    title: "AI Tools We Leverage",
    subtitle: "Including Kleriq AI for job analysis, matching & screening",
    cells: [
      { icon: FileCheck, title: "Resume Parsing & Analysis", desc: "AI extracts skills, experience depth, and role-fit signals from thousands of resumes in seconds." },
      { icon: Search, title: "Job Description Matching", desc: "Kleriq AI transforms any JD into a structured sourcing matrix for precision targeting." },
      { icon: UserCheck, title: "Candidate Pre-Screening", desc: "Automated first-pass scoring eliminates noise before any human recruiter reviews a profile." },
      { icon: Shield, title: "Bias-Free Shortlisting", desc: "Skills-first shortlisting removes demographic bias from early screening stages." },
      { icon: TrendingUp, title: "Fit Scoring & Ranking", desc: "Each candidate receives a composite fit score across technical, cultural, and experience dimensions." },
      { icon: Brain, title: "Why AI-Assisted Hiring Wins", desc: "70% faster shortlisting. 92% first-submission acceptance. Zero guesswork. Better outcomes every time." },
    ],
  },
  {
    slide_type: "why_us",
    title: "Why Hire'in",
    cards: [
      { icon: Brain, title: "AI-Assisted Matching", description: "Kleriq AI delivers 92% match accuracy — transforming job descriptions into precise sourcing logic and resume scoring.", badge: "70% Faster Shortlisting" },
      { icon: Code2, title: "IT Domain Experts", description: "60+ IT-only recruiters fluent in your tech stack — Java to Kubernetes, React to SAP, cloud to cybersecurity.", badge: "60+ IT-Only Recruiters" },
      { icon: ShieldCheck, title: "Compliance-First", description: "I-9, E-Verify, background screening built into every single placement — zero risk, zero shortcuts.", badge: "Zero-Risk: I-9 + E-Verify" },
      { icon: Zap, title: "Fastest Time-to-Fill", description: "Bench-ready IT talent and pre-vetted pipelines enable qualified profile delivery within 24 hours for most roles.", badge: "First Profiles in 24 Hours" },
    ],
  },
  {
    slide_type: "process_flow",
    title: "Sourcing Process",
    steps: [
      { icon: Search, name: "Intake", desc: "Deep-dive into tech stack, experience, and culture requirements" },
      { icon: Brain, name: "AI Sourcing", desc: "Kleriq AI scores and ranks candidates from 25K+ pool", highlight: true, highlight_label: "AI-powered" },
      { icon: UserCheck, name: "Screening", desc: "Technical + soft-skills validation by specialist recruiters" },
      { icon: FileCheck, name: "Submit", desc: "Compliant profiles delivered with full documentation" },
      { icon: Handshake, name: "Onboard", desc: "Seamless onboarding with I-9, E-Verify, and background checks" },
    ],
    banner: "AI-powered tools are active throughout the pipeline — continuously scoring, ranking, and surfacing the best-fit candidates automatically.",
  },
  {
    slide_type: "demand_flow",
    title: "Demand Fulfillment",
    steps: [
      { icon: FileCheck, name: "Demand", desc: "Role received and triaged" },
      { icon: Search, name: "Review", desc: "JD parsed and structured" },
      { icon: Star, name: "Priorities", desc: "Urgency and complexity ranked" },
      { icon: Users, name: "Allocation", desc: "Specialist recruiter assigned" },
      { icon: Brain, name: "Submissions", desc: "AI-matched profiles submitted" },
      { icon: ShieldCheck, name: "Quality", desc: "Compliance check passed" },
      { icon: Handshake, name: "Client", desc: "Qualified profiles delivered" },
    ],
    metrics: [
      { value: "< 24 hrs", label: "Demand Acknowledgement" },
      { value: "< 24 hrs", label: "First Submissions" },
      { value: "≥ 95%", label: "Submission Quality Score", orange: true },
      { value: "100%", label: "Compliance Coverage" },
    ],
  },
  {
    slide_type: "domain_matrix",
    title: "IT Domains",
    domains: [
      { icon: Code2, label: "Java / Microsoft" },
      { icon: Cloud, label: "Cloud & DevOps" },
      { icon: Database, label: "Data & AI" },
      { icon: Shield, label: "Cybersecurity" },
      { icon: Smartphone, label: "Mobility" },
      { icon: ShieldCheck, label: "QA & Testing" },
      { icon: Briefcase, label: "Project Mgmt" },
    ],
    column_headers: ["Permanent", "Contract", "Project", "RPO"],
  },
  {
    slide_type: "contact",
    tagline: "The Right Tech Talent, Right Now",
    subtitle: "Hire'in Solutions · San Jose CA & New Delhi India",
    contacts: [
      { icon: Mail, label: "Email", value: "contact@hire-in.com" },
      { icon: Globe, label: "Website", value: "hire-in.com" },
      { icon: MapPin, label: "US HQ", value: "San Jose, CA 95124" },
      { icon: MapPin, label: "India Office", value: "New Delhi, India" },
      { icon: Linkedin, label: "LinkedIn", value: "linkedin.com/company/hirein-solutions" },
    ],
  },
];

const TOTAL_SLIDES = IT_SLIDES.length;
const DECK_LABEL = "US IT Staffing";

export default function ITStaffing() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const [pptProgress, setPptProgress] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "IT Staffing Services | Hire'in Solutions - AI-Powered IT Recruitment";
    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", "Hire'in Solutions IT Staffing — 500+ successful IT talent engagements, 24-hour submissions, 95% retention. AI-powered IT recruitment across all 50 US states.");
    setMeta("og:title", "IT Staffing Services | Hire'in Solutions", true);
    setMeta("og:description", "AI-powered IT staffing with 500+ successful talent engagements, 24-hour submissions, and 95% client retention.", true);
    setMeta("og:type", "website", true);
    setMeta("og:url", "https://hire-in.com/it-staffing", true);
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.setAttribute("rel", "canonical"); document.head.appendChild(canonical); }
    canonical.setAttribute("href", "https://hire-in.com/it-staffing");
    return () => { document.title = "Hire'in Solutions"; document.querySelector('link[rel="canonical"]')?.remove(); };
  }, []);

  const goTo = useCallback((idx: number) => setCurrentSlide(Math.max(0, Math.min(TOTAL_SLIDES - 1, idx))), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(currentSlide - 1);
      else if (e.key === "ArrowRight") goTo(currentSlide + 1);
      else if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentSlide, isFullscreen, goTo]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) { viewerRef.current?.requestFullscreen?.(); setIsFullscreen(true); }
    else { document.exitFullscreen?.(); setIsFullscreen(false); }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleDownloadPDF = async () => {
    setPdfProgress(0);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1920, 1080] });
      for (let i = 0; i < TOTAL_SLIDES; i++) {
        setPdfProgress(Math.round((i / TOTAL_SLIDES) * 100));
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 350));
        const el = slideContainerRef.current;
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 1920, 1080);
      }
      pdf.save("HireIn_Solutions_IT_Staffing_Deck.pdf");
    } catch (err) { console.error("PDF generation failed:", err); }
    finally { setPdfProgress(null); }
  };

  const handleDownloadPPT = async () => {
    setPptProgress(0);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const pptxgen = (await import("pptxgenjs")).default;
      const pptx = new pptxgen();
      pptx.layout = "LAYOUT_WIDE";
      for (let i = 0; i < TOTAL_SLIDES; i++) {
        setPptProgress(Math.round((i / TOTAL_SLIDES) * 100));
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 350));
        const el = slideContainerRef.current;
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
        const slide = pptx.addSlide();
        slide.addImage({ data: canvas.toDataURL("image/png"), x: 0, y: 0, w: "100%", h: "100%" });
      }
      await pptx.writeFile({ fileName: "HireIn_Solutions_IT_Staffing_Deck.pptx" });
    } catch (err) { console.error("PPT generation failed:", err); }
    finally { setPptProgress(null); }
  };

  const isDownloading = pdfProgress !== null || pptProgress !== null;
  const slide = IT_SLIDES[currentSlide];

  return (
    <Layout>
      <SchemaHead schema={SERVICE_SCHEMA} />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-foreground via-foreground/95 to-primary/30 py-20 md:py-28 px-4" data-testid="section-it-staffing-hero">
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute top-10 left-[10%] w-60 h-60 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-[15%] w-80 h-80 bg-primary/60 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 container mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white/70 tracking-wider uppercase mb-6" data-testid="badge-it-staffing-brand">
            <Brain className="h-3 w-3 text-primary" />
            AI-Powered IT Recruitment
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-[1.1] tracking-tight" data-testid="text-it-staffing-headline">
            US IT Staffing,{" "}<span className="text-primary">Powered by AI</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-3 font-medium max-w-2xl mx-auto">
            The Right Tech Talent, Right Now — 500+ successful IT talent engagements, 24-hour first submissions, and 95% client retention.
          </p>
          <p className="text-sm text-white/50 max-w-xl mx-auto mb-8">
            Hire'in Solutions delivers elite IT talent across all 50 US states, leveraging proprietary AI tools to match, screen, and place faster than any traditional staffing firm.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" onClick={() => document.getElementById("deck-viewer")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-view-deck">
              View Deck <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="bg-white/5 text-white border-white/15 backdrop-blur-sm" asChild data-testid="button-contact-hero">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="py-5 px-4 border-b bg-muted/40" data-testid="section-it-staffing-stats">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { value: "500+", label: "IT Placements" },
              { value: "24 hrs", label: "First Submissions" },
              { value: "95%", label: "Client Retention" },
              { value: "50", label: "US States" },
              { value: "25K+", label: "Candidate Pool" },
              { value: "92%", label: "AI Match Rate" },
            ].map((s) => (
              <div key={s.label} className="text-center py-2" data-testid={`stat-it-${s.label.toLowerCase().replace(/\s/g, "-")}`}>
                <p className="text-xl md:text-2xl font-bold text-primary leading-none mb-0.5">{s.value}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTERACTIVE SLIDE VIEWER */}
      <section id="deck-viewer" className="py-12 md:py-16 px-4" data-testid="section-it-staffing-viewer">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-px bg-primary" />
            <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Interactive Deck</p>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6 tracking-tight">IT Staffing Presentation</h2>

          <div ref={viewerRef} className={`relative bg-muted/30 rounded-xl border overflow-hidden ${isFullscreen ? "fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center rounded-none border-none" : ""}`} data-testid="deck-viewer-container">
            <div className={`relative w-full ${isFullscreen ? "max-w-[90vw] max-h-[85vh]" : ""}`}>
              <div ref={slideContainerRef} className="w-full">
                <TypedSlideRenderer
                  slide={slide}
                  ctx={{ slideNumber: currentSlide + 1, totalSlides: TOTAL_SLIDES, deckLabel: DECK_LABEL }}
                />
              </div>
            </div>

            <div className={`flex items-center justify-between px-4 py-3 ${isFullscreen ? "absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm" : "border-t bg-card"}`}>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => goTo(currentSlide - 1)} disabled={currentSlide === 0 || isDownloading} data-testid="button-slide-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className={`text-sm font-medium tabular-nums min-w-[60px] text-center ${isFullscreen ? "text-white" : ""}`} data-testid="text-slide-counter">
                  {currentSlide + 1} / {TOTAL_SLIDES}
                </span>
                <Button variant="outline" size="sm" onClick={() => goTo(currentSlide + 1)} disabled={currentSlide === TOTAL_SLIDES - 1 || isDownloading} data-testid="button-slide-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={toggleFullscreen} className={isFullscreen ? "text-white hover:text-white/80" : ""} data-testid="button-fullscreen">
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Slide thumbnail strip */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin" data-testid="slide-thumbnails">
            {IT_SLIDES.map((s, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                disabled={isDownloading}
                className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  i === currentSlide ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`button-slide-thumb-${i + 1}`}
              >
                {i + 1}. {s.slide_type.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* DOWNLOAD SECTION */}
      <section className="py-12 md:py-16 px-4 bg-muted/30" data-testid="section-it-staffing-download">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-8 h-px bg-primary" />
            <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Download</p>
            <div className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">Get the Full Deck</h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-lg mx-auto">
            Download the complete IT Staffing presentation in your preferred format.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" onClick={handleDownloadPDF} disabled={isDownloading} className="min-w-[180px]" data-testid="button-download-pdf">
              {pdfProgress !== null ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating... {pdfProgress}%</> : <><Download className="mr-2 h-4 w-4" />Download PDF</>}
            </Button>
            <Button size="lg" variant="outline" onClick={handleDownloadPPT} disabled={isDownloading} className="min-w-[180px]" data-testid="button-download-ppt">
              {pptProgress !== null ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating... {pptProgress}%</> : <><Download className="mr-2 h-4 w-4" />Download PPT</>}
            </Button>
          </div>
          {isDownloading && <p className="text-xs text-muted-foreground mt-4">Please wait while slides are being rendered.</p>}
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="py-12 md:py-16 px-4" data-testid="section-it-staffing-highlights">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Brain, title: "AI-Powered Matching", desc: "92% match accuracy using proprietary Kleriq AI for resume parsing, job matching, and candidate scoring." },
              { icon: Zap, title: "24-Hour Submissions", desc: "Qualified candidate profiles delivered within 24 hours for most IT roles — the fastest in the industry." },
              { icon: Shield, title: "Compliance-First", desc: "Built-in I-9 verification, E-Verify, background checks, and federal/state employment law compliance." },
              { icon: Code2, title: "IT Domain Experts", desc: "60+ domain-specialist recruiters fluent in your tech stack — from Java to Kubernetes, React to SAP." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 rounded-xl border bg-card" data-testid={`card-highlight-${title.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-3"><Icon className="h-5 w-5 text-primary" /></div>
                <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FOOTER */}
      <section className="py-16 md:py-20 px-4 bg-gradient-to-br from-foreground via-foreground/95 to-primary/30" data-testid="section-it-staffing-cta">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white/70 tracking-wider uppercase mb-6">
            <Users className="h-3 w-3 text-primary" />
            Ready to Hire Smarter?
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            Let&apos;s Build Your <span className="text-primary">Dream Team</span>
          </h2>
          <p className="text-white/60 mb-8 max-w-lg mx-auto">
            Whether you need a single developer or an entire IT team, our AI-powered recruitment platform delivers pre-vetted talent faster than anyone else.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" asChild data-testid="button-cta-contact">
              <Link href="/contact">Schedule a Consultation <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/5 text-white border-white/15 backdrop-blur-sm" asChild data-testid="button-cta-call">
              <a href={`tel:${CONTACT.phones.it}`}>Call {CONTACT.phones.it}</a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
