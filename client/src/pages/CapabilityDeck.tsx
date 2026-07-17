import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  Brain,
  Briefcase,
  Building2,
  BadgeCheck,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code,
  Cpu,
  Download,
  Expand,
  Factory,
  FileCheck,
  Globe,
  Handshake,
  Landmark,
  Layers,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Minimize2,
  PhoneCall,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  Stethoscope,
  Shield,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COMPANY, CONTACT, METRICS } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import { BrandedSlideShell } from "@/components/deck/BrandedSlideShell";

interface MasterDeckSlide { title: string; bullets: string[]; speaker_notes: string; }
interface MasterDeck { id: string; title: string; slides: MasterDeckSlide[]; }

const CLIENT_LOGOS = [
  { name: "22nd Century", industry: "Technology" },
  { name: "Wipro", industry: "IT Services" },
  { name: "TCS", industry: "IT Services" },
  { name: "Accenture", industry: "Consulting" },
  { name: "Wells Fargo", industry: "Banking" },
  { name: "Walmart", industry: "Retail" },
  { name: "Abbott", industry: "Healthcare" },
  { name: "Bentley", industry: "Engineering" },
  { name: "RC4Vet", industry: "Healthcare" },
  { name: "HonerVet", industry: "Healthcare" },
  { name: "HWL", industry: "Staffing" },
  { name: "AYA", industry: "Healthcare" },
  { name: "NYCHH", industry: "Healthcare" },
];

const INDUSTRIES = [
  { icon: Stethoscope, name: "Healthcare", desc: "Hospitals, clinics, telehealth" },
  { icon: Cpu, name: "Information Technology", desc: "Software, cloud, cyber" },
  { icon: Factory, name: "Engineering", desc: "Industrial, mechanical, civil" },
  { icon: Landmark, name: "Finance & Banking", desc: "Financial services, risk" },
  { icon: ShoppingCart, name: "Retail & E-Commerce", desc: "Operations, logistics" },
  { icon: Building2, name: "Professional Services", desc: "Consulting, legal, HR" },
];

