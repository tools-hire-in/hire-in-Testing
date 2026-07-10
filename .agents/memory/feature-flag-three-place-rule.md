---
name: Feature flag three-place rule
description: Every new feature flag requires changes in THREE places or it silently stays OFF and never appears in the admin UI.
---

# Feature Flag Three-Place Rule

## The Rule
Adding a new feature flag requires **three synchronized changes**. Missing any one causes a silent failure:

1. **Backend allowlist** — `ALLOWED_FLAGS` array in `server/routes.ts` (line ~14129).  
   Gate: the PATCH endpoint ignores any key not in this list, so writes silently do nothing.

2. **Frontend toggle UI** — `flagDefs` array in `client/src/pages/admin/hr/HRSettings.tsx` `FeatureFlagsSection` (line ~585).  
   Gate: if the flag isn't here, there's no toggle in the admin panel — the flag is permanently stuck at whatever value it was seeded with (or `undefined` = false).

3. **Server startup seed** — `FLAG_DEFAULTS` block in `server/index.ts` after the "App announcement" ensure block (line ~3427).  
   Gate: if the flag isn't seeded, it defaults to `undefined` (falsy) in a fresh or migrated environment — even if the code reads it correctly.  
   Implementation: uses `defaults::jsonb || existing` merge so **admin overrides always win** (existing DB values take precedence over defaults).

**Why:** The `feature_flags` key in `system_settings` stores a JSONB blob. New flags are absent from the blob unless explicitly seeded — absent keys evaluate to `undefined`/falsy in JS. Task agents build the code that READS the flag but often skip updating the UI and seed, leaving the flag dark forever.

## How to Apply
Whenever a task agent adds a feature flag:
- Check routes.ts ALLOWED_FLAGS — is the new key there?
- Check HRSettings.tsx flagDefs — is there a toggle label + description?
- Check the FLAG_DEFAULTS block in server/index.ts — is the default value set?

If any of the three is missing, add it. Do NOT use `storage.getSystemSetting` inside `runStartupTasks` — that function doesn't have `storage` in scope. Use `db.execute(sql\`...\`)` directly.

## Current Flag Registry (as of 2026-07-10)
All seven flags live in all three places:
- `notifications_enabled` (default: true)
- `document_reminder_email_enabled` (default: false)
- `esign_docusign_flow` (default: true)
- `new_look` (default: true)
- `probation_framework_db` (default: true)
- `process_governance` (default: true)
- `studio_v2_enabled` (default: true)
