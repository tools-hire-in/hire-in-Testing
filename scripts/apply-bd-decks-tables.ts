// Apply BD Decks tables (Task #968) via direct SQL.
// Run once: npx tsx scripts/apply-bd-decks-tables.ts
// Idempotent — uses CREATE TABLE IF NOT EXISTS.

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[bd-decks-tables] Applying BD decks tables…");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bd_decks (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(300) NOT NULL,
      domain VARCHAR(50) NOT NULL DEFAULT 'healthcare',
      deck_type VARCHAR(20) NOT NULL DEFAULT 'master',
      parent_id VARCHAR REFERENCES bd_decks(id) ON DELETE SET NULL,
      version VARCHAR(20) NOT NULL DEFAULT 'v1',
      client_name VARCHAR(200),
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      slides JSONB NOT NULL DEFAULT '[]',
      created_by VARCHAR REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS bd_decks_domain_idx ON bd_decks(domain)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS bd_decks_deck_type_idx ON bd_decks(deck_type)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS bd_decks_status_idx ON bd_decks(status)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS bd_decks_parent_id_idx ON bd_decks(parent_id)
  `);

  console.log("[bd-decks-tables] Tables created.");

  // Seed Healthcare v1 (active master)
  const v1Slides = JSON.stringify([
    {
      title: "Introduction — Hire'in Solutions",
      bullets: [
        "Full-service healthcare recruitment partner",
        "Specialising in clinical, allied health, and healthcare administration",
        "Serving hospital networks, specialty clinics, and diagnostic chains across India",
        "95% first-year retention rate for placed candidates",
      ],
      speaker_notes: "Open by thanking the client for their time. Establish Hire'in as a domain specialist, not a generalist agency. Emphasise the retention rate as proof of fit-based placement.",
    },
    {
      title: "The Healthcare Hiring Challenge",
      bullets: [
        "Average time-to-fill for clinical roles: 45–90 days via direct hiring",
        "Credentialing and licensure complexity slows starts by 2–4 weeks",
        "High 90-day attrition due to culture/role misalignment",
        "Float pool management and surge demand require on-demand talent access",
      ],
      speaker_notes: "Mirror the client's stated pain points back to them here. This slide exists so they nod — 'yes, that's exactly our problem.' Pause after presenting and ask: 'Does this reflect what you're experiencing?'",
    },
    {
      title: "Our Healthcare Capability",
      bullets: [
        "Nurses (RN, ICU, ER, OT, Paediatric, Oncology)",
        "Allied Health (Physiotherapy, Radiology, Lab Technicians, Pharmacists)",
        "Healthcare Administration (Medical Records, Billing, Operations Managers)",
        "Credentialing support included at no additional cost",
        "Background verification and reference checks managed end-to-end",
      ],
      speaker_notes: "Tailor which roles you emphasise based on the client's current open positions. Don't list everything — lead with what they actually need. Ask for a live roles list before the presentation if possible.",
    },
    {
      title: "Talent Acquisition Process",
      bullets: [
        "Briefing call → JD validation → sourcing kickoff within 24 hours",
        "AI-assisted candidate pre-screening from a live healthcare talent pool",
        "Structured competency interviews by domain-specialist recruiters",
        "First shortlist submitted within 5 business days",
        "Client feedback loop integrated into screening criteria in real time",
      ],
      speaker_notes: "Highlight the speed differentiator: 24-hour kickoff and 5-day first submission. Most agencies take 2–3 weeks for a first shortlist. This is a proof point worth dwelling on.",
    },
    {
      title: "Our Proof Points",
      bullets: [
        "95% first-year retention rate (vs 60–70% industry average)",
        "Average 18-day time-to-offer for nursing roles",
        "3:1 shortlist-to-hire ratio — we qualify before we submit",
        "Credentialing success rate: 98% of placed candidates fully credentialed within 30 days",
      ],
      speaker_notes: "These numbers are internal benchmarks. Use them but be ready for the client to probe them. If asked for client references, offer to connect them with a reference account in their sector.",
    },
    {
      title: "Engagement Models",
      bullets: [
        "Permanent Placement — one-time fee on successful start",
        "Contract-to-Hire — flexible 3–6 month contract with conversion option",
        "Pure Contract / Locum — daily/weekly engagement for surge and backfill",
        "Retainer Partnership — priority access + dedicated account team",
      ],
      speaker_notes: "Let the client choose the model that fits their budget and risk appetite. The retainer model is best for high-volume or recurring needs. Don't push it prematurely — surface it as an option, not a pitch.",
    },
    {
      title: "Why Hire'in Over Competitors",
      bullets: [
        "Healthcare-first: dedicated vertical vs generalist agencies",
        "Account team with clinical domain knowledge — we know the terminology",
        "No CVs without a call — every submission has been spoken to",
        "Post-placement support: 90-day check-ins, replacement guarantee",
        "Single point of contact — no handoffs between teams",
      ],
      speaker_notes: "This slide is most powerful as a response to the objection 'we already work with an agency.' Position as complementary or superior, not combative. Ask: 'Are there specific roles your current agency struggles to fill?'",
    },
    {
      title: "Proposed Next Steps",
      bullets: [
        "Share your current open roles list (confidential)",
        "We'll run a 72-hour capability match against our talent pool",
        "Pilot engagement: 2–3 roles with a 30-day conversion window",
        "No commitment required until you see shortlisted candidates",
      ],
      speaker_notes: "Always close with a low-risk next step. A pilot removes the commitment barrier. The 72-hour capability match gives them a quick win without signing anything. Confirm the primary contact and decision timeline before leaving.",
    },
  ]);

  const v2Slides = JSON.stringify([
    {
      title: "Section 1: Healthcare Delivery Partner — Not a Staffing Agency",
      bullets: [
        "Hire'in is a healthcare recruitment delivery partner — we own the hiring outcome, not just the CV pipeline",
        "We embed into your talent function: briefing, sourcing, screening, credentialing, onboarding support",
        "Primary focus: clinical-to-hire conversion speed and first-year retention — the metrics that matter",
        "This deck covers how we operate, what we can deliver, and how we propose starting together",
      ],
      speaker_notes: "Open with this reframe: we are not a CV supplier. This is the single most important positioning shift from v1. The client's mental model of 'staffing agency' = bulk CVs and a fee. We need to replace that with 'delivery partner' = shared accountability for outcomes. Spend 2–3 minutes on this. If they push back, ask: 'What has your experience been with other recruitment partners — where did it break down?'",
    },
    {
      title: "Section 2: Why Partner with Hire'in",
      bullets: [
        "Healthcare vertical focus — clinical domain expertise in every recruiter on your account",
        "24-hour sourcing kickoff with first shortlist in 5 business days",
        "95% first-year retention rate — driven by structured competency + culture fit assessment",
        "End-to-end credentialing management at no added cost",
        "Post-placement support: 90-day check-ins, replacement policy, feedback loop",
      ],
      speaker_notes: "Five proof points, not twenty. Resist the urge to list every service. These are the five metrics and commitments that clients cite when they renew or refer us. Lead with retention rate — it reframes the conversation from 'cost to place' to 'cost of attrition avoided.'",
    },
    {
      title: "Section 3: Healthcare Capability Overview",
      bullets: [
        "Nursing: RN, ICU/CCU, ER, OT, Paediatrics, Oncology, Dialysis",
        "Allied Health: Physiotherapy, Radiology, Lab & Pathology, Pharmacy",
        "Niche clinical: Perfusionists, Cath Lab Technicians, Nuclear Medicine",
        "Healthcare Administration: Medical Records, Revenue Cycle, Quality & Compliance, Operations",
        "Leadership: Clinical Directors, CNO, Medical Superintendents, VP Clinical Operations",
      ],
      speaker_notes: "This slide proves breadth. But in the room, lead only with roles the client actually needs. If they're a diagnostic chain, go deep on Lab and Radiology. If they're an acute care hospital, lead with nursing and specialty clinical. Tailor verbally — don't read the full list.",
    },
    {
      title: "Section 4: Talent Acquisition Capacity",
      bullets: [
        "Active talent pool: 12,000+ credentialed healthcare professionals across India",
        "Monthly pipeline additions: 800–1,000 new candidates through referral and targeted sourcing",
        "Capacity commitment: up to 15 concurrent open roles per client account",
        "Surge support: additional recruiter bandwidth deployed within 48 hours for volume spikes",
        "Talent pool segmented by speciality, geography, availability, and credentialing status",
      ],
      speaker_notes: "Capacity numbers establish credibility. The client wants to know: can you actually deliver at our scale? Tailor the '15 concurrent roles' number to the client's realistic need. If they have 50 open roles, be honest about how you'd prioritise and sequence. Don't overcommit.",
    },
    {
      title: "Section 5: Tools & Recruitment Process",
      bullets: [
        "AI-assisted pre-screening: skills, competency, culture, and credentialing status",
        "Structured interview framework: domain-specific competency questions + behavioural scoring",
        "Digital credentialing workflow: licence verification, registration checks, reference calls",
        "Client feedback loop: real-time screening criteria adjustments based on your shortlist feedback",
        "ATS integration available for clients with existing systems (Ceipal, Workday, SuccessFactors)",
      ],
      speaker_notes: "The process slide differentiates us from manual CV-blasting agencies. Emphasise the AI pre-screening layer — every candidate submitted has passed a structured screen, not just keyword matching. The ATS integration point is important for enterprise clients with procurement compliance requirements.",
    },
    {
      title: "Section 6: Healthcare Pipeline Availability",
      bullets: [
        "Immediate availability (0–30 days): 400+ candidates across nursing and allied health",
        "Short-term pipeline (30–60 days): 900+ candidates in active engagement",
        "Specialty clinical pipeline: Perfusionists (14 active), Cath Lab (22 active), Nuclear Medicine (8 active)",
        "Geographic coverage: Pan-India with deep density in Metro, Tier-1, and Tier-2 cities",
        "Travel-to-perm candidates available for rural, remote, and project-based deployments",
      ],
      speaker_notes: "This slide is most powerful when you can tailor the pipeline numbers to the client's geography and roles. Pull the actual numbers from the talent pool before the presentation. Real data > generic estimates. If you don't have the exact numbers, frame it as 'we'll run a 72-hour capability match and share the live pipeline report with you.'",
    },
    {
      title: "Section 7: Proposed Operating Model",
      bullets: [
        "Dedicated account team: Account Lead + 2 specialist recruiters assigned to your account",
        "Weekly delivery report: submissions, shortlist status, interview pipeline, offer stage",
        "Client success review: monthly 30-minute call with Account Lead and your TA lead",
        "Engagement models: Permanent Placement / Contract-to-Hire / Pure Contract / Retainer",
        "SLA commitments: first shortlist in 5 days, weekly status updates, 48-hour candidate replacement proposal",
      ],
      speaker_notes: "The operating model slide answers the client's unspoken question: 'Will I get ghosted after I brief them?' Dedicated account team + weekly reporting = accountability. The SLA list makes the commitment concrete and comparable to their current vendor. Ask: 'What does your current vendor's reporting look like? Is it meeting your needs?'",
    },
    {
      title: "Section 8: Pilot Approach",
      bullets: [
        "2–3 roles selected by the client as the pilot scope",
        "72-hour talent pool capability match shared before any commitment",
        "30-day pilot window: first shortlist within 5 days, interviews scheduled by day 10",
        "No placement fee until a candidate successfully starts",
        "Pilot success metric: agreed upfront (speed, shortlist quality, interview-to-offer rate)",
        "Post-pilot review: full partnership discussion based on delivery evidence",
      ],
      speaker_notes: "The pilot is the key objection-handler for new clients. It removes the commitment risk. Frame it as: 'We'd rather earn your business by showing you what we can do on 2–3 roles than ask you to trust us on 20.' Agree the success metric before starting — this protects both sides from ambiguous outcomes.",
    },
    {
      title: "Section 9: Discussion Items & Next Steps",
      bullets: [
        "Share your current open roles list — we'll run the 72-hour capability match",
        "Agree the pilot scope: which 2–3 roles have you been struggling to fill?",
        "Introduce the dedicated Account Lead who will own your account",
        "Confirm the primary decision-maker and internal stakeholders for the pilot",
        "Set the 30-day pilot review date — we'll come back with delivery evidence",
      ],
      speaker_notes: "Close with a clear action list, not a vague 'we'll be in touch.' Each item has an owner and a timeframe. The 72-hour capability match is the immediate deliverable — it gives the client something concrete before they've signed anything. Before leaving the room, confirm: who makes the decision, by when, and what would make them say yes.",
    },
  ]);

  // Seed each deck independently — check per (domain, deck_type, version) tuple
  const v1Exists = await db.execute(sql`
    SELECT id FROM bd_decks WHERE domain = 'healthcare' AND deck_type = 'master' AND version = 'v1' LIMIT 1
  `);
  if (v1Exists.rows.length === 0) {
    await db.execute(sql`
      INSERT INTO bd_decks (title, domain, deck_type, version, status, slides)
      VALUES (
        'Healthcare Capability Deck',
        'healthcare',
        'master',
        'v1',
        'active',
        ${v1Slides}::jsonb
      )
    `);
    console.log("[bd-decks-tables] Seeded Healthcare v1 master deck.");
  } else {
    console.log("[bd-decks-tables] Healthcare v1 already present — skipping.");
  }

  const v2Exists = await db.execute(sql`
    SELECT id FROM bd_decks WHERE domain = 'healthcare' AND deck_type = 'master' AND version = 'v2' LIMIT 1
  `);
  if (v2Exists.rows.length === 0) {
    await db.execute(sql`
      INSERT INTO bd_decks (title, domain, deck_type, version, status, slides)
      VALUES (
        'Healthcare Capability Deck',
        'healthcare',
        'master',
        'v2',
        'draft',
        ${v2Slides}::jsonb
      )
    `);
    console.log("[bd-decks-tables] Seeded Healthcare v2 master deck.");
  } else {
    console.log("[bd-decks-tables] Healthcare v2 already present — skipping.");
  }

  console.log("[bd-decks-tables] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[bd-decks-tables] Error:", err);
  process.exit(1);
});
