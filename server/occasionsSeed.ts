// ---------------------------------------------------------------------------
// Studio T4 — curated occasions dataset (US + India + industry awareness days).
// Explicit resolved dates per year (2026 + 2027); movable festivals are stored
// per year and refreshed by a yearly admin review — no religious-calendar math.
// Titles are plain ASCII (seed Unicode pitfall). Seeded idempotently via
// ON CONFLICT (name, date) WHERE project_id IS NULL.
// ---------------------------------------------------------------------------
import { sql } from "drizzle-orm";
import { db } from "./db";

export interface OccasionSeedRow {
  name: string;
  dates: string[]; // YYYY-MM-DD resolved per year
  region: "us" | "india" | "global";
  category: "national_holiday" | "festival" | "industry_awareness" | "fun_observance";
  contentAngle: string;
}

export const OCCASIONS_SEED: OccasionSeedRow[] = [
  // ---- Global anchors -----------------------------------------------------
  {
    name: "New Year's Day",
    dates: ["2026-01-01", "2027-01-01"],
    region: "global",
    category: "national_holiday",
    contentAngle: "Publish a hiring-market outlook for the year ahead - positions the brand as the strategist clients plan the year with.",
  },
  {
    name: "May Day (International Workers' Day)",
    dates: ["2026-05-01", "2027-05-01"],
    region: "global",
    category: "national_holiday",
    contentAngle: "Celebrate the workforce behind every project - a people-first story that reinforces the staffing mission without politics.",
  },
  {
    name: "Christmas Day",
    dates: ["2026-12-25", "2027-12-25"],
    region: "global",
    category: "festival",
    contentAngle: "Share a year-in-review thank-you to clients, candidates, and consultants - gratitude content that doubles as social proof.",
  },
  // ---- US national holidays ----------------------------------------------
  {
    name: "Martin Luther King Jr. Day (US)",
    dates: ["2026-01-19", "2027-01-18"],
    region: "us",
    category: "national_holiday",
    contentAngle: "Tie equitable hiring practices to measurable outcomes - show how structured, bias-aware processes widen talent pools.",
  },
  {
    name: "Presidents' Day (US)",
    dates: ["2026-02-16", "2027-02-15"],
    region: "us",
    category: "national_holiday",
    contentAngle: "A leadership-hiring angle: what separates managers who retain teams from those who lose them - backed by placement data.",
  },
  {
    name: "Memorial Day (US)",
    dates: ["2026-05-25", "2027-05-31"],
    region: "us",
    category: "national_holiday",
    contentAngle: "Honor service with substance: spotlight veteran hiring programs and the skills veterans bring to civilian teams.",
  },
  {
    name: "Juneteenth (US)",
    dates: ["2026-06-19", "2027-06-19"],
    region: "us",
    category: "national_holiday",
    contentAngle: "Move past statements to systems: share one concrete practice that makes hiring pipelines more inclusive.",
  },
  {
    name: "Independence Day (US)",
    dates: ["2026-07-04", "2027-07-04"],
    region: "us",
    category: "national_holiday",
    contentAngle: "Frame career independence: how contract and travel roles give professionals control over where and how they work.",
  },
  {
    name: "Labor Day (US)",
    dates: ["2026-09-07", "2027-09-06"],
    region: "us",
    category: "national_holiday",
    contentAngle: "The state of the American workforce in one chart - a data-led post that earns saves and shares from HR leaders.",
  },
  {
    name: "Veterans Day (US)",
    dates: ["2026-11-11", "2027-11-11"],
    region: "us",
    category: "national_holiday",
    contentAngle: "Profile a veteran placement story - credibility with government and healthcare clients who prioritize veteran hiring.",
  },
  {
    name: "Thanksgiving (US)",
    dates: ["2026-11-26", "2027-11-25"],
    region: "us",
    category: "national_holiday",
    contentAngle: "Thank the consultants working through the holidays - especially healthcare travelers - and make clients feel it too.",
  },
  // ---- Indian national days & festivals -----------------------------------
  {
    name: "Republic Day (India)",
    dates: ["2026-01-26", "2027-01-26"],
    region: "india",
    category: "national_holiday",
    contentAngle: "Celebrate India's talent powering global teams - a bridge story for clients hiring across US-India delivery models.",
  },
  {
    name: "Makar Sankranti / Pongal",
    dates: ["2026-01-14", "2027-01-14"],
    region: "india",
    category: "festival",
    contentAngle: "A harvest-of-skills metaphor: what your team 'harvests' from a year of upskilling - ties festival warmth to L&D.",
  },
  {
    name: "Holi",
    dates: ["2026-03-04", "2027-03-22"],
    region: "india",
    category: "festival",
    contentAngle: "Celebrate the many 'colors' of a cross-functional team - a culture post that showcases workplace belonging.",
  },
  {
    name: "Eid al-Fitr",
    dates: ["2026-03-20", "2027-03-10"],
    region: "india",
    category: "festival",
    contentAngle: "Highlight inclusive scheduling and floating holidays - practical inclusion content HR leaders actually reuse.",
  },
  {
    name: "Raksha Bandhan",
    dates: ["2026-08-28", "2027-08-17"],
    region: "india",
    category: "festival",
    contentAngle: "A bond-of-trust angle: what protecting your team looks like in practice - mentorship, sponsorship, and safe escalation.",
  },
  {
    name: "Independence Day (India)",
    dates: ["2026-08-15", "2027-08-15"],
    region: "india",
    category: "national_holiday",
    contentAngle: "Spotlight India's engineering and IT talent story - positions the brand inside the global capability-center wave.",
  },
  {
    name: "Ganesh Chaturthi",
    dates: ["2026-09-14", "2027-09-03"],
    region: "india",
    category: "festival",
    contentAngle: "New-beginnings framing for career moves: why the best time to plan a role change is before you need one.",
  },
  {
    name: "Gandhi Jayanti",
    dates: ["2026-10-02", "2027-10-02"],
    region: "india",
    category: "national_holiday",
    contentAngle: "Lead with values: one principle your hiring process refuses to compromise on - integrity content that builds trust.",
  },
  {
    name: "Dussehra",
    dates: ["2026-10-20", "2027-10-09"],
    region: "india",
    category: "festival",
    contentAngle: "Good-over-evil reframed for work: the hiring myths worth defeating - a myth-busting carousel with real data.",
  },
  {
    name: "Diwali",
    dates: ["2026-11-08", "2027-10-29"],
    region: "india",
    category: "festival",
    contentAngle: "Light up the people behind the placements - a gratitude campaign for consultants and clients that travels well on LinkedIn.",
  },
  // ---- Industry awareness days ---------------------------------------------
  {
    name: "Data Privacy Day",
    dates: ["2026-01-28", "2027-01-28"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Explain how candidate data is protected across the hiring funnel - trust content that differentiates a staffing firm.",
  },
  {
    name: "Engineers Week begins (US)",
    dates: ["2026-02-22", "2027-02-21"],
    region: "us",
    category: "industry_awareness",
    contentAngle: "Spotlight the engineers your clients depend on - project stories that double as engineering staffing credibility.",
  },
  {
    name: "Employee Appreciation Day",
    dates: ["2026-03-06", "2027-03-05"],
    region: "us",
    category: "fun_observance",
    contentAngle: "Show appreciation as a system, not a day: three low-cost recognition rituals managers can start this week.",
  },
  {
    name: "International Women's Day",
    dates: ["2026-03-08", "2027-03-08"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Feature women leaders in staffing, healthcare, and tech - real profiles beat generic graphics for reach and trust.",
  },
  {
    name: "World Health Day",
    dates: ["2026-04-07", "2027-04-07"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Connect workforce shortages to patient outcomes - a data-backed piece that positions healthcare staffing as care infrastructure.",
  },
  {
    name: "Administrative Professionals Day (US)",
    dates: ["2026-04-22", "2027-04-21"],
    region: "us",
    category: "fun_observance",
    contentAngle: "Celebrate the operators who keep offices running - a professional-services staffing nod with genuine warmth.",
  },
  {
    name: "World Day for Safety and Health at Work",
    dates: ["2026-04-28", "2027-04-28"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Share a compliance-ready safety onboarding checklist - useful, saveable content for engineering and industrial clients.",
  },
  {
    name: "National Nurses Week begins (US)",
    dates: ["2026-05-06", "2027-05-06"],
    region: "us",
    category: "industry_awareness",
    contentAngle: "Spotlight the nurses your clients depend on - a thank-you campaign that doubles as healthcare staffing credibility.",
  },
  {
    name: "International Nurses Day",
    dates: ["2026-05-12", "2027-05-12"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Tell one nurse's career story end-to-end - authentic clinician content outperforms any stock-photo tribute.",
  },
  {
    name: "International HR Day",
    dates: ["2026-05-20", "2027-05-20"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Publish the 'state of HR' from the trenches: what HR leaders are prioritizing this year - invite discussion, not applause.",
  },
  {
    name: "National Healthcare Recruiter Recognition Day (US)",
    dates: ["2026-06-02", "2027-06-01"],
    region: "us",
    category: "industry_awareness",
    contentAngle: "Pull back the curtain on what great healthcare recruiters actually do - educates clients and honors the team.",
  },
  {
    name: "National Doctors Day (India)",
    dates: ["2026-07-01", "2027-07-01"],
    region: "india",
    category: "industry_awareness",
    contentAngle: "Honor physicians with substance: the staffing decisions that protect doctor time - an operations angle clients remember.",
  },
  {
    name: "National Interns Day (US)",
    dates: ["2026-07-30", "2027-07-29"],
    region: "us",
    category: "fun_observance",
    contentAngle: "Showcase intern-to-hire journeys - early-talent proof points that appeal to both candidates and hiring managers.",
  },
  {
    name: "System Administrator Appreciation Day",
    dates: ["2026-07-31", "2027-07-30"],
    region: "global",
    category: "fun_observance",
    contentAngle: "Thank the invisible IT backbone - a lighthearted post that signals the firm understands technical roles deeply.",
  },
  {
    name: "Global Talent Acquisition Day",
    dates: ["2026-09-02", "2027-09-01"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Share one TA metric most teams measure wrong and how to fix it - practitioner content that earns recruiter follows.",
  },
  {
    name: "Programmers' Day",
    dates: ["2026-09-13", "2027-09-13"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Celebrate the 256th day with a developer-hiring insight: what senior engineers actually screen for in interviews.",
  },
  {
    name: "National Staffing Employee Week begins (US)",
    dates: ["2026-09-14", "2027-09-13"],
    region: "us",
    category: "industry_awareness",
    contentAngle: "Feature the contract professionals behind client wins - the staffing industry's own week, use real placement stories.",
  },
  {
    name: "Engineers Day (India)",
    dates: ["2026-09-15", "2027-09-15"],
    region: "india",
    category: "industry_awareness",
    contentAngle: "Honor Visvesvaraya's legacy with a modern engineering-talent insight - where India's engineering demand is heading.",
  },
  {
    name: "National IT Professionals Day (US)",
    dates: ["2026-09-15", "2027-09-21"],
    region: "us",
    category: "industry_awareness",
    contentAngle: "A day-in-the-life of the IT roles keeping businesses running - humanizes the tech staffing practice.",
  },
  {
    name: "World Mental Health Day",
    dates: ["2026-10-10", "2027-10-10"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Address burnout in high-demand roles like nursing and IT - practical manager guidance, not platitudes.",
  },
  {
    name: "International Day of Persons with Disabilities",
    dates: ["2026-12-03", "2027-12-03"],
    region: "global",
    category: "industry_awareness",
    contentAngle: "Share one accessibility improvement that widened your talent pool - concrete inclusion beats awareness-only posts.",
  },
];

// Idempotent seed: insert-or-refresh every curated row (global rows only).
export async function seedStudioOccasions(): Promise<void> {
  let count = 0;
  for (const o of OCCASIONS_SEED) {
    for (const d of o.dates) {
      await db.execute(sql`
        INSERT INTO studio_occasions (name, date, region, category, content_angle, project_id, is_active)
        VALUES (${o.name}, ${d}, ${o.region}, ${o.category}, ${o.contentAngle}, NULL, true)
        ON CONFLICT (name, date) WHERE project_id IS NULL
        DO UPDATE SET
          region = EXCLUDED.region,
          category = EXCLUDED.category,
          content_angle = EXCLUDED.content_angle
      `);
      count++;
    }
  }
  console.log(`Studio occasions seeded (${count} curated rows)`);
}
