---
name: HIRD needs_info (Returned / Needs Info) flow
description: How the Service Desk return-for-info / respond loop preserves and restores ticket state.
---

The Service Desk (HIRD, real routes `/api/help-desk/*`) has a `needs_info` status in `internalRequestStatusEnum` between `in_progress` and `resolved`.

**State restoration:** When a ticket is returned (`POST /:id/return-for-info`), the audit entry uses `action: "returned_for_info"` and stores `metadata.priorStatus` (+ `commentId`). When the requester replies (`POST /:id/respond`, requester-only, status must be `needs_info`), the endpoint reads the *latest* `returned_for_info` audit entry's `metadata.priorStatus` (default `in_progress`) to decide where to send the ticket back. Respond audit action is `responded_to_info`.

**Why:** there is no separate column for "where it came from" — the prior active state lives only in audit metadata. Any code that returns/responds must keep these two action strings and the metadata in lockstep, and the client reads the same `returned_for_info` action + `metadata.commentId` to surface the "Action Needed" comment.

**How to apply:** the client status badge for needs_info is rose (`bg-rose-100 text-rose-700`) across HelpDeskTicket / HelpDesk / ServiceDesk / RequestsTab. Email events `needs_info` and `responded` live in `sendHelpDeskEmail`. Enum value was added via direct `ALTER TYPE ... ADD VALUE` because db:push wants to drop unrelated drifted columns.
