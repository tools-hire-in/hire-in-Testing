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

export const MASTER_DECK_SEEDS: Record<"it" | "healthcare", MasterDeckSeed> = {
  it: {
    domain: "it",
    title: "US IT Staffing — Powered by AI",
    slides: [
      {
        title: "US IT Staffing — Powered by AI",
        bullets: [
          "AI-powered IT talent acquisition for enterprise and growth-stage technology companies",
          "500+ successful IT talent engagements — engineers, architects, and technology leaders placed",
          "24-hour first submissions for most IT roles — the fastest in the industry",
          "KleriQ.ai delivers 92% match accuracy across all technology disciplines",
          "'Right Tech Talent, Right Now — Powered by AI'",
        ],
        speaker_notes: "Open with speed and accuracy. IT buyers care about time-to-quality-submission, not just fill time.",
      },
      {
        title: "By the Numbers",
        bullets: [
          "500+ Successful IT Talent Engagements",
          "<5 Days Avg Fill Time (From intake to qualified submission)",
          "95%+ Client Retention — year-over-year",
          "50 US States Covered — nationwide IT talent delivery",
          "25,000+ IT Candidate Database — pre-vetted bench talent",
          "92% AI Match Accuracy — Kleriq AI powered",
        ],
        speaker_notes: "Lead with proof. These metrics differentiate us from general staffing firms.",
      },
      {
        title: "About Us",
        bullets: [
          "Est. 2014 · 60+ recruiters nationwide — connecting enterprises with elite IT talent",
          "IT-Exclusive Focus — specialist recruiters, not generalist agency",
          "AI-Powered Matching — 92% match accuracy via Kleriq AI scoring",
          "Compliance-First — I-9, E-Verify, background checks built into every placement",
          "Nationwide — All 50 US States, remote-first and on-site",
        ],
        speaker_notes: "Differentiate with the specialist recruiter model. IT buyers hate generalist agencies.",
      },
      {
        title: "IT Staffing Services",
        bullets: [
          "Permanent IT Hiring: culture-fit scoring, technical assessment, end-to-end onboarding",
          "Contract IT Staffing: short & long-term, bench-ready, rapid deployment within 24 hours",
          "Project-Based IT: team composition by need, milestone-based, full accountability",
          "RPO: SLA-backed delivery, dedicated talent desk, Ceipal ATS integration",
        ],
        speaker_notes: "Present the engagement model that fits the client's situation.",
      },
      {
        title: "Staffing Models",
        bullets: [
          "Permanent — Culture-fit scoring + technical assessment + 90-day guarantee",
          "Contract — Bench-ready talent, rapid deployment, all tech stacks",
          "Project-Based — Team squads by need, milestone accountability",
          "RPO — SLA-backed delivery, dedicated talent desk, ATS integration",
          "All models supported by AI-driven tools — precision matching, faster screening, compliance-first",
        ],
        speaker_notes: "Present the engagement model that fits the client's situation.",
      },
      {
        title: "AI Tools We Leverage",
        bullets: [
          "SMARTER HIRING — Kleriq AI for job analysis, matching & screening",
          "Resume Parsing & Analysis — AI extracts skills and role-fit signals at scale",
          "Job Description Matching — Kleriq AI transforms any JD into a sourcing matrix",
          "Candidate Pre-Screening — Automated first-pass scoring eliminates noise",
          "Bias-Free Shortlisting — Skills-first, removing demographic bias",
          "Fit Scoring & Ranking — Composite score across technical, cultural, experience",
        ],
        speaker_notes: "This slide closes skeptical technical buyers. Show we understand their stack, not just job titles.",
      },
      {
        title: "Why Hire'in",
        bullets: [
          "AI-Assisted Matching — 92% match accuracy, 70% faster shortlisting",
          "IT Domain Experts — 60+ IT-only recruiters, Java to Kubernetes, React to SAP",
          "Compliance-First — Zero-Risk: I-9 + E-Verify built into every placement",
          "Fastest Time-to-Fill — First qualified profiles in 24 hours for most IT roles",
        ],
        speaker_notes: "The 'no layers' and 'tech-born DNA' points resonate strongly with engineering managers.",
      },
      {
        title: "Sourcing Process",
        bullets: [
          "Step 1 — Intake: Deep-dive into tech stack, experience, and culture requirements",
          "Step 2 — AI Sourcing (AI-powered): Kleriq AI scores from 25K+ pre-vetted pool",
          "Step 3 — Screening: Technical + soft-skills validation by specialist recruiters",
          "Step 4 — Submit: Compliant profiles delivered with full documentation",
          "Step 5 — Onboard: Seamless onboarding with I-9, E-Verify, background checks",
        ],
        speaker_notes: "AI-powered tools are active throughout the pipeline.",
      },
      {
        title: "Demand Fulfillment",
        bullets: [
          "Demand → Review → Priorities → Allocation → Submissions → Quality → Client",
          "< 24 hrs Demand Acknowledgement",
          "< 24 hrs First Submissions",
          "≥ 95% Submission Quality Score",
          "100% Compliance Coverage",
        ],
        speaker_notes: "Walk the demand flow. Emphasize speed and compliance.",
      },
      {
        title: "IT Domains",
        bullets: [
          "Java / Microsoft — Permanent, Contract, Project, RPO",
          "Cloud & DevOps — Permanent, Contract, Project, RPO",
          "Data & AI — Permanent, Contract, Project, RPO",
          "Cybersecurity — Permanent, Contract, Project, RPO",
          "Mobility — Permanent, Contract, Project, RPO",
          "QA & Testing — Permanent, Contract, Project, RPO",
          "Project Mgmt — Permanent, Contract, Project, RPO",
        ],
        speaker_notes: "Show the breadth of IT domains covered across all engagement models.",
      },
      {
        title: "Let's Connect",
        bullets: [
          "The Right Tech Talent, Right Now",
          "Email: contact@hire-in.com",
          "Website: hire-in.com",
          "US HQ: San Jose, CA 95124",
          "India Office: New Delhi, India",
          "LinkedIn: linkedin.com/company/hirein-solutions",
        ],
        speaker_notes: "Close with urgency. Ask: 'What's your most critical open IT role right now?'",
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
          "'Compliance-Verified Clinical Talent. Placed Faster. Everywhere You Need Them.'",
        ],
        speaker_notes: "Open with compliance — it's the #1 concern for healthcare hiring managers and MSPs.",
      },
      {
        title: "By the Numbers",
        bullets: [
          "500+ Healthcare Roles Placed — RNs, LPNs, allied health, physicians",
          "TJC-Aligned Workflows — Joint Commission standards built into every placement",
          "100% Compliance Rate — proKred.com verifies every credential before submission",
          "All 50 US States — travel nursing and locum coverage nationwide",
          "MSP Ready — compliant submission packets for every managed service program",
          "24–48 Hours — compliant submission packages from engagement to delivery",
        ],
        speaker_notes: "Compliance and speed are the two things every healthcare hiring manager cares about most.",
      },
      {
        title: "About Us",
        bullets: [
          "Est. 2014 · Dedicated healthcare staffing division with clinical recruitment specialists",
          "proKred.com — built-in credential collection, public-directory license checks, audit-ready submission packets",
          "Joint Commission-aligned workflows built into every placement from day one",
          "HIPAA-ready data handling and secure credential sharing via proKred.com platform",
          "Named clinical recruiter per account — single point of contact, no handoffs",
        ],
        speaker_notes: "Lead with the JC alignment and proKred.com. These are not optional add-ons.",
      },
      {
        title: "Healthcare Staffing Services",
        bullets: [
          "Travel Nursing: Fully credentialed, JC-aligned submission packets, MSP/VMS-ready",
          "Locum Tenens: All physician specialties, DEA & state licensure verified",
          "Allied Health: PT, OT, SLP, Radiology with specialty skill checklists",
          "Healthcare RPO: SLA-backed delivery, dedicated clinical talent desk, HIPAA-ready",
        ],
        speaker_notes: "Cover all four service lines and match to the client's immediate need.",
      },
      {
        title: "Staffing Models",
        bullets: [
          "Travel — Credentialing Included, JC-Aligned, MSP/VMS Ready",
          "Locum — Credentialing Included, JC-Aligned, MSP/VMS Ready",
          "Allied — Credentialing Included, JC-Aligned, MSP/VMS Ready",
          "RPO — Credentialing Included, JC-Aligned, MSP/VMS Ready",
          "All models include proKred.com compliance packets — TJC-aligned, audit-ready",
        ],
        speaker_notes: "Every model includes compliance — that's the differentiator.",
      },
      {
        title: "AI + Compliance Tools We Leverage",
        bullets: [
          "COMPLIANCE-FIRST HIRING — proKred.com + KleriQ.ai",
          "Credential Collection — Automated license, cert, and skill checklist collection",
          "Public-Directory Checks — OIG/SAM exclusion, state board, NPI registry automated",
          "Compliant Submission Packets — Every submission is fully organized and audit-ready",
          "KleriQ.ai Clinical Matching — AI scores by specialty, acuity, EMR proficiency",
          "Gold-Standard Skill Checklists — EMR-specific, weighted by recency and proficiency",
        ],
        speaker_notes: "This is a major differentiator. Most agencies cobble together spreadsheets.",
      },
      {
        title: "Why Hire'in Healthcare",
        bullets: [
          "Compliance-First — 100% Compliance Rate, JC-aligned from day one",
          "Clinical Specialists — 60+ Clinical Recruiters, specialty-trained",
          "HIPAA-Ready — Secure credential handling via proKred.com",
          "Fastest Compliant Submission — First packet in 24–48 hrs, MSP-ready",
        ],
        speaker_notes: "The JC alignment and HIPAA-readiness are the strongest differentiators for hospital buyers.",
      },
      {
        title: "Sourcing Process",
        bullets: [
          "Step 1 — Intake: Map specialty, acuity, EMR, certifications, compliance requirements",
          "Step 2 — AI Sourcing (AI-powered): KleriQ.ai scores candidates by specialty and proficiency",
          "Step 3 — Screening: Clinical recruiter confirms specialty fit and availability",
          "Step 4 — Credentialing: proKred.com compiles JC-aligned compliant packet",
          "Step 5 — Submit: Full packet delivered within 24–48 hrs, MSP-ready",
        ],
        speaker_notes: "The key sell is Step 4: proKred.com delivers a complete, compliant submission packet.",
      },
      {
        title: "Demand Fulfillment",
        bullets: [
          "Demand → Review → Priorities → Allocation → Submissions → Credentialing → Client",
          "< 24 hrs Demand Acknowledgement",
          "24–48 hrs Compliant First Submission",
          "≥ 95% Submission Quality Score",
          "100% Compliance Coverage",
        ],
        speaker_notes: "Walk the demand flow. Step 6 (Credentialing) is what makes us different.",
      },
      {
        title: "Clinical Domains",
        bullets: [
          "RN / LPN — Travel, Locum, Permanent, RPO",
          "Allied Health — Travel, Locum, Permanent, RPO",
          "Physician / Locum — Travel, Locum, Permanent, RPO",
          "Healthcare IT — Travel, Locum, Permanent, RPO",
          "Admin / Revenue — Travel, Locum, Permanent, RPO",
          "Long-Term Care — Travel, Locum, Permanent, RPO",
          "Home Health — Travel, Locum, Permanent, RPO",
        ],
        speaker_notes: "Show the breadth of clinical domains covered across all engagement models.",
      },
      {
        title: "Let's Connect",
        bullets: [
          "Compliance-Verified Clinical Talent, Placed Faster",
          "Email: contact@hire-in.com",
          "Website: hire-in.com",
          "US HQ: San Jose, CA 95124",
          "India Office: New Delhi, India",
          "LinkedIn: linkedin.com/company/hirein-solutions",
        ],
        speaker_notes: "Close with urgency. Ask: 'What's your most urgent clinical role right now?'",
      },
    ],
  },
};
