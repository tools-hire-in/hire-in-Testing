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
  | "failed";

export interface CommunicationTypeDef {
  key: string;
  label: string;
  description: string;
  category: string;
}

export const COMMUNICATION_TYPES: CommunicationTypeDef[] = [
  {
    key: "salary_report_reminder",
    label: "Salary Report Approval Reminder",
    description:
      "Reminds Super Admins that a monthly salary report is still pending approval.",
    category: "Payroll",
  },
  {
    key: "attendance_approval_request",
    label: "Attendance Approval Request",
    description:
      "Asks managers to review and approve their team's monthly attendance report.",
    category: "Attendance",
  },
  {
    key: "attendance_approval_reminder",
    label: "Attendance Approval Reminder (T-2h)",
    description:
      "Reminds managers who haven't approved attendance as the deadline approaches.",
    category: "Attendance",
  },
  {
    key: "attendance_deadline_expired",
    label: "Attendance Deadline Expired Escalation",
    description:
      "Escalates to HR/Admin when a manager's attendance approval deadline passes.",
    category: "Attendance",
  },
  {
    key: "regularization_digest",
    label: "Regularization Digest",
    description:
      "Monthly digest to managers listing pending attendance regularization requests.",
    category: "Attendance",
  },
  {
    key: "offer_letter_reminder",
    label: "Offer Letter Signing Reminder",
    description:
      "Reminds candidates to sign an offer letter that is still unsigned.",
    category: "Onboarding",
  },
  {
    key: "addendum_reminder",
    label: "Addendum Signing Reminder",
    description:
      "Reminds recipients to sign an offer letter addendum that is still unsigned.",
    category: "Onboarding",
  },
  {
    key: "newsletter_notification",
    label: "Newsletter / New Content Notification",
    description:
      "Notifies subscribers when new Insights content is published.",
    category: "Content",
  },
  {
    key: "overtime_recognition",
    label: "Overtime Recognition",
    description:
      "Recognizes employees who worked overtime; sent to their managers.",
    category: "Attendance",
  },
  {
    key: "attendance_escalation",
    label: "Attendance Exception Escalation",
    description:
      "Escalates attendance exceptions through configured tiers to managers/HR.",
    category: "Attendance",
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
