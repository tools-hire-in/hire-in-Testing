---
name: SOP ↔ performance-goal KPI linkage
description: How performance goals link to SOPs and why linkage resolves via sopMasterId across versions.
---

Performance goals carry a nullable `linked_sop_id` FK (onDelete set null) pointing at a **specific SOP version row** (sop_documents.id), chosen at link time.

**Why version-aware roll-up:** SOPs version by cloning a new sop_documents row that shares `sopMasterId` (the stable identity holding the SOP code). A goal linked to v1 must still surface under the current version. So any read that groups goals by "the SOP" must resolve the full set of version ids for the sopMasterId (or map version-id→sopMasterId) and aggregate across them — never match on a single version id.

**How to apply:**
- "KPIs Tracked" on SOP detail (`GET /api/sops/:id/goals`): resolve all version ids via getSopVersionHistory(sopMasterId), then query goals where linkedSopId IN those ids.
- MBR export + role scorecard: build a version-id→sopMasterId map and bucket goals by master.
- Prefill: linking a SOP in the goal form pre-fills the goal description from the SOP's `kpi_description` only when description is empty (never clobbers user text).

**Analytics page gotcha:** `/api/performance/analytics` endpoint does NOT exist — Analytics.tsx renders its empty state. Any new analytics card (e.g. SOP role scorecard) must be a self-contained component with its own query rendered OUTSIDE the `analytics ?` conditional, or it will never show.
