import { useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Brain,
  Code,
  Briefcase,
  Users,
  Target,
  Shield,
  ArrowRight,
  Download,
  Building2,
  Cpu,
  Stethoscope,
  Factory,
  Landmark,
  ShoppingCart,
  CheckCircle,
  TrendingUp,
  Globe,
  Clock,
  FileCheck,
  Star,
  Layers,
  Search,
  UserCheck,
  Handshake,
  BadgeCheck,
  Sparkles,
  PhoneCall,
  Mail,
  MapPin,
  Linkedin,
  Zap,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COMPANY, CONTACT, METRICS } from "@/lib/constants";

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
    description: "Proprietary AI platform with AI Booster for recruiters to deeply understand requirements and perform intelligent resume matching — ensuring only the most qualified candidates make the shortlist.",
    features: ["AI Booster for Recruiters", "Smart Resume Matching", "Requirement Analysis", "Quality-First Shortlisting"],
    icon: Brain,
    accent: "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent",
    badgeColor: "bg-primary/10 text-primary",
  },
  {
    name: "CredentialRX",
    tagline: "Healthcare Credentialing Excellence",
    description: "Purpose-built credentialing platform that streamlines and secures the entire healthcare credentialing process — transforming complex workflows into a seamless, future-ready system.",
    features: ["Secure Credentialing", "Compliance Automation", "Real-Time Verification", "Future-Ready Architecture"],
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
  { step: "04", title: "Credentials", description: "CredentialRX handles compliance verification and credentialing with 100% accuracy.", icon: FileCheck },
  { step: "05", title: "Placement", description: "Pre-vetted candidates delivered with complete documentation, ready for onboarding.", icon: Handshake },
];

const DIFFERENTIATORS = [
  { icon: Sparkles, title: "Tech-Forward DNA", description: "Born from a software company — we build like technologists, not just staffing firms." },
  { icon: Brain, title: "Proprietary AI Tools", description: "KlerHire and CredentialRX give us capabilities no traditional agency can match." },
  { icon: Clock, title: "50% Faster Placements", description: "AI pre-screening cuts time-to-hire in half while improving quality." },
  { icon: Shield, title: "100% Compliance", description: "Zero-compromise credential verification for every placement." },
  { icon: Globe, title: "10+ Years of Excellence", description: "Backed by Rayomind with over a decade of technology expertise." },
  { icon: TrendingUp, title: "95% Client Retention", description: "Clients stay because we consistently deliver quality talent." },
];

export default function CapabilityDeck() {
  const deckRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Capability Deck | Hire'in Solutions - AI-Powered Recruitment";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "Hire'in Solutions capability deck — AI-powered staffing solutions across Healthcare, IT, Engineering & Professional Services. Backed by Rayomind (est. 2014).");
    return () => { document.title = "Hire'in Solutions"; };
  }, []);

  const handleDownloadPDF = () => { window.print(); };

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
            <div className="flex items-center justify-center gap-3">
              <Button size="lg" asChild data-testid="button-deck-contact">
                <Link href="/contact">
                  Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-white/5 text-white border-white/15 backdrop-blur-sm" onClick={handleDownloadPDF} data-testid="button-deck-download">
                <Download className="mr-1.5 h-4 w-4" /> Download PDF
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
                  With over a decade of technology expertise as our foundation, we don't just fill positions — we engineer perfect matches. Our proprietary tools like KlerHire AI and CredentialRX give us capabilities that traditional staffing firms simply cannot replicate.
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
            <h2 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight">Powered by Proprietary AI</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xl">We build our own technology. Our proprietary tools give us an unfair advantage in finding, matching, and placing top talent.</p>

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
                <p className="text-xs text-muted-foreground">Every healthcare placement comes with complete CredentialRX verification. HIPAA-ready, TJC-HCSS aligned, 100% compliant.</p>
              </div>
              <div className="hidden sm:flex flex-wrap gap-1.5 shrink-0">
                {["HIPAA", "TJC", "Verified"].map((b) => (
                  <Badge key={b} variant="secondary" className="text-[10px]">{b}</Badge>
                ))}
              </div>
            </div>
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
              <a href={CONTACT.social.linkedin} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-white/30 hover:text-primary transition-colors" data-testid="link-deck-linkedin">
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
