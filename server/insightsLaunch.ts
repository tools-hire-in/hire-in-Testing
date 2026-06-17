// ===========================================================================
// Hire'in Insights Pilot Launch (Task #473)
// ---------------------------------------------------------------------------
// Content + go-to-market layer on top of the already-built Content Studio.
//   1. Idempotent seed of the 13 launch articles (dry-run aware).
//   2. Senior+-only category routing guardrail written into the Insights
//      project's routingRules.
//   3. Auto-route each seeded article to an eligible senior reviewer with a
//      2-hour SLA, the reviewer's manager CC'd on the email, an in-app
//      notification, and an audit trail.
//   4. Editable Social Kit drafts per article (never auto-posted).
//   5. One-time Super-Admin "Send launch announcement" broadcast.
// No new platform plumbing — this reuses the existing studio storage layer,
// review-assignment workflow, email service and social-card engine.
// ===========================================================================

import { readFileSync } from "fs";
import { join } from "path";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { studioArticles, studioAuthorProfiles } from "@shared/schema";
import type {
  AdminUser,
  Department,
  StudioArticle,
  StudioProject,
} from "@shared/schema";
import type { CanonicalSocialKit } from "@shared/studioAi";

export const INSIGHTS_LAUNCH_SEED_BATCH_ID = "hirein-insights-launch-v1";
const INSIGHTS_PROJECT_SLUG = "hirein";
const DEFAULT_BASE_URL = "https://hire-in.com";
const REVIEW_SLA_MS = 2 * 60 * 60 * 1000; // 2 hours
const ANNOUNCEMENT_FLAG_KEY = "hirein_insights_launch_announced";

// Routing desk a category maps onto. Mirrors the launch routing spec.
type RoutingTeam =
  | "leadership"
  | "healthcare"
  | "it"
  | "recruiting"
  | "candidate"
  | "employer"
  | "ai";

interface SeedArticle {
  title: string;
  slug: string;
  category: string;
  categoryRaw: string;
  audience: string[];
  suggestedAuthorRole: string;
  routingTeam: RoutingTeam;
  minimumReviewerLevel: string;
  status: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  bodyMarkdown: string;
  cta: string | null;
  requiresAuthorApproval: boolean;
  requiresMarketingApproval: boolean;
}

interface SeedFile {
  seedBatchId: string;
  categories: string[];
  articles: SeedArticle[];
}

let _seedCache: SeedFile | null = null;
function loadSeed(): SeedFile {
  if (_seedCache) return _seedCache;
  const raw = readFileSync(join(process.cwd(), "server/data/insightsLaunchSeed.json"), "utf8");
  _seedCache = JSON.parse(raw) as SeedFile;
  return _seedCache;
}

// Canonical category -> routing desk. The 8 launch categories all map here.
const CATEGORY_TEAM: Record<string, RoutingTeam> = {
  "Company / Thought Leadership": "leadership",
  "Healthcare Staffing": "healthcare",
  "IT Staffing": "it",
  "Recruiter Playbook": "recruiting",
  "Candidate Tips": "candidate",
  "Employer Guide": "employer",
  "Staffing Operations": "employer",
  "AI in Recruiting": "ai",
};

// ---------------------------------------------------------------------------
// Senior+ eligibility — the launch guardrail.
// ---------------------------------------------------------------------------
// Anyone whose designation reads junior/associate/fresher/trainee/intern/MIS is
// never eligible. Otherwise a user is "senior+" if they are super_admin, sit at
// a senior hierarchy level, hold a senior role, or carry a senior designation.
const EXCLUDE_DESIGNATION = /junior|associate|fresher|trainee|intern|\bmis\b/i;
const SENIOR_DESIGNATION = /senior|sr\.?|lead|head|principal|manager|director|chief|founder|ceo|cto|coo|\bvp\b|vice\s*president|delivery/i;
const SENIOR_HIERARCHY = new Set(["ceo", "vp", "director", "manager", "team_lead", "delivery_manager"]);
const SENIOR_ROLES = new Set(["super_admin", "admin", "manager", "operations"]);

function isSeniorEligible(u: AdminUser): boolean {
  const designation = u.designation ?? "";
  if (EXCLUDE_DESIGNATION.test(designation)) return false;
  if (u.role === "super_admin") return true;
  if (u.hierarchyLevel && SENIOR_HIERARCHY.has(u.hierarchyLevel)) return true;
  if (SENIOR_ROLES.has(u.role)) return true;
  if (SENIOR_DESIGNATION.test(designation)) return true;
  return false;
}

