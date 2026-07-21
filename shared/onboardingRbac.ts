/**
 * RBAC Audit — Onboarding Flow
 * -----------------------------------------------------------------------
 * Maps each portal role to the set of routes that role can actually reach,
 * derived from client/src/App.tsx (route declarations) and
 * shared/accessControl.ts (permission guards).
 *
 * Purpose: seed and content tasks use this map to verify that every
 * `navRoute` field seeded into `onboarding_steps` is genuinely reachable
 * by the target track's primary role.
 *
 * Maintenance: keep in sync with App.tsx route list. When a route is added
 * or removed, update the relevant role entry here.
 */

export type OnboardingTrack = "employee" | "manager" | "hr" | "executive" | "admin";

/**
 * Routes accessible to each role.
 * Entries are canonical portal paths (no query params, no dynamic segments).
 * A role inherits all routes below its hierarchy level (employee ⊂ manager ⊂ hr ⊂ admin).
 * Routes are listed exactly as they appear in App.tsx / the portal sidebar.
 */
export const ONBOARDING_ROLE_ROUTES: Record<OnboardingTrack, string[]> = {
  employee: [
    "/admin/my-desk",
    "/admin/my-desk?tab=time-card",
    "/admin/my-desk?tab=leave-balance",
    "/admin/my-desk?tab=apply-leave",
    "/admin/my-desk?tab=leave-history",
    "/admin/my-desk?tab=accrual",
    "/admin/my-desk?tab=leave-calendar",
    "/admin/my-desk?tab=regularizations",
    "/admin/my-desk?tab=payslips",
    "/admin/profile",
    "/admin/growth",
    "/admin/salary-advance",
    "/admin/hr/my-documents",
    "/admin/hr/my-training",
    "/admin/notifications",
    "/admin/help-desk",
    "/admin/policy-gate",
    "/admin/governance",
  ],
  manager: [
    // inherits all employee routes
    "/admin/my-desk",
    "/admin/my-desk?tab=time-card",
    "/admin/my-desk?tab=leave-balance",
    "/admin/my-desk?tab=apply-leave",
    "/admin/my-desk?tab=leave-history",
    "/admin/my-desk?tab=accrual",
    "/admin/my-desk?tab=leave-calendar",
    "/admin/my-desk?tab=regularizations",
    "/admin/my-desk?tab=payslips",
    "/admin/profile",
    "/admin/growth",
    "/admin/salary-advance",
    "/admin/hr/my-documents",
    "/admin/hr/my-training",
    "/admin/notifications",
    "/admin/help-desk",
    "/admin/policy-gate",
    "/admin/governance",
    // manager-specific
    "/admin/hr/my-team",
    "/admin/hr/leave-approvals",
    "/admin/new-hire",
    "/admin/hr/team-attendance",
    "/admin/recruitment",
    "/admin/sops",
    "/admin/sops/compliance",
    "/admin/sops/my-reviews",
    // performance module routes (visible when performance_management flag is ON)
    "/admin/performance/goals",
    "/admin/performance/check-ins",
    "/admin/performance/reviews",
    "/admin/performance/feedback",
    "/admin/performance/cycles",
    "/admin/performance/analytics",
    // command card reference page
    "/admin/command-card",
  ],
  hr: [
    // inherits manager routes
    "/admin/my-desk",
    "/admin/my-desk?tab=time-card",
    "/admin/my-desk?tab=leave-balance",
    "/admin/my-desk?tab=apply-leave",
    "/admin/my-desk?tab=leave-history",
    "/admin/my-desk?tab=accrual",
    "/admin/my-desk?tab=leave-calendar",
    "/admin/my-desk?tab=regularizations",
    "/admin/my-desk?tab=payslips",
    "/admin/profile",
    "/admin/growth",
    "/admin/salary-advance",
    "/admin/hr/my-documents",
    "/admin/hr/my-training",
    "/admin/notifications",
    "/admin/help-desk",
    "/admin/policy-gate",
    "/admin/governance",
    "/admin/hr/my-team",
    "/admin/hr/leave-approvals",
    "/admin/new-hire",
    "/admin/hr/team-attendance",
    "/admin/recruitment",
    "/admin/sops",
    "/admin/sops/compliance",
    "/admin/sops/my-reviews",
    // hr-specific
    "/admin/hr/people",
    "/admin/hr/tools",
    "/admin/hr/reports",
    "/admin/hr/org-chart",
    "/admin/settings/feature-flags",
    "/admin/settings/users",
    "/admin/settings/departments",
    "/admin/settings/leave-types",
    "/admin/settings/holidays",
    "/admin/payroll/run",
    "/admin/payroll/setup",
    "/admin/training/catalog",
    "/admin/communications",
    "/admin/finance",
    "/admin/control-tower",
  ],
  executive: [
    "/admin/executive-cockpit",
    "/admin/my-desk",
    "/admin/my-desk?tab=time-card",
    "/admin/my-desk?tab=leave-balance",
    "/admin/my-desk?tab=apply-leave",
    "/admin/my-desk?tab=leave-history",
    "/admin/my-desk?tab=accrual",
    "/admin/my-desk?tab=leave-calendar",
    "/admin/my-desk?tab=regularizations",
    "/admin/my-desk?tab=payslips",
    "/admin/profile",
    "/admin/growth",
    "/admin/salary-advance",
    "/admin/notifications",
    "/admin/help-desk",
    "/admin/policy-gate",
    "/admin/governance",
    "/admin/payroll/run",
    "/admin/payroll/executive",
    "/admin/payroll/setup",
    "/admin/control-tower",
  ],
  admin: [
    // admin sees everything hr sees plus admin-only paths
    "/admin/my-desk",
    "/admin/profile",
    "/admin/growth",
    "/admin/hr/my-team",
    "/admin/hr/leave-approvals",
    "/admin/hr/people",
    "/admin/hr/tools",
    "/admin/hr/reports",
    "/admin/hr/org-chart",
    "/admin/hr/team-attendance",
    "/admin/new-hire",
    "/admin/recruitment",
    "/admin/settings/feature-flags",
    "/admin/settings/users",
    "/admin/settings/departments",
    "/admin/settings/leave-types",
    "/admin/settings/holidays",
    "/admin/salary-advance",
    "/admin/payroll/run",
    "/admin/payroll/setup",
    "/admin/sops",
    "/admin/sops/compliance",
    "/admin/training/catalog",
    "/admin/communications",
    "/admin/finance",
    "/admin/control-tower",
    "/admin/governance",
    "/admin/vault",
    "/admin/notifications",
    "/admin/help-desk",
    "/admin/policy-gate",
  ],
};

/**
 * Verify that a navRoute is reachable by a given track's primary role.
 * Used by the seed validator and content tasks.
 */
export function isRouteReachableByTrack(
  navRoute: string | null | undefined,
  track: OnboardingTrack,
): boolean {
  if (!navRoute) return true;
  const base = navRoute.split("?")[0];
  return ONBOARDING_ROLE_ROUTES[track].some((r) => r.split("?")[0] === base);
}
