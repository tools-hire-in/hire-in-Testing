import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertContactSchema, insertApplicationSchema, insertJobSchema, insertAdminUserSchema, insertHolidaySchema, insertLeaveTypeSchema, insertLeaveRequestSchema, insertTicketSchema, insertLetterTemplateSentenceSchema, type AdminUser, type InsertHrLetter, type Attendance, trackAssignments, trainingExtensionRequests, learningTracks, breakRecords, attendance, attendanceRegularizations, hrLetters, offerLetters, leaveBalances, leaveAdjustments, leaveTypes, leaveRequests, leaveAccruals, holidays, nightShiftConsents, trackCompletions, trackSections, sectionProgress, departments, shifts, salaryReportRuns, salarySlips, policyAcknowledgements } from "@shared/schema";
import { PERFORMANCE_BAND_SENTENCES, CONDUCT_BAND_SENTENCES, COMPLETION_BAND_SENTENCES, TEMPLATE_PREFIX_MAP as SHARED_TEMPLATE_PREFIX_MAP } from "@shared/hrLetterConstants";
import { companyProfileSchema, mergeCompanyProfile } from "@shared/companyProfile";
import { INDUSTRY_SPECIALTY_MAP } from "@shared/industryMap";
import { db } from "./db";
import { eq, and, inArray, sql, desc, isNull, or } from "drizzle-orm";
import { getCurrentShiftTiming, getAllShiftsWithTiming } from "./shiftUtils";
import { setupSession, requireAuth as requireAuthImported, requireRole as requireRoleAuth, require2FA } from "./auth";
import { registerAuthRoutes } from "./authRoutes";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage/routes";
import { sendInvitationEmail, sendWelcomeEmail, sendSalaryReport, sendDocumentReminderEmail, sendOfferLetterEmail, sendOnboardingWelcomeEmail, sendRayoAcademyCredentialsEmail, sendHrLetterEmail, sendAddendumEmail, sendAddendumAcceptedEmail, sendOfferLetterPendingApprovalEmail, sendOfferLetterApprovalDecisionEmail, sendLeaveAppliedEmail, sendLeaveDecisionEmail, type SalaryReportAdjustment } from "./email";
import { generateMonthlySalaryReport } from "./salaryReport";
import crypto from "crypto";
import path from "path";
import { signHrLetter as _signHrLetter, signOfferLetterAcceptance as _signOfferLetterAcceptance } from "./documentSigningService";
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
import { registerOnboardingRoutes } from "./onboardingRoutes";
import { registerPerformanceRoutes } from "./performanceRoutes";
import { registerContractRoutes } from "./contractRoutes";
import { registerPraiseRoutes, seedPraiseBadgeTypes } from "./praiseRoutes";
import { registerPolicySigningRoutes } from "./policySigningRoutes";
import { registerAttendanceReportRoutes } from "./attendanceReportRoutes";
import { provisionRayoUser, isRayoEnabled } from "./rayoAcademyClient";

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

