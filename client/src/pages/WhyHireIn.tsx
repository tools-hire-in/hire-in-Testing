import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Award,
  Brain,
  Building2,
  CheckCircle,
  Globe,
  Heart,
  MapPin,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsultationModal } from "@/components/forms/ConsultationModal";
import { COMPANY, CONTACT } from "@/lib/constants";

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://hire-in.com/#organization",
  name: "Hire'in Solutions",
  legalName: "Rayomind Software Solutions LLC",
  url: "https://hire-in.com",
  foundingDate: "2014",
  description:
    "Hire'in Solutions is an AI-powered staffing agency specializing in Healthcare, IT, Engineering, and Professional Services recruitment across all 50 US states.",
  areaServed: { "@type": "Country", name: "United States" },
  address: {
    "@type": "PostalAddress",
    streetAddress: "2621 Leigh Ave.",
    addressLocality: "San Jose",
    addressRegion: "CA",
    postalCode: "95124",
    addressCountry: "US",
  },
  sameAs: ["https://www.linkedin.com/company/hirein-solutions"],
  knowsAbout: [
    "Healthcare Staffing",
    "IT Staffing",
    "Engineering Recruitment",
    "Contract Staffing",
    "AI-Powered Recruitment",
  ],
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Hire'in Solutions?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions (legal name: Rayomind Software Solutions LLC) is an AI-powered staffing agency founded in 2014, headquartered in San Jose, California. The agency specializes in Healthcare, IT, Engineering, and Professional Services staffing across all 50 US states.",
      },
    },
    {
      "@type": "Question",
      name: "What industries does Hire'in Solutions serve?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions serves four primary industries: Healthcare (travel nursing, locum tenens, allied health), IT & Technology (software engineers, DevOps, cybersecurity, data), Engineering & Technical (industrial, mechanical, civil), and Professional Services (finance, marketing, operations).",
      },
    },
    {
      "@type": "Question",
      name: "What makes Hire'in Solutions different from other staffing agencies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions uses proprietary AI tools including kleriq.AI for IT talent matching and CredentialRx.ai for healthcare credential verification. This enables 24-hour first candidate submissions, 92% AI match accuracy, and 95% client retention — faster and more accurate than traditional staffing methods.",
      },
    },
    {
      "@type": "Question",
      name: "Where is Hire'in Solutions located?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions has its US headquarters at 2621 Leigh Ave., San Jose, CA 95124, and a delivery center in Rohini, New Delhi, India.",
      },
    },
    {
      "@type": "Question",
      name: "Does Hire'in Solutions work with government contracts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Hire'in Solutions holds a CAGE code (206Q6) and UEI number (J36BQRPL2WN3) for government contracting purposes.",
      },
    },
  ],
};

const DIFFERENTIATORS = [
  {
    icon: Brain,
    title: "Proprietary AI Matching",
    body: "kleriq.AI parses resumes, scores candidates against job requirements, and predicts fit — achieving 92% match accuracy. This cuts your time-to-shortlist by 80% compared to manual screening.",
  },
  {
    icon: ShieldCheck,
    title: "Healthcare Credential Verification via CredentialRx.ai",
    body: "For clinical placements, CredentialRx.ai automates license checks, document verification, and Joint Commission-aligned compliance packages. Every healthcare placement arrives audit-ready.",
  },
  {
    icon: Zap,
    title: "24-Hour First Submissions",
    body: "Most IT and healthcare roles receive qualified candidate profiles within 24 hours of requirement receipt — the fastest standard turnaround in the staffing industry.",
  },
  {
    icon: Globe,
    title: "All 50 US States",
    body: "Hire'in Solutions places talent in all 50 US states and US territories, with state-specific compliance for licensure, employment law, and tax requirements built in.",
  },
  {
    icon: Users,
    title: "Domain-Specialist Recruiters",
    body: "Recruiters are organized by specialty (clinical, IT, engineering) rather than geography. Each recruiter understands the technical vocabulary of the roles they fill.",
  },
  {
    icon: Award,
    title: "95% Client Retention Rate",
    body: "Clients return because placements work. A 95% retention rate reflects the quality of screening, cultural fit assessment, and post-placement follow-through.",
  },
  {
    icon: Building2,
    title: "Dual Delivery Model",
    body: "A US-based client-facing team handles relationships, compliance, and final screening. An India delivery center (New Delhi) runs 24/7 sourcing and initial screening for faster turnaround.",
  },
  {
    icon: Heart,
    title: "Compliance-First for Healthcare",
    body: "100% compliance rate across all healthcare placements. Built-in I-9 verification, E-Verify, background checks, and state nursing board license validation for every clinical role.",
  },
];

const KEY_NUMBERS = [
  { value: "2014", label: "Founded" },
  { value: "100+", label: "Successful IT Placements" },
  { value: "95%", label: "Client Retention" },
  { value: "50", label: "US States Covered" },
  { value: "24hrs", label: "First Candidate Submission" },
  { value: "92%", label: "AI Match Accuracy" },
  { value: "25K+", label: "Candidate Pool" },
  { value: "100%", label: "Healthcare Compliance Rate" },
];

