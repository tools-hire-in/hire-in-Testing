export type SettingsGroupKey =
  | "leave-attendance"
  | "organization"
  | "payroll"
  | "onboarding";

export const DEFAULT_SETTINGS_PATH = "/admin/settings/leave-attendance";

export const SETTINGS_TAB_TO_GROUP: Record<string, SettingsGroupKey> = {
  "leave-types": "leave-attendance",
  holidays: "leave-attendance",
  "attendance-policy": "leave-attendance",
  shifts: "leave-attendance",
  "salary-advance-policy": "leave-attendance",
  departments: "organization",
  "company-profile": "organization",
  "salary-structures": "payroll",
  "state-registrations": "payroll",
  coverage: "payroll",
  "onboarding-steps": "onboarding",
};

const LEGACY_SETTINGS_TAB_ALIASES: Record<string, string> = {
  attendance: "attendance-policy",
};

// Tabs that have been relocated out of Settings to another page. Old deep-links
// should land on their new home rather than the Settings default.
export const RELOCATED_SETTINGS_TABS: Record<string, string> = {
  "balance-adjustments": "/admin/hr/people?tab=balance-adjustments",
  "letter-templates": "/admin/hr/tools?tab=templates",
  "whats-new": "/admin/communications?tab=whats-new",
  "release-notes": "/admin/communications?tab=release-notes",
  // Super-admin governance + maintenance now live only in Control Tower.
  "feature-flags": "/admin/control-tower?tab=feature-flags",
  "access-control": "/admin/control-tower?tab=access-control",
  "data-maintenance": "/admin/control-tower?tab=data-maintenance",
  // Training module on/off toggle folded into Feature Flags (Control Tower).
  training: "/admin/control-tower?tab=feature-flags",
  // Training-specific + performance config now live in My Growth.
  "rayo-academy": "/admin/growth?tab=training-mgmt",
  performance: "/admin/growth?tab=settings",
  "goal-templates": "/admin/growth?tab=settings",
};

// Returns the new home for a relocated Settings tab, or null if not relocated.
// Used both by the legacy /admin/settings redirect and by the grouped
// HRSettings page (where a stale ?tab= would otherwise silently fall back).
export function relocatedSettingsTabTarget(tab: string | null | undefined): string | null {
  if (!tab) return null;
  return RELOCATED_SETTINGS_TABS[tab] ?? null;
}

export function resolveSettingsRedirect(search: string): string {
  let tab: string | null = null;
  try {
    tab = new URLSearchParams(search).get("tab");
  } catch {}
  if (!tab) return DEFAULT_SETTINGS_PATH;
  const relocated = relocatedSettingsTabTarget(tab);
  if (relocated) return relocated;
  const resolved = LEGACY_SETTINGS_TAB_ALIASES[tab] ?? tab;
  const group = SETTINGS_TAB_TO_GROUP[resolved];
  if (group) return `/admin/settings/${group}?tab=${resolved}`;
  return DEFAULT_SETTINGS_PATH;
}
