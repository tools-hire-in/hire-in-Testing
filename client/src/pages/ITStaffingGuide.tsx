import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Code2,
  DollarSign,
  FileText,
  Users,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsultationModal } from "@/components/forms/ConsultationModal";

const HOWTO_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Hire Software Engineers Through a Staffing Agency",
  description:
    "A step-by-step guide to hiring IT and software engineers through a staffing agency like Hire'in Solutions.",
  step: [
    {
      "@type": "HowToStep",
      name: "Define the role and engagement type",
      text: "Decide whether you need a contractor (W2 or corp-to-corp), contract-to-hire, or direct permanent hire. Specify the tech stack, seniority level, location preference (on-site, hybrid, remote), and timeline.",
    },
    {
      "@type": "HowToStep",
      name: "Submit requirements to the staffing agency",
      text: "Share the job description, required skills, rate or salary range, and must-have vs. nice-to-have criteria. A specialized IT staffing agency will use this to configure their AI matching and recruiter search.",
    },
    {
      "@type": "HowToStep",
      name: "Review candidate submissions",
      text: "Within 24 hours for most roles, you'll receive pre-screened candidate profiles with match scores, recruiter notes, and availability. Review and shortlist based on your criteria.",
    },
    {
      "@type": "HowToStep",
      name: "Conduct technical interviews",
      text: "The agency's recruiters have already done a first pass. Your technical interview focuses on domain depth, architecture thinking, and team fit. The agency can provide reference contacts and technical screening notes.",
    },
    {
      "@type": "HowToStep",
      name: "Extend an offer and onboard",
      text: "For contract roles, the staffing agency handles payroll, benefits, and compliance. For direct hire, the agency facilitates the offer process and delivers a placement guarantee for a defined period.",
    },
  ],
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is IT staffing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "IT staffing is the process of sourcing, screening, and placing technology professionals — including software engineers, DevOps engineers, data scientists, and cybersecurity specialists — into contract, contract-to-hire, or permanent roles at client companies.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between contract and permanent IT staffing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Contract IT staffing places candidates on a fixed-term engagement (typically 3–12 months), with the staffing agency handling payroll and compliance. Permanent (direct hire) staffing places candidates directly on the client's payroll with no fixed end date. Contract-to-hire starts as a contract with an option to convert to permanent employment.",
      },
    },
    {
      "@type": "Question",
      name: "How fast can a staffing agency fill an IT role?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions delivers first qualified candidate submissions within 24 hours for most IT roles. Time-to-fill depends on role seniority and market availability — common roles like Java developers or QA engineers can be filled in 5–10 business days; senior architects or niche specialists may take 2–4 weeks.",
      },
    },
    {
      "@type": "Question",
      name: "What IT roles can Hire'in Solutions fill?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions fills software engineers (Java, Python, JavaScript, React, Node.js), DevOps and cloud engineers (AWS, Azure, GCP, Kubernetes), data scientists and ML engineers, cybersecurity analysts and engineers, QA/test engineers, IT project managers, business analysts, and enterprise platform consultants (SAP, Salesforce, ServiceNow).",
      },
    },
    {
      "@type": "Question",
      name: "What does IT staffing cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "IT contract staffing is typically priced as an hourly bill rate — the candidate's pay rate plus a markup (usually 25–50%) covering payroll taxes, benefits, and agency overhead. Direct hire placements are priced as a percentage of the candidate's first-year salary, typically 15–20%. Hire'in Solutions provides firm quotes before any placement.",
      },
    },
    {
      "@type": "Question",
      name: "Can Hire'in Solutions place remote IT workers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Hire'in Solutions places IT professionals in remote, hybrid, and on-site roles across all 50 US states. Remote placements include compliance with state-specific employment law for multi-state payroll.",
      },
    },
    {
      "@type": "Question",
      name: "How does AI improve IT staffing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions uses kleriq.AI, a proprietary AI platform that parses resumes, extracts skills and experience, scores candidates against job requirements, and predicts retention risk. This achieves 92% match accuracy and reduces time-to-shortlist by 80% compared to manual recruiter screening.",
      },
    },
    {
      "@type": "Question",
      name: "What is corp-to-corp (C2C) IT staffing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Corp-to-corp (C2C) is an arrangement where the IT professional works as a contractor through their own business entity (LLC or S-Corp), and the staffing agency pays that entity rather than the individual. C2C is common for senior IT consultants and independent contractors with established businesses. Hire'in Solutions supports both W2 contract and C2C engagements.",
      },
    },
    {
      "@type": "Question",
      name: "Does Hire'in Solutions work with startups or only enterprises?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions works with organizations of all sizes — from early-stage startups needing their first engineering hire to Fortune 500 enterprises building large IT teams. Minimum engagement size is typically one role.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if a placed IT contractor doesn't work out?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For contract placements, clients can end the engagement with standard notice. For permanent placements, Hire'in Solutions offers a replacement guarantee within a defined guarantee period — typically 60–90 days. If the placed candidate leaves or is terminated for performance within that period, Hire'in Solutions will search for a replacement at no additional fee.",
      },
    },
  ],
};

