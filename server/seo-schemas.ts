import { db } from "./db";
import { jobs } from "@shared/schema";
import { eq } from "drizzle-orm";

function mapEmploymentType(jobType: string | null | undefined): string {
  if (!jobType) return "OTHER";
  const t = jobType.toUpperCase();
  if (t.includes("FULL") && t.includes("TIME")) return "FULL_TIME";
  if (t.includes("PART") && t.includes("TIME")) return "PART_TIME";
  if (t.includes("CONTRACT") || t.includes("1099") || t.includes("C2C")) return "CONTRACTOR";
  if (t.includes("TEMP") || t.includes("TRAVEL")) return "TEMPORARY";
  if (t.includes("INTERN")) return "INTERN";
  if (t.includes("PER_DIEM") || t.includes("PER DIEM")) return "PER_DIEM";
  return "OTHER";
}

const IT_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "IT Staffing Services",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "IT Staffing",
  description: "AI-powered IT staffing with 100+ successful talent engagements, 24-hour submissions, and 95% client retention. Engineers, developers, architects, and technology leaders.",
  areaServed: { "@type": "Country", name: "United States" },
};

const EHEALTHCARE_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Healthcare Staffing Services",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "Healthcare Staffing",
  description: "AI-powered healthcare staffing with Joint Commission-aligned workflows. Travel nursing, locum tenens, allied health, and clinical recruitment across all 50 US states.",
  areaServed: { "@type": "Country", name: "United States" },
};

const CONTRACT_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Contract Staffing Solutions",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "Contract Staffing",
  description: "Flexible contract staffing for Healthcare, IT, Engineering, Finance, and Professional Services. Hire'in Solutions handles sourcing, compliance, and onboarding.",
  areaServed: { "@type": "Country", name: "United States" },
};

const IT_SOFTWARE_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "IT & Software Development Staffing",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "IT Staffing",
  description: "Full-spectrum IT and software development staffing — engineers, DevOps, cloud, data, cybersecurity. AI-powered matching with kleriq.AI. 24-hour first candidate submissions.",
  areaServed: { "@type": "Country", name: "United States" },
};

const HC_RECRUITMENT_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Healthcare Recruitment Services",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "Healthcare Recruitment",
  description: "AI-powered healthcare recruitment for nurses, physicians, and allied health professionals. Joint Commission-aligned workflows, compliant submission packets via CredentialRx.ai, across all 50 US states.",
  areaServed: { "@type": "Country", name: "United States" },
};

const ENGINEERING_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Engineering & Technical Staffing",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "Engineering Staffing",
  description: "Hire'in Solutions sources and places mechanical, electrical, civil, and technical engineers for contract and direct-hire roles across the United States.",
  areaServed: { "@type": "Country", name: "United States" },
};

const PROFESSIONAL_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Professional Services Staffing",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "Professional Services Staffing",
  description: "Hire'in Solutions delivers skilled professionals in finance, HR, operations, and business management across all 50 US states.",
  areaServed: { "@type": "Country", name: "United States" },
};

const REQUEST_QUOTE_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Staffing Agency Services",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "Staffing Agency",
  description: "Request a staffing quote from Hire'in Solutions — AI-powered recruitment for Healthcare, IT, Engineering, and Professional Services across all 50 US states.",
  areaServed: { "@type": "Country", name: "United States" },
};

const HC_GUIDE_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Healthcare Staffing Services",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "Healthcare Staffing",
  description: "Hire'in Solutions provides healthcare staffing services including travel nursing, locum tenens, allied health, and clinical staffing across all 50 US states with Joint Commission-aligned compliance.",
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

