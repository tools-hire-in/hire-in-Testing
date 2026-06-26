export type PeopleHrTab =
  | "users"
  | "balance-adjustments"
  | "salary"
  | "compliance"
  | "policy"
  | "audit"
  | "training"
  | "regularizations"
  | "plans"
  | "exceptions"
  | "risk-summary";

type TabGate = "all" | "hr" | "admin";

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
  { value: "compliance", label: "Document Compliance", testId: "tab-compliance", gate: "hr" },
  { value: "policy", label: "Policy Compliance", testId: "tab-policy", gate: "hr" },
  { value: "audit", label: "Audit Logs", testId: "tab-audit", gate: "admin" },
  { value: "training", label: "Training Mgmt", testId: "tab-training-mgmt", gate: "all" },
  { value: "regularizations", label: "Regularizations", testId: "tab-regularizations", gate: "all" },
  { value: "plans", label: "Plans Overview", testId: "tab-plans", gate: "hr" },
  { value: "exceptions", label: "Att. Exceptions", testId: "tab-exceptions", gate: "hr" },
  { value: "risk-summary", label: "Risk Summary", testId: "tab-risk-summary", gate: "hr" },
];

const ALL_TAB_VALUES = PEOPLE_HR_TAB_DEFS.map((t) => t.value);

const DEFAULT_TAB: PeopleHrTab = "users";

// Legacy ?tab= aliases from the old nested-tab layout.
export const PEOPLE_HR_LEGACY_TAB_ALIASES: Record<string, PeopleHrTab> = {
  reports: "salary",
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

// Final resolution once the role is known: the deep-linked tab if it is
// visible for the role, otherwise the default tab.
export function resolvePeopleHrTab(search: string, role: string): PeopleHrTab {
  const parsed = parsePeopleHrTab(search);
  if (parsed && isTabVisibleForRole(parsed, role)) return parsed;
  return DEFAULT_TAB;
}