// Role-based middleware - allows specific roles plus super_admin and admin
// super_admin and admin automatically have access to all admin routes
function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const userRole = req.session.role;
    // Super admin and admin always have access to everything
    if (userRole === "super_admin" || userRole === "admin") {
      return next();
    }
    // Check if user's role is in the allowed roles
    if (allowedRoles.includes(userRole!)) {
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
  app.get("/api/admin/jobs", requireRole("operations", "recruiter", "manager"), async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.post("/api/admin/jobs", requireRole("operations", "recruiter", "manager"), async (req, res) => {
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

  app.patch("/api/admin/jobs/:id", requireRole("operations", "recruiter", "manager"), async (req, res) => {
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

  app.delete("/api/admin/jobs/:id", requireRole("operations", "recruiter", "manager"), async (req, res) => {
    try {
      const jobId = req.params.id as string;
      await storage.deleteJob(jobId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // Bulk delete jobs
  app.post("/api/admin/jobs/bulk-delete", requireRole("operations", "recruiter", "manager"), async (req, res) => {
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
  app.post("/api/admin/jobs/bulk-update", requireRole("operations", "recruiter", "manager"), async (req, res) => {
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
  app.post("/api/admin/jobs/sync-ceipal", requireRole("operations", "recruiter", "manager"), async (req, res) => {
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
  app.post("/api/admin/jobs/upload", requireRole("operations", "recruiter", "manager"), upload.single("file"), async (req, res) => {
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

  app.patch("/api/admin/applications/:id", requireRole("hr", "operations", "recruiter", "manager"), async (req, res) => {
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

  app.post("/api/admin/applications/:id/retry-ceipal", requireRole("hr", "operations", "recruiter", "manager"), async (req, res) => {
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

  app.patch("/api/admin/contacts/:id", requireRole("hr", "operations", "recruiter", "manager"), async (req, res) => {
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
  app.post("/api/admin/users", requireRole("admin", "manager", "hr"), async (req, res) => {
    try {
      const actorRole = req.session.role!;
      const actorRank = ROLE_RANK[actorRole] ?? 0;
      const { email, role, firstName, lastName, password, joiningDate, designation, departmentId, hierarchyLevel, salary, managerId } = req.body;

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
  app.post("/api/admin/users/bulk-upload", requireRole("admin", "manager"), upload.single("file"), async (req, res) => {
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

  app.patch("/api/admin/users/:id", requireRole("admin", "manager", "hr"), async (req, res) => {
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

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.post("/api/admin/users/:id/resend-invite", requireRole("admin", "manager"), async (req, res) => {
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

  app.delete("/api/admin/users/:id", requireRole("super_admin"), async (req, res) => {
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

  app.patch("/api/admin/users/:id/employment-status", requireRole("super_admin", "admin", "manager"), async (req, res) => {
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

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employment status" });
    }
  });

  app.post("/api/admin/users/:id/restore", requireRole("super_admin", "admin"), async (req, res) => {
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

  app.get("/api/admin/employees/:userId/dossier", requireRole("hr"), async (req, res) => {
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

  app.post("/api/departments", requireRole("hr"), async (req, res) => {
    try {
      const dept = await storage.createDepartment(req.body);
      res.status(201).json(dept);
    } catch (error) {
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", requireRole("hr"), async (req, res) => {
    try {
      const dept = await storage.updateDepartment(req.params.id as string, req.body);
      if (!dept) return res.status(404).json({ error: "Department not found" });
      res.json(dept);
    } catch (error) {
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", requireRole("super_admin"), async (req, res) => {
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

  app.patch("/api/admin/users/:id/hierarchy", requireRole("hr", "admin", "manager"), async (req, res) => {
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

  app.get("/api/admin/audit-logs", requireRole("admin"), async (req, res) => {
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
  app.get("/api/hr/users", requireRole("hr"), async (req, res) => {
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
      const presentRecords = monthRecords.filter(r => ["present", "late", "half_day"].includes(r.status));
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

  app.post("/api/hr/holidays", requireRole("hr"), async (req, res) => {
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

  app.post("/api/hr/holidays/upload", requireRole("hr"), upload.single("file"), async (req, res) => {
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

  app.patch("/api/hr/holidays/:id", requireRole("hr"), async (req, res) => {
    try {
      const holiday = await storage.updateHoliday(req.params.id as string, req.body);
      if (!holiday) return res.status(404).json({ error: "Holiday not found" });
      res.json(holiday);
    } catch (error) {
      res.status(500).json({ error: "Failed to update holiday" });
    }
  });

  app.delete("/api/hr/holidays/:id", requireRole("hr"), async (req, res) => {
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
        if (!existing.punchIn && existing.status === "absent" && existing.notes?.includes("[Training non-compliance]")) {
          // Determine late/present status for this corrected punch-in
          const punchInTime = new Date();
          let punchStatus: "present" | "late" = "present";
          let noteStr: string | null = null;
          const typedUser2 = currentUser as AdminUser & { shiftId?: string | null };
          if (typedUser2.shiftId) {
            try {
              const { computeLateStatus } = await import("./attendancePolicy");
              const result = await computeLateStatus(typedUser2.shiftId, punchInTime);
              if (result) {
                punchStatus = result.status;
                noteStr = result.notes;
              }
            } catch (policyErr) {
              console.error("[punch-in correction] Late-status computation failed:", policyErr);
            }
          }
          const record = await storage.updateAttendance(existing.id, {
            punchIn: punchInTime,
            status: punchStatus,
            notes: noteStr,
          });
          return res.status(200).json(record);
        }
        return res.status(400).json({ error: "Already punched in today" });
      }

      // Determine if punch-in is late (after shift start + grace period)
      const punchInTime = new Date();
      let punchStatus: "present" | "late" = "present";
      let graceNote: string | null = null;
      const typedUserForShift = currentUser as AdminUser & { shiftId?: string | null };
      if (typedUserForShift.shiftId) {
        try {
          const { computeLateStatus } = await import("./attendancePolicy");
          const result = await computeLateStatus(typedUserForShift.shiftId, punchInTime);
          if (result) {
            punchStatus = result.status;
            graceNote = result.notes;
          }
        } catch (policyErr) {
          console.error("[punch-in] Late-status computation failed:", policyErr);
        }
      }

      const record = await storage.createAttendance({
        userId,
        date: today,
        punchIn: punchInTime,
        status: punchStatus,
        notes: graceNote,
      });
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

      const existing = await storage.getTodayAttendance(userId);
      if (!existing) {
        return res.status(400).json({ error: "No punch-in record found for today" });
      }
      if (existing.punchOut) {
        return res.status(400).json({ error: "Already punched out today" });
      }
      const punchOut = new Date();
      const punchIn = existing.punchIn ? new Date(existing.punchIn) : punchOut;
      const diffMs = punchOut.getTime() - punchIn.getTime();
      const totalHoursNum = diffMs / (1000 * 60 * 60);
      const totalHours = totalHoursNum.toFixed(2);

      // Auto half-day detection: if worked hours < half of scheduled hours
      const currentStatus = existing.status as string;
      let updatedStatus: string | undefined;
      let halfDayNote: string | undefined;
      const typedUserOut = await storage.getAdminUser(userId) as AdminUser & { shiftId?: string | null };
      if (typedUserOut?.shiftId) {
        try {
          const { computeHalfDayStatus } = await import("./attendancePolicy");
          const result = await computeHalfDayStatus(typedUserOut.shiftId, totalHoursNum, currentStatus);
          if (result.status !== currentStatus) {
            updatedStatus = result.status;
            halfDayNote = result.notes;
          }
        } catch (policyErr) {
          console.error("[punch-out] Half-day computation failed:", policyErr);
        }
      }

      const updatePayload: Partial<typeof existing> & { punchOut: Date; totalHours: string; status?: string; notes?: string } = { punchOut, totalHours };
      if (updatedStatus) {
        updatePayload.status = updatedStatus;
        const existingNotes = existing.notes ? `${existing.notes}; ` : "";
        updatePayload.notes = existingNotes + halfDayNote;
      }

      const record = await storage.updateAttendance(existing.id, updatePayload);
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
        tea1WindowStart: string;
        tea1WindowEnd: string;
        lunchWindowStart: string;
        lunchWindowEnd: string;
        tea2WindowStart: string;
        tea2WindowEnd: string;
      } | null = null;

      const userShiftRow = await db.execute(sql`
        SELECT u.shift_id, s.name, s.ist_start_dst, s.ist_end_dst, s.ist_start_std, s.ist_end_std, s.scheduled_hours
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

  app.get("/api/hr/attendance/breaks/team-status", requireRole("hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
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

  app.get("/api/hr/attendance/team", requireRole("hr"), async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const records = await storage.getAttendanceByDate(date);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team attendance" });
    }
  });

  app.patch("/api/hr/attendance/:id", requireRole("hr", "admin", "super_admin", "manager"), async (req, res) => {
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
      res.status(500).json({ error: "Failed to update attendance" });
    }
  });

  // --- Admin Correction Upsert (absent days + existing records) ---
  app.post("/api/hr/attendance/admin-correction", requireRole("hr", "manager", "admin", "super_admin"), async (req, res) => {
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
  app.get("/api/hr/attendance/corrections-summary", requireRole("admin", "super_admin", "hr", "operations", "manager"), async (req, res) => {
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

  app.post("/api/hr/leave-types", requireRole("hr"), async (req, res) => {
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

  app.patch("/api/hr/leave-types/:id", requireRole("hr"), async (req, res) => {
    try {
      const lt = await storage.updateLeaveType(req.params.id as string, req.body);
      if (!lt) return res.status(404).json({ error: "Leave type not found" });
      res.json(lt);
    } catch (error) {
      res.status(500).json({ error: "Failed to update leave type" });
    }
  });

  app.delete("/api/hr/leave-types/:id", requireRole("hr"), async (req, res) => {
    try {
      await storage.deleteLeaveType(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete leave type" });
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

  app.get("/api/hr/leave-balances/:userId", requireRole("hr"), async (req, res) => {
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

  app.patch("/api/hr/leave-balances/:id", requireRole("hr"), async (req, res) => {
    try {
      const lb = await storage.updateLeaveBalance(req.params.id as string, req.body);
      if (!lb) return res.status(404).json({ error: "Leave balance not found" });
      res.json(lb);
    } catch (error) {
      res.status(500).json({ error: "Failed to update leave balance" });
    }
  });

  app.post("/api/hr/leave-accruals/run", requireRole("hr"), async (req, res) => {
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

  app.post("/api/hr/leave-accruals/year-end", requireRole("hr"), async (req, res) => {
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
              // Mirror in leave_accruals as hr_adjustment (survives future recalculations)
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
              }).onConflictDoUpdate({
                target: [leaveAccruals.userId, leaveAccruals.leaveTypeId, leaveAccruals.year, leaveAccruals.month, leaveAccruals.accrualType],
                set: {
                  accruedDays: sql`leave_accruals.accrued_days + EXCLUDED.accrued_days`,
                  skipReason: sql`EXCLUDED.skip_reason`,
                },
              });
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
              }).onConflictDoUpdate({
                target: [leaveAccruals.userId, leaveAccruals.leaveTypeId, leaveAccruals.year, leaveAccruals.month, leaveAccruals.accrualType],
                set: {
                  accruedDays: sql`leave_accruals.accrued_days + EXCLUDED.accrued_days`,
                  skipReason: sql`EXCLUDED.skip_reason`,
                },
              });
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

  app.get("/api/hr/leave-accruals/run-log", requireRole("hr"), async (req, res) => {
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

  app.get("/api/hr/leave-requests", requireRole("hr"), async (req, res) => {
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

  app.patch("/api/hr/leave-requests/:id/review", requireRole("hr", "manager"), async (req, res) => {
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

      const lr = await storage.updateLeaveRequest(req.params.id as string, {
        status,
        reviewComment,
        reviewedBy: req.session.userId!,
        reviewedAt: new Date(),
      });
      if (!lr) return res.status(404).json({ error: "Leave request not found" });

      if (status === "approved") {
        const year = parseInt(lr.startDate.split("-")[0]);
        const balances = await storage.getLeaveBalances(lr.userId, year);
        const balance = balances.find(b => b.leaveTypeId === lr.leaveTypeId);
        if (balance) {
          // For split-leave: deduct only the paid portion (splitPaidDays) from this leave type's balance.
          // The LWP portion (splitLwpDays) does not come from any balance — it is unpaid.
          const paidPortion = lr.splitPaidDays != null
            ? parseFloat(lr.splitPaidDays)
            : parseFloat(lr.totalDays || "0");
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

  app.get("/api/hr/tickets", requireRole("hr"), async (req, res) => {
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

  app.patch("/api/hr/tickets/:id/review", requireRole("hr"), async (req, res) => {
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
  app.get("/api/hr/attendance/grace-usage", requireRole("hr", "admin", "super_admin", "manager"), async (req, res) => {
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
      res.json({
        policyVersion: versionSetting ? String(versionSetting.value) : "2",
        monthEndBlackoutDays: blackoutSetting ? Number(blackoutSetting.value) : 3,
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
      const { attendanceDate, requestType, requestedPunchIn, requestedPunchOut, reason } = req.body;

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
      });

      await storage.createAuditLog({
        actorId: userId,
        targetId: userId,
        action: "regularization_submitted",
        changes: { attendanceDate, requestType, reason },
      });

      res.status(201).json(request);
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

      const enriched = requests.map(r => {
        const emp = userMap.get(r.employeeId);
        const reviewer = r.reviewedBy ? userMap.get(r.reviewedBy) : null;
        return {
          ...r,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          employeeCode: emp?.employeeId ?? null,
          reviewerName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null,
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
  app.patch("/api/hr/attendance/regularization/:id/review", requireRole("hr", "manager", "admin", "super_admin"), async (req, res) => {
    try {
      const actorId = req.session.userId!;
      const actorRole = req.session.role!;
      const { status, reviewerComment } = req.body;

      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
      }
      if (!reviewerComment || !reviewerComment.trim()) {
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

      const updated = await storage.updateRegularizationRequest(req.params.id, {
        status,
        reviewedBy: actorId,
        reviewerComment,
        reviewedAt: new Date(),
      });

      // On approval: apply attendance correction with fully recomputed derived fields
      if (status === "approved") {
        const punchIn = request.requestedPunchIn;
        const punchOut = request.requestedPunchOut;

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
            const { computeLateStatus, computeHalfDayStatus } = await import("./attendancePolicy");
            const lateResult = await computeLateStatus(empUser.shiftId, new Date(effectivePunchIn));
            if (lateResult) {
              const halfResult = totalHoursNum
                ? await computeHalfDayStatus(empUser.shiftId, parseFloat(totalHoursNum), lateResult.status)
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

      // Create in-app notification for employee
      const actorUser = await storage.getAdminUser(actorId);
      await storage.createNotification({
        userId: request.employeeId,
        type: "regularization_decision",
        title: status === "approved" ? "Regularization Approved" : "Regularization Rejected",
        message: `Your regularization request for ${request.attendanceDate} was ${status}. ${reviewerComment ? `Comment: ${reviewerComment}` : ""}`,
        isRead: false,
        metadata: { requestId: request.id, attendanceDate: request.attendanceDate, status, reviewerName: actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : null },
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
            status: status as "approved" | "rejected",
            reviewerName: actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : "HR",
            reviewerComment,
          }).catch(console.error);
        }
      } catch { /* non-critical */ }

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
          reviewerComment,
          requestedPunchIn: request.requestedPunchIn ?? null,
          requestedPunchOut: request.requestedPunchOut ?? null,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error("Regularization review error:", error);
      res.status(500).json({ error: "Failed to review request" });
    }
  });

  // HR/Admin direct override (bypasses request queue)
  app.post("/api/hr/attendance/regularization/override", requireRole("hr", "admin", "super_admin"), async (req, res) => {
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
          const { computeLateStatus: cls, computeHalfDayStatus: chs } = await import("./attendancePolicy");
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
  app.post("/api/hr/attendance/regularization/bulk-approve", requireRole("hr", "manager", "admin", "super_admin"), async (req, res) => {
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
              const { computeLateStatus, computeHalfDayStatus } = await import("./attendancePolicy");
              const lateResult = await computeLateStatus(empUser.shiftId, new Date(effectivePunchIn));
              if (lateResult) {
                const halfResult = totalHoursNum
                  ? await computeHalfDayStatus(empUser.shiftId, parseFloat(totalHoursNum), lateResult.status)
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
  app.get("/api/hr/attendance/absent-employees", requireRole("hr", "admin", "super_admin"), async (req, res) => {
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
  app.post("/api/hr/attendance/regularization/bulk-override", requireRole("hr", "admin", "super_admin"), async (req, res) => {
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
  app.get("/api/hr/reports/attendance", requireRole("hr"), async (req, res) => {
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
  app.get("/api/hr/attendance/my-team", requireRole("hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
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

  app.get("/api/hr/attendance/my-team/range", requireRole("hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
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

  app.get("/api/hr/attendance/member/:memberId/range", requireRole("hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
    try {
      const memberId = req.params.memberId;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const records = await storage.getAttendanceByUser(memberId, startDate, endDate);
      const member = await storage.getAdminUser(memberId);

      // Enrich corrected records with corrector name
      const correctorIds = [...new Set(records.filter(r => r.correctedById).map(r => r.correctedById!))];
      const correctorMap = new Map<string, string>();
      if (correctorIds.length > 0) {
        const correctors = await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
          .from(adminUsers).where(inArray(adminUsers.id, correctorIds));
        for (const c of correctors) correctorMap.set(c.id, `${c.firstName} ${c.lastName}`);
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
      res.status(500).json({ error: "Failed to fetch member attendance" });
    }
  });

  app.get("/api/hr/attendance/download", requireRole("hr", "manager", "operations", "admin", "super_admin"), async (req, res) => {
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
  app.get("/api/hr/leave-requests/my-team", requireRole("hr", "manager"), async (req, res) => {
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
  app.get("/api/hr/attendance-report/salary-gate-status", requireRole("hr", "admin", "super_admin"), async (req, res) => {
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

  app.get("/api/hr/reports/salary/preview", requireAuth, requireRole("super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
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
  app.get("/api/hr/reports/salary/recipients", requireAuth, requireRole("super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const setting = await storage.getSystemSetting("salary_report_recipients");
      const defaults = { to: ["accounts@hire-in.com"], cc: ["simranjeet@hire-in.com"] };
      res.json(setting?.value || defaults);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipients" });
    }
  });

  // Salary report recipients - Update
  app.put("/api/hr/reports/salary/recipients", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

      if (existing.length > 0) {
        await db.update(salaryReportRuns)
          .set({
            reportData: report.rows as any,
            adjustments: {} as any,
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
        adjustments: {} as any,
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

  app.get("/api/hr/reports/salary/download", requireAuth, requireRole("super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
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
  app.get("/api/hr/reports/salary/runs", requireAuth, requireRole("super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
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
  app.get("/api/hr/reports/salary/runs/:id", requireAuth, requireRole("super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
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
        const newNetPayable = Math.max(0, Math.round((gross - newDeductions) * 100) / 100);
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
        const net = Math.max(0, Math.round((gross - ded) * 100) / 100);
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

      const actorId = req.session.userId!;
      const rows = (run.reportData as any[]) || [];
      const adjustments = (run.adjustments as Record<string, SalaryReportAdjustment>) || {};

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
      const recipients = recipientsSetting?.value as { to: string[]; cc: string[] } | undefined;

      const emailResult = await sendSalaryReport({
        csvContent: csv,
        summary,
        recipients,
        adjustments,
        rows,
      });

      if (!emailResult.success) {
        return res.status(500).json({ error: "Email dispatch failed: " + emailResult.error });
      }

      const now = new Date();
      await db.update(salaryReportRuns)
        .set({ status: "approved", approvedAt: now, approvedBy: actorId, emailSentAt: now })
        .where(eq(salaryReportRuns.id, req.params.id));

      // Upsert adjusted salary_slips records
      const allUsers = await storage.getAdminUsers();
      const userEmailMap = new Map(allUsers.map(u => [u.email, u.id]));

      let upsertedCount = 0;
      for (const row of rows) {
        const adj = adjustments[row.email];
        if (!adj) continue;
        const userId = userEmailMap.get(row.email);
        if (!userId) continue;
        await db.delete(salarySlips).where(and(
          eq(salarySlips.userId, userId),
          eq(salarySlips.year, run.year),
          eq(salarySlips.month, run.month),
        ));
        await db.insert(salarySlips).values({
          userId,
          year: run.year,
          month: run.month,
          basicSalary: String(row.salary),
          grossSalary: String(row.grossSalary),
          deductions: String(row.deductions),
          netPayable: String(row.netPayable),
          totalWorkingDays: row.workingDays,
          daysPresent: row.presentDays,
          daysAbsent: row.absentDays,
          approvedLeaves: String(row.paidLeaves),
          lopLeaves: String(row.lopLeaves),
          totalHours: String(row.totalHours),
          attendancePercentage: String(row.attendancePercentage),
          generatedBy: actorId,
        });
        upsertedCount++;
      }

      await storage.createAuditLog({
        action: "salary_report_approved",
        actorId,
        changes: { runId: run.id, year: run.year, month: run.month, adjustedRows: Object.keys(adjustments).length, slipsUpserted: upsertedCount },
      });

      res.json({ success: true, adjustedRows: Object.keys(adjustments).length, slipsUpserted: upsertedCount });
    } catch (error) {
      console.error("Failed to approve salary run:", error);
      res.status(500).json({ error: "Failed to approve and send salary report" });
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

  app.post("/api/hr/salary-slips/generate", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
  app.post("/api/hr/salary-slips/regenerate", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

      let upsertedCount = 0;
      for (const slip of slipsToUpsert) {
        await storage.upsertSalarySlip(slip);
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

  app.post("/api/hr/leave-balances/adjust", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

  app.post("/api/hr/leave-balances/bulk-adjust", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

  app.get("/api/hr/leave-adjustments", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
  app.get("/api/hr/employee-documents/:userId", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const docs = await storage.getEmployeeDocuments(req.params.userId);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee documents" });
    }
  });

  app.patch("/api/hr/employee-documents/:id/verify", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

  app.get("/api/hr/document-compliance", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

  app.post("/api/hr/employee-documents/initialize/:userId", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

  app.patch("/api/hr/employee-documents/:id/toggle-required", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

  app.post("/api/hr/employee-documents/send-reminder/:userId", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
  app.get("/api/hr/employee-bank-details/:userId", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const details = await storage.getBankDetails(req.params.userId);
      res.json(details || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bank details" });
    }
  });

  // Employee emergency contacts (HR view)
  app.get("/api/hr/employee-emergency-contacts/:userId", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const contacts = await storage.getEmergencyContacts(req.params.userId);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch emergency contacts" });
    }
  });

  // HR Tools: Admin fetch salary slips for any user
  app.get("/api/hr/admin/salary-slips/:userId", requireAuth, requireRole("super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
    try {
      const slips = await storage.getSalarySlipsByUser(req.params.userId);
      res.json(slips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch salary slips" });
    }
  });

  app.get("/api/hr/admin/salary-slip/:id", requireAuth, requireRole("super_admin", "admin", "hr", "finance"), async (req: Request, res: Response) => {
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
  app.post("/api/hr/tools/generate-offer-letter", requireAuth, requireRole("super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
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
  app.post("/api/hr/tools/offer-letters", requireAuth, requireRole("super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const { candidateTitle, candidateName, candidatePersonalEmail, candidateAddress,
        designation, subjectDesignation, reportingToUserId, departmentId,
        employmentType, proposedStartDate, salary, salaryInWords,
        location, jurisdiction, hrManagerName, offerDate, ccEmails,
        probationSalary, probationSalaryInWords, postProbationSalary, postProbationSalaryInWords,
        probationPeriodMonths, extendedProbationMonths,
        performanceProbationReview, maxRevisionSalary, maxRevisionSalaryInWords,
        policyAnnexures, seedProbationPlan } = req.body;

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
          if (!ann.title || !ann.body) {
            return res.status(400).json({ error: "Each annexure must have a non-empty title and body." });
          }
        }
        offerAnnexures = rawOfferAnnexures.map((a: any) => ({ title: String(a.title), body: String(a.body) }));
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

  // List all offer letters
  app.get("/api/hr/tools/offer-letters", requireAuth, requireRole("super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
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
  app.patch("/api/hr/tools/offer-letters/:id/approve", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
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
  app.patch("/api/hr/tools/offer-letters/:id/reject", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
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

  app.get("/api/onboard/:token", async (req: Request, res: Response) => {
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

      const { acceptedName, acceptanceDate } = req.body;
      if (!acceptedName || acceptedName.trim().toLowerCase() !== letter.candidateName.trim().toLowerCase()) {
        return res.status(400).json({ error: `Please type your full name exactly as it appears on the offer: "${letter.candidateName}"` });
      }

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

      await storage.createAuditLog({
        action: "offer_letter_accepted",
        actorId: letter.createdBy,
        changes: { offerId: letter.id, candidateName: letter.candidateName, acceptedName: acceptedName.trim(), ip: clientIp, authCode },
      });

      // ── Seed a pending probation plan at offer acceptance ─────────────────
      if ((letter as any).seedProbationPlan) {
        try {
          const probationMonths: number = (letter as any).probationPeriodMonths || 3;
          const proposedStart: string = letter.proposedStartDate || new Date().toISOString().slice(0, 10);
          const endDate = new Date(proposedStart);
          endDate.setMonth(endDate.getMonth() + probationMonths);
          const endDateStr = endDate.toISOString().slice(0, 10);
          const durationDays = Math.round((endDate.getTime() - new Date(proposedStart).getTime()) / (1000 * 60 * 60 * 24));

          // Seed plan with NULL employee_id — filled in at onboarding
          await db.execute(sql`
            INSERT INTO employee_plans
              (offer_letter_id, employee_id, manager_id, plan_type, department_scope, status, start_date, end_date, duration_days, created_by)
            VALUES
              (${letter.id}, NULL, NULL, 'probation', 'healthcare', 'pending',
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
  app.post("/api/admin/offer-letters/:id/countersign", requireAuth, requireRole("hr", "super_admin", "admin"), async (req: Request, res: Response) => {
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
  // OFFER LETTER ADDENDUMS
  // ==========================================

  // List addendums for an offer letter
  app.get("/api/hr/tools/offer-letters/:offerId/addendums", requireAuth, requireRole("super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const addendums = await storage.getAddendumsForOffer(req.params.offerId);
      res.json(addendums);
    } catch (error) {
      console.error("List addendums error:", error);
      res.status(500).json({ error: "Failed to fetch addendums" });
    }
  });

  // Create addendum + send email
  app.post("/api/hr/tools/offer-letters/:offerId/addendums", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
      });

      await storage.updateAddendumStatus(addendum.id, { issuedAt: new Date() });

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

      res.json({ ...addendum, emailSent: emailResult.success });
    } catch (error: any) {
      console.error("Create addendum error:", error?.message || error);
      res.status(500).json({ error: "Failed to create addendum", detail: error?.message });
    }
  });

  // Download addendum DOCX
  app.get("/api/hr/tools/offer-letters/:offerId/addendums/:addendumId/download", requireAuth, requireRole("super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
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
  app.post("/api/hr/tools/offer-letters/:offerId/addendums/:addendumId/send", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
  app.post("/api/hr/tools/offer-letters/:offerId/addendums/:addendumId/cancel", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

  // Public: View addendum by token
  app.get("/api/addendum/:token", async (req: Request, res: Response) => {
    try {
      const addendum = await storage.getAddendumByToken(req.params.token);
      if (!addendum) {
        return res.status(404).json({ error: "Addendum not found" });
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
      const addendum = await storage.getAddendumByToken(req.params.token);
      if (!addendum) {
        return res.status(404).json({ error: "Addendum not found" });
      }
      if (addendum.status === "accepted" || addendum.status === "countersigned") {
        return res.status(400).json({ error: "This addendum has already been signed", status: addendum.status });
      }
      if (addendum.status === "cancelled") {
        return res.status(400).json({ error: "This addendum has been cancelled and is no longer available for signing" });
      }
      if (addendum.status !== "sent") {
        return res.status(400).json({ error: "This addendum is not yet available for signing" });
      }

      const { acceptedName } = req.body;
      if (!acceptedName || acceptedName.trim().toLowerCase() !== addendum.candidateName.trim().toLowerCase()) {
        return res.status(400).json({ error: `Please type your full name exactly as: "${addendum.candidateName}"` });
      }

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

      res.json({ success: true, authCode, documentHash });
    } catch (error) {
      console.error("Accept addendum error:", error);
      res.status(500).json({ error: "Failed to accept addendum" });
    }
  });

  // List standalone addendums
  app.get("/api/hr/tools/addendums/standalone", requireAuth, requireRole("super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
    try {
      const addendums = await storage.getStandaloneAddendums();
      res.json(addendums);
    } catch (error) {
      console.error("List standalone addendums error:", error);
      res.status(500).json({ error: "Failed to fetch standalone addendums" });
    }
  });

  // Create standalone addendum
  app.post("/api/hr/tools/addendums/standalone", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
          if (!ax.title?.trim() || !ax.body?.trim()) {
            return res.status(400).json({ error: "Each annexure must have a non-empty title and body." });
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
      } as any);

      await storage.updateAddendumStatus(addendum.id, { issuedAt: new Date() });

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

      res.json({ ...addendum, emailSent: emailResult.success });
    } catch (error: any) {
      console.error("Create standalone addendum error:", error?.message || error);
      res.status(500).json({ error: "Failed to create standalone addendum", detail: error?.message });
    }
  });

  // Preview standalone addendum DOCX — generates the document from form data without
  // saving to the database or sending any email. Used for "Preview before send" UX.
  app.post("/api/hr/tools/addendums/standalone/preview", requireAuth, requireRole("super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
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
  app.get("/api/hr/tools/addendums/:addendumId/download", requireAuth, requireRole("super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
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
  app.post("/api/hr/tools/addendums/:addendumId/cancel", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
  app.post("/api/hr/tools/addendums/:addendumId/send", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

      const emailResult = await sendAddendumEmail({
        to: toEmail,
        candidateName: addendum.candidateName,
        addendumType: addendum.addendumType,
        acceptUrl,
        cc: storedCcEmails.length > 0 ? storedCcEmails : undefined,
      });

      if (addendum.status === "draft") {
        await storage.updateAddendumStatus(addendum.id, { status: "sent" });
      }

      await storage.createAuditLog({
        action: "standalone_addendum_resent",
        actorId: req.session.userId!,
        changes: { addendumId: addendum.id, emailSent: emailResult.success },
      });

      res.json({ success: emailResult.success, error: emailResult.success ? undefined : emailResult.error });
    } catch (error: any) {
      console.error("Resend standalone addendum error:", error);
      res.status(500).json({ error: "Failed to resend addendum email" });
    }
  });

  // HR: Counter-sign addendum
  app.post("/api/hr/tools/addendums/:addendumId/countersign", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

      await storage.createAuditLog({
        action: "addendum_countersigned",
        actorId: req.session.userId!,
        changes: { addendumId: addendum.id, counterAuthCode },
      });

      res.json({ success: true, counterAuthCode });
    } catch (error) {
      console.error("Counter-sign addendum error:", error);
      res.status(500).json({ error: "Failed to counter-sign addendum" });
    }
  });

  // Start onboarding — creates employee profile
  app.post("/api/hr/tools/offer-letters/:id/start-onboarding", requireAuth, requireRole("super_admin", "admin", "hr", "manager"), async (req: Request, res: Response) => {
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
        salary: letter.salary || null,
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

      // ── Activate the pending probation plan seeded at offer acceptance ────
      if ((letter as any).seedProbationPlan) {
        try {
          // Find the pending plan created at offer acceptance (linked by offer_letter_id)
          const pendingPlanResult = await db.execute(sql`
            SELECT * FROM employee_plans
            WHERE offer_letter_id = ${letter.id} AND status = 'pending'
            LIMIT 1
          `);

          if (pendingPlanResult.rows.length > 0) {
            const pendingPlan = pendingPlanResult.rows[0] as any;
            const joiningDate: string = newUser.joiningDate || new Date().toISOString().slice(0, 10);
            const probationMonths: number = (letter as any).probationPeriodMonths || 3;
            const endDate = new Date(joiningDate);
            endDate.setMonth(endDate.getMonth() + probationMonths);
            const endDateStr = endDate.toISOString().slice(0, 10);
            const durationDays = Math.round((endDate.getTime() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24));

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

            // Seed template goals for this role/designation
            const roleSlug = (letter.designation || "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_|_$/g, "");

            const templates = await db.execute(sql`
              SELECT * FROM plan_goal_templates
              WHERE plan_type = 'probation'
                AND department_scope = 'healthcare'
                AND is_active = true
                AND (role_slug = ${roleSlug} OR role_slug = 'all')
              ORDER BY sort_order ASC
            `);

            for (const tpl of templates.rows as any[]) {
              await db.execute(sql`
                INSERT INTO performance_goals
                  (employee_id, plan_id, title, description, category, status, progress, auto_progress_from_milestones, source_ref)
                VALUES
                  (${newUser.id}, ${pendingPlan.id}, ${tpl.goal_title}, ${(tpl as any).goal_description ?? null},
                   ${(tpl as any).goal_category ?? "general"}, 'not_started', 0, true, 'seed')
              `);
            }

            // Generate Day 15/30/60/90 milestone check-ins from actual joining date
            const milestones = [15, 30, 60, 90].filter(d => d <= durationDays);
            for (const day of milestones) {
              const milestoneDate = new Date(joiningDate);
              milestoneDate.setDate(milestoneDate.getDate() + day);
              const milestoneDateStr = milestoneDate.toISOString().slice(0, 10);
              await db.execute(sql`
                INSERT INTO check_ins (employee_id, manager_id, plan_id, check_in_type, scheduled_date, status)
                VALUES (${newUser.id}, ${newUser.managerId ?? null}, ${pendingPlan.id}, 'milestone'::check_in_type, ${milestoneDateStr}, 'scheduled'::check_in_status)
              `);
            }

            await storage.createAuditLog({
              action: "probation_plan_activated",
              actorId,
              targetId: newUser.id,
              changes: { planId: pendingPlan.id, joiningDate, endDate: endDateStr, durationDays, roleSlug, goalsSeeded: templates.rows.length },
            });
          }
        } catch (planErr) {
          console.error("[Onboarding] Probation plan activation failed (non-fatal):", planErr);
        }
      }

      res.json({ success: true, userId: newUser.id, employeeId, rayoProvisioning });
    } catch (error: any) {
      console.error("Start onboarding error:", error);
      res.status(500).json({ error: error.message || "Failed to start onboarding" });
    }
  });

  // New Hire onboarding status — recent employees with setup checklist
  app.get("/api/hr/new-hire/onboarding-status", requireAuth, requireRole("super_admin", "admin", "hr", "operations", "manager"), async (req: Request, res: Response) => {
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
  app.post("/api/hr/tools/offer-letters/:id/cancel", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const letter = await storage.getOfferLetter(req.params.id);
      if (!letter) {
        return res.status(404).json({ error: "Offer letter not found" });
      }

      if (!["sent", "viewed"].includes(letter.status)) {
        return res.status(400).json({ error: `Cannot cancel — offer status is '${letter.status}'` });
      }

      await storage.updateOfferLetter(letter.id, { status: "cancelled" });

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

  // ==========================================
  // MY TEAM API ROUTES (with edit and audit trail)
  // ==========================================

  app.get("/api/admin/my-team", requireAuth, requireRole("super_admin", "admin", "hr", "operations", "manager"), async (req, res) => {
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

  app.patch("/api/admin/my-team/:userId/attendance/:attendanceId", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.patch("/api/admin/my-team/:userId/profile", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.post("/api/admin/my-team/:userId/regional-holidays", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.delete("/api/admin/my-team/:userId/regional-holidays/:selectionId", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.post("/api/admin/my-team/:userId/emergency-contacts", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.patch("/api/admin/my-team/:userId/emergency-contacts/:contactId", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.delete("/api/admin/my-team/:userId/emergency-contacts/:contactId", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.patch("/api/admin/my-team/:userId/tickets/:ticketId", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.get("/api/admin/my-team/:userId/audit-log", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.get("/api/admin/my-team/:userId/details", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.get("/api/admin/my-team/:userId/leaves", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.post("/api/admin/my-team/:userId/apply-leave", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.get("/api/admin/my-team/members", requireRole("hr", "manager", "operations"), async (req, res) => {
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

  app.patch("/api/system/feature-flags", requireAuth, requireRole("super_admin", "admin"), async (req: Request, res: Response) => {
    try {
      const ALLOWED_FLAGS = ["notifications_enabled", "document_reminder_email_enabled"];
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
  app.patch("/api/company-profile", requireAuth, requireRole("super_admin", "admin"), async (req: Request, res: Response) => {
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

  app.get("/api/hr/letters/wording-matrix", requireRole("hr"), async (_req, res) => {
    res.json({
      performanceBand: PERFORMANCE_BAND_SENTENCES,
      conductBand: CONDUCT_BAND_SENTENCES,
      completionBand: COMPLETION_BAND_SENTENCES,
    });
  });

  app.get("/api/hr/letter-templates/sentences", requireRole("hr"), async (req, res) => {
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

  app.get("/api/hr/letter-templates/roles", requireRole("hr"), async (req, res) => {
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

  app.get("/api/hr/letters", requireRole("hr"), async (req, res) => {
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

  app.get("/api/hr/letters/:id", requireRole("hr"), async (req, res) => {
    try {
      const letter = await storage.getHrLetter(req.params.id);
      if (!letter) return res.status(404).json({ error: "Letter not found" });
      res.json(letter);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch letter" });
    }
  });

  app.post("/api/hr/letters", requireRole("hr"), async (req, res) => {
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
            if (!ann.title || !ann.body) {
              return res.status(400).json({ error: "Each annexure must have a non-empty title and body." });
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
          if (!ann.title || !ann.body) {
            return res.status(400).json({ error: "Each annexure must have a non-empty title and body." });
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

  app.patch("/api/hr/letters/:id", requireRole("hr"), async (req, res) => {
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

  app.post("/api/hr/letters/:id/approve", requireRole("hr"), async (req, res) => {
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

  app.post("/api/hr/letters/:id/issue", requireRole("hr"), async (req, res) => {
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

  app.get("/api/hr/letters/:id/download", requireRole("hr"), async (req, res) => {
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

  app.post("/api/hr/letters/:id/email", requireRole("hr"), async (req, res) => {
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

  app.post("/api/hr/letters/:id/reissue", requireRole("hr"), async (req, res) => {
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

  app.post("/api/hr/letters/:id/revoke", requireRole("hr"), async (req, res) => {
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

  app.get("/api/verify-letter", async (req, res) => {
    try {
      const { ref, auth, documentType } = req.query;
      if (!ref || !auth) {
        return res.status(400).json({ error: "Reference number and auth code are required" });
      }

      // ── Contract verification branch ────────────────────────────────────────
      if (documentType === "contract") {
        const { verifyDocument } = await import("./documentSigningService");
        const result = await verifyDocument("contract", ref as string, auth as string);

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

      // ── HR letter verification branch (existing) ───────────────────────────
      const letter = await storage.getHrLetterByRef(ref as string);
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

      if (recomputedAuth !== (auth as string).toUpperCase()) {
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
        SELECT id, name, display_label, us_coverage,
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
  app.patch("/api/hr/admin/shifts/:id/grace-period", requireRole("hr", "admin", "super_admin"), async (req, res) => {
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

  app.get("/api/hr/shifts/current-timing/:shiftId", requireRole("hr", "manager"), async (req, res) => {
    try {
      const timing = await getCurrentShiftTiming(req.params.shiftId);
      if (!timing) return res.status(404).json({ error: "Shift not found" });
      res.json(timing);
    } catch (error) {
      console.error("Get shift timing error:", error);
      res.status(500).json({ error: "Failed to fetch shift timing" });
    }
  });

  app.patch("/api/hr/users/:id/shift", requireRole("hr"), async (req, res) => {
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

  app.get("/api/hr/users/:id/shift-history", requireRole("hr", "manager"), async (req, res) => {
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

  app.get("/api/hr/policy-acknowledgements", requireRole("hr", "manager"), async (req, res) => {
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

  app.get("/api/admin/announcements", requireRole("hr", "admin", "super_admin"), async (req, res) => {
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

  app.patch("/api/admin/announcements", requireRole("hr", "admin", "super_admin"), async (req, res) => {
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

  app.get("/api/admin/announcements/recipient-count", requireRole("hr", "admin", "super_admin"), async (req, res) => {
    try {
      const allActive = await storage.getAllActiveEmployees();
      const targetRoles = ["employee", "manager", "recruiter", "operations", "finance"];
      const recipients = allActive.filter(u => targetRoles.includes(u.role || ""));
      res.json({ count: recipients.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to get recipient count" });
    }
  });

  app.post("/api/admin/announcements/send-email", requireRole("hr", "admin", "super_admin"), async (req, res) => {
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

  // Seed badge types on startup (idempotent)
  seedPraiseBadgeTypes().catch(console.error);

  return httpServer;
}
