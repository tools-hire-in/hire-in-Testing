import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Lightbulb,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { studioPath } from "@/lib/studioBase";
import { INSIGHT_REACTIONS } from "@shared/insights";

/**
 * Studio CMO Playbook (Task #914) — Layer 3: the full in-app guide.
 * Written at CMO + content-strategist level. Sticky left anchor nav,
 * scrollable content. Every internal Studio link is built from STUDIO_BASE.
 */

// ── Shared guide components ─────────────────────────────────────────────────

function ProTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="my-3 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>
        <p className="font-semibold text-amber-900 dark:text-amber-200">Pro Tip — {title}</p>
        <p className="mt-0.5 text-amber-800 dark:text-amber-300">{children}</p>
      </div>
    </div>
  );
}

function ScreenLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}>
      <span className="inline-flex cursor-pointer items-center gap-0.5 font-medium text-primary underline-offset-2 hover:underline">
        {children}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function StepList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="my-3 space-y-0">
      {steps.map((step, i) => (
        <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && (
            <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-border" aria-hidden />
          )}
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {i + 1}
          </span>
          <div className="pt-1 text-sm">{step}</div>
        </li>
      ))}
    </ol>
  );
}

function FlowStrip({ stages }: { stages: string[] }) {
  return (
    <div className="my-4 flex flex-wrap items-center gap-1.5">
      {stages.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="rounded-md border bg-muted px-2.5 py-1.5 text-xs font-semibold tracking-wide">
            {s}
          </span>
          {i < stages.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </span>
      ))}
    </div>
  );
}

