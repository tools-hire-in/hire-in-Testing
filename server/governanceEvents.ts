/**
 * Governance Event Recorder
 *
 * Append-only audit trail for governance control transitions.
 * Every significant state change emits one event row.
 *
 * Design rules:
 *   - Never DELETE or UPDATE existing rows — append only.
 *   - Failures are non-fatal (wrapped in catch) so the primary operation
 *     is never blocked by an audit write.
 *   - Source identifies who/what triggered the event:
 *       user      — a real user via an HTTP request
 *       sync      — the daily obligation sync job
 *       scheduler — the escalation sweep or CEO-report cron
 *       api       — an internal service call with no live user session
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export type GovernanceEventType =
  | "created"
  | "assigned"
  | "reassigned"
  | "status_changed"
  | "evidence_submitted"
  | "disputed"
  | "escalated"
  | "closed"
  | "reopened"
  | "exception_recorded"
  | "sync_updated";

export type GovernanceEventSource = "user" | "sync" | "scheduler" | "api";

export interface EmitEventOpts {
  controlId: string;
  eventType: GovernanceEventType;
  actorId?: string | null;
  actorRef?: string | null;
  source: GovernanceEventSource;
  metadata?: Record<string, unknown>;
}

/**
 * Append a governance event row. Non-fatal — the caller should .catch(console.error).
 */
export async function emitGovernanceEvent(opts: EmitEventOpts): Promise<void> {
  const metaJson = opts.metadata ? JSON.stringify(opts.metadata) : null;
  await db.execute(sql`
    INSERT INTO governance_events
      (control_id, event_type, actor_id, actor_ref, source, metadata)
    VALUES
      (${opts.controlId},
       ${opts.eventType}::governance_event_type,
       ${opts.actorId ?? null},
       ${opts.actorRef ?? null},
       ${opts.source}::governance_event_source,
       ${metaJson}::jsonb)
  `);
}

/**
 * Fetch the event history for a single control.
 * Ordered newest first. Caller is responsible for authorization gating
 * before invoking this function.
 */
export async function getControlEventHistory(controlId: string): Promise<{
  id: string;
  eventType: string;
  actorId: string | null;
  actorRef: string | null;
  source: string;
  metadata: unknown;
  createdAt: string;
}[]> {
  const rows = await db.execute(sql`
    SELECT ge.id,
           ge.event_type AS "eventType",
           ge.actor_id   AS "actorId",
           ge.actor_ref  AS "actorRef",
           ge.source,
           ge.metadata,
           ge.created_at::text AS "createdAt"
    FROM governance_events ge
    WHERE ge.control_id = ${controlId}
    ORDER BY ge.created_at DESC
    LIMIT 200
  `);
  return rows.rows as any[];
}
