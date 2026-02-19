import { useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Brain,
  Heart,
  Code,
  Briefcase,
  Users,
  Target,
  Shield,
  Award,
  ArrowRight,
  Download,
  Building2,
  Cpu,
  Stethoscope,
  Factory,
  Landmark,
  ShoppingCart,
  Truck,
  Zap,
  CheckCircle,
  TrendingUp,
  Globe,
  Clock,
  FileCheck,
  ChevronRight,
  Star,
  Layers,
  Workflow,
  Search,
  UserCheck,
  Handshake,
  BadgeCheck,
  Sparkles,
  Lock,
  Eye,
  PhoneCall,
  Mail,
  MapPin,
  Linkedin,
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
  { icon: Stethoscope, name: "Healthcare", desc: "Hospitals, clinics, telehealth, credentialing" },
  { icon: Cpu, name: "Information Technology", desc: "Software, cloud, cybersecurity, data" },
  { icon: Factory, name: "Engineering", desc: "Industrial, mechanical, civil, electrical" },
  { icon: Landmark, name: "Finance & Banking", desc: "Financial services, compliance, risk" },
  { icon: ShoppingCart, name: "Retail & E-Commerce", desc: "Operations, logistics, supply chain" },
  { icon: Building2, name: "Professional Services", desc: "Consulting, legal, HR, marketing" },
];

const TECH_TOOLS = [
  {
    name: "KlerHire AI",
    tagline: "AI-Powered Hiring Intelligence",
    description: "Proprietary AI platform with AI Booster for recruiters to deeply understand requirements and perform intelligent resume matching — ensuring only the most qualified candidates make the shortlist.",
    features: ["AI Booster for Recruiters", "Smart Resume Matching", "Requirement Analysis", "Quality-First Candidate Shortlisting"],
    icon: Brain,
    accent: "from-primary/20 to-primary/5",
    badgeColor: "bg-primary/10 text-primary",
  },
  {
    name: "CredentialRX",
    tagline: "Healthcare Credentialing Excellence",
    description: "Purpose-built credentialing platform that streamlines and secures the entire healthcare credentialing process — transforming a traditionally complex workflow into a seamless, future-ready system.",
    features: ["Secure Credentialing Workflow", "Compliance Automation", "Real-Time Verification", "Future-Ready Architecture"],
    icon: Shield,
    accent: "from-green-500/20 to-green-500/5",
    badgeColor: "bg-green-500/10 text-green-700 dark:text-green-400",
  },
  {
    name: "Ceipal ATS",
    tagline: "Enterprise Applicant Tracking",
    description: "Fully integrated with Ceipal's enterprise applicant tracking system for seamless job posting synchronization, candidate management, and end-to-end recruitment workflow automation.",
    features: ["Bidirectional Job Sync", "Automated Candidate Push", "Workflow Automation", "Enterprise-Grade Tracking"],
    icon: Layers,
    accent: "from-blue-500/20 to-blue-500/5",
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
];

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Discovery & Consultation",
    description: "Deep-dive into your requirements, company culture, and hiring goals. Our AI Booster analyzes the role to create an intelligent candidate profile.",
    icon: Search,
  },
  {
    step: "02",
    title: "AI-Powered Sourcing",
    description: "KlerHire AI scans and matches candidates from our extensive talent network, ranking them by fit, skills, and experience with 90%+ accuracy.",
    icon: Brain,
  },
  {
    step: "03",
    title: "Expert Validation",
    description: "Our specialized recruiters conduct thorough human validation — assessing cultural fit, soft skills, and career alignment that AI alone cannot capture.",
    icon: UserCheck,
  },
  {
    step: "04",
    title: "Credential Verification",
    description: "For healthcare and regulated roles, CredentialRX handles compliance verification, background checks, and credentialing with 100% accuracy.",
    icon: FileCheck,
  },
  {
    step: "05",
    title: "Seamless Placement",
    description: "Pre-vetted, fully qualified candidates delivered with complete documentation, ready for interviews and rapid onboarding.",
    icon: Handshake,
  },
];

const DIFFERENTIATORS = [
  {
    icon: Sparkles,
    title: "Tech-Forward DNA",
    description: "Born from a software company, we think and build like technologists — not just staffing firms.",
  },
  {
    icon: Brain,
    title: "Proprietary AI Tools",
    description: "KlerHire and CredentialRX give us capabilities no traditional agency can match.",
  },
  {
    icon: Clock,
    title: "50% Faster Placements",
    description: "AI-powered pre-screening cuts time-to-hire in half while improving quality.",
  },
  {
    icon: Shield,
    title: "100% Compliance",
    description: "Zero-compromise credential verification and regulatory compliance for every placement.",
  },
  {
    icon: Globe,
    title: "10+ Years of Excellence",
    description: "Backed by Rayomind Software Solutions with over a decade of technology and staffing expertise.",
  },
  {
    icon: TrendingUp,
    title: "95% Client Retention",
    description: "Our results speak for themselves — clients stay because we consistently deliver quality.",
  },
];