function SignalMatrix() {
  return (
    <div className="my-4">
      <div className="grid grid-cols-[auto_1fr_1fr] gap-px overflow-hidden rounded-md border bg-border text-xs">
        <div className="bg-background p-2" />
        <div className="bg-muted p-2 text-center font-semibold">LOW CLICKS</div>
        <div className="bg-muted p-2 text-center font-semibold">HIGH CLICKS</div>

        <div className="flex items-center bg-muted p-2 font-semibold [writing-mode:horizontal-tb]">
          HIGH<br />REACTIONS
        </div>
        <div className="bg-sky-50 p-3 dark:bg-sky-950/30">
          <p className="font-semibold text-sky-900 dark:text-sky-200">Resonates, fix the CTA</p>
          <p className="mt-1 text-sky-800 dark:text-sky-300">Great content with a weak call to action. Strengthen the CTA and re-measure.</p>
        </div>
        <div className="bg-emerald-50 p-3 dark:bg-emerald-950/30">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">Resonates AND converts ★</p>
          <p className="mt-1 text-emerald-800 dark:text-emerald-300">Your best content. Replicate the topic, format, and angle. Repurpose it.</p>
        </div>

        <div className="flex items-center bg-muted p-2 font-semibold">
          LOW<br />REACTIONS
        </div>
        <div className="bg-red-50 p-3 dark:bg-red-950/30">
          <p className="font-semibold text-red-900 dark:text-red-200">Revisit the topic</p>
          <p className="mt-1 text-red-800 dark:text-red-300">Not resonating, not converting. Question the topic, channel, and format.</p>
        </div>
        <div className="bg-amber-50 p-3 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Converts, low resonance</p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">Functional, not memorable. Keep for direct-response; don't brand-build with it.</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ id, index, title, subtitle }: { id: string; index: string; title: string; subtitle: string }) {
  return (
    <div className="scroll-mt-20 border-t pt-8 first:border-t-0 first:pt-0" id={id}>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Section {index}</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm italic text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function Why({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-sm leading-relaxed">
      <span className="font-semibold">Why this matters:</span> {children}
    </p>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed">{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 text-sm font-semibold">{children}</h3>;
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

// ── Sections index ──────────────────────────────────────────────────────────

const SECTIONS: { id: string; index: string; label: string }[] = [
  { id: "s0", index: "0", label: "The Studio at a Glance" },
  { id: "s1", index: "1", label: "Setting Up a Project" },
  { id: "s2", index: "2", label: "Configuring Brand Voice" },
  { id: "s3", index: "3", label: "Planning on the Calendar" },
  { id: "s4", index: "4", label: "Running a Campaign" },
  { id: "s5", index: "5", label: "The Editorial Workflow" },
  { id: "s6", index: "6", label: "Social Content" },
  { id: "s7", index: "7", label: "Multiple Brand Projects" },
  { id: "s8", index: "8", label: "Reading the Signals" },
  { id: "s9", index: "9", label: "Notification Setup" },
];

export default function Guide() {
  const [activeId, setActiveId] = useState<string>("s0");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-guide-title">
              The Studio Playbook
            </h1>
            <p className="text-sm text-muted-foreground">
              How to run a full content operation — strategy, AI, and signals — as a team of one.
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* Sticky anchor nav */}
          <nav className="hidden lg:block">
            <div className="sticky top-6 space-y-0.5" data-testid="nav-guide-sections">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    activeId === s.id
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`nav-guide-${s.id}`}
                >
                  <span className="w-4 shrink-0 text-xs tabular-nums opacity-60">{s.index}</span>
                  <span className="truncate">{s.label}</span>
                  {activeId === s.id && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="min-w-0 space-y-8 pb-16">
            {/* ── Section 0 ── */}
            <section>
              <SectionHeading
                id="s0"
                index="0"
                title="The Studio at a Glance"
                subtitle="A one-page orientation — what the system is, what it is not, and how the pieces connect."
              />
              <P>
                The Studio is built around one idea: <strong>strategy before production</strong>. Most content
                teams produce first and wonder why it doesn't work. The Studio flips that — you plan, brief,
                assign, and approve before a single word is written.
              </P>
              <H3>The five layers of the Studio:</H3>
              <FlowStrip stages={["PROJECTS", "CAMPAIGNS", "IDEAS", "ARTICLES / SOCIAL KITS", "ANALYTICS"]} />
              <UL
                items={[
                  <><strong>Projects</strong> — one per brand (Hire'in Solutions, ProKred, KlerIQ AI). Each has its own brand voice, author profiles, and content calendar. Never mix brands in one project.</>,
                  <><strong>Campaigns</strong> — the strategic unit. A campaign is a themed push with a goal, a timeframe, and a set of channels. Everything traces back to a campaign.</>,
                  <><strong>Ideas</strong> — the planning unit. An idea lives on the calendar before anything is produced. It has a topic, a brief, an assignee, a status. Ideas prevent the "what do we post today?" panic.</>,
                  <><strong>Articles</strong> — long-form editorial content that publishes to the Insights section. Edited with AI assistance, reviewed, approved, then live.</>,
                  <><strong>Social Kits</strong> — captions, copy, and creative briefs for LinkedIn, Instagram, Facebook. Generated from Social ideas or repurposed from published articles.</>,
                  <><strong>Analytics</strong> — reactions (quality signal) and CTA clicks (effectiveness signal) combined into a per-campaign picture of what's working.</>,
                ]}
              />
              <P>
                <strong>What the Studio is not:</strong> A publishing tool that posts directly to platforms.
                Content goes here for strategy, drafting, review, and approval. Approved Social content is
                downloaded and posted by the social media manager. This is deliberate — it keeps a human in the
                loop before anything goes live.
              </P>
              <ProTip title="The 3-project rule">
                If you're running more than one brand, create a separate project for each. Never share a project
                between brands. Brand voice, author profiles, and campaign history are per-project — mixing
                brands poisons all three.
              </ProTip>
            </section>

            {/* ── Section 1 ── */}
            <section>
              <SectionHeading
                id="s1"
                index="1"
                title="Setting Up a Project (Your Brand's Home)"
                subtitle="Start here — before the calendar, before AI, before anything."
              />
              <Why>
                Every AI generation, every campaign, every published article belongs to a project. The project
                holds the brand voice that makes your content sound like <em>you</em> instead of generic AI
                output. Getting this right first is the single highest-leverage setup action in the Studio.
              </Why>
              <H3>How to do it:</H3>
              <StepList
                steps={[
                  <>Go to the <ScreenLink href={studioPath("")}>Studio Dashboard</ScreenLink> → click the project switcher in the top bar → <strong>New Project</strong></>,
                  <>Name it exactly as the brand appears publicly (e.g., "Hire'in Solutions" not "Hirein" or "HS")</>,
                  <>Go to <strong>Settings → Brand Voice</strong> and configure before doing anything else (see Section 2)</>,
                  <>Go to <ScreenLink href={studioPath("/authors")}>Authors</ScreenLink> → create at least one author profile for this project. Authors appear on published articles; they need a name, title, short bio, and photo.</>,
                  <>Go to <strong>Settings → Templates</strong> to check the default article templates — these control the structural scaffolding AI uses when generating drafts.</>,
                ]}
              />
              <ProTip title="Name your project publicly">
                The project name can appear in article bylines and email footers. Use the brand's exact public
                name. Abbreviations or internal nicknames create inconsistency across every piece of content.
              </ProTip>
              <ProTip title="One Author profile per real person, not per role">
                If the CEO and the Head of Marketing both write content, create two profiles. If it's one
                person, one profile. Don't create fake author personas — readers (and Google) notice.
              </ProTip>
            </section>

            {/* ── Section 2 ── */}
            <section>
              <SectionHeading
                id="s2"
                index="2"
                title="Configuring Brand Voice (The Most Important Setting)"
                subtitle="The difference between AI content that sounds like you and AI content that sounds like everyone else."
              />
              <Why>
                Every time you click "Generate" in the Article Editor or ask AI to draft a campaign plan, it
                reads your Brand Voice configuration first. If the config is empty, AI falls back to a generic
                professional tone — technically correct, completely forgettable. A well-configured brand voice
                means you can generate a first draft and spend 10 minutes editing instead of an hour rewriting.
              </Why>
              <H3>How to do it:</H3>
              <P>
                Go to <ScreenLink href={studioPath("/settings/brand-voice")}>Settings → Brand Voice</ScreenLink> for
                your project. You will configure two levels:
              </P>
              <P>
                <strong>Default Voice</strong> — applies to all content unless a platform overrides it:
              </P>
              <UL
                items={[
                  <><strong>Tone Tags</strong> — 3 to 5 words that describe the brand's personality. Examples for Hire'in Solutions: <code>Credible</code>, <code>Warm</code>, <code>Direct</code>, <code>Industry-expert</code>. Examples for a tech brand: <code>Technical</code>, <code>Plain-spoken</code>, <code>No-hype</code>.</>,
                  <><strong>Guardrails</strong> — things AI must never do. Be specific. "Never invent statistics" is a guardrail. "Be professional" is not. Good examples: "Never claim to be the largest or best without a citation." "Don't use passive voice." "Never use the word 'leverage' as a verb."</>,
                  <><strong>Banned Phrases</strong> — words and phrases that are off-brand. Examples: "game-changer", "revolutionary", "cutting-edge", "seamless", "robust solution", "synergy". List them comma-separated.</>,
                  <><strong>Signature Phrases</strong> — phrases the brand actually uses. Examples: "At Hire'in Solutions,", "For healthcare professionals,", "The right fit matters because—". These anchor generated content in your voice.</>,
                ]}
              />
              <P>
                <strong>Per-Platform Overrides</strong> — same project, different tone per channel:
              </P>
              <div className="my-3 space-y-2 rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                <p><span className="font-semibold text-primary">LinkedIn</span> → tone: <span className="text-emerald-700 dark:text-emerald-400">Thought-leadership, Data-backed</span> · signature: <span className="text-emerald-700 dark:text-emerald-400">"Follow Hire'in Solutions for more weekly insights →"</span></p>
                <p><span className="font-semibold text-primary">Instagram</span> → tone: <span className="text-emerald-700 dark:text-emerald-400">Conversational, Approachable, Punchy</span> · signature: <span className="text-emerald-700 dark:text-emerald-400">#HireInSolutions #Staffing</span></p>
                <p><span className="font-semibold text-primary">Instagram Story</span> → tone: <span className="text-emerald-700 dark:text-emerald-400">Punchy, Direct</span> · signature: <span className="text-muted-foreground">(none — too short)</span></p>
              </div>
              <UL
                items={[
                  <><strong>LinkedIn</strong> — usually more authoritative and data-backed than the default. Override Tone and Signature Phrases.</>,
                  <><strong>Instagram</strong> — usually more energetic and conversational.</>,
                  <><strong>Instagram Story</strong> — most compressed channel. No signature — too short.</>,
                ]}
              />
              <P>
                The system merges: <strong>Platform Override → Project Default → System Default</strong>. So if
                you only set Instagram's Tone, everything else (guardrails, banned phrases) still comes from
                your Default.
              </P>
              <ProTip title="Write your guardrails from your worst AI output">
                Generate an article without any brand voice. Read it. Every sentence that makes you wince — turn
                that into a guardrail. The first draft is your list.
              </ProTip>
              <ProTip title="Banned phrases are the easiest win">
                Every industry has the same 20 clichés AI gravitates toward. For staffing: "top talent",
                "seamless hiring experience", "robust pipeline". For healthcare: "compassionate care",
                "cutting-edge treatments". List them all. Banned phrases are enforced on every generation.
              </ProTip>
              <ProTip title="Review brand voice quarterly">
                As your brand matures, the voice should too. Stale brand voice configs produce content that
                sounds like last year's company.
              </ProTip>
            </section>

            {/* ── Section 3 ── */}
            <section>
              <SectionHeading
                id="s3"
                index="3"
                title="Planning Content on the Calendar"
                subtitle="Never ask &quot;what do we post today?&quot; again."
              />
              <Why>
                Reactive content — deciding what to write the day you write it — produces inconsistent quality,
                missed opportunities, and channel neglect. The Content Plan exists to get one month ahead. Once
                you're a month ahead, content production becomes a calm, scheduled process instead of a daily
                scramble.
              </Why>
              <H3>One pipeline, three lenses:</H3>
              <P>
                Go to <ScreenLink href={studioPath("/calendar")}>Calendar</ScreenLink>. The Content Plan is one
                pipeline of ideas — articles, posts, and stories — that you can view through three lenses,
                switchable at the top of the page:
              </P>
              <UL
                items={[
                  <><strong>Calendar</strong> — the month view. Idea chips sit on their scheduled dates, colour-coded by status (grey = Idea, yellow = In Review, green = Approved, blue = In Production, teal = Done). This is your planning lens.</>,
                  <><strong>Board</strong> — a kanban of the same ideas grouped by status column. This is your workflow lens — see at a glance what's stuck in review or production.</>,
                  <><strong>Table</strong> — every idea as a row with inline editing and CSV export. This is your weekly-review lens for bulk cleanups and planning meetings.</>,
                ]}
              />
              <H3>To plan a new idea:</H3>
              <P>
                Click the <strong>+</strong> on any date in the Calendar lens (or <strong>New idea</strong> at
                the top) and fill in:
              </P>
              <UL
                items={[
                  <><strong>Content Family:</strong> Editorial (blog, deep-dive, how-to) or Social (LinkedIn, Instagram post, Story, Facebook)</>,
                  <><strong>Channel:</strong> filters by family — picks the specific format</>,
                  <><strong>Topic:</strong> one sentence — what is this piece about?</>,
                  <><strong>Brief:</strong> 2-4 sentences — the angle, the key points, the target reader</>,
                  <><strong>Assignee</strong> (optional at planning time)</>,
                ]}
              />
              <P>
                The idea saves to that date and appears on the calendar in grey (Idea status). Clicking any idea —
                in any lens — opens the <strong>peek panel</strong> on the right: full details, status actions,
                assignee, comments, and campaign links, without leaving the view you're in.
              </P>
              <H3>The backlog tray:</H3>
              <P>
                Ideas without a scheduled date live in the <strong>Backlog</strong> tray below the calendar.
                Capture ideas the moment you have them — schedule them later when you plan the month. An empty
                backlog means you're planning reactively; a healthy backlog means you always have material ready.
              </P>
              <H3>Importing a plan via CSV:</H3>
              <P>
                Already planned a month in a spreadsheet? Click <strong>Import</strong> in the Content Plan. The
                flow is preview → commit → rollback: upload the CSV, review exactly which rows will become ideas,
                confirm — and if the import was wrong, roll it back in one click. This is the fastest way to move
                an existing content calendar into the Studio.
              </P>
              <H3>To assign and move to review:</H3>
              <P>
                Open the idea in the peek panel → assign to yourself or a team member → move it to review. Status
                changes to yellow (In Review). The reviewer approves it from the same panel — status moves to
                green (Approved). Now it's ready for production.
              </P>
              <ProTip title="Plan in monthly sprints">
                At the start of each month, block 30 minutes on the calendar view. Use "Generate Content Plan"
                inside a campaign to have AI suggest topics for the whole month. Review, edit, confirm. Month
                planned. This is the highest-ROI 30 minutes in your content operation.
              </ProTip>
              <ProTip title="Don't plan every day">
                Three to four pieces of content per week — consistently — beats seven pieces per week for two
                weeks then silence. Whitespace on the calendar is fine. Inconsistency is not.
              </ProTip>
              <ProTip title="The bottom-up path">
                You don't have to start with a campaign to plan ideas. Plan ideas freely on the calendar, then
                retroactively group them into a campaign using "Add to Campaign" on any idea card. This is how
                great themes emerge organically.
              </ProTip>
            </section>

            {/* ── Section 4 ── */}
            <section>
              <SectionHeading
                id="s4"
                index="4"
                title="Running a Campaign (Strategy at Scale)"
                subtitle="From one paragraph of intent to a full month of content, in minutes."
              />
              <Why>
                A Campaign is the difference between a content calendar and a content strategy. Without
                campaigns, you have a list of pieces. With campaigns, every piece connects to a goal, an
                audience, and a measurable outcome. Campaigns also unlock AI's most powerful feature:
                brief-to-plan generation, where you write one paragraph and AI maps out a full publishing
                schedule across all your channels.
              </Why>
              <H3>How to do it — Top-Down (Strategic Start):</H3>
              <StepList
                steps={[
                  <>Go to <ScreenLink href={studioPath("/campaigns")}>Campaigns</ScreenLink> → <strong>New Campaign</strong></>,
                  <>
                    Fill in:
                    <UL
                      items={[
                        <><strong>Name</strong> — thematic, specific. "Q3 Healthcare Staffing Guide" not "July Content"</>,
                        <><strong>Strategic Brief</strong> — the most important field. Write 2-4 sentences: what is this campaign about, who is it for, what do you want them to do after consuming it? Example: "Target healthcare facility managers in Tier-1 cities who are struggling with nurse attrition. Goal: demonstrate Hire'in Solutions' depth of understanding of the nursing shortage. CTA: Request a consultation."</>,
                        <><strong>Channels</strong> — which platforms will this campaign use? Multi-select: LinkedIn, Instagram, Blog, etc.</>,
                        <><strong>Date Range</strong> — start and end date of the campaign</>,
                      ]}
                    />
                  </>,
                  <>Click <strong>Generate Content Plan</strong> → a preview panel opens showing AI's suggested topics, channels, and dates for the full campaign period</>,
                  <><strong>Edit the preview</strong> — AI suggestions are a starting point, not a final answer. Change topics, swap channels, adjust dates. Add rows for pieces AI missed. Remove rows that don't fit.</>,
                  <>Click <strong>Confirm & Add to Calendar</strong> — all ideas appear on the calendar linked to this campaign. Campaign board now shows them in the kanban view.</>,
                ]}
              />
              <H3>How to do it — Bottom-Up (Organic Start):</H3>
              <P>
                You already have 5 ideas on the calendar that all relate to the same theme. Instead of starting
                with a campaign:
              </P>
              <StepList
                steps={[
                  <>Open any idea on the calendar → click <strong>Add to Campaign</strong> → select an existing campaign or create one inline</>,
                  <>Repeat for each related idea</>,
                  <>Now the campaign board shows all 5, linked and tracked together</>,
                ]}
              />
              <H3>The Campaign Board:</H3>
              <P>
                Open any campaign from <ScreenLink href={studioPath("/campaigns")}>Campaigns</ScreenLink>:
              </P>
              <UL
                items={[
                  <><strong>Kanban columns:</strong> Idea → In Review → Approved → In Production → Done</>,
                  <><strong>Progress bar</strong> at the top: X of Y pieces Done (accurate — links to real idea + article status)</>,
                  <><strong>Contributors:</strong> everyone assigned to any idea in this campaign</>,
                  <><strong>Each card:</strong> channel, topic, assignee, due date chip</>,
                ]}
              />
              <ProTip title="The brief is the brief">
                The quality of AI's content plan output is a direct function of brief quality. A vague brief
                ("post about staffing") produces vague topics. A specific brief with a real audience, a real
                problem, and a real CTA produces a plan you can actually use. Spend 10 minutes on the brief.
                Save hours on the content.
              </ProTip>
              <ProTip title="One campaign per month per brand">
                More than one active campaign per brand at a time splits your creative energy and confuses your
                audience. The exception: if you serve clearly distinct audiences (e.g., employers and
                candidates), run one campaign per audience segment.
              </ProTip>
              <ProTip title="End every campaign with a repurpose pass">
                When the editorial articles in a campaign are published, go to each one and click{" "}
                <strong>Repurpose</strong>. Select your social channels. AI will generate one Social idea per
                channel from the article — extending the campaign's reach for free. This typically doubles the
                effective output of each editorial piece.
              </ProTip>
            </section>

            {/* ── Section 5 ── */}
            <section>
              <SectionHeading
                id="s5"
                index="5"
                title="The Editorial Workflow (Idea to Published Article)"
                subtitle="The five-stage process that keeps quality consistent without slowing everything down."
              />
              <Why>
                Unreviewed content is a brand risk. But an approval process that takes two weeks kills momentum.
                The Studio's five-stage workflow is designed to be fast for solo operators and rigorous for
                teams — the same system, scaled by how many people are in the loop.
              </Why>
              <H3>The five stages:</H3>
              <FlowStrip stages={["IDEA", "APPROVED", "IN PRODUCTION", "CM REVIEW", "PUBLISHED"]} />
              <P>
                <strong>Stage 1 — Idea</strong> (already covered in Section 3). Idea exists on the calendar with
                a topic, brief, and assignee.
              </P>
              <P>
                <strong>Stage 2 — Approved.</strong> An approver (or you, for solo operation) reviews the idea
                and clicks Approve. This is the editorial commissioning decision — is this topic right for this
                campaign? Is the brief strong enough to produce a good article?
              </P>
              <P>
                <strong>Stage 3 — In Production (Article Editor).</strong> From an Approved Editorial idea, click{" "}
                <strong>Create Article</strong>. The system creates a new article with the idea's topic as the
                title, copies the idea's brief into the <strong>Generation Brief</strong> field (the AI context
                block — not the article body), and opens the Article Editor from{" "}
                <ScreenLink href={studioPath("/articles")}>Articles</ScreenLink>.
              </P>
              <P>In the Article Editor:</P>
              <UL
                items={[
                  <><strong>Generation Brief</strong> — review and expand the AI context. Add: key stats or facts you want included, specific references or links, the exact target reader, the article's one core argument. The better this is, the better the AI draft.</>,
                  <>Click <strong>Generate Draft</strong> — AI reads the brief + your brand voice config and produces a full draft in your brand's voice</>,
                  <><strong>Edit the draft</strong> — AI output is a first draft, not a final article. Always edit. Check: is the argument clear? Does it sound like you? Are all facts accurate?</>,
                  <>Set the <strong>Author</strong> (from your author profiles), <strong>Publish Date</strong>, <strong>Content Type</strong></>,
                  <>Click <strong>Submit for Review</strong> — status moves to CM Review</>,
                ]}
              />
              <P>
                <strong>Stage 4 — CM Review.</strong> The Content Manager reviews the final draft in{" "}
                <ScreenLink href={studioPath("/cm-review")}>CM Review</ScreenLink>. Can approve or return with
                comments. For solo operators: you are the CM. Review your own work with fresh eyes — ideally
                after a break.
              </P>
              <P>
                <strong>Stage 5 — Published.</strong> Approved article publishes to the Insights section
                (/insights). The linked idea on the calendar automatically moves to <strong>Done</strong>{" "}
                status. Campaign progress bar advances.
              </P>
              <ProTip title="The Generation Brief is the most under-used field">
                Most users skip it and click Generate immediately. The AI output is then generic. Spend 5
                minutes writing the Generation Brief as if you're briefing a senior copywriter. Include: the one
                argument the article must make, two or three facts you want cited, the specific reader (not
                "decision makers" — "a Head of IT at a 500-person company who is worried about vendor lock-in"),
                and any phrases you want to appear.
              </ProTip>
              <ProTip title="Edit for voice, not for content">
                AI handles structure and volume. Your job in editing is voice. Read the draft aloud. Every
                sentence that sounds stiff or robotic — rewrite it. Every paragraph where the brand's
                perspective isn't clear — add it. Content: AI. Voice: you.
              </ProTip>
              <ProTip title="Use CM Review even as a solo operator">
                The step exists to create distance between writing and publishing. After generating and editing,
                submit for CM Review and don't open it again for 2 hours. When you return to review, you'll
                catch things you missed.
              </ProTip>
            </section>

            {/* ── Section 6 ── */}
            <section>
              <SectionHeading
                id="s6"
                index="6"
                title="Social Content (Fast, Platform-Native, On-Brand)"
                subtitle="From Social idea to caption copy in minutes — without sounding like you wrote it in a hurry."
              />
              <Why>
                Social content has a different rhythm from editorial. It needs to be faster, shorter,
                platform-specific, and more frequent. A LinkedIn post has different expectations than an
                Instagram Story. The Studio handles Social as a separate content family — with its own idea
                type, its own AI generation flow, and its own per-platform voice config.
              </Why>
              <H3>How social ideas work:</H3>
              <P>
                When you create an idea on the <ScreenLink href={studioPath("/calendar")}>calendar</ScreenLink>{" "}
                and select <strong>Social</strong> as the content family, you then choose the channel:
              </P>
              <UL
                items={[
                  <><strong>LinkedIn Post</strong> — up to 3,000 characters, professional tone, thought-leadership angle</>,
                  <><strong>Instagram Post</strong> — up to 2,200 characters, more visual, shorter caption recommended</>,
                  <><strong>Instagram Story</strong> — text + image brief, ~150 characters, very punchy</>,
                  <><strong>Facebook Post</strong> — longer-form acceptable, community feel</>,
                ]}
              />
              <P>A Social idea has extra fields beyond the standard idea:</P>
              <UL
                items={[
                  <><strong>Caption/Copy</strong> — if you already know what you want to say, write it here at planning time. AI can use this as direction or refine it.</>,
                  <><strong>Requirement</strong> — creative brief for the visual: dimensions, mood, any text overlay needed</>,
                  <><strong>Creative Link</strong> — link to the final asset (Canva, Drive, etc.) once it's ready</>,
                  <><strong>Story Content / Story Reference / Story Creative Link</strong> — same fields for the Story version if this post has a companion Story</>,
                ]}
              />
              <H3>Generating a Social Kit:</H3>
              <P>
                From an Approved Social idea, click <strong>Generate Social Kit</strong>. AI generates:
              </P>
              <UL
                items={[
                  <>Platform-optimised caption copy using your LinkedIn or Instagram brand voice override</>,
                  <>Hashtag suggestions (Instagram/Facebook)</>,
                  <>A creative brief for the image (what should the visual show, text overlay suggestion)</>,
                ]}
              />
              <P>
                Review, edit, download. Post manually — the Studio does not publish to platforms directly.
              </P>
              <H3>Repurposing editorial as social:</H3>
              <P>
                The fastest way to fill the social calendar: go to any published article → click{" "}
                <strong>Repurpose</strong> → select channels. AI reads the article and generates one Social idea
                per selected channel, each with a caption draft, placed on the calendar at staggered dates. This
                turns one article into 3-5 social posts without starting from scratch.
              </P>
              <ProTip title="Platform voice overrides are mandatory for social">
                The default brand voice is built for editorial. LinkedIn and Instagram are distinct enough that
                generic copy sounds off-brand on both. Configure the per-platform overrides in Settings → Brand
                Voice before generating any social content.
              </ProTip>
              <ProTip title="Instagram Stories are a campaign tool, not an afterthought">
                Stories drive to a link or to the main post. When you approve an Instagram Post idea, always
                create a companion Story idea the same day. The Studio's import flow can split them from a
                single planning row — use it.
              </ProTip>
              <ProTip title="80/20 the social calendar">
                80% value-led content (insights, case studies, team stories, industry data). 20% direct
                promotion (open roles, services, CTAs). Violating this ratio accelerates audience fatigue. The
                Campaign board makes this visible — look at the ratio of content types in any campaign.
              </ProTip>
            </section>

            {/* ── Section 7 ── */}
            <section>
              <SectionHeading
                id="s7"
                index="7"
                title="Managing Multiple Brand Projects"
                subtitle="How to run Hire'in Solutions, ProKred, and KlerIQ AI from one Studio without mixing them up."
              />
              <Why>
                Each brand has a distinct audience, a distinct voice, and a distinct content goal. Mixing them
                in one project produces content that's confused about who it's talking to. The Studio's project
                system exists precisely for this: complete separation of brand voice, campaigns, ideas, authors,
                and analytics — per project — with one-click switching.
              </Why>
              <H3>The project-per-brand rule:</H3>
              <UL
                items={[
                  <><strong>Hire'in Solutions Project</strong> — staffing industry content for employers and candidates. Voice: credible, warm, industry-expert.</>,
                  <><strong>ProKred Project</strong> — professional credentialing content. Voice: authoritative, process-focused, compliance-aware.</>,
                  <><strong>KlerIQ AI Project</strong> — AI and tech content. Voice: technical but plain-spoken, no hype.</>,
                ]}
              />
              <H3>How to switch projects:</H3>
              <P>
                Use the <strong>Project Switcher</strong> in the{" "}
                <ScreenLink href={studioPath("")}>Studio top bar</ScreenLink>. The entire Studio — calendar,
                campaigns, articles, analytics — switches context. Your Brand Voice, your Authors, your
                Campaigns are all project-specific.
              </P>
              <div className="my-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Shared across projects
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                    <li>Studio Access roles (who can use the Studio at all)</li>
                    <li>Your user account and notification preferences</li>
                    <li>The notification centre</li>
                  </ul>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    NOT shared (kept separate)
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                    <li>Brand voice configuration</li>
                    <li>Author profiles</li>
                    <li>Campaigns and content ideas</li>
                    <li>Published articles and analytics</li>
                    <li>Subscriber lists</li>
                    <li>Templates</li>
                  </ul>
                </div>
              </div>
              <P>
                <strong>Setting up a new brand project:</strong> Follow Section 1. The most important
                new-project action is configuring Brand Voice (Section 2) before generating anything. An empty
                brand voice config on a new project means the first AI output will sound identical to the other
                brand — which defeats the purpose.
              </P>
              <ProTip title="Use the project switcher to audit brand consistency">
                Switch to each project monthly and read the last 5 published pieces. Do they all sound like that
                brand? If LinkedIn posts sound the same across ProKred and Hire'in, your per-platform voice
                overrides aren't specific enough.
              </ProTip>
            </section>

            {/* ── Section 8 ── */}
            <section>
              <SectionHeading
                id="s8"
                index="8"
                title="Reading the Signals (What Good Looks Like)"
                subtitle="How to use reactions and click data to decide what to make more of — and what to stop."
              />
              <Why>
                Most content teams make decisions based on gut feel. The Studio gives you two objective signals
                per article: <strong>Reactions</strong> (did it resonate?) and <strong>CTA Clicks</strong> (did
                it drive action?). Used together, they tell a precise story about what's working.
              </Why>
              <H3>The two signals:</H3>
              <div className="my-3 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3 font-semibold">Signal</th>
                      <th className="py-2 pr-3 font-semibold">What it measures</th>
                      <th className="py-2 font-semibold">Where to find it</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 pr-3">
                        {INSIGHT_REACTIONS.map((r) => `${r.emoji} ${r.label}`).join(", ")}
                      </td>
                      <td className="py-2 pr-3">
                        Content <strong>quality</strong> — did readers connect with it emotionally or intellectually?
                      </td>
                      <td className="py-2">Article page (live), Analytics page</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3">CTA Clicks</td>
                      <td className="py-2 pr-3">
                        Content <strong>effectiveness</strong> — did readers take the action you wanted?
                      </td>
                      <td className="py-2">Campaign Analytics tab</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <H3>The 2×2 Engagement Matrix:</H3>
              <SignalMatrix />
              <UL
                items={[
                  <><strong>Top right (Resonates + Converts):</strong> Your best content. Analyse what made it work. Replicate the topic, format, and angle. Use the Repurpose button to extend its reach.</>,
                  <><strong>Top left (Resonates, weak CTA):</strong> Great content with a weak or unclear call to action. Go back into the article and strengthen the CTA — rewrite the button label, make the offer clearer, add urgency. Then monitor CTA clicks on the updated version.</>,
                  <><strong>Bottom right (Converts, low resonance):</strong> Functional content — people click but don't react emotionally. Good for pipeline but bad for brand. Don't replicate this format for brand-building campaigns; keep it for direct-response campaigns.</>,
                  <><strong>Bottom left (Revisit):</strong> Not resonating, not converting. Look at the topic (wrong audience?), the channel (wrong platform?), and the format (wrong content type?). Don't write more pieces like this.</>,
                ]}
              />
              <P>
                The <ScreenLink href={studioPath("/analytics")}>Studio Analytics page</ScreenLink> shows:
              </P>
              <UL
                items={[
                  <>Total reactions, reaction breakdown by type (which emotion your content triggers)</>,
                  <>Average reactions per article (your quality baseline — watch it trend up over time)</>,
                  <>Top articles by combined engagement</>,
                  <>Per-author performance</>,
                  <>Campaign attribution — which campaigns produced the most engaged content</>,
                ]}
              />
              <H3>Reading reaction types:</H3>
              <UL
                items={[
                  <>Mostly 👍 Helpful → Your content is practical and useful. Strong for bottom-of-funnel.</>,
                  <>Mostly 💡 Insightful → Your content teaches something new. Strong for brand authority.</>,
                  <>Mostly ❤️ Love this → Emotional resonance. Strong for brand loyalty and sharing.</>,
                  <>Mostly 🔖 Saved it → High-intent signal. Readers want to return to this. Best evergreen content signal.</>,
                ]}
              />
              <ProTip title="The 🔖 Save is the most valuable reaction">
                It means the reader thinks this content is worth keeping. Identify your most-saved articles and
                ask: what topic, what format, what length? Those parameters are your evergreen content formula.
              </ProTip>
              <ProTip title="Check analytics before planning the next campaign">
                Open Analytics before every new campaign brief. Look at the top 3 performing articles from the
                previous campaign. The next campaign brief should deliberately continue what's working. Most
                teams skip this and treat every campaign as a fresh start.
              </ProTip>
              <ProTip title="Reactions without clicks is a signal about your CTA, not your content">
                If a piece has 50 reactions and 3 clicks, the article is doing its job. The CTA is not. Before
                writing a new article, fix the CTA on that one.
              </ProTip>
            </section>

            {/* ── Section 9 ── */}
            <section>
              <SectionHeading
                id="s9"
                index="9"
                title="Notification Setup (Act on What Matters, Ignore the Rest)"
                subtitle="How to configure Studio alerts so every notification is signal, not noise."
              />
              <Why>
                A notification system that sends too much produces the same result as one that sends too little
                — people stop looking. The Studio sends events for every meaningful workflow action. Your job is
                to tune which ones reach your inbox vs. which ones can wait for the weekly digest.
              </Why>
              <P>
                <strong>Where to configure:</strong> Go to your{" "}
                <ScreenLink href="/admin/hr/profile?tab=notifications">Profile → Notifications tab</ScreenLink>.
                Two toggles per event type: <strong>In-App</strong> (bell icon, 30s refresh) and{" "}
                <strong>Email</strong> (immediate or digest).
              </P>
              <H3>Recommended configuration for a solo Studio Owner:</H3>
              <div className="my-3 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3 font-semibold">Event</th>
                      <th className="px-2 py-2 text-center font-semibold">In-App</th>
                      <th className="px-2 py-2 text-center font-semibold">Email</th>
                      <th className="py-2 font-semibold">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Idea assigned to me", "✅", "✅", "You need to act on this"],
                      ["Review requested on my idea", "✅", "✅", "Time-sensitive"],
                      ["My idea approved", "✅", "❌", "Good news, not urgent"],
                      ["My idea rejected", "✅", "✅", "Needs a response"],
                      ["New comment on my idea", "✅", "❌", "Check at next session"],
                      ["Campaign plan approved", "✅", "❌", "Informational"],
                      ["Campaign piece overdue", "✅", "✅", "Needs immediate action"],
                      ["Deadline approaching (48h)", "✅", "✅", "Act now"],
                      ["Studio weekly digest", "—", "✅", "Monday summary of all pending"],
                    ].map(([event, inApp, email, why]) => (
                      <tr key={event} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">{event}</td>
                        <td className="px-2 py-2 text-center">{inApp}</td>
                        <td className="px-2 py-2 text-center">{email}</td>
                        <td className="py-2 text-muted-foreground">{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <P>
                <strong>The Weekly Digest</strong> (every Monday 08:00) gives you one email with:
              </P>
              <UL
                items={[
                  <>Unread Studio notifications from last 7 days</>,
                  <>Ideas assigned to you with deadlines this week</>,
                  <>Overdue pieces that need reschedule or reassign</>,
                ]}
              />
              <P>
                For a solo operator, the digest is often enough — you can keep the email toggles off for most
                events and let the digest handle the summary.
              </P>
              <P>
                The <ScreenLink href="/admin/notifications">Notification Centre</ScreenLink> shows the full
                history of all notifications across Studio, HR, and Payroll — grouped by category, with deep
                links to the relevant screen.
              </P>
              <ProTip title="Start with everything on, then turn off after one week">
                You won't know what's noise until you've seen the volume. After 7 days, look at which
                notifications you ignored. Turn those email alerts off; keep the in-app ones.
              </ProTip>
              <div className="mt-8 rounded-md border bg-muted/40 p-4 text-center text-sm">
                <p className="font-medium">That's the whole Playbook.</p>
                <p className="mt-1 text-muted-foreground">
                  Head back to the <ScreenLink href={studioPath("")}>Dashboard</ScreenLink> and start with the
                  setup checklist — the Studio teaches the rest as you go.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