function deptName(u: AdminUser, deptById: Map<string, string>): string {
  return (u.departmentId && deptById.get(u.departmentId)) || "";
}

// Desk filter for a routing team, applied on top of the senior+ base pool.
function matchesTeam(u: AdminUser, team: RoutingTeam, deptById: Map<string, string>): boolean {
  const ctx = `${deptName(u, deptById)} ${u.designation ?? ""}`;
  const isSuper = u.role === "super_admin";
  const level = u.hierarchyLevel ?? "";
  switch (team) {
    case "leadership":
      return isSuper || level === "ceo" || /founder|ceo|chief|managing\s*director/i.test(ctx);
    case "ai":
      return (
        isSuper ||
        level === "ceo" ||
        level === "director" ||
        /founder|\bai\b|studio|product|chief|head\s*of/i.test(ctx)
      );
    case "healthcare":
      return /health|clinic|nurs|medical|allied/i.test(ctx);
    case "it":
      return /\bit\b|tech|software|developer|engineer|sales|account/i.test(ctx);
    case "employer":
      return (
        /account|delivery|sales|operations|leadership|client|business/i.test(ctx) ||
        ["ceo", "vp", "director"].includes(level)
      );
    case "recruiting":
    case "candidate":
      return /recruit|talent|staffing|delivery|sourc|account/i.test(ctx);
    default:
      return false;
  }
}

interface RoutingRule {
  category: string;
  reviewerUserIds: string[];
}
interface RoutingRules {
  strategy: "least_recently_assigned" | "round_robin";
  defaultReviewerUserIds: string[];
  rules: RoutingRule[];
}

export async function computeLaunchRoutingRules(): Promise<{
  rules: RoutingRules;
  summary: { category: string; team: RoutingTeam; pool: number; fellBack: boolean }[];
}> {
  const users = (await storage.getAdminUsers()).filter((u) => u.isActive !== false);
  const departments: Department[] = await storage.getDepartments();
  const deptById = new Map(departments.map((d) => [d.id, d.name] as const));

  const superAdminIds = users.filter((u) => u.role === "super_admin").map((u) => u.id);
  const seniorBase = users.filter(isSeniorEligible);

  const seed = loadSeed();
  const rules: RoutingRule[] = [];
  const summary: { category: string; team: RoutingTeam; pool: number; fellBack: boolean }[] = [];

  for (const category of seed.categories) {
    const team = CATEGORY_TEAM[category] ?? "recruiting";
    let pool = seniorBase.filter((u) => matchesTeam(u, team, deptById)).map((u) => u.id);
    // Candidate Tips: senior recruiter desk, else Marketing Manager / Super Admin.
    // Every category gets Super Admin as the final fallback.
    let fellBack = false;
    if (pool.length === 0) {
      pool = superAdminIds;
      fellBack = true;
    }
    rules.push({ category, reviewerUserIds: pool });
    summary.push({ category, team, pool: pool.length, fellBack });
  }

  return {
    rules: {
      strategy: "least_recently_assigned",
      defaultReviewerUserIds: superAdminIds,
      rules,
    },
    summary,
  };
}

function resolvePool(rules: RoutingRules | null | undefined, category: string | null): string[] {
  if (!rules) return [];
  if (category && Array.isArray(rules.rules)) {
    const match = rules.rules.find(
      (r) => (r.category ?? "").trim().toLowerCase() === category.trim().toLowerCase(),
    );
    if (match && match.reviewerUserIds.length) return match.reviewerUserIds;
  }
  return rules.defaultReviewerUserIds ?? [];
}

