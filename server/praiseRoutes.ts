import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  praiseBadgeTypes,
  praisePosts,
  praiseReactions,
  praiseComments,
  pinnedPraisePosts,
  adminUsers,
  notifications,
} from "@shared/schema";
import { eq, and, desc, sql, inArray, or, ilike } from "drizzle-orm";
import { sendPraiseEmail } from "./email";

function requireAuth(req: Request, res: Response): string | null {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.session.userId;
}

async function createNotification(userId: string, type: string, title: string, message: string, metadata?: Record<string, unknown>) {
  try {
    await db.insert(notifications).values({ userId, type, title, message, metadata: metadata ?? null });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

export const BADGE_SEED_DATA = [
  { name: "Star Performer", emoji: "⭐", color: "#F59E0B", description: "Exceptional performance and results" },
  { name: "Team Player", emoji: "🤝", color: "#3B82F6", description: "Outstanding collaboration and teamwork" },
  { name: "Innovation", emoji: "💡", color: "#8B5CF6", description: "Creative problem solving and new ideas" },
  { name: "Leadership", emoji: "🎯", color: "#EF4444", description: "Inspiring leadership and direction" },
  { name: "Client Champion", emoji: "🏆", color: "#F97316", description: "Going above and beyond for clients" },
  { name: "Problem Solver", emoji: "🔧", color: "#6B7280", description: "Finding solutions to tough challenges" },
  { name: "Above & Beyond", emoji: "🚀", color: "#EC4899", description: "Exceeding expectations every time" },
  { name: "Mentor", emoji: "📚", color: "#10B981", description: "Nurturing and developing others" },
  { name: "Culture Champion", emoji: "🌟", color: "#F59E0B", description: "Embodying and promoting our values" },
  { name: "Rising Star", emoji: "🌱", color: "#22C55E", description: "Remarkable growth and potential" },
];

export async function seedPraiseBadgeTypes() {
  try {
    for (const badge of BADGE_SEED_DATA) {
      await db.insert(praiseBadgeTypes)
        .values(badge)
        .onConflictDoNothing();
    }
  } catch (err) {
    console.error("Failed to seed praise badge types:", err);
  }
}

export function registerPraiseRoutes(app: Express) {

  // GET /api/praise/badge-types
  app.get("/api/praise/badge-types", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const types = await db.select().from(praiseBadgeTypes).orderBy(praiseBadgeTypes.name);
      res.json(types);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch badge types" });
    }
  });

  // GET /api/praise/users — colleague directory for all authenticated users (safe fields only)
  app.get("/api/praise/users", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const users = await db
        .select({
          id: adminUsers.id,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          email: adminUsers.email,
          role: adminUsers.role,
        })
        .from(adminUsers)
        .where(eq(adminUsers.isActive, true))
        .orderBy(adminUsers.firstName);
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // GET /api/praise/board?page=&badgeTypeId=&search=
  app.get("/api/praise/board", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = 20;
      const offset = (page - 1) * pageSize;
      const badgeTypeId = req.query.badgeTypeId as string | undefined;
      const search = req.query.search as string | undefined;

      // Build conditions
      const conditions: any[] = [];
      if (badgeTypeId) conditions.push(eq(praisePosts.badgeTypeId, badgeTypeId));
      if (search) {
        // Join to users to filter by name — easier to do in raw SQL or use subquery
        // We'll fetch all matching user IDs first
        const term = `%${search}%`;
        const matchingUsers = await db
          .select({ id: adminUsers.id })
          .from(adminUsers)
          .where(
            or(
              ilike(sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`, term),
              ilike(adminUsers.firstName, term),
              ilike(adminUsers.lastName, term)
            )
          );
        const ids = matchingUsers.map((u) => u.id);
        if (ids.length === 0) return res.json({ posts: [], total: 0, page, pageSize });
        conditions.push(or(inArray(praisePosts.recipientId, ids), inArray(praisePosts.giverId, ids)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(praisePosts)
        .where(whereClause);

      const posts = await db
        .select()
        .from(praisePosts)
        .where(whereClause)
        .orderBy(desc(praisePosts.createdAt))
        .limit(pageSize)
        .offset(offset);

      if (posts.length === 0) return res.json({ posts: [], total: count ?? 0, page, pageSize });

      // Enrich with user names, badge type, clap counts, comment counts, hasClapped
      const userIds = Array.from(new Set([
        ...posts.map((p) => p.giverId),
        ...posts.map((p) => p.recipientId),
      ]));
      const badgeTypeIds = Array.from(new Set(posts.map((p) => p.badgeTypeId)));
      const postIds = posts.map((p) => p.id);

      const [users, badges, reactions, comments] = await Promise.all([
        db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
          .from(adminUsers).where(inArray(adminUsers.id, userIds)),
        db.select().from(praiseBadgeTypes).where(inArray(praiseBadgeTypes.id, badgeTypeIds)),
        db.select({ postId: praiseReactions.postId, reactorId: praiseReactions.reactorId })
          .from(praiseReactions).where(inArray(praiseReactions.postId, postIds)),
        db.select({ postId: praiseComments.postId, id: praiseComments.id })
          .from(praiseComments).where(inArray(praiseComments.postId, postIds)),
      ]);

      const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
      const badgeMap = new Map(badges.map((b) => [b.id, b]));

      const clapCountMap = new Map<string, number>();
      const hasClappedSet = new Set<string>();
      for (const r of reactions) {
        clapCountMap.set(r.postId, (clapCountMap.get(r.postId) ?? 0) + 1);
        if (r.reactorId === userId) hasClappedSet.add(r.postId);
      }

      const commentCountMap = new Map<string, number>();
      for (const c of comments) {
        commentCountMap.set(c.postId, (commentCountMap.get(c.postId) ?? 0) + 1);
      }

      const enriched = posts.map((p) => ({
        ...p,
        giverName: userMap.get(p.giverId) ?? "Unknown",
        recipientName: userMap.get(p.recipientId) ?? "Unknown",
        badgeType: badgeMap.get(p.badgeTypeId) ?? null,
        clapCount: clapCountMap.get(p.id) ?? 0,
        commentCount: commentCountMap.get(p.id) ?? 0,
        hasClapped: hasClappedSet.has(p.id),
      }));

      res.json({ posts: enriched, total: count ?? 0, page, pageSize });
    } catch (err) {
      console.error("Error fetching praise board:", err);
      res.status(500).json({ error: "Failed to fetch praise board" });
    }
  });

  // POST /api/praise — create a praise post
  app.post("/api/praise", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const {
        recipientId, badgeTypeId, message,
        certificateRequested, recognitionDescription, contributionSummary,
        publicCitationDraft, recognitionContext,
      } = req.body;
      if (!recipientId || !badgeTypeId || !message?.trim()) {
        return res.status(400).json({ error: "recipientId, badgeTypeId, and message are required" });
      }
      if (recipientId === userId) {
        return res.status(400).json({ error: "You cannot award a badge to yourself" });
      }

      if (certificateRequested) {
        if (!recognitionDescription?.trim() || !contributionSummary?.trim() || !publicCitationDraft?.trim()) {
          return res.status(400).json({ error: "recognitionDescription, contributionSummary, and publicCitationDraft are required when requesting a certificate" });
        }
        if (recognitionDescription.trim().length < 40 || contributionSummary.trim().length < 40) {
          return res.status(400).json({ error: "recognitionDescription and contributionSummary must each be at least 40 characters" });
        }
      }

      const [badge] = await db.select().from(praiseBadgeTypes).where(eq(praiseBadgeTypes.id, badgeTypeId));
      if (!badge) return res.status(404).json({ error: "Badge type not found" });

      const insertValues: any = {
        giverId: userId,
        recipientId,
        badgeTypeId,
        message: message.trim(),
      };

      if (certificateRequested) {
        insertValues.certificateRequested = true;
        insertValues.certificateStatus = "pending_verification";
        insertValues.recognitionDescription = recognitionDescription.trim();
        insertValues.contributionSummary = contributionSummary.trim();
        insertValues.publicCitationDraft = publicCitationDraft.trim();
        if (recognitionContext?.trim()) insertValues.recognitionContext = recognitionContext.trim();
      }

      const [post] = await db.insert(praisePosts).values(insertValues).returning();

      // Fire-and-forget notifications
      (async () => {
        try {
          const [giver] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId));
          const [recipient] = await db.select().from(adminUsers).where(eq(adminUsers.id, recipientId));
          if (giver && recipient) {
            const giverName = `${giver.firstName} ${giver.lastName}`;
            const recipientName = `${recipient.firstName} ${recipient.lastName}`;
            // In-app notification
            await createNotification(
              recipientId,
              "praise_received",
              `You received a ${badge.emoji} ${badge.name} badge!`,
              `${giverName} awarded you the "${badge.name}" badge: "${message.trim().substring(0, 100)}"`,
              { postId: post.id, badgeTypeId }
            );
            // Email
            await sendPraiseEmail({
              to: recipient.email,
              recipientFirstName: recipient.firstName,
              giverName,
              badgeName: badge.name,
              badgeEmoji: badge.emoji,
              message: message.trim(),
            });
          }
        } catch (err) {
          console.error("Praise notification error:", err);
        }
      })();

      res.status(201).json(post);
    } catch (err) {
      console.error("Error creating praise post:", err);
      res.status(500).json({ error: "Failed to create praise post" });
    }
  });

  // POST /api/praise/:id/react — toggle clap
  app.post("/api/praise/:id/react", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const postId = req.params.id;
      const [existing] = await db
        .select()
        .from(praiseReactions)
        .where(and(eq(praiseReactions.postId, postId), eq(praiseReactions.reactorId, userId)));

      if (existing) {
        await db.delete(praiseReactions).where(eq(praiseReactions.id, existing.id));
        return res.json({ hasClapped: false });
      } else {
        await db.insert(praiseReactions).values({ postId, reactorId: userId });
        return res.json({ hasClapped: true });
      }
    } catch (err) {
      console.error("Error toggling reaction:", err);
      res.status(500).json({ error: "Failed to toggle reaction" });
    }
  });

  // GET /api/praise/:id/comments — returns threaded: top-level comments with nested replies
  app.get("/api/praise/:id/comments", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const postId = req.params.id;
      const allComments = await db
        .select()
        .from(praiseComments)
        .where(eq(praiseComments.postId, postId))
        .orderBy(praiseComments.createdAt);

      if (allComments.length === 0) return res.json([]);

      const authorIds = Array.from(new Set(allComments.map((c) => c.authorId)));
      const authors = await db
        .select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
        .from(adminUsers).where(inArray(adminUsers.id, authorIds));
      const authorMap = new Map(authors.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));

      const enriched = allComments.map((c) => ({
        ...c,
        authorName: authorMap.get(c.authorId) ?? "Unknown",
        replies: [] as typeof enriched,
      }));

      // Build threaded structure: max depth = 1
      const topLevel = enriched.filter((c) => !c.parentCommentId);
      const replyMap = new Map<string, typeof enriched>();
      for (const c of enriched) {
        if (c.parentCommentId) {
          if (!replyMap.has(c.parentCommentId)) replyMap.set(c.parentCommentId, []);
          replyMap.get(c.parentCommentId)!.push(c);
        }
      }
      for (const top of topLevel) {
        top.replies = replyMap.get(top.id) ?? [];
      }

      res.json(topLevel);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // POST /api/praise/:id/comments — add a comment or reply (max depth=1)
  app.post("/api/praise/:id/comments", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const postId = req.params.id;
      const { message, parentCommentId } = req.body;
      if (!message?.trim()) return res.status(400).json({ error: "Message is required" });

      const [post] = await db.select().from(praisePosts).where(eq(praisePosts.id, postId));
      if (!post) return res.status(404).json({ error: "Post not found" });

      // Enforce max depth = 1: parent must be a top-level comment (no parent itself)
      if (parentCommentId) {
        const [parent] = await db
          .select()
          .from(praiseComments)
          .where(and(eq(praiseComments.id, parentCommentId), eq(praiseComments.postId, postId)));
        if (!parent) return res.status(400).json({ error: "Parent comment not found" });
        if (parent.parentCommentId) return res.status(400).json({ error: "Replies can only be one level deep" });
      }

      const [comment] = await db.insert(praiseComments).values({
        postId,
        authorId: userId,
        message: message.trim(),
        parentCommentId: parentCommentId ?? null,
      }).returning();

      // Notify recipient and giver (in-app only, not email)
      (async () => {
        try {
          const [commenter] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId));
          const commenterName = commenter ? `${commenter.firstName} ${commenter.lastName}` : "Someone";
          const notifyIds = Array.from(new Set([post.recipientId, post.giverId].filter((id) => id !== userId)));
          for (const nId of notifyIds) {
            await createNotification(
              nId,
              "praise_comment",
              "New comment on a praise post",
              `${commenterName} commented: "${message.trim().substring(0, 100)}"`,
              { postId, commentId: comment.id }
            );
          }
        } catch (err) {
          console.error("Comment notification error:", err);
        }
      })();

      // Return with author name
      const [commenter] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId));
      res.status(201).json({
        ...comment,
        authorName: commenter ? `${commenter.firstName} ${commenter.lastName}` : "Unknown",
      });
    } catch (err) {
      console.error("Error adding comment:", err);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  // GET /api/praise/my-badges — current user's received praise posts
  app.get("/api/praise/my-badges", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const posts = await db
        .select()
        .from(praisePosts)
        .where(eq(praisePosts.recipientId, userId))
        .orderBy(desc(praisePosts.createdAt));

      if (posts.length === 0) return res.json({ posts: [], pinnedPostIds: [] });

      const giverIds = Array.from(new Set(posts.map((p) => p.giverId)));
      const badgeTypeIds = Array.from(new Set(posts.map((p) => p.badgeTypeId)));
      const postIds = posts.map((p) => p.id);

      const [givers, badges, pinned] = await Promise.all([
        db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
          .from(adminUsers).where(inArray(adminUsers.id, giverIds)),
        db.select().from(praiseBadgeTypes).where(inArray(praiseBadgeTypes.id, badgeTypeIds)),
        db.select().from(pinnedPraisePosts).where(
          and(eq(pinnedPraisePosts.userId, userId), inArray(pinnedPraisePosts.postId, postIds))
        ),
      ]);

      const giverMap = new Map(givers.map((g) => [g.id, `${g.firstName} ${g.lastName}`]));
      const badgeMap = new Map(badges.map((b) => [b.id, b]));
      const pinnedPostIds = pinned.map((p) => p.postId);

      res.json({
        posts: posts.map((p) => ({
          ...p,
          giverName: giverMap.get(p.giverId) ?? "Unknown",
          badgeType: badgeMap.get(p.badgeTypeId) ?? null,
          isPinned: pinnedPostIds.includes(p.id),
        })),
        pinnedPostIds,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch my badges" });
    }
  });

  // PATCH /api/praise/pinned — update current user's pinned post IDs (max 3)
  app.patch("/api/praise/pinned", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const { postIds } = req.body;
      if (!Array.isArray(postIds)) return res.status(400).json({ error: "postIds must be an array" });
      if (postIds.length > 3) return res.status(400).json({ error: "You can pin at most 3 badges" });

      // Delete all existing pinned posts for this user
      await db.delete(pinnedPraisePosts).where(eq(pinnedPraisePosts.userId, userId));

      if (postIds.length > 0) {
        // Verify these posts exist and belong to this user
        const validPosts = await db
          .select({ id: praisePosts.id })
          .from(praisePosts)
          .where(and(eq(praisePosts.recipientId, userId), inArray(praisePosts.id, postIds)));
        const validIds = validPosts.map((p) => p.id);
        if (validIds.length > 0) {
          await db.insert(pinnedPraisePosts).values(validIds.map((postId) => ({ userId, postId })));
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error updating pinned posts:", err);
      res.status(500).json({ error: "Failed to update pinned posts" });
    }
  });

  // GET /api/praise/pinned/:userId — get pinned badges for a user (for profile display)
  app.get("/api/praise/pinned/:userId", async (req: Request, res: Response) => {
    const currentUserId = requireAuth(req, res);
    if (!currentUserId) return;
    try {
      const targetUserId = req.params.userId;
      const pinned = await db
        .select()
        .from(pinnedPraisePosts)
        .where(eq(pinnedPraisePosts.userId, targetUserId));

      if (pinned.length === 0) return res.json([]);

      const postIds = pinned.map((p) => p.postId);
      const posts = await db
        .select()
        .from(praisePosts)
        .where(inArray(praisePosts.id, postIds));

      const badgeTypeIds = Array.from(new Set(posts.map((p) => p.badgeTypeId)));
      const giverIds = Array.from(new Set(posts.map((p) => p.giverId)));

      const [badges, givers] = await Promise.all([
        db.select().from(praiseBadgeTypes).where(inArray(praiseBadgeTypes.id, badgeTypeIds)),
        db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
          .from(adminUsers).where(inArray(adminUsers.id, giverIds)),
      ]);

      const badgeMap = new Map(badges.map((b) => [b.id, b]));
      const giverMap = new Map(givers.map((g) => [g.id, `${g.firstName} ${g.lastName}`]));

      res.json(posts.map((p) => ({
        ...p,
        badgeType: badgeMap.get(p.badgeTypeId) ?? null,
        giverName: giverMap.get(p.giverId) ?? "Unknown",
      })));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch pinned badges" });
    }
  });
}
