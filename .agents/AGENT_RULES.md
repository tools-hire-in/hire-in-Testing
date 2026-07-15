# Agent Rules — Standing Rulebook

> **Every agent reads this file in full before writing a single line of code.**
> If a rule links to a memory topic file, open and read that file before proceeding with work that touches the relevant area.

---

## 0 — Read This First

- Read this file fully before writing a single line of code.
- Read any memory topic files linked from a relevant rule before assuming you know the answer.
- When this file conflicts with an older memory topic file, this file wins. Update the topic file.

---

## 0.1 — Keep the Rulebook Current (Standing Obligation)

- Whenever a new architectural decision, pattern, feature spec, or working guide is discussed and agreed upon with the developer, **immediately update both `replit.md` and `.agents/AGENT_RULES.md`** to reflect it — in the same task, before closing the PR.
- `replit.md` is the project-facing record (architecture, features, design choices). `.agents/AGENT_RULES.md` is the agent-facing rulebook (what to do, what never to do).
- If only one of the two is relevant to the new information, update that one. If both are relevant, update both. Never leave a verbal agreement undocumented.
- This applies to every agent, every task, every time — it is not optional and does not require a separate task to action.

---

## 1 — Scope & Assumptions (NO Hallucination, Creep, or Guessing)

- Build exactly what the task says — nothing more, nothing less.
- If a requirement is ambiguous, stop and ask. Do not invent a plausible interpretation and proceed.
- Never add "nice to have" extras, refactor unrelated code, or rename things not mentioned in the plan.
- Never assume an API, field, table, or function exists — verify by reading the file or running a search first.

---

## 2 — Preservation (Don't Break Existing Things)

- Before changing any file, read it. Understand what it does and who calls it.
- When adding a new feature, run a search to find all consumers of the code you are changing. Touch only what the task requires.
- After implementation, mentally walk through every existing user flow that could be affected and verify it still works.
- If a change could break an unrelated flow, flag it explicitly in the PR description and ask for guidance rather than proceeding silently.

---

## 3 — Deletion Requires Explicit Approval

- Never delete a file, table, column, route, component, or exported symbol without explicitly listing what you plan to delete and waiting for developer approval.
- This applies even if the item appears unused — it may be consumed by a task currently in-progress in another agent's branch.
- Soft-deletes and feature flags are preferred over hard removal where practical.

---

## 4 — Centralization, Modularization & Reuse

- Before creating a new utility, hook, component, or helper, search the codebase. If one already exists that does 80%+ of the job, extend it rather than duplicating.
- Shared types live in `shared/schema.ts` or `shared/` — never redeclare them in a route file or component.
- Business logic goes in a service/engine layer (e.g. `server/payrollEngine.ts`), not inline in a route handler.
- UI components that appear in more than one place must be factored into `client/src/components/` before the second usage lands.
- Avoid "god files" — if a file exceeds ~400 lines and contains unrelated concerns, split it. But only split what the task actually touches.

---

## 5 — Database Rules

- `shared/schema.ts` is the single source of truth for every column and table. A column that exists in an ensure-block but not in `schema.ts` will be deleted by `db:push`. (→ [`schema-db-drift-guard.md`](memory/schema-db-drift-guard.md))
- Reuse and extend existing tables where the data logically belongs there. Do not create a new table when an extra column or a join table would suffice.
- Do not overload a single table with unrelated concerns — if adding a column makes the table's purpose ambiguous, a new table is correct.
- Never run `drizzle-kit push` interactively — it requires a TTY and blocks in CI. Apply new tables/columns via a `scripts/*.ts` raw SQL script using `db.execute`. (→ [`drizzle-push-tty.md`](memory/drizzle-push-tty.md))
- Never resolve a drizzle "is created or renamed?" prompt as a rename — it is data-destructive. Always choose "create new". (→ [`schema-db-drift-guard.md`](memory/schema-db-drift-guard.md))
- The drift guard (`scripts/check-schema-drift.sh`) must pass before any production release.

---

## 6 — Backend Rules (Replit-Specific)

- The dev server has no watch mode — backend route/logic changes require a workflow restart before they take effect. (→ [`dev-server-no-watch.md`](memory/dev-server-no-watch.md))
- Boot order is fixed: open the HTTP port first, then do DB ensure/seed work. Never `await` DB setup before `listen()`. (→ [`boot-stability.md`](memory/boot-stability.md))
- Every new feature flag needs three registration points: `ALLOWED_FLAGS` in `routes.ts`, `flagDefs` in `HRSettings.tsx`, and `FLAG_DEFAULTS` seed in `index.ts`. Missing any one means the flag is silently OFF forever. (→ [`feature-flag-three-place-rule.md`](memory/feature-flag-three-place-rule.md))
- `tsc` is not a build gate — the repo has pre-existing type errors. The build uses tsx/esbuild. Verify correctness via runtime tests, not clean `tsc`. (→ [`tsc-not-a-build-gate.md`](memory/tsc-not-a-build-gate.md))

---

## 7 — Frontend Rules

- `App.tsx` has duplicate route blocks (studio and legacy). New routes must be added to both blocks via `replace_all` or the page 404s in one context. (→ [`app-tsx-duplicate-route-blocks.md`](memory/app-tsx-duplicate-route-blocks.md))
- Use `useQuery` with the object form only (TanStack Query v5): `useQuery({ queryKey: [...] })`.
- Mutations must invalidate the relevant query cache immediately after success.
- Do not import React explicitly — the Vite JSX transformer handles it.
- Use `import.meta.env.VITE_*` for env vars on the frontend, never `process.env`.

---

## 8 — Testing

- Server tests use `node:test`. Run with `npx tsx --test`, not vitest. (→ [`test-runner-node-test.md`](memory/test-runner-node-test.md))
- After any change, manually walk through the affected user flows in the browser. Do not rely on TypeScript alone.

---

## 9 — Secrets & Integrations

- Never hardcode secrets, tokens, or API keys. Use the `environment-secrets` skill to read/set them.
- Before adding a new third-party integration, check whether a Replit integration already exists for that service.
- Installed integrations for this project: Replit DB, Replit Auth, Object Storage, SendGrid, OpenAI. Do not reinstall these.

---

## 10 — Comms & Handoff

- If something in the plan is contradictory, technically impossible, or riskier than it appears, say so before starting — not after building the wrong thing.
- List every file you modified in the PR/commit description.
- If you had to deviate from the plan for a good technical reason, explain the deviation explicitly.
