/**
 * Studio T3 (Task #908) — canonical notification type registry.
 *
 * Source of truth for the Notification Centre grouping and the per-type
 * preference UI. Preferences are stored per *preference key* — several raw
 * notification `type` strings (e.g. every `training_*` variant) collapse into
 * one preference key so users manage a small, meaningful list.
 *
 * Default is always ON: no preference row = both channels enabled.
 */

export type NotificationCategory = "studio" | "hr" | "payroll" | "performance" | "system";

export const NOTIFICATION_CATEGORIES: { value: NotificationCategory; label: string }[] = [
  { value: "studio", label: "Content Studio" },
  { value: "hr", label: "HR & Attendance" },
  { value: "payroll", label: "Payroll & Salary" },
  { value: "performance", label: "Performance & Training" },
  { value: "system", label: "System" },
];

export interface NotificationTypeDef {
  /** Preference key stored in notification_preferences.notification_type. */
  key: string;
  label: string;
  description: string;
  category: NotificationCategory;
  /**
   * Prefixes of raw notification `type` strings that map to this key.
   * Matched with startsWith(), longest prefix wins.
   */
  typePrefixes: string[];
}

export const NOTIFICATION_TYPES: NotificationTypeDef[] = [
  // ── Studio ────────────────────────────────────────────────────────────────
  {
    key: "studio_pipeline",
    label: "Content pipeline",
    description: "Idea assignments, comments, due-date reminders and promotions.",
    category: "studio",
    typePrefixes: ["studio_idea_"],
  },
  {
    key: "studio_review",
    label: "Reviews & approvals",
    description: "Review requests, review decisions, sign-offs and publish events.",
    category: "studio",
    typePrefixes: [
      "studio_review",
      "studio_cm_review",
      "studio_final",
      "studio_marketing",
      "studio_author",
      "studio_published",
    ],
  },
  {
    key: "studio_campaigns",
    label: "Campaigns",
    description: "Contributor additions, AI plan proposals and campaign status changes.",
    category: "studio",
    typePrefixes: ["studio_campaign_"],
  },
  {
    key: "studio_digest",
    label: "Weekly Studio digest",
    description: "Monday morning summary of pending approvals, overdue ideas and deadlines.",
    category: "studio",
    typePrefixes: ["studio_weekly_digest"],
  },
  {
    key: "studio_regen",
    label: "Regeneration requests",
    description: "Article regeneration request approvals, rejections, and unlock notifications.",
    category: "studio",
    typePrefixes: ["studio_regen_"],
  },
  // ── HR ───────────────────────────────────────────────────────────────────
  {
    key: "hr_leave",
    label: "Leave & balances",
    description: "Leave accruals, year-end processing and balance warnings.",
    category: "hr",
    typePrefixes: ["leave_"],
  },
  {
    key: "hr_attendance",
    label: "Attendance",
    description: "Attendance escalations and punch corrections.",
    category: "hr",
    typePrefixes: ["attendance_"],
  },
  {
    key: "hr_requests",
    label: "Requests & approvals (HIRD)",
    description: "Internal request submissions, approvals and rejections.",
    category: "hr",
    typePrefixes: ["hird_"],
  },
  {
    key: "hr_documents",
    label: "Documents & letters",
    description: "Document reminders, offer letters and HR letters.",
    category: "hr",
    typePrefixes: ["document_", "offer_letter_", "hr_letter_"],
  },
  {
    key: "hr_onboarding",
    label: "Onboarding",
    description: "Onboarding checklist reminders for new hires.",
    category: "hr",
    typePrefixes: ["onboarding_"],
  },
  // ── Payroll ───────────────────────────────────────────────────────────────
  {
    key: "payroll_advance",
    label: "Salary advances",
    description: "Advance requests, approvals and recovery updates.",
    category: "payroll",
    typePrefixes: ["salary_advance"],
  },
  // ── Performance & Training ────────────────────────────────────────────────
  {
    key: "performance_training",
    label: "Training",
    description: "Training assignments, requests, extensions and compliance.",
    category: "performance",
    typePrefixes: ["training_", "compliance_"],
  },
  {
    key: "performance_sop",
    label: "SOPs",
    description: "SOP review assignments, audit findings, and training assignments.",
    category: "performance",
    // sop_training_assigned / sop_finding_assigned / sop_review_* / sop_audit_* / sop_access_*
    typePrefixes: ["sop_training", "sop_finding", "sop_review", "sop_audit", "sop_access"],
  },
  {
    key: "sop_compliance_checkins",
    label: "SOP compliance check-ins",
    description: "Scheduled SOP compliance reminders (Day 7 early nudge, Day 15 deadline alert, Day 30 reinforcement) for employees and managers.",
    category: "performance",
    // Employee: sop_early_nudge (Day 7), sop_deadline_reminder (Day 15), sop_reinforcement (Day 30)
    // Manager:  sop_deadline_reminder_manager, sop_reinforcement_manager (Days 15 & 30 only)
    typePrefixes: ["sop_early_nudge", "sop_deadline_reminder", "sop_reinforcement"],
  },
  {
    key: "sop_compliance_nudge",
    label: "SOP compliance reminders",
    description: "Scheduled SOP compliance check-in nudges at Day 7, Day 15, and Day 30 after assignment.",
    category: "performance",
    typePrefixes: ["sop_early_nudge", "sop_deadline_reminder", "sop_reinforcement"],
  },
  {
    key: "performance_plans",
    label: "Growth & probation plans",
    description: "Plan milestones, overdue reminders and escalations.",
    category: "performance",
    typePrefixes: ["pip_", "probation_", "growth_"],
  },
  {
    key: "performance_goals",
    label: "Performance goals",
    description: "Goal overdue nudges, manager escalations and skip-level escalations.",
    category: "performance",
    typePrefixes: ["goal_"],
  },
  {
    key: "governance_escalation",
    label: "Governance escalations",
    description: "Governance control overdue alerts, escalations and compliance digest notifications.",
    category: "performance",
    typePrefixes: [
      "governance_overdue",
      "governance_escalated",
      "governance_",
      "checkin_overdue_digest",
      "compliance_digest",
      "sop_manager_escalation",
      "sop_overdue_contextual",
      "compliance_manager_alert",
    ],
  },
  {
    key: "performance_checkin_reminders",
    label: "Check-in reminders",
    description: "Contextual check-in reminders with goal progress summaries.",
    category: "performance",
    typePrefixes: ["checkin_reminder_contextual"],
  },
  {
    key: "performance_coaching_prompts",
    label: "Coaching prompts",
    description: "Contextual PIP/plan coaching entry prompts for managers.",
    category: "performance",
    typePrefixes: ["pip_coaching_prompt_contextual"],
  },
  // ── Recruitment ───────────────────────────────────────────────────────────
  {
    key: "recruiter_activity",
    label: "Recruiter activity nudges",
    description: "End-of-day reminders to log your call and screen counts.",
    category: "hr",
    typePrefixes: ["recruiter_activity_"],
  },
  {
    key: "ceipal_compliance",
    label: "Ceipal update reminders",
    description: "Morning reminders about unresolved Ceipal update commitments, and manager alerts for missed updates.",
    category: "hr",
    typePrefixes: ["ceipal_morning_reminder", "ceipal_manager_alert", "ceipal_"],
  },
  // ── Manager Inbox ─────────────────────────────────────────────────────────
  {
    key: "hr_action_required",
    label: "Manager inbox escalations",
    description: "Notifications when an inbox item is escalated to you or approaches the 48-hour deferral cap.",
    category: "hr",
    typePrefixes: ["hr_action_required"],
  },
  // ── Recognition Certificates ─────────────────────────────────────────────
  {
    key: "recognition_certificates",
    label: "Recognition certificates",
    description: "Notifications when a verified recognition certificate is issued, returned, or rejected.",
    category: "hr",
    typePrefixes: ["recognition_certificate_", "recognition_issued", "recognition_returned", "recognition_rejected", "recognition_"],
  },
  // ── System ────────────────────────────────────────────────────────────────
  {
    key: "system_general",
    label: "System announcements",
    description: "Release notes and general system messages.",
    category: "system",
    typePrefixes: ["release_notes", "system"],
  },
];

/**
 * Map a raw notification `type` string to its preference key.
 * Longest matching prefix wins; unknown types fall back to "system_general"
 * so every notification is always governed by exactly one preference.
 */
export function preferenceKeyForType(rawType: string): string {
  let best: { key: string; len: number } | null = null;
  for (const def of NOTIFICATION_TYPES) {
    for (const prefix of def.typePrefixes) {
      if (rawType.startsWith(prefix) && (!best || prefix.length > best.len)) {
        best = { key: def.key, len: prefix.length };
      }
    }
  }
  return best?.key ?? "system_general";
}

/** Category for a raw notification `type` string (Centre grouping). */
export function categoryForType(rawType: string): NotificationCategory {
  const key = preferenceKeyForType(rawType);
  return NOTIFICATION_TYPES.find((d) => d.key === key)?.category ?? "system";
}

export const VALID_PREFERENCE_KEYS = new Set(NOTIFICATION_TYPES.map((d) => d.key));