const HC_GUIDE_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is healthcare staffing?", acceptedAnswer: { "@type": "Answer", text: "Healthcare staffing is the process of sourcing, credentialing, and placing clinical professionals — nurses, physicians, allied health workers, and healthcare operations staff — into temporary (travel, per diem), contract, or permanent positions at hospitals, clinics, and healthcare facilities." } },
    { "@type": "Question", name: "What is travel nursing?", acceptedAnswer: { "@type": "Answer", text: "Travel nursing is a contract staffing model where registered nurses take 8–26 week assignments at facilities in need of temporary clinical coverage. Travel nurses are employed by a staffing agency, which handles payroll, housing stipends, and licensure compliance. Hire'in Solutions places travel nurses across all 50 US states." } },
    { "@type": "Question", name: "What is locum tenens staffing?", acceptedAnswer: { "@type": "Answer", text: "Locum tenens (Latin for 'holding the place') is a staffing model for physicians, nurse practitioners, and other advanced practice providers who take temporary assignments at healthcare facilities. Locum tenens fills gaps caused by vacations, leaves of absence, or sudden departures." } },
    { "@type": "Question", name: "What is allied health staffing?", acceptedAnswer: { "@type": "Answer", text: "Allied health staffing covers non-physician, non-nursing clinical professionals — including physical therapists, occupational therapists, respiratory therapists, medical technologists, radiology techs, and medical assistants. These roles are essential for care delivery and are frequently filled through staffing agencies." } },
    { "@type": "Question", name: "What does Joint Commission alignment mean in healthcare staffing?", acceptedAnswer: { "@type": "Answer", text: "The Joint Commission (TJC) sets standards for healthcare organization accreditation. Joint Commission-aligned staffing means the agency's credentialing and compliance processes match TJC requirements — including license verification, reference checks, competency assessments, and documentation standards. Hire'in Solutions' compliance team runs these checks and uses CredentialRx.ai (proKred.com) to automate public-directory license and exclusion lookups and compile audit-ready submission packets." } },
    { "@type": "Question", name: "How does credential verification work for healthcare staffing?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions' compliance team verifies credentials, runs background and reference checks, verifies DEA numbers for physicians, and validates certifications (BLS, ACLS, PALS). CredentialRx.ai (proKred.com) automates license checks against state boards' public directories and OIG/SAM-style exclusion screening, then compiles everything into a compliant submission packet for each candidate before they are presented to a facility." } },
  ],
};

const IT_GUIDE_HOWTO_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Hire Software Engineers Through a Staffing Agency",
  description: "A step-by-step guide to hiring IT and software engineers through a staffing agency like Hire'in Solutions.",
  step: [
    { "@type": "HowToStep", name: "Define the role and engagement type", text: "Decide whether you need a contractor (W2 or corp-to-corp), contract-to-hire, or direct permanent hire. Specify the tech stack, seniority level, location preference (on-site, hybrid, remote), and timeline." },
    { "@type": "HowToStep", name: "Submit requirements to the staffing agency", text: "Share the job description, required skills, rate or salary range, and must-have vs. nice-to-have criteria. A specialized IT staffing agency will use this to configure their AI matching and recruiter search." },
    { "@type": "HowToStep", name: "Review candidate submissions", text: "Within 24 hours for most roles, you'll receive pre-screened candidate profiles with match scores, recruiter notes, and availability. Review and shortlist based on your criteria." },
    { "@type": "HowToStep", name: "Conduct technical interviews", text: "The agency's recruiters have already done a first pass. Your technical interview focuses on domain depth, architecture thinking, and team fit. The agency can provide reference contacts and technical screening notes." },
    { "@type": "HowToStep", name: "Extend an offer and onboard", text: "For contract roles, the staffing agency handles payroll, benefits, and compliance. For direct hire, the agency facilitates the offer process and delivers a placement guarantee for a defined period." },
  ],
};

