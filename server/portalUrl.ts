/**
 * Resolves the canonical base URL for the employee/admin portal used in outbound
 * email deep-links. Order of preference:
 *   1. APP_URL          — explicit override when set
 *   2. REPLIT_DEV_DOMAIN — so links work while developing on Replit
 *   3. BASE_URL         — the production portal domain (e.g. employee.hire-in.com)
 *   4. hard-coded portal fallback
 *
 * NOTE: the marketing site (hire-in.com) is NOT the portal — never fall back to it
 * for in-app deep links or reviewers land on a page that cannot open the report.
 */
export function getPortalBaseUrl(): string {
  const raw =
    process.env.APP_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "") ||
    process.env.BASE_URL ||
    "https://employee.hire-in.com";
  return raw.replace(/\/+$/, "");
}

/** Deep-link path that opens the manager attendance approval screen. */
export const ATTENDANCE_APPROVAL_PATH = "/admin/hr/my-team?tab=attendance-approval";

/** Full deep-link URL to the manager attendance approval screen. */
export function attendanceApprovalUrl(): string {
  return `${getPortalBaseUrl()}${ATTENDANCE_APPROVAL_PATH}`;
}
