import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, HelpCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { ConsultationModal } from "@/components/forms/ConsultationModal";
import { useCompanyProfile } from "@/hooks/use-company-profile";
import type { CompanyProfile } from "@shared/companyProfile";

const buildAllFaqs = (profile: CompanyProfile) => [
  {
    category: "General Staffing",
    questions: [
      {
        q: "What is a staffing agency?",
        a: "A staffing agency sources, screens, and places candidates in contract, contract-to-hire, or permanent roles at client companies. The agency earns revenue as a markup on contractor billing rates (for temporary placements) or as a placement fee (for direct hire). The agency handles recruiting, screening, and — for contract roles — payroll, benefits, and compliance.",
      },
      {
        q: "What is the difference between a staffing agency and a recruiting firm?",
        a: "Staffing agencies typically focus on contract and temporary placements, acting as the employer of record. Recruiting firms (also called search firms or headhunters) focus primarily on permanent direct-hire placements. Many agencies, including Hire'in Solutions, do both.",
      },
      {
        q: "How does Hire'in Solutions make money?",
        a: "For contract placements: a markup on the contractor's hourly pay rate (typically 25–50%), covering payroll taxes, benefits, and agency overhead. For permanent placements: a placement fee equal to 15–20% of the placed candidate's first-year annual salary, due on the candidate's start date.",
      },
      {
        q: "What industries does Hire'in Solutions serve?",
        a: "Healthcare (travel nursing, locum tenens, allied health, clinical operations), IT & Technology (software engineers, DevOps, cloud, cybersecurity, data), Engineering & Technical (mechanical, industrial, civil, chemical), and Professional Services (finance, accounting, marketing, operations).",
      },
      {
        q: "Does Hire'in Solutions work with job seekers or only employers?",
        a: `Both. Employers submit hiring requirements and receive pre-screened candidates. Job seekers can submit their profiles to be considered for current and upcoming roles. Contact ${profile.emails.careers} to explore opportunities.`,
      },
      {
        q: "Does Hire'in Solutions work with government clients?",
        a: `Yes. Hire'in Solutions (${profile.legalName}) holds CAGE code ${profile.cage} and UEI ${profile.uei}, enabling participation in federal and state government contracts.`,
      },
    ],
  },
  {
    category: "IT & Technology Staffing",
    questions: [
      {
        q: "What IT roles can Hire'in Solutions fill?",
        a: "Software engineers (Java, Python, JavaScript, C#, Go), frontend and backend developers, full-stack developers, mobile developers (iOS, Android, React Native), DevOps and cloud engineers (AWS, Azure, GCP, Kubernetes), data scientists and ML engineers, cybersecurity analysts and engineers, QA/test engineers, IT project managers, business analysts, and enterprise platform consultants (SAP, Salesforce, ServiceNow).",
      },
      {
        q: "How quickly can Hire'in Solutions fill an IT role?",
        a: "First qualified candidate submissions arrive within 24 hours of requirement receipt for most IT roles. Common roles (Java developers, QA engineers, business analysts) can be fully filled in 5–10 business days. Senior architects or niche specialists typically take 2–4 weeks.",
      },
      {
        q: "What is IT contract staffing?",
        a: "IT contract staffing places technology professionals on a fixed-term engagement (typically 3–12 months) at a client company. The staffing agency employs the contractor (W2) or pays their entity (corp-to-corp), handling payroll, taxes, and benefits. The client pays an hourly bill rate.",
      },
      {
        q: "What is corp-to-corp (C2C) IT staffing?",
        a: "C2C is a contract arrangement where the IT professional operates through their own LLC or S-Corp. The staffing agency pays that business entity rather than the individual. Common for senior IT consultants and independent contractors with established businesses.",
      },
      {
        q: "Can Hire'in Solutions place fully remote IT workers?",
        a: "Yes, across all 50 US states with multi-state payroll compliance built in.",
      },
      {
        q: "How does AI improve IT candidate matching?",
        a: "Hire'in Solutions uses kleriq.AI, a proprietary platform that parses resumes, extracts and verifies skills, scores candidates against job requirements, and predicts retention risk. This achieves 92% match accuracy and reduces time-to-shortlist by 80% compared to manual screening.",
      },
      {
        q: "What tech stacks does Hire'in Solutions recruit for?",
        a: "Java, Python, JavaScript, TypeScript, React, Node.js, Go, Rust, C#/.NET, AWS, Azure, GCP, Kubernetes, Docker, PostgreSQL, MongoDB, Kafka, Spark, TensorFlow, PyTorch, Salesforce, SAP, ServiceNow, and more.",
      },
    ],
  },
  {
    category: "Healthcare Staffing",
    questions: [
      {
        q: "What healthcare roles does Hire'in Solutions place?",
        a: "RNs, LPNs, CNAs, medical assistants, travel nurses (all specialties), locum tenens physicians (MD/DO), nurse practitioners (NP), physician assistants (PA), CRNAs, physical therapists, occupational therapists, respiratory therapists, medical technologists, radiology technicians, surgical technologists, telehealth nurses and physicians, healthcare administrators, and compliance officers.",
      },
      {
        q: "What is travel nursing?",
        a: "Travel nursing is a contract staffing model where RNs take 8–26 week assignments at facilities with temporary coverage needs. The agency handles payroll, housing stipends, and licensure compliance. Hire'in Solutions places travel nurses in all 50 US states.",
      },
      {
        q: "What is locum tenens?",
        a: "Locum tenens covers temporary physician, NP, and PA assignments at healthcare facilities to fill gaps from vacations, leaves, or sudden departures.",
      },
      {
        q: "What does Joint Commission-aligned staffing mean?",
        a: "It means the agency's credentialing processes match TJC documentation requirements — license verification, reference checks, competency assessments — so every placement is audit-ready for a TJC survey.",
      },
      {
        q: "How does Hire'in Solutions verify healthcare credentials?",
        a: "Hire'in's compliance team runs background checks, reference checks, DEA number validation for prescribers, and BLS/ACLS/PALS/NRP certification verification. CredentialRx.ai (proKred.com) automates license verification and blacklist/exclusion checks against public government directories — state nursing board license lookups and OIG/SAM exclusion screening — and compiles everything into a compliant submission packet before any candidate is presented.",
      },
      {
        q: "Does Hire'in Solutions handle multi-state nurse licensure?",
        a: "Yes. We track compact nursing license (NLC) states and assist travel nurses with obtaining additional state licenses where required.",
      },
      {
        q: "How quickly can healthcare positions be filled?",
        a: "Per diem shifts: 24–72 hours. Travel nurse placements: 5–10 business days. Locum tenens and permanent placements: 2–4 weeks.",
      },
    ],
  },
  {
    category: "Engineering & Professional Services",
    questions: [
      {
        q: "What engineering roles does Hire'in Solutions recruit for?",
        a: "Mechanical engineers, electrical engineers, civil engineers, chemical engineers, industrial engineers, process engineers, manufacturing engineers, quality engineers, and project engineers across industries including energy, defense, construction, and manufacturing.",
      },
      {
        q: "What professional services roles does Hire'in Solutions fill?",
        a: "Finance and accounting professionals (CFOs, controllers, analysts), marketing and communications professionals, operations managers, project managers, HR professionals, administrative and executive assistants, and business development professionals.",
      },
      {
        q: "Does Hire'in Solutions do engineering contract staffing?",
        a: "Yes. Engineering contract placements are available on W2 or corp-to-corp basis for project-based or staff augmentation needs.",
      },
    ],
  },
  {
    category: "Pricing & Timelines",
    questions: [
      {
        q: "How much does contract staffing cost?",
        a: "Contract staffing is priced as an hourly bill rate — the candidate's pay rate plus a markup (typically 25–50%) that covers payroll taxes, benefits, workers' compensation, and agency overhead. You pay only for hours worked.",
      },
      {
        q: "How much does direct hire (permanent placement) staffing cost?",
        a: "Direct hire is priced as a percentage of the placed candidate's first-year annual salary — typically 15–20%. The fee is due upon the candidate's start date.",
      },
      {
        q: "Is there a replacement guarantee?",
        a: "Yes. Permanent placements include a replacement guarantee (typically 60–90 days). If the placed candidate leaves or is terminated for performance within that period, Hire'in Solutions will conduct a replacement search at no additional fee.",
      },
      {
        q: "Are there any upfront fees?",
        a: "No upfront fees for employers. Hire'in Solutions earns its fee only upon successful placement (for direct hire) or as part of ongoing contractor billing (for contract roles).",
      },
      {
        q: "How quickly will I receive my first candidate submissions?",
        a: "Within 24 hours for IT and most contract roles. Healthcare roles requiring credential verification typically take 3–7 business days for first submissions.",
      },
    ],
  },
  {
    category: "Compliance & Onboarding",
    questions: [
      {
        q: "Does Hire'in Solutions handle I-9 and E-Verify?",
        a: "Yes. All placements include I-9 verification and E-Verify enrollment as required by federal law.",
      },
      {
        q: "Who handles payroll for contract placements?",
        a: "Hire'in Solutions acts as employer of record for W2 contractors. We handle payroll, tax withholding, W-2 issuance, workers' compensation, and unemployment insurance. For C2C contractors, we pay their business entity per the agreed billing schedule.",
      },
      {
        q: "Does Hire'in Solutions conduct background checks?",
        a: "Yes. Standard background checks include criminal history, employment verification, and education verification. Additional checks (drug screening, credit checks, OIG/SAM exclusion for healthcare) are conducted based on role requirements.",
      },
      {
        q: "What is the MSP (Managed Service Provider) model?",
        a: "An MSP model centralizes all contingent workforce management through a single agency. Hire'in Solutions can serve as an MSP for healthcare facilities needing coordinated multi-vendor staffing management and consolidated reporting.",
      },
    ],
  },
];

