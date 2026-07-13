/**
 * Agent Feedback Routes — Task #999
 *
 * POST /api/agent-feedback         — record a rating or action event
 * GET  /api/admin/agent-feedback/summary — admin validation view
 */
import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  AGENT_TYPES,
  FEEDBACK_EVENT_TYPES,
  FEEDBACK_REASON_CODES,
  RATING_EVENT_TYPES,
  type AgentType,
  type FeedbackEventType,
  type FeedbackReasonCode,
  type SourceRecordType,
} from "@shared/agentIntelligenceContracts";
import {
  recordRating,
  recordAction,
  getUserRating,
  getUserRatingsBulk,
  getFeedbackSummary,
} from "./services/agentFeedbackService";
import { db } from "./db";
import { sql } from "drizzle-orm";

const feedbackSchema = z.object({
  agentType: z.enum(AGENT_TYPES as [AgentType, ...AgentType[]]),
  sourceRecordType: z.enum(["bd_message", "studio_generation", "studio_article", "bd_deck"] as [SourceRecordType, ...SourceRecordType[]]),
  sourceRecordId: z.string().min(1),
  eventType: z.enum(FEEDBACK_EVENT_TYPES as [FeedbackEventType, ...FeedbackEventType[]]),
  reasonCode: z.enum(FEEDBACK_REASON_CODES as [FeedbackReasonCode, ...FeedbackReasonCode[]]).nullable().optional(),
  generationId: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  audience: z.string().nullable().optional(),
  contentGoal: z.string().nullable().optional(),
  bdMode: z.string().nullable().optional(),
  icpId: z.string().nullable().optional(),
  buyerStage: z.string().nullable().optional(),
  painPointTheme: z.string().nullable().optional(),
  promptVersion: z.number().int().nullable().optional(),
  modelVersion: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

/**
 * Roles that may interact with Studio content resources.
 * Employee and executive roles are explicitly excluded — they cannot provide
 * feedback on organizational content studio records.
 */
const STUDIO_ROLES = new Set([
  "super_admin", "admin", "hr", "marketing_manager",
  "content_editor", "reviewer", "content_manager",
]);

/**
 * Roles that may interact with BD resources.
 * Includes manager so team leads who use the BD agent can rate responses.
 */
const BD_ROLES = new Set([
  "super_admin", "admin", "hr", "marketing_manager", "content_editor", "operations", "manager",
]);

/**
 * Verify the source record exists AND that the requesting user is authorized to
 * submit feedback for it.
 *
 * - bd_message:          ownership check — the message must belong to a conversation
 *                        owned by this user.
 * - studio_generation,
 *   studio_article:      role-based check — user must have a studio role, AND the
 *                        record must exist (org-wide resources; no per-record ownership).
 * - bd_deck:             role-based check — user must have a BD role, AND the record
 *                        must exist.
 */
async function verifySourceAccess(
  userId: string,
  userRole: string,
  sourceRecordType: SourceRecordType,
  sourceRecordId: string,
): Promise<boolean> {
  try {
    if (sourceRecordType === "bd_message") {
      // Strict ownership: message must belong to a conversation created by this user.
      const result = await db.execute(sql`
        SELECT m.id
        FROM bd_messages m
        JOIN bd_conversations c ON c.id = m.conversation_id
        WHERE m.id = ${sourceRecordId} AND c.user_id = ${userId}
        LIMIT 1
      `);
      return result.rows.length > 0;
    }

    if (sourceRecordType === "studio_generation") {
      // Role gate: only studio staff may feedback on generated drafts.
      if (!STUDIO_ROLES.has(userRole)) return false;
      const result = await db.execute(sql`
        SELECT id FROM studio_generations
        WHERE id = ${sourceRecordId}
        LIMIT 1
      `);
      return result.rows.length > 0;
    }

    if (sourceRecordType === "studio_article") {
      // Role gate: only studio staff may feedback on articles.
      if (!STUDIO_ROLES.has(userRole)) return false;
      const result = await db.execute(sql`
        SELECT id FROM studio_articles
        WHERE id = ${sourceRecordId}
        LIMIT 1
      `);
      return result.rows.length > 0;
    }

    if (sourceRecordType === "bd_deck") {
      // Role gate: only BD-enabled roles may feedback on decks.
      if (!BD_ROLES.has(userRole)) return false;
      const result = await db.execute(sql`
        SELECT id FROM bd_decks
        WHERE id = ${sourceRecordId}
        LIMIT 1
      `);
      return result.rows.length > 0;
    }

    return false;
  } catch {
    return false;
  }
}

export function registerAgentFeedbackRoutes(app: Express) {
  // POST /api/agent-feedback — record a rating or action event
  app.post("/api/agent-feedback", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const userId = req.session.userId!;
    const userRole = req.session.role || "";

    // Verify source record access (ownership + role-based authorization)
    const hasAccess = await verifySourceAccess(userId, userRole, data.sourceRecordType, data.sourceRecordId);
    if (!hasAccess) {
      console.warn(`[agent-feedback] Access check failed for user ${userId} on ${data.sourceRecordType}:${data.sourceRecordId}`);
      return res.status(403).json({ error: "Source record not found or not accessible" });
    }

    const isRating = RATING_EVENT_TYPES.includes(data.eventType as any);

    let result: { id: string } | null;
    if (isRating) {
      result = await recordRating({
        agentType: data.agentType,
        sourceRecordType: data.sourceRecordType,
        sourceRecordId: data.sourceRecordId,
        userId,
        eventType: data.eventType as "POSITIVE_RATING" | "NEGATIVE_RATING",
        reasonCode: data.reasonCode ?? null,
        generationId: data.generationId ?? null,
        conversationId: data.conversationId ?? null,
        domain: data.domain ?? null,
        audience: data.audience ?? null,
        contentGoal: data.contentGoal ?? null,
        bdMode: data.bdMode ?? null,
        icpId: data.icpId ?? null,
        buyerStage: data.buyerStage ?? null,
        painPointTheme: data.painPointTheme ?? null,
        promptVersion: data.promptVersion ?? null,
        modelVersion: data.modelVersion ?? null,
        metadata: data.metadata ?? null,
      });
    } else {
      result = await recordAction({
        agentType: data.agentType,
        sourceRecordType: data.sourceRecordType,
        sourceRecordId: data.sourceRecordId,
        userId,
        eventType: data.eventType,
        generationId: data.generationId ?? null,
        conversationId: data.conversationId ?? null,
        domain: data.domain ?? null,
        audience: data.audience ?? null,
        contentGoal: data.contentGoal ?? null,
        bdMode: data.bdMode ?? null,
        icpId: data.icpId ?? null,
        buyerStage: data.buyerStage ?? null,
        painPointTheme: data.painPointTheme ?? null,
        promptVersion: data.promptVersion ?? null,
        modelVersion: data.modelVersion ?? null,
        metadata: data.metadata ?? null,
      });
    }

    if (!result) {
      return res.status(500).json({ error: "Failed to record feedback" });
    }

    return res.json({ id: result.id, eventType: data.eventType });
  });

  // GET /api/agent-feedback/rating — get current user's rating for a source
  app.get("/api/agent-feedback/rating", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { sourceRecordType, sourceRecordId } = req.query;
    if (!sourceRecordType || !sourceRecordId) {
      return res.status(400).json({ error: "sourceRecordType and sourceRecordId are required" });
    }
    const rating = await getUserRating(
      req.session.userId,
      sourceRecordType as SourceRecordType,
      sourceRecordId as string,
    );
    return res.json(rating ?? { eventType: null, reasonCode: null });
  });

  // GET /api/agent-feedback/ratings/bulk — fetch current user's ratings for multiple source records
  app.get("/api/agent-feedback/ratings/bulk", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { sourceRecordType, sourceRecordIds } = req.query;
    if (!sourceRecordType || !sourceRecordIds) {
      return res.status(400).json({ error: "sourceRecordType and sourceRecordIds are required" });
    }
    const ids = String(sourceRecordIds)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) {
      return res.json({});
    }
    const ratings = await getUserRatingsBulk(
      req.session.userId,
      sourceRecordType as SourceRecordType,
      ids,
    );
    return res.json(ratings);
  });

  // GET /api/admin/agent-feedback/summary — admin validation view
  app.get("/api/admin/agent-feedback/summary", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userRole = req.session.role;
    if (!["super_admin", "admin", "hr"].includes(userRole || "")) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const days = Math.min(Number(req.query.days) || 30, 90);
    const summary = await getFeedbackSummary(days);
    return res.json({ days, ...summary });
  });
}
