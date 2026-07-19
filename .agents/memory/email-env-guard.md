---
name: Email non-production env guard
description: How dev/QA email suppression works and why the client factory is the choke point
---
# Email non-production env guard

Rule: ALL email suppression must live in `getUncachableSendGridClient()` — every send path (30+ direct send functions, blast queue delivery, dispatchAutomatedEmail) obtains its client there, making it the single choke point. Scheduler-level env_mode suspension is NOT sufficient: tests and manual triggers call sweep functions directly.

**Why:** Governance tests calling `runGovernanceSyncSweep()` directly fired real SendGrid emails to staff. The old intercept lived only inside `dispatchAutomatedEmail`, and with `dev_dry_run=false` + empty `dev_email_override` it did nothing.

**How to apply:**
- env_mode ≠ production + `dev_email_override` set → redirect wrapper ([ENV] subject prefix, original recipients noted).
- env_mode ≠ production, no override → no-op client, logs `env_suppressed` to communications_log.
- Env-check failure fails CLOSED (suppress) when APP_ENV ≠ production.
- Return shape carries `suppressionReason: "master" | "env"` so callers log `master_suppressed` vs `env_suppressed` correctly.
- Master kill-switch check runs first and takes precedence.
- Governance test teardown must also clean: GovTest notifications sent to REAL users (title/message LIKE '%GovTest%'), pending_email_blasts + blast_delivery_records with @governance.test recipients, and attendance rows for test users (FK blocks admin_users delete).
