import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Heart,
  Loader2,
  Minimize2,
  ShieldCheck,
  Stethoscope,
  Users,
  Zap,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { HEALTHCARE_SLIDES, HEALTHCARE_TOTAL_SLIDES, HealthcareSlideNumberContext } from "@/components/deck/HealthcareDeckSlides";
import { COMPANY, CONTACT } from "@/lib/constants";

export default function EHealthcareStaffing() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const [pptProgress, setPptProgress] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "eHealthcare Staffing Services | Hire'in Solutions - AI + Compliance Healthcare Recruitment";
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
    setMeta("description", "Hire'in Solutions Healthcare Staffing. Joint Commission-aligned workflows, verified documents & compliant submission packages via proKred.com. Clinical recruitment across all 50 US states.");
    setMeta("og:title", "eHealthcare Staffing Services | Hire'in Solutions", true);
    setMeta("og:description", "AI-powered healthcare staffing with Joint Commission-aligned workflows, verified documents & compliant submission packages. Travel nursing, locum tenens, allied health. View our interactive deck.", true);
    setMeta("og:type", "website", true);
    setMeta("og:url", `${window.location.origin}/ehealthcare-staffing`, true);
    setMeta("keywords", "healthcare staffing, travel nursing, locum tenens, allied health staffing, Joint Commission aligned, proKred, clinical recruitment, healthcare MSP, nurse staffing agency");
    return () => { document.title = "Hire'in Solutions"; };
  }, []);

  const goTo = useCallback((idx: number) => {
    setCurrentSlide(Math.max(0, Math.min(HEALTHCARE_TOTAL_SLIDES - 1, idx)));
  }, []);

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

      for (let i = 0; i < HEALTHCARE_TOTAL_SLIDES; i++) {
        setPdfProgress(Math.round(((i) / HEALTHCARE_TOTAL_SLIDES) * 100));
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 300));
        const el = slideContainerRef.current;
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, 1920, 1080);
      }
      pdf.save("HireIn_Solutions_Healthcare_Staffing_Deck.pdf");
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

      for (let i = 0; i < HEALTHCARE_TOTAL_SLIDES; i++) {
        setPptProgress(Math.round(((i) / HEALTHCARE_TOTAL_SLIDES) * 100));
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 300));
        const el = slideContainerRef.current;
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
        const imgData = canvas.toDataURL("image/png");
        const slide = pptx.addSlide();
        slide.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%" });
      }
      await pptx.writeFile({ fileName: "HireIn_Solutions_Healthcare_Staffing_Deck.pptx" });
    } catch (err) {
      console.error("PPT generation failed:", err);
    } finally {
      setPptProgress(null);
    }
  };

  const isDownloading = pdfProgress !== null || pptProgress !== null;
  const slide = HEALTHCARE_SLIDES[currentSlide];

  return (
    <Layout>
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
            US Healthcare Staffing,{" "}
            <span className="text-primary">AI + Compliance</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-3 font-medium max-w-2xl mx-auto">
            We place compliance-verified clinical professionals in all 50 US states with Joint Commission-aligned workflows and compliant submission packages.
          </p>
          <p className="text-sm text-white/50 max-w-xl mx-auto mb-8">
            {COMPANY.name} delivers compliance-verified clinical professionals across all 50 US states, leveraging proKred.com and KlerHire AI to verify documents and deliver compliant submission packages with speed.
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
              { value: "TJC", label: "JC-Aligned" },
              { value: "AI+", label: "Verified Documents" },
              { value: "50", label: "US States" },
              { value: "100+", label: "Healthcare Roles" },
              { value: "MSP", label: "Managed Service" },
              { value: "Fast", label: "Compliant Packages" },
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
                <HealthcareSlideNumberContext.Provider value={{ slideNumber: slide.id, totalSlides: HEALTHCARE_TOTAL_SLIDES }}>
                  {slide.component}
                </HealthcareSlideNumberContext.Provider>
              </div>
            </div>

            <div className={`flex items-center justify-between px-4 py-3 ${isFullscreen ? "absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm" : "border-t bg-card"}`}>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goTo(currentSlide - 1)}
                  disabled={currentSlide === 0 || isDownloading}
                  data-testid="button-hc-slide-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className={`text-sm font-medium tabular-nums min-w-[60px] text-center ${isFullscreen ? "text-white" : ""}`} data-testid="text-hc-slide-counter">
                  {currentSlide + 1} / {HEALTHCARE_TOTAL_SLIDES}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goTo(currentSlide + 1)}
                  disabled={currentSlide === HEALTHCARE_TOTAL_SLIDES - 1 || isDownloading}
                  data-testid="button-hc-slide-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs hidden sm:inline ${isFullscreen ? "text-white/60" : "text-muted-foreground"}`}>
                  {slide.title}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className={isFullscreen ? "text-white hover:text-white/80" : ""}
                  data-testid="button-hc-fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin" data-testid="hc-slide-thumbnails">
            {HEALTHCARE_SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                disabled={isDownloading}
                className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  i === currentSlide
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`button-hc-slide-thumb-${s.id}`}
              >
                {s.id}. {s.title}
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
            Download the complete Healthcare Staffing presentation in your preferred format. Share with stakeholders, review offline, or use in your own presentations.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button
              size="lg"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="min-w-[180px]"
              data-testid="button-hc-download-pdf"
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
              data-testid="button-hc-download-ppt"
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

      <section className="py-12 md:py-16 px-4" data-testid="section-hc-staffing-highlights">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ShieldCheck, title: "Joint Commission-Aligned", desc: "Our compliance workflows are built around TJC standards with automated document verification via proKred.com, so your placements are audit-ready from day one." },
              { icon: Zap, title: "Compliant Submission Packages", desc: "proKred.com automates license verification and compliance tracking, delivering verified documents and compliant submission packages faster than traditional firms." },
              { icon: Heart, title: "Clinical Domain Experts", desc: "Specialty-trained recruiters for RN, LPN, CNA, allied health, physicians, and telehealth professionals." },
              { icon: Stethoscope, title: "Healthcare-Only Focus", desc: "Dedicated healthcare staffing division with deep clinical recruitment expertise across all care settings." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 rounded-xl border bg-card" data-testid={`card-hc-highlight-${title.toLowerCase().replace(/\s/g, "-")}`}>
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

      <section className="py-16 md:py-20 px-4 bg-gradient-to-br from-foreground via-foreground/95 to-primary/30" data-testid="section-hc-staffing-cta">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white/70 tracking-wider uppercase mb-6">
            <Users className="h-3 w-3 text-primary" />
            Ready to Staff Smarter?
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            Let&apos;s Build Your{" "}
            <span className="text-primary">Clinical Team</span>
          </h2>
          <p className="text-white/60 mb-8 max-w-lg mx-auto">
            Whether you need travel nurses, locum tenens physicians, or a full allied health team, our AI-powered platform delivers verified documents and compliant submission packages for every placement.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" asChild data-testid="button-hc-cta-contact">
              <Link href="/contact">
                Schedule a Consultation <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/5 text-white border-white/15 backdrop-blur-sm" asChild data-testid="button-hc-cta-call">
              <a href={`tel:${CONTACT.phones.healthcare}`}>
                Call {CONTACT.phones.healthcare}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}