const TECH_TOOLS = [
  {
    name: "KlerHire AI",
    tagline: "AI-Powered Hiring Intelligence",
    description: "Best-in-class AI platform with AI Booster for recruiters to deeply understand requirements and perform intelligent resume matching — ensuring only the most qualified candidates make the shortlist.",
    features: ["AI Booster for Recruiters", "Smart Resume Matching", "Requirement Analysis", "Quality-First Shortlisting"],
    icon: Brain,
    accent: "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent",
    badgeColor: "bg-primary/10 text-primary",
  },
  {
    name: "proKred.com",
    tagline: "Compliance Packets & Skill Checklists",
    description: "Purpose-built compliance submission packet, credential sharing, and skill checklist tool — with automated license and exclusion checks against public government directories and gold-standard skill checklists covering EMR systems, weighted by recency and proficiency.",
    features: ["Compliant Submission Packets", "Secure Credential Sharing", "Public-Directory License & Exclusion Checks", "Gold-Standard Skill Checklists"],
    icon: Shield,
    accent: "border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent",
    badgeColor: "bg-green-500/10 text-green-700 dark:text-green-400",
  },
  {
    name: "Ceipal ATS",
    tagline: "Enterprise Applicant Tracking",
    description: "Fully integrated with Ceipal's enterprise ATS for seamless job posting synchronization, candidate management, and end-to-end recruitment workflow automation.",
    features: ["Bidirectional Job Sync", "Automated Candidate Push", "Workflow Automation", "Enterprise Tracking"],
    icon: Layers,
    accent: "border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent",
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
];

const PROCESS_STEPS = [
  { step: "01", title: "Discovery", description: "Deep-dive into requirements, culture, and goals. AI Booster creates intelligent candidate profiles.", icon: Search },
  { step: "02", title: "AI Sourcing", description: "KlerHire AI matches candidates by fit, skills, and experience with 90%+ accuracy.", icon: Brain },
  { step: "03", title: "Validation", description: "Expert recruiters assess cultural fit, soft skills, and career alignment.", icon: UserCheck },
  { step: "04", title: "Credentials", description: "Our compliance team verifies each candidate; proKred.com compiles the results into a compliant, audit-ready submission packet.", icon: FileCheck },
  { step: "05", title: "Placement", description: "Pre-vetted candidates delivered with complete documentation, ready for onboarding.", icon: Handshake },
];

const DIFFERENTIATORS = [
  { icon: Sparkles, title: "Tech-Forward DNA", description: "Born from a software company — we build like technologists, not just staffing firms." },
  { icon: Brain, title: "Best-in-Class AI Tools", description: "KlerHire and proKred.com give us capabilities no traditional agency can match." },
  { icon: Clock, title: "50% Faster Placements", description: "AI pre-screening cuts time-to-hire in half while improving quality." },
  { icon: Shield, title: "100% Compliance", description: "Zero-compromise credential verification for every placement." },
  { icon: Globe, title: "10+ Years of Excellence", description: "Backed by Rayomind with over a decade of technology expertise." },
  { icon: TrendingUp, title: "95% Client Retention", description: "Clients stay because we consistently deliver quality talent." },
];

export default function CapabilityDeck() {
  const deckRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const [pptProgress, setPptProgress] = useState<number | null>(null);

  const { data: masterDeck } = useQuery<MasterDeck>({
    queryKey: ["/api/bd/decks/master/general"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const dbSlides = masterDeck?.slides ?? [];
  const totalSlides = dbSlides.length || 11;

  useSEO({
    title: "Capability Deck | Hire'in Solutions - AI-Powered Recruitment",
    description:
      "Hire'in Solutions general capability deck — AI-powered staffing across Healthcare, IT, Engineering & Professional Services. Backed by Rayomind (est. 2014). View our interactive deck and download PDF/PPT.",
    canonical: "https://hire-in.com/capability-deck",
    noindex: true,
  });

  const goTo = useCallback((idx: number) => {
    setCurrentSlide(Math.max(0, Math.min(totalSlides - 1, idx)));
  }, [totalSlides]);

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
      for (let i = 0; i < totalSlides; i++) {
        setPdfProgress(Math.round((i / totalSlides) * 100));
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 300));
        const el = slideContainerRef.current;
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, 1920, 1080);
      }
      pdf.save("HireIn_Solutions_Capability_Deck.pdf");
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
      for (let i = 0; i < totalSlides; i++) {
        setPptProgress(Math.round((i / totalSlides) * 100));
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 300));
        const el = slideContainerRef.current;
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
        const imgData = canvas.toDataURL("image/png");
        const slide = pptx.addSlide();
        slide.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%" });
      }
      await pptx.writeFile({ fileName: "HireIn_Solutions_Capability_Deck.pptx" });
    } catch (err) { console.error("PPT generation failed:", err); }
    finally { setPptProgress(null); }
  };

  const isDownloading = pdfProgress !== null || pptProgress !== null;
  const slide = dbSlides[currentSlide];

  return (
    <Layout hideFooter>
      <div ref={deckRef} className="capability-deck">

        {/* HERO */}
        <section className="relative flex items-center justify-center px-4 py-16 md:py-20 overflow-hidden bg-gradient-to-br from-foreground via-foreground/95 to-primary/30" data-testid="section-deck-hero">
          <div className="absolute inset-0 opacity-[0.07]">
            <div className="absolute top-10 left-[10%] w-60 h-60 bg-primary rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-[10%] w-80 h-80 bg-primary/60 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full" />
          </div>
          <div className="relative z-10 container mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white/70 tracking-wider uppercase mb-5" data-testid="badge-deck-brand">
              <Zap className="h-3 w-3 text-primary" />
              {COMPANY.brandLine}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-[1.1] tracking-tight" data-testid="text-deck-title">
              {COMPANY.name}
            </h1>
            <p className="text-lg md:text-xl text-white/70 mb-2 font-medium">
              {COMPANY.tagline}
            </p>
            <p className="text-sm text-white/50 max-w-xl mx-auto mb-8">
              A tech-forward startup under Rayomind, purpose-built to transform
              the hiring landscape with AI-powered recruitment and human expertise.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button size="lg" onClick={() => document.getElementById("deck-viewer")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-view-deck">
                View Deck <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="bg-white/5 text-white border-white/15 backdrop-blur-sm" asChild data-testid="button-deck-contact">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* STATS RIBBON */}
        <section className="py-5 px-4 border-b bg-muted/40" data-testid="section-deck-stats-ribbon">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { value: "10+", label: "Years" },
                { value: "95%", label: "Retention" },
                { value: "90%", label: "AI Accuracy" },
                { value: "50%", label: "Faster" },
                { value: "100%", label: "Compliance" },
                { value: "98%", label: "Satisfaction" },
              ].map((s) => (
                <div key={s.label} className="text-center py-1" data-testid={`stat-ribbon-${s.label.toLowerCase()}`}>
                  <p className="text-xl md:text-2xl font-bold text-primary leading-none mb-0.5">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INTERACTIVE SLIDE VIEWER */}
        <section id="deck-viewer" className="py-12 md:py-16 px-4" data-testid="section-deck-viewer">
          <div className="container mx-auto max-w-5xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-px bg-primary" />
              <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Interactive Deck</p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6 tracking-tight">General Capability Presentation</h2>

            <div ref={viewerRef} className={`relative bg-muted/30 rounded-xl border overflow-hidden ${isFullscreen ? "fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center rounded-none border-none" : ""}`} data-testid="deck-viewer-container">
              <div className={`relative w-full ${isFullscreen ? "max-w-[90vw] max-h-[85vh]" : ""}`}>
                <div ref={slideContainerRef} className="w-full">
                  {slide ? (
                    <BrandedSlideShell
                      slideTitle={slide.title}
                      bullets={slide.bullets ?? []}
                      slideNumber={currentSlide + 1}
                      totalSlides={totalSlides}
                      domain="general"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-muted/40 flex items-center justify-center rounded-md">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              <div className={`flex items-center justify-between px-4 py-3 ${isFullscreen ? "absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm" : "border-t bg-card"}`}>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => goTo(currentSlide - 1)} disabled={currentSlide === 0 || isDownloading} data-testid="button-slide-prev">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className={`text-sm font-medium tabular-nums min-w-[60px] text-center ${isFullscreen ? "text-white" : ""}`} data-testid="text-slide-counter">
                    {currentSlide + 1} / {totalSlides}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => goTo(currentSlide + 1)} disabled={currentSlide === totalSlides - 1 || isDownloading} data-testid="button-slide-next">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs hidden sm:inline ${isFullscreen ? "text-white/60" : "text-muted-foreground"}`}>
                    {slide?.title ?? ""}
                  </span>
                  <Button variant="ghost" size="sm" onClick={toggleFullscreen} className={isFullscreen ? "text-white hover:text-white/80" : ""} data-testid="button-fullscreen">
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin" data-testid="slide-thumbnails">
              {dbSlides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  disabled={isDownloading}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    i === currentSlide ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`button-slide-thumb-${i + 1}`}
                >
                  {i + 1}. {s.title}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* DOWNLOAD SECTION */}
        <section className="py-12 md:py-16 px-4 bg-muted/30" data-testid="section-deck-download">
          <div className="container mx-auto max-w-3xl text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-8 h-px bg-primary" />
              <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Download</p>
              <div className="w-8 h-px bg-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">Get the Full Deck</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-lg mx-auto">
              Download the complete capability presentation in your preferred format. Share with stakeholders, review offline, or use in your own presentations.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button size="lg" onClick={handleDownloadPDF} disabled={isDownloading} className="min-w-[180px]" data-testid="button-download-pdf">
                {pdfProgress !== null ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating... {pdfProgress}%</>
                ) : (
                  <><Download className="mr-2 h-4 w-4" />Download PDF</>
                )}
              </Button>
              <Button size="lg" variant="outline" onClick={handleDownloadPPT} disabled={isDownloading} className="min-w-[180px]" data-testid="button-download-ppt">
                {pptProgress !== null ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating... {pptProgress}%</>
                ) : (
                  <><Download className="mr-2 h-4 w-4" />Download PPT</>
                )}
              </Button>
            </div>
            {isDownloading && (
              <p className="text-xs text-muted-foreground mt-4">Please wait while slides are being rendered. This may take a moment.</p>
            )}
          </div>
        </section>

        {/* COMPANY OVERVIEW */}
        <section className="py-12 px-4 lg:px-6" data-testid="section-deck-overview">
          <div className="container mx-auto max-w-5xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-px bg-primary" />
              <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Who We Are</p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-5 tracking-tight">Changing the Hiring Landscape</h2>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">{COMPANY.name}</strong> was established as a tech-forward startup under <strong className="text-foreground">Rayomind</strong> (est. 2014) with a singular mission: to revolutionize recruitment by merging cutting-edge AI technology with genuine human understanding.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  With over a decade of technology expertise as our foundation, we don't just fill positions — we engineer perfect matches. We leverage best-in-class AI tools like KlerHire AI and proKred.com for capabilities that traditional staffing firms simply cannot replicate.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We specialize in Healthcare, IT, Engineering, and Professional Services — serving clients from Fortune 500 companies to innovative startups across the United States.
                </p>
              </div>
              <div className="lg:col-span-2 grid grid-cols-2 gap-3">
                {[
                  { value: METRICS.yearsInBusiness, label: "Years", icon: Building2 },
                  { value: METRICS.clientRetention, label: "Retention", icon: TrendingUp },
                  { value: METRICS.aiAccuracy, label: "AI Accuracy", icon: Target },
                  { value: METRICS.clientSatisfaction, label: "Satisfaction", icon: Star },
                ].map((stat) => (
                  <Card key={stat.label} className="text-center" data-testid={`card-stat-${stat.label.toLowerCase()}`}>
                    <CardContent className="p-4">
                      <stat.icon className="h-4 w-4 text-primary mx-auto mb-2" />
                      <p className="text-2xl font-bold text-primary leading-none mb-0.5">{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section className="py-12 px-4 lg:px-6 bg-muted/30" data-testid="section-deck-services">
          <div className="container mx-auto max-w-5xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-px bg-primary" />
              <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">What We Do</p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight">Services & Specializations</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xl">Comprehensive talent solutions powered by AI and delivered with a human touch.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  icon: Stethoscope, title: "Healthcare Recruitment", highlight: true,
                  desc: "End-to-end for hospitals, clinics, telehealth. Credentialing & compliance handled.",
                  items: ["Physicians & Surgeons", "Registered Nurses", "Allied Health", "Telehealth"],
                },
                {
                  icon: Code, title: "IT & Software", highlight: false,
                  desc: "Full-spectrum technology hiring from architects to junior developers.",
                  items: ["Software Engineers", "DevOps & Cloud", "Data Scientists", "Cybersecurity"],
                },
                {
                  icon: Factory, title: "Engineering & Technical", highlight: false,
                  desc: "Skilled professionals across industrial, mechanical, and civil engineering.",
                  items: ["Mechanical", "Civil", "Industrial", "Project Managers"],
                },
                {
                  icon: Briefcase, title: "Professional Services", highlight: false,
                  desc: "Finance, marketing, ops, and administrative talent for critical functions.",
                  items: ["Finance", "Marketing & Ops", "HR", "Executive Search"],
                },
              ].map((s) => (
                <Card key={s.title} className={s.highlight ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent" : ""} data-testid={`card-service-${s.title.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-md bg-primary/10">
                        <s.icon className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-sm">{s.title}</h3>
                      {s.highlight && <Badge variant="secondary" className="text-[10px] ml-auto">Priority</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{s.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.items.map((item) => (
                        <span key={item} className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{item}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-3" data-testid="card-service-contract-staffing">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">Contract & Flexible Staffing</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["Contract Staffing", "Contract-to-Hire", "Direct Placement"].map((m) => (
                    <div key={m} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle className="h-3 w-3 text-primary shrink-0" />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* INDUSTRIES + PROCESS - side by side */}
        <section className="py-12 px-4 lg:px-6" data-testid="section-deck-industries">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-px bg-primary" />
                  <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Industries</p>
                </div>
                <h2 className="text-2xl font-bold mb-4 tracking-tight">Industries We Serve</h2>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRIES.map((ind) => (
                    <div key={ind.name} className="flex items-center gap-3 p-3 rounded-md border bg-card" data-testid={`card-industry-${ind.name.toLowerCase().replace(/\s/g, "-")}`}>
                      <div className="p-1.5 rounded-md bg-primary/10">
                        <ind.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold leading-tight">{ind.name}</p>
                        <p className="text-[10px] text-muted-foreground">{ind.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="section-deck-process">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-px bg-primary" />
                  <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">How We Work</p>
                </div>
                <h2 className="text-2xl font-bold mb-4 tracking-tight">Our Process</h2>
                <div className="space-y-2">
                  {PROCESS_STEPS.map((step, i) => (
                    <div key={step.step} className="flex items-start gap-3" data-testid={`step-process-${step.step}`}>
                      <div className="flex flex-col items-center shrink-0 pt-0.5">
                        <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                          {step.step}
                        </div>
                        {i < PROCESS_STEPS.length - 1 && <div className="w-px h-5 bg-border mt-1" />}
                      </div>
                      <div className="pb-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <step.icon className="h-3.5 w-3.5 text-primary" />
                          <h3 className="font-semibold text-sm">{step.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS DARK */}
        <section className="py-10 px-4 lg:px-6 bg-gradient-to-r from-foreground via-foreground/95 to-primary/20" data-testid="section-deck-stats">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { value: "10+", label: "Years in Business", sub: "Est. 2014" },
                { value: "95%", label: "Client Retention", sub: "Year over year" },
                { value: "90%", label: "AI Match Accuracy", sub: "KlerHire AI" },
                { value: "50%", label: "Faster Placements", sub: "vs Industry Avg" },
                { value: "100%", label: "Compliance Rate", sub: "Healthcare verified" },
                { value: "98%", label: "Satisfaction", sub: "Client surveys" },
              ].map((stat) => (
                <div key={stat.label} className="text-center py-2" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                  <p className="text-2xl md:text-3xl font-bold text-primary leading-none mb-1">{stat.value}</p>
                  <p className="text-white text-xs font-medium">{stat.label}</p>
                  <p className="text-white/40 text-[10px]">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CLIENTS */}
        <section className="py-10 px-4 lg:px-6 bg-muted/30" data-testid="section-deck-clients">
          <div className="container mx-auto max-w-5xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-px bg-primary" />
              <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Our Clients</p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-5 tracking-tight">Trusted by Industry Leaders</h2>

            <div className="flex flex-wrap gap-2">
              {CLIENT_LOGOS.map((client) => (
                <div key={client.name} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-card" data-testid={`card-client-${client.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <span className="text-sm font-semibold text-foreground/80">{client.name}</span>
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{client.industry}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">...and many more across Healthcare, IT, Engineering & Professional Services</p>
          </div>
        </section>

        {/* TECHNOLOGY */}
        <section className="py-12 px-4 lg:px-6" data-testid="section-deck-technology">
          <div className="container mx-auto max-w-5xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-px bg-primary" />
              <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Our Technology</p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight">Powered by Best-in-Class AI</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xl">We deploy the best AI tools available. KlerHire AI and proKred.com give us an unfair advantage in finding, matching, and placing top talent.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TECH_TOOLS.map((tool) => (
                <Card key={tool.name} className={`overflow-visible ${tool.accent}`} data-testid={`card-tech-${tool.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-md bg-background border">
                        <tool.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm leading-tight">{tool.name}</h3>
                        <p className="text-[10px] text-muted-foreground">{tool.tagline}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{tool.description}</p>
                    <div className="space-y-1.5">
                      {tool.features.map((f) => (
                        <div key={f} className="flex items-center gap-1.5 text-xs">
                          <CheckCircle className="h-3 w-3 text-primary shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* WHY CHOOSE */}
        <section className="py-12 px-4 lg:px-6 bg-muted/30" data-testid="section-deck-why">
          <div className="container mx-auto max-w-5xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-px bg-primary" />
              <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">The Edge</p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-5 tracking-tight">Why {COMPANY.name}</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {DIFFERENTIATORS.map((d) => (
                <Card key={d.title} data-testid={`card-diff-${d.title.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="p-4">
                    <div className="p-2 rounded-md bg-primary/10 w-fit mb-2">
                      <d.icon className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{d.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-4 p-4 rounded-md border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <div className="p-2.5 rounded-md bg-primary/10 shrink-0">
                <BadgeCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">Compliance & Credentialing Guarantee</h3>
                <p className="text-xs text-muted-foreground">Every healthcare placement ships with a proKred.com compliant submission packet, including public-directory license checks. HIPAA-ready, TJC-HCSS aligned.</p>
              </div>
              <div className="hidden sm:flex flex-wrap gap-1.5 shrink-0">
                {["HIPAA", "TJC", "Verified"].map((b) => (
                  <Badge key={b} variant="secondary" className="text-[10px]">{b}</Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CEO / FOUNDER */}
        <section className="py-12 px-4 lg:px-6 bg-muted/30" data-testid="section-deck-ceo">
          <div className="container mx-auto max-w-5xl">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-px bg-primary" />
              <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">The Founder</p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6 tracking-tight" data-testid="text-ceo-headline">
              Engineered Products. Built Companies. Now Redefining Hiring.
            </h2>

            {/* Two-column block */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Left: bio, badges, LinkedIn */}
              <div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4" data-testid="text-ceo-bio">
                  <span className="font-semibold text-foreground" data-testid="text-ceo-name">Simranjeet Sidana</span> is a product engineering and program leader with 14+ years of experience building and delivering high-stakes software across regulated medical devices, financial platforms, precision oncology patient care software, enterprise retail, airline technology, and national-scale education infrastructure.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  As Founder of Escanor Technologies and CEO of Hire'in Solutions, he brings the discipline of an engineer, the operating mindset of a builder, and the judgment of a leader who has shipped real products in environments where quality, compliance, reliability, and execution matter.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  His career has been defined by one principle: quality cannot be an afterthought — it must be engineered from the start. That principle now shapes how Hire'in approaches staffing.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Simranjeet saw that recruitment was not broken because people lacked effort. It was broken because teams were operating with fragmented tools, unclear requirements, inconsistent data, and too many manual quality gaps. So he built the infrastructure to solve it. Under Escanor Technologies, he architected and shipped <strong>KleriQ.ai</strong> — a recruiter intelligence platform that transforms complex job descriptions into plain-language insights, structured intake questions, sourcing logic, role-family intelligence, and recruiter-ready guidance. He also built <strong>proKred.com</strong> — a compliance submission packet, credential sharing, and skill checklist tool designed to simplify credential collection, compile compliant submission packets, support audit readiness, and enable secure credential sharing for healthcare professionals, staffing agencies, MSPs, and facilities.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  These are not third-party tools Hire'in licenses from a vendor. They are products Simranjeet personally architected, shaped, and shipped — built with the same engineering discipline he has applied across regulated medical, financial, AI, and enterprise software environments.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  When clients work with Hire'in Solutions, they are not working with a traditional staffing firm trying to add technology later. They are working with a company led by a founder who understands product quality, operational rigor, compliance-driven execution, and the cost of a poor match. For Simranjeet, staffing is not about sending resumes — it is about engineering fit.
                </p>

                {/* Credential badges */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {["Wharton 2024", "PSM II", "ISTQB Advanced", "14+ Years", "B.E. Computer Science"].map((badge) => (
                    <Badge key={badge} variant="secondary" className="text-[11px] font-medium">{badge}</Badge>
                  ))}
                </div>

                {/* LinkedIn link */}
                <a
                  href="https://linkedin.com/in/simranjeetsidana"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                  data-testid="link-ceo-linkedin"
                >
                  <Linkedin className="h-4 w-4" />
                  Connect on LinkedIn
                </a>
              </div>

              {/* Right: 2×2 highlight tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    icon: Cpu,
                    title: "FDA-Regulated MedTech at Abbott",
                    desc: "Led quality and release engineering for Abbott Lingo — a CGM bio-wearable aligned to FDA QSR and 21 CFR compliance standards.",
                    id: 1,
                  },
                  {
                    icon: Landmark,
                    title: "Industry-First at Wells Fargo",
                    desc: "Delivered end-to-end engineering validation for the first mobile wallet launched by a major U.S. bank.",
                    id: 2,
                  },
                  {
                    icon: Users,
                    title: "500,000-Student Platform at Edmodo",
                    desc: "Led a 25-person global engineering team supporting national-scale exam infrastructure serving half a million students in Egypt.",
                    id: 3,
                  },
                  {
                    icon: Brain,
                    title: "AI & GenAI at the Frontier",
                    desc: "ML-driven physician note automation and clinical trials management at McKesson; GenAI governance and automation at Mathison and Abbott — all before enterprise AI went mainstream.",
                    id: 4,
                  },
                ].map((tile) => (
                  <Card key={tile.id} data-testid={`card-ceo-highlight-${tile.id}`}>
                    <CardContent className="p-4">
                      <div className="p-2 rounded-md bg-primary/10 w-fit mb-2">
                        <tile.icon className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-sm mb-1 leading-snug">{tile.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{tile.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Pull-quote — full width */}
            <blockquote className="border-l-4 border-primary pl-5 py-1 mb-6" data-testid="text-ceo-quote">
              <p className="italic text-sm text-muted-foreground leading-relaxed mb-2">
                "Every placement we make is an engineering decision. You define the requirements. We build the match — with the same precision, accountability, and quality gates I've applied to regulated systems my entire career."
              </p>
              <footer className="text-xs text-muted-foreground/70 font-medium not-italic">
                — Simranjeet Sidana, CEO &amp; Founder, Hire'in Solutions
              </footer>
            </blockquote>

            {/* Deck-specific closing line */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hire'in Solutions brings together recruiting expertise, AI-enabled tooling, and founder-led quality discipline to help clients hire with more clarity, speed, and confidence.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 px-4 lg:px-6 bg-gradient-to-br from-foreground via-foreground/95 to-primary/30" data-testid="section-deck-cta">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-white tracking-tight">
              Ready to Transform Your Hiring?
            </h2>
            <p className="text-sm text-white/60 max-w-lg mx-auto mb-8">
              Let's discuss how {COMPANY.name} can help you find exceptional talent faster, smarter, and with complete confidence.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
              {[
                { icon: PhoneCall, label: "Call Us", value: CONTACT.phones.main, href: `tel:${CONTACT.phones.main.replace(/\s/g, "")}` },
                { icon: Mail, label: "Email Us", value: CONTACT.emails.general, href: `mailto:${CONTACT.emails.general}` },
                { icon: MapPin, label: "Visit Us", value: "San Jose, CA", href: "#" },
              ].map((item) => (
                <a key={item.label} href={item.href} className="flex items-center gap-3 p-3 rounded-md border border-white/10 bg-white/5 hover-elevate" data-testid={`link-contact-${item.label.toLowerCase().replace(/\s/g, "-")}`}>
                  <item.icon className="h-4 w-4 text-primary shrink-0" />
                  <div className="text-left">
                    <p className="text-white text-xs font-medium">{item.label}</p>
                    <p className="text-white/50 text-[11px]">{item.value}</p>
                  </div>
                </a>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 mb-8">
              <Button size="lg" asChild data-testid="button-deck-cta-contact">
                <Link href="/contact">
                  Schedule a Consultation <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-white/5 text-white border-white/15 backdrop-blur-sm" asChild>
                <Link href="/jobs">View Open Positions</Link>
              </Button>
            </div>

            <div className="pt-6 border-t border-white/10">
              <p className="text-white/40 text-xs">{COMPANY.name} — {COMPANY.brandLine}</p>
              <p className="text-white/25 text-[11px] mt-0.5">{CONTACT.address.full}</p>
              <a href={CONTACT.social.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Follow Hire'in Solutions on LinkedIn" className="inline-block mt-3 text-white/30 hover:text-primary transition-colors" data-testid="link-deck-linkedin">
                <Linkedin className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
