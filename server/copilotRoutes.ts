/**
 * Goal Copilot Routes (Task #1116)
 *
 * POST /api/ceo/copilot/message — streaming SSE chat endpoint (super_admin only)
 * POST /api/ceo/copilot/create-goal — create structured goal from copilot proposal
 * GET  /api/ceo/goals — list active company goals with progress
 * GET  /api/ceo/copilot/history — recent conversation turns for this user
 * POST /api/ceo/copilot/actions — create a tracked next action
 * GET  /api/ceo/copilot/actions — list open next actions for this user
 * PATCH /api/ceo/copilot/actions/:id/complete — mark action complete
 */

import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  classifyIntent,
  buildContextForIntent,
  buildSystemPrompt,
} from "./goalCopilotContextService";
import { buildCeoReportData } from "./governanceService";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function requireSuperAdmin(req: Request, res: Response): string | null {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (req.session.role !== "super_admin") {
    res.status(403).json({ error: "CEO Copilot is only available to super_admin" });
    return null;
  }
  return req.session.userId;
}

// ── Goal proposal parser ──────────────────────────────────────────────────────

interface ParsedGoalProposal {
  title: string;
  owner: string | null;
  target: string | null;
  timeline: string | null;
  milestones: string[];
  subGoals: string[];
  financialTarget: string | null;
}

function parseGoalProposal(text: string): ParsedGoalProposal | null {
  const match = text.match(/\[GOAL_PROPOSAL\]([\s\S]*?)\[\/GOAL_PROPOSAL\]/);
  if (!match) return null;
  const block = match[1];
  const get = (key: string) => {
    const m = block.match(new RegExp(`${key}:\\s*(.+)`, "i"));
    return m ? m[1].trim() : null;
  };
  const title = get("Title");
  if (!title) return null;
  const milestonesRaw = get("Milestones");
  const subGoalsRaw = get("Sub-goals");
  return {
    title,
    owner: get("Owner"),
    target: get("Target"),
    timeline: get("Timeline"),
    milestones: milestonesRaw ? milestonesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    subGoals: subGoalsRaw && subGoalsRaw !== "if any" ? subGoalsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    financialTarget: get("Financial target"),
  };
}

