---
name: e-sign foundation architecture
description: How the central signature ledger + signing service + reusable SignatureBlock fit together; rules for adding a new sign-off.
---

# Central e-sign foundation

A unified e-signature layer backs every formal acceptance flow (offer letters,
addendums, HR letters, contracts, policy signing).

## The three pillars
- **Ledger**: one polymorphic `signature_records` table (document_type/document_id +
  refNumber/authCode/contentHash + signer/ip/userAgent + sectionInitials/metadata).
  Created via an idempotent ensure block in `server/index.ts` (auto-migrations are
  DISABLED, so the table only appears after a **server restart** — HMR won't run it).
- **Service**: `server/documentSigningService.ts` — `recordSignature()` (non-fatal
  ledger write, wrapped in try/catch at every call-site so signing never breaks),
  `signPolicyAcknowledgement()`, and `verifyDocument()` covering all 7 types.
- **Frontend atom**: `client/src/components/esign/SignatureBlock.tsx`.

## Back-compat rule (CRITICAL)
hr_letter & contract hashing/verify JSON must stay byte-identical — never re-hash or
re-sign already-signed records. New doc types get new branches; old ones untouched.

## SignatureBlock contract
The block owns ONLY consent + typed-name state and exposes the trimmed name via
`onSubmit({ acceptedName })`. Pages keep their own chrome, success screens, and build
their own exact request payload — this is what preserves identical payloads/behavior.
**Why:** the goal mandates zero visible change; centralizing payload/success-state in
the component would have forced divergent flows to converge and altered output.
**How to apply:** a new sign-off = add a verifyDocument branch + a recordSignature
call at the new call-site + drop in `<SignatureBlock>` with the right props. Only
typed signatures are supported today (no drawn-signature pad yet).
