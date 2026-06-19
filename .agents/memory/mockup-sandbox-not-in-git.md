---
name: mockup-sandbox scaffold not committed
description: Why the mockup sandbox can appear "empty/broken" and how to recover it
---

The `artifacts/mockup-sandbox/` scaffold (package.json, vite.config.ts, mockupPreviewPlugin.ts, index.html, src/main.tsx, src/index.css, components/ui, etc.) is NOT tracked in git — only `src/.generated/mockup-components.ts` is. So between sessions the sandbox can show up as just `node_modules/` + an empty `src/` (or only `.generated/`), which makes every preview 404.

**Recovery:** `createArtifact({ artifactType: "mockup-sandbox", slug: "mockup-sandbox", previewPath: "/__mockup/", title: "Mockup Sandbox" })` refuses to run when the dir exists ("already exists … remove the existing directory first"). So:
1. `rm -rf artifacts/mockup-sandbox` (plain file delete, not a git command)
2. re-run `createArtifact(...)` — it re-scaffolds and installs
3. `restartWorkflow({ workflowName: "artifacts/mockup-sandbox: Component Preview Server" })`
4. recreate the `src/components/mockups/<group>/` folder (also gone after wipe)

**Why:** the scaffold being untracked means any wipe loses real mockup component files too — graduate approved mockups into the main app promptly rather than relying on them surviving in the sandbox.
