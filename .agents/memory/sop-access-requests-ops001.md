---
name: SOP tool-access requests (OPS-001)
description: How employee tool-access self-requests link to SOP OPS-001 and feed governance/scorecard KPIs.
---

Employees self-request tool access post-training by reusing the existing HIRD Service Desk "Access" request type — no new request table. The linkage to SOP OPS-001 is a nullable `linked_sop_id` FK on `internal_requests` (references `sop_documents.id`, onDelete set null).

**Why:** OPS-001 required tagging access requests to the SOP without a parallel request system; reusing HIRD keeps the approval/audit flow intact.

**How to apply:**
- `linked_sop_id` is only set when `type === "access"` (helpDeskRoutes create route); else null.
- Client sends the OPS-001 current-version doc id (`MySopAssignment.sopId`). The access-requests endpoint must resolve OPS-001 tagging by matching `linked_sop_id ∈ {all version ids for that sopMasterId}`, not a single id.
- KPI endpoint `/api/sops/ops001/access-kpis` shape: `{access:{total,approved,rejected,pending,granted,approvalBeforeAccessPct}, deprovisioning:{exited,accessRemoved,completionPct}, byRole:[{role,raised,approved,requesters}]}`. Approved statuses = [assigned,in_progress,needs_info,resolved,closed]; granted = [resolved,closed]; deprovisioning from admin_users.employmentStatus in [relieved,left_company] & !deletedAt, accessRemoved = !isActive.
- Both `/api/sops/ops001/access-kpis` and `/api/sops/:id/access-requests` are gated by requirePermission("sops.view", ...) + resolveSopAccess; governance dashboard (SOPCompliance) is further scoped to GOVERNANCE_ROLES (super_admin/admin/hr/operations) — employees get 401, which is expected.
