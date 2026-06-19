import type { Express, Request, Response } from "express";
import { db } from "./db";
import { storage } from "./storage";
import { releaseNotes, adminUsers } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "./auth";
import { getCommitsSinceLastRelease, getHeadSha } from "./services/gitLogService";
import { generateReleaseNotes, isAiConfigured } from "./services/aiDraftService";
import { sendReleaseNotesEmail } from "./email";

const ALLOWED_ROLES = ["super_admin", "admin", "hr"] as const;

function requireRole(...roles: string[]) {
  return [
    requireAuth,
    (req: Request, res: Response, next: Function) => {
      const user = (req as any).user;
      if (!user || !roles.includes(user.role)) {
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
    // jsonb — Drizzle returns parsed JS value; strings come back as strings
    if (typeof v === "string") return v;
    if (v != null) return JSON.stringify(v);
    return null;
  } catch {
    return null;
  }
}

async function setSettingValue(key: string, value: string): Promise<void> {
  // storage.upsertSystemSetting handles jsonb serialization via Drizzle ORM
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

export function registerReleaseNotesRoutes(app: Express) {
  // --- Draft scratchpad (system_settings key: release_notes_changelog_draft) ---

  app.get(
    "/api/admin/settings/release-notes-draft",
    ...requireRole(...ALLOWED_ROLES),
    async (_req: Request, res: Response) => {
      try {
        const draft = await getSettingValue("release_notes_changelog_draft");
        const lastSha = await getSettingValue("release_notes_last_git_sha");
        res.json({ draft: draft || "", lastSha: lastSha || "" });
      } catch (err: any) {
        res.status(500).json({ message: "Failed to load draft" });
      }
    }
  );

  app.patch(
    "/api/admin/settings/release-notes-draft",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        const { draft } = req.body;
        await setSettingValue("release_notes_changelog_draft", draft ?? "");
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ message: "Failed to save draft" });
      }
    }
  );

  // --- Release notes CRUD ---

  // List release notes — restricted to hr/admin/super_admin
  app.get(
    "/api/admin/release-notes",
    ...requireRole(...ALLOWED_ROLES),
    async (_req: Request, res: Response) => {
      try {
        const notes = await db
          .select()
          .from(releaseNotes)
          .orderBy(desc(releaseNotes.createdAt))
          .limit(50);
        res.json(notes);
      } catch (err: any) {
        console.error("[releaseNotes] list error:", err);
        res.status(500).json({ message: "Failed to fetch release notes" });
      }
    }
  );

  // Fetch git commits since last release
  app.post(
    "/api/admin/release-notes/git-log",
    ...requireRole(...ALLOWED_ROLES),
    async (_req: Request, res: Response) => {
      try {
        const lastSha = await getSettingValue("release_notes_last_git_sha") || "";
        const log = await getCommitsSinceLastRelease(lastSha);
        res.json({ log });
      } catch (err: any) {
        console.error("[releaseNotes] git-log error:", err);
        res.status(500).json({ message: "Failed to fetch git log" });
      }
    }
  );

  // Generate polished release notes from changelog input via AI
  app.post(
    "/api/admin/release-notes/generate",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        if (!isAiConfigured()) {
          return res.status(400).json({ message: "AI is not configured. Please set up AI integrations first." });
        }
        const { changelogInput } = req.body;
        if (!changelogInput?.trim()) {
          return res.status(400).json({ message: "changelogInput is required" });
        }
        const result = await generateReleaseNotes(changelogInput);
        res.json(result);
      } catch (err: any) {
        console.error("[releaseNotes] generate error:", err);
        res.status(500).json({ message: err.message || "Failed to generate release notes" });
      }
    }
  );

  // Save a new release note as draft (no channel dispatch, no SHA advance)
  app.post(
    "/api/admin/release-notes",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
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
            sentChannels: [],
            sentAt: null,
            sentByUserId: user?.id || null,
          })
          .returning();

        res.json(note);
      } catch (err: any) {
        console.error("[releaseNotes] save error:", err);
        res.status(500).json({ message: "Failed to save release notes" });
      }
    }
  );

  // Re-send an existing release note to additional channels
  app.post(
    "/api/admin/release-notes/:id/send",
    ...requireRole(...ALLOWED_ROLES),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { channels = [] } = req.body;

        const [note] = await db.select().from(releaseNotes).where(eq(releaseNotes.id, id));
        if (!note) return res.status(404).json({ message: "Release note not found" });

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

        // Update SHA after any send action
        const headSha = await getHeadSha();
        if (headSha) {
          await setSettingValue("release_notes_last_git_sha", headSha);
        }

        const now = new Date();
        const updatedChannels = [...new Set([...(note.sentChannels || []), ...channels])];
        const [updated] = await db
          .update(releaseNotes)
          .set({ sentAt: now, sentChannels: updatedChannels })
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