export function registerCopilotRoutes(app: Express): void {

  // ── Streaming message endpoint ──────────────────────────────────────────────
  app.post("/api/ceo/copilot/message", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    const { message, conversationHistory = [] } = req.body as {
      message: string;
      conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!message?.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    // Classify intent and build context
    const intent = classifyIntent(message);
    let context;
    try {
      context = await buildContextForIntent(intent, userId);
    } catch (err) {
      console.error("[copilot] context build error:", err);
      context = { intent, quarter: "current quarter", quarterStart: "", quarterEnd: "", today: new Date().toISOString().slice(0, 10) };
    }

    // Inject CEO exception report into system prompt (best-effort)
    let ceoExceptionContext = "";
    try {
      const ceoReport = await buildCeoReportData();
      if (ceoReport && typeof ceoReport === "object") {
        const cats = (ceoReport as any).exceptionCategories ?? [];
        if (cats.length > 0) {
          const lines = cats
            .slice(0, 8)
            .map((c: any) => `• ${c.title ?? c.category ?? "Unknown"}: ${c.count ?? 0} item(s)`)
            .join("\n");
          ceoExceptionContext = `\n\n## System Exceptions (Governance)\n${lines}`;
        }
      }
    } catch {
      // non-blocking
    }

    const systemPrompt = buildSystemPrompt(context as any) + ceoExceptionContext;

    // Build message history (cap at 20 turns)
    const historyMessages = conversationHistory.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let fullResponse = "";

    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-5.4",
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: message },
        ],
        stream: true,
        max_completion_tokens: 1024,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      // Check if response contains a goal proposal
      const proposal = parseGoalProposal(fullResponse);
      if (proposal) {
        res.write(`data: ${JSON.stringify({ goalProposal: proposal })}\n\n`);
      }

      // Save conversation turns
      try {
        const contextSnap = JSON.stringify(context).slice(0, 8000); // cap size
        await db.execute(sql`
          INSERT INTO copilot_conversations (user_id, role, content, intent_detected, context_snapshot_json)
          VALUES (${userId}, 'user', ${message}, ${intent}, null)
        `);
        await db.execute(sql`
          INSERT INTO copilot_conversations (user_id, role, content, intent_detected, context_snapshot_json)
          VALUES (${userId}, 'assistant', ${fullResponse}, ${intent}, ${contextSnap}::jsonb)
        `);
      } catch (saveErr) {
        console.error("[copilot] failed to save conversation turns:", saveErr);
      }

      res.write(`data: ${JSON.stringify({ done: true, intent })}\n\n`);
      res.end();
    } catch (err: any) {
      console.error("[copilot] streaming error:", err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to stream response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to generate response" });
      }
    }
  });

  // ── Create goal endpoint ────────────────────────────────────────────────────
  app.post("/api/ceo/copilot/create-goal", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    const { title, description, milestones = [], subGoals = [], financialTarget, targetDate } = req.body as {
      title: string;
      description?: string;
      milestones?: string[];
      subGoals?: string[];
      financialTarget?: string;
      targetDate?: string;
    };

    if (!title?.trim()) {
      return res.status(400).json({ error: "title is required" });
    }

    let goalId: string | null = null;
    try {
      await db.transaction(async (tx) => {
        // 1. Create the company goal
        const goalResult = await tx.execute(sql`
          INSERT INTO performance_goals
            (employee_id, manager_id, title, description, category, status, progress,
             auto_progress_from_milestones, start_date, target_date)
          VALUES
            (${userId}, ${userId}, ${title.trim()}, ${description ?? null},
             'company', 'not_started', 0, true,
             CURRENT_DATE::text, ${targetDate ?? null})
          RETURNING id
        `);
        goalId = (goalResult.rows[0] as any).id;

        // 2. Create milestones
        for (let i = 0; i < milestones.length; i++) {
          await tx.execute(sql`
            INSERT INTO goal_milestones (goal_id, title, sort_order)
            VALUES (${goalId}, ${milestones[i]}, ${i})
          `);
        }

        // 3. Create sub-goals as child performance_goals
        for (const sg of subGoals) {
          if (!sg.trim()) continue;
          await tx.execute(sql`
            INSERT INTO performance_goals
              (employee_id, manager_id, title, category, status, progress,
               parent_goal_id, start_date, target_date)
            VALUES
              (${userId}, ${userId}, ${sg.trim()}, 'company', 'not_started', 0,
               ${goalId}, CURRENT_DATE::text, ${targetDate ?? null})
          `);
        }

        // 4. Create financial target if provided
        if (financialTarget && financialTarget.trim() && financialTarget !== "if applicable") {
          const now = new Date();
          const quarter = `Q${Math.floor(now.getMonth() / 3) + 1}`;
          const year = now.getFullYear();
          await tx.execute(sql`
            INSERT INTO company_financial_targets
              (goal_id, label, quarter, year, target_amount, currency, created_by)
            VALUES
              (${goalId}, ${financialTarget.trim()}, ${quarter}, ${year}, null, 'INR', ${userId})
          `);
        }
      });

      // 5. Log governance event (non-fatal, outside transaction)
      try {
        await db.execute(sql`
          INSERT INTO governance_events (type, reference_id, actor_id, description)
          VALUES ('goal_created', ${goalId}, ${userId}, ${`CEO Copilot created company goal: ${title.trim()}`})
        `);
      } catch (_) { /* non-fatal */ }

      res.json({ goalId, success: true });
    } catch (err: any) {
      console.error("[copilot] create-goal error:", err);
      res.status(500).json({ error: err.message || "Failed to create goal" });
    }
  });

  // ── List company goals ──────────────────────────────────────────────────────
  app.get("/api/ceo/goals", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    try {
      const rows = await db.execute(sql`
        SELECT
          pg.id, pg.title, pg.description, pg.progress, pg.status,
          pg.start_date, pg.target_date, pg.created_at,
          COALESCE(
            (SELECT COUNT(*) FROM goal_milestones gm WHERE gm.goal_id = pg.id),
            0
          )::int AS milestone_count,
          COALESCE(
            (SELECT COUNT(*) FROM goal_milestones gm WHERE gm.goal_id = pg.id AND gm.done = true),
            0
          )::int AS milestones_done,
          cft.label AS financial_label,
          cft.target_amount, cft.actual_amount, cft.currency
        FROM performance_goals pg
        LEFT JOIN company_financial_targets cft ON cft.goal_id = pg.id
        WHERE pg.category = 'company'
          AND pg.parent_goal_id IS NULL
          AND pg.status NOT IN ('cancelled')
        ORDER BY pg.created_at DESC
        LIMIT 20
      `);

      res.json(rows.rows);
    } catch (err: any) {
      console.error("[copilot] list goals error:", err);
      res.status(500).json({ error: "Failed to fetch goals" });
    }
  });

  // ── Conversation history ────────────────────────────────────────────────────
  app.get("/api/ceo/copilot/history", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    try {
      const rows = await db.execute(sql`
        SELECT id, role, content, intent_detected, created_at
        FROM copilot_conversations
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 50
      `);
      // Return in chronological order
      res.json((rows.rows as any[]).reverse());
    } catch (err: any) {
      console.error("[copilot] history error:", err);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  // ── Next actions ────────────────────────────────────────────────────────────
  app.post("/api/ceo/copilot/actions", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    const { title, description, goalId, dueDate } = req.body as {
      title: string;
      description?: string;
      goalId?: string;
      dueDate?: string;
    };

    if (!title?.trim()) return res.status(400).json({ error: "title is required" });

    try {
      const result = await db.execute(sql`
        INSERT INTO company_goal_actions (goal_id, title, description, assigned_to, due_date, created_by)
        VALUES (${goalId ?? null}, ${title.trim()}, ${description ?? null}, ${userId}, ${dueDate ?? null}, ${userId})
        RETURNING id
      `);
      res.json({ id: (result.rows[0] as any).id, success: true });
    } catch (err: any) {
      console.error("[copilot] create action error:", err);
      res.status(500).json({ error: "Failed to create action" });
    }
  });

  app.get("/api/ceo/copilot/actions", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    try {
      const rows = await db.execute(sql`
        SELECT cga.id, cga.title, cga.description, cga.due_date::text, cga.completed_at,
               pg.title AS goal_title, pg.id AS goal_id
        FROM company_goal_actions cga
        LEFT JOIN performance_goals pg ON pg.id = cga.goal_id
        WHERE cga.assigned_to = ${userId} AND cga.completed_at IS NULL
        ORDER BY cga.due_date ASC NULLS LAST
      `);
      res.json(rows.rows);
    } catch (err: any) {
      console.error("[copilot] list actions error:", err);
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });

  app.patch("/api/ceo/copilot/actions/:id/complete", async (req: Request, res: Response) => {
    const userId = requireSuperAdmin(req, res);
    if (!userId) return;

    try {
      await db.execute(sql`
        UPDATE company_goal_actions
        SET completed_at = NOW(), updated_at = NOW()
        WHERE id = ${req.params.id} AND assigned_to = ${userId}
      `);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[copilot] complete action error:", err);
      res.status(500).json({ error: "Failed to complete action" });
    }
  });
}