async function pickReviewer(pool: string[]): Promise<string | null> {
  const candidates = pool.filter(Boolean);
  if (candidates.length === 0) return null;
  const times = await storage.getLastStudioAssignmentTimes(candidates);
  let best: string | null = null;
  let bestVal = Infinity;
  for (const id of candidates) {
    const t = times[id];
    const val = t ? new Date(t).getTime() : -1; // never-assigned sorts first
    if (val < bestVal) {
      bestVal = val;
      best = id;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getInsightsProject(): Promise<StudioProject | undefined> {
  const projects = await storage.getStudioProjects();
  return (
    projects.find((p) => p.slug === INSIGHTS_PROJECT_SLUG) ||
    projects.find((p) => p.isPrimary) ||
    projects[0]
  );
}

async function getSeedActorId(): Promise<string | null> {
  const [admin] = (await storage.getAdminUsers()).filter(
    (u) => u.isActive !== false && (u.role === "super_admin" || u.role === "admin"),
  );
  return admin?.id ?? null;
}

function splitAuthor(role: string): { displayName: string; title: string | null } {
  // "Simranjeet Sidana, Founder / CEO" -> name + title; otherwise the role
  // string is the byline display name (e.g. "Sr. Healthcare Recruiter").
  const comma = role.indexOf(",");
  if (comma > 0 && /[A-Z][a-z]+\s+[A-Z]/.test(role.slice(0, comma))) {
    return { displayName: role.slice(0, comma).trim(), title: role.slice(comma + 1).trim() || null };
  }
  return { displayName: role.trim(), title: null };
}

// ---------------------------------------------------------------------------
// 1. Seed the 13 launch articles (idempotent on slug, dry-run aware).
// ---------------------------------------------------------------------------
export async function seedInsightsLaunchArticles(opts: { dryRun?: boolean; actorId?: string | null } = {}) {
  const dryRun = !!opts.dryRun;
  const seed = loadSeed();
  const project = await getInsightsProject();
  if (!project) {
    return { ok: false as const, reason: "no_insights_project", inserted: 0, skipped: 0, wouldInsert: [] as string[] };
  }
  const actorId = opts.actorId ?? (await getSeedActorId());

  // Ensure an author profile exists per unique suggested-author role.
  const existingAuthors = await storage.getStudioAuthorProfiles(project.id);
  const authorByName = new Map(existingAuthors.map((a) => [a.displayName.trim().toLowerCase(), a] as const));
  const uniqueRoles = Array.from(new Set(seed.articles.map((a) => a.suggestedAuthorRole)));
  for (const role of uniqueRoles) {
    const { displayName, title } = splitAuthor(role);
    if (authorByName.has(displayName.trim().toLowerCase())) continue;
    if (dryRun) {
      console.log(`[insights-seed][dry-run] would create author profile: ${displayName}${title ? ` (${title})` : ""}`);
      continue;
    }
    const created = await storage.createStudioAuthorProfile({
      projectId: project.id,
      displayName,
      title,
      isActive: true,
    } as any);
    authorByName.set(displayName.trim().toLowerCase(), created);
  }

  // Existing slugs for this project (idempotency key — clean ASCII, so no
  // Unicode ON CONFLICT pitfall).
  const existingRows = await db
    .select({ slug: studioArticles.slug })
    .from(studioArticles)
    .where(eq(studioArticles.projectId, project.id));
  const existingSlugs = new Set(existingRows.map((r) => (r.slug ?? "").toLowerCase()));

  let inserted = 0;
  let skipped = 0;
  const wouldInsert: string[] = [];

  for (const a of seed.articles) {
    if (existingSlugs.has(a.slug.toLowerCase())) {
      skipped++;
      continue;
    }
    if (dryRun) {
      wouldInsert.push(a.slug);
      console.log(`[insights-seed][dry-run] would insert: ${a.slug} — "${a.title}" [${a.category}]`);
      continue;
    }
    const { displayName } = splitAuthor(a.suggestedAuthorRole);
    const author = authorByName.get(displayName.trim().toLowerCase());
    const created = await storage.createStudioArticle({
      projectId: project.id,
      // The article_status enum has no "reviewer_pending" value; "in_review"
      // is its real-world equivalent and the only status that makes the
      // reviewer inbox + review-decision workflow functional. Never published.
      status: "in_review",
      contentType: "article",
      category: a.category,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      bodyMarkdown: a.bodyMarkdown,
      seoTitle: a.seoTitle,
      seoDescription: a.seoDescription,
      tags: [a.category],
      audience: a.audience,
      suggestedAuthorRole: a.suggestedAuthorRole,
      authorProfileId: author?.id ?? null,
      seedBatchId: INSIGHTS_LAUNCH_SEED_BATCH_ID,
      requiresAuthorApproval: a.requiresAuthorApproval,
      requiresMarketingApproval: a.requiresMarketingApproval,
      createdBy: actorId,
    } as any);
    await storage.createStudioAuditEvent({
      articleId: created.id,
      actorUserId: actorId,
      eventType: "article_seeded",
      metadata: {
        seedBatchId: INSIGHTS_LAUNCH_SEED_BATCH_ID,
        slug: a.slug,
        category: a.category,
        routingTeam: a.routingTeam,
        status: "in_review",
      },
    } as any);
    inserted++;
    existingSlugs.add(a.slug.toLowerCase());
  }

  console.log(
    `[insights-seed]${dryRun ? "[dry-run]" : ""} project=${project.slug} inserted=${inserted} skipped=${skipped} total=${seed.articles.length}`,
  );
  return { ok: true as const, inserted, skipped, wouldInsert, projectId: project.id };
}

// ---------------------------------------------------------------------------
// 2. Apply the Senior+ routing guardrail to the Insights project.
// ---------------------------------------------------------------------------
export async function applyLaunchRoutingGuardrail(opts: { dryRun?: boolean; actorId?: string | null } = {}) {
  const dryRun = !!opts.dryRun;
  const project = await getInsightsProject();
  if (!project) return { ok: false as const, reason: "no_insights_project" };
  const { rules, summary } = await computeLaunchRoutingRules();

  console.log(
    `[insights-routing]${dryRun ? "[dry-run]" : ""} default(super_admin)=${rules.defaultReviewerUserIds.length} ` +
      summary.map((s) => `${s.team}:${s.pool}${s.fellBack ? "(fallback)" : ""}`).join(" "),
  );
  if (dryRun) return { ok: true as const, rules, summary };

  await storage.updateStudioProject(project.id, { routingRules: rules } as any);
  await storage.createStudioAuditEvent({
    articleId: null,
    actorUserId: opts.actorId ?? (await getSeedActorId()),
    eventType: "routing_updated",
    metadata: { source: "insights_launch_guardrail", summary },
  } as any);
  return { ok: true as const, rules, summary };
}

// ---------------------------------------------------------------------------
// 3. Auto-route seeded articles: 2h SLA, manager CC, notification, audit.
// ---------------------------------------------------------------------------
export async function routeLaunchArticles(opts: {
  dryRun?: boolean;
  baseUrl?: string;
  actorId?: string | null;
} = {}) {
  const dryRun = !!opts.dryRun;
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const project = await getInsightsProject();
  if (!project) return { ok: false as const, reason: "no_insights_project", assigned: 0, skipped: 0 };
  const actorId = opts.actorId ?? (await getSeedActorId());

  const articles = await db
    .select()
    .from(studioArticles)
    .where(
      and(
        eq(studioArticles.projectId, project.id),
        eq(studioArticles.seedBatchId, INSIGHTS_LAUNCH_SEED_BATCH_ID),
      ),
    );

  const rules = (project.routingRules ?? null) as RoutingRules | null;
  let assigned = 0;
  let skipped = 0;
  const unrouted: string[] = [];

  for (const article of articles as StudioArticle[]) {
    const existing = await storage.getActiveStudioReviewAssignment(article.id);
    if (existing) {
      skipped++;
      continue;
    }
    const pool = resolvePool(rules, article.category);
    const reviewerUserId = await pickReviewer(pool);
    if (!reviewerUserId) {
      unrouted.push(article.slug ?? article.id);
      if (!dryRun) {
        await storage.createStudioAuditEvent({
          articleId: article.id,
          actorUserId: actorId,
          eventType: "review_unassigned",
          metadata: { reason: "no_reviewer_pool", category: article.category ?? null },
        } as any);
      }
      continue;
    }

    const dueAt = new Date(Date.now() + REVIEW_SLA_MS);
    const reviewer = await storage.getAdminUser(reviewerUserId);
    const manager = reviewer?.managerId ? await storage.getAdminUser(reviewer.managerId) : undefined;

    if (dryRun) {
      console.log(
        `[insights-route][dry-run] ${article.slug} -> ${reviewer?.email ?? reviewerUserId}` +
          (manager?.email ? ` (cc ${manager.email})` : "") +
          ` due ${dueAt.toISOString()}`,
      );
      assigned++;
      continue;
    }

    const assignment = await storage.createStudioReviewAssignment({
      articleId: article.id,
      reviewerUserId,
      status: "pending",
      dueAt,
      assignedBy: actorId ?? null,
      comment: "Auto-assigned for Hire'in Insights pilot launch (2-hour review SLA).",
    } as any);
    await storage.updateStudioArticle(article.id, { reviewerUserId } as any);

    const dueLabel = dueAt.toLocaleString();
    try {
      await storage.createNotification({
        userId: reviewerUserId,
        type: "studio_review_assigned",
        title: "New article to review",
        message: `You have a new article to review: ${article.title} — due ${dueLabel} (2-hour SLA)`,
        isRead: false,
        metadata: { articleId: article.id, assignmentId: assignment.id, link: "/admin/studio/inbox" },
      });
    } catch (notifyErr) {
      console.error("[insights-route] notification error:", notifyErr);
    }

    try {
      if (reviewer?.email) {
        const { sendReviewAssignmentEmail } = await import("./email");
        sendReviewAssignmentEmail({
          to: reviewer.email,
          cc: manager?.email ? [manager.email] : undefined,
          reviewerName: `${reviewer.firstName ?? ""} ${reviewer.lastName ?? ""}`.trim() || reviewer.email,
          articleTitle: article.title,
          excerpt: article.excerpt,
          contentType: article.contentType,
          category: article.category,
          projectName: project.name,
          dueDate: dueLabel,
          reviewUrl: `${baseUrl}/admin/studio/articles/${article.id}/review`,
        }).catch((e) => console.error("[insights-route] email error:", e));
      }
    } catch (emailErr) {
      console.error("[insights-route] email lookup error:", emailErr);
    }

    await storage.createStudioAuditEvent({
      articleId: article.id,
      actorUserId: actorId,
      eventType: "review_assigned",
      metadata: {
        reviewerUserId,
        managerCc: manager?.email ?? null,
        category: article.category ?? null,
        auto: true,
        sla: "2h",
        dueAt: dueAt.toISOString(),
        source: "insights_launch",
      },
    } as any);
    assigned++;
  }

  console.log(
    `[insights-route]${dryRun ? "[dry-run]" : ""} assigned=${assigned} skipped=${skipped}` +
      (unrouted.length ? ` unrouted=${unrouted.join(",")}` : ""),
  );
  return { ok: true as const, assigned, skipped, unrouted };
}

// ---------------------------------------------------------------------------
// 4. Editable Social Kit drafts per article (never auto-posted).
// ---------------------------------------------------------------------------
function buildSocialKitDraft(a: SeedArticle): CanonicalSocialKit {
  // Pull the section headings as checklist takeaways (skip generic closers).
  const headings = a.bodyMarkdown
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.replace(/^##\s+/, "").replace(/^\d+\.\s*/, "").replace(/^Habit\s+\d+:\s*/i, "").trim())
    .filter((h) => !/perspective|final thought|final recruiter reminder/i.test(h));
  const checklist = headings.slice(0, 5);
  const firstSentence = (a.excerpt.split(/(?<=[.!?])\s/)[0] || a.excerpt).replace(/[…]+$/, "").trim();
  const link = "hire-in.com/insights";

  const baseTags = ["#HireinSolutions", "#Staffing", "#Recruiting", "#Insights"];
  const catTag = "#" + a.category.replace(/[^A-Za-z]/g, "");

  const linkedin =
    `${a.title}\n\n${a.excerpt}\n\n` +
    (checklist.length ? `${checklist.map((c) => `• ${c}`).join("\n")}\n\n` : "") +
    `Read the full insight: ${link}`;
  const instagram = `${a.title}\n\n${firstSentence}\n\nMore practical hiring lessons at ${link}`;
  const twitter = `${firstSentence}\n\n${a.cta ?? `Read more: ${link}`}`;

  return {
    captions: [
      { platform: "linkedin", text: linkedin, variants: [] },
      { platform: "instagram", text: instagram, variants: [] },
      { platform: "twitter", text: twitter, variants: [] },
    ],
    thread: [],
    story_frames: [a.title, firstSentence].filter(Boolean).slice(0, 3),
    quote_card_text: firstSentence,
    checklist_card_items: checklist,
    hashtags: {
      linkedin: [...baseTags, catTag],
      instagram: [...baseTags, catTag, "#Careers"],
      twitter: [catTag, "#Hiring"],
    },
    suggested_visual_template: checklist.length >= 3 ? "checklist_card" : "thought_leadership_landscape",
    suggested_card_layout: checklist.length >= 3 ? "checklist" : "landscape",
    suggested_category_badge: a.category,
    quality_notes: {
      risk_flags: [],
      needs_human_review: true,
      suggested_reviewer_role: "Marketing Manager",
      brand_fit_score: 80,
    },
  };
}

export async function generateLaunchSocialKitDrafts(opts: { dryRun?: boolean; actorId?: string | null } = {}) {
  const dryRun = !!opts.dryRun;
  const seed = loadSeed();
  const seedBySlug = new Map(seed.articles.map((a) => [a.slug, a] as const));
  const project = await getInsightsProject();
  if (!project) return { ok: false as const, reason: "no_insights_project", created: 0, skipped: 0 };
  const actorId = opts.actorId ?? (await getSeedActorId());

  const articles = await db
    .select()
    .from(studioArticles)
    .where(
      and(
        eq(studioArticles.projectId, project.id),
        eq(studioArticles.seedBatchId, INSIGHTS_LAUNCH_SEED_BATCH_ID),
      ),
    );

  let created = 0;
  let skipped = 0;
  for (const article of articles as StudioArticle[]) {
    if (article.socialKitJsonb) {
      skipped++;
      continue;
    }
    const seedArticle = article.slug ? seedBySlug.get(article.slug) : undefined;
    if (!seedArticle) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`[insights-social][dry-run] would create social kit draft for ${article.slug}`);
      created++;
      continue;
    }
    const kit = buildSocialKitDraft(seedArticle);
    await storage.updateStudioArticle(article.id, {
      socialKitJsonb: kit,
      cardLayout: kit.suggested_card_layout,
    } as any);
    await storage.createStudioAuditEvent({
      articleId: article.id,
      actorUserId: actorId,
      eventType: "social_kit_generated",
      metadata: {
        source: "insights_launch_draft",
        auto: true,
        requiresMarketingApproval: true,
        autoPosted: false,
      },
    } as any);
    created++;
  }

  console.log(`[insights-social]${dryRun ? "[dry-run]" : ""} created=${created} skipped=${skipped}`);
  return { ok: true as const, created, skipped };
}

// ---------------------------------------------------------------------------
// Orchestrator — runs the full idempotent launch setup at startup.
// ---------------------------------------------------------------------------
export async function runInsightsLaunchSetup(opts: { dryRun?: boolean; baseUrl?: string } = {}) {
  const dryRun = !!opts.dryRun;
  const actorId = await getSeedActorId();
  const seedResult = await seedInsightsLaunchArticles({ dryRun, actorId });
  if (!seedResult.ok) {
    console.warn("[insights-launch] skipped — no Insights project found");
    return seedResult;
  }
  await applyLaunchRoutingGuardrail({ dryRun, actorId });
  await routeLaunchArticles({ dryRun, baseUrl: opts.baseUrl, actorId });
  await generateLaunchSocialKitDrafts({ dryRun, actorId });
  return seedResult;
}

// ---------------------------------------------------------------------------
// 5. One-time Super-Admin "Send launch announcement" broadcast.
// ---------------------------------------------------------------------------
export async function isLaunchAnnouncementSent(): Promise<boolean> {
  const setting = await storage.getSystemSetting(ANNOUNCEMENT_FLAG_KEY);
  return !!setting?.value;
}

export async function sendLaunchAnnouncement(opts: { actorId: string; baseUrl?: string; force?: boolean }) {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  if (!opts.force && (await isLaunchAnnouncementSent())) {
    return { ok: false as const, reason: "already_sent" };
  }

  const activeUsers = (await storage.getAdminUsers()).filter((u) => u.isActive !== false);

  // (a) In-app notification for every active user (drives the unread badge).
  let notified = 0;
  for (const u of activeUsers) {
    try {
      await storage.createNotification({
        userId: u.id,
        type: "insights_launch_announcement",
        title: "Hire'in Insights is live (internal pilot)",
        message:
          "Our first content package is loaded in Content Studio. Articles flow draft → review → approve → publish. " +
          "If you are assigned a review, check your Studio inbox — nothing goes public until a human approves it.",
        isRead: false,
        metadata: { link: "/admin/studio", launch: INSIGHTS_LAUNCH_SEED_BATCH_ID },
      });
      notified++;
    } catch (err) {
      console.error("[insights-announce] notification error:", err);
    }
  }

  // (b) Team-wide email via the existing service, founder CC'd by convention.
  let emailed = false;
  try {
    const { sendInsightsLaunchAnnouncementEmail } = await import("./email");
    const recipients = activeUsers.map((u) => u.email).filter(Boolean);
    const result = await sendInsightsLaunchAnnouncementEmail({
      to: recipients,
      portalUrl: `${baseUrl}/admin/studio`,
    });
    emailed = result.success;
  } catch (err) {
    console.error("[insights-announce] email error:", err);
  }

  await storage.upsertSystemSetting(
    ANNOUNCEMENT_FLAG_KEY,
    { sentAt: new Date().toISOString(), sentBy: opts.actorId, notified, emailed },
    opts.actorId,
  );

  console.log(`[insights-announce] notified=${notified} emailed=${emailed} recipients=${activeUsers.length}`);
  return { ok: true as const, notified, emailed, recipients: activeUsers.length };
}