const IT_GUIDE_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is IT staffing?", acceptedAnswer: { "@type": "Answer", text: "IT staffing is the process of sourcing, screening, and placing technology professionals — including software engineers, DevOps engineers, data scientists, and cybersecurity specialists — into contract, contract-to-hire, or permanent roles at client companies." } },
    { "@type": "Question", name: "What is the difference between contract and permanent IT staffing?", acceptedAnswer: { "@type": "Answer", text: "Contract IT staffing places candidates on a fixed-term engagement (typically 3–12 months), with the staffing agency handling payroll and compliance. Permanent (direct hire) staffing places candidates directly on the client's payroll with no fixed end date. Contract-to-hire starts as a contract with an option to convert to permanent employment." } },
    { "@type": "Question", name: "How fast can a staffing agency fill an IT role?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions delivers first qualified candidate submissions within 24 hours for most IT roles. Time-to-fill depends on role seniority and market availability — common roles like Java developers or QA engineers can be filled in 5–10 business days; senior architects or niche specialists may take 2–4 weeks." } },
    { "@type": "Question", name: "What IT roles can Hire'in Solutions fill?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions fills software engineers (Java, Python, JavaScript, React, Node.js), DevOps and cloud engineers (AWS, Azure, GCP, Kubernetes), data scientists and ML engineers, cybersecurity analysts and engineers, QA/test engineers, IT project managers, business analysts, and enterprise platform consultants (SAP, Salesforce, ServiceNow)." } },
    { "@type": "Question", name: "What does IT staffing cost?", acceptedAnswer: { "@type": "Answer", text: "IT contract staffing is typically priced as an hourly bill rate — the candidate's pay rate plus a markup (usually 25–50%) covering payroll taxes, benefits, and agency overhead. Direct hire placements are priced as a percentage of the candidate's first-year salary, typically 15–20%. Hire'in Solutions provides firm quotes before any placement." } },
    { "@type": "Question", name: "Can Hire'in Solutions place remote IT workers?", acceptedAnswer: { "@type": "Answer", text: "Yes. Hire'in Solutions places IT professionals in remote, hybrid, and on-site roles across all 50 US states. Remote placements include compliance with state-specific employment law for multi-state payroll." } },
    { "@type": "Question", name: "How does AI improve IT staffing?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions uses kleriq.AI, a proprietary AI platform that parses resumes, extracts skills and experience, scores candidates against job requirements, and predicts retention risk. This achieves 92% match accuracy and reduces time-to-shortlist by 80% compared to manual recruiter screening." } },
    { "@type": "Question", name: "What is corp-to-corp (C2C) IT staffing?", acceptedAnswer: { "@type": "Answer", text: "Corp-to-corp (C2C) is an arrangement where the IT professional works as a contractor through their own business entity (LLC or S-Corp), and the staffing agency pays that entity rather than the individual. C2C is common for senior IT consultants and independent contractors with established businesses. Hire'in Solutions supports both W2 contract and C2C engagements." } },
  ],
};

const WHYHIREIN_ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://hire-in.com/#organization",
  name: "Hire'in Solutions",
  legalName: "Rayomind Software Solutions LLC",
  url: "https://hire-in.com",
  foundingDate: "2014",
  description: "Hire'in Solutions is an AI-powered staffing agency specializing in Healthcare, IT, Engineering, and Professional Services recruitment across all 50 US states.",
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
  knowsAbout: ["Healthcare Staffing", "IT Staffing", "Engineering Recruitment", "Contract Staffing", "AI-Powered Recruitment"],
};

const WHYHIREIN_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is Hire'in Solutions?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions (legal name: Rayomind Software Solutions LLC) is an AI-powered staffing agency founded in 2014, headquartered in San Jose, CA. The agency specializes in Healthcare, IT, Engineering, and Professional Services staffing across all 50 US states." } },
    { "@type": "Question", name: "What industries does Hire'in Solutions serve?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions serves four primary industries: Healthcare (travel nursing, locum tenens, allied health), IT & Technology (software engineers, DevOps, cybersecurity, data), Engineering & Technical (industrial, mechanical, civil), and Professional Services (finance, marketing, operations)." } },
    { "@type": "Question", name: "What makes Hire'in Solutions different from other staffing agencies?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions uses proprietary AI tools including kleriq.AI for IT talent matching and CredentialRx.ai (proKred.com), a compliance submission packet, credential sharing, and skill checklist tool that automates license and exclusion checks against public government directories. This enables 24-hour first candidate submissions, 92% AI match accuracy, and 95% client retention — faster and more accurate than traditional staffing methods." } },
    { "@type": "Question", name: "Where is Hire'in Solutions located?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions has its US headquarters at 2621 Leigh Ave., San Jose, CA-95124, United States, and a delivery center in Suite No-101, Pocket-6, Sector-2, Rohini, New Delhi, 110085, India." } },
    { "@type": "Question", name: "Does Hire'in Solutions work with government contracts?", acceptedAnswer: { "@type": "Answer", text: "Yes. Hire'in Solutions holds a CAGE code (206Q6) and UEI number (J36BQRPL2WN3) for government contracting purposes." } },
  ],
};

