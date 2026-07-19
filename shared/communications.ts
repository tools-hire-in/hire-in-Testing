// Communications Control Center — shared registry of automated/system email types.
// Each automated sender declares one of these types when routing through the central
// send gateway. Per-type policy (auto-send vs hold-for-approval) is stored in
// system_settings under the COMMUNICATION_POLICY_KEY.
//
// ── AUDIT RULE ────────────────────────────────────────────────────────────────
// Any notifyUser() or dispatchAutomatedEmail() call that carries an email with a
// `configType` MUST have a matching entry in COMMUNICATION_TYPES below, or that
// email bypasses the per-type enabled toggle and can only be stopped by the master
// kill switch.
//
// Intentional exceptions (bypass per-type toggle by design — user-triggered
// transactional sends, gated only by the master kill switch):
//   • sendHelpDeskEmail / sendInternalRequestEmail — ticket event notifications
//   • Offer-letter delivery / addendum delivery to candidates — user-triggered
//   • shift_correction_apology (server/index.ts) — one-time legacy correction send
//
// Design debt to address in a future task:
//   • Plan email functions (sendPlanManagerBriefingEmail, sendPlanOverdueReminderEmail,
//     sendPlanEscalationEmail) use a dynamic key pattern: `${planType}_<action>`.
//     This forces 9 concrete registry entries (probation/growth/pip × 3 actions) to
//     keep coverage complete.  Long-term fix: use a single fixed key per action
//     (e.g. `plan_overdue_reminder`) since the plan type already lives in the body.
// ──────────────────────────────────────────────────────────────────────────────

export const COMMUNICATION_POLICY_KEY = "communications_policy";

export type CommunicationPolicy = "auto" | "hold";

export type CommunicationStatus =
  | "sent"
  | "held"
  | "approved"
  | "rejected"
  | "failed"
  | "dry_run"
  | "master_suppressed";

export interface CommunicationTypeDef {
  key: string;
  label: string;
  description: string;
  category: string;
  scheduleLabel: string;
  recipientRule: string;
}

