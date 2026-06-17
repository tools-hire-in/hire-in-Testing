---
name: Dev server has no backend watch
description: The dev script runs plain tsx (not tsx watch); backend changes need a manual workflow restart
---

The `dev` script runs `tsx server/index.ts` (plain, NOT `tsx watch`). The frontend
hot-reloads via Vite HMR, but **backend changes (server/*.ts) do NOT auto-restart**.

**Symptom:** after editing `server/routes.ts` / `server/storage.ts`, new API routes
return the SPA `index.html` (200) instead of JSON — Express never registered them, so
the request falls through to Vite's catch-all.

**How to apply:** restart the `Start application` workflow (via restart_workflow tool)
after any backend change, then re-test endpoints with curl. Don't trust HMR for server code.
