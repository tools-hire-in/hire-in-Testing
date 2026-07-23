import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Lightbulb,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Target,
  ShieldCheck,
  BarChart3,
  Users,
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

function StructureMatrix() {
  const INTENTS = ["Thought Leadership", "Job Marketing", "Educational", "Brand Perspective"];
  const PLATFORMS = ["Article", "LinkedIn", "Instagram", "X"];
  const DATA: Record<string, Record<string, string>> = {
    "Thought Leadership": { Article: "The Framework", LinkedIn: "Rule of Three", Instagram: "The Reveal", X: "Contrast" },
    "Job Marketing": { Article: "PAS", LinkedIn: "PAS", Instagram: "PAS", X: "Contrast" },
    "Educational": { Article: "Framework / Listicle", LinkedIn: "Listicle", Instagram: "Listicle", X: "Rule of Three" },
    "Brand Perspective": { Article: "The Reveal", LinkedIn: "Rule of Three", Instagram: "Contrast", X: "Rule of Three" },
  };
  const COLOR: Record<string, string> = {
    "Rule of Three": "font-medium text-blue-700 dark:text-blue-300",
    "PAS": "font-medium text-red-700 dark:text-red-300",
    "The Framework": "font-medium text-teal-700 dark:text-teal-300",
    "Framework / Listicle": "font-medium text-teal-700 dark:text-teal-300",
    "Listicle": "font-medium text-emerald-700 dark:text-emerald-300",
    "Contrast": "font-medium text-amber-700 dark:text-amber-300",
    "The Reveal": "font-medium text-violet-700 dark:text-violet-300",
  };
  return (
    <div className="my-4 overflow-x-auto">
      <div
        className="grid gap-px overflow-hidden rounded-md border bg-border text-xs"
        style={{ gridTemplateColumns: "auto 1fr 1fr 1fr 1fr" }}
      >
        <div className="bg-background p-2" />
        {PLATFORMS.map((p) => (
          <div key={p} className="bg-muted p-2 text-center font-semibold">{p}</div>
        ))}
        {INTENTS.map((intent) => [
          <div key={`lbl-${intent}`} className="flex items-center bg-muted p-2 font-semibold">{intent}</div>,
          ...PLATFORMS.map((platform) => {
            const val = DATA[intent][platform];
            return (
              <div key={`${intent}-${platform}`} className="bg-background p-2.5">
                <span className={COLOR[val] ?? ""}>{val}</span>
              </div>
            );
          }),
        ])}
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
  { id: "s10", index: "10", label: "Audience-First Strategy" },
  { id: "s11", index: "11", label: "Content Pillars & Goals" },
  { id: "s12", index: "12", label: "The Content Brief" },
  { id: "s13", index: "13", label: "Content Guardrails" },
  { id: "s14", index: "14", label: "Measuring What Matters" },
  { id: "s15", index: "15", label: "The AI Brief" },
  { id: "s16", index: "16", label: "Hook Patterns" },
  { id: "s17", index: "17", label: "Content Structures" },
];

export default function Guide() {
  const { enabled: newLook } = useNewLook();
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
      <div className="mx-auto max-w-6xl v2-surface">
        {newLook ? (
          <div className="mb-6">
            <V2PageHeader
              icon={BookOpen}
              eyebrow="Studio"
              title="The Studio Playbook"
              subtitle="How to run a full content operation — strategy, AI, and signals — as a team of one."
              testId="text-guide-title"
            />
          </div>
        ) : (
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
        )}

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
              <ProTip title="LinkedIn and Instagram brief differently">
                LinkedIn and Instagram require different briefs — not just different word counts. LinkedIn rewards
                the Curiosity Gap hook and the Rule of Three structure. Instagram rewards the PAS structure and
                the Loss Aversion or Specific Scene hook. Choosing the wrong structure for the platform is the
                most common reason social AI output needs heavy editing. Set Hook Pattern and Content Structure
                in Creative direction before generating — see Sections 16 and 17 for the full reference.
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
              <div className="mt-6 rounded-md border bg-muted/40 p-4 text-center text-sm">
                <p className="font-medium">That covers the tools.</p>
                <p className="mt-1 text-muted-foreground">
                  Sections 10–14 cover the strategy layer — audience, pillars, briefs, guardrails, and measurement.
                  Read them before your first campaign brief.
                </p>
              </div>
            </section>

            {/* ── Section 10 ── */}
            <section>
              <SectionHeading
                id="s10"
                index="10"
                title="Audience-First Strategy"
                subtitle="Every piece of content must identify one primary audience. Not two. One."
              />
              <Why>
                The fastest way to produce content that reaches nobody is to write for everyone. The Studio's
                audience model exists to force that decision before any word is written. One article, one
                audience, one question answered. The channels adapt — the audience does not.
              </Why>
              <div className="my-4 flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">The core principle</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Every asset must identify one primary audience, answer one real question, and guide one useful
                    next action. This is the gate every piece of content must pass before production begins.
                  </p>
                </div>
              </div>
              <H3>The four primary audiences for Hire'in Solutions:</H3>
              <div className="my-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    code: "H1",
                    label: "Healthcare Hiring Leaders",
                    decision: "Can this partner understand the role, submit relevant professionals, and support a reliable hiring process?",
                    content: "Hard-to-fill roles, intake quality, submission readiness, credentialing friction, workforce planning.",
                    color: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
                    badge: "text-blue-700 dark:text-blue-300",
                  },
                  {
                    code: "H2",
                    label: "Healthcare Professionals",
                    decision: "Is this opportunity relevant, trustworthy and worth my time? Am I prepared?",
                    content: "Jobs, specialty guidance, credential readiness, resume preparation, career decisions.",
                    color: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
                    badge: "text-emerald-700 dark:text-emerald-300",
                  },
                  {
                    code: "I1",
                    label: "IT & Engineering Hiring Leaders",
                    decision: "Can this partner identify evidence of fit and reduce unqualified submissions?",
                    content: "Technical screening, role calibration, project context, hiring quality, contract staffing.",
                    color: "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30",
                    badge: "text-violet-700 dark:text-violet-300",
                  },
                  {
                    code: "I2",
                    label: "IT & Engineering Professionals",
                    decision: "Does this role fit my skills and goals, and how do I demonstrate fit?",
                    content: "Jobs, resume evidence, interviews, skill positioning, career transitions.",
                    color: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
                    badge: "text-amber-700 dark:text-amber-300",
                  },
                ].map((a) => (
                  <div key={a.code} className={`rounded-md border p-3 ${a.color}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${a.badge}`}>{a.code}</span>
                      <span className="text-sm font-semibold">{a.label}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium">Their decision: </span>{a.decision}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium">Useful content: </span>{a.content}
                    </p>
                  </div>
                ))}
              </div>
              <H3>Studio translation — H1/H2/I1/I2 to Studio fields:</H3>
              <P>
                The H1/H2/I1/I2 codes are planning shorthand. The Studio stores audience and staffing domain as
                separate selections. Use this translation every time you create an article or idea:
              </P>
              <div className="my-3 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3 font-semibold">Strategy Code</th>
                      <th className="py-2 pr-3 font-semibold">Studio Audience</th>
                      <th className="py-2 font-semibold">Studio Domain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["H1 — Healthcare Hiring Leaders", "EMPLOYER_CLIENT", "Healthcare"],
                      ["H2 — Healthcare Professionals", "CANDIDATE", "Healthcare"],
                      ["I1 — IT & Engineering Hiring Leaders", "EMPLOYER_CLIENT", "IT"],
                      ["I2 — IT & Engineering Professionals", "CANDIDATE", "IT"],
                    ].map(([code, audience, domain]) => (
                      <tr key={code} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 font-medium">{code}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-primary">{audience}</td>
                        <td className="py-2 font-mono text-xs text-primary">{domain}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <P>
                The Studio also shows <strong>MSP/VMS Partner</strong> and <strong>Recruiter/Staffing Operator</strong>{" "}
                as audience options. Select these only when the content is specifically written for those audiences —
                do not default to them. The audience in the Studio, the brief, and the article metadata must always
                stay consistent.
              </P>
              <H3>Before writing any piece, answer these five questions:</H3>
              <StepList
                steps={[
                  <><strong>Primary audience</strong> — which of H1, H2, I1, I2 is the single target?</>,
                  <><strong>Their current question or decision</strong> — what are they actively trying to resolve right now?</>,
                  <><strong>Single takeaway</strong> — what is the one thing they should think, feel, or do differently after reading this?</>,
                  <><strong>Source or approved input</strong> — what recruiter note, client intake, candidate feedback, or verified fact is this based on?</>,
                  <><strong>Next action</strong> — what is the one thing you want them to do after reading: apply, contact a recruiter, read the article, request a consultation?</>,
                ]}
              />
              <ProTip title="The source question is the quality gate">
                If you cannot name a real source — a recruiter conversation, a client intake, a verified fact —
                the piece is not ready to brief. Generic content comes from generic inputs. The best Hire'in
                content comes from what a recruiter told a candidate last Tuesday.
              </ProTip>
              <ProTip title="One primary audience, not one exclusive audience">
                An H1 piece may be useful to I1 readers too. That is fine. The primary audience determines the
                angle, the hook, and the call to action. Other audiences who find it useful are a bonus.
              </ProTip>
            </section>

            {/* ── Section 11 ── */}
            <section>
              <SectionHeading
                id="s11"
                index="11"
                title="Content Pillars & Goals"
                subtitle="Five pillars. Four Studio goals. One way to make sure every piece earns its place."
              />
              <Why>
                A pillar is the strategic category your content falls into — why it exists and what job it does
                for the audience. The Studio's Content Goal is the AI instruction that shapes the draft. They are
                not the same thing, but they must be selected together every time. Using both prevents content
                that is strategically correct but tonally wrong, and vice versa.
              </Why>
              <div className="my-4 space-y-3">
                {[
                  {
                    pillar: "Hiring Intelligence",
                    purpose: "Help employers make better staffing and hiring decisions.",
                    examples: ["Why role calibration matters", "Why submissions fail", "Credentialing bottlenecks", "Evidence of technical or clinical fit"],
                    goals: ["THOUGHT_LEADERSHIP", "EDUCATIONAL"],
                    audiences: ["H1", "I1"],
                    color: "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20",
                  },
                  {
                    pillar: "Career Enablement",
                    purpose: "Help professionals understand, prepare for, and evaluate opportunities.",
                    examples: ["Resume guidance", "Interview preparation", "Credential readiness", "Career transitions", "Skill positioning"],
                    goals: ["EDUCATIONAL", "JOB_MARKETING"],
                    audiences: ["H2", "I2"],
                    color: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20",
                  },
                  {
                    pillar: "Jobs & Opportunities",
                    purpose: "Convert active demand into clear, respectful candidate communication.",
                    examples: ["Role-specific job posts", "Multi-role roundups", "Location or specialty spotlights", "Requirement updates with current facts only"],
                    goals: ["JOB_MARKETING"],
                    audiences: ["H2", "I2"],
                    color: "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
                  },
                  {
                    pillar: "Process & Proof",
                    purpose: "Show how Hire'in approaches the work — without relying on unsupported claims.",
                    examples: ["Intake-to-submission workflow", "Quality checks", "Recruiter preparation", "Communication standards", "Candidate support process"],
                    goals: ["BRAND_PERSPECTIVE", "THOUGHT_LEADERSHIP"],
                    audiences: ["H1", "I1"],
                    color: "border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20",
                  },
                  {
                    pillar: "People & Perspective",
                    purpose: "Humanize the company and build professional trust.",
                    examples: ["Recruiter insights", "Founder or leadership point of view", "Team learning", "Candidate-care principles", "Responsible recruiting practices"],
                    goals: ["BRAND_PERSPECTIVE"],
                    audiences: ["Any"],
                    color: "border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20",
                  },
                ].map((p) => (
                  <div key={p.pillar} className={`rounded-md border p-4 ${p.color}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{p.pillar}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.purpose}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.audiences.map((a) => (
                          <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Examples</p>
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {p.examples.map((e) => <li key={e}>· {e}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Studio Content Goal</p>
                        {p.goals.map((g) => (
                          <p key={g} className="mt-1 font-mono text-xs text-primary">{g}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="my-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">People & Perspective in the Studio</p>
                  <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                    Select <strong>Brand Perspective</strong> as the Content Goal for all People & Perspective content.
                    This includes founder or leadership points of view, recruiter insights, team learning, culture, and
                    candidate-care principles. Brand Perspective means "how Hire'in thinks" — it is not a formal capability
                    statement, proposal, or business-development document. If it sounds like a brochure, it belongs in the
                    BD Agent, not in content.
                  </p>
                </div>
              </div>
              <H3>Volume discipline:</H3>
              <P>
                Do not increase volume until the team can maintain audience clarity, accuracy, visual quality, and
                timely approvals at the current volume. Three high-quality, on-audience pieces per week beats seven
                mediocre ones. The Studio's campaign plan enforces a minimum — it is not a target.
              </P>
              <ProTip title="Rotate pillars deliberately">
                If the last three pieces were all Hiring Intelligence, the next piece should be Career Enablement
                or People & Perspective. Repetition of the same pillar produces an audience that expects one type
                of content — and leaves when you need to serve a different one.
              </ProTip>
            </section>

            {/* ── Section 12 ── */}
            <section>
              <SectionHeading
                id="s12"
                index="12"
                title="The Content Brief"
                subtitle="The single most important document in your content operation. Fill it in before anyone starts writing."
              />
              <Why>
                The brief is not a form. It is the editorial commissioning decision. Every word in the final
                article can be traced back to a decision made in the brief. A brief that takes 10 minutes to
                complete saves 3 hours of revision. A brief skipped produces an article that needs to be rewritten
                from scratch or, worse, gets published and misses the audience entirely.
              </Why>
              <H3>The complete MVP brief — field by field:</H3>
              <div className="my-4 space-y-2">
                {[
                  { field: "Working title", why: "Directional, not final. A clear working title forces you to know what you're making.", studio: "Article title field" },
                  { field: "Primary audience", why: "H1, H2, I1, or I2. One only. The Studio audience + domain fields must match.", studio: "Audience + Domain selectors" },
                  { field: "Audience question", why: "The exact question or decision this piece answers. Not 'about X' — the question the reader is actually asking.", studio: "Generation Brief field" },
                  { field: "Business objective", why: "Awareness, credibility, candidate interest, employer inquiry, application, or engagement. Be honest about what you actually want.", studio: "Content Goal + CTA fields" },
                  { field: "Single takeaway", why: "One sentence. If you cannot state the takeaway in one sentence, the brief is not ready.", studio: "Generation Brief field" },
                  { field: "Source or SME", why: "Recruiter notes, client intake, verified industry data, approved review. If this field is blank, the piece should not proceed.", studio: "Source Notes field" },
                  { field: "Approved facts", why: "Any company-specific claim, metric, or capability statement that has been approved for use. Nothing invented.", studio: "User-supplied facts field" },
                  { field: "Primary CTA", why: "One action. What should the reader do immediately after finishing? A CTA URL and label in the Studio.", studio: "CTA Text + CTA URL" },
                  { field: "Core format", why: "Insight article, carousel, video, text post, or job post. Format determines the production path.", studio: "Content Type selector" },
                  { field: "Channels & adaptations", why: "Which platforms need a version? Each channel needs a different hook, depth, and CTA.", studio: "Campaign idea channels" },
                  { field: "Owner + due date", why: "Named person and real date. 'Someone' and 'soon' are not owners or dates.", studio: "Assignee + due date" },
                ].map((row) => (
                  <div key={row.field} className="grid gap-1 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-[160px_1fr_140px]">
                    <p className="font-semibold">{row.field}</p>
                    <p className="text-muted-foreground">{row.why}</p>
                    <p className="font-mono text-xs text-primary">{row.studio}</p>
                  </div>
                ))}
              </div>
              <H3>The minimum weekly operating rhythm:</H3>
              <div className="my-3 space-y-2">
                {[
                  { day: "Monday", action: "20-minute insight huddle — Content, Social, and one SME. Select the audience question. Assign the owner and required input." },
                  { day: "Tuesday", action: "Complete the brief and SME input. Confirm the angle, takeaway, source, and call to action." },
                  { day: "Wednesday", action: "Draft the core insight and visual direction. AI generates the first draft from the brief." },
                  { day: "Thursday", action: "Review, adapt, and schedule the platform-specific versions." },
                  { day: "Friday", action: "Publish and engage, or review early performance and record learning." },
                ].map((row) => (
                  <div key={row.day} className="flex gap-3 rounded-md border p-3 text-sm">
                    <span className="w-24 shrink-0 font-semibold text-primary">{row.day}</span>
                    <span className="text-muted-foreground">{row.action}</span>
                  </div>
                ))}
              </div>
              <ProTip title="The brief is the review checkpoint">
                In the weekly huddle, review the brief together — not the draft. If everyone agrees the brief is
                strong, the draft almost writes itself. Reviewing a weak brief early is 10 minutes. Reviewing a
                weak draft late is 3 hours.
              </ProTip>
              <ProTip title="The source field is your quality filter">
                If the source field is empty, the brief is not ready. Real, useful content comes from real, specific
                inputs — a recruiter conversation, a candidate question, a client intake discussion. Generic
                content comes from generic briefs. Never brief without a source.
              </ProTip>
              <ProTip title="The AI generation dialog now has two new quality levers">
                The AI generation dialog now asks for Hook Pattern and Content Structure in Creative direction.
                These are the two brief fields that most directly affect output quality — they shape the opening
                line and the entire body of the draft. Fill them in before generating. See Section 16 for Hook
                Patterns and Section 17 for Content Structures.
              </ProTip>
            </section>

            {/* ── Section 13 ── */}
            <section>
              <SectionHeading
                id="s13"
                index="13"
                title="Content Guardrails"
                subtitle="These are not suggestions. Every published asset must clear all of them."
              />
              <Why>
                A staffing agency's credibility is built on accuracy and trust. One invented job fact, one
                unsupported claim, one piece of clinical or legal advice published without approval — and that
                credibility takes months to rebuild. The guardrails below are enforced both by the AI system
                (claim-free-by-default) and by the approval workflow. They are not optional.
              </Why>
              <div className="my-4 flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Claim-free by default</p>
                  <p className="mt-0.5 text-muted-foreground">
                    If a company-specific claim, metric, or capability statement is not provided by an approved source,
                    the content omits it and remains useful through education, insight, and point of view. The AI
                    agent and the content team do not add proof placeholders or unsupported promotional language.
                    This rule is enforced at generation time and at every approval stage.
                  </p>
                </div>
              </div>
              <H3>The non-negotiable list:</H3>
              <div className="my-3 space-y-2">
                {[
                  { rule: "Do not combine audiences in one piece", detail: "Healthcare buyers, healthcare candidates, IT buyers, and IT candidates are four different audiences. Writing for all of them at once means writing for none of them. One primary audience per asset." },
                  { rule: "Do not use unsupported claims", detail: "No unsupported AI performance claims, compliance certifications, 'nationwide' or 'best' or 'fastest' language, client names, placement metrics, or service capability claims without verified, approved source material." },
                  { rule: "Do not copy the same post to every platform", detail: "LinkedIn and Instagram are different media. A caption optimised for LinkedIn reads wrong on Instagram. A carousel works on Instagram and falls flat on X. Adapt the hook, depth, visual, and CTA for each channel." },
                  { rule: "Do not invent job facts", detail: "No invented compensation, location, schedule, employment type, work arrangement, sponsorship, credential requirements, number of openings, or deadlines. If you don't have the fact, omit it. Job posts with invented facts create candidate trust failures." },
                  { rule: "Do not publish clinical, legal, financial, or immigration advice", detail: "Content that implies clinical guidance, legal compliance, immigration eligibility, or financial advice requires approved expertise and must be reviewed before publication. When in doubt, omit and reframe as general education." },
                  { rule: "Do not measure by follower count or total likes alone", detail: "Follower count is a vanity metric. Total likes without context tells you nothing about whether the right audience saw the content. Measure by qualified reach, saves, CTA clicks, and downstream actions — not raw numbers." },
                  { rule: "Do not expand scope mid-pilot", detail: "No website redesign, complex automation, campaign orchestration, business-development workflows, or advanced reporting during the MVP phase. Ship the minimum well before expanding." },
                ].map((g) => (
                  <div key={g.rule} className="flex gap-3 rounded-md border border-red-100 bg-red-50/50 p-3 text-sm dark:border-red-900/40 dark:bg-red-950/20">
                    <span className="mt-0.5 shrink-0 text-xs font-bold text-red-600 dark:text-red-400">✕</span>
                    <div>
                      <p className="font-semibold text-foreground">{g.rule}</p>
                      <p className="mt-0.5 text-muted-foreground">{g.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <H3>Final decision standard — ask this before approving any asset:</H3>
              <div className="my-3 rounded-md border bg-muted/40 p-4 text-sm italic">
                "Who is this for? What real question are we answering? Why should the audience trust it? And what
                should become easier next?"
              </div>
              <P>
                If you cannot answer all four questions from the brief alone — without looking at the draft — the
                brief was not ready. Send it back, not forward.
              </P>
            </section>

            {/* ── Section 14 ── */}
            <section>
              <SectionHeading
                id="s14"
                index="14"
                title="Measuring What Matters"
                subtitle="Four sources of truth. None of them is the Studio alone."
              />
              <Why>
                The most common measurement mistake in content marketing: reporting Studio data as if it were
                reach. The Studio records what happens inside your content operation — brief quality, workflow
                throughput, CTA clicks on published articles. It does not know how many people saw your LinkedIn
                post. That data lives on LinkedIn. Using the wrong source for the wrong metric produces decisions
                based on fiction.
              </Why>
              <div className="my-4 flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">The baseline principle</p>
                  <p className="mt-0.5 text-muted-foreground">
                    The first 30 days are for establishing a reliable baseline — not chasing performance. Review by
                    audience, content goal, format, and platform so you can identify what is useful and repeatable.
                    A successful pilot does not require large follower growth or viral reach. It requires a
                    disciplined process that reached the right audiences and generated useful learning.
                  </p>
                </div>
              </div>
              <H3>The four measurement sources:</H3>
              <div className="my-4 space-y-3">
                {[
                  {
                    source: "Native social-platform analytics",
                    tracks: "Reach or impressions, reactions, saves, shares, comments, video views, and other platform-native engagement.",
                    where: "LinkedIn Analytics, Instagram Insights, Facebook Page Insights, X Analytics",
                    note: "These metrics are NOT generated by the Content Studio. Record them directly from each platform.",
                    color: "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20",
                  },
                  {
                    source: "Content Studio & website analytics",
                    tracks: "Content brief metadata (audience, domain, goal, platform), publishing details, CTA link-click activity, article visits, referral traffic, page engagement.",
                    where: "Studio Analytics tab, Hire'in Insights page analytics",
                    note: "Studio data measures what happens after a reader follows a link. It does not measure social platform reach.",
                    color: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20",
                  },
                  {
                    source: "ATS & recruiter records",
                    tracks: "Applications, recruiter contacts, qualified candidate conversations, employer inquiries, and other downstream actions.",
                    where: "ATS (Ceipal), recruiting records, shared inbox, responsible owner",
                    note: "This is the revenue signal. Connect content to downstream actions manually during the pilot.",
                    color: "border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20",
                  },
                  {
                    source: "Manual MVP tracker",
                    tracks: "Audience questions generated, qualitative feedback, production time, approval delays, successful content reuse across channels.",
                    where: "Shared tracker (spreadsheet or project doc)",
                    note: "The process health signal. If production time is going down, the process is working.",
                    color: "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
                  },
                ].map((s) => (
                  <div key={s.source} className={`rounded-md border p-4 ${s.color}`}>
                    <p className="font-semibold text-foreground">{s.source}</p>
                    <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium">Tracks: </span>{s.tracks}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-medium">Where: </span>{s.where}</p>
                    <p className="mt-1.5 rounded-sm bg-background/60 px-2 py-1 text-xs font-medium text-foreground">{s.note}</p>
                  </div>
                ))}
              </div>
              <H3>What to record for every published asset:</H3>
              <UL
                items={[
                  <>Primary audience and staffing domain</>,
                  <>Content goal and platform</>,
                  <>Publication date and owner</>,
                  <>Qualified reach or relevant impressions (from native platform)</>,
                  <>Saves, shares, and meaningful comments (from native platform)</>,
                  <>CTA clicks or page engagement where a link is used (from Studio or website analytics)</>,
                  <>Applications, recruiter contacts, employer inquiries, or other useful actions (from ATS/records)</>,
                  <>Audience questions or feedback generated</>,
                  <>Production time and whether the asset was successfully reused across channels</>,
                ]}
              />
              <H3>Day-30 success criteria:</H3>
              <UL
                items={[
                  <>Four audience-led content cycles completed using the full content brief</>,
                  <>At least two substantive Hire'in Insights pieces or equivalent high-value source assets published</>,
                  <>Minimum social outputs from the 30-day plan completed — or any shortfall documented with a clear reason</>,
                  <>Every published asset tagged internally by audience, domain, objective, platform, and call to action</>,
                  <>No unsupported company claims, invented job details, or preventable privacy and accuracy issues published</>,
                  <>At least three content lessons documented to repeat and three changes to test in Phase 2</>,
                  <>A short retrospective completed: what to keep, change, stop, and introduce next</>,
                ]}
              />
              <H3>End-of-pilot review questions:</H3>
              <div className="my-3 space-y-1.5">
                {[
                  "Which audience questions produced the strongest useful response?",
                  "Which platform and format worked best for each audience?",
                  "Which content led to qualified applications, conversations, or inquiries?",
                  "Where did the workflow slow down or create rework?",
                  "Which subject-matter inputs or approved facts were missing?",
                  "What should be standardized before Phase 2?",
                  "Is the team ready to adopt the next audience messaging and content operations process?",
                ].map((q, i) => (
                  <div key={i} className="flex gap-3 rounded-md border bg-muted/30 p-2.5 text-sm">
                    <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-primary">{i + 1}.</span>
                    <span className="text-muted-foreground">{q}</span>
                  </div>
                ))}
              </div>
              <ProTip title="Combine all four sources before reporting">
                A 30-day review that uses only Studio data will undercount impact (it misses social reach) and
                overcount relevance (it includes all impressions, not just qualified ones). Combine native
                platform data, Studio analytics, ATS records, and the manual tracker. That is the complete picture.
              </ProTip>
              <ProTip title="Reactions without downstream action is a brand signal, not a pipeline signal">
                High reactions with no ATS inquiries means your content is building awareness but not converting.
                That is fine for Phase 1. In Phase 2, add a stronger CTA, a gated resource, or a recruiter
                contact link to move the audience from aware to acting.
              </ProTip>
              <div className="mt-8 rounded-md border bg-muted/40 p-4 text-center text-sm">
                <p className="font-medium">That covers Strategy.</p>
                <p className="mt-1 text-muted-foreground">
                  Tools (0–9) + Strategy (10–14). Continue to Sections 15–17 for the AI brief and psychology
                  guide — the deep reference for generation.
                </p>
              </div>
            </section>

            {/* ── Section 15 ── */}
            <section>
              <SectionHeading
                id="s15"
                index="15"
                title="The AI Brief: How to Instruct the Engine"
                subtitle="Five fields that separate a draft you'll use from one you'll rewrite."
              />
              <Why>
                The AI generation dialog asks for five psychological brief fields in addition to the topic and
                audience. These aren't optional extras — they are the primary levers that control output quality.
                A team that understands what each field does will consistently produce first drafts that need
                editing, not rewriting. A team that skips them will consistently produce output that sounds
                plausible but lands wrong.
              </Why>
              <H3>The generation flow:</H3>
              <FlowStrip stages={["Platform", "Content Intent", "Hook Pattern", "Desired Emotion", "Content Structure", "Engagement Goal", "Generate"]} />
              <H3>Field-by-field — what it is and why it exists:</H3>
              <div className="my-4 space-y-3">
                {[
                  {
                    field: "Platform",
                    what: "Where the content will live: Article, LinkedIn, Instagram, or X.",
                    why: "Each platform has different rules for word count, formatting, line breaks, and reader expectations. The AI applies platform-specific craft rules when you specify the platform. A LinkedIn brief produces professional text-post structure (150–300 words, hook in the first two lines). An Instagram brief produces carousel-ready slide copy. An Article brief produces 800–1,400 words with H2s and a framework. Without specifying the platform, the AI produces copy that fits nowhere well.",
                    example: "Platform: LinkedIn → hook + payoff in the first two lines, line breaks every 1–2 sentences, 150–300 words, one CTA.",
                  },
                  {
                    field: "Content Intent",
                    what: "The strategic purpose: Thought Leadership, Educational, Job Marketing, or Brand Perspective.",
                    why: "This maps to the content goal block inside the AI intelligence engine. Each intent triggers a different internal pattern. Thought Leadership follows Problem → Why the usual approach fails → What actually changes the outcome → CTA. Job Marketing triggers fit-filter language and avoids invented job facts. Educational follows Question → Explanation → Example → Takeaway. Getting intent wrong produces content that is tonally correct but strategically misaligned.",
                    example: "Intent: Educational → the AI structures the piece as Question → Explanation → Example → Takeaway, using staffing-specific examples throughout.",
                  },
                  {
                    field: "Hook Pattern",
                    what: "The psychological archetype for the opening line — the mechanism that creates an open question in the reader's mind.",
                    why: "The first line of any content does one job: pull the reader to line two. Different archetypes use different psychological mechanisms. Loss Aversion creates fear of a mistake already being made. Curiosity Gap creates a knowledge tension the reader needs to resolve. Reader's Inner Monologue creates validation before instruction — which lowers resistance before any teaching begins. Without specifying a hook, the AI defaults to a competent but predictable opener. See Section 16 for the full breakdown.",
                    example: "Hook Pattern: Loss Aversion → \"That 3-day delay returning interview feedback just cost you your top candidate — she had two other offers by Thursday.\"",
                  },
                  {
                    field: "Desired Emotion",
                    what: "What the reader should feel in the first 3 seconds: Validated, Challenged, Warned, Curious, Surprised, or Inspired.",
                    why: "Emotion shapes tone from the first word. \"Warned\" produces a different register than \"Inspired\" — one is urgent and loss-focused, the other is expansive and possibility-focused. The AI adjusts word choice, sentence rhythm, and urgency level based on this field. If left blank, the AI defaults to a neutral professional register — which is rarely the most effective choice for social content.",
                    example: "Emotion: Validated → the AI opens by naming something the reader already knows but has never seen stated plainly, then builds from that moment of recognition.",
                  },
                  {
                    field: "Content Structure",
                    what: "The internal architecture of the body — the psychological sequence that carries the reader from hook to CTA.",
                    why: "The hook gets the reader in the door. The structure determines whether they stay. Each structure uses a different psychological logic to maintain momentum: PAS uses agitation to create motivation; Rule of Three uses pattern completion; The Reveal uses narrative tension. Without a deliberate structure, the AI defaults to a generic introduction-points-conclusion pattern that is functional but forgettable. See Section 17 for the full breakdown.",
                    example: "Structure: PAS → names a real problem (credentialing delay), agitates it (what it costs the hiring manager, specifically), then resolves with a clear mechanism.",
                  },
                  {
                    field: "Engagement Goal",
                    what: "The one action you want the reader to take after finishing: save it, share it, comment, follow, DM, or apply.",
                    why: "This shapes the closing line and the CTA. \"Save it\" tells the AI to end with a framework or checklist worth bookmarking. \"Share it\" tells it to end with a sharp, quotable statement or a question worth forwarding. \"DM / reach out\" tells it to close with a direct, warm, low-friction invitation. Without this field, the AI produces a generic close that drives no specific action.",
                    example: "Goal: DM / reach out → \"If your current staffing partner can't answer the intake question above, send us the requirement. We'll tell you if we can help.\"",
                  },
                ].map((item) => (
                  <div key={item.field} className="rounded-md border bg-muted/30 p-4 text-sm">
                    <p className="font-semibold text-foreground">{item.field}</p>
                    <p className="mt-0.5 text-xs font-medium text-primary">{item.what}</p>
                    <p className="mt-2 text-muted-foreground">
                      <span className="font-medium text-foreground">Why it matters: </span>{item.why}
                    </p>
                    <p className="mt-2 rounded border border-dashed bg-background p-2 text-xs italic text-muted-foreground">
                      {item.example}
                    </p>
                  </div>
                ))}
              </div>
              <H3>Side-by-side example — same topic, two different briefs:</H3>
              <div className="my-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border p-4 text-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">LinkedIn Post Brief</p>
                  <div className="space-y-2">
                    {[
                      { label: "Platform", value: "LinkedIn" },
                      { label: "Content Intent", value: "Thought Leadership" },
                      { label: "Topic", value: "Why IT hiring managers reject technically qualified candidates" },
                      { label: "Hook Pattern", value: "Mechanism Reveal" },
                      { label: "Desired Emotion", value: "Challenged" },
                      { label: "Content Structure", value: "Rule of Three" },
                      { label: "Engagement Goal", value: "Comment their take" },
                    ].map((row) => (
                      <div key={row.label} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
                        <span className="font-medium text-muted-foreground">{row.label}</span>
                        <span>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border p-4 text-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Article Brief (same topic)</p>
                  <div className="space-y-2">
                    {[
                      { label: "Platform", value: "Article" },
                      { label: "Content Intent", value: "Educational" },
                      { label: "Topic", value: "Why IT hiring managers reject technically qualified candidates" },
                      { label: "Hook Pattern", value: "Loss Aversion" },
                      { label: "Desired Emotion", value: "Warned" },
                      { label: "Content Structure", value: "The Framework" },
                      { label: "Engagement Goal", value: "Save it" },
                    ].map((row) => (
                      <div key={row.label} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
                        <span className="font-medium text-muted-foreground">{row.label}</span>
                        <span>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <P>
                The same topic produces different content because the platform, the intended emotion, the
                structure, and the desired action are all different. The LinkedIn post challenges the reader
                with a mechanism reveal and asks for their perspective. The article warns the reader with a
                loss-aversion hook and ends with a framework they will save and return to.
              </P>
              <H3>Weak brief vs. strong brief — what the output difference looks like:</H3>
              <div className="my-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-red-100 bg-red-50/50 p-4 text-sm dark:border-red-900/40 dark:bg-red-950/20">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Weak brief</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {[
                      ["Platform", "LinkedIn"],
                      ["Intent", "Thought Leadership"],
                      ["Topic", "IT hiring tips"],
                      ["Hook", "Let AI decide"],
                      ["Emotion", "Let AI decide"],
                      ["Structure", "Let AI decide"],
                      ["Goal", "Let AI decide"],
                    ].map(([k, v]) => (
                      <p key={k}><span className="font-medium text-foreground">{k}:</span> {v}</p>
                    ))}
                  </div>
                  <div className="mt-3 rounded border border-red-200 bg-background/60 p-2 text-xs italic text-muted-foreground dark:border-red-800">
                    Output: "In today's fast-paced IT hiring landscape, finding the right candidates can be
                    challenging. Here are some tips that might help your team..."
                  </div>
                </div>
                <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-4 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Strong brief</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {[
                      ["Platform", "LinkedIn"],
                      ["Intent", "Thought Leadership"],
                      ["Topic", "Why IT hiring managers reject technically qualified candidates"],
                      ["Hook", "Mechanism Reveal"],
                      ["Emotion", "Challenged"],
                      ["Structure", "Rule of Three"],
                      ["Goal", "Comment their take"],
                    ].map(([k, v]) => (
                      <p key={k}><span className="font-medium text-foreground">{k}:</span> {v}</p>
                    ))}
                  </div>
                  <div className="mt-3 rounded border border-emerald-200 bg-background/60 p-2 text-xs italic text-muted-foreground dark:border-emerald-800">
                    Output: "The resume isn't the problem. The intake call is. Three things IT hiring managers
                    never say — but every recruiter needs to hear — before a single profile is sourced..."
                  </div>
                </div>
              </div>
              <ProTip title="The two fields that most affect output quality">
                Hook Pattern and Content Structure are the brief fields that most directly change what the AI
                produces. Platform shapes the format. Hook shapes the first line. Structure shapes the entire
                body. If you only use two optional fields, use these two. See Section 16 for hooks, Section 17
                for structures.
              </ProTip>
            </section>

            {/* ── Section 16 ── */}
            <section>
              <SectionHeading
                id="s16"
                index="16"
                title="Hook Patterns: 8 Ways to Open Content"
                subtitle="The first line is the only line most readers will see. Choose the right archetype."
              />
              <Why>
                A hook earns its place by creating a specific open question in the reader's mind — not by being
                loud. Each of the 8 archetypes below works through a different psychological mechanism. The
                choice of archetype is a strategic decision based on the reader's current state and the
                content's intent. Use the wrong archetype for the platform or audience and the reader never
                gets past line one.
              </Why>
              <div className="my-4 space-y-4">
                {[
                  {
                    number: "1",
                    name: "Mechanism Reveal",
                    description: "Name the hidden cause of a familiar pain.",
                    mechanism: "Curiosity + Competence signal. The reader recognises the pain but not the cause — naming the mechanism makes them feel they are about to learn something they should already know.",
                    example: "\"Your OR req isn't stuck. Your titers are.\"",
                    platforms: "LinkedIn · Article",
                    color: "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20",
                  },
                  {
                    number: "2",
                    name: "Insider Contrast",
                    description: "What amateurs do vs. what operators do.",
                    mechanism: "Identity + Aspiration. The reader immediately places themselves in one camp and wants to move to the other — or confirm they are already in the right one.",
                    example: "\"Weak agencies send you resumes. Strong ones send you evidence.\"",
                    platforms: "LinkedIn · X",
                    color: "border-violet-200 bg-violet-50/30 dark:border-violet-800 dark:bg-violet-950/20",
                  },
                  {
                    number: "3",
                    name: "Loss Aversion",
                    description: "A specific, costed error the reader is probably already making.",
                    mechanism: "Loss Aversion (Kahneman). The pain of losing something is psychologically twice as powerful as the pleasure of gaining something. Naming a specific, believable cost forces the reader to evaluate whether they are the one making the mistake.",
                    example: "\"That 3-day delay returning interview feedback just cost you your top candidate — she had two other offers by Thursday.\"",
                    platforms: "LinkedIn · Article · X",
                    color: "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20",
                  },
                  {
                    number: "4",
                    name: "Unasked Question",
                    description: "The question the reader should be asking but isn't.",
                    mechanism: "Knowledge Gap + Self-awareness trigger. The reader is suddenly aware they have been missing a critical frame. The discomfort of not having asked this question is the pull.",
                    example: "\"Nobody asks their staffing partner this one question. It predicts everything.\"",
                    platforms: "LinkedIn · Article",
                    color: "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20",
                  },
                  {
                    number: "5",
                    name: "Counter-intuitive Number",
                    description: "A pattern-from-experience observation that surprises — must be clearly framed as such, never invented.",
                    mechanism: "Surprise + Calibration. The reader's existing mental model is challenged. The dissonance creates the need to resolve it — which requires reading the next line.",
                    example: "\"Most IT screening calls are 30 minutes long. The first 3 minutes decide everything.\"",
                    platforms: "All platforms",
                    color: "border-teal-200 bg-teal-50/30 dark:border-teal-800 dark:bg-teal-950/20",
                  },
                  {
                    number: "6",
                    name: "Reader's Inner Monologue",
                    description: "Say what the reader is privately thinking.",
                    mechanism: "Validation before instruction. When a reader sees their own unexpressed thought stated plainly, the reaction is recognition, not resistance. This disarms scepticism and creates trust before any teaching begins.",
                    example: "\"You're not 'behind on credentialing.' You were given a checklist designed for someone who's done this five times.\"",
                    platforms: "LinkedIn (candidate) · Instagram",
                    color: "border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20",
                  },
                  {
                    number: "7",
                    name: "Stakes Flip",
                    description: "Reframe who actually bears the risk.",
                    mechanism: "Accountability shift. The reader assumes the risk is symmetric — it isn't. Revealing the asymmetry makes them recalibrate their relationship with the topic and with the decision-maker involved.",
                    example: "\"A bad submittal doesn't cost the agency anything. It costs you a week.\"",
                    platforms: "LinkedIn (employer) · Article",
                    color: "border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/20",
                  },
                  {
                    number: "8",
                    name: "Specific Scene",
                    description: "Drop the reader into a moment.",
                    mechanism: "Narrative transportation. A concrete, specific scene bypasses intellectual resistance. The reader is inside the moment before they decide whether they agree with it.",
                    example: "\"Day 12 of a 13-week contract. Your recruiter hasn't mentioned extension. Here's what that silence usually means.\"",
                    platforms: "LinkedIn · Instagram · Article",
                    color: "border-sky-200 bg-sky-50/30 dark:border-sky-800 dark:bg-sky-950/20",
                  },
                ].map((hook) => (
                  <div key={hook.number} className={`rounded-md border p-4 text-sm ${hook.color}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-bold">
                          {hook.number}
                        </span>
                        <div>
                          <p className="font-semibold">{hook.name}</p>
                          <p className="text-xs text-muted-foreground">{hook.description}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 whitespace-nowrap text-xs">{hook.platforms}</Badge>
                    </div>
                    <div className="mt-3 space-y-2 pl-7">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Mechanism: </span>{hook.mechanism}
                      </p>
                      <p className="rounded border border-dashed bg-background/60 p-2 text-xs italic text-muted-foreground">
                        {hook.example}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <H3>Pick your hook — 3 questions that narrow to the right archetype:</H3>
              <StepList
                steps={[
                  <>
                    <strong>What is the reader's current emotional state?</strong> Anxious or frustrated with a
                    recurring problem → Mechanism Reveal or Loss Aversion. Confident but potentially wrong →
                    Insider Contrast or Stakes Flip. Unaware of an angle → Unasked Question or Counter-intuitive
                    Number. Resistant to being taught → Reader's Inner Monologue (validate first).
                  </>,
                  <>
                    <strong>What is the content's primary job?</strong> Challenge a belief → Insider Contrast,
                    Stakes Flip, Counter-intuitive Number. Warn about a risk → Loss Aversion. Deepen understanding
                    → Mechanism Reveal, Unasked Question. Build trust before instruction → Reader's Inner
                    Monologue, Specific Scene.
                  </>,
                  <>
                    <strong>What is the platform and available word count?</strong> Under 12 words (X, Instagram) →
                    Mechanism Reveal, Insider Contrast, Loss Aversion all compress well. LinkedIn (under 20 words)
                    → any archetype works. Long-form article → Specific Scene or Unasked Question set up a longer
                    narrative naturally.
                  </>,
                ]}
              />
              <ProTip title="The default choices for staffing content">
                When in doubt: use <strong>Unasked Question</strong> (Curiosity Gap) for LinkedIn — it performs
                consistently well across employer and candidate content because the reader always wonders what
                the question is. Use <strong>Loss Aversion</strong> for articles — the cost framing creates
                enough tension to sustain 800+ words. These two have the highest engagement floor across
                Hire'in content.
              </ProTip>
              <ProTip title="Hook rules — the constraints that make them work">
                Under 12 words for X and Instagram. Under 20 for LinkedIn. No questions that answer themselves.
                No "Here's why" as the entire hook. Never promise more than the body delivers. The second line
                must pay off the first — immediately. If it doesn't, the hook isn't finished.
              </ProTip>
            </section>

            {/* ── Section 17 ── */}
            <section>
              <SectionHeading
                id="s17"
                index="17"
                title="Content Structures: How to Architect the Body"
                subtitle="The hook gets the reader in. The structure keeps them reading to the end."
              />
              <Why>
                A structure is not an outline. It is the psychological sequence that moves a reader from engaged
                to committed. Each structure works for a different reason — and fails for a different reason.
                PAS works because agitation creates motivation. Rule of Three works because the brain completes
                patterns. The Reveal works because narrative tension is nearly impossible to exit. Choosing the
                wrong structure for the content intent is the most common reason AI output needs heavy editing.
              </Why>
              <div className="my-4 space-y-5">
                {[
                  {
                    name: "Rule of Three",
                    definition: "Hook + three proof points + CTA.",
                    psychology: "Pattern completion. The brain is wired to expect triads. Three points feel complete; two feel thin; four feel long. The reader is always waiting for the third point to arrive — and the CTA lands at the moment that satisfaction is highest.",
                    skeleton: ["Hook — names one mechanism or challenge", "Point 1 — the evidence, observation, or example", "Point 2 — the complication or deeper layer", "Point 3 — the resolution or implication", "CTA — one clear action"],
                    example: "Thought Leadership LinkedIn post: Hook names the real reason IT hiring slows down. Point 1: intake quality gap. Point 2: what it costs in time and credibility. Point 3: the one question that fixes it. CTA: 'What's your intake question?'",
                    platforms: "LinkedIn (primary) · Article (secondary)",
                    color: "border-blue-200",
                  },
                  {
                    name: "PAS — Problem → Agitate → Solution",
                    definition: "Name the pain, make it visceral, then resolve it.",
                    psychology: "Agitation drives action. The brain moves away from pain faster than it moves toward gain. PAS exploits this by making the problem feel immediately real — not abstract — then intensifying it to the point where the solution is a relief, not a pitch. The agitation step is what most people omit. Without it, the structure feels like a weak list.",
                    skeleton: ["Problem — the specific, real problem", "Agitate — what it costs, who bears it, what happens if it goes unresolved", "Solution — the mechanism or action that resolves it", "CTA — low friction, direct"],
                    example: "Job Marketing Instagram: Problem: agency submits unqualified IT candidates. Agitate: what that costs the hiring manager in time, team credibility, and delayed delivery. Solution: fit-filter language that self-qualifies before any call. CTA: 'Apply only if these three criteria match.'",
                    platforms: "Instagram (primary) · LinkedIn · Job Marketing across all platforms",
                    color: "border-red-200",
                  },
                  {
                    name: "The Reveal",
                    definition: "Setup → Tension → Payoff. Scene-based storytelling.",
                    psychology: "Narrative transportation. Once a reader is inside a scene, they experience narrative closure compulsion — the same mechanism that makes you keep reading a novel past your bedtime. The Reveal is the only structure where the reader actively resists stopping.",
                    skeleton: ["Setup — drop the reader into a specific moment or situation", "Tension — show what's at stake, what the reader doesn't know yet", "Complication — the thing that makes resolution non-obvious", "Payoff — the resolution, the mechanism, the lesson"],
                    example: "Article opening: 'Day 12 of a 13-week contract. The recruiter hasn't called. The hiring manager is wondering if extension is coming. Here's what that silence actually means — and what a different agency would have done on Day 1.'",
                    platforms: "Article (primary) · LinkedIn (secondary, narrative posts)",
                    color: "border-violet-200",
                  },
                  {
                    name: "Contrast (Before / After)",
                    definition: "Wrong way vs. right way — show, never just tell.",
                    psychology: "Comparative evaluation. The brain understands differences faster than it understands absolutes. Showing two states side by side makes the quality gap immediately legible — no argument required. The reader evaluates the contrast rather than the claim.",
                    skeleton: ["Before — the common, weaker approach (named specifically, not vaguely)", "The gap — what's missing and what it costs", "After — the stronger approach, with the mechanism that makes it better", "Application — how the reader uses this today"],
                    example: "Educational post: 'Weak intake: Here's the JD, let me know what you find. Strong intake: Three questions that surface must-haves the hiring manager forgot to list.' Side by side, the reader sees the difference without being told what to think.",
                    platforms: "LinkedIn · Instagram · X (pairs naturally with Insider Contrast hook)",
                    color: "border-amber-200",
                  },
                  {
                    name: "The Framework",
                    definition: "Name a concept, explain the mechanics, show the application.",
                    psychology: "Mental model construction. The reader is given a reusable cognitive tool — something they can apply beyond this piece. This creates the highest save-rate of any structure because the reader associates the framework with the brand that gave it to them.",
                    skeleton: ["Name the framework — give it a memorable label", "Explain each component — what it is and why it matters", "Show the mechanism — how the parts interact", "Application — what a reader should do with this today", "Optional: where it breaks down (adds credibility)"],
                    example: "Thought Leadership article: 'The Intake Triangle: three inputs that determine whether a staffing engagement succeeds before sourcing begins. Requirement clarity, must-have vs. nice-to-have separation, and decision timeline. When all three are present, fill time compresses. When any one is missing, every other variable degrades.'",
                    platforms: "Article (primary) · LinkedIn (condensed versions)",
                    color: "border-teal-200",
                  },
                  {
                    name: "Listicle",
                    definition: "Numbered breakdown for scannability and completeness.",
                    psychology: "Information chunking + completion bias. Numbered lists exploit two mechanisms simultaneously: chunking makes each item feel digestible, and the number in the headline creates a completion contract — the reader counts to the end. The listicle is the most scannable structure, ideal for high-competition feeds where most content is not read linearly.",
                    skeleton: ["Headline with the number and the promise ('5 signs your req is under-specified')", "Brief framing — why this list matters, in 1–2 lines", "Items — each specific, actionable, and standalone", "Closing — one thing to do today"],
                    example: "Educational LinkedIn post: '6 questions every recruiter should ask in the IT intake call. Most ask 2 of these. The ones who ask all 6 fill the role faster.' Each question is a specific, concrete intake topic — not a vague category.",
                    platforms: "Instagram carousel (primary) · LinkedIn · Educational content across all platforms",
                    color: "border-emerald-200",
                  },
                ].map((s) => (
                  <div key={s.name} className={`rounded-md border ${s.color} bg-muted/10 p-4 text-sm`}>
                    <p className="font-semibold">{s.name}</p>
                    <p className="mt-0.5 text-xs italic text-muted-foreground">{s.definition}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why it works</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.psychology}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal moves</p>
                        <ol className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {s.skeleton.map((move, i) => <li key={i}>→ {move}</li>)}
                        </ol>
                      </div>
                    </div>
                    <div className="mt-3 rounded border border-dashed bg-background/60 p-2 text-xs italic text-muted-foreground">
                      {s.example}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Platform fit: </span>{s.platforms}
                    </p>
                  </div>
                ))}
              </div>
              <H3>Decision matrix — Content intent × Platform → Recommended structure:</H3>
              <StructureMatrix />
              <ProTip title="The two most common structure mistakes">
                <strong>Mistake 1:</strong> Using Listicle for Thought Leadership. Listicles scan well but feel
                thin for authority content — use Rule of Three or The Framework instead. <strong>Mistake 2:</strong>{" "}
                Using PAS for Educational content. PAS agitates before it teaches, which works for marketing
                but creates anxiety in an educational context. Use The Framework or Listicle for Educational,
                and save PAS for Job Marketing and awareness content.
              </ProTip>
              <ProTip title="LinkedIn and Instagram structure differently">
                LinkedIn rewards Curiosity Gap hooks paired with Rule of Three — this combination produces
                professional authority with a strong discussion CTA. Instagram rewards PAS structure paired
                with Loss Aversion or Specific Scene hooks — this produces urgency in a visual-first format.
                Choosing the wrong structure for the platform is the most common reason social AI output needs
                heavy editing.
              </ProTip>
              <div className="mt-8 rounded-md border bg-muted/40 p-4 text-center text-sm">
                <p className="font-medium">That is the complete Playbook.</p>
                <p className="mt-1 text-muted-foreground">
                  Tools (0–9) + Strategy (10–14) + AI Brief &amp; Psychology (15–17). Head to the{" "}
                  <ScreenLink href={studioPath("")}>Dashboard</ScreenLink> and start with a brief.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
