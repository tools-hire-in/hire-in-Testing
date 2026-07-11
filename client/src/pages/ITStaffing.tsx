import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Brain,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  Expand,
  Loader2,
  Minimize2,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { Button } from "@/components/ui/button";
import { BrandedSlideShell } from "@/components/deck/BrandedSlideShell";
import { COMPANY, CONTACT } from "@/lib/constants";

interface MasterDeckSlide { title: string; bullets: string[]; speaker_notes: string; }
interface MasterDeck { id: string; title: string; slides: MasterDeckSlide[]; }

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "IT Staffing Services",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "IT Staffing",
  description: "AI-powered IT staffing with 100+ successful talent engagements, 24-hour submissions, and 95% client retention. Engineers, developers, architects, and technology leaders.",
  areaServed: { "@type": "Country", name: "United States" },
};

export default function ITStaffing() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const [pptProgress, setPptProgress] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data: masterDeck } = useQuery<MasterDeck>({
    queryKey: ["/api/bd/decks/master/it"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const dbSlides = masterDeck?.slides ?? [];
  const totalSlides = dbSlides.length || 11;

  useEffect(() => {
    document.title = "IT Staffing Services | Hire'in Solutions - AI-Powered IT Recruitment";
    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("description", "Hire'in Solutions IT Staffing — 100+ successful IT talent engagements, 24-hour submissions, 95% retention. AI-powered IT recruitment across all 50 US states. View our deck and download PDF/PPT.");
    setMeta("og:title", "IT Staffing Services | Hire'in Solutions", true);
    setMeta("og:description", "AI-powered IT staffing with 100+ successful talent engagements, 24-hour submissions, and 95% client retention. View our interactive deck.", true);
    setMeta("og:type", "website", true);
    setMeta("og:url", "https://hire-in.com/it-staffing", true);
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", "https://hire-in.com/it-staffing");
    return () => {
      document.title = "Hire'in Solutions";
      document.querySelector('link[rel="canonical"]')?.remove();
    };
  }, []);

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
    if (!isFullscreen) {
      viewerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
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
        setPdfProgress(Math.round(((i) / totalSlides) * 100));
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 300));
        const el = slideContainerRef.current;
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, 1920, 1080);
      }
      pdf.save(`HireIn_Solutions_IT_Staffing_Deck.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfProgress(null);
    }
  };

  const handleDownloadPPT = async () => {
    setPptProgress(0);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const pptxgen = (await import("pptxgenjs")).default;
      const pptx = new pptxgen();
      pptx.layout = "LAYOUT_WIDE";

      for (let i = 0; i < totalSlides; i++) {
        setPptProgress(Math.round(((i) / totalSlides) * 100));
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 300));
        const el = slideContainerRef.current;
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
        const imgData = canvas.toDataURL("image/png");
        const slide = pptx.addSlide();
        slide.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%" });
      }
      await pptx.writeFile({ fileName: "HireIn_Solutions_IT_Staffing_Deck.pptx" });
    } catch (err) {
      console.error("PPT generation failed:", err);
    } finally {
      setPptProgress(null);
    }
  };

  const isDownloading = pdfProgress !== null || pptProgress !== null;
  const slide = dbSlides[currentSlide];

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
            US IT Staffing,{" "}
            <span className="text-primary">Powered by AI</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-3 font-medium max-w-2xl mx-auto">
            The Right Tech Talent, Right Now — 100+ successful IT talent engagements, 24-hour first submissions, and 95% client retention.
          </p>
          <p className="text-sm text-white/50 max-w-xl mx-auto mb-8">
            {COMPANY.name} delivers elite IT talent across all 50 US states, leveraging proprietary AI tools to match, screen, and place faster than any traditional staffing firm.
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
              { value: "100+", label: "Successful IT Talent Engagements" },
              { value: "24hrs", label: "First Submissions" },
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
            {/* Slide display */}
            <div className={`relative w-full ${isFullscreen ? "max-w-[90vw] max-h-[85vh]" : ""}`}>
              <div ref={slideContainerRef} className="w-full">
                {slide ? (
                  <BrandedSlideShell
                    slideTitle={slide.title}
                    bullets={slide.bullets ?? []}
                    slideNumber={currentSlide + 1}
                    totalSlides={totalSlides}
                    domain="it"
                  />
                ) : (
                  <div className="w-full aspect-video bg-muted/40 flex items-center justify-center rounded-md">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Controls bar */}
            <div className={`flex items-center justify-between px-4 py-3 ${isFullscreen ? "absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm" : "border-t bg-card"}`}>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goTo(currentSlide - 1)}
                  disabled={currentSlide === 0 || isDownloading}
                  data-testid="button-slide-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className={`text-sm font-medium tabular-nums min-w-[60px] text-center ${isFullscreen ? "text-white" : ""}`} data-testid="text-slide-counter">
                  {currentSlide + 1} / {totalSlides}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goTo(currentSlide + 1)}
                  disabled={currentSlide === totalSlides - 1 || isDownloading}
                  data-testid="button-slide-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs hidden sm:inline ${isFullscreen ? "text-white/60" : "text-muted-foreground"}`}>
                  {slide?.title ?? ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className={isFullscreen ? "text-white hover:text-white/80" : ""}
                  data-testid="button-fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Slide thumbnail strip */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin" data-testid="slide-thumbnails">
            {dbSlides.map((s, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                disabled={isDownloading}
                className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  i === currentSlide
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
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
      <section className="py-12 md:py-16 px-4 bg-muted/30" data-testid="section-it-staffing-download">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-8 h-px bg-primary" />
            <p className="text-primary font-semibold tracking-wider uppercase text-[11px]">Download</p>
            <div className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">Get the Full Deck</h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-lg mx-auto">
            Download the complete IT Staffing presentation in your preferred format. Share with stakeholders, review offline, or use in your own presentations.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button
              size="lg"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="min-w-[180px]"
              data-testid="button-download-pdf"
            >
              {pdfProgress !== null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating... {pdfProgress}%
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleDownloadPPT}
              disabled={isDownloading}
              className="min-w-[180px]"
              data-testid="button-download-ppt"
            >
              {pptProgress !== null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating... {pptProgress}%
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download PPT
                </>
              )}
            </Button>
          </div>
          {isDownloading && (
            <p className="text-xs text-muted-foreground mt-4">
              Please wait while slides are being rendered. This may take a moment.
            </p>
          )}
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
              { icon: Code2, title: "IT Domain Experts", desc: "20+ domain-specialist recruiters fluent in your tech stack — from Java to Kubernetes, React to SAP. Direct access, no layers." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 rounded-xl border bg-card" data-testid={`card-highlight-${title.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
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
            Let&apos;s Build Your{" "}
            <span className="text-primary">Dream Team</span>
          </h2>
          <p className="text-white/60 mb-8 max-w-lg mx-auto">
            Whether you need a single developer or an entire IT team, our AI-powered recruitment platform delivers pre-vetted talent faster than anyone else.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" asChild data-testid="button-cta-contact">
              <Link href="/contact">
                Schedule a Consultation <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/5 text-white border-white/15 backdrop-blur-sm" asChild data-testid="button-cta-call">
              <a href={`tel:${CONTACT.phones.it}`}>
                Call {CONTACT.phones.it}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
