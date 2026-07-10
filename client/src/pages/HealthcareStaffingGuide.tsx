import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle,
  Heart,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsultationModal } from "@/components/forms/ConsultationModal";

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Healthcare Staffing Services",
  provider: {
    "@type": "Organization",
    name: "Hire'in Solutions",
    url: "https://hire-in.com",
  },
  serviceType: "Healthcare Staffing",
  description:
    "Hire'in Solutions provides healthcare staffing services including travel nursing, locum tenens, allied health, and clinical staffing across all 50 US states with Joint Commission-aligned compliance.",
  areaServed: { "@type": "Country", name: "United States" },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Healthcare Staffing Engagements",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Travel Nurse Staffing" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Locum Tenens Physician Staffing" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Allied Health Staffing" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Per Diem Healthcare Staffing" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Permanent Clinical Placement" } },
    ],
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is healthcare staffing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Healthcare staffing is the process of sourcing, credentialing, and placing clinical professionals — nurses, physicians, allied health workers, and healthcare operations staff — into temporary (travel, per diem), contract, or permanent positions at hospitals, clinics, and healthcare facilities.",
      },
    },
    {
      "@type": "Question",
      name: "What is travel nursing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Travel nursing is a contract staffing model where registered nurses take 8–26 week assignments at facilities in need of temporary clinical coverage. Travel nurses are employed by a staffing agency, which handles payroll, housing stipends, and licensure compliance. Hire'in Solutions places travel nurses across all 50 US states.",
      },
    },
    {
      "@type": "Question",
      name: "What is locum tenens staffing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Locum tenens (Latin for 'holding the place') is a staffing model for physicians, nurse practitioners, and other advanced practice providers who take temporary assignments at healthcare facilities. Locum tenens fills gaps caused by vacations, leaves of absence, or sudden departures.",
      },
    },
    {
      "@type": "Question",
      name: "What is allied health staffing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Allied health staffing covers non-physician, non-nursing clinical professionals — including physical therapists, occupational therapists, respiratory therapists, medical technologists, radiology techs, and medical assistants. These roles are essential for care delivery and are frequently filled through staffing agencies.",
      },
    },
    {
      "@type": "Question",
      name: "What does Joint Commission alignment mean in healthcare staffing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The Joint Commission (TJC) sets standards for healthcare organization accreditation. Joint Commission-aligned staffing means the agency's credentialing and compliance processes match TJC requirements — including license verification, reference checks, competency assessments, and documentation standards. Hire'in Solutions' compliance team runs these checks and uses CredentialRx.ai (proKred.com) to automate public-directory license and exclusion lookups and compile audit-ready submission packets.",
      },
    },
    {
      "@type": "Question",
      name: "How does credential verification work for healthcare staffing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions' compliance team verifies credentials, runs background and reference checks, verifies DEA numbers for physicians, and validates certifications (BLS, ACLS, PALS). CredentialRx.ai (proKred.com) automates license checks against state boards' public directories and OIG/SAM-style exclusion screening, then compiles everything into a compliant submission packet for each candidate before they are presented to a facility.",
      },
    },
    {
      "@type": "Question",
      name: "What healthcare roles does Hire'in Solutions place?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hire'in Solutions places RNs, LPNs, CNAs, medical assistants, travel nurses, locum tenens physicians, CRNAs, nurse practitioners, physician assistants, physical therapists, occupational therapists, respiratory therapists, medical technologists, radiology technicians, telehealth nurses, and healthcare administrators.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to fill a healthcare staffing position?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Per diem and travel nurse placements can be arranged within 3–7 business days for facilities in the Hire'in Solutions network. New facility onboarding and credential verification for travel placements typically takes 5–10 business days. Locum tenens and permanent physician placements average 2–4 weeks.",
      },
    },
    {
      "@type": "Question",
      name: "Does Hire'in Solutions handle multi-state nurse licensure?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Hire'in Solutions tracks compact nursing license states and assists travel nurses with obtaining additional state licenses where required. The Nurse Licensure Compact (NLC) allows nurses to practice in multiple compact states on a single license. Hire'in Solutions operates in both compact and non-compact states.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between per diem and travel nursing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Per diem nurses work shift-by-shift on an as-needed basis, usually locally, with no guaranteed hours. Travel nurses commit to assignments of 8–26 weeks at a facility, often receiving housing stipends and travel reimbursements. Per diem offers flexibility; travel nursing offers stable income and often higher pay rates.",
      },
    },
  ],
};

