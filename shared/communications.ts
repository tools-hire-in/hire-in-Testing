// Communications Control Center — shared registry of automated/system email types.
// Each automated sender declares one of these types when routing through the central
// send gateway. Per-type policy (auto-send vs hold-for-approval) is stored in
// system_settings under the COMMUNICATION_POLICY_KEY.

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
    scheduleLabel: "Monthly · 1st at 9 AM IST",
    recipientRule: "Managers with pending regularizations",
  },
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
    key: "attendance_escalation",
    label: "Attendance Exception Escalation",
    description:
      "Escalates attendance exceptions through configured tiers to managers/HR.",
    category: "Attendance",
    scheduleLabel: "On threshold breach",
    recipientRule: "Managers & HR (tiered)",
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