const STAFFINGFAQ_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is a staffing agency?", acceptedAnswer: { "@type": "Answer", text: "A staffing agency sources, screens, and places candidates in contract, contract-to-hire, or permanent roles at client companies. The agency earns revenue as a markup on contractor billing rates (for temporary placements) or as a placement fee (for direct hire). The agency handles recruiting, screening, and — for contract roles — payroll, benefits, and compliance." } },
    { "@type": "Question", name: "What is the difference between a staffing agency and a recruiting firm?", acceptedAnswer: { "@type": "Answer", text: "Staffing agencies typically focus on contract and temporary placements, acting as the employer of record. Recruiting firms (also called search firms or headhunters) focus primarily on permanent direct-hire placements. Many agencies, including Hire'in Solutions, do both." } },
    { "@type": "Question", name: "How does Hire'in Solutions make money?", acceptedAnswer: { "@type": "Answer", text: "For contract placements: a markup on the contractor's hourly pay rate (typically 25–50%), covering payroll taxes, benefits, and agency overhead. For permanent placements: a placement fee equal to 15–20% of the placed candidate's first-year annual salary, due on the candidate's start date." } },
    { "@type": "Question", name: "What industries does Hire'in Solutions serve?", acceptedAnswer: { "@type": "Answer", text: "Healthcare (travel nursing, locum tenens, allied health, clinical operations), IT & Technology (software engineers, DevOps, cloud, cybersecurity, data), Engineering & Technical (mechanical, industrial, civil, chemical), and Professional Services (finance, accounting, marketing, operations)." } },
    { "@type": "Question", name: "Does Hire'in Solutions work with job seekers or only employers?", acceptedAnswer: { "@type": "Answer", text: "Both. Employers submit hiring requirements and receive pre-screened candidates. Job seekers can submit their profiles to be considered for current and upcoming roles. Contact careers@hire-in.com to explore opportunities." } },
    { "@type": "Question", name: "Does Hire'in Solutions work with government clients?", acceptedAnswer: { "@type": "Answer", text: "Yes. Hire'in Solutions (Rayomind Software Solutions LLC) holds CAGE code 206Q6 and UEI J36BQRPL2WN3, enabling participation in federal and state government contracts." } },
    { "@type": "Question", name: "What IT roles can Hire'in Solutions fill?", acceptedAnswer: { "@type": "Answer", text: "Software engineers (Java, Python, JavaScript, C#, Go), frontend and backend developers, full-stack developers, mobile developers (iOS, Android, React Native), DevOps and cloud engineers (AWS, Azure, GCP, Kubernetes), data scientists and ML engineers, cybersecurity analysts and engineers, QA/test engineers, IT project managers, business analysts, and enterprise platform consultants (SAP, Salesforce, ServiceNow)." } },
    { "@type": "Question", name: "How quickly can Hire'in Solutions fill an IT role?", acceptedAnswer: { "@type": "Answer", text: "First qualified candidate submissions arrive within 24 hours of requirement receipt for most IT roles. Common roles (Java developers, QA engineers, business analysts) can be fully filled in 5–10 business days. Senior architects or niche specialists typically take 2–4 weeks." } },
    { "@type": "Question", name: "What is IT contract staffing?", acceptedAnswer: { "@type": "Answer", text: "IT contract staffing places technology professionals on a fixed-term engagement (typically 3–12 months) at a client company. The staffing agency employs the contractor (W2) or pays their entity (corp-to-corp), handling payroll, taxes, and benefits. The client pays an hourly bill rate." } },
    { "@type": "Question", name: "What is corp-to-corp (C2C) IT staffing?", acceptedAnswer: { "@type": "Answer", text: "C2C is a contract arrangement where the IT professional operates through their own LLC or S-Corp. The staffing agency pays that business entity rather than the individual. Common for senior IT consultants and independent contractors with established businesses." } },
    { "@type": "Question", name: "Can Hire'in Solutions place fully remote IT workers?", acceptedAnswer: { "@type": "Answer", text: "Yes, across all 50 US states with multi-state payroll compliance built in." } },
    { "@type": "Question", name: "How does AI improve IT candidate matching?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions uses kleriq.AI, a proprietary platform that parses resumes, extracts and verifies skills, scores candidates against job requirements, and predicts retention risk. This achieves 92% match accuracy and reduces time-to-shortlist by 80% compared to manual screening." } },
    { "@type": "Question", name: "What healthcare roles does Hire'in Solutions place?", acceptedAnswer: { "@type": "Answer", text: "RNs, LPNs, CNAs, medical assistants, travel nurses (all specialties), locum tenens physicians (MD/DO), nurse practitioners (NP), physician assistants (PA), CRNAs, physical therapists, occupational therapists, respiratory therapists, medical technologists, radiology technicians, surgical technologists, telehealth nurses and physicians, healthcare administrators, and compliance officers." } },
    { "@type": "Question", name: "What is travel nursing?", acceptedAnswer: { "@type": "Answer", text: "Travel nursing is a contract staffing model where RNs take 8–26 week assignments at facilities with temporary coverage needs. The agency handles payroll, housing stipends, and licensure compliance. Hire'in Solutions places travel nurses in all 50 US states." } },
    { "@type": "Question", name: "What is locum tenens?", acceptedAnswer: { "@type": "Answer", text: "Locum tenens covers temporary physician, NP, and PA assignments at healthcare facilities to fill gaps from vacations, leaves, or sudden departures." } },
    { "@type": "Question", name: "What does Joint Commission-aligned staffing mean?", acceptedAnswer: { "@type": "Answer", text: "It means the agency's credentialing processes match TJC documentation requirements — license verification, reference checks, competency assessments — so every placement is audit-ready for a TJC survey." } },
    { "@type": "Question", name: "How does Hire'in Solutions verify healthcare credentials?", acceptedAnswer: { "@type": "Answer", text: "Hire'in's compliance team runs background checks, reference checks, DEA number validation for prescribers, and BLS/ACLS/PALS/NRP certification verification. CredentialRx.ai (proKred.com) automates license verification and blacklist/exclusion checks against public government directories — state nursing board license lookups and OIG/SAM exclusion screening — and compiles everything into a compliant submission packet before any candidate is presented." } },
    { "@type": "Question", name: "Does Hire'in Solutions handle multi-state nurse licensure?", acceptedAnswer: { "@type": "Answer", text: "Yes. We track compact nursing license (NLC) states and assist travel nurses with obtaining additional state licenses where required." } },
    { "@type": "Question", name: "How quickly can healthcare positions be filled?", acceptedAnswer: { "@type": "Answer", text: "Per diem shifts: 24–72 hours. Travel nurse placements: 5–10 business days. Locum tenens and permanent placements: 2–4 weeks." } },
    { "@type": "Question", name: "What engineering roles does Hire'in Solutions recruit for?", acceptedAnswer: { "@type": "Answer", text: "Mechanical engineers, electrical engineers, civil engineers, chemical engineers, industrial engineers, process engineers, manufacturing engineers, quality engineers, and project engineers across industries including energy, defense, construction, and manufacturing." } },
    { "@type": "Question", name: "What professional services roles does Hire'in Solutions fill?", acceptedAnswer: { "@type": "Answer", text: "Finance and accounting professionals (CFOs, controllers, analysts), marketing and communications professionals, operations managers, project managers, HR professionals, administrative and executive assistants, and business development professionals." } },
    { "@type": "Question", name: "How much does contract staffing cost?", acceptedAnswer: { "@type": "Answer", text: "Contract staffing is priced as an hourly bill rate — the candidate's pay rate plus a markup (typically 25–50%) that covers payroll taxes, benefits, workers' compensation, and agency overhead. You pay only for hours worked." } },
    { "@type": "Question", name: "How much does direct hire (permanent placement) staffing cost?", acceptedAnswer: { "@type": "Answer", text: "Direct hire is priced as a percentage of the placed candidate's first-year annual salary — typically 15–20%. The fee is due upon the candidate's start date." } },
    { "@type": "Question", name: "Is there a replacement guarantee?", acceptedAnswer: { "@type": "Answer", text: "Yes. Permanent placements include a replacement guarantee (typically 60–90 days). If the placed candidate leaves or is terminated for performance within that period, Hire'in Solutions will conduct a replacement search at no additional fee." } },
    { "@type": "Question", name: "Are there any upfront fees?", acceptedAnswer: { "@type": "Answer", text: "No upfront fees for employers. Hire'in Solutions earns its fee only upon successful placement (for direct hire) or as part of ongoing contractor billing (for contract roles)." } },
    { "@type": "Question", name: "How quickly will I receive my first candidate submissions?", acceptedAnswer: { "@type": "Answer", text: "Within 24 hours for IT and most contract roles. Healthcare roles requiring credential verification typically take 3–7 business days for first submissions." } },
    { "@type": "Question", name: "Does Hire'in Solutions handle I-9 and E-Verify?", acceptedAnswer: { "@type": "Answer", text: "Yes. All placements include I-9 verification and E-Verify enrollment as required by federal law." } },
    { "@type": "Question", name: "Who handles payroll for contract placements?", acceptedAnswer: { "@type": "Answer", text: "Hire'in Solutions acts as employer of record for W2 contractors. We handle payroll, tax withholding, W-2 issuance, workers' compensation, and unemployment insurance. For C2C contractors, we pay their business entity per the agreed billing schedule." } },
    { "@type": "Question", name: "Does Hire'in Solutions conduct background checks?", acceptedAnswer: { "@type": "Answer", text: "Yes. Standard background checks include criminal history, employment verification, and education verification. Additional checks (drug screening, credit checks, OIG/SAM exclusion for healthcare) are conducted based on role requirements." } },
  ],
};