const ENGAGEMENT_TYPES = [
  {
    icon: Heart,
    title: "Travel Nursing (Contract)",
    description:
      "Registered nurses on 8–26 week assignments at facilities with temporary coverage needs. Agency handles payroll, housing stipends, and licensure compliance. Available nationwide across all 50 states.",
    typical: "8–26 week assignments",
  },
  {
    icon: Stethoscope,
    title: "Locum Tenens",
    description:
      "Temporary physician, NP, and PA placements covering vacations, leaves, or sudden departures. Locum tenens providers are credentialed and ready to see patients with minimal ramp time.",
    typical: "Days to months",
  },
  {
    icon: Users,
    title: "Allied Health Contract",
    description:
      "Physical therapists, OTs, respiratory therapists, lab techs, and radiology techs on contract assignments. Covers both short-term (per diem) and extended contract needs.",
    typical: "Per shift or 13+ weeks",
  },
  {
    icon: ShieldCheck,
    title: "Permanent Clinical Placement",
    description:
      "Direct-hire placement of nurses, physicians, and allied health professionals on a permanent basis. Hire'in Solutions conducts full credentialing and compliance before presenting candidates.",
    typical: "Direct hire with guarantee",
  },
];

const HC_ROLES = [
  "Registered Nurses (RN)",
  "Licensed Practical Nurses (LPN)",
  "Certified Nursing Assistants (CNA)",
  "Medical Assistants",
  "Travel Nurses (all specialties)",
  "Physicians (MD/DO)",
  "Nurse Practitioners (NP)",
  "Physician Assistants (PA)",
  "CRNAs",
  "Physical Therapists (PT)",
  "Occupational Therapists (OT)",
  "Respiratory Therapists (RT)",
  "Medical Technologists",
  "Radiology Technicians",
  "Surgical Technologists",
  "Telehealth Nurses & Physicians",
  "Healthcare Administrators",
  "Medical Records Specialists",
  "Compliance Officers",
];

