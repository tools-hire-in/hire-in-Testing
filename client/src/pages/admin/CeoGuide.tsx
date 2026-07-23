import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import {
  Compass,
  Lightbulb,
  ArrowUpRight,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

// ── Shared guide helper components ───────────────────────────────────────────

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
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

// ── TOC sections ─────────────────────────────────────────────────────────────

const SECTIONS: { id: string; index: string; label: string }[] = [
  { id: "s1", index: "1", label: "Your Daily Routine" },
  { id: "s2", index: "2", label: "Executive Cockpit" },
  { id: "s3", index: "3", label: "Governance Control Tower" },
  { id: "s4", index: "4", label: "Studio & BD Agent" },
  { id: "s5", index: "5", label: "HR & Payroll" },
  { id: "s6", index: "6", label: "New Hire Pipeline" },
  { id: "s7", index: "7", label: "Strategy & Reports" },
  { id: "s8", index: "8", label: "Platform Health" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CeoGuide() {
  const { enabled: newLook } = useNewLook();
  const [activeId, setActiveId] = useState<string>("s1");

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
        {/* Header */}
        {newLook ? (
          <div className="mb-6">
            <V2PageHeader
              icon={Compass}
              eyebrow="Guides"
              title="CEO Command Guide"
              subtitle="One reference for every major platform lever — how to run the business from the portal."
              testId="text-ceo-guide-title"
            />
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-ceo-guide-title">
                CEO Command Guide
              </h1>
              <p className="text-sm text-muted-foreground">
                One reference for every major platform lever — how to run the business from the portal.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
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
                  data-testid={`nav-ceo-guide-${s.id}`}
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

            {/* ── Section 1 — Your Daily Routine ── */}
            <section>
              <SectionHeading
                id="s1"
                index="1"
                title="Your Daily Routine"
                subtitle="Three screens, ten minutes. Everything else can wait."
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <ScreenLink href="/admin/executive-cockpit">Exec Cockpit</ScreenLink>
                <ScreenLink href="/admin/control-tower">Control Tower</ScreenLink>
                <ScreenLink href="/studio">Studio</ScreenLink>
              </div>

              <H3>Morning checklist:</H3>
              <StepList
                steps={[
                  <>Open the <ScreenLink href="/admin/executive-cockpit">Executive Cockpit</ScreenLink> — scan the People tab for any new joiners or exits, and the Compliance tab for overdue controls.</>,
                  <>Open the <ScreenLink href="/admin/control-tower">Control Tower</ScreenLink> — check the escalation count at the top. If there are escalated items, act on them before anything else.</>,
                  <>Check the <ScreenLink href="/studio">Studio</ScreenLink> calendar — confirm today's and tomorrow's content is in Approved status. If anything is stuck in review, unblock it.</>,
                  <>Review any pending items in the notifications bell (top right). Approve or delegate before your first call.</>,
                  <>Once a week, open <ScreenLink href="/admin/hr/people">People & HR</ScreenLink> and check the salary report for the current month's attendance status.</>,
                ]}
              />

              <ProTip title="Tower escalations take priority">
                If the Control Tower shows 5 or more escalated controls, that takes priority over Studio content review. Governance blocks compound — an unacknowledged escalation becomes a CEO Digest item within 48 hours.
              </ProTip>
            </section>

            {/* ── Section 2 — Executive Cockpit ── */}
            <section>
              <SectionHeading
                id="s2"
                index="2"
                title="Executive Cockpit"
                subtitle="A unified action layer — everything senior management needs without navigating 12 modules."
              />

              <P>
                The <ScreenLink href="/admin/executive-cockpit">Executive Cockpit</ScreenLink> aggregates signals from across the platform into four tabs. Each tab is designed to surface what requires a decision, not a report dump.
              </P>

              <H3>The four tabs:</H3>
              <UL
                items={[
                  <><strong>People</strong> — headcount, recent joiners, exits, open positions. Use this to spot gaps in team coverage and confirm new hire onboarding is on track. If a joiner has been in the system for 7+ days without completing onboarding, follow up with HR.</>,
                  <><strong>Compliance</strong> — overdue governance controls, pending CEO exceptions, and the most recent AI digest payload. The digest is your weekly automated summary — read it, don't archive it.</>,
                  <><strong>Attendance</strong> — organisation-wide attendance signals for the current month. Use this to verify the attendance report is progressing before payroll week. Anomalies here (team with 0% punches) indicate a data feed issue, not an empty office.</>,
                  <><strong>Reports</strong> — salary run status, current headcount by role, and any pending manual adjustments. Acts as a pre-flight check before approving the payroll run.</>,
                ]}
              />

              <H3>When to act vs. let it run:</H3>
              <P>
                The Cockpit is read-mostly. Act when you see a red badge (overdue/escalated), a CEO-exception pending your signature, or a salary run stuck in "pending approval" past the 25th of the month. Everything else — green counts, in-progress onboarding, approved content — is informational.
              </P>

              <H3>Reading the AI digest payload:</H3>
              <P>
                The Compliance tab shows the most recent automated digest. The payload is an allowlisted summary — it contains no employee PII, no raw salary data, no medical records. It only surfaces aggregate counts and categorical risk signals. If a category shows "elevated", click through to the relevant module for detail.
              </P>

              <ProTip title="The digest is fail-closed">
                If the AI digest payload shows "no data available", the underlying aggregation endpoint returned an error. This is not a health signal — check Control Tower instead for a manual view of compliance status.
              </ProTip>
            </section>

            {/* ── Section 3 — Governance Control Tower ── */}
            <section>
              <SectionHeading
                id="s3"
                index="3"
                title="Governance Control Tower"
                subtitle="The 4-stage escalation ladder — from overdue to CEO desk."
              />

              <P>
                The <ScreenLink href="/admin/control-tower">Control Tower</ScreenLink> is the platform's systemic governance engine. Every control (a goal, check-in, SOP, training, PIP, or attendance threshold) is monitored automatically. When a control goes overdue, it enters the escalation ladder.
              </P>

              <H3>The 4-stage escalation ladder:</H3>
              <UL
                items={[
                  <><strong>Overdue</strong> — the control deadline has passed. The owning manager receives an in-app nudge. No action required from you at this stage.</>,
                  <><strong>Escalated L1</strong> — still unresolved after the first grace window. The manager's manager is now notified. HR is CC'd. If you see items here, they are typically resolved within 24 hours of the L1 notification going out.</>,
                  <><strong>Escalated L2</strong> — unresolved past L1 grace. HR and the owning department head are formally looped in. Items at L2 appear in your Exec Cockpit Compliance tab. This is your first direct touch point — review and decide whether to intervene or let HR resolve.</>,
                  <><strong>CEO Digest</strong> — the item has been unresolved long enough to warrant your direct attention. It appears in the next automated digest. At this stage, escalate to the relevant manager with a deadline or close the item with a documented exception.</>,
                ]}
              />

              <H3>When to intervene:</H3>
              <P>
                L1 and L2 items rarely need your direct involvement — they resolve through the normal chain. Intervene at L2 only if the item is high-risk (a probation milestone overdue at Day 90, a PIP with no check-ins in 30 days, a statutory compliance control). At CEO Digest level, always act.
              </P>

              <H3>Exceptions:</H3>
              <P>
                Some controls allow a CEO exception — a documented override that closes the escalation without the underlying action being completed. Use exceptions sparingly. They are audit-logged with your name, timestamp, and reason. Exceptions are visible to auditors.
              </P>

              <ProTip title="PIP zero-threshold rule">
                Performance Improvement Plans have a zero-tolerance escalation threshold — any missed check-in escalates immediately to L2, regardless of the control's age. This is intentional. A PIP with a missed check-in is a legal and HR risk, not an administrative oversight.
              </ProTip>
            </section>

            {/* ── Section 4 — Studio & BD Agent ── */}
            <section>
              <SectionHeading
                id="s4"
                index="4"
                title="Studio & BD Agent"
                subtitle="Content calendar rhythm, BD proposals, and the editorial loop explained."
              />

              <P>
                The <ScreenLink href="/studio">Studio</ScreenLink> runs on a weekly content cadence. The goal is to be one week ahead at all times — next week's content should be in Approved status before the current week's content goes live.
              </P>

              <H3>Weekly cadence:</H3>
              <UL
                items={[
                  <><strong>Monday</strong> — review the calendar for the coming week. Any ideas still in Draft or In Review need to be unblocked or pulled from the schedule.</>,
                  <><strong>Tuesday–Wednesday</strong> — content production and editing. AI-assisted first drafts are generated, reviewed by the content team, and submitted for approval.</>,
                  <><strong>Thursday</strong> — final approval day. All this-week content should reach Approved status. You or a delegated approver signs off on the week's batch.</>,
                  <><strong>Friday</strong> — social media manager downloads approved Social Kits and publishes. Articles go live on the Insights page on the scheduled date.</>,
                ]}
              />

              <H3>Triggering a BD proposal from the BD Agent:</H3>
              <P>
                Go to <ScreenLink href="/studio/bd-agent">BD Agent</ScreenLink>. The agent generates outreach proposals based on your current campaign context, target segment, and brand voice. Fill in the target company, the contact role, and the value proposition context — the agent handles the draft. Review it, adjust the tone, and export.
              </P>

              <P>
                For templates and previously approved outreach formats, see <ScreenLink href="/studio/bd-guide">BD Guide</ScreenLink>.
              </P>

              <H3>The editorial loop — how inbound connects to revenue:</H3>
              <FlowStrip stages={["Jobs", "Content", "Brand", "Inbound", "BD", "Contract", "Onboarding", "Repeat"]} />
              <UL
                items={[
                  <><strong>Jobs</strong> — open roles drive the content brief. What roles are hard to fill? Those become thought-leadership articles and social content.</>,
                  <><strong>Content</strong> — articles and social kits are produced in Studio, approved, and published to the Insights section and social channels.</>,
                  <><strong>Brand</strong> — consistent publishing builds brand recognition in the healthcare/IT/engineering segments. The Brand Kit ensures every piece stays on-voice.</>,
                  <><strong>Inbound</strong> — qualified candidates and client inquiries arrive via the website's contact form and job listings. These feed into the ATS pipeline.</>,
                  <><strong>BD</strong> — the BD Agent generates outreach for warm prospects identified from inbound signals. Outreach is personalised to the segment.</>,
                  <><strong>Contract</strong> — signed contracts are logged in Finance & Contracts. The Contracts Hub tracks MSAs, SOWs, and placement agreements.</>,
                  <><strong>Onboarding</strong> — placed candidates go through the New Hire pipeline. The cycle restarts with the next open role.</>,
                ]}
              />

              <P>
                For a full guide to the Studio's capabilities, see the <ScreenLink href="/studio/guide">Studio Playbook</ScreenLink>.
              </P>

              <ProTip title="Content velocity trumps content perfection">
                A good article published weekly outperforms a perfect article published quarterly. The Studio's AI layer is designed to get you to 80% in the first draft — your job is the final 20%. Do not let the perfect be the enemy of the published.
              </ProTip>
            </section>

            {/* ── Section 5 — HR & Payroll ── */}
            <section>
              <SectionHeading
                id="s5"
                index="5"
                title="HR & Payroll"
                subtitle="Monthly payroll in 5 steps, attendance reading, salary advance, and letter generation."
              />

              <H3>Monthly payroll run — 5 steps:</H3>
              <StepList
                steps={[
                  <>By the 20th of the month, confirm with HR that the attendance report is finalised. Open <ScreenLink href="/admin/hr/people">People & HR</ScreenLink> → Salary Reports tab and check the current month's report status. It should read "Finalised" or "Ready for payroll".</>,
                  <>Open the <ScreenLink href="/admin/payroll/run">Bulk Payroll Run</ScreenLink> page. Review the headcount and the gross salary total against last month. A variance over 5% warrants investigation before proceeding.</>,
                  <>Check the LOP (Loss of Pay) column. Any employee with LOP days should have a corresponding attendance note in their record. If an LOP looks wrong, flag it to HR before running — corrections after disbursement require a separate adjustment cycle.</>,
                  <>Click "Generate Payslips". The engine runs the India-statutory computation (PF, ESI, TDS, PT) and produces individual payslips. Review the summary sheet for any computation errors flagged in red.</>,
                  <>Approve and mark as disbursed. The system automatically unlocks individual payslips for employee viewing and triggers payslip email notifications if the notification toggle is enabled.</>,
                ]}
              />

              <H3>Reading the attendance report:</H3>
              <P>
                The attendance report at <ScreenLink href="/admin/hr/people">People & HR → Salary Reports</ScreenLink> shows present days, LOP days, leave days, and punch-in/out completeness per employee. Focus on two signals: employees with 0 present days (likely a punch sync issue) and employees with LOP days who have no approved leave (likely a dispute).
              </P>

              <H3>Salary advance recording:</H3>
              <P>
                HR can record advances directly from <ScreenLink href="/admin/hr/tools">HR Tools</ScreenLink> → Salary Advance. Two types: a standard advance (repaid in monthly instalments) and an overpayment recovery (full deduction next cycle, remainder carries forward). Both are audit-logged. The system's monthly payroll recovery engine handles deductions automatically once an advance is disbursed.
              </P>

              <H3>Letter generation flow:</H3>
              <P>
                Experience letters, relieving letters, salary revision letters, and offer letters are generated from <ScreenLink href="/admin/hr/tools">HR Tools</ScreenLink>. All letters include a cryptographic reference number and verification code, accessible at the public <code>/verify</code> page. Amendment letters (salary revision, promotion, device allocation) can be emailed directly from the tool.
              </P>

              <ProTip title="Payslips are locked until disbursed">
                Employees cannot see their payslip until you mark the run as disbursed. If an employee reports not seeing their payslip, check the run status before investigating anything else.
              </ProTip>
            </section>

            {/* ── Section 6 — New Hire Pipeline ── */}
            <section>
              <SectionHeading
                id="s6"
                index="6"
                title="New Hire Pipeline"
                subtitle="From offer letter to active employee — what each stage requires from you."
              />

              <P>
                The <ScreenLink href="/admin/new-hire">New Hire</ScreenLink> section manages the pre-employment pipeline. The chain runs: Offer Letter → Candidate Acceptance → HR Counter-sign → Onboarding Checklist → Growth Plan activation.
              </P>

              <H3>What each stage requires from you:</H3>
              <UL
                items={[
                  <><strong>Offer Letter approval</strong> — managers generate offer letters; HR submits for your final approval. You will see a badge on the New Hire nav item when letters are pending. Open New Hire → Letters, review the compensation and title, and approve or return with comments. Returning a letter prompts the originator to revise and resubmit.</>,
                  <><strong>Counter-signature</strong> — once the candidate digitally accepts, HR countersigns on your behalf. If HR is unavailable, you can countersign directly. The countersigned letter is cryptographically hashed and stored — this is the binding employment document.</>,
                  <><strong>Onboarding checklist</strong> — the New Hire → Onboarding tab shows each new joiner's checklist completion: training %, documents uploaded, bank details, and night-shift consent. A joiner who has been in the system for 14 days with below 50% checklist completion should be flagged to their manager.</>,
                  <><strong>Growth plan activation</strong> — once the onboarding addendum is signed, the system activates the employee's growth plan (goals and probation framework). You do not need to take action here — it is automatic. You can review active plans in My Team → Plans.</>,
                ]}
              />

              <ProTip title="Offer letter approval is the only manual gate">
                Every other step in the new hire pipeline is automated or delegated to HR/managers. Your only required action is approving the offer letter. If a new hire's start date is approaching and the letter is still pending, it will block the onboarding checklist from activating.
              </ProTip>
            </section>

            {/* ── Section 7 — Strategy & Reports ── */}
            <section>
              <SectionHeading
                id="s7"
                index="7"
                title="Strategy & Reports"
                subtitle="Three documents — what each covers and when to use it."
              />

              <H3>Competitive Audit</H3>
              <P>
                The <ScreenLink href="/admin/competitive-audit">Competitive Audit</ScreenLink> is a live internal strategy document comparing Hire'in 360 against seven competitors across 29 weighted capability dimensions. It was last updated in July 2026. Use it when preparing for a sales conversation against Darwinbox or Keka, when briefing a potential investor on platform differentiation, or when scoping a new feature to understand how it closes a competitive gap. The Feature Matrix tab is the most actionable section — it shows exactly where Hire'in wins, where it is partial, and where it has gaps.
              </P>

              <H3>McKinsey Market Strategy</H3>
              <P>
                The McKinsey-style commercialisation playbook lives in the <ScreenLink href="/admin/knowledge-hub">Knowledge Hub</ScreenLink>. It covers the India staffing market sizing, the target segment (10–200 employee Indian staffing agencies running US-client operations), the go-to-market motion, and the pricing strategy. Use it when planning a BD push into a new geography or when aligning the leadership team on the commercialisation roadmap for the next quarter.
              </P>

              <H3>VC Memo</H3>
              <P>
                The VC investment narrative is also in the <ScreenLink href="/admin/knowledge-hub">Knowledge Hub</ScreenLink>. It frames Hire'in 360 as a platform investment — the staffing operations OS thesis, the defensibility argument (integrated data moat + proprietary AI compliance layer), and the unit economics model. Use it when speaking with prospective investors or when briefing a new advisor who needs rapid context on the business.
              </P>

              <ProTip title="Keep the Competitive Audit current">
                Competitor products change quarterly. The Competitive Audit is only as valuable as its last update. Revisit the Feature Matrix after any major product launch by Darwinbox, Keka, or GreytHR to flag new gaps or wins.
              </ProTip>
            </section>

            {/* ── Section 8 — Platform Health ── */}
            <section>
              <SectionHeading
                id="s8"
                index="8"
                title="Platform Health"
                subtitle="Audit logs, feature flags, and notification toggles — your admin levers."
              />

              <H3>Reading the audit log:</H3>
              <P>
                The audit log is accessible from <ScreenLink href="/admin/hr/people">People & HR → Audit</ScreenLink>. Every significant write operation in the platform (salary changes, letter generation, user role changes, leave approvals, payroll runs) is logged with the acting user, timestamp, and before/after state. Use it to investigate a disputed transaction, verify a historical action, or satisfy an audit request. Filter by user or action type to narrow the log.
              </P>

              <H3>Feature flags:</H3>
              <P>
                Feature flags at <ScreenLink href="/admin/settings">Settings</ScreenLink> control which platform capabilities are active. Flags you might need to toggle:
              </P>
              <UL
                items={[
                  <><strong>notifications_enabled</strong> — master switch for all in-app notifications. Turn off during maintenance windows.</>,
                  <><strong>salary_advance_enabled</strong> — controls employee self-service salary advance requests. HR can still record advances manually regardless of this flag.</>,
                  <><strong>performance_management_enabled</strong> — enables the Goals, Check-Ins, and Reviews modules for employees.</>,
                  <><strong>studio_v2_enabled</strong> — activates the standalone Studio shell (the /studio domain).</>,
                ]}
              />

              <H3>Notification toggles:</H3>
              <P>
                Granular email and in-app notification settings are at <ScreenLink href="/admin/notification-settings">Notification Settings</ScreenLink>. Each notification type (leave approval, payslip unlock, governance sweep, onboarding reminder) can be toggled independently. Review this page if employees report missing emails — the toggle is the first thing to check before investigating the email delivery layer.
              </P>

              <ProTip title="Governance sweep email toggle">
                The governance sweep runs nightly and sends digest emails to managers with overdue controls. If managers report receiving too many emails, check the "governance_sweep_email" toggle in Notification Settings before disabling the sweep itself — the sweep still runs (and updates the Control Tower) regardless of the email toggle state.
              </ProTip>
            </section>

          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