const STATIC_ROUTE_SCHEMAS: Record<string, object[]> = {
  "/it-staffing": [IT_SERVICE_SCHEMA],
  "/ehealthcare-staffing": [EHEALTHCARE_SERVICE_SCHEMA],
  "/why-hire-in-solutions": [WHYHIREIN_ORG_SCHEMA, WHYHIREIN_FAQ_SCHEMA],
  "/staffing-faq": [STAFFINGFAQ_FAQ_SCHEMA],
  "/it-staffing-guide": [IT_GUIDE_HOWTO_SCHEMA, IT_GUIDE_FAQ_SCHEMA],
  "/healthcare-staffing-guide": [HC_GUIDE_SERVICE_SCHEMA, HC_GUIDE_FAQ_SCHEMA],
  "/request-a-quote": [REQUEST_QUOTE_SERVICE_SCHEMA],
  "/services/contract-staffing": [CONTRACT_SERVICE_SCHEMA],
  "/services/it-software": [IT_SOFTWARE_SERVICE_SCHEMA],
  "/services/healthcare-recruitment": [HC_RECRUITMENT_SERVICE_SCHEMA],
  "/services/engineering-technical": [ENGINEERING_SERVICE_SCHEMA],
  "/services/non-it-professional": [PROFESSIONAL_SERVICE_SCHEMA],
};

