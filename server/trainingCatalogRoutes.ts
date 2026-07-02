import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  learningTracks, trackSections, trackAssignments, trainingSopLinks,
  roleTrainingRules, adminUsers, onboardingAuditEvents,
} from "@shared/schema";
import { eq, and, inArray, or, sql, isNotNull } from "drizzle-orm";
import fs from "fs";
import path from "path";

const SUPER_ADMIN_ROLES = ["super_admin"];
const ADMIN_HR_ROLES = ["super_admin", "admin", "hr"];

function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: () => void) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.session.role!)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

const AUDIENCE_ROLE_MAP: Record<string, string[]> = {
  "All Employees": ["super_admin", "admin", "hr", "finance", "operations", "manager", "recruiter", "employee"],
  "Managers, Leads, AMs, Ops, HR": ["manager", "hr", "operations"],
  "Manager + Ops Governance": ["manager", "operations"],
  "All Delivery + Sales": ["manager", "operations", "employee"],
  "TA + Sales + Managers": ["manager", "operations"],
  "Recruiters + Leads": ["employee", "manager"],
  "Recruiters + Leads + Managers": ["employee", "manager"],
};

function mapAudienceToRoles(audience: string): string[] {
  if (AUDIENCE_ROLE_MAP[audience]) return AUDIENCE_ROLE_MAP[audience];
  const lower = audience.toLowerCase();
  if (lower.includes("all employee") || lower.includes("all relevant")) return AUDIENCE_ROLE_MAP["All Employees"];
  if (lower.includes("manager") && lower.includes("hr")) return ["manager", "hr", "operations"];
  if (lower.includes("manager")) return ["manager", "operations"];
  if (lower.includes("hr")) return ["hr"];
  if (lower.includes("recruiter")) return ["employee", "manager"];
  if (lower.includes("delivery") && lower.includes("sales")) return ["manager", "operations", "employee"];
  return [];
}

