export type SettingsGroupKey =
  | "leave-attendance"
  | "people-access"
  | "company"
  | "features"
  | "system";

export const DEFAULT_SETTINGS_PATH = "/admin/settings/leave-attendance";

export const SETTINGS_TAB_TO_GROUP: Record<string, SettingsGroupKey> = {
  "leave-types": "leave-attendance",
  holidays: "leave-attendance",
  "attendance-policy": "leave-attendance",
  shifts: "leave-attendance",
  "salary-advance-policy": "leave-attendance",
  departments: "people-access",
  "access-control": "people-access",
  "company-profile": "company",
  "feature-flags": "features",
  training: "features",
  "rayo-academy": "features",
  "data-maintenance": "system",
};

const LEGACY_SETTINGS_TAB_ALIASES: Record<string, string> = {
  attendance: "attendance-policy",
};

// Tabs that have been relocated out of Settings to another page. Old deep-links
// should land on their new home rather than the Settings default.
export const RELOCATED_SETTINGS_TABS: Record<string, string> = {
  "balance-adjustments": "/admin/hr/people?tab=balance-adjustments",
  "letter-templates": "/admin/hr/tools?tab=templates",
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
