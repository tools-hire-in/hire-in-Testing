import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  FileCheck,
  Globe,
  Handshake,
  Heart,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Minimize2,
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
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { Button } from "@/components/ui/button";
import { TypedSlideRenderer } from "@/components/deck/TypedSlideRenderer";
import type { TypedSlide } from "@/components/deck/ITSlideLayouts";
import { CONTACT } from "@/lib/constants";

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Healthcare Staffing Services",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "Healthcare Staffing",
  description: "AI-powered healthcare staffing with Joint Commission-aligned workflows. Travel nursing, locum tenens, allied health, and clinical recruitment across all 50 US states.",
  areaServed: { "@type": "Country", name: "United States" },
};

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";

const HC_SLIDES: TypedSlide[] = [
  {
    slide_type: "cover",
    badge: "AI + COMPLIANCE STAFFING",
    title: "Hire'in Solutions — US Healthcare Staffing · AI + Compliance",
    subtitle: "Compliance-Verified Clinical Talent, Placed Faster",
    tagline: "Compliance-Verified Clinical Talent. Everywhere You Need Them.",
    stats: [
      { value: "500+", label: "Healthcare Placements" },
      { value: "24–48 hr", label: "Compliant Submissions" },
      { value: "100%", label: "Compliance Rate" },
    ],
    right_icons: [
      { icon: ShieldCheck, label: "proKred.com Compliance" },
      { icon: Stethoscope, label: "Clinical Specialists" },
      { icon: BadgeCheck, label: "TJC-Aligned" },
      { icon: Globe, label: "All 50 States" },
    ],
  },
  {
    slide_type: "stats",
    title: "By the Numbers",
    metrics: [
      { value: "500+", label: "Healthcare Roles Placed", sub: "RNs, LPNs, allied health, physicians" },
      { value: "24–48 hrs", label: "Compliant Submission", sub: "From engagement to credentialed packet" },
      { value: "100%", label: "Compliance Rate", sub: "proKred.com verifies every credential" },
      { value: "50 States", label: "US Coverage", sub: "Travel nursing and locum coverage" },
      { value: "TJC", label: "JC-Aligned Workflows", sub: "Joint Commission standards built-in" },
      { value: "95%+", label: "Client Retention", sub: "Year-over-year healthcare partnership" },
    ],
  },
  {
    slide_type: "about",
    title: "About Us",
    mission_label: "Our Mission",
    mission_text: "Est. 2014 · Dedicated healthcare staffing division. We place compliance-verified clinical professionals across all 50 US states with Joint Commission-aligned workflows and compliant submission packages via proKred.com.",
    navy_block_label: "proKred.com Family",
    navy_block_text: "proKred.com is Hire'in Solutions' purpose-built healthcare compliance platform — automating public-directory license checks, compiling audit-ready submission packets, and enabling secure credential sharing for facilities, MSPs, and staffing agencies.",
    right_items: [
      { icon: ShieldCheck, title: "proKred.com Compliance", sub: "Purpose-built credential & compliance platform" },
      { icon: Stethoscope, title: "Clinical Specialists", sub: "Specialty-trained healthcare recruiters" },
      { icon: Brain, title: "KleriQ.ai Matching", sub: "AI-powered clinical candidate scoring" },
      { icon: MapPin, title: "All 50 US States", sub: "Travel nursing and locum nationwide" },
    ],
  },
  {
    slide_type: "services",
    title: "Healthcare Staffing Services",
    cards: [
      {
        icon: Heart,
        icon_bg: NAVY,
        title: "Travel Nursing",
        description: "Nationwide travel RN placements with fully credentialed, JC-aligned submission packets ready for any MSP or VMS.",
        checks: ["Fully credentialed submission packets", "JC-aligned from day one", "MSP/VMS-ready documentation"],
      },
      {
        icon: Stethoscope,
        icon_bg: ORANGE,
        title: "Locum Tenens",
        description: "Physician and advanced practice provider placements across all specialties with DEA, licensure, and CME verification included.",
        checks: ["DEA & state licensure verified", "All physician specialties", "CME and malpractice confirmed"],
      },
      {
        icon: UserCheck,
        icon_bg: NAVY,
        title: "Allied Health",
        description: "Physical therapists, OTs, respiratory therapists, and radiology professionals placed with complete compliance documentation.",
        checks: ["PT, OT, SLP, Radiology covered", "Specialty skill checklists", "Public-directory exclusion checks"],
      },
      {
        icon: Shield,
        icon_bg: ORANGE,
        title: "Healthcare RPO",
        description: "End-to-end managed recruitment for health systems — SLA-backed delivery with dedicated clinical talent desk.",
        checks: ["SLA-backed talent delivery", "Dedicated clinical talent desk", "HIPAA-ready workflows"],
      },
    ],
  },
  {
    slide_type: "comparison_table",
    title: "Staffing Models",
    columns: ["Travel", "Locum", "Allied", "RPO"],
    rows: [
      { label: "Engagement Type", checks: [true, true, true, true] },
      { label: "Credentialing Included", checks: [true, true, true, true] },
      { label: "JC-Aligned Workflow", checks: [true, true, true, true] },
      { label: "MSP/VMS Ready", checks: [true, true, true, true] },
    ],
    banner: "All models include proKred.com compliance packets — ensuring TJC-aligned, audit-ready credential submission for every clinical placement.",
  },
  {
    slide_type: "feature_grid",
    badge: "COMPLIANCE-FIRST HIRING",
    title: "AI + Compliance Tools We Leverage",
    subtitle: "proKred.com for compliance, KleriQ.ai for clinical matching",
    cells: [
      { icon: FileCheck, title: "Credential Collection", desc: "proKred.com automates collection of licenses, certifications, and skill checklists from clinicians." },
      { icon: Search, title: "Public-Directory Checks", desc: "Automated OIG/SAM exclusion, state board, and NPI registry checks on every candidate." },
      { icon: ShieldCheck, title: "Compliant Submission Packets", desc: "Every submission is a fully organized, audit-ready packet — not just a resume." },
      { icon: Brain, title: "KleriQ.ai Clinical Matching", desc: "AI scores clinical candidates by specialty, acuity, EMR proficiency, and recency." },
      { icon: Heart, title: "Gold-Standard Skill Checklists", desc: "EMR-specific checklists weighted by recency and clinical proficiency for precise matching." },
      { icon: BadgeCheck, title: "Why Compliance-First Wins", desc: "100% compliance rate. Zero audit failures. MSP-ready in 24–48 hours. Built for the toughest healthcare programs." },
    ],
  },
  {
    slide_type: "why_us",
    title: "Why Hire'in Healthcare",
    cards: [
      { icon: ShieldCheck, title: "Compliance-First", description: "Joint Commission-aligned workflows and proKred.com compliance packets built into every placement — not an afterthought.", badge: "100% Compliance Rate" },
      { icon: Stethoscope, title: "Clinical Specialists", description: "Specialty-trained recruiters for RN, LPN, CNA, allied health, physicians, and telehealth across every care setting.", badge: "60+ Clinical Recruiters" },
      { icon: Brain, title: "HIPAA-Ready", description: "Secure, traceable credential handling via proKred.com with HIPAA-ready data workflows throughout the credentialing process.", badge: "HIPAA-Ready Platform" },
      { icon: Zap, title: "Fastest Compliant Submission", description: "Fully credentialed, JC-aligned submission packet delivered within 24–48 hours — the fastest MSP-ready delivery in healthcare staffing.", badge: "First Packet in 24–48 hrs" },
    ],
  },
  {
    slide_type: "process_flow",
    title: "Sourcing Process",
    steps: [
      { icon: Search, name: "Intake", desc: "Map specialty, acuity, EMR, certifications, and compliance requirements" },
      { icon: Brain, name: "AI Sourcing", desc: "KleriQ.ai scores clinical candidates by specialty and proficiency", highlight: true, highlight_label: "AI-powered" },
      { icon: UserCheck, name: "Screening", desc: "Clinical recruiter confirms specialty fit and availability" },
      { icon: FileCheck, name: "Credentialing", desc: "proKred.com compiles JC-aligned compliant packet" },
      { icon: Handshake, name: "Submit", desc: "Full packet delivered within 24–48 hrs, MSP-ready" },
    ],
    banner: "The key sell is Step 4: proKred.com delivers a complete, compliant submission packet — not just a resume. MSP-ready from day one.",
  },
  {
    slide_type: "demand_flow",
    title: "Demand Fulfillment",
    steps: [
      { icon: FileCheck, name: "Demand", desc: "Clinical role received and triaged" },
      { icon: Search, name: "Review", desc: "JD parsed for specialty and compliance" },
      { icon: Star, name: "Priorities", desc: "Urgency and acuity ranked" },
      { icon: Users, name: "Allocation", desc: "Clinical recruiter assigned" },
      { icon: Brain, name: "Submissions", desc: "AI-matched profiles selected" },
      { icon: ShieldCheck, name: "Credentialing", desc: "proKred.com packet assembled" },
      { icon: Handshake, name: "Client", desc: "Compliant packet delivered" },
    ],
    metrics: [
      { value: "< 24 hrs", label: "Demand Acknowledgement" },
      { value: "24–48 hrs", label: "Compliant First Submission" },
      { value: "≥ 95%", label: "Submission Quality Score", orange: true },
      { value: "100%", label: "Compliance Coverage" },
    ],
  },
  {
    slide_type: "domain_matrix",
    title: "Clinical Domains",
    domains: [
      { icon: Heart, label: "RN / LPN" },
      { icon: UserCheck, label: "Allied Health" },
      { icon: Stethoscope, label: "Physician / Locum" },
      { icon: Brain, label: "Healthcare IT" },
      { icon: Briefcase, label: "Admin / Revenue" },
      { icon: Shield, label: "Long-Term Care" },
      { icon: Globe, label: "Home Health" },
    ],
    column_headers: ["Travel", "Locum", "Permanent", "RPO"],
  },
  {
    slide_type: "contact",
    tagline: "Compliance-Verified Clinical Talent, Placed Faster",
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

const TOTAL_SLIDES = HC_SLIDES.length;
const DECK_LABEL = "US Healthcare Staffing";

export default function EHealthcareStaffing() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const [pptProgress, setPptProgress] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Healthcare Staffing Services | Hire'in Solutions - AI + Compliance Healthcare Recruitment";
    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", "Hire'in Solutions Healthcare Staffing. Joint Commission-aligned workflows, verified documents & compliant submission packages via proKred.com. Clinical recruitment across all 50 US states.");
    setMeta("og:title", "Healthcare Staffing Services | Hire'in Solutions", true);
    setMeta("og:description", "AI-powered healthcare staffing with Joint Commission-aligned workflows and compliant submission packages via proKred.com.", true);
    setMeta("og:type", "website", true);
    setMeta("og:url", "https://hire-in.com/ehealthcare-staffing", true);
    setMeta("keywords", "healthcare staffing, travel nursing, locum tenens, allied health staffing, Joint Commission aligned, proKred, clinical recruitment");
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.setAttribute("rel", "canonical"); document.head.appendChild(canonical); }
    canonical.setAttribute("href", "https://hire-in.com/ehealthcare-staffing");
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
      pdf.save("HireIn_Solutions_Healthcare_Staffing_Deck.pdf");
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
      await pptx.writeFile({ fileName: "HireIn_Solutions_Healthcare_Staffing_Deck.pptx" });
    } catch (err) { console.error("PPT generation failed:", err); }
    finally { setPptProgress(null); }
  };

  const isDownloading = pdfProgress !== null || pptProgress !== null;
  const slide = HC_SLIDES[currentSlide];

  return (
    <Layout>
      <SchemaHead schema={SERVICE_SCHEMA} />

      <section className="relative overflow-hidden bg-gradient-to-br from-foreground via-foreground/95 to-primary/30 py-20 md:py-28 px-4" data-testid="section-hc-staffing-hero">
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute top-10 left-[10%] w-60 h-60 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-[15%] w-80 h-80 bg-primary/60 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 container mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white/70 tracking-wider uppercase mb-6" data-testid="badge-hc-staffing-brand">
            <Stethoscope className="h-3 w-3 text-primary" />
            AI + Compliance Healthcare Staffing
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-[1.1] tracking-tight" data-testid="text-hc-staffing-headline">
            US Healthcare Staffing,{" "}<span className="text-primary">AI + Compliance</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-3 font-medium max-w-2xl mx-auto">
            We place compliance-verified clinical professionals in all 50 US states with Joint Commission-aligned workflows and compliant submission packages.
          </p>
          <p className="text-sm text-white/50 max-w-xl mx-auto mb-8">
            Hire'in Solutions delivers compliance-verified clinical professionals across all 50 US states, leveraging proKred.com for compliant submission packets with public-directory license checks.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" onClick={() => document.getElementById("hc-deck-viewer")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-hc-view-deck">
              View Deck <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="bg-white/5 text-white border-white/15 backdrop-blur-sm" asChild data-testid="button-hc-contact-hero">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-5 px-4 border-b bg-muted/40" data-testid="section-hc-staffing-stats">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { value: "500+", label: "Healthcare Roles" },
              { value: "100%", label: "Compliance Rate" },
              { value: "50", label: "US States" },
              { value: "TJC", label: "JC-Aligned" },
              { value: "24–48 hr", label: "Compliant Packets" },
              { value: "95%+", label: "Client Retention" },
            ].map((s) => (
              <div key={s.label} className="text-center py-2" data-testid={`stat-hc-${s.label.toLowerCase().replace(/\s/g, "-")}`}>
                <p className="text-xl md:text-2xl font-bold text-primary leading-none mb-0.5">{s.value}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="hc-deck-viewer" className="py-12 md:py-16 px-4" data-testid="section-hc-staffing-viewer">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-px bg-primary" />
            <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Interactive Deck</p>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6 tracking-tight">Healthcare Staffing Presentation</h2>

          <div ref={viewerRef} className={`relative bg-muted/30 rounded-xl border overflow-hidden ${isFullscreen ? "fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center rounded-none border-none" : ""}`} data-testid="hc-deck-viewer-container">
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
                <Button variant="outline" size="sm" onClick={() => goTo(currentSlide - 1)} disabled={currentSlide === 0 || isDownloading} data-testid="button-hc-slide-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className={`text-sm font-medium tabular-nums min-w-[60px] text-center ${isFullscreen ? "text-white" : ""}`} data-testid="text-hc-slide-counter">
                  {currentSlide + 1} / {TOTAL_SLIDES}
                </span>
                <Button variant="outline" size="sm" onClick={() => goTo(currentSlide + 1)} disabled={currentSlide === TOTAL_SLIDES - 1 || isDownloading} data-testid="button-hc-slide-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={toggleFullscreen} className={isFullscreen ? "text-white hover:text-white/80" : ""} data-testid="button-hc-fullscreen">
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin" data-testid="hc-slide-thumbnails">
            {HC_SLIDES.map((s, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                disabled={isDownloading}
                className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  i === currentSlide ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`button-hc-slide-thumb-${i + 1}`}
              >
                {i + 1}. {s.slide_type.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 px-4 bg-muted/30" data-testid="section-hc-staffing-download">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-8 h-px bg-primary" />
            <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Download</p>
            <div className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">Get the Full Deck</h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-lg mx-auto">
            Download the complete Healthcare Staffing presentation in your preferred format.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" onClick={handleDownloadPDF} disabled={isDownloading} className="min-w-[180px]" data-testid="button-hc-download-pdf">
              {pdfProgress !== null ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating... {pdfProgress}%</> : <><Download className="mr-2 h-4 w-4" />Download PDF</>}
            </Button>
            <Button size="lg" variant="outline" onClick={handleDownloadPPT} disabled={isDownloading} className="min-w-[180px]" data-testid="button-hc-download-ppt">
              {pptProgress !== null ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating... {pptProgress}%</> : <><Download className="mr-2 h-4 w-4" />Download PPT</>}
            </Button>
          </div>
          {isDownloading && <p className="text-xs text-muted-foreground mt-4">Please wait while slides are being rendered.</p>}
        </div>
      </section>

      <section className="py-12 md:py-16 px-4" data-testid="section-hc-staffing-highlights">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ShieldCheck, title: "Joint Commission-Aligned", desc: "Our compliance workflows are built around TJC standards, with proKred.com organizing credentials into audit-ready submission packets from day one." },
              { icon: Zap, title: "Compliant Submission Packets", desc: "proKred.com automates license and exclusion checks against public government directories and compiles compliant submission packets faster than traditional firms." },
              { icon: Heart, title: "Clinical Domain Experts", desc: "Specialty-trained recruiters for RN, LPN, CNA, allied health, physicians, and telehealth professionals." },
              { icon: Stethoscope, title: "Healthcare-Only Focus", desc: "Dedicated healthcare staffing division with deep clinical recruitment expertise across all care settings." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 rounded-xl border bg-card" data-testid={`card-hc-highlight-${title.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-3"><Icon className="h-5 w-5 text-primary" /></div>
                <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-4 bg-gradient-to-br from-foreground via-foreground/95 to-primary/30" data-testid="section-hc-staffing-cta">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white/70 tracking-wider uppercase mb-6">
            <Users className="h-3 w-3 text-primary" />
            Ready to Staff Smarter?
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            Let&apos;s Build Your <span className="text-primary">Clinical Team</span>
          </h2>
          <p className="text-white/60 mb-8 max-w-lg mx-auto">
            Whether you need travel nurses, locum tenens physicians, or a full allied health team, our AI-powered platform delivers verified documents and compliant submission packages for every placement.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" asChild data-testid="button-hc-cta-contact">
              <Link href="/contact">Schedule a Consultation <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/5 text-white border-white/15 backdrop-blur-sm" asChild data-testid="button-hc-cta-call">
              <a href={`tel:${CONTACT.phones.healthcare}`}>Call {CONTACT.phones.healthcare}</a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
