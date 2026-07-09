---
name: Executive read-only role
description: How the executive role was added and key pitfalls encountered.
---

# Executive read-only role

## Rule
When adding a new Postgres enum value to `user_role`, do NOT rely on `npm run db:push` alone — it stalls on any unrelated interactive prompt (e.g. unique-constraint confirmation). Apply the enum directly with `ALTER TYPE user_role ADD VALUE 'executive'` via a Node.js script or psql.

**Why:** `drizzle-kit push` is interactive; if any other pending schema diff exists (even a benign unique constraint), the TTY prompt blocks the whole run and can't be piped through.

**How to apply:** 
```js
pool.query("ALTER TYPE user_role ADD VALUE 'executive'")
```
Run this once, then db:push handles the rest of the diff.

## AdminLayout is a NAMED export
`AdminLayout` in `client/src/components/admin/AdminLayout.tsx` is exported as `export function AdminLayout`, not `export default`. Always import it as:
```ts
import { AdminLayout } from "@/components/admin/AdminLayout";
```

## Access registry pattern for read-only roles
Add the new role only to GET/read registry keys. Never add to `*.patch`, `*.post`, `*.delete`, `*.approve`, `*.generate`, `*.sendReminder`, `*.initialize`, `*.toggleRequired`, `*.adjust`, `*.bulkAdjust` keys.

## Simplified creation flow
Creating an executive skips Department/Shift requirements (create-user endpoint gates those checks on role !== executive), sends NO credentials email, skips Rayo provisioning, and returns a one-time `credentials` object in the 201 response shown once in a dialog. The password works as-is — there is no forced-change flow anywhere in the app. Track auto-assignment still runs (policy/all-roles tracks get assigned); it tolerates null dept/shift.

## readOnly prop threading
Components (`DocumentComplianceContent`, `PolicyComplianceContent`) accept `{ readOnly?: boolean }` — pass `readOnly` down to child rows to hide write-action buttons.
