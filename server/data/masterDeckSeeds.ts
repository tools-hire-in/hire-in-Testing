export interface BdSlideSeed {
  title: string;
  bullets: string[];
  speaker_notes: string;
}

export interface MasterDeckSeed {
  domain: string;
  title: string;
  slides: BdSlideSeed[];
}

export const MASTER_DECK_SEEDS: Record<"it" | "general" | "healthcare", MasterDeckSeed> = {
  it: {
    domain: "it",
    title: "US IT Staffing — Powered by AI",
    slides: [
      {
        title: "US IT Staffing — Powered by AI",
        bullets: [
          "AI-powered IT talent acquisition for enterprise and growth-stage technology companies",
          "100+ successful IT talent engagements — engineers, architects, and technology leaders placed",
          "24-hour first submissions for most IT roles — the fastest in the industry",
          "KleriQ.ai delivers 92% match accuracy across all technology disciplines",
          "'Right Tech Talent, Right Now — Powered by AI'",
        ],
        speaker_notes:
          "Open with speed and accuracy. IT buyers care about time-to-quality-submission, not just fill time.",
      },
      {
        title: "IT Staffing By the Numbers",
        bullets: [
          "100+ Successful IT Talent Engagements",
          "24-Hour First Submissions for most roles",
          "95% Client Retention — year-over-year",
          "92% AI Match Accuracy — KleriQ.ai powered",
          "25,000+ IT Candidate Pool — pre-vetted bench talent",
          "All 50 US States — nationwide IT talent delivery",
        ],
        speaker_notes:
          "Lead with proof. These metrics differentiate us from general staffing firms.",
      },
      {
        title: "About Our IT Staffing Practice",
        bullets: [
          "Dedicated IT staffing division with domain-specialist recruiters fluent in your tech stack",
          "AI-first approach: KleriQ.ai transforms complex JDs into sourcing logic and candidate scores",
          "Built-in compliance: I-9, E-Verify, background checks for every IT placement",
          "Named partner model — single point of contact from intake through onboarding",
          "Fully integrated with Ceipal ATS for seamless pipeline visibility and candidate tracking",
        ],
        speaker_notes:
          "Differentiate with the specialist recruiter model. IT buyers hate generalist agencies.",
      },
      {
        title: "IT Roles & Technologies We Place",
        bullets: [
          "Software Engineering: Java, Python, JavaScript, React, .NET, Node.js, Go, Rust, C++",
          "Cloud & DevOps: AWS, Azure, GCP, Kubernetes, Docker, CI/CD, Terraform",
          "Data & AI/ML: Data Engineers, ML Engineers, Data Scientists, AI Architects",
          "Cybersecurity: CISO, Security Engineers, SOC Analysts, Pen Testers, GRC",
          "SAP & Enterprise: SAP FICO, SD, MM, SuccessFactors, Salesforce, ServiceNow",
        ],
        speaker_notes:
          "Match this slide to the specific technologies the client uses. Ask them their stack before the meeting.",
      },
      {
        title: "IT Specializations & Engagement Models",
        bullets: [
          "Contract Staffing: Flexible IT talent on demand — weekly or monthly billing",
          "Contract-to-Hire: Trial period that lets both sides confirm fit before full commitment",
          "Direct Hire: Permanent IT talent sourced, vetted, and placed end-to-end",
          "Project Teams: Build dedicated squads for product launches, migrations, or modernization projects",
          "Executive Search: CTO, VP Engineering, Director-level technology leadership",
        ],
        speaker_notes:
          "Present the engagement model that fits the client's situation. Most start with contract or C2H.",
      },
      {
        title: "AI Technology for IT Talent Acquisition",
        bullets: [
          "KleriQ.ai — Recruiter Intelligence Engine: JD-to-insights, role-family intelligence, resume scoring",
          "Technology Stack Parsing: KleriQ.ai maps exact tools, versions, and adjacent skills from any JD",
          "AI Match Accuracy: 92% first-submission quality — dramatically reducing interview-to-offer cycles",
          "Ceipal ATS Integration: Full pipeline visibility, automated job sync, and candidate tracking",
          "proKred.com Background Verification: Automated credential and background verification workflows",
        ],
        speaker_notes:
          "This slide closes skeptical technical buyers. Show them we understand their stack, not just job titles.",
      },
      {
        title: "Our IT Recruitment Process",
        bullets: [
          "Step 1 — Tech Discovery: KleriQ.ai parses JD into exact skills, tools, and experience matrix",
          "Step 2 — AI-Powered Sourcing: Resume scoring against 25,000+ pre-vetted IT professionals",
          "Step 3 — Technical Validation: Recruiter + technical screening to confirm depth, not just keyword match",
          "Step 4 — Background & Compliance: Automated verification via proKred.com workflows",
          "Step 5 — Submission: Compliant submission packet delivered within 24 hours of engagement",
        ],
        speaker_notes:
          "Walk the process. At Step 2, ask: 'How many resumes does your current vendor send before you find a fit?'",
      },
      {
        title: "IT Clients & Technology Partners",
        bullets: [
          "Technology companies: Wipro, TCS, Accenture, 22nd Century Technologies, Edmodo",
          "Enterprise IT programs: FDA-regulated systems (Abbott), financial platforms (Wells Fargo), retail tech (Walmart)",
          "Cross-industry IT staffing: Healthcare IT, FinTech, EdTech, Enterprise SaaS",
          "All 50 US States — remote-first and on-site IT placements nationwide",
          "95% client retention — technical hiring managers come back because our submissions are pre-qualified",
        ],
        speaker_notes:
          "Real logos build trust instantly. Transition: 'What's your current technical hiring process?'",
      },
      {
        title: "Why Hire'in for IT Staffing",
        bullets: [
          "Domain Specialists: Recruiters who understand your tech stack — Java to Kubernetes, React to SAP",
          "92% Match Rate: AI pre-screening eliminates noise — only qualified, pre-vetted profiles submitted",
          "24-Hour Submissions: Fastest qualified submission in the industry for most IT roles",
          "Tech-Born DNA: Founded by a software engineer who shipped FDA-regulated and financial systems",
          "Compliance Built-In: Every placement includes I-9, E-Verify, and background verification",
          "No Layers: Direct recruiter access — no account manager between you and your candidate",
        ],
        speaker_notes:
          "The 'no layers' and 'tech-born DNA' points resonate strongly with engineering managers.",
      },
      {
        title: "Meet the Founder — Simranjeet Sidana",
        bullets: [
          "14+ years building high-stakes technology: regulated medical devices, financial platforms, AI/ML",
          "FDA-Regulated MedTech: Led quality engineering for Abbott Lingo CGM (21 CFR / FDA QSR compliant)",
          "Industry-First FinTech: End-to-end engineering validation for Wells Fargo's first US mobile wallet",
          "AI at McKesson: ML-driven physician note automation and clinical trials management",
          "Built KleriQ.ai from scratch — the recruiter intelligence platform Hire'in runs on",
          "Wharton 2024 · PSM II · ISTQB Advanced · B.E. Computer Science",
        ],
        speaker_notes:
          "The founder's engineering background is the source of our quality standard. This is why our IT submissions are pre-qualified, not just filtered.",
      },
      {
        title: "Let's Hire Your Next IT Star",
        bullets: [
          "Ready to fill your open IT roles? Let's start with a 30-minute technical intake call",
          "We match to your exact tech stack — no keyword-matching guesswork",
          "Phone: +1 (408) 412-9890",
          "Email: contact@hire-in.com",
          "Website: hire-in.com",
          "Nationwide IT staffing · Remote & On-site · Contract · C2H · Direct Hire",
        ],
        speaker_notes:
          "Close with urgency. Ask: 'What's your most critical open IT role right now?'",
      },
    ],
  },

  general: {
    domain: "general",
    title: "Hire'in Solutions — General Capability Deck",
    slides: [
      {
        title: "Hire'in Solutions — General Capability Deck",
        bullets: [
          "AI-powered staffing firm serving Healthcare, IT, Engineering & Professional Services",
          "Est. 2014 under Rayomind — born from engineering, built for impact",
          "Proprietary AI tools: KleriQ.ai (recruiter intelligence) & proKred.com (compliance packets)",
          "Nationwide coverage across all 50 US states",
          "'We engineer perfect matches — faster, smarter, with complete confidence'",
        ],
        speaker_notes:
          "Opening slide — set the tone with our tech-forward identity and broad industry coverage.",
      },
      {
        title: "By the Numbers",
        bullets: [
          "10+ Years in Business — Est. 2014 under Rayomind",
          "95% Client Retention — year-over-year renewals",
          "90% AI Match Accuracy — powered by KleriQ.ai",
          "50% Faster Placements — vs. industry average",
          "100% Compliance Rate — healthcare credential verified",
          "98% Client Satisfaction — measured by client surveys",
        ],
        speaker_notes:
          "Lead with proof. These numbers anchor credibility before diving into services.",
      },
      {
        title: "About Hire'in Solutions",
        bullets: [
          "Founded 2014 under Rayomind with a singular mission: revolutionize recruitment through AI",
          "Tech-forward DNA — we build like engineers, not traditional staffing firms",
          "Proprietary tools built in-house: KleriQ.ai and proKred.com (not licensed from vendors)",
          "Compliance-first culture: I-9, E-Verify, background screening built into every placement",
          "Headquartered in San Jose, CA — staffing professionals across the US",
        ],
        speaker_notes:
          "Focus on the tech-forward differentiator. We are an engineering company that does staffing, not a staffing company that added technology.",
      },
      {
        title: "Industries & Services",
        bullets: [
          "Healthcare: Hospitals, clinics, telehealth, home health, long-term care",
          "Information Technology: Software, cloud, data, cybersecurity, DevOps",
          "Engineering: Industrial, mechanical, civil, chemical, project management",
          "Finance & Banking: Financial services, risk, compliance, audit",
          "Professional Services: Consulting, legal, HR, operations, marketing",
          "Staffing Models: Contract, Contract-to-Hire, Direct Placement, Executive Search",
        ],
        speaker_notes:
          "Highlight breadth — we serve all major verticals. Healthcare and IT are our strongest domains.",
      },
      {
        title: "Services & Specializations",
        bullets: [
          "Healthcare Recruitment: RNs, LPNs, physicians, allied health, telehealth — with proKred.com compliance packets",
          "IT & Software Staffing: Engineers, DevOps, data scientists, cybersecurity — AI-matched via KleriQ.ai",
          "Engineering & Technical: Mechanical, civil, industrial engineers, project managers",
          "Professional Services: Finance, accounting, HR, operations, executive search",
          "All roles: Contract, C2H, and Direct Hire across all 50 states",
        ],
        speaker_notes:
          "Tailor this slide to the client's domain. Lead with the vertical that matches their industry.",
      },
      {
        title: "Our AI Technology Stack",
        bullets: [
          "KleriQ.ai — Recruiter Intelligence Engine: transforms JDs into insights, sourcing logic, and resume match scoring",
          "proKred.com — Compliance Packets & Skill Checklists: public-directory license checks, secure credential sharing, HIPAA-ready",
          "Ceipal ATS — Enterprise Applicant Tracking: bidirectional job sync, automated candidate push, pipeline visibility",
          "AI advantage: 90%+ match accuracy, 50% faster placements, zero manual credential-chasing",
          "All tools built in-house by our founder — not licensed from third-party vendors",
        ],
        speaker_notes:
          "This slide wins technical buyers. Emphasize that these are proprietary tools, not off-the-shelf software.",
      },
      {
        title: "Our Recruitment Process",
        bullets: [
          "Step 1 — Discovery: Deep-dive into requirements, culture, and goals; KleriQ.ai creates intelligent candidate profiles",
          "Step 2 — AI Sourcing: 90%+ match accuracy using role-family intelligence and resume scoring",
          "Step 3 — Validation: Expert recruiters assess cultural fit, soft skills, and career alignment",
          "Step 4 — Credentials: Compliance team verifies; proKred.com compiles compliant, audit-ready submission packets",
          "Step 5 — Placement: Pre-vetted candidates delivered with documentation and onboarding readiness confirmed",
        ],
        speaker_notes:
          "Walk through the process step by step. Emphasize speed at Step 2 and compliance at Step 4.",
      },
      {
        title: "Clients & Partners",
        bullets: [
          "Fortune 500 trust: Abbott, McKesson, Wells Fargo, Walmart, American Airlines, Accenture, Wipro, TCS",
          "Healthcare-focused: RC4Vet, AYA, NYCHH, HonerVet, HWL, and dozens of clinical facilities",
          "Technology clients: 22nd Century Technologies, Edmodo, Mathison",
          "All 50 US states — coast-to-coast talent delivery",
          "Average time-to-qualified-submission: under 5 business days for most roles",
        ],
        speaker_notes:
          "Name-dropping matters. Let the logos do the talking. Transition to asking what their current vendor looks like.",
      },
      {
        title: "Why Hire'in Solutions",
        bullets: [
          "Tech-Forward DNA: Born from a software engineering company — we build like technologists",
          "Best-in-Class AI Tools: KleriQ.ai and proKred.com — proprietary tools, not licensed software",
          "50% Faster Placements: AI pre-screening cuts time-to-hire in half while improving quality",
          "100% Compliance Rate: Zero-compromise credential verification for every placement",
          "Founder-Led Quality: CEO has shipped FDA-regulated software — that standard applies here",
          "95% Client Retention: Clients stay because we consistently deliver quality talent on time",
        ],
        speaker_notes:
          "This is the close slide before the founder story. Let the numbers do the work.",
      },
      {
        title: "Meet the Founder — Simranjeet Sidana",
        bullets: [
          "14+ years shipping high-stakes software: FDA-regulated MedTech, financial platforms, AI/ML, enterprise software",
          "FDA-Regulated at Abbott: Led quality engineering for Abbott Lingo CGM bio-wearable (21 CFR aligned)",
          "Industry-First at Wells Fargo: Delivered validation for the first mobile wallet by a major US bank",
          "AI at Scale at McKesson: ML-driven physician note automation and clinical trials management",
          "Founder of Escanor Technologies — built KleriQ.ai and proKred.com from scratch, not licensed",
          "Wharton 2024 · PSM II · ISTQB Advanced · B.E. Computer Science",
        ],
        speaker_notes:
          "Humanize the company. Simranjeet's engineering background is the origin story of our quality standards.",
      },
      {
        title: "Let's Build Your Dream Team",
        bullets: [
          "Ready to transform your hiring? Let's start with a 30-minute discovery call",
          "Phone: +1 (408) 412-9890",
          "Email: contact@hire-in.com",
          "Website: hire-in.com",
          "Headquarters: San Jose, CA",
          "Nationwide staffing · Healthcare · IT · Engineering · Professional Services",
        ],
        speaker_notes:
          "Close with a clear call-to-action. Ask: 'What's your most urgent open role right now?'",
      },
    ],
  },

  healthcare: {
    domain: "healthcare",
    title: "US Healthcare Staffing — AI + Compliance",
    slides: [
      {
        title: "US Healthcare Staffing — AI + Compliance",
        bullets: [
          "AI-powered healthcare staffing with Joint Commission-aligned compliance workflows",
          "Travel nursing, locum tenens, allied health, and clinical recruitment across all 50 US states",
          "proKred.com for compliant submission packets with public-directory license checks",
          "KleriQ.ai for clinical skills matching and candidate scoring",
          "'Compliance-verified clinical talent. Placed faster. Everywhere you need them.'",
        ],
        speaker_notes:
          "Open with compliance — it's the #1 concern for healthcare hiring managers and MSPs.",
      },
      {
        title: "Healthcare Staffing By the Numbers",
        bullets: [
          "100+ Healthcare Roles Placed — RNs, LPNs, allied health, physicians",
          "TJC-Aligned Workflows — Joint Commission standards built into every placement",
          "100% Compliance Rate — proKred.com verifies every credential before submission",
          "All 50 US States — travel nursing and locum coverage nationwide",
          "MSP Ready — compliant submission packets for every managed service program",
          "Fast Turnaround — compliant submission packages within 24–48 hours of engagement",
        ],
        speaker_notes:
          "Compliance and speed are the two things every healthcare hiring manager cares about most.",
      },
      {
        title: "About Our Healthcare Staffing Practice",
        bullets: [
          "Dedicated healthcare staffing division with clinical recruitment specialists",
          "proKred.com — built-in credential collection, public-directory license checks, audit-ready submission packets",
          "Joint Commission-aligned workflows built into every placement from day one",
          "HIPAA-ready data handling and secure credential sharing via proKred.com platform",
          "Named clinical recruiter per account — single point of contact, no handoffs",
        ],
        speaker_notes:
          "Lead with the JC alignment and proKred.com. These are not optional add-ons — they're built into our process.",
      },
      {
        title: "Healthcare Roles We Place",
        bullets: [
          "Nursing: RN, LPN, CNA, Travel Nurses, ICU, ER, OR, PACU, NICU, Telemetry",
          "Allied Health: Physical Therapists, Occupational Therapists, Respiratory Therapists, Radiology",
          "Physician & Advanced Practice: MD, DO, NP, PA, Locum Tenens across all specialties",
          "Healthcare IT: Clinical Systems, EMR Specialists (Epic, Cerner, Meditech), Health Informatics",
          "Healthcare Administration: Medical Coders, Billers, Revenue Cycle, Case Management",
          "Long-Term Care & Home Health: CNAs, HHAs, Care Coordinators",
        ],
        speaker_notes:
          "Cover breadth, then ask: 'Which clinical specialties are hardest for you to fill right now?'",
      },
      {
        title: "Compliance & Credentialing — proKred.com",
        bullets: [
          "Public-directory license verification: State Board, NPI, OIG/SAM exclusion checks automated",
          "Compliant submission packets: All credentials compiled, organized, and submission-ready",
          "Secure credential sharing: proKred.com platform for digital, traceable document exchange",
          "Gold-standard skill checklists: EMR-specific, weighted by recency and clinical proficiency",
          "HIPAA-ready data handling throughout the credentialing workflow",
          "Audit-ready documentation: Every submission packet ready for TJC or CMS audit on day one",
        ],
        speaker_notes:
          "This is a major differentiator. Most agencies cobble together spreadsheets — we use a purpose-built compliance platform.",
      },
      {
        title: "AI-Powered Clinical Talent Matching",
        bullets: [
          "KleriQ.ai parses clinical JDs into specialty, experience, licensure, and setting requirements",
          "Clinical skill scoring: EMR proficiency, specialty certifications, acuity level — all weighted by recency",
          "Bench matching against pre-vetted pool of travel nurses and locum professionals",
          "Real-time availability matching: Active, interested, and already-packaged candidates surfaced first",
          "Quality gate: Every AI-matched candidate reviewed by clinical recruiter before submission",
        ],
        speaker_notes:
          "Reinforce that AI assists our clinical recruiters — it doesn't replace human judgment in clinical hiring.",
      },
      {
        title: "Our Healthcare Recruitment Process",
        bullets: [
          "Step 1 — Clinical Intake: Map specialty, acuity, EMR, certifications, and compliance requirements",
          "Step 2 — AI Sourcing: KleriQ.ai scores candidates against clinical requirements with specialty-specific weighting",
          "Step 3 — Clinical Validation: Healthcare recruiter confirms specialty fit, availability, and cultural alignment",
          "Step 4 — Credentialing: proKred.com compiles public-directory verified, JC-aligned submission packet",
          "Step 5 — Compliant Submission: Full packet delivered within 24–48 hours, MSP-ready",
        ],
        speaker_notes:
          "The key sell is Step 4: we deliver a complete, compliant packet — not just a resume.",
      },
      {
        title: "Healthcare Clients & Facilities Served",
        bullets: [
          "Hospitals & Health Systems: NYCHH (New York City Health + Hospitals), Sanford Health, major regional systems",
          "Travel Staffing Programs: AYA Healthcare, HWL, RC4Vet, HonerVet — MSP and VMS aligned",
          "Specialty Facilities: Oncology, cardiac, orthopedic, behavioral health, long-term acute care",
          "Healthcare Technology: Abbott (MedTech), McKesson (clinical trials management, AI/ML)",
          "All 50 US States — travel and perm placement coverage coast to coast",
          "Compliant candidate submitted within 24–48 hours for most acute care roles",
        ],
        speaker_notes:
          "Name the accounts. MSP buyers want to know you understand the VMS/MSP compliance ecosystem.",
      },
      {
        title: "Why Hire'in for Healthcare Staffing",
        bullets: [
          "Joint Commission-Aligned: TJC compliance built into our workflow — not a checkbox at the end",
          "proKred.com Platform: Compliant submission packets with public-directory verified credentials",
          "Clinical Specialist Recruiters: Specialty-trained in nursing, allied health, and physician recruitment",
          "HIPAA-Ready: Secure, traceable document handling throughout the credentialing process",
          "Fastest Compliant Submission: Full credentialed packet in 24–48 hours — MSP-ready from day one",
          "Founder's Medical Device Background: CEO built FDA-regulated software — compliance is in our DNA",
        ],
        speaker_notes:
          "The JC alignment and HIPAA-readiness are the strongest differentiators for hospital buyers.",
      },
      {
        title: "Meet the Founder — Simranjeet Sidana",
        bullets: [
          "14+ years in high-stakes technology with deep healthcare industry experience",
          "FDA-Regulated MedTech at Abbott: Led quality engineering for Abbott Lingo CGM bio-wearable (21 CFR / FDA QSR)",
          "AI in Clinical Settings at McKesson: ML-driven physician note automation and clinical trials management",
          "Built proKred.com — purpose-built for healthcare credential compliance and submission packets",
          "Built KleriQ.ai — AI platform for recruiter intelligence and clinical candidate scoring",
          "Wharton 2024 · PSM II · ISTQB Advanced · B.E. Computer Science",
        ],
        speaker_notes:
          "The FDA background is the origin of our compliance-first culture. This is why proKred.com exists.",
      },
    ],
  },
};