export default function HealthcareStaffingGuide() {
  useSEO({
    title: "Healthcare Staffing Guide: Travel Nursing, Locum Tenens & Allied Health | Hire'in Solutions",
    description:
      "Complete guide to healthcare staffing — travel nursing, locum tenens, allied health, credential verification, Joint Commission alignment, costs, and 10 FAQs. From Hire'in Solutions.",
    canonical: "https://hire-in.com/healthcare-staffing-guide",
  });

  const [consultationOpen, setConsultationOpen] = useState(false);

  return (
    <Layout>
      <SchemaHead schema={[SERVICE_SCHEMA, FAQ_SCHEMA]} />

      <section className="py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl">
          <p className="text-primary font-semibold tracking-wider uppercase text-xs mb-3">Healthcare Staffing Reference Guide</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Healthcare Staffing: A Complete Guide
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mb-8 leading-relaxed">
            Everything a healthcare facility, hospital, or clinic administrator needs to know about staffing for clinical roles — travel nursing, locum tenens, allied health, and permanent placements — including how AI-powered credential verification makes compliance faster and safer.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" onClick={() => setConsultationOpen(true)} data-testid="button-hcguide-cta">
              Staff Your Clinical Team <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/staffing-faq">Full Staffing FAQ</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">What Is Healthcare Staffing?</h2>
          <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
            <p>
              Healthcare staffing is the process of sourcing, credentialing, and placing clinical professionals — nurses, physicians, allied health workers, and healthcare operations staff — into temporary or permanent positions at hospitals, clinics, long-term care facilities, and telehealth platforms.
            </p>
            <p>
              Unlike general staffing, healthcare placements require extensive compliance work: license verification through state nursing boards, DEA number validation for prescribers, background checks, certification verification (BLS, ACLS, PALS), reference checks, health screenings, and facility-specific competency assessments. A healthcare staffing agency must maintain these records and deliver compliant submission packages for every candidate — before the candidate ever steps foot in a facility.
            </p>
            <p>
              Hire'in Solutions organizes this compliance layer using CredentialRx.ai (proKred.com), a proprietary compliance submission packet, credential sharing, and skill checklist tool that tracks credentials, flags expiring licenses, automates license and exclusion checks against public government directories, and compiles Joint Commission-aligned submission packets. This means every Hire'in Solutions healthcare placement arrives audit-ready from day one.
            </p>
          </div>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold mb-3 text-center">Engagement Types</h2>
          <p className="text-muted-foreground text-center mb-10">Choose the coverage model that fits your facility's need.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {ENGAGEMENT_TYPES.map(({ icon: Icon, title, description, typical }) => (
              <Card key={title}>
                <CardContent className="p-6">
                  <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-3">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
                  <div className="pt-3 border-t">
                    <p className="text-xs font-medium text-primary">Typical engagement:</p>
                    <p className="text-xs text-muted-foreground">{typical}</p>
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
          <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Clinical Roles We Place</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-10">
            {HC_ROLES.map((role) => (
              <div key={role} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                {role}
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mb-4">Compliance Coverage — Verified by Hire'in's Team, Packaged via CredentialRx.ai</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {[
              "State nursing license verification (all 50 states)",
              "Compact Nurse Licensure (NLC) tracking",
              "DEA number validation for prescribers",
              "BLS, ACLS, PALS, NRP certification verification",
              "Background checks and OIG/SAM exclusion screening",
              "Reference checks (minimum 2 clinical references)",
              "TB testing and immunization records",
              "Facility-specific onboarding documentation",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mb-4">Typical Fill Times</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Per Diem Shifts", value: "24–72 hours" },
              { label: "Travel Nurse Placement", value: "5–10 business days" },
              { label: "Locum Tenens / Permanent", value: "2–4 weeks" },
            ].map(({ label, value }) => (
              <div key={label} className="border rounded-lg p-4 text-center">
                <p className="text-xl font-bold text-primary mb-1">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">What Is Joint Commission Alignment?</h2>
          <div className="text-muted-foreground space-y-4 text-sm leading-relaxed mb-8">
            <p>
              The Joint Commission (TJC) accredits hospitals, clinics, and healthcare organizations against rigorous quality and safety standards. Part of TJC compliance involves documentation of healthcare worker credentials — licenses, certifications, competency assessments, and background checks.
            </p>
            <p>
              A Joint Commission-aligned staffing agency organizes its credentialing processes to match TJC documentation requirements. This means that when a TJC survey occurs, facilities using Hire'in Solutions have the right documentation already in place for every placed candidate.
            </p>
            <p>
              Hire'in Solutions's CredentialRx.ai tool structures candidate submission packets to TJC standards, flags expiring credentials, and maintains audit-ready documentation for the life of each placement.
            </p>
          </div>
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Hire'in Solutions Healthcare Compliance Summary</h3>
              <ul className="space-y-2">
                {[
                  "Joint Commission-aligned credentialing workflows",
                  "100% license verification before candidate submission",
                  "CredentialRx.ai automated document tracking",
                  "I-9 and E-Verify for all placements",
                  "HIPAA-ready data handling",
                  "OIG/SAM exclusion database screening",
                  "State-specific compliance for all 50 states",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-14 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-10 text-center">Healthcare Staffing FAQ</h2>
          <div className="space-y-5">
            {[
              {
                q: "What is healthcare staffing?",
                a: "Healthcare staffing is the process of sourcing, credentialing, and placing clinical professionals — nurses, physicians, allied health workers — into temporary or permanent positions at healthcare facilities.",
              },
              {
                q: "What is travel nursing?",
                a: "Travel nursing is a contract staffing model where registered nurses take 8–26 week assignments at facilities in need of temporary clinical coverage. Hire'in Solutions places travel nurses across all 50 US states.",
              },
              {
                q: "What is locum tenens staffing?",
                a: "Locum tenens covers temporary physician, NP, and PA assignments at healthcare facilities. It fills gaps caused by vacations, leaves, or sudden departures.",
              },
              {
                q: "What is allied health staffing?",
                a: "Allied health staffing covers non-physician, non-nursing clinical professionals — PTs, OTs, respiratory therapists, medical technologists, radiology techs, and medical assistants.",
              },
              {
                q: "What does Joint Commission alignment mean in healthcare staffing?",
                a: "It means the agency's credentialing and compliance processes match TJC requirements — license verification, reference checks, competency assessments, and documentation standards. Hire'in's compliance team runs these checks; CredentialRx.ai automates public-directory license lookups and compiles the audit-ready submission packet.",
              },
              {
                q: "How does credential verification work?",
                a: "Hire'in's compliance team validates DEA numbers and verifies certifications (BLS, ACLS, PALS). CredentialRx.ai (proKred.com) checks nursing licenses via state boards' public directories, runs exclusion screening, and compiles a compliant submission packet before presenting any candidate.",
              },
              {
                q: "What healthcare roles does Hire'in Solutions place?",
                a: "RNs, LPNs, CNAs, medical assistants, travel nurses, locum tenens physicians, CRNAs, NPs, PAs, PTs, OTs, respiratory therapists, medical technologists, radiology techs, telehealth nurses, and healthcare administrators.",
              },
              {
                q: "How long does it take to fill a healthcare position?",
                a: "Per diem shifts: 24–72 hours. Travel nurse placements: 5–10 business days. Locum tenens and permanent physician placements: 2–4 weeks.",
              },
              {
                q: "Does Hire'in Solutions handle multi-state nurse licensure?",
                a: "Yes. We track compact nursing license states and assist travel nurses with obtaining additional state licenses where required.",
              },
              {
                q: "What is the difference between per diem and travel nursing?",
                a: "Per diem nurses work shift-by-shift locally with no guaranteed hours. Travel nurses commit to 8–26 week assignments, often with housing stipends and higher pay rates.",
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
          <Stethoscope className="h-10 w-10 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl font-bold mb-4">Ready to Staff Your Clinical Team?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Tell us your coverage needs — travel nurses, locum tenens, or allied health — and receive verified candidate submissions with compliant packages.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" onClick={() => setConsultationOpen(true)} data-testid="button-hcguide-cta-bottom">
              Request a Consultation
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
              <Link href="/request-a-quote">Get a Quote</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-primary-foreground/70">
            <span>See also:</span>
            <Link href="/why-hire-in-solutions" className="hover:text-white underline">Why Hire'in Solutions</Link>
            <Link href="/it-staffing-guide" className="hover:text-white underline">IT Staffing Guide</Link>
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