export const COMMUNICATION_TYPES: CommunicationTypeDef[] = [
  // ── Payroll ──────────────────────────────────────────────────────────────────
  {
    key: "salary_report_reminder",
    label: "Salary Report Approval Reminder",
    description:
      "Reminds Super Admins that a monthly salary report is still pending approval.",
    category: "Payroll",
    scheduleLabel: "Monthly · 1st at 8 PM CST",
    recipientRule: "Super Admins",
  },
  {
    key: "salary_report_dispatch",
    label: "Salary Report Dispatch",
    description:
      "Auto-dispatch of approved monthly salary CSV to accounts and configured recipients.",
    category: "Payroll",
    scheduleLabel: "Monthly · On salary run approval",
    recipientRule: "Configured accounts recipients (salary_report_recipients setting)",
  },
  {
    key: "salary_run_ready",
    label: "Salary Run Ready for Processing",
    description:
      "Lightweight ping to executives when a salary run is approved — no figures or attachments, deep link to the Executive Cockpit.",
    category: "Payroll",
    scheduleLabel: "Monthly · On salary run approval",
    recipientRule: "Active executive users",
  },
  {
    key: "salary_deposited",
    label: "Salary Deposited / Payslip Ready",
    description:
      "Notifies an employee that their salary was deposited and their payslip for the month is available.",
    category: "Payroll",
    scheduleLabel: "On deposit confirmation",
    recipientRule: "The employee whose payment was marked deposited",
  },

  // ── Attendance ────────────────────────────────────────────────────────────────
  {
    key: "attendance_approval_request",
    label: "Attendance Approval Request",
    description:
      "Asks managers to review and approve their team's monthly attendance report.",
    category: "Attendance",
    scheduleLabel: "Monthly · Last working day",
    recipientRule: "All Managers",
  },
  {
    key: "attendance_approval_reminder",
    label: "Attendance Approval Reminder (T-2h)",
    description:
      "Reminds managers who haven't approved attendance as the deadline approaches.",
    category: "Attendance",
    scheduleLabel: "Monthly · 2 hours before deadline",
    recipientRule: "Managers with pending approvals",
  },
  {
    key: "attendance_deadline_expired",
    label: "Attendance Deadline Expired Escalation",
    description:
      "Escalates to HR/Admin when a manager's attendance approval deadline passes.",
    category: "Attendance",
    scheduleLabel: "Monthly · On deadline expiry",
    recipientRule: "HR & Admins",
  },
  {
    key: "regularization_digest",
    label: "Regularization Digest",
    description:
      "Monthly digest to managers listing pending attendance regularization requests.",
    category: "Attendance",
    scheduleLabel: "Monthly · 25th at 9 AM IST",
    recipientRule: "Managers with pending regularizations",
  },
  {
    key: "attendance_escalation",
    label: "Attendance Exception Escalation",
    description:
      "Escalates attendance exceptions through configured tiers to managers/HR.",
    category: "Attendance",
    scheduleLabel: "On threshold breach",
    recipientRule: "Managers & HR (tiered)",
  },

  // ── Onboarding ────────────────────────────────────────────────────────────────
  {
    key: "offer_letter_reminder",
    label: "Offer Letter Signing Reminder",
    description:
      "Reminds candidates to sign an offer letter that is still unsigned.",
    category: "Onboarding",
    scheduleLabel: "Daily · On schedule",
    recipientRule: "Candidates with unsigned offers",
  },
  {
    key: "addendum_reminder",
    label: "Addendum Signing Reminder",
    description:
      "Reminds recipients to sign an offer letter addendum that is still unsigned.",
    category: "Onboarding",
    scheduleLabel: "Daily · On schedule",
    recipientRule: "Recipients with unsigned addendums",
  },

  // ── Content ───────────────────────────────────────────────────────────────────
  {
    key: "newsletter_notification",
    label: "Newsletter / New Content Notification",
    description:
      "Notifies subscribers when new Insights content is published.",
    category: "Content",
    scheduleLabel: "On publish event",
    recipientRule: "Newsletter subscribers",
  },
  {
    key: "studio_weekly_digest",
    label: "Studio Weekly Digest",
    description:
      "Weekly preview of upcoming Content Studio scheduled posts sent to Studio T3 users, so they can prepare and review before content goes live.",
    category: "Content",
    scheduleLabel: "Weekly · Monday morning",
    recipientRule: "Studio T3 users with upcoming scheduled content",
  },

  // ── Governance & Compliance ───────────────────────────────────────────────────
  // NOTE: Several governance notification types are intentionally omitted here
  // because they send NO email — they are in-app only. Adding them to this list
  // would create misleading "email" toggles for types that never touch SendGrid.
  // In-app-only types (no email toggle needed):
  //   governance_overdue, governance_overdue_employee, governance_escalated,
  //   governance_escalated_warning, compliance_digest, sop_overdue_contextual,
  //   sop_overdue_nudge
  // The types below DO send email via notifyUser() + dispatchAutomatedEmail(),
  // so they require toggles.
  {
    key: "checkin_overdue_digest",
    label: "Check-in Overdue Digest",
    description:
      "Daily digest emailed to HR and Admins listing all growth plan check-ins that are currently overdue — so they can follow up with managers before targets slip.",
    category: "Governance",
    scheduleLabel: "Daily · Compliance sweep",
    recipientRule: "HR & Admin users",
  },
  {
    key: "pip_coaching_prompt_contextual",
    label: "PIP Coaching Prompt",
    description:
      "Context-rich coaching nudge sent to a manager when no coaching note has been logged against a PIP employee for 5 or more days — prompting them to record an update before the plan falls behind.",
    category: "Governance",
    scheduleLabel: "Daily · Compliance sweep (when triggered)",
    recipientRule: "Manager responsible for the PIP plan",
  },
  {
    key: "checkin_reminder_contextual",
    label: "Plan Check-in Reminder",
    description:
      "Contextual reminder sent to both the employee and their manager when a scheduled plan check-in (probation, growth, or PIP) is approaching and hasn't been completed.",
    category: "Governance",
    scheduleLabel: "Daily · On schedule",
    recipientRule: "Employee on the plan + their manager",
  },
  {
    key: "governance_ceo_report",
    label: "CEO Governance Exception Report",
    description:
      "Weekly anonymised AI summary of open governance exceptions emailed to Super Admins and executives — highlights overdue controls, escalated plans, and compliance gaps.",
    category: "Governance",
    scheduleLabel: "Weekly · Mondays at 8 AM IST",
    recipientRule: "Super Admins & Executive users",
  },

  // ── Plans & Escalations ───────────────────────────────────────────────────────
  // Three plan types (probation / growth / pip) × three actions each.
  // These use dynamic configType keys (`${planType}_${action}`) in server/email.ts.
  // Each concrete variant must be registered here so per-type toggles work.
  // Future: collapse these into three fixed keys (plan_manager_briefing,
  // plan_overdue_reminder, plan_escalation) since plan type lives in the body.

  // Probation
  {
    key: "probation_manager_briefing",
    label: "Probation Plan — Manager Briefing",
    description:
      "Sent once to the owning manager when a probation plan is assigned, summarising the 90-day check-in cadence and their responsibilities.",
    category: "Plans & Escalations",
    scheduleLabel: "On plan assignment",
    recipientRule: "Manager who owns the probation plan",
  },
  {
    key: "probation_overdue_reminder",
    label: "Probation Plan — Overdue Check-in Reminder",
    description:
      "Daily reminder to a manager about a probation check-in that is past its scheduled date and hasn't been completed.",
    category: "Plans & Escalations",
    scheduleLabel: "Daily · When triggered",
    recipientRule: "Manager who owns the probation plan",
  },
  {
    key: "probation_escalation",
    label: "Probation Plan — Escalation",
    description:
      "Escalation email to HR/Ops (and optionally skip-level) when a probation plan breaches a configured overdue threshold.",
    category: "Plans & Escalations",
    scheduleLabel: "On escalation threshold",
    recipientRule: "HR, Ops & skip-level manager",
  },

  // Growth
  {
    key: "growth_manager_briefing",
    label: "Growth Plan — Manager Briefing",
    description:
      "Sent once to the owning manager when a growth plan is assigned, summarising the milestone review cadence and their responsibilities.",
    category: "Plans & Escalations",
    scheduleLabel: "On plan assignment",
    recipientRule: "Manager who owns the growth plan",
  },
  {
    key: "growth_overdue_reminder",
    label: "Growth Plan — Overdue Check-in Reminder",
    description:
      "Daily reminder to a manager about a growth plan check-in that is past its scheduled date.",
    category: "Plans & Escalations",
    scheduleLabel: "Daily · When triggered",
    recipientRule: "Manager who owns the growth plan",
  },
  {
    key: "growth_escalation",
    label: "Growth Plan — Escalation",
    description:
      "Escalation email to HR/Ops when a growth plan breaches the overdue threshold.",
    category: "Plans & Escalations",
    scheduleLabel: "On escalation threshold",
    recipientRule: "HR & Ops",
  },

  // PIP
  {
    key: "pip_manager_briefing",
    label: "PIP — Manager Briefing",
    description:
      "Sent once to the owning manager when a Performance Improvement Plan is assigned, summarising the weekly check-in cadence and their responsibilities.",
    category: "Plans & Escalations",
    scheduleLabel: "On plan assignment",
    recipientRule: "Manager who owns the PIP",
  },
  {
    key: "pip_overdue_reminder",
    label: "PIP — Overdue Check-in Reminder",
    description:
      "Daily reminder to a manager about a PIP check-in that is past its scheduled date.",
    category: "Plans & Escalations",
    scheduleLabel: "Daily · When triggered",
    recipientRule: "Manager who owns the PIP",
  },
  {
    key: "pip_escalation",
    label: "PIP — Escalation",
    description:
      "Escalation email to HR/Ops when a PIP breaches the overdue threshold.",
    category: "Plans & Escalations",
    scheduleLabel: "On escalation threshold",
    recipientRule: "HR & Ops",
  },
];

export const COMMUNICATION_TYPE_KEYS = COMMUNICATION_TYPES.map((t) => t.key);

const TYPE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  COMMUNICATION_TYPES.map((t) => [t.key, t.label]),
);

export function communicationTypeLabel(key: string): string {
  return TYPE_LABEL_MAP[key] ?? key;
}

// Resolve effective policy for a type from a stored policy map. Default: auto-send.
export function resolveCommunicationPolicy(
  policyMap: Record<string, CommunicationPolicy> | undefined | null,
  type: string,
): CommunicationPolicy {
  return policyMap?.[type] === "hold" ? "hold" : "auto";
}
