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

export function resolveSettingsRedirect(search: string): string {
  let tab: string | null = null;
  try {
    tab = new URLSearchParams(search).get("tab");
  } catch {}
  if (!tab) return DEFAULT_SETTINGS_PATH;
  const resolved = LEGACY_SETTINGS_TAB_ALIASES[tab] ?? tab;
  const group = SETTINGS_TAB_TO_GROUP[resolved];
  if (group) return `/admin/settings/${group}?tab=${resolved}`;
  return DEFAULT_SETTINGS_PATH;
}
