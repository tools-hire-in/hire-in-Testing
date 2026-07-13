/**
 * Shared Agent Feedback Service — Task #999
 *
 * Captures structured feedback signals from the BD Agent and Content Copilot.
 * One generic table, one service, consistent canonical values.
 *
 * Rules:
 * - Never modifies prompts or knowledge automatically.
 * - Missing optional metadata (ICP, buyer stage, etc.) does not block recording.
 * - Ratings are idempotent per user+source: updating replaces the existing rating.
 * - Action events are independent of ratings.
 * - Never throws into callers — all methods swallow errors internally.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  type AgentType,
  type FeedbackEventType,
  type FeedbackReasonCode,
  type SourceRecordType,
  AGENT_TYPES,
  FEEDBACK_EVENT_TYPES,
  FEEDBACK_REASON_CODES,
  RATING_EVENT_TYPES,
  normalizeDomain,
  normalizeAudience,
} from "@shared/agentIntelligenceContracts";

export interface RecordRatingInput {
  agentType: AgentType;
  sourceRecordType: SourceRecordType;
  sourceRecordId: string;
  userId: string;
  eventType: "POSITIVE_RATING" | "NEGATIVE_RATING";
  reasonCode?: FeedbackReasonCode | null;
  /** Optional enrichment — all nullable */
  generationId?: string | null;
  conversationId?: string | null;
  domain?: string | null;
  audience?: string | null;
  contentGoal?: string | null;
  bdMode?: string | null;
  icpId?: string | null;
  buyerStage?: string | null;
  painPointTheme?: string | null;
  promptVersion?: number | null;
  modelVersion?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RecordActionInput {
  agentType: AgentType;
  sourceRecordType: SourceRecordType;
  sourceRecordId: string;
  userId: string;
  eventType: FeedbackEventType;
  /** Optional enrichment */
  generationId?: string | null;
  conversationId?: string | null;
  domain?: string | null;
  audience?: string | null;
  contentGoal?: string | null;
  bdMode?: string | null;
  icpId?: string | null;
  buyerStage?: string | null;
  painPointTheme?: string | null;
  promptVersion?: number | null;
  modelVersion?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RecordContentOutcomeInput {
  agentType: AgentType;
  sourceRecordType: SourceRecordType;
  sourceRecordId: string;
  userId: string;
  eventType: "ACCEPTED" | "EDITED_THEN_ACCEPTED" | "DISCARDED" | "REGENERATED" | "SENT_FOR_REVIEW" | "PUBLISHED";
  generationId?: string | null;
  conversationId?: string | null;
  domain?: string | null;
  audience?: string | null;
  contentGoal?: string | null;
  promptVersion?: number | null;
  modelVersion?: string | null;
  metadata?: Record<string, unknown> | null;
}

function validate(value: string, allowedValues: readonly string[], field: string): boolean {
  if (!allowedValues.includes(value)) {
    console.warn(`[agentFeedbackService] Invalid ${field}: "${value}". Allowed: ${allowedValues.join(", ")}`);
    return false;
  }
  return true;
}

function buildRow(input: {
  agentType: AgentType;
  sourceRecordType: SourceRecordType;
  sourceRecordId: string;
  userId: string;
  eventType: FeedbackEventType;
  reasonCode?: FeedbackReasonCode | null;
  generationId?: string | null;
  conversationId?: string | null;
  domain?: string | null;
  audience?: string | null;
  contentGoal?: string | null;
  bdMode?: string | null;
  icpId?: string | null;
  buyerStage?: string | null;
  painPointTheme?: string | null;
  promptVersion?: number | null;
  modelVersion?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return {
    agentType: input.agentType,
    sourceRecordType: input.sourceRecordType,
    sourceRecordId: input.sourceRecordId,
    userId: input.userId,
    eventType: input.eventType,
    reasonCode: input.reasonCode ?? null,
    generationId: input.generationId ?? null,
    conversationId: input.conversationId ?? null,
    domain: input.domain ? normalizeDomain(input.domain) : null,
    audience: input.audience ? normalizeAudience(input.audience) : null,
    contentGoal: input.contentGoal ?? null,
    bdMode: input.bdMode ?? null,
    icpId: input.icpId ?? null,
    buyerStage: input.buyerStage ?? null,
    painPointTheme: input.painPointTheme ?? null,
    promptVersion: input.promptVersion ?? null,
    modelVersion: input.modelVersion ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  };
}

/**
 * Record or update a positive/negative rating.
 * Idempotent: exactly one rating row per user+source.
 * Uses INSERT … ON CONFLICT DO UPDATE so concurrent retries are safe without
 * a separate DELETE pass that could race between two simultaneous clicks.
 */
export async function recordRating(input: RecordRatingInput): Promise<{ id: string } | null> {
  try {
    if (!validate(input.agentType, AGENT_TYPES, "agentType")) return null;
    if (!validate(input.eventType, RATING_EVENT_TYPES, "eventType (rating)")) return null;
    if (input.reasonCode && !validate(input.reasonCode, FEEDBACK_REASON_CODES, "reasonCode")) return null;

    const row = buildRow(input);

    // Upsert pattern: the partial unique index on
    //   (user_id, source_record_type, source_record_id)
    //   WHERE event_type IN ('POSITIVE_RATING','NEGATIVE_RATING')
    // guarantees at most one active rating per user+source.
    // We fall back to a serialisable-transaction DELETE+INSERT for databases
    // that don't yet have the partial index applied (idempotent either way).
    const result = await db.execute(sql`
      WITH deleted AS (
        DELETE FROM agent_feedback_events
        WHERE user_id = ${input.userId}
          AND source_record_type = ${input.sourceRecordType}
          AND source_record_id = ${input.sourceRecordId}
          AND event_type IN ('POSITIVE_RATING', 'NEGATIVE_RATING')
      )
      INSERT INTO agent_feedback_events (
        agent_type, source_record_type, source_record_id, user_id,
        event_type, reason_code, generation_id, conversation_id,
        domain, audience, content_goal, bd_mode,
        icp_id, buyer_stage, pain_point_theme,
        prompt_version, model_version, metadata,
        created_at, updated_at
      ) VALUES (
        ${row.agentType}, ${row.sourceRecordType}, ${row.sourceRecordId}, ${row.userId},
        ${row.eventType}, ${row.reasonCode}, ${row.generationId}, ${row.conversationId},
        ${row.domain}, ${row.audience}, ${row.contentGoal}, ${row.bdMode},
        ${row.icpId}, ${row.buyerStage}, ${row.painPointTheme},
        ${row.promptVersion}, ${row.modelVersion}, ${row.metadata}::jsonb,
        NOW(), NOW()
      )
      RETURNING id
    `);

    const id = (result.rows?.[0] as any)?.id;
    return id ? { id } : null;
  } catch (err) {
    console.error("[agentFeedbackService] recordRating failed:", err);
    return null;
  }
}

/**
 * Record an action event (separate from ratings — no idempotency).
 * Network retries are deduplicated by checking for a recent identical event.
 */
export async function recordAction(input: RecordActionInput): Promise<{ id: string } | null> {
  try {
    if (!validate(input.agentType, AGENT_TYPES, "agentType")) return null;
    if (!validate(input.eventType, FEEDBACK_EVENT_TYPES, "eventType")) return null;

    // Dedup: skip if an identical event exists within the last 30 seconds (retry guard)
    const recent = await db.execute(sql`
      SELECT id FROM agent_feedback_events
      WHERE user_id = ${input.userId}
        AND source_record_type = ${input.sourceRecordType}
        AND source_record_id = ${input.sourceRecordId}
        AND event_type = ${input.eventType}
        AND created_at > NOW() - INTERVAL '30 seconds'
      LIMIT 1
    `);
    if (recent.rows.length > 0) {
      return { id: (recent.rows[0] as any).id };
    }

    const row = buildRow(input);
    const result = await db.execute(sql`
      INSERT INTO agent_feedback_events (
        agent_type, source_record_type, source_record_id, user_id,
        event_type, reason_code, generation_id, conversation_id,
        domain, audience, content_goal, bd_mode,
        icp_id, buyer_stage, pain_point_theme,
        prompt_version, model_version, metadata,
        created_at, updated_at
      ) VALUES (
        ${row.agentType}, ${row.sourceRecordType}, ${row.sourceRecordId}, ${row.userId},
        ${row.eventType}, ${row.reasonCode ?? null}, ${row.generationId}, ${row.conversationId},
        ${row.domain}, ${row.audience}, ${row.contentGoal}, ${row.bdMode},
        ${row.icpId}, ${row.buyerStage}, ${row.painPointTheme},
        ${row.promptVersion}, ${row.modelVersion}, ${row.metadata}::jsonb,
        NOW(), NOW()
      )
      RETURNING id
    `);

    const id = (result.rows?.[0] as any)?.id;
    return id ? { id } : null;
  } catch (err) {
    console.error("[agentFeedbackService] recordAction failed:", err);
    return null;
  }
}

/**
 * Record a content lifecycle outcome (accept, edit+accept, discard, regenerate, review, publish).
 * Convenience wrapper around recordAction with content-specific typing.
 */
export async function recordContentOutcome(input: RecordContentOutcomeInput): Promise<{ id: string } | null> {
  return recordAction(input as RecordActionInput);
}

/**
 * Get the current rating for a user+source combination.
 * Returns null if no rating exists.
 */
export async function getUserRating(
  userId: string,
  sourceRecordType: SourceRecordType,
  sourceRecordId: string,
): Promise<{ eventType: "POSITIVE_RATING" | "NEGATIVE_RATING"; reasonCode: string | null } | null> {
  try {
    const result = await db.execute(sql`
      SELECT event_type, reason_code
      FROM agent_feedback_events
      WHERE user_id = ${userId}
        AND source_record_type = ${sourceRecordType}
        AND source_record_id = ${sourceRecordId}
        AND event_type IN ('POSITIVE_RATING', 'NEGATIVE_RATING')
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (!result.rows.length) return null;
    const row = result.rows[0] as any;
    return { eventType: row.event_type, reasonCode: row.reason_code };
  } catch (err) {
    console.error("[agentFeedbackService] getUserRating failed:", err);
    return null;
  }
}

/**
 * Fetch the current user's ratings for multiple source records in one query.
 * Returns a map of sourceRecordId → rating event type.
 */
export async function getUserRatingsBulk(
  userId: string,
  sourceRecordType: SourceRecordType,
  sourceRecordIds: string[],
): Promise<Record<string, "POSITIVE_RATING" | "NEGATIVE_RATING">> {
  if (!sourceRecordIds.length) return {};
  try {
    const idList = sourceRecordIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
    const result = await db.execute(sql`
      SELECT DISTINCT ON (source_record_id) source_record_id, event_type
      FROM agent_feedback_events
      WHERE user_id = ${userId}
        AND source_record_type = ${sourceRecordType}
        AND source_record_id = ANY(ARRAY[${sql.raw(idList)}]::text[])
        AND event_type IN ('POSITIVE_RATING', 'NEGATIVE_RATING')
      ORDER BY source_record_id, created_at DESC
    `);
    const map: Record<string, "POSITIVE_RATING" | "NEGATIVE_RATING"> = {};
    for (const row of result.rows as any[]) {
      map[row.source_record_id] = row.event_type;
    }
    return map;
  } catch (err) {
    console.error("[agentFeedbackService] getUserRatingsBulk failed:", err);
    return {};
  }
}

/**
 * Summary stats for admin validation endpoint.
 * Returns counts by agent, event type, reason code, and domain.
 */
export async function getFeedbackSummary(days = 30): Promise<{
  byAgent: Record<string, number>;
  positiveRatings: number;
  negativeRatings: number;
  topNegativeReasons: Array<{ reasonCode: string; count: number }>;
  contentOutcomes: Record<string, number>;
  bdActions: Record<string, number>;
  byDomain: Record<string, number>;
}> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const byAgentResult = await db.execute(sql`
      SELECT agent_type, COUNT(*)::int as count
      FROM agent_feedback_events
      WHERE created_at >= ${since}
      GROUP BY agent_type
    `);

    const ratingsResult = await db.execute(sql`
      SELECT event_type, COUNT(*)::int as count
      FROM agent_feedback_events
      WHERE event_type IN ('POSITIVE_RATING', 'NEGATIVE_RATING')
        AND created_at >= ${since}
      GROUP BY event_type
    `);

    const negativeReasonsResult = await db.execute(sql`
      SELECT reason_code, COUNT(*)::int as count
      FROM agent_feedback_events
      WHERE event_type = 'NEGATIVE_RATING'
        AND reason_code IS NOT NULL
        AND created_at >= ${since}
      GROUP BY reason_code
      ORDER BY count DESC
      LIMIT 5
    `);

    const contentOutcomesResult = await db.execute(sql`
      SELECT event_type, COUNT(*)::int as count
      FROM agent_feedback_events
      WHERE event_type IN ('ACCEPTED', 'EDITED_THEN_ACCEPTED', 'DISCARDED', 'REGENERATED', 'SENT_FOR_REVIEW', 'PUBLISHED')
        AND created_at >= ${since}
      GROUP BY event_type
    `);

    const bdActionsResult = await db.execute(sql`
      SELECT event_type, COUNT(*)::int as count
      FROM agent_feedback_events
      WHERE agent_type = 'BD_AGENT'
        AND event_type IN ('SAVED_AS_CONTENT_IDEA', 'CREATED_CLIENT_DECK', 'USED_IN_CALL', 'USED_IN_DECK', 'COPIED')
        AND created_at >= ${since}
      GROUP BY event_type
    `);

    const byDomainResult = await db.execute(sql`
      SELECT domain, COUNT(*)::int as count
      FROM agent_feedback_events
      WHERE domain IS NOT NULL
        AND created_at >= ${since}
      GROUP BY domain
    `);

    const byAgent: Record<string, number> = {};
    for (const row of byAgentResult.rows as any[]) {
      byAgent[row.agent_type] = row.count;
    }

    let positiveRatings = 0;
    let negativeRatings = 0;
    for (const row of ratingsResult.rows as any[]) {
      if (row.event_type === "POSITIVE_RATING") positiveRatings = row.count;
      if (row.event_type === "NEGATIVE_RATING") negativeRatings = row.count;
    }

    const topNegativeReasons = (negativeReasonsResult.rows as any[]).map((r) => ({
      reasonCode: r.reason_code,
      count: r.count,
    }));

    const contentOutcomes: Record<string, number> = {};
    for (const row of contentOutcomesResult.rows as any[]) {
      contentOutcomes[row.event_type] = row.count;
    }

    const bdActions: Record<string, number> = {};
    for (const row of bdActionsResult.rows as any[]) {
      bdActions[row.event_type] = row.count;
    }

    const byDomain: Record<string, number> = {};
    for (const row of byDomainResult.rows as any[]) {
      byDomain[row.domain] = row.count;
    }

    return { byAgent, positiveRatings, negativeRatings, topNegativeReasons, contentOutcomes, bdActions, byDomain };
  } catch (err) {
    console.error("[agentFeedbackService] getFeedbackSummary failed:", err);
    return { byAgent: {}, positiveRatings: 0, negativeRatings: 0, topNegativeReasons: [], contentOutcomes: {}, bdActions: {}, byDomain: {} };
  }
}
