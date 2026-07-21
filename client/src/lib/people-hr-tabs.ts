export type PeopleHrTab =
  | "users"
  | "balance-adjustments"
  | "salary"
  | "salary-approvals"
  | "compliance"
  | "policy"
  | "audit"
  | "escalations"
  | "org-pulse"
  | "onboarding";

type TabGate = "all" | "hr" | "admin" | "superadmin";

export interface PeopleHrTabDef {
  value: PeopleHrTab;
  label: string;
  testId: string;
  gate: TabGate;
}

export const PEOPLE_HR_TAB_DEFS: PeopleHrTabDef[] = [
  { value: "users", label: "User Management", testId: "tab-users", gate: "all" },
  { value: "balance-adjustments", label: "Balance Adjustments", testId: "tab-balance-adjustments", gate: "hr" },
  { value: "salary", label: "Salary Reports", testId: "tab-salary", gate: "hr" },
  { value: "salary-approvals", label: "Salary Approvals", testId: "tab-salary-approvals", gate: "superadmin" },
  { value: "compliance", label: "Document Compliance", testId: "tab-compliance", gate: "hr" },
  { value: "policy", label: "Policy Compliance", testId: "tab-policy", gate: "hr" },
  { value: "audit", label: "Audit Logs", testId: "tab-audit", gate: "admin" },
  { value: "escalations", label: "Attendance Escalations", testId: "tab-escalations", gate: "hr" },
  { value: "onboarding", label: "Onboarding", testId: "tab-onboarding", gate: "hr" },
  { value: "org-pulse", label: "Org Pulse", testId: "tab-org-pulse", gate: "admin" },
];

const ALL_TAB_VALUES = PEOPLE_HR_TAB_DEFS.map((t) => t.value);

const DEFAULT_TAB: PeopleHrTab = "users";

// Legacy ?tab= aliases from the old nested-tab layout.
// `exceptions` and `risk-summary` were merged into the single "escalations" tab.
// `training` and `plans` moved to Growth & Learning (handled via redirect in PeopleHR).
export const PEOPLE_HR_LEGACY_TAB_ALIASES: Record<string, PeopleHrTab> = {
  reports: "salary",
  exceptions: "escalations",
  "risk-summary": "escalations",
};

// Legacy ?tab= values that have moved off the People & HR page entirely and must
// redirect to another route (Growth & Learning). Maps old tab → Growth tab.
export const PEOPLE_HR_RELOCATED_TABS: Record<string, string> = {
  training: "training-mgmt",
  plans: "employee-plans",
};

// Legacy ?tab= values that have moved to a fully different route. Maps the old
// People & HR tab → the absolute destination URL. Regularizations now live in
// My Team → Corrections.
export const PEOPLE_HR_EXTERNAL_REDIRECTS: Record<string, string> = {
  regularizations: "/admin/hr/my-team?tab=corrections",
};

export function isAdminRole(role: string): boolean {
  return role === "super_admin" || role === "admin";
}

export function isHrRole(role: string): boolean {
  return role === "super_admin" || role === "admin" || role === "hr";
}

export function isTabVisibleForRole(tab: PeopleHrTab, role: string): boolean {
  const def = PEOPLE_HR_TAB_DEFS.find((t) => t.value === tab);
  if (!def) return false;
  if (def.gate === "all") return true;
  if (def.gate === "hr") return isHrRole(role);
  if (def.gate === "superadmin") return role === "super_admin";
  return isAdminRole(role);
}

export function visibleTabDefsForRole(role: string): PeopleHrTabDef[] {
  return PEOPLE_HR_TAB_DEFS.filter((t) => isTabVisibleForRole(t.value, role));
}

// Role-independent parse: resolves legacy aliases and returns a structurally
// valid tab, or null when there is no usable ?tab=. This must NOT depend on
// role, so deep-links survive the auth-loading phase before role is known.
export function parsePeopleHrTab(search: string): PeopleHrTab | null {
  try {
    const raw = new URLSearchParams(search).get("tab");
    if (!raw) return null;
    const resolved = (PEOPLE_HR_LEGACY_TAB_ALIASES[raw] ?? raw) as PeopleHrTab;
    if (ALL_TAB_VALUES.includes(resolved)) return resolved;
  } catch {}
  return null;
}

// Returns the Growth tab a relocated People & HR ?tab= should redirect to, or
// null if the current ?tab= is not a relocated one.
export function relocatedGrowthTab(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get("tab");
    if (!raw) return null;
    return PEOPLE_HR_RELOCATED_TABS[raw] ?? null;
  } catch {}
  return null;
}

// Returns the absolute URL a relocated-off-page People & HR ?tab= should
// redirect to (e.g. regularizations → My Team Corrections), or null otherwise.
export function externalRedirectForTab(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get("tab");
    if (!raw) return null;
    return PEOPLE_HR_EXTERNAL_REDIRECTS[raw] ?? null;
  } catch {}
  return null;
}

// Final resolution once the role is known: the deep-linked tab if it is
// visible for the role, otherwise the default tab.
export function resolvePeopleHrTab(search: string, role: string): PeopleHrTab {
  const parsed = parsePeopleHrTab(search);
  if (parsed && isTabVisibleForRole(parsed, role)) return parsed;
  return DEFAULT_TAB;
}
