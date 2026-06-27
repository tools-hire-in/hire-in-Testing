import type { Express, Request, Response } from "express";
import { db } from "./db";
import { storage } from "./storage";
import { releaseNotes, adminUsers } from "@shared/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAuth } from "./auth";
import { getCommitsSinceLastRelease, getHeadSha } from "./services/gitLogService";
import { generateReleaseNotes, isAiConfigured } from "./services/aiDraftService";
import { sendReleaseNotesEmail } from "./email";

const ALLOWED_ROLES = ["super_admin", "admin", "hr"] as const;

// Roles that can author/edit/generate/submit drafts
function requireRole(...roles: string[]) {
  return [
    requireAuth,
    (req: Request, res: Response, next: Function) => {
      const role = req.session?.role;
      if (!role || !roles.includes(role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    },
  ];
}

async function getSettingValue(key: string): Promise<string | null> {
  try {
    const setting = await storage.getSystemSetting(key);
    if (!setting) return null;
    const v = setting.value;
    if (typeof v === "string") return v;
    if (v != null) return JSON.stringify(v);
    return null;
  } catch {
    return null;
  }
}

async function setSettingValue(key: string, value: string): Promise<void> {
  await storage.upsertSystemSetting(key, value);
}

async function getActiveUsers(): Promise<Array<{ id: string; email: string; firstName: string }>> {
  const users = await db
    .select({ id: adminUsers.id, email: adminUsers.email, firstName: adminUsers.firstName })
    .from(adminUsers)
    .where(eq(adminUsers.isActive, true));
  return users.filter(u => u.email).map(u => ({
    id: u.id,
    email: u.email!,
    firstName: u.firstName || "Team",
  }));
}

async function broadcastInApp(version: string | null, title: string, body: string) {
  const users = await getActiveUsers();
  for (const u of users) {
    try {
      await storage.createNotification({
        userId: u.id,
        type: "release_notes",
        title: `Platform Update${version ? ` ${version}` : ""}: ${title}`,
        message: body.slice(0, 300) + (body.length > 300 ? "..." : ""),
        isRead: false,
        metadata: null,
      });
    } catch {
    }
  }
}

// Statuses considered "unsent" (still in the working pipeline)
const UNSENT_STATUSES = ["draft", "pending_approval", "rejected", "approved"];

export function registerReleaseNotesRoutes(app: Express) {
  // --- Release notes CRUD + approval workflow ---

  // List all release notes (drafts + sent) — restricted to hr/admin/super_admin
  app.get(
    "/api/admin/release-notes",
    ...requireRole(...ALLOWED_ROLES),
    async (_req: Request, res: Response) => {
      try {
        const notes = await db
          .select()
          .from(releaseNotes)
          .orderBy(desc(releaseNotes.createdAt))
          .limit(100);
        res.json(notes);
      } catch (err: any) {
        console.error("[releaseNotes] list error:", err);
        res.status(500).json({ message: "Failed to fetch release notes" });
      }
    }
  );

  // Fetch git commits since last release — OPTIONAL convenience, always degrades gracefully
  app.post(
    "/api/admin/release-notes/git-log",
    ...requireRole(...ALLOWED_ROLES),
    async (_req: Request, res: Response) => {
      try {
        const lastSha = await getSettingValue("release_notes_last_git_sha") || "";
        const log = await getCommitsSinceLastRelease(lastSha);
        res.json({ log: log || "", available: Boolean(log) });
      } catch (err: any) {
        console.error("[releaseNotes] git-log error:", err);
        // Degrade gracefully — never block the page with a hard error
        res.json({ log: "", available: false });
      }
    }
  );

  // Generate polished release notes from changelog input via AI
  // mode: "release" (default) | "digest" (one-time themed monthly catch-up)
  app.post(
    "/api/admin/release-notes/generate",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        if (!isAiConfigured()) {
          return res.status(400).json({ message: "AI is not configured. Please set up AI integrations first." });
        }
        const { changelogInput, mode } = req.body;
        if (!changelogInput?.trim()) {
          return res.status(400).json({ message: "changelogInput is required" });
        }
        const result = await generateReleaseNotes(changelogInput, mode === "digest" ? "digest" : "release");
        res.json(result);
      } catch (err: any) {
        console.error("[releaseNotes] generate error:", err);
        res.status(500).json({ message: err.message || "Failed to generate release notes" });
      }
    }
  );

  // Create a new draft release note (never overwrites an existing one — each is its own row)
  app.post(
    "/api/admin/release-notes",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        const userId = req.session?.userId || null;
        const { version, title, body, changelogInput } = req.body;

        if (!title || !body) {
          return res.status(400).json({ message: "title and body are required" });
        }

        const [note] = await db
          .insert(releaseNotes)
          .values({
            version: version || null,
            title,
            body,
            changelogInput: changelogInput || null,
            status: "draft",
            createdByUserId: userId,
            sentChannels: [],
            sentAt: null,
          })
          .returning();

        res.json(note);
      } catch (err: any) {
        console.error("[releaseNotes] create error:", err);
        res.status(500).json({ message: "Failed to save release notes" });
      }
    }
  );

  // Edit an existing draft / rejected note (cannot edit once sent)
  app.patch(
    "/api/admin/release-notes/:id",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { version, title, body, changelogInput } = req.body;

        const [existing] = await db.select().from(releaseNotes).where(eq(releaseNotes.id, id));
        if (!existing) return res.status(404).json({ message: "Release note not found" });
        // Only unsubmitted notes are editable. Notes that are pending approval,
        // already approved, or sent must NOT be mutated in place — otherwise an
        // approved note could be changed and then sent without re-approval,
        // breaking the "Super Admin must approve before send" guarantee.
        if (!["draft", "rejected"].includes(existing.status)) {
          return res.status(400).json({
            message:
              existing.status === "sent"
                ? "Sent release notes cannot be edited"
                : "This note is locked while it awaits approval. Reject it (or it must be returned) before editing.",
          });
        }

        const updateData: any = {};
        if (version !== undefined) updateData.version = version || null;
        if (title !== undefined) updateData.title = title;
        if (body !== undefined) updateData.body = body;
        if (changelogInput !== undefined) updateData.changelogInput = changelogInput || null;

        // Editing a rejected note resets it back to draft and clears the rejection
        if (existing.status === "rejected") {
          updateData.status = "draft";
          updateData.rejectionReason = null;
        }

        const [updated] = await db
          .update(releaseNotes)
          .set(updateData)
          .where(eq(releaseNotes.id, id))
          .returning();

        res.json(updated);
      } catch (err: any) {
        console.error("[releaseNotes] edit error:", err);
        res.status(500).json({ message: "Failed to update release note" });
      }
    }
  );

  // Discard a draft (any unsent note)
  app.delete(
    "/api/admin/release-notes/:id",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const [existing] = await db.select().from(releaseNotes).where(eq(releaseNotes.id, id));
        if (!existing) return res.status(404).json({ message: "Release note not found" });
        if (existing.status === "sent") {
          return res.status(400).json({ message: "Sent release notes cannot be discarded" });
        }
        await db.delete(releaseNotes).where(eq(releaseNotes.id, id));
        res.json({ ok: true });
      } catch (err: any) {
        console.error("[releaseNotes] discard error:", err);
        res.status(500).json({ message: "Failed to discard release note" });
      }
    }
  );

  // Combine multiple saved drafts into a single new draft
  app.post(
    "/api/admin/release-notes/combine",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        const userId = req.session?.userId || null;
        const { ids } = req.body as { ids?: string[] };
        if (!Array.isArray(ids) || ids.length < 2) {
          return res.status(400).json({ message: "Select at least two drafts to combine" });
        }

        const sources = await db
          .select()
          .from(releaseNotes)
          .where(inArray(releaseNotes.id, ids));

        if (sources.length < 2) {
          return res.status(400).json({ message: "Could not find the selected drafts" });
        }
        if (sources.some(s => s.status === "sent")) {
          return res.status(400).json({ message: "Sent release notes cannot be combined" });
        }

        // Preserve the order the user selected them in
        const ordered = ids
          .map(id => sources.find(s => s.id === id))
          .filter(Boolean) as typeof sources;

        const combinedBody = ordered
          .map(s => {
            const heading = s.title ? `## ${s.title}` : "";
            return [heading, s.body || ""].filter(Boolean).join("\n");
          })
          .join("\n\n");

        const combinedChangelog = ordered
          .map(s => s.changelogInput || "")
          .filter(Boolean)
          .join("\n\n");

        const versions = ordered.map(s => s.version).filter(Boolean);
        const combinedVersion = versions.length > 0 ? versions.join(" + ") : null;

        const [note] = await db
          .insert(releaseNotes)
          .values({
            version: combinedVersion,
            title: "Combined Update",
            body: combinedBody,
            changelogInput: combinedChangelog || null,
            status: "draft",
            createdByUserId: userId,
            sentChannels: [],
            sentAt: null,
          })
          .returning();

        res.json(note);
      } catch (err: any) {
        console.error("[releaseNotes] combine error:", err);
        res.status(500).json({ message: "Failed to combine drafts" });
      }
    }
  );

  // Submit a draft for Super Admin approval
  app.post(
    "/api/admin/release-notes/:id/submit",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const userId = req.session?.userId || null;

        const [existing] = await db.select().from(releaseNotes).where(eq(releaseNotes.id, id));
        if (!existing) return res.status(404).json({ message: "Release note not found" });
        if (!["draft", "rejected"].includes(existing.status)) {
          return res.status(400).json({ message: `Cannot submit a note that is ${existing.status}` });
        }
        if (!existing.title || !existing.body) {
          return res.status(400).json({ message: "Title and body are required before submitting" });
        }

        const [updated] = await db
          .update(releaseNotes)
          .set({
            status: "pending_approval",
            submittedByUserId: userId,
            submittedAt: new Date(),
            rejectionReason: null,
          })
          .where(eq(releaseNotes.id, id))
          .returning();

        res.json(updated);
      } catch (err: any) {
        console.error("[releaseNotes] submit error:", err);
        res.status(500).json({ message: "Failed to submit for approval" });
      }
    }
  );

  // Approve a pending note — SUPER ADMIN ONLY
  app.post(
    "/api/admin/release-notes/:id/approve",
    ...requireRole("super_admin"),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const userId = req.session?.userId || null;

        const [existing] = await db.select().from(releaseNotes).where(eq(releaseNotes.id, id));
        if (!existing) return res.status(404).json({ message: "Release note not found" });
        if (existing.status !== "pending_approval") {
          return res.status(400).json({ message: "Only notes pending approval can be approved" });
        }

        const [updated] = await db
          .update(releaseNotes)
          .set({
            status: "approved",
            approvedByUserId: userId,
            approvedAt: new Date(),
            rejectionReason: null,
          })
          .where(eq(releaseNotes.id, id))
          .returning();

        // Notify the submitter that their note was approved
        if (existing.submittedByUserId) {
          try {
            await storage.createNotification({
              userId: existing.submittedByUserId,
              type: "release_notes",
              title: "Release note approved",
              message: `"${existing.title}" was approved and is ready to send.`,
              isRead: false,
              metadata: null,
            });
          } catch {}
        }

        res.json(updated);
      } catch (err: any) {
        console.error("[releaseNotes] approve error:", err);
        res.status(500).json({ message: "Failed to approve release note" });
      }
    }
  );

  // Reject a pending note with a reason — SUPER ADMIN ONLY
  app.post(
    "/api/admin/release-notes/:id/reject",
    ...requireRole("super_admin"),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason?.trim()) {
          return res.status(400).json({ message: "A rejection reason is required" });
        }

        const [existing] = await db.select().from(releaseNotes).where(eq(releaseNotes.id, id));
        if (!existing) return res.status(404).json({ message: "Release note not found" });
        if (existing.status !== "pending_approval") {
          return res.status(400).json({ message: "Only notes pending approval can be rejected" });
        }

        const [updated] = await db
          .update(releaseNotes)
          .set({
            status: "rejected",
            rejectionReason: reason.trim(),
          })
          .where(eq(releaseNotes.id, id))
          .returning();

        // Notify the submitter that their note was rejected
        if (existing.submittedByUserId) {
          try {
            await storage.createNotification({
              userId: existing.submittedByUserId,
              type: "release_notes",
              title: "Release note needs changes",
              message: `"${existing.title}" was returned: ${reason.trim().slice(0, 200)}`,
              isRead: false,
              metadata: null,
            });
          } catch {}
        }

        res.json(updated);
      } catch (err: any) {
        console.error("[releaseNotes] reject error:", err);
        res.status(500).json({ message: "Failed to reject release note" });
      }
    }
  );

  // Send an APPROVED note via the chosen channels — SUPER ADMIN ONLY
  app.post(
    "/api/admin/release-notes/:id/send",
    ...requireRole("super_admin"),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const userId = req.session?.userId || null;
        const { channels = [] } = req.body as { channels?: string[] };

        if (!Array.isArray(channels) || channels.length === 0) {
          return res.status(400).json({ message: "Select at least one delivery channel" });
        }

        const [note] = await db.select().from(releaseNotes).where(eq(releaseNotes.id, id));
        if (!note) return res.status(404).json({ message: "Release note not found" });
        if (note.status !== "approved") {
          return res.status(400).json({ message: "Only approved release notes can be sent" });
        }

        if (channels.includes("in_app")) {
          await broadcastInApp(note.version, note.title || "", note.body || "");
        }

        if (channels.includes("email")) {
          const employees = await getActiveUsers();
          if (employees.length > 0) {
            await sendReleaseNotesEmail({
              employees,
              version: note.version || "",
              title: note.title || "",
              body: note.body || "",
            });
          }
        }

        // Advance the git SHA cursor after a successful send (best-effort)
        const headSha = await getHeadSha();
        if (headSha) {
          await setSettingValue("release_notes_last_git_sha", headSha);
        }

        const updatedChannels = [...new Set([...(note.sentChannels || []), ...channels])];
        const [updated] = await db
          .update(releaseNotes)
          .set({
            status: "sent",
            sentAt: new Date(),
            sentChannels: updatedChannels,
            sentByUserId: userId,
          })
          .where(eq(releaseNotes.id, id))
          .returning();

        res.json(updated);
      } catch (err: any) {
        console.error("[releaseNotes] send error:", err);
        res.status(500).json({ message: "Failed to send release notes" });
      }
    }
  );
}