const buildFaqSchema = (faqs: ReturnType<typeof buildAllFaqs>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.flatMap((cat) =>
    cat.questions.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    }))
  ),
});

export default function StaffingFAQ() {
  useSEO({
    title: "Staffing FAQ: 30+ Questions Answered — IT, Healthcare, Engineering | Hire'in Solutions",
    description:
      "Comprehensive answers to 30+ staffing questions covering IT staffing, healthcare staffing, engineering recruitment, pricing, timelines, compliance, and how Hire'in Solutions works.",
    canonical: "https://hire-in.com/staffing-faq",
  });

  const [consultationOpen, setConsultationOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const profile = useCompanyProfile();

  const allFaqs = buildAllFaqs(profile);
  const displayedFAQs = activeCategory
    ? allFaqs.filter((c) => c.category === activeCategory)
    : allFaqs;

  return (
    <Layout>
      <SchemaHead schema={buildFaqSchema(allFaqs)} />

      <section className="py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <HelpCircle className="h-6 w-6 text-primary" />
            <p className="text-primary font-semibold tracking-wider uppercase text-xs">Staffing FAQ</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Staffing Questions, Answered
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            30+ plain-language answers to the questions employers most commonly ask about IT staffing, healthcare staffing, engineering recruitment, pricing, timelines, and compliance — from Hire'in Solutions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => setConsultationOpen(true)} data-testid="button-faq-cta">
              Talk to a Recruiter <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/request-a-quote">Get a Quote</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-4 px-4 border-b bg-card">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center gap-2 justify-center">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid="filter-all"
            >
              All Topics
            </button>
            {allFaqs.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(cat.category === activeCategory ? null : cat.category)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.category
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`filter-${cat.category.toLowerCase().replace(/\s/g, "-")}`}
              >
                {cat.category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl">
          {displayedFAQs.map((cat) => (
            <div key={cat.category} className="mb-12">
              <h2 className="text-2xl font-bold mb-6 pb-2 border-b">{cat.category}</h2>
              <div className="space-y-4">
                {cat.questions.map(({ q, a }) => (
                  <div key={q} className="border rounded-lg p-5">
                    <h3 className="font-semibold mb-2">{q}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 px-4 border-t">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold mb-4">Didn't find your answer?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            These FAQs cover the most common questions. For specific situations — unusual engagement types, government contracting, MSP arrangements, or compliance questions for specialized healthcare roles — contact us directly.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setConsultationOpen(true)} data-testid="button-faq-contact">
              Request a Consultation
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">Contact Page</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/why-hire-in-solutions">About Hire'in Solutions</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-lg font-semibold mb-4">Explore Our Detailed Guides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: "Why Hire'in Solutions", desc: "Who we are, our identity, and key differentiators", href: "/why-hire-in-solutions" },
              { title: "IT Staffing Guide", desc: "Complete guide to hiring tech talent through a staffing agency", href: "/it-staffing-guide" },
              { title: "Healthcare Staffing Guide", desc: "Travel nursing, locum tenens, allied health, compliance", href: "/healthcare-staffing-guide" },
            ].map(({ title, desc, href }) => (
              <Link key={href} href={href} className="block p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors">
                <h3 className="font-semibold text-sm mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </Link>
            ))}
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