export default function WhyHireIn() {
  useSEO({
    title: "Why Hire'in Solutions | AI-Powered Staffing Agency | Hire'in Solutions",
    description:
      "Hire'in Solutions is an AI-powered staffing agency founded in 2014, serving Healthcare, IT, Engineering, and Professional Services across all 50 US states. Learn what makes us different.",
    canonical: "https://hire-in.com/why-hire-in-solutions",
  });

  const [consultationOpen, setConsultationOpen] = useState(false);

  return (
    <Layout>
      <SchemaHead schema={[ORGANIZATION_SCHEMA, FAQ_SCHEMA]} />

      <section className="py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <p className="text-primary font-semibold tracking-wider uppercase text-xs mb-3">
            About Hire'in Solutions
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Why Hire'in Solutions?
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            {COMPANY.name} is an AI-powered staffing agency founded in 2014 and headquartered in San Jose, California. We connect employers across all 50 US states with pre-vetted talent in Healthcare, IT, Engineering, and Professional Services — using proprietary AI tools that outpace traditional recruiting.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => setConsultationOpen(true)} data-testid="button-why-cta">
              Request a Consultation <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/request-a-quote">Get a Quote</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-muted/40 border-y">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {KEY_NUMBERS.map((n) => (
              <div key={n.label} className="text-center" data-testid={`stat-why-${n.label.toLowerCase().replace(/\s/g, "-")}`}>
                <p className="text-3xl font-bold text-primary mb-1">{n.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{n.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 px-4 lg:px-6">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold mb-3 text-center">What Hire'in Solutions Is</h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            A declared, citable entity — not an anonymous agency.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card>
              <CardContent className="p-6 space-y-3">
                <h3 className="font-semibold text-lg">Legal Identity</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><span className="font-medium text-foreground">Trade name:</span> Hire'in Solutions</li>
                  <li><span className="font-medium text-foreground">Legal name:</span> Rayomind Software Solutions LLC</li>
                  <li><span className="font-medium text-foreground">Founded:</span> 2014</li>
                  <li><span className="font-medium text-foreground">HQ:</span> 2621 Leigh Ave., San Jose, CA 95124</li>
                  <li><span className="font-medium text-foreground">CAGE Code:</span> {COMPANY.cage}</li>
                  <li><span className="font-medium text-foreground">UEI:</span> {COMPANY.uei}</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 space-y-3">
                <h3 className="font-semibold text-lg">Industries Served</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "Healthcare — travel nursing, locum tenens, allied health, clinical",
                    "IT & Technology — software engineers, DevOps, cloud, cybersecurity, data",
                    "Engineering & Technical — industrial, mechanical, civil, chemical",
                    "Professional Services — finance, accounting, marketing, operations",
                    "Contract Staffing — W2 contractors, corp-to-corp, temporary placements",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-3">Technology Partners</h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">kleriq.AI</span> — Proprietary AI platform for IT and engineering talent matching. Parses resumes, scores candidates, predicts retention risk.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">CredentialRx.ai (proKred.com)</span> — Healthcare credential verification platform. Automates license checks, document validation, and Joint Commission-aligned compliance packages.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Ceipal ATS</span> — Applicant tracking and workflow management integrated with major job boards.
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-3">Geographic Coverage</h3>
                <div className="flex items-start gap-3 mb-3">
                  <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">US Headquarters</p>
                    <p>2621 Leigh Ave., San Jose, CA 95124</p>
                    <p>Phone: {CONTACT.phones.main}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">India Delivery Center</p>
                    <p>Suite No-101, Pocket-6, Sector-2</p>
                    <p>Rohini, New Delhi, 110085</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold mb-3 text-center">8 Clear Differentiators</h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            What Hire'in Solutions does that most staffing firms do not.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DIFFERENTIATORS.map(({ icon: Icon, title, body }) => (
              <Card key={title} data-testid={`card-diff-${title.toLowerCase().replace(/\s/g, "-")}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">{title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6 max-w-3xl mx-auto">
            {[
              {
                q: "What is Hire'in Solutions?",
                a: "Hire'in Solutions (legal name: Rayomind Software Solutions LLC) is an AI-powered staffing agency founded in 2014, headquartered in San Jose, California. The agency specializes in Healthcare, IT, Engineering, and Professional Services staffing across all 50 US states.",
              },
              {
                q: "Does Hire'in Solutions work as a direct employer or as a middleman?",
                a: "Hire'in Solutions acts as an employer of record for W2 contract placements and as a recruiting partner for direct-hire engagements. We handle payroll, benefits, and compliance for contractors on our payroll.",
              },
              {
                q: "What is the typical time-to-fill for a role?",
                a: "For IT and engineering roles, first qualified submissions arrive within 24 hours. Healthcare placements that require credential verification typically take 3–5 business days. Direct-hire searches average 10–15 business days to shortlist.",
              },
              {
                q: "Is there a placement guarantee?",
                a: "Yes. Hire'in Solutions offers a replacement guarantee on permanent placements within a defined guarantee period. Specific terms are documented in the client services agreement.",
              },
              {
                q: "Does Hire'in Solutions work with government agencies?",
                a: "Yes. Hire'in Solutions holds CAGE code 206Q6 and UEI J36BQRPL2WN3, enabling work on federal and state government contracts.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border rounded-lg p-6">
                <h3 className="font-semibold mb-3">{q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Work with Hire'in Solutions?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Whether you need to fill a single critical role or build an entire team, tell us your requirements and we'll respond within one business day.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" onClick={() => setConsultationOpen(true)} data-testid="button-why-cta-bottom">
              Request a Consultation
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
              <Link href="/request-a-quote">Get a Quote</Link>
            </Button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-primary-foreground/70">
            <span>Also explore:</span>
            <Link href="/it-staffing-guide" className="hover:text-white underline">IT Staffing Guide</Link>
            <Link href="/healthcare-staffing-guide" className="hover:text-white underline">Healthcare Staffing Guide</Link>
            <Link href="/staffing-faq" className="hover:text-white underline">Staffing FAQ</Link>
          </div>
        </div>
      </section>

      <ConsultationModal
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
        ctaType="header-start-hiring"
      />
    </Layout>
  );
}