export function getStaticSchemas(pathname: string): object[] {
  const clean = pathname.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
  return STATIC_ROUTE_SCHEMAS[clean] ?? [];
}

export async function getJobPostingSchema(jobId: string): Promise<object | null> {
  try {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) return null;

    const locationIsRemote =
      !job.city && !job.state
        ? true
        : (job.city ?? "").toLowerCase().includes("remote") ||
          (job.state ?? "").toLowerCase().includes("remote");

    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: job.title,
      description: job.description || job.requirements || job.title,
      datePosted: job.createdAt
        ? new Date(job.createdAt).toISOString().slice(0, 10)
        : undefined,
      hiringOrganization: {
        "@type": "Organization",
        name: "Hire'in Solutions",
        sameAs: "https://hire-in.com",
        logo: "https://hire-in.com/logo.jpg",
      },
      identifier: {
        "@type": "PropertyValue",
        name: "Hire'in Solutions",
        value: job.ceipalJobCode ?? job.id,
      },
      employmentType: mapEmploymentType(job.jobType),
      directApply: true,
    };

    if (locationIsRemote) {
      schema.jobLocationType = "TELECOMMUTE";
      schema.applicantLocationRequirements = { "@type": "Country", name: "United States" };
    } else {
      schema.jobLocation = {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: job.city ?? undefined,
          addressRegion: job.state ?? undefined,
          addressCountry: "US",
        },
      };
    }

    if (job.payRate) {
      const num = parseFloat(job.payRate.replace(/[^0-9.]/g, ""));
      if (!isNaN(num) && num > 0) {
        schema.baseSalary = {
          "@type": "MonetaryAmount",
          currency: "USD",
          value: { "@type": "QuantitativeValue", value: num, unitText: "HOUR" },
        };
      }
    }

    if (job.startDate) {
      schema.jobStartDate = job.startDate;
    }

    if (job.updatedAt) {
      const validThrough = new Date(job.updatedAt);
      validThrough.setMonth(validThrough.getMonth() + 3);
      schema.validThrough = validThrough.toISOString().slice(0, 10);
    }

    if (job.specialty) {
      schema.occupationalCategory = job.specialty;
    }

    return schema;
  } catch {
    return null;
  }
}

export function injectSchemas(html: string, schemas: object[]): string {
  if (!schemas.length) return html;
  const tags = schemas
    .map((s) => `    <script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join("\n");
  return html.replace("</head>", `${tags}\n  </head>`);
}
