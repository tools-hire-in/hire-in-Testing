import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  BookOpen,
  Lightbulb,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";

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

function SectionHeading({ id, index, title, subtitle }: { id: string; index: string; title: string; subtitle: string }) {
  return (
    <div className="scroll-mt-20 border-t pt-8 first:border-t-0 first:pt-0" id={id}>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Section {index}</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm italic text-muted-foreground">{subtitle}</p>
    </div>
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
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

// ── Sections index ──────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "s1", index: "1", label: "Your Daily Routine" },
  { id: "s2", index: "2", label: "Executive Cockpit" },
  { id: "s3", index: "3", label: "Governance Control Tower" },
  { id: "s4", index: "4", label: "Studio & BD Agent" },
  { id: "s5", index: "5", label: "HR & Payroll" },
  { id: "s6", index: "6", label: "New Hire Pipeline" },
  { id: "s7", index: "7", label: "Strategy & Reports" },
  { id: "s8", index: "8", label: "Platform Health" },
];

export default function CeoGuide() {
  const [activeId, setActiveId] = useState<string>("s1");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
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
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-ceo-guide-title">
              CEO Command Guide
            </h1>
            <p className="text-sm text-muted-foreground">
              Every tool, every workflow — in one place. Your operating manual for the platform.
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* Sticky anchor nav */}
          <nav className="hidden lg:block">
            <div className="sticky top-6 space-y-0.5" data-testid="nav-ceo-guide-sections">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    activeId === s.id
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`nav-ceo-${s.id}`}
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

            {/* ── Section 1 — Daily Routine ── */}
            <section>
              <SectionHeading
                id="s1"
                index="1"
                title="Your Daily Routine"
                subtitle="A 15-minute morning check that keeps the whole operation visible."
              />
              <P>
                Every business day starts in the same three places. Build the habit and the platform's signals
                will surface what needs your attention before it becomes a problem.
              </P>
              <H3>Morning checklist (in order):</H3>
              <StepList
                steps={[
                  <>
                    Open <ScreenLink href="/admin/executive-cockpit">Executive Cockpit</ScreenLink> — scan the People,
                    Attendance, and Disbursement tabs. Flag anything that looks wrong (missing attendance run,
                    pending payroll, unusual headcount).
                  </>,
                  <>
                    Open <ScreenLink href="/admin/control-tower">Control Tower</ScreenLink> — check the Communications
                    tab for held emails (amber badge) and the Automated Changes tab for pending proposals. Approve
                    or reject before midday.
                  </>,
                  <>
                    Open <ScreenLink href="/studio">Studio Dashboard</ScreenLink> — check the editorial queue (any
                    articles waiting for final approval?), the BD agent pipeline, and the Ideas calendar for today's
                    scheduled posts.
                  </>,
                ]}
              />
              <ProTip title="Set a recurring 9 AM block">
                Three tabs, 15 minutes. If you find yourself spending more than 15 minutes, it usually means there's
                a backlog of unapproved communications or pending automated changes. Clear those first.
              </ProTip>
            </section>

            {/* ── Section 2 — Executive Cockpit ── */}
            <section>
              <SectionHeading
                id="s2"
                index="2"
                title="Executive Cockpit"
                subtitle="One surface for the whole company — people, attendance, and payroll at a glance."
              />
              <P>
                The <ScreenLink href="/admin/executive-cockpit">Executive Cockpit</ScreenLink> gives you a read-only
                executive view across the three operational dimensions: People, Attendance, and Disbursement.
              </P>
              <H3>What each tab shows:</H3>
              <UL
                items={[
                  <><strong>People</strong> — live headcount, active/inactive split, departments, and a searchable
                  employee directory. Download a CSV snapshot at any time. Use this to cross-check before a payroll run.</>,
                  <><strong>Attendance</strong> — the current month's attendance run by manager group: team size,
                  average days present, total LOP days, and manager approval status. Export to CSV for payroll input.</>,
                  <><strong>Disbursement</strong> — the active salary run's payment status per employee. Mark individual
                  deposits, or mark all deposited at once. When all are deposited, the run auto-executes and payslips unlock.</>,
                ]}
              />
              <H3>When to act:</H3>
              <UL
                items={[
                  <>If a manager's approval is still Pending at month-end → message them directly or override via the attendance run page.</>,
                  <>If the disbursement run shows pending employees near salary date → coordinate with finance to get deposits confirmed.</>,
                  <>If the Cockpit shows zero employees → the session expired; refresh and log in again.</>,
                ]}
              />
              <ProTip title="The AI payload is allowlisted">
                The Cockpit's AI summary never includes raw PII — salary amounts, bank details, and personal IDs are
                stripped before the AI sees them. The payload is fail-closed: if the guard fails, no data is sent.
              </ProTip>
            </section>

            {/* ── Section 3 — Governance Control Tower ── */}
            <section>
              <SectionHeading
                id="s3"
                index="3"
                title="Governance Control Tower"
                subtitle="The platform's highest-privilege controls — escalation ladder, communications gate, and audit trail."
              />
              <P>
                The <ScreenLink href="/admin/control-tower">Control Tower</ScreenLink> is super_admin only. It
                combines the audit trail, feature flags, access control matrix, communications governance, and
                automated change approvals into a single audited surface.
              </P>
              <H3>Escalation ladder (what to check, and when):</H3>
              <UL
                items={[
                  <><strong>Communications (held emails)</strong> — Amber badge on the Control Tower link means
                  emails are queued for approval. Check daily. Held emails never send until you approve them.</>,
                  <><strong>Automated Changes</strong> — System jobs (absence sweeps, leave accruals) propose changes
                  here for your review before they apply to employee records. Approve within 48 hours or they stale-date.</>,
                  <><strong>Audit Logs</strong> — Every privileged action (user creation, role change, salary edit,
                  letter generation) is recorded here. Use it when something looks wrong.</>,
                  <><strong>Feature Flags</strong> — Toggle modules on and off. Notifications, salary advance, performance
                  management, and training compliance lock are all flag-gated.</>,
                  <><strong>Access Control Matrix</strong> — Override which roles can see each feature. Use sparingly
                  — the defaults are calibrated for a staffing firm.</>,
                ]}
              />
              <H3>When to intervene directly:</H3>
              <UL
                items={[
                  <>An automated change looks wrong → Reject it with a reason note. The system logs the rejection.</>,
                  <>A communication type is sending too frequently → Go to Communications → set that type to "Hold" while you investigate.</>,
                  <>An employee is locked out of a feature they need → Check Feature Flags and Access Control Matrix.</>,
                ]}
              />
              <ProTip title="Never use Feature Flags to bypass compliance">
                The Training Compliance Lock, SOP enforcement, and document verification are not decoration — they
                are the compliance backbone. Only disable them if you have a specific, documented reason.
              </ProTip>
            </section>

            {/* ── Section 4 — Studio & BD Agent ── */}
            <section>
              <SectionHeading
                id="s4"
                index="4"
                title="Studio & BD Agent"
                subtitle="The content engine and the business development pipeline — connected."
              />
              <P>
                The <ScreenLink href="/studio">Studio</ScreenLink> is the brand's content OS. It runs the editorial
                calendar, generates AI drafts, routes them through review and approval, and publishes to the Insights
                section. The BD Agent sits inside Studio and manages the outreach pipeline.
              </P>
              <H3>Content calendar rhythm:</H3>
              <UL
                items={[
                  <>Plan the month's ideas on the <ScreenLink href="/studio">Studio Dashboard</ScreenLink> → Calendar view by the last week of the prior month.</>,
                  <>AI generates draft articles; the editorial team reviews and marks them "In Review".</>,
                  <>As CEO, your touch-point is Final Approval — articles come to you (or a delegated approver) before publishing.</>,
                  <>Published articles automatically appear in <ScreenLink href="/studio">Studio → Live Content</ScreenLink> and the public Insights section.</>,
                ]}
              />
              <H3>BD agent proposal flow:</H3>
              <UL
                items={[
                  <>The BD Agent is at <ScreenLink href="/studio/bd-guide">Studio → BD Guide</ScreenLink>. It generates outreach sequences, email templates, and LinkedIn messages.</>,
                  <>All BD agent output passes through the Staffing Safety Gate — invented facts, superlatives, and clearance claims are hard-blocked before any text reaches a prospect.</>,
                  <>Review the proposed outreach before your BD team sends it. The agent drafts; humans decide.</>,
                ]}
              />
              <H3>The Insights editorial loop:</H3>
              <UL
                items={[
                  <>Articles with high Reactions + high CTA clicks are your best content — replicate the topic, angle, and format.</>,
                  <>Articles with low Reactions but high clicks need a stronger CTA. Articles with high Reactions but low clicks need a stronger call to action.</>,
                  <>Review the <ScreenLink href="/studio">Studio Analytics</ScreenLink> monthly to calibrate what's working.</>,
                ]}
              />
              <ProTip title="The Safety Gate is non-negotiable">
                The Staffing Safety Gate hard-blocks any draft that makes a claim the system can't verify (e.g., "We
                place 10,000 candidates annually" without a cited source). Do not ask the team to bypass it — the
                block is there to protect the brand from liability.
              </ProTip>
            </section>

            {/* ── Section 5 — HR & Payroll ── */}
            <section>
              <SectionHeading
                id="s5"
                index="5"
                title="HR & Payroll"
                subtitle="Monthly payroll run steps, attendance reports, salary advances, and letter generation."
              />
              <P>
                Payroll runs monthly. The cycle is: attendance report → manager approval → payroll run → salary
                slip generation → disbursement tracking. Each step gates the next.
              </P>
              <H3>Monthly payroll run (in order):</H3>
              <StepList
                steps={[
                  <>HR generates the attendance report for the month (People & HR → Attendance Report tab). Managers receive the report by email and approve their team's numbers.</>,
                  <>Once all managers have approved (or HR overrides), the payroll run is created (Payroll → Run Payroll).</>,
                  <>HR reviews LOP deductions, salary advances (auto-recovered from the oldest pending advance), and any adjustments.</>,
                  <>The run is approved. Salary slips are generated and locked. Employees can view them from My Desk → Payslips.</>,
                  <>Finance marks each salary deposit in the <ScreenLink href="/admin/executive-cockpit">Executive Cockpit → Disbursement</ScreenLink> tab. When all are deposited, the run auto-executes.</>,
                ]}
              />
              <H3>Salary advances:</H3>
              <UL
                items={[
                  <>Employees can request advances (if the flag is enabled). HR/Admin can also record advances manually for any employee — useful for backfills and overpayments.</>,
                  <>Advances are recovered automatically from the next payroll run, oldest-first. Shortfalls carry forward.</>,
                  <>Track all active advances from <ScreenLink href="/admin/salary-advance">Salary Advance</ScreenLink>.</>,
                ]}
              />
              <H3>Letter generation:</H3>
              <UL
                items={[
                  <>Experience letters, internship letters, relieving letters, and amendment letters are generated from HR Tools → Letter Generator.</>,
                  <>All letters are cryptographically verifiable — candidates can validate their letter on the <ScreenLink href="/verify">public verify page</ScreenLink> using the reference number and auth code.</>,
                ]}
              />
              <ProTip title="Lock the payroll run before the disbursement">
                Once you approve a payroll run, salary slip content is locked. Any corrections after that point require
                a new run. Get all manager approvals in before creating the run.
              </ProTip>
            </section>

            {/* ── Section 6 — New Hire Pipeline ── */}
            <section>
              <SectionHeading
                id="s6"
                index="6"
                title="New Hire Pipeline"
                subtitle="From offer letter to fully onboarded employee — the chain that must not break."
              />
              <P>
                The pipeline is: Offer Letter → HR countersign → candidate acceptance → onboarding checklist
                → growth plan activation. Each step is tracked in the{" "}
                <ScreenLink href="/admin/new-hire">New Hire</ScreenLink> section.
              </P>
              <H3>The chain:</H3>
              <StepList
                steps={[
                  <>Manager or recruiter generates an offer letter from New Hire → Offer Letters → New Offer Letter. It goes to HR for approval.</>,
                  <>HR (or Admin) approves and countersigns. The candidate receives an email with an acceptance link.</>,
                  <>Candidate accepts digitally. The document is hashed and locked — any alteration voids the hash.</>,
                  <>The New Hire → Onboarding tab shows training completion %, documents uploaded, bank details, and night-shift consent. All must be green before the employee is fully onboarded.</>,
                  <>Once the offer is accepted, the employee's growth plan is seeded automatically. The manager runs the 90-day probation check-ins from My Team.</>,
                ]}
              />
              <H3>What to watch:</H3>
              <UL
                items={[
                  <>Onboarding tab: employees with training % below 100% after their start date are at risk — their training compliance lock will fire.</>,
                  <>Offer letters pending approval for more than 48 hours → check with HR.</>,
                  <>Candidates who accepted but haven't uploaded documents → send a reminder from New Hire → Onboarding.</>,
                ]}
              />
              <ProTip title="The 90-day probation cadence is mandatory">
                Managers are accountable for running every check-in (Day 1, 7, 15, 30, 45, 60, 75, 90). Missed
                milestones escalate to HR automatically. The system logs every scored review — no documentation
                gaps at confirmation.
              </ProTip>
            </section>

            {/* ── Section 7 — Strategy & Reports ── */}
            <section>
              <SectionHeading
                id="s7"
                index="7"
                title="Strategy & Reports"
                subtitle="The competitive picture, the market thesis, and the fundraising story — in one place."
              />
              <P>
                Three strategic documents are always one click away from the Knowledge Hub.
              </P>
              <H3>Key documents:</H3>
              <UL
                items={[
                  <>
                    <strong>Competitive Audit (v3.0)</strong> — The full feature matrix, positioning map, white space analysis,
                    and action plan for Hire'in 360 vs. Darwinbox, Keka, GreytHR, Rippling, and BambooHR.
                    View at <ScreenLink href="/admin/competitive-audit">Competitive Audit</ScreenLink>. Print or export to CSV.
                  </>,
                  <>
                    <strong>McKinsey Market Strategy 2026</strong> — The market sizing, segment prioritisation, and
                    go-to-market sequencing for the staffing HRMS segment. Access via{" "}
                    <ScreenLink href="/admin/knowledge-hub">Knowledge Hub → Strategy</ScreenLink>.
                  </>,
                  <>
                    <strong>VC Fundraising Strategy 2026</strong> — The funding thesis, investor targeting, and
                    round structure. Access via <ScreenLink href="/admin/knowledge-hub">Knowledge Hub → Strategy</ScreenLink>.
                  </>,
                ]}
              />
              <ProTip title="Keep the Competitive Audit current">
                The audit was last updated July 2026. Competitor feature sets change quarterly. Assign someone to
                re-audit the top 3 competitors every quarter and update the feature matrix rows. Stale intel is
                worse than no intel in a sales conversation.
              </ProTip>
            </section>

            {/* ── Section 8 — Platform Health ── */}
            <section>
              <SectionHeading
                id="s8"
                index="8"
                title="Platform Health"
                subtitle="Audit log, feature flags, notification settings — how to know if something is wrong."
              />
              <P>
                Platform health is visible in three places: the audit log, the feature flag dashboard, and the
                notification settings panel.
              </P>
              <H3>Key health indicators:</H3>
              <UL
                items={[
                  <>
                    <strong>Audit Log</strong> (<ScreenLink href="/admin/control-tower">Control Tower → Audit Logs</ScreenLink>)
                    — Look for unusual bursts of write operations, failed login attempts, or role changes you didn't authorise.
                    Every privileged action has an actor, a target, and a timestamp.
                  </>,
                  <>
                    <strong>Feature Flags</strong> (<ScreenLink href="/admin/control-tower">Control Tower → Feature Flags</ScreenLink>)
                    — Check that the flags you expect to be ON are ON. The Training Compliance Lock, notifications, and
                    salary advance flags are the three most commonly asked about.
                  </>,
                  <>
                    <strong>Notification Settings</strong> (<ScreenLink href="/admin/notification-settings">Notification Settings</ScreenLink>)
                    — Configure which event types send emails and in-app notifications. If employees are saying they
                    didn't get an email, start here.
                  </>,
                ]}
              />
              <H3>When something is wrong:</H3>
              <UL
                items={[
                  <>A feature stopped working → check Feature Flags first (it may have been toggled off).</>,
                  <>Employees aren't receiving emails → check the Communications tab in Control Tower (emails may be held), then check Notification Settings.</>,
                  <>An HR letter hash validation is failing → check that the document wasn't regenerated after signing. Every re-issue creates a new hash.</>,
                  <>The payroll run is stuck → check if all managers have approved the attendance report. Unapproved managers block the run creation.</>,
                ]}
              />
              <ProTip title="Review the audit log weekly">
                A 5-minute scan of the audit log every Friday catches unusual patterns before they become incidents.
                Filter by "user management" and "salary" actions — those are the highest-risk write operations.
              </ProTip>
            </section>

          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
