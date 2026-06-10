---
name: Replit env store model
description: How viewEnvVars secrets vs envVars relate — critical for safely moving keys to Secrets.
---

# Replit Env Store Model

The `viewEnvVars` tool returns two fields: `envVars` (plaintext, environment-scoped) and `secrets` (boolean).

## Key insight
`secrets: { KEY: true }` does NOT mean a separate encrypted secret exists. It reflects that the key is **available at runtime** in the current environment context. If a key is in `envVars.shared`, it shows `secrets: true`. If it is only in `envVars.production` (and you're in dev context), it shows `secrets: false`.

**Why:** Confirmed empirically — deleting a shared env var that showed `secrets: true` caused `secrets` to immediately flip to `false`. No separate encrypted store existed.

## Safe flow to move a key to Secrets
1. Call `requestEnvVar({ requestType: "secret", keys: [...] })` FIRST — user pastes the value into encrypted Secrets. Wait for confirmation.
2. Only THEN call `deleteEnvVars` to remove the plaintext shared env var.
3. Restart workflow and verify `process.env.KEY` is still present (`!!v && v.length > 0`).

**Why order matters:** If you delete first and there is no separate encrypted secret, the app loses the value until the user acts.

## Conflict rule
`setEnvVars` cannot set secrets. Secrets are set only via `requestEnvVar` (user-initiated). Variables cannot exist in both "shared" and a specific environment simultaneously — but Secrets (encrypted) are separate from env vars and can coexist.
