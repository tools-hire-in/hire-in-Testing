---
name: Company profile data model
description: How company identity (UEI/CAGE/NAICS/SAM/addresses) is stored and consumed across the app
---

The company's government-contracting identity (legal name, UEI, CAGE, NAICS codes, SAM status, certifications, addresses, phones, emails) is stored as ONE `company_profile` entry in the `system_settings` table, not as a dedicated table.

- Schema/defaults/helpers live in `shared/companyProfile.ts` (`companyProfileSchema`, `DEFAULT_COMPANY_PROFILE`, `mergeCompanyProfile`, `formatCompanyAddress`).
- Public read: `GET /api/company-profile` always returns DB value merged over defaults (so partial DB rows still render). Admin write: `PATCH /api/company-profile` gated to super_admin/admin with Zod validation.
- Frontend reads via `useCompanyProfile()` hook (placeholderData = DEFAULT, staleTime 60s). Display sites: deck slides, About (Gov Contracting section), WhyHireIn, StaffingFAQ.

**Why:** values like UEI/CAGE were previously hardcoded literals scattered across many files, drifting out of sync. Merge-over-defaults means an empty DB still renders correct values.

**How to apply:** when showing company identity, read from `useCompanyProfile()` — do NOT add new hardcoded UEI/CAGE literals. Note the legacy `client/src/constants.ts` COMPANY/CONTACT constants still feed ~20 other files and duplicate some values; reconcile carefully (separate follow-up exists).