const ENGAGEMENT_TYPES = [
  {
    icon: Clock,
    title: "Contract (W2 / C2C)",
    description:
      "Fixed-term engagement, typically 3–12 months. The staffing agency employs the contractor (W2) or pays their entity (C2C) and handles all payroll, taxes, and benefits. Best for project-based needs, staff augmentation, and peak-demand periods.",
    best: "Project teams, staff augmentation, surge capacity",
  },
  {
    icon: ArrowRight,
    title: "Contract-to-Hire",
    description:
      "Starts as a contract, with an agreed option to convert to permanent employment after a trial period (typically 3–6 months). Lets you evaluate fit before a long-term commitment.",
    best: "When you want to reduce permanent hire risk",
  },
  {
    icon: Users,
    title: "Direct Hire (Permanent)",
    description:
      "The candidate is placed directly on your payroll as a permanent employee. The agency earns a placement fee (percentage of first-year salary). The agency provides a replacement guarantee for a defined period.",
    best: "Core team members, leadership roles, long-term positions",
  },
];

const IT_ROLES = [
  "Software Engineers (Java, Python, JavaScript, C#, Go)",
  "Frontend Developers (React, Angular, Vue)",
  "Backend Engineers (Node.js, Django, Spring Boot)",
  "Full-Stack Developers",
  "Mobile Developers (iOS, Android, React Native)",
  "DevOps Engineers",
  "Cloud Architects (AWS, Azure, GCP)",
  "Site Reliability Engineers (SRE)",
  "Data Scientists & ML Engineers",
  "Data Engineers & Analysts",
  "Cybersecurity Analysts & Engineers",
  "Penetration Testers",
  "QA/Test Engineers",
  "IT Project Managers",
  "Business Analysts",
  "SAP / Salesforce / ServiceNow Consultants",
  "Enterprise Architects",
  "Database Administrators (DBA)",
];

