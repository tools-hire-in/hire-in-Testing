export type TowerTab =
  | "overview"
  | "communications"
  | "automated-changes"
  | "feature-flags"
  | "access-control"
  | "audit-logs"
  | "data-maintenance"
  | "system-settings"
  | "user-management"
  | "security"
  | "governance";

export const SUPER_ADMIN_TOWER_TABS: TowerTab[] = [
  "overview",
  "communications",
  "automated-changes",
  "feature-flags",
  "access-control",
  "audit-logs",
  "data-maintenance",
  "user-management",
  "security",
  "governance",
];

export const ADMIN_TOWER_TABS: TowerTab[] = ["governance"];

export const HR_TOWER_TABS: TowerTab[] = ["data-maintenance", "governance"];

export function allowedTowerTabs(role?: string | null): TowerTab[] {
  if (role === "super_admin") return SUPER_ADMIN_TOWER_TABS;
  if (role === "admin") return ADMIN_TOWER_TABS;
  if (role === "hr") return HR_TOWER_TABS;
  return [];
}

export function canAccessControlTower(role?: string | null): boolean {
  return allowedTowerTabs(role).length > 0;
}

export function towerLegacyTabRedirect(tabParam?: string | null): string | null {
  if (tabParam === "system-settings") return "/admin/settings";
  return null;
}