function SectionDivider() {
  return <div className="w-24 h-1 bg-gradient-to-r from-primary to-primary/40 mx-auto" />;
}

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
    meta.setAttribute("content", "Hire'in Solutions capability deck — AI-powered staffing solutions across Healthcare, IT, Engineering & Professional Services. Backed by Rayomind Software Solutions (est. 2014).");
    return () => { document.title = "Hire'in Solutions"; };
  }, []);

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <Layout hideFooter>
      <div ref={deckRef} className="capability-deck">
        {/* SECTION 1: Hero / Cover */}
        <section className="relative min-h-[70vh] flex items-center justify-center px-4 py-20 overflow-hidden bg-gradient-to-br from-foreground via-foreground/95 to-primary/30" data-testid="section-deck-hero">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-72 h-72 bg-primary rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/50 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 container mx-auto max-w-5xl text-center">
            <Badge className="mb-6 bg-primary/20 text-primary-foreground border-primary/30 no-default-hover-elevate no-default-active-elevate" data-testid="badge-deck-brand">
              {COMPANY.brandLine}
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight" data-testid="text-deck-title">
              {COMPANY.name}
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-3 font-light">
              {COMPANY.tagline}
            </p>
            <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
              A tech-forward startup under Rayomind Software Solutions, purpose-built to transform
              the hiring landscape with AI-powered recruitment and human expertise.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild data-testid="button-deck-contact">
                <Link href="/contact">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 text-white border-white/20 backdrop-blur-sm"
                onClick={handleDownloadPDF}
                data-testid="button-deck-download"
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </section>

        {/* SECTION 2: Company Overview */}
        <section className="py-20 px-4 lg:px-6" data-testid="section-deck-overview">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-semibold mb-2 tracking-wide uppercase text-sm">Who We Are</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Changing the Hiring Landscape
              </h2>
              <SectionDivider />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  <strong className="text-foreground">{COMPANY.name}</strong> was established as a
                  tech-forward startup under <strong className="text-foreground">Rayomind Software Solutions</strong> (est. 2014)
                  with a singular mission: to revolutionize recruitment by merging cutting-edge AI
                  technology with genuine human understanding.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  With over a decade of technology expertise as our foundation, we don't just fill
                  positions — we engineer perfect matches. Our proprietary tools like KlerHire AI
                  and CredentialRX give us capabilities that traditional staffing firms simply cannot
                  replicate.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We specialize in Healthcare, Information Technology, Engineering, and Professional
                  Services — serving clients from Fortune 500 companies to innovative startups
                  across the United States.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: METRICS.yearsInBusiness, label: "Years in Business", icon: Building2 },
                  { value: METRICS.clientRetention, label: "Client Retention", icon: TrendingUp },
                  { value: METRICS.aiAccuracy, label: "AI Match Accuracy", icon: Target },
                  { value: METRICS.clientSatisfaction, label: "Client Satisfaction", icon: Star },
                ].map((stat) => (
                  <Card key={stat.label} className="text-center" data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                    <CardContent className="pt-6 pb-5">
                      <stat.icon className="h-6 w-6 text-primary mx-auto mb-3" />
                      <p className="text-3xl font-bold text-primary mb-1">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Services & Specializations */}
        <section className="py-20 px-4 lg:px-6 bg-muted/30" data-testid="section-deck-services">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-semibold mb-2 tracking-wide uppercase text-sm">What We Do</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Services & Specializations
              </h2>
              <SectionDivider />
              <p className="text-muted-foreground max-w-2xl mx-auto mt-4">
                Comprehensive talent solutions across critical industries, powered by AI
                and delivered with a human touch.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  icon: Stethoscope,
                  title: "Healthcare Recruitment",
                  desc: "End-to-end talent solutions for hospitals, clinics, and telehealth. Credentialing, compliance, and quality — all handled.",
                  items: ["Physicians & Surgeons", "Registered Nurses", "Allied Health Professionals", "Healthcare Operations", "Telehealth Specialists"],
                  highlight: true,
                },
                {
                  icon: Code,
                  title: "IT & Software Development",
                  desc: "Full-spectrum technology hiring from senior architects to junior developers. Pre-vetted talent ready to deliver.",
                  items: ["Software Engineers", "DevOps & Cloud", "Data Scientists", "Cybersecurity Experts", "AI/ML Engineers"],
                  highlight: false,
                },
                {
                  icon: Factory,
                  title: "Engineering & Technical",
                  desc: "Skilled professionals across industrial, mechanical, civil, and core engineering disciplines.",
                  items: ["Mechanical Engineers", "Civil Engineers", "Industrial Engineers", "Project Managers", "Quality Engineers"],
                  highlight: false,
                },
                {
                  icon: Briefcase,
                  title: "Professional Services",
                  desc: "Finance, marketing, operations, and administrative talent for every critical business function.",
                  items: ["Finance & Accounting", "Marketing & Operations", "Human Resources", "Legal & Compliance", "Executive Search"],
                  highlight: false,
                },
              ].map((service) => (
                <Card
                  key={service.title}
                  className={service.highlight ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent" : ""}
                  data-testid={`card-service-${service.title.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-2.5 rounded-md bg-primary/10">
                        <service.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1">{service.title}</h3>
                        {service.highlight && (
                          <Badge variant="secondary" className="text-xs">Priority Vertical</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{service.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {service.items.map((item) => (
                        <span key={item} className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8">
              <Card data-testid="card-service-contract-staffing">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-2.5 rounded-md bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">Contract & Flexible Staffing</h3>
                      <p className="text-sm text-muted-foreground">
                        Scalable workforce solutions — contract, contract-to-hire, and direct placement
                        models tailored to your business needs and budget.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    {["Contract Staffing", "Contract-to-Hire", "Direct Placement"].map((model) => (
                      <div key={model} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                        <span>{model}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* SECTION 4: Industries We Serve */}
        <section className="py-20 px-4 lg:px-6" data-testid="section-deck-industries">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-semibold mb-2 tracking-wide uppercase text-sm">Industries</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Industries We Serve
              </h2>
              <SectionDivider />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {INDUSTRIES.map((ind) => (
                <Card key={ind.name} className="hover-elevate" data-testid={`card-industry-${ind.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="p-5 text-center">
                    <div className="p-3 rounded-md bg-primary/10 w-fit mx-auto mb-3">
                      <ind.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1 text-sm">{ind.name}</h3>
                    <p className="text-xs text-muted-foreground">{ind.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5: Our Process */}
        <section className="py-20 px-4 lg:px-6 bg-muted/30" data-testid="section-deck-process">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-semibold mb-2 tracking-wide uppercase text-sm">How We Work</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Our Proven Process
              </h2>
              <SectionDivider />
              <p className="text-muted-foreground max-w-2xl mx-auto mt-4">
                A streamlined 5-step methodology that combines AI precision with human expertise
                to deliver exceptional talent — fast.
              </p>
            </div>

            <div className="space-y-6">
              {PROCESS_STEPS.map((step, index) => (
                <div key={step.step} className="flex gap-6 items-start" data-testid={`step-process-${step.step}`}>
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-12 h-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      {step.step}
                    </div>
                    {index < PROCESS_STEPS.length - 1 && (
                      <div className="w-px h-full min-h-8 bg-border mt-2" />
                    )}
                  </div>
                  <Card className="flex-1">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-2">
                        <step.icon className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">{step.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 6: Key Stats & Metrics */}
        <section className="py-20 px-4 lg:px-6 bg-gradient-to-br from-foreground via-foreground/95 to-primary/30" data-testid="section-deck-stats">
          <div className="container mx-auto max-w-5xl text-center">
            <p className="text-primary font-semibold mb-2 tracking-wide uppercase text-sm">By the Numbers</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Numbers That Speak
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-primary to-primary/40 mx-auto mb-12" />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {[
                { value: "10+", label: "Years in Business", sub: "Est. 2014" },
                { value: "95%", label: "Client Retention", sub: "Year over year" },
                { value: "90%", label: "AI Match Accuracy", sub: "KlerHire AI" },
                { value: "50%", label: "Faster Placements", sub: "vs Industry Avg" },
                { value: "100%", label: "Compliance Rate", sub: "Healthcare verified" },
                { value: "98%", label: "Satisfaction Score", sub: "Client surveys" },
              ].map((stat) => (
                <div key={stat.label} className="p-4" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                  <p className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</p>
                  <p className="text-white font-medium text-sm mb-0.5">{stat.label}</p>
                  <p className="text-white/50 text-xs">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 7: Trusted Clients */}
        <section className="py-20 px-4 lg:px-6" data-testid="section-deck-clients">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-semibold mb-2 tracking-wide uppercase text-sm">Our Clients</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Trusted by Industry Leaders
              </h2>
              <SectionDivider />
              <p className="text-muted-foreground max-w-2xl mx-auto mt-4">
                From Fortune 500 enterprises to innovative healthcare providers, we partner with
                organizations that demand excellence in talent acquisition.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {CLIENT_LOGOS.map((client) => (
                <Card
                  key={client.name}
                  className="hover-elevate"
                  data-testid={`card-client-${client.name.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <CardContent className="p-4 text-center">
                    <div className="h-12 flex items-center justify-center mb-2">
                      <span className="text-base font-bold text-foreground/80 tracking-tight">{client.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{client.industry}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-8">
              ...and many more across Healthcare, IT, Engineering, and Professional Services
            </p>
          </div>
        </section>

        {/* SECTION 8: Technology & AI Tools */}
        <section className="py-20 px-4 lg:px-6 bg-muted/30" data-testid="section-deck-technology">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-semibold mb-2 tracking-wide uppercase text-sm">Our Technology</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Powered by Proprietary AI
              </h2>
              <SectionDivider />
              <p className="text-muted-foreground max-w-2xl mx-auto mt-4">
                Unlike traditional staffing agencies, we build our own technology. Our proprietary
                tools give us an unfair advantage in finding, matching, and placing top talent.
              </p>
            </div>

            <div className="space-y-6">
              {TECH_TOOLS.map((tool) => (
                <Card key={tool.name} className={`overflow-visible bg-gradient-to-r ${tool.accent}`} data-testid={`card-tech-${tool.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="shrink-0">
                        <div className="p-3 rounded-md bg-background w-fit">
                          <tool.icon className="h-8 w-8 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{tool.name}</h3>
                          <Badge className={`${tool.badgeColor} no-default-hover-elevate no-default-active-elevate`}>
                            {tool.tagline}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-4">{tool.description}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {tool.features.map((feature) => (
                            <div key={feature} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 9: Why Choose Hire'in */}
        <section className="py-20 px-4 lg:px-6" data-testid="section-deck-why">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-semibold mb-2 tracking-wide uppercase text-sm">The Hire'in Edge</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Choose {COMPANY.name}
              </h2>
              <SectionDivider />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DIFFERENTIATORS.map((diff) => (
                <Card key={diff.title} className="hover-elevate" data-testid={`card-diff-${diff.title.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="p-6">
                    <div className="p-2.5 rounded-md bg-primary/10 w-fit mb-4">
                      <diff.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{diff.title}</h3>
                    <p className="text-sm text-muted-foreground">{diff.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-10 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="p-4 rounded-md bg-primary/10 shrink-0">
                    <BadgeCheck className="h-10 w-10 text-primary" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-bold mb-2">Compliance & Credentialing Guarantee</h3>
                    <p className="text-muted-foreground">
                      Every healthcare placement comes with complete credentialing verification through
                      CredentialRX. HIPAA-ready, TJC-HCSS aligned, and 100% compliant — guaranteed.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {["HIPAA Ready", "TJC Aligned", "Verified"].map((badge) => (
                      <Badge key={badge} variant="secondary">{badge}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 10: Contact / CTA */}
        <section className="py-20 px-4 lg:px-6 bg-gradient-to-br from-foreground via-foreground/95 to-primary/30" data-testid="section-deck-cta">
          <div className="container mx-auto max-w-5xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Ready to Transform Your Hiring?
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10">
              Let's discuss how {COMPANY.name} can help you find exceptional talent faster,
              smarter, and with complete confidence.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {[
                { icon: PhoneCall, label: "Call Us", value: CONTACT.phones.main, href: `tel:${CONTACT.phones.main.replace(/\s/g, "")}` },
                { icon: Mail, label: "Email Us", value: CONTACT.emails.general, href: `mailto:${CONTACT.emails.general}` },
                { icon: MapPin, label: "Visit Us", value: "San Jose, CA", href: "#" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="p-6 rounded-md border border-white/10 bg-white/5 backdrop-blur-sm text-center hover-elevate block"
                  data-testid={`link-contact-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <item.icon className="h-6 w-6 text-primary mx-auto mb-3" />
                  <p className="text-white font-medium mb-1">{item.label}</p>
                  <p className="text-white/60 text-sm">{item.value}</p>
                </a>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild data-testid="button-deck-cta-contact">
                <Link href="/contact">
                  Schedule a Consultation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/20 backdrop-blur-sm" asChild>
                <Link href="/jobs">
                  View Open Positions
                </Link>
              </Button>
            </div>

            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="text-white/40 text-sm mb-2">{COMPANY.name} — {COMPANY.brandLine}</p>
              <p className="text-white/30 text-xs">{CONTACT.address.full}</p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <a href={CONTACT.social.linkedin} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-primary transition-colors" data-testid="link-deck-linkedin">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