export default function ITStaffingGuide() {
  useSEO({
    title: "IT Staffing Guide: How to Hire Software Engineers Through a Staffing Agency | Hire'in Solutions",
    description:
      "Complete guide to IT and technology staffing — what it is, engagement types (contract, permanent, C2C), how AI improves matching, costs, timelines, and 10 FAQs. From Hire'in Solutions.",
    canonical: "https://hire-in.com/it-staffing-guide",
  });

  const [consultationOpen, setConsultationOpen] = useState(false);

  return (
    <Layout>
      <SchemaHead schema={[HOWTO_SCHEMA, FAQ_SCHEMA]} />

      <section className="py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl">
          <p className="text-primary font-semibold tracking-wider uppercase text-xs mb-3">IT Staffing Reference Guide</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            IT & Technology Staffing: A Complete Guide
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mb-8 leading-relaxed">
            Everything an employer or hiring manager needs to know about staffing for software engineers, DevOps, data, and cybersecurity roles — what IT staffing is, how it works, what it costs, and how AI-powered agencies like Hire'in Solutions deliver qualified candidates faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" onClick={() => setConsultationOpen(true)} data-testid="button-itguide-cta">
              Hire IT Talent Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/staffing-faq">Read Full Staffing FAQ</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">What Is IT Staffing?</h2>
          <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
            <p>
              IT staffing is the process of sourcing, screening, and placing technology professionals into roles at client companies. An IT staffing agency — also called an IT staffing firm or technology recruiter — maintains a candidate pipeline and uses specialized knowledge of technical roles to match employers with qualified candidates faster than internal HR teams typically can.
            </p>
            <p>
              The staffing agency earns revenue either as a markup on the contractor's hourly rate (for contract roles) or as a placement fee based on the candidate's annual salary (for permanent roles). In exchange, the agency handles all sourcing, screening, initial interviewing, background checks, and — for contract placements — payroll, benefits, and compliance.
            </p>
            <p>
              IT staffing differs from general staffing in that recruiters must understand the technical requirements of each role: programming languages, cloud platforms, architectural patterns, and domain-specific tools. An IT recruiter who cannot distinguish a Java backend engineer from a JavaScript frontend developer cannot screen candidates accurately.
            </p>
            <p>
              Hire'in Solutions augments recruiter knowledge with kleriq.AI — a proprietary AI platform that parses resumes, extracts and verifies skills, and scores candidates against job requirements. This achieves 92% match accuracy and first candidate submissions within 24 hours.
            </p>
          </div>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold mb-3 text-center">Engagement Types</h2>
          <p className="text-muted-foreground text-center mb-10">Choose the model that fits your hiring need.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {ENGAGEMENT_TYPES.map(({ icon: Icon, title, description, best }) => (
              <Card key={title}>
                <CardContent className="p-6">
                  <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-3">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
                  <div className="pt-3 border-t">
                    <p className="text-xs font-medium text-primary">Best for:</p>
                    <p className="text-xs text-muted-foreground">{best}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">What Hire'in Solutions Covers</h2>
          <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Roles We Place</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-10">
            {IT_ROLES.map((role) => (
              <div key={role} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                {role}
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mb-4">Typical Turnaround Times</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { label: "First Candidate Submissions", value: "Within 24 hours" },
              { label: "Common Roles (Java, QA, BA)", value: "5–10 business days" },
              { label: "Senior / Niche Specialists", value: "2–4 weeks" },
            ].map(({ label, value }) => (
              <div key={label} className="border rounded-lg p-4 text-center">
                <p className="text-xl font-bold text-primary mb-1">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mb-4">Tech Stacks We Recruit For</h3>
          <div className="flex flex-wrap gap-2">
            {[
              "Java", "Python", "JavaScript", "TypeScript", "React", "Node.js",
              "Go", "Rust", "C#/.NET", "AWS", "Azure", "GCP", "Kubernetes",
              "Docker", "PostgreSQL", "MongoDB", "Kafka", "Spark", "TensorFlow",
              "PyTorch", "Salesforce", "SAP", "ServiceNow",
            ].map((tech) => (
              <span key={tech} className="px-3 py-1 rounded-full bg-muted text-sm font-medium">{tech}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">How to Hire a Software Engineer Through a Staffing Agency</h2>
          <div className="space-y-5">
            {[
              {
                step: "1",
                title: "Define the role and engagement type",
                body: "Decide whether you need a contractor (W2 or C2C), contract-to-hire, or permanent hire. Specify the tech stack, seniority level, location (on-site, hybrid, remote), and timeline.",
              },
              {
                step: "2",
                title: "Submit your requirements",
                body: "Share the job description, required skills, rate or salary range, and must-have criteria. Hire'in Solutions will configure kleriq.AI matching and assign a domain-specialist recruiter.",
              },
              {
                step: "3",
                title: "Review candidate submissions (within 24 hours)",
                body: "Receive pre-screened candidate profiles with AI match scores, recruiter notes, and availability. Shortlist based on your criteria.",
              },
              {
                step: "4",
                title: "Conduct technical interviews",
                body: "Your technical interview focuses on domain depth and team fit. The agency provides reference contacts and technical screening notes. For contract roles, interviews are often conducted faster because candidates are already available.",
              },
              {
                step: "5",
                title: "Extend an offer and onboard",
                body: "For contract roles, Hire'in Solutions handles payroll, benefits, and compliance as employer of record. For direct hire, we facilitate the offer process and provide a replacement guarantee.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4 p-5 border rounded-lg bg-card">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">What IT Staffing Costs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Contract Staffing Pricing</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Priced as an hourly bill rate — the candidate's pay rate plus a markup (typically 25–50%) that covers payroll taxes, benefits, workers' compensation, and agency overhead. You pay only for hours worked. No recruiting fee upfront.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Direct Hire Pricing</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Priced as a percentage of the placed candidate's first-year annual salary — typically 15–20%. The fee is due upon the candidate's start date. Includes a replacement guarantee (typically 60–90 days).
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Note:</span> Hire'in Solutions provides firm quotes before any placement begins. There are no hidden fees. Get a specific quote for your role at <Link href="/request-a-quote" className="text-primary hover:underline">request-a-quote</Link>.
          </p>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-10 text-center">IT Staffing FAQ</h2>
          <div className="space-y-5">
            {[
              {
                q: "What is IT staffing?",
                a: "IT staffing is the process of sourcing, screening, and placing technology professionals into contract, contract-to-hire, or permanent roles at client companies.",
              },
              {
                q: "What is the difference between contract and permanent IT staffing?",
                a: "Contract staffing places candidates on a fixed-term engagement with the staffing agency handling payroll. Permanent (direct hire) places candidates directly on your payroll. Contract-to-hire starts as a contract with an option to convert.",
              },
              {
                q: "How fast can a staffing agency fill an IT role?",
                a: "Hire'in Solutions delivers first submissions within 24 hours. Time-to-fill ranges from 5–10 days for common roles to 2–4 weeks for senior or niche specialists.",
              },
              {
                q: "What IT roles can Hire'in Solutions fill?",
                a: "Software engineers (all major stacks), DevOps/cloud engineers, data scientists, ML engineers, cybersecurity analysts, QA engineers, IT project managers, business analysts, and enterprise platform consultants (SAP, Salesforce, ServiceNow).",
              },
              {
                q: "What does IT staffing cost?",
                a: "Contract: hourly bill rate (pay rate + 25–50% markup). Direct hire: 15–20% of first-year salary, with a replacement guarantee.",
              },
              {
                q: "Can Hire'in Solutions place remote IT workers?",
                a: "Yes, across all 50 US states with multi-state payroll compliance built in.",
              },
              {
                q: "How does AI improve IT staffing?",
                a: "Hire'in Solutions uses kleriq.AI to achieve 92% match accuracy and 24-hour first submissions, reducing screening time by 80%.",
              },
              {
                q: "What is corp-to-corp (C2C) IT staffing?",
                a: "C2C is a contract arrangement where the IT professional operates through their own LLC or S-Corp. The agency pays that entity. Common for senior IT consultants and independent contractors.",
              },
              {
                q: "Does Hire'in Solutions work with startups?",
                a: "Yes. Hire'in Solutions works with organizations of all sizes, from early-stage startups to Fortune 500 enterprises.",
              },
              {
                q: "What happens if a placed IT contractor doesn't work out?",
                a: "For contract placements, clients can end the engagement with standard notice. For permanent placements, Hire'in Solutions offers a replacement guarantee (typically 60–90 days) at no additional fee.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border rounded-lg p-5 bg-card">
                <h3 className="font-semibold mb-2">{q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <Code2 className="h-10 w-10 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl font-bold mb-4">Ready to Hire IT Talent?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Tell us your requirement and receive qualified IT candidate profiles within 24 hours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" onClick={() => setConsultationOpen(true)} data-testid="button-itguide-cta-bottom">
              Request a Consultation
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
              <Link href="/request-a-quote">Get a Quote</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-primary-foreground/70">
            <span>See also:</span>
            <Link href="/why-hire-in-solutions" className="hover:text-white underline">Why Hire'in Solutions</Link>
            <Link href="/healthcare-staffing-guide" className="hover:text-white underline">Healthcare Staffing Guide</Link>
            <Link href="/staffing-faq" className="hover:text-white underline">Full Staffing FAQ</Link>
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
