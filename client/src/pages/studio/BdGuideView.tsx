import { useState, useEffect } from "react";
import { Link } from "wouter";
import { StudioShell } from "@/components/studio/StudioShell";
import { Badge } from "@/components/ui/badge";
import { studioPath } from "@/lib/studioBase";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Briefcase,
  ArrowRight,
  ChevronRight,
  Lightbulb,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";

// ── Shared helpers ────────────────────────────────────────────────────────────

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed">{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 text-sm font-semibold">{children}</h3>;
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

function OL({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ol>
  );
}

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

function FlowStrip({ stages }: { stages: string[] }) {
  return (
    <div className="my-4 flex flex-wrap items-center gap-1.5">
      {stages.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="rounded-md border bg-muted px-2.5 py-1.5 text-xs font-semibold tracking-wide">{s}</span>
          {i < stages.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </span>
      ))}
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

// ── Sections index ────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "s0", index: "0", label: "BD Overview" },
  { id: "s1", index: "1", label: "Prospecting & Research" },
  { id: "s2", index: "2", label: "Discovery Calls" },
  { id: "s3", index: "3", label: "Proposal & Rate Conversations" },
  { id: "s4", index: "4", label: "Follow-Up & Nurture" },
  { id: "s5", index: "5", label: "Domain Playbooks" },
  { id: "s6", index: "6", label: "Using the BD Agent" },
  { id: "s7", index: "7", label: "Common Pitfalls" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BdGuideView() {
  const { can } = usePermissions();
  const [activeId, setActiveId] = useState("s0");

  useEffect(() => {
    if (!can("studio.bd_agent")) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [can]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  if (!can("studio.bd_agent")) {
    return (
      <StudioShell>
        <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-semibold">Access restricted</p>
          <p className="text-sm text-muted-foreground">
            The BD Guide is available to super admins, admins, and HR managers.
          </p>
        </div>
      </StudioShell>
    );
  }

  return (
    <StudioShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-bd-guide-title">
              BD Playbook
            </h1>
            <p className="text-sm text-muted-foreground">
              Stage-by-stage guide for winning new staffing clients — Hire'in style.
            </p>
          </div>
          <Badge variant="outline" className="ml-auto hidden sm:inline-flex">Internal only</Badge>
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* Sticky anchor nav */}
          <nav className="hidden lg:block">
            <div className="sticky top-6 space-y-0.5" data-testid="nav-bd-guide-sections">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    activeId === s.id
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`nav-bd-guide-${s.id}`}
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
                title="BD at Hire'in — The One-Page Picture"
                subtitle="What we're selling, who we're selling to, and the pipeline that connects them."
              />
              <P>
                Hire'in Solutions is not a job board. We're a strategic staffing partner that removes the risk
                from hiring for <strong>Healthcare, IT, Engineering, and Professional Services</strong> clients.
                Every BD conversation should reinforce that difference: we are an embedded extension of their
                talent function, not a CV supplier.
              </P>
              <H3>Our proof points (use these, don't invent others):</H3>
              <UL items={[
                <><strong>95% first-year retention rate</strong> — we measure fit, not just skills</>,
                <><strong>24-hour first candidate submissions</strong> — our AI pre-screening runs 24/7</>,
                <><strong>Multi-domain capability</strong> — Healthcare, IT, Engineering, and Professional Services under one account team</>,
                <><strong>Flexible engagement models</strong> — Contract, Contract-to-Hire, Permanent</>,
              ]} />
              <H3>The BD pipeline:</H3>
              <FlowStrip stages={["PROSPECT", "QUALIFY", "DISCOVER", "PROPOSE", "NEGOTIATE", "CLOSE", "DELIVER", "EXPAND"]} />
              <P>
                Most deals are lost at <strong>Qualify</strong> (wrong ICP) or <strong>Propose</strong> (wrong
                framing). This guide addresses both. The BD Agent handles the copy; the guide handles the
                strategy.
              </P>
              <ProTip title="Never burn a prospect on the first touch">
                A prospect who says "not now" is not a rejection — it's a timing issue. Log them, set a
                60-day follow-up, and put them in a nurture sequence. Most staffing clients switch vendors
                once a year. You want to be in their inbox when that moment arrives.
              </ProTip>
            </section>

            {/* ── Section 1 ── */}
            <section>
              <SectionHeading
                id="s1"
                index="1"
                title="Prospecting & Research"
                subtitle="Know the account before the first call. Every minute of research saves ten minutes of recovery from a bad first impression."
              />
              <P>
                Qualification starts before outreach. If you call a prospect who has no hiring need, no budget
                authority, and no pain, you've wasted both your time and theirs. Qualify on paper first.
              </P>
              <H3>Ideal Customer Profile (ICP) signals to look for:</H3>
              <UL items={[
                <><strong>Company size:</strong> 50–5000 employees (large enough to need external talent, small enough to still feel pain)</>,
                <><strong>Growth signals:</strong> Recent funding, expansion announcements, new locations, product launches</>,
                <><strong>Hiring pain signals:</strong> High volume of open roles on LinkedIn/Indeed, roles open 60+ days, repeated postings</>,
                <><strong>Staff turnover signals:</strong> Glassdoor reviews mentioning turnover; LinkedIn profiles showing short tenures</>,
                <><strong>Right buyer:</strong> VP/Director of HR, Talent Acquisition Lead, COO (for smaller companies), VP Engineering, VP Clinical Operations</>,
              ]} />
              <H3>Research checklist before first contact:</H3>
              <OL items={[
                "Company website — understand their service/product, locations, size",
                "LinkedIn — company page, hiring posts, the contact's background",
                "Job boards — count their open roles, identify domains, note how long roles have been open",
                "News search — funding rounds, expansions, leadership changes, layoffs",
                "Glassdoor — culture and turnover signals (use as context, never cite publicly)",
              ]} />
              <H3>Research → talking point conversion:</H3>
              <div className="my-3 rounded-md border bg-muted/40 p-4 text-xs font-mono leading-relaxed">
                <p><span className="text-primary font-semibold">Signal observed:</span> 12 open nursing roles, avg. 75 days posting age</p>
                <p className="mt-2"><span className="text-primary font-semibold">Opening line:</span> "I noticed you've had a cluster of clinical roles open for a few months — we work with healthcare systems specifically on hard-to-fill clinical positions and typically submit qualified candidates within 24 hours of briefing."</p>
              </div>
              <P>
                Use the <ScreenLink href={studioPath("/bd-agent")}>BD Agent</ScreenLink> to generate call-prep
                briefs once you have the research above in hand. Paste your notes in; the agent frames the
                conversation strategy.
              </P>
              <ProTip title="Research is a competitive advantage">
                Most BD reps open cold. A rep who references a specific role, a recent news item, or a hiring
                pattern the prospect didn't think anyone noticed gets to a real conversation 3× faster.
              </ProTip>
            </section>

            {/* ── Section 2 ── */}
            <section>
              <SectionHeading
                id="s2"
                index="2"
                title="Discovery Calls"
                subtitle="The goal is not to pitch. The goal is to understand their problem well enough that the solution is obvious."
              />
              <P>
                A discovery call has one job: surface pain. Every minute you spend on your company's features
                before you understand their problem is a minute they spend tuning out.
              </P>
              <H3>Recommended call flow (45-minute discovery):</H3>
              <OL items={[
                <>Opener (2 min): confirm time, set agenda — "I'd like to understand your hiring situation before I say anything about us. Is that OK?"</>,
                <>Current state (10 min): how do they hire today? Agencies, direct, referrals? What's working?</>,
                <>Pain (15 min): where is the friction? Time-to-fill, quality of candidates, costs, turnover post-hire?</>,
                <>Stakes (5 min): what happens if the problem isn't solved? A role open 90 days costs them — do they know the number?</>,
                <>Ideal state (8 min): what does success look like? Speed? Quality? Volume? Long-term partnership?</>,
                <>Positioning (5 min): now — and only now — map Hire'in to their specific pain</>,
              ]} />
              <H3>Core discovery questions by domain:</H3>
              <div className="my-3 space-y-3 rounded-md border p-4 text-sm">
                <div>
                  <p className="font-semibold text-primary">Healthcare</p>
                  <UL items={[
                    "How many clinical FTEs are you trying to fill right now, and what's your average time-to-offer?",
                    "Are you dealing with credentialing or licensure backlogs that slow starts?",
                    "What percentage of hires make it past 90 days? 12 months?",
                  ]} />
                </div>
                <div>
                  <p className="font-semibold text-primary">IT / Engineering</p>
                  <UL items={[
                    "Are you trying to hire contract, full-time, or both right now?",
                    "What's your biggest skill-gap risk on current projects?",
                    "Have you had candidates walk between offer and start date? How often?",
                  ]} />
                </div>
                <div>
                  <p className="font-semibold text-primary">Professional Services</p>
                  <UL items={[
                    "What roles take the longest to fill, and why?",
                    "How do you currently handle volume spikes — project ramp-ups, seasonal demand?",
                    "What does a bad hire cost you in rework and morale?",
                  ]} />
                </div>
              </div>
              <ProTip title="Silence is a discovery tool">
                Ask a question. Wait. The first answer is rarely the real answer. Let silence sit for 3 seconds
                after they finish. Most of the time they'll add the important detail you actually need.
              </ProTip>
            </section>

            {/* ── Section 3 ── */}
            <section>
              <SectionHeading
                id="s3"
                index="3"
                title="Proposal & Rate Conversations"
                subtitle="Frame cost as investment. Frame risk as the cost of not acting."
              />
              <P>
                A proposal that leads with fees loses. A proposal that leads with the prospect's pain, then
                maps Hire'in's solution to each pain point, then mentions cost as an afterthought — wins.
                The BD Agent's <strong>Proposal Outline</strong> template is built on this structure.
              </P>
              <H3>Proposal structure (what the AI helps you build):</H3>
              <OL items={[
                <>Executive Summary — their situation in their language, not yours</>,
                <>Client Pain Points — repeat back what they told you in discovery (shows you listened)</>,
                <>Our Approach — specifically how Hire'in addresses each pain</>,
                <>Engagement Model — Contract / CTH / Perm — the one that fits their need</>,
                <>Value Propositions — our proof points mapped to their stated priorities</>,
                <>Next Steps — clear, specific, timebound</>,
              ]} />
              <H3>Rate and fee conversations:</H3>
              <P>
                Never lead with rate. If they ask "what's your fee?" before you've established value, say:
                "Great question — I want to make sure I give you the right number, which depends on the
                engagement model. Can I ask a couple more questions first?"
              </P>
              <P>
                <strong>The ROI frame:</strong> A contract fee looks expensive until you compare it to the
                cost of a 90-day vacancy. A 45-day time-to-fill improvement on a role billing at $150/hour
                is worth more than the placement fee. Help them do that math (using their numbers, not invented
                ones — always their numbers).
              </P>
              <P>
                Use the <ScreenLink href={studioPath("/bd-templates")}>Rate Card Talking Points</ScreenLink> template
                to generate objection responses before the call. Common objections:
              </P>
              <UL items={[
                <><strong>"Your fee is too high"</strong> — redirect to total cost of vacancy + rework cost of bad hire</>,
                <><strong>"We already work with an agency"</strong> — "Great — we often work alongside existing vendors as a domain specialist. Are there roles they're not filling well?"</>,
                <><strong>"We'll try direct first"</strong> — agree, then ask if you can be their backup for roles that age past 30 days</>,
                <><strong>"We're on a hiring freeze"</strong> — "Understood. Can I stay in touch? Freezes always thaw — I'd rather be your first call than your tenth."</>,
              ]} />
              <ProTip title="Proposals should be short">
                The ideal proposal is 2 pages max. If you're writing more than that, you're answering questions
                they haven't asked. A long proposal is a signal that you don't know what they care about.
              </ProTip>
            </section>

            {/* ── Section 4 ── */}
            <section>
              <SectionHeading
                id="s4"
                index="4"
                title="Follow-Up & Nurture"
                subtitle="Persistence beats talent. Most deals close on the 5th to 8th touch."
              />
              <P>
                The fastest way to lose a deal is to send one email and wait. The second fastest is to send
                five identical emails. Good follow-up adds value on every touch — a new angle, a relevant
                insight, or an update that's genuinely useful to them.
              </P>
              <H3>Follow-up timing framework:</H3>
              <div className="my-3 space-y-2 rounded-md border bg-muted/40 p-4 text-xs font-mono">
                <p><span className="text-primary font-semibold">Touch 1</span> — Day 1 after call: summary of what you heard, one clear next step</p>
                <p><span className="text-primary font-semibold">Touch 2</span> — Day 3: relevant insight (article, benchmark, statistic) — not a sales message</p>
                <p><span className="text-primary font-semibold">Touch 3</span> — Day 7: gentle check-in, low-friction ask ("any questions on the proposal?")</p>
                <p><span className="text-primary font-semibold">Touch 4</span> — Day 14: case point or proof (relevant to their domain)</p>
                <p><span className="text-primary font-semibold">Touch 5</span> — Day 21: the opt-out offer ("Happy to step back if timing isn't right — just say the word.")</p>
                <p><span className="text-primary font-semibold">Nurture</span> — Monthly: one value-add touch, no ask</p>
              </div>
              <P>
                Use the <ScreenLink href={studioPath("/bd-templates")}>Follow-Up Sequence</ScreenLink> template
                to draft these in bulk. Specify the number of touches, channels (email, LinkedIn, or mixed),
                and the prospect context — the AI drafts all steps.
              </P>
              <H3>What makes follow-up not annoying:</H3>
              <UL items={[
                "Each touch has a different hook — never copy-paste the previous email",
                "You add something — an insight, a relevant stat, a timely observation",
                "You make it easy to say no — permission to opt out keeps people reading",
                "Short messages get read; long ones get archived",
              ]} />
              <ProTip title="The breakup message outperforms">
                "I don't want to keep showing up in your inbox if the timing isn't right. If now isn't the
                moment, just reply 'not now' and I'll check back in six months." This message typically
                generates more replies than any other touch — either they engage or they cleanly opt out
                so you can focus elsewhere.
              </ProTip>
            </section>

            {/* ── Section 5 ── */}
            <section>
              <SectionHeading
                id="s5"
                index="5"
                title="Domain Playbooks"
                subtitle="Healthcare, IT, Engineering, and Professional Services each have distinct buying patterns."
              />
              <div className="my-4 space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="font-semibold text-primary">Healthcare</p>
                  <P>Buyers: VP/Director of Clinical Operations, CNO, HR Director. Primary pains: time-to-credential, nurse/therapist/phlebotomist shortages, float pool management, travel-to-perm conversion.</P>
                  <P>Key differentiators to emphasize: credentialing assistance, clinical domain expertise, retention rates, Joint Commission awareness.</P>
                  <P>Seasonal pattern: budget cycles often reset in Q4; expansion announcements follow CMS certification timelines.</P>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-semibold text-primary">IT / Technology</p>
                  <P>Buyers: VP Engineering, CTO (small companies), IT Director, Procurement (large). Primary pains: specific-skill shortages (cloud, security, AI/ML), contractor-to-permanent conversion, project-based surge capacity.</P>
                  <P>Key differentiators: technical screening quality (not just keyword matching), speed-to-submit, contractor bench availability.</P>
                  <P>Watch for: company growth stage (Series B+ = real hiring budget), funded startups, digital transformation programs at mid-market firms.</P>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-semibold text-primary">Engineering / Industrial</p>
                  <P>Buyers: Plant Manager, VP Operations, Project Manager, HR. Primary pains: skilled trades shortages, project ramp-up speed, safety certification requirements, union/non-union complexity.</P>
                  <P>Key differentiators: trades expertise, on-site safety compliance knowledge, regional candidate access.</P>
                  <P>Seasonal pattern: project-driven; watch capital project announcements, infrastructure awards.</P>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-semibold text-primary">Professional Services</p>
                  <P>Buyers: COO, HR Director, Office Manager (smaller firms). Primary pains: admin/coordinator/office management shortages, finance & accounting gaps, paralegal and compliance roles.</P>
                  <P>Key differentiators: white-collar domain expertise, culture fit screening, professional reference verification.</P>
                  <P>Approach: these buyers respond strongly to case-based framing. "We've helped similar firms fill roles like X in Y days" (generic, not invented specific clients).</P>
                </div>
              </div>
            </section>

            {/* ── Section 6 ── */}
            <section>
              <SectionHeading
                id="s6"
                index="6"
                title="Using the BD Agent"
                subtitle="Your AI co-strategist — for research, copy, and objection prep."
              />
              <P>
                The BD Agent is a conversational AI trained on Hire'in's positioning, domains, and BD
                methodology. It helps with strategy, copy, and thinking — not with sending messages or
                accessing CRMs.
              </P>
              <H3>What to use the BD Agent for:</H3>
              <UL items={[
                "Thinking through how to approach a specific account or buyer type",
                "Preparing for objections before a call",
                "Drafting or refining outreach copy",
                "Exploring angles you haven't thought of",
                "Pressure-testing a proposal framing",
              ]} />
              <H3>What to use the Templates for:</H3>
              <UL items={[
                <><ScreenLink href={studioPath("/bd-templates")}>Proposal Outline</ScreenLink> — structured proposal with the prospect's pain, our approach, and value propositions</>,
                <><ScreenLink href={studioPath("/bd-templates")}>Rate Card Talking Points</ScreenLink> — framing fees as ROI, with pre-built objection responses</>,
                <><ScreenLink href={studioPath("/bd-templates")}>Call Prep Brief</ScreenLink> — discovery questions, likely objections, call flow for a specific account</>,
                <><ScreenLink href={studioPath("/bd-templates")}>Follow-Up Sequence</ScreenLink> — multi-touch follow-up copy ready to personalise and send</>,
              ]} />
              <H3>Guardrails the BD Agent enforces (always):</H3>
              <UL items={[
                "Never invents statistics, named clients, or outcome figures not given by you",
                "Never makes placement guarantees",
                "Copy is for human manual use — never auto-sent",
                "Flags when advice needs local market or compliance verification",
              ]} />
              <ProTip title="Give the agent context">
                The more context you give — the company, the contact's role, the pain they expressed, any
                rates you've agreed on — the more specific and useful the output. Vague input produces
                generic output. The agent is only as good as the brief you give it.
              </ProTip>
            </section>

            {/* ── Section 7 ── */}
            <section>
              <SectionHeading
                id="s7"
                index="7"
                title="Common Pitfalls"
                subtitle="The mistakes that cost deals — and how to avoid them."
              />
              <div className="my-4 space-y-3">
                {[
                  {
                    label: "Pitching before discovering",
                    fix: "Ask three discovery questions before you mention a single feature. If you've talked about Hire'in for more than 2 minutes before they've described their problem, you're pitching too early.",
                  },
                  {
                    label: "Sending generic outreach",
                    fix: "Every first message should contain one specific observation about their company or role. If you could send it to any company on your list unchanged, it's not ready.",
                  },
                  {
                    label: "Quoting rate before establishing value",
                    fix: "Rate conversations happen after they've told you what they care about. Defer the fee question until you've anchored on the cost of the problem.",
                  },
                  {
                    label: "Single follow-up and wait",
                    fix: "Set 5-8 touches before treating a prospect as cold. Use the Follow-Up Sequence template to draft all touches at once so you don't have to think under pressure.",
                  },
                  {
                    label: "Inventing statistics or client names",
                    fix: "Say 'our clients have seen outcomes like...' not 'Company X achieved Y%.' Invented specifics destroy trust the moment they're questioned. The BD Agent enforces this; you should too.",
                  },
                  {
                    label: "Treating a staffing freeze as a closed door",
                    fix: "Freezes end. Ask permission to stay in touch, agree on a timeline, and put them in your 60-day nurture sequence. Being the first call when the freeze lifts is the whole game.",
                  },
                ].map(({ label, fix }) => (
                  <div key={label} className="rounded-lg border bg-card p-4 text-sm">
                    <p className="font-semibold text-destructive">{label}</p>
                    <p className="mt-1.5 text-muted-foreground">{fix}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
