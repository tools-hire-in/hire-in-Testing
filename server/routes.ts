import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertContactSchema, insertApplicationSchema, insertJobSchema, insertAdminUserSchema, insertHolidaySchema, insertLeaveTypeSchema, insertLeaveRequestSchema, insertTicketSchema, insertLetterTemplateSentenceSchema, type AdminUser, type InsertHrLetter, type Attendance, type OfferLetter, trackAssignments, trainingExtensionRequests, learningTracks, breakRecords, attendance, attendanceRegularizations, hrLetters, offerLetters, offerLetterAddendums, leaveBalances, leaveAdjustments, leaveTypes, leaveRequests, leaveAccruals, holidays, nightShiftConsents, trackCompletions, trackSections, sectionProgress, departments, shifts, salaryReportRuns, salarySlips, policyAcknowledgements, auditLogs, insertSopDocumentSchema, insertSopReviewAssignmentSchema, insertSopCommentSchema, insertSopAuditRecordSchema, insertSopAuditFindingSchema, sopDocuments, sopRoleAssignments, sopAuditRecords, sopEmployeeProgress, type SopDocument } from "@shared/schema";
import { PERFORMANCE_BAND_SENTENCES, CONDUCT_BAND_SENTENCES, COMPLETION_BAND_SENTENCES, TEMPLATE_PREFIX_MAP as SHARED_TEMPLATE_PREFIX_MAP } from "@shared/hrLetterConstants";
import { companyProfileSchema, mergeCompanyProfile } from "@shared/companyProfile";
import { INDUSTRY_SPECIALTY_MAP } from "@shared/industryMap";
import { db } from "./db";
import { eq, and, inArray, sql, desc, isNull, isNotNull, or } from "drizzle-orm";
import { getCurrentShiftTiming, getAllShiftsWithTiming } from "./shiftUtils";
import { setupSession, requireAuth as requireAuthImported, require2FA } from "./auth";
import { resolveRoles, getEffectiveMatrix, isDbDrivenAccessControl, ACCESS_CONTROL_ROLES, ACCESS_REGISTRY } from "@shared/accessControl";
import { registerAuthRoutes } from "./authRoutes";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage/routes";
import {
  generateArticleCards,
  renderTemplateToPng,
} from "./cardGenerationService";
import {
  resolveCardLayout,
  sampleCardVariables,
  cardBudget,
  CARD_LAYOUTS,
  CARD_PLATFORMS,
  isCardLayout,
} from "@shared/socialCards";
import {
  insertStudioArticleSchema,
  insertStudioAuthorProfileSchema,
  studioArticles,
  performanceGoals,
  type PerformanceGoal,
  type StudioArticle,
  type StudioRoutingRules,
} from "@shared/schema";
import { COMMUNICATION_TYPES } from "@shared/communications";
import { computeReadTime } from "@shared/studioContent";
import { INSIGHT_REACTION_VALUES } from "@shared/insights";
import {
  getComplianceMode,
  type AiGenerationParams,
} from "@shared/studioAi";
import {
  generateArticleDraft,
  generateSocialKit,
  runQualityReview,
  isAiConfigured,
  AiGenerationError,
} from "./services/aiDraftService";
import { z } from "zod";
// express-rate-limit kept for other potential uses; verify endpoint uses a
// custom sliding-window implementation (see slidingWindowVerifyLimiter below).
import { verifyInputSchema } from "@shared/verifySchema";
import { sendInvitationEmail, sendWelcomeEmail, sendSalaryReport, sendSalaryReportDispatch, sendDocumentReminderEmail, sendOfferLetterEmail, sendOnboardingWelcomeEmail, sendRayoAcademyCredentialsEmail, sendHrLetterEmail, sendAddendumEmail, sendAddendumReminderEmail, sendAddendumAcceptedEmail, sendOfferLetterPendingApprovalEmail, sendOfferLetterApprovalDecisionEmail, sendLeaveAppliedEmail, sendLeaveDecisionEmail, sendStudioPublishedEmail, sendStudioRejectionEmail, sendStudioAuthorSignOffEmail, sendNewsletterWelcomeEmail, type SalaryReportAdjustment } from "./email";
import { notifyNewContentSubscribers, makeUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrlFor, insightsUrl, NEWSLETTER_FLAG_KEY } from "./newsletterService";
import { generateMonthlySalaryReport } from "./salaryReport";
import crypto from "crypto";
import path from "path";
import { signHrLetter as _signHrLetter, signOfferLetterAcceptance as _signOfferLetterAcceptance, recordSignature } from "./documentSigningService";
import * as sopGov from "./sopGovernance";
import { syncSopProgressForUser, impactedUserIdsForSop, backfillAllSopProgress } from "./sopAssignmentEngine";
import * as sopRollout from "./sopRollout";
import fs from "fs";
import { syncCeipalJobs, pushApplicantToCeipal } from "./ceipalService";
import { generateOfferLetterDocx, type OfferLetterData } from "./offerLetter";
import { POLICY_ANNEXURES } from "./annexureContent";
import { generateAddendumDocx, generateClauseDocx, type AddendumData } from "./offerLetterAddendum";
import {
  OFFER_CLAUSE_CATEGORY, OFFER_CLAUSE_KEY, OFFER_CLAUSE_DEFAULT_TEXT,
  ADDENDUM_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_KEY, ADDENDUM_CLAUSE_DEFAULT_TEXT,
  renderOfferClause, renderAddendumClause,
} from "@shared/performanceClauses";
import { generateHrLetterPdf } from "./hrLetterPdf";
import { generateSopMbrPdf } from "./sopMbrPdf";
import { registerOnboardingRoutes } from "./onboardingRoutes";
import { registerPerformanceRoutes, ensureGrowthPlanFromAddendum, ensurePlanFromDocument, resolveAttachedPlanGoals, seedPlanGoals, generatePlanCheckIns, normalizeGoalCategory, type AttachablePlanType } from "./performanceRoutes";
import { registerContractRoutes } from "./contractRoutes";
import { registerPraiseRoutes, seedPraiseBadgeTypes } from "./praiseRoutes";
import { registerPolicySigningRoutes } from "./policySigningRoutes";
import { registerAttendanceReportRoutes } from "./attendanceReportRoutes";
import { registerReleaseNotesRoutes } from "./releaseNotesRoutes";
import { registerHelpDeskRoutes } from "./helpDeskRoutes";
import { registerSalaryAdvanceRoutes, applyAdvanceRecoveriesForRun, applyCreditsForRun } from "./salaryAdvanceRoutes";
import { registerAttendanceExceptionRoutes, createExceptionForShortDay, checkEscalationTiers } from "./attendanceExceptionRoutes";
import { registerTravelRoutes } from "./travelRoutes";
import { provisionRayoUser, isRayoEnabled } from "./rayoAcademyClient";
import { registerTrainingCatalogRoutes } from "./trainingCatalogRoutes";
import { trainingSopLinks, roleTrainingRules } from "@shared/schema";
import { tokenLookupLimiter, verifyLetterLimiter } from "./rateLimits";

const upload = multer({ storage: multer.memoryStorage() });

const DEPT_ABBREVIATIONS: Record<string, string> = {
  "information technology": "IT", "it": "IT", "technology": "IT",
  "human resources": "HR", "hr": "HR",
  "engineering": "ENG", "eng": "ENG",
  "operations": "OPS", "ops": "OPS",
  "finance": "FIN", "fin": "FIN",
  "marketing": "MKT", "mkt": "MKT",
  "sales": "SLS", "sls": "SLS",
  "administration": "ADM", "admin": "ADM",
  "legal": "LGL", "lgl": "LGL",
  "healthcare": "HC", "health care": "HC",
  "delivery": "DLV", "dlv": "DLV",
  "recruitment": "REC", "rec": "REC",
  "accounts": "ACC", "acc": "ACC",
  "management": "MGT", "mgt": "MGT",
};

const COOL_WORDS = [
  "NOVA","LYNX","BOLT","ARIA","SAGE","FLUX","ONYX","APEX","ECHO","LUNA",
  "NEON","VIBE","RUNE","AURA","BLIZ","VOLT","ZENO","ORBI","JADE","IRIS",
  "HAWK","FANG","DUSK","CODA","BYTE","AXON","WREN","VALE","TUSK","SPIN",
  "RIFT","QUIL","PYRE","OPAL","MYTH","LARK","KNOT","JINX","HAZE","GRIT",
  "FURY","ELMS","DIVE","CYAN","BRIM","AMPL","ZEST","YUZU","XION","WISP",
  "TIDE","SOUL","RAZE","PEAK","OMNI","NOVA","MIST","LINK","KITE","JAZZ",
  "IRON","HELM","GLOW","FINN","EDGE","DUNE","CORE","BLOX","ATOM","ZERO",
  "YOGI","XENO","WAVE","VOID","UNIT","TREK","STAR","RUST","QUIX","PYRO",
  "OXID","NEXU","MARS","LYRA","KODA","JOLT","ICON","HYPR","GRID","FUSE",
  "EPIC","DART","CRUX","BIOS","AXLE","ZION","YARA","XRAY","WING","VEGA",
  "URSA","TRON","SILO","RIOT","QUAD","PIXL","ORYX","NUKE","MODE","LUSH",
  "KEEN","JUST","ISLE","HIVE","GALE","FIRE","ENIG","DAWN","CLAY","BANE",
  "ALFA","ZINC","YOKE","XIST","WARP","VINE","UPRA","TORC","SURF","ROOK",
  "POLO","NOIR","MEGA","LAVA","KAON","JEDI","IBIS","HORA","GIZA","FLAM",
  "ELAN","DOJO","CHIP","BOHR","ANSI","ZEPP","YANG","XION","WASP","VORTX",
  "UMBR","TIKI","STYX","RHEN","QSAR","PHON","OBOE","NERD","MESA","LOOM",
  "KOEL","JIVY","IKON","HYPO","GUST","FIZZ","EXPO","DRAX","COAX","BARD",
  "ARCH","ZEAL","YAWL","XACT","WHIZ","VEER","ULNA","TURB","SPAR","RIFF",
  "QUAY","PLUM","OPUS","NULL","MOXO","LOOP","KUBO","JOBI","INKY","HULK",
  "GRIN","FRAY","EMIT","DRAM","CUSP","BREW","AVID","ZETA","YARN","XENA",
];

async function generateEmployeeId(departmentName: string | null): Promise<string> {
  let abbrev = "GEN";
  if (departmentName) {
    const lower = departmentName.toLowerCase().trim();
    abbrev = DEPT_ABBREVIATIONS[lower] || departmentName.substring(0, 3).toUpperCase();
  }

  const prefix = `HIS-${abbrev}-`;

  const allUsers = await storage.getAdminUsers();
  const usedWords = new Set(
    allUsers
      .map(u => u.employeeId)
      .filter(id => id && id.startsWith(prefix))
      .map(id => id!.substring(prefix.length))
  );

  const available = COOL_WORDS.filter(w => !usedWords.has(w));

  let word: string;
  if (available.length > 0) {
    word = available[Math.floor(Math.random() * available.length)];
  } else {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    do {
      word = "";
      for (let i = 0; i < 4; i++) {
        word += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (usedWords.has(word));
  }

  return `${prefix}${word}`;
}
const objectStorageService = new ObjectStorageService();

// Fetch the managed (Admin-editable) template text for a performance clause,
// falling back to the seeded default if the row is missing.
async function getManagedClauseText(category: string, key: string, fallback: string): Promise<string> {
  try {
    const rows = await storage.getLetterTemplateSentences(category);
    const match = rows.find((r) => r.key === key);
    return match?.sentence?.trim() ? match.sentence : fallback;
  } catch {
    return fallback;
  }
}

// Neutral note stamped on a punch when the employee has no shift assigned. The
// punch is still recorded (never blocked); the note flags that on-time / late
// tracking cannot be computed until a shift is assigned.
const NO_SHIFT_PUNCH_NOTE = "No shift configured — punch recorded; assign a shift to enable on-time tracking.";

function employeeDisplayName(user: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined): string {
  if (!user) return "An employee";
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email || "An employee";
}

/**
 * Record an attendance exception (late punch-in, early logout, overtime) to the
 * audit trail and notify the employee's manager via an in-app notification.
 * The notification respects the global `notifications_enabled` feature flag; the
 * audit entry is always written. All failures are swallowed so they can never
 * block a punch.
 */
async function recordAttendanceException(opts: {
  employeeId: string;
  managerId: string | null;
  action: string;
  changes: Record<string, unknown>;
  title: string;
  message: string;
}): Promise<void> {
  try {
    await storage.createAuditLog({
      actorId: opts.employeeId,
      targetId: opts.employeeId,
      action: opts.action,
      changes: opts.changes,
    });
  } catch (err) {
    console.error("[attendance-exception] audit log failed:", err);
  }
  try {
    if (!opts.managerId) return;
    const setting = await storage.getSystemSetting("feature_flags");
    const flags = (setting?.value as Record<string, boolean>) || {};
    if (!flags.notifications_enabled) return;
    await storage.createNotification({
      userId: opts.managerId,
      title: opts.title,
      message: opts.message,
      type: "warning",
    });
  } catch (err) {
    console.error("[attendance-exception] manager notification failed:", err);
  }
}

/**
 * Tiered late-arrival escalation (monthly count, not consecutive):
 *
 *  3rd late in month  → notify Manager only           (first warning)
 *  6th late in month  → notify Manager + HR + Admin   (escalation)
 *
 * Fires only at the exact threshold crossing so recipients aren't spammed.
 * All failures are swallowed — this must never block a punch.
 */
async function checkMonthlyLatesAndNotify(opts: {
  employeeId: string;
  managerId: string | null;
  employeeName: string;
}): Promise<void> {
  try {
    const setting = await storage.getSystemSetting("feature_flags");
    const flags = (setting?.value as Record<string, boolean>) || {};
    if (!flags.notifications_enabled) return;

    // Count late punch-ins in the current calendar month.
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = now.toISOString().split("T")[0];
    const monthRecords = await storage.getAttendanceByUser(opts.employeeId, monthStart, today);
    const monthlyLates = monthRecords.filter(
      (r) => r.punchIn && r.notes && r.notes.includes("[Auto] Late punch-in")
    ).length;

    // Only act at exact threshold crossings to avoid notification spam.
    const MANAGER_THRESHOLD = 3;   // 3rd late → manager only
    const ESCALATION_THRESHOLD = 6; // 6th late → manager + HR + Admin

    let tier: "manager" | "escalation" | null = null;
    if (monthlyLates === MANAGER_THRESHOLD) tier = "manager";
    else if (monthlyLates === ESCALATION_THRESHOLD) tier = "escalation";
    if (!tier) return;

    const allUsers = await storage.getAdminUsers();

    const recipients: string[] = [];
    // Manager always gets notified at both tiers.
    if (opts.managerId) recipients.push(opts.managerId);

    if (tier === "escalation") {
      // Add HR and Admin users at escalation tier.
      for (const u of allUsers) {
        if ((u.role === "hr" || u.role === "admin" || u.role === "super_admin") &&
            !recipients.includes(u.id)) {
          recipients.push(u.id);
        }
      }
    }

    const tierLabel = tier === "escalation" ? "⚠️ Escalation" : "Warning";
    const title = `[${tierLabel}] Late Arrivals — ${opts.employeeName}`;
    const message =
      tier === "manager"
        ? `${opts.employeeName} has been late ${monthlyLates} times this month. Please speak with them directly.`
        : `${opts.employeeName} has now been late ${monthlyLates} times this month. This has been escalated to HR and Admin for review.`;

    for (const recipientId of recipients) {
      try {
        await storage.createNotification({
          userId: recipientId,
          title,
          message,
          type: "warning",
        });
      } catch { /* non-fatal */ }
    }

    try {
      await storage.createAuditLog({
        actorId: opts.employeeId,
        targetId: opts.employeeId,
        action: tier === "escalation" ? "attendance_late_escalated" : "attendance_late_warning",
        changes: { monthlyLates, tier, employeeName: opts.employeeName },
      });
    } catch { /* non-fatal */ }
  } catch { /* non-fatal */ }
}

/**
 * ROLE-BASED ACCESS CONTROL (RBAC) DOCUMENTATION
 * 
 * Role Hierarchy (highest to lowest):
 * - super_admin: Full access to everything, including user management
 * - admin: Full access to all operational routes (jobs, applications, contacts) but NOT user management
 * - hr: Access to applications and contacts only
 * - operations: Access to jobs only  
 * - employee: Dashboard access only (view stats)
 * 
 * Policy: super_admin and admin are omnipotent for operational routes.
 * Only super_admin can manage team members.
 */

// Middleware to check if user has admin-level access (super_admin or admin only)
function requireAdminLevel(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userRole = req.session.role;
  if (userRole === "super_admin" || userRole === "admin") {
    next();
  } else {
    return res.status(403).json({ error: "Admin access required" });
  }
}

// Middleware for any authenticated admin portal user
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Centralized permission middleware — resolves allowed roles via the central
// access registry (ACCESS_REGISTRY). super_admin and admin are auto-granted.
// The trailing role list is the defensive default seed for resolveRoles.
function requirePermission(featureKey: string, ...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const allowed = resolveRoles(featureKey, Array.from(new Set(["super_admin", "admin", ...allowedRoles])));
    if (allowed.includes(req.session.role!)) {
      return next();
    }
    return res.status(403).json({ error: "Insufficient permissions" });
  };
}

function parseDateString(dateStr: string, year: number): string | null {
  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  };

  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;

  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const y = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
    return `${y}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
  }

  const namedMatch = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?$/i);
  if (namedMatch) {
    const month = monthNames[namedMatch[1].toLowerCase()];
    if (month) {
      const day = namedMatch[2].padStart(2, "0");
      const y = namedMatch[3] || String(year);
      return `${y}-${String(month).padStart(2, "0")}-${day}`;
    }
  }

  const dayMonthMatch = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s*,?\s*(\d{4}))?$/i);
  if (dayMonthMatch) {
    const month = monthNames[dayMonthMatch[2].toLowerCase()];
    if (month) {
      const day = dayMonthMatch[1].padStart(2, "0");
      const y = dayMonthMatch[3] || String(year);
      return `${y}-${String(month).padStart(2, "0")}-${day}`;
    }
  }

  return null;
}

/**
 * Ensure a probation-extension addendum is reflected as an employee_plans row so
 * the extended employee surfaces in the Employee Plans dashboard. Without this,
 * probation extensions generated via the Letter Generator never created a plan
 * row, so extended employees were invisible there.
 *
 * Behaviour:
 *  - Resolves an employee id (directly, or via an existing offer-letter-linked plan).
 *  - Marks any open (pending/active) probation plan for that employee as extended.
 *  - Inserts a new active probation plan covering the extension window, unless an
 *    identical one already exists (idempotent against regenerated addendums).
 * All failures are non-fatal — addendum creation must never be blocked by this.
 */
async function ensureProbationExtensionPlan(opts: {
  employeeId?: string | null;
  offerLetterId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdBy: string;
}): Promise<void> {
  let employeeId = opts.employeeId ?? null;
  const { offerLetterId, createdBy } = opts;
  const startDate = opts.startDate || new Date().toISOString().slice(0, 10);
  const endDate = opts.endDate || null;
  if (!endDate) return; // no extended confirmation date — nothing to plan

  if (!employeeId && offerLetterId) {
    const r = await db.execute(sql`
      SELECT employee_id FROM employee_plans
      WHERE offer_letter_id = ${offerLetterId} AND employee_id IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `);
    employeeId = ((r.rows[0] as any)?.employee_id as string | undefined) ?? null;
  }
  if (!employeeId) return; // cannot link a plan without a system employee

  // Close any currently-open probation plan as extended.
  await db.execute(sql`
    UPDATE employee_plans
    SET status = 'extended', outcome = 'extended', updated_at = NOW()
    WHERE employee_id = ${employeeId} AND plan_type = 'probation' AND status IN ('pending', 'active')
  `);

  // Idempotency: skip if an identical extension plan already exists.
  const dup = await db.execute(sql`
    SELECT id FROM employee_plans
    WHERE employee_id = ${employeeId} AND plan_type = 'probation' AND end_date = ${endDate}
    LIMIT 1
  `);
  if (dup.rows.length > 0) return;

  const durationDays = Math.max(
    0,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)),
  );
  await db.execute(sql`
    INSERT INTO employee_plans
      (employee_id, manager_id, plan_type, department_scope, status, start_date, end_date, duration_days, created_by)
    VALUES
      (${employeeId}, NULL, 'probation', 'healthcare', 'active', ${startDate}, ${endDate}, ${durationDays}, ${createdBy})
  `);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup session-based authentication (must be before other routes)
  setupSession(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);

  // Enforce 2FA for all admin/HR API routes
  app.use("/api/admin", require2FA);
  app.use("/api/hr", require2FA);
  
  // ==========================================
  // PUBLIC API ROUTES
  // ==========================================

  const SAFE_RAW_DATA_KEYS = [
    "primary_skills", "secondary_skills", "tax_terms", "work_authorization",
    "experience", "number_of_positions", "required_hours_week", "shift",
  ];

  function sanitizePublicJob(job: any) {
    const { rawData, billRate, facility, ...rest } = job;
    return rest;
  }

  function sanitizePublicJobDetail(job: any) {
    const { rawData, billRate, facility, ...rest } = job;
    const extraFields: Record<string, any> = {};
    if (rawData && typeof rawData === "object") {
      for (const key of SAFE_RAW_DATA_KEYS) {
        if (rawData[key] !== undefined) extraFields[key] = rawData[key];
      }
    }
    return { ...rest, ...extraFields };
  }

  // Strip internal workflow/compliance fields from a published insight before
  // exposing it on the public surface. Only the checklist items are surfaced
  // from the social kit; the rest of the kit is internal.
  function sanitizePublicInsight(a: any) {
    const kit = a.socialKitJsonb && typeof a.socialKitJsonb === "object" ? a.socialKitJsonb : null;
    const checklistItems: string[] = Array.isArray(kit?.checklist_card_items)
      ? kit.checklist_card_items.filter((s: any) => typeof s === "string" && s.trim())
      : [];
    return {
      id: a.id,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      bodyMarkdown: a.bodyMarkdown,
      category: a.category,
      contentType: a.contentType,
      coverImageUrl: a.coverImageUrl,
      ogImageUrl: a.ogImageUrl,
      seoTitle: a.seoTitle,
      seoDescription: a.seoDescription,
      tags: a.tags ?? [],
      readTimeMinutes: a.readTimeMinutes,
      publishedAt: a.publishedAt,
      updatedAt: a.updatedAt,
      checklistItems,
      // Only expose the author card when the profile is marked complete; this prevents
      // incomplete placeholder profiles from showing on public articles.
      author: (a.authorName && a.authorProfileComplete)
        ? {
            name: a.authorName,
            title: a.authorTitle ?? null,
            bio: a.authorBio ?? null,
            photoUrl: a.authorPhotoUrl ?? null,
            linkedinUrl: a.authorLinkedinUrl ?? null,
            slug: a.authorSlug ?? null,
            profileComplete: true,
          }
        : null,
    };
  }

  // Dynamic sitemap — includes all static marketing pages + active job detail pages
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const BASE = "https://hire-in.com";
      const today = new Date().toISOString().slice(0, 10);

      const staticPages = [
        { loc: "/", changefreq: "weekly", priority: "1.0", lastmod: "2026-06-11" },
        { loc: "/about", changefreq: "monthly", priority: "0.8", lastmod: "2026-06-11" },
        { loc: "/contracts", changefreq: "monthly", priority: "0.8", lastmod: "2026-06-16" },
        { loc: "/jobs", changefreq: "daily", priority: "0.9", lastmod: today },
        { loc: "/contact", changefreq: "monthly", priority: "0.8", lastmod: "2026-06-11" },
        { loc: "/services/healthcare-recruitment", changefreq: "monthly", priority: "0.9", lastmod: "2026-06-11" },
        { loc: "/services/it-software", changefreq: "monthly", priority: "0.9", lastmod: "2026-06-11" },
        { loc: "/services/engineering-technical", changefreq: "monthly", priority: "0.8", lastmod: "2026-06-11" },
        { loc: "/services/non-it-professional", changefreq: "monthly", priority: "0.8", lastmod: "2026-06-11" },
        { loc: "/services/contract-staffing", changefreq: "monthly", priority: "0.8", lastmod: "2026-06-11" },
        { loc: "/it-staffing", changefreq: "monthly", priority: "0.9", lastmod: "2026-06-11" },
        { loc: "/ehealthcare-staffing", changefreq: "monthly", priority: "0.9", lastmod: "2026-06-11" },
        { loc: "/capability-deck", changefreq: "monthly", priority: "0.7", lastmod: "2026-06-11" },
        { loc: "/why-hire-in-solutions", changefreq: "monthly", priority: "0.9", lastmod: "2026-06-11" },
        { loc: "/it-staffing-guide", changefreq: "monthly", priority: "0.9", lastmod: "2026-06-11" },
        { loc: "/healthcare-staffing-guide", changefreq: "monthly", priority: "0.9", lastmod: "2026-06-11" },
        { loc: "/staffing-faq", changefreq: "monthly", priority: "0.9", lastmod: "2026-06-11" },
        { loc: "/request-a-quote", changefreq: "monthly", priority: "0.9", lastmod: "2026-06-11" },
        { loc: "/terms", changefreq: "yearly", priority: "0.4", lastmod: "2026-06-11" },
        { loc: "/privacy", changefreq: "yearly", priority: "0.4", lastmod: "2026-06-11" },
        { loc: "/verify", changefreq: "yearly", priority: "0.3", lastmod: "2026-06-11" },
      ];

      const jobResult = await storage.getActiveJobs({ pageSize: 1000 });
      const jobEntries = jobResult.jobs.map((job) => {
        const lastmod = job.updatedAt
          ? new Date(job.updatedAt).toISOString().slice(0, 10)
          : today;
        return { loc: `/jobs/${job.id}`, changefreq: "weekly", priority: "0.7", lastmod };
      });

      const insightSlugs = await storage.getPublishedInsightSlugs();
      const insightEntries = insightSlugs.map((a) => {
        const stamp = a.publishedAt ?? a.updatedAt;
        const lastmod = stamp ? new Date(stamp).toISOString().slice(0, 10) : today;
        return { loc: `/insights/${a.slug}`, changefreq: "monthly", priority: "0.7", lastmod };
      });

      const allEntries = [
        ...staticPages,
        { loc: "/insights", changefreq: "weekly", priority: "0.8", lastmod: today },
        ...insightEntries,
        ...jobEntries,
      ];
      const urlNodes = allEntries
        .map(
          (e) =>
            `  <url>\n    <loc>${BASE}${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
        )
        .join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlNodes}\n</urlset>`;
      res.set("Content-Type", "application/xml").end(xml);
    } catch (error) {
      console.error("Failed to generate sitemap:", error);
      res.status(500).end("Internal Server Error");
    }
  });

  // ==========================================
  // PUBLIC INSIGHTS (Content Studio read path)
  // Only published Hire'in articles (publishesToInsights) are exposed.
  // ==========================================

  // List published insights, optionally filtered by category.
  app.get("/api/insights", async (req, res) => {
    try {
      const category =
        typeof req.query.category === "string" && req.query.category.trim()
          ? req.query.category.trim()
          : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 12;

      const { items, total } = await storage.getPublishedInsights({
        category,
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 12,
      });

      res.set("Cache-Control", "public, max-age=300");
      res.json({ items: items.map(sanitizePublicInsight), total });
    } catch (error) {
      console.error("Failed to list insights:", error);
      res.status(500).json({ message: "Failed to load insights" });
    }
  });

  // Single published insight by slug, with related articles.
  app.get("/api/insights/:slug", async (req, res) => {
    try {
      const article = await storage.getPublishedInsightBySlug(req.params.slug);
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }
      const related = await storage.getRelatedInsights(article.id, article.category, 3);
      res.set("Cache-Control", "public, max-age=300");
      res.json({
        article: sanitizePublicInsight(article),
        related: related.map(sanitizePublicInsight),
      });
    } catch (error) {
      console.error("Failed to load insight:", error);
      res.status(500).json({ message: "Failed to load article" });
    }
  });

  // ---- Public reader reactions (no auth) ----
  // Stable-but-anonymous identity: we store an opaque anonId in the session and
  // attribute reactions to an HMAC of it (never the raw id). No anonId is
  // created on read — only when a visitor actually reacts.
  function hashSessionAnonId(anonId: string): string {
    return crypto
      .createHmac("sha256", process.env.SESSION_SECRET || "insights-reaction-secret")
      .update(anonId)
      .digest("hex");
  }

  const reactSchema = z.object({
    reactionType: z.enum(INSIGHT_REACTION_VALUES as [string, ...string[]]),
  });

  // Reaction counts for an article + the current session's reaction (if any).
  app.get("/api/insights/:articleId/reactions", async (req, res) => {
    try {
      const counts = await storage.getArticleReactionCounts(req.params.articleId);
      let userReaction: string | null = null;
      if (req.session?.anonId) {
        const existing = await storage.getUserArticleReaction(
          req.params.articleId,
          hashSessionAnonId(req.session.anonId),
        );
        userReaction = existing?.reactionType ?? null;
      }
      res.json({ counts, userReaction });
    } catch (error) {
      console.error("Failed to load reactions:", error);
      res.status(500).json({ message: "Failed to load reactions" });
    }
  });

  // Toggle a reaction for the current session. One reaction per session per
  // article: same type toggles off, a different type switches.
  app.post("/api/insights/:articleId/react", async (req, res) => {
    try {
      const parsed = reactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid reaction type" });
      }

      const published = await storage.isInsightPublished(req.params.articleId);
      if (!published) {
        return res.status(404).json({ message: "Article not found" });
      }

      if (!req.session.anonId) {
        req.session.anonId = crypto.randomUUID();
      }
      const sessionHash = hashSessionAnonId(req.session.anonId);

      const result = await storage.toggleArticleReaction(
        req.params.articleId,
        sessionHash,
        parsed.data.reactionType,
      );

      // Append to the studio audit trail so the analytics dashboard can chart
      // reaction trends. A switch emits a removed (old) + added (new) pair.
      if (result.action === "switched") {
        await storage.createStudioAuditEvent({
          articleId: req.params.articleId,
          eventType: "reaction_removed",
          metadata: { action: "removed", reactionType: result.previousType },
        });
        await storage.createStudioAuditEvent({
          articleId: req.params.articleId,
          eventType: "reaction_added",
          metadata: { action: "added", reactionType: result.reactionType },
        });
      } else {
        await storage.createStudioAuditEvent({
          articleId: req.params.articleId,
          eventType: result.action === "removed" ? "reaction_removed" : "reaction_added",
          metadata: { action: result.action, reactionType: result.reactionType },
        });
      }

      const counts = await storage.getArticleReactionCounts(req.params.articleId);
      const userReaction = result.action === "removed" ? null : result.reactionType;
      res.json({ counts, userReaction });
    } catch (error) {
      console.error("Failed to record reaction:", error);
      res.status(500).json({ message: "Failed to record reaction" });
    }
  });

  // Record an article view for the analytics dashboard. Rate-limited to one
  // counted view per session per article per hour (tracked in the session) so a
  // single reader refreshing does not inflate the view count.
  const VIEW_WINDOW_MS = 60 * 60 * 1000;
  app.post("/api/insights/:articleId/view", async (req, res) => {
    try {
      const published = await storage.isInsightPublished(req.params.articleId);
      if (!published) {
        return res.status(404).json({ message: "Article not found" });
      }

      const now = Date.now();
      const seen = (req.session.studioViews ?? {}) as Record<string, number>;
      const last = seen[req.params.articleId];
      if (last && now - last < VIEW_WINDOW_MS) {
        return res.json({ counted: false });
      }
      seen[req.params.articleId] = now;
      req.session.studioViews = seen;

      await storage.createStudioAuditEvent({
        articleId: req.params.articleId,
        eventType: "article_viewed",
        metadata: null,
      });
      res.json({ counted: true });
    } catch (error) {
      console.error("Failed to record view:", error);
      res.status(500).json({ message: "Failed to record view" });
    }
  });

  // Record a CTA click on a published article for the analytics dashboard.
  app.post("/api/insights/:articleId/cta-click", async (req, res) => {
    try {
      const published = await storage.isInsightPublished(req.params.articleId);
      if (!published) {
        return res.status(404).json({ message: "Article not found" });
      }
      const href = typeof req.body?.href === "string" ? req.body.href.slice(0, 512) : null;
      await storage.createStudioAuditEvent({
        articleId: req.params.articleId,
        eventType: "cta_clicked",
        metadata: href ? { href } : null,
      });
      res.json({ counted: true });
    } catch (error) {
      console.error("Failed to record CTA click:", error);
      res.status(500).json({ message: "Failed to record CTA click" });
    }
  });

  // ==========================================
  // PUBLIC AUTHOR DIRECTORY
  // ==========================================

  // All active authors with profileComplete = true for the public directory.
  app.get("/api/public/authors", async (_req, res) => {
    try {
      const authors = await storage.getStudioAuthorProfiles(undefined);
      const active = authors.filter((a) => a.isActive && (a as any).profileComplete);
      // Attach published article count per author.
      const publishedAll = await storage.getPublishedInsights({ page: 1, pageSize: 1000 });
      const countByAuthorId: Record<string, number> = {};
      for (const art of publishedAll.items) {
        if ((art as any).authorProfileId) {
          countByAuthorId[(art as any).authorProfileId] =
            (countByAuthorId[(art as any).authorProfileId] ?? 0) + 1;
        }
      }
      res.set("Cache-Control", "public, max-age=300");
      res.json(active.map((a) => ({
        id: a.id,
        displayName: a.displayName,
        publicTitle: (a as any).publicTitle ?? a.title ?? null,
        bio: a.bio ?? null,
        photoUrl: a.photoUrl ?? null,
        linkedinUrl: a.linkedinUrl ?? null,
        specialties: (a as any).specialties ?? [],
        slug: (a as any).slug ?? a.id,
        articleCount: countByAuthorId[a.id] ?? 0,
      })));
    } catch (error) {
      console.error("Public authors error:", error);
      res.status(500).json({ message: "Failed to load authors" });
    }
  });

  // Individual author page: profile + their published articles.
  app.get("/api/public/authors/:slug", async (req, res) => {
    try {
      const authors = await storage.getStudioAuthorProfiles(undefined);
      const author = authors.find((a) => (a as any).slug === req.params.slug || a.id === req.params.slug);
      if (!author || !author.isActive || !(author as any).profileComplete) {
        return res.status(404).json({ message: "Author not found" });
      }
      const publishedArticles = await storage.getPublishedInsights({ page: 1, pageSize: 100 });
      const authorArticles = publishedArticles.items.filter(
        (a: any) => a.authorProfileId === author.id,
      );
      res.set("Cache-Control", "public, max-age=300");
      res.json({
        author: {
          id: author.id,
          displayName: author.displayName,
          publicTitle: (author as any).publicTitle ?? author.title ?? null,
          bio: author.bio ?? null,
          photoUrl: author.photoUrl ?? null,
          linkedinUrl: author.linkedinUrl ?? null,
          specialties: (author as any).specialties ?? [],
          slug: (author as any).slug ?? author.id,
        },
        articles: authorArticles,
      });
    } catch (error) {
      console.error("Public author detail error:", error);
      res.status(500).json({ message: "Failed to load author" });
    }
  });

  // ==========================================
  // NEWSLETTER (public subscribe / unsubscribe / SendGrid events)
  // ==========================================

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Single opt-in subscribe. Subscriber is active immediately.
  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const raw = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!raw || !EMAIL_RE.test(raw) || raw.length > 254) {
        return res.status(400).json({ status: "invalid", message: "Please enter a valid email address." });
      }

      const baseUrl = baseUrlFrom(req);
      const existing = await storage.getNewsletterSubscriberByEmail(raw);

      if (existing) {
        const isActive = !existing.unsubscribedAt && !existing.suppressedAt;
        if (isActive) {
          return res.json({ status: "already_subscribed", message: "You're already subscribed" });
        }
        // Reactivate a previously unsubscribed/suppressed subscriber.
        const reactivated = await storage.updateNewsletterSubscriber(existing.id, {
          unsubscribedAt: null,
          suppressedAt: null,
          bounceCount: 0,
          lastBounceAt: null,
          confirmedAt: new Date(),
        });
        const subId = reactivated?.id ?? existing.id;
        sendNewsletterWelcomeEmail({
          to: raw,
          unsubscribeUrl: unsubscribeUrlFor(subId, baseUrl),
          insightsUrl: insightsUrl(baseUrl),
        }).catch((e) => console.error("Welcome email (reactivate) failed:", e));
        return res.json({ status: "subscribed", message: "You're subscribed!" });
      }

      const created = await storage.createNewsletterSubscriber({
        email: raw,
        confirmedAt: new Date(),
      } as any);
      sendNewsletterWelcomeEmail({
        to: raw,
        unsubscribeUrl: unsubscribeUrlFor(created.id, baseUrl),
        insightsUrl: insightsUrl(baseUrl),
      }).catch((e) => console.error("Welcome email failed:", e));
      return res.json({ status: "subscribed", message: "You're subscribed!" });
    } catch (error) {
      console.error("Newsletter subscribe error:", error);
      res.status(500).json({ status: "error", message: "Something went wrong. Please try again." });
    }
  });

  // One-click unsubscribe via signed token. Renders a simple HTML page.
  app.get("/api/newsletter/unsubscribe/:token", async (req, res) => {
    const renderPage = (heading: string, body: string) =>
      `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Hire'in Insights</title>
        <style>
          body{margin:0;font-family:'Inter','Segoe UI',Arial,sans-serif;background:#f2f4f7;color:#1e293b;}
          .wrap{max-width:520px;margin:64px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,.08);}
          .hd{background:linear-gradient(135deg,#1F3A6E 0%,#F47C20 100%);padding:28px;text-align:center;color:#fff;}
          .hd h1{margin:0;font-size:22px;font-weight:700;}
          .bd{padding:32px;text-align:center;}
          .bd h2{margin:0 0 12px;font-size:20px;}
          .bd p{color:#475569;line-height:1.6;margin:0 0 20px;}
          .btn{display:inline-block;background:#1F3A6E;color:#fff;text-decoration:none;padding:11px 26px;border-radius:6px;font-weight:600;}
        </style></head>
        <body><div class="wrap"><div class="hd"><h1>Hire'in Insights</h1></div>
        <div class="bd"><h2>${heading}</h2><p>${body}</p>
        <a class="btn" href="https://hire-in.com/insights">Back to Insights</a></div></div></body></html>`;

    try {
      const subId = verifyUnsubscribeToken(req.params.token);
      if (!subId) {
        return res.status(400).send(renderPage("Invalid link", "This unsubscribe link is invalid or has been tampered with."));
      }
      const sub = await storage.getNewsletterSubscriber(subId);
      if (!sub) {
        return res.status(404).send(renderPage("Not found", "We couldn't find that subscription."));
      }
      if (!sub.unsubscribedAt) {
        await storage.updateNewsletterSubscriber(sub.id, { unsubscribedAt: new Date() });
      }
      return res.send(
        renderPage(
          "You've been unsubscribed",
          `${sub.email} will no longer receive Hire'in Insights emails. Changed your mind? You can resubscribe anytime from our Insights page.`,
        ),
      );
    } catch (error) {
      console.error("Newsletter unsubscribe error:", error);
      res.status(500).send(renderPage("Something went wrong", "Please try again later."));
    }
  });

  // SendGrid Event Webhook — bounce / dropped / blocked / spamreport handling.
  // NOTE (team setup): configure this URL + signed event verification in the
  // SendGrid dashboard (Settings > Mail Settings > Event Webhook). Set the
  // SENDGRID_WEBHOOK_VERIFICATION_KEY env var to the public key SendGrid shows
  // so signatures are verified; without it events are accepted unverified.
  app.post("/api/newsletter/sendgrid-events", async (req, res) => {
    try {
      const verifyKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
      if (verifyKey) {
        const signature = req.get("X-Twilio-Email-Event-Webhook-Signature");
        const timestamp = req.get("X-Twilio-Email-Event-Webhook-Timestamp");
        const rawBody = (req as any).rawBody as Buffer | undefined;
        let verified = false;
        if (signature && timestamp && rawBody) {
          try {
            const payload = Buffer.concat([Buffer.from(timestamp), rawBody]);
            const pubKeyPem = `-----BEGIN PUBLIC KEY-----\n${verifyKey}\n-----END PUBLIC KEY-----`;
            const verifier = crypto.createVerify("sha256");
            verifier.update(payload);
            verifier.end();
            verified = verifier.verify(pubKeyPem, Buffer.from(signature, "base64"));
          } catch (e) {
            console.error("SendGrid signature verify error:", e);
          }
        }
        if (!verified) {
          return res.status(403).json({ error: "Invalid signature" });
        }
      }

      const events = Array.isArray(req.body) ? req.body : [];
      for (const ev of events) {
        const email = typeof ev?.email === "string" ? ev.email.toLowerCase() : "";
        const type = typeof ev?.event === "string" ? ev.event : "";
        if (!email) continue;
        const sub = await storage.getNewsletterSubscriberByEmail(email);
        if (!sub) continue;

        if (type === "delivered") {
          if (sub.bounceCount > 0) {
            await storage.updateNewsletterSubscriber(sub.id, { bounceCount: 0 });
          }
          continue;
        }

        const isHard =
          type === "spamreport" ||
          type === "blocked" ||
          (type === "bounce" && (ev?.type === "bounce" || ev?.bounce_classification === "Invalid Address"));
        const isSoft = type === "dropped" || (type === "bounce" && !isHard);

        if (type === "spamreport" || isHard) {
          await storage.updateNewsletterSubscriber(sub.id, {
            suppressedAt: sub.suppressedAt ?? new Date(),
            lastBounceAt: new Date(),
            bounceCount: sub.bounceCount + 1,
          });
        } else if (isSoft) {
          const nextCount = sub.bounceCount + 1;
          await storage.updateNewsletterSubscriber(sub.id, {
            bounceCount: nextCount,
            lastBounceAt: new Date(),
            suppressedAt: nextCount >= 2 ? (sub.suppressedAt ?? new Date()) : sub.suppressedAt,
          });
        }
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("SendGrid event webhook error:", error);
      res.status(500).json({ error: "Failed to process events" });
    }
  });

  // Get active jobs (public)
  app.get("/api/jobs", async (req, res) => {
    try {
      const { search, specialty, state, jobType, industry, page, pageSize, limit } = req.query;

      let industrySpecialties: string[] | undefined;
      if (industry && industry !== "All") {
        industrySpecialties = INDUSTRY_SPECIALTY_MAP[industry as string] ?? undefined;
      }

      const parsedPage = page ? parseInt(page as string, 10) : undefined;
      const parsedPageSize = pageSize ? parseInt(pageSize as string, 10) : undefined;
      const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;

      if ((parsedPage !== undefined && isNaN(parsedPage)) ||
          (parsedPageSize !== undefined && (isNaN(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > 100)) ||
          (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100))) {
        return res.status(400).json({ error: "Invalid pagination parameters" });
      }

      const result = await storage.getActiveJobs({
        search: search as string | undefined,
        specialty: specialty as string | undefined,
        state: state as string | undefined,
        jobType: jobType as string | undefined,
        industrySpecialties,
        page: parsedPage,
        pageSize: parsedPageSize,
        limit: parsedLimit,
      });

      res.json({ jobs: result.jobs.map(sanitizePublicJob), total: result.total });
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // Get job filters (public)
  app.get("/api/jobs/filters", async (req, res) => {
    try {
      const { industry } = req.query;
      let industrySpecialties: string[] | undefined;
      if (industry && industry !== "All") {
        industrySpecialties = INDUSTRY_SPECIALTY_MAP[industry as string] ?? undefined;
      }
      const filters = await storage.getJobFilters(industrySpecialties);
      res.json(filters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch filters" });
    }
  });

  // Get single job (public)
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(sanitizePublicJobDetail(job));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Get resume upload URL (public)
  app.post("/api/upload-url", async (req, res) => {
    try {
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadUrl });
    } catch (error) {
      console.error("Upload URL error:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Submit job application (public)
  app.post("/api/applications", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.resumeUrl) {
        body.resumePath = objectStorageService.normalizeObjectEntityPath(body.resumeUrl);
        delete body.resumeUrl;
      }

      if (!body.resumePath) {
        return res.status(400).json({ error: "Resume is required" });
      }
      
      const result = insertApplicationSchema.safeParse(body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid application data", details: result.error.issues });
      }
      
      const application = await storage.createApplication(result.data);
      res.status(201).json(application);

      pushApplicantToCeipal(application.id).then((syncResult) => {
        if (syncResult.success) {
          console.log(`Applicant ${application.id} synced to Ceipal (ID: ${syncResult.ceipalId})`);
        } else {
          console.error(`Ceipal sync failed for applicant ${application.id}:`, syncResult.error);
        }
      }).catch((err) => {
        console.error(`Ceipal sync error for applicant ${application.id}:`, err);
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit application" });
    }
  });

  // Submit contact form (public)
  app.post("/api/contacts", async (req, res) => {
    try {
      const result = insertContactSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid contact data", details: result.error.issues });
      }
      const contact = await storage.createContact(result.data);
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit contact" });
    }
  });

  // ==========================================
  // ADMIN API ROUTES
  // ==========================================

  // Get admin stats - all authenticated admin users can see dashboard stats
  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Admin Jobs CRUD (Operations role can access)
  app.get("/api/admin/jobs", requirePermission("admin.jobs", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.post("/api/admin/jobs", requirePermission("admin.jobs", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const result = insertJobSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid job data", details: result.error.issues });
      }
      const job = await storage.createJob(result.data);
      res.status(201).json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.patch("/api/admin/jobs/:id", requirePermission("admin.jobs", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const result = insertJobSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid job data", details: result.error.issues });
      }
      const jobId = req.params.id as string;
      const job = await storage.updateJob(jobId, result.data);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  app.delete("/api/admin/jobs/:id", requirePermission("admin.jobs", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const jobId = req.params.id as string;
      await storage.deleteJob(jobId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // Bulk delete jobs
  app.post("/api/admin/jobs/bulk-delete", requirePermission("admin.jobs.bulkDelete", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No job IDs provided" });
      }
      const count = await storage.deleteJobs(ids);
      res.json({ message: `Deleted ${count} jobs`, count });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete jobs" });
    }
  });

  // Bulk update jobs (activate/deactivate only)
  app.post("/api/admin/jobs/bulk-update", requirePermission("admin.jobs.bulkUpdate", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const { ids, updates } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No job IDs provided" });
      }
      // Whitelist only allowed bulk update fields for security
      const allowedUpdates: Partial<{ isActive: boolean; isHot: boolean }> = {};
      if (typeof updates?.isActive === "boolean") {
        allowedUpdates.isActive = updates.isActive;
      }
      if (typeof updates?.isHot === "boolean") {
        allowedUpdates.isHot = updates.isHot;
      }
      if (Object.keys(allowedUpdates).length === 0) {
        return res.status(400).json({ error: "No valid updates provided" });
      }
      const count = await storage.updateJobsBulk(ids, allowedUpdates);
      res.json({ message: `Updated ${count} jobs`, count });
    } catch (error) {
      res.status(500).json({ error: "Failed to update jobs" });
    }
  });

  // Sync jobs from Ceipal ATS
  app.post("/api/admin/jobs/sync-ceipal", requirePermission("admin.jobs.syncCeipal", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const result = await syncCeipalJobs();
      res.json({
        message: `Ceipal sync complete: ${result.created} new, ${result.updated} updated, ${result.deactivated} deactivated out of ${result.total} total`,
        ...result,
      });
    } catch (error: any) {
      console.error("Ceipal sync error:", error);
      res.status(500).json({ error: error.message || "Failed to sync jobs from Ceipal" });
    }
  });

  // CSV/XLSX Upload for Jobs
  app.post("/api/admin/jobs/upload", requirePermission("admin.jobs.upload", "operations", "recruiter", "manager"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      let records: any[];
      const fileName = req.file.originalname.toLowerCase();
      
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json(worksheet);
      } else {
        const content = req.file.buffer.toString("utf-8");
        records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      }

      const jobsToCreate = records
        .map((record: any) => {
          const title = record["Title"] || record["title"] || record["Job Title"] || record["Position"] || record["Role"];
          if (!title) return null; // Skip rows without a title
          
          return {
            jobId: String(record["Job ID"] || record["job_id"] || record["JobID"] || "").trim() || undefined,
            title: String(title).trim(),
            specialty: String(record["Specialty"] || record["specialty"] || record["Department"] || "").trim() || undefined,
            department: String(record["Department"] || record["department"] || "").trim() || undefined,
            facility: String(record["Facility"] || record["facility"] || record["Client"] || "").trim() || undefined,
            city: String(record["City"] || record["city"] || "").trim() || undefined,
            state: String(record["State"] || record["state"] || "").trim() || undefined,
            jobType: String(record["Job Type"] || record["job_type"] || record["Type"] || record["Employment Type"] || "").trim() || undefined,
            shift: String(record["Shift"] || record["shift"] || "").trim() || undefined,
            duration: String(record["Duration"] || record["duration"] || "").trim() || undefined,
            payRate: String(record["Pay Rate"] || record["pay_rate"] || record["Rate"] || "").trim() || undefined,
            billRate: String(record["Bill Rate"] || record["bill_rate"] || "").trim() || undefined,
            startDate: String(record["Start Date"] || record["start_date"] || "").trim() || undefined,
            description: String(record["Description"] || record["description"] || record["Job Description"] || "").trim() || undefined,
            requirements: String(record["Requirements"] || record["requirements"] || record["Qualifications"] || "").trim() || undefined,
            isActive: true,
            isHot: record["Hot"] === "true" || record["hot"] === "true" || record["Priority"] === "High",
            rawData: record,
          };
        })
        .filter((job): job is NonNullable<typeof job> => job !== null);

      if (jobsToCreate.length === 0) {
        return res.status(400).json({ error: "No valid jobs found in file. Ensure rows have a Title column." });
      }

      const created = await storage.createJobs(jobsToCreate);
      res.json({ message: `Successfully imported ${created.length} jobs`, count: created.length });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Failed to process file" });
    }
  });

  // Admin Applications (HR and Operations roles can access)
  app.get("/api/admin/applications", requireAuth, async (req, res) => {
    try {
      const jobId = req.query.jobId as string | undefined;
      const applications = await storage.getApplications(jobId);
      res.json(applications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  app.get("/api/admin/jobs/application-counts", requireAuth, async (req, res) => {
    try {
      const counts = await storage.getApplicationCountsByJob();
      res.json(counts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch application counts" });
    }
  });

  app.patch("/api/admin/applications/:id", requirePermission("admin.applications", "hr", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const applicationId = req.params.id as string;
      const application = await storage.updateApplication(applicationId, req.body);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(application);
    } catch (error) {
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  app.post("/api/admin/applications/:id/retry-ceipal", requirePermission("admin.applications.retryCeipal", "hr", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const applicationId = req.params.id as string;
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      console.log(`[ceipal] Retry sync requested for application ${applicationId} by user ${(req as any).user?.email}`);
      const result = await pushApplicantToCeipal(applicationId);

      if (result.success) {
        res.json({ success: true, ceipalId: result.ceipalId, message: "Successfully synced to Ceipal" });
      } else {
        res.json({ success: false, error: result.error, message: `Sync failed: ${result.error}` });
      }
    } catch (error: any) {
      console.error("[ceipal] Retry sync error:", error);
      res.status(500).json({ error: "Failed to retry Ceipal sync", details: error.message });
    }
  });

  // Admin Contacts (HR and Operations roles can access - view)
  app.get("/api/admin/contacts", requireAuth, async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.patch("/api/admin/contacts/:id", requirePermission("admin.contacts", "hr", "operations", "recruiter", "manager"), async (req, res) => {
    try {
      const contactId = req.params.id as string;
      const contact = await storage.updateContact(contactId, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  // Admin Users - only Super Admin can view/manage team
  app.get("/api/admin/users", requireAuth, async (req, res) => {
    try {
      const allUsers = await storage.getAllAdminUsersIncludingDeleted();
      const status = (req.query.status as string) || "active";

      const activeUsers = allUsers.filter(u => u.isActive && !u.deletedAt && (!u.employmentStatus || u.employmentStatus === "active"));
      const disabledUsers = allUsers.filter(u => !u.isActive && !u.deletedAt && (!u.employmentStatus || u.employmentStatus === "active"));
      const relievedUsers = allUsers.filter(u => !u.deletedAt && u.employmentStatus === "relieved");
      const leftCompanyUsers = allUsers.filter(u => !u.deletedAt && u.employmentStatus === "left_company");
      const deletedUsers = allUsers.filter(u => u.deletedAt);
      const allNonDeleted = allUsers.filter(u => !u.deletedAt);

      const counts = {
        active: activeUsers.length,
        disabled: disabledUsers.length,
        relieved: relievedUsers.length,
        left_company: leftCompanyUsers.length,
        deleted: deletedUsers.length,
      };

      let filtered: typeof allUsers;
      if (status === "disabled") {
        filtered = disabledUsers;
      } else if (status === "relieved") {
        filtered = relievedUsers;
      } else if (status === "left_company") {
        filtered = leftCompanyUsers;
      } else if (status === "deleted") {
        filtered = deletedUsers;
      } else if (status === "all_non_deleted") {
        filtered = allNonDeleted;
      } else {
        filtered = activeUsers;
      }

      res.json({ users: filtered, counts });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Role hierarchy for permission checks
  const ROLE_RANK: Record<string, number> = {
    super_admin: 6,
    admin: 5,
    hr: 4,
    finance: 2.5,
    operations: 3,
    manager: 2,
    recruiter: 1.5,
    employee: 1,
  };

  // User management routes — accessible to super_admin, admin, and manager
  app.post("/api/admin/users", requirePermission("admin.users.post", "admin", "manager", "hr"), async (req, res) => {
    try {
      const actorRole = req.session.role!;
      const actorRank = ROLE_RANK[actorRole] ?? 0;
      const { email, role, firstName, lastName, password, joiningDate, designation, departmentId, hierarchyLevel, salary, managerId, shiftId } = req.body;

      const assignedRole = role || "employee";
      const assignedRank = ROLE_RANK[assignedRole] ?? 0;
      if (actorRank <= assignedRank && actorRole !== "super_admin") {
        return res.status(403).json({ error: "You cannot assign a role equal to or higher than your own" });
      }

      if (!email?.endsWith("@hire-in.com")) {
        return res.status(400).json({ error: "Only @hire-in.com emails are allowed" });
      }

      if (!departmentId) {
        return res.status(400).json({ error: "Department is required when creating a new employee" });
      }

      // Shift is mandatory: without it the attendance engine cannot determine the
      // employee's working window (late-marking, absent sweep, day-completion all
      // depend on it). Validate the shift exists and is active.
      if (!shiftId) {
        return res.status(400).json({ error: "Shift is required when creating a new employee" });
      }
      const shiftCheck = await db.execute(sql`
        SELECT id FROM shifts WHERE id = ${shiftId} AND is_active = true LIMIT 1
      `);
      if (shiftCheck.rows.length === 0) {
        return res.status(400).json({ error: "Selected shift is invalid or inactive" });
      }
      
      const existing = await storage.getAdminUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "User already exists" });
      }
      
      const tempPassword = password || crypto.randomBytes(6).toString("base64url") + "A1!";
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(tempPassword, 12);
      
      let deptName: string | null = null;
      if (departmentId) {
        const dept = await storage.getDepartment(departmentId);
        if (dept) deptName = dept.name;
      }
      const employeeIdVal = await generateEmployeeId(deptName);

      const { gender, employeeCategory } = req.body;
      const categoryVal = ["fresher", "intern", "experienced"].includes(employeeCategory) ? employeeCategory : "experienced";

      const user = await storage.createAdminUser({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName || "",
        lastName: lastName || "",
        role: assignedRole,
        isActive: true,
        joiningDate: joiningDate || null,
        designation: designation || null,
        departmentId: departmentId || null,
        hierarchyLevel: hierarchyLevel || "team_member",
        salary: salary || null,
        employeeId: employeeIdVal,
        managerId: managerId || null,
        gender: gender || null,
        employeeCategory: categoryVal,
        shiftId: shiftId,
      });

      storage.initializeEmployeeDocuments(user.id, categoryVal).catch(err =>
        console.error("Failed to initialize documents for user:", err)
      );

      // Auto-assign all published tracks to the new user
      // - Policy tracks: immediate due date (required before portal access)
      // - Non-policy SOP tracks: 15-day due date, filtered by role/department
      (async () => {
        try {
          const { db: dbInstance } = await import("./db");
          const { learningTracks: lt, trackAssignments: ta } = await import("@shared/schema");
          const { eq, and, or, isNull } = await import("drizzle-orm");

          const allPublishedTracks = await dbInstance.select().from(lt)
            .where(eq(lt.status, "published"));

          const dueIn14Days = new Date();
          dueIn14Days.setDate(dueIn14Days.getDate() + 14);

          for (const track of allPublishedTracks) {
            // Skip tracks that don't match the user's role/department
            // Policy tracks are always assigned. Non-policy tracks:
            //   - null or "all_roles" targetRole => assign to all roles
            //   - specific role => must match user's role
            //   - null targetDepartmentId => assign to all departments
            //   - specific dept => must match user's department
            if (!track.isPolicyTrack) {
              const trackRole = track.targetRole;
              const trackDept = track.targetDepartmentId;
              const roleMatch = !trackRole || trackRole === "all_roles" || trackRole === user.role;
              const deptMatch = !trackDept || trackDept === user.departmentId;
              if (!roleMatch || !deptMatch) continue;
            }

            const [existing] = await dbInstance.select().from(ta)
              .where(and(eq(ta.trackId, track.id), eq(ta.userId, user.id)));
            if (!existing) {
              await dbInstance.insert(ta).values({
                trackId: track.id,
                userId: user.id,
                assignedBy: req.session.userId!,
                dueDate: track.isPolicyTrack ? new Date() : dueIn14Days,
                status: "not_started",
              });
            }
          }
        } catch (err) {
          console.error("Track auto-assignment failed (non-fatal):", err);
        }
      })();

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: user.id,
        action: "create_user",
        changes: { email: email.toLowerCase(), role: assignedRole, firstName, lastName, designation, departmentId, hierarchyLevel, employeeId: employeeIdVal },
      });

      const baseUrl = process.env.BASE_URL || "https://employee.hire-in.com";
      const loginUrl = `${baseUrl}/admin/login`;

      sendInvitationEmail({
        to: email.toLowerCase(),
        firstName: firstName || email.split("@")[0],
        lastName: lastName || "",
        role: assignedRole,
        temporaryPassword: tempPassword,
        loginUrl,
        employeeId: employeeIdVal,
      }).catch((err) => console.error("Background invitation email error:", err));

      let rayoProvisioning: { success: boolean; tempPassword?: string; error?: string } | null = null;
      try {
        const rayoEnabled = await isRayoEnabled();
        if (rayoEnabled) {
          rayoProvisioning = await provisionRayoUser(
            email.toLowerCase(),
            firstName || "",
            lastName || "",
            assignedRole
          );
          if (rayoProvisioning.success) {
            await storage.createAuditLog({
              actorId: req.session.userId!,
              targetId: user.id,
              action: "rayo_academy_provisioned",
              changes: { email: email.toLowerCase(), rayoTempPassword: "[redacted]" },
            });
            if (rayoProvisioning.tempPassword) {
              sendRayoAcademyCredentialsEmail({
                to: email.toLowerCase(),
                firstName: firstName || email.split("@")[0],
                tempPassword: rayoProvisioning.tempPassword,
              }).catch((err) => console.error("Failed to send Rayo credentials email:", err));
            }
          }
        }
      } catch (err) {
        console.error("Rayo Academy provisioning failed (non-fatal):", err);
      }

      res.status(201).json({ ...user, rayoProvisioning });
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Bulk upload users via CSV/XLSX
  app.post("/api/admin/users/bulk-upload", requirePermission("admin.users.bulkUpload", "admin", "manager"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const actorRole = req.session.role!;
      const actorRank = ROLE_RANK[actorRole] ?? 0;
      const fileName = req.file.originalname.toLowerCase();
      let rows: any[] = [];

      if (fileName.endsWith(".csv")) {
        const content = req.file.buffer.toString("utf-8");
        rows = parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true });
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      } else {
        return res.status(400).json({ error: "Only CSV and XLSX files are supported" });
      }

      if (rows.length === 0) {
        return res.status(400).json({ error: "File is empty or has no data rows" });
      }

      const normalize = (row: any, keys: string[]): string => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return String(row[k]).trim();
        }
        return "";
      };

      const allUsers = await storage.getAdminUsers();
      const existingEmails = new Set(allUsers.map(u => u.email.toLowerCase()));
      const usersByName: Record<string, string> = {};
      allUsers.forEach(u => {
        usersByName[`${u.firstName} ${u.lastName}`.toLowerCase()] = u.id;
      });

      const bcrypt = await import("bcryptjs");
      const baseUrl = process.env.BASE_URL || "https://employee.hire-in.com";
      const loginUrl = `${baseUrl}/admin/login`;

      const results: { row: number; email: string; status: string; error?: string }[] = [];
      const newUsersByName: Record<string, string> = {};

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const firstName = normalize(row, ["First Name", "first_name", "firstName", "First name", "first name", "FIRST NAME"]);
        const lastName = normalize(row, ["Last Name", "last_name", "lastName", "Last name", "last name", "LAST NAME"]);
        const email = normalize(row, ["Email", "email", "EMAIL", "Email Address", "email_address"]).toLowerCase();
        const designation = normalize(row, ["Designation", "designation", "DESIGNATION", "Title", "title", "Job Title", "job_title"]);
        const reportingManager = normalize(row, ["Reporting Manager", "reporting_manager", "Manager", "manager", "Reports To", "reports_to", "REPORTING MANAGER"]);
        const salaryVal = normalize(row, ["Salary", "salary", "SALARY", "CTC", "ctc"]);
        const joiningDate = normalize(row, ["Joining Date", "joining_date", "joiningDate", "JOINING DATE", "Join Date", "join_date"]);
        const department = normalize(row, ["Department", "department", "DEPARTMENT"]);
        const role = normalize(row, ["Role", "role", "ROLE"]).toLowerCase() || "employee";

        if (!firstName || !email) {
          results.push({ row: i + 2, email: email || "(empty)", status: "skipped", error: "Missing first name or email" });
          continue;
        }

        if (!email.endsWith("@hire-in.com")) {
          results.push({ row: i + 2, email, status: "skipped", error: "Email must end with @hire-in.com" });
          continue;
        }

        if (existingEmails.has(email)) {
          results.push({ row: i + 2, email, status: "skipped", error: "User already exists" });
          continue;
        }

        const validRoles = ["super_admin", "admin", "hr", "operations", "manager", "recruiter", "employee"] as const;
        const assignedRole = (validRoles as readonly string[]).includes(role) ? role as typeof validRoles[number] : "employee" as const;
        const assignedRank = ROLE_RANK[assignedRole] ?? 0;
        if (actorRank <= assignedRank && actorRole !== "super_admin") {
          results.push({ row: i + 2, email, status: "skipped", error: "Cannot assign a role equal to or higher than your own" });
          continue;
        }

        let managerId: string | null = null;
        if (reportingManager) {
          const mgrKey = reportingManager.toLowerCase();
          managerId = usersByName[mgrKey] || newUsersByName[mgrKey] || null;
        }

        let departmentId: string | null = null;
        if (department) {
          const dept = (await storage.getDepartments?.())?.find((d: any) => d.name.toLowerCase() === department.toLowerCase() && d.isActive);
          if (dept) departmentId = dept.id;
        }

        const tempPassword = crypto.randomBytes(6).toString("base64url") + "A1!";
        const hashedPassword = await bcrypt.hash(tempPassword, 12);

        try {
          let bulkDeptName: string | null = null;
          if (departmentId) {
            const dept = (await storage.getDepartments?.())?.find((d: any) => d.id === departmentId);
            if (dept) bulkDeptName = dept.name;
          }
          const bulkEmployeeId = await generateEmployeeId(bulkDeptName);

          const newUser = await storage.createAdminUser({
            email,
            password: hashedPassword,
            firstName,
            lastName: lastName || "",
            role: assignedRole,
            isActive: true,
            joiningDate: joiningDate || null,
            designation: designation || null,
            departmentId,
            hierarchyLevel: "team_member",
            salary: salaryVal || null,
            managerId,
            employeeId: bulkEmployeeId,
          });

          storage.initializeEmployeeDocuments(newUser.id, newUser.employeeCategory ?? "experienced").catch(err =>
            console.error(`Failed to init docs for ${email}:`, err)
          );

          existingEmails.add(email);
          newUsersByName[`${firstName} ${lastName || ""}`.toLowerCase().trim()] = newUser.id;
          if (managerId) {
            usersByName[`${firstName} ${lastName || ""}`.toLowerCase().trim()] = newUser.id;
          }

          await storage.createAuditLog({
            actorId: req.session.userId!,
            targetId: newUser.id,
            action: "create_user",
            changes: { email, role: assignedRole, firstName, lastName, designation, salary: salaryVal, source: "bulk_upload", employeeId: bulkEmployeeId },
          });

          sendInvitationEmail({
            to: email,
            firstName,
            lastName: lastName || "",
            role: assignedRole,
            temporaryPassword: tempPassword,
            loginUrl,
            employeeId: bulkEmployeeId,
          }).catch((err) => console.error(`Bulk upload email error for ${email}:`, err));

          results.push({ row: i + 2, email, status: "created" });
        } catch (err: any) {
          results.push({ row: i + 2, email, status: "failed", error: err.message || "Database error" });
        }
      }

      const created = results.filter(r => r.status === "created").length;
      const skipped = results.filter(r => r.status === "skipped").length;
      const failed = results.filter(r => r.status === "failed").length;

      res.json({ summary: { total: rows.length, created, skipped, failed }, results });
    } catch (error: any) {
      console.error("Bulk upload error:", error);
      res.status(500).json({ error: "Failed to process bulk upload: " + (error.message || "Unknown error") });
    }
  });

  app.patch("/api/admin/users/:id", requirePermission("admin.users.patch", "admin", "manager", "hr"), async (req, res) => {
    try {
      const actorRole = req.session.role!;
      const actorRank = ROLE_RANK[actorRole] ?? 0;
      const userId = req.params.id as string;

      const targetUser = await storage.getAdminUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const targetRank = ROLE_RANK[targetUser.role] ?? 0;
      if (actorRank <= targetRank && actorRole !== "super_admin") {
        return res.status(403).json({ error: "You cannot edit a user with an equal or higher role" });
      }

      const { password, role, ...updateData } = req.body;

      const exitStatuses = ["relieved", "left_company"];
      const effectiveEmploymentStatus = updateData.employmentStatus ?? targetUser.employmentStatus;
      if (exitStatuses.includes(effectiveEmploymentStatus) && updateData.isActive === true) {
        return res.status(400).json({ error: "Cannot set isActive=true for a user with an exit employment status (relieved/left_company). Use the employment-status endpoint to reinstate." });
      }
      
      if (role) {
        const newRoleRank = ROLE_RANK[role] ?? 0;
        if (actorRank <= newRoleRank && actorRole !== "super_admin") {
          return res.status(403).json({ error: "You cannot assign a role equal to or higher than your own" });
        }
        updateData.role = role;
      }

      if (password) {
        const bcrypt = await import("bcryptjs");
        updateData.password = await bcrypt.hash(password, 12);
      }

      const VALID_CATEGORIES = ["experienced", "fresher", "intern"];
      if (updateData.employeeCategory !== undefined) {
        if (!VALID_CATEGORIES.includes(updateData.employeeCategory)) {
          updateData.employeeCategory = "experienced";
        }
      }

      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      for (const key of Object.keys(updateData)) {
        if (key === "password") {
          before[key] = "***";
          after[key] = "***";
        } else if ((targetUser as any)[key] !== updateData[key]) {
          before[key] = (targetUser as any)[key];
          after[key] = updateData[key];
        }
      }

      const user = await storage.updateAdminUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (updateData.employeeCategory && updateData.employeeCategory !== targetUser.employeeCategory) {
        storage.updateDocumentRequiredStatusForCategory(userId, updateData.employeeCategory).catch(err =>
          console.error("Failed to update doc required status for category change:", err)
        );
      }

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "update_user",
        changes: { before, after },
      });

      // When a user's role is set/changed, project SOP obligations for the new role
      // (idempotent, no duplicates). Non-fatal — never block the user update.
      if (role && role !== targetUser.role) {
        syncSopProgressForUser(userId, role).catch((err) =>
          console.error("SOP progress sync on role change failed:", err),
        );
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.post("/api/admin/users/:id/resend-invite", requirePermission("admin.users.resendInvite", "admin", "manager"), async (req, res) => {
    try {
      const userId = req.params.id as string;
      const targetUser = await storage.getAdminUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const actorRank = ROLE_RANK[req.session.role!] ?? 0;
      const targetRank = ROLE_RANK[targetUser.role] ?? 0;
      if (actorRank <= targetRank && req.session.role !== "super_admin") {
        return res.status(403).json({ error: "You cannot resend invitations to users with an equal or higher role" });
      }

      const tempPassword = crypto.randomBytes(6).toString("base64url") + "A1!";
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      const baseUrl = process.env.BASE_URL || "https://employee.hire-in.com";
      const loginUrl = `${baseUrl}/admin/login`;

      const result = await sendInvitationEmail({
        to: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        role: targetUser.role,
        temporaryPassword: tempPassword,
        loginUrl,
      });

      if (result.success) {
        await storage.updateAdminUser(userId, { password: hashedPassword });
        await storage.createAuditLog({
          actorId: req.session.userId!,
          targetId: userId,
          action: "resend_invite",
          changes: { email: targetUser.email },
        });
        res.json({ message: "Invitation resent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send email. Password was not changed." });
      }
    } catch (error) {
      console.error("Resend invite error:", error);
      res.status(500).json({ error: "Failed to resend invitation" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", requireAuth, async (req, res) => {
    try {
      const actorRole = req.session.role!;
      const actorRank = ROLE_RANK[actorRole] ?? 0;

      if (actorRank < ROLE_RANK.manager) {
        return res.status(403).json({ error: "Only managers and above can reset passwords" });
      }

      const targetId = req.params.id as string;
      if (targetId === req.session.userId) {
        return res.status(400).json({ error: "You cannot reset your own password through this action" });
      }

      const targetUser = await storage.getAdminUser(targetId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const targetRank = ROLE_RANK[targetUser.role] ?? 0;
      if (actorRank <= targetRank) {
        return res.status(403).json({ error: "You can only reset passwords for users with a lower role than yours" });
      }

      const { newPassword } = req.body;
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await storage.updateAdminUser(targetId, { password: hashedPassword, totpEnabled: false, totpSecret: null });

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: targetId,
        action: "reset_password",
        changes: { targetEmail: targetUser.email },
      });

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.delete("/api/admin/users/:id", requirePermission("admin.users.delete", "super_admin"), async (req, res) => {
    try {
      const userId = req.params.id as string;
      const targetUser = await storage.getAdminUser(userId);

      if (targetUser) {
        if (userId === req.session.userId) {
          return res.status(400).json({ error: "You cannot delete your own account" });
        }
      }

      await storage.softDeleteAdminUser(userId);

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "delete_user",
        changes: targetUser ? { email: targetUser.email, role: targetUser.role, name: `${targetUser.firstName} ${targetUser.lastName}` } : null,
      });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.patch("/api/admin/users/:id/employment-status", requirePermission("admin.users.employmentStatus", "super_admin", "admin", "manager"), async (req, res) => {
    try {
      const actorRole = req.session.role!;
      const actorRank = ROLE_RANK[actorRole] ?? 0;
      const userId = req.params.id as string;

      const validStatuses = ["active", "relieved", "left_company"] as const;
      const { employmentStatus } = req.body as { employmentStatus: typeof validStatuses[number] };

      if (!validStatuses.includes(employmentStatus)) {
        return res.status(400).json({ error: "Invalid employment status. Must be one of: active, relieved, left_company" });
      }

      const targetUser = await storage.getAdminUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (userId === req.session.userId) {
        return res.status(400).json({ error: "You cannot change your own employment status" });
      }

      const targetRank = ROLE_RANK[targetUser.role] ?? 0;
      if (actorRank <= targetRank && actorRole !== "super_admin") {
        return res.status(403).json({ error: "You cannot change the employment status of a user with an equal or higher role" });
      }

      const isActive = employmentStatus === "active";
      const updated = await storage.updateAdminUser(userId, { employmentStatus, isActive });

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "update_employment_status",
        changes: { employmentStatus, isActive, previousStatus: targetUser.employmentStatus },
      });

      // Exit clause: flag outstanding salary advances for final-settlement recovery.
      try {
        if (employmentStatus === "relieved" || employmentStatus === "left_company") {
          const advances = await storage.listSalaryAdvancesByRequester(userId);
          for (const adv of advances) {
            const outstanding = Number(adv.outstandingBalance || 0);
            const recoverableStatuses = ["approved", "disbursed", "repaying"];
            if (outstanding > 0 && recoverableStatuses.includes(adv.status) && !adv.exitRecoveryFlag) {
              await storage.updateSalaryAdvance(adv.id, { exitRecoveryFlag: true });
              await storage.addSalaryAdvanceAuditEntry({
                advanceId: adv.id,
                actorId: req.session.userId!,
                action: "exit_recovery_flagged",
                oldStatus: adv.status,
                newStatus: adv.status,
                metadata: { employmentStatus, outstandingBalance: outstanding.toFixed(2) },
              });
            }
          }
        }
      } catch (flagErr) {
        console.error("Failed to flag salary advances for exit recovery:", flagErr);
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employment status" });
    }
  });

  app.post("/api/admin/users/:id/restore", requirePermission("admin.users.restore", "super_admin", "admin"), async (req, res) => {
    try {
      const userId = req.params.id as string;
      const targetUser = await storage.getAdminUser(userId);

      if (!targetUser || !targetUser.deletedAt) {
        return res.status(404).json({ error: "Deleted user not found" });
      }

      const actorRank = ROLE_RANK[req.session.role!] ?? 0;
      const targetRank = ROLE_RANK[targetUser.role] ?? 0;
      if (actorRank <= targetRank && req.session.role !== "super_admin") {
        return res.status(403).json({ error: "You cannot restore a user with an equal or higher role" });
      }

      const restored = await storage.restoreAdminUser(userId);

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "restore_user",
        changes: { email: targetUser.email, role: targetUser.role, name: `${targetUser.firstName} ${targetUser.lastName}` },
      });

      res.json(restored);
    } catch (error) {
      res.status(500).json({ error: "Failed to restore user" });
    }
  });

  // ==========================================
  // EMPLOYEE DOSSIER API ROUTE
  // ==========================================

  app.get("/api/admin/employees/:userId/dossier", requirePermission("admin.employees.dossier", "hr"), async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await storage.getAdminUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const [allUsers, allDepts, leaveTypesList, allShifts] = await Promise.all([
        storage.getAdminUsers(),
        storage.getDepartments(),
        db.select().from(leaveTypes),
        db.select({ id: shifts.id, displayLabel: shifts.displayLabel, name: shifts.name }).from(shifts),
      ]);

      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const deptMap = new Map(allDepts.map(d => [d.id, d]));
      const leaveTypeMap = new Map(leaveTypesList.map(lt => [lt.id, lt]));
      const shiftMap = new Map(allShifts.map(s => [s.id, s]));

      const managerUser = user.managerId ? userMap.get(user.managerId) : undefined;

      // Leave balances for current year
      const currentYear = new Date().getFullYear();
      const balanceRows = await db.select().from(leaveBalances)
        .where(and(eq(leaveBalances.userId, userId), eq(leaveBalances.year, currentYear)));
      const enrichedBalances = balanceRows.map(b => ({
        ...b,
        leaveTypeName: leaveTypeMap.get(b.leaveTypeId)?.name || "Unknown",
      }));

      // Track assignments
      const assignmentRows = await db.select().from(trackAssignments)
        .where(eq(trackAssignments.userId, userId));

      const trackIds = assignmentRows.map(a => a.trackId);
      const trackRows = trackIds.length > 0
        ? await db.select().from(learningTracks).where(inArray(learningTracks.id, trackIds))
        : [];
      const trackMap = new Map(trackRows.map(t => [t.id, t]));

      const enrichedAssignments = await Promise.all(assignmentRows.map(async (a) => {
        const track = trackMap.get(a.trackId);

        const [allSections, completedProgress, lastProgressRow, completionRow] = await Promise.all([
          db.select({ id: trackSections.id }).from(trackSections).where(eq(trackSections.trackId, a.trackId)),
          db.select({ id: sectionProgress.id }).from(sectionProgress)
            .where(and(eq(sectionProgress.assignmentId, a.id), eq(sectionProgress.status, "completed"))),
          db.select({ lastViewedAt: sectionProgress.lastViewedAt }).from(sectionProgress)
            .where(eq(sectionProgress.assignmentId, a.id))
            .orderBy(desc(sectionProgress.lastViewedAt)).limit(1),
          db.select().from(trackCompletions).where(eq(trackCompletions.assignmentId, a.id)).limit(1),
        ]);

        const totalSections = allSections.length;
        const completedSections = completedProgress.length;
        const completionPct = totalSections > 0
          ? Math.round((completedSections / totalSections) * 100)
          : (a.status === "completed" ? 100 : 0);
        const isOverdue = !!(a.dueDate && new Date(a.dueDate) < new Date() && a.status !== "completed");

        const completion = completionRow[0];
        return {
          assignmentId: a.id,
          trackId: a.trackId,
          trackTitle: track?.title || "Unknown Track",
          isPolicyTrack: track?.isPolicyTrack || false,
          status: a.status,
          completionPct,
          dueDate: a.dueDate,
          completedAt: a.completedAt,
          isOverdue,
          lastActivityAt: lastProgressRow[0]?.lastViewedAt || null,
          signedVersion: completion?.signedVersion || null,
          currentVersion: track?.versionNumber || 1,
        };
      }));

      const policyTracks = enrichedAssignments.filter(a => a.isPolicyTrack);
      const trainingTracks = enrichedAssignments.filter(a => !a.isPolicyTrack);

      // Night shift consent (female employees only)
      type NightShiftConsentSummary = {
        status: "valid" | "expired" | "expiring_soon" | "not_signed";
        signedAt?: Date;
        expiresAt?: Date;
      };
      let nightShiftConsent: NightShiftConsentSummary | null = null;
      if (user.gender === "Female") {
        const [latestConsent] = await db.select().from(nightShiftConsents)
          .where(and(eq(nightShiftConsents.userId, userId), eq(nightShiftConsents.isActive, true)))
          .orderBy(desc(nightShiftConsents.signedAt)).limit(1);
        if (latestConsent) {
          const isExpired = new Date(latestConsent.expiresAt) < new Date();
          const daysToExpiry = Math.ceil((new Date(latestConsent.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          nightShiftConsent = {
            signedAt: latestConsent.signedAt,
            expiresAt: latestConsent.expiresAt,
            status: isExpired ? "expired" : daysToExpiry <= 30 ? "expiring_soon" : "valid",
          };
        } else {
          nightShiftConsent = { status: "not_signed" };
        }
      }

      // HR letters — match by linked userId OR employee full name (for legacy/manual records)
      const userFullName = `${user.firstName} ${user.lastName}`;
      const hrLettersList = await db.select({
        id: hrLetters.id,
        templateType: hrLetters.templateType,
        status: hrLetters.status,
        referenceNumber: hrLetters.referenceNumber,
        issueDate: hrLetters.issueDate,
        issuedAt: hrLetters.issuedAt,
        employeeName: hrLetters.employeeName,
      }).from(hrLetters)
        .where(or(
          eq(hrLetters.employeeId, userId),
          eq(hrLetters.employeeName, userFullName),
        ))
        .orderBy(desc(hrLetters.issuedAt));

      // Offer letters — match by linked userId OR candidate email
      const offerLettersList = await db.select({
        id: offerLetters.id,
        token: offerLetters.token,
        status: offerLetters.status,
        candidateName: offerLetters.candidateName,
        designation: offerLetters.designation,
        proposedStartDate: offerLetters.proposedStartDate,
        offerDate: offerLetters.offerDate,
        acceptedAt: offerLetters.acceptedAt,
        counterSignedAt: offerLetters.counterSignedAt,
        createdAt: offerLetters.createdAt,
      }).from(offerLetters)
        .where(or(
          eq(offerLetters.resultingUserId, userId),
          eq(offerLetters.candidatePersonalEmail, user.email),
        ))
        .orderBy(desc(offerLetters.createdAt));

      res.json({
        profile: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          designation: user.designation,
          departmentId: user.departmentId,
          departmentName: user.departmentId ? (deptMap.get(user.departmentId)?.name || null) : null,
          managerId: user.managerId,
          managerName: managerUser ? `${managerUser.firstName} ${managerUser.lastName}` : null,
          joiningDate: user.joiningDate,
          shiftId: user.shiftId,
          shiftName: user.shiftId ? (shiftMap.get(user.shiftId)?.displayLabel || shiftMap.get(user.shiftId)?.name || null) : null,
          gender: user.gender,
          employmentStatus: user.employmentStatus,
          isActive: user.isActive,
          totpEnabled: user.totpEnabled,
          employeeId: user.employeeId,
          hierarchyLevel: user.hierarchyLevel,
          salary: user.salary,
          attendanceExempt: user.attendanceExempt,
        },
        policyCompliance: {
          tracks: policyTracks,
          nightShiftConsent,
        },
        training: trainingTracks,
        documents: {
          offerLetters: offerLettersList,
          hrLetters: hrLettersList,
          leaveBalances: enrichedBalances,
        },
      });
    } catch (error) {
      console.error("Dossier error:", error);
      res.status(500).json({ error: "Failed to fetch employee dossier" });
    }
  });

  // ==========================================
  // DEPARTMENTS & HIERARCHY API ROUTES
  // ==========================================

  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const depts = await storage.getDepartments();
      res.json(depts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", requirePermission("departments.post", "hr"), async (req, res) => {
    try {
      const dept = await storage.createDepartment(req.body);
      res.status(201).json(dept);
    } catch (error) {
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", requirePermission("departments.patch", "hr"), async (req, res) => {
    try {
      const dept = await storage.updateDepartment(req.params.id as string, req.body);
      if (!dept) return res.status(404).json({ error: "Department not found" });
      res.json(dept);
    } catch (error) {
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", requirePermission("departments.delete", "super_admin"), async (req, res) => {
    try {
      await storage.deleteDepartment(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  app.get("/api/org-tree", requireAuth, async (req, res) => {
    try {
      const tree = await storage.getOrgTree();
      const safeUsers = tree.users.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        managerId: u.managerId,
        departmentId: u.departmentId,
        designation: u.designation,
        hierarchyLevel: u.hierarchyLevel,
      }));
      res.json({ users: safeUsers, departments: tree.departments });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch org tree" });
    }
  });

  app.get("/api/team-members/:managerId", requireAuth, async (req, res) => {
    try {
      const members = await storage.getTeamMembers(req.params.managerId as string);
      const safeMembers = members.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        designation: u.designation,
        departmentId: u.departmentId,
        hierarchyLevel: u.hierarchyLevel,
      }));
      res.json(safeMembers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  app.patch("/api/admin/users/:id/hierarchy", requirePermission("admin.users.hierarchy", "hr", "admin", "manager"), async (req, res) => {
    try {
      const targetId = req.params.id as string;
      const targetUser = await storage.getAdminUser(targetId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      const { managerId, departmentId, designation, hierarchyLevel } = req.body;
      const before = { managerId: targetUser.managerId, departmentId: targetUser.departmentId, designation: targetUser.designation, hierarchyLevel: targetUser.hierarchyLevel };

      const updated = await storage.updateAdminUser(targetId, {
        managerId, departmentId, designation, hierarchyLevel,
      });
      if (!updated) return res.status(404).json({ error: "User not found" });

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId,
        action: "update_hierarchy",
        changes: { before, after: { managerId, departmentId, designation, hierarchyLevel } },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user hierarchy" });
    }
  });

  // ==========================================
  // AUDIT LOGS API ROUTES
  // ==========================================

  app.get("/api/admin/audit-logs", requirePermission("admin.auditLogs", "admin"), async (req, res) => {
    try {
      const { actorId, targetId, action, limit, offset } = req.query;
      const filters = {
        actorId: actorId as string | undefined,
        targetId: targetId as string | undefined,
        action: action as string | undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      };
      const [logs, total] = await Promise.all([
        storage.getAuditLogs(filters),
        storage.getAuditLogCount(filters),
      ]);

      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, { firstName: u.firstName, lastName: u.lastName, email: u.email }]));

      const enrichedLogs = logs.map(log => ({
        ...log,
        actorName: userMap.get(log.actorId) ? `${userMap.get(log.actorId)!.firstName} ${userMap.get(log.actorId)!.lastName}` : "Unknown",
        actorEmail: userMap.get(log.actorId)?.email || "Unknown",
        targetName: log.targetId && userMap.get(log.targetId) ? `${userMap.get(log.targetId)!.firstName} ${userMap.get(log.targetId)!.lastName}` : "Unknown",
        targetEmail: log.targetId && userMap.get(log.targetId)?.email || null,
      }));

      res.json({ logs: enrichedLogs, total });
    } catch (error) {
      console.error("Audit logs error:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ==========================================
  // HR PORTAL API ROUTES
  // ==========================================

  // --- User Directory (for HR) ---
  app.get("/api/hr/users", requirePermission("hr.users", "hr"), async (req, res) => {
    try {
      const users = await storage.getAdminUsers();
      const safeUsers = users.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        managerId: u.managerId,
        departmentId: u.departmentId,
        designation: u.designation,
        hierarchyLevel: u.hierarchyLevel,
      }));
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // --- Dashboard Stats ---
  app.get("/api/hr/dashboard-stats", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const currentUser = await storage.getAdminUser(userId);
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      // For attendance-exempt users, skip punch/hours calculations
      if (currentUser?.attendanceExempt) {
        const leaveRequests = await storage.getLeaveRequests({ userId });
        const pendingCount = leaveRequests.filter(lr => lr.status === "pending").length;
        const balances = await storage.getLeaveBalances(userId, now.getFullYear());
        const allLeaveTypes = await storage.getLeaveTypes();
        const activeIds = new Set(allLeaveTypes.filter(lt => lt.isActive).map(lt => lt.id));
        const activeBalances = balances.filter(b => activeIds.has(b.leaveTypeId));
        return res.json({
          todayStatus: "exempt",
          punchInTime: null,
          punchOutTime: null,
          presentDaysThisMonth: 0,
          totalHoursThisMonth: "0.0",
          pendingLeaveRequests: pendingCount,
          leaveBalances: activeBalances,
          productiveHoursToday: null,
          correctionsThisMonth: 0,
        });
      }

      const todayRecord = await storage.getTodayAttendance(userId);
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
      const monthRecords = await storage.getAttendanceByUser(userId, monthStart, monthEnd);
      const presentRecords = monthRecords.filter(r => ["present", "late", "half_day", "short_day"].includes(r.status));
      const totalHours = monthRecords.reduce((s, r) => s + parseFloat(r.totalHours || "0"), 0);
      const leaveRequests = await storage.getLeaveRequests({ userId });
      const pendingCount = leaveRequests.filter(lr => lr.status === "pending").length;
      const balances = await storage.getLeaveBalances(userId, now.getFullYear());
      const allLeaveTypes = await storage.getLeaveTypes();
      const activeIds = new Set(allLeaveTypes.filter(lt => lt.isActive).map(lt => lt.id));
      const activeBalances = balances.filter(b => activeIds.has(b.leaveTypeId));

      let todayStatus: "not_punched" | "punched_in" | "completed" = "not_punched";
      if (todayRecord && todayRecord.punchIn) {
        todayStatus = todayRecord.punchOut ? "completed" : "punched_in";
      }

      // Calculate productive hours (total punch duration minus break time)
      let productiveHoursToday: string | null = null;
      if (todayRecord?.punchIn) {
        const endTime = todayRecord.punchOut ? new Date(todayRecord.punchOut) : new Date();
        const punchInTime = new Date(todayRecord.punchIn);
        const totalMs = endTime.getTime() - punchInTime.getTime();
        // Subtract break time
        const todayBreaks = await db.select().from(breakRecords)
          .where(and(eq(breakRecords.userId, userId), eq(breakRecords.date, today)));
        const breakMinutes = todayBreaks.reduce((sum, b) => {
          if (b.durationMinutes) return sum + parseFloat(b.durationMinutes);
          if (!b.endedAt && b.startedAt) {
            // Active break — count elapsed so far
            return sum + (new Date().getTime() - new Date(b.startedAt).getTime()) / 60000;
          }
          return sum;
        }, 0);
        const productiveMs = Math.max(0, totalMs - breakMinutes * 60000);
        const productiveHours = productiveMs / (1000 * 60 * 60);
        const wholeH = Math.floor(productiveHours);
        const mins = Math.round((productiveHours - wholeH) * 60);
        productiveHoursToday = `${wholeH}h ${mins}m`;
      }

      const correctionsThisMonthForUser = monthRecords.filter(r => r.isCorrect).length;

      res.json({
        todayStatus,
        punchInTime: todayRecord?.punchIn || null,
        punchOutTime: todayRecord?.punchOut || null,
        presentDaysThisMonth: presentRecords.length,
        totalHoursThisMonth: totalHours.toFixed(1),
        pendingLeaveRequests: pendingCount,
        leaveBalances: activeBalances,
        productiveHoursToday,
        correctionsThisMonth: correctionsThisMonthForUser,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // --- Holidays ---
  app.get("/api/hr/holidays", requireAuth, async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const result = await storage.getHolidays(year);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch holidays" });
    }
  });

  app.post("/api/hr/holidays", requirePermission("hr.holidays", "hr"), async (req, res) => {
    try {
      const result = insertHolidaySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid holiday data", details: result.error.issues });
      }
      const holiday = await storage.createHoliday(result.data);

      if (holiday.type === "public" || holiday.type === "mandatory") {
        const stamped = await storage.stampHolidayForAllActiveEmployees(holiday.date);
        console.log(`[holidays] Auto-stamped ${stamped} attendance records for ${holiday.type} holiday "${holiday.name}" on ${holiday.date}`);
      }

      res.status(201).json(holiday);
    } catch (error) {
      res.status(500).json({ error: "Failed to create holiday" });
    }
  });

  app.post("/api/hr/holidays/upload", requirePermission("hr.holidays.upload", "hr"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const csvContent = req.file.buffer.toString("utf-8");
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });

      if (!records || records.length === 0) {
        return res.status(400).json({ error: "CSV file is empty or has no valid rows" });
      }

      const year = req.body.year ? parseInt(req.body.year) : new Date().getFullYear();
      const note = req.body.note || null;

      const created: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i] as Record<string, string>;
        const rowNum = i + 2;

        const dateStr = row["Date"] || row["date"] || "";
        const holidayName = row["Holiday Name"] || row["holiday_name"] || row["name"] || "";
        const regionalHoliday = row["Regional Holiday"] || row["regional_holiday"] || row["regional"] || "";

        if (!dateStr && !holidayName && !regionalHoliday) continue;

        const parsedDate = parseDateString(dateStr, year);
        if (!parsedDate) {
          errors.push(`Row ${rowNum}: Could not parse date "${dateStr}"`);
          continue;
        }

        if (holidayName) {
          try {
            const h = await storage.createHoliday({
              name: holidayName,
              date: parsedDate,
              type: "public",
              isOptional: false,
            });
            created.push(h);
            await storage.stampHolidayForAllActiveEmployees(parsedDate);
          } catch (e: any) {
            errors.push(`Row ${rowNum}: Failed to create holiday "${holidayName}"`);
          }
        }

        if (regionalHoliday) {
          try {
            const h = await storage.createHoliday({
              name: regionalHoliday,
              date: parsedDate,
              type: "regional",
              isOptional: true,
            });
            created.push(h);
          } catch (e: any) {
            errors.push(`Row ${rowNum}: Failed to create regional holiday "${regionalHoliday}"`);
          }
        }
      }

      res.json({
        message: `Imported ${created.length} holiday(s) successfully`,
        imported: created.length,
        errors,
        note,
      });
    } catch (error: any) {
      console.error("Holiday CSV upload error:", error);
      res.status(500).json({ error: "Failed to process holiday CSV file" });
    }
  });

  app.patch("/api/hr/holidays/:id", requirePermission("hr.holidays", "hr"), async (req, res) => {
    try {
      const holiday = await storage.updateHoliday(req.params.id as string, req.body);
      if (!holiday) return res.status(404).json({ error: "Holiday not found" });
      res.json(holiday);
    } catch (error) {
      res.status(500).json({ error: "Failed to update holiday" });
    }
  });

  app.delete("/api/hr/holidays/:id", requirePermission("hr.holidays", "hr"), async (req, res) => {
    try {
      const holiday = await storage.getHoliday(req.params.id as string);
      if (holiday && (holiday.type === "public" || holiday.type === "mandatory")) {
        const removed = await storage.removeHolidayAttendanceStamps(holiday.date);
        console.log(`[holidays] Removed ${removed} holiday attendance stamps for "${holiday.name}" on ${holiday.date}`);
      }
      await storage.deleteHoliday(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete holiday" });
    }
  });

  app.get("/api/hr/regional-holiday-selections", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const selections = await storage.getRegionalHolidaySelections(userId, year);
      res.json(selections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch regional holiday selections" });
    }
  });

  app.post("/api/hr/regional-holiday-selections", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { holidayId } = req.body;
      if (!holidayId) {
        return res.status(400).json({ error: "holidayId is required" });
      }

      const holiday = await storage.getHoliday(holidayId);
      if (!holiday || holiday.type !== "regional") {
        return res.status(400).json({ error: "Invalid regional holiday" });
      }

      const holidayYear = parseInt(holiday.date.substring(0, 4)) || new Date().getFullYear();

      const existing = await storage.getRegionalHolidaySelections(userId, holidayYear);
      if (existing.length >= 2) {
        return res.status(400).json({ error: "You can only select up to 2 regional holidays per year" });
      }
      if (existing.some(s => s.holidayId === holidayId)) {
        return res.status(400).json({ error: "You have already selected this holiday" });
      }

      const selection = await storage.createRegionalHolidaySelection({
        userId,
        holidayId,
        year: holidayYear,
      });

      await storage.stampHolidayAttendance(userId, holiday.date, "regional");
      console.log(`[holidays] Auto-stamped regional holiday "${holiday.name}" on ${holiday.date} for user ${userId}`);

      res.status(201).json(selection);
    } catch (error) {
      console.error("Regional holiday selection error:", error);
      res.status(500).json({ error: "Failed to save regional holiday selection" });
    }
  });

  app.delete("/api/hr/regional-holiday-selections/:id", requireAuth, async (req, res) => {
    try {
      const selectionId = req.params.id as string;
      const userId = req.session.userId!;
      const userRole = req.session.role;

      const allSelections = await storage.getRegionalHolidaySelections(userId, new Date().getFullYear());
      const selection = allSelections.find(s => s.id === selectionId);

      if (selection) {
        const holiday = await storage.getHoliday(selection.holidayId);
        if (holiday) {
          await storage.removeUserHolidayAttendanceStamp(userId, holiday.date, "regional");
        }
      }

      const isAdmin = ["super_admin", "admin", "hr"].includes(userRole!);
      await storage.deleteRegionalHolidaySelection(selectionId, isAdmin ? undefined : userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove regional holiday selection" });
    }
  });

  // --- Attendance ---
  app.get("/api/hr/attendance/today", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const record = await storage.getTodayAttendance(userId);
      res.json(record || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch today's attendance" });
    }
  });

  async function checkTrainingCompliance(userId: string, userRole: string): Promise<{ locked: boolean; trackTitles: string[] }> {
    const EXEMPT_ROLES = ["super_admin", "admin"];
    const LOCKABLE_ROLES = ["hr", "finance", "manager", "operations", "employee"];
    if (EXEMPT_ROLES.includes(userRole) || !LOCKABLE_ROLES.includes(userRole)) return { locked: false, trackTitles: [] };

    const now = new Date();
    const assignments = await db.select({
      id: trackAssignments.id,
      trackId: trackAssignments.trackId,
      status: trackAssignments.status,
      dueDate: trackAssignments.dueDate,
    }).from(trackAssignments).where(eq(trackAssignments.userId, userId));

    const overdueAssignments = assignments.filter(a =>
      a.status !== "completed" && a.dueDate && new Date(a.dueDate) < now
    );

    if (overdueAssignments.length === 0) return { locked: false, trackTitles: [] };

    const approvedExtensions = await db.select()
      .from(trainingExtensionRequests)
      .where(and(
        eq(trainingExtensionRequests.userId, userId),
        eq(trainingExtensionRequests.status, "approved"),
      ));

    const approvedByAssignment = new Map<string, Date>();
    for (const ext of approvedExtensions) {
      const existing = approvedByAssignment.get(ext.assignmentId);
      if (!existing || new Date(ext.newDueDate) > existing) {
        approvedByAssignment.set(ext.assignmentId, new Date(ext.newDueDate));
      }
    }

    const stillOverdue = overdueAssignments.filter(a => {
      const approvedNewDate = approvedByAssignment.get(a.id);
      if (approvedNewDate && approvedNewDate > now) return false;
      return true;
    });

    if (stillOverdue.length === 0) return { locked: false, trackTitles: [] };

    const overdueTrackIds = stillOverdue.map(a => a.trackId);
    const tracks = await db.select({ title: learningTracks.title })
      .from(learningTracks).where(inArray(learningTracks.id, overdueTrackIds));
    return { locked: true, trackTitles: tracks.map(t => t.title) };
  }

  app.post("/api/hr/attendance/punch-in", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role!;
      const today = new Date().toISOString().split("T")[0];

      const currentUser = await storage.getAdminUser(userId);
      if (currentUser?.attendanceExempt) {
        return res.status(403).json({ error: "Attendance tracking is not applicable for your account" });
      }

      const compliance = await checkTrainingCompliance(userId, userRole);
      if (compliance.locked) {
        const existingToday = await storage.getTodayAttendance(userId);
        if (!existingToday || existingToday.punchIn) {
          if (!existingToday) {
            await storage.createAttendance({
              userId,
              date: today,
              status: "absent",
              notes: `[Training non-compliance] Overdue: ${compliance.trackTitles.join(", ")}`,
            });
          }
        }
        return res.status(403).json({
          error: "Portal locked due to overdue training",
          locked: true,
          trackTitles: compliance.trackTitles,
        });
      }

      const existing = await storage.getTodayAttendance(userId);
      if (existing) {
        // A blank "absent" row with no punch-in is an auto-generated placeholder
        // (the 23:59 sweep's "[Auto] No punch-in recorded", or a training-non-compliance
        // stub). When the employee actually punches in, convert that placeholder into a
        // real present/late record instead of rejecting them as "already punched in".
        const isAutoAbsentPlaceholder =
          !existing.punchIn &&
          existing.status === "absent" &&
          (existing.notes?.includes("[Training non-compliance]") ||
            existing.notes?.includes("[Auto] No punch-in recorded"));
        if (isAutoAbsentPlaceholder) {
          // Convert the placeholder to a real punch-in. Status is always "present"
          // regardless of shift — the timing note is informational only.
          const punchInTime = new Date();
          let punchNote: string | null = null;
          const typedUser2 = currentUser as AdminUser & { shiftId?: string | null };
          if (typedUser2.shiftId) {
            try {
              const { computeLateStatus } = await import("./attendancePolicy");
              const result = await computeLateStatus(typedUser2.shiftId, punchInTime);
              if (result?.notes) punchNote = result.notes;
            } catch { /* non-fatal */ }
          }
          const record = await storage.updateAttendance(existing.id, {
            punchIn: punchInTime,
            status: "present",
            notes: punchNote,
          });
          // Fire monthly-late escalation in background (never blocks the punch).
          if (punchNote?.includes("[Auto] Late punch-in")) {
            checkMonthlyLatesAndNotify({
              employeeId: userId,
              managerId: currentUser?.managerId ?? null,
              employeeName: employeeDisplayName(currentUser),
            }).catch(() => {});
          }
          return res.status(200).json(record);
        }
        return res.status(400).json({ error: "Already punched in today" });
      }

      // Status is always "present" — shift timing note is informational only,
      // no automatic actions or notifications are triggered.
      const punchInTime = new Date();
      let punchNote: string | null = null;
      const typedUserForShift = currentUser as AdminUser & { shiftId?: string | null };
      if (typedUserForShift.shiftId) {
        try {
          const { computeLateStatus } = await import("./attendancePolicy");
          const result = await computeLateStatus(typedUserForShift.shiftId, punchInTime);
          if (result?.notes) punchNote = result.notes;
        } catch { /* non-fatal */ }
      }
      const record = await storage.createAttendance({
        userId,
        date: today,
        punchIn: punchInTime,
        status: "present",
        notes: punchNote,
      });
      // Fire monthly-late escalation in background (never blocks the punch).
      if (punchNote?.includes("[Auto] Late punch-in")) {
        checkMonthlyLatesAndNotify({
          employeeId: userId,
          managerId: currentUser?.managerId ?? null,
          employeeName: employeeDisplayName(currentUser),
        }).catch(() => {});
      }
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to punch in" });
    }
  });

  app.post("/api/hr/attendance/punch-out", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role!;
      const today = new Date().toISOString().split("T")[0];

      const currentUser = await storage.getAdminUser(userId);
      if (currentUser?.attendanceExempt) {
        return res.status(403).json({ error: "Attendance tracking is not applicable for your account" });
      }

      const compliance = await checkTrainingCompliance(userId, userRole);
      if (compliance.locked) {
        const existingToday = await storage.getTodayAttendance(userId);
        if (!existingToday) {
          await storage.createAttendance({
            userId,
            date: today,
            status: "absent",
            notes: `[Training non-compliance] Overdue: ${compliance.trackTitles.join(", ")}`,
          });
        }
        return res.status(403).json({
          error: "Portal locked due to overdue training",
          locked: true,
          trackTitles: compliance.trackTitles,
        });
      }

      // Locate the OPEN session (most recent record with a punch-in and no
      // punch-out) rather than a strict UTC-today row. A night-shift session that
      // starts in the evening (record dated the start day) and ends after 00:00
      // UTC (= 5:30 AM IST the next day) must still attach to its start-day row;
      // a UTC-today lookup would miss it and lose the log-off time.
      const existing = await storage.getOpenAttendance(userId);
      if (!existing) {
        // Fall back to today's row to surface the precise reason (already punched
        // out vs never punched in) without blocking.
        const todayRow = await storage.getTodayAttendance(userId);
        if (todayRow?.punchOut) {
          return res.status(400).json({ error: "Already punched out" });
        }
        return res.status(400).json({ error: "No active punch-in record found" });
      }
      const punchOut = new Date();
      const punchIn = existing.punchIn ? new Date(existing.punchIn) : punchOut;
      const diffMs = punchOut.getTime() - punchIn.getTime();
      const totalHoursNum = diffMs / (1000 * 60 * 60);
      const totalHours = totalHoursNum.toFixed(2);

      // Determine completion status using configurable standard shift hours.
      // Shift users go through computeDayCompletionStatus (reads standard_shift_hours setting).
      // Shiftless users fall back to the same setting with >= 50% / < 100% thresholds.
      const currentStatus = existing.status as string;
      let updatedStatus: string | undefined;
      const noteSegments: string[] = [];
      const typedUserOut = currentUser as AdminUser & { shiftId?: string | null };

      if (currentStatus !== "absent") {
        if (typedUserOut?.shiftId) {
          try {
            const { computeDayCompletionStatus, computeLogoutStatus } = await import("./attendancePolicy");
            const completionResult = await computeDayCompletionStatus(typedUserOut.shiftId, totalHoursNum, currentStatus);
            if (completionResult.status !== currentStatus) updatedStatus = completionResult.status;
            if (completionResult.notes) noteSegments.push(completionResult.notes);
            // Logout timing note (early / on-time / overtime)
            const logout = await computeLogoutStatus(typedUserOut.shiftId, punchOut);
            if (logout?.notes) noteSegments.push(logout.notes);
          } catch { /* non-fatal — status stays as-is */ }
        } else {
          // No shift assigned: use configurable standard_shift_hours (≥50% → short_day, <50% → half_day)
          let stdHours = 9.0;
          try {
            const setting = await storage.getSystemSetting("standard_shift_hours");
            if (setting?.value && typeof setting.value === "number" && setting.value > 0) stdHours = setting.value;
          } catch { /* use default 9h */ }
          if (totalHoursNum < stdHours / 2) updatedStatus = "half_day";
          else if (totalHoursNum < stdHours) updatedStatus = "short_day";
        }
      }

      const updatePayload: Partial<typeof existing> & { punchOut: Date; totalHours: string; status?: string; notes?: string } = { punchOut, totalHours };
      if (updatedStatus) updatePayload.status = updatedStatus;
      if (noteSegments.length > 0) {
        const existingNotes = existing.notes ? `${existing.notes}; ` : "";
        updatePayload.notes = existingNotes + noteSegments.join("; ");
      }

      const record = await storage.updateAttendance(existing.id, updatePayload);

      // Auto-create attendance exception row when punch-out produces a short_day
      if (updatedStatus === "short_day") {
        const [stdHoursSetting, minShortfallSetting] = await Promise.all([
          storage.getSystemSetting("standard_shift_hours").catch(() => null),
          storage.getSystemSetting("min_exception_shortfall_minutes").catch(() => null),
        ]);
        const standardHours = (stdHoursSetting?.value && typeof stdHoursSetting.value === "number")
          ? stdHoursSetting.value
          : 9.0;
        const minShortfallMinutes = (minShortfallSetting?.value && typeof minShortfallSetting.value === "number")
          ? minShortfallSetting.value
          : 30;
        const shortfallHours = standardHours - totalHoursNum;
        // Rounding guard: treat sub-0.05h as zero (floating-point artefact)
        const effectiveShortfallHours = shortfallHours < 0.05 ? 0 : shortfallHours;
        const shortfallMinutes = effectiveShortfallHours * 60;
        if (shortfallMinutes > minShortfallMinutes) {
          createExceptionForShortDay(
            existing.id,
            userId,
            currentUser?.managerId ?? null,
            totalHoursNum,
            standardHours,
          ).catch((err: any) => console.error("[punch-out] createExceptionForShortDay failed:", err));
        } else {
          console.log(`[punch-out] Skipping exception for ${userId}: shortfall ${shortfallMinutes.toFixed(1)}min ≤ threshold ${minShortfallMinutes}min`);
        }
      }

      // Fire escalation tier check for short_day or late final status
      if (updatedStatus === "short_day" || updatedStatus === "late" || (!updatedStatus && currentStatus === "late")) {
        checkEscalationTiers(userId).catch((err: any) =>
          console.error("[punch-out] checkEscalationTiers failed:", err)
        );
      }

      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to punch out" });
    }
  });

  // --- Break Records ---
  app.get("/api/hr/attendance/breaks/today", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const today = new Date().toISOString().split("T")[0];
      const records = await db.select().from(breakRecords)
        .where(and(eq(breakRecords.userId, userId), eq(breakRecords.date, today)));
      const totalMinutes = records.reduce((sum, r) => sum + parseFloat(r.durationMinutes || "0"), 0);
      const activeBreak = records.find(r => !r.endedAt) || null;
      const lunchTaken = records.filter(r => r.breakType === "lunch" && r.endedAt);
      const teaTaken = records.filter(r => r.breakType === "tea" && r.endedAt);
      const lunchCount = records.filter(r => r.breakType === "lunch").length;
      const teaCount = records.filter(r => r.breakType === "tea").length;

      // Fetch shift details for this user
      let shiftInfo: {
        name: string;
        istStart: string;
        istEnd: string;
        usCoverage: string;
        isDst: boolean;
        tea1WindowStart: string;
        tea1WindowEnd: string;
        lunchWindowStart: string;
        lunchWindowEnd: string;
        tea2WindowStart: string;
        tea2WindowEnd: string;
      } | null = null;

      const userShiftRow = await db.execute(sql`
        SELECT u.shift_id, s.name, s.ist_start_dst, s.ist_end_dst, s.ist_start_std, s.ist_end_std,
               s.scheduled_hours, s.us_coverage, s.us_coverage_dst, s.us_coverage_std
        FROM admin_users u
        LEFT JOIN shifts s ON s.id = u.shift_id AND s.is_active = true
        WHERE u.id = ${userId} LIMIT 1
      `);

      if (userShiftRow.rows.length > 0) {
        const row = userShiftRow.rows[0] as any;
        if (row.shift_id && row.name) {
          const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
          const istDate = new Date(Date.now() + IST_OFFSET_MS);
          const todayStr = istDate.toISOString().slice(0, 10);
          const year = parseInt(todayStr.slice(0, 4), 10);
          const dstRows = await db.execute(sql`
            SELECT spring_forward_date, fall_back_date FROM dst_config WHERE year = ${year} LIMIT 1
          `);
          let isDst = false;
          if (dstRows.rows.length > 0) {
            const dr = dstRows.rows[0] as any;
            isDst = todayStr >= dr.spring_forward_date && todayStr < dr.fall_back_date;
          }
          const istStart: string = isDst ? row.ist_start_dst : row.ist_start_std;
          const istEnd: string = isDst ? row.ist_end_dst : row.ist_end_std;

          // Compute break windows
          const startMins = (function parseT(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; })(istStart);
          let endMins = (function parseT(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; })(istEnd);
          if (endMins <= startMins) endMins += 1440;
          const duration = endMins - startMins;
          const midMins = startMins + Math.floor(duration / 2);
          const fmtM = (m: number) => { const n = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2,"0")}:${String(n % 60).padStart(2,"0")}`; };

          shiftInfo = {
            name: row.name,
            istStart,
            istEnd,
            usCoverage: isDst ? (row.us_coverage_dst ?? row.us_coverage) : (row.us_coverage_std ?? row.us_coverage),
            isDst,
            tea1WindowStart: fmtM(startMins + 90),
            tea1WindowEnd: fmtM(midMins),
            lunchWindowStart: fmtM(midMins - 30),
            lunchWindowEnd: fmtM(midMins + 30),
            tea2WindowStart: fmtM(midMins),
            tea2WindowEnd: fmtM(endMins - 90),
          };
        }
      }

      res.json({
        breaks: records,
        totalMinutes,
        lunchMinutes: lunchTaken.reduce((s, r) => s + parseFloat(r.durationMinutes || "0"), 0),
        teaMinutes: teaTaken.reduce((s, r) => s + parseFloat(r.durationMinutes || "0"), 0),
        activeBreak,
        entitlement: { lunch: 30, tea: 15, teaCount: 2, total: 60 },
        lunchCount,
        teaCount,
        shift: shiftInfo,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch break records" });
    }
  });

  app.post("/api/hr/attendance/breaks/start", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const today = new Date().toISOString().split("T")[0];
      const { breakType } = req.body;
      if (!breakType || !["lunch", "tea"].includes(breakType)) {
        return res.status(400).json({ error: "Invalid break type. Must be 'lunch' or 'tea'" });
      }
      const todayAttendance = await storage.getTodayAttendance(userId);
      if (!todayAttendance || !todayAttendance.punchIn || todayAttendance.punchOut) {
        return res.status(400).json({ error: "You must be punched in to start a break" });
      }
      const existing = await db.select().from(breakRecords)
        .where(and(eq(breakRecords.userId, userId), eq(breakRecords.date, today)));
      const activeBreak = existing.find(r => !r.endedAt);
      if (activeBreak) {
        return res.status(400).json({ error: "You already have an active break. End it first." });
      }
      // Check limits
      const lunchCount = existing.filter(r => r.breakType === "lunch" && r.endedAt).length;
      const teaCount = existing.filter(r => r.breakType === "tea" && r.endedAt).length;
      if (breakType === "lunch" && lunchCount >= 1) {
        return res.status(400).json({ error: "Lunch break already taken today" });
      }
      if (breakType === "tea" && teaCount >= 2) {
        return res.status(400).json({ error: "Both tea breaks already taken today" });
      }
      const [record] = await db.insert(breakRecords).values({
        userId,
        attendanceId: todayAttendance.id,
        date: today,
        breakType: breakType as "lunch" | "tea",
        startedAt: new Date(),
      }).returning();
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to start break" });
    }
  });

  app.post("/api/hr/attendance/breaks/end", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const today = new Date().toISOString().split("T")[0];
      const existing = await db.select().from(breakRecords)
        .where(and(eq(breakRecords.userId, userId), eq(breakRecords.date, today)));
      const activeBreak = existing.find(r => !r.endedAt);
      if (!activeBreak) {
        return res.status(400).json({ error: "No active break found" });
      }
      const endedAt = new Date();
      const startedAt = new Date(activeBreak.startedAt);
      const durationMinutes = ((endedAt.getTime() - startedAt.getTime()) / 60000).toFixed(1);
      const [updated] = await db.update(breakRecords)
        .set({ endedAt, durationMinutes })
        .where(eq(breakRecords.id, activeBreak.id))
        .returning();
      // Soft warning payload
      const allocated = activeBreak.breakType === "lunch" ? 30 : 15;
      const exceeded = parseFloat(durationMinutes) > allocated;
      res.json({ ...updated, exceeded, allocated, durationMinutes: parseFloat(durationMinutes) });
    } catch (error) {
      res.status(500).json({ error: "Failed to end break" });
    }
  });

  app.get("/api/hr/attendance/breaks/team-status", requirePermission("hr.attendance.breaks.teamStatus", "hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role;
      const today = new Date().toISOString().split("T")[0];

      // Scope to authorized team members only
      let scopedUserIds: string[];
      if (["super_admin", "admin", "hr"].includes(userRole!)) {
        // Broad scope: all active users
        const allUsers = await storage.getAdminUsers();
        scopedUserIds = allUsers.map(u => u.id);
      } else {
        // manager/operations: direct reports only
        const teamMembers = await storage.getTeamMembers(userId);
        scopedUserIds = teamMembers.map(m => m.id);
      }

      if (scopedUserIds.length === 0) {
        return res.json({});
      }

      const todayBreaks = await db.select().from(breakRecords)
        .where(and(eq(breakRecords.date, today), inArray(breakRecords.userId, scopedUserIds)));

      const statusMap: Record<string, { activeBreak: typeof todayBreaks[0] | null; totalMinutes: number }> = {};
      for (const b of todayBreaks) {
        if (!statusMap[b.userId]) statusMap[b.userId] = { activeBreak: null, totalMinutes: 0 };
        if (!b.endedAt) statusMap[b.userId].activeBreak = b;
        else statusMap[b.userId].totalMinutes += parseFloat(b.durationMinutes || "0");
      }
      res.json(statusMap);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team break status" });
    }
  });

  app.get("/api/hr/attendance/my", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { startDate, endDate } = req.query;
      const records = await storage.getAttendanceByUser(
        userId,
        startDate as string,
        endDate as string
      );
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance records" });
    }
  });

  app.get("/api/hr/attendance/team", requirePermission("hr.attendance.team", "hr"), async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const records = await storage.getAttendanceByDate(date);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team attendance" });
    }
  });

  app.patch("/api/hr/attendance/:id", requirePermission("hr.attendance", "hr", "admin", "super_admin", "manager"), async (req, res) => {
    try {
      const isAdminOrSuperAdmin = ["admin", "super_admin"].includes(req.session.role!);
      const actorRole = req.session.role!;
      const actorId = req.session.userId!;

      // Shared guards: fetch record first, then validate date constraints
      const [guardRecord] = await db.select().from(attendance).where(eq(attendance.id, req.params.id as string));
      if (!guardRecord) return res.status(404).json({ error: "Attendance record not found" });

      const todayGuard = new Date().toISOString().split("T")[0];
      if (guardRecord.date > todayGuard) {
        return res.status(400).json({ error: "Cannot correct a future date" });
      }
      const dow = new Date(guardRecord.date + "T12:00:00").getDay();
      if (dow === 0 || dow === 6) {
        return res.status(400).json({ error: "Cannot correct a weekend" });
      }
      if (guardRecord.status === "on_leave" || guardRecord.status === "holiday") {
        return res.status(400).json({ error: `Cannot correct a day with status: ${guardRecord.status}` });
      }

      // Normalize incoming punch values: the client sends ISO timestamp strings (or null),
      // but the timestamp columns run in "date" mode whose driver calls .toISOString() on
      // the value — which throws on a string. Convert to Date objects (null when cleared)
      // and recompute total hours from the effective punch pair.
      const toPunchDate = (v: unknown): Date | null => {
        if (v === null || v === undefined || v === "") return null;
        if (v instanceof Date) return v;
        const d = new Date(v as string);
        return isNaN(d.getTime()) ? null : d;
      };
      const hasPunchIn = Object.prototype.hasOwnProperty.call(req.body, "punchIn");
      const hasPunchOut = Object.prototype.hasOwnProperty.call(req.body, "punchOut");
      const punchUpdate: Record<string, any> = {};
      if (hasPunchIn) punchUpdate.punchIn = toPunchDate(req.body.punchIn);
      if (hasPunchOut) punchUpdate.punchOut = toPunchDate(req.body.punchOut);
      const effectiveIn = hasPunchIn ? punchUpdate.punchIn : guardRecord.punchIn;
      const effectiveOut = hasPunchOut ? punchUpdate.punchOut : guardRecord.punchOut;
      if (hasPunchIn || hasPunchOut) {
        if (effectiveIn && effectiveOut) {
          const diffMs = new Date(effectiveOut).getTime() - new Date(effectiveIn).getTime();
          punchUpdate.totalHours = diffMs > 0 ? (diffMs / 3600000).toFixed(2) : "0.00";
        } else {
          punchUpdate.totalHours = null;
        }
      }

      // Manager: validate they can only correct their own direct reports
      if (actorRole === "manager") {
        const existing = guardRecord;
        const reporteeIds = await getAllReporteeIds(actorId);
        if (!reporteeIds.includes(existing.userId)) {
          return res.status(403).json({ error: "You do not have permission to correct this employee's attendance" });
        }
        const { correctionComment: mgrNote, ...mgrUpdateFields } = req.body;
        if (!mgrNote || !mgrNote.trim()) {
          return res.status(400).json({ error: "A correction comment is required" });
        }
        const record = await storage.updateAttendance(req.params.id as string, {
          ...mgrUpdateFields,
          ...punchUpdate,
          isCorrect: true,
          correctionSource: "manager",
          correctedById: actorId,
          correctionNote: mgrNote.trim(),
        });
        if (!record) return res.status(404).json({ error: "Attendance record not found" });
        await storage.createAuditLog({
          actorId,
          targetId: existing.userId,
          action: "correct_attendance_hours",
          changes: {
            attendanceId: existing.id,
            date: existing.date,
            old: { punchIn: existing.punchIn, punchOut: existing.punchOut, totalHours: existing.totalHours },
            new: { punchIn: record.punchIn, punchOut: record.punchOut, totalHours: record.totalHours },
            correctionComment: mgrNote.trim(),
          },
        });
        return res.json(record);
      }

      if (isAdminOrSuperAdmin) {
        const { correctionComment } = req.body;
        if (!correctionComment || typeof correctionComment !== "string" || !correctionComment.trim()) {
          return res.status(400).json({ error: "A correction comment is required" });
        }

        const existing = guardRecord;

        const { correctionComment: _omit, ...updateFields } = req.body;
        const record = await storage.updateAttendance(req.params.id as string, {
          ...updateFields,
          ...punchUpdate,
          isCorrect: true,
          correctionSource: actorRole,
          correctedById: actorId,
          correctionNote: correctionComment.trim(),
        });
        if (!record) return res.status(404).json({ error: "Attendance record not found" });

        await storage.createAuditLog({
          actorId,
          targetId: existing.userId,
          action: "correct_attendance_hours",
          changes: {
            attendanceId: existing.id,
            date: existing.date,
            old: { punchIn: existing.punchIn, punchOut: existing.punchOut, totalHours: existing.totalHours },
            new: { punchIn: record.punchIn, punchOut: record.punchOut, totalHours: record.totalHours },
            correctionComment: correctionComment.trim(),
          },
        });

        return res.json(record);
      }

      // HR role: also set correction metadata
      const { correctionComment: hrNote, ...hrUpdateFields } = req.body;
      if (!hrNote || !hrNote.trim()) {
        return res.status(400).json({ error: "A correction comment is required" });
      }
      const hrExisting = guardRecord;
      const record = await storage.updateAttendance(req.params.id as string, {
        ...hrUpdateFields,
        ...punchUpdate,
        isCorrect: true,
        correctionSource: "hr",
        correctedById: actorId,
        correctionNote: hrNote.trim(),
      });
      if (!record) return res.status(404).json({ error: "Attendance record not found" });

      await storage.createAuditLog({
        actorId,
        targetId: hrExisting.userId,
        action: "correct_attendance_hours",
        changes: {
          attendanceId: hrExisting.id,
          date: hrExisting.date,
          old: { punchIn: hrExisting.punchIn, punchOut: hrExisting.punchOut, totalHours: hrExisting.totalHours },
          new: { punchIn: record.punchIn, punchOut: record.punchOut, totalHours: record.totalHours },
          correctionComment: hrNote.trim(),
        },
      });
      res.json(record);
    } catch (error) {
      console.error(
        `[PATCH /api/hr/attendance/${req.params.id}] failed to update attendance:`,
        error instanceof Error ? `${error.message}\n${error.stack}` : error
      );
      res.status(500).json({ error: "Failed to update attendance" });
    }
  });

  // --- Admin Correction Upsert (absent days + existing records) ---
  app.post("/api/hr/attendance/admin-correction", requirePermission("hr.attendance.adminCorrection", "hr", "manager", "admin", "super_admin"), async (req, res) => {
    try {
      const actorRole = req.session.role!;
      const actorId = req.session.userId!;
      const { userId, date, punchIn, punchOut, totalHours, correctionNote } = req.body;

      if (!userId || !date || !correctionNote || !correctionNote.trim()) {
        return res.status(400).json({ error: "userId, date, and correctionNote are required" });
      }

      // Validate date is not future
      const todayStr = new Date().toISOString().split("T")[0];
      if (date > todayStr) {
        return res.status(400).json({ error: "Cannot correct a future date" });
      }

      // Validate not a weekend
      const dayOfWeek = new Date(date + "T12:00:00").getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return res.status(400).json({ error: "Cannot correct a weekend" });
      }

      // Check if date is on_leave or holiday
      const [existingRecord] = await db.select().from(attendance)
        .where(and(eq(attendance.userId, userId), eq(attendance.date, date)));

      if (existingRecord && (existingRecord.status === "on_leave" || existingRecord.status === "holiday")) {
        return res.status(400).json({ error: `Cannot correct a day with status: ${existingRecord.status}` });
      }

      // Manager: validate team access
      if (actorRole === "manager") {
        const reporteeIds = await getAllReporteeIds(actorId);
        if (!reporteeIds.includes(userId)) {
          return res.status(403).json({ error: "You do not have permission to correct this employee's attendance" });
        }
      }

      // For no-record case (absent day), also check holidays table and approved leave
      if (!existingRecord) {
        const [holidayRow] = await db.execute(sql`
          SELECT id FROM holidays WHERE date = ${date} LIMIT 1
        `).then(r => r.rows as { id: string }[]);
        if (holidayRow) {
          return res.status(400).json({ error: "Cannot correct a day that is a public holiday" });
        }
        const approvedLeave = await db.execute(sql`
          SELECT id FROM leave_requests
          WHERE user_id = ${userId}
            AND status = 'approved'
            AND start_date <= ${date}
            AND end_date >= ${date}
          LIMIT 1
        `).then(r => r.rows as { id: string }[]);
        if (approvedLeave.length > 0) {
          return res.status(400).json({ error: "Cannot correct a day that is covered by an approved leave" });
        }
      }

      const punchInTs = punchIn ? new Date(`${date}T${punchIn}:00`) : null;
      const punchOutTs = punchOut ? new Date(`${date}T${punchOut}:00`) : null;
      let computedHours = totalHours ? String(totalHours) : null;
      if (punchInTs && punchOutTs && !computedHours) {
        computedHours = ((punchOutTs.getTime() - punchInTs.getTime()) / (1000 * 60 * 60)).toFixed(2);
      }

      const correctionData = {
        userId,
        date,
        punchIn: punchInTs,
        punchOut: punchOutTs,
        totalHours: computedHours,
        status: "present" as const,
        isCorrect: true,
        correctionSource: actorRole,
        correctedById: actorId,
        correctionNote: correctionNote.trim(),
      };

      const oldValues = existingRecord
        ? { punchIn: existingRecord.punchIn, punchOut: existingRecord.punchOut, totalHours: existingRecord.totalHours, status: existingRecord.status }
        : null;

      let record: Attendance;
      if (existingRecord) {
        const updated = await storage.updateAttendance(existingRecord.id, correctionData);
        if (!updated) return res.status(404).json({ error: "Attendance record not found after update" });
        record = updated;
      } else {
        record = await storage.createAttendance(correctionData);
      }

      await storage.createAuditLog({
        actorId,
        targetId: userId,
        action: "admin_correction_attendance",
        changes: {
          date,
          old: oldValues || "no_record",
          new: { punchIn: punchInTs, punchOut: punchOutTs, totalHours: computedHours, status: "present" },
          correctionNote: correctionNote.trim(),
          correctionSource: actorRole,
        },
      });

      res.json(record);
    } catch (error) {
      console.error("Admin correction error:", error);
      res.status(500).json({ error: "Failed to save attendance correction" });
    }
  });

  // --- Corrections Summary ---
  app.get("/api/hr/attendance/corrections-summary", requirePermission("hr.attendance.correctionsSummary", "admin", "super_admin", "hr", "operations", "manager"), async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      interface CorrectionRow {
        corrected_by_id: string | null;
        user_id: string;
        date: string;
        employee_name: string;
        employee_email: string;
        corrected_by_name: string | null;
      }

      const actorRole = req.session.role!;
      const actorId = req.session.userId!;

      // Manager: restrict to direct reportees only
      let userIdFilter: string[] | null = null;
      if (actorRole === "manager") {
        userIdFilter = await getAllReporteeIds(actorId);
        if (userIdFilter.length === 0) {
          return res.json({ totalCorrections: 0, affectedCount: 0, perEmployee: [] });
        }
      }

      const baseQuery = userIdFilter
        ? sql`
          SELECT
            a.corrected_by_id,
            a.user_id,
            a.date,
            u.first_name || ' ' || u.last_name AS employee_name,
            u.email AS employee_email,
            cb.first_name || ' ' || cb.last_name AS corrected_by_name
          FROM attendance a
          JOIN admin_users u ON u.id = a.user_id
          LEFT JOIN admin_users cb ON cb.id = a.corrected_by_id
          WHERE a.is_corrected = TRUE
            AND a.date >= ${startDate}
            AND a.date <= ${endDate}
            AND a.user_id = ANY(${userIdFilter})
          ORDER BY a.date DESC`
        : sql`
          SELECT
            a.corrected_by_id,
            a.user_id,
            a.date,
            u.first_name || ' ' || u.last_name AS employee_name,
            u.email AS employee_email,
            cb.first_name || ' ' || cb.last_name AS corrected_by_name
          FROM attendance a
          JOIN admin_users u ON u.id = a.user_id
          LEFT JOIN admin_users cb ON cb.id = a.corrected_by_id
          WHERE a.is_corrected = TRUE
            AND a.date >= ${startDate}
            AND a.date <= ${endDate}
          ORDER BY a.date DESC`;

      const rows = await db.execute(baseQuery);
      const corrections = rows.rows as CorrectionRow[];
      const totalCorrections = corrections.length;
      const affectedEmployeeIds = new Set(corrections.map(r => r.user_id));
      const affectedCount = affectedEmployeeIds.size;

      const employeeMap = new Map<string, { name: string; email: string; correctedDays: number }>();
      for (const row of corrections) {
        const key = row.user_id;
        if (!employeeMap.has(key)) {
          employeeMap.set(key, { name: row.employee_name, email: row.employee_email, correctedDays: 0 });
        }
        employeeMap.get(key)!.correctedDays++;
      }

      res.json({
        totalCorrections,
        affectedCount,
        perEmployee: Array.from(employeeMap.values()),
      });
    } catch (error) {
      console.error("Corrections summary error:", error);
      res.status(500).json({ error: "Failed to fetch corrections summary" });
    }
  });

  // --- Leave Types ---
  app.get("/api/hr/leave-types", requireAuth, async (req, res) => {
    try {
      const types = await storage.getLeaveTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave types" });
    }
  });

  app.post("/api/hr/leave-types", requirePermission("hr.leaveTypes", "hr"), async (req, res) => {
    try {
      const result = insertLeaveTypeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid leave type data", details: result.error.issues });
      }
      const lt = await storage.createLeaveType(result.data);
      res.status(201).json(lt);
    } catch (error) {
      res.status(500).json({ error: "Failed to create leave type" });
    }
  });

  app.patch("/api/hr/leave-types/:id", requirePermission("hr.leaveTypes", "hr"), async (req, res) => {
    try {
      const lt = await storage.updateLeaveType(req.params.id as string, req.body);
      if (!lt) return res.status(404).json({ error: "Leave type not found" });
      res.json(lt);
    } catch (error) {
      res.status(500).json({ error: "Failed to update leave type" });
    }
  });

  app.get("/api/hr/leave-types/:id/usage", requirePermission("hr.leaveTypes", "hr"), async (req, res) => {
    try {
      const usage = await storage.getLeaveTypeUsage(req.params.id as string);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave type usage" });
    }
  });

  // Safe delete is restricted to super_admin. When the type is in use, the caller must
  // choose how to clear dependents: "transfer" remaining balances into another type, or
  // "expire" (discard balances/history). A clean (unused) type can be deleted directly.
  app.delete("/api/hr/leave-types/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ error: "Only a Super Admin can delete a leave type" });
      }
      const id = req.params.id as string;
      const { mode, targetLeaveTypeId } = (req.body || {}) as { mode?: "transfer" | "expire"; targetLeaveTypeId?: string };

      const usage = await storage.getLeaveTypeUsage(id);
      const inUse = usage.balances > 0 || usage.accruals > 0 || usage.adjustments > 0 || usage.requests > 0;

      if (!inUse) {
        await storage.deleteLeaveType(id);
        return res.status(200).json({ deleted: true });
      }

      if (mode !== "transfer" && mode !== "expire") {
        return res.status(409).json({
          error: "Leave type is in use. Choose how to handle existing data.",
          requiresChoice: true,
          usage,
        });
      }
      if (mode === "transfer" && !targetLeaveTypeId) {
        return res.status(400).json({ error: "A target leave type is required to transfer balances" });
      }

      await storage.deleteLeaveTypeSafe(id, { mode, targetLeaveTypeId });
      res.status(200).json({ deleted: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to delete leave type" });
    }
  });

  // --- Leave Balances ---
  app.get("/api/hr/leave-balances/my", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      let balances = await storage.getLeaveBalances(userId, year);
      if (balances.length === 0) {
        balances = await storage.initLeaveBalances(userId, year);
      }
      const ltAll = await storage.getLeaveTypes();
      const activeIds = new Set(ltAll.filter(lt => lt.isActive).map(lt => lt.id));
      balances = balances.filter(b => activeIds.has(b.leaveTypeId));
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave balances" });
    }
  });

  app.get("/api/hr/leave-balances/:userId", requirePermission("hr.leaveBalances", "hr"), async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      let balances = await storage.getLeaveBalances(req.params.userId as string, year);
      if (balances.length === 0) {
        balances = await storage.initLeaveBalances(req.params.userId as string, year);
      }
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave balances" });
    }
  });

  app.patch("/api/hr/leave-balances/:id", requirePermission("hr.leaveBalances", "hr"), async (req, res) => {
    try {
      const lb = await storage.updateLeaveBalance(req.params.id as string, req.body);
      if (!lb) return res.status(404).json({ error: "Leave balance not found" });
      res.json(lb);
    } catch (error) {
      res.status(500).json({ error: "Failed to update leave balance" });
    }
  });

  app.post("/api/hr/leave-accruals/run", requirePermission("hr.leaveAccruals.run", "hr"), async (req, res) => {
    try {
      const now = new Date();
      const rawYear = req.body.year ?? now.getFullYear();
      const rawMonth = req.body.month ?? (now.getMonth() + 1);
      const targetYear = Number(rawYear);
      const targetMonth = Number(rawMonth);
      if (!Number.isInteger(targetYear) || targetYear < 2020 || targetYear > 2100) {
        return res.status(400).json({ error: "Invalid year (must be 2020-2100)" });
      }
      if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
        return res.status(400).json({ error: "Invalid month (must be 1-12)" });
      }
      const result = await storage.accrueMonthlyLeaves(targetYear, targetMonth);

      // Emit per-employee in-app notifications (same as scheduler path)
      const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
      const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
      const notificationsEnabled = featureFlags.notifications_enabled === true;
      if (notificationsEnabled) {
        const monthName = new Date(targetYear, targetMonth - 1).toLocaleString("en-IN", { month: "long" });
        const userMap = new Map<string, { types: { leaveTypeName: string; days: number; newBalance: number; accrualType: string }[] }>();
        for (const d of result.processedDetails) {
          const entry = userMap.get(d.userId);
          if (entry) entry.types.push({ leaveTypeName: d.leaveTypeName, days: d.accruedDays, newBalance: d.newBalance, accrualType: d.accrualType });
          else userMap.set(d.userId, { types: [{ leaveTypeName: d.leaveTypeName, days: d.accruedDays, newBalance: d.newBalance, accrualType: d.accrualType }] });
        }
        for (const [userId, info] of Array.from(userMap.entries())) {
          const typesSummary = info.types.map((t: { leaveTypeName: string; days: number; newBalance: number; accrualType: string }) => {
            const bonus = t.accrualType === "monthly+bonus" ? " (incl. bonus)" : "";
            return `${t.leaveTypeName}: +${t.days}${bonus} → balance: ${t.newBalance.toFixed(1)}`;
          }).join("; ");
          try {
            await storage.createNotification({
              userId,
              type: "leave_accrual",
              title: `${monthName} ${targetYear} Leave Credited`,
              message: `Your leave has been credited for ${monthName} ${targetYear}. ${typesSummary}.`,
              isRead: false,
              metadata: { year: targetYear, month: targetMonth, types: info.types },
            });
          } catch (_) { /* non-fatal */ }
        }
      }

      res.json({
        message: `Accrual completed for ${targetMonth}/${targetYear}`,
        ...result,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to run leave accrual" });
    }
  });

  app.post("/api/hr/leave-accruals/year-end", requirePermission("hr.leaveAccruals.yearEnd", "hr"), async (req, res) => {
    try {
      const year = Number(req.body.year ?? new Date().getFullYear());
      if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        return res.status(400).json({ error: "Invalid year" });
      }
      const result = await storage.runYearEndBatch(year);
      res.json({ message: `Year-end batch completed for ${year}`, ...result });
    } catch (error) {
      res.status(500).json({ error: "Failed to run year-end batch" });
    }
  });

  app.post("/api/admin/hr/backfill-leave-accruals", requireAuth, async (req, res) => {
    if (req.session.role !== "super_admin") {
      return res.status(403).json({ error: "Super admin access required" });
    }
    try {
      const dryRun = req.body?.dryRun === true;
      const overrides: Array<{ userId: string; elOverride?: number; slOverride?: number; note: string }> = req.body?.overrides ?? [];
      const overrideNote: string = (req.body?.overrideNote ?? "").trim();

      if (!dryRun && overrides.length > 0 && overrideNote.length === 0) {
        return res.status(400).json({ error: "A non-empty override note is required when applying per-employee overrides." });
      }

      const result = await storage.backfillLeaveAccruals(dryRun);

      // After successful backfill (non-dry-run), apply per-employee overrides as audit-logged adjustments
      if (!dryRun && overrides.length > 0) {
        // Build a lookup of computed values from the result
        const computedMap: Record<string, { elAdded: number; slAdded: number }> = {};
        for (const d of result.details) {
          computedMap[d.userId] = { elAdded: d.elAdded, slAdded: d.slAdded };
        }

        for (const ov of overrides) {
          const computed = computedMap[ov.userId];
          if (!computed) continue;

          // Determine EL and SL leave type IDs from resolved types
          const elTypeId = result.resolvedLeaveTypes.el.id;
          const slTypeId = result.resolvedLeaveTypes.sl.id;
          const year = 2026;
          const actorId = req.session.userId!;
          const reason = `Backfill override: ${overrideNote}`;

          if (ov.elOverride !== undefined) {
            const elDelta = parseFloat((ov.elOverride - computed.elAdded).toFixed(4));
            if (Math.abs(elDelta) >= 0.001) {
              // Insert leave_adjustments row (visible in normal HR audit views)
              await db.insert(leaveAdjustments).values({
                userId: ov.userId,
                leaveTypeId: elTypeId,
                adjustmentDays: String(elDelta),
                reason,
                year,
                adjustedBy: actorId,
              });
              // Mirror in leave_accruals as hr_adjustment — manual upsert because
              // leave_accruals has no unique constraint on (userId, leaveTypeId, year, month, accrualType)
              const existingElAcc = await db.select().from(leaveAccruals).where(
                and(
                  eq(leaveAccruals.userId, ov.userId),
                  eq(leaveAccruals.leaveTypeId, elTypeId),
                  eq(leaveAccruals.year, year),
                  eq(leaveAccruals.month, 0),
                  sql`${leaveAccruals.accrualType} = 'hr_adjustment'`
                )
              ).limit(1);
              if (existingElAcc.length > 0) {
                const newAccrued = parseFloat(existingElAcc[0].accruedDays) + elDelta;
                await db.update(leaveAccruals)
                  .set({ accruedDays: String(newAccrued), skipReason: reason })
                  .where(eq(leaveAccruals.id, existingElAcc[0].id));
              } else {
                await db.insert(leaveAccruals).values({
                  userId: ov.userId,
                  leaveTypeId: elTypeId,
                  year,
                  month: 0,
                  accruedDays: String(elDelta),
                  hoursWorked: "0",
                  qualified: true,
                  accrualType: "hr_adjustment",
                  skipReason: reason,
                });
              }
              // Update leave_balances to reflect the delta
              const existingBal = await db.select().from(leaveBalances).where(
                and(eq(leaveBalances.userId, ov.userId), eq(leaveBalances.leaveTypeId, elTypeId), eq(leaveBalances.year, year))
              ).limit(1);
              if (existingBal.length > 0) {
                const newTotal = Math.max(parseFloat(existingBal[0].usedDays), parseFloat(existingBal[0].totalDays) + elDelta);
                await db.update(leaveBalances)
                  .set({ totalDays: String(parseFloat(newTotal.toFixed(2))), updatedAt: new Date() })
                  .where(eq(leaveBalances.id, existingBal[0].id));
              }
            }
          }

          if (ov.slOverride !== undefined) {
            const slDelta = parseFloat((ov.slOverride - computed.slAdded).toFixed(4));
            if (Math.abs(slDelta) >= 0.001) {
              await db.insert(leaveAdjustments).values({
                userId: ov.userId,
                leaveTypeId: slTypeId,
                adjustmentDays: String(slDelta),
                reason,
                year,
                adjustedBy: actorId,
              });
              // Manual upsert for same reason as EL above
              const existingSlAcc = await db.select().from(leaveAccruals).where(
                and(
                  eq(leaveAccruals.userId, ov.userId),
                  eq(leaveAccruals.leaveTypeId, slTypeId),
                  eq(leaveAccruals.year, year),
                  eq(leaveAccruals.month, 0),
                  sql`${leaveAccruals.accrualType} = 'hr_adjustment'`
                )
              ).limit(1);
              if (existingSlAcc.length > 0) {
                const newAccrued = parseFloat(existingSlAcc[0].accruedDays) + slDelta;
                await db.update(leaveAccruals)
                  .set({ accruedDays: String(newAccrued), skipReason: reason })
                  .where(eq(leaveAccruals.id, existingSlAcc[0].id));
              } else {
                await db.insert(leaveAccruals).values({
                  userId: ov.userId,
                  leaveTypeId: slTypeId,
                  year,
                  month: 0,
                  accruedDays: String(slDelta),
                  hoursWorked: "0",
                  qualified: true,
                  accrualType: "hr_adjustment",
                  skipReason: reason,
                });
              }
              const existingBal = await db.select().from(leaveBalances).where(
                and(eq(leaveBalances.userId, ov.userId), eq(leaveBalances.leaveTypeId, slTypeId), eq(leaveBalances.year, year))
              ).limit(1);
              if (existingBal.length > 0) {
                const newTotal = Math.max(parseFloat(existingBal[0].usedDays), parseFloat(existingBal[0].totalDays) + slDelta);
                await db.update(leaveBalances)
                  .set({ totalDays: String(parseFloat(newTotal.toFixed(2))), updatedAt: new Date() })
                  .where(eq(leaveBalances.id, existingBal[0].id));
              }
            }
          }
        }
      }

      res.json({
        message: dryRun
          ? `Dry run complete — no data was written. ${result.employeesProcessed} employees would be processed.`
          : `Backfill complete. ${result.employeesProcessed} employees processed, ${result.accrualRowsCreated} rows created, ${result.correctionRowsApplied} corrections applied${overrides.length > 0 ? `, ${overrides.length} override(s) applied` : ""}.`,
        ...result,
      });
    } catch (error: any) {
      console.error("[backfill] Leave accrual backfill failed:", error);
      res.status(500).json({ error: error.message || "Failed to run leave accrual backfill" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ABSENT RECORD CORRECTION TOOL (HR + Super Admin)
  // ──────────────────────────────────────────────────────────────────────────

  app.post("/api/admin/hr/absent-correction/dry-run", requireAuth, async (req, res) => {
    // Explicitly restrict to hr and super_admin only — admin is intentionally excluded
    if (!["hr", "super_admin"].includes(req.session.role!)) {
      return res.status(403).json({ error: "HR or Super Admin access required" });
    }
    try {
      const { fromDate, toDate } = req.body as { fromDate?: string; toDate?: string };
      if (!fromDate || !toDate) {
        return res.status(400).json({ error: "fromDate and toDate are required" });
      }

      const { isMonthPayrollLocked, computeLateStatus } = await import("./attendancePolicy");

      // Query 1: direct absent attendance records
      // Query 2: pending absent proposals from the absent sweep (pending_changes)
      // Both sets are combined into a single candidates list.
      const rows = await db.execute(sql`
        SELECT
          a.id              AS attendance_id,
          a.user_id,
          a.date,
          a.punch_in        AS absent_record_punch_in,
          u.first_name,
          u.last_name,
          u.shift_id,
          s.display_label   AS shift_name,
          p_prev.punch_in   AS prev_day_punch_in,
          false             AS is_pending_proposal,
          NULL::text        AS pending_change_id
        FROM attendance a
        JOIN admin_users u ON u.id = a.user_id AND u.deleted_at IS NULL
        LEFT JOIN shifts s ON s.id = u.shift_id
        LEFT JOIN attendance p_prev
          ON p_prev.user_id = a.user_id
          AND p_prev.date = to_char((a.date::date - INTERVAL '1 day'), 'YYYY-MM-DD')
          AND p_prev.punch_in IS NOT NULL
        WHERE a.status = 'absent'
          AND a.date >= ${fromDate}
          AND a.date <= ${toDate}
          AND u.is_active = true

        UNION ALL

        SELECT
          COALESCE(a2.id, NULL)   AS attendance_id,
          pc.target_user_id       AS user_id,
          pc.run_date             AS date,
          a2.punch_in             AS absent_record_punch_in,
          u2.first_name,
          u2.last_name,
          u2.shift_id,
          s2.display_label        AS shift_name,
          p2.punch_in             AS prev_day_punch_in,
          true                    AS is_pending_proposal,
          pc.id                   AS pending_change_id
        FROM pending_changes pc
        JOIN admin_users u2 ON u2.id = pc.target_user_id AND u2.deleted_at IS NULL
        LEFT JOIN shifts s2 ON s2.id = u2.shift_id
        LEFT JOIN attendance a2 ON a2.id = pc.target_record_id
        LEFT JOIN attendance p2
          ON p2.user_id = pc.target_user_id
          AND p2.date = to_char((pc.run_date::date - INTERVAL '1 day'), 'YYYY-MM-DD')
          AND p2.punch_in IS NOT NULL
        WHERE pc.source_job = 'absent_sweep'
          AND pc.target_table = 'attendance'
          AND pc.field = 'status'
          AND pc.proposed_value = 'absent'
          AND pc.status = 'pending'
          AND pc.run_date >= ${fromDate}
          AND pc.run_date <= ${toDate}
          AND u2.is_active = true

        ORDER BY date DESC, first_name ASC
      `);

      // Cache payroll-lock lookups to avoid repeated DB hits per month
      const lockCache: Record<string, boolean> = {};
      async function checkLock(date: string) {
        const [yr, mo] = date.split("-");
        const key = `${yr}-${mo}`;
        if (lockCache[key] === undefined) {
          lockCache[key] = await isMonthPayrollLocked(parseInt(yr), parseInt(mo));
        }
        return lockCache[key];
      }

      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      function fmtPunchIST(ts: Date | null | undefined): string | null {
        if (!ts) return null;
        const ist = new Date(new Date(ts).getTime() + IST_OFFSET_MS);
        const hh = String(ist.getUTCHours()).padStart(2, "0");
        const mm = String(ist.getUTCMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      }

      const candidates = [];
      for (const r of rows.rows as any[]) {
        const punchFound = !!(r.absent_record_punch_in || r.prev_day_punch_in);
        const rawPunch = r.absent_record_punch_in || r.prev_day_punch_in;
        const punchTime = fmtPunchIST(rawPunch);
        const isPayrollLocked = await checkLock(r.date as string);

        let suggestedStatus = "present";
        if (punchFound && rawPunch && r.shift_id) {
          try {
            const lateResult = await computeLateStatus(r.shift_id, new Date(rawPunch));
            if (lateResult) suggestedStatus = lateResult.status;
          } catch {
            // Fall back to "present"
          }
        }

        candidates.push({
          attendanceId: r.attendance_id ?? null,
          userId: r.user_id,
          employeeName: `${r.first_name} ${r.last_name}`.trim(),
          date: r.date,
          shiftId: r.shift_id ?? null,
          shiftName: r.shift_name ?? "—",
          punchFound,
          punchTime,
          suggestedStatus,
          isPayrollLocked,
          isPendingProposal: !!r.is_pending_proposal,
          pendingChangeId: r.pending_change_id ?? null,
        });
      }

      res.json({ candidates, fromDate, toDate });
    } catch (error: any) {
      console.error("[absent-correction] dry-run failed:", error);
      res.status(500).json({ error: error.message || "Dry run failed" });
    }
  });

  app.post("/api/admin/hr/absent-correction/apply", requireAuth, async (req, res) => {
    // Explicitly restrict to hr and super_admin only — admin is intentionally excluded
    if (!["hr", "super_admin"].includes(req.session.role!)) {
      return res.status(403).json({ error: "HR or Super Admin access required" });
    }
    try {
      const { corrections, auditNote } = req.body as {
        corrections?: Array<{
          attendanceId: string | null;
          userId: string;
          attendanceDate: string;
          newStatus: string;
          newPunchIn?: string;
          newPunchOut?: string;
          isPendingProposal?: boolean;
          pendingChangeId?: string | null;
        }>;
        auditNote?: string;
      };

      if (!Array.isArray(corrections) || corrections.length === 0) {
        return res.status(400).json({ error: "corrections must be a non-empty array" });
      }
      if (!auditNote || auditNote.trim().length < 20) {
        return res.status(400).json({ error: "auditNote is required and must be at least 20 characters" });
      }

      const actorId = req.session.userId!;
      const { isMonthPayrollLocked } = await import("./attendancePolicy");

      // ── PRE-VALIDATION PHASE ──────────────────────────────────────────────
      // Fetch every DB record first, then use the authoritative DB-sourced date
      // for payroll-lock checks — never trust the client-supplied attendanceDate.
      const lockCache: Record<string, boolean> = {};
      async function checkLock(date: string) {
        const [yr, mo] = date.split("-");
        const key = `${yr}-${mo}`;
        if (lockCache[key] === undefined) {
          lockCache[key] = await isMonthPayrollLocked(parseInt(yr), parseInt(mo));
        }
        return lockCache[key];
      }

      type AttendanceRow = typeof attendance.$inferSelect;
      type PendingRow = { id: string; target_user_id: string; run_date: string; target_record_id: string | null; status: string };
      type Enriched = {
        c: (typeof corrections)[number];
        existing: AttendanceRow | null;
        pendingRow: PendingRow | null;
        dbDate: string;
        dbUserId: string;
        alreadyIdempotent: boolean;
      };
      const enriched: Enriched[] = [];
      const validationErrors: string[] = [];

      for (const c of corrections) {
        // ── Step 1: Fetch DB records to get authoritative date + userId ────
        let existing: AttendanceRow | null = null;
        let pendingRow: PendingRow | null = null;
        let dbDate = c.attendanceDate;
        let dbUserId = c.userId; // will be overwritten by DB value

        if (c.attendanceId) {
          const [row] = await db.select()
            .from(attendance)
            .where(eq(attendance.id, c.attendanceId))
            .limit(1);
          if (!row) {
            validationErrors.push(`${c.attendanceDate}: attendance record ${c.attendanceId} not found`);
            continue;
          }
          existing = row;
          dbDate = existing.date;
          dbUserId = existing.userId;
        }

        if (c.isPendingProposal && c.pendingChangeId) {
          // Fetch and fully validate the pending_change row — must be an absent-sweep proposal
          const pcResult = await db.execute(sql`
            SELECT id, target_user_id, run_date, target_record_id, status
            FROM pending_changes
            WHERE id = ${c.pendingChangeId}
              AND source_job = 'absent_sweep'
              AND target_table = 'attendance'
              AND field = 'status'
              AND proposed_value = 'absent'
            LIMIT 1
          `);
          if (!pcResult.rows[0]) {
            validationErrors.push(`${c.attendanceDate}: pending change ${c.pendingChangeId} not found or is not a valid absent-sweep proposal`);
            continue;
          }
          pendingRow = pcResult.rows[0] as PendingRow;
          if (!c.attendanceId) {
            dbDate = pendingRow.run_date;
            dbUserId = pendingRow.target_user_id;
          }
          // If attendance record not yet fetched via attendanceId, try via pending_change's target_record_id
          if (!existing && pendingRow.target_record_id) {
            const [attRow] = await db.select()
              .from(attendance)
              .where(eq(attendance.id, pendingRow.target_record_id))
              .limit(1);
            if (attRow) {
              existing = attRow;
              dbDate = existing.date;
              dbUserId = existing.userId;
            }
          }
        }

        // ── Step 2: Payroll-lock check using DB-sourced date ──────────────
        if (await checkLock(dbDate)) {
          validationErrors.push(`${dbDate} is in a payroll-locked month — cannot correct`);
          continue;
        }

        // ── Step 3: Idempotency checks ────────────────────────────────────
        // (a) Attendance record already corrected to the target status
        const attendanceAlreadyCorrect = !!(
          existing &&
          existing.isCorrect === true &&
          existing.status === c.newStatus
        );
        // (b) Pending proposal already handled (non-pending) — no-op, no new regularization
        const pendingAlreadyHandled = !!(pendingRow && pendingRow.status !== "pending");
        const alreadyIdempotent = attendanceAlreadyCorrect || pendingAlreadyHandled;

        enriched.push({ c, existing, pendingRow, dbDate, dbUserId, alreadyIdempotent });
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: "Pre-validation failed — no records were modified",
          details: validationErrors,
        });
      }

      // ── APPLY PHASE (atomic transaction) ─────────────────────────────────
      // Uses the same correction engine as regularization overrides:
      //   1. Insert an approved attendanceRegularizations row for audit trail
      //   2. Update attendance with corrected status/punches/totalHours
      //   3. Reject pending_changes proposals to prevent re-application
      let correctedCount = 0;

      await db.transaction(async (tx) => {
        for (const { c, existing, pendingRow, dbDate, dbUserId, alreadyIdempotent } of enriched) {
          if (alreadyIdempotent) {
            correctedCount++;
            continue;
          }

          // Recompute punch times and totalHours (same logic as applyRegularizationOverride)
          const punchIn = c.newPunchIn
            ? new Date(c.newPunchIn)
            : (existing?.punchIn ?? undefined);
          const punchOut = c.newPunchOut
            ? new Date(c.newPunchOut)
            : (existing?.punchOut ?? undefined);
          let totalHours: string | undefined;
          if (punchIn && punchOut) {
            const diffMs = punchOut.getTime() - punchIn.getTime();
            if (diffMs > 0) totalHours = (diffMs / 3600000).toFixed(2);
          }

          // 1. Create an approved regularization record using DB-sourced userId (not client payload)
          await tx.insert(attendanceRegularizations).values({
            employeeId: dbUserId,
            attendanceDate: dbDate,
            requestedPunchIn: punchIn,
            requestedPunchOut: punchOut,
            requestType: "wrong_absent" as any,
            reason: "bulk_absent_correction",
            status: "approved" as any,
            reviewedBy: actorId,
            reviewerComment: auditNote.trim(),
            reviewedAt: new Date(),
          });

          // 2. Update the attendance record atomically
          if (existing) {
            await tx.update(attendance).set({
              status: c.newStatus as any,
              punchIn: punchIn ?? existing.punchIn,
              punchOut: punchOut ?? existing.punchOut,
              totalHours: totalHours ?? existing.totalHours,
              isCorrect: true,
              correctionSource: "bulk_absent_correction",
              correctedById: actorId,
              correctionNote: auditNote.trim(),
              updatedAt: new Date(),
            }).where(eq(attendance.id, existing.id));
          }

          // 3. Reject the pending absent proposal so the sweep cannot re-apply it
          // Use DB-validated pendingRow.id (not client-supplied pendingChangeId)
          if (pendingRow && pendingRow.status === "pending") {
            await tx.execute(sql`
              UPDATE pending_changes
              SET status = 'rejected',
                  reviewed_by = ${actorId},
                  reviewed_at = NOW(),
                  review_note = ${`Bulk absent correction: ${auditNote.trim()}`}
              WHERE id = ${pendingRow.id}
                AND status = 'pending'
            `);
          }

          correctedCount++;
        }

        // Single audit log entry covering the entire batch
        await tx.insert(auditLogs).values({
          actorId,
          targetId: actorId,
          action: "bulk_absent_correction",
          changes: {
            correctedCount,
            totalSubmitted: corrections.length,
            auditNote: auditNote.trim(),
            dateRange: corrections.length > 0
              ? { from: corrections[0].attendanceDate, to: corrections[corrections.length - 1].attendanceDate }
              : null,
          },
        });
      });

      res.json({
        correctedCount,
        message: `${correctedCount} record${correctedCount !== 1 ? "s" : ""} corrected successfully.`,
      });
    } catch (error: any) {
      console.error("[absent-correction] apply failed:", error);
      res.status(500).json({ error: error.message || "Failed to apply corrections" });
    }
  });

  app.get("/api/hr/leave-accruals/run-log", requirePermission("hr.leaveAccruals.runLog", "hr"), async (req, res) => {
    try {
      const latest = await storage.getSystemSetting("accrual_run_log_latest");
      const history = await storage.getSystemSetting("accrual_run_log_history");
      const yearEndLog = await storage.getSystemSetting("year_end_batch_log");
      res.json({
        latest: latest?.value || null,
        history: history?.value || [],
        yearEndLog: yearEndLog?.value || [],
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accrual run log" });
    }
  });

  app.get("/api/hr/leave-accruals/my", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const accruals = await storage.getLeaveAccrualsByUser(userId, year);
      res.json(accruals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave accruals" });
    }
  });

  app.get("/api/hr/leave-days-count", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) return res.status(400).json({ error: "startDate and endDate required" });
      const count = await storage.countLeaveDays(String(startDate), String(endDate));
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to count leave days" });
    }
  });

  // --- Leave Requests ---
  app.get("/api/hr/leave-requests/my", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const requests = await storage.getLeaveRequests({ userId });
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave requests" });
    }
  });

  app.get("/api/hr/leave-requests", requirePermission("hr.leaveRequests", "hr"), async (req, res) => {
    try {
      const { status } = req.query;
      const requests = await storage.getLeaveRequests({ status: status as string });
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave requests" });
    }
  });

  app.post("/api/hr/leave-requests", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const body = { ...req.body, userId };
      const result = insertLeaveRequestSchema.safeParse(body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid leave request data", details: result.error.issues });
      }

      // LWP (Loss of Pay) gating: block only if EL/SL/Comp-Off balance remains
      // (not other special/manual leave types — per policy, only earned categories gate LWP)
      const leaveType = await storage.getLeaveType(result.data.leaveTypeId);
      if (leaveType && /lwp|loss.?of.?pay/i.test(leaveType.name)) {
        const year = parseInt(result.data.startDate.split("-")[0]);
        const balances = await storage.getLeaveBalances(userId, year);
        const allLeaveTypes = await storage.getLeaveTypes();
        const eligibleRemaining = balances.reduce((sum, b) => {
          const lt = allLeaveTypes.find(t => t.id === b.leaveTypeId);
          if (!lt) return sum;
          // Only gate on EL (conditional+carry-forward), SL (unconditional), and Comp-Off
          const isEL = lt.isConditional && (lt.carryForwardCap || 0) > 0;
          const isSL = !lt.isConditional && !(/comp|compensatory/i.test(lt.name)) && !(/lwp|loss.?of.?pay/i.test(lt.name));
          const isCO = /comp|compensatory/i.test(lt.name);
          if (!isEL && !isSL && !isCO) return sum;
          const remaining = parseFloat(b.totalDays) - parseFloat(b.usedDays);
          return sum + Math.max(0, remaining);
        }, 0);
        if (eligibleRemaining > 0) {
          return res.status(422).json({
            error: `LWP cannot be applied while you have ${eligibleRemaining.toFixed(1)} day(s) of EL/SL/Comp-Off remaining. Please exhaust your earned leave balance first.`,
          });
        }
      }

      // Auto-calculate working days (excluding weekends and holidays)
      const calculatedDays = await storage.countLeaveDays(result.data.startDate, result.data.endDate);
      const finalDays = result.data.halfDay ? 0.5 : calculatedDays;

      // Non-accruing block entitlements (Maternity/Paternity): cap the application at the
      // configured entitlement (default_days) so it can be granted on approval without a
      // pre-accrued balance and without driving the balance negative.
      if (leaveType?.blockEntitlement) {
        const reqYear = parseInt(result.data.startDate.split("-")[0]);
        const reqBalances = await storage.getLeaveBalances(userId, reqYear);
        const reqBalance = reqBalances.find(b => b.leaveTypeId === leaveType.id);
        const alreadyUsed = reqBalance ? parseFloat(reqBalance.usedDays || "0") : 0;
        // Also count still-pending requests for the same type/year — they will draw
        // from the same fixed entitlement once approved, so they must be reserved now
        // to prevent cumulative overbooking against the cap.
        const userRequests = await storage.getLeaveRequests({ userId });
        const pendingSameType = userRequests
          .filter(r => r.leaveTypeId === leaveType.id
            && r.status === "pending"
            && parseInt(r.startDate.split("-")[0]) === reqYear)
          .reduce((sum, r) => sum + parseFloat(r.totalDays || "0"), 0);
        const cap = leaveType.defaultDays || 0;
        const committed = alreadyUsed + pendingSameType;
        if (cap > 0 && committed + finalDays > cap) {
          const remaining = Math.max(0, cap - committed);
          return res.status(422).json({
            error: `This request exceeds the ${leaveType.name} entitlement of ${cap} day(s). You have ${remaining.toFixed(1)} day(s) remaining for ${reqYear} (including pending requests).`,
          });
        }
      }

      const lr = await storage.createLeaveRequest({ ...result.data, totalDays: String(finalDays) });
      res.status(201).json(lr);

      (async () => {
        try {
          const employee = await storage.getAdminUser(userId);
          if (!employee) return;
          const employeeName = `${employee.firstName} ${employee.lastName}`;

          let approver: { id: string | null; firstName: string; lastName: string; email?: string | null } | null = null;
          let currentManagerId = employee.managerId;
          while (currentManagerId) {
            const manager = await storage.getAdminUser(currentManagerId);
            if (!manager) break;
            const isOnLeave = await storage.isUserOnLeaveToday(manager.id);
            if (!isOnLeave) {
              approver = { id: manager.id, firstName: manager.firstName, lastName: manager.lastName, email: manager.email };
              break;
            }
            currentManagerId = manager.managerId;
          }
          if (!approver) {
            approver = { id: null, firstName: "HR", lastName: "Department", email: null };
          }

          const leaveType = await storage.getLeaveType(lr.leaveTypeId);
          const leaveTypeName = leaveType?.name || "Leave";
          const approvalUrl = `${req.protocol}://${req.get("host")}/admin/hr/leave-approvals`;

          if (approver.email) {
            await sendLeaveAppliedEmail({
              to: approver.email,
              managerName: `${approver.firstName} ${approver.lastName}`,
              employeeName,
              leaveType: leaveTypeName,
              startDate: lr.startDate,
              endDate: lr.endDate,
              totalDays: lr.totalDays || "1",
              reason: lr.reason || "",
              approvalUrl,
            });
          }

          if (approver.id) {
            const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
            const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
            if (featureFlags.notifications_enabled) {
              await storage.createNotification({
                userId: approver.id,
                type: "leave_request_pending",
                title: "New Leave Request",
                message: `${employeeName} has submitted a ${leaveTypeName} request (${lr.startDate} – ${lr.endDate}).`,
                isRead: false,
                metadata: { leaveRequestId: lr.id, employeeName, leaveType: leaveTypeName },
              });
            }
          }
        } catch (bgErr) {
          console.error("Background leave notification failed:", bgErr);
        }
      })();
    } catch (error) {
      res.status(500).json({ error: "Failed to create leave request" });
    }
  });

  app.patch("/api/hr/leave-requests/:id/review", requirePermission("hr.leaveRequests.review", "hr", "manager"), async (req, res) => {
    try {
      const { status, reviewComment } = req.body;
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
      }

      const leaveRequest = await storage.getLeaveRequest(req.params.id as string);
      if (!leaveRequest) return res.status(404).json({ error: "Leave request not found" });

      const reviewerRole = req.session.role;
      if (reviewerRole === "manager") {
        const directReports = await storage.getTeamMembers(req.session.userId!);
        const isDirectReport = directReports.some(r => r.id === leaveRequest.userId);
        if (!isDirectReport) {
          return res.status(403).json({ error: "You can only review leave requests from your direct reports" });
        }
      }

      // For split-leave: deduct only the paid portion (splitPaidDays) from this leave type's balance.
      // The LWP portion (splitLwpDays) does not come from any balance — it is unpaid.
      const paidPortion = leaveRequest.splitPaidDays != null
        ? parseFloat(leaveRequest.splitPaidDays)
        : parseFloat(leaveRequest.totalDays || "0");
      const reviewYear = parseInt(leaveRequest.startDate.split("-")[0]);
      const reviewLeaveType = await storage.getLeaveType(leaveRequest.leaveTypeId);

      // Pre-validate block-entitlement cap BEFORE persisting the approval, so a rejection
      // never leaves the request marked approved without a corresponding balance grant.
      if (status === "approved" && reviewLeaveType?.blockEntitlement) {
        const cap = reviewLeaveType.defaultDays || 0;
        const preBalances = await storage.getLeaveBalances(leaveRequest.userId, reviewYear);
        const preBalance = preBalances.find(b => b.leaveTypeId === leaveRequest.leaveTypeId);
        const currentUsed = preBalance ? parseFloat(preBalance.usedDays || "0") : 0;
        if (cap > 0 && currentUsed + paidPortion > cap) {
          const remaining = Math.max(0, cap - currentUsed);
          return res.status(422).json({
            error: `Approving this request would exceed the ${reviewLeaveType.name} entitlement of ${cap} day(s). Only ${remaining.toFixed(1)} day(s) remain for ${reviewYear}.`,
          });
        }
      }

      const lr = await storage.updateLeaveRequest(req.params.id as string, {
        status,
        reviewComment,
        reviewedBy: req.session.userId!,
        reviewedAt: new Date(),
      });
      if (!lr) return res.status(404).json({ error: "Leave request not found" });

      if (status === "approved") {
        const year = parseInt(lr.startDate.split("-")[0]);
        const approvedLeaveType = reviewLeaveType;
        let balances = await storage.getLeaveBalances(lr.userId, year);
        let balance = balances.find(b => b.leaveTypeId === lr.leaveTypeId);

        if (approvedLeaveType?.blockEntitlement) {
          // Non-accruing block entitlement (Maternity/Paternity): there is no pre-accrued
          // balance. Grant on approval by topping up totalDays to cover the usage, capped at
          // the configured entitlement (default_days), so remaining never goes negative.
          if (!balance) {
            await storage.initLeaveBalances(lr.userId, year);
            balances = await storage.getLeaveBalances(lr.userId, year);
            balance = balances.find(b => b.leaveTypeId === lr.leaveTypeId);
          }
          if (!balance) {
            balance = await storage.createLeaveBalance({
              userId: lr.userId, leaveTypeId: lr.leaveTypeId,
              totalDays: "0", usedDays: "0", year,
            });
          }
          const cap = approvedLeaveType.defaultDays || 0;
          const currentUsed = parseFloat(balance.usedDays || "0");
          const newUsed = currentUsed + paidPortion;
          const newTotal = Math.min(cap, Math.max(parseFloat(balance.totalDays || "0"), newUsed));
          await storage.updateLeaveBalance(balance.id, { totalDays: String(newTotal), usedDays: String(newUsed) });
        } else if (balance) {
          const newUsed = parseFloat(balance.usedDays || "0") + paidPortion;
          await storage.updateLeaveBalance(balance.id, { usedDays: String(newUsed) });
        }
      }

      res.json(lr);

      (async () => {
        // Create on_leave attendance records for each working day of the approved leave
        if (status === "approved") {
          try {
            const holidayRows = await db.select({ date: holidays.date })
              .from(holidays)
              .where(and(
                sql`${holidays.date} >= ${lr.startDate}`,
                sql`${holidays.date} <= ${lr.endDate}`,
              ));
            const holidaySet = new Set(holidayRows.map(h => h.date));

            const attStatus = lr.halfDay ? "half_day" : "on_leave";
            const current = new Date(lr.startDate + "T00:00:00Z");
            const end = new Date(lr.endDate + "T00:00:00Z");

            while (current <= end) {
              const dayOfWeek = current.getUTCDay(); // 0 = Sunday
              const dateStr = current.toISOString().slice(0, 10);
              if (dayOfWeek !== 0 && !holidaySet.has(dateStr)) {
                await db.execute(sql`
                  INSERT INTO attendance (user_id, date, status, notes)
                  VALUES (${lr.userId}, ${dateStr}, ${attStatus}, 'Approved leave')
                  ON CONFLICT DO NOTHING
                `);
              }
              current.setUTCDate(current.getUTCDate() + 1);
            }
          } catch (leaveAttErr) {
            console.error("[leave-approval] Failed to create attendance records:", leaveAttErr);
          }
        }
      })();

      (async () => {
        try {
          const employee = await storage.getAdminUser(lr.userId);
          if (!employee || !employee.email) return;

          const leaveType = await storage.getLeaveType(lr.leaveTypeId);
          const leaveTypeName = leaveType?.name || "Leave";

          await sendLeaveDecisionEmail({
            to: employee.email,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            leaveType: leaveTypeName,
            startDate: lr.startDate,
            endDate: lr.endDate,
            status: status as "approved" | "rejected",
            reviewComment: reviewComment || null,
          });

          const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
          const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
          if (featureFlags.notifications_enabled) {
            const isApproved = status === "approved";
            await storage.createNotification({
              userId: lr.userId,
              type: isApproved ? "leave_request_approved" : "leave_request_rejected",
              title: isApproved ? "Leave Approved" : "Leave Rejected",
              message: `Your ${leaveTypeName} request (${lr.startDate} – ${lr.endDate}) has been ${status}.${reviewComment ? ` Comment: ${reviewComment}` : ""}`,
              isRead: false,
              metadata: { leaveRequestId: lr.id, leaveType: leaveTypeName, status },
            });
          }
        } catch (bgErr) {
          console.error("Background leave decision notification failed:", bgErr);
        }
      })();
    } catch (error) {
      res.status(500).json({ error: "Failed to review leave request" });
    }
  });

  app.patch("/api/hr/leave-requests/:id/cancel", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getLeaveRequest(req.params.id as string);
      if (!existing) return res.status(404).json({ error: "Leave request not found" });
      if (existing.userId !== req.session.userId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      if (existing.status !== "pending") {
        return res.status(400).json({ error: "Only pending requests can be cancelled" });
      }
      const lr = await storage.updateLeaveRequest(req.params.id as string, { status: "cancelled" });
      res.json(lr);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel leave request" });
    }
  });

  // --- Tickets (Regularization) ---
  app.get("/api/hr/tickets/my", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const result = await storage.getTickets({ userId });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.get("/api/hr/tickets", requirePermission("hr.tickets", "hr"), async (req, res) => {
    try {
      const { status } = req.query;
      const result = await storage.getTickets({ status: status as string });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.post("/api/hr/tickets", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const rawBody = req.body;
      const body: any = { ...rawBody, userId };
      if (rawBody.requestedPunchIn && typeof rawBody.requestedPunchIn === "string") {
        body.requestedPunchIn = rawBody.requestedPunchIn.includes("T")
          ? new Date(rawBody.requestedPunchIn)
          : new Date(`${rawBody.date}T${rawBody.requestedPunchIn}:00`);
      }
      if (rawBody.requestedPunchOut && typeof rawBody.requestedPunchOut === "string") {
        body.requestedPunchOut = rawBody.requestedPunchOut.includes("T")
          ? new Date(rawBody.requestedPunchOut)
          : new Date(`${rawBody.date}T${rawBody.requestedPunchOut}:00`);
      }
      const result = insertTicketSchema.safeParse(body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid ticket data", details: result.error.issues });
      }

      // Regularization window enforcement: max 3 working days back
      const ticketDate = result.data.date as string;
      if (ticketDate && result.data.type === "regularization") {
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const todayIST = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
        if (ticketDate > todayIST) {
          return res.status(400).json({ error: "Regularisation date cannot be in the future" });
        }
        if (ticketDate < todayIST) {
          const workingDaysBack = await storage.countLeaveDays(ticketDate, todayIST);
          // countLeaveDays includes both start and end dates, so subtract 1 for "days back"
          const daysBack = workingDaysBack - 1;
          if (daysBack > 3) {
            return res.status(400).json({
              error: "Regularisation must be raised within 3 working days of the incident",
              daysBack,
              cutoffExceeded: true,
            });
          }
        }
      }

      const ticket = await storage.createTicket(result.data);
      res.status(201).json(ticket);
    } catch (error) {
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  app.patch("/api/hr/tickets/:id/review", requirePermission("hr.tickets.review", "hr"), async (req, res) => {
    try {
      const { status, reviewComment } = req.body;
      if (!["resolved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'resolved' or 'rejected'" });
      }
      const ticket = await storage.getTicket(req.params.id as string);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const updated = await storage.updateTicket(req.params.id as string, {
        status,
        reviewComment,
        reviewedBy: req.session.userId!,
        reviewedAt: new Date(),
      });

      if (status === "resolved" && ticket.attendanceId && ticket.requestedPunchIn) {
        const updateData: any = {};
        if (ticket.requestedPunchIn) updateData.punchIn = ticket.requestedPunchIn;
        if (ticket.requestedPunchOut) updateData.punchOut = ticket.requestedPunchOut;
        if (updateData.punchIn && updateData.punchOut) {
          const diffMs = new Date(updateData.punchOut).getTime() - new Date(updateData.punchIn).getTime();
          updateData.totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
        }
        await storage.updateAttendance(ticket.attendanceId, updateData);
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to review ticket" });
    }
  });

  // --- Grace Period Usage Report ---
  app.get("/api/hr/attendance/grace-usage", requirePermission("hr.attendance.graceUsage", "hr", "admin", "super_admin", "manager"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role!;
      const rawMonth = (req.query.month as string) || new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(rawMonth)) {
        return res.status(400).json({ error: "month must be in YYYY-MM format" });
      }
      const month = rawMonth;
      const { queryGraceUsage } = await import("./attendancePolicy");
      const rows = await queryGraceUsage(userRole, userId, month);
      res.json(rows);
    } catch (error) {
      console.error("Grace usage report error:", error);
      res.status(500).json({ error: "Failed to fetch grace period usage" });
    }
  });

  // ==========================================
  // ATTENDANCE REGULARIZATION ROUTES
  // ==========================================

  // Get policy config (public to all authenticated users)
  app.get("/api/hr/attendance/regularization/policy", requireAuth, async (req, res) => {
    try {
      const versionSetting = await storage.getSystemSetting("regularization_policy_version");
      const blackoutSetting = await storage.getSystemSetting("regularization_month_end_blackout_days");
      const cutoffSetting = await storage.getSystemSetting("regularization_manager_cutoff_day");
      res.json({
        policyVersion: versionSetting ? String(versionSetting.value) : "2",
        monthEndBlackoutDays: blackoutSetting ? Number(blackoutSetting.value) : 3,
        managerCutoffDay: cutoffSetting ? Number(cutoffSetting.value) : 20,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch policy" });
    }
  });

  // Return the valid submission window dates (server-computes holiday-aware working-day range)
  app.get("/api/hr/attendance/regularization/window", requireAuth, async (req, res) => {
    try {
      const windowSetting = await storage.getSystemSetting("regularization_employee_window_days");
      const windowDays = windowSetting ? Number(windowSetting.value) : 7;
      const holidays = await storage.getHolidays();
      const publicHolidays = new Set(holidays.filter(h => !h.isOptional).map((h: any) => h.date));
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      // Walk backwards counting only working days until we reach windowDays
      let wd = 0;
      const cur = new Date(today);
      cur.setDate(cur.getDate() - 1);
      let windowStart = todayStr;
      for (let safety = 0; safety < 120; safety++) {
        const ds = cur.toISOString().slice(0, 10);
        const dow = cur.getDay();
        if (dow !== 0 && dow !== 6 && !publicHolidays.has(ds)) wd++;
        if (wd >= windowDays) { windowStart = ds; break; }
        cur.setDate(cur.getDate() - 1);
      }
      res.json({ windowStart, windowEnd: todayStr });
    } catch (error) {
      res.status(500).json({ error: "Failed to compute submission window" });
    }
  });

  // Submit a regularization request (employee)
  app.post("/api/hr/attendance/regularization", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { attendanceDate, requestType, requestedPunchIn, requestedPunchOut, reason, attachmentUrl } = req.body;

      if (!attendanceDate || !requestType || !reason) {
        return res.status(400).json({ error: "attendanceDate, requestType, and reason are required" });
      }

      // Enforce minimum 20-character reason
      if (reason.trim().length < 20) {
        return res.status(400).json({ error: "Reason must be at least 20 characters. Please provide more detail about the issue." });
      }

      // Check month-end blackout period
      const blackoutSetting = await storage.getSystemSetting("regularization_month_end_blackout_days");
      const blackoutDays = blackoutSetting ? Number(blackoutSetting.value) : 3;
      const { isWithinFilingWindow, isBlackoutDate } = await import("./attendancePolicy");

      if (isBlackoutDate(attendanceDate, blackoutDays)) {
        return res.status(409).json({
          code: "REGULARIZATION_WINDOW_CLOSED",
          reason: "month_end_blackout",
          message: `Attendance corrections for this date cannot be filed during the last ${blackoutDays} days of the month (month-end payroll lock). Please contact HR for assistance.`,
          canEscalateTo: "hr",
        });
      }

      // Check if the month's attendance run is approved/locked — block filing if so
      const attDateMonth = attendanceDate.substring(0, 7); // "YYYY-MM"
      const lockedRunRows = (await db.execute(sql`
        SELECT id, status FROM attendance_report_runs
        WHERE year = ${parseInt(attDateMonth.split("-")[0])}
          AND month = ${parseInt(attDateMonth.split("-")[1])}
          AND (status = 'approved' OR status = 'overridden')
        LIMIT 1
      `)).rows as any[];
      if (lockedRunRows.length > 0) {
        return res.status(409).json({
          code: "REGULARIZATION_WINDOW_CLOSED",
          reason: "month_attendance_run_locked",
          message: "The attendance run for this month has been approved and locked. Self-service filing is closed. Please contact HR to request a correction directly.",
          canEscalateTo: "hr",
        });
      }

      // Strict 24-hour + next-punch-in filing window
      const windowCheck = await isWithinFilingWindow(userId, attendanceDate);
      if (!windowCheck.allowed) {
        const reason24h = windowCheck.reason === "next_punch_in_exists"
          ? "The filing window for this date has closed because you have already punched in for a subsequent day."
          : "The 24-hour filing window for this date has expired. Regularization must be requested within 24 hours of end-of-day.";
        return res.status(409).json({
          code: "REGULARIZATION_WINDOW_CLOSED",
          reason: windowCheck.reason,
          message: reason24h,
          canEscalateTo: "hr",
        });
      }

      // Check for existing pending request for this date
      const existing = await storage.getRegularizationRequests({ employeeId: userId });
      const duplicate = existing.find(r => r.attendanceDate === attendanceDate && r.status === "pending");
      if (duplicate) {
        return res.status(400).json({ error: "A pending regularization request already exists for this date" });
      }

      const punchIn = requestedPunchIn ? new Date(`${attendanceDate}T${requestedPunchIn}`) : undefined;
      const punchOut = requestedPunchOut ? new Date(`${attendanceDate}T${requestedPunchOut}`) : undefined;

      const request = await storage.createRegularizationRequest({
        employeeId: userId,
        attendanceDate,
        requestType,
        requestedPunchIn: punchIn,
        requestedPunchOut: punchOut,
        reason,
        ...(attachmentUrl ? { attachmentUrl } : {}),
      });

      await storage.createAuditLog({
        actorId: userId,
        targetId: userId,
        action: "regularization_submitted",
        changes: { attendanceDate, requestType, reason },
      });

      res.status(201).json(request);

      // Best-effort: notify the reporting manager (or HR fallback) about the new
      // pending regularization request. Never block / fail the submission.
      const reviewPath = "/admin/hr/my-team?tab=corrections";
      const reviewUrl = `${req.protocol}://${req.get("host")}${reviewPath}`;
      (async () => {
        try {
          const employee = await storage.getAdminUser(userId);
          if (!employee) return;
          const employeeName = `${employee.firstName} ${employee.lastName}`;

          // Resolve the approver(s): the direct reporting manager, or fall back to
          // HR users so the request is never silently dropped.
          let approvers: { id: string; firstName: string; lastName: string; email?: string | null }[] = [];
          if (employee.managerId) {
            const mgr = await storage.getAdminUser(employee.managerId);
            if (mgr && !mgr.deletedAt) {
              approvers = [{ id: mgr.id, firstName: mgr.firstName, lastName: mgr.lastName, email: mgr.email }];
            }
          }
          if (approvers.length === 0) {
            const all = await storage.getAdminUsers();
            const active = all.filter(u => !u.deletedAt);
            let fallback = active.filter(u => u.role === "hr");
            if (fallback.length === 0) fallback = active.filter(u => u.role === "super_admin" || u.role === "admin");
            approvers = fallback.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }));
          }
          if (approvers.length === 0) return;

          let notificationsEnabled = true;
          try {
            const setting = await storage.getSystemSetting("feature_flags");
            const flags = (setting?.value as Record<string, boolean>) || {};
            notificationsEnabled = flags.notifications_enabled !== false;
          } catch { /* default enabled */ }

          const { sendManagerRegularizationSubmittedEmail } = await import("./email");
          for (const approver of approvers) {
            if (notificationsEnabled) {
              await storage.createNotification({
                userId: approver.id,
                type: "regularization_pending",
                title: "New Regularization Request",
                message: `${employeeName} submitted an attendance correction for ${attendanceDate}.`,
                isRead: false,
                metadata: { requestId: request.id, employeeName, attendanceDate, requestType, link: reviewPath },
              });
            }
            if (approver.email) {
              sendManagerRegularizationSubmittedEmail({
                to: approver.email,
                managerName: `${approver.firstName} ${approver.lastName}`,
                employeeName,
                attendanceDate,
                requestType,
                reason,
                reviewUrl,
              }).catch(console.error);
            }
          }
        } catch (bgErr) {
          console.error("Background regularization notification failed:", bgErr);
        }
      })();
    } catch (error) {
      console.error("Regularization submit error:", error);
      res.status(500).json({ error: "Failed to submit regularization request" });
    }
  });

  // Get regularization requests (role-scoped)
  app.get("/api/hr/attendance/regularization", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role!;
      const { status, startDate, endDate, employeeId } = req.query;

      let filters: any = {};
      if (status) filters.status = status as string;
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;

      if (userRole === "employee") {
        filters.employeeId = userId;
      } else if (userRole === "manager") {
        const team = await storage.getTeamMembers(userId);
        const teamIds = team.map(m => m.id);
        if (employeeId) {
          // Per-employee tab: verify the requested employee is in the manager's team
          if (!teamIds.includes(employeeId as string)) {
            return res.status(403).json({ error: "Employee is not in your team" });
          }
          filters.employeeId = employeeId as string;
        } else {
          filters.managerTeamIds = teamIds;
        }
      } else if (["hr", "admin", "super_admin"].includes(userRole)) {
        if (employeeId) filters.employeeId = employeeId as string;
      } else {
        filters.employeeId = userId;
      }

      const requests = await storage.getRegularizationRequests(filters);

      // Enrich with employee name
      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      // Load the one-time shift-correction cutoff date from system_settings.
      // This is set once when notifyShiftCorrectionEmployees() runs and never
      // changes on subsequent restarts — avoiding false-positive drift from the
      // seed upsert's updated_at timestamp.
      let shiftCorrectionCutoffDate: string | null = null;
      {
        const cutoffRow = await db.execute(sql`
          SELECT value FROM system_settings WHERE key = 'shift_correction_applied_at' LIMIT 1
        `);
        if (cutoffRow.rows.length > 0) {
          try {
            const parsed = JSON.parse((cutoffRow.rows[0] as { value: string }).value);
            shiftCorrectionCutoffDate = parsed?.date ?? null;
          } catch { /* ignore malformed */ }
        }
      }

      // Determine which employees are on a corrected shift (SHIFT_A or SHIFT_C)
      const correctedShiftIds = new Set(["SHIFT_A", "SHIFT_C"]);

      const enriched = requests.map(r => {
        const emp = userMap.get(r.employeeId);
        const reviewer = r.reviewedBy ? userMap.get(r.reviewedBy) : null;
        const shiftId = (emp as any)?.shiftId ?? null;
        // Warn when: the request is pending, the employee is on a corrected shift,
        // and the attendance date predates the fixed correction cutoff.
        const shiftCorrectionWarning =
          r.status === "pending" &&
          shiftCorrectionCutoffDate !== null &&
          correctedShiftIds.has(shiftId) &&
          r.attendanceDate < shiftCorrectionCutoffDate;
        return {
          ...r,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          employeeCode: emp?.employeeId ?? null,
          reviewerName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null,
          shiftCorrectionWarning,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Regularization fetch error:", error);
      res.status(500).json({ error: "Failed to fetch regularization requests" });
    }
  });

  // Dedicated employee self-service endpoint: always returns the caller's own requests
  app.get("/api/hr/attendance/regularization/my", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const requests = await storage.getRegularizationRequests({ employeeId: userId });

      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const enriched = requests.map(r => {
        const reviewer = r.reviewedBy ? userMap.get(r.reviewedBy) : null;
        return {
          ...r,
          employeeName: `${allUsers.find(u => u.id === userId)?.firstName ?? ""} ${allUsers.find(u => u.id === userId)?.lastName ?? ""}`.trim(),
          reviewerName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("My regularizations fetch error:", error);
      res.status(500).json({ error: "Failed to fetch your regularization requests" });
    }
  });

  // Get single regularization request (scoped by role)
  app.get("/api/hr/attendance/regularization/:id", requireAuth, async (req, res) => {
    try {
      const request = await storage.getRegularizationRequest(req.params.id);
      if (!request) return res.status(404).json({ error: "Request not found" });
      const userId = req.session.userId!;
      const userRole = req.session.role!;
      if (userRole === "employee") {
        // Employees may only view their own requests
        if (request.employeeId !== userId) {
          return res.status(403).json({ error: "Not authorized" });
        }
      } else if (userRole === "manager") {
        // Managers may only view requests belonging to their direct reports
        const team = await storage.getTeamMembers(userId);
        const teamIds = new Set(team.map(m => m.id));
        if (!teamIds.has(request.employeeId)) {
          return res.status(403).json({ error: "Not authorized — this employee is not in your team" });
        }
      }
      // HR / admin / super_admin have unrestricted read access

      // Enrich with actor names for audit chain
      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const emp = userMap.get(request.employeeId);

      // Query real audit_logs entries linked to this request via changes->>'requestId'
      const rawLogs = await db.execute(sql`
        SELECT al.id, al.actor_id, al.action, al.changes, al.created_at
        FROM audit_logs al
        WHERE al.changes->>'requestId' = ${request.id}
        ORDER BY al.created_at ASC
      `);

      type RawLogRow = { id: string; actor_id: string | null; action: string; changes: any; created_at: Date | null };
      const auditChain: { event: string; actor: string; actorId: string | null; at: Date | null; detail?: string; changes?: any }[] = [];

      // Always prepend the submission event from the request record itself
      auditChain.push({
        event: "submitted",
        actor: emp ? `${emp.firstName} ${emp.lastName}` : request.employeeId,
        actorId: request.employeeId,
        at: request.createdAt,
        detail: `${request.requestType.replace(/_/g, " ")} — ${request.reason}`,
      });

      // Append actual audit log entries (approved/rejected/overridden/policy_accepted etc.)
      for (const row of (rawLogs.rows as RawLogRow[])) {
        const actor = row.actor_id ? userMap.get(row.actor_id) : null;
        auditChain.push({
          event: row.action,
          actor: actor ? `${actor.firstName} ${actor.lastName}` : (row.actor_id ?? "System"),
          actorId: row.actor_id,
          at: row.created_at,
          detail: row.changes?.reviewerComment ?? row.changes?.comment ?? undefined,
          changes: row.changes,
        });
      }

      res.json({ ...request, auditChain });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch request" });
    }
  });

  // Approve or reject a regularization request
  app.patch("/api/hr/attendance/regularization/:id/review", requirePermission("hr.attendance.regularization.review", "hr", "manager", "admin", "super_admin"), async (req, res) => {
    try {
      const actorId = req.session.userId!;
      const actorRole = req.session.role!;
      const { status, reviewerComment, returnComment, managerAdjustedPunchIn, managerAdjustedPunchOut } = req.body;

      if (!["approved", "rejected", "returned"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'approved', 'rejected', or 'returned'" });
      }
      // For approve/reject a reviewer comment is required; for return a returnComment is required.
      if (status === "returned") {
        if (!returnComment || !returnComment.trim()) {
          return res.status(400).json({ error: "A clarification note is required when returning a request" });
        }
      } else if (!reviewerComment || !reviewerComment.trim()) {
        return res.status(400).json({ error: "Reviewer comment is required" });
      }

      const request = await storage.getRegularizationRequest(req.params.id);
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.status !== "pending") return res.status(400).json({ error: "Request is no longer pending" });

      // Managers may review requests for anyone in their full reporting line
      // (direct reports and people reporting to their sub-managers).
      if (actorRole === "manager") {
        const reporteeIds = await getAllReporteeIds(actorId);
        if (!reporteeIds.includes(request.employeeId)) {
          return res.status(403).json({ error: "You can only review requests for your reporting line" });
        }
      }

      // Attendance run lock check: if the month has an approved/overridden attendance run,
      // only HR and super_admin can still approve/reject (salary is being processed).
      const [reqYear, reqMonth] = request.attendanceDate.split("-");
      const lockedRun = (await db.execute(sql`
        SELECT id FROM attendance_report_runs
        WHERE year = ${parseInt(reqYear)}
          AND month = ${parseInt(reqMonth)}
          AND status IN ('approved', 'overridden')
        LIMIT 1
      `)).rows as any[];

      if (lockedRun.length > 0 && !["hr", "admin", "super_admin"].includes(actorRole)) {
        return res.status(403).json({
          error: "The attendance report for this month has been approved and locked. Please contact HR to process this correction.",
          code: "ATTENDANCE_RUN_LOCKED",
        });
      }

      // Parse optional manager-adjusted punch times (HH:mm strings combined with the attendance date,
      // or full ISO strings from older callers). These override the employee's requested times on approval.
      const HH_MM_RE = /^\d{2}:\d{2}$/;
      const parseAdjusted = (val: string | undefined | null): Date | undefined => {
        if (!val) return undefined;
        const iso = HH_MM_RE.test(val) ? `${request.attendanceDate}T${val}:00` : val;
        const d = new Date(iso);
        return isNaN(d.getTime()) ? undefined : d;
      };
      const adjustedPunchIn = parseAdjusted(managerAdjustedPunchIn);
      const adjustedPunchOut = parseAdjusted(managerAdjustedPunchOut);

      const updated = await storage.updateRegularizationRequest(req.params.id, {
        status,
        reviewedBy: actorId,
        reviewerComment: status === "returned" ? null : reviewerComment,
        returnComment: status === "returned" ? returnComment : null,
        managerAdjustedPunchIn: status === "approved" ? (adjustedPunchIn ?? null) : null,
        managerAdjustedPunchOut: status === "approved" ? (adjustedPunchOut ?? null) : null,
        reviewedAt: new Date(),
      });

      // On approval: apply attendance correction with fully recomputed derived fields.
      // Manager-adjusted times (if provided) take precedence over the employee's requested times.
      if (status === "approved") {
        const punchIn = adjustedPunchIn ?? request.requestedPunchIn;
        const punchOut = adjustedPunchOut ?? request.requestedPunchOut;

        const existing = await storage.getAttendanceByUser(request.employeeId, request.attendanceDate, request.attendanceDate);

        // Determine the effective punch times after merging the correction
        const rec = existing.length > 0 ? existing[0] : null;
        const effectivePunchIn  = punchIn  ?? rec?.punchIn  ?? undefined;
        const effectivePunchOut = punchOut ?? rec?.punchOut ?? undefined;

        // Always recompute totalHours from the effective punch pair
        let totalHoursNum: string | undefined;
        if (effectivePunchIn && effectivePunchOut) {
          const diffMs = new Date(effectivePunchOut).getTime() - new Date(effectivePunchIn).getTime();
          if (diffMs > 0) totalHoursNum = (diffMs / 3600000).toFixed(2);
        }

        // Recompute attendance status from corrected punch times + shift policy
        // Falls back to "present" when shift data is unavailable
        let correctedStatus = "present";
        const empUser = await storage.getAdminUser(request.employeeId);
        if (empUser?.shiftId && effectivePunchIn) {
          try {
            const { computeLateStatus, computeDayCompletionStatus } = await import("./attendancePolicy");
            const lateResult = await computeLateStatus(empUser.shiftId, new Date(effectivePunchIn));
            if (lateResult) {
              const halfResult = totalHoursNum
                ? await computeDayCompletionStatus(empUser.shiftId, parseFloat(totalHoursNum), lateResult.status)
                : { status: lateResult.status };
              correctedStatus = halfResult.status;
            }
          } catch {
            // Fall back to "present" if shift-based recomputation fails
          }
        }

        if (rec) {
          await storage.updateAttendance(rec.id, {
            punchIn: effectivePunchIn,
            punchOut: effectivePunchOut,
            totalHours: totalHoursNum ?? rec.totalHours ?? undefined,
            isCorrect: true,
            correctionSource: "regularization",
            correctedById: actorId,
            correctionNote: reviewerComment,
            status: correctedStatus,
          });
        } else if (request.requestType === "wrong_absent") {
          // No existing record — create one marking the employee as present
          await storage.createAttendance({
            userId: request.employeeId,
            date: request.attendanceDate,
            punchIn: effectivePunchIn,
            punchOut: effectivePunchOut,
            totalHours: totalHoursNum,
            status: correctedStatus,
            isCorrect: true,
            correctionSource: "regularization",
            correctedById: actorId,
            correctionNote: reviewerComment,
          });
        }
      }

      // Notify the employee — in-app always, email best-effort. Respects the notifications feature flag.
      const actorUser = await storage.getAdminUser(actorId);
      const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : "HR";
      const decisionComment = status === "returned" ? returnComment : reviewerComment;
      const titleByStatus: Record<string, string> = {
        approved: "Regularization Approved",
        rejected: "Regularization Rejected",
        returned: "Regularization Needs Clarification",
      };
      const messageByStatus: Record<string, string> = {
        approved: `Your regularization request for ${request.attendanceDate} was approved.${reviewerComment ? ` Comment: ${reviewerComment}` : ""}`,
        rejected: `Your regularization request for ${request.attendanceDate} was rejected.${reviewerComment ? ` Comment: ${reviewerComment}` : ""}`,
        returned: `Your regularization request for ${request.attendanceDate} was returned for clarification.${returnComment ? ` Note: ${returnComment}` : ""}`,
      };

      let notificationsEnabled = true;
      try {
        const setting = await storage.getSystemSetting("feature_flags");
        const flags = (setting?.value as Record<string, boolean>) || {};
        notificationsEnabled = flags.notifications_enabled !== false;
      } catch { /* default to enabled */ }

      if (notificationsEnabled) {
        await storage.createNotification({
          userId: request.employeeId,
          type: "regularization_decision",
          title: titleByStatus[status],
          message: messageByStatus[status],
          isRead: false,
          metadata: { requestId: request.id, attendanceDate: request.attendanceDate, status, reviewerName: actorName },
        });

        // Send email notification to employee (fire-and-forget)
        try {
          const empUser = await storage.getAdminUser(request.employeeId);
          if (empUser?.email) {
            const { sendRegularizationDecisionEmail } = await import("./email");
            sendRegularizationDecisionEmail({
              to: empUser.email,
              employeeName: `${empUser.firstName} ${empUser.lastName}`,
              attendanceDate: request.attendanceDate,
              requestType: request.requestType,
              status: status as "approved" | "rejected" | "returned",
              reviewerName: actorName,
              reviewerComment: decisionComment,
            }).catch(console.error);
          }
        } catch { /* non-critical */ }
      }

      await storage.createAuditLog({
        actorId,
        targetId: request.employeeId,
        action: `regularization_${status}`,
        changes: {
          requestId: request.id,
          attendanceDate: request.attendanceDate,
          requestType: request.requestType,
          oldStatus: "pending",
          newStatus: status,
          reviewerComment: decisionComment,
          requestedPunchIn: request.requestedPunchIn ?? null,
          requestedPunchOut: request.requestedPunchOut ?? null,
          managerAdjustedPunchIn: adjustedPunchIn?.toISOString() ?? null,
          managerAdjustedPunchOut: adjustedPunchOut?.toISOString() ?? null,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error("Regularization review error:", error);
      res.status(500).json({ error: "Failed to review request" });
    }
  });

  // Employee resubmits a returned request after addressing the reviewer's clarification note.
  // Owner-only; allowed only when the request is currently in the "returned" state.
  app.patch("/api/hr/attendance/regularization/:id/resubmit", requireAuth, async (req, res) => {
    try {
      const actorId = req.session.userId!;
      const request = await storage.getRegularizationRequest(req.params.id);
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.employeeId !== actorId) {
        return res.status(403).json({ error: "You can only resubmit your own requests" });
      }
      if (request.status !== "returned") {
        return res.status(400).json({ error: "Only returned requests can be resubmitted" });
      }

      const { reason, requestedPunchIn, requestedPunchOut, attachmentUrl } = req.body;
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: "Reason is required" });
      }

      // Convert optional HH:mm time strings to full datetimes combined with the attendance date.
      const HH_MM_RE = /^\d{2}:\d{2}$/;
      const buildDatetime = (time: string | undefined | null): Date | null | undefined => {
        if (time === undefined) return undefined; // leave unchanged
        if (time === null || time === "") return null; // explicitly clear
        const iso = HH_MM_RE.test(time) ? `${request.attendanceDate}T${time}:00` : time;
        const d = new Date(iso);
        if (isNaN(d.getTime())) throw new Error("invalid_time");
        return d;
      };

      let newPunchIn: Date | null | undefined;
      let newPunchOut: Date | null | undefined;
      try {
        newPunchIn = buildDatetime(requestedPunchIn);
        newPunchOut = buildDatetime(requestedPunchOut);
      } catch {
        return res.status(400).json({ error: "Invalid punch time format" });
      }

      const updated = await storage.updateRegularizationRequest(req.params.id, {
        status: "pending",
        reason,
        ...(newPunchIn !== undefined ? { requestedPunchIn: newPunchIn } : {}),
        ...(newPunchOut !== undefined ? { requestedPunchOut: newPunchOut } : {}),
        ...(attachmentUrl !== undefined ? { attachmentUrl: attachmentUrl || null } : {}),
        // Clear the prior review trail so the request re-enters the queue cleanly.
        reviewedBy: null,
        reviewerComment: null,
        reviewedAt: null,
        returnComment: null,
      });

      await storage.createAuditLog({
        actorId,
        targetId: request.employeeId,
        action: "regularization_resubmitted",
        changes: {
          requestId: request.id,
          attendanceDate: request.attendanceDate,
          requestType: request.requestType,
          oldStatus: "returned",
          newStatus: "pending",
        },
      });

      res.json(updated);
    } catch (error) {
      console.error("Regularization resubmit error:", error);
      res.status(500).json({ error: "Failed to resubmit request" });
    }
  });

  // HR/Admin direct override (bypasses request queue)
  app.post("/api/hr/attendance/regularization/override", requirePermission("hr.attendance.regularization.override", "hr", "admin", "super_admin"), async (req, res) => {
    try {
      const actorId = req.session.userId!;
      const { employeeId, attendanceDate, requestedPunchIn, requestedPunchOut, requestType, reason, comment } = req.body;

      if (!employeeId || !attendanceDate || !requestType || !reason || !comment) {
        return res.status(400).json({ error: "employeeId, attendanceDate, requestType, reason, and comment are required" });
      }

      // Convert HH:mm time strings to full ISO datetime strings by combining with attendanceDate.
      // Reject any time values that don't produce a valid Date.
      const HH_MM_RE = /^\d{2}:\d{2}$/;
      const buildFullDatetime = (time: string | undefined): string | undefined => {
        if (!time) return undefined;
        const iso = HH_MM_RE.test(time)
          ? `${attendanceDate}T${time}:00`
          : time; // Already a full ISO string (e.g. from older callers)
        if (isNaN(new Date(iso).getTime())) throw new Error(`Invalid time value: "${time}"`);
        return iso;
      };

      let resolvedPunchIn: string | undefined;
      let resolvedPunchOut: string | undefined;
      try {
        resolvedPunchIn = buildFullDatetime(requestedPunchIn);
        resolvedPunchOut = buildFullDatetime(requestedPunchOut);
      } catch (timeErr: any) {
        return res.status(400).json({ error: timeErr.message });
      }

      if (resolvedPunchIn && resolvedPunchOut && new Date(resolvedPunchIn) >= new Date(resolvedPunchOut)) {
        return res.status(400).json({ error: "Punch-in time must be before punch-out time" });
      }

      // Recompute attendance status from corrected punch times + shift policy
      // Falls back to "present" when shift data is unavailable
      let computedStatus = "present";
      const empUserO = await storage.getAdminUser(employeeId);
      if (empUserO?.shiftId && resolvedPunchIn) {
        try {
          const { computeLateStatus: cls, computeDayCompletionStatus: chs } = await import("./attendancePolicy");
          const lateResult = await cls(empUserO.shiftId, new Date(resolvedPunchIn));
          if (lateResult) {
            let totalHrsNum: number | undefined;
            if (resolvedPunchIn && resolvedPunchOut) {
              const diffMs = new Date(resolvedPunchOut).getTime() - new Date(resolvedPunchIn).getTime();
              if (diffMs > 0) totalHrsNum = diffMs / 3600000;
            }
            const halfResult = totalHrsNum !== undefined
              ? await chs(empUserO.shiftId, totalHrsNum, lateResult.status)
              : { status: lateResult.status };
            computedStatus = halfResult.status;
          }
        } catch {
          // Fall back to "present"
        }
      }

      const result = await storage.applyRegularizationOverride({
        actorId,
        employeeId,
        attendanceDate,
        requestedPunchIn: resolvedPunchIn,
        requestedPunchOut: resolvedPunchOut,
        requestType,
        reason,
        comment,
        attendanceStatus: computedStatus,
      });

      await storage.createAuditLog({
        actorId,
        targetId: employeeId,
        action: "regularization_override",
        changes: { requestId: result.id, attendanceDate, requestType, reason, comment },
      });

      await storage.createNotification({
        userId: employeeId,
        type: "regularization_decision",
        title: "Attendance Correction Applied",
        message: `HR has directly corrected your attendance for ${attendanceDate}. Note: ${comment}`,
        isRead: false,
        metadata: { requestId: result.id, attendanceDate, status: "approved_override" },
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Regularization override error:", error);
      res.status(500).json({ error: "Failed to apply override" });
    }
  });

  // Bulk-approve multiple pending regularization requests (manager-scoped)
  app.post("/api/hr/attendance/regularization/bulk-approve", requirePermission("hr.attendance.regularization.bulkApprove", "hr", "manager", "admin", "super_admin"), async (req, res) => {
    try {
      const actorId = req.session.userId!;
      const actorRole = req.session.role!;
      const { ids, reviewerComment } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids must be a non-empty array" });
      }
      if (!reviewerComment || !reviewerComment.trim()) {
        return res.status(400).json({ error: "reviewerComment is required for bulk approval" });
      }

      // For managers, validate all requests belong to their full reporting line
      let teamIds: Set<string> | null = null;
      if (actorRole === "manager") {
        const reporteeIds = await getAllReporteeIds(actorId);
        teamIds = new Set(reporteeIds);
      }

      const results: { id: string; status: "approved" | "skipped"; reason?: string }[] = [];
      const actorUser = await storage.getAdminUser(actorId);

      for (const id of ids) {
        try {
          const request = await storage.getRegularizationRequest(id);
          if (!request || request.status !== "pending") {
            results.push({ id, status: "skipped", reason: "not_found_or_not_pending" });
            continue;
          }

          if (teamIds && !teamIds.has(request.employeeId)) {
            results.push({ id, status: "skipped", reason: "not_in_team" });
            continue;
          }

          // Run-lock check
          const [rYear, rMonth] = request.attendanceDate.split("-");
          const locked = (await db.execute(sql`
            SELECT id FROM attendance_report_runs
            WHERE year = ${parseInt(rYear)} AND month = ${parseInt(rMonth)}
              AND status IN ('approved', 'overridden')
            LIMIT 1
          `)).rows as any[];
          if (locked.length > 0 && !["hr", "admin", "super_admin"].includes(actorRole)) {
            results.push({ id, status: "skipped", reason: "attendance_run_locked" });
            continue;
          }

          // Compute attendance correction values BEFORE the transaction
          const empUser = await storage.getAdminUser(request.employeeId);
          const punchIn = request.requestedPunchIn;
          const punchOut = request.requestedPunchOut;
          const existing = await storage.getAttendanceByUser(request.employeeId, request.attendanceDate, request.attendanceDate);
          const rec = existing.length > 0 ? existing[0] : null;
          const effectivePunchIn  = punchIn  ?? rec?.punchIn  ?? undefined;
          const effectivePunchOut = punchOut ?? rec?.punchOut ?? undefined;
          let totalHoursNum: string | undefined;
          if (effectivePunchIn && effectivePunchOut) {
            const diffMs = new Date(effectivePunchOut).getTime() - new Date(effectivePunchIn).getTime();
            if (diffMs > 0) totalHoursNum = (diffMs / 3600000).toFixed(2);
          }
          let correctedStatus = "present";
          if (empUser?.shiftId && effectivePunchIn) {
            try {
              const { computeLateStatus, computeDayCompletionStatus } = await import("./attendancePolicy");
              const lateResult = await computeLateStatus(empUser.shiftId, new Date(effectivePunchIn));
              if (lateResult) {
                const halfResult = totalHoursNum
                  ? await computeDayCompletionStatus(empUser.shiftId, parseFloat(totalHoursNum), lateResult.status)
                  : { status: lateResult.status };
                correctedStatus = halfResult.status;
              }
            } catch { /* fall back to present */ }
          }

          // Atomic transaction: regularization status + attendance correction must succeed together
          await db.transaction(async (tx) => {
            await tx.update(attendanceRegularizations)
              .set({ status: "approved", reviewedBy: actorId, reviewerComment, reviewedAt: new Date() } as any)
              .where(eq(attendanceRegularizations.id, id));

            if (rec) {
              await tx.update(attendance)
                .set({
                  punchIn: effectivePunchIn, punchOut: effectivePunchOut,
                  totalHours: totalHoursNum ?? rec.totalHours ?? undefined,
                  isCorrect: true, correctionSource: "regularization",
                  correctedById: actorId, correctionNote: reviewerComment, status: correctedStatus,
                } as any)
                .where(eq(attendance.id, rec.id));
            } else if (request.requestType === "wrong_absent") {
              await tx.insert(attendance).values({
                userId: request.employeeId, date: request.attendanceDate,
                punchIn: effectivePunchIn, punchOut: effectivePunchOut,
                totalHours: totalHoursNum, status: correctedStatus, isCorrect: true,
                correctionSource: "regularization", correctedById: actorId, correctionNote: reviewerComment,
              } as any);
            }
          });

          // Post-transaction: notifications, email, audit (fire-and-forget acceptable)
          await storage.createNotification({
            userId: request.employeeId, type: "regularization_decision",
            title: "Regularization Approved",
            message: `Your regularization request for ${request.attendanceDate} was approved. ${reviewerComment ? `Note: ${reviewerComment}` : ""}`,
            isRead: false,
            metadata: { requestId: id, attendanceDate: request.attendanceDate, status: "approved", reviewerName: actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : null },
          });

          if (empUser?.email) {
            const { sendRegularizationDecisionEmail } = await import("./email");
            sendRegularizationDecisionEmail({
              to: empUser.email,
              employeeName: `${empUser.firstName} ${empUser.lastName}`,
              attendanceDate: request.attendanceDate,
              requestType: request.requestType,
              status: "approved",
              reviewerName: actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : "HR",
              reviewerComment,
            }).catch(console.error);
          }

          await storage.createAuditLog({
            actorId, targetId: request.employeeId, action: "regularization_approved",
            changes: { requestId: id, attendanceDate: request.attendanceDate, requestType: request.requestType, oldStatus: "pending", newStatus: "approved", reviewerComment, bulkApproval: true },
          });

          results.push({ id, status: "approved" });
        } catch (err) {
          results.push({ id, status: "skipped", reason: "internal_error" });
        }
      }

      const approvedCount = results.filter(r => r.status === "approved").length;
      res.json({ approvedCount, skippedCount: results.length - approvedCount, results });
    } catch (error) {
      console.error("Bulk approve error:", error);
      res.status(500).json({ error: "Failed to bulk approve requests" });
    }
  });

  // ==========================================
  // BULK REGULARIZATION & ABSENT EMPLOYEE ENDPOINTS
  // ==========================================

  // Get employees with absent/no-punch status on given dates
  app.get("/api/hr/attendance/absent-employees", requirePermission("hr.attendance.absentEmployees", "hr", "admin", "super_admin"), async (req, res) => {
    try {
      const rawDates = req.query["dates[]"] || req.query["dates"];
      const dates: string[] = Array.isArray(rawDates)
        ? (rawDates as string[])
        : typeof rawDates === "string"
          ? rawDates.split(",").map(d => d.trim())
          : [];
      if (dates.length === 0) {
        return res.status(400).json({ error: "At least one date is required" });
      }

      const allUsers = await storage.getAdminUsers();

      const results: Array<{ userId: string; name: string; employeeId: string | null; email: string; date: string; currentStatus: string }> = [];

      for (const date of dates) {
        const dateAttendance = await storage.getAttendanceByDate(date);
        const attendanceByUser = new Map(dateAttendance.map(a => [a.userId, a]));

        for (const user of allUsers) {
          if (!user.isActive) continue;
          const rec = attendanceByUser.get(user.id);
          if (!rec || rec.status === "absent") {
            results.push({
              userId: user.id,
              name: `${user.firstName} ${user.lastName}`,
              employeeId: user.employeeId ?? null,
              email: user.email,
              date,
              currentStatus: rec?.status ?? "no_punch",
            });
          }
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Absent employees error:", error);
      res.status(500).json({ error: "Failed to fetch absent employees" });
    }
  });

  // Bulk attendance regularization override
  app.post("/api/hr/attendance/regularization/bulk-override", requirePermission("hr.attendance.regularization.bulkOverride", "hr", "admin", "super_admin"), async (req, res) => {
    try {
      const actorId = req.session.userId!;
      const { entries, punchIn, punchOut, reason, comment } = req.body;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: "entries array is required" });
      }
      if (!reason) {
        return res.status(400).json({ error: "reason is required" });
      }

      const HH_MM_RE = /^\d{2}:\d{2}$/;

      let successCount = 0;
      let failedCount = 0;
      const failures: Array<{ userId: string; date: string; error: string }> = [];

      for (const entry of entries) {
        const { userId, date } = entry;
        if (!userId || !date) { failedCount++; continue; }

        const resolvedPunchIn = punchIn && HH_MM_RE.test(punchIn) ? `${date}T${punchIn}:00` : punchIn || undefined;
        const resolvedPunchOut = punchOut && HH_MM_RE.test(punchOut) ? `${date}T${punchOut}:00` : punchOut || undefined;

        try {
          const hrComment = comment || `Bulk regularization: ${reason}`;
          await storage.applyRegularizationOverride({
            actorId,
            employeeId: userId,
            attendanceDate: date,
            requestedPunchIn: resolvedPunchIn,
            requestedPunchOut: resolvedPunchOut,
            requestType: "wrong_absent",
            reason,
            comment: hrComment,
            attendanceStatus: "present",
          });

          await storage.createNotification({
            userId,
            type: "regularization_decision",
            title: "Attendance Correction Applied",
            message: `HR has corrected your attendance for ${date}. Reason: ${reason}`,
            isRead: false,
            metadata: { attendanceDate: date, status: "bulk_override" },
          });

          successCount++;
        } catch (err: any) {
          failedCount++;
          failures.push({ userId, date, error: err.message || "Unknown error" });
        }
      }

      await storage.createAuditLog({
        actorId,
        targetId: actorId,
        action: "bulk_regularization_override",
        changes: {
          totalEntries: entries.length,
          successCount,
          failedCount,
          reason,
          dates: [...new Set(entries.map((e: any) => e.date))],
          punchIn: punchIn || null,
          punchOut: punchOut || null,
          failures,
        },
      });

      res.json({ success: true, successCount, failedCount, failures });
    } catch (error) {
      console.error("Bulk regularization override error:", error);
      res.status(500).json({ error: "Failed to apply bulk override" });
    }
  });

  // --- Attendance Report (CSV export) ---
  app.get("/api/hr/reports/attendance", requirePermission("hr.reports.attendance", "hr"), async (req, res) => {
    try {
      const { userId, startDate, endDate } = req.query;
      if (!userId || !startDate || !endDate) {
        return res.status(400).json({ error: "userId, startDate, and endDate are required" });
      }
      const records = await storage.getAttendanceByUser(userId as string, startDate as string, endDate as string);
      const user = await storage.getAdminUser(userId as string);
      const csvHeader = "Date,Punch In,Punch Out,Total Hours,Status,Notes\n";
      const csvRows = records.map(r => {
        const pIn = r.punchIn ? new Date(r.punchIn).toLocaleTimeString() : "";
        const pOut = r.punchOut ? new Date(r.punchOut).toLocaleTimeString() : "";
        return `${r.date},${pIn},${pOut},${r.totalHours || ""},${r.status},${(r.notes || "").replace(/,/g, ";")}`;
      }).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=attendance_${user?.firstName || "user"}_${startDate}_${endDate}.csv`);
      res.send(csvHeader + csvRows);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // --- Manager: Team Attendance ---
  app.get("/api/hr/attendance/my-team", requirePermission("hr.attendance.myTeam", "hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role;
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];

      const isPrivilegedRole = ["super_admin", "admin", "hr", "operations"].includes(userRole!);
      let teamMembers: AdminUser[];
      if (isPrivilegedRole) {
        teamMembers = await storage.getAllActiveEmployees();
      } else {
        teamMembers = await storage.getTeamMembers(userId);
      }

      const memberIds = teamMembers.map(m => m.id);

      if (memberIds.length === 0) {
        return res.json({
          members: [],
          attendance: [],
          noTeamAssigned: !isPrivilegedRole,
        });
      }

      const attendanceRecords = await storage.getAttendanceByTeam(memberIds, date);

      // Augment attendance with approved leave data so on-leave employees
      // don't appear as absent when no attendance record was created.
      let augmentedAttendance: Attendance[] = [...attendanceRecords];
      try {
        const approvedLeaveRows = await db
          .select({ userId: leaveRequests.userId, halfDay: leaveRequests.halfDay })
          .from(leaveRequests)
          .where(and(
            inArray(leaveRequests.userId, memberIds),
            eq(leaveRequests.status, "approved"),
            sql`${leaveRequests.startDate} <= ${date}`,
            sql`${leaveRequests.endDate} >= ${date}`,
          ));

        for (const row of approvedLeaveRows) {
          const leaveStatus: Attendance["status"] = row.halfDay ? "half_day" : "on_leave";
          const existingIdx = augmentedAttendance.findIndex(a => a.userId === row.userId);
          if (existingIdx === -1) {
            const syntheticRecord: Attendance = {
              id: `leave-synthetic-${row.userId}-${date}`,
              userId: row.userId,
              date,
              punchIn: null,
              punchOut: null,
              totalHours: null,
              status: leaveStatus,
              notes: "Approved leave",
              isCorrect: false,
              correctionSource: null,
              correctedById: null,
              correctionNote: null,
              createdAt: null,
              updatedAt: null,
            };
            augmentedAttendance.push(syntheticRecord);
          } else if (augmentedAttendance[existingIdx].status === "absent") {
            augmentedAttendance[existingIdx] = {
              ...augmentedAttendance[existingIdx],
              status: leaveStatus,
              notes: "Approved leave",
            };
          }
        }
      } catch (leaveAugErr) {
        console.error("[my-team] Failed to augment leave data:", leaveAugErr);
        // Non-fatal: fall back to raw attendance records
        augmentedAttendance = attendanceRecords;
      }

      // Fetch shift info for all team members in one query
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(Date.now() + IST_OFFSET_MS);
      const todayStr = istNow.toISOString().slice(0, 10);
      const year = parseInt(todayStr.slice(0, 4), 10);
      const dstRowsTeam = await db.execute(sql`SELECT spring_forward_date, fall_back_date FROM dst_config WHERE year = ${year} LIMIT 1`);
      let isDstTeam = false;
      if (dstRowsTeam.rows.length > 0) {
        const dr = dstRowsTeam.rows[0] as any;
        isDstTeam = todayStr >= dr.spring_forward_date && todayStr < dr.fall_back_date;
      }
      const shiftMap: Record<string, { shiftName: string; expectedStart: string }> = {};
      try {
        const shiftRows = await db.execute(sql`
          SELECT u.id as user_id, s.name as shift_name,
                 s.ist_start_dst, s.ist_start_std
          FROM admin_users u
          JOIN shifts s ON s.id = u.shift_id AND s.is_active = true
          WHERE u.id = ANY(${memberIds})
        `);
        for (const row of shiftRows.rows as any[]) {
          shiftMap[row.user_id] = {
            shiftName: row.shift_name ?? null,
            expectedStart: (isDstTeam ? row.ist_start_dst : row.ist_start_std) ?? null,
          };
        }
      } catch (_shiftErr) {
        // Non-fatal: shift data missing; continue without shift info
      }

      res.json({
        members: teamMembers.map(m => ({
          id: m.id, firstName: m.firstName, lastName: m.lastName, email: m.email,
          designation: m.designation, departmentId: m.departmentId,
          shiftName: shiftMap[m.id]?.shiftName ?? null,
          expectedStart: shiftMap[m.id]?.expectedStart ?? null,
          attendanceExempt: m.attendanceExempt ?? false,
        })),
        attendance: augmentedAttendance,
        noTeamAssigned: false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team attendance" });
    }
  });

  app.get("/api/hr/attendance/my-team/range", requirePermission("hr.attendance.myTeam.range", "hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      let teamMembers: AdminUser[];
      if (["super_admin", "admin", "hr", "operations"].includes(userRole!)) {
        teamMembers = await storage.getAllActiveEmployees();
      } else {
        teamMembers = await storage.getTeamMembers(userId);
      }

      if (teamMembers.length === 0) {
        return res.json({ members: [], attendance: [] });
      }

      const memberIds = teamMembers.map(m => m.id);
      const attendanceRecords = await storage.getAttendanceByTeamRange(memberIds, startDate, endDate);

      res.json({
        members: teamMembers.map(m => ({
          id: m.id, firstName: m.firstName, lastName: m.lastName, email: m.email,
          designation: m.designation, departmentId: m.departmentId,
          attendanceExempt: m.attendanceExempt ?? false,
        })),
        attendance: attendanceRecords
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team attendance" });
    }
  });

  app.get("/api/hr/attendance/member/:memberId/range", requirePermission("hr.attendance.member.range", "hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
    try {
      const memberId = req.params.memberId;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const records = await storage.getAttendanceByUser(memberId, startDate, endDate);
      const member = await storage.getAdminUser(memberId);

      // Enrich corrected records with corrector name. This is a non-critical
      // enrichment: if it fails, still return the core attendance records (with
      // correctedByName null) rather than 500-ing the whole read.
      const correctorMap = new Map<string, string>();
      try {
        const correctorIds = [...new Set(records.filter(r => r.correctedById).map(r => r.correctedById!))];
        if (correctorIds.length > 0) {
          const correctors = await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
            .from(adminUsers).where(inArray(adminUsers.id, correctorIds));
          for (const c of correctors) correctorMap.set(c.id, `${c.firstName} ${c.lastName}`);
        }
      } catch (enrichError) {
        console.error(
          `[hr/attendance/member/${memberId}/range] corrector-name enrichment failed (non-fatal):`,
          enrichError instanceof Error ? `${enrichError.message}\n${enrichError.stack}` : enrichError
        );
      }

      const enrichedRecords = records.map(r => ({
        ...r,
        correctedByName: r.correctedById ? (correctorMap.get(r.correctedById) || null) : null,
      }));

      res.json({
        member: member ? {
          id: member.id, firstName: member.firstName, lastName: member.lastName,
          email: member.email, designation: member.designation, departmentId: member.departmentId
        } : null,
        attendance: enrichedRecords
      });
    } catch (error) {
      console.error(
        `[hr/attendance/member/${req.params.memberId}/range] failed to fetch member attendance:`,
        error instanceof Error ? `${error.message}\n${error.stack}` : error
      );
      res.status(500).json({ error: "Failed to fetch member attendance" });
    }
  });

  app.get("/api/hr/attendance/download", requirePermission("hr.attendance.download", "hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
    try {
      const ExcelJSModule = await import("exceljs");
      const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
      const userId = req.session.userId!;
      const userRole = req.session.role;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      let teamMembers: AdminUser[];
      if (["super_admin", "admin", "hr", "operations"].includes(userRole!)) {
        teamMembers = await storage.getAdminUsers();
      } else {
        teamMembers = await storage.getTeamMembers(userId);
      }

      teamMembers.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

      const memberIds = teamMembers.map(m => m.id);
      const records = await storage.getAttendanceByTeamRange(memberIds, startDate, endDate);
      const memberMap = new Map(teamMembers.map(m => [m.id, m]));

      const allDates: string[] = [];
      const allCalendarDates: { date: string; dayOfWeek: number }[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      const todayStr = new Date().toISOString().split("T")[0];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split("T")[0];
        allCalendarDates.push({ date: ds, dayOfWeek: d.getDay() });
        if (d.getDay() !== 0 && d.getDay() !== 6) allDates.push(ds);
      }

      const getEffectiveStatus = (record: any): string => {
        if (record.status === "on_leave") return "leave";
        if (record.status === "holiday") return "holiday";
        if (record.punchIn && record.punchOut && record.totalHours) {
          return parseFloat(record.totalHours as string) >= 8 ? "present" : "absent";
        }
        if (record.punchIn && !record.punchOut) return "present";
        return "absent";
      };

      const recordsByUser = new Map<string, Map<string, any>>();
      for (const rec of records) {
        if (!recordsByUser.has(rec.userId)) recordsByUser.set(rec.userId, new Map());
        recordsByUser.get(rec.userId)!.set(rec.date, rec);
      }

      interface DayData {
        name: string;
        email: string;
        designation: string;
        date: string;
        punchIn: string;
        punchOut: string;
        hours: number;
        status: string;
        isCorrect: boolean;
        correctionNote: string;
        correctedBy: string;
        correctedAt: string;
        originalStatus: string;
      }

      const allRowData: DayData[] = [];
      const summaryData: {
        name: string; email: string; designation: string;
        totalWorkingDays: number; present: number; absent: number;
        holidays: number; leaves: number; totalHours: number; avgHours: number;
        correctedDays: number;
      }[] = [];

      // Build corrector name map for all records
      const allCorrectorIds = [...new Set(records.filter((r: any) => r.correctedById).map((r: any) => r.correctedById as string))];
      const correctorNameMap = new Map<string, string>();
      if (allCorrectorIds.length > 0) {
        const correctorRows = await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
          .from(adminUsers).where(inArray(adminUsers.id, allCorrectorIds));
        for (const c of correctorRows) correctorNameMap.set(c.id, `${c.firstName} ${c.lastName}`);
      }

      for (const member of teamMembers) {
        const name = `${member.firstName} ${member.lastName}`;
        const userRecords = recordsByUser.get(member.id) || new Map();
        let present = 0, absent = 0, holidayCount = 0, leaveCount = 0, totalHours = 0, correctedDays = 0;

        for (const date of allDates) {
          const record = userRecords.get(date);
          let status = "absent";
          let punchIn = "";
          let punchOut = "";
          let hours = 0;
          let isCorrect = false;
          let correctionNote = "";
          let correctedBy = "";
          let correctedAt = "";

          if (record) {
            status = getEffectiveStatus(record);
            punchIn = record.punchIn ? new Date(record.punchIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
            punchOut = record.punchOut ? new Date(record.punchOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
            hours = record.totalHours ? parseFloat(record.totalHours as string) : 0;
            isCorrect = !!record.isCorrect;
            correctionNote = record.correctionNote || "";
            correctedBy = record.correctedById ? (correctorNameMap.get(record.correctedById) || "") : "";
            correctedAt = record.updatedAt ? new Date(record.updatedAt).toLocaleDateString("en-US") : "";
          } else if (date > todayStr) {
            status = "-";
          }

          if (status === "present") present++;
          else if (status === "absent") absent++;
          else if (status === "holiday") holidayCount++;
          else if (status === "leave") leaveCount++;
          if (isCorrect) correctedDays++;
          totalHours += hours;

          allRowData.push({
            name, email: member.email, designation: member.designation || "",
            date, punchIn, punchOut, hours, status,
            isCorrect, correctionNote, correctedBy, correctedAt,
            originalStatus: record ? record.status : "absent",
          });
        }

        const totalWorkingDays = allDates.filter(d => d <= todayStr).length;
        summaryData.push({
          name, email: member.email, designation: member.designation || "",
          totalWorkingDays, present, absent, holidays: holidayCount, leaves: leaveCount,
          totalHours: Math.round(totalHours * 100) / 100,
          avgHours: present > 0 ? Math.round((totalHours / present) * 100) / 100 : 0,
          correctedDays,
        });
      }

      const workbook = new ExcelJS.Workbook();

      const summarySheet = workbook.addWorksheet("Summary");
      summarySheet.columns = [
        { header: "Employee", key: "name", width: 25 },
        { header: "Email", key: "email", width: 30 },
        { header: "Designation", key: "designation", width: 25 },
        { header: "Working Days", key: "totalWorkingDays", width: 14 },
        { header: "Present", key: "present", width: 10 },
        { header: "Absent", key: "absent", width: 10 },
        { header: "Holidays", key: "holidays", width: 10 },
        { header: "Leaves", key: "leaves", width: 10 },
        { header: "Total Hours", key: "totalHours", width: 12 },
        { header: "Avg Hours/Day", key: "avgHours", width: 14 },
        { header: "Corrected Days", key: "correctedDays", width: 14 },
      ];
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      for (const row of summaryData) {
        summarySheet.addRow(row);
      }
      // Footer: total corrections
      const totalCorrectionsInSummary = summaryData.reduce((s, r) => s + r.correctedDays, 0);
      const footerRow = summarySheet.addRow(["", "", "", "", "", "", "", "", "", "Total Corrections:", totalCorrectionsInSummary]);
      footerRow.font = { bold: true };
      footerRow.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } };
      footerRow.getCell(11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } };

      const calendarSheet = workbook.addWorksheet("Calendar Grid");
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const calendarHeaders = ["Employee"];
      for (const cd of allCalendarDates) {
        const d = new Date(cd.date);
        calendarHeaders.push(`${d.getDate()} ${dayNames[cd.dayOfWeek]}`);
      }
      calendarHeaders.push("P", "A", "H", "L");

      const headerRow = calendarSheet.addRow(calendarHeaders);
      headerRow.font = { bold: true, size: 9 };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      calendarSheet.getColumn(1).width = 25;
      for (let i = 2; i <= allCalendarDates.length + 1; i++) {
        calendarSheet.getColumn(i).width = 7;
      }
      for (let i = allCalendarDates.length + 2; i <= allCalendarDates.length + 5; i++) {
        calendarSheet.getColumn(i).width = 5;
      }

      const statusColors: Record<string, string> = {
        present: "FF92D050", absent: "FFFF6B6B", holiday: "FF5B9BD5",
        leave: "FFFFC000", weekend: "FFD9D9D9", "-": "FFF2F2F2",
        corrected: "FFFFC000",
      };
      const statusCodes: Record<string, string> = {
        present: "P", absent: "A", holiday: "H", leave: "L", weekend: "W", "-": "-",
      };

      for (const member of teamMembers) {
        const name = `${member.firstName} ${member.lastName}`;
        const userRecords = recordsByUser.get(member.id) || new Map();
        const rowValues: string[] = [name];
        const correctedCells: Set<number> = new Set();
        let pCount = 0, aCount = 0, hCount = 0, lCount = 0;
        let colIdx = 2;

        for (const cd of allCalendarDates) {
          if (cd.dayOfWeek === 0 || cd.dayOfWeek === 6) {
            rowValues.push("W");
          } else if (cd.date > todayStr) {
            rowValues.push("-");
          } else {
            const record = userRecords.get(cd.date);
            const status = record ? getEffectiveStatus(record) : "absent";
            const isRecordCorrected = record && record.isCorrect;
            const cellVal = isRecordCorrected ? `${statusCodes[status] || "A"}*` : (statusCodes[status] || "A");
            rowValues.push(cellVal);
            if (isRecordCorrected) correctedCells.add(colIdx);
            if (status === "present") pCount++;
            else if (status === "absent") aCount++;
            else if (status === "holiday") hCount++;
            else if (status === "leave") lCount++;
          }
          colIdx++;
        }
        rowValues.push(String(pCount), String(aCount), String(hCount), String(lCount));

        const row = calendarSheet.addRow(rowValues);
        row.font = { size: 9 };
        for (let i = 2; i <= allCalendarDates.length + 1; i++) {
          const cellRaw = row.getCell(i).value as string;
          const isCorrected = correctedCells.has(i);
          const cellValue = isCorrected ? cellRaw.replace("*", "") : cellRaw;
          const statusKey = Object.entries(statusCodes).find(([, v]) => v === cellValue)?.[0] || "";
          if (isCorrected) {
            row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } };
            row.getCell(i).alignment = { horizontal: "center" };
            row.getCell(i).font = { size: 9, bold: true, color: { argb: "FF000000" } };
          } else if (statusColors[statusKey]) {
            row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColors[statusKey] } };
            row.getCell(i).alignment = { horizontal: "center" };
            row.getCell(i).font = { size: 9, bold: true, color: { argb: statusKey === "weekend" || statusKey === "-" ? "FF666666" : "FFFFFFFF" } };
          }
        }
      }

      calendarSheet.addRow([]);
      calendarSheet.addRow(["Legend:", "P = Present", "A = Absent", "H = Holiday", "L = Leave", "W = Weekend", "P* / A* = Corrected (amber)"]);

      const detailSheet = workbook.addWorksheet("Daily Detail");
      detailSheet.columns = [
        { header: "Employee", key: "name", width: 25 },
        { header: "Email", key: "email", width: 30 },
        { header: "Designation", key: "designation", width: 25 },
        { header: "Date", key: "date", width: 12 },
        { header: "Punch In", key: "punchIn", width: 12 },
        { header: "Punch Out", key: "punchOut", width: 12 },
        { header: "Duration (Hours)", key: "hours", width: 16 },
        { header: "Status", key: "status", width: 12 },
        { header: "Corrected (Y/N)", key: "correctedYN", width: 14 },
        { header: "Correction Note", key: "correctionNote", width: 30 },
        { header: "Corrected By", key: "correctedBy", width: 20 },
      ];
      detailSheet.getRow(1).font = { bold: true };
      detailSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      detailSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      for (const row of allRowData) {
        if (row.status !== "-") {
          detailSheet.addRow({
            ...row,
            hours: row.hours.toFixed(2),
            correctedYN: row.isCorrect ? "Y" : "N",
          });
        }
      }

      // Corrections Log sheet
      const correctionsLog = workbook.addWorksheet("Corrections Log");
      correctionsLog.columns = [
        { header: "Employee", key: "employee", width: 25 },
        { header: "Date", key: "date", width: 12 },
        { header: "Original Status", key: "originalStatus", width: 16 },
        { header: "Corrected By", key: "correctedBy", width: 20 },
        { header: "Corrected At", key: "correctedAt", width: 16 },
        { header: "Punch In", key: "punchIn", width: 12 },
        { header: "Punch Out", key: "punchOut", width: 12 },
        { header: "Hours", key: "hours", width: 10 },
        { header: "Note", key: "note", width: 40 },
      ];
      correctionsLog.getRow(1).font = { bold: true };
      correctionsLog.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } };
      correctionsLog.getRow(1).font = { bold: true, color: { argb: "FF000000" } };
      const correctionLogRows = allRowData.filter(r => r.isCorrect).sort((a, b) => b.date.localeCompare(a.date));
      for (const row of correctionLogRows) {
        correctionsLog.addRow({
          employee: row.name,
          date: row.date,
          originalStatus: row.originalStatus,
          correctedBy: row.correctedBy,
          correctedAt: row.correctedAt,
          punchIn: row.punchIn,
          punchOut: row.punchOut,
          hours: row.hours.toFixed(2),
          note: row.correctionNote,
        });
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="attendance_report_${startDate}_${endDate}.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Download attendance error:", error);
      res.status(500).json({ error: "Failed to generate attendance report" });
    }
  });

  // --- Manager: Team Leave Requests ---
  app.get("/api/hr/leave-requests/my-team", requirePermission("hr.leaveRequests.myTeam", "hr", "manager"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role;
      const { status } = req.query;

      let teamMembers: AdminUser[];
      if (["super_admin", "admin", "hr"].includes(userRole!)) {
        const requests = await storage.getLeaveRequests({ status: status as string });
        return res.json(requests);
      } else {
        teamMembers = await storage.getTeamMembers(userId);
      }

      if (teamMembers.length === 0) {
        return res.json([]);
      }

      const memberIds = teamMembers.map(m => m.id);
      const requests = await storage.getLeaveRequestsByTeam(memberIds);

      const filtered = status ? requests.filter(r => r.status === status) : requests;
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team leave requests" });
    }
  });

  // --- Leave Request: Get Approver (for escalation logic display) ---
  app.get("/api/hr/leave-requests/approver/:userId", requireAuth, async (req, res) => {
    try {
      const targetUserId = req.params.userId as string;
      const targetUser = await storage.getAdminUser(targetUserId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      let currentManagerId = targetUser.managerId;
      let approver = null;
      let escalationPath: string[] = [];

      while (currentManagerId) {
        const manager = await storage.getAdminUser(currentManagerId);
        if (!manager) break;

        const isOnLeave = await storage.isUserOnLeaveToday(manager.id);
        escalationPath.push(`${manager.firstName} ${manager.lastName}${isOnLeave ? ' (on leave)' : ''}`);

        if (!isOnLeave) {
          approver = { id: manager.id, firstName: manager.firstName, lastName: manager.lastName, role: manager.role };
          break;
        }

        currentManagerId = manager.managerId;
      }

      if (!approver) {
        approver = { id: null, firstName: "HR", lastName: "Department", role: "hr" };
      }

      res.json({ approver, escalationPath });
    } catch (error) {
      res.status(500).json({ error: "Failed to determine approver" });
    }
  });

  // ==========================================
  // SALARY GATE STATUS
  // ==========================================

  // Pre-flight check before generating a salary run for a given month/year.
  // Returns: attendanceRunApproved, pendingRegularizations count, canGenerate, blockingReasons[]
  app.get("/api/hr/attendance-report/salary-gate-status", requirePermission("hr.attendanceReport.salaryGateStatus", "hr", "admin", "super_admin"), async (req, res) => {
    try {
      const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

      // 1. Check attendance run status
      const runRows = (await db.execute(sql`
        SELECT id, status FROM attendance_report_runs
        WHERE year = ${year} AND month = ${month}
        ORDER BY created_at DESC LIMIT 1
      `)).rows as any[];

      const run = runRows[0] ?? null;
      const attendanceRunApproved = run?.status === "approved" || run?.status === "overridden";
      const attendanceRunStatus   = run?.status ?? "none";

      // 2. Count pending regularizations for this month
      const monthStr  = `${year}-${String(month).padStart(2, "0")}`;
      const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
      const pendingRows = (await db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM attendance_regularizations
        WHERE attendance_date >= ${monthStr + "-01"}
          AND attendance_date <  ${nextMonth + "-01"}
          AND status = 'pending'
      `)).rows as any[];
      const pendingRegularizations = parseInt(pendingRows[0]?.cnt ?? "0", 10);

      // Determine overall gate
      const blockingReasons: string[] = [];
      if (!attendanceRunApproved) blockingReasons.push("Attendance report for this month has not been approved yet.");
      if (pendingRegularizations > 0) blockingReasons.push(`${pendingRegularizations} regularization request(s) are still pending review.`);

      res.json({
        year,
        month,
        attendanceRunApproved,
        attendanceRunStatus,
        pendingRegularizations,
        canGenerate: blockingReasons.length === 0,
        blockingReasons,
      });
    } catch (error) {
      console.error("Salary gate status error:", error);
      res.status(500).json({ error: "Failed to fetch salary gate status" });
    }
  });

  // ==========================================
  // SALARY REPORTS
  // ==========================================

  app.get("/api/hr/reports/salary/preview", requireAuth, requirePermission("hr.reports.salary.preview", "super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const report = await generateMonthlySalaryReport(year, month);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate salary report preview" });
    }
  });

  // Salary report recipients - Get
  app.get("/api/hr/reports/salary/recipients", requireAuth, requirePermission("hr.reports.salary.recipients.get", "super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const setting = await storage.getSystemSetting("salary_report_recipients");
      const defaults = { to: ["accounts@hire-in.com"], cc: ["simranjeet@hire-in.com"] };
      res.json(setting?.value || defaults);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipients" });
    }
  });

  // Salary report recipients - Update
  app.put("/api/hr/reports/salary/recipients", requireAuth, requirePermission("hr.reports.salary.recipients.put", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const { to, cc } = req.body;
      if (!Array.isArray(to) || to.length === 0) {
        return res.status(400).json({ error: "At least one 'To' recipient is required" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const allEmails = [...to, ...(cc || [])];
      for (const email of allEmails) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: `Invalid email address: ${email}` });
        }
      }

      const actorId = req.session.userId!;
      await storage.upsertSystemSetting("salary_report_recipients", { to, cc: cc || [] }, actorId);

      await storage.createAuditLog({
        action: "salary_report_recipients_updated",
        actorId,
        changes: { to, cc: cc || [] },
      });

      res.json({ success: true, to, cc: cc || [] });
    } catch (error) {
      res.status(500).json({ error: "Failed to update recipients" });
    }
  });

  // Salary report send/generate endpoint.
  // - Current or future month: approval-gate flow (creates pending_approval run; admin-level only)
  // - Past month (historical): direct email send (admin-level only); no approval step needed
  app.post("/api/hr/reports/salary", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.body.year) || new Date().getFullYear();
      const month = parseInt(req.body.month) || new Date().getMonth() + 1;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const isPastMonth = year < currentYear || (year === currentYear && month < currentMonth);

      const report = await generateMonthlySalaryReport(year, month);

      if (isPastMonth) {
        // Historical month — send directly without requiring approval, but persist a "sent" run
        // so the history table reflects the action.
        const recipientsSetting = await storage.getSystemSetting("salary_report_recipients");
        const recipients = recipientsSetting?.value as { to: string[]; cc: string[] } | undefined;
        const emailResult = await sendSalaryReport({
          csvContent: report.csv,
          summary: report.summary,
          recipients,
        });
        if (!emailResult.success) {
          return res.status(500).json({ error: "Report generated but email failed to send" });
        }

        // Upsert a salary_report_runs record so the history table shows this send
        const existingHistorical = await db.select({ id: salaryReportRuns.id })
          .from(salaryReportRuns)
          .where(and(eq(salaryReportRuns.year, year), eq(salaryReportRuns.month, month)))
          .limit(1);

        const now2 = new Date();
        if (existingHistorical.length > 0) {
          await db.update(salaryReportRuns)
            .set({ status: "sent", reportData: report.rows as any, emailSentAt: now2, approvedBy: req.session.userId!, approvedAt: now2 })
            .where(eq(salaryReportRuns.id, existingHistorical[0].id));
        } else {
          await db.insert(salaryReportRuns).values({
            year,
            month,
            status: "sent",
            reportData: report.rows as any,
            adjustments: {} as any,
            emailSentAt: now2,
            approvedBy: req.session.userId!,
            approvedAt: now2,
          });
        }

        await storage.createAuditLog({
          action: "salary_report_sent_historical",
          actorId: req.session.userId!,
          changes: { year, month, employeeCount: report.rows.length },
        });
        return res.json({ success: true, summary: report.summary, requiresApproval: false });
      }

      // Current/future month — route through approval gate
      const existing = await db.select({ id: salaryReportRuns.id, status: salaryReportRuns.status })
        .from(salaryReportRuns)
        .where(and(eq(salaryReportRuns.year, year), eq(salaryReportRuns.month, month)))
        .limit(1);

      if (existing.length > 0 && existing[0].status === "approved") {
        return res.status(409).json({ error: "A report for this month has already been approved and sent." });
      }

      // Store snapshotted credit IDs so applyCreditsForRun can constrain to
      // only credits that were actually included in this run's gross-pay figure.
      const creditSnapshot = { __creditSnapshot__: report.salaryCreditIds };

      if (existing.length > 0) {
        await db.update(salaryReportRuns)
          .set({
            reportData: report.rows as any,
            adjustments: creditSnapshot as any,
            status: "pending_approval",
            generatedAt: new Date(),
            approvedAt: null,
            approvedBy: null,
            emailSentAt: null,
          })
          .where(eq(salaryReportRuns.id, existing[0].id));
        const [updated] = await db.select().from(salaryReportRuns).where(eq(salaryReportRuns.id, existing[0].id));
        return res.json({ success: true, run: updated, requiresApproval: true, summary: report.summary });
      }

      const [created] = await db.insert(salaryReportRuns).values({
        year,
        month,
        status: "pending_approval",
        reportData: report.rows as any,
        adjustments: creditSnapshot as any,
      }).returning();

      await storage.createAuditLog({
        action: "salary_report_generated",
        actorId: req.session.userId!,
        changes: { year, month, employeeCount: report.rows.length },
      });

      res.status(201).json({ success: true, run: created, requiresApproval: true, summary: report.summary });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate salary report run" });
    }
  });

  app.get("/api/hr/reports/salary/download", requireAuth, requirePermission("hr.reports.salary.download", "super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const report = await generateMonthlySalaryReport(year, month);
      const monthName = report.summary.monthName;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="Salary_Report_${monthName}_${year}.csv"`);
      res.send(report.csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to download salary report" });
    }
  });

  // ==========================================
  // SALARY REPORT RUNS (approval gate)
  // ==========================================

  // Count pending-approval runs (for nav badge)
  app.get("/api/hr/reports/salary/runs/pending-count", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
    try {
      const runs = await db.select({ id: salaryReportRuns.id })
        .from(salaryReportRuns)
        .where(eq(salaryReportRuns.status, "pending_approval"));
      res.json({ count: runs.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending count" });
    }
  });

  // List all runs (meta only, no full report data)
  app.get("/api/hr/reports/salary/runs", requireAuth, requirePermission("hr.reports.salary.runs", "super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const runs = await db.select({
        id: salaryReportRuns.id,
        year: salaryReportRuns.year,
        month: salaryReportRuns.month,
        status: salaryReportRuns.status,
        generatedAt: salaryReportRuns.generatedAt,
        approvedAt: salaryReportRuns.approvedAt,
        approvedBy: salaryReportRuns.approvedBy,
        emailSentAt: salaryReportRuns.emailSentAt,
        createdAt: salaryReportRuns.createdAt,
      }).from(salaryReportRuns)
        .orderBy(desc(salaryReportRuns.year), desc(salaryReportRuns.month));

      // Attach approver name
      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

      const enriched = runs.map(r => {
        const adjustedCount = 0; // We'll compute this per-run on the full fetch
        return {
          ...r,
          approverName: r.approvedBy ? (userMap.get(r.approvedBy) || null) : null,
          adjustedCount,
        };
      });

      // Fetch adjustment counts efficiently
      const fullRuns = await db.select({
        id: salaryReportRuns.id,
        adjustments: salaryReportRuns.adjustments,
      }).from(salaryReportRuns);
      const adjCountMap = new Map(fullRuns.map(r => [r.id, Object.keys((r.adjustments as Record<string, any>) || {}).length]));

      const result = enriched.map(r => ({ ...r, adjustedCount: adjCountMap.get(r.id) || 0 }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch salary runs" });
    }
  });

  // Get single run (full data including adjustments)
  app.get("/api/hr/reports/salary/runs/:id", requireAuth, requirePermission("hr.reports.salary.runs", "super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const [run] = await db.select().from(salaryReportRuns).where(eq(salaryReportRuns.id, req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });

      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

      res.json({
        ...run,
        approverName: run.approvedBy ? (userMap.get(run.approvedBy) || null) : null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch run" });
    }
  });

  // Manually generate a run for a given month (or refresh existing pending run)
  app.post("/api/hr/reports/salary/runs/generate", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.body.year) || new Date().getFullYear();
      const month = parseInt(req.body.month) || (new Date().getMonth() + 1);
      const overridePendingRegularizations: boolean = req.body.overridePendingRegularizations === true;
      const overrideReason: string = (req.body.overrideReason || "").trim();
      const overrideAttendanceApproval: boolean = req.body.overrideAttendanceApproval === true;
      const overrideAttendanceReason: string = (req.body.overrideAttendanceReason || "").trim();
      const actorId = req.session.userId!;
      const actorRole = req.session.role!;
      const canOverride = ["hr", "super_admin"].includes(actorRole);

      // Gate 1: attendance approval must be complete (approved or overridden) before salary run
      // HR/Super Admin may bypass with explicit overrideAttendanceApproval + mandatory reason
      const attRunRows = (await db.execute(sql`
        SELECT id, status FROM attendance_report_runs
        WHERE month = ${month} AND year = ${year}
        ORDER BY created_at DESC LIMIT 1
      `)).rows as any[];
      const attRun = attRunRows[0] ?? null;
      if (!attRun || (attRun.status !== "approved" && attRun.status !== "overridden")) {
        if (!canOverride) {
          return res.status(409).json({
            error: "Attendance approval incomplete",
            message: "All managers must approve the attendance report before a salary run can be generated. Go to Salary Reports → Attendance Approvals to trigger or override.",
            attendanceStatus: attRun?.status || "not_created",
          });
        }
        if (!overrideAttendanceApproval) {
          return res.status(409).json({
            error: "Attendance approval incomplete",
            message: "Attendance is not yet fully approved. As HR / Super Admin you can override — re-submit with overrideAttendanceApproval: true and a mandatory overrideAttendanceReason.",
            attendanceStatus: attRun?.status || "not_created",
            canOverride: true,
          });
        }
        if (!overrideAttendanceReason) {
          return res.status(400).json({ error: "overrideAttendanceReason is required when overriding attendance approval." });
        }
        // Audit-log the Gate 1 bypass
        await storage.createAuditLog({
          actorId,
          targetId: actorId,
          action: "salary_run_generated_with_unverified_attendance",
          changes: { year, month, attendanceStatus: attRun?.status || "not_created", overrideAttendanceReason },
        });
      }

      // Gate 2: pending regularizations must be zero (HR/Super Admin can override with mandatory reason)
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
      const pendingRegRows = (await db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM attendance_regularizations
        WHERE attendance_date >= ${monthStr + "-01"}
          AND attendance_date < ${nextMonth + "-01"}
          AND status = 'pending'
      `)).rows as any[];
      const pendingCount = parseInt(pendingRegRows[0]?.cnt ?? "0", 10);

      if (pendingCount > 0) {
        if (!canOverride) {
          return res.status(409).json({
            error: "Pending regularizations",
            message: `There are ${pendingCount} unresolved regularization request(s) for this month. All requests must be reviewed before generating the salary run.`,
            pendingRegularizations: pendingCount,
          });
        }
        if (!overridePendingRegularizations) {
          return res.status(409).json({
            error: "Pending regularizations",
            message: `There are ${pendingCount} unresolved regularization request(s). As HR/Super Admin you can override this gate — re-submit with overridePendingRegularizations: true and a mandatory overrideReason.`,
            pendingRegularizations: pendingCount,
            canOverride: true,
          });
        }
        if (!overrideReason) {
          return res.status(400).json({ error: "overrideReason is required when overriding pending regularizations." });
        }
        // Log the override in the audit trail
        await storage.createAuditLog({
          actorId,
          targetId: actorId,
          action: "salary_run_generated_with_pending_regularizations",
          changes: { year, month, pendingRegularizations: pendingCount, overrideReason },
        });
      }

      const report = await generateMonthlySalaryReport(year, month);

      const existing = await db.select({ id: salaryReportRuns.id, status: salaryReportRuns.status })
        .from(salaryReportRuns)
        .where(and(eq(salaryReportRuns.year, year), eq(salaryReportRuns.month, month)))
        .limit(1);

      // Build override metadata for durable persistence on the run record
      const overrideMeta: Record<string, any> = {};
      if (overrideAttendanceApproval && overrideAttendanceReason) {
        overrideMeta.attendanceApprovalOverride = {
          reason: overrideAttendanceReason,
          actorId,
          at: new Date().toISOString(),
        };
      }
      if (overridePendingRegularizations && overrideReason) {
        overrideMeta.pendingRegularizationsOverride = {
          reason: overrideReason,
          count: pendingCount,
          actorId,
          at: new Date().toISOString(),
        };
      }

      if (existing.length > 0) {
        if (existing[0].status === "approved") {
          return res.status(409).json({ error: "A report for this month has already been approved and sent. Cannot regenerate." });
        }
        await db.update(salaryReportRuns)
          .set({
            reportData: report.rows as any,
            adjustments: Object.keys(overrideMeta).length > 0 ? { _overrides: overrideMeta } as any : {} as any,
            status: "pending_approval",
            generatedAt: new Date(),
            approvedAt: null,
            approvedBy: null,
            emailSentAt: null,
          })
          .where(eq(salaryReportRuns.id, existing[0].id));
        const [updated] = await db.select().from(salaryReportRuns).where(eq(salaryReportRuns.id, existing[0].id));
        return res.json(updated);
      }

      const [created] = await db.insert(salaryReportRuns).values({
        year,
        month,
        status: "pending_approval",
        reportData: report.rows as any,
        adjustments: Object.keys(overrideMeta).length > 0 ? { _overrides: overrideMeta } as any : {} as any,
      }).returning();

      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate salary run" });
    }
  });

  // Save a row-level adjustment on a pending run
  app.patch("/api/hr/reports/salary/runs/:id/adjust", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
    try {
      const [run] = await db.select().from(salaryReportRuns).where(eq(salaryReportRuns.id, req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });
      if (run.status !== "pending_approval") return res.status(409).json({ error: "Only pending runs can be adjusted" });

      const { email, fields, comment } = req.body;
      if (!email || !fields || !comment?.trim()) {
        return res.status(400).json({ error: "email, fields, and comment are required" });
      }

      // Find the row in report data and update it
      const rows = (run.reportData as any[]) || [];
      const rowIdx = rows.findIndex((r: any) => r.email === email);
      if (rowIdx === -1) return res.status(404).json({ error: "Employee not found in this run" });

      const row = { ...rows[rowIdx] };
      const existingAdj = (run.adjustments as Record<string, any>) || {};

      // Snapshot the COMPLETE original row on first adjustment for this employee.
      // This allows atomic full restoration if the adjustment is later removed,
      // and provides all context (salary, workingDays, regionalHolidayDays, etc.)
      // needed for canonical recomputation.
      const originalRow: Record<string, any> = existingAdj[email]?.originalRow || { ...rows[rowIdx] };
      if (!existingAdj[email]) {
        // First time adjusting — deep-clone entire original row as the restoration baseline
        Object.assign(originalRow, rows[rowIdx]);
      }

      const allowed = ["presentDays", "absentDays", "paidLeaves", "lopLeaves", "deductions", "netPayable", "grossSalary", "totalHours"];
      const adjustmentFields: Record<string, { oldValue: number; newValue: number }> = {};

      for (const [field, newVal] of Object.entries(fields as Record<string, number>)) {
        if (!allowed.includes(field)) continue;
        // oldValue is always relative to the true original, not an intermediate edit
        adjustmentFields[field] = { oldValue: originalRow[field] ?? row[field], newValue: Number(newVal) };
        row[field] = Number(newVal);
      }

      // Canonical server-side recomputation — matches generateMonthlySalaryReport formula exactly:
      //   effectivePresentDays = presentDays + paidLeaves + regionalHolidayDays
      //   absentDays = max(0, workingDays - effectivePresentDays)
      //   deductions = absentDays * (grossSalary / workingDays)
      //   netPayable = max(0, grossSalary - deductions)
      const attendanceFieldsChanged = ["presentDays", "paidLeaves", "lopLeaves"].some(f => f in fields);
      const salaryFieldsChanged = ["grossSalary", "deductions"].some(f => f in fields);

      if (attendanceFieldsChanged) {
        const wDays = Number(row.workingDays) || 1;
        const gross = Number(row.grossSalary);
        const regionalHolidayDays = Number(row.regionalHolidayDays) || 0;
        const dailyRate = gross / wDays;
        // LOP leaves are NOT in effectivePresentDays — they become absent days naturally
        const effectivePresentDays = Number(row.presentDays) + Number(row.paidLeaves) + regionalHolidayDays;
        const newAbsentDays = Math.max(0, wDays - effectivePresentDays);
        const newDeductions = Math.round(newAbsentDays * dailyRate * 100) / 100;
        const advanceRecovery = Number(row.advanceRecovery) || 0;
        const newNetPayable = Math.max(0, Math.round((gross - newDeductions - advanceRecovery) * 100) / 100);
        const newAttendancePct = wDays > 0 ? Math.round((effectivePresentDays / wDays) * 100) : 0;

        const captureIfChanged = (field: string, newVal: number) => {
          if (row[field] !== newVal) {
            adjustmentFields[field] = { oldValue: originalRow[field] ?? rows[rowIdx][field], newValue: newVal };
            row[field] = newVal;
          }
        };

        captureIfChanged("absentDays", newAbsentDays);
        captureIfChanged("deductions", newDeductions);
        captureIfChanged("netPayable", newNetPayable);
        captureIfChanged("attendancePercentage", newAttendancePct);
      } else if (salaryFieldsChanged && !("netPayable" in fields)) {
        // grossSalary or deductions changed without explicit netPayable override — compute it
        const gross = Number(row.grossSalary);
        const ded = Number(row.deductions);
        const advanceRecovery = Number(row.advanceRecovery) || 0;
        const net = Math.max(0, Math.round((gross - ded - advanceRecovery) * 100) / 100);
        adjustmentFields["netPayable"] = { oldValue: originalRow["netPayable"] ?? rows[rowIdx].netPayable, newValue: net };
        row.netPayable = net;
      }

      rows[rowIdx] = row;

      existingAdj[email] = {
        employeeName: row.employeeName,
        email,
        comment: comment.trim(),
        originalRow,
        // Accumulate all field diffs across multiple edits — each field tracks true original vs. current
        fields: {
          ...(existingAdj[email]?.fields || {}),
          ...adjustmentFields,
        },
      };

      await db.update(salaryReportRuns)
        .set({ reportData: rows as any, adjustments: existingAdj as any })
        .where(eq(salaryReportRuns.id, req.params.id));

      res.json({ success: true, row: rows[rowIdx] });
    } catch (error) {
      res.status(500).json({ error: "Failed to save adjustment" });
    }
  });

  // Remove an adjustment from a pending run — atomically restores original row values
  app.delete("/api/hr/reports/salary/runs/:id/adjust/:email", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
    try {
      const [run] = await db.select().from(salaryReportRuns).where(eq(salaryReportRuns.id, req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });
      if (run.status !== "pending_approval") return res.status(409).json({ error: "Only pending runs can be adjusted" });

      const emailToRemove = decodeURIComponent(req.params.email);
      const existingAdj = (run.adjustments as Record<string, any>) || {};
      const adjEntry = existingAdj[emailToRemove];

      const rows = (run.reportData as any[]) || [];
      const rowIdx = rows.findIndex((r: any) => r.email === emailToRemove);

      // Atomically restore the COMPLETE original row snapshot captured at adjustment-creation time.
      // originalRow contains every field so nothing is left modified without an adjustment flag.
      if (adjEntry?.originalRow && rowIdx !== -1) {
        rows[rowIdx] = { ...adjEntry.originalRow };
      } else if (adjEntry?.originalValues && rowIdx !== -1) {
        // Backward-compat: older entries may still use originalValues subset
        const restoredRow = { ...rows[rowIdx] };
        for (const [field, val] of Object.entries(adjEntry.originalValues as Record<string, number>)) {
          restoredRow[field] = val;
        }
        rows[rowIdx] = restoredRow;
      }

      delete existingAdj[emailToRemove];

      await db.update(salaryReportRuns)
        .set({ reportData: rows as any, adjustments: existingAdj as any })
        .where(eq(salaryReportRuns.id, req.params.id));

      res.json({ success: true, restoredRow: rowIdx !== -1 ? rows[rowIdx] : null });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove adjustment" });
    }
  });

  // Approve and send a pending run
  app.post("/api/hr/reports/salary/runs/:id/approve", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
    try {
      const [run] = await db.select().from(salaryReportRuns).where(eq(salaryReportRuns.id, req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });
      if (run.status !== "pending_approval") return res.status(409).json({ error: "Only pending runs can be approved" });

      // Attendance gate: the attendance report for the same month/year must be approved or overridden
      const attRunRows = (await db.execute(
        sql`SELECT id, status FROM attendance_report_runs WHERE month = ${run.month} AND year = ${run.year} ORDER BY created_at DESC LIMIT 1`
      )).rows as any[];
      const attRunRow = attRunRows[0];
      const attStatus = attRunRow?.status ?? "none";
      if (!["approved", "overridden"].includes(attStatus)) {
        return res.status(400).json({
          error: "Attendance approval required",
          message: `The attendance report for this period must be approved before the salary run can be approved. Current attendance status: ${attStatus === "none" ? "no run created" : attStatus.replace(/_/g, " ")}.`,
          attendanceStatus: attStatus,
        });
      }

      const actorId = req.session.userId!;
      const rows = (run.reportData as any[]) || [];
      const rawAdjustments = (run.adjustments as Record<string, any>) || {};
      // Extract snapshotted credit IDs (stored at run-generation time) before
      // spreading into employee-keyed adjustments map.
      const snapshotCreditIds: string[] | undefined = rawAdjustments.__creditSnapshot__;
      // Build employee-keyed adjustments (exclude the reserved snapshot key).
      const adjustments: Record<string, SalaryReportAdjustment> = Object.fromEntries(
        Object.entries(rawAdjustments).filter(([k]) => k !== "__creditSnapshot__")
      ) as Record<string, SalaryReportAdjustment>;

      // Build summary from rows
      const totalPayable = rows.reduce((s: number, r: any) => s + Number(r.netPayable), 0);
      const totalDeductions = rows.reduce((s: number, r: any) => s + Number(r.deductions), 0);
      const totalHoursWorked = rows.reduce((s: number, r: any) => s + Number(r.totalHours), 0);
      const monthName = new Date(run.year, run.month - 1, 1).toLocaleString("en-US", { month: "long" });

      const summary = {
        year: run.year,
        month: run.month,
        monthName,
        totalEmployees: rows.length,
        totalPayable: Math.round(totalPayable * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
        generatedAt: (run.generatedAt || new Date()).toISOString(),
      };

      // Build CSV with ADJUSTED column
      const csvHeaders = [
        "Employee Name", "Email", "Designation", "Department", "Salary",
        "Working Days", "Present Days", "Absent Days", "Paid Leaves", "LOP Leaves (Unpaid)", "Holidays",
        "Total Hours", "Attendance %", "Gross Salary", "Deductions", "Net Payable",
        "ADJUSTED", "ADJUSTMENT_COMMENT",
      ];
      const csvRows = rows.map((r: any) => {
        const adj = adjustments[r.email];
        return [
          `"${r.employeeName}"`, `"${r.email}"`, `"${r.designation}"`, `"${r.department}"`,
          r.salary, r.workingDays, r.presentDays, r.absentDays, r.paidLeaves, r.lopLeaves, r.holidays,
          r.totalHours, r.attendancePercentage, r.grossSalary, r.deductions, r.netPayable,
          adj ? "Y" : "N", adj ? `"${adj.comment.replace(/"/g, '""')}"` : "",
        ].join(",");
      });
      const csv = [csvHeaders.join(","), ...csvRows].join("\n");

      const recipientsSetting = await storage.getSystemSetting("salary_report_recipients");
      const recipientsConfig = recipientsSetting?.value as { to: string[]; cc: string[] } | undefined;
      const toList = recipientsConfig?.to?.filter(Boolean) ?? [];
      const ccList = recipientsConfig?.cc?.filter(Boolean) ?? [];

      const now = new Date();
      let dispatched = false;
      let dispatchSkippedReason: string | null = null;

      if (toList.length === 0) {
        // No recipients configured — skip dispatch but continue to approve
        dispatchSkippedReason = "No recipients configured in salary_report_recipients setting";
        console.warn(`[salary_run:${run.id}] ${dispatchSkippedReason}`);
      } else {
        // Route through dispatchAutomatedEmail so CCC policy, hold-for-approval,
        // and audit logging are all respected automatically.
        const emailResult = await sendSalaryReportDispatch({
          runId: run.id,
          csvContent: csv,
          summary,
          recipients: { to: toList, cc: ccList },
          adjustments,
          rows,
        });

        if (!emailResult.success && !emailResult.held && !emailResult.disabled) {
          return res.status(500).json({ error: "Salary report email dispatch failed: " + emailResult.error });
        }
        dispatched = true;
      }

      await db.update(salaryReportRuns)
        .set({
          status: "approved",
          approvedAt: now,
          approvedBy: actorId,
          emailSentAt: dispatched ? now : null,
          dispatchedTo: dispatched ? ({ to: toList, cc: ccList } as any) : null,
          dispatchedAt: dispatched ? now : null,
        })
        .where(eq(salaryReportRuns.id, req.params.id));

      // Apply scheduled salary-advance recoveries for this run (idempotent: only
      // 'scheduled' repayments for this year/month are marked deducted).
      const allUsers = await storage.getAdminUsers();
      const userEmailMap = new Map(allUsers.map(u => [u.email, u.id]));
      let advancesRecovered = 0;
      try {
        advancesRecovered = await applyAdvanceRecoveriesForRun({
          year: run.year,
          month: run.month,
          salaryRunId: run.id,
          rows: rows.map((r: any) => ({ email: r.email, advanceRecovery: Number(r.advanceRecovery || 0) })),
          userEmailMap,
          actorId,
        });
      } catch (recErr) {
        console.error("Salary advance recovery failed during run approve:", recErr);
      }

      let creditsApplied = 0;
      try {
        creditsApplied = await applyCreditsForRun({
          year: run.year,
          month: run.month,
          salaryRunId: run.id,
          actorId,
          // Snapshot-safe: only mark credits that were actually included in this
          // run's gross-pay computation. snapshotCreditIds is undefined for
          // legacy runs (falls back to month/year query in applyCreditsForRun).
          creditIds: snapshotCreditIds,
        });
      } catch (credErr) {
        console.error("Salary credit apply failed during run approve:", credErr);
      }

      await storage.createAuditLog({
        action: "salary_report_approved",
        actorId,
        changes: { runId: run.id, year: run.year, month: run.month, adjustedRows: Object.keys(adjustments).length, dispatched, dispatchSkippedReason, advancesRecovered, creditsApplied },
      });

      res.json({ success: true, adjustedRows: Object.keys(adjustments).length, dispatched, dispatchSkippedReason, advancesRecovered });
    } catch (error) {
      console.error("Failed to approve salary run:", error);
      res.status(500).json({ error: "Failed to approve and send salary report" });
    }
  });

  // Employee-safe: list approved salary runs that contain the current user's email.
  // Accessible to all authenticated users (employees see their own months;
  // HR/admin see all via the existing runs list endpoint).
  app.get("/api/hr/salary-slips/my-runs", requireAuth, async (req: Request, res: Response) => {
    try {
      const actor = req.session.userId!;
      const actorRole = (req.session as any).role as string | undefined;
      const allUsers = await storage.getAdminUsers();
      const actorUser = allUsers.find(u => u.id === actor);
      if (!actorUser) return res.status(404).json({ error: "User not found" });

      // HR/admin/finance/super_admin get all approved runs
      if (["super_admin", "admin", "hr", "finance"].includes(actorRole ?? "")) {
        const runs = await db.select({
          id: salaryReportRuns.id,
          year: salaryReportRuns.year,
          month: salaryReportRuns.month,
          status: salaryReportRuns.status,
          approvedAt: salaryReportRuns.approvedAt,
        }).from(salaryReportRuns)
          .where(eq(salaryReportRuns.status, "approved"))
          .orderBy(desc(salaryReportRuns.approvedAt));
        return res.json(runs);
      }

      // Employees + managers: only runs containing their email in reportData
      const approvedRuns = await db.select({
        id: salaryReportRuns.id,
        year: salaryReportRuns.year,
        month: salaryReportRuns.month,
        status: salaryReportRuns.status,
        approvedAt: salaryReportRuns.approvedAt,
        reportData: salaryReportRuns.reportData,
      }).from(salaryReportRuns)
        .where(eq(salaryReportRuns.status, "approved"))
        .orderBy(desc(salaryReportRuns.approvedAt));

      const myEmail = actorUser.email ?? "";
      const myRuns = approvedRuns
        .filter(run => {
          const rows = (run.reportData as any[]) || [];
          return rows.some((r: any) => r.email === myEmail);
        })
        .map(({ reportData: _rd, ...rest }) => rest);

      res.json(myRuns);
    } catch (error) {
      console.error("Failed to fetch my salary runs:", error);
      res.status(500).json({ error: "Failed to fetch salary runs" });
    }
  });

  // On-demand salary slip render — finds the approved run for the period, builds the slip JSON,
  // writes a slim ledger row on first access (idempotent by run+user).
  app.get("/api/hr/salary-slips/render/:userId/:month/:year", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, month, year } = req.params;
      const m = parseInt(month);
      const y = parseInt(year);
      if (!m || !y || m < 1 || m > 12) return res.status(400).json({ error: "Invalid month or year" });

      // Access control:
      //   - Employees may only view their own slip.
      //   - Managers may view slips for their direct reports only (team-scoped).
      //   - HR / admin / finance / super_admin may view any slip.
      const actor = req.session.userId!;
      const actorRole = (req.session as any).role as string | undefined;
      const isPrivileged = ["super_admin", "admin", "hr", "finance"].includes(actorRole ?? "");
      const isManager = actorRole === "manager";
      if (!isPrivileged && actor !== userId) {
        if (isManager) {
          // Verify the target user is a direct report of the manager
          const directReports = await storage.getTeamMembers(actor);
          const isDirectReport = directReports.some(dr => dr.id === userId);
          if (!isDirectReport) {
            return res.status(403).json({ error: "Access denied: employee is not in your team" });
          }
        } else {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Find the latest approved run for this period
      const [approvedRun] = await db.select()
        .from(salaryReportRuns)
        .where(and(
          eq(salaryReportRuns.month, m),
          eq(salaryReportRuns.year, y),
          eq(salaryReportRuns.status, "approved"),
        ))
        .orderBy(desc(salaryReportRuns.approvedAt))
        .limit(1);

      if (!approvedRun) {
        return res.status(404).json({ error: "No approved salary run found for this period" });
      }

      const reportRows = (approvedRun.reportData as any[]) || [];
      const allUsers = await storage.getAdminUsers();
      const targetUser = allUsers.find(u => u.id === userId);
      if (!targetUser) return res.status(404).json({ error: "Employee not found" });

      const row = reportRows.find((r: any) => r.email === targetUser.email);
      if (!row) {
        return res.status(404).json({ error: "Employee not found in this salary run" });
      }

      const adjustments = (approvedRun.adjustments as Record<string, any>) || {};
      const adj = adjustments[targetUser.email ?? ""];

      const slipData = {
        userId,
        employeeName: row.employeeName,
        email: targetUser.email,
        designation: row.designation,
        department: row.department,
        year: y,
        month: m,
        salary: Number(row.salary),
        grossSalary: Number(row.grossSalary),
        deductions: Number(row.deductions),
        advanceRecovery: Number(row.advanceRecovery || 0),
        netPayable: Number(row.netPayable),
        workingDays: row.workingDays,
        presentDays: row.presentDays,
        absentDays: row.absentDays,
        paidLeaves: row.paidLeaves,
        lopLeaves: row.lopLeaves,
        totalHours: row.totalHours,
        attendancePercentage: row.attendancePercentage,
        adjusted: !!adj,
        adjustmentComment: adj?.comment ?? null,
        salaryRunId: approvedRun.id,
        approvedAt: approvedRun.approvedAt,
      };

      // Write / update ledger row on first access (idempotent per run+user)
      const [existingLedger] = await db.select().from(salarySlips)
        .where(and(
          eq(salarySlips.userId, userId),
          eq(salarySlips.year, y),
          eq(salarySlips.month, m),
          eq(salarySlips.salaryRunId, approvedRun.id),
        ))
        .limit(1);

      if (!existingLedger) {
        // Find max version for this user/month/year and increment
        const maxVersionRows = (await db.execute(
          sql`SELECT COALESCE(MAX(version), 0) AS max_ver FROM salary_slips WHERE user_id = ${userId} AND year = ${y} AND month = ${m}`
        )).rows as any[];
        const nextVersion = (Number(maxVersionRows[0]?.max_ver ?? 0)) + 1;

        await db.insert(salarySlips).values({
          userId,
          year: y,
          month: m,
          version: nextVersion,
          salaryRunId: approvedRun.id,
          basicSalary: String(row.salary),
          grossSalary: String(row.grossSalary),
          deductions: String(row.deductions),
          salaryAdvanceRecovery: String(row.advanceRecovery || 0),
          netPayable: String(row.netPayable),
          totalWorkingDays: row.workingDays,
          daysPresent: row.presentDays,
          daysAbsent: row.absentDays,
          approvedLeaves: String(row.paidLeaves),
          lopLeaves: String(row.lopLeaves),
          totalHours: String(row.totalHours),
          attendancePercentage: String(row.attendancePercentage),
          generatedBy: actor,
        });
      }

      res.json({ slip: slipData });
    } catch (error) {
      console.error("Failed to render salary slip:", error);
      res.status(500).json({ error: "Failed to render salary slip" });
    }
  });

  // Slip count for a run — how many employees in the run have ledger rows
  app.get("/api/hr/salary-slips/run-count/:runId", requireAuth, requirePermission("hr.salarySlips.view", "super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const [run] = await db.select().from(salaryReportRuns).where(eq(salaryReportRuns.id, runId));
      if (!run) return res.status(404).json({ error: "Run not found" });
      const totalEmployees = ((run.reportData as any[]) || []).length;
      const countRows = (await db.execute(
        sql`SELECT COUNT(*) AS cnt FROM salary_slips WHERE salary_run_id = ${runId}`
      )).rows as any[];
      const generated = Number(countRows[0]?.cnt ?? 0);
      res.json({ generated, total: totalEmployees });
    } catch (error) {
      res.status(500).json({ error: "Failed to get slip count" });
    }
  });

  // ==========================================
  // CENTRALIZED SALARY CHANGES (ledger + maker-checker)
  // ==========================================

  // History for one employee — includes every source (offer / addendum / manual /
  // advance). Visible to roles that can view team compensation.
  // Org-wide HR roles can act on any employee; managers are scoped to their own
  // direct reports. Used to guard all salary-change read/write endpoints.
  async function canAccessEmployeeSalary(actorId: string, role: string, employeeId: string): Promise<boolean> {
    if (["super_admin", "admin", "hr"].includes(role)) return true;
    if (role === "manager") {
      const team = await storage.getTeamMembers(actorId);
      return team.some(m => m.id === employeeId);
    }
    return false;
  }

  // Verify a proof document (offer letter / addendum) actually belongs to the
  // employee, so a manual change cannot be linked to an unrelated document.
  async function proofBelongsToEmployee(type: string, id: string, employeeId: string): Promise<boolean> {
    if (type === "offer_letter") {
      const offer = await storage.getOfferLetter(id);
      return !!offer && (offer as any).resultingUserId === employeeId;
    }
    if (type === "addendum") {
      const addendum = await storage.getAddendum(id);
      return !!addendum && (addendum as any).forEmployeeId === employeeId;
    }
    return false;
  }

  app.get("/api/hr/salary-changes", requireAuth, requirePermission("hr.salaryChanges.view", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const employeeId = (req.query.employeeId as string) || "";
      if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
      if (!(await canAccessEmployeeSalary(req.session.userId!, req.session.role || "", employeeId))) {
        return res.status(403).json({ error: "You can only view salary history for your direct reports" });
      }
      const rows = await storage.getSalaryChangesByEmployee(employeeId);
      // Enrich with actor names for the timeline.
      const ids = new Set<string>();
      for (const r of rows) { if (r.initiatedBy) ids.add(r.initiatedBy); if (r.approvedBy) ids.add(r.approvedBy); }
      const userMap: Record<string, any> = {};
      for (const id of ids) {
        const u = await storage.getAdminUser(id);
        if (u) userMap[id] = { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email };
      }
      res.json(rows.map(r => ({
        ...r,
        initiator: r.initiatedBy ? userMap[r.initiatedBy] || null : null,
        approver: r.approvedBy ? userMap[r.approvedBy] || null : null,
      })));
    } catch (error) {
      console.error("Failed to load salary changes:", error);
      res.status(500).json({ error: "Failed to load salary changes" });
    }
  });

  // Proof-document options for an employee (their offer letters + addendums) so a
  // manual change can be linked to supporting documentation.
  app.get("/api/hr/salary-changes/proof-options", requireAuth, requirePermission("hr.salaryChanges.manage", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const employeeId = (req.query.employeeId as string) || "";
      if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
      if (!(await canAccessEmployeeSalary(req.session.userId!, req.session.role || "", employeeId))) {
        return res.status(403).json({ error: "You can only manage salary for your direct reports" });
      }
      const [offers, addendums] = await Promise.all([storage.getOfferLetters(), storage.getAllAddendums()]);
      const offerOptions = offers
        .filter(o => (o as any).resultingUserId === employeeId)
        .map(o => ({ type: "offer_letter", id: o.id, label: `Offer • ${(o as any).referenceNumber || o.id}`, salary: (o as any).salary ?? null }));
      const addendumOptions = addendums
        .filter(a => (a as any).forEmployeeId === employeeId)
        .map(a => ({ type: "addendum", id: a.id, label: `Addendum • ${(a as any).addendumType || ""} ${(a as any).referenceNumber || a.id}`.trim(), salary: (a as any).newSalary ?? null }));
      res.json([...addendumOptions, ...offerOptions]);
    } catch (error) {
      console.error("Failed to load proof options:", error);
      res.status(500).json({ error: "Failed to load proof options" });
    }
  });

  // Pending manual changes awaiting Super-Admin approval (maker-checker queue).
  app.get("/api/hr/salary-changes/pending", requireAuth, requirePermission("hr.salaryChanges.approve", "super_admin"), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.getPendingSalaryChanges();
      const ids = new Set<string>();
      for (const r of rows) { ids.add(r.employeeId); if (r.initiatedBy) ids.add(r.initiatedBy); }
      const userMap: Record<string, any> = {};
      for (const id of ids) {
        const u = await storage.getAdminUser(id);
        if (u) userMap[id] = { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email };
      }
      res.json(rows.map(r => ({
        ...r,
        employee: userMap[r.employeeId] || null,
        initiator: r.initiatedBy ? userMap[r.initiatedBy] || null : null,
      })));
    } catch (error) {
      console.error("Failed to load pending salary changes:", error);
      res.status(500).json({ error: "Failed to load pending salary changes" });
    }
  });

  app.get("/api/hr/salary-changes/pending-count", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.session.role !== "super_admin") return res.json({ count: 0 });
      res.json({ count: await storage.countPendingSalaryChanges() });
    } catch {
      res.json({ count: 0 });
    }
  });

  // Initiate a manual salary change. Super-admins apply immediately; everyone
  // else creates a pending request that a super-admin must approve.
  app.post("/api/hr/salary-changes", requireAuth, requirePermission("hr.salaryChanges.manage", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        employeeId: z.string().min(1, "Employee is required"),
        newSalary: z.number().positive("Salary must be greater than zero"),
        effectiveDate: z.string().min(1, "Effective date is required"),
        reason: z.string().min(5, "Please provide a reason (at least 5 characters)"),
        proofDocumentType: z.enum(["offer_letter", "addendum"], { required_error: "A linked proof document is required" }),
        proofDocumentId: z.string().min(1, "A linked proof document is required"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", errors: parsed.error.errors });

      const actorId = req.session.userId!;
      const role = req.session.role || "";
      const { employeeId, newSalary, effectiveDate, reason, proofDocumentType, proofDocumentId } = parsed.data;

      const employee = await storage.getAdminUser(employeeId);
      if (!employee) return res.status(404).json({ error: "Employee not found" });

      // Managers may only change pay for their own direct reports.
      if (!(await canAccessEmployeeSalary(actorId, role, employeeId))) {
        return res.status(403).json({ error: "You can only manage salary for your direct reports" });
      }

      // The linked proof must genuinely belong to this employee (offer resulting
      // user / addendum subject) — prevents attaching an unrelated document.
      const validProof = await proofBelongsToEmployee(proofDocumentType, proofDocumentId, employeeId);
      if (!validProof) return res.status(400).json({ error: "The linked proof document does not belong to this employee" });
      const oldSalary = employee.salary != null ? Number(employee.salary) : null;
      const newSalaryRounded = Math.round(newSalary * 100) / 100;

      if (role === "super_admin") {
        // Maker == checker authority: apply immediately via the centralized helper.
        const { recordSalaryChange } = await import("./salaryLedger");
        await recordSalaryChange({
          employeeId,
          newSalary: newSalaryRounded,
          sourceType: "manual",
          sourceDocumentType: proofDocumentType || null,
          sourceDocumentId: proofDocumentId || null,
          reason,
          effectiveDate,
          initiatedBy: actorId,
          approvedBy: actorId,
          apply: true,
        });
        await storage.createAuditLog({ action: "salary_change_applied", actorId, changes: { employeeId, oldSalary, newSalary: newSalaryRounded, source: "manual" } });
        return res.status(201).json({ status: "applied" });
      }

      // Maker-checker: create a pending change for Super-Admin approval.
      const created = await storage.createSalaryChange({
        employeeId,
        sourceType: "manual",
        sourceDocumentType: proofDocumentType || null,
        sourceDocumentId: proofDocumentId || null,
        oldSalary: oldSalary != null ? oldSalary.toFixed(2) : null,
        newSalary: newSalaryRounded.toFixed(2),
        amount: null,
        effectiveDate,
        reason,
        status: "pending_approval",
        initiatedBy: actorId,
      } as any);
      await storage.createAuditLog({ action: "salary_change_requested", actorId, changes: { employeeId, oldSalary, newSalary: newSalaryRounded, changeId: created.id } });

      // Notify super admins of the pending approval.
      try {
        const flagsSetting = await storage.getSystemSetting("feature_flags");
        const flags = (flagsSetting?.value as Record<string, any>) || {};
        if (flags.notifications_enabled !== false) {
          const users = await storage.getAdminUsers();
          for (const u of users.filter(x => x.role === "super_admin" && x.isActive)) {
            await storage.createNotification({
              userId: u.id,
              type: "salary_change_pending",
              title: "Salary change needs approval",
              message: `A salary change for ${employee.firstName} ${employee.lastName} awaits your approval.`,
              metadata: { link: "/admin/hr/people?tab=salary-approvals" },
            } as any);
          }
        }
      } catch { /* best-effort */ }

      res.status(201).json({ status: "pending_approval", id: created.id });
    } catch (error) {
      console.error("Failed to create salary change:", error);
      res.status(500).json({ error: "Failed to create salary change" });
    }
  });

  // Super-Admin approves a pending manual change — applies it to the employee.
  app.post("/api/hr/salary-changes/:id/approve", requireAuth, requirePermission("hr.salaryChanges.approve", "super_admin"), async (req: Request, res: Response) => {
    try {
      const change = await storage.getSalaryChange(req.params.id);
      if (!change) return res.status(404).json({ error: "Not found" });
      if (change.status !== "pending_approval") return res.status(400).json({ error: "This change is not pending approval." });

      const actorId = req.session.userId!;
      const employee = await storage.getAdminUser(change.employeeId);
      if (!employee) return res.status(404).json({ error: "Employee not found" });

      // Re-read the current salary at apply time so the recorded old value is accurate.
      const oldSalary = employee.salary != null ? Number(employee.salary) : null;
      const newSalary = change.newSalary != null ? Number(change.newSalary) : null;
      if (newSalary == null) return res.status(400).json({ error: "Change has no target salary." });

      // Honour the effective date: only write the live salary if the change is in
      // effect today. Future-dated changes become "applied" in the ledger but are
      // promoted to admin_users.salary by applyDueSalaryChanges() when due
      // (appliedAt stays NULL until then). The salary report reads the ledger by
      // effective date, so reporting stays correct in the meantime.
      const today = new Date().toISOString().slice(0, 10);
      const writeNow = !change.effectiveDate || change.effectiveDate <= today;
      if (writeNow) {
        await storage.updateAdminUser(change.employeeId, { salary: newSalary.toFixed(2) } as any);
      }
      const updated = await storage.updateSalaryChange(change.id, {
        status: "applied",
        oldSalary: oldSalary != null ? oldSalary.toFixed(2) : change.oldSalary,
        approvedBy: actorId,
        appliedAt: writeNow ? new Date() : null,
      } as any);
      await storage.createAuditLog({ action: "salary_change_approved", actorId, changes: { changeId: change.id, employeeId: change.employeeId, oldSalary, newSalary } });

      try {
        const flagsSetting = await storage.getSystemSetting("feature_flags");
        const flags = (flagsSetting?.value as Record<string, any>) || {};
        if (flags.notifications_enabled !== false && change.initiatedBy) {
          await storage.createNotification({
            userId: change.initiatedBy,
            type: "salary_change_approved",
            title: "Salary change approved",
            message: `Your salary change for ${employee.firstName} ${employee.lastName} was approved and applied.`,
            metadata: null,
          } as any);
        }
      } catch { /* best-effort */ }

      res.json(updated);
    } catch (error) {
      console.error("Failed to approve salary change:", error);
      res.status(500).json({ error: "Failed to approve salary change" });
    }
  });

  // Super-Admin rejects a pending manual change.
  app.post("/api/hr/salary-changes/:id/reject", requireAuth, requirePermission("hr.salaryChanges.approve", "super_admin"), async (req: Request, res: Response) => {
    try {
      const change = await storage.getSalaryChange(req.params.id);
      if (!change) return res.status(404).json({ error: "Not found" });
      if (change.status !== "pending_approval") return res.status(400).json({ error: "This change is not pending approval." });

      const schema = z.object({ reason: z.string().min(1, "A rejection reason is required") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A rejection reason is required" });

      const actorId = req.session.userId!;
      const updated = await storage.updateSalaryChange(change.id, {
        status: "rejected",
        approvedBy: actorId,
        rejectionReason: parsed.data.reason,
      } as any);
      await storage.createAuditLog({ action: "salary_change_rejected", actorId, changes: { changeId: change.id, employeeId: change.employeeId, reason: parsed.data.reason } });

      try {
        const flagsSetting = await storage.getSystemSetting("feature_flags");
        const flags = (flagsSetting?.value as Record<string, any>) || {};
        if (flags.notifications_enabled !== false && change.initiatedBy) {
          await storage.createNotification({
            userId: change.initiatedBy,
            type: "salary_change_rejected",
            title: "Salary change rejected",
            message: `Your salary change request was rejected: ${parsed.data.reason}`,
            metadata: null,
          } as any);
        }
      } catch { /* best-effort */ }

      res.json(updated);
    } catch (error) {
      console.error("Failed to reject salary change:", error);
      res.status(500).json({ error: "Failed to reject salary change" });
    }
  });

  // ==========================================
  // SALARY SLIPS
  // ==========================================

  app.get("/api/hr/salary-slips/my", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const slips = await storage.getSalarySlipsByUser(userId, year);
      res.json(slips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch salary slips" });
    }
  });

  app.get("/api/hr/salary-slips/my/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const slip = await storage.getSalarySlip(req.params.id);
      if (!slip || slip.userId !== req.session.userId) {
        return res.status(404).json({ error: "Salary slip not found" });
      }
      const user = await storage.getAdminUser(slip.userId);
      const allDepts = await storage.getDepartments();
      const dept = allDepts.find(d => d.id === user?.departmentId);
      res.json({ ...slip, user, department: dept });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch salary slip" });
    }
  });

  app.post("/api/hr/salary-slips/generate", requireAuth, requirePermission("hr.salarySlips.generate", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.body.year) || new Date().getFullYear();
      const month = parseInt(req.body.month) || new Date().getMonth() + 1;

      const existing = await storage.getSalarySlipsByMonth(year, month);
      if (existing.length > 0) {
        return res.status(400).json({ error: `Salary slips already generated for ${month}/${year}. ${existing.length} slips exist.` });
      }

      const report = await generateMonthlySalaryReport(year, month);
      const generatedBy = req.session.userId!;
      let created = 0;

      const allUsers = await storage.getAdminUsers();
      const userEmailMap = new Map(allUsers.map(u => [u.email, u.id]));

      for (const row of report.rows) {
        const userId = userEmailMap.get(row.email);
        if (!userId) continue;
        await storage.createSalarySlip({
          userId,
          year,
          month,
          basicSalary: String(row.salary),
          grossSalary: String(row.grossSalary),
          deductions: String(row.deductions),
          salaryAdvanceRecovery: String(row.advanceRecovery || 0),
          netPayable: String(row.netPayable),
          totalWorkingDays: row.workingDays,
          daysPresent: row.presentDays,
          daysAbsent: row.absentDays,
          approvedLeaves: String(row.paidLeaves),
          lopLeaves: String(row.lopLeaves),
          totalHours: String(row.totalHours),
          attendancePercentage: String(row.attendancePercentage),
          generatedBy,
        });
        created++;
      }

      res.json({ success: true, created, month, year });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate salary slips" });
    }
  });

  // Salary slip regeneration (replace existing slips for a month)
  app.post("/api/hr/salary-slips/regenerate", requireAuth, requirePermission("hr.salarySlips.regenerate", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const { month, year, userIds, dryRun } = req.body;
      const m = parseInt(month);
      const y = parseInt(year);
      if (!m || !y || m < 1 || m > 12) {
        return res.status(400).json({ error: "Valid month and year are required" });
      }

      const report = await generateMonthlySalaryReport(y, m);
      const allUsers = await storage.getAdminUsers();
      const userEmailMap = new Map(allUsers.map(u => [u.email, u.id]));
      const userNameMap = new Map(allUsers.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

      const existingSlips = await storage.getSalarySlipsByMonth(y, m);
      const existingByUser = new Map(existingSlips.map(s => [s.userId, s]));

      const scopedUserIds = Array.isArray(userIds) && userIds.length > 0 ? new Set<string>(userIds) : null;

      const diff: Array<{
        userId: string;
        name: string;
        email: string;
        oldNetPayable: number | null;
        newNetPayable: number;
        oldLopLeaves: number | null;
        newLopLeaves: number;
        changed: boolean;
      }> = [];

      const slipsToUpsert: Array<Parameters<typeof storage.upsertSalarySlip>[0]> = [];
      const generatedBy = req.session.userId!;

      for (const row of report.rows) {
        const userId = userEmailMap.get(row.email);
        if (!userId) continue;
        if (scopedUserIds && !scopedUserIds.has(userId)) continue;

        const existing = existingByUser.get(userId);
        const oldNet = existing ? parseFloat(String(existing.netPayable)) : null;
        const oldLop = existing ? parseFloat(String(existing.lopLeaves ?? 0)) : null;
        const changed = oldNet === null || Math.abs(oldNet - row.netPayable) > 0.01 || Math.abs((oldLop ?? 0) - row.lopLeaves) > 0.01;

        diff.push({
          userId,
          name: userNameMap.get(userId) ?? row.employeeName,
          email: row.email,
          oldNetPayable: oldNet,
          newNetPayable: row.netPayable,
          oldLopLeaves: oldLop,
          newLopLeaves: row.lopLeaves,
          changed,
        });

        slipsToUpsert.push({
          userId,
          year: y,
          month: m,
          basicSalary: String(row.salary),
          grossSalary: String(row.grossSalary),
          deductions: String(row.deductions),
          salaryAdvanceRecovery: String(row.advanceRecovery || 0),
          netPayable: String(row.netPayable),
          totalWorkingDays: row.workingDays,
          daysPresent: row.presentDays,
          daysAbsent: row.absentDays,
          approvedLeaves: String(row.paidLeaves),
          lopLeaves: String(row.lopLeaves),
          totalHours: String(row.totalHours),
          attendancePercentage: String(row.attendancePercentage),
          generatedBy,
        });
      }

      if (dryRun) {
        return res.json({ dryRun: true, diff, totalEmployees: diff.length, changedCount: diff.filter(d => d.changed).length });
      }

      // Find the latest approved salary run for this period (to link ledger rows)
      const [approvedRun] = await db.select()
        .from(salaryReportRuns)
        .where(and(
          eq(salaryReportRuns.month, m),
          eq(salaryReportRuns.year, y),
          eq(salaryReportRuns.status, "approved"),
        ))
        .orderBy(desc(salaryReportRuns.approvedAt))
        .limit(1);

      let upsertedCount = 0;
      for (const slip of slipsToUpsert) {
        // Insert a new version row instead of overwriting
        const maxVersionRows = (await db.execute(
          sql`SELECT COALESCE(MAX(version), 0) AS max_ver FROM salary_slips WHERE user_id = ${slip.userId} AND year = ${y} AND month = ${m}`
        )).rows as any[];
        const nextVersion = (Number(maxVersionRows[0]?.max_ver ?? 0)) + 1;
        await db.insert(salarySlips).values({
          ...slip,
          version: nextVersion,
          salaryRunId: approvedRun?.id ?? null,
        });
        upsertedCount++;
      }

      await storage.createAuditLog({
        actorId: generatedBy,
        targetId: generatedBy,
        action: "salary_slips_regenerated",
        changes: { month: m, year: y, upsertedCount, scopedUserIds: userIds || null },
      });

      res.json({ success: true, upsertedCount, diff, month: m, year: y });
    } catch (error) {
      console.error("Salary slip regeneration error:", error);
      res.status(500).json({ error: "Failed to regenerate salary slips" });
    }
  });

  // ==========================================
  // LEAVE BALANCE ADJUSTMENTS
  // ==========================================

  app.post("/api/hr/leave-balances/adjust", requireAuth, requirePermission("hr.leaveBalances.adjust", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const { userId, leaveTypeId, adjustmentDays, reason, year } = req.body;
      if (!userId || !leaveTypeId || !adjustmentDays || !reason || !year) {
        return res.status(400).json({ error: "Missing required fields: userId, leaveTypeId, adjustmentDays, reason, year" });
      }

      const balances = await storage.getLeaveBalances(userId, year);
      let balance = balances.find(b => b.leaveTypeId === leaveTypeId);

      if (!balance) {
        await storage.initLeaveBalances(userId, year);
        const refreshed = await storage.getLeaveBalances(userId, year);
        balance = refreshed.find(b => b.leaveTypeId === leaveTypeId);
      }

      if (!balance) {
        return res.status(404).json({ error: "Leave balance not found for this user and leave type" });
      }

      const newTotal = Number(balance.totalDays) + Number(adjustmentDays);

      // Wrap all three writes atomically: balance, audit record, and accrual durability row.
      let adjustment: any;
      await db.transaction(async (tx) => {
        await tx.update(leaveBalances)
          .set({ totalDays: String(Math.max(0, newTotal)), updatedAt: new Date() })
          .where(eq(leaveBalances.id, balance!.id));

        [adjustment] = await tx.insert(leaveAdjustments).values({
          userId,
          leaveTypeId,
          adjustmentDays: String(adjustmentDays),
          reason,
          year,
          adjustedBy: req.session.userId!,
        }).returning();

        // Upsert a hr_adjustment row into leave_accruals (month=0 sentinel, distinct from
        // year_end_carry_forward which also uses month=0 but has a different accrual_type)
        // so this adjustment survives any future backfill recalculation. ON CONFLICT
        // accumulates the delta into the existing row to respect the unique constraint on
        // (user_id, leave_type_id, year, month, accrual_type).
        await tx.insert(leaveAccruals).values({
          userId,
          leaveTypeId,
          year,
          month: 0,
          accruedDays: String(adjustmentDays),
          hoursWorked: "0",
          qualified: true,
          accrualType: "hr_adjustment",
          skipReason: `HR manual adjustment: ${reason}`,
        }).onConflictDoUpdate({
          target: [leaveAccruals.userId, leaveAccruals.leaveTypeId, leaveAccruals.year, leaveAccruals.month, leaveAccruals.accrualType],
          set: {
            accruedDays: sql`leave_accruals.accrued_days + EXCLUDED.accrued_days`,
            skipReason: sql`EXCLUDED.skip_reason`,
          },
        });
      });

      res.json({ success: true, adjustment, newBalance: Math.max(0, newTotal) });
    } catch (error) {
      res.status(500).json({ error: "Failed to adjust leave balance" });
    }
  });

  app.post("/api/hr/leave-balances/bulk-adjust", requireAuth, requirePermission("hr.leaveBalances.bulkAdjust", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const { userIds, leaveTypeId, adjustmentDays, reason, year } = req.body;
      if (!userIds?.length || !leaveTypeId || !adjustmentDays || !reason || !year) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let adjusted = 0;
      let failed = 0;

      for (const userId of userIds) {
        try {
          const balances = await storage.getLeaveBalances(userId, year);
          let balance = balances.find(b => b.leaveTypeId === leaveTypeId);

          if (!balance) {
            await storage.initLeaveBalances(userId, year);
            const refreshed = await storage.getLeaveBalances(userId, year);
            balance = refreshed.find(b => b.leaveTypeId === leaveTypeId);
          }

          if (balance) {
            const newTotal = Number(balance.totalDays) + Number(adjustmentDays);
            // Wrap all three writes atomically for each user.
            await db.transaction(async (tx) => {
              await tx.update(leaveBalances)
                .set({ totalDays: String(Math.max(0, newTotal)), updatedAt: new Date() })
                .where(eq(leaveBalances.id, balance!.id));
              await tx.insert(leaveAdjustments).values({
                userId,
                leaveTypeId,
                adjustmentDays: String(adjustmentDays),
                reason,
                year,
                adjustedBy: req.session.userId!,
              });
              // Upsert hr_adjustment in leave_accruals (month=0 sentinel) — ON CONFLICT
              // accumulates delta so the unique constraint is never violated even when the
              // same user receives multiple adjustments for the same year.
              await tx.insert(leaveAccruals).values({
                userId,
                leaveTypeId,
                year,
                month: 0,
                accruedDays: String(adjustmentDays),
                hoursWorked: "0",
                qualified: true,
                accrualType: "hr_adjustment",
                skipReason: `HR manual adjustment: ${reason}`,
              }).onConflictDoUpdate({
                target: [leaveAccruals.userId, leaveAccruals.leaveTypeId, leaveAccruals.year, leaveAccruals.month, leaveAccruals.accrualType],
                set: {
                  accruedDays: sql`leave_accruals.accrued_days + EXCLUDED.accrued_days`,
                  skipReason: sql`EXCLUDED.skip_reason`,
                },
              });
            });
            adjusted++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      res.json({ success: true, adjusted, failed });
    } catch (error) {
      res.status(500).json({ error: "Failed to bulk adjust leave balances" });
    }
  });

  app.get("/api/hr/leave-adjustments", requireAuth, requirePermission("hr.leaveAdjustments", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string | undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const adjustments = await storage.getLeaveAdjustments({ userId, year });

      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const leaveTypesList = await storage.getLeaveTypes();
      const ltMap = new Map(leaveTypesList.map(lt => [lt.id, lt]));

      const enriched = adjustments.map(a => ({
        ...a,
        userName: userMap.has(a.userId) ? `${userMap.get(a.userId)!.firstName} ${userMap.get(a.userId)!.lastName}` : "Unknown",
        leaveTypeName: ltMap.get(a.leaveTypeId)?.name || "Unknown",
        adjustedByName: userMap.has(a.adjustedBy) ? `${userMap.get(a.adjustedBy)!.firstName} ${userMap.get(a.adjustedBy)!.lastName}` : "Unknown",
      }));

      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave adjustments" });
    }
  });

  // ==========================================
  // EMPLOYEE DOCUMENTS
  // ==========================================

  app.get("/api/hr/my-documents", requireAuth, async (req: Request, res: Response) => {
    try {
      let docs = await storage.getEmployeeDocuments(req.session.userId!);
      if (!docs || docs.length === 0) {
        const currentUser = await storage.getAdminUser(req.session.userId!);
        await storage.initializeEmployeeDocuments(req.session.userId!, currentUser?.employeeCategory ?? "experienced");
        docs = await storage.getEmployeeDocuments(req.session.userId!);
      }
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.patch("/api/hr/my-documents/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const doc = await storage.getEmployeeDocument(req.params.id);
      if (!doc || doc.userId !== req.session.userId) {
        return res.status(404).json({ error: "Document not found" });
      }
      const { fileName, fileUrl, fileSize } = req.body;
      const updated = await storage.updateEmployeeDocument(req.params.id, {
        fileName,
        fileUrl,
        fileSize,
        status: "uploaded",
        uploadedAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  app.get("/api/hr/my-bank-details", requireAuth, async (req: Request, res: Response) => {
    try {
      const details = await storage.getBankDetails(req.session.userId!);
      res.json(details || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bank details" });
    }
  });

  app.post("/api/hr/my-bank-details", requireAuth, async (req: Request, res: Response) => {
    try {
      const { accountNumber, ifscCode, bankName, branchName } = req.body;
      const result = await storage.upsertBankDetails({
        userId: req.session.userId!,
        accountNumber: accountNumber || null,
        ifscCode: ifscCode || null,
        bankName: bankName || null,
        branchName: branchName || null,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to save bank details" });
    }
  });

  app.get("/api/hr/my-emergency-contacts", requireAuth, async (req: Request, res: Response) => {
    try {
      const contacts = await storage.getEmergencyContacts(req.session.userId!);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch emergency contacts" });
    }
  });

  app.post("/api/hr/my-emergency-contacts", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, relationship, phone, email, address, isPrimary } = req.body;
      const contact = await storage.createEmergencyContact({
        userId: req.session.userId!,
        name,
        relationship,
        phone,
        email: email || null,
        address: address || null,
        isPrimary: isPrimary || false,
      });
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to create emergency contact" });
    }
  });

  app.patch("/api/hr/my-emergency-contacts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getEmergencyContacts(req.session.userId!);
      const contact = existing.find(c => c.id === req.params.id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      const updated = await storage.updateEmergencyContact(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update emergency contact" });
    }
  });

  app.delete("/api/hr/my-emergency-contacts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getEmergencyContacts(req.session.userId!);
      const contact = existing.find(c => c.id === req.params.id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      await storage.deleteEmergencyContact(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete emergency contact" });
    }
  });

  // HR Document Management routes
  app.get("/api/hr/employee-documents/:userId", requireAuth, requirePermission("hr.employeeDocuments", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const docs = await storage.getEmployeeDocuments(req.params.userId);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee documents" });
    }
  });

  app.patch("/api/hr/employee-documents/:id/verify", requireAuth, requirePermission("hr.employeeDocuments.verify", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const { status, remarks } = req.body;
      if (!["verified", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'verified' or 'rejected'" });
      }
      const updated = await storage.updateEmployeeDocument(req.params.id, {
        status,
        remarks: remarks || null,
        verifiedBy: req.session.userId!,
        verifiedAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to verify document" });
    }
  });

  app.get("/api/hr/document-compliance", requireAuth, requirePermission("hr.documentCompliance", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const allDocs = await storage.getAllEmployeeDocuments();
      const allUsers = await storage.getAdminUsers();
      const depts = await storage.getDepartments();
      const deptMap = new Map(depts.map(d => [d.id, d.name]));

      const userDocMap: Record<string, { user: any; docs: any[]; requiredTotal: number; requiredUploaded: number; requiredVerified: number }> = {};

      for (const user of allUsers.filter(u => u.isActive)) {
        userDocMap[user.id] = {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            employeeId: user.employeeId,
            department: user.departmentId ? deptMap.get(user.departmentId) || null : null,
            employeeCategory: user.employeeCategory || "experienced",
          },
          docs: [],
          requiredTotal: 0,
          requiredUploaded: 0,
          requiredVerified: 0,
        };
      }

      for (const doc of allDocs) {
        if (userDocMap[doc.userId]) {
          userDocMap[doc.userId].docs.push(doc);
          if (doc.isRequired) {
            userDocMap[doc.userId].requiredTotal++;
            if (doc.status === "uploaded" || doc.status === "verified") {
              userDocMap[doc.userId].requiredUploaded++;
            }
            if (doc.status === "verified") {
              userDocMap[doc.userId].requiredVerified++;
            }
          }
        }
      }

      const report = Object.values(userDocMap);
      const totalEmployees = report.length;
      const fullyCompliant = report.filter(r => r.requiredTotal > 0 && r.requiredUploaded === r.requiredTotal).length;
      const pendingDocs = report.filter(r => r.requiredTotal > 0 && r.requiredUploaded < r.requiredTotal).length;
      const noDocs = report.filter(r => r.requiredTotal === 0).length;

      res.json({
        summary: { totalEmployees, fullyCompliant, pendingDocs, noDocs },
        employees: report,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch compliance report" });
    }
  });

  app.post("/api/hr/employee-documents/initialize/:userId", requireAuth, requirePermission("hr.employeeDocuments.initialize", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const existing = await storage.getEmployeeDocuments(req.params.userId);
      if (existing.length > 0) {
        return res.status(400).json({ error: "Documents already initialized for this user" });
      }
      const user = await storage.getAdminUser(req.params.userId);
      const docs = await storage.initializeEmployeeDocuments(req.params.userId, user?.employeeCategory ?? "experienced");
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to initialize documents" });
    }
  });

  app.patch("/api/hr/employee-documents/:id/toggle-required", requireAuth, requirePermission("hr.employeeDocuments.toggleRequired", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const doc = await storage.getEmployeeDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      const updated = await storage.updateEmployeeDocument(req.params.id, { isRequired: !doc.isRequired });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle required status" });
    }
  });

  app.post("/api/hr/employee-documents/send-reminder/:userId", requireAuth, requirePermission("hr.employeeDocuments.sendReminder", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const user = await storage.getAdminUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const docs = await storage.getEmployeeDocuments(req.params.userId);
      const pendingDocs = docs.filter(d => d.isRequired && d.status === "pending");

      const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
      const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
      const emailEnabled = featureFlags.document_reminder_email_enabled === true;

      if (emailEnabled) {
        const emailResult = await sendDocumentReminderEmail({
          to: user.email,
          firstName: user.firstName,
          pendingDocuments: pendingDocs.map(d => d.documentType),
        });

        if (!emailResult.success) {
          console.error(`Document reminder email failed for user ${req.params.userId}:`, emailResult.error);
          return res.status(500).json({ error: "Failed to send reminder email" });
        }
      }

      const notificationsEnabled = featureFlags.notifications_enabled === true;
      if (notificationsEnabled && emailEnabled) {
        await storage.createNotification({
          userId: req.params.userId,
          type: "document_reminder",
          title: "Document Reminder",
          message: `You have ${pendingDocs.length} pending document(s) to upload.`,
          isRead: false,
          metadata: { pendingDocuments: pendingDocs.map(d => d.documentType) },
        });
      }

      const actions = [];
      if (emailEnabled) actions.push("email sent");
      if (notificationsEnabled && emailEnabled) actions.push("notification created");
      const message = actions.length > 0
        ? `Reminder sent (${actions.join(", ")})`
        : "Reminder acknowledged (no delivery channels enabled)";
      res.json({ success: true, message });
    } catch (error) {
      console.error("Send reminder error:", error);
      res.status(500).json({ error: "Failed to send reminder" });
    }
  });

  // Employee bank details (HR view)
  app.get("/api/hr/employee-bank-details/:userId", requireAuth, requirePermission("hr.employeeBankDetails", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const details = await storage.getBankDetails(req.params.userId);
      res.json(details || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bank details" });
    }
  });

  // Employee emergency contacts (HR view)
  app.get("/api/hr/employee-emergency-contacts/:userId", requireAuth, requirePermission("hr.employeeEmergencyContacts", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const contacts = await storage.getEmergencyContacts(req.params.userId);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch emergency contacts" });
    }
  });

  // HR Tools: Admin fetch salary slips for any user
  app.get("/api/hr/admin/salary-slips/:userId", requireAuth, requirePermission("hr.admin.salarySlips", "super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const slips = await storage.getSalarySlipsByUser(req.params.userId);
      res.json(slips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch salary slips" });
    }
  });

  app.get("/api/hr/admin/salary-slip/:id", requireAuth, requirePermission("hr.admin.salarySlip", "super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const slip = await storage.getSalarySlip(req.params.id);
      if (!slip) {
        return res.status(404).json({ error: "Salary slip not found" });
      }
      const user = await storage.getAdminUser(slip.userId);
      const allDepts = await storage.getDepartments();
      const dept = allDepts.find(d => d.id === user?.departmentId);
      const bankDetails = await storage.getBankDetails(slip.userId);
      res.json({ ...slip, user, department: dept, bankDetails });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch salary slip" });
    }
  });

  // HR Tools: Generate offer letter DOCX
  app.post("/api/hr/tools/generate-offer-letter", requireAuth, requirePermission("hr.tools.generateOfferLetter", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      let departmentName = "";
      if (req.body.departmentId) {
        const dept = await storage.getDepartment(req.body.departmentId);
        departmentName = dept?.name || "";
      }

      const rawGenAnnexures = req.body.annexureData;
      let genAnnexures: Array<{ title: string; body: string }> | undefined;
      if (Array.isArray(rawGenAnnexures) && rawGenAnnexures.length > 0) {
        genAnnexures = rawGenAnnexures.slice(0, 5).map((a: any) => ({ title: String(a.title || ""), body: String(a.body || "") }));
      }

      const data: OfferLetterData = {
        candidateTitle: req.body.candidateTitle || "Mr.",
        candidateName: req.body.candidateName || "",
        candidateAddress: req.body.candidateAddress || "",
        designation: req.body.designation || "",
        subjectDesignation: req.body.subjectDesignation || req.body.designation || "",
        reportingTo: req.body.reportingTo || "",
        employmentType: req.body.employmentType || "Full-time / Regular",
        proposedStartDate: req.body.proposedStartDate || "",
        salary: parseFloat(req.body.salary) || 0,
        salaryInWords: req.body.salaryInWords || "",
        location: req.body.location || "Delhi",
        jurisdiction: req.body.jurisdiction || "Delhi",
        department: departmentName,
        hrManagerName: req.body.hrManagerName || "Alina Carter",
        offerDate: req.body.offerDate || new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        annexures: genAnnexures,
        probationSalary: req.body.probationSalary ? parseFloat(req.body.probationSalary) : undefined,
        probationSalaryInWords: req.body.probationSalaryInWords || undefined,
        postProbationSalary: req.body.postProbationSalary ? parseFloat(req.body.postProbationSalary) : undefined,
        postProbationSalaryInWords: req.body.postProbationSalaryInWords || undefined,
        probationPeriodMonths: req.body.probationPeriodMonths ? parseInt(req.body.probationPeriodMonths) : undefined,
        extendedProbationMonths: req.body.extendedProbationMonths ? parseInt(req.body.extendedProbationMonths) : undefined,
      };

      if (req.body.performanceProbationReview) {
        const template = await getManagedClauseText(OFFER_CLAUSE_CATEGORY, OFFER_CLAUSE_KEY, OFFER_CLAUSE_DEFAULT_TEXT);
        data.performanceProbationReview = true;
        data.performanceClauseText = renderOfferClause(template, {
          probationSalary: req.body.probationSalary,
          probationPeriodMonths: req.body.probationPeriodMonths,
          maxRevisionSalary: req.body.maxRevisionSalary,
          extendedProbationMonths: req.body.extendedProbationMonths,
        });
      }

      if (Array.isArray(req.body.policyAnnexures) && req.body.policyAnnexures.length > 0) {
        data.policyAnnexures = req.body.policyAnnexures;
      }

      if (req.body.annexureInitials && typeof req.body.annexureInitials === "object" && !Array.isArray(req.body.annexureInitials)) {
        data.annexureInitials = req.body.annexureInitials as Record<string, string>;
      }

      if (!data.candidateName || !data.designation) {
        return res.status(400).json({ error: "Candidate name and designation are required" });
      }

      const buffer = await generateOfferLetterDocx(data);
      const fileName = `${data.candidateName.replace(/\s+/g, "_")}_Offer_Letter.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Offer letter generation error:", error);
      res.status(500).json({ error: "Failed to generate offer letter" });
    }
  });

  // ==========================================
  // OFFER LETTERS — Send, List, Accept, Onboard
  // ==========================================

  // Send offer letter
  app.post("/api/hr/tools/offer-letters", requireAuth, requirePermission("hr.tools.offerLetters", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const { candidateTitle, candidateName, candidatePersonalEmail, candidateAddress,
        designation, subjectDesignation, reportingToUserId, departmentId,
        employmentType, proposedStartDate, salary, salaryInWords,
        location, jurisdiction, hrManagerName, offerDate, ccEmails,
        probationSalary, probationSalaryInWords, postProbationSalary, postProbationSalaryInWords,
        probationPeriodMonths, extendedProbationMonths,
        performanceProbationReview, maxRevisionSalary, maxRevisionSalaryInWords,
        policyAnnexures, seedProbationPlan,
        attachedPlanType, attachedPlanDepartment, attachedPlanRole, attachedPlanLevel } = req.body;

      if (!candidateName || !candidatePersonalEmail || !designation) {
        return res.status(400).json({ error: "Candidate name, personal email, and designation are required" });
      }

      // Validate the performance-based probation review mode when selected
      let renderedPerformanceClauseText: string | null = null;
      if (performanceProbationReview) {
        const pSal = parseFloat(probationSalary);
        if (!probationSalary || isNaN(pSal) || pSal <= 0) {
          return res.status(400).json({ error: "Probation salary must be a positive number for performance-based probation review" });
        }
        const pMonths = probationPeriodMonths ? parseInt(probationPeriodMonths) : 3;
        if (isNaN(pMonths) || pMonths < 1 || pMonths > 6) {
          return res.status(400).json({ error: "Probation duration must be between 1 and 6 months" });
        }
        if (maxRevisionSalary !== undefined && maxRevisionSalary !== null && maxRevisionSalary !== "") {
          const mSal = parseFloat(maxRevisionSalary);
          if (isNaN(mSal) || mSal <= 0) {
            return res.status(400).json({ error: "Revision ceiling must be a positive number when provided" });
          }
        }
        if (extendedProbationMonths !== undefined && extendedProbationMonths !== null && extendedProbationMonths !== "") {
          const epMonths = parseInt(extendedProbationMonths);
          if (isNaN(epMonths) || epMonths < 4 || epMonths > 12) {
            return res.status(400).json({ error: "Extended probation duration must be between 4 and 12 months" });
          }
        }
        const template = await getManagedClauseText(OFFER_CLAUSE_CATEGORY, OFFER_CLAUSE_KEY, OFFER_CLAUSE_DEFAULT_TEXT);
        renderedPerformanceClauseText = renderOfferClause(template, {
          probationSalary,
          probationPeriodMonths,
          maxRevisionSalary,
          extendedProbationMonths,
        });
      }

      // Validate probation salary fields when split compensation is used
      const hasProbationFields = !performanceProbationReview && (probationSalary || postProbationSalary);
      if (hasProbationFields) {
        const pSal = parseFloat(probationSalary);
        const ppSal = parseFloat(postProbationSalary);
        if (!probationSalary || isNaN(pSal) || pSal <= 0) {
          return res.status(400).json({ error: "Probation salary must be a positive number when using split compensation" });
        }
        if (!postProbationSalary || isNaN(ppSal) || ppSal <= 0) {
          return res.status(400).json({ error: "Post-probation salary must be a positive number when using split compensation" });
        }
        if (ppSal <= pSal) {
          return res.status(400).json({ error: "Post-probation salary should be greater than probation salary" });
        }
        if (!probationSalaryInWords || !postProbationSalaryInWords) {
          return res.status(400).json({ error: "Salary in words is required for both probation and post-probation tiers" });
        }
        const pMonths = probationPeriodMonths ? parseInt(probationPeriodMonths) : 3;
        if (isNaN(pMonths) || pMonths < 1 || pMonths > 6) {
          return res.status(400).json({ error: "Probation duration must be between 1 and 6 months" });
        }
        if (extendedProbationMonths !== undefined && extendedProbationMonths !== null && extendedProbationMonths !== "") {
          const epMonths = parseInt(extendedProbationMonths);
          if (isNaN(epMonths) || epMonths < 4 || epMonths > 12) {
            return res.status(400).json({ error: "Extended probation duration must be between 4 and 12 months" });
          }
        }
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const actorId = req.session.userId!;
      const actorUser = await storage.getAdminUser(actorId);
      // Only super_admin can send directly; all other roles require super_admin approval
      const canSendDirectly = actorUser?.role === "super_admin";

      const offerStatus = canSendDirectly ? "sent" : "pending_approval";

      const rawOfferAnnexures = req.body.annexureData;
      let offerAnnexures: Array<{ title: string; body: string }> | null = null;
      if (Array.isArray(rawOfferAnnexures) && rawOfferAnnexures.length > 0) {
        if (rawOfferAnnexures.length > 5) {
          return res.status(400).json({ error: "A maximum of 5 annexures are allowed." });
        }
        for (const ann of rawOfferAnnexures) {
          if (!ann.title?.trim()) {
            return res.status(400).json({ error: "Each annexure must have a non-empty title." });
          }
        }
        offerAnnexures = rawOfferAnnexures.map((a: any) => ({ title: String(a.title), body: String(a.body ?? "") }));
      }

      const offerLetter = await storage.createOfferLetter({
        token,
        status: offerStatus,
        candidateTitle: candidateTitle || "Mr.",
        candidateName,
        candidatePersonalEmail: candidatePersonalEmail.toLowerCase(),
        candidateAddress: candidateAddress || null,
        designation,
        subjectDesignation: subjectDesignation || designation,
        reportingToUserId: reportingToUserId || null,
        departmentId: departmentId || null,
        employmentType: employmentType || "Full-time / Regular",
        proposedStartDate: proposedStartDate || null,
        salary: salary || null,
        salaryInWords: salaryInWords || null,
        location: location || "Delhi",
        jurisdiction: jurisdiction || "Delhi",
        hrManagerName: hrManagerName || null,
        offerDate: offerDate || new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        createdBy: actorId,
        expiresAt,
        hireInEmail: null,
        ccEmails: Array.isArray(ccEmails) && ccEmails.length > 0 ? ccEmails.join(",") : (typeof ccEmails === "string" && ccEmails.trim() ? ccEmails.trim() : null),
        annexureData: offerAnnexures,
        probationSalary: probationSalary ? String(probationSalary) : null,
        probationSalaryInWords: probationSalaryInWords || null,
        postProbationSalary: postProbationSalary ? String(postProbationSalary) : null,
        postProbationSalaryInWords: postProbationSalaryInWords || null,
        probationPeriodMonths: probationPeriodMonths ? parseInt(probationPeriodMonths) : null,
        extendedProbationMonths: extendedProbationMonths ? parseInt(extendedProbationMonths) : null,
        performanceProbationReview: !!performanceProbationReview,
        maxRevisionSalary: (performanceProbationReview && maxRevisionSalary) ? String(maxRevisionSalary) : null,
        maxRevisionSalaryInWords: (performanceProbationReview && maxRevisionSalaryInWords) ? maxRevisionSalaryInWords : null,
        performanceClauseText: renderedPerformanceClauseText,
        policyAnnexures: Array.isArray(policyAnnexures) && policyAnnexures.length > 0 ? policyAnnexures : null,
        seedProbationPlan: !!seedProbationPlan,
        // Phase 2: attached plan template. Default to probation when only the
        // legacy seed-probation checkbox is set, so older clients keep working.
        attachedPlanType: attachedPlanType || (seedProbationPlan ? "probation" : null),
        attachedPlanDepartment: attachedPlanDepartment || null,
        attachedPlanRole: attachedPlanRole || null,
        attachedPlanLevel: attachedPlanLevel || null,
      });

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";

      if (!canSendDirectly) {
        // Non-super_admin flow: route to super_admin for approval, do not send to candidate yet
        const reviewUrl = `${protocol}://${host}/admin/new-hire`;
        const creatorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : "A team member";
        const creatorRole = actorUser?.role ?? "unknown";

        // Notify super_admin email addresses
        const superAdminNotifyEmails = ["simranjeet@hire-in.com"];
        await sendOfferLetterPendingApprovalEmail({
          to: superAdminNotifyEmails,
          managerName: `${creatorName} (${creatorRole})`,
          candidateName,
          designation,
          salary: salary || null,
          reviewUrl,
        });

        // Create in-app notifications for super_admin users only
        try {
          const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
          const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
          if (featureFlags.notifications_enabled) {
            const allUsers = await storage.getAdminUsers();
            const superAdmins = allUsers.filter(u => u.role === "super_admin" && u.isActive);
            for (const sa of superAdmins) {
              await storage.createNotification({
                userId: sa.id,
                type: "offer_letter_pending_approval",
                title: "Offer Letter Pending Approval",
                message: `${creatorName} submitted an offer letter for ${candidateName} (${designation}) — awaiting your approval.`,
                isRead: false,
                metadata: { offerId: offerLetter.id, candidateName, designation },
              });
            }
          }
        } catch (notifErr) {
          console.error("[OfferLetter] Notification creation error:", notifErr);
        }

        await storage.createAuditLog({
          action: "offer_letter_pending_approval",
          actorId,
          changes: { offerId: offerLetter.id, candidateName, designation, email: candidatePersonalEmail },
        });

        const { token: _token, ...offerLetterWithoutToken } = offerLetter;
        return res.json({ ...offerLetterWithoutToken, emailSent: false, pendingApproval: true });
      }

      // super_admin flow: send directly to candidate
      const acceptUrl = `${protocol}://${host}/onboard/${token}`;

      const parsedCcEmails = Array.isArray(ccEmails)
        ? ccEmails.filter(Boolean)
        : (typeof ccEmails === "string" && ccEmails.trim() ? ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean) : []);

      const emailResult = await sendOfferLetterEmail({
        to: candidatePersonalEmail.toLowerCase(),
        candidateName,
        designation,
        acceptUrl,
        expiresAt,
        cc: parsedCcEmails.length > 0 ? parsedCcEmails : undefined,
      });

      if (!emailResult.success) {
        console.error(`[OfferLetter] Email delivery failed for ${candidatePersonalEmail}: ${emailResult.error}`);
      } else {
        console.log(`[OfferLetter] Email sent to ${candidatePersonalEmail}, acceptUrl: ${acceptUrl}`);
      }

      await storage.createAuditLog({
        action: "offer_letter_sent",
        actorId,
        changes: { offerId: offerLetter.id, candidateName, designation, email: candidatePersonalEmail, emailSent: emailResult.success },
      });

      res.json({ ...offerLetter, emailSent: emailResult.success, emailError: emailResult.success ? undefined : emailResult.error });
    } catch (error: any) {
      console.error("[OfferLetter] Send error:", error?.message || error, error?.stack);
      res.status(500).json({ error: "Failed to send offer letter", detail: error?.message });
    }
  });

  // Edit / resubmit an offer letter that is still pending approval or was rejected
  app.patch("/api/hr/tools/offer-letters/:id", requireAuth, requirePermission("hr.tools.offerLetters", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const actorId = req.session.userId!;
      const actorUser = await storage.getAdminUser(actorId);
      const existing = await storage.getOfferLetter(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Offer letter not found" });
      }

      // Only the original creator or a super_admin may edit
      const isSuperAdmin = actorUser?.role === "super_admin";
      if (!isSuperAdmin && existing.createdBy !== actorId) {
        return res.status(403).json({ error: "You can only edit offer letters you created" });
      }

      // Editing is only permitted before the offer has been sent to the candidate
      if (existing.status !== "pending_approval" && existing.status !== "rejected") {
        return res.status(400).json({ error: "Only offer letters that are pending approval or rejected can be edited" });
      }

      const { candidateTitle, candidateName, candidatePersonalEmail, candidateAddress,
        designation, subjectDesignation, reportingToUserId, departmentId,
        employmentType, proposedStartDate, salary, salaryInWords,
        location, jurisdiction, hrManagerName, offerDate, ccEmails,
        probationSalary, probationSalaryInWords, postProbationSalary, postProbationSalaryInWords,
        probationPeriodMonths, extendedProbationMonths,
        performanceProbationReview, maxRevisionSalary, maxRevisionSalaryInWords,
        policyAnnexures, seedProbationPlan,
        attachedPlanType, attachedPlanDepartment, attachedPlanRole, attachedPlanLevel } = req.body;

      if (!candidateName || !candidatePersonalEmail || !designation) {
        return res.status(400).json({ error: "Candidate name, personal email, and designation are required" });
      }

      // Validate the performance-based probation review mode when selected
      let renderedPerformanceClauseText: string | null = null;
      if (performanceProbationReview) {
        const pSal = parseFloat(probationSalary);
        if (!probationSalary || isNaN(pSal) || pSal <= 0) {
          return res.status(400).json({ error: "Probation salary must be a positive number for performance-based probation review" });
        }
        const pMonths = probationPeriodMonths ? parseInt(probationPeriodMonths) : 3;
        if (isNaN(pMonths) || pMonths < 1 || pMonths > 6) {
          return res.status(400).json({ error: "Probation duration must be between 1 and 6 months" });
        }
        if (maxRevisionSalary !== undefined && maxRevisionSalary !== null && maxRevisionSalary !== "") {
          const mSal = parseFloat(maxRevisionSalary);
          if (isNaN(mSal) || mSal <= 0) {
            return res.status(400).json({ error: "Revision ceiling must be a positive number when provided" });
          }
        }
        if (extendedProbationMonths !== undefined && extendedProbationMonths !== null && extendedProbationMonths !== "") {
          const epMonths = parseInt(extendedProbationMonths);
          if (isNaN(epMonths) || epMonths < 4 || epMonths > 12) {
            return res.status(400).json({ error: "Extended probation duration must be between 4 and 12 months" });
          }
        }
        const template = await getManagedClauseText(OFFER_CLAUSE_CATEGORY, OFFER_CLAUSE_KEY, OFFER_CLAUSE_DEFAULT_TEXT);
        renderedPerformanceClauseText = renderOfferClause(template, {
          probationSalary,
          probationPeriodMonths,
          maxRevisionSalary,
          extendedProbationMonths,
        });
      }

      // Validate probation salary fields when split compensation is used
      const hasProbationFields = !performanceProbationReview && (probationSalary || postProbationSalary);
      if (hasProbationFields) {
        const pSal = parseFloat(probationSalary);
        const ppSal = parseFloat(postProbationSalary);
        if (!probationSalary || isNaN(pSal) || pSal <= 0) {
          return res.status(400).json({ error: "Probation salary must be a positive number when using split compensation" });
        }
        if (!postProbationSalary || isNaN(ppSal) || ppSal <= 0) {
          return res.status(400).json({ error: "Post-probation salary must be a positive number when using split compensation" });
        }
        if (ppSal <= pSal) {
          return res.status(400).json({ error: "Post-probation salary should be greater than probation salary" });
        }
        if (!probationSalaryInWords || !postProbationSalaryInWords) {
          return res.status(400).json({ error: "Salary in words is required for both probation and post-probation tiers" });
        }
        const pMonths = probationPeriodMonths ? parseInt(probationPeriodMonths) : 3;
        if (isNaN(pMonths) || pMonths < 1 || pMonths > 6) {
          return res.status(400).json({ error: "Probation duration must be between 1 and 6 months" });
        }
        if (extendedProbationMonths !== undefined && extendedProbationMonths !== null && extendedProbationMonths !== "") {
          const epMonths = parseInt(extendedProbationMonths);
          if (isNaN(epMonths) || epMonths < 4 || epMonths > 12) {
            return res.status(400).json({ error: "Extended probation duration must be between 4 and 12 months" });
          }
        }
      }

      const rawOfferAnnexures = req.body.annexureData;
      let offerAnnexures: Array<{ title: string; body: string }> | null = null;
      if (Array.isArray(rawOfferAnnexures) && rawOfferAnnexures.length > 0) {
        if (rawOfferAnnexures.length > 5) {
          return res.status(400).json({ error: "A maximum of 5 annexures are allowed." });
        }
        for (const ann of rawOfferAnnexures) {
          if (!ann.title?.trim()) {
            return res.status(400).json({ error: "Each annexure must have a non-empty title." });
          }
        }
        offerAnnexures = rawOfferAnnexures.map((a: any) => ({ title: String(a.title), body: String(a.body ?? "") }));
      }

      const wasRejected = existing.status === "rejected";

      const updates: Partial<OfferLetter> = {
        candidateTitle: candidateTitle || "Mr.",
        candidateName,
        candidatePersonalEmail: candidatePersonalEmail.toLowerCase(),
        candidateAddress: candidateAddress || null,
        designation,
        subjectDesignation: subjectDesignation || designation,
        reportingToUserId: reportingToUserId || null,
        departmentId: departmentId || null,
        employmentType: employmentType || "Full-time / Regular",
        proposedStartDate: proposedStartDate || null,
        salary: salary || null,
        salaryInWords: salaryInWords || null,
        location: location || "Delhi",
        jurisdiction: jurisdiction || "Delhi",
        hrManagerName: hrManagerName || null,
        offerDate: offerDate || existing.offerDate,
        ccEmails: Array.isArray(ccEmails) && ccEmails.length > 0 ? ccEmails.join(",") : (typeof ccEmails === "string" && ccEmails.trim() ? ccEmails.trim() : null),
        annexureData: offerAnnexures,
        probationSalary: probationSalary ? String(probationSalary) : null,
        probationSalaryInWords: probationSalaryInWords || null,
        postProbationSalary: postProbationSalary ? String(postProbationSalary) : null,
        postProbationSalaryInWords: postProbationSalaryInWords || null,
        probationPeriodMonths: probationPeriodMonths ? parseInt(probationPeriodMonths) : null,
        extendedProbationMonths: extendedProbationMonths ? parseInt(extendedProbationMonths) : null,
        performanceProbationReview: !!performanceProbationReview,
        maxRevisionSalary: (performanceProbationReview && maxRevisionSalary) ? String(maxRevisionSalary) : null,
        maxRevisionSalaryInWords: (performanceProbationReview && maxRevisionSalaryInWords) ? maxRevisionSalaryInWords : null,
        performanceClauseText: renderedPerformanceClauseText,
        policyAnnexures: Array.isArray(policyAnnexures) && policyAnnexures.length > 0 ? policyAnnexures : null,
        seedProbationPlan: !!seedProbationPlan,
        attachedPlanType: attachedPlanType || (seedProbationPlan ? "probation" : null),
        attachedPlanDepartment: attachedPlanDepartment || null,
        attachedPlanRole: attachedPlanRole || null,
        attachedPlanLevel: attachedPlanLevel || null,
      };

      // Resubmitting a rejected letter returns it to the approval queue
      if (wasRejected) {
        updates.status = "pending_approval";
        updates.approvalRejectionReason = null;
      }

      const updated = await storage.updateOfferLetter(req.params.id, updates);

      // On resubmission, notify super_admins exactly like a fresh non-super_admin submission
      if (wasRejected) {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers.host || "localhost";
        const reviewUrl = `${protocol}://${host}/admin/new-hire`;
        const creator = existing.createdBy ? await storage.getAdminUser(existing.createdBy) : actorUser;
        const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : "A team member";
        const creatorRole = creator?.role ?? "unknown";

        const superAdminNotifyEmails = ["simranjeet@hire-in.com"];
        await sendOfferLetterPendingApprovalEmail({
          to: superAdminNotifyEmails,
          managerName: `${creatorName} (${creatorRole})`,
          candidateName,
          designation,
          salary: salary || null,
          reviewUrl,
        });

        try {
          const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
          const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
          if (featureFlags.notifications_enabled) {
            const allUsers = await storage.getAdminUsers();
            const superAdmins = allUsers.filter(u => u.role === "super_admin" && u.isActive);
            for (const sa of superAdmins) {
              await storage.createNotification({
                userId: sa.id,
                type: "offer_letter_pending_approval",
                title: "Offer Letter Resubmitted",
                message: `${creatorName} revised and resubmitted an offer letter for ${candidateName} (${designation}) — awaiting your approval.`,
                isRead: false,
                metadata: { offerId: req.params.id, candidateName, designation },
              });
            }
          }
        } catch (notifErr) {
          console.error("[OfferLetter] Resubmission notification error:", notifErr);
        }
      }

      await storage.createAuditLog({
        action: wasRejected ? "offer_letter_resubmitted" : "offer_letter_edited",
        actorId,
        changes: { offerId: req.params.id, candidateName, designation, email: candidatePersonalEmail, previousStatus: existing.status },
      });

      const { token: _token, ...offerLetterWithoutToken } = (updated || existing) as any;
      return res.json({ ...offerLetterWithoutToken, resubmitted: wasRejected });
    } catch (error: any) {
      console.error("[OfferLetter] Edit error:", error?.message || error, error?.stack);
      res.status(500).json({ error: "Failed to update offer letter", detail: error?.message });
    }
  });

  // List all offer letters
  app.get("/api/hr/tools/offer-letters", requireAuth, requirePermission("hr.tools.offerLetters", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const letters = await storage.getOfferLetters();
      const allUsers = await storage.getAdminUsers();
      const allDepts = await storage.getDepartments();

      const enriched = letters.map(letter => {
        const creator = allUsers.find(u => u.id === letter.createdBy);
        const manager = letter.reportingToUserId ? allUsers.find(u => u.id === letter.reportingToUserId) : null;
        const dept = letter.departmentId ? allDepts.find(d => d.id === letter.departmentId) : null;
        const onboarder = letter.onboardedBy ? allUsers.find(u => u.id === letter.onboardedBy) : null;
        return {
          ...letter,
          creatorName: creator ? `${creator.firstName} ${creator.lastName}` : "Unknown",
          managerName: manager ? `${manager.firstName} ${manager.lastName}` : null,
          departmentName: dept?.name || null,
          onboarderName: onboarder ? `${onboarder.firstName} ${onboarder.lastName}` : null,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("List offer letters error:", error);
      res.status(500).json({ error: "Failed to fetch offer letters" });
    }
  });

  // Approve a pending offer letter
  app.patch("/api/hr/tools/offer-letters/:id/approve", requireAuth, requirePermission("hr.tools.offerLetters.approve", "super_admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const actorId = req.session.userId!;
      const letter = await storage.getOfferLetter(id);
      if (!letter) return res.status(404).json({ error: "Offer letter not found" });
      if (letter.status !== "pending_approval") return res.status(400).json({ error: "Offer letter is not pending approval" });

      await storage.updateOfferLetter(id, {
        status: "sent",
        approvedBy: actorId,
        approvedAt: new Date(),
      });

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";
      const acceptUrl = `${protocol}://${host}/onboard/${letter.token}`;

      const emailResult = await sendOfferLetterEmail({
        to: letter.candidatePersonalEmail,
        candidateName: letter.candidateName,
        designation: letter.designation,
        acceptUrl,
        expiresAt: letter.expiresAt,
      });

      if (!emailResult.success) {
        console.error(`[OfferLetter Approve] Email delivery failed for ${letter.candidatePersonalEmail}: ${emailResult.error}`);
      }

      // Notify the creating manager
      const creator = await storage.getAdminUser(letter.createdBy);
      if (creator) {
        const portalUrl = `${protocol}://${host}/admin/hr-tools`;
        await sendOfferLetterApprovalDecisionEmail({
          to: creator.email,
          managerFirstName: creator.firstName,
          candidateName: letter.candidateName,
          designation: letter.designation,
          approved: true,
          reviewUrl: portalUrl,
        });

        try {
          const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
          const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
          if (featureFlags.notifications_enabled) {
            await storage.createNotification({
              userId: creator.id,
              type: "offer_letter_approved",
              title: "Offer Letter Approved",
              message: `Your offer letter for ${letter.candidateName} (${letter.designation}) has been approved and sent to the candidate.`,
              isRead: false,
              metadata: { offerId: id, candidateName: letter.candidateName },
            });
          }
        } catch (notifErr) {
          console.error("[OfferLetter Approve] Notification error:", notifErr);
        }
      }

      await storage.createAuditLog({
        action: "offer_letter_approved",
        actorId,
        changes: { offerId: id, candidateName: letter.candidateName, designation: letter.designation, emailSent: emailResult.success },
      });

      res.json({ success: true, emailSent: emailResult.success });
    } catch (error: any) {
      console.error("[OfferLetter Approve] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to approve offer letter" });
    }
  });

  // Reject a pending offer letter
  app.patch("/api/hr/tools/offer-letters/:id/reject", requireAuth, requirePermission("hr.tools.offerLetters.reject", "super_admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const actorId = req.session.userId!;
      const letter = await storage.getOfferLetter(id);
      if (!letter) return res.status(404).json({ error: "Offer letter not found" });
      if (letter.status !== "pending_approval") return res.status(400).json({ error: "Offer letter is not pending approval" });

      await storage.updateOfferLetter(id, {
        status: "rejected",
        approvalRejectionReason: reason || null,
      });

      // Notify the creating manager
      const creator = await storage.getAdminUser(letter.createdBy);
      if (creator) {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers.host || "localhost";
        const portalUrl = `${protocol}://${host}/admin/hr-tools`;
        await sendOfferLetterApprovalDecisionEmail({
          to: creator.email,
          managerFirstName: creator.firstName,
          candidateName: letter.candidateName,
          designation: letter.designation,
          approved: false,
          rejectionReason: reason || undefined,
          reviewUrl: portalUrl,
        });

        try {
          const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
          const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
          if (featureFlags.notifications_enabled) {
            await storage.createNotification({
              userId: creator.id,
              type: "offer_letter_rejected",
              title: "Offer Letter Rejected",
              message: `Your offer letter for ${letter.candidateName} (${letter.designation}) was rejected.${reason ? ` Reason: ${reason}` : ""}`,
              isRead: false,
              metadata: { offerId: id, candidateName: letter.candidateName, reason },
            });
          }
        } catch (notifErr) {
          console.error("[OfferLetter Reject] Notification error:", notifErr);
        }
      }

      await storage.createAuditLog({
        action: "offer_letter_rejected",
        actorId,
        changes: { offerId: id, candidateName: letter.candidateName, reason },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[OfferLetter Reject] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to reject offer letter" });
    }
  });

  // Public: View offer letter by token
  // Public: read-only standard policy annexure content (title + body) for the offer-letter viewer.
  // Single source of truth shared with the Word-document generator (server/annexureContent.ts).
  app.get("/api/annexure-content", async (_req: Request, res: Response) => {
    try {
      const content = Object.values(POLICY_ANNEXURES).map(a => ({
        key: a.key,
        label: a.label,
        title: a.title,
        body: a.body,
      }));
      res.json(content);
    } catch (error) {
      console.error("Annexure content error:", error);
      res.status(500).json({ error: "Failed to load annexure content" });
    }
  });

  app.get("/api/onboard/:token", tokenLookupLimiter, async (req: Request, res: Response) => {
    try {
      const letter = await storage.getOfferLetterByToken(req.params.token);
      if (!letter) {
        return res.status(404).json({ error: "Offer letter not found" });
      }

      if (letter.status === "pending_approval") {
        return res.status(403).json({ error: "This offer letter is awaiting internal approval and has not been released yet.", status: "pending_approval" });
      }

      if (letter.status === "rejected") {
        return res.status(403).json({ error: "This offer letter is not available.", status: "rejected" });
      }

      if (new Date() > letter.expiresAt && letter.status === "sent") {
        await storage.updateOfferLetter(letter.id, { status: "expired" });
        return res.status(410).json({ error: "This offer has expired", status: "expired" });
      }

      if (letter.status === "sent") {
        await storage.updateOfferLetter(letter.id, { status: "viewed" });
      }

      const allDepts = await storage.getDepartments();
      const dept = letter.departmentId ? allDepts.find(d => d.id === letter.departmentId) : null;
      let managerName = null;
      if (letter.reportingToUserId) {
        const mgr = await storage.getAdminUser(letter.reportingToUserId);
        managerName = mgr ? `${mgr.firstName} ${mgr.lastName}` : null;
      }

      res.json({
        id: letter.id,
        status: letter.status === "sent" ? "viewed" : letter.status,
        candidateTitle: letter.candidateTitle,
        candidateName: letter.candidateName,
        candidateAddress: letter.candidateAddress,
        designation: letter.designation,
        subjectDesignation: letter.subjectDesignation,
        employmentType: letter.employmentType,
        proposedStartDate: letter.proposedStartDate,
        salary: letter.salary,
        salaryInWords: letter.salaryInWords,
        location: letter.location,
        jurisdiction: letter.jurisdiction,
        hrManagerName: letter.hrManagerName,
        offerDate: letter.offerDate,
        expiresAt: letter.expiresAt,
        departmentName: dept?.name || null,
        managerName,
        probationSalary: letter.probationSalary,
        probationSalaryInWords: letter.probationSalaryInWords,
        postProbationSalary: letter.postProbationSalary,
        postProbationSalaryInWords: letter.postProbationSalaryInWords,
        probationPeriodMonths: letter.probationPeriodMonths,
        extendedProbationMonths: letter.extendedProbationMonths,
        performanceProbationReview: letter.performanceProbationReview,
        maxRevisionSalary: letter.maxRevisionSalary,
        maxRevisionSalaryInWords: letter.maxRevisionSalaryInWords,
        performanceClauseText: letter.performanceClauseText,
        policyAnnexures: letter.policyAnnexures ?? null,
        annexureInitials: letter.annexureInitials ?? null,
        authCode: (letter.status === "accepted" || letter.status === "onboarded" || letter.status === "countersigned") ? letter.authCode ?? null : null,
      });
    } catch (error) {
      console.error("View offer letter error:", error);
      res.status(500).json({ error: "Failed to load offer letter" });
    }
  });

  // Public: Accept offer letter
  app.post("/api/onboard/:token/accept", async (req: Request, res: Response) => {
    try {
      const letter = await storage.getOfferLetterByToken(req.params.token);
      if (!letter) {
        return res.status(404).json({ error: "Offer letter not found" });
      }

      if (letter.status === "pending_approval") {
        return res.status(403).json({ error: "This offer letter has not been released yet.", status: "pending_approval" });
      }

      if (letter.status === "rejected") {
        return res.status(403).json({ error: "This offer letter is not available.", status: "rejected" });
      }

      if (letter.status === "accepted" || letter.status === "onboarded") {
        return res.status(400).json({ error: "This offer has already been accepted", status: letter.status });
      }

      if (letter.status === "cancelled") {
        return res.status(400).json({ error: "This offer has been cancelled", status: "cancelled" });
      }

      if (letter.status === "expired" || new Date() > letter.expiresAt) {
        if (letter.status !== "expired") {
          await storage.updateOfferLetter(letter.id, { status: "expired" });
        }
        return res.status(410).json({ error: "This offer has expired", status: "expired" });
      }

      const { acceptedName, acceptanceDate, consentAcceptedAt: consentAcceptedAtRaw, signatureFont } = req.body;
      if (!acceptedName || acceptedName.trim().toLowerCase() !== letter.candidateName.trim().toLowerCase()) {
        return res.status(400).json({ error: `Please type your full name exactly as it appears on the offer: "${letter.candidateName}"` });
      }
      const consentAcceptedAt = consentAcceptedAtRaw ? new Date(consentAcceptedAtRaw) : null;

      if (!process.env.OFFER_SIGNING_KEY) {
        console.error("OFFER_SIGNING_KEY is not set in environment");
        return res.status(500).json({ error: "Server configuration error" });
      }

      const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const serverTimestamp = new Date();

      // ── Per-annexure initials — required when policy annexures are attached ────
      const requiredAnnexureKeys: string[] = Array.isArray(letter.policyAnnexures) ? letter.policyAnnexures : [];
      let annexureInitials: { key: string; initials: string; initialedAt: string }[] | null = null;
      if (requiredAnnexureKeys.length > 0) {
        const rawInitials = Array.isArray(req.body.annexureInitials) ? req.body.annexureInitials : [];
        const initialsByKey = new Map<string, { initials: string; initialedAt?: string }>();
        for (const entry of rawInitials) {
          if (entry && typeof entry.key === "string" && typeof entry.initials === "string") {
            initialsByKey.set(entry.key, { initials: entry.initials.trim(), initialedAt: entry.initialedAt });
          }
        }
        const missing = requiredAnnexureKeys.filter(k => !initialsByKey.get(k)?.initials);
        if (missing.length > 0) {
          return res.status(400).json({ error: "Please initial each attached policy annexure before accepting." });
        }
        annexureInitials = requiredAnnexureKeys.map(k => {
          const v = initialsByKey.get(k)!;
          const ts = v.initialedAt && !isNaN(Date.parse(v.initialedAt)) ? new Date(v.initialedAt).toISOString() : serverTimestamp.toISOString();
          return { key: k, initials: v.initials, initialedAt: ts };
        });
      }

      // Delegates to DocumentSigningService (preserves exact same algorithm/hash)
      const { authCode, documentHash } = _signOfferLetterAcceptance(
        { id: letter.id, candidateName: letter.candidateName, designation: letter.designation, salary: letter.salary, proposedStartDate: letter.proposedStartDate, offerDate: letter.offerDate, location: letter.location },
        acceptedName,
        serverTimestamp,
        annexureInitials,
      );

      await storage.updateOfferLetter(letter.id, {
        status: "accepted",
        acceptedAt: serverTimestamp,
        acceptedName: acceptedName.trim(),
        acceptanceDate: acceptanceDate || serverTimestamp.toISOString().split("T")[0],
        acceptedIp: clientIp,
        acceptedUserAgent: userAgent,
        annexureInitials: annexureInitials as any,
        authCode,
        documentHash
      });

      await recordSignature({
        documentType: "offer_letter",
        documentId: letter.id,
        referenceNumber: letter.id,
        signerName: acceptedName.trim(),
        signerRole: "candidate",
        signedAt: serverTimestamp,
        ipAddress: clientIp,
        userAgent,
        contentHash: documentHash,
        authCode,
        sectionInitials: annexureInitials ?? null,
        consentAcceptedAt,
        metadata: signatureFont ? { signatureFont } : null,
      });

      await storage.createAuditLog({
        action: "offer_letter_accepted",
        actorId: letter.createdBy,
        changes: { offerId: letter.id, candidateName: letter.candidateName, acceptedName: acceptedName.trim(), ip: clientIp, authCode },
      });

      // Centralized compensation: when the offer is already linked to an existing
      // employee record (legacy employee accepting a fresh offer), write the
      // agreed salary back at acceptance. Brand-new hires have no user record yet
      // — their write-back happens when the account is created at start-onboarding.
      // Idempotent per offer, so the two paths never double-write.
      try {
        if (letter.resultingUserId) {
          const { applyOfferSalaryChange } = await import("./salaryLedger");
          await applyOfferSalaryChange(letter, letter.createdBy, { employeeId: letter.resultingUserId, apply: true });
        }
      } catch (ledgerErr) {
        console.error("Offer-acceptance salary write-back failed (non-fatal):", ledgerErr);
      }

      // ── Seed a pending plan at offer acceptance ──────────────────────────
      // Phase 2: honor the attached plan template chosen on the offer. Fall back
      // to the legacy seed-probation checkbox so older offers keep working.
      const acceptPlanType: AttachablePlanType | null =
        ((letter as any).attachedPlanType as AttachablePlanType | null)
        || ((letter as any).seedProbationPlan ? "probation" : null);
      if (acceptPlanType) {
        try {
          const proposedStart: string = letter.proposedStartDate || new Date().toISOString().slice(0, 10);
          let durationDays: number;
          let endDateStr: string;
          // Probation windows follow the offer's probation duration in months;
          // growth/pip use the engine's default day windows.
          if (acceptPlanType === "probation") {
            const probationMonths: number = (letter as any).probationPeriodMonths || 3;
            const endDate = new Date(proposedStart);
            endDate.setMonth(endDate.getMonth() + probationMonths);
            endDateStr = endDate.toISOString().slice(0, 10);
            durationDays = Math.round((endDate.getTime() - new Date(proposedStart).getTime()) / (1000 * 60 * 60 * 24));
          } else {
            durationDays = acceptPlanType === "pip" ? 30 : 90;
            endDateStr = new Date(new Date(proposedStart).getTime() + durationDays * 86400000)
              .toISOString().slice(0, 10);
          }

          // Seed plan with NULL employee_id — filled in at onboarding
          await db.execute(sql`
            INSERT INTO employee_plans
              (offer_letter_id, employee_id, manager_id, plan_type, department_scope, status, start_date, end_date, duration_days, created_by)
            VALUES
              (${letter.id}, NULL, NULL, ${acceptPlanType}::employee_plan_type, 'healthcare', 'pending',
               ${proposedStart}, ${endDateStr}, ${durationDays}, ${letter.createdBy})
          `);
        } catch (planErr) {
          console.error("[AcceptOffer] Pending plan seed failed (non-fatal):", planErr);
        }
      }

      res.json({ success: true, message: "Offer accepted successfully", authCode, documentHash });
    } catch (error) {
      console.error("Accept offer letter error:", error);
      res.status(500).json({ error: "Failed to accept offer" });
    }
  });

  // Counter-sign offer letter
  app.post("/api/admin/offer-letters/:id/countersign", requireAuth, requirePermission("admin.offerLetters.countersign", "hr", "super_admin", "admin"), async (req: Request, res: Response) => {
    try {
      const letter = await storage.getOfferLetter(req.params.id);
      if (!letter) {
        return res.status(404).json({ error: "Offer letter not found" });
      }

      if (letter.status !== "accepted") {
        return res.status(400).json({ error: `Cannot counter-sign — offer status is '${letter.status}', must be 'accepted'` });
      }

      const { counterSignedName, counterSignedDate } = req.body;
      if (!counterSignedName || !counterSignedName.trim()) {
        return res.status(400).json({ error: "Counter-signer name is required" });
      }

      const now = new Date();

      const { signOfferCountersign } = await import("./documentSigningService");
      const { counterAuthCode, counterDocumentHash } = signOfferCountersign(letter, counterSignedName, now);

      await storage.updateOfferLetter(letter.id, {
        status: "countersigned",
        counterSignedBy: req.session.userId,
        counterSignedAt: now,
        counterSignedName: counterSignedName.trim(),
        counterSignedDate: counterSignedDate || now.toISOString().split("T")[0],
        counterAuthCode,
        counterDocumentHash
      });

      await recordSignature({
        documentType: "offer_letter_counter",
        documentId: letter.id,
        referenceNumber: letter.id,
        signerName: counterSignedName.trim(),
        signerRole: "hr",
        signerUserId: req.session.userId,
        signedAt: now,
        contentHash: counterDocumentHash,
        authCode: counterAuthCode,
      });

      await storage.createAuditLog({
        action: "offer_letter_countersigned",
        actorId: req.session.userId!,
        changes: { offerId: letter.id, counterSignedName: counterSignedName.trim(), counterAuthCode },
      });

      res.json({ success: true, message: "Offer counter-signed successfully", counterAuthCode });
    } catch (error) {
      console.error("Counter-sign offer letter error:", error);
      res.status(500).json({ error: "Failed to counter-sign offer" });
    }
  });

  // ==========================================
  // ATTACH-A-PLAN PICKER OPTIONS
  // ==========================================

  // Options for the "attach a plan template" picker on offers and addendums.
  // Returns the available (department/role/level) keys per plan type plus the
  // probation default resolved from an optional designation/department, so the
  // UI can pre-select a sensible template. Read-only.
  app.get("/api/hr/plans/attach-options", requireAuth, requirePermission("hr.plans.attachOptions", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const designation = (req.query.designation as string | undefined) ?? null;
      const departmentName = (req.query.department as string | undefined) ?? null;

      // Distinct template keys per plan type. NULLs collapse so the UI can offer
      // a "default / all" option when a template isn't keyed to a specific
      // department or level.
      const keyRows = await db.execute(sql`
        SELECT DISTINCT plan_type, department, role, level
        FROM plan_goal_templates
        WHERE is_active = true
        ORDER BY plan_type, department NULLS FIRST, role NULLS FIRST, level NULLS FIRST
      `);

      const byType: Record<string, Array<{ department: string | null; role: string | null; level: string | null }>> = {
        probation: [], growth: [], pip: [],
      };
      for (const row of keyRows.rows as any[]) {
        const pt = row.plan_type as string;
        if (!byType[pt]) continue;
        // Skip fully-empty rows (legacy healthcare templates keyed only by
        // role_slug surface via the probation default instead).
        if (!row.department && !row.role && !row.level) continue;
        byType[pt].push({ department: row.department ?? null, role: row.role ?? null, level: row.level ?? null });
      }

      // Probation default from the free-text designation/department, mirroring
      // the onboarding activation resolver.
      const { parseProbationKey } = await import("./probationTemplates");
      const probationDefault = parseProbationKey(designation, departmentName);

      res.json({
        types: ["probation", "growth", "pip"] as AttachablePlanType[],
        probation: { keys: byType.probation, default: probationDefault },
        growth: { keys: byType.growth, default: null },
        pip: { keys: byType.pip, default: null },
      });
    } catch (error) {
      console.error("Attach-plan options error:", error);
      res.status(500).json({ error: "Failed to load attach-plan options" });
    }
  });

  // ==========================================
  // OFFER LETTER ADDENDUMS
  // ==========================================

  // List addendums for an offer letter
  app.get("/api/hr/tools/offer-letters/:offerId/addendums", requireAuth, requirePermission("hr.tools.offerLetters.addendums.get", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const addendums = await storage.getAddendumsForOffer(req.params.offerId);
      res.json(addendums);
    } catch (error) {
      console.error("List addendums error:", error);
      res.status(500).json({ error: "Failed to fetch addendums" });
    }
  });

  // Create addendum + send email
  app.post("/api/hr/tools/offer-letters/:offerId/addendums", requireAuth, requirePermission("hr.tools.offerLetters.addendums.post", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const offerLetter = await storage.getOfferLetter(req.params.offerId);
      if (!offerLetter) {
        return res.status(404).json({ error: "Offer letter not found" });
      }
      if (offerLetter.status !== "countersigned" && offerLetter.status !== "onboarded") {
        return res.status(400).json({ error: "Can only create addendums for countersigned or onboarded offers" });
      }

      const {
        addendumType, effectiveDate, reason, hrManagerName,
        oldDesignation, newDesignation, oldDepartment, newDepartment,
        oldSalary, newSalary, oldSalaryInWords, newSalaryInWords,
        oldConfirmationDate, newConfirmationDate,
        customClauseTitle, customClauseText,
        deviceItems, ccEmails, annexures,
        includeGrowthPlanClause, growthPlanCurrentSalary, growthPlanMaxRevisionSalary,
        attachedPlanType, attachedPlanDepartment, attachedPlanRole, attachedPlanLevel,
      } = req.body;

      if (!addendumType || !effectiveDate) {
        return res.status(400).json({ error: "addendumType and effectiveDate are required" });
      }

      let renderedGrowthPlanText: string | null = null;
      if (includeGrowthPlanClause) {
        if (!growthPlanCurrentSalary || !String(growthPlanCurrentSalary).trim()) {
          return res.status(400).json({ error: "Current salary is required for the 90-day performance review clause" });
        }
        const template = await getManagedClauseText(ADDENDUM_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_KEY, ADDENDUM_CLAUSE_DEFAULT_TEXT);
        renderedGrowthPlanText = renderAddendumClause(template, {
          currentSalary: growthPlanCurrentSalary,
          maxRevisionSalary: growthPlanMaxRevisionSalary,
        });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const actorId = req.session.userId!;

      const addendum = await storage.createAddendum({
        offerLetterId: offerLetter.id,
        // Eagerly link to the employee record when available so the ownership
        // check on GET /api/addendum/:token works for already-onboarded candidates.
        forEmployeeId: offerLetter.resultingUserId || null,
        token,
        addendumType,
        status: "sent",
        candidateName: offerLetter.candidateName,
        effectiveDate,
        reason: reason || null,
        hrManagerName: hrManagerName || offerLetter.hrManagerName || "HR Manager",
        issuedBy: actorId,
        oldDesignation: oldDesignation || null,
        newDesignation: newDesignation || null,
        oldDepartment: oldDepartment || null,
        newDepartment: newDepartment || null,
        oldSalary: oldSalary || null,
        newSalary: newSalary || null,
        oldSalaryInWords: oldSalaryInWords || null,
        newSalaryInWords: newSalaryInWords || null,
        oldConfirmationDate: oldConfirmationDate || null,
        newConfirmationDate: newConfirmationDate || null,
        customClauseTitle: customClauseTitle || null,
        customClauseText: customClauseText || null,
        deviceItems: deviceItems && Array.isArray(deviceItems) && deviceItems.length > 0 ? deviceItems : null,
        annexures: annexures && Array.isArray(annexures) && annexures.length > 0 ? annexures : null,
        ccEmails: Array.isArray(ccEmails) && ccEmails.length > 0 ? ccEmails.join(",") : (typeof ccEmails === "string" && ccEmails.trim() ? ccEmails.trim() : null),
        includeGrowthPlanClause: !!includeGrowthPlanClause,
        growthPlanCurrentSalary: includeGrowthPlanClause ? (growthPlanCurrentSalary || null) : null,
        growthPlanMaxRevisionSalary: includeGrowthPlanClause ? (growthPlanMaxRevisionSalary || null) : null,
        growthPlanClauseText: renderedGrowthPlanText,
        // Phase 2: attached plan template. Default to growth when the legacy
        // growth-plan clause is enabled, so existing growth flows keep working.
        attachedPlanType: attachedPlanType || (includeGrowthPlanClause ? "growth" : null),
        attachedPlanDepartment: attachedPlanDepartment || null,
        attachedPlanRole: attachedPlanRole || null,
        attachedPlanLevel: attachedPlanLevel || null,
      });

      const addendumExpiresAt = new Date();
      addendumExpiresAt.setDate(addendumExpiresAt.getDate() + 7);
      await storage.updateAddendumStatus(addendum.id, { issuedAt: new Date(), expiresAt: addendumExpiresAt });

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";
      const acceptUrl = `${protocol}://${host}/addendum/${token}`;

      const parsedAddendumCcEmails = Array.isArray(ccEmails)
        ? ccEmails.filter(Boolean)
        : (typeof ccEmails === "string" && ccEmails.trim() ? ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean) : []);

      const emailResult = await sendAddendumEmail({
        to: offerLetter.candidatePersonalEmail,
        candidateName: offerLetter.candidateName,
        addendumType,
        acceptUrl,
        cc: parsedAddendumCcEmails.length > 0 ? parsedAddendumCcEmails : undefined,
      });

      if (!emailResult.success) {
        console.error(`[Addendum] Email delivery failed: ${emailResult.error}`);
      }

      await storage.createAuditLog({
        action: "addendum_created",
        actorId,
        changes: { addendumId: addendum.id, offerId: offerLetter.id, addendumType, emailSent: emailResult.success },
      });

      if (addendumType === "probation_extension") {
        try {
          await ensureProbationExtensionPlan({
            offerLetterId: offerLetter.id,
            startDate: effectiveDate,
            endDate: newConfirmationDate,
            createdBy: actorId,
          });
        } catch (planErr) {
          console.error("[Addendum] probation plan upsert failed (non-fatal):", planErr);
        }
      }

      res.json({ ...addendum, emailSent: emailResult.success });
    } catch (error: any) {
      console.error("Create addendum error:", error?.message || error);
      res.status(500).json({ error: "Failed to create addendum", detail: error?.message });
    }
  });

  // Download addendum DOCX
  app.get("/api/hr/tools/offer-letters/:offerId/addendums/:addendumId/download", requireAuth, requirePermission("hr.tools.offerLetters.addendums.download", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const addendum = await storage.getAddendum(req.params.addendumId);
      if (!addendum || addendum.offerLetterId !== req.params.offerId) {
        return res.status(404).json({ error: "Addendum not found" });
      }
      const offerLetter = await storage.getOfferLetter(addendum.offerLetterId);
      if (!offerLetter) {
        return res.status(404).json({ error: "Parent offer letter not found" });
      }

      const buffer = await generateAddendumDocx({
        candidateName: addendum.candidateName,
        originalOfferDate: offerLetter.offerDate || "",
        originalDesignation: offerLetter.designation,
        effectiveDate: addendum.effectiveDate || "",
        hrManagerName: addendum.hrManagerName || "HR Manager",
        addendumType: addendum.addendumType,
        oldDesignation: addendum.oldDesignation || undefined,
        newDesignation: addendum.newDesignation || undefined,
        oldDepartment: addendum.oldDepartment || undefined,
        newDepartment: addendum.newDepartment || undefined,
        oldSalary: addendum.oldSalary || undefined,
        newSalary: addendum.newSalary || undefined,
        oldSalaryInWords: addendum.oldSalaryInWords || undefined,
        newSalaryInWords: addendum.newSalaryInWords || undefined,
        oldConfirmationDate: addendum.oldConfirmationDate || undefined,
        newConfirmationDate: addendum.newConfirmationDate || undefined,
        customClauseTitle: addendum.customClauseTitle || undefined,
        customClauseText: addendum.customClauseText || undefined,
        deviceItems: Array.isArray(addendum.deviceItems) && addendum.deviceItems.length > 0 ? addendum.deviceItems as any[] : undefined,
        annexures: Array.isArray(addendum.annexures) && addendum.annexures.length > 0 ? addendum.annexures as any[] : undefined,
        reason: addendum.reason || undefined,
        growthPlanClauseText: addendum.growthPlanClauseText || undefined,
      });

      const fileName = `${addendum.candidateName.replace(/\s+/g, "_")}_Addendum_${addendum.addendumType}.docx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Download addendum error:", error);
      res.status(500).json({ error: "Failed to generate addendum document" });
    }
  });

  // Resend addendum email
  app.post("/api/hr/tools/offer-letters/:offerId/addendums/:addendumId/send", requireAuth, requirePermission("hr.tools.offerLetters.addendums.send", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const addendum = await storage.getAddendum(req.params.addendumId);
      if (!addendum || addendum.offerLetterId !== req.params.offerId) {
        return res.status(404).json({ error: "Addendum not found" });
      }
      const offerLetter = await storage.getOfferLetter(addendum.offerLetterId);
      if (!offerLetter) return res.status(404).json({ error: "Parent offer letter not found" });

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";
      const acceptUrl = `${protocol}://${host}/addendum/${addendum.token}`;

      const storedCcEmails = addendum.ccEmails
        ? addendum.ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean)
        : [];

      const emailResult = await sendAddendumEmail({
        to: offerLetter.candidatePersonalEmail,
        candidateName: addendum.candidateName,
        addendumType: addendum.addendumType,
        acceptUrl,
        cc: storedCcEmails.length > 0 ? storedCcEmails : undefined,
      });

      if (addendum.status === "draft") {
        await storage.updateAddendumStatus(addendum.id, { status: "sent" });
      }

      await storage.createAuditLog({
        action: "addendum_resent",
        actorId: req.session.userId!,
        changes: { addendumId: addendum.id, offerId: req.params.offerId, emailSent: emailResult.success },
      });

      res.json({ success: emailResult.success, error: emailResult.success ? undefined : emailResult.error });
    } catch (error: any) {
      console.error("Resend addendum error:", error);
      res.status(500).json({ error: "Failed to resend addendum email" });
    }
  });

  // Cancel addendum
  app.post("/api/hr/tools/offer-letters/:offerId/addendums/:addendumId/cancel", requireAuth, requirePermission("hr.tools.offerLetters.addendums.cancel", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const addendum = await storage.getAddendum(req.params.addendumId);
      if (!addendum || addendum.offerLetterId !== req.params.offerId) {
        return res.status(404).json({ error: "Addendum not found" });
      }
      if (addendum.status !== "draft" && addendum.status !== "sent") {
        return res.status(400).json({ error: "Can only cancel draft or sent addendums" });
      }
      await storage.updateAddendumStatus(addendum.id, { status: "cancelled" });
      await storage.createAuditLog({
        action: "addendum_cancelled",
        actorId: req.session.userId!,
        changes: { addendumId: addendum.id, previousStatus: addendum.status },
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Cancel addendum error:", error);
      res.status(500).json({ error: "Failed to cancel addendum" });
    }
  });

  // Auth-gated: View addendum by token — employees must be logged in
  app.get("/api/addendum/:token", tokenLookupLimiter, async (req: Request, res: Response) => {
    try {
      // Require portal login — addendums contain sensitive compensation/promotion data.
      // Candidates who have no portal account should contact HR for a portal invite before signing.
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Login required to view this addendum", loginRequired: true });
      }

      const addendum = await storage.getAddendumByToken(req.params.token);
      if (!addendum) {
        return res.status(404).json({ error: "Addendum not found" });
      }

      // If the logged-in user is an employee (not HR/admin), verify strict ownership.
      const sessionRole = req.session.role;
      const isPrivilegedRole = ["super_admin", "admin", "hr", "operations", "manager"].includes(sessionRole || "");
      if (!isPrivilegedRole) {
        // Resolve the effective recipient: explicit forEmployeeId first, then
        // fall back to the offer letter's resultingUserId (candidate who joined).
        let effectiveEmployeeId = addendum.forEmployeeId;
        if (!effectiveEmployeeId && addendum.offerLetterId) {
          const offerLetterForAuth = await storage.getOfferLetter(addendum.offerLetterId);
          effectiveEmployeeId = offerLetterForAuth?.resultingUserId ?? null;
        }
        if (!effectiveEmployeeId || effectiveEmployeeId !== req.session.userId) {
          return res.status(403).json({ error: "You do not have permission to view this addendum" });
        }
      }

      if (addendum.expiresAt && new Date() > new Date(addendum.expiresAt) && addendum.status === "sent") {
        await storage.updateAddendumStatus(addendum.id, { status: "expired" as any });
        return res.status(410).json({ error: "This addendum has expired. Please contact HR for a renewed link.", status: "expired" });
      }

      let originalOfferDate: string | null = null;
      let originalDesignation: string | null = null;

      if (addendum.offerLetterId) {
        const offerLetter = await storage.getOfferLetter(addendum.offerLetterId);
        if (!offerLetter) {
          return res.status(404).json({ error: "Parent offer letter not found" });
        }
        originalOfferDate = offerLetter.offerDate;
        originalDesignation = offerLetter.designation;
      } else if (addendum.manualEmployeeData && typeof addendum.manualEmployeeData === "object") {
        const med = addendum.manualEmployeeData as Record<string, any>;
        originalOfferDate = med.joiningDate || null;
        originalDesignation = med.designation || null;
      }

      res.json({
        id: addendum.id,
        status: addendum.status,
        addendumType: addendum.addendumType,
        candidateName: addendum.candidateName,
        effectiveDate: addendum.effectiveDate,
        reason: addendum.reason,
        hrManagerName: addendum.hrManagerName,
        oldDesignation: addendum.oldDesignation,
        newDesignation: addendum.newDesignation,
        oldDepartment: addendum.oldDepartment,
        newDepartment: addendum.newDepartment,
        oldSalary: addendum.oldSalary,
        newSalary: addendum.newSalary,
        oldSalaryInWords: addendum.oldSalaryInWords,
        newSalaryInWords: addendum.newSalaryInWords,
        oldConfirmationDate: addendum.oldConfirmationDate,
        newConfirmationDate: addendum.newConfirmationDate,
        customClauseTitle: addendum.customClauseTitle,
        customClauseText: addendum.customClauseText,
        deviceItems: addendum.deviceItems,
        includeGrowthPlanClause: addendum.includeGrowthPlanClause,
        growthPlanCurrentSalary: addendum.growthPlanCurrentSalary,
        growthPlanMaxRevisionSalary: addendum.growthPlanMaxRevisionSalary,
        growthPlanClauseText: addendum.growthPlanClauseText,
        acceptedName: addendum.acceptedName,
        authCode: addendum.authCode,
        originalOfferDate,
        originalDesignation,
        offerDate: originalOfferDate,
        isStandalone: addendum.isStandalone,
      });
    } catch (error) {
      console.error("View addendum error:", error);
      res.status(500).json({ error: "Failed to load addendum" });
    }
  });

  // Public: Accept addendum
  app.post("/api/addendum/:token/accept", async (req: Request, res: Response) => {
    try {
      // Require portal login — keeps the accept path consistent with the GET auth gate.
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Login required to sign this addendum", loginRequired: true });
      }

      const addendum = await storage.getAddendumByToken(req.params.token);
      if (!addendum) {
        return res.status(404).json({ error: "Addendum not found" });
      }

      // Verify ownership for non-privileged users (same logic as GET route).
      const acceptRole = req.session.role;
      const acceptIsPrivileged = ["super_admin", "admin", "hr", "operations", "manager"].includes(acceptRole || "");
      if (!acceptIsPrivileged) {
        let effectiveId = addendum.forEmployeeId;
        if (!effectiveId && addendum.offerLetterId) {
          const ol = await storage.getOfferLetter(addendum.offerLetterId);
          effectiveId = ol?.resultingUserId ?? null;
        }
        if (!effectiveId || effectiveId !== req.session.userId) {
          return res.status(403).json({ error: "You do not have permission to sign this addendum" });
        }
      }

      if (addendum.status === "accepted" || addendum.status === "countersigned") {
        return res.status(400).json({ error: "This addendum has already been signed", status: addendum.status });
      }
      if (addendum.status === "cancelled") {
        return res.status(400).json({ error: "This addendum has been cancelled and is no longer available for signing" });
      }
      if (addendum.expiresAt && (addendum.status === "expired" || new Date() > new Date(addendum.expiresAt))) {
        if (addendum.status !== "expired") {
          await storage.updateAddendumStatus(addendum.id, { status: "expired" as any });
        }
        return res.status(410).json({ error: "This addendum has expired", status: "expired" });
      }
      if (addendum.status !== "sent") {
        return res.status(400).json({ error: "This addendum is not yet available for signing" });
      }

      const { acceptedName, consentAcceptedAt: consentAcceptedAtRaw, signatureFont } = req.body;
      if (!acceptedName || acceptedName.trim().toLowerCase() !== addendum.candidateName.trim().toLowerCase()) {
        return res.status(400).json({ error: `Please type your full name exactly as: "${addendum.candidateName}"` });
      }
      const consentAcceptedAt = consentAcceptedAtRaw ? new Date(consentAcceptedAtRaw) : null;

      const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "unknown";
      const serverTimestamp = new Date();

      const { signAddendumAcceptance } = await import("./documentSigningService");
      const { authCode, documentHash } = signAddendumAcceptance(addendum, acceptedName, serverTimestamp);

      await storage.updateAddendumStatus(addendum.id, {
        status: "accepted",
        acceptedAt: serverTimestamp,
        acceptedName: acceptedName.trim(),
        acceptedIp: clientIp,
        authCode,
        documentHash,
      });

      await recordSignature({
        documentType: "addendum",
        documentId: addendum.id,
        referenceNumber: addendum.id,
        signerName: acceptedName.trim(),
        signerRole: "candidate",
        signedAt: serverTimestamp,
        ipAddress: clientIp,
        contentHash: documentHash,
        authCode,
        consentAcceptedAt,
        metadata: signatureFont ? { signatureFont } : null,
      });

      // Audit trail — acceptance is audited via (a) row fields (acceptedAt/Name/Ip/authCode/documentHash)
      // and (b) an audit_log entry attributed to the HR creator of the parent offer letter (or issuedBy for standalone),
      // since audit_logs requires a valid admin_users FK and this endpoint is unauthenticated.
      let actorIdForAudit: string | null = null;
      let hrEmail = "hr@hire-in.com";

      if (addendum.offerLetterId) {
        const offerLetter = await storage.getOfferLetter(addendum.offerLetterId);
        if (offerLetter?.createdBy) {
          actorIdForAudit = offerLetter.createdBy;
          const actor = await storage.getAdminUser(offerLetter.createdBy);
          if (actor?.email) hrEmail = actor.email;
        }
      } else if (addendum.issuedBy) {
        actorIdForAudit = addendum.issuedBy;
        const actor = await storage.getAdminUser(addendum.issuedBy);
        if (actor?.email) hrEmail = actor.email;
      }

      if (actorIdForAudit) {
        await storage.createAuditLog({
          action: "addendum_accepted_by_candidate",
          actorId: actorIdForAudit,
          changes: {
            addendumId: addendum.id,
            offerLetterId: addendum.offerLetterId,
            isStandalone: addendum.isStandalone,
            candidateName: addendum.candidateName,
            addendumType: addendum.addendumType,
            authCode,
            documentHash,
            acceptedIp: clientIp,
            acceptedAt: serverTimestamp.toISOString(),
          },
        }).catch(e => console.error("[Addendum] Failed to create acceptance audit log:", e));
      }

      // Notify HR
      await sendAddendumAcceptedEmail({
        to: hrEmail,
        candidateName: addendum.candidateName,
        addendumType: addendum.addendumType,
      }).catch(e => console.error("[Addendum] Failed to notify HR:", e));

      // Activation engine: a signed addendum that carries an attached plan
      // template now instantiates a REAL, active, fully-tracked plan of that type
      // (goals + milestones + check-ins) that follows the normal SOP. Idempotent,
      // so countersign / backfill never duplicate it. Non-fatal. The legacy
      // growth-plan clause still activates a growth plan when no explicit type is
      // attached, preserving back-compat.
      const acceptAttachedType: AttachablePlanType | null =
        ((addendum as any).attachedPlanType as AttachablePlanType | null)
        || (addendum.includeGrowthPlanClause ? "growth" : null);
      if (acceptAttachedType && actorIdForAudit) {
        try {
          const r = await ensurePlanFromDocument({
            planType: acceptAttachedType,
            employeeId: addendum.forEmployeeId ?? null,
            offerLetterId: addendum.offerLetterId ?? null,
            effectiveDate: addendum.effectiveDate ?? null,
            // Plan starts on the employee's signature date (this acceptance).
            signatureDate: serverTimestamp,
            createdBy: actorIdForAudit,
            department: (addendum as any).attachedPlanDepartment ?? null,
            role: (addendum as any).attachedPlanRole ?? null,
            level: (addendum as any).attachedPlanLevel ?? null,
            designation: (addendum as any).newDesignation ?? (addendum as any).oldDesignation ?? null,
            departmentName: (addendum as any).newDepartment ?? (addendum as any).oldDepartment ?? null,
          });
          if (r.created) console.log(`[Addendum] ${acceptAttachedType} plan activated from signed addendum ${addendum.id} -> plan ${r.planId}`);
        } catch (planErr) {
          console.error("[Addendum] Plan activation failed (non-fatal):", planErr);
        }
      }

      // Centralized compensation: a salary-revision / combined addendum updates
      // admin_users.salary (single source of truth) the moment it is accepted,
      // and records the change in the salary ledger. Idempotent per addendum.
      try {
        const { applyAddendumSalaryChange } = await import("./salaryLedger");
        await applyAddendumSalaryChange(addendum, actorIdForAudit);
      } catch (salErr) {
        console.error("[Addendum] Salary write-back failed (non-fatal):", salErr);
      }

      res.json({ success: true, authCode, documentHash });
    } catch (error) {
      console.error("Accept addendum error:", error);
      res.status(500).json({ error: "Failed to accept addendum" });
    }
  });

  // List standalone addendums
  app.get("/api/hr/tools/addendums/standalone", requireAuth, requirePermission("hr.tools.addendums.standalone.get", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const addendums = await storage.getStandaloneAddendums();
      res.json(addendums);
    } catch (error) {
      console.error("List standalone addendums error:", error);
      res.status(500).json({ error: "Failed to fetch standalone addendums" });
    }
  });

  // All addendums (linked + standalone) for the unified Letters hub
  app.get("/api/hr/tools/addendums/all", requireAuth, requirePermission("hr.tools.addendums.standalone.get", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const addendums = await storage.getAllAddendums();
      res.json(addendums);
    } catch (error) {
      console.error("List all addendums error:", error);
      res.status(500).json({ error: "Failed to fetch addendums" });
    }
  });

  // My pending addendums — addendums sent to the logged-in employee awaiting their acceptance
  app.get("/api/hr/tools/addendums/my-pending", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const addendums = await storage.getPendingAddendumsForEmployee(userId);
      res.json(addendums);
    } catch (error) {
      console.error("My pending addendums error:", error);
      res.status(500).json({ error: "Failed to fetch pending addendums" });
    }
  });

  // Create standalone addendum
  app.post("/api/hr/tools/addendums/standalone", requireAuth, requirePermission("hr.tools.addendums.standalone.post", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const {
        employeeName, employeeEmail, employeeDesignation, employeeDepartment,
        employeeJoiningDate, employeeReportingManager,
        addendumType, effectiveDate, reason, hrManagerName,
        oldDesignation, newDesignation, oldDepartment, newDepartment,
        oldSalary, newSalary, oldSalaryInWords, newSalaryInWords,
        oldConfirmationDate, newConfirmationDate,
        customClauseTitle, customClauseText,
        deviceItems, ccEmails, annexureData,
        forEmployeeId,
        includeGrowthPlanClause, growthPlanCurrentSalary, growthPlanMaxRevisionSalary,
        attachedPlanType, attachedPlanDepartment, attachedPlanRole, attachedPlanLevel,
      } = req.body;

      if (!employeeName || !employeeEmail || !addendumType || !effectiveDate) {
        return res.status(400).json({ error: "employeeName, employeeEmail, addendumType, and effectiveDate are required" });
      }

      let renderedStandaloneGrowthPlanText: string | null = null;
      if (includeGrowthPlanClause) {
        if (!growthPlanCurrentSalary || !String(growthPlanCurrentSalary).trim()) {
          return res.status(400).json({ error: "Current salary is required for the 90-day performance review clause" });
        }
        const template = await getManagedClauseText(ADDENDUM_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_KEY, ADDENDUM_CLAUSE_DEFAULT_TEXT);
        renderedStandaloneGrowthPlanText = renderAddendumClause(template, {
          currentSalary: growthPlanCurrentSalary,
          maxRevisionSalary: growthPlanMaxRevisionSalary,
        });
      }

      // Validate annexures if provided (max 5, each must have title + body)
      let validatedAnnexures: { title: string; body: string }[] | null = null;
      if (annexureData && Array.isArray(annexureData) && annexureData.length > 0) {
        if (annexureData.length > 5) {
          return res.status(400).json({ error: "A maximum of 5 annexures are allowed." });
        }
        for (const ax of annexureData) {
          if (!ax.title?.trim()) {
            return res.status(400).json({ error: "Each annexure must have a non-empty title." });
          }
        }
        validatedAnnexures = annexureData;
      }

      // If a system employee was selected, validate it exists and is not deleted
      let resolvedForEmployeeId: string | null = null;
      if (forEmployeeId) {
        const emp = await storage.getAdminUser(forEmployeeId);
        if (!emp || emp.deletedAt) {
          return res.status(400).json({ error: "Selected employee was not found." });
        }
        resolvedForEmployeeId = emp.id;
      }

      const token = crypto.randomBytes(32).toString("hex");
      const actorId = req.session.userId!;

      const manualEmployeeData = {
        name: employeeName,
        email: employeeEmail,
        designation: employeeDesignation || null,
        department: employeeDepartment || null,
        joiningDate: employeeJoiningDate || null,
        reportingManager: employeeReportingManager || null,
      };

      const addendum = await storage.createAddendum({
        isStandalone: true,
        manualEmployeeData,
        forEmployeeId: resolvedForEmployeeId,
        token,
        addendumType,
        status: "sent",
        candidateName: employeeName,
        effectiveDate,
        reason: reason || null,
        hrManagerName: hrManagerName || "HR Manager",
        issuedBy: actorId,
        oldDesignation: oldDesignation || null,
        newDesignation: newDesignation || null,
        oldDepartment: oldDepartment || null,
        newDepartment: newDepartment || null,
        oldSalary: oldSalary || null,
        newSalary: newSalary || null,
        oldSalaryInWords: oldSalaryInWords || null,
        newSalaryInWords: newSalaryInWords || null,
        oldConfirmationDate: oldConfirmationDate || null,
        newConfirmationDate: newConfirmationDate || null,
        customClauseTitle: customClauseTitle || null,
        customClauseText: customClauseText || null,
        deviceItems: deviceItems && Array.isArray(deviceItems) && deviceItems.length > 0 ? deviceItems : null,
        annexures: validatedAnnexures,
        ccEmails: Array.isArray(ccEmails) && ccEmails.length > 0 ? ccEmails.join(",") : (typeof ccEmails === "string" && ccEmails.trim() ? ccEmails.trim() : null),
        includeGrowthPlanClause: !!includeGrowthPlanClause,
        growthPlanCurrentSalary: includeGrowthPlanClause ? (growthPlanCurrentSalary || null) : null,
        growthPlanMaxRevisionSalary: includeGrowthPlanClause ? (growthPlanMaxRevisionSalary || null) : null,
        growthPlanClauseText: renderedStandaloneGrowthPlanText,
        // Phase 2: attached plan template (default growth when growth clause on).
        attachedPlanType: attachedPlanType || (includeGrowthPlanClause ? "growth" : null),
        attachedPlanDepartment: attachedPlanDepartment || null,
        attachedPlanRole: attachedPlanRole || null,
        attachedPlanLevel: attachedPlanLevel || null,
      } as any);

      const standaloneExpiresAt = new Date();
      standaloneExpiresAt.setDate(standaloneExpiresAt.getDate() + 7);
      await storage.updateAddendumStatus(addendum.id, { issuedAt: new Date(), expiresAt: standaloneExpiresAt });

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";
      const acceptUrl = `${protocol}://${host}/addendum/${token}`;

      const parsedCcEmails = Array.isArray(ccEmails)
        ? ccEmails.filter(Boolean)
        : (typeof ccEmails === "string" && ccEmails.trim() ? ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean) : []);

      const emailResult = await sendAddendumEmail({
        to: employeeEmail,
        candidateName: employeeName,
        addendumType,
        acceptUrl,
        cc: parsedCcEmails.length > 0 ? parsedCcEmails : undefined,
      });

      if (!emailResult.success) {
        console.error(`[Standalone Addendum] Email delivery failed: ${emailResult.error}`);
      }

      await storage.createAuditLog({
        action: "standalone_addendum_created",
        actorId,
        changes: { addendumId: addendum.id, employeeName, addendumType, emailSent: emailResult.success },
      });

      if (addendumType === "probation_extension" && resolvedForEmployeeId) {
        try {
          await ensureProbationExtensionPlan({
            employeeId: resolvedForEmployeeId,
            startDate: effectiveDate,
            endDate: newConfirmationDate,
            createdBy: actorId,
          });
        } catch (planErr) {
          console.error("[Standalone Addendum] probation plan upsert failed (non-fatal):", planErr);
        }
      }

      res.json({ ...addendum, emailSent: emailResult.success });
    } catch (error: any) {
      console.error("Create standalone addendum error:", error?.message || error);
      res.status(500).json({ error: "Failed to create standalone addendum", detail: error?.message });
    }
  });

  // Preview standalone addendum DOCX — generates the document from form data without
  // saving to the database or sending any email. Used for "Preview before send" UX.
  app.post("/api/hr/tools/addendums/standalone/preview", requireAuth, requirePermission("hr.tools.addendums.standalone.preview", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const {
        employeeName, employeeEmail, employeeDesignation, employeeJoiningDate,
        addendumType, effectiveDate, reason, hrManagerName,
        oldDesignation, newDesignation, oldDepartment, newDepartment,
        oldSalary, newSalary, oldSalaryInWords, newSalaryInWords,
        oldConfirmationDate, newConfirmationDate,
        customClauseTitle, customClauseText,
        deviceItems, annexureData,
        includeGrowthPlanClause, growthPlanCurrentSalary, growthPlanMaxRevisionSalary,
      } = req.body;

      if (!employeeName || !effectiveDate) {
        return res.status(400).json({ error: "employeeName and effectiveDate are required for preview" });
      }

      let renderedGrowthPlanText: string | null = null;
      if (includeGrowthPlanClause && growthPlanCurrentSalary) {
        const template = await getManagedClauseText(ADDENDUM_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_KEY, ADDENDUM_CLAUSE_DEFAULT_TEXT);
        renderedGrowthPlanText = renderAddendumClause(template, {
          currentSalary: growthPlanCurrentSalary,
          maxRevisionSalary: growthPlanMaxRevisionSalary,
        });
      }

      const validatedAnnexures =
        Array.isArray(annexureData) && annexureData.length > 0
          ? annexureData.filter((ax: any) => ax.title?.trim() && ax.body?.trim())
          : undefined;

      const buffer = await generateAddendumDocx({
        candidateName: employeeName,
        originalOfferDate: employeeJoiningDate || "",
        originalDesignation: employeeDesignation || "",
        effectiveDate,
        hrManagerName: hrManagerName || "HR Manager",
        addendumType: addendumType || "custom",
        oldDesignation: oldDesignation || undefined,
        newDesignation: newDesignation || undefined,
        oldDepartment: oldDepartment || undefined,
        newDepartment: newDepartment || undefined,
        oldSalary: oldSalary || undefined,
        newSalary: newSalary || undefined,
        oldSalaryInWords: oldSalaryInWords || undefined,
        newSalaryInWords: newSalaryInWords || undefined,
        oldConfirmationDate: oldConfirmationDate || undefined,
        newConfirmationDate: newConfirmationDate || undefined,
        customClauseTitle: customClauseTitle || undefined,
        customClauseText: customClauseText || undefined,
        deviceItems: Array.isArray(deviceItems) && deviceItems.length > 0 ? deviceItems : undefined,
        annexures: validatedAnnexures,
        reason: reason || undefined,
        growthPlanClauseText: renderedGrowthPlanText || undefined,
      });

      const safeName = (employeeName || "Employee").replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Addendum_PREVIEW.docx"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Preview standalone addendum error:", error);
      res.status(500).json({ error: "Failed to generate preview document" });
    }
  });

  // Download standalone addendum DOCX
  app.get("/api/hr/tools/addendums/:addendumId/download", requireAuth, requirePermission("hr.tools.addendums.download", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const addendum = await storage.getAddendum(req.params.addendumId);
      if (!addendum) {
        return res.status(404).json({ error: "Addendum not found" });
      }

      let originalOfferDate = "";
      let originalDesignation = "";

      if (addendum.offerLetterId) {
        const offerLetter = await storage.getOfferLetter(addendum.offerLetterId);
        originalOfferDate = offerLetter?.offerDate || "";
        originalDesignation = offerLetter?.designation || "";
      } else if (addendum.manualEmployeeData && typeof addendum.manualEmployeeData === "object") {
        const med = addendum.manualEmployeeData as Record<string, any>;
        originalOfferDate = med.joiningDate || "";
        originalDesignation = med.designation || "";
      }

      const buffer = await generateAddendumDocx({
        candidateName: addendum.candidateName,
        originalOfferDate,
        originalDesignation,
        effectiveDate: addendum.effectiveDate || "",
        hrManagerName: addendum.hrManagerName || "HR Manager",
        addendumType: addendum.addendumType,
        oldDesignation: addendum.oldDesignation || undefined,
        newDesignation: addendum.newDesignation || undefined,
        oldDepartment: addendum.oldDepartment || undefined,
        newDepartment: addendum.newDepartment || undefined,
        oldSalary: addendum.oldSalary || undefined,
        newSalary: addendum.newSalary || undefined,
        oldSalaryInWords: addendum.oldSalaryInWords || undefined,
        newSalaryInWords: addendum.newSalaryInWords || undefined,
        oldConfirmationDate: addendum.oldConfirmationDate || undefined,
        newConfirmationDate: addendum.newConfirmationDate || undefined,
        customClauseTitle: addendum.customClauseTitle || undefined,
        customClauseText: addendum.customClauseText || undefined,
        deviceItems: Array.isArray(addendum.deviceItems) && addendum.deviceItems.length > 0 ? addendum.deviceItems as any[] : undefined,
        annexures: Array.isArray(addendum.annexures) && (addendum.annexures as any[]).length > 0 ? addendum.annexures as any[] : undefined,
        reason: addendum.reason || undefined,
        growthPlanClauseText: addendum.growthPlanClauseText || undefined,
      });

      const fileName = `${addendum.candidateName.replace(/\s+/g, "_")}_Addendum_${addendum.addendumType}.docx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Download standalone addendum error:", error);
      res.status(500).json({ error: "Failed to generate addendum document" });
    }
  });

  // Cancel standalone addendum
  app.post("/api/hr/tools/addendums/:addendumId/cancel", requireAuth, requirePermission("hr.tools.addendums.cancel", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const addendum = await storage.getAddendum(req.params.addendumId);
      if (!addendum || !addendum.isStandalone) {
        return res.status(404).json({ error: "Standalone addendum not found" });
      }
      if (addendum.status !== "draft" && addendum.status !== "sent") {
        return res.status(400).json({ error: "Can only cancel draft or sent addendums" });
      }
      await storage.updateAddendumStatus(addendum.id, { status: "cancelled" });
      await storage.createAuditLog({
        action: "standalone_addendum_cancelled",
        actorId: req.session.userId!,
        changes: { addendumId: addendum.id, previousStatus: addendum.status },
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Cancel standalone addendum error:", error);
      res.status(500).json({ error: "Failed to cancel addendum" });
    }
  });

  // Resend standalone addendum email
  app.post("/api/hr/tools/addendums/:addendumId/send", requireAuth, requirePermission("hr.tools.addendums.send", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const addendum = await storage.getAddendum(req.params.addendumId);
      if (!addendum || !addendum.isStandalone) {
        return res.status(404).json({ error: "Standalone addendum not found" });
      }
      const med = addendum.manualEmployeeData && typeof addendum.manualEmployeeData === "object"
        ? addendum.manualEmployeeData as Record<string, any>
        : {};
      const toEmail = med.email || null;
      if (!toEmail) {
        return res.status(400).json({ error: "No employee email on record for this addendum" });
      }

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";
      const acceptUrl = `${protocol}://${host}/addendum/${addendum.token}`;

      const storedCcEmails = addendum.ccEmails
        ? addendum.ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean)
        : [];

      // A draft being sent for the first time gets the original issuance email.
      // A pending (already-sent, not yet signed) addendum gets a reminder-styled
      // nudge with the days-remaining / expiry framing instead.
      const isReminder = addendum.status === "sent" && !addendum.acceptedAt;
      let emailResult: { success: boolean; error?: string };
      if (isReminder) {
        const expiresAt = addendum.expiresAt ? new Date(addendum.expiresAt) : (() => {
          const d = new Date();
          d.setDate(d.getDate() + 7);
          return d;
        })();
        const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        emailResult = await sendAddendumReminderEmail({
          to: toEmail,
          candidateName: addendum.candidateName,
          addendumType: addendum.addendumType,
          acceptUrl,
          expiresAt,
          daysLeft,
          cc: storedCcEmails.length > 0 ? storedCcEmails : undefined,
        });
      } else {
        emailResult = await sendAddendumEmail({
          to: toEmail,
          candidateName: addendum.candidateName,
          addendumType: addendum.addendumType,
          acceptUrl,
          cc: storedCcEmails.length > 0 ? storedCcEmails : undefined,
        });
      }

      if (addendum.status === "draft") {
        await storage.updateAddendumStatus(addendum.id, { status: "sent" });
      } else if (isReminder && emailResult.success) {
        await storage.updateAddendumStatus(addendum.id, { reminderSentAt: new Date() });
      }

      await storage.createAuditLog({
        action: isReminder ? "standalone_addendum_reminder_sent" : "standalone_addendum_resent",
        actorId: req.session.userId!,
        changes: { addendumId: addendum.id, emailSent: emailResult.success, reminder: isReminder },
      });

      res.json({ success: emailResult.success, error: emailResult.success ? undefined : emailResult.error });
    } catch (error: any) {
      console.error("Resend standalone addendum error:", error);
      res.status(500).json({ error: "Failed to resend addendum email" });
    }
  });

  // HR: Counter-sign addendum
  app.post("/api/hr/tools/addendums/:addendumId/countersign", requireAuth, requirePermission("hr.tools.addendums.countersign", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const addendum = await storage.getAddendum(req.params.addendumId);
      if (!addendum) {
        return res.status(404).json({ error: "Addendum not found" });
      }
      if (addendum.status !== "accepted") {
        return res.status(400).json({ error: `Cannot counter-sign — addendum status is '${addendum.status}', must be 'accepted'` });
      }

      const now = new Date();

      const { signAddendumCountersign } = await import("./documentSigningService");
      const { counterAuthCode, counterDocumentHash } = signAddendumCountersign(addendum, req.session.userId!, now);

      await storage.updateAddendumStatus(addendum.id, {
        status: "countersigned",
        counterSignedBy: req.session.userId,
        counterSignedAt: now,
        counterAuthCode,
        counterDocumentHash,
      });

      await recordSignature({
        documentType: "addendum_counter",
        documentId: addendum.id,
        referenceNumber: addendum.id,
        signerName: addendum.candidateName,
        signerRole: "hr",
        signerUserId: req.session.userId,
        signedAt: now,
        contentHash: counterDocumentHash,
        authCode: counterAuthCode,
      });

      await storage.createAuditLog({
        action: "addendum_countersigned",
        actorId: req.session.userId!,
        changes: { addendumId: addendum.id, counterAuthCode },
      });

      // Activation engine (idempotent): ensure an addendum's attached plan is in
      // effect even if it was accepted before this feature existed. The legacy
      // growth-plan clause still activates a growth plan when no explicit type is
      // attached. Non-fatal.
      const countersignAttachedType: AttachablePlanType | null =
        ((addendum as any).attachedPlanType as AttachablePlanType | null)
        || (addendum.includeGrowthPlanClause ? "growth" : null);
      if (countersignAttachedType) {
        try {
          const r = await ensurePlanFromDocument({
            planType: countersignAttachedType,
            employeeId: addendum.forEmployeeId ?? null,
            offerLetterId: addendum.offerLetterId ?? null,
            effectiveDate: addendum.effectiveDate ?? null,
            // Use the EMPLOYEE's stored acceptance date (not the countersign date),
            // since activation can happen at accept or here at countersign.
            signatureDate: addendum.acceptedAt ?? null,
            createdBy: req.session.userId!,
            department: (addendum as any).attachedPlanDepartment ?? null,
            role: (addendum as any).attachedPlanRole ?? null,
            level: (addendum as any).attachedPlanLevel ?? null,
            designation: (addendum as any).newDesignation ?? (addendum as any).oldDesignation ?? null,
            departmentName: (addendum as any).newDepartment ?? (addendum as any).oldDepartment ?? null,
          });
          if (r.created) console.log(`[Addendum] ${countersignAttachedType} plan activated on countersign of ${addendum.id} -> plan ${r.planId}`);
        } catch (planErr) {
          console.error("[Addendum] Plan activation on countersign failed (non-fatal):", planErr);
        }
      }

      // Centralized compensation safety net: write back the salary even if the
      // addendum predates the accept-time hook. Idempotent per addendum.
      try {
        const { applyAddendumSalaryChange } = await import("./salaryLedger");
        await applyAddendumSalaryChange(addendum, req.session.userId!);
      } catch (salErr) {
        console.error("[Addendum] Salary write-back on countersign failed (non-fatal):", salErr);
      }

      res.json({ success: true, counterAuthCode });
    } catch (error) {
      console.error("Counter-sign addendum error:", error);
      res.status(500).json({ error: "Failed to counter-sign addendum" });
    }
  });

  // Start onboarding — creates employee profile
  app.post("/api/hr/tools/offer-letters/:id/start-onboarding", requireAuth, requirePermission("hr.tools.offerLetters.startOnboarding", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const letter = await storage.getOfferLetter(req.params.id);
      if (!letter) {
        return res.status(404).json({ error: "Offer letter not found" });
      }

      if (letter.status !== "countersigned") {
        return res.status(400).json({ error: `Cannot onboard — offer status is '${letter.status}', must be 'countersigned'` });
      }

      // Managers may only onboard candidates from their own offer letters
      const actingUser = await storage.getAdminUser(req.session.userId!);
      if (actingUser?.role === "manager" && letter.createdBy !== req.session.userId!) {
        return res.status(403).json({ error: "Managers can only initiate onboarding for offer letters they created" });
      }

      const { hireInEmail } = req.body;
      if (!hireInEmail || !hireInEmail.endsWith("@hire-in.com")) {
        return res.status(400).json({ error: "Email must end with @hire-in.com" });
      }

      const existingUser = await storage.getAdminUserByEmail(hireInEmail.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: "This @hire-in.com email is already in use" });
      }

      const nameParts = letter.candidateName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

      let deptName: string | null = null;
      if (letter.departmentId) {
        const dept = await storage.getDepartment(letter.departmentId);
        if (dept) deptName = dept.name;
      }

      const employeeId = await generateEmployeeId(deptName);

      const tempPassword = crypto.randomBytes(6).toString("base64url") + "A1!";
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      const actorId = req.session.userId!;

      const { resolveOfferOpeningSalary, applyOfferSalaryChange } = await import("./salaryLedger");
      const openingSalary = resolveOfferOpeningSalary(letter);

      const newUser = await storage.createAdminUser({
        email: hireInEmail.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role: "employee",
        isActive: true,
        joiningDate: letter.proposedStartDate || new Date().toISOString().slice(0, 10),
        designation: letter.designation || null,
        departmentId: letter.departmentId || null,
        hierarchyLevel: "team_member",
        salary: openingSalary != null ? openingSalary.toFixed(2) : (letter.salary || null),
        employeeId,
        managerId: letter.reportingToUserId || null,
        gender: (letter as any).gender || null,
        employmentType: (letter as any).employmentType || null,
        attendanceExempt: (letter as any).attendanceExempt ?? false,
        trainingExempt: (letter as any).trainingExempt ?? false,
        maternityLeaveEligible: (letter as any).maternityLeaveEligible ?? false,
      });

      await storage.updateOfferLetter(letter.id, {
        status: "onboarded",
        onboardedAt: new Date(),
        hireInEmail: hireInEmail.toLowerCase(),
        resultingUserId: newUser.id,
        onboardedBy: actorId,
      });

      // Centralized compensation: record the offer salary in the salary-change
      // ledger as the new hire's opening compensation (probation salary when set;
      // a future-dated post-probation entry is added automatically). The salary
      // was already set on the user record above, so apply=false avoids a
      // redundant write-back. Idempotent — if acceptance already wrote it back
      // (legacy employee path) this is a no-op.
      try {
        await applyOfferSalaryChange(letter, actorId, { employeeId: newUser.id, apply: false });
      } catch (ledgerErr) {
        console.error("Offer-letter salary ledger entry failed (non-fatal):", ledgerErr);
      }

      // Bridge policy annexures the candidate signed at offer acceptance into
      // policy-track completions so they are never asked to re-sign them.
      try {
        const { bridgeAnnexuresForUser } = await import("./annexureBridge");
        await bridgeAnnexuresForUser(newUser.id);
      } catch (bridgeErr) {
        console.error("Annexure bridge at onboarding failed (non-fatal):", bridgeErr);
      }

      await storage.initializeEmployeeDocuments(newUser.id, newUser.employeeCategory ?? "experienced");

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";
      const loginUrl = `${protocol}://${host}/admin/login`;

      await sendOnboardingWelcomeEmail({
        to: hireInEmail.toLowerCase(),
        firstName,
        lastName,
        employeeId,
        temporaryPassword: tempPassword,
        designation: letter.designation,
        loginUrl,
      });

      await storage.createAuditLog({
        action: "employee_onboarded",
        actorId,
        targetId: newUser.id,
        changes: { candidateName: letter.candidateName, email: hireInEmail, employeeId, offerLetterId: letter.id },
      });

      let rayoProvisioning: { success: boolean; tempPassword?: string; error?: string } | null = null;
      try {
        const rayoEnabled = await isRayoEnabled();
        if (rayoEnabled) {
          rayoProvisioning = await provisionRayoUser(
            hireInEmail.toLowerCase(),
            firstName,
            lastName,
            "employee"
          );
          if (rayoProvisioning.success) {
            await storage.createAuditLog({
              actorId,
              targetId: newUser.id,
              action: "rayo_academy_provisioned",
              changes: { email: hireInEmail.toLowerCase(), rayoTempPassword: "[redacted]" },
            });
            if (rayoProvisioning.tempPassword) {
              sendRayoAcademyCredentialsEmail({
                to: hireInEmail.toLowerCase(),
                firstName,
                tempPassword: rayoProvisioning.tempPassword,
              }).catch((err) => console.error("Failed to send Rayo credentials email:", err));
            }
          }
        }
      } catch (err) {
        console.error("Rayo Academy provisioning failed (non-fatal):", err);
      }

      // ── Activate the pending plan seeded at offer acceptance ─────────────
      // Phase 2: generalized to any attached plan type (probation/growth/pip).
      // We key off the pending plan row's own plan_type rather than the legacy
      // seedProbationPlan flag, so growth/pip attachments activate identically.
      try {
        // Find the pending plan created at offer acceptance (linked by offer_letter_id)
        const pendingPlanResult = await db.execute(sql`
          SELECT * FROM employee_plans
          WHERE offer_letter_id = ${letter.id} AND status = 'pending'
          LIMIT 1
        `);

        if (pendingPlanResult.rows.length > 0) {
          const pendingPlan = pendingPlanResult.rows[0] as any;
          const planType = (pendingPlan.plan_type as AttachablePlanType) || "probation";
          const joiningDate: string = newUser.joiningDate || new Date().toISOString().slice(0, 10);

          // Recalculate the window from the actual joining date. Probation honors
          // the offer's probation duration in months; growth/pip use day windows.
          let endDateStr: string;
          let durationDays: number;
          if (planType === "probation") {
            const probationMonths: number = (letter as any).probationPeriodMonths || 3;
            const endDate = new Date(joiningDate);
            endDate.setMonth(endDate.getMonth() + probationMonths);
            endDateStr = endDate.toISOString().slice(0, 10);
            durationDays = Math.round((endDate.getTime() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24));
          } else {
            durationDays = planType === "pip" ? 30 : 90;
            endDateStr = new Date(new Date(joiningDate).getTime() + durationDays * 86400000)
              .toISOString().slice(0, 10);
          }

          // Activate plan: fill in employee_id, manager_id, recalculate dates from actual joining date
          await db.execute(sql`
            UPDATE employee_plans SET
              employee_id = ${newUser.id},
              manager_id = ${newUser.managerId ?? null},
              status = 'active',
              start_date = ${joiningDate},
              end_date = ${endDateStr},
              duration_days = ${durationDays},
              updated_at = NOW()
            WHERE id = ${pendingPlan.id}
          `);

          // Seed goals via the generalized resolver: probation → cross-department
          // framework (universal + role/level milestones, legacy fallback);
          // growth/pip → plan_goal_templates by the offer's attached key.
          const resolvedGoals = await resolveAttachedPlanGoals({
            planType,
            department: (letter as any).attachedPlanDepartment ?? null,
            role: (letter as any).attachedPlanRole ?? null,
            level: (letter as any).attachedPlanLevel ?? null,
            designation: letter.designation,
            departmentName: deptName,
          });
          await seedPlanGoals(pendingPlan.id, newUser.id, newUser.managerId ?? null, joiningDate, endDateStr, resolvedGoals);

          // Generate the SOP check-in schedule for this plan type from the actual
          // joining date (probation = Day 1/7/15/30/45/60/75/90 milestones).
          const checkInSchedule = generatePlanCheckIns(
            pendingPlan.id, newUser.id, newUser.managerId ?? null, planType, joiningDate, endDateStr,
          );
          for (const ci of checkInSchedule) {
            await db.execute(sql`
              INSERT INTO check_ins (employee_id, manager_id, plan_id, check_in_type, scheduled_date, status)
              VALUES (${ci.employeeId}, ${ci.managerId}, ${ci.planId}, ${ci.checkInType}::check_in_type, ${ci.scheduledDate}, 'scheduled'::check_in_status)
            `);
          }

          await storage.createAuditLog({
            action: "plan_activated",
            actorId,
            targetId: newUser.id,
            changes: { planId: pendingPlan.id, planType, joiningDate, endDate: endDateStr, durationDays, goalsSeeded: resolvedGoals.length },
          });
        }
      } catch (planErr) {
        console.error("[Onboarding] Plan activation failed (non-fatal):", planErr);
      }

      res.json({ success: true, userId: newUser.id, employeeId, rayoProvisioning });
    } catch (error: any) {
      console.error("Start onboarding error:", error);
      res.status(500).json({ error: error.message || "Failed to start onboarding" });
    }
  });

  // New Hire onboarding status — recent employees with setup checklist
  app.get("/api/hr/new-hire/onboarding-status", requireAuth, requirePermission("hr.newHire.onboardingStatus", "super_admin", "admin", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.employee_id,
          u.designation,
          u.joining_date,
          u.role,
          u.gender,
          u.employment_type,
          u.attendance_exempt,
          u.training_exempt,
          u.maternity_leave_eligible,
          d.name AS department_name,
          COALESCE((
            SELECT COUNT(*)::int FROM employee_documents WHERE user_id = u.id
          ), 0) AS document_count,
          EXISTS (
            SELECT 1 FROM employee_bank_details WHERE user_id = u.id LIMIT 1
          ) AS has_bank_details,
          EXISTS (
            SELECT 1 FROM night_shift_consents WHERE user_id = u.id AND is_active = true LIMIT 1
          ) AS has_ns_consent,
          COALESCE((
            SELECT ROUND(
              100.0 * COUNT(CASE WHEN sp.completed_at IS NOT NULL THEN 1 END)
                    / NULLIF(COUNT(ts.id), 0)
            )::int
            FROM track_assignments ta
            JOIN track_sections ts ON ts.track_id = ta.track_id
            LEFT JOIN section_progress sp
              ON sp.assignment_id = ta.id AND sp.section_id = ts.id
            WHERE ta.user_id = u.id
          ), 0) AS training_pct
        FROM admin_users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE (u.joining_date IS NULL OR u.joining_date >= CURRENT_DATE - INTERVAL '90 days')
          AND u.is_active = true
          AND u.deleted_at IS NULL
          AND u.role NOT IN ('super_admin', 'admin')
        ORDER BY u.joining_date DESC NULLS LAST
      `);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cancel offer letter
  // Admin: Reactivate expired/sent offer letter (reset expiry + resend email)
  app.post("/api/hr/tools/offer-letters/:id/reactivate", requireAuth, requirePermission("hr.tools.offerLetters.cancel", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const letter = await storage.getOfferLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Offer letter not found" });
      if (["accepted", "onboarded", "countersigned", "cancelled", "rejected"].includes(letter.status)) {
        return res.status(400).json({ error: `Cannot reactivate — offer status is '${letter.status}'` });
      }
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);
      await storage.updateOfferLetter(letter.id, { status: "sent", expiresAt: newExpiresAt, reminderSentAt: null });

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";
      const acceptUrl = `${protocol}://${host}/onboard/${letter.token}`;
      const ccList = letter.ccEmails ? letter.ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean) : [];
      const { sendOfferLetterEmail } = await import("./email");
      await sendOfferLetterEmail({
        to: letter.candidatePersonalEmail,
        candidateName: letter.candidateName,
        designation: letter.designation,
        acceptUrl,
        expiresAt: newExpiresAt,
        cc: ccList.length > 0 ? ccList : undefined,
      });

      await storage.createAuditLog({
        action: "offer_letter_reactivated",
        actorId: req.session.userId!,
        changes: { offerId: letter.id, candidateName: letter.candidateName, newExpiresAt: newExpiresAt.toISOString() },
      });
      res.json({ success: true, expiresAt: newExpiresAt });
    } catch (error) {
      console.error("Reactivate offer letter error:", error);
      res.status(500).json({ error: "Failed to reactivate offer letter" });
    }
  });

  // Admin: Reactivate expired addendum (reset expiry + resend email)
  app.post("/api/hr/tools/addendums/:id/reactivate", requireAuth, requirePermission("hr.tools.addendums.cancel", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const addendum = await storage.getAddendum(req.params.id);
      if (!addendum) return res.status(404).json({ error: "Addendum not found" });
      if (["accepted", "countersigned", "cancelled"].includes(addendum.status)) {
        return res.status(400).json({ error: `Cannot reactivate — addendum status is '${addendum.status}'` });
      }
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);
      await storage.updateAddendumStatus(addendum.id, { status: "sent", expiresAt: newExpiresAt, reminderSentAt: null } as any);

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";
      const acceptUrl = `${protocol}://${host}/addendum/${addendum.token}`;
      const ccList = addendum.ccEmails ? addendum.ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean) : [];

      let recipientEmail = "";
      let recipientName = addendum.candidateName;
      if (addendum.offerLetterId) {
        const offerLetter = await storage.getOfferLetter(addendum.offerLetterId);
        recipientEmail = offerLetter?.candidatePersonalEmail || "";
      } else if (addendum.forEmployeeId) {
        const emp = await storage.getAdminUser(addendum.forEmployeeId);
        recipientEmail = emp?.email || "";
      }

      if (recipientEmail) {
        const { sendAddendumEmail } = await import("./email");
        await sendAddendumEmail({
          to: recipientEmail,
          candidateName: recipientName,
          addendumType: addendum.addendumType,
          acceptUrl,
          cc: ccList.length > 0 ? ccList : undefined,
        });
      }

      await storage.createAuditLog({
        action: "addendum_reactivated",
        actorId: req.session.userId!,
        changes: { addendumId: addendum.id, candidateName: addendum.candidateName, newExpiresAt: newExpiresAt.toISOString() },
      });
      res.json({ success: true, expiresAt: newExpiresAt });
    } catch (error) {
      console.error("Reactivate addendum error:", error);
      res.status(500).json({ error: "Failed to reactivate addendum" });
    }
  });

  app.post("/api/hr/tools/offer-letters/:id/cancel", requireAuth, requirePermission("hr.tools.offerLetters.cancel", "super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const letter = await storage.getOfferLetter(req.params.id);
      if (!letter) {
        return res.status(404).json({ error: "Offer letter not found" });
      }

      if (!["sent", "viewed"].includes(letter.status)) {
        return res.status(400).json({ error: `Cannot cancel — offer status is '${letter.status}'` });
      }

      await storage.updateOfferLetter(letter.id, { status: "cancelled" });

      // Clean up any pending plan seeded for this offer (no employee/check-ins yet).
      await db.execute(sql`
        DELETE FROM employee_plans
        WHERE offer_letter_id = ${letter.id} AND status = 'pending' AND employee_id IS NULL
      `);

      await storage.createAuditLog({
        action: "offer_letter_cancelled",
        actorId: req.session.userId!,
        changes: { offerId: letter.id, candidateName: letter.candidateName },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Cancel offer letter error:", error);
      res.status(500).json({ error: "Failed to cancel offer letter" });
    }
  });

  // Withdraw/recall a pending_approval offer letter (creator or super admin). Sets status to
  // 'cancelled' and pulls it out of the approval queue. No HR/approver notification is sent.
  app.post("/api/hr/tools/offer-letters/:id/withdraw", requireAuth, requirePermission("hr.tools.offerLetters", "super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const actorId = req.session.userId!;
      const isSuperAdmin = req.session.role === "super_admin";
      const letter = await storage.getOfferLetter(req.params.id);
      if (!letter) {
        return res.status(404).json({ error: "Offer letter not found" });
      }

      if (!isSuperAdmin && letter.createdBy !== actorId) {
        return res.status(403).json({ error: "You can only withdraw offer letters you created" });
      }

      if (letter.status !== "pending_approval") {
        return res.status(400).json({ error: `Cannot withdraw — offer status is '${letter.status}'` });
      }

      await storage.updateOfferLetter(letter.id, { status: "cancelled" });

      // Clean up any pending plan seeded for this offer (no employee/check-ins yet).
      await db.execute(sql`
        DELETE FROM employee_plans
        WHERE offer_letter_id = ${letter.id} AND status = 'pending' AND employee_id IS NULL
      `);

      await storage.createAuditLog({
        action: "offer_letter_withdrawn",
        actorId,
        changes: { offerId: letter.id, candidateName: letter.candidateName },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Withdraw offer letter error:", error);
      res.status(500).json({ error: "Failed to withdraw offer letter" });
    }
  });

  // ==========================================
  // MY TEAM API ROUTES (with edit and audit trail)
  // ==========================================

  app.get("/api/admin/my-team", requireAuth, requirePermission("admin.myTeam", "super_admin", "admin", "hr", "operations", "manager"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role!;

      const allUsers = await storage.getAdminUsers();
      const allDepartments = await storage.getDepartments();
      const deptMap = new Map(allDepartments.map(d => [d.id, d.name]));

      let teamMembers: typeof allUsers;
      let directReportIds: Set<string> = new Set();

      if (["super_admin", "admin", "hr", "operations"].includes(userRole)) {
        teamMembers = allUsers;
      } else {
        const direct = allUsers.filter(u => u.managerId === userId);
        directReportIds = new Set(direct.map(u => u.id));

        const allReportees: typeof allUsers = [];
        const visited = new Set<string>();
        const queue = [userId];
        while (queue.length > 0) {
          const mgr = queue.shift()!;
          if (visited.has(mgr)) continue;
          visited.add(mgr);
          const reports = allUsers.filter(u => u.managerId === mgr);
          for (const r of reports) {
            allReportees.push(r);
            queue.push(r.id);
          }
        }
        teamMembers = allReportees;
      }

      const result = teamMembers.map(u => ({
        id: u.id,
        employeeId: u.employeeId,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        designation: u.designation,
        departmentId: u.departmentId,
        departmentName: u.departmentId ? deptMap.get(u.departmentId) || null : null,
        joiningDate: u.joiningDate,
        isActive: u.isActive,
        hierarchyLevel: u.hierarchyLevel,
        isDirect: userRole === "manager" ? directReportIds.has(u.id) : true,
      }));

      res.json({ members: result, role: userRole });
    } catch (error) {
      console.error("My team error:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  async function getAllReporteeIds(managerId: string): Promise<string[]> {
    const result: string[] = [];
    const queue = [managerId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const directReports = await storage.getTeamMembers(currentId);
      for (const report of directReports) {
        result.push(report.id);
        queue.push(report.id);
      }
    }
    return result;
  }

  async function validateMyTeamAccess(req: Request, res: Response, targetUserId: string): Promise<boolean> {
    const actorRole = req.session.role!;
    const actorId = req.session.userId!;

    if (["super_admin", "admin", "hr", "operations"].includes(actorRole)) {
      return true;
    }

    if (actorRole === "manager") {
      const reporteeIds = await getAllReporteeIds(actorId);
      if (reporteeIds.includes(targetUserId)) {
        return true;
      }
    }

    res.status(403).json({ error: "You do not have permission to edit this employee's data" });
    return false;
  }

  app.patch("/api/admin/my-team/:userId/attendance/:attendanceId", requirePermission("admin.myTeam.attendance", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId, attendanceId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const { punchIn, punchOut, status, note } = req.body;
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Reason for change is required" });
      }

      const existing = await storage.getAttendanceByUser(userId);
      const record = existing.find(r => r.id === attendanceId);
      if (!record) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      if (record.userId !== userId) {
        return res.status(403).json({ error: "Attendance record does not belong to this user" });
      }

      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const updateData: any = {};

      if (punchIn !== undefined) {
        before.punchIn = record.punchIn;
        after.punchIn = punchIn;
        updateData.punchIn = punchIn ? new Date(punchIn) : null;
      }
      if (punchOut !== undefined) {
        before.punchOut = record.punchOut;
        after.punchOut = punchOut;
        updateData.punchOut = punchOut ? new Date(punchOut) : null;
      }
      if (status !== undefined) {
        before.status = record.status;
        after.status = status;
        updateData.status = status;
      }

      if (updateData.punchIn && updateData.punchOut) {
        const diffMs = new Date(updateData.punchOut).getTime() - new Date(updateData.punchIn).getTime();
        updateData.totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
      } else if (updateData.punchIn && record.punchOut) {
        const diffMs = new Date(record.punchOut).getTime() - new Date(updateData.punchIn).getTime();
        updateData.totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
      } else if (updateData.punchOut && record.punchIn) {
        const diffMs = new Date(updateData.punchOut).getTime() - new Date(record.punchIn).getTime();
        updateData.totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
      }

      const updated = await storage.updateAttendance(attendanceId, updateData);

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "edit_attendance",
        changes: { before, after, note: note.trim(), attendanceId, date: record.date },
      });

      res.json(updated);
    } catch (error) {
      console.error("Edit attendance error:", error);
      res.status(500).json({ error: "Failed to update attendance" });
    }
  });

  app.patch("/api/admin/my-team/:userId/profile", requirePermission("admin.myTeam.profile", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const { designation, departmentId, hierarchyLevel, gender, employmentType, employeeCategory, attendanceExempt, trainingExempt, maternityLeaveEligible, note } = req.body;
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Reason for change is required" });
      }

      const targetUser = await storage.getAdminUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const updateData: any = {};

      if (designation !== undefined) {
        before.designation = targetUser.designation;
        after.designation = designation;
        updateData.designation = designation;
      }
      if (departmentId !== undefined) {
        before.departmentId = targetUser.departmentId;
        after.departmentId = departmentId;
        updateData.departmentId = departmentId;
      }
      if (hierarchyLevel !== undefined) {
        before.hierarchyLevel = targetUser.hierarchyLevel;
        after.hierarchyLevel = hierarchyLevel;
        updateData.hierarchyLevel = hierarchyLevel;
      }
      if (gender !== undefined) {
        before.gender = (targetUser as any).gender;
        after.gender = gender;
        updateData.gender = gender;
      }
      if (employmentType !== undefined) {
        before.employmentType = (targetUser as any).employmentType;
        after.employmentType = employmentType;
        updateData.employmentType = employmentType;
      }
      if (employeeCategory !== undefined) {
        before.employeeCategory = (targetUser as any).employeeCategory;
        after.employeeCategory = employeeCategory;
        updateData.employeeCategory = employeeCategory;
      }
      if (attendanceExempt !== undefined) {
        before.attendanceExempt = targetUser.attendanceExempt;
        after.attendanceExempt = attendanceExempt;
        updateData.attendanceExempt = attendanceExempt;
      }
      if (trainingExempt !== undefined) {
        before.trainingExempt = (targetUser as any).trainingExempt;
        after.trainingExempt = trainingExempt;
        updateData.trainingExempt = trainingExempt;
      }
      if (maternityLeaveEligible !== undefined) {
        before.maternityLeaveEligible = (targetUser as any).maternityLeaveEligible;
        after.maternityLeaveEligible = maternityLeaveEligible;
        updateData.maternityLeaveEligible = maternityLeaveEligible;
      }

      const updated = await storage.updateAdminUser(userId, updateData);

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "edit_profile",
        changes: { before, after, note: note.trim() },
      });

      res.json(updated);
    } catch (error) {
      console.error("Edit profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/admin/my-team/:userId/regional-holidays", requirePermission("admin.myTeam.regionalHolidays", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const { holidayId, note } = req.body;
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Reason for change is required" });
      }
      if (!holidayId) {
        return res.status(400).json({ error: "holidayId is required" });
      }

      const holiday = await storage.getHoliday(holidayId);
      if (!holiday || holiday.type !== "regional") {
        return res.status(400).json({ error: "Invalid regional holiday" });
      }

      const holidayYear = parseInt(holiday.date.substring(0, 4)) || new Date().getFullYear();
      const existing = await storage.getRegionalHolidaySelections(userId, holidayYear);
      if (existing.some(s => s.holidayId === holidayId)) {
        return res.status(400).json({ error: "This holiday is already selected for this employee" });
      }

      const selection = await storage.createRegionalHolidaySelection({
        userId,
        holidayId,
        year: holidayYear,
      });

      await storage.stampHolidayAttendance(userId, holiday.date, "regional");

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "add_regional_holiday",
        changes: { holidayId, holidayName: holiday.name, holidayDate: holiday.date, note: note.trim() },
      });

      res.status(201).json(selection);
    } catch (error) {
      console.error("Add regional holiday error:", error);
      res.status(500).json({ error: "Failed to add regional holiday" });
    }
  });

  app.delete("/api/admin/my-team/:userId/regional-holidays/:selectionId", requirePermission("admin.myTeam.regionalHolidays", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId, selectionId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const { note } = req.body;
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Reason for change is required" });
      }

      const year = new Date().getFullYear();
      const selections = await storage.getRegionalHolidaySelections(userId, year);
      const selection = selections.find(s => s.id === selectionId);

      if (selection) {
        const holiday = await storage.getHoliday(selection.holidayId);
        if (holiday) {
          await storage.removeUserHolidayAttendanceStamp(userId, holiday.date, "regional");
        }
        await storage.createAuditLog({
          actorId: req.session.userId!,
          targetId: userId,
          action: "remove_regional_holiday",
          changes: { selectionId, holidayId: selection.holidayId, holidayName: holiday?.name, note: note.trim() },
        });
      }

      await storage.deleteRegionalHolidaySelection(selectionId);
      res.status(204).send();
    } catch (error) {
      console.error("Remove regional holiday error:", error);
      res.status(500).json({ error: "Failed to remove regional holiday" });
    }
  });

  app.post("/api/admin/my-team/:userId/emergency-contacts", requirePermission("admin.myTeam.emergencyContacts", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const { name, relationship, phone, email, address, isPrimary, note } = req.body;
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Reason for change is required" });
      }
      if (!name || !relationship || !phone) {
        return res.status(400).json({ error: "Name, relationship, and phone are required" });
      }

      const contact = await storage.createEmergencyContact({
        userId,
        name,
        relationship,
        phone,
        email: email || null,
        address: address || null,
        isPrimary: isPrimary || false,
      });

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "add_emergency_contact",
        changes: { contactId: contact.id, name, relationship, phone, note: note.trim() },
      });

      res.status(201).json(contact);
    } catch (error) {
      console.error("Add emergency contact error:", error);
      res.status(500).json({ error: "Failed to add emergency contact" });
    }
  });

  app.patch("/api/admin/my-team/:userId/emergency-contacts/:contactId", requirePermission("admin.myTeam.emergencyContacts", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId, contactId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const { note, ...updates } = req.body;
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Reason for change is required" });
      }

      const existingContacts = await storage.getEmergencyContacts(userId);
      const existing = existingContacts.find(c => c.id === contactId);
      if (!existing) {
        return res.status(404).json({ error: "Emergency contact not found" });
      }

      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      for (const key of ["name", "relationship", "phone", "email", "address", "isPrimary"] as const) {
        if (updates[key] !== undefined && updates[key] !== existing[key]) {
          before[key] = existing[key];
          after[key] = updates[key];
        }
      }

      const updated = await storage.updateEmergencyContact(contactId, updates);

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "edit_emergency_contact",
        changes: { contactId, before, after, note: note.trim() },
      });

      res.json(updated);
    } catch (error) {
      console.error("Edit emergency contact error:", error);
      res.status(500).json({ error: "Failed to update emergency contact" });
    }
  });

  app.delete("/api/admin/my-team/:userId/emergency-contacts/:contactId", requirePermission("admin.myTeam.emergencyContacts", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId, contactId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const { note } = req.body;
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Reason for change is required" });
      }

      const existingContacts = await storage.getEmergencyContacts(userId);
      const existing = existingContacts.find(c => c.id === contactId);

      await storage.deleteEmergencyContact(contactId);

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "delete_emergency_contact",
        changes: { contactId, deleted: existing ? { name: existing.name, relationship: existing.relationship, phone: existing.phone } : null, note: note.trim() },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Delete emergency contact error:", error);
      res.status(500).json({ error: "Failed to delete emergency contact" });
    }
  });

  app.patch("/api/admin/my-team/:userId/tickets/:ticketId", requirePermission("admin.myTeam.tickets", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId, ticketId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const { status, reviewComment, note } = req.body;
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Reason for change is required" });
      }
      if (!["in_review", "resolved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'in_review', 'resolved', or 'rejected'" });
      }

      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticket.userId !== userId) {
        return res.status(403).json({ error: "Ticket does not belong to this user" });
      }

      const before = { status: ticket.status, reviewComment: ticket.reviewComment };

      const updated = await storage.updateTicket(ticketId, {
        status,
        reviewComment: reviewComment || note.trim(),
        reviewedBy: req.session.userId!,
        reviewedAt: new Date(),
      });

      if (status === "resolved" && ticket.attendanceId && ticket.requestedPunchIn) {
        const updateData: any = {};
        if (ticket.requestedPunchIn) updateData.punchIn = ticket.requestedPunchIn;
        if (ticket.requestedPunchOut) updateData.punchOut = ticket.requestedPunchOut;
        if (updateData.punchIn && updateData.punchOut) {
          const diffMs = new Date(updateData.punchOut).getTime() - new Date(updateData.punchIn).getTime();
          updateData.totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
        }
        await storage.updateAttendance(ticket.attendanceId, updateData);
      }

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: userId,
        action: "review_ticket",
        changes: { ticketId, before, after: { status, reviewComment: reviewComment || note.trim() }, note: note.trim() },
      });

      res.json(updated);
    } catch (error) {
      console.error("Review ticket error:", error);
      res.status(500).json({ error: "Failed to review ticket" });
    }
  });

  app.get("/api/admin/my-team/:userId/audit-log", requirePermission("admin.myTeam.auditLog", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const [logs, total] = await Promise.all([
        storage.getAuditLogs({ targetId: userId, limit, offset }),
        storage.getAuditLogCount({ targetId: userId }),
      ]);

      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, { firstName: u.firstName, lastName: u.lastName, email: u.email }]));

      const enrichedLogs = logs.map(log => ({
        ...log,
        actorName: userMap.get(log.actorId) ? `${userMap.get(log.actorId)!.firstName} ${userMap.get(log.actorId)!.lastName}` : "Unknown",
        actorEmail: userMap.get(log.actorId)?.email || "Unknown",
        targetName: log.targetId && userMap.get(log.targetId) ? `${userMap.get(log.targetId)!.firstName} ${userMap.get(log.targetId)!.lastName}` : "Unknown",
      }));

      res.json({ logs: enrichedLogs, total });
    } catch (error) {
      console.error("Audit log error:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/admin/my-team/:userId/details", requirePermission("admin.myTeam.details", "hr", "manager", "operations"), async (req, res) => {
    try {
      const { userId } = req.params;
      const hasAccess = await validateMyTeamAccess(req, res, userId);
      if (!hasAccess) return;

      const user = await storage.getAdminUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const today = new Date().toISOString().split("T")[0];
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const year = new Date().getFullYear();

      const [attendanceRecords, emergencyContacts, tickets, regionalSelections, departments, salarySlips, allHolidays, leaveBalances, leaveRequests] = await Promise.all([
        storage.getAttendanceByUser(userId, ninetyDaysAgo, today),
        storage.getEmergencyContacts(userId),
        storage.getTickets({ userId }),
        storage.getRegionalHolidaySelections(userId, year),
        storage.getDepartments(),
        storage.getSalarySlipsByUser(userId),
        storage.getHolidays(year),
        storage.getLeaveBalances(userId, year),
        storage.getLeaveRequests({ userId }),
      ]);

      const dept = departments.find(d => d.id === user.departmentId);

      const mandatoryHolidays = allHolidays.filter(h => h.type === "mandatory" || !h.isOptional);
      const selectedRegionalIds = new Set(regionalSelections.map(s => s.holidayId));
      const selectedRegionalHolidays = allHolidays.filter(h => selectedRegionalIds.has(h.id));
      const resolvedHolidays = [...mandatoryHolidays, ...selectedRegionalHolidays]
        .filter((h, i, arr) => arr.findIndex(x => x.id === h.id) === i)
        .sort((a, b) => a.date.localeCompare(b.date));

      const leaveTypes = await storage.getLeaveTypes();
      const enrichedBalances = leaveBalances.map(b => ({
        ...b,
        leaveTypeName: leaveTypes.find(lt => lt.id === b.leaveTypeId)?.name || "Unknown",
      }));

      const recentLeaves = leaveRequests
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(0, 20)
        .map(lr => ({
          ...lr,
          leaveTypeName: leaveTypes.find(lt => lt.id === lr.leaveTypeId)?.name || "Unknown",
        }));

      const userShiftId = (user as AdminUser & { shiftId?: string | null }).shiftId || null;
      const shiftTiming = userShiftId ? await getCurrentShiftTiming(userShiftId) : null;

      res.json({
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          designation: user.designation,
          departmentId: user.departmentId,
          departmentName: dept?.name || null,
          hierarchyLevel: user.hierarchyLevel,
          managerId: user.managerId,
          employeeId: user.employeeId,
          joiningDate: user.joiningDate,
          isActive: user.isActive,
          salary: user.salary || null,
          shiftId: userShiftId,
          shiftTiming: shiftTiming
            ? { istStart: shiftTiming.istStart, istEnd: shiftTiming.istEnd, isDst: shiftTiming.isDst }
            : null,
          gender: (user as any).gender ?? null,
          employmentType: (user as any).employmentType ?? null,
          employeeCategory: (user as any).employeeCategory ?? "experienced",
          attendanceExempt: user.attendanceExempt ?? false,
          trainingExempt: (user as any).trainingExempt ?? false,
          maternityLeaveEligible: (user as any).maternityLeaveEligible ?? false,
        },
        attendance: attendanceRecords,
        emergencyContacts,
        tickets,
        regionalHolidaySelections: regionalSelections,
        salary: {
          currentSalary: user.salary || null,
          slips: salarySlips,
        },
        holidays: resolvedHolidays,
        leaveBalances: enrichedBalances,
        recentLeaves,
      });
    } catch (error) {
      console.error("Employee details error:", error);
      res.status(500).json({ error: "Failed to fetch employee details" });
    }
  });

  // ==========================================
  // MY TEAM — LEAVE TRACKING & APPLY ON BEHALF
  // ==========================================

  app.get("/api/admin/my-team/:userId/leaves", requirePermission("admin.myTeam.leaves", "hr", "manager", "operations"), async (req, res) => {
    try {
      const targetUserId = req.params.userId as string;
      const actorId = req.session.userId!;
      const actorRole = req.session.role!;

      const targetUser = await storage.getAdminUser(targetUserId);
      if (!targetUser) return res.status(404).json({ error: "Employee not found" });

      if (actorRole === "manager") {
        const directReports = await storage.getTeamMembers(actorId);
        const isReport = directReports.some(r => r.id === targetUserId);
        if (!isReport) {
          return res.status(403).json({ error: "You can only view leave details for your reportees" });
        }
      }

      const currentYear = new Date().getFullYear();
      const year = parseInt(req.query.year as string) || currentYear;

      const [balances, leaveTypesList, requests, accruals] = await Promise.all([
        storage.getLeaveBalances(targetUserId, year),
        storage.getLeaveTypes(),
        storage.getLeaveRequests({ userId: targetUserId }),
        storage.getLeaveAccrualsByUser(targetUserId, year),
      ]);

      const yearRequests = requests.filter(r => r.startDate.startsWith(String(year)));
      const approvedRequests = yearRequests.filter(r => r.status === "approved");
      const totalDaysTaken = approvedRequests.reduce((sum, r) => sum + parseFloat(r.totalDays || "0"), 0);
      const pendingCount = yearRequests.filter(r => r.status === "pending").length;

      const leaveTypeUsage: Record<string, number> = {};
      for (const r of approvedRequests) {
        const ltName = leaveTypesList.find(lt => lt.id === r.leaveTypeId)?.name || "Unknown";
        leaveTypeUsage[ltName] = (leaveTypeUsage[ltName] || 0) + parseFloat(r.totalDays || "0");
      }
      const mostUsedLeaveType = Object.entries(leaveTypeUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

      res.json({
        employee: { id: targetUser.id, firstName: targetUser.firstName, lastName: targetUser.lastName, email: targetUser.email },
        balances,
        leaveTypes: leaveTypesList,
        requests: yearRequests,
        accruals,
        summary: {
          totalDaysTaken,
          pendingCount,
          mostUsedLeaveType,
        },
        year,
      });
    } catch (error) {
      console.error("Fetch employee leave details error:", error);
      res.status(500).json({ error: "Failed to fetch employee leave details" });
    }
  });

  app.post("/api/admin/my-team/:userId/apply-leave", requirePermission("admin.myTeam.applyLeave", "hr", "manager", "operations"), async (req, res) => {
    try {
      const targetUserId = req.params.userId as string;
      const actorId = req.session.userId!;
      const actorRole = req.session.role!;

      const targetUser = await storage.getAdminUser(targetUserId);
      if (!targetUser) return res.status(404).json({ error: "Employee not found" });

      if (actorRole === "manager") {
        const directReports = await storage.getTeamMembers(actorId);
        const isReport = directReports.some(r => r.id === targetUserId);
        if (!isReport) {
          return res.status(403).json({ error: "You can only apply leave for your reportees" });
        }
      }

      const { leaveTypeId, startDate, endDate, totalDays, reason, note } = req.body;

      if (!leaveTypeId || !startDate || !endDate || !totalDays || !note) {
        return res.status(400).json({ error: "leaveTypeId, startDate, endDate, totalDays, and note are required" });
      }

      const today = new Date().toISOString().split("T")[0];
      if (endDate > today) {
        return res.status(400).json({ error: "Cannot apply leave on behalf for future dates. Employee should apply themselves." });
      }

      const lr = await storage.createLeaveRequest({
        userId: targetUserId,
        leaveTypeId,
        startDate,
        endDate,
        totalDays: String(totalDays),
        reason: reason || null,
      });

      const approved = await storage.updateLeaveRequest(lr.id, {
        status: "approved",
        reviewedBy: actorId,
        reviewComment: `Applied on behalf: ${note}`,
        reviewedAt: new Date(),
      });

      const year = parseInt(startDate.split("-")[0]);
      const balances = await storage.getLeaveBalances(targetUserId, year);
      const balance = balances.find(b => b.leaveTypeId === leaveTypeId);
      if (balance) {
        const newUsed = parseFloat(balance.usedDays || "0") + parseFloat(String(totalDays));
        await storage.updateLeaveBalance(balance.id, { usedDays: String(newUsed) });
      }

      await storage.createAuditLog({
        actorId,
        targetId: targetUserId,
        action: "apply_leave_on_behalf",
        changes: {
          leaveTypeId,
          startDate,
          endDate,
          totalDays,
          reason: reason || null,
          note,
          leaveRequestId: lr.id,
        },
      });

      res.status(201).json(approved);
    } catch (error) {
      console.error("Apply leave on behalf error:", error);
      res.status(500).json({ error: "Failed to apply leave on behalf" });
    }
  });

  app.get("/api/admin/my-team/members", requirePermission("admin.myTeam.members", "hr", "manager", "operations"), async (req, res) => {
    try {
      const actorId = req.session.userId!;
      const actorRole = req.session.role!;

      let members: AdminUser[];
      if (["super_admin", "admin", "hr", "operations"].includes(actorRole)) {
        members = await storage.getAdminUsers();
      } else {
        const reporteeIds = await getAllReporteeIds(actorId);
        const allUsers = await storage.getAdminUsers();
        members = allUsers.filter(u => reporteeIds.includes(u.id));
      }

      const departments = await storage.getDepartments();
      const deptMap = new Map(departments.map(d => [d.id, d.name]));

      const safeMembers = members.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        designation: u.designation,
        departmentId: u.departmentId,
        departmentName: u.departmentId ? deptMap.get(u.departmentId) || null : null,
        hierarchyLevel: u.hierarchyLevel,
        employeeId: u.employeeId,
        isActive: u.isActive,
      }));

      res.json(safeMembers);
    } catch (error) {
      console.error("My team members error:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // Public endpoint — returns only the UX flags needed by the unauthenticated signing pages.
  app.get("/api/public/esign-config", async (req: Request, res: Response) => {
    try {
      const setting = await storage.getSystemSetting("feature_flags");
      const flags = (setting?.value as Record<string, boolean>) || {};
      res.set("Cache-Control", "public, max-age=60");
      res.json({ esignDocusignFlow: flags.esign_docusign_flow === true });
    } catch {
      res.json({ esignDocusignFlow: false });
    }
  });

  app.get("/api/system/feature-flags", requireAuth, async (req: Request, res: Response) => {
    try {
      const setting = await storage.getSystemSetting("feature_flags");
      const flags = (setting?.value as Record<string, boolean>) || {
        notifications_enabled: false,
        document_reminder_email_enabled: false,
      };
      res.json(flags);
    } catch (error) {
      console.error("Get feature flags error:", error);
      res.status(500).json({ error: "Failed to fetch feature flags" });
    }
  });

  app.patch("/api/system/feature-flags", requireAuth, requirePermission("system.featureFlags", "super_admin", "admin"), async (req: Request, res: Response) => {
    try {
      const ALLOWED_FLAGS = ["notifications_enabled", "document_reminder_email_enabled", "esign_docusign_flow", "new_look", "probation_framework_db", "process_governance"];
      const updates = req.body as Record<string, unknown>;
      const validated: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (!ALLOWED_FLAGS.includes(key)) continue;
        if (typeof value !== "boolean") continue;
        validated[key] = value;
      }
      const existing = await storage.getSystemSetting("feature_flags");
      const currentFlags = (existing?.value as Record<string, boolean>) || {
        notifications_enabled: false,
        document_reminder_email_enabled: false,
      };
      const merged = { ...currentFlags, ...validated };
      await storage.upsertSystemSetting("feature_flags", merged, req.session.userId);
      res.json(merged);
    } catch (error) {
      console.error("Update feature flags error:", error);
      res.status(500).json({ error: "Failed to update feature flags" });
    }
  });

  // ==========================================
  // PROCESS GOVERNANCE CENTER — SOPs (Task #660)
  // ==========================================
  // Two-tier feature gate mirroring the new_look pattern:
  //  Tier 1 (master): system_settings.feature_flags.process_governance boolean.
  //  Tier 2 (rollout): system_settings.process_governance_rollout =
  //    { mode: 'pilot'|'all', roles: string[], userIds: string[] }.
  // A user has access when the master flag is ON AND (mode==='all' OR their role
  // is in rollout.roles OR their userId is in rollout.userIds). super_admin/admin
  // always have access when the master flag is ON so governance owners can manage
  // the library during a pilot.

  type SopRolloutScope = sopRollout.SopRolloutScope;

  // Delegate the two-tier gate + scope to the shared module (server/sopRollout.ts)
  // so routes, onboarding compliance, and the seed never diverge.
  const getSopRolloutScope = sopRollout.getSopRolloutScope;

  async function resolveSopAccess(req: Request): Promise<{ masterOn: boolean; enabled: boolean; rollout: SopRolloutScope }> {
    return sopRollout.resolveSopAccessForUser(
      req.session?.userId as string | undefined,
      req.session?.role as string | undefined,
    );
  }

  // Per-user SOP access summary for the client gate (useSopAccess hook).
  app.get("/api/sops/access", requireAuth, async (req: Request, res: Response) => {
    try {
      const { masterOn, enabled, rollout } = await resolveSopAccess(req);
      const role = req.session?.role as string | undefined;
      const canManage = enabled && ["super_admin", "admin", "hr", "operations", "manager"].includes(role || "");
      res.json({ masterOn, enabled, canManage, rollout });
    } catch (error) {
      console.error("SOP access resolve error:", error);
      res.status(500).json({ error: "Failed to resolve SOP access" });
    }
  });

  // Rollout scope read/write — super_admin/admin only.
  app.get("/api/sops/rollout", requireAuth, requirePermission("sops.rollout"), async (_req: Request, res: Response) => {
    try {
      res.json(await getSopRolloutScope());
    } catch (error) {
      console.error("SOP rollout get error:", error);
      res.status(500).json({ error: "Failed to fetch rollout scope" });
    }
  });

  app.patch("/api/sops/rollout", requireAuth, requirePermission("sops.rollout"), async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<SopRolloutScope>;
      const next: SopRolloutScope = {
        mode: body.mode === "all" ? "all" : "pilot",
        roles: Array.isArray(body.roles) ? body.roles.filter((r) => typeof r === "string") : [],
        userIds: Array.isArray(body.userIds) ? body.userIds.filter((u) => typeof u === "string") : [],
      };
      await storage.upsertSystemSetting("process_governance_rollout", next, req.session.userId);
      res.json(next);
    } catch (error) {
      console.error("SOP rollout update error:", error);
      res.status(500).json({ error: "Failed to update rollout scope" });
    }
  });

  // ── SOP Wave Rollout & Enforcement (Task #662) ───────────────────────────────

  // Wave board: all waves + their member SOPs + the current-calendar-week cadence count.
  app.get("/api/sops/waves", requireAuth, requirePermission("sops.rollout"), async (_req: Request, res: Response) => {
    try {
      res.json(await sopRollout.getWavesWithSops());
    } catch (error) {
      console.error("SOP waves fetch error:", error);
      res.status(500).json({ error: "Failed to fetch waves" });
    }
  });

  // Activate a wave (planned → active). SOPs can only go operational once active.
  app.post("/api/sops/waves/:waveNumber/activate", requireAuth, requirePermission("sops.rollout"), async (req: Request, res: Response) => {
    try {
      const waveNumber = Number(req.params.waveNumber);
      if (!Number.isInteger(waveNumber)) return res.status(400).json({ error: "Invalid wave number" });
      await sopRollout.activateWave(waveNumber, req.session.userId!);

      // Activating a wave publishes its approved SOPs into the training-
      // assignment lifecycle so employees actually receive obligations. SOPs
      // that are still drafts/in-review (not yet approved) are skipped; already-
      // published/active ones are left untouched (idempotent).
      const memberCodes = await sopRollout.getWaveMemberMasterIds(waveNumber);
      let published = 0;
      let skipped = 0;
      for (const code of memberCodes) {
        const doc = await storage.getCurrentSopByMasterId(code);
        if (!doc) { skipped += 1; continue; }
        if (doc.lifecycleStatus !== "approved") { skipped += 1; continue; }
        await storage.setSopLifecycleStatus(doc.id, "published", { effectiveDate: new Date().toISOString().slice(0, 10) });
        await assignSopTraining(doc, req);
        if (doc.learningTrackId) await storage.setSopLifecycleStatus(doc.id, "training_assigned");
        published += 1;
      }

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: String(waveNumber),
        action: "sop_wave_activated",
        changes: { waveNumber, sopsPublished: published, sopsSkipped: skipped },
      });
      res.json(await sopRollout.getWavesWithSops());
    } catch (error) {
      console.error("SOP wave activate error:", error);
      res.status(500).json({ error: "Failed to activate wave" });
    }
  });

  // Update a wave's status and/or enforcement level (soft / measured / full).
  app.patch("/api/sops/waves/:waveNumber", requireAuth, requirePermission("sops.rollout"), async (req: Request, res: Response) => {
    try {
      const waveNumber = Number(req.params.waveNumber);
      if (!Number.isInteger(waveNumber)) return res.status(400).json({ error: "Invalid wave number" });
      const { status, enforcement } = req.body as { status?: string; enforcement?: string };
      if (status && !["planned", "active", "completed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      if (enforcement && !["soft", "measured", "full"].includes(enforcement)) {
        return res.status(400).json({ error: "Invalid enforcement" });
      }
      await sopRollout.updateWave(waveNumber, {
        status: status as sopRollout.WaveStatus | undefined,
        enforcement: enforcement as sopRollout.WaveEnforcement | undefined,
      });
      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: String(waveNumber),
        action: "sop_wave_updated",
        changes: { waveNumber, status, enforcement },
      });
      res.json(await sopRollout.getWavesWithSops());
    } catch (error) {
      console.error("SOP wave update error:", error);
      res.status(500).json({ error: "Failed to update wave" });
    }
  });

  // Make a wave's SOP operational, enforcing the ≤2 operational SOPs/week cadence.
  // Pass { force: true } to override the cadence cap (audit-logged).
  app.post("/api/sops/waves/:waveNumber/sops/:code/activate", requireAuth, requirePermission("sops.rollout"), async (req: Request, res: Response) => {
    try {
      const waveNumber = Number(req.params.waveNumber);
      if (!Number.isInteger(waveNumber)) return res.status(400).json({ error: "Invalid wave number" });
      const code = req.params.code;
      const force = req.body?.force === true;
      const result = await sopRollout.activateSop(waveNumber, code, req.session.userId!, force);
      if (!result.ok) {
        if (result.cadenceBlocked) {
          return res.status(409).json({
            error: `Cadence guardrail: ${result.windowCount} SOPs already went operational this calendar week (max ${sopRollout.CADENCE_MAX_PER_WEEK}). Override with force to proceed.`,
            cadenceBlocked: true,
            windowCount: result.windowCount,
          });
        }
        return res.status(400).json({ error: result.error || "Failed to make SOP operational" });
      }
      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: code,
        action: result.overridden ? "sop_operational_cadence_override" : "sop_operational",
        changes: { waveNumber, code, overridden: !!result.overridden },
      });
      res.json({ ok: true, overridden: !!result.overridden, ...(await sopRollout.getWavesWithSops()) });
    } catch (error) {
      console.error("SOP operational error:", error);
      res.status(500).json({ error: "Failed to make SOP operational" });
    }
  });

  // Employee-facing "My SOPs" — assigned published SOPs with wave/enforcement
  // status. Returns { enabled:false, assignments:[] } for users outside the pilot.
  app.get("/api/sops/my-assignments", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await sopRollout.getMySopAssignments(
        req.session?.userId as string | undefined,
        req.session?.role as string | undefined,
      );
      res.json(result);
    } catch (error) {
      console.error("SOP my-assignments error:", error);
      res.status(500).json({ error: "Failed to fetch your SOPs" });
    }
  });

  // ─── My SOP Reviews Inbox (Task #745) ───────────────────────────────────────
  // Returns sopReviewAssignments for the current user, enriched with SOP details
  // and a server-computed slaStatus. Static path — must stay above /:id.

  // Lightweight count endpoint for the sidebar badge.
  app.get("/api/sops/my-reviews/count", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const rows = await db
        .select({ status: sopReviewAssignments.status })
        .from(sopReviewAssignments)
        .where(and(
          eq(sopReviewAssignments.reviewerId, userId),
          eq(sopReviewAssignments.status, "pending"),
        ));
      res.json({ pending: rows.length });
    } catch (error) {
      console.error("SOP my-reviews/count error:", error);
      res.status(500).json({ error: "Failed to fetch pending count" });
    }
  });

  // Full my-reviews list with SOP enrichment and SLA computation.
  app.get("/api/sops/my-reviews", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const statusFilter = (req.query.status as string) || "pending";

      // Fetch assignments for this reviewer.
      const assignments = await db
        .select()
        .from(sopReviewAssignments)
        .where(eq(sopReviewAssignments.reviewerId, userId))
        .orderBy(desc(sopReviewAssignments.createdAt));

      // Filter by pending vs completed.
      const isPending = statusFilter === "pending";
      const filtered = assignments.filter((a) =>
        isPending ? a.status === "pending" : a.status !== "pending"
      );

      if (filtered.length === 0) return res.json([]);

      // Bulk-fetch all SOP documents and index by masterId::version.
      const allDocs = await db
        .select({
          id: sopDocuments.id,
          sopMasterId: sopDocuments.sopMasterId,
          code: sopDocuments.code,
          title: sopDocuments.title,
          category: sopDocuments.category,
          version: sopDocuments.version,
          lifecycleStatus: sopDocuments.lifecycleStatus,
          owner: sopDocuments.owner,
          approver: sopDocuments.approver,
          summary: sopDocuments.summary,
          aiAssistAllowed: sopDocuments.aiAssistAllowed,
          humanSignoffRequired: sopDocuments.humanSignoffRequired,
        })
        .from(sopDocuments);

      const docIndex = new Map<string, typeof allDocs[0]>();
      for (const d of allDocs) {
        docIndex.set(`${d.sopMasterId}::${d.version}`, d);
      }

      // Fetch the assignedBy user display names.
      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      const now = new Date();
      const results = filtered.map((a) => {
        const doc = docIndex.get(`${a.sopMasterId}::${a.sopVersion}`) ?? null;
        const assignedByUser = a.assignedBy ? userMap.get(a.assignedBy) : null;
        const assignedByName = assignedByUser
          ? `${assignedByUser.firstName ?? ""} ${assignedByUser.lastName ?? ""}`.trim() || assignedByUser.email
          : "Unknown";

        let slaStatus: "on_track" | "at_risk" | "overdue" = "on_track";
        if (a.status === "pending" && a.dueAt) {
          const dueMs = new Date(a.dueAt).getTime();
          const diffMs = dueMs - now.getTime();
          if (diffMs < 0) {
            slaStatus = "overdue";
          } else if (diffMs < 24 * 60 * 60 * 1000) {
            slaStatus = "at_risk";
          }
        }

        return {
          ...a,
          sopTitle: doc?.title ?? "(SOP not found)",
          sopCode: doc?.code ?? a.sopMasterId,
          sopCategory: doc?.category ?? "",
          sopLifecycleStatus: doc?.lifecycleStatus ?? "",
          sopDocumentId: doc?.id ?? null,
          sopOwner: doc?.owner ?? "",
          sopApprover: doc?.approver ?? null,
          sopSummary: doc?.summary ?? null,
          sopAiAssistAllowed: doc?.aiAssistAllowed ?? false,
          sopHumanSignoffRequired: doc?.humanSignoffRequired ?? true,
          assignedByName,
          slaStatus,
        };
      });

      res.json(results);
    } catch (error) {
      console.error("SOP my-reviews error:", error);
      res.status(500).json({ error: "Failed to fetch your review assignments" });
    }
  });

  // Team SOP compliance view — manager sees direct reports; hr/admin/super_admin see all.
  app.get("/api/sops/team-compliance", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role!;
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });

      let teamMembers: AdminUser[];
      if (["manager", "operations"].includes(role)) {
        teamMembers = await storage.getTeamMembers(userId);
      } else if (["super_admin", "admin", "hr"].includes(role)) {
        const allUsers = await storage.getAdminUsers();
        teamMembers = allUsers.filter((u) => u.isActive && !u.deletedAt);
      } else {
        return res.status(403).json({ error: "Access denied" });
      }

      const result: Array<{
        userId: string; name: string; role: string | null;
        total: number; acknowledged: number; trainingPending: number; overdue: number;
        sops: Array<{ code: string; title: string; state: string; overdue: boolean; dueAt: string | null; acknowledgedAt: string | null; evidenceText: string | null; evidenceFileUrl: string | null }>;
      }> = [];

      for (const member of teamMembers) {
        const { assignments } = await sopRollout.getMySopAssignments(member.id, member.role ?? undefined);
        result.push({
          userId: member.id,
          name: `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() || member.email,
          role: member.role ?? null,
          total: assignments.length,
          acknowledged: assignments.filter((a) => a.state === "acknowledged").length,
          trainingPending: assignments.filter((a) => a.state === "training_pending").length,
          overdue: assignments.filter((a) => a.overdue).length,
          sops: assignments.map((a) => ({
            code: a.code,
            title: a.title,
            state: a.state,
            overdue: a.overdue,
            dueAt: a.dueAt ? a.dueAt.toISOString() : null,
            acknowledgedAt: a.acknowledgedAt ? a.acknowledgedAt.toISOString() : null,
            evidenceText: a.evidenceText ?? null,
            evidenceFileUrl: a.evidenceFileUrl ?? null,
          })),
        });
      }

      res.json({ members: result });
    } catch (error) {
      console.error("SOP team compliance error:", error);
      res.status(500).json({ error: "Failed to fetch team SOP compliance" });
    }
  });

  // List SOPs (current versions by default), with optional filters.
  app.get("/api/sops", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const { category, wave, status, owner, all } = req.query as Record<string, string>;
      const docs = await storage.getSopDocuments({
        category: category || undefined,
        launchWave: wave !== undefined && wave !== "" ? Number(wave) : undefined,
        lifecycleStatus: status || undefined,
        owner: owner || undefined,
        currentOnly: all === "true" ? false : true,
      });
      res.json(docs);
    } catch (error) {
      console.error("SOP list error:", error);
      res.status(500).json({ error: "Failed to fetch SOPs" });
    }
  });

  // ─── Reviewer Assignment Overview (Task #744) ────────────────────────────
  // Admin/super_admin bulk reviewer management panel.
  // Returns every current SOP with its latest review round assignments + SLA.
  app.get("/api/sops/reviewer-assignments", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });

      const docs = await storage.getSopDocuments({ currentOnly: true });
      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const now = new Date();

      const rows = await Promise.all(
        docs.map(async (doc) => {
          const allAssignments = await storage.getSopReviewAssignments(doc.sopMasterId, doc.version);
          const latest = sopGov.latestRound(allAssignments);
          const maxRound = allAssignments.reduce((m, a) => Math.max(m, a.round ?? 1), 0);

          const reviewerDetails = latest.map((a) => {
            const u = userMap.get(a.reviewerId);
            const name = u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email : a.reviewerId;
            const overdue = a.status === "pending" && !!a.dueAt && new Date(a.dueAt) < now;
            return { ...a, reviewerName: name, overdue };
          });

          const noReviewer = latest.length === 0;
          const gate = sopGov.evaluateApprovalGate(
            latest.map((r) => ({
              status: r.status,
              dueAt: r.dueAt ? new Date(r.dueAt) : null,
              decisionAt: r.decisionAt ? new Date(r.decisionAt) : null,
            })),
          );
          const overallOverdue = gate.overdueCount > 0;

          const slaStatus = noReviewer
            ? "none"
            : overallOverdue
            ? "overdue"
            : "on_track";

          return {
            id: doc.id,
            sopMasterId: doc.sopMasterId,
            code: doc.code,
            title: doc.title,
            category: doc.category,
            lifecycleStatus: doc.lifecycleStatus,
            version: doc.version,
            round: maxRound,
            noReviewer,
            slaStatus,
            reviewers: reviewerDetails,
            gate,
          };
        }),
      );

      // Summary counts
      const summary = {
        total: rows.length,
        unassigned: rows.filter((r) => r.noReviewer).length,
        inReview: rows.filter((r) => r.lifecycleStatus === "in_review").length,
        overdue: rows.filter((r) => r.slaStatus === "overdue").length,
      };

      res.json({ rows, summary });
    } catch (error) {
      console.error("SOP reviewer-assignments error:", error);
      res.status(500).json({ error: "Failed to fetch reviewer assignments" });
    }
  });

  // Bulk submit SOPs for review — admin/super_admin only (Task #744).
  // Wraps each SOP operation atomically so partial failures don't leave orphan assignments.
  app.post("/api/sops/bulk-submit-review", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });

      const sopIds: string[] = Array.isArray(req.body?.sopIds)
        ? req.body.sopIds.filter((x: unknown) => typeof x === "string")
        : [];
      const reviewerIds: string[] = Array.isArray(req.body?.reviewerIds)
        ? req.body.reviewerIds.filter((x: unknown) => typeof x === "string")
        : [];

      if (sopIds.length === 0) return res.status(400).json({ error: "At least one SOP is required" });
      if (reviewerIds.length === 0) return res.status(400).json({ error: "At least one reviewer is required" });

      const VALID_STATES = ["draft", "changes_requested", "under_revision"];
      const results: Array<{ sopId: string; code: string; status: "submitted" | "skipped"; reason?: string }> = [];
      const dueAt = sopGov.addBusinessDays(new Date(), sopGov.REVIEWER_SLA_BUSINESS_DAYS);
      const uniqueReviewerIds = Array.from(new Set(reviewerIds));

      for (const sopId of sopIds) {
        const doc = await storage.getSopDocumentById(sopId);
        if (!doc) {
          results.push({ sopId, code: sopId, status: "skipped", reason: "Not found" });
          continue;
        }
        if (!VALID_STATES.includes(doc.lifecycleStatus as string)) {
          results.push({ sopId, code: doc.code, status: "skipped", reason: `Status is '${doc.lifecycleStatus}'` });
          continue;
        }

        // Each SOP is processed atomically — assignments + status change together.
        await db.transaction(async () => {
          const priorRounds = await storage.getSopReviewAssignments(doc.sopMasterId, doc.version);
          const nextRound = priorRounds.reduce((max, r) => Math.max(max, r.round ?? 1), 0) + 1;

          for (const reviewerId of uniqueReviewerIds) {
            await storage.createSopReviewAssignment({
              sopMasterId: doc.sopMasterId,
              sopVersion: doc.version,
              round: nextRound,
              reviewerId,
              status: "pending",
              dueAt,
              assignedBy: req.session.userId!,
            });
          }
          await storage.setSopLifecycleStatus(doc.id, "in_review");
        });

        // Notifications are fire-and-forget outside the transaction.
        for (const reviewerId of uniqueReviewerIds) {
          try {
            await storage.createNotification({
              userId: reviewerId,
              type: "sop_review_assigned",
              title: "SOP to review",
              message: `You have a SOP to review: ${doc.code} — ${doc.title} (due ${dueAt.toLocaleDateString()})`,
              isRead: false,
              metadata: { sopId: doc.id, link: "/admin/sops" },
            });
          } catch (e) {
            console.error("SOP bulk review notify error:", e);
          }
        }
        results.push({ sopId, code: doc.code, status: "submitted" });
      }

      const submitted = results.filter((r) => r.status === "submitted").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      res.json({ results, submitted, skipped });
    } catch (error) {
      console.error("SOP bulk-submit-review error:", error);
      res.status(500).json({ error: "Failed to bulk submit SOPs for review" });
    }
  });

  // Add reviewers to the CURRENT round of an in_review SOP — admin/super_admin only (Task #744).
  // Unlike submit-review (which opens a new round), this appends to the existing round
  // without resetting or disturbing decisions already recorded in that round.
  app.post("/api/sops/:id/add-reviewers", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });

      const reviewerIds: string[] = Array.isArray(req.body?.reviewerIds)
        ? req.body.reviewerIds.filter((r: unknown) => typeof r === "string")
        : [];
      if (reviewerIds.length === 0) return res.status(400).json({ error: "At least one reviewer is required" });

      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      if (doc.lifecycleStatus !== "in_review") {
        return res.status(409).json({ error: "SOP must be in_review to add reviewers to the current round" });
      }

      const existing = await storage.getSopReviewAssignments(doc.sopMasterId, doc.version);
      const currentRound = existing.reduce((max, r) => Math.max(max, r.round ?? 1), 1);
      const currentRoundReviewerIds = new Set(
        existing.filter((r) => (r.round ?? 1) === currentRound).map((r) => r.reviewerId),
      );

      // Only add reviewers not already in this round.
      const toAdd = Array.from(new Set(reviewerIds)).filter((id) => !currentRoundReviewerIds.has(id));
      if (toAdd.length === 0) {
        return res.json({ added: 0, message: "All specified reviewers are already in the current round" });
      }

      const dueAt = sopGov.addBusinessDays(new Date(), sopGov.REVIEWER_SLA_BUSINESS_DAYS);
      const created = [];
      for (const reviewerId of toAdd) {
        const assignment = await storage.createSopReviewAssignment({
          sopMasterId: doc.sopMasterId,
          sopVersion: doc.version,
          round: currentRound,
          reviewerId,
          status: "pending",
          dueAt,
          assignedBy: req.session.userId!,
        });
        created.push(assignment);
        try {
          await storage.createNotification({
            userId: reviewerId,
            type: "sop_review_assigned",
            title: "SOP to review",
            message: `You have been added as a reviewer: ${doc.code} — ${doc.title} (due ${dueAt.toLocaleDateString()})`,
            isRead: false,
            metadata: { sopId: doc.id, link: "/admin/sops" },
          });
        } catch (e) {
          console.error("SOP add-reviewers notify error:", e);
        }
      }

      res.json({ added: created.length, assignments: created });
    } catch (error) {
      console.error("SOP add-reviewers error:", error);
      res.status(500).json({ error: "Failed to add reviewers" });
    }
  });

  // Single SOP + its version history + role assignments.
  app.get("/api/sops/:id", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const [versions, roleAssignments] = await Promise.all([
        storage.getSopVersionHistory(doc.sopMasterId),
        storage.getSopRoleAssignments(doc.sopMasterId),
      ]);
      res.json({ ...doc, versions, roleAssignments });
    } catch (error) {
      console.error("SOP get error:", error);
      res.status(500).json({ error: "Failed to fetch SOP" });
    }
  });

  // Create a new SOP (version 1).
  app.post("/api/sops", requireAuth, requirePermission("sops.manage", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const parsed = insertSopDocumentSchema.safeParse({ ...req.body, createdBy: req.session.userId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid SOP data", details: parsed.error.flatten() });
      }
      const created = await storage.createSopDocument(parsed.data);
      res.status(201).json(created);
    } catch (error) {
      console.error("SOP create error:", error);
      res.status(500).json({ error: "Failed to create SOP" });
    }
  });

  // Update a SOP — version control enforced in storage (published/active clones a
  // new draft version; draft edits in place).
  app.patch("/api/sops/:id", requireAuth, requirePermission("sops.manage", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const parsed = insertSopDocumentSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid SOP data", details: parsed.error.flatten() });
      }
      const result = await storage.updateSopDocument(req.params.id, parsed.data, req.session.userId);
      res.json({ ...result.doc, clonedNewVersion: result.clonedNewVersion });
    } catch (error) {
      if (error instanceof Error && error.message === "SOP not found") {
        return res.status(404).json({ error: "SOP not found" });
      }
      console.error("SOP update error:", error);
      res.status(500).json({ error: "Failed to update SOP" });
    }
  });

  // ── SOP Governance: lifecycle + review workflow (Task #661) ──────────────────

  const SOP_OVERRIDE_ROLES = ["super_admin", "admin"]; // CEO/Super Admin override

  // Comment thread on a SOP (by master id). Anyone with SOP access can read/post.
  app.get("/api/sops/:id/comments", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const comments = await storage.getSopComments(doc.sopMasterId);
      const users = await storage.getAdminUsers();
      const nameById = new Map(users.map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email]));
      res.json(comments.map((c) => ({ ...c, authorName: nameById.get(c.authorId) ?? "Unknown" })));
    } catch (error) {
      console.error("SOP comments list error:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/sops/:id/comments", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const body = (req.body?.body ?? "").toString().trim();
      if (!body) return res.status(400).json({ error: "Comment body is required" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const created = await storage.createSopComment({ sopMasterId: doc.sopMasterId, authorId: req.session.userId!, body });
      res.status(201).json(created);
    } catch (error) {
      console.error("SOP comment create error:", error);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  // Reviewer assignments for a SOP's current version (with SLA state).
  app.get("/api/sops/:id/reviews", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      // Only the latest review round is current; prior rounds are history.
      const reviews = sopGov.latestRound(await storage.getSopReviewAssignments(doc.sopMasterId, doc.version));
      const users = await storage.getAdminUsers();
      const nameById = new Map(users.map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email]));
      const now = new Date();
      const enriched = reviews.map((r) => ({
        ...r,
        reviewerName: nameById.get(r.reviewerId) ?? "Unknown",
        overdue: r.status === "pending" && !!r.dueAt && new Date(r.dueAt).getTime() < now.getTime(),
      }));
      const gate = sopGov.evaluateApprovalGate(
        reviews.map((r) => ({ status: r.status, dueAt: r.dueAt ? new Date(r.dueAt) : null, decisionAt: r.decisionAt ? new Date(r.decisionAt) : null })),
        now,
      );
      res.json({ reviews: enriched, gate });
    } catch (error) {
      console.error("SOP reviews list error:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Submit a SOP for review: assign reviewers with a 5-business-day SLA, move to in_review.
  app.post("/api/sops/:id/submit-review", requireAuth, requirePermission("sops.manage", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const reviewerIds: string[] = Array.isArray(req.body?.reviewerIds) ? req.body.reviewerIds.filter((r: unknown) => typeof r === "string") : [];
      if (reviewerIds.length === 0) return res.status(400).json({ error: "At least one reviewer is required" });

      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const from = doc.lifecycleStatus as sopGov.SopLifecycleStatus;
      if (!sopGov.canTransition(from, "in_review")) {
        return res.status(409).json({ error: `Cannot submit a SOP in '${from}' status for review` });
      }

      // Open a fresh review round. The approval gate only ever evaluates the
      // latest round, so prior changes_requested/rejected decisions from an
      // earlier round never permanently block a resubmitted version.
      const priorRounds = await storage.getSopReviewAssignments(doc.sopMasterId, doc.version);
      const nextRound = priorRounds.reduce((max, r) => Math.max(max, r.round ?? 1), 0) + 1;

      const dueAt = sopGov.addBusinessDays(new Date(), sopGov.REVIEWER_SLA_BUSINESS_DAYS);
      const created = [];
      for (const reviewerId of Array.from(new Set(reviewerIds))) {
        const assignment = await storage.createSopReviewAssignment({
          sopMasterId: doc.sopMasterId,
          sopVersion: doc.version,
          round: nextRound,
          reviewerId,
          status: "pending",
          dueAt,
          assignedBy: req.session.userId!,
        });
        created.push(assignment);
        try {
          await storage.createNotification({
            userId: reviewerId,
            type: "sop_review_assigned",
            title: "SOP to review",
            message: `You have a SOP to review: ${doc.code} — ${doc.title} (due ${dueAt.toLocaleDateString()})`,
            isRead: false,
            metadata: { sopId: doc.id, link: "/admin/sops" },
          });
        } catch (e) { console.error("SOP review notify error:", e); }
      }

      const updated = await storage.setSopLifecycleStatus(doc.id, "in_review");
      res.json({ doc: updated, assignments: created });
    } catch (error) {
      console.error("SOP submit-review error:", error);
      res.status(500).json({ error: "Failed to submit SOP for review" });
    }
  });

  // Reviewer action: mark_reviewed | approve | approve_with_comments | request_changes | reject.
  app.post("/api/sops/:id/review-action", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const action = req.body?.action as sopGov.ReviewerAction;
      const comment: string | null = req.body?.comment ? String(req.body.comment).trim() : null;
      if (!sopGov.REVIEWER_ACTIONS.includes(action)) return res.status(400).json({ error: "Invalid review action" });
      if (sopGov.actionRequiresComment(action) && !comment) {
        return res.status(400).json({ error: "A comment is required for this action" });
      }

      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      if (doc.lifecycleStatus !== "in_review") {
        return res.status(409).json({ error: "SOP is not currently in review" });
      }

      // Scope to the current (latest) review round only.
      const reviews = sopGov.latestRound(await storage.getSopReviewAssignments(doc.sopMasterId, doc.version));
      // A reviewer decision may ONLY be recorded by the assigned reviewer for
      // their own pending assignment in the current round. Override roles
      // (CEO/Super Admin) do NOT get to impersonate another reviewer's decision
      // here — their only elevated power is the no-objection publish.
      const target = reviews.find((r) => r.reviewerId === req.session.userId && r.status === "pending");
      if (!target) {
        return res.status(403).json({ error: "You have no pending review assignment for this SOP" });
      }

      await storage.updateSopReviewAssignment(target.id, {
        status: sopGov.reviewerActionToStatus(action),
        decisionAt: new Date(),
        comment,
      });
      if (comment) {
        await storage.createSopComment({ sopMasterId: doc.sopMasterId, authorId: req.session.userId!, body: `[${action}] ${comment}` });
      }

      // Recompute the gate over the fresh latest-round assignment set.
      const fresh = sopGov.latestRound(await storage.getSopReviewAssignments(doc.sopMasterId, doc.version));
      const gate = sopGov.evaluateApprovalGate(
        fresh.map((r) => ({ status: r.status, dueAt: r.dueAt ? new Date(r.dueAt) : null, decisionAt: r.decisionAt ? new Date(r.decisionAt) : null })),
      );

      // Auto-advance is STRICT-only: every reviewer must have positively signed
      // off. The no-objection (overdue) path is deliberately NOT honored here —
      // it is a privileged override consumed solely by /publish under an override
      // role, so reviewers merely lapsing their SLA can never auto-approve a SOP.
      let updated = doc;
      if (gate.hasBlocking) {
        updated = (await storage.setSopLifecycleStatus(doc.id, "changes_requested")) ?? doc;
      } else if (gate.strictApprove) {
        updated = (await storage.setSopLifecycleStatus(doc.id, "approved")) ?? doc;
      }
      res.json({ doc: updated, gate });
    } catch (error) {
      console.error("SOP review-action error:", error);
      res.status(500).json({ error: "Failed to record review action" });
    }
  });

  // Publish a SOP — only from 'approved'. CEO/Super Admin may force a publish from
  // 'in_review' under the no-objection rule (all outstanding reviewers overdue).
  app.post("/api/sops/:id/publish", requireAuth, requirePermission("sops.manage", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const role = req.session.role!;
      const isOverride = SOP_OVERRIDE_ROLES.includes(role);

      if (doc.lifecycleStatus === "in_review") {
        // No-objection override path.
        if (!isOverride) return res.status(403).json({ error: "Only a CEO/Super Admin can publish a SOP that is still in review" });
        const reviews = sopGov.latestRound(await storage.getSopReviewAssignments(doc.sopMasterId, doc.version));
        const gate = sopGov.evaluateApprovalGate(
          reviews.map((r) => ({ status: r.status, dueAt: r.dueAt ? new Date(r.dueAt) : null, decisionAt: r.decisionAt ? new Date(r.decisionAt) : null })),
        );
        if (gate.hasBlocking) return res.status(409).json({ error: "A reviewer requested changes — resolve before publishing" });
        // Accept either a clean strict approval or a no-objection override (all
        // outstanding reviewers overdue). Both require the override role enforced
        // above; reviewers still inside their SLA block the override.
        if (!gate.strictApprove && !gate.noObjectionEligible) {
          return res.status(409).json({ error: "Reviewers are still within their SLA — cannot override yet" });
        }
        await storage.setSopLifecycleStatus(doc.id, "approved");
      } else if (doc.lifecycleStatus !== "approved") {
        return res.status(409).json({ error: `Cannot publish a SOP in '${doc.lifecycleStatus}' status` });
      }

      const published = await storage.setSopLifecycleStatus(doc.id, "published", { effectiveDate: new Date().toISOString().slice(0, 10) });

      // SOP retraining trigger — reset completed training assignments for linked tracks.
      // This is a mandatory compliance step: errors propagate and fail the publish.
      const links = await db.select({ trackId: trainingSopLinks.trackId })
        .from(trainingSopLinks)
        .where(eq(trainingSopLinks.sopCode, doc.code ?? ""));
      if (links.length > 0) {
        const trackIds = links.map((l) => l.trackId);
        const affected = await db.select({ id: trackAssignments.id, userId: trackAssignments.userId, trackId: trackAssignments.trackId })
          .from(trackAssignments)
          .where(and(
            inArray(trackAssignments.trackId, trackIds),
            eq(trackAssignments.status, "completed"),
          ));
        if (affected.length > 0) {
          await db.update(trackAssignments)
            .set({ status: "not_started", completedAt: null })
            .where(inArray(trackAssignments.id, affected.map((a) => a.id)));
          // Emit one audit event per impacted track for per-track compliance reporting
          for (const trackId of trackIds) {
            const trackAffected = affected.filter((a) => a.trackId === trackId);
            if (trackAffected.length === 0) continue;
            await db.insert(onboardingAuditEvents).values({
              userId: req.session.userId!,
              eventType: "sop_retraining_triggered",
              metadata: {
                sopCode: doc.code,
                sopId: doc.id,
                trackId,
                reason: "sop_republished",
                resetCount: trackAffected.length,
                affectedUsers: trackAffected.map((a) => a.userId),
                resetAssignmentIds: trackAffected.map((a) => a.id),
              },
            });
          }
        }
      }

      // Auto-assign training to impacted roles (rollout-aware) → TRAINING_ASSIGNED.
      // The lifecycle advances to training_assigned whenever the SOP requires
      // training (a learning track is linked); the rollout filter only governs
      // who actually receives an assignment/notification now, not the SOP's phase.
      // With no linked track there is nothing to train, so it stays 'published'
      // and is ready for direct acknowledgment.
      const result = await assignSopTraining(doc, req);
      const finalDoc = doc.learningTrackId
        ? await storage.setSopLifecycleStatus(doc.id, "training_assigned")
        : published;
      res.json({ doc: finalDoc, training: result });
    } catch (error) {
      console.error("SOP publish error:", error);
      res.status(500).json({ error: "Failed to publish SOP" });
    }
  });

  // Retire an active/under_revision SOP.
  app.post("/api/sops/:id/retire", requireAuth, requirePermission("sops.manage", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const from = doc.lifecycleStatus as sopGov.SopLifecycleStatus;
      if (!sopGov.canTransition(from, "retired")) {
        return res.status(409).json({ error: `Cannot retire a SOP in '${from}' status` });
      }
      const updated = await storage.setSopLifecycleStatus(doc.id, "retired", { isCurrent: false });
      res.json({ doc: updated });
    } catch (error) {
      console.error("SOP retire error:", error);
      res.status(500).json({ error: "Failed to retire SOP" });
    }
  });

  // Link / unlink a learning track to a SOP.
  app.patch("/api/sops/:id/learning-track", requireAuth, requirePermission("sops.manage", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const learningTrackId = req.body?.learningTrackId ? String(req.body.learningTrackId) : null;
      const updated = await storage.setSopLifecycleStatus(doc.id, doc.lifecycleStatus as string, { learningTrackId } as any);
      res.json({ doc: updated });
    } catch (error) {
      console.error("SOP link-track error:", error);
      res.status(500).json({ error: "Failed to link learning track" });
    }
  });

  // Team progress for a SOP (employee, role, training status, ack version + date).
  app.get("/api/sops/:id/progress", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const progress = await storage.getSopEmployeeProgress(doc.sopMasterId);
      const users = await storage.getAdminUsers();
      const byId = new Map(users.map((u) => [u.id, u]));
      const rows = progress.map((p) => {
        const u = byId.get(p.userId);
        return {
          userId: p.userId,
          name: u ? (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email) : "Unknown",
          role: u?.role ?? null,
          departmentId: u?.departmentId ?? null,
          trainingCompletedAt: p.trainingCompletedAt,
          acknowledgedAt: p.acknowledgedAt,
          acknowledgedVersion: p.acknowledgedAt ? p.sopVersion : null,
          // True only when the user acknowledged the CURRENT version; a prior
          // version ack shows as not-yet-acknowledged for this version.
          acknowledgedCurrentVersion: !!p.acknowledgedAt && p.sopVersion === doc.version,
        };
      });
      res.json(rows);
    } catch (error) {
      console.error("SOP progress error:", error);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  // Employee acknowledges a SOP version — gated on linked-track completion.
  app.post("/api/sops/:id/acknowledge", requireAuth, async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const userId = req.session.userId!;

      // Must have a progress row (i.e. impacted) for this SOP.
      const myProgress = (await storage.getSopEmployeeProgressForUser(userId)).find((p) => p.sopMasterId === doc.sopMasterId);
      if (!myProgress) return res.status(403).json({ error: "This SOP is not assigned to you" });

      // Gate on linked-track completion if a track is linked.
      if (doc.learningTrackId) {
        const [assignment] = await db.select().from(trackAssignments)
          .where(and(eq(trackAssignments.trackId, doc.learningTrackId), eq(trackAssignments.userId, userId)));
        if (!assignment || assignment.status !== "completed") {
          return res.status(409).json({ error: "Complete the linked training before acknowledging this SOP" });
        }
        await storage.markSopTrainingComplete(doc.sopMasterId, userId, assignment.completedAt ?? new Date());
      }

      // Gate on evidence if the role assignment requires it.
      const [roleAssignmentRow] = await db.select()
        .from(sopRoleAssignments)
        .where(and(eq(sopRoleAssignments.sopMasterId, doc.sopMasterId), eq(sopRoleAssignments.role, req.session.role!)));
      if (roleAssignmentRow?.evidenceDescription?.trim()) {
        if (!myProgress.evidenceText?.trim() && !myProgress.evidenceFileUrl?.trim()) {
          return res.status(412).json({ code: "evidence_required", error: "You must add evidence (written response or file) before acknowledging this SOP" });
        }
      }

      const typedName = (req.body?.typedName ?? "").toString().trim();
      if (!typedName) return res.status(400).json({ error: "Typed name is required to acknowledge" });

      const now = new Date();
      const refNumber = `SOP-${doc.code}-V${doc.version}-${userId.slice(0, 8)}`;
      const payload = `${doc.sopMasterId}|${doc.version}|${userId}|${typedName}|${now.toISOString()}`;
      const contentHash = crypto.createHash("sha256").update(payload).digest("hex");
      const authCode = crypto.createHmac("sha256", process.env.LETTER_HMAC_SECRET || process.env.OFFER_SIGNING_KEY || "sop-fallback")
        .update(payload).digest("hex").substring(0, 24).toUpperCase().match(/.{1,4}/g)?.join("-") || "";

      await recordSignature({
        documentType: "sop",
        documentId: `${doc.sopMasterId}:${doc.version}`,
        referenceNumber: refNumber,
        signerName: typedName,
        signerRole: req.session.role,
        signerUserId: userId,
        signedAt: now,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
        userAgent: req.headers["user-agent"] || null,
        contentHash,
        authCode,
        metadata: { sopCode: doc.code, sopTitle: doc.title, sopVersion: doc.version },
      });

      const updatedProgress = await storage.setSopAcknowledged(doc.sopMasterId, doc.version, userId, contentHash, now);

      // Advance only when every CURRENTLY-impacted user has acknowledged THIS
      // version. Acknowledgment is version-bound: a prior-version ack (older
      // sopVersion) does not count, and stale progress rows for users no longer
      // in scope are ignored by intersecting with the live impacted set. This
      // guarantees a v2 publish collects fresh v2 acknowledgments before going
      // active.
      const impactedIds = await impactedUserIdsForSop(doc.sopMasterId);
      const allProgress = await storage.getSopEmployeeProgress(doc.sopMasterId);
      const progressByUser = new Map(allProgress.map((p) => [p.userId, p]));
      const allAck = impactedIds.length > 0 && impactedIds.every((uid) => {
        const p = progressByUser.get(uid);
        return !!p && p.sopVersion === doc.version && !!p.acknowledgedAt;
      });
      const ackFrom = doc.lifecycleStatus as sopGov.SopLifecycleStatus;
      if (allAck && sopGov.canTransition(ackFrom, "acknowledged")) {
        await storage.setSopLifecycleStatus(doc.id, "acknowledged");
        await storage.setSopLifecycleStatus(doc.id, "active");
      }

      res.json({ progress: updatedProgress, refNumber, authCode });
    } catch (error) {
      console.error("SOP acknowledge error:", error);
      res.status(500).json({ error: "Failed to acknowledge SOP" });
    }
  });

  const evidenceUploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single("file");

  // Upload a single evidence file for a SOP (stores under .private/sop-evidence/).
  app.post("/api/sops/:masterId/evidence-upload", requireAuth, async (req: Request, res: Response) => {
    // Run multer inline so we can catch LIMIT_FILE_SIZE and return a tidy 400.
    await new Promise<void>((resolve, reject) => evidenceUploadMiddleware(req, res, (err) => err ? reject(err) : resolve()))
      .catch((err: any) => {
        if (err?.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "File too large. Maximum 10 MB allowed" });
        } else {
          res.status(500).json({ error: "Upload failed" });
        }
      });
    if (res.headersSent) return;

    try {
      const { masterId } = req.params;
      const userId = req.session.userId!;

      if (!req.file) return res.status(400).json({ error: "No file provided" });

      // Validate file type.
      const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!ALLOWED_MIME.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Allowed: PDF, PNG, JPG, DOCX" });
      }

      // Gate: user must have a progress row for this SOP.
      const myProgress = (await storage.getSopEmployeeProgressForUser(userId)).find((p) => p.sopMasterId === masterId);
      if (!myProgress) return res.status(403).json({ error: "This SOP is not assigned to you" });

      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
      const relativePath = `sop-evidence/${masterId}/${userId}/${crypto.randomUUID()}-${safeName}`;

      await objectStorageService.uploadBuffer(req.file.buffer, relativePath, req.file.mimetype);

      // Store as a canonical /objects/<relativePath> so the existing /objects/* serve
      // route can resolve it directly without any double-prefix issues.
      const storedPath = `/objects/${relativePath}`;

      res.json({ url: storedPath });
    } catch (error) {
      console.error("SOP evidence upload error:", error);
      res.status(500).json({ error: "Failed to upload evidence file" });
    }
  });

  // Save / update evidence text and/or file URL for a SOP progress row.
  app.patch("/api/sops/:masterId/evidence", requireAuth, async (req: Request, res: Response) => {
    try {
      const { masterId } = req.params;
      const userId = req.session.userId!;

      const myProgress = (await storage.getSopEmployeeProgressForUser(userId)).find((p) => p.sopMasterId === masterId);
      if (!myProgress) return res.status(403).json({ error: "This SOP is not assigned to you" });

      const evidenceText = req.body?.evidenceText !== undefined ? String(req.body.evidenceText).slice(0, 5000) : undefined;
      let evidenceFileUrl: string | undefined;
      if (req.body?.evidenceFileUrl !== undefined) {
        const raw = String(req.body.evidenceFileUrl);
        // Only accept blank (clear) or canonical internal paths from our upload route.
        const EVIDENCE_PATH_RE = /^\/objects\/sop-evidence\/[^/]+\/[^/]+\/[^/]+$/;
        if (raw !== "" && !EVIDENCE_PATH_RE.test(raw)) {
          return res.status(400).json({ error: "Invalid evidenceFileUrl — must be a path generated by the evidence upload endpoint" });
        }
        evidenceFileUrl = raw;
      }

      const updates: { evidenceText?: string | null; evidenceFileUrl?: string | null } = {};
      if (evidenceText !== undefined) updates.evidenceText = evidenceText || null;
      if (evidenceFileUrl !== undefined) updates.evidenceFileUrl = evidenceFileUrl || null;

      const updated = await storage.updateSopEvidence(masterId, userId, updates);

      // If an audit record exists for the current ISO week and evidence is now present, mark it collected.
      try {
        const hasEvidence = !!(updated?.evidenceText?.trim() || updated?.evidenceFileUrl?.trim());
        if (hasEvidence) {
          const weekDate = currentWeekMonday();
          await db.update(sopAuditRecords)
            .set({ evidenceCollected: true })
            .where(and(eq(sopAuditRecords.sopMasterId, masterId), eq(sopAuditRecords.weekDate, weekDate)));
        }
      } catch { /* non-fatal */ }

      res.json({ progress: updated });
    } catch (error) {
      console.error("SOP evidence save error:", error);
      res.status(500).json({ error: "Failed to save evidence" });
    }
  });

  // Backfill SOP progress for all eligible employees (hr/admin).
  app.post("/api/sops/assignments/sync", requireAuth, requirePermission("sops.manage", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const result = await backfillAllSopProgress();
      res.json(result);
    } catch (error) {
      console.error("SOP assignments sync error:", error);
      res.status(500).json({ error: "Failed to sync SOP assignments" });
    }
  });

  // ── SOP Audits, Findings & Governance Dashboards (Task #663) ────────────────

  // The Monday (ISO date) of the week containing `d`. Audits are weekly; a new
  // checklist naturally regenerates every Monday because the week_date key moves.
  function currentWeekMonday(d: Date = new Date()): string {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = dt.getUTCDay(); // 0=Sun..6=Sat
    const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
    dt.setUTCDate(dt.getUTCDate() + diff);
    return dt.toISOString().slice(0, 10);
  }

  // Map a SOP's free-text audit_owner_role label (e.g. "Delivery Manager", "Ops",
  // "Sales Director") to the set of SYSTEM roles whose holders own that audit.
  // super_admin/admin are universal owners and handled separately.
  function systemRolesForAuditOwner(label?: string | null): string[] {
    const l = (label || "").toLowerCase();
    const roles = new Set<string>();
    if (/\bops\b|operation/.test(l)) roles.add("operations");
    if (/\bhr\b|human/.test(l)) roles.add("hr");
    if (/manager|director|lead|delivery|\bam\b|sales|marketing|recruit/.test(l)) roles.add("manager");
    return Array.from(roles);
  }

  // Does the caller's role own this SOP's audit? super_admin/admin own everything.
  function callerOwnsAudit(role: string | undefined, auditOwnerRole?: string | null): boolean {
    if (!role) return false;
    if (role === "super_admin" || role === "admin") return true;
    return systemRolesForAuditOwner(auditOwnerRole).includes(role);
  }

  // SOP lifecycle states that are "live" and therefore auditable.
  const AUDITABLE_STATUSES = ["published", "training_assigned", "acknowledged", "active", "under_revision"];

  // Pending weekly audit checklist for the caller's audit-owner role. Returns the
  // live SOPs they own that have NOT yet been audited this week (auto-regenerates
  // each Monday). Also returns this week's already-submitted records for context.
  app.get("/api/sops/audits/pending", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const role = req.session.role;
      const weekDate = currentWeekMonday();
      const docs = (await storage.getSopDocuments({ currentOnly: true }))
        .filter((d) => AUDITABLE_STATUSES.includes(d.lifecycleStatus) && callerOwnsAudit(role, d.auditOwnerRole));

      const result = [] as Array<{
        sopId: string; sopMasterId: string; code: string; title: string; category: string;
        auditOwnerRole: string | null; frequency: string | null; weekDate: string;
        audited: boolean; lastAudit: { weekDate: string | null; auditScore: number | null; missesCount: number } | null;
        openFindings: number;
      }>;
      for (const d of docs) {
        const records = await storage.getSopAuditRecords(d.sopMasterId);
        const thisWeek = records.find((r) => r.weekDate === weekDate);
        const last = records[0] ?? null;
        const findings = await storage.getSopAuditFindings(d.sopMasterId);
        result.push({
          sopId: d.id, sopMasterId: d.sopMasterId, code: d.code, title: d.title, category: d.category,
          auditOwnerRole: d.auditOwnerRole, frequency: d.frequency, weekDate,
          audited: !!thisWeek,
          lastAudit: last ? { weekDate: last.weekDate, auditScore: last.auditScore, missesCount: last.missesCount } : null,
          openFindings: findings.filter((f) => f.status === "open" || f.status === "in_progress").length,
        });
      }
      // Pending first (not yet audited), then by code.
      result.sort((a, b) => (Number(a.audited) - Number(b.audited)) || a.code.localeCompare(b.code));
      res.json({ weekDate, pendingCount: result.filter((r) => !r.audited).length, items: result });
    } catch (error) {
      console.error("SOP pending audits error:", error);
      res.status(500).json({ error: "Failed to fetch pending audits" });
    }
  });

  // Audit history + findings for one SOP (drill-down / detail tab).
  app.get("/api/sops/:id/audits", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const [records, findings, users] = await Promise.all([
        storage.getSopAuditRecords(doc.sopMasterId),
        storage.getSopAuditFindings(doc.sopMasterId),
        storage.getAdminUsers(),
      ]);
      const nameById = new Map(users.map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email]));
      res.json({
        canAudit: callerOwnsAudit(req.session.role, doc.auditOwnerRole),
        records: records.map((r) => ({ ...r, auditorName: r.auditorId ? (nameById.get(r.auditorId) ?? "Unknown") : null })),
        findings: findings.map((f) => ({
          ...f,
          raisedByName: f.raisedBy ? (nameById.get(f.raisedBy) ?? "Unknown") : null,
          ownerName: f.ownerId ? (nameById.get(f.ownerId) ?? "Unknown") : null,
        })),
      });
    } catch (error) {
      console.error("SOP audits get error:", error);
      res.status(500).json({ error: "Failed to fetch audit history" });
    }
  });

  // Submit a weekly audit checklist for a SOP. Only the audit owner (or override).
  app.post("/api/sops/:id/audits", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      if (!callerOwnsAudit(req.session.role, doc.auditOwnerRole)) {
        return res.status(403).json({ error: "You are not the audit owner for this SOP" });
      }
      const weekDate = currentWeekMonday();
      const existing = (await storage.getSopAuditRecords(doc.sopMasterId)).find((r) => r.weekDate === weekDate);
      if (existing) return res.status(409).json({ error: "This SOP has already been audited this week" });

      let score = req.body?.auditScore;
      score = score === null || score === undefined || score === "" ? null : Number(score);
      if (score !== null && (Number.isNaN(score) || score < 0 || score > 100)) {
        return res.status(400).json({ error: "Audit score must be between 0 and 100" });
      }
      const parsed = insertSopAuditRecordSchema.safeParse({
        sopMasterId: doc.sopMasterId,
        auditorId: req.session.userId,
        weekDate,
        evidenceCollected: !!req.body?.evidenceCollected,
        missesCount: Number(req.body?.missesCount ?? 0) || 0,
        auditScore: score,
        notes: req.body?.notes ? String(req.body.notes).trim() : null,
      });
      if (!parsed.success) return res.status(400).json({ error: "Invalid audit data", details: parsed.error.flatten() });
      const created = await storage.createSopAuditRecord(parsed.data);
      res.status(201).json(created);
    } catch (error) {
      console.error("SOP audit submit error:", error);
      res.status(500).json({ error: "Failed to submit audit" });
    }
  });

  // Raise an audit finding against a SOP.
  app.post("/api/sops/:id/findings", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      // Managers may only raise findings on SOPs they audit; HR/Ops/admin override.
      const role = req.session.role as string | undefined;
      const isGovernanceRole = ["super_admin", "admin", "hr", "operations"].includes(role || "");
      if (!isGovernanceRole && !callerOwnsAudit(role, doc.auditOwnerRole)) {
        return res.status(403).json({ error: "You can only raise findings on SOPs you audit" });
      }
      const description = (req.body?.description ?? "").toString().trim();
      if (!description) return res.status(400).json({ error: "A description is required" });
      const parsed = insertSopAuditFindingSchema.safeParse({
        sopMasterId: doc.sopMasterId,
        raisedBy: req.session.userId,
        ownerId: req.body?.ownerId ? String(req.body.ownerId) : null,
        description,
        correctiveAction: req.body?.correctiveAction ? String(req.body.correctiveAction).trim() : null,
        dueDate: req.body?.dueDate ? String(req.body.dueDate) : null,
        status: "open",
      });
      if (!parsed.success) return res.status(400).json({ error: "Invalid finding data", details: parsed.error.flatten() });
      const created = await storage.createSopAuditFinding(parsed.data);
      // Notify the corrective-action owner, if assigned.
      if (created.ownerId && created.ownerId !== req.session.userId) {
        try {
          await storage.createNotification({
            userId: created.ownerId, type: "sop_finding_assigned", title: "SOP audit finding assigned",
            message: `A corrective action is assigned to you on SOP ${doc.code} — ${doc.title}.`,
            isRead: false, metadata: { sopId: doc.id, link: "/admin/sops/compliance" },
          });
        } catch (e) { console.error("SOP finding notify error:", e); }
      }
      res.status(201).json(created);
    } catch (error) {
      console.error("SOP finding create error:", error);
      res.status(500).json({ error: "Failed to raise finding" });
    }
  });

  // Filterable findings tracker — all findings across SOPs. Lives under /compliance/*
  // (2+ segments) so it can never be shadowed by the single-segment GET /api/sops/:id.
  // Filters: status, sopMasterId, ownerId, overdue.
  app.get("/api/sops/compliance/findings", requireAuth, requirePermission("sops.view", "hr", "operations"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const { status, sopMasterId, ownerId, overdue } = req.query as Record<string, string>;
      const [all, docs, users] = await Promise.all([
        storage.getSopAuditFindings(sopMasterId || undefined),
        storage.getSopDocuments({ currentOnly: true }),
        storage.getAdminUsers(),
      ]);
      const codeByMaster = new Map(docs.map((d) => [d.sopMasterId, { code: d.code, title: d.title, sopId: d.id }]));
      const nameById = new Map(users.map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email]));
      const todayStr = new Date().toISOString().slice(0, 10);
      let findings = all;
      if (status) findings = findings.filter((f) => f.status === status);
      if (ownerId) findings = findings.filter((f) => f.ownerId === ownerId);
      if (overdue === "true") {
        findings = findings.filter((f) => (f.status === "open" || f.status === "in_progress") && f.dueDate && String(f.dueDate) < todayStr);
      }
      res.json(findings.map((f) => {
        const sop = codeByMaster.get(f.sopMasterId);
        return {
          ...f,
          sopCode: sop?.code ?? f.sopMasterId,
          sopTitle: sop?.title ?? null,
          sopId: sop?.sopId ?? null,
          raisedByName: f.raisedBy ? (nameById.get(f.raisedBy) ?? "Unknown") : null,
          ownerName: f.ownerId ? (nameById.get(f.ownerId) ?? "Unknown") : null,
          overdue: (f.status === "open" || f.status === "in_progress") && !!f.dueDate && String(f.dueDate) < todayStr,
        };
      }));
    } catch (error) {
      console.error("SOP findings list error:", error);
      res.status(500).json({ error: "Failed to fetch findings" });
    }
  });

  // Update a finding (status / corrective action / owner / due date). 2-segment
  // path so it never collides with PATCH /api/sops/:id. Restricted to HR/Ops
  // (+ super_admin/admin) — managers raise findings but do not own resolution.
  app.patch("/api/sops/findings/:findingId", requireAuth, requirePermission("sops.manage", "hr", "operations"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const updates: Record<string, unknown> = {};
      const validStatuses = ["open", "in_progress", "resolved", "closed"];
      if (req.body?.status !== undefined) {
        if (!validStatuses.includes(req.body.status)) return res.status(400).json({ error: "Invalid status" });
        updates.status = req.body.status;
        updates.resolvedAt = (req.body.status === "resolved" || req.body.status === "closed") ? new Date() : null;
      }
      if (req.body?.correctiveAction !== undefined) updates.correctiveAction = req.body.correctiveAction ? String(req.body.correctiveAction).trim() : null;
      if (req.body?.ownerId !== undefined) updates.ownerId = req.body.ownerId ? String(req.body.ownerId) : null;
      if (req.body?.dueDate !== undefined) updates.dueDate = req.body.dueDate ? String(req.body.dueDate) : null;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No updates provided" });
      const updated = await storage.updateSopAuditFinding(req.params.findingId, updates as any);
      if (!updated) return res.status(404).json({ error: "Finding not found" });
      res.json(updated);
    } catch (error) {
      console.error("SOP finding update error:", error);
      res.status(500).json({ error: "Failed to update finding" });
    }
  });

  // Governance dashboard summary — adoption, overdue reviews, training/ack gaps,
  // open findings, audit coverage. Optional filters: category, wave, role, department.
  app.get("/api/sops/compliance/summary", requireAuth, requirePermission("sops.view", "hr", "operations"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const data = await buildSopComplianceReport(req.query as Record<string, string>);
      res.json(data);
    } catch (error) {
      console.error("SOP compliance summary error:", error);
      res.status(500).json({ error: "Failed to build compliance report" });
    }
  });

  // OPS-001 access-control KPIs (Task #665) — computed from HIRD "access" requests
  // and employee exit (deprovisioning) data. Powers the governance dashboard KPI
  // cards and the performance scorecard's access-responsibility companion.
  app.get("/api/sops/ops001/access-kpis", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });

      const accessReqs = await storage.listInternalRequestsQueue({ type: "access" });
      const APPROVED_STATUSES = ["assigned", "in_progress", "needs_info", "resolved", "closed"];
      const GRANTED_STATUSES = ["resolved", "closed"];

      const total = accessReqs.length;
      const pending = accessReqs.filter((r) => r.status === "pending_approval").length;
      const rejected = accessReqs.filter((r) => r.status === "rejected").length;
      const approved = accessReqs.filter((r) => APPROVED_STATUSES.includes(r.status as string)).length;
      const granted = accessReqs.filter((r) => GRANTED_STATUSES.includes(r.status as string));

      // Compliance: of accesses actually granted, how many carry a recorded
      // manager approval decision (target: 100% approval before access).
      let grantedWithApproval = 0;
      for (const r of granted) {
        const approvals = await storage.listInternalRequestApprovals(r.id);
        if (approvals.some((a) => a.decision === "approved")) grantedWithApproval += 1;
      }
      const approvalBeforeAccessPct = granted.length === 0 ? 100 : Math.round((grantedWithApproval / granted.length) * 100);

      // Deprovisioning: exited employees whose access has been removed (account
      // deactivated) upon leaving/relieving.
      const users = await storage.getAdminUsers();
      const exited = users.filter((u) => !u.deletedAt && (u.employmentStatus === "relieved" || u.employmentStatus === "left_company"));
      const accessRemoved = exited.filter((u) => !u.isActive).length;
      const completionPct = exited.length === 0 ? 100 : Math.round((accessRemoved / exited.length) * 100);

      // Per-role responsibility breakdown for the performance scorecard.
      const roleById = new Map(users.map((u) => [u.id, u.role]));
      const roleMap = new Map<string, { role: string; raised: number; approved: number; requesters: Set<string> }>();
      for (const r of accessReqs) {
        const role = (roleById.get(r.requesterId) as string) || "unknown";
        const entry = roleMap.get(role) || { role, raised: 0, approved: 0, requesters: new Set<string>() };
        entry.raised += 1;
        entry.requesters.add(r.requesterId);
        if (APPROVED_STATUSES.includes(r.status as string)) entry.approved += 1;
        roleMap.set(role, entry);
      }
      const byRole = Array.from(roleMap.values())
        .map((e) => ({ role: e.role, raised: e.raised, approved: e.approved, requesters: e.requesters.size }))
        .sort((a, b) => a.role.localeCompare(b.role));

      res.json({
        access: { total, approved, rejected, pending, granted: granted.length, approvalBeforeAccessPct },
        deprovisioning: { exited: exited.length, accessRemoved, completionPct },
        byRole,
      });
    } catch (error) {
      console.error("OPS-001 access KPIs error:", error);
      res.status(500).json({ error: "Failed to build access KPIs" });
    }
  });

  // Per-employee OPS-001 access-responsibility scorecard item (Task #665) — used
  // inside the performance review (manager assessment) to show whether an employee
  // self-served required tool access (raised + got approved) vs operating without it.
  // 3-segment path — never shadowed by GET /api/sops/:id.
  app.get("/api/sops/ops001/employee-access/:employeeId", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });

      const employeeId = req.params.employeeId;
      const APPROVED_STATUSES = ["assigned", "in_progress", "needs_info", "resolved", "closed"];

      // Is OPS-001 active (trained/acknowledged) for this employee?
      const currentDocs = await storage.getSopDocuments({ currentOnly: true });
      const ops001Doc = currentDocs.find((d) => d.code === "OPS-001");
      let ops001Active = false;
      if (ops001Doc) {
        const prog = (await storage.getSopEmployeeProgressForUser(employeeId)).find((p) => p.sopMasterId === ops001Doc.sopMasterId);
        ops001Active = !!prog && (!!prog.trainingCompletedAt || !!prog.acknowledgedAt);
      }

      const allAccess = await storage.listInternalRequestsQueue({ type: "access" });
      const mine = allAccess.filter((r) => r.requesterId === employeeId);

      const raised = mine.length;
      const approved = mine.filter((r) => APPROVED_STATUSES.includes(r.status as string)).length;
      const pending = mine.filter((r) => r.status === "pending_approval").length;
      const rejected = mine.filter((r) => r.status === "rejected").length;
      const hasApprovedAccess = approved > 0;

      const decisionFor = (status: string): "approved" | "rejected" | "pending" =>
        status === "rejected" ? "rejected" : status === "pending_approval" ? "pending" : "approved";

      const requests = mine
        .map((r) => {
          const tpl = (r.templateData || {}) as Record<string, any>;
          return {
            id: r.id,
            requestNumber: r.requestNumber,
            system: tpl.system ?? null,
            accessLevel: tpl.accessLevel ?? null,
            status: r.status,
            decision: decisionFor(r.status as string),
            createdAt: r.createdAt,
          };
        })
        .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());

      res.json({ ops001Active, raised, approved, pending, rejected, hasApprovedAccess, requests });
    } catch (error) {
      console.error("OPS-001 employee-access error:", error);
      res.status(500).json({ error: "Failed to load access responsibility" });
    }
  });

  // Access Requests evidence view for a SOP detail page (Task #665) — lists HIRD
  // "access" requests, flagging those tagged to this SOP (OPS-001). 2-segment path
  // is never shadowed by GET /api/sops/:id.
  app.get("/api/sops/:id/access-requests", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });

      const versions = await storage.getSopVersionHistory(doc.sopMasterId);
      const versionIds = new Set(versions.map((v) => v.id));
      versionIds.add(doc.id);

      const [accessReqs, users] = await Promise.all([
        storage.listInternalRequestsQueue({ type: "access" }),
        storage.getAdminUsers(),
      ]);
      const byId = new Map(users.map((u) => [u.id, u]));

      const decisionFor = (status: string): "approved" | "rejected" | "pending" =>
        status === "rejected" ? "rejected" : status === "pending_approval" ? "pending" : "approved";

      const rows = accessReqs.map((r) => {
        const u = byId.get(r.requesterId);
        const tpl = (r.templateData || {}) as Record<string, any>;
        return {
          id: r.id,
          requestNumber: r.requestNumber,
          title: r.title,
          status: r.status,
          priority: r.priority,
          createdAt: r.createdAt,
          requesterName: u ? (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email) : "Unknown",
          requesterRole: u?.role ?? null,
          system: tpl.system ?? null,
          accessLevel: tpl.accessLevel ?? null,
          managerDecision: decisionFor(r.status as string),
          taggedOps001: !!r.linkedSopId && versionIds.has(r.linkedSopId),
        };
      });
      // Tagged (SOP-linked) first, then most recent.
      rows.sort((a, b) => {
        if (a.taggedOps001 !== b.taggedOps001) return a.taggedOps001 ? -1 : 1;
        return new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime();
      });

      res.json({ requests: rows, taggedCount: rows.filter((r) => r.taggedOps001).length, total: rows.length });
    } catch (error) {
      console.error("SOP access-requests error:", error);
      res.status(500).json({ error: "Failed to fetch access requests" });
    }
  });

  // CSV export of the governance dashboard (per-SOP rows).
  app.get("/api/sops/compliance/export", requireAuth, requirePermission("sops.view", "hr", "operations"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const data = await buildSopComplianceReport(req.query as Record<string, string>);
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ["Code", "Title", "Category", "Wave", "Status", "Impacted", "Trained", "Acknowledged", "Adoption %", "Open Findings", "Last Audit", "Last Score", "Overdue Reviews"];
      const lines = data.sops.map((s) => [
        s.code, s.title, s.category, s.launchWave, s.lifecycleStatus, s.impacted, s.trained, s.acknowledged,
        s.adoptionPct, s.openFindings, s.lastAuditWeek ?? "", s.lastAuditScore ?? "", s.overdueReviews,
      ].map(esc).join(","));
      const csv = [header.join(","), ...lines].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="sop_compliance_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("SOP compliance export error:", error);
      res.status(500).json({ error: "Failed to export compliance report" });
    }
  });

  // Per-SOP compliance drill-down: per-employee training/ack status + audits + findings.
  app.get("/api/sops/:id/compliance", requireAuth, requirePermission("sops.view", "hr", "operations"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const [progress, records, findings, users] = await Promise.all([
        storage.getSopEmployeeProgress(doc.sopMasterId),
        storage.getSopAuditRecords(doc.sopMasterId),
        storage.getSopAuditFindings(doc.sopMasterId),
        storage.getAdminUsers(),
      ]);
      const byId = new Map(users.map((u) => [u.id, u]));
      const employees = progress.map((p) => {
        const u = byId.get(p.userId);
        return {
          userId: p.userId,
          name: u ? (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email) : "Unknown",
          role: u?.role ?? null,
          departmentId: u?.departmentId ?? null,
          trained: !!p.trainingCompletedAt,
          acknowledgedVersion: p.acknowledgedAt ? p.sopVersion : null,
          acknowledgedAt: p.acknowledgedAt,
          acknowledgedCurrent: !!p.acknowledgedAt && p.sopVersion === doc.version,
        };
      });
      const nameById = new Map(users.map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email]));
      res.json({
        sop: { id: doc.id, code: doc.code, title: doc.title, category: doc.category, version: doc.version, lifecycleStatus: doc.lifecycleStatus, auditOwnerRole: doc.auditOwnerRole },
        employees,
        records: records.map((r) => ({ ...r, auditorName: r.auditorId ? (nameById.get(r.auditorId) ?? "Unknown") : null })),
        findings: findings.map((f) => ({
          ...f,
          raisedByName: f.raisedBy ? (nameById.get(f.raisedBy) ?? "Unknown") : null,
          ownerName: f.ownerId ? (nameById.get(f.ownerId) ?? "Unknown") : null,
        })),
      });
    } catch (error) {
      console.error("SOP compliance drill-down error:", error);
      res.status(500).json({ error: "Failed to fetch SOP compliance detail" });
    }
  });

  // CSV export of a single SOP's per-employee training/acknowledgement status.
  // 4-segment path — never shadowed by GET /api/sops/:id.
  app.get("/api/sops/:id/compliance/export", requireAuth, requirePermission("sops.view", "hr", "operations"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const [progress, users] = await Promise.all([
        storage.getSopEmployeeProgress(doc.sopMasterId),
        storage.getAdminUsers(),
      ]);
      const byId = new Map(users.map((u) => [u.id, u]));
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ["Employee", "Role", "Trained", "Acknowledged Version", "Acknowledged At", "Acknowledged Current"];
      const lines = progress.map((p) => {
        const u = byId.get(p.userId);
        return [
          u ? (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email) : "Unknown",
          u?.role ?? "",
          p.trainingCompletedAt ? "Yes" : "No",
          p.acknowledgedAt ? p.sopVersion : "",
          p.acknowledgedAt ? new Date(p.acknowledgedAt).toISOString().slice(0, 10) : "",
          (!!p.acknowledgedAt && p.sopVersion === doc.version) ? "Yes" : "No",
        ].map(esc).join(",");
      });
      const csv = [header.join(","), ...lines].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="sop_${doc.code}_employees_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("SOP drill-down export error:", error);
      res.status(500).json({ error: "Failed to export SOP compliance detail" });
    }
  });

  // Performance goals linked to a SOP (Task #664). Resolves by sopMasterId so the
  // "KPIs Tracked" section survives version clones (linked_sop_id points at the
  // version-specific row selected at link time). 4-segment path — never shadowed
  // by GET /api/sops/:id.
  app.get("/api/sops/:id/goals", requireAuth, requirePermission("sops.view", "hr", "operations", "manager"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const doc = await storage.getSopDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: "SOP not found" });
      const versions = await storage.getSopVersionHistory(doc.sopMasterId);
      const versionIds = Array.from(new Set([doc.id, ...versions.map((v) => v.id)]));
      const goals = await db.select().from(performanceGoals)
        .where(inArray(performanceGoals.linkedSopId, versionIds))
        .orderBy(desc(performanceGoals.createdAt));
      const users = await storage.getAdminUsers();
      const byId = new Map(users.map((u) => [u.id, u]));
      res.json(goals.map((g) => {
        const u = byId.get(g.employeeId);
        return {
          id: g.id,
          title: g.title,
          assigneeName: u ? (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email) : "Unknown",
          assigneeRole: u?.role ?? null,
          progress: g.progress,
          status: g.status,
          targetDate: g.targetDate,
          category: g.category,
        };
      }));
    } catch (error) {
      console.error("SOP linked goals error:", error);
      res.status(500).json({ error: "Failed to fetch linked goals" });
    }
  });

  // Monthly Business Review (MBR) — branded PDF export of the governance dashboard,
  // grouped by category, with per-SOP adoption, last audit score, open findings,
  // linked-KPI status, lifecycle status, and wave (Task #664).
  app.get("/api/sops/mbr/export", requireAuth, requirePermission("sops.view", "hr", "operations"), async (req: Request, res: Response) => {
    try {
      const { enabled } = await resolveSopAccess(req);
      if (!enabled) return res.status(403).json({ error: "Process Governance is not enabled for your account" });
      const report = await buildSopComplianceReport(req.query as Record<string, string>);

      // Attach linked-KPI (goal) roll-up per SOP, resolved via sopMasterId.
      const allGoals = await db.select({
        linkedSopId: performanceGoals.linkedSopId,
        progress: performanceGoals.progress,
        status: performanceGoals.status,
      }).from(performanceGoals).where(isNotNull(performanceGoals.linkedSopId));
      // Map every version id -> its sopMasterId so goals linked to any version roll up.
      const allDocs = await storage.getSopDocuments({ currentOnly: false });
      const masterByVersionId = new Map(allDocs.map((d) => [d.id, d.sopMasterId]));
      const goalsByMaster = new Map<string, { total: number; sumProgress: number; completed: number }>();
      for (const g of allGoals) {
        const master = g.linkedSopId ? masterByVersionId.get(g.linkedSopId) : undefined;
        if (!master) continue;
        const agg = goalsByMaster.get(master) ?? { total: 0, sumProgress: 0, completed: 0 };
        agg.total += 1;
        agg.sumProgress += g.progress ?? 0;
        if (g.status === "completed") agg.completed += 1;
        goalsByMaster.set(master, agg);
      }

      const sopsWithKpi = report.sops.map((s) => {
        const agg = goalsByMaster.get(s.sopMasterId);
        return {
          ...s,
          linkedGoals: agg?.total ?? 0,
          linkedGoalsAvgProgress: agg && agg.total > 0 ? Math.round(agg.sumProgress / agg.total) : null,
          linkedGoalsCompleted: agg?.completed ?? 0,
        };
      });

      const pdfBuffer = await generateSopMbrPdf({
        generatedAt: new Date(),
        summary: report.summary,
        sops: sopsWithKpi,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="sop_mbr_${new Date().toISOString().slice(0, 10)}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("SOP MBR export error:", error);
      res.status(500).json({ error: "Failed to export MBR report" });
    }
  });

  // Shared builder for the governance dashboard summary + CSV export.
  async function buildSopComplianceReport(query: Record<string, string>) {
    const { category, wave, role, department } = query;
    let docs = (await storage.getSopDocuments({ currentOnly: true }))
      .filter((d) => AUDITABLE_STATUSES.includes(d.lifecycleStatus));
    if (category) docs = docs.filter((d) => d.category === category);
    if (wave !== undefined && wave !== "") docs = docs.filter((d) => d.launchWave === Number(wave));

    const users = await storage.getAdminUsers();
    const userById = new Map(users.map((u) => [u.id, u]));
    const now = Date.now();

    const sops = [] as Array<{
      id: string; sopMasterId: string; code: string; title: string; category: string; launchWave: number;
      lifecycleStatus: string; version: number; auditOwnerRole: string | null;
      impacted: number; trained: number; acknowledged: number; adoptionPct: number;
      openFindings: number; overdueReviews: number;
      lastAuditWeek: string | null; lastAuditScore: number | null;
    }>;
    let totalImpacted = 0, totalTrained = 0, totalAck = 0, totalOpenFindings = 0, totalOverdueReviews = 0, auditedThisWeek = 0;
    const weekDate = currentWeekMonday();

    for (const d of docs) {
      let progress = await storage.getSopEmployeeProgress(d.sopMasterId);
      // Role/department filters scope the impacted population per SOP.
      if (role || department) {
        progress = progress.filter((p) => {
          const u = userById.get(p.userId);
          if (!u) return false;
          if (role && u.role !== role) return false;
          if (department && u.departmentId !== department) return false;
          return true;
        });
      }
      const impacted = progress.length;
      const trained = progress.filter((p) => !!p.trainingCompletedAt).length;
      const acknowledged = progress.filter((p) => !!p.acknowledgedAt && p.sopVersion === d.version).length;
      const adoptionPct = impacted === 0 ? 0 : Math.round((acknowledged / impacted) * 100);

      const findings = await storage.getSopAuditFindings(d.sopMasterId);
      const openFindings = findings.filter((f) => f.status === "open" || f.status === "in_progress").length;

      const reviews = sopGov.latestRound(await storage.getSopReviewAssignments(d.sopMasterId, d.version));
      const overdueReviews = reviews.filter((r) => r.status === "pending" && r.dueAt && new Date(r.dueAt).getTime() < now).length;

      const records = await storage.getSopAuditRecords(d.sopMasterId);
      const last = records[0] ?? null;
      if (records.some((r) => r.weekDate === weekDate)) auditedThisWeek += 1;

      sops.push({
        id: d.id, sopMasterId: d.sopMasterId, code: d.code, title: d.title, category: d.category, launchWave: d.launchWave,
        lifecycleStatus: d.lifecycleStatus, version: d.version, auditOwnerRole: d.auditOwnerRole,
        impacted, trained, acknowledged, adoptionPct, openFindings, overdueReviews,
        lastAuditWeek: last?.weekDate ?? null, lastAuditScore: last?.auditScore ?? null,
      });
      totalImpacted += impacted; totalTrained += trained; totalAck += acknowledged;
      totalOpenFindings += openFindings; totalOverdueReviews += overdueReviews;
    }
    sops.sort((a, b) => a.code.localeCompare(b.code));

    const categories = Array.from(new Set((await storage.getSopDocuments({ currentOnly: true })).map((d) => d.category))).sort();
    const depts = await storage.getDepartments();
    const departments = depts.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name));
    const roles = Array.from(new Set(users.map((u) => u.role).filter((r): r is string => !!r))).sort();
    return {
      summary: {
        totalSops: sops.length,
        adoptionPct: totalImpacted === 0 ? 0 : Math.round((totalAck / totalImpacted) * 100),
        trainingPct: totalImpacted === 0 ? 0 : Math.round((totalTrained / totalImpacted) * 100),
        ackGaps: totalImpacted - totalAck,
        openFindings: totalOpenFindings,
        overdueReviews: totalOverdueReviews,
        auditedThisWeek,
        auditCoveragePct: sops.length === 0 ? 0 : Math.round((auditedThisWeek / sops.length) * 100),
      },
      filters: { categories, departments, roles },
      sops,
    };
  }

  // Auto-assign training on publish, filtered through the rollout gate. Returns the
  // number of users assigned and the impacted/skipped breakdown.
  async function assignSopTraining(doc: SopDocument, req: Request): Promise<{ assignedCount: number; skippedOutOfRollout: number; impacted: number }> {
    const impacted = await impactedUserIdsForSop(doc.sopMasterId);
    if (impacted.length === 0) return { assignedCount: 0, skippedOutOfRollout: 0, impacted: 0 };

    // Always project progress rows for impacted users (in-rollout or not), so a
    // later rollout expansion + sync simply assigns training for already-tracked users.
    const current = await storage.getSopDocumentById(doc.id);
    for (const userId of impacted) {
      await storage.upsertSopEmployeeProgress(doc.sopMasterId, current?.version ?? doc.version, userId);
    }

    if (!doc.learningTrackId) return { assignedCount: 0, skippedOutOfRollout: 0, impacted: impacted.length };

    // Filter recipients through the server-side rollout gate.
    const rollout = await getSopRolloutScope();
    const allUsers = await storage.getAdminUsers();
    const byId = new Map(allUsers.map((u) => [u.id, u]));
    const inRollout = (userId: string): boolean => {
      const u = byId.get(userId);
      if (!u) return false;
      if (u.role === "super_admin" || u.role === "admin") return true;
      if (rollout.mode === "all") return true;
      if (u.role && rollout.roles.includes(u.role)) return true;
      if (rollout.userIds.includes(userId)) return true;
      return false;
    };

    let assignedCount = 0;
    let skippedOutOfRollout = 0;
    const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    for (const userId of impacted) {
      if (!inRollout(userId)) { skippedOutOfRollout += 1; continue; }
      const [existing] = await db.select().from(trackAssignments)
        .where(and(eq(trackAssignments.trackId, doc.learningTrackId), eq(trackAssignments.userId, userId)));
      if (existing) continue;
      await db.insert(trackAssignments).values({
        trackId: doc.learningTrackId, userId, assignedBy: req.session.userId!, dueDate, status: "not_started",
      });
      assignedCount += 1;
      try {
        await storage.createNotification({
          userId,
          type: "sop_training_assigned",
          title: "New SOP training assigned",
          message: `Training is required for SOP ${doc.code} — ${doc.title}.`,
          isRead: false,
          metadata: { sopId: doc.id, trackId: doc.learningTrackId, link: "/admin/my-training" },
        });
      } catch (e) { console.error("SOP training notify error:", e); }
    }
    return { assignedCount, skippedOutOfRollout, impacted: impacted.length };
  }

  // ==========================================
  // ACCESS CONTROL (DB-driven RBAC, Super Admin editor)
  // ==========================================

  // Hardcoded Super-Admin-only gate — never resolved through the matrix, so the
  // editor itself can never be locked out regardless of saved permissions.
  function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    if (req.session.role !== "super_admin") return res.status(403).json({ error: "Super Admin access required" });
    next();
  }

  // ==========================================
  // PENDING CHANGES (automated-job guardrail) — Super Admin only
  // ==========================================
  // Automated/scheduled jobs PROPOSE changes here instead of overwriting user-entered
  // values. A Super Admin reviews each proposal and approves (apply transactionally +
  // audit) or rejects (discard). Nothing is ever auto-applied.

  // Count of proposals awaiting review (for the sidebar badge).
  app.get("/api/admin/pending-changes/count", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const count = await storage.countPendingChanges("pending");
      res.json({ count });
    } catch (error) {
      console.error("Pending changes count error:", error);
      res.status(500).json({ error: "Failed to fetch pending changes count" });
    }
  });

  // List proposals (default: pending), enriched with employee name + grouped by run date.
  app.get("/api/admin/pending-changes", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const status = (req.query.status as string) || "pending";
      const changes = await storage.getPendingChanges({ status });

      const allUsers = await storage.getAdminUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const enriched = changes.map((c) => {
        const u = c.targetUserId ? userMap.get(c.targetUserId) : undefined;
        return {
          ...c,
          employeeName: u ? `${u.firstName} ${u.lastName}`.trim() : "Unknown",
          employeeEmail: u?.email ?? null,
        };
      });

      // Group into a dated daily report (newest date first).
      const groupsMap = new Map<string, typeof enriched>();
      for (const c of enriched) {
        if (!groupsMap.has(c.runDate)) groupsMap.set(c.runDate, []);
        groupsMap.get(c.runDate)!.push(c);
      }
      const groups = Array.from(groupsMap.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([runDate, items]) => ({ runDate, count: items.length, items }));

      res.json({ total: enriched.length, groups });
    } catch (error) {
      console.error("Pending changes list error:", error);
      res.status(500).json({ error: "Failed to fetch pending changes" });
    }
  });

  // Approve a single proposal (apply + audit, transactional).
  app.post("/api/admin/pending-changes/:id/approve", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.approvePendingChange(req.params.id, req.session.userId!, req.body?.note);
      if (!result.ok) return res.status(409).json({ error: result.reason });
      res.json({ ok: true });
    } catch (error) {
      console.error("Approve pending change error:", error);
      res.status(500).json({ error: "Failed to approve proposal" });
    }
  });

  // Reject a single proposal (discard + audit).
  app.post("/api/admin/pending-changes/:id/reject", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.rejectPendingChange(req.params.id, req.session.userId!, req.body?.note);
      if (!result.ok) return res.status(409).json({ error: result.reason });
      res.json({ ok: true });
    } catch (error) {
      console.error("Reject pending change error:", error);
      res.status(500).json({ error: "Failed to reject proposal" });
    }
  });

  // Bulk approve.
  app.post("/api/admin/pending-changes/bulk-approve", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (ids.length === 0) return res.status(400).json({ error: "No proposal ids provided" });
      let approved = 0;
      const failures: { id: string; reason?: string }[] = [];
      for (const id of ids) {
        const result = await storage.approvePendingChange(id, req.session.userId!, req.body?.note);
        if (result.ok) approved++;
        else failures.push({ id, reason: result.reason });
      }
      res.json({ approved, failed: failures.length, failures });
    } catch (error) {
      console.error("Bulk approve pending changes error:", error);
      res.status(500).json({ error: "Failed to bulk approve proposals" });
    }
  });

  // Bulk reject.
  app.post("/api/admin/pending-changes/bulk-reject", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (ids.length === 0) return res.status(400).json({ error: "No proposal ids provided" });
      let rejected = 0;
      const failures: { id: string; reason?: string }[] = [];
      for (const id of ids) {
        const result = await storage.rejectPendingChange(id, req.session.userId!, req.body?.note);
        if (result.ok) rejected++;
        else failures.push({ id, reason: result.reason });
      }
      res.json({ rejected, failed: failures.length, failures });
    } catch (error) {
      console.error("Bulk reject pending changes error:", error);
      res.status(500).json({ error: "Failed to bulk reject proposals" });
    }
  });

  // ==========================================
  // COMMUNICATIONS CONTROL CENTER — Super Admin only
  // ==========================================
  // Visibility + governance over all automated/system email. Every automated send
  // routes through email.ts dispatchAutomatedEmail, which consults per-type policy
  // (auto-send vs hold-for-approval) and writes an activity-log row. Super Admins
  // review the held queue here and approve (send + audit) or reject (discard + audit).

  // Type registry + current policy (for the policy settings UI).
  // Merges system types with non-deleted custom types from communication_config.
  app.get("/api/admin/communications/types", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const policy = await storage.getCommunicationPolicy();
      const customConfigs = await storage.getCommunicationConfigs();
      const customTypes = customConfigs
        .filter((c) => c.isCustom)
        .map((c) => ({
          key: c.typeKey,
          label: c.label ?? c.typeKey,
          description: c.description ?? "",
          category: c.category ?? "Custom",
          scheduleLabel: c.scheduleLabel ?? undefined,
          recipientRule: c.recipientRule ?? undefined,
        }));
      res.json({ types: [...COMMUNICATION_TYPES, ...customTypes], policy });
    } catch (error) {
      console.error("Communication types error:", error);
      res.status(500).json({ error: "Failed to fetch communication types" });
    }
  });

  // Update per-type policy (partial map merged over existing).
  app.put("/api/admin/communications/policy", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const incoming = (req.body?.policy ?? {}) as Record<string, unknown>;
      // Allow policy updates for both system types AND custom types
      const customConfigs = await storage.getCommunicationConfigs();
      const customKeys = new Set(customConfigs.filter((c) => c.isCustom).map((c) => c.typeKey));
      const validKeys = new Set([...COMMUNICATION_TYPES.map((t) => t.key), ...customKeys]);
      const existing = await storage.getCommunicationPolicy();
      const merged: Record<string, "auto" | "hold"> = { ...existing };
      for (const [key, value] of Object.entries(incoming)) {
        if (!validKeys.has(key)) continue;
        if (value !== "auto" && value !== "hold") continue;
        merged[key] = value;
      }
      const saved = await storage.setCommunicationPolicy(merged, req.session.userId!);
      res.json({ policy: saved });
    } catch (error) {
      console.error("Update communication policy error:", error);
      res.status(500).json({ error: "Failed to update communication policy" });
    }
  });

  // Count of communications awaiting approval (for the sidebar/landing badge).
  app.get("/api/admin/communications/count", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const count = await storage.countCommunications("held");
      res.json({ count });
    } catch (error) {
      console.error("Communications count error:", error);
      res.status(500).json({ error: "Failed to fetch communications count" });
    }
  });

  // Activity log (filter by status/type). Default returns latest across all statuses.
  app.get("/api/admin/communications", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const status = req.query.status ? String(req.query.status) : undefined;
      const type = req.query.type ? String(req.query.type) : undefined;
      const recipient = req.query.recipient ? String(req.query.recipient).trim() : undefined;
      const limit = req.query.limit ? Math.min(500, Math.max(1, parseInt(String(req.query.limit), 10) || 200)) : 200;
      const parseDate = (v: unknown): Date | undefined => {
        if (!v) return undefined;
        const d = new Date(String(v));
        return isNaN(d.getTime()) ? undefined : d;
      };
      const startDate = parseDate(req.query.startDate);
      // Inclusive end-of-day when only a date (no time) is supplied.
      let endDate = parseDate(req.query.endDate);
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.endDate))) {
        endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      const logs = await storage.getCommunicationLogs({ status, type, recipient, startDate, endDate, limit });
      res.json({ total: logs.length, logs });
    } catch (error) {
      console.error("Communications list error:", error);
      res.status(500).json({ error: "Failed to fetch communications" });
    }
  });

  // Approve a single held communication: re-send it, then mark approved + audit.
  app.post("/api/admin/communications/:id/approve", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      // Atomic claim (compare-and-swap on status='held') prevents two concurrent
      // approvers from double-sending the same email.
      const claimed = await storage.claimCommunicationForApproval(req.params.id, req.session.userId!, req.body?.note);
      if (!claimed) return res.status(409).json({ error: "Communication is not awaiting approval" });

      const { resendHeldCommunication } = await import("./email");
      const result = await resendHeldCommunication({
        recipients: claimed.recipients ?? [],
        cc: claimed.cc,
        subject: claimed.subject,
        bodyHtml: claimed.bodyHtml,
        bodyText: claimed.bodyText,
      });
      if (!result.success) {
        await storage.markCommunicationFailed(req.params.id, result.error ?? "Send failed");
        return res.status(502).json({ error: result.error ?? "Failed to send communication" });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Approve communication error:", error);
      res.status(500).json({ error: "Failed to approve communication" });
    }
  });

  // Reject a single held communication (discard + audit, no send).
  app.post("/api/admin/communications/:id/reject", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.rejectCommunication(req.params.id, req.session.userId!, req.body?.note);
      if (!result.ok) return res.status(409).json({ error: result.reason });
      res.json({ ok: true });
    } catch (error) {
      console.error("Reject communication error:", error);
      res.status(500).json({ error: "Failed to reject communication" });
    }
  });

  // Bulk approve held communications.
  app.post("/api/admin/communications/bulk-approve", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (ids.length === 0) return res.status(400).json({ error: "No communication ids provided" });
      const { resendHeldCommunication } = await import("./email");
      let approved = 0;
      const failures: { id: string; reason?: string }[] = [];
      for (const id of ids) {
        // Atomic claim per id — only the winner of the compare-and-swap sends.
        const claimed = await storage.claimCommunicationForApproval(id, req.session.userId!, req.body?.note);
        if (!claimed) {
          failures.push({ id, reason: "Not awaiting approval" });
          continue;
        }
        const result = await resendHeldCommunication({
          recipients: claimed.recipients ?? [],
          cc: claimed.cc,
          subject: claimed.subject,
          bodyHtml: claimed.bodyHtml,
          bodyText: claimed.bodyText,
        });
        if (!result.success) {
          await storage.markCommunicationFailed(id, result.error ?? "Send failed");
          failures.push({ id, reason: result.error });
          continue;
        }
        approved++;
      }
      res.json({ approved, failed: failures.length, failures });
    } catch (error) {
      console.error("Bulk approve communications error:", error);
      res.status(500).json({ error: "Failed to bulk approve communications" });
    }
  });

  // Bulk reject held communications.
  app.post("/api/admin/communications/bulk-reject", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (ids.length === 0) return res.status(400).json({ error: "No communication ids provided" });
      let rejected = 0;
      const failures: { id: string; reason?: string }[] = [];
      for (const id of ids) {
        const result = await storage.rejectCommunication(id, req.session.userId!, req.body?.note);
        if (result.ok) rejected++;
        else failures.push({ id, reason: result.reason });
      }
      res.json({ rejected, failed: failures.length, failures });
    } catch (error) {
      console.error("Bulk reject communications error:", error);
      res.status(500).json({ error: "Failed to bulk reject communications" });
    }
  });

  // ==========================================
  // COMMUNICATION CONFIG (Super Admin per-type overrides)
  // ==========================================

  // GET: all system types merged with saved config rows + any custom types.
  app.get("/api/admin/communication-config", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const savedConfigs = await storage.getCommunicationConfigs();
      const configMap = new Map(savedConfigs.map((c) => [c.typeKey, c]));

      // Merge system types with any saved overrides
      const systemRows = COMMUNICATION_TYPES.map((t) => {
        const saved = configMap.get(t.key);
        return {
          typeKey: t.key,
          label: t.label,
          description: t.description,
          category: t.category,
          scheduleLabel: t.scheduleLabel,
          recipientRule: t.recipientRule,
          isCustom: false,
          enabled: saved?.enabled ?? true,
          cc: saved?.cc ?? [],
          extraTo: saved?.extraTo ?? [],
          updatedAt: saved?.updatedAt ?? null,
          updatedBy: saved?.updatedBy ?? null,
        };
      });

      // Custom types from DB only
      const customRows = savedConfigs
        .filter((c) => c.isCustom)
        .map((c) => ({
          typeKey: c.typeKey,
          label: c.label ?? c.typeKey,
          description: c.description ?? "",
          category: c.category ?? "Custom",
          scheduleLabel: c.scheduleLabel ?? null,
          recipientRule: c.recipientRule ?? null,
          isCustom: true,
          enabled: c.enabled,
          cc: c.cc ?? [],
          extraTo: c.extraTo ?? [],
          updatedAt: c.updatedAt ?? null,
          updatedBy: c.updatedBy ?? null,
        }));

      res.json({ configs: [...systemRows, ...customRows] });
    } catch (error) {
      console.error("Get communication-config error:", error);
      res.status(500).json({ error: "Failed to fetch communication config" });
    }
  });

  // PATCH: update enabled flag and/or CC for a given type key (system or custom).
  app.patch("/api/admin/communication-config/:key", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const { enabled, cc, extraTo } = req.body ?? {};
      const updates: Record<string, unknown> = {};
      if (typeof enabled === "boolean") updates.enabled = enabled;
      if (Array.isArray(cc)) updates.cc = cc.filter((e: unknown) => typeof e === "string" && e.trim());
      if (Array.isArray(extraTo)) updates.extraTo = extraTo.filter((e: unknown) => typeof e === "string" && e.trim());

      const saved = await storage.upsertCommunicationConfig(key, updates as any, req.session.userId!);
      res.json({ ok: true, config: saved });
    } catch (error) {
      console.error("Update communication-config error:", error);
      res.status(500).json({ error: "Failed to update communication config" });
    }
  });

  // POST: create a custom communication type.
  app.post("/api/admin/communication-config", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { typeKey, label, category, description, scheduleLabel, recipientRule, extraTo, cc } = req.body ?? {};
      if (!typeKey || !label || !category) {
        return res.status(400).json({ error: "typeKey, label, and category are required" });
      }
      // Reject keys that collide with system types
      const systemKeys = new Set(COMMUNICATION_TYPES.map((t) => t.key));
      if (systemKeys.has(typeKey)) {
        return res.status(400).json({ error: "A system type with this key already exists" });
      }
      const existing = await storage.getCommunicationConfig(typeKey);
      if (existing) {
        return res.status(409).json({ error: "A type with this key already exists" });
      }
      const created = await storage.createCustomCommunicationType({
        typeKey,
        label: String(label),
        category: String(category),
        description: description ? String(description) : null,
        scheduleLabel: scheduleLabel ? String(scheduleLabel) : null,
        recipientRule: recipientRule ? String(recipientRule) : null,
        extraTo: Array.isArray(extraTo) ? extraTo.filter((e: unknown) => typeof e === "string") : [],
        cc: Array.isArray(cc) ? cc.filter((e: unknown) => typeof e === "string") : [],
        enabled: true,
        isCustom: true,
      } as any, req.session.userId!);
      res.status(201).json({ ok: true, config: created });
    } catch (error) {
      console.error("Create custom communication type error:", error);
      res.status(500).json({ error: "Failed to create custom communication type" });
    }
  });

  // DELETE: remove a custom type (system types return 400).
  app.delete("/api/admin/communication-config/:key", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.deleteCustomCommunicationType(req.params.key, req.session.userId!);
      if (!result.ok) return res.status(400).json({ error: result.reason });
      res.json({ ok: true });
    } catch (error) {
      console.error("Delete communication type error:", error);
      res.status(500).json({ error: "Failed to delete communication type" });
    }
  });

  // Current user's effective permissions (feature keys their role can access).
  app.get("/api/me/permissions", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.session.role || "";
      const matrix = getEffectiveMatrix();
      const permissions = Object.keys(matrix).filter((k) => matrix[k].includes(role));
      res.json({ role, permissions, dbDriven: isDbDrivenAccessControl() });
    } catch (error) {
      console.error("Get my permissions error:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  // ==========================================
  // CONTENT & MARKETING STUDIO
  // ==========================================

  // ---- Smart-routing helpers ----

  // Resolve the reviewer pool for an article's category from a project's
  // routing rules, falling back to the default pool when no rule matches.
  function resolveReviewerPool(
    routingRules: unknown,
    category?: string | null,
  ): string[] {
    const rules = (routingRules ?? {}) as StudioRoutingRules;
    if (category && Array.isArray(rules.rules)) {
      const match = rules.rules.find(
        (r) => (r.category ?? "").trim().toLowerCase() === category.trim().toLowerCase(),
      );
      if (match && Array.isArray(match.reviewerUserIds) && match.reviewerUserIds.length) {
        return match.reviewerUserIds;
      }
    }
    return Array.isArray(rules.defaultReviewerUserIds) ? rules.defaultReviewerUserIds : [];
  }

  // Pick a reviewer from a pool. Default strategy is least-recently-assigned:
  // never-assigned reviewers are chosen first, then whoever was assigned the
  // longest time ago. Pool order breaks ties (round-robin friendly).
  async function pickReviewerFromPool(
    pool: string[],
    excludeUserId?: string,
  ): Promise<string | null> {
    const candidates = pool.filter((id) => id && id !== excludeUserId);
    if (candidates.length === 0) return null;
    const times = await storage.getLastStudioAssignmentTimes(candidates);
    let best: string | null = null;
    let bestVal = Infinity;
    for (const id of candidates) {
      const t = times[id];
      const val = t ? new Date(t).getTime() : -1; // never assigned sorts first
      if (val < bestVal) {
        bestVal = val;
        best = id;
      }
    }
    return best;
  }

  // Create a review assignment, point the article at the reviewer, and fire the
  // in-app notification + SendGrid email. Returns the created assignment.
  async function assignReviewerToArticle(
    article: StudioArticle,
    reviewerUserId: string,
    assignedBy: string | undefined,
    baseUrl: string,
    opts?: { dueAt?: Date; comment?: string | null },
  ) {
    const dueAt = opts?.dueAt ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const assignment = await storage.createStudioReviewAssignment({
      articleId: article.id,
      reviewerUserId,
      status: "pending",
      dueAt,
      assignedBy: assignedBy ?? null,
      comment: opts?.comment ?? null,
    } as any);
    await storage.updateStudioArticle(article.id, { reviewerUserId } as any);

    const dueLabel = dueAt.toLocaleDateString();
    try {
      await storage.createNotification({
        userId: reviewerUserId,
        type: "studio_review_assigned",
        title: "New article to review",
        message: `You have a new article to review: ${article.title} — due ${dueLabel}`,
        isRead: false,
        metadata: { articleId: article.id, assignmentId: assignment.id, link: "/admin/studio/inbox" },
      });
    } catch (notifyErr) {
      console.error("Studio review notification error:", notifyErr);
    }

    try {
      const reviewer = await storage.getAdminUser(reviewerUserId);
      if (reviewer?.email) {
        const project = await storage.getStudioProject(article.projectId);
        const { sendReviewAssignmentEmail } = await import("./email");
        sendReviewAssignmentEmail({
          to: reviewer.email,
          reviewerName: `${reviewer.firstName ?? ""} ${reviewer.lastName ?? ""}`.trim() || reviewer.email,
          articleTitle: article.title,
          excerpt: article.excerpt,
          contentType: article.contentType,
          category: article.category,
          projectName: project?.name ?? null,
          dueDate: dueLabel,
          reviewUrl: `${baseUrl}/admin/studio/articles/${article.id}/review`,
        }).catch((e) => console.error("Review assignment email error:", e));
      }
    } catch (emailErr) {
      console.error("Review assignment email lookup error:", emailErr);
    }

    return assignment;
  }

  // Auto-route an article that just entered review. Returns the chosen reviewer
  // id, or null when no pool is configured for its category.
  async function autoRouteArticle(
    article: StudioArticle,
    actorId: string | undefined,
    baseUrl: string,
  ): Promise<string | null> {
    const project = await storage.getStudioProject(article.projectId);
    const pool = resolveReviewerPool(project?.routingRules, article.category);
    const reviewerUserId = await pickReviewerFromPool(pool);
    if (!reviewerUserId) {
      await storage.createStudioAuditEvent({
        articleId: article.id,
        actorUserId: actorId ?? null,
        eventType: "review_unassigned",
        metadata: { reason: "no_reviewer_pool", category: article.category ?? null },
      } as any);
      return null;
    }
    await assignReviewerToArticle(article, reviewerUserId, actorId, baseUrl);
    await storage.createStudioAuditEvent({
      articleId: article.id,
      actorUserId: actorId ?? null,
      eventType: "review_assigned",
      metadata: { reviewerUserId, category: article.category ?? null, auto: true },
    } as any);
    return reviewerUserId;
  }

  // List studio projects (project switcher + Projects tab).
  app.get(
    "/api/admin/studio/projects",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (_req: Request, res: Response) => {
      try {
        const projects = await storage.getStudioProjects();
        res.json(projects);
      } catch (error) {
        console.error("Get studio projects error:", error);
        res.status(500).json({ error: "Failed to fetch studio projects" });
      }
    },
  );

  // Create a new studio project (admin/hr/super_admin only).
  app.post(
    "/api/admin/studio/projects",
    requireAuth,
    requirePermission("studio.manage_settings"),
    async (req: Request, res: Response) => {
      try {
        const { name, slug, description, brandColor, publishesToInsights } = req.body ?? {};
        if (!name?.trim()) return res.status(400).json({ error: "Project name is required" });
        if (!slug?.trim()) return res.status(400).json({ error: "Project slug is required" });
        const created = await storage.createStudioProject({
          name: name.trim(),
          slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          description: description?.trim() || null,
          brandColor: brandColor || null,
          publishesToInsights: !!publishesToInsights,
          isActive: true,
          isPrimary: false,
          createdBy: req.session.userId,
        } as any);
        res.status(201).json(created);
      } catch (error: any) {
        console.error("Create studio project error:", error);
        res.status(400).json({ error: error?.message || "Failed to create project" });
      }
    },
  );

  // Dashboard stats (counts by status for the selected project, or all).
  app.get(
    "/api/admin/studio/stats",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const projectId = typeof req.query.projectId === "string" && req.query.projectId
          ? req.query.projectId
          : undefined;
        const stats = await storage.getStudioDashboardStats(projectId);
        res.json(stats);
      } catch (error) {
        console.error("Get studio stats error:", error);
        res.status(500).json({ error: "Failed to fetch studio stats" });
      }
    },
  );

  // Analytics dashboard (read layer): workflow + audience metrics aggregated
  // from studio_audit_events, article reactions, and the article pipeline.
  app.get(
    "/api/admin/studio/analytics",
    requireAuth,
    requirePermission("studio.view_analytics", "marketing_manager"),
    async (req: Request, res: Response) => {
      try {
        const projectId =
          typeof req.query.projectId === "string" && req.query.projectId
            ? req.query.projectId
            : undefined;
        const parseDate = (v: unknown): Date | undefined => {
          if (typeof v !== "string" || !v) return undefined;
          const d = new Date(v);
          return isNaN(d.getTime()) ? undefined : d;
        };
        const dateFrom = parseDate(req.query.date_from);
        const dateTo = parseDate(req.query.date_to);
        const analytics = await storage.getStudioAnalytics({ projectId, dateFrom, dateTo });
        res.json(analytics);
      } catch (error) {
        console.error("Get studio analytics error:", error);
        res.status(500).json({ error: "Failed to fetch studio analytics" });
      }
    },
  );

  // ---- Newsletter notifications feature flag (studio.manage_settings) ----
  app.get(
    "/api/admin/studio/newsletter-flag",
    requireAuth,
    requirePermission("studio.manage_settings"),
    async (_req: Request, res: Response) => {
      try {
        const setting = await storage.getSystemSetting(NEWSLETTER_FLAG_KEY);
        const v = setting?.value as any;
        const enabled = typeof v === "boolean" ? v : !!(v && typeof v === "object" && v.enabled);
        res.json({ enabled });
      } catch (error) {
        console.error("Get newsletter flag error:", error);
        res.status(500).json({ error: "Failed to fetch flag" });
      }
    },
  );

  app.patch(
    "/api/admin/studio/newsletter-flag",
    requireAuth,
    requirePermission("studio.manage_settings"),
    async (req: Request, res: Response) => {
      try {
        const enabled = !!req.body?.enabled;
        await storage.upsertSystemSetting(NEWSLETTER_FLAG_KEY, enabled, req.session.userId);
        res.json({ enabled });
      } catch (error) {
        console.error("Update newsletter flag error:", error);
        res.status(500).json({ error: "Failed to update flag" });
      }
    },
  );

  // ---- Newsletter subscribers (studio.manage_settings) ----
  app.get(
    "/api/admin/studio/subscribers",
    requireAuth,
    requirePermission("studio.manage_settings"),
    async (_req: Request, res: Response) => {
      try {
        const [subscribers, counts] = await Promise.all([
          storage.getAllNewsletterSubscribers(),
          storage.getNewsletterSubscriberCounts(),
        ]);
        const items = subscribers.map((s) => ({
          id: s.id,
          email: s.email,
          status: s.suppressedAt ? "suppressed" : s.unsubscribedAt ? "unsubscribed" : "active",
          subscribedAt: s.createdAt,
          unsubscribedAt: s.unsubscribedAt,
          suppressedAt: s.suppressedAt,
          lastBounceAt: s.lastBounceAt,
          bounceCount: s.bounceCount,
        }));
        res.json({ items, counts });
      } catch (error) {
        console.error("Get subscribers error:", error);
        res.status(500).json({ error: "Failed to fetch subscribers" });
      }
    },
  );

  app.get(
    "/api/admin/studio/subscribers/export",
    requireAuth,
    requirePermission("studio.manage_settings"),
    async (_req: Request, res: Response) => {
      try {
        const subscribers = await storage.getAllNewsletterSubscribers();
        const esc = (v: any) => {
          const s = v == null ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const header = ["Email", "Status", "Subscribed At", "Unsubscribed At", "Suppressed At", "Last Bounce At", "Bounce Count"];
        const rows = subscribers.map((s) => [
          s.email,
          s.suppressedAt ? "Suppressed" : s.unsubscribedAt ? "Unsubscribed" : "Active",
          s.createdAt ? new Date(s.createdAt).toISOString() : "",
          s.unsubscribedAt ? new Date(s.unsubscribedAt).toISOString() : "",
          s.suppressedAt ? new Date(s.suppressedAt).toISOString() : "",
          s.lastBounceAt ? new Date(s.lastBounceAt).toISOString() : "",
          s.bounceCount,
        ]);
        const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(csv);
      } catch (error) {
        console.error("Export subscribers error:", error);
        res.status(500).json({ error: "Failed to export subscribers" });
      }
    },
  );

  // ---- Articles ----

  // List articles with filters + pagination.
  app.get(
    "/api/admin/studio/articles",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const q = req.query;
        const result = await storage.getStudioArticles({
          projectId: typeof q.projectId === "string" && q.projectId ? q.projectId : undefined,
          status: typeof q.status === "string" && q.status ? q.status : undefined,
          contentType: typeof q.contentType === "string" && q.contentType ? q.contentType : undefined,
          search: typeof q.search === "string" && q.search ? q.search : undefined,
          page: q.page ? parseInt(q.page as string, 10) : undefined,
          pageSize: q.pageSize ? parseInt(q.pageSize as string, 10) : undefined,
        });
        res.json(result);
      } catch (error) {
        console.error("Get studio articles error:", error);
        res.status(500).json({ error: "Failed to fetch articles" });
      }
    },
  );

  // Get a single article.
  app.get(
    "/api/admin/studio/articles/:id",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        res.json(article);
      } catch (error) {
        console.error("Get studio article error:", error);
        res.status(500).json({ error: "Failed to fetch article" });
      }
    },
  );

  // Create a new draft article.
  app.post(
    "/api/admin/studio/articles",
    requireAuth,
    requirePermission("studio.create_article", "marketing_manager", "content_editor"),
    async (req: Request, res: Response) => {
      try {
        const coerced = coerceDateFields(req.body ?? {}, [
          "scheduledAt", "approvedAt", "publishedAt", "notifiedAt", "riskFlagsResolvedAt",
        ]);
        const parsed = insertStudioArticleSchema.partial().parse(coerced);
        if (!parsed.projectId) return res.status(400).json({ error: "projectId is required" });
        if (!parsed.title || !parsed.title.trim()) {
          return res.status(400).json({ error: "title is required" });
        }
        const contentType = parsed.contentType || "quick_take";
        const readTimeMinutes = computeReadTime(parsed.bodyMarkdown, contentType);
        const created = await storage.createStudioArticle({
          ...parsed,
          projectId: parsed.projectId,
          title: parsed.title.trim(),
          contentType,
          status: "draft",
          readTimeMinutes,
          createdBy: req.session.userId,
        } as any);
        await storage.createStudioAuditEvent({
          articleId: created.id,
          actorUserId: req.session.userId,
          eventType: "article_created",
          metadata: { title: created.title, contentType },
        });
        res.status(201).json(created);
      } catch (error: any) {
        console.error("Create studio article error:", error);
        res.status(400).json({ error: error?.message || "Failed to create article" });
      }
    },
  );

  // Update an article (metadata + body). Recomputes read time.
  app.patch(
    "/api/admin/studio/articles/:id",
    requireAuth,
    requirePermission("studio.edit_article", "marketing_manager", "content_editor"),
    async (req: Request, res: Response) => {
      try {
        const existing = await storage.getStudioArticle(req.params.id);
        if (!existing) return res.status(404).json({ error: "Article not found" });

        const coerced = coerceDateFields(req.body ?? {}, [
          "scheduledAt", "approvedAt", "publishedAt", "notifiedAt", "riskFlagsResolvedAt",
        ]);
        const updates = insertStudioArticleSchema.partial().parse(coerced);
        // Status changes must go through the transition endpoint.
        delete (updates as any).status;
        delete (updates as any).createdBy;

        const contentType = updates.contentType ?? existing.contentType;
        const bodyMarkdown =
          updates.bodyMarkdown !== undefined ? updates.bodyMarkdown : existing.bodyMarkdown;
        const readTimeMinutes = computeReadTime(bodyMarkdown, contentType);

        const updated = await storage.updateStudioArticle(req.params.id, {
          ...updates,
          readTimeMinutes,
        });
        const isAutosave = req.body?.autosave === true;
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: req.session.userId,
          eventType: isAutosave ? "article_autosaved" : "article_updated",
          metadata: { readTimeMinutes },
        });
        res.json(updated);
      } catch (error: any) {
        console.error("Update studio article error:", error);
        res.status(400).json({ error: error?.message || "Failed to update article" });
      }
    },
  );

  // Delete an article (drafts only).
  app.delete(
    "/api/admin/studio/articles/:id",
    requireAuth,
    requirePermission("studio.edit_article", "marketing_manager", "content_editor"),
    async (req: Request, res: Response) => {
      try {
        const existing = await storage.getStudioArticle(req.params.id);
        if (!existing) return res.status(404).json({ error: "Article not found" });
        if (existing.status !== "draft") {
          return res.status(400).json({ error: "Only draft articles can be deleted" });
        }
        await storage.deleteStudioArticle(req.params.id);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Delete studio article error:", error);
        res.status(500).json({ error: "Failed to delete article" });
      }
    },
  );

  // ---- AI generation (draft + Social Kit) ----
  // Rate limit: 10 generations per user per rolling hour.
  const AI_GENERATION_RATE_LIMIT = 10;

  async function checkAiRateLimit(userId: string, res: Response): Promise<boolean> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const count = await storage.countStudioGenerationsByUserSince(userId, since);
    if (count >= AI_GENERATION_RATE_LIMIT) {
      res.status(429).json({
        error: `Rate limit reached (${AI_GENERATION_RATE_LIMIT} generations/hour). Try again later.`,
        code: "rate_limit",
      });
      return false;
    }
    return true;
  }

  function buildArticleParams(article: any, body: any): AiGenerationParams {
    const compliance = getComplianceMode(body?.complianceMode ?? article.complianceMode);
    return {
      industry: body?.industry,
      content_type: body?.contentType ?? article.contentType,
      topic: body?.topic,
      raw_input: body?.rawInput,
      key_points: Array.isArray(body?.keyPoints) ? body.keyPoints.join("\n") : body?.keyPoints,
      source_notes: body?.sourceNotes,
      target_audience: body?.targetAudience,
      author_name: body?.authorName,
      author_title: body?.authorTitle,
      tone: body?.tone,
      desired_length: body?.desiredLength,
      cta_text: body?.ctaText,
      cta_url: body?.ctaUrl,
      compliance_mode: compliance.value,
    };
  }

  function handleAiError(error: any, res: Response) {
    if (error instanceof AiGenerationError) {
      const status =
        error.code === "rate_limit" ? 429 : error.code === "validation" || error.code === "malformed" ? 422 : 502;
      return res.status(status).json({ error: error.message, code: error.code, retryable: error.retryable });
    }
    console.error("AI generation error:", error);
    return res.status(500).json({
      error: "AI generation failed — please try again. If the problem persists, contact support.",
      code: "upstream",
    });
  }

  /**
   * Coerce named date fields from ISO strings to Date objects before Zod parsing.
   * drizzle-zod maps timestamp() columns to z.date(), so raw ISO strings from
   * the client would otherwise fail validation.
   */
  function coerceDateFields(body: Record<string, unknown>, fields: string[]): Record<string, unknown> {
    const result = { ...body };
    for (const field of fields) {
      if (typeof result[field] === "string" && result[field]) {
        const d = new Date(result[field] as string);
        result[field] = isNaN(d.getTime()) ? null : d;
      }
    }
    return result;
  }

  // Generate a full article draft. Modes: "topic" (default) | "shape".
  app.post(
    "/api/admin/studio/articles/:id/generate-article",
    requireAuth,
    requirePermission("studio.generate_ai_draft", "marketing_manager", "content_editor"),
    async (req: Request, res: Response) => {
      try {
        if (!isAiConfigured()) {
          return res.status(503).json({ error: "AI provider is not configured", code: "upstream" });
        }
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });

        const mode = req.body?.mode === "shape" ? "shape" : "topic";
        const contentTypeKey = mode === "shape" ? "shape_my_draft" : "article_generator";

        if (mode === "topic" && !req.body?.topic?.trim()) {
          return res.status(400).json({ error: "topic is required for topic mode" });
        }
        if (mode === "shape" && !req.body?.rawInput?.trim()) {
          return res.status(400).json({ error: "rawInput is required for shape mode" });
        }

        if (!(await checkAiRateLimit(req.session.userId!, res))) return;

        const template = await storage.getActiveStudioPromptTemplate(contentTypeKey, article.projectId);
        if (!template) {
          return res.status(500).json({ error: `Prompt template '${contentTypeKey}' not found` });
        }

        const params = buildArticleParams(article, req.body);
        const compliance = getComplianceMode(params.compliance_mode);

        // Record the generation up-front (status reflects outcome).
        const generation = await storage.createStudioGeneration({
          projectId: article.projectId,
          articleId: article.id,
          promptTemplateId: template.id,
          promptVersion: template.version,
          kind: "article_draft",
          contentType: contentTypeKey,
          modelName: template.modelName,
          inputJson: { mode, ...params },
          generatedByUserId: req.session.userId,
          status: "draft",
        } as any);

        let result;
        try {
          result = await generateArticleDraft(template, params);
        } catch (err) {
          await storage.updateStudioGeneration(generation.id, {
            status: "rejected",
            approvalNotes: err instanceof Error ? err.message : "generation failed",
          } as any);
          return handleAiError(err, res);
        }

        // Gated quality reviewer pass.
        let qualityReview = null;
        if (compliance.requiresQualityReview) {
          try {
            const reviewer = await storage.getActiveStudioPromptTemplate("quality_reviewer", article.projectId);
            if (reviewer) {
              qualityReview = await runQualityReview(reviewer, params, result.draft.body_markdown);
            }
          } catch (err) {
            console.error("Quality review error (non-fatal):", err);
          }
        }

        const riskFlags = qualityReview?.risk_flags ?? [];

        await storage.updateStudioGeneration(generation.id, {
          outputJson: result.rawOutput,
          qualityReviewJson: qualityReview,
          tokenEstimate: result.tokenEstimate,
          modelName: result.model,
          status: "reviewed",
        } as any);

        // Track compliance mode + risk flags on the article so the publish gate
        // can act on them. New flags reset any prior resolution.
        await storage.updateStudioArticle(article.id, {
          complianceMode: compliance.value,
          riskFlags: riskFlags as any,
          riskFlagsResolvedAt: null as any,
          riskFlagsResolvedBy: null as any,
        } as any);

        await storage.createStudioAuditEvent({
          articleId: article.id,
          actorUserId: req.session.userId,
          eventType: "ai_article_generated",
          metadata: {
            mode,
            generationId: generation.id,
            promptVersion: template.version,
            complianceMode: compliance.value,
            riskFlagCount: riskFlags.length,
          },
        });

        res.json({
          draft: result.draft,
          qualityReview,
          riskFlags,
          complianceMode: compliance.value,
          generationId: generation.id,
          model: result.model,
        });
      } catch (error: any) {
        handleAiError(error, res);
      }
    },
  );

  // Generate a Social Kit from the article. Persists socialKitJsonb on success.
  app.post(
    "/api/admin/studio/articles/:id/generate-social-kit",
    requireAuth,
    requirePermission("studio.generate_ai_draft", "marketing_manager", "content_editor"),
    async (req: Request, res: Response) => {
      try {
        if (!isAiConfigured()) {
          return res.status(503).json({ error: "AI provider is not configured", code: "upstream" });
        }
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (!article.bodyMarkdown?.trim()) {
          return res.status(400).json({ error: "Article has no body to derive a Social Kit from" });
        }

        if (!(await checkAiRateLimit(req.session.userId!, res))) return;

        const contentTypeKey =
          typeof req.body?.contentType === "string" && req.body.contentType
            ? req.body.contentType
            : "master_social_kit";
        // Two-level fallback: project/seed template for contentType → master_social_kit
        let template = await storage.getActiveStudioPromptTemplate(contentTypeKey, article.projectId);
        if (!template && contentTypeKey !== "master_social_kit") {
          template = await storage.getActiveStudioPromptTemplate("master_social_kit", article.projectId);
        }
        if (!template) {
          return res.status(500).json({ error: `Prompt template '${contentTypeKey}' not found` });
        }

        const compliance = getComplianceMode(req.body?.complianceMode ?? article.complianceMode);
        const params: AiGenerationParams = {
          industry: req.body?.industry,
          platform: req.body?.platform,
          // Pass the resolved content type so generateSocialKit can infer the
          // correct card layout (checklist_card → checklist, quote_card → quote, etc.)
          content_type: contentTypeKey !== "master_social_kit" ? contentTypeKey : article.contentType ?? undefined,
          article_title: article.title,
          article_summary: article.excerpt ?? "",
          article_body: article.bodyMarkdown,
          cta_text: req.body?.ctaText,
          cta_url: req.body?.ctaUrl,
          visual_template: req.body?.visualTemplate,
          compliance_mode: compliance.value,
        };

        const generation = await storage.createStudioGeneration({
          projectId: article.projectId,
          articleId: article.id,
          promptTemplateId: template.id,
          promptVersion: template.version,
          kind: "social_kit",
          contentType: contentTypeKey,
          modelName: template.modelName,
          inputJson: { ...params, article_body: undefined },
          generatedByUserId: req.session.userId,
          status: "draft",
        } as any);

        let result;
        try {
          result = await generateSocialKit(template, params);
        } catch (err) {
          await storage.updateStudioGeneration(generation.id, {
            status: "rejected",
            approvalNotes: err instanceof Error ? err.message : "generation failed",
          } as any);
          return handleAiError(err, res);
        }

        await storage.updateStudioGeneration(generation.id, {
          outputJson: result.rawOutput,
          tokenEstimate: result.tokenEstimate,
          modelName: result.model,
          status: "reviewed",
        } as any);

        // Persist the canonical kit on the article (never auto-publishes).
        await storage.updateStudioArticle(article.id, {
          socialKitJsonb: result.kit as any,
        } as any);

        await storage.createStudioAuditEvent({
          articleId: article.id,
          actorUserId: req.session.userId,
          eventType: "ai_social_kit_generated",
          metadata: {
            generationId: generation.id,
            promptVersion: template.version,
            contentType: contentTypeKey,
            warningCount: result.warnings.length,
          },
        });

        res.json({
          socialKit: result.kit,
          warnings: result.warnings,
          generationId: generation.id,
          model: result.model,
        });
      } catch (error: any) {
        handleAiError(error, res);
      }
    },
  );

  // List generation history for an article.
  app.get(
    "/api/admin/studio/articles/:id/generations",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const generations = await storage.getStudioGenerations(req.params.id);
        res.json(generations);
      } catch (error) {
        console.error("Get studio generations error:", error);
        res.status(500).json({ error: "Failed to fetch generations" });
      }
    },
  );

  // Resolve (clear) risk flags on an article so it can pass the publish gate.
  app.post(
    "/api/admin/studio/articles/:id/resolve-risk-flags",
    requireAuth,
    requirePermission("studio.review_article", "marketing_manager", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        const updated = await storage.updateStudioArticle(req.params.id, {
          riskFlagsResolvedAt: new Date(),
          riskFlagsResolvedBy: req.session.userId,
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: req.session.userId,
          eventType: "risk_flags_resolved",
          metadata: { notes: req.body?.notes ?? null },
        });
        res.json(updated);
      } catch (error: any) {
        console.error("Resolve risk flags error:", error);
        res.status(400).json({ error: error?.message || "Failed to resolve risk flags" });
      }
    },
  );

  // ---- Status transitions (role-gated) ----
  // Each target status maps to the permission required to move there.
  const STUDIO_TRANSITIONS: Record<
    string,
    { to: string; permission: string; roles: string[] }[]
  > = {
    // Generic editor transitions only. States that require dedicated endpoint
    // logic (CM decision, author sign-off, marketing/final approval, publish)
    // are listed here with empty arrays so the generic endpoint rejects them
    // cleanly — their transitions are enforced by dedicated routes below.
    draft: [
      { to: "in_review", permission: "studio.edit_article", roles: ["marketing_manager", "content_editor"] },
    ],
    in_review: [
      // Reviewer submits to CM queue — the new workflow step replacing direct approval.
      { to: "pending_cm_review", permission: "studio.review_article", roles: ["marketing_manager", "reviewer"] },
      // Reviewer sends back for edits.
      { to: "draft", permission: "studio.review_article", roles: ["marketing_manager", "reviewer"] },
    ],
    // All states below are advanced exclusively through dedicated endpoints:
    pending_cm_review: [],    // → pending_author or draft via /cm-decision
    pending_author: [],       // → author_approved via /author-decision
    author_approved: [],      // → pending_marketing via dedicated marketing flow
    pending_marketing: [],    // → pending_final_approval via dedicated endpoint
    pending_final_approval: [],
    approved: [],
    scheduled: [],
    published: [],
    archived: [],
    ready_to_export: [],
  };

  app.post(
    "/api/admin/studio/articles/:id/transition",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const { to, scheduledAt } = req.body ?? {};
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });

        const allowed = STUDIO_TRANSITIONS[article.status] || [];
        const transition = allowed.find((t) => t.to === to);
        if (!transition) {
          return res
            .status(400)
            .json({ error: `Cannot move from ${article.status} to ${to}` });
        }

        // Role check for this specific transition.
        const role = req.session.role!;
        const permittedRoles = resolveRoles(
          transition.permission,
          Array.from(new Set(["super_admin", "admin", ...transition.roles])),
        );
        if (!permittedRoles.includes(role)) {
          return res.status(403).json({ error: "Insufficient permissions for this transition" });
        }

        // Risk-flag publish gate: when the article's compliance mode blocks
        // publish on unresolved risk flags, prevent publish/schedule until a
        // reviewer has explicitly resolved them.
        if (to === "published" || to === "scheduled") {
          const compliance = getComplianceMode((article as any).complianceMode);
          const flags = (article as any).riskFlags;
          const hasUnresolvedFlags =
            Array.isArray(flags) && flags.length > 0 && !(article as any).riskFlagsResolvedAt;
          if (compliance.blocksPublishOnRiskFlags && hasUnresolvedFlags) {
            return res.status(409).json({
              error:
                "This article has unresolved AI risk flags and its compliance mode blocks publishing. Resolve the flags first.",
              code: "risk_flags_block_publish",
              riskFlags: flags,
            });
          }
        }

        const updates: any = { status: to };
        if (to === "approved") {
          updates.approvedBy = req.session.userId;
          updates.approvedAt = new Date();
        }
        if (to === "scheduled") {
          updates.scheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();
        }
        if (to === "published") {
          updates.publishedAt = new Date();
        }

        const updated = await storage.updateStudioArticle(req.params.id, updates);
        if (to === "published") {
          void notifyNewContentSubscribers(req.params.id);
        }
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: req.session.userId,
          eventType: "status_changed",
          metadata: { from: article.status, to },
        });

        // Social card engine (Task #432): when an article is approved, render its
        // branded social cards in the background (non-blocking) and notify.
        if (to === "approved") {
          (async () => {
            try {
              const result = await generateArticleCards(req.params.id);
              await storage.createStudioAuditEvent({
                articleId: req.params.id,
                actorUserId: req.session.userId,
                eventType: "social_cards_generated",
                metadata: {
                  layout: result.layout,
                  family: result.family,
                  cardCount: result.cards.length,
                  skipped: result.skipped,
                },
              });
            } catch (cardErr) {
              console.error("Studio social card generation error:", cardErr);
            }
          })();
        }

        // Smart routing: auto-assign a reviewer when an article enters review.
        let autoAssignedReviewerId: string | null = null;
        if (to === "in_review") {
          try {
            const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
            const baseUrl = `${proto}://${req.get("host")}`;
            autoAssignedReviewerId = await autoRouteArticle(
              (updated ?? article) as StudioArticle,
              req.session.userId,
              baseUrl,
            );
          } catch (routeErr) {
            console.error("Studio auto-route error:", routeErr);
          }
        }

        res.json({ ...updated, autoAssignedReviewerId });
      } catch (error: any) {
        console.error("Studio transition error:", error);
        res.status(400).json({ error: error?.message || "Failed to transition article" });
      }
    },
  );

  // ---- Reviewer Inbox & Smart Routing ----

  // List candidate reviewers (all active admin users). The DB user_role enum has
  // no dedicated reviewer role, so any active admin user can be in a pool.
  app.get(
    "/api/admin/studio/reviewers",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (_req, res) => {
      try {
        const users = await storage.getAdminUsers();
        res.json(
          users
            .filter((u) => u.isActive !== false)
            .map((u) => ({
              id: u.id,
              email: u.email,
              firstName: u.firstName ?? null,
              lastName: u.lastName ?? null,
              role: u.role,
            })),
        );
      } catch (error: any) {
        console.error("Studio reviewers list error:", error);
        res.status(500).json({ error: "Failed to fetch reviewers" });
      }
    },
  );

  // Reviewer's own inbox: pending review assignments + pending_author sign-off tasks.
  app.get(
    "/api/admin/studio/inbox",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.session.userId!;
        // Standard reviewer assignments (in_review queue).
        const inbox = await storage.getStudioInboxForReviewer(userId);

        // Author sign-off tasks: articles in pending_author status where the
        // current user is the linked author on the assigned author profile.
        const authorSignOffItems: any[] = [];
        try {
          const allProfiles = await storage.getStudioAuthorProfiles(undefined);
          const linkedProfile = allProfiles.find(
            (p) => (p as any).linkedUserId === userId || (p as any).linked_user_id === userId,
          );
          if (linkedProfile) {
            const queue = await storage.getStudioApprovalQueue(["pending_author"], undefined);
            for (const article of queue) {
              if ((article as any).authorProfileId === linkedProfile.id) {
                authorSignOffItems.push({
                  // Synthesise an inbox-compatible shape for the UI.
                  id: `author-signoff-${article.id}`,
                  articleId: article.id,
                  reviewerUserId: userId,
                  status: "pending",
                  type: "author_signoff",
                  dueAt: null,
                  createdAt: article.updatedAt ?? article.createdAt,
                  updatedAt: article.updatedAt ?? article.createdAt,
                  decisionAt: null,
                  article,
                  projectName: (article as any).projectName ?? null,
                });
              }
            }
          }
        } catch (e) {
          // Non-fatal: author sign-off lookup failure shouldn't block reviewer inbox.
        }

        res.json([...inbox, ...authorSignOffItems]);
      } catch (error: any) {
        console.error("Studio inbox error:", error);
        res.status(500).json({ error: "Failed to fetch inbox" });
      }
    },
  );

  // Author sign-off view: allows the linked author (or admin proxy) to read
  // the article so they can approve or request changes via /author-decision.
  app.get(
    "/api/admin/studio/articles/:id/author-signoff",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });

        const role = req.session.role!;
        const userId = req.session.userId!;
        const isAdminProxy = ["super_admin", "admin", "hr"].includes(role);

        if (!isAdminProxy) {
          // Only expose when the article is actually awaiting author sign-off.
          if (article.status !== "pending_author") {
            return res.status(403).json({ error: "Article is not currently awaiting author sign-off" });
          }
          // Verify the requester is the linked author for this article.
          const apid = (article as any).authorProfileId;
          if (!apid) return res.status(403).json({ error: "No author profile assigned" });
          const authorProfile = await storage.getStudioAuthorProfile(apid);
          const linkedUserId =
            (authorProfile as any)?.linkedUserId ??
            (authorProfile as any)?.linked_user_id ??
            (authorProfile as any)?.linkedEmployeeId;
          if (!linkedUserId || linkedUserId !== userId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        res.json(article);
      } catch (error: any) {
        console.error("Author sign-off view error:", error);
        res.status(500).json({ error: "Failed to fetch article" });
      }
    },
  );

  // Review detail: the article plus its assignment history. Accessible to the
  // assigned reviewer or super_admin/admin (managers can view to track).
  app.get(
    "/api/admin/studio/articles/:id/review",
    requireAuth,
    async (req, res) => {
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        const assignments = await storage.getStudioReviewAssignmentsForArticle(req.params.id);
        const active = await storage.getActiveStudioReviewAssignment(req.params.id);
        const role = req.session.role!;
        const userId = req.session.userId!;
        const isPrivileged = role === "super_admin" || role === "admin";
        const isAssignedReviewer = active?.reviewerUserId === userId;
        if (!isPrivileged && !isAssignedReviewer) {
          return res.status(403).json({ error: "You are not assigned to review this article" });
        }
        res.json({ article, assignments, activeAssignment: active ?? null });
      } catch (error: any) {
        console.error("Studio review detail error:", error);
        res.status(500).json({ error: "Failed to fetch review detail" });
      }
    },
  );

  // Reviewer decision: approve / request_changes / decline. Enforced to the
  // assigned reviewer (or super_admin) only — otherwise 403.
  app.post(
    "/api/admin/studio/articles/:id/review-decision",
    requireAuth,
    async (req, res) => {
      try {
        const { decision, comment } = req.body ?? {};
        const allowed = ["approve", "request_changes", "decline"];
        if (!allowed.includes(decision)) {
          return res.status(400).json({ error: "Invalid decision" });
        }
        if (decision !== "approve" && !comment?.trim()) {
          return res.status(400).json({ error: "A comment is required for this decision" });
        }

        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        const active = await storage.getActiveStudioReviewAssignment(req.params.id);
        if (!active) {
          return res.status(409).json({ error: "No active review assignment for this article" });
        }

        const role = req.session.role!;
        const userId = req.session.userId!;
        const isSuperAdmin = role === "super_admin";
        if (active.reviewerUserId !== userId && !isSuperAdmin) {
          return res.status(403).json({ error: "You are not the assigned reviewer" });
        }
        if (article.status !== "in_review") {
          return res.status(409).json({ error: "Article is not currently in review" });
        }

        const decisionMap: Record<string, { assignmentStatus: string; articleStatus: string; eventType: string }> = {
          approve: { assignmentStatus: "approved", articleStatus: "pending_cm_review", eventType: "review_approved" },
          request_changes: { assignmentStatus: "changes_requested", articleStatus: "draft", eventType: "review_changes_requested" },
          decline: { assignmentStatus: "declined", articleStatus: "draft", eventType: "review_declined" },
        };
        const mapped = decisionMap[decision];

        await storage.updateStudioReviewAssignment(active.id, {
          status: mapped.assignmentStatus,
          decisionAt: new Date(),
          comment: comment ?? null,
        } as any);

        const articleUpdates: any = { status: mapped.articleStatus };
        if (decision === "approve") {
          articleUpdates.approvedBy = userId;
          articleUpdates.approvedAt = new Date();
        }
        const updated = await storage.updateStudioArticle(req.params.id, articleUpdates);

        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: mapped.eventType,
          metadata: { assignmentId: active.id, comment: comment ?? null },
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: article.status, to: mapped.articleStatus, via: "review_decision" },
        } as any);

        // Notify the article author of the outcome.
        if (article.createdBy && article.createdBy !== userId) {
          try {
            const labels: Record<string, string> = {
              approve: "approved",
              request_changes: "sent back for changes",
              decline: "declined",
            };
            await storage.createNotification({
              userId: article.createdBy,
              type: "studio_review_decision",
              title: `Your article was ${labels[decision]}`,
              message: `"${article.title}" was ${labels[decision]}${comment?.trim() ? `: ${comment.trim()}` : "."}`,
              isRead: false,
              metadata: { articleId: article.id, decision },
            });
          } catch (notifyErr) {
            console.error("Studio decision notification error:", notifyErr);
          }
        }

        // On approval, the article enters the CM review queue. Notify content managers.
        if (decision === "approve") {
          try {
            const admins = await storage.getAdminUsers();
            const cms = admins.filter(
              (u) => u.isActive !== false && u.role === "content_manager",
            );
            await Promise.all(
              cms.map((m) =>
                storage.createNotification({
                  userId: m.id,
                  type: "studio_cm_review_queue",
                  title: "Article ready for CM review",
                  message: `"${article.title}" passed peer review and is ready for content manager review.`,
                  isRead: false,
                  metadata: { articleId: article.id, status: "pending_cm_review" },
                }),
              ),
            );
          } catch (notifyErr) {
            console.error("Studio CM queue notification error:", notifyErr);
          }
        }

        res.json({ ...updated, assignmentStatus: mapped.assignmentStatus });
      } catch (error: any) {
        console.error("Studio review-decision error:", error);
        res.status(400).json({ error: error?.message || "Failed to record decision" });
      }
    },
  );

  // ---- Marketing approval & Super Admin final sign-off ----

  // Helper: only the super_admin role may publish/schedule/sign off. We use an
  // inline role check (not requirePermission) because the access-parity tooling
  // auto-grants admin to every permission key, which would violate the hard
  // "Super Admin only" rule for publishing.
  const ensureSuperAdmin = (req: Request, res: Response): boolean => {
    if (req.session.role !== "super_admin") {
      res.status(403).json({ error: "Only a Super Admin can perform this action" });
      return false;
    }
    return true;
  };

  const baseUrlFrom = (req: Request) => {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    return `${proto}://${req.get("host")}`;
  };

  const userDisplayName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null } | undefined | null) => {
    if (!u) return null;
    const n = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
    return n || u.email || null;
  };

  // Translate a marketing "edits" payload into a safe partial article update.
  // Only the fields marketing is allowed to polish are honored; social caption
  // edits are merged into the existing canonical Social Kit by platform.
  const buildMarketingPolishUpdates = (article: StudioArticle, edits: any): Record<string, any> => {
    const updates: Record<string, any> = {};
    if (!edits || typeof edits !== "object") return updates;
    if (typeof edits.seoTitle === "string") updates.seoTitle = edits.seoTitle.trim() || null;
    if (typeof edits.seoDescription === "string") updates.seoDescription = edits.seoDescription.trim() || null;
    if (typeof edits.coverImageUrl === "string") updates.coverImageUrl = edits.coverImageUrl.trim() || null;
    if (typeof edits.authorProfileId === "string" && edits.authorProfileId) {
      updates.authorProfileId = edits.authorProfileId;
    }
    if (Array.isArray(edits.captions)) {
      const existing = (article as any).socialKitJsonb ?? null;
      const baseCaptions: any[] = Array.isArray(existing?.captions) ? existing.captions : [];
      const byPlatform = new Map<string, any>();
      for (const c of baseCaptions) {
        if (c && typeof c.platform === "string") byPlatform.set(c.platform, { ...c });
      }
      for (const edit of edits.captions) {
        if (!edit || typeof edit.platform !== "string" || typeof edit.text !== "string") continue;
        const prev = byPlatform.get(edit.platform) ?? { platform: edit.platform, variants: [] };
        byPlatform.set(edit.platform, { ...prev, text: edit.text });
      }
      updates.socialKitJsonb = { ...(existing ?? {}), captions: Array.from(byPlatform.values()) };
    }
    return updates;
  };

  // Resolve the byline author to an admin user id (if the author profile is
  // linked to a system user) so they can be notified alongside the editor.
  const resolveAuthorUserId = async (article: StudioArticle): Promise<string | null> => {
    const apid = (article as any).authorProfileId;
    if (!apid) return null;
    try {
      const profile = await storage.getStudioAuthorProfile(apid);
      if (!profile) return null;
      // Prefer the explicit HR-system link; fall back to the legacy userId field.
      return (profile as any).linkedUserId ?? (profile as any).linked_user_id ?? profile.userId ?? null;
    } catch {
      return null;
    }
  };

  // Find the marketing manager who recommended this article (last
  // marketing_recommended audit event), so reject/publish notices reach them.
  const findMarketingRecommender = async (articleId: string): Promise<string | null> => {
    const events = await storage.getStudioAuditEvents(articleId);
    const rec = [...events]
      .filter((e) => e.eventType === "marketing_recommended" && e.actorUserId)
      .pop();
    return rec?.actorUserId ?? null;
  };

  // Marketing queue: articles awaiting marketing polish/recommendation.
  app.get(
    "/api/admin/studio/approvals",
    requireAuth,
    requirePermission("studio.marketing_approve", "marketing_manager"),
    async (req, res) => {
      try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const items = await storage.getStudioApprovalQueue(["author_approved", "pending_marketing"], projectId);
        res.json(items);
      } catch (error: any) {
        console.error("Studio approvals queue error:", error);
        res.status(500).json({ error: "Failed to fetch approvals queue" });
      }
    },
  );

  // Final sign-off queue: articles recommended by marketing, awaiting Super
  // Admin sign-off. Super Admin only.
  app.get(
    "/api/admin/studio/final-approval",
    requireAuth,
    async (req, res) => {
      if (!ensureSuperAdmin(req, res)) return;
      try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const items = await storage.getStudioApprovalQueue(["pending_final_approval"], projectId);
        res.json(items);
      } catch (error: any) {
        console.error("Studio final-approval queue error:", error);
        res.status(500).json({ error: "Failed to fetch final-approval queue" });
      }
    },
  );

  // Publishing calendar: scheduled + published articles within a date range.
  app.get(
    "/api/admin/studio/calendar",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req, res) => {
      try {
        const now = new Date();
        const from = req.query.from ? new Date(String(req.query.from)) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const to = req.query.to ? new Date(String(req.query.to)) : new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
          return res.status(400).json({ error: "Invalid date range" });
        }
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const items = await storage.getStudioCalendarArticles(from, to, projectId);
        res.json(items);
      } catch (error: any) {
        console.error("Studio calendar error:", error);
        res.status(500).json({ error: "Failed to fetch calendar" });
      }
    },
  );

  // Workflow detail: article + author + project + assignments + audit trail.
  // Used by both the marketing and final-approval review screens.
  app.get(
    "/api/admin/studio/articles/:id/workflow",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req, res) => {
      try {
        const detail = await storage.getStudioWorkflowDetail(req.params.id);
        if (!detail) return res.status(404).json({ error: "Article not found" });
        res.json(detail);
      } catch (error: any) {
        console.error("Studio workflow detail error:", error);
        res.status(500).json({ error: "Failed to fetch workflow detail" });
      }
    },
  );

  // Marketing decision: recommend (→ pending_final_approval) or reject (→ draft).
  // Marketing may polish and recommend but can never publish.
  app.post(
    "/api/admin/studio/articles/:id/marketing-decision",
    requireAuth,
    requirePermission("studio.marketing_approve", "marketing_manager"),
    async (req, res) => {
      try {
        const { decision, reason, edits } = req.body ?? {};
        if (!["recommend", "reject", "save"].includes(decision)) {
          return res.status(400).json({ error: "Invalid decision" });
        }
        if (decision === "reject" && !reason?.trim()) {
          return res.status(400).json({ error: "A reason is required to reject" });
        }
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (!["author_approved", "pending_marketing"].includes(article.status)) {
          return res.status(409).json({ error: "Article is not awaiting marketing review" });
        }

        const userId = req.session.userId!;

        // Build the marketing polish patch (SEO, featured image, author byline,
        // edited social captions). Applied on save and recommend.
        const polish = buildMarketingPolishUpdates(article, edits);

        // "save" just persists the polish edits without advancing the workflow.
        if (decision === "save") {
          const saved = Object.keys(polish).length
            ? await storage.updateStudioArticle(req.params.id, polish as any)
            : article;
          if (Object.keys(polish).length) {
            await storage.createStudioAuditEvent({
              articleId: req.params.id,
              actorUserId: userId,
              eventType: "marketing_polished",
              metadata: { fields: Object.keys(polish) },
            } as any);
          }
          return res.json(saved);
        }

        const toStatus = decision === "recommend" ? "pending_final_approval" : "draft";
        // On recommend, persist any pending polish edits alongside the status change.
        const statusUpdate =
          decision === "recommend" ? { ...polish, status: toStatus } : { status: toStatus };
        const updated = await storage.updateStudioArticle(req.params.id, statusUpdate as any);

        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: decision === "recommend" ? "marketing_recommended" : "marketing_rejected",
          metadata: { reason: reason?.trim() || null },
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: article.status, to: toStatus, via: "marketing_decision" },
        } as any);

        const actor = await storage.getAdminUser(userId);
        const actorName = userDisplayName(actor);

        if (decision === "recommend") {
          // Notify all super admins that an article awaits final sign-off.
          try {
            const admins = await storage.getAdminUsers();
            const supers = admins.filter((u) => u.isActive !== false && u.role === "super_admin");
            await Promise.all(
              supers.map((s) =>
                storage.createNotification({
                  userId: s.id,
                  type: "studio_final_queue",
                  title: "Article awaiting final sign-off",
                  message: `"${article.title}" was recommended by marketing and needs your sign-off.`,
                  isRead: false,
                  metadata: { articleId: article.id, status: "pending_final_approval" },
                }),
              ),
            );
          } catch (notifyErr) {
            console.error("Studio final-queue notification error:", notifyErr);
          }
        } else {
          // Reject → notify the author/editor in-app + email.
          try {
            if (article.createdBy) {
              await storage.createNotification({
                userId: article.createdBy,
                type: "studio_marketing_rejected",
                title: "Article sent back for changes",
                message: `"${article.title}" was sent back during marketing review: ${reason.trim()}`,
                isRead: false,
                metadata: { articleId: article.id, stage: "marketing" },
              });
              const author = await storage.getAdminUser(article.createdBy);
              if (author?.email) {
                await sendStudioRejectionEmail({
                  to: author.email,
                  recipientName: userDisplayName(author) || "there",
                  articleTitle: article.title,
                  stage: "marketing",
                  reason: reason.trim(),
                  rejectedByName: actorName,
                  editUrl: `${baseUrlFrom(req)}/admin/studio/articles/${article.id}`,
                });
              }
            }
          } catch (notifyErr) {
            console.error("Studio marketing reject notification error:", notifyErr);
          }
        }

        res.json(updated);
      } catch (error: any) {
        console.error("Studio marketing-decision error:", error);
        res.status(400).json({ error: error?.message || "Failed to record marketing decision" });
      }
    },
  );

  // Shared publish/schedule routine used by the final-decision and direct
  // publish endpoints. Enforces the risk-flag publish gate.
  const performPublish = async (
    article: StudioArticle,
    userId: string,
    opts: { scheduledAt?: Date | null },
  ): Promise<{ updated: StudioArticle | undefined; scheduled: boolean }> => {
    const compliance = getComplianceMode((article as any).complianceMode);
    const flags = (article as any).riskFlags;
    const hasUnresolvedFlags =
      Array.isArray(flags) && flags.length > 0 && !(article as any).riskFlagsResolvedAt;
    if (compliance.blocksPublishOnRiskFlags && hasUnresolvedFlags) {
      const err: any = new Error(
        "This article has unresolved AI risk flags and its compliance mode blocks publishing. Resolve the flags first.",
      );
      err.code = "risk_flags_block_publish";
      err.riskFlags = flags;
      throw err;
    }
    const isFuture = !!opts.scheduledAt && opts.scheduledAt.getTime() > Date.now();
    const updates: any = isFuture
      ? { status: "scheduled", scheduledAt: opts.scheduledAt }
      : { status: "published", publishedAt: new Date(), scheduledAt: opts.scheduledAt ?? null };
    const updated = await storage.updateStudioArticle(article.id, updates);
    // Fire-and-forget per-publish subscriber notification (gated internally by
    // the newsletter flag + publishesToInsights + notifiedAt guard). Uses the
    // public production base URL so links work for real subscribers.
    if (!isFuture) {
      void notifyNewContentSubscribers(article.id);
    }
    return { updated, scheduled: isFuture };
  };

  // Notify author, editor, marketing recommender, and all content_manager/
  // marketing_manager users that an article went live (or was scheduled).
  // In-app notification + transactional email.
  const notifyPublished = async (
    req: Request,
    article: StudioArticle,
    scheduled: boolean,
    scheduledAt: Date | null,
    publishedAt: Date | null,
  ) => {
    try {
      const signer = await storage.getAdminUser(req.session.userId!);
      const signerName = userDisplayName(signer);
      const recommenderId = await findMarketingRecommender(article.id);
      const authorUserId = await resolveAuthorUserId(article);

      // Core direct recipients: article creator, linked author, marketing recommender.
      const directIds = new Set<string>(
        [article.createdBy, authorUserId, recommenderId].filter((x): x is string => !!x),
      );

      // Broadcast recipients: all active content_manager + marketing_manager users
      // get a social-sharing notification so they can promote the article.
      const allAdmins = await storage.getAdminUsers();
      const broadcastRoles = new Set(["content_manager", "marketing_manager"]);
      const broadcastIds = allAdmins
        .filter((u) => u.isActive !== false && broadcastRoles.has(u.role))
        .map((u) => u.id);

      const allRecipientIds = Array.from(new Set([...directIds, ...broadcastIds]));

      const title = scheduled ? "Article scheduled" : "Article published";
      const msg = scheduled
        ? `"${article.title}" was signed off and scheduled${scheduledAt ? ` for ${scheduledAt.toLocaleString()}` : ""}. Time to prep social posts!`
        : `"${article.title}" is now live. Share it on social media to maximise reach!`;
      await Promise.all(
        allRecipientIds.map(async (rid) => {
          await storage.createNotification({
            userId: rid,
            type: "studio_published",
            title,
            message: msg,
            isRead: false,
            metadata: { articleId: article.id, scheduled },
          });
          // Email all recipients: direct (creator/author/recommender) and broadcast
          // (content_manager/marketing_manager) — publish is a high-value social moment.
          if (directIds.has(rid) || broadcastIds.includes(rid)) {
            const u = await storage.getAdminUser(rid);
            if (u?.email) {
              await sendStudioPublishedEmail({
                to: u.email,
                recipientName: userDisplayName(u) || "there",
                articleTitle: article.title,
                scheduledFor: scheduled && scheduledAt ? scheduledAt.toLocaleString() : null,
                publishedAt: !scheduled && publishedAt ? publishedAt.toLocaleString() : null,
                publishedByName: signerName,
              });
            }
          }
        }),
      );
    } catch (notifyErr) {
      console.error("Studio publish notification error:", notifyErr);
    }
  };

  // Final decision: schedule / publish / reject. Super Admin only.
  app.post(
    "/api/admin/studio/articles/:id/final-decision",
    requireAuth,
    async (req, res) => {
      if (!ensureSuperAdmin(req, res)) return;
      try {
        const { decision, scheduledAt, reason } = req.body ?? {};
        if (!["publish", "schedule", "reject"].includes(decision)) {
          return res.status(400).json({ error: "Invalid decision" });
        }
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (article.status !== "pending_final_approval") {
          return res.status(409).json({ error: "Article is not awaiting final sign-off" });
        }
        const userId = req.session.userId!;

        if (decision === "reject") {
          if (!reason?.trim()) {
            return res.status(400).json({ error: "A reason is required to reject" });
          }
          const updated = await storage.updateStudioArticle(req.params.id, { status: "draft" } as any);
          await storage.createStudioAuditEvent({
            articleId: req.params.id,
            actorUserId: userId,
            eventType: "final_rejected",
            metadata: { reason: reason.trim() },
          } as any);
          await storage.createStudioAuditEvent({
            articleId: req.params.id,
            actorUserId: userId,
            eventType: "status_changed",
            metadata: { from: article.status, to: "draft", via: "final_decision" },
          } as any);

          // Notify editor + the marketing recommender.
          try {
            const signer = await storage.getAdminUser(userId);
            const signerName = userDisplayName(signer);
            const recommenderId = await findMarketingRecommender(article.id);
            const recipientIds = Array.from(
              new Set([article.createdBy, recommenderId].filter((x): x is string => !!x)),
            );
            await Promise.all(
              recipientIds.map(async (rid) => {
                await storage.createNotification({
                  userId: rid,
                  type: "studio_final_rejected",
                  title: "Article sent back for changes",
                  message: `"${article.title}" was sent back during final sign-off: ${reason.trim()}`,
                  isRead: false,
                  metadata: { articleId: article.id, stage: "final" },
                });
                const u = await storage.getAdminUser(rid);
                if (u?.email) {
                  await sendStudioRejectionEmail({
                    to: u.email,
                    recipientName: userDisplayName(u) || "there",
                    articleTitle: article.title,
                    stage: "final",
                    reason: reason.trim(),
                    rejectedByName: signerName,
                    editUrl: `${baseUrlFrom(req)}/admin/studio/articles/${article.id}`,
                  });
                }
              }),
            );
          } catch (notifyErr) {
            console.error("Studio final reject notification error:", notifyErr);
          }
          return res.json(updated);
        }

        // publish or schedule
        const when = decision === "schedule" ? (scheduledAt ? new Date(scheduledAt) : null) : null;
        if (decision === "schedule" && (!when || isNaN(when.getTime()))) {
          return res.status(400).json({ error: "A valid scheduledAt is required to schedule" });
        }
        const { updated, scheduled } = await performPublish(article, userId, { scheduledAt: when });
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "final_approved",
          metadata: { scheduled, scheduledAt: when?.toISOString() ?? null },
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: scheduled ? "article_scheduled" : "article_published",
          metadata: { scheduledAt: when?.toISOString() ?? null },
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: article.status, to: scheduled ? "scheduled" : "published", via: "final_decision" },
        } as any);
        await notifyPublished(req, updated ?? article, scheduled, when, scheduled ? null : new Date());
        res.json(updated);
      } catch (error: any) {
        if (error?.code === "risk_flags_block_publish") {
          return res.status(409).json({ error: error.message, code: error.code, riskFlags: error.riskFlags });
        }
        console.error("Studio final-decision error:", error);
        res.status(400).json({ error: error?.message || "Failed to record final decision" });
      }
    },
  );

  // Direct publish (publish now). Super Admin only. Works from
  // pending_final_approval, scheduled, or approved (unpublished) states.
  app.post(
    "/api/admin/studio/articles/:id/publish",
    requireAuth,
    async (req, res) => {
      if (!ensureSuperAdmin(req, res)) return;
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (!["pending_final_approval", "scheduled", "approved"].includes(article.status)) {
          return res.status(409).json({ error: `Cannot publish from ${article.status}` });
        }
        const userId = req.session.userId!;
        const { updated } = await performPublish(article, userId, { scheduledAt: null });
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "article_published",
          metadata: { from: article.status },
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: article.status, to: "published", via: "publish" },
        } as any);
        await notifyPublished(req, updated ?? article, false, null, new Date());
        res.json(updated);
      } catch (error: any) {
        if (error?.code === "risk_flags_block_publish") {
          return res.status(409).json({ error: error.message, code: error.code, riskFlags: error.riskFlags });
        }
        console.error("Studio publish error:", error);
        res.status(400).json({ error: error?.message || "Failed to publish article" });
      }
    },
  );

  // Unpublish a live article → back to approved (a Super-Admin holding state).
  app.post(
    "/api/admin/studio/articles/:id/unpublish",
    requireAuth,
    async (req, res) => {
      if (!ensureSuperAdmin(req, res)) return;
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (!["published", "scheduled"].includes(article.status)) {
          return res.status(409).json({ error: `Cannot unpublish from ${article.status}` });
        }
        const userId = req.session.userId!;
        const updated = await storage.updateStudioArticle(req.params.id, {
          status: "approved",
          publishedAt: null,
          scheduledAt: null,
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "article_unpublished",
          metadata: { from: article.status },
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: article.status, to: "approved", via: "unpublish" },
        } as any);
        res.json(updated);
      } catch (error: any) {
        console.error("Studio unpublish error:", error);
        res.status(400).json({ error: error?.message || "Failed to unpublish article" });
      }
    },
  );

  // Reschedule a scheduled (or live) article to a new future time. Super Admin only.
  app.post(
    "/api/admin/studio/articles/:id/reschedule",
    requireAuth,
    async (req, res) => {
      if (!ensureSuperAdmin(req, res)) return;
      try {
        const { scheduledAt } = req.body ?? {};
        const when = scheduledAt ? new Date(scheduledAt) : null;
        if (!when || isNaN(when.getTime())) {
          return res.status(400).json({ error: "A valid scheduledAt is required" });
        }
        if (when.getTime() <= Date.now()) {
          return res.status(400).json({ error: "Scheduled time must be in the future" });
        }
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (!["scheduled", "published", "pending_final_approval"].includes(article.status)) {
          return res.status(409).json({ error: `Cannot reschedule from ${article.status}` });
        }
        const userId = req.session.userId!;
        const updated = await storage.updateStudioArticle(req.params.id, {
          status: "scheduled",
          scheduledAt: when,
          publishedAt: null,
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "article_scheduled",
          metadata: { from: article.status, scheduledAt: when.toISOString(), rescheduled: true },
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: article.status, to: "scheduled", via: "reschedule" },
        } as any);
        res.json(updated);
      } catch (error: any) {
        console.error("Studio reschedule error:", error);
        res.status(400).json({ error: error?.message || "Failed to reschedule article" });
      }
    },
  );

  // Schedule a draft directly to the "scheduled" state from the calendar.
  // Requires studio.schedule_publish (super_admin). The article must be in draft status.
  app.post(
    "/api/admin/studio/articles/:id/schedule-draft",
    requireAuth,
    requirePermission("studio.schedule_publish"),
    async (req: Request, res: Response) => {
      try {
        const { scheduledAt } = req.body ?? {};
        const when = scheduledAt ? new Date(scheduledAt) : null;
        if (!when || isNaN(when.getTime())) {
          return res.status(400).json({ error: "A valid scheduledAt is required" });
        }
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (article.status !== "draft") {
          return res
            .status(409)
            .json({ error: `Only draft articles can be scheduled this way. Current status: ${article.status}` });
        }
        const userId = req.session.userId!;
        const updated = await storage.updateStudioArticle(req.params.id, {
          status: "scheduled",
          scheduledAt: when,
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "article_scheduled",
          metadata: { from: "draft", scheduledAt: when.toISOString(), via: "calendar" },
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: "draft", to: "scheduled", via: "calendar" },
        } as any);
        res.json(updated);
      } catch (error: any) {
        console.error("Studio schedule-draft error:", error);
        res.status(400).json({ error: error?.message || "Failed to schedule article" });
      }
    },
  );

  // Archive an article (take it out of all queues). Super Admin only.
  app.post(
    "/api/admin/studio/articles/:id/archive",
    requireAuth,
    async (req, res) => {
      if (!ensureSuperAdmin(req, res)) return;
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (article.status === "archived") {
          return res.status(409).json({ error: "Article is already archived" });
        }
        const userId = req.session.userId!;
        const updated = await storage.updateStudioArticle(req.params.id, {
          status: "archived",
          publishedAt: null,
          scheduledAt: null,
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "article_archived",
          metadata: { from: article.status },
        } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: article.status, to: "archived", via: "archive" },
        } as any);
        res.json(updated);
      } catch (error: any) {
        console.error("Studio archive error:", error);
        res.status(400).json({ error: error?.message || "Failed to archive article" });
      }
    },
  );

  // Reassign: assigned reviewer can hand off; super_admin/admin can override.
  app.post(
    "/api/admin/studio/articles/:id/reassign",
    requireAuth,
    async (req, res) => {
      try {
        const { reviewerUserId, comment } = req.body ?? {};
        if (!reviewerUserId || typeof reviewerUserId !== "string") {
          return res.status(400).json({ error: "reviewerUserId is required" });
        }

        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (article.status !== "in_review") {
          return res.status(409).json({ error: "Article is not currently in review" });
        }

        const role = req.session.role!;
        const userId = req.session.userId!;
        const isPrivileged = role === "super_admin" || role === "admin";
        const active = await storage.getActiveStudioReviewAssignment(req.params.id);
        const isAssignedReviewer = active?.reviewerUserId === userId;
        if (!isPrivileged && !isAssignedReviewer) {
          return res.status(403).json({ error: "You cannot reassign this article" });
        }

        const newReviewer = await storage.getAdminUser(reviewerUserId);
        if (!newReviewer || newReviewer.isActive === false) {
          return res.status(400).json({ error: "Selected reviewer is not available" });
        }

        // Close the current assignment, if any.
        if (active) {
          await storage.updateStudioReviewAssignment(active.id, {
            status: "reassigned",
            decisionAt: new Date(),
            comment: comment ?? null,
          } as any);
        }

        const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
        const baseUrl = `${proto}://${req.get("host")}`;
        await assignReviewerToArticle(article as StudioArticle, reviewerUserId, userId, baseUrl, {
          comment: comment ?? null,
        });

        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: userId,
          eventType: "review_reassigned",
          metadata: {
            from: active?.reviewerUserId ?? null,
            to: reviewerUserId,
            override: isPrivileged && !isAssignedReviewer,
            comment: comment ?? null,
          },
        } as any);

        res.json({ ok: true, reviewerUserId });
      } catch (error: any) {
        console.error("Studio reassign error:", error);
        res.status(400).json({ error: error?.message || "Failed to reassign article" });
      }
    },
  );

  // Get a project's routing configuration.
  app.get(
    "/api/admin/studio/projects/:id/routing",
    requireAuth,
    requirePermission("studio.manage_settings"),
    async (req, res) => {
      try {
        const project = await storage.getStudioProject(req.params.id);
        if (!project) return res.status(404).json({ error: "Project not found" });
        const rules = (project.routingRules ?? { rules: [] }) as StudioRoutingRules;
        res.json({
          projectId: project.id,
          strategy: rules.strategy ?? "least_recently_assigned",
          defaultReviewerUserIds: rules.defaultReviewerUserIds ?? [],
          rules: Array.isArray(rules.rules) ? rules.rules : [],
        });
      } catch (error: any) {
        console.error("Studio routing get error:", error);
        res.status(500).json({ error: "Failed to fetch routing config" });
      }
    },
  );

  // Update a project's routing configuration.
  app.put(
    "/api/admin/studio/projects/:id/routing",
    requireAuth,
    requirePermission("studio.manage_settings"),
    async (req, res) => {
      try {
        const project = await storage.getStudioProject(req.params.id);
        if (!project) return res.status(404).json({ error: "Project not found" });

        const routingSchema = z.object({
          strategy: z.enum(["least_recently_assigned", "round_robin"]).optional(),
          defaultReviewerUserIds: z.array(z.string()).optional(),
          rules: z
            .array(
              z.object({
                category: z.string().min(1),
                reviewerUserIds: z.array(z.string()),
              }),
            )
            .default([]),
        });
        const parsed = routingSchema.parse(req.body ?? {});

        const updated = await storage.updateStudioProject(req.params.id, {
          routingRules: parsed,
        } as any);

        await storage.createStudioAuditEvent({
          articleId: null,
          actorUserId: req.session.userId,
          eventType: "routing_updated",
          metadata: { projectId: req.params.id, ruleCount: parsed.rules.length },
        } as any);

        res.json(updated?.routingRules ?? parsed);
      } catch (error: any) {
        console.error("Studio routing update error:", error);
        res.status(400).json({ error: error?.message || "Failed to update routing config" });
      }
    },
  );

  // ---- Hire'in Insights Launch Control (Super Admin) ----

  app.get(
    "/api/admin/studio/insights-launch/status",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const { getLaunchStatus } = await import("./insightsLaunch");
        const status = await getLaunchStatus();
        res.json({ ...status, canControl: req.session.role === "super_admin" });
      } catch (error: any) {
        console.error("Insights launch status error:", error);
        res.status(500).json({ error: "Failed to fetch launch status" });
      }
    },
  );

  app.post(
    "/api/admin/studio/insights-launch/load",
    requireAuth,
    requirePermission("admin.studio.insightsLaunch.load", "super_admin"),
    async (req: Request, res: Response) => {
      try {
        const { seedInsightsLaunchArticles, applyLaunchRoutingGuardrail, getLaunchStatus } = await import("./insightsLaunch");
        const actorId = req.session.userId!;
        const seedResult = await seedInsightsLaunchArticles({ actorId });
        const guardResult = await applyLaunchRoutingGuardrail({ actorId });
        const status = await getLaunchStatus();
        res.json({
          ok: true,
          inserted: seedResult.ok ? seedResult.inserted : 0,
          skipped: seedResult.ok ? seedResult.skipped : 0,
          articlesLoaded: status.articlesLoaded,
          routingPoolSummary: guardResult.ok ? (guardResult as any).summary : [],
        });
      } catch (error: any) {
        console.error("Insights launch load error:", error);
        res.status(500).json({ error: error?.message || "Failed to load pilot articles" });
      }
    },
  );

  app.post(
    "/api/admin/studio/insights-launch/announce-and-route",
    requireAuth,
    requirePermission("admin.studio.insightsLaunch.announceAndRoute", "super_admin"),
    async (req: Request, res: Response) => {
      try {
        const { announceAndRouteLaunch } = await import("./insightsLaunch");
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const result = await announceAndRouteLaunch({
          actorId: req.session.userId!,
          baseUrl,
        });
        if (!result.ok) {
          if ((result as any).reason === "already_complete") {
            return res.status(409).json({ error: "Launch announcement already sent and articles are routed." });
          }
          if ((result as any).reason === "step1_not_done") {
            return res.status(400).json({ error: "Load pilot articles first (Step 1 not complete)." });
          }
          if ((result as any).reason === "announcement_email_failed") {
            return res.status(503).json({
              error: (result as any).message,
              notified: (result as any).notified ?? 0,
              retriable: true,
            });
          }
          return res.status(400).json({ error: "Could not complete announce-and-route." });
        }
        res.json(result);
      } catch (error: any) {
        console.error("Insights launch announce-and-route error:", error);
        res.status(500).json({ error: error?.message || "Failed to send launch announcement" });
      }
    },
  );

  app.post(
    "/api/admin/studio/insights-launch/announce",
    requireAuth,
    requirePermission("admin.studio.insightsLaunch.announce", "super_admin"),
    async (req: Request, res: Response) => {
      try {
        const { sendLaunchAnnouncement } = await import("./insightsLaunch");
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const result = await sendLaunchAnnouncement({
          actorId: req.session.userId!,
          baseUrl,
          force: false,
        });
        if (!result.ok) {
          return res.status(409).json({ error: "Launch announcement has already been sent." });
        }
        res.json(result);
      } catch (error: any) {
        console.error("Insights launch announce error:", error);
        res.status(500).json({ error: error?.message || "Failed to send launch announcement" });
      }
    },
  );

  // ---- Versions ----

  // List versions for an article.
  app.get(
    "/api/admin/studio/articles/:id/versions",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const versions = await storage.getStudioArticleVersions(req.params.id);
        res.json(versions);
      } catch (error) {
        console.error("Get studio versions error:", error);
        res.status(500).json({ error: "Failed to fetch versions" });
      }
    },
  );

  // Snapshot the current article body as an explicit version.
  app.post(
    "/api/admin/studio/articles/:id/versions",
    requireAuth,
    requirePermission("studio.edit_article", "marketing_manager", "content_editor"),
    async (req: Request, res: Response) => {
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        const version = await storage.createStudioArticleVersion({
          articleId: req.params.id,
          title: article.title,
          bodyMarkdown: article.bodyMarkdown,
          bodyJson: article.bodyJson,
          createdBy: req.session.userId,
        });
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: req.session.userId,
          eventType: "version_saved",
          metadata: { versionNo: version.versionNo },
        });
        res.status(201).json(version);
      } catch (error: any) {
        console.error("Create studio version error:", error);
        res.status(400).json({ error: error?.message || "Failed to save version" });
      }
    },
  );

  // Restore a version's body back onto the article.
  app.post(
    "/api/admin/studio/articles/:id/versions/:versionId/restore",
    requireAuth,
    requirePermission("studio.edit_article", "marketing_manager", "content_editor"),
    async (req: Request, res: Response) => {
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        const version = await storage.getStudioArticleVersion(req.params.versionId);
        if (!version || version.articleId !== req.params.id) {
          return res.status(404).json({ error: "Version not found" });
        }
        // Snapshot current state before overwriting, so restore is reversible.
        await storage.createStudioArticleVersion({
          articleId: req.params.id,
          title: article.title,
          bodyMarkdown: article.bodyMarkdown,
          bodyJson: article.bodyJson,
          createdBy: req.session.userId,
        });
        const readTimeMinutes = computeReadTime(version.bodyMarkdown, article.contentType);
        const updated = await storage.updateStudioArticle(req.params.id, {
          title: version.title ?? article.title,
          bodyMarkdown: version.bodyMarkdown,
          bodyJson: version.bodyJson,
          readTimeMinutes,
        });
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: req.session.userId,
          eventType: "version_restored",
          metadata: { restoredVersionNo: version.versionNo },
        });
        res.json(updated);
      } catch (error: any) {
        console.error("Restore studio version error:", error);
        res.status(400).json({ error: error?.message || "Failed to restore version" });
      }
    },
  );

  // ---- Authors ----

  // Returns active admin_users not yet linked as author profiles — used by the
  // "Link Employee" picker in AuthorsPanel to create employee-backed authors.
  app.get(
    "/api/admin/studio/author-candidates",
    requireAuth,
    requirePermission("studio.manage_authors"),
    async (req: Request, res: Response) => {
      try {
        const allUsers = await storage.getAdminUsers();
        const allAuthors = await storage.getStudioAuthorProfiles(undefined);
        const linkedIds = new Set(
          allAuthors
            .flatMap((a) => [
              (a as any).linkedUserId,
              (a as any).linked_user_id,
              a.linkedEmployeeId,
            ])
            .filter(Boolean) as string[],
        );
        const candidates = allUsers
          .filter((u) => u.isActive && !linkedIds.has(u.id))
          .map((u) => ({
            id: u.id,
            displayName: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email,
            title: (u as any).designation ?? u.role ?? null,
            photoUrl: (u as any).profilePhoto ?? null,
            email: u.email,
            linkedinUrl: (u as any).linkedinUrl ?? null,
          }));
        res.json(candidates);
      } catch (error) {
        console.error("Get author candidates error:", error);
        res.status(500).json({ error: "Failed to fetch author candidates" });
      }
    },
  );

  app.get(
    "/api/admin/studio/authors",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const projectId =
          typeof req.query.projectId === "string" && req.query.projectId
            ? req.query.projectId
            : undefined;
        const authors = await storage.getStudioAuthorProfiles(projectId);
        res.json(authors);
      } catch (error) {
        console.error("Get studio authors error:", error);
        res.status(500).json({ error: "Failed to fetch authors" });
      }
    },
  );

  // Recompute an author's profileComplete flag from its byline fields. Shared by
  // create / update / from-employee so the "incomplete profile" rule stays in one place.
  const computeAuthorProfileComplete = (a: {
    displayName?: string | null;
    publicTitle?: string | null;
    bio?: string | null;
    photoUrl?: string | null;
  }): boolean =>
    !!(
      a.displayName?.toString().trim() &&
      a.publicTitle?.toString().trim() &&
      a.bio?.toString().trim() &&
      a.photoUrl?.toString().trim()
    );

  // Central reassignment primitive shared by bulk-assign and merge. Validates
  // project compatibility, reassigns (or clears when targetId is null), and writes
  // one author_reassigned audit event per article. Throws an Error with a `.status`
  // property on validation failure so callers can surface the right HTTP code.
  //
  // Project rule: a project-scoped author may only own articles in its own project.
  // A global (null-project) author may own articles from any project — that is the
  // documented purpose of global authors, so a null-project target is allowed across
  // any selection.
  const reassignArticlesToAuthorGuarded = async (opts: {
    articles: Array<{ id: string; projectId: string; authorProfileId: string | null }>;
    targetId: string | null;
    actorUserId: string | undefined;
    via: string;
  }): Promise<string[]> => {
    const { articles, targetId, actorUserId, via } = opts;
    if (articles.length === 0) return [];

    if (targetId) {
      const target = await storage.getStudioAuthorProfile(targetId);
      if (!target) {
        throw Object.assign(new Error("Target author not found"), { status: 404 });
      }
      const targetProject = (target as any).projectId ?? null;
      if (targetProject) {
        const mismatch = articles.find((a) => a.projectId !== targetProject);
        if (mismatch) {
          throw Object.assign(
            new Error(
              "Target author belongs to a different project than one or more selected articles.",
            ),
            { status: 400 },
          );
        }
      }
    }

    const ids = articles.map((a) => a.id);
    const affected = await storage.reassignStudioArticleAuthors(ids, targetId);
    await Promise.all(
      articles.map((a) =>
        storage.createStudioAuditEvent({
          articleId: a.id,
          actorUserId,
          eventType: "author_reassigned",
          metadata: { from: a.authorProfileId ?? null, to: targetId, via },
        } as any),
      ),
    );
    return affected;
  };

  // Per-author linked article counts (for the merge UI: "N articles will move").
  app.get(
    "/api/admin/studio/authors/article-counts",
    requireAuth,
    requirePermission("studio.manage_authors"),
    async (req: Request, res: Response) => {
      try {
        const rows = await db
          .select({
            authorProfileId: studioArticles.authorProfileId,
            count: sql<number>`count(*)::int`,
          })
          .from(studioArticles)
          .where(isNotNull(studioArticles.authorProfileId))
          .groupBy(studioArticles.authorProfileId);
        res.json(rows);
      } catch (error) {
        console.error("Author article-counts error:", error);
        res.status(500).json({ error: "Failed to fetch article counts" });
      }
    },
  );

  app.post(
    "/api/admin/studio/authors",
    requireAuth,
    requirePermission("studio.manage_authors"),
    async (req: Request, res: Response) => {
      try {
        const coerced = coerceDateFields(req.body ?? {}, ["consentedAt"]);
        const parsed = insertStudioAuthorProfileSchema.partial().parse(coerced);
        if (!parsed.displayName || !parsed.displayName.trim()) {
          return res.status(400).json({ error: "displayName is required" });
        }
        if ((parsed as any).authorType === "employee" && !(parsed as any).linkedUserId) {
          return res.status(400).json({ error: "linkedUserId is required for internal (employee) authors" });
        }
        const body = { ...parsed, displayName: parsed.displayName.trim() };
        const profileComplete = computeAuthorProfileComplete(body as any);
        const created = await storage.createStudioAuthorProfile({
          ...body,
          profileComplete,
        } as any);
        // Sync LinkedIn URL back to the employee's admin_users record when creating
        // an internal (employee-type) author.
        if ((body as any).authorType === "employee" && (body as any).linkedUserId && body.linkedinUrl) {
          await storage.updateAdminUser((body as any).linkedUserId, {
            linkedinUrl: body.linkedinUrl,
          } as any).catch(() => {/* non-fatal */});
        }
        await storage.createStudioAuditEvent({
          articleId: null,
          actorUserId: req.session.userId,
          eventType: "author_created",
          metadata: { authorId: created.id, displayName: created.displayName },
        });
        res.status(201).json(created);
      } catch (error: any) {
        console.error("Create studio author error:", error);
        res.status(400).json({ error: error?.message || "Failed to create author" });
      }
    },
  );

  app.patch(
    "/api/admin/studio/authors/:id",
    requireAuth,
    requirePermission("studio.manage_authors"),
    async (req: Request, res: Response) => {
      try {
        const existing = await storage.getStudioAuthorProfile(req.params.id);
        if (!existing) return res.status(404).json({ error: "Author not found" });
        const coerced = coerceDateFields(req.body ?? {}, ["consentedAt"]);
        const updates = insertStudioAuthorProfileSchema.partial().parse(coerced);
        // Merge with existing to recompute profileComplete correctly.
        const merged = { ...existing, ...updates };
        const profileComplete = computeAuthorProfileComplete(merged as any);
        const updated = await storage.updateStudioAuthorProfile(req.params.id, {
          ...updates,
          profileComplete,
        } as any);
        await storage.createStudioAuditEvent({
          articleId: null,
          actorUserId: req.session.userId,
          eventType: "author_updated",
          metadata: { authorId: req.params.id },
        });
        res.json(updated);
      } catch (error: any) {
        console.error("Update studio author error:", error);
        res.status(400).json({ error: error?.message || "Failed to update author" });
      }
    },
  );

  app.delete(
    "/api/admin/studio/authors/:id",
    requireAuth,
    requirePermission("studio.manage_authors"),
    async (req: Request, res: Response) => {
      try {
        const existing = await storage.getStudioAuthorProfile(req.params.id);
        if (!existing) return res.status(404).json({ error: "Author not found" });

        const linkedArticles = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(studioArticles)
          .where(eq(studioArticles.authorProfileId, req.params.id));
        const articleCount = linkedArticles[0]?.count ?? 0;
        if (articleCount > 0) {
          return res.status(409).json({
            error: `Author has ${articleCount} linked article${articleCount === 1 ? "" : "s"} — reassign them first.`,
          });
        }

        await storage.deleteStudioAuthorProfile(req.params.id);
        await storage.createStudioAuditEvent({
          articleId: null,
          actorUserId: req.session.userId,
          eventType: "author_deleted",
          metadata: { authorId: req.params.id, displayName: existing.displayName },
        });
        res.status(204).end();
      } catch (error: any) {
        console.error("Delete studio author error:", error);
        res.status(500).json({ error: error?.message || "Failed to delete author" });
      }
    },
  );

  // Author profile completion status: computes which required fields are filled
  // and syncs the profileComplete flag. Called by the Authors panel to show progress.
  app.get(
    "/api/admin/studio/authors/:id/profile-status",
    requireAuth,
    requirePermission("studio.manage_authors"),
    async (req: Request, res: Response) => {
      try {
        const profile = await storage.getStudioAuthorProfile(req.params.id);
        if (!profile) return res.status(404).json({ error: "Author not found" });

        const requiredFields = [
          { key: "displayName", label: "Byline name", filled: !!(profile as any).displayName?.trim() },
          { key: "publicTitle", label: "Public title / role", filled: !!(profile as any).publicTitle?.trim() },
          { key: "bio", label: "Short bio", filled: !!(profile as any).bio?.trim() },
          { key: "photoUrl", label: "Photo / headshot", filled: !!(profile as any).photoUrl?.trim() },
        ];
        const filledCount = requiredFields.filter((f) => f.filled).length;
        const isComplete = filledCount === requiredFields.length;

        // Sync profileComplete flag in DB if it has drifted.
        if (!!(profile as any).profileComplete !== isComplete) {
          await storage.updateStudioAuthorProfile(req.params.id, { profileComplete: isComplete } as any);
        }

        res.json({
          profileId: profile.id,
          isComplete,
          filledCount,
          totalRequired: requiredFields.length,
          fields: requiredFields,
          linkedUserId: (profile as any).linkedUserId ?? (profile as any).linkedEmployeeId ?? null,
        });
      } catch (error: any) {
        console.error("Author profile-status error:", error);
        res.status(500).json({ error: "Failed to compute profile status" });
      }
    },
  );

  // ---- CM Review queue ----

  // Count of articles pending CM review (for sidebar badge).
  app.get(
    "/api/admin/studio/cm-review/count",
    requireAuth,
    requirePermission("studio.cm_review", "super_admin", "admin", "hr", "content_manager"),
    async (_req: Request, res: Response) => {
      try {
        const items = await storage.getStudioApprovalQueue(["pending_cm_review"]);
        res.json({ count: items.length });
      } catch (error) {
        console.error("CM review count error:", error);
        res.status(500).json({ error: "Failed to fetch CM review count" });
      }
    },
  );

  // CM Review queue: articles that a reviewer has approved, now awaiting CM polish.
  app.get(
    "/api/admin/studio/cm-review",
    requireAuth,
    requirePermission("studio.cm_review", "super_admin", "admin", "hr", "content_manager"),
    async (req: Request, res: Response) => {
      try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const items = await storage.getStudioApprovalQueue(["pending_cm_review"], projectId);
        res.json(items);
      } catch (error: any) {
        console.error("CM review queue error:", error);
        res.status(500).json({ error: "Failed to fetch CM review queue" });
      }
    },
  );

  // CM decision: approve → pending_author (with optional author assignment), or reject → draft.
  app.post(
    "/api/admin/studio/articles/:id/cm-decision",
    requireAuth,
    requirePermission("studio.cm_review", "super_admin", "admin", "hr", "content_manager"),
    async (req: Request, res: Response) => {
      try {
        const { decision, reason, authorProfileId } = req.body ?? {};
        if (!["approve", "reject"].includes(decision)) {
          return res.status(400).json({ error: "Invalid decision" });
        }
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (article.status !== "pending_cm_review") {
          return res.status(409).json({ error: "Article is not in CM review" });
        }
        const userId = req.session.userId!;

        if (decision === "reject") {
          if (!reason?.trim()) return res.status(400).json({ error: "A reason is required to reject" });
          const updated = await storage.updateStudioArticle(req.params.id, { status: "draft" } as any);
          await storage.createStudioAuditEvent({
            articleId: req.params.id, actorUserId: userId,
            eventType: "status_changed",
            metadata: { from: article.status, to: "draft", reason: reason.trim(), via: "cm_decision" },
          } as any);
          return res.json(updated);
        }

        // Approve → pending_author. Assign author if provided; auto-pick if none.
        let resolvedAuthorId: string | null = authorProfileId ?? (article as any).authorProfileId ?? null;
        if (!resolvedAuthorId) {
          const authors = await storage.getStudioAuthorProfiles(undefined);
          const withLinkedUser = authors.filter((a) => a.isActive && (a as any).linkedUserId);
          if (withLinkedUser.length > 0) {
            withLinkedUser.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            resolvedAuthorId = withLinkedUser[0].id;
            await storage.createStudioAuditEvent({
              articleId: req.params.id, actorUserId: userId,
              eventType: "author_auto_assigned",
              metadata: { authorProfileId: resolvedAuthorId, reason: "no_author_set" },
            } as any);
          }
        }

        // Gate: author profile must be complete before requesting sign-off.
        // Compute freshly from actual fields rather than relying on stale column.
        if (resolvedAuthorId) {
          const authorProfile = await storage.getStudioAuthorProfile(resolvedAuthorId);
          const isComplete = !!(
            authorProfile &&
            (authorProfile as any).displayName?.trim() &&
            (authorProfile as any).publicTitle?.trim() &&
            (authorProfile as any).bio?.trim() &&
            (authorProfile as any).photoUrl?.trim()
          );
          if (!isComplete) {
            return res.status(422).json({
              error: "Author profile is incomplete. Ensure byline name, public title, bio, and photo are filled in before sending for sign-off.",
              code: "author_profile_incomplete",
            });
          }
        }

        const updates: any = { status: "pending_author" };
        if (resolvedAuthorId) updates.authorProfileId = resolvedAuthorId;
        const updated = await storage.updateStudioArticle(req.params.id, updates);

        await storage.createStudioAuditEvent({
          articleId: req.params.id, actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: article.status, to: "pending_author", via: "cm_decision" },
        } as any);

        // Notify linked author user if present (in-app + email).
        try {
          if (resolvedAuthorId) {
            const authorProfile = await storage.getStudioAuthorProfile(resolvedAuthorId);
            const linkedUserId = (authorProfile as any)?.linkedUserId ?? (authorProfile as any)?.linkedEmployeeId;
            if (linkedUserId) {
              await storage.createNotification({
                userId: linkedUserId,
                type: "studio_author_sign_off",
                title: "Article awaiting your approval",
                message: `"${article.title}" has been assigned to you for author sign-off.`,
                isRead: false,
                metadata: { articleId: article.id, status: "pending_author" },
              });
              // SendGrid email to the linked admin user.
              const authorUser = await storage.getAdminUser(linkedUserId);
              if (authorUser?.email) {
                const cmUser = await storage.getAdminUser(userId);
                await sendStudioAuthorSignOffEmail({
                  to: authorUser.email,
                  recipientName: userDisplayName(authorUser) || "there",
                  articleTitle: article.title,
                  sentByName: userDisplayName(cmUser) || "the content team",
                });
              }
            }
          }
        } catch (notifyErr) {
          console.error("CM decision author notification error:", notifyErr);
        }

        res.json(updated);
      } catch (error: any) {
        console.error("CM decision error:", error);
        res.status(400).json({ error: error?.message || "Failed to record CM decision" });
      }
    },
  );

  // Author sign-off decision: approve → author_approved, or request_changes → draft.
  // Only the linked author (via authorProfile.linkedUserId) may take this action.
  // super_admin / admin / hr may override on the author's behalf.
  app.post(
    "/api/admin/studio/articles/:id/author-decision",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { decision, reason } = req.body ?? {};
        if (!["approve", "request_changes"].includes(decision)) {
          return res.status(400).json({ error: "Invalid decision" });
        }
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        if (article.status !== "pending_author") {
          return res.status(409).json({ error: "Article is not awaiting author sign-off" });
        }

        // Authorization: requester must be the linked author OR an admin/super_admin/hr proxy.
        const role = req.session.role!;
        const userId = req.session.userId!;
        const isAdminProxy = ["super_admin", "admin", "hr"].includes(role);
        if (!isAdminProxy) {
          // Look up the article's author profile and verify linked user.
          const apid = (article as any).authorProfileId;
          if (!apid) {
            return res.status(403).json({ error: "No author profile assigned to this article" });
          }
          const authorProfile = await storage.getStudioAuthorProfile(apid);
          const linkedUserId =
            (authorProfile as any)?.linkedUserId ??
            (authorProfile as any)?.linked_user_id ??
            (authorProfile as any)?.linkedEmployeeId;
          if (!linkedUserId || linkedUserId !== userId) {
            return res.status(403).json({ error: "You are not the assigned author for this article" });
          }
        }

        const toStatus = decision === "approve" ? "author_approved" : "draft";
        const updated = await storage.updateStudioArticle(req.params.id, { status: toStatus } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id, actorUserId: userId,
          eventType: "status_changed",
          metadata: { from: article.status, to: toStatus, reason: reason?.trim() || null, via: "author_decision" },
        } as any);

        // If approved, notify content managers that the article is ready for marketing.
        if (decision === "approve") {
          try {
            const admins = await storage.getAdminUsers();
            const marketers = admins.filter(
              (u) => u.isActive !== false && (u.role === "marketing_manager" || u.role === "content_manager"),
            );
            await Promise.all(
              marketers.map((m) =>
                storage.createNotification({
                  userId: m.id,
                  type: "studio_author_approved",
                  title: "Author approved article",
                  message: `"${article.title}" has been approved by the author and is ready for marketing.`,
                  isRead: false,
                  metadata: { articleId: article.id, status: "author_approved" },
                }),
              ),
            );
          } catch (notifyErr) {
            console.error("Author-approved notification error:", notifyErr);
          }
        }

        res.json(updated);
      } catch (error: any) {
        console.error("Author decision error:", error);
        res.status(400).json({ error: error?.message || "Failed to record author decision" });
      }
    },
  );

  // Bulk approve: move selected articles one step forward in the pipeline.
  app.post(
    "/api/admin/studio/articles/bulk-approve",
    requireAuth,
    requirePermission("studio.marketing_approve.bulk"),
    async (req: Request, res: Response) => {
      try {
        const { articleIds } = req.body ?? {};
        if (!Array.isArray(articleIds) || articleIds.length === 0) {
          return res.status(400).json({ error: "articleIds must be a non-empty array" });
        }
        // Only transitions that carry no mandatory side-effects are allowed here.
        // Transitions that require individual decision endpoints are intentionally
        // excluded to preserve workflow integrity:
        //   pending_cm_review → pending_author  requires CM decision + author profile completeness gate
        //   pending_author    → author_approved  requires actual author sign-off & auth check
        const BULK_STATUS_MAP: Record<string, string> = {
          draft: "in_review",
          in_review: "pending_cm_review",
          approved: "pending_cm_review",         // legacy articles already at "approved"
          author_approved: "pending_marketing",
          pending_marketing: "pending_final_approval",
        };
        const GATED_TRANSITIONS: Record<string, string> = {
          pending_cm_review: "Use the CM Review interface to advance individual articles.",
          pending_author: "Use the author sign-off interface — author must personally approve.",
        };
        const userId = req.session.userId!;
        const results: { id: string; status: string; error?: string }[] = [];
        for (const id of articleIds) {
          try {
            const article = await storage.getStudioArticle(id);
            if (!article) { results.push({ id, status: "error", error: "not found" }); continue; }
            const gateMsg = GATED_TRANSITIONS[article.status];
            if (gateMsg) { results.push({ id, status: "skipped", error: gateMsg }); continue; }
            const nextStatus = BULK_STATUS_MAP[article.status];
            if (!nextStatus) { results.push({ id, status: "skipped", error: `no next status for ${article.status}` }); continue; }
            await storage.updateStudioArticle(id, { status: nextStatus } as any);
            await storage.createStudioAuditEvent({
              articleId: id, actorUserId: userId,
              eventType: "status_changed",
              metadata: { from: article.status, to: nextStatus, via: "bulk_approve" },
            } as any);
            results.push({ id, status: nextStatus });
          } catch (err: any) {
            results.push({ id, status: "error", error: err?.message });
          }
        }
        res.json({ results });
      } catch (error: any) {
        console.error("Bulk approve error:", error);
        res.status(400).json({ error: error?.message || "Failed to bulk approve" });
      }
    },
  );

  // Assign or reassign an author on an article.
  app.patch(
    "/api/admin/studio/articles/:id/assign-author",
    requireAuth,
    requirePermission("studio.marketing_approve", "marketing_manager"),
    async (req: Request, res: Response) => {
      try {
        const { authorProfileId } = req.body ?? {};
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        const updated = await storage.updateStudioArticle(req.params.id, { authorProfileId: authorProfileId ?? null } as any);
        await storage.createStudioAuditEvent({
          articleId: req.params.id, actorUserId: req.session.userId,
          eventType: "author_reassigned",
          metadata: { authorProfileId: authorProfileId ?? null },
        } as any);
        res.json(updated);
      } catch (error: any) {
        console.error("Assign author error:", error);
        res.status(400).json({ error: error?.message || "Failed to assign author" });
      }
    },
  );

  // Bulk reassign (or clear) the author of a set of articles.
  app.post(
    "/api/admin/studio/articles/bulk-assign-author",
    requireAuth,
    requirePermission("studio.manage_authors"),
    async (req: Request, res: Response) => {
      try {
        const { articleIds, authorProfileId } = req.body ?? {};
        if (!Array.isArray(articleIds) || articleIds.length === 0) {
          return res.status(400).json({ error: "articleIds must be a non-empty array" });
        }
        const targetId: string | null =
          authorProfileId === null || authorProfileId === undefined || authorProfileId === ""
            ? null
            : String(authorProfileId);

        // Load articles up-front so we can validate and audit old → new.
        const articles = await Promise.all(
          articleIds.map((id: string) => storage.getStudioArticle(id)),
        );
        const found = articles.filter((a): a is NonNullable<typeof a> => !!a);
        if (found.length === 0) {
          return res.status(404).json({ error: "No matching articles found" });
        }

        const affected = await reassignArticlesToAuthorGuarded({
          articles: found,
          targetId,
          actorUserId: req.session.userId,
          via: "bulk_assign",
        });
        res.json({ updated: affected.length, articleIds: affected });
      } catch (error: any) {
        console.error("Bulk assign author error:", error);
        res.status(error?.status ?? 400).json({ error: error?.message || "Failed to bulk assign author" });
      }
    },
  );

  // Merge an author into another: move ALL of the source author's articles onto
  // the target author, then delete the now-empty source author.
  app.post(
    "/api/admin/studio/authors/:id/merge",
    requireAuth,
    requirePermission("studio.manage_authors"),
    async (req: Request, res: Response) => {
      try {
        const sourceId = req.params.id;
        const { targetAuthorId } = req.body ?? {};
        if (!targetAuthorId || typeof targetAuthorId !== "string") {
          return res.status(400).json({ error: "targetAuthorId is required" });
        }
        if (targetAuthorId === sourceId) {
          return res.status(400).json({ error: "Cannot merge an author into itself" });
        }
        const source = await storage.getStudioAuthorProfile(sourceId);
        if (!source) return res.status(404).json({ error: "Source author not found" });
        const target = await storage.getStudioAuthorProfile(targetAuthorId);
        if (!target) return res.status(404).json({ error: "Target author not found" });

        // Two project-scoped authors must share the same project to merge. A
        // null-project (global) author is compatible with anything by design.
        const sourceProject = (source as any).projectId ?? null;
        const targetProject = (target as any).projectId ?? null;
        if (sourceProject && targetProject && sourceProject !== targetProject) {
          return res.status(400).json({
            error: "Cannot merge authors that belong to different projects.",
          });
        }

        // Move all of the source's articles via the shared, project-validated
        // primitive (this also writes the per-article author_reassigned events).
        const sourceArticleIds = await storage.getStudioArticleIdsByAuthor(sourceId);
        const sourceArticles = (
          await Promise.all(sourceArticleIds.map((id) => storage.getStudioArticle(id)))
        ).filter((a): a is NonNullable<typeof a> => !!a);
        const moved = await reassignArticlesToAuthorGuarded({
          articles: sourceArticles,
          targetId: targetAuthorId,
          actorUserId: req.session.userId,
          via: "merge",
        });

        // Source is now empty — reuse the existing delete path's storage method.
        await storage.deleteStudioAuthorProfile(sourceId);
        await storage.createStudioAuditEvent({
          articleId: null,
          actorUserId: req.session.userId,
          eventType: "author_merged",
          metadata: {
            sourceAuthorId: sourceId,
            sourceDisplayName: source.displayName,
            targetAuthorId,
            targetDisplayName: target.displayName,
            movedArticleCount: moved.length,
          },
        } as any);

        res.json({
          merged: true,
          movedArticleCount: moved.length,
          targetAuthorId,
        });
      } catch (error: any) {
        console.error("Merge author error:", error);
        res.status(error?.status ?? 400).json({ error: error?.message || "Failed to merge author" });
      }
    },
  );

  // One-click: create an employee-type author profile directly from an
  // employee's HR record (name, title, photo, LinkedIn auto-pulled). Missing
  // byline fields are flagged on the card later — creation is NOT blocked.
  app.post(
    "/api/admin/studio/authors/from-employee",
    requireAuth,
    requirePermission("studio.manage_authors"),
    async (req: Request, res: Response) => {
      try {
        const { employeeId, projectId } = req.body ?? {};
        if (!employeeId || typeof employeeId !== "string") {
          return res.status(400).json({ error: "employeeId is required" });
        }
        const user = await storage.getAdminUser(employeeId);
        if (!user || !user.isActive) {
          return res.status(404).json({ error: "Employee not found or inactive" });
        }

        // Guard against double-linking the same employee.
        const existingAuthors = await storage.getStudioAuthorProfiles(undefined);
        const alreadyLinked = existingAuthors.some(
          (a) =>
            (a as any).linkedUserId === employeeId ||
            (a as any).linkedEmployeeId === employeeId,
        );
        if (alreadyLinked) {
          return res.status(409).json({ error: "This employee is already linked as an author." });
        }

        const displayName =
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
        const title = (user as any).designation ?? user.role ?? null;
        const photoUrl = (user as any).profilePhoto ?? null;
        const linkedinUrl = (user as any).linkedinUrl ?? null;

        // Same completeness rule as the normal create path. HR records don't carry
        // a publicTitle or bio, so a one-click profile is almost always incomplete
        // by design — that's surfaced on the card so it can be filled in later.
        const profileComplete = computeAuthorProfileComplete({
          displayName,
          publicTitle: null,
          bio: null,
          photoUrl,
        });

        const created = await storage.createStudioAuthorProfile({
          projectId: projectId || null,
          displayName,
          title,
          photoUrl,
          linkedinUrl,
          authorType: "employee",
          linkedUserId: employeeId,
          profileComplete,
        } as any);

        // Keep LinkedIn in sync back to the HR record (no-op if already set).
        if (linkedinUrl) {
          await storage
            .updateAdminUser(employeeId, { linkedinUrl } as any)
            .catch(() => {/* non-fatal */});
        }

        await storage.createStudioAuditEvent({
          articleId: null,
          actorUserId: req.session.userId,
          eventType: "author_created",
          metadata: {
            authorId: created.id,
            displayName: created.displayName,
            via: "from_employee",
            employeeId,
          },
        } as any);

        res.status(201).json(created);
      } catch (error: any) {
        console.error("Create author from employee error:", error);
        res.status(400).json({ error: error?.message || "Failed to create author from employee" });
      }
    },
  );

  // AI Schedule panel: create article stubs spread across a date range.
  app.post(
    "/api/admin/studio/calendar/ai-plan",
    requireAuth,
    requirePermission("studio.create_article", "marketing_manager", "content_editor"),
    async (req: Request, res: Response) => {
      try {
        const { projectId, fromDate, toDate, articlesPerWeek, topicFocus } = req.body ?? {};
        if (!projectId) return res.status(400).json({ error: "projectId is required" });
        if (!fromDate || !toDate) return res.status(400).json({ error: "fromDate and toDate are required" });
        const from = new Date(fromDate);
        const to = new Date(toDate);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) return res.status(400).json({ error: "Invalid dates" });
        const perWeek = Math.max(1, Math.min(7, Number(articlesPerWeek) || 3));
        const daysBetween = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalSlots = Math.ceil(daysBetween / 7 * perWeek);
        const slots: Date[] = [];
        const stepDays = Math.max(1, Math.floor(7 / perWeek));
        let cursor = new Date(from);
        while (slots.length < totalSlots && cursor <= to) {
          slots.push(new Date(cursor));
          cursor = new Date(cursor.getTime() + stepDays * 24 * 60 * 60 * 1000);
        }
        const topics = Array.isArray(topicFocus) ? topicFocus : [];
        const stubs = await Promise.all(slots.map(async (date, i) => {
          const topic = topics[i % Math.max(1, topics.length)] || "Hiring & Recruitment";
          return storage.createStudioArticle({
            projectId,
            title: `[Planned] ${topic} — ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            contentType: "article",
            // Keep stubs as drafts — they appear on calendar as "Planned Draft" chips.
            status: "draft",
            scheduledAt: date,
            createdBy: req.session.userId,
          } as any);
        }));
        await Promise.all(stubs.map((stub) =>
          storage.createStudioAuditEvent({
            articleId: stub.id, actorUserId: req.session.userId,
            eventType: "ai_stub_created",
            metadata: { scheduledAt: stub.scheduledAt, topicFocus: topicFocus ?? null },
          } as any),
        ));
        // Return a `plan` array matching what the AIPlanDialog UI expects,
        // plus raw `stubs` for any integrations that need the full article objects.
        const plan = stubs.map((s) => ({
          id: s.id,
          title: s.title,
          scheduledDate: s.scheduledAt,
          contentType: s.contentType,
        }));
        res.status(201).json({ plan, stubs, count: stubs.length });
      } catch (error: any) {
        console.error("AI plan error:", error);
        res.status(400).json({ error: error?.message || "Failed to create AI plan" });
      }
    },
  );

  // ---- Image upload (featured / cover images via presigned URL) ----
  app.post(
    "/api/admin/studio/upload-url",
    requireAuth,
    requirePermission("studio.manage_assets", "marketing_manager", "content_editor"),
    async (_req: Request, res: Response) => {
      try {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        res.json({ uploadURL, objectPath });
      } catch (error) {
        console.error("Studio upload URL error:", error);
        res.status(500).json({ error: "Failed to generate upload URL" });
      }
    },
  );

  // Brand reference (palette + typography) for Studio Settings.
  app.get(
    "/api/admin/studio/brand",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (_req: Request, res: Response) => {
      try {
        const brand = await storage.getStudioBrandSettings();
        res.json(brand ?? null);
      } catch (error) {
        console.error("Get studio brand error:", error);
        res.status(500).json({ error: "Failed to fetch brand settings" });
      }
    },
  );

  // List seeded social-card templates (matrix used by Content Studio).
  app.get(
    "/api/admin/studio/card-templates",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const family = typeof req.query.family === "string" && req.query.family ? req.query.family : undefined;
        const includeInactive = req.query.includeInactive === "true" || req.query.includeInactive === "1";
        const templates = await storage.getCardTemplates(family, includeInactive);
        // Omit the heavy html blob from the list view.
        res.json(templates.map(({ html, ...rest }) => rest));
      } catch (error) {
        console.error("Get card templates error:", error);
        res.status(500).json({ error: "Failed to fetch card templates" });
      }
    },
  );

  // Single template (includes the HTML body) for the Template Settings editor.
  app.get(
    "/api/admin/studio/card-templates/:id",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const template = await storage.getCardTemplate(req.params.id);
        if (!template) return res.status(404).json({ error: "Template not found" });
        res.json(template);
      } catch (error) {
        console.error("Get card template error:", error);
        res.status(500).json({ error: "Failed to fetch card template" });
      }
    },
  );

  // Live PNG preview of a template rendered with sample data (Template Settings).
  app.get(
    "/api/admin/studio/card-templates/:id/preview",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const template = await storage.getCardTemplate(req.params.id);
        if (!template) return res.status(404).json({ error: "Template not found" });
        const layout = isCardLayout(template.layout) ? template.layout : "standard";
        const vars = sampleCardVariables(layout);
        const png = await renderTemplateToPng(
          { html: template.html, width: template.width, height: template.height },
          vars as any,
        );
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "no-store");
        res.end(png);
      } catch (error) {
        console.error("Card template preview error:", error);
        res.status(500).json({ error: "Failed to render preview" });
      }
    },
  );

  // Activate / deactivate a template variant (Super Admin / marketing manager).
  app.patch(
    "/api/admin/studio/card-templates/:id",
    requireAuth,
    requirePermission("studio.manage_settings"),
    async (req: Request, res: Response) => {
      try {
        const { isActive } = req.body ?? {};
        if (typeof isActive !== "boolean") {
          return res.status(400).json({ error: "isActive (boolean) is required" });
        }
        const updated = await storage.updateCardTemplate(req.params.id, { isActive });
        if (!updated) return res.status(404).json({ error: "Template not found" });
        const { html, ...rest } = updated;
        res.json(rest);
      } catch (error) {
        console.error("Update card template error:", error);
        res.status(500).json({ error: "Failed to update card template" });
      }
    },
  );

  // Switch the active template family for a project (multi-brand).
  app.patch(
    "/api/admin/studio/projects/:id/template-family",
    requireAuth,
    requirePermission("studio.manage_settings"),
    async (req: Request, res: Response) => {
      try {
        const { family } = req.body ?? {};
        if (typeof family !== "string" || !family.trim()) {
          return res.status(400).json({ error: "family is required" });
        }
        const updated = await storage.updateStudioProject(req.params.id, {
          activeTemplateFamily: family.trim(),
        });
        if (!updated) return res.status(404).json({ error: "Project not found" });
        res.json(updated);
      } catch (error) {
        console.error("Switch template family error:", error);
        res.status(500).json({ error: "Failed to switch template family" });
      }
    },
  );

  // Regenerate an article's social cards on demand (optional layout override).
  app.post(
    "/api/admin/studio/articles/:id/regenerate-cards",
    requireAuth,
    requirePermission("studio.view", "marketing_manager", "content_editor", "reviewer"),
    async (req: Request, res: Response) => {
      try {
        const article = await storage.getStudioArticle(req.params.id);
        if (!article) return res.status(404).json({ error: "Article not found" });
        const { layout } = req.body ?? {};
        if (layout !== undefined && layout !== null && !isCardLayout(layout)) {
          return res.status(400).json({
            error: `Invalid layout. Use one of: ${CARD_LAYOUTS.join(", ")}`,
          });
        }
        // Persist the per-article layout override when provided.
        if (isCardLayout(layout) && layout !== article.cardLayout) {
          await storage.updateStudioArticle(req.params.id, { cardLayout: layout });
        }
        const result = await generateArticleCards(req.params.id, {
          layoutOverride: isCardLayout(layout) ? layout : article.cardLayout,
        });
        await storage.createStudioAuditEvent({
          articleId: req.params.id,
          actorUserId: req.session.userId,
          eventType: "social_cards_regenerated",
          metadata: {
            layout: result.layout,
            cardCount: result.cards.length,
            skipped: result.skipped,
          },
        });
        res.json(result);
      } catch (error: any) {
        console.error("Regenerate cards error:", error);
        res.status(500).json({ error: error?.message || "Failed to regenerate cards" });
      }
    },
  );

  // Read the full editable matrix + master flag (Super Admin only).
  app.get("/api/admin/access-control", require2FA, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const { getAccessControlState } = await import("./accessControlService");
      const state = await getAccessControlState();
      res.json({
        matrix: state.matrix,
        enabled: state.enabled,
        roles: ACCESS_CONTROL_ROLES,
        defaults: ACCESS_REGISTRY,
      });
    } catch (error) {
      console.error("Get access control error:", error);
      res.status(500).json({ error: "Failed to fetch access control" });
    }
  });

  // Update the matrix and/or the master flag (Super Admin only).
  app.put("/api/admin/access-control", require2FA, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { saveAccessControlMatrix, saveAccessControlEnabled, getAccessControlState } = await import("./accessControlService");
      const { matrix, enabled } = req.body as { matrix?: unknown; enabled?: unknown };
      if (matrix !== undefined) {
        await saveAccessControlMatrix(matrix, req.session.userId!);
      }
      if (typeof enabled === "boolean") {
        await saveAccessControlEnabled(enabled, req.session.userId!);
      }
      const state = await getAccessControlState();
      res.json({ matrix: state.matrix, enabled: state.enabled });
    } catch (error) {
      console.error("Update access control error:", error);
      res.status(500).json({ error: "Failed to update access control" });
    }
  });

  // Reset the matrix back to the shipped config defaults (Super Admin only).
  app.post("/api/admin/access-control/reset", require2FA, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { resetAccessControlMatrix, getAccessControlState } = await import("./accessControlService");
      await resetAccessControlMatrix(req.session.userId!);
      const state = await getAccessControlState();
      res.json({ matrix: state.matrix, enabled: state.enabled });
    } catch (error) {
      console.error("Reset access control error:", error);
      res.status(500).json({ error: "Failed to reset access control" });
    }
  });

  // Company Profile — public read (DB value merged over defaults)
  app.get("/api/company-profile", async (_req: Request, res: Response) => {
    try {
      const setting = await storage.getSystemSetting("company_profile");
      res.json(mergeCompanyProfile(setting?.value));
    } catch (error) {
      console.error("Get company profile error:", error);
      res.status(500).json({ error: "Failed to fetch company profile" });
    }
  });

  // Company Profile — admin-only upsert
  app.patch("/api/company-profile", requireAuth, requirePermission("companyProfile", "super_admin", "admin"), async (req: Request, res: Response) => {
    try {
      const result = companyProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid company profile data", details: result.error.issues });
      }
      await storage.upsertSystemSetting("company_profile", result.data, req.session.userId);
      res.json(mergeCompanyProfile(result.data));
    } catch (error) {
      console.error("Update company profile error:", error);
      res.status(500).json({ error: "Failed to update company profile" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const flagSetting = await storage.getSystemSetting("feature_flags");
      const flags = (flagSetting?.value as Record<string, boolean>) || {};
      if (!flags.notifications_enabled) {
        return res.json([]);
      }
      const userNotifications = await storage.getNotificationsByUser(req.session.userId!);
      res.json(userNotifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const flagSetting = await storage.getSystemSetting("feature_flags");
      const flags = (flagSetting?.value as Record<string, boolean>) || {};
      if (!flags.notifications_enabled) {
        return res.status(404).json({ error: "Notifications not enabled" });
      }
      const userNotifications = await storage.getNotificationsByUser(req.session.userId!);
      const owns = userNotifications.some(n => n.id === req.params.id);
      if (!owns) {
        return res.status(404).json({ error: "Notification not found" });
      }
      const updated = await storage.markNotificationRead(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req: Request, res: Response) => {
    try {
      const flagSetting = await storage.getSystemSetting("feature_flags");
      const flags = (flagSetting?.value as Record<string, boolean>) || {};
      if (!flags.notifications_enabled) {
        return res.status(404).json({ error: "Notifications not enabled" });
      }
      await storage.markAllNotificationsRead(req.session.userId!);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });

  // ==========================================
  // HR LETTERS (Experience, Internship, Certificate, Relieving)
  // ==========================================

  const LETTER_HMAC_SECRET = process.env.LETTER_HMAC_SECRET || process.env.OFFER_SIGNING_KEY;
  if (!LETTER_HMAC_SECRET) {
    console.warn("[hr-letters] WARNING: LETTER_HMAC_SECRET / OFFER_SIGNING_KEY not set. Letter issuance will fail.");
  }

  const TEMPLATE_PREFIX_MAP = SHARED_TEMPLATE_PREFIX_MAP;


  function generateRefNumber(prefix: string, year: number, count: number): string {
    return `RL/${prefix}/${year}/${String(count + 1).padStart(4, "0")}`;
  }

  // Delegates to the central DocumentSigningService to avoid duplicating the algorithm.
  // Field ordering is preserved exactly to remain compatible with already-issued letters.
  function computeLetterAuthCode(letter: {
    id: string; templateType: string; employeeName: string; designation: string;
    startDate: string; endDate?: string | null; performanceBand?: string | null;
    conductBand?: string | null; completionBand?: string | null;
    department?: string | null; location?: string | null; employeeCode?: string | null;
    signatoryName?: string | null; signatoryDesignation?: string | null;
    closingLine?: string | null; responsibilitiesSummary?: string | null;
    projectName?: string | null; customOverrideText?: string | null;
    issueDate?: string | null;
  }): { authCode: string; documentHash: string } {
    return _signHrLetter(letter);
  }

  app.get("/api/hr/letters/wording-matrix", requirePermission("hr.letters.wordingMatrix", "hr"), async (_req, res) => {
    res.json({
      performanceBand: PERFORMANCE_BAND_SENTENCES,
      conductBand: CONDUCT_BAND_SENTENCES,
      completionBand: COMPLETION_BAND_SENTENCES,
    });
  });

  app.get("/api/hr/letter-templates/sentences", requirePermission("hr.letterTemplates.sentences", "hr"), async (req, res) => {
    try {
      const { category } = req.query;
      const sentences = await storage.getLetterTemplateSentences(category as string | undefined);
      res.json(sentences);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch letter template sentences" });
    }
  });

  app.patch("/api/hr/letter-templates/sentences/:id", requireAdminLevel, async (req, res) => {
    try {
      const patchSchema = insertLetterTemplateSentenceSchema.pick({ sentence: true });
      const result = patchSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
      }
      const updated = await storage.updateLetterTemplateSentence(req.params.id, { sentence: result.data.sentence.trim() });
      if (!updated) {
        return res.status(404).json({ error: "Template sentence not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update letter template sentence" });
    }
  });

  app.get("/api/hr/letter-templates/sentences/:id/download", requireAdminLevel, async (req, res) => {
    try {
      const all = await storage.getLetterTemplateSentences();
      const sentence = all.find((s) => s.id === req.params.id);
      if (!sentence) {
        return res.status(404).json({ error: "Template sentence not found" });
      }
      const title = sentence.category === OFFER_CLAUSE_CATEGORY
        ? "Performance-Based Probation Review Clause (Offer Letter)"
        : sentence.category === ADDENDUM_CLAUSE_CATEGORY
          ? "90-Day Performance Review & Salary Revision Eligibility (Addendum)"
          : (sentence.label || "Letter Clause");
      const buffer = await generateClauseDocx(title, sentence.sentence);
      const fileName = `${title.replace(/[^a-zA-Z0-9]+/g, "_")}.docx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Download clause docx error:", error);
      res.status(500).json({ error: "Failed to generate clause document" });
    }
  });

  app.get("/api/hr/letter-templates/roles", requirePermission("hr.letterTemplates.roles", "hr"), async (req, res) => {
    try {
      const { designation, vertical } = req.query;
      const roles = await storage.getRoleSummaryTemplates({
        designation: designation as string | undefined,
        vertical: vertical as string | undefined,
      });
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role summary templates" });
    }
  });

  app.get("/api/hr/letters", requirePermission("hr.letters", "hr"), async (req, res) => {
    try {
      const { templateType, status, search } = req.query;
      const letters = await storage.getHrLetters({
        templateType: templateType as string,
        status: status as string,
        search: search as string,
      });
      res.json(letters);
    } catch (error) {
      console.error("Get HR letters error:", error);
      res.status(500).json({ error: "Failed to fetch letters" });
    }
  });

  app.get("/api/hr/letters/:id", requirePermission("hr.letters", "hr"), async (req, res) => {
    try {
      const letter = await storage.getHrLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Letter not found" });
      res.json(letter);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch letter" });
    }
  });

  app.post("/api/hr/letters", requirePermission("hr.letters", "hr"), async (req, res) => {
    try {
      const templateType = req.body.templateType;
      const STANDARD_TEMPLATES = ["experience", "internship_completion", "internship_certificate", "relieving"];
      const AMENDMENT_TEMPLATES = ["salary_revision", "role_change", "combined", "device_allocation"];
      const validTemplates = [...STANDARD_TEMPLATES, ...AMENDMENT_TEMPLATES];
      if (!templateType || !validTemplates.includes(templateType)) {
        return res.status(400).json({ error: "Invalid template type" });
      }

      const isAmendment = AMENDMENT_TEMPLATES.includes(templateType);

      // --- AMENDMENT LETTER PATH ---
      if (isAmendment) {
        const isManual = req.body.isManualEntry === true || req.body.isManualEntry === "true";
        let resolvedEmployeeName = (req.body.employeeName || "").trim();
        let resolvedDesignation = (req.body.designation || "").trim();
        let resolvedDepartment = (req.body.department || "").trim();
        let resolvedEmployeeCode = (req.body.employeeCode || "").trim();
        let resolvedEmployeeId: string | null = null;
        let resolvedEmail = (req.body.manualEmployeeEmail || "").trim();
        let resolvedStartDate = (req.body.startDate || "").trim();

        if (!isManual) {
          if (!req.body.employeeId) {
            return res.status(400).json({ error: "Employee must be selected from the system." });
          }
          const employee = await storage.getAdminUser(req.body.employeeId);
          if (!employee) {
            return res.status(400).json({ error: "Selected employee not found in system." });
          }
          resolvedEmployeeId = employee.id;
          resolvedEmployeeName = resolvedEmployeeName || `${employee.firstName} ${employee.lastName}`.trim();
          resolvedDesignation = resolvedDesignation || employee.designation || "";
          if (!resolvedDepartment && employee.departmentId) {
            const dept = await storage.getDepartment(employee.departmentId);
            resolvedDepartment = dept?.name || "";
          }
          resolvedEmployeeCode = resolvedEmployeeCode || employee.employeeId || "";
          resolvedEmail = resolvedEmail || employee.email || "";
          resolvedStartDate = resolvedStartDate || employee.joiningDate || "";
        }

        if (!resolvedEmployeeName) {
          return res.status(400).json({ error: "Full name is required." });
        }
        if (!resolvedDesignation) {
          return res.status(400).json({ error: "Designation is required." });
        }

        const metadata: Record<string, unknown> = req.body.metadata || {};
        const effectiveDate = (
          (req.body.effectiveDate || "").trim() ||
          (typeof metadata.effectiveDate === "string" ? metadata.effectiveDate : "") ||
          new Date().toISOString().split("T")[0]
        );

        const issueDate = new Date().toISOString().split("T")[0];
        const signatoryName = (req.body.signatoryName || "").trim();
        const signatoryDesignation = (req.body.signatoryDesignation || "HR Manager").trim();

        // Validate and extract annexures (max 5, each requires title + body)
        const rawAnnexures = req.body.annexureData;
        let validatedAnnexures: Array<{ title: string; body: string }> | null = null;
        if (Array.isArray(rawAnnexures) && rawAnnexures.length > 0) {
          if (rawAnnexures.length > 5) {
            return res.status(400).json({ error: "A maximum of 5 annexures are allowed." });
          }
          for (const ann of rawAnnexures) {
            if (!ann.title?.trim()) {
              return res.status(400).json({ error: "Each annexure must have a non-empty title." });
            }
          }
          validatedAnnexures = rawAnnexures.map((a: any) => ({ title: String(a.title), body: String(a.body) }));
        }

        const docData: AddendumData = {
          candidateName: resolvedEmployeeName,
          originalOfferDate: resolvedStartDate || effectiveDate,
          originalDesignation: resolvedDesignation,
          effectiveDate,
          hrManagerName: signatoryName || "HR Manager",
          addendumType: templateType as AddendumData["addendumType"],
          ...metadata,
          ...(validatedAnnexures ? { annexures: validatedAnnexures } : {}),
        };
        const docxBuffer = await generateAddendumDocx(docData);

        const letterData: InsertHrLetter = {
          templateType: templateType as InsertHrLetter["templateType"],
          employeeId: resolvedEmployeeId,
          employeeName: resolvedEmployeeName,
          employeeCode: resolvedEmployeeCode || null,
          designation: resolvedDesignation,
          department: resolvedDepartment || null,
          startDate: resolvedStartDate || effectiveDate,
          signatoryName: signatoryName || null,
          signatoryDesignation: signatoryDesignation || null,
          signatoryId: req.body.signatoryId || null,
          issueDate: issueDate || null,
          manualEmployeeEmail: resolvedEmail || null,
          metadata,
          annexureData: validatedAnnexures || null,
          createdBy: req.session.userId!,
          status: "draft",
        };

        const letter = await storage.createHrLetter(letterData);

        const prefix = TEMPLATE_PREFIX_MAP[letter.templateType] || "GEN";
        const year = new Date().getFullYear();
        const refPrefix = `RL/${prefix}/${year}/`;
        const count = await storage.getHrLetterCountByPrefix(refPrefix);
        const referenceNumber = generateRefNumber(prefix, year, count);
        const { authCode, documentHash } = computeLetterAuthCode({ ...letter, issueDate });

        const docDir = path.resolve("uploads/hr-letters");
        if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });
        const docFilename = `${referenceNumber.replace(/\//g, "-")}.docx`;
        const docPath = path.join(docDir, docFilename);
        fs.writeFileSync(docPath, docxBuffer);

        const issuedRecord = await storage.updateHrLetter(letter.id, {
          status: "issued",
          referenceNumber,
          authCode,
          documentHash,
          issuedBy: req.session.userId!,
          issuedAt: new Date(),
          issueDate,
          pdfPath: `hr-letters/${docFilename}`,
        });

        await recordSignature({
          documentType: "hr_letter",
          documentId: letter.id,
          referenceNumber,
          signerName: letter.employeeName,
          signerRole: "hr",
          signerUserId: req.session.userId,
          contentHash: documentHash,
          authCode,
          metadata: { templateType: letter.templateType },
        });

        await storage.createAuditLog({
          actorId: req.session.userId!,
          targetId: resolvedEmployeeId || req.session.userId!,
          action: "create_hr_letter",
          changes: { templateType: letter.templateType, employeeName: letter.employeeName, letterId: letter.id, isManual },
        });

        // Send email if requested
        if (req.body.sendEmail && resolvedEmail) {
          try {
            const verifyUrl = `${process.env.BASE_URL || "https://employee.hire-in.com"}/verify`;
            const ccList = req.body.ccEmails
              ? String(req.body.ccEmails).split(",").map((e: string) => e.trim()).filter(Boolean)
              : [];
            await sendHrLetterEmail({
              to: resolvedEmail,
              employeeName: resolvedEmployeeName,
              letterType: letter.templateType,
              referenceNumber,
              authCode,
              verifyUrl,
              pdfBuffer: docxBuffer as Buffer,
              pdfFilename: docFilename,
              cc: ccList.length ? ccList : undefined,
            });
          } catch (emailErr) {
            console.error("Amendment letter email send error:", emailErr);
          }
        }

        return res.status(201).json(issuedRecord);
      }

      // --- STANDARD LETTER PATH ---
      // Validate annexures if provided
      const rawStdAnnexures = req.body.annexureData;
      if (Array.isArray(rawStdAnnexures) && rawStdAnnexures.length > 0) {
        if (rawStdAnnexures.length > 5) {
          return res.status(400).json({ error: "A maximum of 5 annexures are allowed." });
        }
        for (const ann of rawStdAnnexures) {
          if (!ann.title?.trim()) {
            return res.status(400).json({ error: "Each annexure must have a non-empty title." });
          }
        }
      }

      if (!req.body.employeeId) {
        return res.status(400).json({ error: "Employee must be selected from the system. Manual entry is not allowed." });
      }
      const employee = await storage.getAdminUser(req.body.employeeId);
      if (!employee) {
        return res.status(400).json({ error: "Selected employee not found in system." });
      }
      if (!req.body.startDate) {
        return res.status(400).json({ error: "Start date is required" });
      }
      if (templateType !== "internship_certificate" && !req.body.endDate) {
        return res.status(400).json({ error: "End date is required for this template type" });
      }

      const userRole = req.session.role;
      const isOverrideAllowed = userRole === "super_admin" || userRole === "admin";
      const body = { ...req.body };
      const hasOverride = !!body.customOverrideText;
      if (!isOverrideAllowed) {
        delete body.customOverrideText;
        delete body.customOverrideBy;
        delete body.customOverrideAt;
      }
      if (isOverrideAllowed && hasOverride) {
        body.customOverrideBy = req.session.userId!;
        body.customOverrideAt = new Date();
      }
      const resolvedDesignation = (req.body.designation || employee.designation || "").trim();
      if (!resolvedDesignation) {
        return res.status(400).json({ error: "Designation is required. Please enter a designation for this employee." });
      }
      let derivedDepartment = "";
      if (employee.departmentId) {
        const dept = await storage.getDepartment(employee.departmentId);
        derivedDepartment = dept?.name || "";
      }
      const resolvedDepartment = (req.body.department || derivedDepartment || "").trim();
      if (!resolvedDepartment) {
        return res.status(400).json({ error: "Department is required. Please enter a department for this employee." });
      }
      const fullName = `${employee.firstName} ${employee.lastName}`.trim();
      const resolvedEmployeeName = (req.body.employeeName || fullName).trim();
      if (!resolvedEmployeeName) {
        return res.status(400).json({ error: "Employee name could not be determined. Please ensure the employee record has a first and last name." });
      }
      // Write back any values HR supplied that were missing from the employee profile
      const profileUpdates: Record<string, unknown> = {};
      if (!employee.designation && resolvedDesignation) profileUpdates.designation = resolvedDesignation;
      if (!employee.joiningDate && req.body.startDate) profileUpdates.joiningDate = req.body.startDate;
      if (!employee.departmentId && resolvedDepartment) {
        const allDepts = await storage.getDepartments();
        const matched = allDepts.find((d: { id: string; name: string }) => d.name.toLowerCase() === resolvedDepartment.toLowerCase());
        if (matched) profileUpdates.departmentId = matched.id;
      }
      if (Object.keys(profileUpdates).length > 0) {
        await storage.updateAdminUser(req.body.employeeId, profileUpdates);
      }
      const data = {
        ...body,
        employeeName: resolvedEmployeeName,
        employeeCode: employee.employeeId || "",
        designation: resolvedDesignation,
        department: resolvedDepartment,
        location: req.body.location || employee.location || "",
        createdBy: req.session.userId!,
        status: "draft",
      };
      const letter = await storage.createHrLetter(data);
      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: req.body.employeeId,
        action: "create_hr_letter",
        changes: { templateType: letter.templateType, employeeName: letter.employeeName, letterId: letter.id },
      });
      if (isOverrideAllowed && hasOverride) {
        await storage.createAuditLog({
          actorId: req.session.userId!,
          targetId: req.body.employeeId,
          action: "hr_letter_custom_override",
          changes: { customOverrideText: letter.customOverrideText, source: "create", letterId: letter.id },
        });
      }

      // Auto-issue on creation
      const prefix = TEMPLATE_PREFIX_MAP[letter.templateType] || "GEN";
      const year = new Date().getFullYear();
      const refPrefix = `RL/${prefix}/${year}/`;
      const count = await storage.getHrLetterCountByPrefix(refPrefix);
      const referenceNumber = generateRefNumber(prefix, year, count);
      const issueDate = letter.issueDate || new Date().toISOString().split("T")[0];
      const tempLetter = { ...letter, issueDate };
      const { authCode, documentHash } = computeLetterAuthCode(tempLetter);
      const issuedLetter = { ...letter, referenceNumber, authCode, issueDate, status: "issued" as const };
      const dbSentences = await storage.getLetterTemplateSentences();
      const customSentences = dbSentences.reduce<Record<string, Record<string, string>>>((acc, s) => {
        if (!acc[s.category]) acc[s.category] = {};
        acc[s.category][s.key] = s.sentence;
        return acc;
      }, {});
      const pdfBuffer = await generateHrLetterPdf(issuedLetter, {
        performance_band: customSentences["performance_band"],
        conduct_band: customSentences["conduct_band"],
        completion_band: customSentences["completion_band"],
        closing_line: customSentences["closing_line"],
      });
      const pdfDir = path.resolve("uploads/hr-letters");
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      const pdfFilename = `${referenceNumber.replace(/\//g, "-")}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFilename);
      fs.writeFileSync(pdfPath, pdfBuffer);
      const issuedRecord = await storage.updateHrLetter(letter.id, {
        status: "issued",
        referenceNumber,
        authCode,
        documentHash,
        issuedBy: req.session.userId!,
        issuedAt: new Date(),
        issueDate,
        pdfPath: `hr-letters/${pdfFilename}`,
      });
      await recordSignature({
        documentType: "hr_letter",
        documentId: letter.id,
        referenceNumber,
        signerName: letter.employeeName,
        signerRole: "hr",
        signerUserId: req.session.userId,
        contentHash: documentHash,
        authCode,
        metadata: { templateType: letter.templateType },
      });
      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: req.body.employeeId,
        action: "issue_hr_letter",
        changes: { referenceNumber, authCode, status: "issued", pdfPath: `hr-letters/${pdfFilename}` },
      });
      res.status(201).json(issuedRecord);
    } catch (error) {
      console.error("Create HR letter error:", error);
      res.status(500).json({ error: "Failed to create letter" });
    }
  });

  app.patch("/api/hr/letters/:id", requirePermission("hr.letters", "hr"), async (req, res) => {
    try {
      const letter = await storage.getHrLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Letter not found" });
      if (letter.status === "issued" || letter.status === "reissued" || letter.status === "revoked") {
        return res.status(400).json({ error: "Cannot edit an issued, reissued, or revoked letter" });
      }
      const userRole = req.session.role;
      const isOverrideAllowed = userRole === "super_admin" || userRole === "admin";
      const body = { ...req.body };
      const hasOverrideChange = body.customOverrideText !== undefined && body.customOverrideText !== letter.customOverrideText;
      if (!isOverrideAllowed) {
        delete body.customOverrideText;
        delete body.customOverrideBy;
        delete body.customOverrideAt;
      }
      if (isOverrideAllowed && hasOverrideChange) {
        body.customOverrideBy = req.session.userId!;
        body.customOverrideAt = new Date();
      }
      const updated = await storage.updateHrLetter(req.params.id, body);
      if (isOverrideAllowed && hasOverrideChange) {
        await storage.createAuditLog({
          actorId: req.session.userId!,
          targetId: letter.id,
          action: "hr_letter_custom_override",
          changes: { before: letter.customOverrideText || null, after: body.customOverrideText, source: "update" },
        });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update letter" });
    }
  });

  app.post("/api/hr/letters/:id/custom-override", requireAdminLevel, async (req, res) => {
    try {
      const letter = await storage.getHrLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Letter not found" });
      if (letter.status === "issued" || letter.status === "reissued" || letter.status === "revoked") {
        return res.status(400).json({ error: "Cannot modify an issued, reissued, or revoked letter. Use reissue to create a new version." });
      }
      const { customOverrideText } = req.body;
      const updated = await storage.updateHrLetter(req.params.id, {
        customOverrideText,
        customOverrideBy: req.session.userId!,
        customOverrideAt: new Date(),
      });
      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: letter.id,
        action: "hr_letter_custom_override",
        changes: { customOverrideText },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to add custom override" });
    }
  });

  app.post("/api/hr/letters/:id/approve", requirePermission("hr.letters.approve", "hr"), async (req, res) => {
    try {
      const letter = await storage.getHrLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Letter not found" });
      if (letter.status !== "draft" && letter.status !== "pending_approval") {
        return res.status(400).json({ error: "Letter must be in draft or pending approval status" });
      }
      const updated = await storage.updateHrLetter(req.params.id, {
        status: "approved",
        approvedBy: req.session.userId!,
        approvedAt: new Date(),
      });
      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: letter.id,
        action: "approve_hr_letter",
        changes: { status: "approved" },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve letter" });
    }
  });

  app.post("/api/hr/letters/:id/issue", requirePermission("hr.letters.issue", "hr"), async (req, res) => {
    try {
      const letter = await storage.getHrLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Letter not found" });
      if (letter.status !== "approved") {
        return res.status(400).json({ error: "Letter must be approved before issuing. Current status: " + letter.status });
      }

      const prefix = TEMPLATE_PREFIX_MAP[letter.templateType] || "GEN";
      const year = new Date().getFullYear();
      const refPrefix = `RL/${prefix}/${year}/`;
      const count = await storage.getHrLetterCountByPrefix(refPrefix);
      const referenceNumber = generateRefNumber(prefix, year, count);

      const issueDate = letter.issueDate || new Date().toISOString().split("T")[0];
      const tempLetter = { ...letter, issueDate };
      const { authCode, documentHash } = computeLetterAuthCode(tempLetter);

      const issuedLetter = {
        ...letter,
        referenceNumber,
        authCode,
        issueDate,
        status: "issued" as const,
      };

      const dbSentences = await storage.getLetterTemplateSentences();
      const customSentences = dbSentences.reduce<Record<string, Record<string, string>>>((acc, s) => {
        if (!acc[s.category]) acc[s.category] = {};
        acc[s.category][s.key] = s.sentence;
        return acc;
      }, {});
      const pdfBuffer = await generateHrLetterPdf(issuedLetter, {
        performance_band: customSentences["performance_band"],
        conduct_band: customSentences["conduct_band"],
        completion_band: customSentences["completion_band"],
        closing_line: customSentences["closing_line"],
      });
      const pdfDir = path.resolve("uploads/hr-letters");
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      const pdfFilename = `${referenceNumber.replace(/\//g, "-")}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFilename);
      fs.writeFileSync(pdfPath, pdfBuffer);

      const updated = await storage.updateHrLetter(req.params.id, {
        status: "issued",
        referenceNumber,
        authCode,
        documentHash,
        issuedBy: req.session.userId!,
        issuedAt: new Date(),
        issueDate,
        pdfPath: `hr-letters/${pdfFilename}`,
      });
      await recordSignature({
        documentType: "hr_letter",
        documentId: letter.id,
        referenceNumber,
        signerName: letter.employeeName,
        signerRole: "hr",
        signerUserId: req.session.userId,
        contentHash: documentHash,
        authCode,
        metadata: { templateType: letter.templateType },
      });
      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: letter.id,
        action: "issue_hr_letter",
        changes: { referenceNumber, authCode, status: "issued", pdfPath: `hr-letters/${pdfFilename}` },
      });
      res.json(updated);
    } catch (error) {
      console.error("Issue HR letter error:", error);
      res.status(500).json({ error: "Failed to issue letter" });
    }
  });

  app.get("/api/hr/letters/:id/download", requirePermission("hr.letters.download", "hr"), async (req, res) => {
    try {
      const letter = await storage.getHrLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Letter not found" });

      const AMENDMENT_TEMPLATES = ["salary_revision", "role_change", "combined", "device_allocation"];
      const isAmendment = AMENDMENT_TEMPLATES.includes(letter.templateType);
      const inline = req.query.inline === "1";
      const last4 = (letter.employeeCode || "").slice(-4) || "XXXX";
      const safeName = (letter.employeeName || "letter").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
      const ext = isAmendment ? "docx" : "pdf";
      const downloadFilename = `${safeName}_${last4}.${ext}`;
      const mimeType = isAmendment
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";
      const disposition = inline && !isAmendment
        ? `inline; filename="${downloadFilename}"`
        : `attachment; filename="${downloadFilename}"`;

      if (letter.pdfPath) {
        const filePath = path.resolve("uploads", letter.pdfPath);
        if (fs.existsSync(filePath)) {
          res.setHeader("Content-Type", mimeType);
          res.setHeader("Content-Disposition", disposition);
          return res.sendFile(filePath);
        }
      }

      // For amendment letters with no stored file, regenerate DOCX
      if (isAmendment) {
        const meta: Record<string, unknown> = (typeof letter.metadata === "object" && letter.metadata !== null ? letter.metadata : {}) as Record<string, unknown>;
        const effectiveDateFromMeta = typeof meta.effectiveDate === "string" ? meta.effectiveDate : letter.startDate;
        const storedAnnexures = Array.isArray((letter as any).annexureData) ? (letter as any).annexureData : undefined;
        const docxBuffer = await generateAddendumDocx({
          candidateName: letter.employeeName,
          originalOfferDate: letter.startDate,
          originalDesignation: letter.designation,
          effectiveDate: effectiveDateFromMeta,
          hrManagerName: letter.signatoryName || "HR Manager",
          addendumType: letter.templateType as AddendumData["addendumType"],
          ...meta,
          ...(storedAnnexures ? { annexures: storedAnnexures } : {}),
        });
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Disposition", disposition);
        return res.send(docxBuffer);
      }

      const dbSentences = await storage.getLetterTemplateSentences();
      const customSentences = dbSentences.reduce<Record<string, Record<string, string>>>((acc, s) => {
        if (!acc[s.category]) acc[s.category] = {};
        acc[s.category][s.key] = s.sentence;
        return acc;
      }, {});
      const pdfBuffer = await generateHrLetterPdf(letter, {
        performance_band: customSentences["performance_band"],
        conduct_band: customSentences["conduct_band"],
        completion_band: customSentences["completion_band"],
        closing_line: customSentences["closing_line"],
      });
      if (letter.pdfPath) {
        try {
          const filePath = path.resolve("uploads", letter.pdfPath);
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, pdfBuffer);
        } catch {}
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", disposition);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Download HR letter error:", error);
      res.status(500).json({ error: "Failed to download letter" });
    }
  });

  app.post("/api/hr/letters/:id/email", requirePermission("hr.letters.email", "hr"), async (req, res) => {
    try {
      const letter = await storage.getHrLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Letter not found" });
      if (letter.status !== "issued") {
        return res.status(400).json({ error: "Letter must be issued before sending email" });
      }
      if (!letter.referenceNumber || !letter.authCode) {
        return res.status(400).json({ error: "Letter missing reference number or auth code" });
      }

      const employee = letter.employeeId ? await storage.getAdminUser(letter.employeeId) : null;
      const recipientEmail = req.body.email || employee?.email;
      if (!recipientEmail) {
        return res.status(400).json({ error: "No email address found for the employee" });
      }
      const rawCcEmails = req.body.ccEmails;
      const parsedHrLetterCcEmails = Array.isArray(rawCcEmails)
        ? rawCcEmails.filter(Boolean)
        : (typeof rawCcEmails === "string" && rawCcEmails.trim() ? rawCcEmails.split(",").map((e: string) => e.trim()).filter(Boolean) : []);

      let pdfBuffer: Buffer | undefined;
      if (letter.pdfPath) {
        const filePath = path.resolve("uploads", letter.pdfPath);
        if (fs.existsSync(filePath)) {
          pdfBuffer = fs.readFileSync(filePath);
        }
      }
      if (!pdfBuffer) {
        const dbSentences = await storage.getLetterTemplateSentences();
        const customSentences = dbSentences.reduce<Record<string, Record<string, string>>>((acc, s) => {
          if (!acc[s.category]) acc[s.category] = {};
          acc[s.category][s.key] = s.sentence;
          return acc;
        }, {});
        pdfBuffer = await generateHrLetterPdf(letter, {
          performance_band: customSentences["performance_band"],
          conduct_band: customSentences["conduct_band"],
          completion_band: customSentences["completion_band"],
          closing_line: customSentences["closing_line"],
        });
        if (letter.pdfPath) {
          try {
            const filePath = path.resolve("uploads", letter.pdfPath);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, pdfBuffer);
          } catch {}
        }
      }

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "hire-in.com";
      const verifyUrl = `${protocol}://${host}/verify`;

      const result = await sendHrLetterEmail({
        to: recipientEmail,
        employeeName: letter.employeeName,
        letterType: letter.templateType,
        referenceNumber: letter.referenceNumber,
        authCode: letter.authCode,
        verifyUrl,
        pdfBuffer,
        pdfFilename: `${letter.referenceNumber.replace(/\//g, "-")}.pdf`,
        cc: parsedHrLetterCcEmails.length > 0 ? parsedHrLetterCcEmails : undefined,
      });

      if (!result.success) {
        return res.status(500).json({ error: `Failed to send email: ${result.error}` });
      }

      if (parsedHrLetterCcEmails.length > 0) {
        await storage.updateHrLetter(letter.id, { ccEmails: parsedHrLetterCcEmails.join(",") });
      }

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: letter.id,
        action: "email_hr_letter",
        changes: { sentTo: recipientEmail, referenceNumber: letter.referenceNumber, cc: parsedHrLetterCcEmails.length > 0 ? parsedHrLetterCcEmails : undefined },
      });

      res.json({ success: true, sentTo: recipientEmail });
    } catch (error) {
      console.error("Email HR letter error:", error);
      res.status(500).json({ error: "Failed to send letter email" });
    }
  });

  app.post("/api/hr/letters/:id/reissue", requirePermission("hr.letters.reissue", "hr"), async (req, res) => {
    try {
      const originalLetter = await storage.getHrLetter(req.params.id);
      if (!originalLetter) return res.status(404).json({ error: "Letter not found" });
      if (originalLetter.status !== "issued" && originalLetter.status !== "reissued") {
        return res.status(400).json({ error: "Can only reissue an issued letter" });
      }
      const { reissueReason } = req.body;

      // Fetch current employee data to capture any name/designation/department changes
      const currentEmployee = await storage.getAdminUser(originalLetter.employeeId);
      if (!currentEmployee) {
        return res.status(400).json({ error: "Employee record not found. Cannot reissue letter." });
      }

      const currentFullName = `${currentEmployee.firstName} ${currentEmployee.lastName}`.trim();
      const currentDesignation = currentEmployee.designation || originalLetter.designation || "";
      let currentDepartment = originalLetter.department || "";
      if (currentEmployee.departmentId) {
        const dept = await storage.getDepartment(currentEmployee.departmentId);
        if (dept?.name) currentDepartment = dept.name;
      }

      // Track what changed between the original letter and the current employee data
      // Always record a field if the old and new values differ — including removals (empty/null)
      const dataChanges: Record<string, { old: string | null; new: string | null }> = {};
      const oldName = originalLetter.employeeName ?? null;
      const newName = currentFullName || null;
      if (oldName !== newName) {
        dataChanges.employeeName = { old: oldName, new: newName };
      }
      const oldDesignation = originalLetter.designation ?? null;
      const newDesignation = currentDesignation || null;
      if (oldDesignation !== newDesignation) {
        dataChanges.designation = { old: oldDesignation, new: newDesignation };
      }
      const oldDepartment = originalLetter.department || null;
      const newDepartment = currentDepartment || null;
      if (oldDepartment !== newDepartment) {
        dataChanges.department = { old: oldDepartment, new: newDepartment };
      }

      // Mark original as reissued; restore on failure (compensating update)
      await storage.updateHrLetter(req.params.id, { status: "reissued" });
      let draftLetter: Awaited<ReturnType<typeof storage.createHrLetter>> | null = null;

      try {
        const newIssueDate = new Date().toISOString().split("T")[0];
        draftLetter = await storage.createHrLetter({
          templateType: originalLetter.templateType,
          employeeId: originalLetter.employeeId,
          employeeName: currentFullName || originalLetter.employeeName,
          employeeCode: currentEmployee.employeeId || originalLetter.employeeCode,
          designation: currentDesignation || originalLetter.designation,
          department: currentDepartment,
          employmentType: originalLetter.employmentType,
          location: currentEmployee.location || originalLetter.location,
          reportingManager: originalLetter.reportingManager,
          startDate: originalLetter.startDate,
          endDate: originalLetter.endDate,
          lastWorkingDay: originalLetter.lastWorkingDay,
          performanceBand: originalLetter.performanceBand,
          conductBand: originalLetter.conductBand,
          completionBand: originalLetter.completionBand,
          closingLine: originalLetter.closingLine,
          includeResponsibilities: originalLetter.includeResponsibilities,
          responsibilitiesSummary: originalLetter.responsibilitiesSummary,
          includeProject: originalLetter.includeProject,
          projectName: originalLetter.projectName,
          includeSeal: originalLetter.includeSeal,
          signatoryId: originalLetter.signatoryId,
          signatoryName: originalLetter.signatoryName,
          signatoryDesignation: originalLetter.signatoryDesignation,
          issueDate: newIssueDate,
          customOverrideText: originalLetter.customOverrideText,
          customOverrideBy: originalLetter.customOverrideBy,
          customOverrideAt: originalLetter.customOverrideAt,
          pdfPath: null,
          status: "draft",
          reissuedFromLetterId: originalLetter.id,
          reissueReason: reissueReason || "Reissued with updated data",
          createdBy: req.session.userId!,
        });

        // Auto-issue the new letter
        const reissuePrefix = TEMPLATE_PREFIX_MAP[draftLetter.templateType] || "GEN";
        const reissueYear = new Date().getFullYear();
        const reissueRefPrefix = `RL/${reissuePrefix}/${reissueYear}/`;
        const reissueCount = await storage.getHrLetterCountByPrefix(reissueRefPrefix);
        const newReferenceNumber = generateRefNumber(reissuePrefix, reissueYear, reissueCount);
        const tempNewLetter = { ...draftLetter, issueDate: newIssueDate };
        const { authCode: newAuthCode, documentHash: newDocumentHash } = computeLetterAuthCode(tempNewLetter);
        const issuedNewLetter = { ...draftLetter, referenceNumber: newReferenceNumber, authCode: newAuthCode, issueDate: newIssueDate, status: "issued" as const };

        const reissueDbSentences = await storage.getLetterTemplateSentences();
        const reissueCustomSentences = reissueDbSentences.reduce<Record<string, Record<string, string>>>((acc, s) => {
          if (!acc[s.category]) acc[s.category] = {};
          acc[s.category][s.key] = s.sentence;
          return acc;
        }, {});
        const newPdfBuffer = await generateHrLetterPdf(issuedNewLetter, {
          performance_band: reissueCustomSentences["performance_band"],
          conduct_band: reissueCustomSentences["conduct_band"],
          completion_band: reissueCustomSentences["completion_band"],
          closing_line: reissueCustomSentences["closing_line"],
        });
        const newPdfDir = path.resolve("uploads/hr-letters");
        if (!fs.existsSync(newPdfDir)) fs.mkdirSync(newPdfDir, { recursive: true });
        const newPdfFilename = `${newReferenceNumber.replace(/\//g, "-")}.pdf`;
        const newPdfPath = path.join(newPdfDir, newPdfFilename);
        fs.writeFileSync(newPdfPath, newPdfBuffer);

        const newLetter = await storage.updateHrLetter(draftLetter.id, {
          status: "issued",
          referenceNumber: newReferenceNumber,
          authCode: newAuthCode,
          documentHash: newDocumentHash,
          issuedBy: req.session.userId!,
          issuedAt: new Date(),
          issueDate: newIssueDate,
          pdfPath: `hr-letters/${newPdfFilename}`,
        });

        await storage.createAuditLog({
          actorId: req.session.userId!,
          targetId: newLetter!.id,
          action: "reissue_hr_letter",
          changes: {
            originalId: originalLetter.id,
            originalReference: originalLetter.referenceNumber,
            newReference: newReferenceNumber,
            reissueReason,
            dataChanges: Object.keys(dataChanges).length > 0 ? dataChanges : null,
          },
        });

        res.status(201).json(newLetter);
      } catch (issuanceError) {
        // Compensating update: restore the original letter's status so it is not left orphaned
        try {
          await storage.updateHrLetter(req.params.id, { status: originalLetter.status });
          if (draftLetter) {
            await storage.updateHrLetter(draftLetter.id, { status: "revoked" });
          }
        } catch (rollbackError) {
          console.error("Reissue rollback failed:", rollbackError);
        }
        throw issuanceError;
      }
    } catch (error) {
      console.error("Reissue HR letter error:", error);
      res.status(500).json({ error: "Failed to reissue letter" });
    }
  });

  app.post("/api/hr/letters/:id/revoke", requirePermission("hr.letters.revoke", "hr"), async (req, res) => {
    try {
      const letter = await storage.getHrLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Letter not found" });
      if (letter.status === "revoked") {
        return res.status(400).json({ error: "Letter is already revoked" });
      }
      const { revokeReason } = req.body;
      const updated = await storage.updateHrLetter(req.params.id, {
        status: "revoked",
        revokedBy: req.session.userId!,
        revokedAt: new Date(),
        revokeReason: revokeReason || "Revoked",
      });
      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: letter.id,
        action: "revoke_hr_letter",
        changes: { revokeReason, status: "revoked" },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to revoke letter" });
    }
  });

  // Security headers applied to every /verify response (defined before rate limiter
  // so the limiter's own handler can also set them on 429 responses).
  function setVerifySecurityHeaders(res: Response): void {
    res.set("Cache-Control", "no-store, no-cache");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("X-Frame-Options", "DENY");
    res.set("Content-Security-Policy", "default-src 'none'");
  }

  /**
   * Log an anomalous /verify request without recording sensitive data.
   * Only the first 3 chars of ref are emitted (honeypot signal).
   * The user-agent is SHA-256 hashed to prevent log injection while
   * preserving a fingerprint for correlation.  Full ref and auth code
   * are never written to logs.
   */
  function logVerifyAnomaly(ip: string, rawRef: string, userAgent: string): void {
    const refPrefix = (rawRef || "").substring(0, 3).replace(/[^\w/]/g, "?");
    const uaHash = crypto
      .createHash("sha256")
      .update((userAgent || "").slice(0, 512))
      .digest("hex")
      .substring(0, 8);
    console.warn(
      `[verify-anomaly] ${new Date().toISOString()} ip=${ip} ref_prefix=${refPrefix} ua_hash=${uaHash} reason=invalid_format`,
    );
  }

  // ── /verify rate limiter — true sliding window ──────────────────────────────
  // express-rate-limit uses a fixed window by default. We implement a true
  // sliding window here: for each IP we keep an array of hit timestamps,
  // prune any older than VERIFY_WINDOW_MS, and reject if ≥ VERIFY_MAX remain.
  // req.ip is correct because auth.ts already calls app.set("trust proxy", 1).
  const _verifyWindow = new Map<string, number[]>();
  const VERIFY_WINDOW_MS = 60_000;
  const VERIFY_MAX = 30;

  function verifyRateLimiter(req: Request, res: Response, next: NextFunction) {
    const ip = (req.ip || req.socket.remoteAddress || "unknown").trim();
    const now = Date.now();
    const hits = (_verifyWindow.get(ip) || []).filter((t) => now - t < VERIFY_WINDOW_MS);
    if (hits.length >= VERIFY_MAX) {
      setVerifySecurityHeaders(res);
      return res.status(429).set("Retry-After", "60").json({ error: "too_many_requests" });
    }
    hits.push(now);
    _verifyWindow.set(ip, hits);
    // Periodic GC: evict IPs whose whole window has expired to prevent unbounded growth
    if (_verifyWindow.size > 10_000) {
      for (const [k, v] of _verifyWindow) {
        if (v.every((t) => now - t >= VERIFY_WINDOW_MS)) _verifyWindow.delete(k);
      }
    }
    next();
  }

  app.get("/api/verify-letter", verifyRateLimiter, async (req, res) => {
    // Security headers present on every response (including 400)
    setVerifySecurityHeaders(res);

    // req.ip is correctly resolved via the trust proxy=1 setting in auth.ts
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = String(req.headers["user-agent"] ?? "");

    // ── 1. Format validation before any DB access ────────────────────────────
    const rawRef = String(req.query.ref ?? "");
    const rawAuth = String(req.query.auth ?? "");
    // documentType is required — no silent default. Missing/invalid → 400.
    const rawDocType = String(req.query.documentType ?? "");

    const parsed = verifyInputSchema.safeParse({
      ref: rawRef,
      auth: rawAuth,
      documentType: rawDocType,
    });

    if (!parsed.success) {
      logVerifyAnomaly(ip, rawRef, userAgent);
      return res.status(400).json({ error: "invalid_format" });
    }

    const { ref, auth, documentType } = parsed.data;

    try {
      // ── Contract verification branch ────────────────────────────────────────
      if (documentType === "contract") {
        const { verifyDocument } = await import("./documentSigningService");
        const result = await verifyDocument("contract", ref, auth);

        if (result.error === "not_found") {
          return res.status(404).json({ error: "Document not found or auth code does not match" });
        }
        if (result.error) {
          return res.status(500).json({ error: "Verification service error" });
        }

        const c = result.record as any;
        return res.json({
          documentType: "contract",
          clientName: c.clientName,
          templateName: c.templateName,
          candidateName: c.candidateName,
          candidates: c.candidates,
          contractStartDate: c.contractStartDate,
          contractEndDate: c.contractEndDate,
          agreementDate: c.agreementDate,
          billingFrequency: c.billingFrequency,
          paymentTermsDays: c.paymentTermsDays,
          status: c.status,
          verified: result.valid,
          tamperDetected: result.tamperDetected,
          ...(result.tamperDetected ? { warning: "Document content may have been modified after issuance" } : {}),
        });
      }

      // ── Offer letter verification ─────────────────────────────────────────
      if (documentType === "offer_letter") {
        const {
          computeOfferLetterVerifyAuth, timingSafeAuthEqual,
        } = await import("./documentSigningService");
        const [l] = await db.select().from(offerLetters)
          .where(eq(offerLetters.referenceNumber, ref)).limit(1);
        if (!l || !l.verifyAuthCode) {
          return res.status(404).json({ error: "Document not found or auth code does not match" });
        }
        const recomputed = computeOfferLetterVerifyAuth({
          referenceNumber: ref,
          candidateName: l.candidateName,
          designation: l.designation,
          salary: l.salary,
          probationSalary: l.probationSalary ? String(l.probationSalary) : null,
          proposedStartDate: l.proposedStartDate,
          departmentId: l.departmentId,
          location: l.location,
          employmentType: l.employmentType,
          offerDate: l.offerDate,
        });
        if (!timingSafeAuthEqual(recomputed, auth)) {
          return res.status(404).json({ error: "Document not found or auth code does not match" });
        }
        const tamperDetected = l.verifyAuthCode !== recomputed;
        return res.json({
          documentType: "offer_letter",
          employeeName: l.candidateName,
          designation: l.designation,
          location: l.location,
          startDate: l.proposedStartDate,
          offerDate: l.offerDate,
          acceptedName: l.acceptedName,
          acceptedAt: l.acceptedAt,
          referenceNumber: ref,
          status: l.status,
          verified: !tamperDetected,
          tamperDetected,
          ...(tamperDetected ? { warning: "Document content may have been modified after issuance" } : {}),
        });
      }

      // ── Addendum verification ─────────────────────────────────────────────
      if (documentType === "addendum") {
        const {
          computeAddendumVerifyAuth, timingSafeAuthEqual,
        } = await import("./documentSigningService");
        const [a] = await db.select().from(offerLetterAddendums)
          .where(eq(offerLetterAddendums.referenceNumber, ref)).limit(1);
        if (!a || !a.verifyAuthCode) {
          return res.status(404).json({ error: "Document not found or auth code does not match" });
        }
        const recomputed = computeAddendumVerifyAuth({
          referenceNumber: ref,
          candidateName: a.candidateName,
          oldDesignation: a.oldDesignation,
          newDesignation: a.newDesignation,
          oldSalary: a.oldSalary,
          newSalary: a.newSalary,
          effectiveDate: a.effectiveDate,
          addendumType: a.addendumType,
          reason: a.reason,
        });
        if (!timingSafeAuthEqual(recomputed, auth)) {
          return res.status(404).json({ error: "Document not found or auth code does not match" });
        }
        const tamperDetected = a.verifyAuthCode !== recomputed;
        return res.json({
          documentType: "addendum",
          employeeName: a.candidateName,
          addendumType: a.addendumType,
          effectiveDate: a.effectiveDate,
          acceptedName: a.acceptedName,
          acceptedAt: a.acceptedAt,
          referenceNumber: ref,
          status: a.status,
          verified: !tamperDetected,
          tamperDetected,
          ...(tamperDetected ? { warning: "Document content may have been modified after issuance" } : {}),
        });
      }

      // ── HR letter verification branch ───────────────────────────────────────
      const letter = await storage.getHrLetterByRef(ref);
      if (!letter) {
        return res.status(404).json({ error: "Document not found or auth code does not match" });
      }

      if (!LETTER_HMAC_SECRET) {
        return res.status(500).json({ error: "Verification service unavailable" });
      }
      const { authCode: recomputedAuth } = computeLetterAuthCode({
        id: letter.id,
        templateType: letter.templateType,
        employeeName: letter.employeeName,
        designation: letter.designation,
        startDate: letter.startDate,
        endDate: letter.endDate,
        performanceBand: letter.performanceBand,
        conductBand: letter.conductBand,
        completionBand: letter.completionBand,
        department: letter.department,
        location: letter.location,
        employeeCode: letter.employeeCode,
        signatoryName: letter.signatoryName,
        signatoryDesignation: letter.signatoryDesignation,
        closingLine: letter.closingLine,
        responsibilitiesSummary: letter.responsibilitiesSummary,
        projectName: letter.projectName,
        customOverrideText: letter.customOverrideText,
        issueDate: letter.issueDate,
      });

      // Timing-safe comparison — auth is already uppercased from verifyInputSchema
      const authBuf = Buffer.from(auth, "utf8");
      const recomputedBuf = Buffer.from(recomputedAuth, "utf8");
      const authMatch =
        authBuf.length === recomputedBuf.length &&
        crypto.timingSafeEqual(authBuf, recomputedBuf);

      if (!authMatch) {
        return res.status(404).json({ error: "Document not found or auth code does not match" });
      }

      const tamperDetected = letter.authCode !== recomputedAuth;

      res.json({
        employeeName: letter.employeeName,
        templateType: letter.templateType,
        designation: letter.designation,
        department: letter.department,
        startDate: letter.startDate,
        endDate: letter.endDate,
        issueDate: letter.issueDate,
        referenceNumber: letter.referenceNumber,
        status: letter.status,
        verified: !tamperDetected,
        ...(tamperDetected ? { warning: "Document content may have been modified after issuance" } : {}),
      });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // ==========================================
  // SHIFT SYSTEM ROUTES
  // ==========================================

  // Helper: parse "HH:MM" to minutes from midnight
  function parseTimeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  // Helper: format minutes from midnight to "HH:MM" (handles >24h cross-midnight)
  function formatMinutesToTime(mins: number): string {
    const m = ((mins % 1440) + 1440) % 1440;
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  // GET /api/hr/my-shift — returns logged-in employee's shift + DST-resolved timing + upcoming DST transition
  app.get("/api/hr/my-shift", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(Date.now() + IST_OFFSET_MS);
      const todayStr = istDate.toISOString().slice(0, 10);
      const year = parseInt(todayStr.slice(0, 4), 10);

      const userRows = await db.execute(sql`
        SELECT shift_id FROM admin_users WHERE id = ${userId} LIMIT 1
      `);
      if (userRows.rows.length === 0 || !(userRows.rows[0] as any).shift_id) {
        return res.json(null);
      }
      const shiftId = (userRows.rows[0] as any).shift_id as string;

      const dstRows = await db.execute(sql`
        SELECT spring_forward_date, fall_back_date FROM dst_config WHERE year = ${year} LIMIT 1
      `);
      let isDst = false;
      let springForwardDate: string | null = null;
      let fallBackDate: string | null = null;
      if (dstRows.rows.length > 0) {
        const dr = dstRows.rows[0] as { spring_forward_date: string; fall_back_date: string };
        springForwardDate = dr.spring_forward_date;
        fallBackDate = dr.fall_back_date;
        isDst = todayStr >= dr.spring_forward_date && todayStr < dr.fall_back_date;
      }

      const shiftRows = await db.execute(sql`
        SELECT id, name, display_label, us_coverage, us_coverage_dst, us_coverage_std,
               ist_start_dst, ist_end_dst, ist_start_std, ist_end_std, scheduled_hours
        FROM shifts WHERE id = ${shiftId} AND is_active = true LIMIT 1
      `);
      if (shiftRows.rows.length === 0) return res.json(null);
      const s = shiftRows.rows[0] as any;

      const istStart = isDst ? s.ist_start_dst : s.ist_start_std;
      const istEnd = isDst ? s.ist_end_dst : s.ist_end_std;

      // Check for DST transition within the next 14 days
      let dstTransition: { date: string; newStart: string; newEnd: string } | null = null;
      if (springForwardDate || fallBackDate) {
        const todayMs = istDate.setHours(0, 0, 0, 0);
        const in14Days = new Date(todayMs + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (springForwardDate && springForwardDate > todayStr && springForwardDate <= in14Days) {
          dstTransition = { date: springForwardDate, newStart: s.ist_start_dst, newEnd: s.ist_end_dst };
        } else if (fallBackDate && fallBackDate > todayStr && fallBackDate <= in14Days) {
          dstTransition = { date: fallBackDate, newStart: s.ist_start_std, newEnd: s.ist_end_std };
        }
      }

      res.json({
        id: s.id,
        name: s.name,
        displayLabel: s.display_label,
        usCoverage: s.us_coverage,
        usCoverageDst: s.us_coverage_dst ?? null,
        usCoverageStd: s.us_coverage_std ?? null,
        istStart,
        istEnd,
        isDst,
        scheduledHours: s.scheduled_hours,
        dstTransition,
      });
    } catch (error) {
      console.error("Get my-shift error:", error);
      res.status(500).json({ error: "Failed to fetch shift" });
    }
  });

  app.get("/api/hr/shifts", requireAuth, async (req, res) => {
    try {
      const shifts = await getAllShiftsWithTiming();
      res.json(shifts);
    } catch (error) {
      console.error("Get shifts error:", error);
      res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });

  app.patch("/api/hr/my-shift", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { shiftId, reason } = req.body;
      if (!shiftId || typeof shiftId !== "string") {
        return res.status(400).json({ error: "shiftId is required" });
      }

      const shiftRows = await db.execute(sql`SELECT id FROM shifts WHERE id = ${shiftId} AND is_active = true LIMIT 1`);
      if (shiftRows.rows.length === 0) {
        return res.status(400).json({ error: "Invalid or inactive shift" });
      }

      const userRows = await db.execute(sql`SELECT shift_id FROM admin_users WHERE id = ${userId} LIMIT 1`);
      const oldShiftId = userRows.rows.length > 0 ? ((userRows.rows[0] as any).shift_id as string | null) : null;

      await db.execute(sql`UPDATE admin_users SET shift_id = ${shiftId}, updated_at = NOW() WHERE id = ${userId}`);

      const trimmedReason = reason && reason.trim() ? reason.trim() : "Self-selected";
      await db.execute(sql`
        INSERT INTO shift_assignment_log (user_id, changed_by_id, old_shift_id, new_shift_id, reason)
        VALUES (${userId}, ${userId}, ${oldShiftId}, ${shiftId}, ${trimmedReason})
      `);

      await storage.createAuditLog({
        actorId: userId,
        targetId: userId,
        action: "shift_assignment",
        changes: { oldShiftId, newShiftId: shiftId, reason: trimmedReason, selfAssigned: true },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Update my-shift error:", error);
      res.status(500).json({ error: "Failed to update shift" });
    }
  });

  app.get("/api/hr/my-shift-history", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const rows = await db.execute(sql`
        SELECT
          sal.id,
          sal.user_id,
          sal.changed_at,
          sal.reason,
          sal.old_shift_id,
          sal.new_shift_id,
          cb.first_name || ' ' || cb.last_name AS changed_by_name,
          cb.email AS changed_by_email,
          os.display_label AS old_shift_label,
          ns.display_label AS new_shift_label
        FROM shift_assignment_log sal
        JOIN admin_users cb ON cb.id = sal.changed_by_id
        LEFT JOIN shifts os ON os.id = sal.old_shift_id
        LEFT JOIN shifts ns ON ns.id = sal.new_shift_id
        WHERE sal.user_id = ${userId}
        ORDER BY sal.changed_at DESC
      `);
      res.json(rows.rows);
    } catch (error) {
      console.error("Get my shift history error:", error);
      res.status(500).json({ error: "Failed to fetch shift history" });
    }
  });

  // Update grace period minutes for a shift
  app.patch("/api/hr/admin/shifts/:id/grace-period", requirePermission("hr.admin.shifts.gracePeriod", "hr", "admin", "super_admin"), async (req, res) => {
    try {
      const { gracePeriodMinutes } = req.body;
      const val = parseInt(gracePeriodMinutes, 10);
      if (isNaN(val) || val < 0 || val > 120) {
        return res.status(400).json({ error: "gracePeriodMinutes must be an integer between 0 and 120" });
      }
      await db.execute(sql`
        UPDATE shifts SET grace_period_minutes = ${val} WHERE id = ${req.params.id} AND is_active = true
      `);
      const updated = await db.execute(sql`
        SELECT id, name, display_label, scheduled_hours, grace_period_minutes
        FROM shifts WHERE id = ${req.params.id} LIMIT 1
      `);
      if (updated.rows.length === 0) return res.status(404).json({ error: "Shift not found" });
      res.json(updated.rows[0]);
    } catch (error) {
      console.error("Update shift grace period error:", error);
      res.status(500).json({ error: "Failed to update grace period" });
    }
  });

  app.get("/api/hr/shifts/current-timing/:shiftId", requirePermission("hr.shifts.currentTiming", "hr", "manager"), async (req, res) => {
    try {
      const timing = await getCurrentShiftTiming(req.params.shiftId);
      if (!timing) return res.status(404).json({ error: "Shift not found" });
      res.json(timing);
    } catch (error) {
      console.error("Get shift timing error:", error);
      res.status(500).json({ error: "Failed to fetch shift timing" });
    }
  });

  app.patch("/api/hr/users/:id/shift", requirePermission("hr.users.shift", "hr"), async (req, res) => {
    try {
      const { shiftId, reason } = req.body;
      if (!shiftId || typeof shiftId !== "string") {
        return res.status(400).json({ error: "shiftId is required" });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: "reason is required" });
      }

      const user = await storage.getAdminUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const allShifts = await db.execute(sql`SELECT id FROM shifts WHERE id = ${shiftId} AND is_active = true LIMIT 1`);
      if (allShifts.rows.length === 0) {
        return res.status(400).json({ error: "Invalid shift ID" });
      }

      const typedUser = user as AdminUser & { shiftId?: string | null };
      const oldShiftId = typedUser.shiftId || null;

      await db.execute(sql`UPDATE admin_users SET shift_id = ${shiftId}, updated_at = NOW() WHERE id = ${req.params.id}`);

      await db.execute(sql`
        INSERT INTO shift_assignment_log (user_id, changed_by_id, old_shift_id, new_shift_id, reason)
        VALUES (${req.params.id}, ${req.session.userId!}, ${oldShiftId}, ${shiftId}, ${reason.trim()})
      `);

      await storage.createAuditLog({
        actorId: req.session.userId!,
        targetId: req.params.id,
        action: "shift_assignment",
        changes: { oldShiftId, newShiftId: shiftId, reason: reason.trim() },
      });

      const updatedUser = await storage.getAdminUser(req.params.id);
      res.json(updatedUser);
    } catch (error) {
      console.error("Update shift error:", error);
      res.status(500).json({ error: "Failed to update shift" });
    }
  });

  app.get("/api/hr/users/:id/shift-history", requirePermission("hr.users.shiftHistory", "hr", "manager"), async (req, res) => {
    try {
      const hasAccess = await validateMyTeamAccess(req, res, req.params.id);
      if (!hasAccess) return;
      const rows = await db.execute(sql`
        SELECT
          sal.id,
          sal.user_id,
          sal.changed_at,
          sal.reason,
          sal.old_shift_id,
          sal.new_shift_id,
          cb.first_name || ' ' || cb.last_name AS changed_by_name,
          cb.email AS changed_by_email,
          os.display_label AS old_shift_label,
          ns.display_label AS new_shift_label
        FROM shift_assignment_log sal
        JOIN admin_users cb ON cb.id = sal.changed_by_id
        LEFT JOIN shifts os ON os.id = sal.old_shift_id
        LEFT JOIN shifts ns ON ns.id = sal.new_shift_id
        WHERE sal.user_id = ${req.params.id}
        ORDER BY sal.changed_at DESC
      `);
      res.json(rows.rows);
    } catch (error) {
      console.error("Get shift history error:", error);
      res.status(500).json({ error: "Failed to fetch shift history" });
    }
  });

  // ==========================================
  // POLICY ACKNOWLEDGEMENTS (attendance regularization)
  // ==========================================

  app.get("/api/hr/policy-acknowledgements/status", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const versionSetting = await storage.getSystemSetting("regularization_policy_version");
      const currentVersion = versionSetting ? String(versionSetting.value) : "2";
      const rows = await db.select().from(policyAcknowledgements)
        .where(and(
          eq(policyAcknowledgements.userId, userId),
          eq(policyAcknowledgements.policyType, "attendance_regularization"),
          eq(policyAcknowledgements.policyVersion, currentVersion)
        ));
      res.json({ accepted: rows.length > 0, policyVersion: currentVersion });
    } catch (error) {
      console.error("Policy acknowledgement status error:", error);
      res.status(500).json({ error: "Failed to fetch policy status" });
    }
  });

  app.post("/api/hr/policy-acknowledgements", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const versionSetting = await storage.getSystemSetting("regularization_policy_version");
      const currentVersion = versionSetting ? String(versionSetting.value) : "2";
      const existing = await db.select().from(policyAcknowledgements)
        .where(and(
          eq(policyAcknowledgements.userId, userId),
          eq(policyAcknowledgements.policyType, "attendance_regularization"),
          eq(policyAcknowledgements.policyVersion, currentVersion)
        ));
      if (existing.length === 0) {
        await db.insert(policyAcknowledgements).values({
          userId,
          policyType: "attendance_regularization",
          policyVersion: currentVersion,
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Policy acknowledgement record error:", error);
      res.status(500).json({ error: "Failed to record acknowledgement" });
    }
  });

  app.get("/api/hr/policy-acknowledgements", requirePermission("hr.policyAcknowledgements", "hr", "manager"), async (req, res) => {
    try {
      const rows = await db.select({
        id: policyAcknowledgements.id,
        userId: policyAcknowledgements.userId,
        policyType: policyAcknowledgements.policyType,
        policyVersion: policyAcknowledgements.policyVersion,
        acceptedAt: policyAcknowledgements.acceptedAt,
      }).from(policyAcknowledgements).orderBy(desc(policyAcknowledgements.acceptedAt));
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch acknowledgements" });
    }
  });

  // ==========================================
  // ANNOUNCEMENTS — employee-facing
  // ==========================================

  app.get("/api/hr/announcements/status", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const [versionSetting, contentSetting] = await Promise.all([
        storage.getSystemSetting("app_announcement_version"),
        storage.getSystemSetting("app_announcement_content"),
      ]);
      const currentVersion = versionSetting ? String(versionSetting.value) : "2024-06";
      const content = contentSetting?.value ?? null;

      const rows = await db.select().from(policyAcknowledgements)
        .where(and(
          eq(policyAcknowledgements.userId, userId),
          eq(policyAcknowledgements.policyType, "app_announcement"),
          eq(policyAcknowledgements.policyVersion, currentVersion)
        ));

      res.json({ hasNew: rows.length === 0, version: currentVersion, content });
    } catch (error) {
      console.error("Announcement status error:", error);
      res.status(500).json({ error: "Failed to fetch announcement status" });
    }
  });

  app.post("/api/hr/announcements/dismiss", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const versionSetting = await storage.getSystemSetting("app_announcement_version");
      const currentVersion = versionSetting ? String(versionSetting.value) : "2024-06";
      const existing = await db.select().from(policyAcknowledgements)
        .where(and(
          eq(policyAcknowledgements.userId, userId),
          eq(policyAcknowledgements.policyType, "app_announcement"),
          eq(policyAcknowledgements.policyVersion, currentVersion)
        ));
      if (existing.length === 0) {
        await db.insert(policyAcknowledgements).values({
          userId,
          policyType: "app_announcement",
          policyVersion: currentVersion,
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Announcement dismiss error:", error);
      res.status(500).json({ error: "Failed to dismiss announcement" });
    }
  });

  // ==========================================
  // ANNOUNCEMENTS — admin management
  // ==========================================

  app.get("/api/admin/announcements", requirePermission("admin.announcements", "hr", "admin", "super_admin"), async (req, res) => {
    try {
      const [versionSetting, contentSetting, lastSentSetting] = await Promise.all([
        storage.getSystemSetting("app_announcement_version"),
        storage.getSystemSetting("app_announcement_content"),
        storage.getSystemSetting("app_announcement_last_sent"),
      ]);
      res.json({
        version: versionSetting?.value ?? "2024-06",
        content: contentSetting?.value ?? null,
        lastSent: lastSentSetting?.value ?? null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch announcement settings" });
    }
  });

  app.patch("/api/admin/announcements", requirePermission("admin.announcements", "hr", "admin", "super_admin"), async (req, res) => {
    try {
      const { version, content } = req.body;
      const adminId = req.session.userId!;
      if (version !== undefined) {
        await storage.upsertSystemSetting("app_announcement_version", version, adminId);
      }
      if (content !== undefined) {
        await storage.upsertSystemSetting("app_announcement_content", content, adminId);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Announcement update error:", error);
      res.status(500).json({ error: "Failed to update announcement" });
    }
  });

  app.get("/api/admin/announcements/recipient-count", requirePermission("admin.announcements.recipientCount", "hr", "admin", "super_admin"), async (req, res) => {
    try {
      const allActive = await storage.getAllActiveEmployees();
      const targetRoles = ["employee", "manager", "recruiter", "operations", "finance"];
      const recipients = allActive.filter(u => targetRoles.includes(u.role || ""));
      res.json({ count: recipients.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to get recipient count" });
    }
  });

  app.post("/api/admin/announcements/send-email", requirePermission("admin.announcements.sendEmail", "hr", "admin", "super_admin"), async (req, res) => {
    try {
      const adminId = req.session.userId!;
      const featureFlags = await (async () => {
        const setting = await storage.getSystemSetting("feature_flags");
        return (setting?.value as Record<string, boolean>) || {};
      })();

      if (!featureFlags.notifications_enabled) {
        return res.status(403).json({ error: "Email notifications are disabled. Enable the notifications feature flag first." });
      }

      const contentSetting = await storage.getSystemSetting("app_announcement_content");
      if (!contentSetting?.value) {
        return res.status(400).json({ error: "No announcement content configured" });
      }

      const allActive = await storage.getAllActiveEmployees();
      const targetRoles = ["employee", "manager", "recruiter", "operations", "finance"];
      const recipients = allActive.filter(u => targetRoles.includes(u.role || "")).map(u => ({
        email: u.email,
        firstName: u.firstName,
      }));

      if (recipients.length === 0) {
        return res.status(400).json({ error: "No eligible recipients found" });
      }

      const { sendWhatsNewEmail } = await import("./email");
      const result = await sendWhatsNewEmail({
        employees: recipients,
        content: contentSetting.value as any,
      });

      await storage.upsertSystemSetting("app_announcement_last_sent", {
        sentAt: new Date().toISOString(),
        recipientCount: result.sent,
        failedCount: result.failed,
        sentBy: adminId,
      }, adminId);

      res.json({ success: true, sent: result.sent, failed: result.failed });
    } catch (error: any) {
      console.error("Announcement email blast error:", error);
      res.status(500).json({ error: "Failed to send announcement emails" });
    }
  });

  registerOnboardingRoutes(app);
  registerPerformanceRoutes(app);
  registerContractRoutes(app);
  registerPraiseRoutes(app);
  registerPolicySigningRoutes(app);
  registerAttendanceReportRoutes(app);
  registerReleaseNotesRoutes(app);
  registerHelpDeskRoutes(app);
  registerSalaryAdvanceRoutes(app);
  registerAttendanceExceptionRoutes(app);
  registerTravelRoutes(app);
  registerTrainingCatalogRoutes(app);

  // Seed badge types on startup (idempotent)
  seedPraiseBadgeTypes().catch(console.error);

  return httpServer;
}
