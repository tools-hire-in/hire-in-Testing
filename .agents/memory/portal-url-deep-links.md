---
name: Portal URL for email deep-links
description: Why outbound email links must use the portal domain, never the marketing site
---

# Portal URL for email deep-links

Outbound transactional emails that deep-link into the admin/employee portal MUST
resolve their base URL via `server/portalUrl.ts` (`getPortalBaseUrl()` /
`attendanceApprovalUrl()`), never the old `process.env.APP_URL || "https://hire-in.com"`
fallback.

**Why:** `hire-in.com` is the marketing site, not the portal. APP_URL is unset in
this project, so the fallback sent reviewers to a page that cannot open the report.
The real portal is `BASE_URL` (prod: employee.hire-in.com) / `REPLIT_DEV_DOMAIN` (dev).

**How to apply:** resolution order is APP_URL → REPLIT_DEV_DOMAIN → BASE_URL →
hard fallback. Also: protected client pages that bounce unauthenticated users to
`/admin/login` must pass `?next=<encoded path+search>` and Login.tsx must honor a
safe same-origin `next` (single leading "/", reject "//"), or the deep-link tab
param is lost through login and the user lands on the default dashboard.