export function registerTrainingCatalogRoutes(app: Express) {

  app.post("/api/training/seed-import",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      if (!["super_admin", "admin"].includes(req.session.role!)) return res.status(403).json({ error: "Insufficient permissions" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const seedPath = path.join(process.cwd(), "attached_assets", "hirein_sop_training_seed_data_1782980559842.json");
        if (!fs.existsSync(seedPath)) {
          return res.status(404).json({ error: "Seed file not found" });
        }
        const raw = fs.readFileSync(seedPath, "utf-8");
        const seedData = JSON.parse(raw);
        const modules: any[] = seedData.trainingModules || [];

        let tracksUpserted = 0;
        let linksCreated = 0;
        let rulesCreated = 0;

        await db.transaction(async (tx) => {
          for (const mod of modules) {
            const { trainingId, sopCode, moduleTitle, category, launchWave, audience, durationMinutes, purpose, learningObjectives } = mod;

            const description = [
              purpose ? `**Purpose:** ${purpose}` : null,
              learningObjectives?.length
                ? `**Learning Objectives:**\n${(learningObjectives as string[]).map((o: string) => `- ${o}`).join("\n")}`
                : null,
            ].filter(Boolean).join("\n\n");

            const existingRows = await tx.select({ id: learningTracks.id })
              .from(learningTracks)
              .where(eq(learningTracks.trainingId, trainingId));

            let trackId: string;
            if (existingRows.length > 0) {
              trackId = existingRows[0].id;
              await tx.update(learningTracks)
                .set({
                  title: moduleTitle,
                  description,
                  sopCategory: category,
                  launchWave,
                  audience,
                  updatedAt: new Date(),
                })
                .where(eq(learningTracks.id, trackId));
            } else {
              const [inserted] = await tx.insert(learningTracks).values({
                title: moduleTitle,
                description,
                status: "draft",
                trainingId,
                sopCategory: category,
                launchWave,
                audience,
                version: "1.0",
                versionNumber: 1,
                isPolicyTrack: false,
                isUniversal: false,
                createdBy: req.session.userId!,
              }).returning({ id: learningTracks.id });
              trackId = inserted.id;

              const estimatedMinutes = Math.max(5, Math.ceil((durationMinutes || 30) / 3));
              const sectionsToCreate = [
                { title: "Purpose & Business Value", body: purpose || "" },
                {
                  title: "Learning Objectives",
                  body: learningObjectives?.length
                    ? (learningObjectives as string[]).map((o: string, i: number) => `${i + 1}. ${o}`).join("\n")
                    : "",
                },
              ];
              for (let i = 0; i < sectionsToCreate.length; i++) {
                const s = sectionsToCreate[i];
                if (s.body.trim()) {
                  await tx.insert(trackSections).values({
                    trackId,
                    title: s.title,
                    body: s.body,
                    orderIndex: i,
                    minDwellSeconds: 30,
                    estimatedMinutes,
                  });
                }
              }
            }

            tracksUpserted++;

            const codes = (sopCode || "").split(";").map((c: string) => c.trim()).filter(Boolean);
            for (const code of codes) {
              const isGlobal = code === "ALL";
              try {
                await tx.insert(trainingSopLinks).values({ trackId, sopCode: code, isGlobal }).onConflictDoNothing();
                linksCreated++;
              } catch {
                // ignore unique conflict
              }
            }

            const roleSlugs = mapAudienceToRoles(audience || "");
            for (const roleSlug of roleSlugs) {
              try {
                const existing = await tx.select({ id: roleTrainingRules.id })
                  .from(roleTrainingRules)
                  .where(and(
                    eq(roleTrainingRules.trackId, trackId),
                    eq(roleTrainingRules.roleSlug, roleSlug),
                  ));
                if (existing.length === 0) {
                  await tx.insert(roleTrainingRules).values({ trackId, roleSlug, isMandatory: true });
                  rulesCreated++;
                }
              } catch {
                // non-fatal
              }
            }
          }
        });

        res.json({ tracksUpserted, linksCreated, rulesCreated });
      } catch (error) {
        console.error("Seed import error:", error);
        res.status(500).json({ error: "Seed import failed" });
      }
    }
  );

  app.get("/api/training/by-sop/:sopCode",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const { sopCode } = req.params as { sopCode: string };
        const userId = req.session.userId!;

        const links = await db.select({ trackId: trainingSopLinks.trackId, isGlobal: trainingSopLinks.isGlobal })
          .from(trainingSopLinks)
          .where(or(
            eq(trainingSopLinks.sopCode, sopCode),
            eq(trainingSopLinks.isGlobal, true),
          ));

        const trackIds = [...new Set(links.map((l) => l.trackId))];
        if (trackIds.length === 0) return res.json([]);

        const tracks = await db.select()
          .from(learningTracks)
          .where(and(
            inArray(learningTracks.id, trackIds),
            eq(learningTracks.status, "published"),
          ));

        const [sectionCounts, assignmentTotals] = await Promise.all([
          Promise.all(tracks.map((t) =>
            db.select({ count: sql<number>`count(*)::int` })
              .from(trackSections)
              .where(eq(trackSections.trackId, t.id))
              .then((r) => ({ trackId: t.id, count: r[0]?.count ?? 0 }))
          )),
          Promise.all(tracks.map((t) =>
            db.select({
              total: sql<number>`count(*)::int`,
              completed: sql<number>`sum(case when status = 'completed' then 1 else 0 end)::int`,
            })
              .from(trackAssignments)
              .where(eq(trackAssignments.trackId, t.id))
              .then((r) => ({ trackId: t.id, total: r[0]?.total ?? 0, completed: r[0]?.completed ?? 0 }))
          )),
        ]);

        const userAssignments = trackIds.length > 0
          ? await db.select()
              .from(trackAssignments)
              .where(and(
                inArray(trackAssignments.trackId, trackIds),
                eq(trackAssignments.userId, userId),
              ))
          : [];

        const linkMap = new Map<string, boolean>();
        for (const l of links) linkMap.set(l.trackId, l.isGlobal);

        const result = tracks.map((track) => {
          const sc = sectionCounts.find((x) => x.trackId === track.id);
          const at = assignmentTotals.find((x) => x.trackId === track.id);
          const myAssignment = userAssignments.find((a) => a.trackId === track.id);
          return {
            ...track,
            isGlobal: linkMap.get(track.id) ?? false,
            sectionCount: sc?.count ?? 0,
            totalAssignments: at?.total ?? 0,
            completedAssignments: at?.completed ?? 0,
            myAssignment: myAssignment ?? null,
            myStatus: myAssignment?.status ?? "not_assigned",
          };
        });

        res.json(result);
      } catch (error) {
        console.error("by-sop error:", error);
        res.status(500).json({ error: "Failed to fetch training for SOP" });
      }
    }
  );

  app.get("/api/training/catalog",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const { wave, category, audience, q } = req.query as { wave?: string; category?: string; audience?: string; q?: string };
        const userId = req.session.userId!;

        const rows = await db.select()
          .from(learningTracks)
          .where(and(
            eq(learningTracks.status, "published"),
            isNotNull(learningTracks.sopCategory),
          ));

        let filtered = rows;
        if (wave) filtered = filtered.filter((t) => t.launchWave === wave);
        if (category) filtered = filtered.filter((t) => t.sopCategory === category);
        if (audience) filtered = filtered.filter((t) => t.audience === audience);
        if (q) {
          const lower = q.toLowerCase();
          filtered = filtered.filter((t) =>
            t.title.toLowerCase().includes(lower) ||
            (t.sopCategory ?? "").toLowerCase().includes(lower)
          );
        }

        const trackIds = filtered.map((t) => t.id);
        const userAssignments = trackIds.length > 0
          ? await db.select()
              .from(trackAssignments)
              .where(and(
                inArray(trackAssignments.trackId, trackIds),
                eq(trackAssignments.userId, userId),
              ))
          : [];

        const result = filtered.map((track) => {
          const myAssignment = userAssignments.find((a) => a.trackId === track.id);
          return {
            ...track,
            myStatus: myAssignment?.status ?? "not_assigned",
            myAssignmentId: myAssignment?.id ?? null,
          };
        });

        res.json(result);
      } catch (error) {
        console.error("catalog error:", error);
        res.status(500).json({ error: "Failed to fetch training catalog" });
      }
    }
  );

  app.post("/api/training/bulk-assign-by-role",
    (req, res, next) => {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      if (!ADMIN_HR_ROLES.includes(req.session.role!)) return res.status(403).json({ error: "Insufficient permissions" });
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const { trackId, roleSlug, department, dueDate } = req.body as {
          trackId: string;
          roleSlug: string;
          department?: string;
          dueDate?: string;
        };
        if (!trackId || !roleSlug) return res.status(400).json({ error: "trackId and roleSlug are required" });

        const [track] = await db.select({ id: learningTracks.id })
          .from(learningTracks)
          .where(eq(learningTracks.id, trackId));
        if (!track) return res.status(404).json({ error: "Track not found" });

        let userQuery = db.select({ id: adminUsers.id })
          .from(adminUsers)
          .where(and(
            eq(adminUsers.isActive, true),
            eq(adminUsers.role, roleSlug as any),
            ...(department ? [eq(adminUsers.departmentId, department)] : []),
          ));

        const users = await userQuery;
        if (users.length === 0) return res.json({ assigned: 0, skipped: 0 });

        const existingAssignments = await db.select({ userId: trackAssignments.userId })
          .from(trackAssignments)
          .where(and(
            eq(trackAssignments.trackId, trackId),
            inArray(trackAssignments.userId, users.map((u) => u.id)),
          ));

        const alreadyAssigned = new Set(existingAssignments.map((a) => a.userId));
        const toAssign = users.filter((u) => !alreadyAssigned.has(u.id));

        const dueDateObj = dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

        let assigned = 0;
        for (const user of toAssign) {
          try {
            await db.insert(trackAssignments).values({
              trackId,
              userId: user.id,
              assignedBy: req.session.userId!,
              dueDate: dueDateObj,
              status: "not_started",
            });
            assigned++;
          } catch {
            // non-fatal
          }
        }

        await db.insert(onboardingAuditEvents).values({
          userId: req.session.userId!,
          eventType: "bulk_role_assign",
          metadata: { trackId, roleSlug, department, assigned, skipped: alreadyAssigned.size },
        });

        res.json({ assigned, skipped: alreadyAssigned.size });
      } catch (error) {
        console.error("bulk-assign error:", error);
        res.status(500).json({ error: "Failed to bulk assign" });
      }
    }
  );
}
