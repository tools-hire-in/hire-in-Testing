import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertContactSchema, insertApplicationSchema, insertJobSchema, insertAdminUserSchema, insertHolidaySchema, insertLeaveTypeSchema, insertLeaveRequestSchema, insertTicketSchema, type AdminUser } from "@shared/schema";
import { setupSession, requireAuth as requireAuthImported, requireRole as requireRoleAuth, require2FA } from "./auth";
import { registerAuthRoutes } from "./authRoutes";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage/routes";
import { sendInvitationEmail, sendWelcomeEmail, sendSalaryReport, sendDocumentReminderEmail, sendOfferLetterEmail, sendOnboardingWelcomeEmail } from "./email";
import { generateMonthlySalaryReport } from "./salaryReport";
import crypto from "crypto";
import { syncCeipalJobs, pushApplicantToCeipal } from "./ceipalService";
import { generateOfferLetterDocx, type OfferLetterData } from "./offerLetter";

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

  // Get active jobs (public)
  app.get("/api/jobs", async (req, res) => {
    try {
      const { search, specialty, state, jobType } = req.query;
      const jobs = await storage.getActiveJobs({
        search: search as string,
        specialty: specialty as string,
        state: state as string,
        jobType: jobType as string,
      });
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // Get job filters (public)
  app.get("/api/jobs/filters", async (req, res) => {
    try {
      const filters = await storage.getJobFilters();
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
      res.json(job);
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
  app.get("/api/admin/jobs", requireRole("operations"), async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.post("/api/admin/jobs", requireRole("operations"), async (req, res) => {
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

  app.patch("/api/admin/jobs/:id", requireRole("operations"), async (req, res) => {
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

  app.delete("/api/admin/jobs/:id", requireRole("operations"), async (req, res) => {
    try {
      const jobId = req.params.id as string;
      await storage.deleteJob(jobId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // Bulk delete jobs
  app.post("/api/admin/jobs/bulk-delete", requireRole("operations"), async (req, res) => {
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
  app.post("/api/admin/jobs/bulk-update", requireRole("operations"), async (req, res) => {
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
  app.post("/api/admin/jobs/sync-ceipal", requireRole("operations"), async (req, res) => {
    try {
      const result = await syncCeipalJobs();
      res.json({
        message: `Ceipal sync complete: ${result.created} new, ${result.updated} updated out of ${result.total} total`,
        ...result,
      });
    } catch (error: any) {
      console.error("Ceipal sync error:", error);
      res.status(500).json({ error: error.message || "Failed to sync jobs from Ceipal" });
    }
  });

  // CSV/XLSX Upload for Jobs
  app.post("/api/admin/jobs/upload", requireRole("operations"), upload.single("file"), async (req, res) => {
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

  app.patch("/api/admin/applications/:id", requireRole("hr", "operations"), async (req, res) => {
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

  app.post("/api/admin/applications/:id/retry-ceipal", requireRole("hr", "operations"), async (req, res) => {
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

  app.patch("/api/admin/contacts/:id", requireRole("hr", "operations"), async (req, res) => {
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
      const users = await storage.getAdminUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Role hierarchy for permission checks
  const ROLE_RANK: Record<string, number> = {
    super_admin: 6,
    admin: 5,
    hr: 4,
    operations: 3,
    manager: 2,
    employee: 1,
  };

  // User management routes — accessible to super_admin, admin, and manager
  app.post("/api/admin/users", requireRole("admin", "manager"), async (req, res) => {
    try {
      const actorRole = req.session.role!;
      const actorRank = ROLE_RANK[actorRole] ?? 0;
      const { email, role, firstName, lastName, password, joiningDate, designation, departmentId, hierarchyLevel, salary } = req.body;

      const assignedRole = role || "employee";
      const assignedRank = ROLE_RANK[assignedRole] ?? 0;
      if (actorRank <= assignedRank && actorRole !== "super_admin") {
        return res.status(403).json({ error: "You cannot assign a role equal to or higher than your own" });
      }

      if (!email?.endsWith("@hire-in.com")) {
        return res.status(400).json({ error: "Only @hire-in.com emails are allowed" });
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
      });

      storage.initializeEmployeeDocuments(user.id).catch(err =>
        console.error("Failed to initialize documents for user:", err)
      );

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

      res.status(201).json(user);
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

        const validRoles = ["super_admin", "admin", "hr", "operations", "manager", "employee"] as const;
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

          storage.initializeEmployeeDocuments(newUser.id).catch(err =>
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

  app.patch("/api/admin/users/:id", requireRole("admin", "manager"), async (req, res) => {
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

  app.delete("/api/admin/users/:id", requireRole("super_admin", "admin"), async (req, res) => {
    try {
      const userId = req.params.id as string;
      const targetUser = await storage.getAdminUser(userId);

      if (targetUser) {
        const actorRank = ROLE_RANK[req.session.role!] ?? 0;
        const targetRank = ROLE_RANK[targetUser.role] ?? 0;
        if (actorRank <= targetRank && req.session.role !== "super_admin") {
          return res.status(403).json({ error: "You cannot delete a user with an equal or higher role" });
        }
        if (userId === req.session.userId) {
          return res.status(400).json({ error: "You cannot delete your own account" });
        }
      }

      await storage.deleteAdminUser(userId);

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
      const todayRecord = await storage.getTodayAttendance(userId);
      const now = new Date();
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
      if (todayRecord) {
        todayStatus = todayRecord.punchOut ? "completed" : "punched_in";
      }

      res.json({
        todayStatus,
        punchInTime: todayRecord?.punchIn || null,
        punchOutTime: todayRecord?.punchOut || null,
        presentDaysThisMonth: presentRecords.length,
        totalHoursThisMonth: totalHours.toFixed(1),
        pendingLeaveRequests: pendingCount,
        leaveBalances: activeBalances,
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

  app.post("/api/hr/attendance/punch-in", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const today = new Date().toISOString().split("T")[0];
      const existing = await storage.getTodayAttendance(userId);
      if (existing) {
        return res.status(400).json({ error: "Already punched in today" });
      }
      const record = await storage.createAttendance({
        userId,
        date: today,
        punchIn: new Date(),
        status: "present",
      });
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to punch in" });
    }
  });

  app.post("/api/hr/attendance/punch-out", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
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
      const totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
      const record = await storage.updateAttendance(existing.id, {
        punchOut,
        totalHours,
      });
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to punch out" });
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

  app.patch("/api/hr/attendance/:id", requireRole("hr"), async (req, res) => {
    try {
      const record = await storage.updateAttendance(req.params.id as string, req.body);
      if (!record) return res.status(404).json({ error: "Attendance record not found" });
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to update attendance" });
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
      res.json({ 
        message: `Accrual completed for ${targetMonth}/${targetYear}`,
        ...result 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to run leave accrual" });
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
      const lr = await storage.createLeaveRequest(result.data);
      res.status(201).json(lr);
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
          const newUsed = parseFloat(balance.usedDays || "0") + parseFloat(lr.totalDays || "0");
          await storage.updateLeaveBalance(balance.id, { usedDays: String(newUsed) });
        }
      }

      res.json(lr);
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
      const body = { ...req.body, userId };
      const result = insertTicketSchema.safeParse(body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid ticket data", details: result.error.issues });
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

  // --- HR Dashboard Stats ---
  app.get("/api/hr/dashboard-stats", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const today = new Date().toISOString().split("T")[0];
      const year = new Date().getFullYear();
      const monthStart = `${today.substring(0, 7)}-01`;

      const todayAttendance = await storage.getTodayAttendance(userId);
      const monthRecords = await storage.getAttendanceByUser(userId, monthStart, today);
      const pendingLeaves = await storage.getLeaveRequests({ userId, status: "pending" });
      let leaveBalances = await storage.getLeaveBalances(userId, year);
      if (leaveBalances.length === 0) {
        leaveBalances = await storage.initLeaveBalances(userId, year);
      }
      const activeLeaveTypes = await storage.getLeaveTypes();
      const activeTypeIds = new Set(activeLeaveTypes.filter(lt => lt.isActive).map(lt => lt.id));
      leaveBalances = leaveBalances.filter(lb => activeTypeIds.has(lb.leaveTypeId));

      const presentDays = monthRecords.filter(r => r.status === "present" || r.status === "half_day" || r.status === "late").length;
      const totalHoursMonth = monthRecords.reduce((sum, r) => sum + parseFloat(r.totalHours || "0"), 0);

      res.json({
        todayStatus: todayAttendance ? (todayAttendance.punchOut ? "completed" : "punched_in") : "not_punched",
        punchInTime: todayAttendance?.punchIn || null,
        punchOutTime: todayAttendance?.punchOut || null,
        presentDaysThisMonth: presentDays,
        totalHoursThisMonth: totalHoursMonth.toFixed(1),
        pendingLeaveRequests: pendingLeaves.length,
        leaveBalances,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
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
  app.get("/api/hr/attendance/my-team", requireRole("hr", "manager", "operations"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role;
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];

      let teamMembers: AdminUser[];
      if (["super_admin", "admin", "hr", "operations"].includes(userRole!)) {
        teamMembers = await storage.getAdminUsers();
      } else {
        teamMembers = await storage.getTeamMembers(userId);
      }

      if (teamMembers.length === 0) {
        return res.json({ members: [], attendance: [] });
      }

      const memberIds = teamMembers.map(m => m.id);
      const attendanceRecords = await storage.getAttendanceByTeam(memberIds, date);

      res.json({
        members: teamMembers.map(m => ({
          id: m.id, firstName: m.firstName, lastName: m.lastName, email: m.email,
          designation: m.designation, departmentId: m.departmentId
        })),
        attendance: attendanceRecords
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team attendance" });
    }
  });

  app.get("/api/hr/attendance/my-team/range", requireRole("hr", "manager", "operations"), async (req, res) => {
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
        teamMembers = await storage.getAdminUsers();
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
          designation: m.designation, departmentId: m.departmentId
        })),
        attendance: attendanceRecords
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team attendance" });
    }
  });

  app.get("/api/hr/attendance/member/:memberId/range", requireRole("hr", "manager", "operations"), async (req, res) => {
    try {
      const memberId = req.params.memberId;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const records = await storage.getAttendanceByUser(memberId, startDate, endDate);
      const member = await storage.getAdminUser(memberId);

      res.json({
        member: member ? {
          id: member.id, firstName: member.firstName, lastName: member.lastName,
          email: member.email, designation: member.designation, departmentId: member.departmentId
        } : null,
        attendance: records
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch member attendance" });
    }
  });

  app.get("/api/hr/attendance/download", requireRole("hr", "manager", "operations"), async (req, res) => {
    try {
      const ExcelJS = await import("exceljs");
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
      }

      const allRowData: DayData[] = [];
      const summaryData: {
        name: string; email: string; designation: string;
        totalWorkingDays: number; present: number; absent: number;
        holidays: number; leaves: number; totalHours: number; avgHours: number;
      }[] = [];

      for (const member of teamMembers) {
        const name = `${member.firstName} ${member.lastName}`;
        const userRecords = recordsByUser.get(member.id) || new Map();
        let present = 0, absent = 0, holidayCount = 0, leaveCount = 0, totalHours = 0;

        for (const date of allDates) {
          const record = userRecords.get(date);
          let status = "absent";
          let punchIn = "";
          let punchOut = "";
          let hours = 0;

          if (record) {
            status = getEffectiveStatus(record);
            punchIn = record.punchIn ? new Date(record.punchIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
            punchOut = record.punchOut ? new Date(record.punchOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
            hours = record.totalHours ? parseFloat(record.totalHours as string) : 0;
          } else if (date > todayStr) {
            status = "-";
          }

          if (status === "present") present++;
          else if (status === "absent") absent++;
          else if (status === "holiday") holidayCount++;
          else if (status === "leave") leaveCount++;
          totalHours += hours;

          allRowData.push({
            name, email: member.email, designation: member.designation || "",
            date, punchIn, punchOut, hours, status,
          });
        }

        const totalWorkingDays = allDates.filter(d => d <= todayStr).length;
        summaryData.push({
          name, email: member.email, designation: member.designation || "",
          totalWorkingDays, present, absent, holidays: holidayCount, leaves: leaveCount,
          totalHours: Math.round(totalHours * 100) / 100,
          avgHours: present > 0 ? Math.round((totalHours / present) * 100) / 100 : 0,
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
      ];
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      for (const row of summaryData) {
        summarySheet.addRow(row);
      }

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
      };
      const statusCodes: Record<string, string> = {
        present: "P", absent: "A", holiday: "H", leave: "L", weekend: "W", "-": "-",
      };

      for (const member of teamMembers) {
        const name = `${member.firstName} ${member.lastName}`;
        const userRecords = recordsByUser.get(member.id) || new Map();
        const rowValues: string[] = [name];
        let pCount = 0, aCount = 0, hCount = 0, lCount = 0;

        for (const cd of allCalendarDates) {
          if (cd.dayOfWeek === 0 || cd.dayOfWeek === 6) {
            rowValues.push("W");
          } else if (cd.date > todayStr) {
            rowValues.push("-");
          } else {
            const record = userRecords.get(cd.date);
            const status = record ? getEffectiveStatus(record) : "absent";
            rowValues.push(statusCodes[status] || "A");
            if (status === "present") pCount++;
            else if (status === "absent") aCount++;
            else if (status === "holiday") hCount++;
            else if (status === "leave") lCount++;
          }
        }
        rowValues.push(String(pCount), String(aCount), String(hCount), String(lCount));

        const row = calendarSheet.addRow(rowValues);
        row.font = { size: 9 };
        for (let i = 2; i <= allCalendarDates.length + 1; i++) {
          const cellValue = row.getCell(i).value as string;
          const statusKey = Object.entries(statusCodes).find(([, v]) => v === cellValue)?.[0] || "";
          if (statusColors[statusKey]) {
            row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColors[statusKey] } };
            row.getCell(i).alignment = { horizontal: "center" };
            row.getCell(i).font = { size: 9, bold: true, color: { argb: statusKey === "weekend" || statusKey === "-" ? "FF666666" : "FFFFFFFF" } };
          }
        }
      }

      const legendRow = calendarSheet.addRow([]);
      calendarSheet.addRow(["Legend:", "P = Present", "A = Absent", "H = Holiday", "L = Leave", "W = Weekend"]);

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
      ];
      detailSheet.getRow(1).font = { bold: true };
      detailSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      detailSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      for (const row of allRowData) {
        if (row.status !== "-") {
          detailSheet.addRow({
            ...row,
            hours: row.hours.toFixed(2),
          });
        }
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
  // SALARY REPORTS
  // ==========================================

  app.get("/api/hr/reports/salary/preview", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
  app.get("/api/hr/reports/salary/recipients", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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

  app.post("/api/hr/reports/salary", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.body.year) || new Date().getFullYear();
      const month = parseInt(req.body.month) || new Date().getMonth() + 1;
      const report = await generateMonthlySalaryReport(year, month);

      const recipientsSetting = await storage.getSystemSetting("salary_report_recipients");
      const recipients = recipientsSetting?.value as { to: string[]; cc: string[] } | undefined;

      const emailResult = await sendSalaryReport({
        csvContent: report.csv,
        summary: report.summary,
        recipients,
      });

      if (emailResult.success) {
        res.json({ success: true, summary: report.summary });
      } else {
        res.status(500).json({ error: "Report generated but email failed to send" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to generate and send salary report" });
    }
  });

  app.get("/api/hr/reports/salary/download", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
          approvedLeaves: String(row.approvedLeaves),
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
      await storage.updateLeaveBalance(balance.id, { totalDays: String(Math.max(0, newTotal)) });

      const adjustment = await storage.createLeaveAdjustment({
        userId,
        leaveTypeId,
        adjustmentDays: String(adjustmentDays),
        reason,
        year,
        adjustedBy: req.session.userId!,
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
            await storage.updateLeaveBalance(balance.id, { totalDays: String(Math.max(0, newTotal)) });
            await storage.createLeaveAdjustment({
              userId,
              leaveTypeId,
              adjustmentDays: String(adjustmentDays),
              reason,
              year,
              adjustedBy: req.session.userId!,
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
        await storage.initializeEmployeeDocuments(req.session.userId!);
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
      const docs = await storage.initializeEmployeeDocuments(req.params.userId);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to initialize documents" });
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

      await sendDocumentReminderEmail({
        to: user.email,
        firstName: user.firstName,
        pendingDocuments: pendingDocs.map(d => d.documentType),
      });

      res.json({ success: true, message: "Reminder sent" });
    } catch (error) {
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
  app.get("/api/hr/admin/salary-slips/:userId", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const slips = await storage.getSalarySlipsByUser(req.params.userId);
      res.json(slips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch salary slips" });
    }
  });

  app.get("/api/hr/admin/salary-slip/:id", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
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
  app.post("/api/hr/tools/generate-offer-letter", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      let departmentName = "";
      if (req.body.departmentId) {
        const dept = await storage.getDepartment(req.body.departmentId);
        departmentName = dept?.name || "";
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
      };

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
        location, jurisdiction, hrManagerName, offerDate } = req.body;

      if (!candidateName || !candidatePersonalEmail || !designation) {
        return res.status(400).json({ error: "Candidate name, personal email, and designation are required" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const actorId = req.session.userId!;

      const offerLetter = await storage.createOfferLetter({
        token,
        status: "sent",
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
      });

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost";
      const acceptUrl = `${protocol}://${host}/onboard/${token}`;

      const emailResult = await sendOfferLetterEmail({
        to: candidatePersonalEmail.toLowerCase(),
        candidateName,
        designation,
        acceptUrl,
        expiresAt,
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

  // Public: View offer letter by token
  app.get("/api/onboard/:token", async (req: Request, res: Response) => {
    try {
      const letter = await storage.getOfferLetterByToken(req.params.token);
      if (!letter) {
        return res.status(404).json({ error: "Offer letter not found" });
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

      const signingKey = process.env.OFFER_SIGNING_KEY;
      if (!signingKey) {
        console.error("OFFER_SIGNING_KEY is not set in environment");
        return res.status(500).json({ error: "Server configuration error" });
      }

      const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const serverTimestamp = new Date();

      // 1. Compute document hash
      const docContents = JSON.stringify({
        id: letter.id,
        candidateName: letter.candidateName,
        designation: letter.designation,
        salary: letter.salary,
        proposedStartDate: letter.proposedStartDate,
        offerDate: letter.offerDate,
        location: letter.location
      });
      const documentHash = crypto.createHash("sha256").update(docContents).digest("hex");

      // 2. Generate authCode
      const hmacPayload = `${letter.id}|${acceptedName.trim()}|${serverTimestamp.toISOString()}|${documentHash}`;
      const fullAuthCode = crypto.createHmac("sha256", signingKey).update(hmacPayload).digest("hex");
      const authCode = fullAuthCode.substring(0, 24).toUpperCase().match(/.{1,4}/g)?.join("-") || fullAuthCode.substring(0, 24).toUpperCase();

      await storage.updateOfferLetter(letter.id, {
        status: "accepted",
        acceptedAt: serverTimestamp,
        acceptedName: acceptedName.trim(),
        acceptanceDate: acceptanceDate || serverTimestamp.toISOString().split("T")[0],
        acceptedIp: clientIp,
        acceptedUserAgent: userAgent,
        authCode,
        documentHash
      });

      await storage.createAuditLog({
        action: "offer_letter_accepted",
        actorId: letter.createdBy,
        changes: { offerId: letter.id, candidateName: letter.candidateName, acceptedName: acceptedName.trim(), ip: clientIp, authCode },
      });

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

      const signingKey = process.env.OFFER_SIGNING_KEY;
      if (!signingKey) {
        console.error("OFFER_SIGNING_KEY is not set in environment");
        return res.status(500).json({ error: "Server configuration error" });
      }

      const now = new Date();
      
      // 1. Compute document hash for counter-signature (incorporating candidate signature)
      const counterDocContents = JSON.stringify({
        id: letter.id,
        candidateName: letter.candidateName,
        acceptedName: letter.acceptedName,
        acceptanceDate: letter.acceptanceDate,
        authCode: letter.authCode,
        documentHash: letter.documentHash
      });
      const counterDocumentHash = crypto.createHash("sha256").update(counterDocContents).digest("hex");

      // 2. Generate counterAuthCode
      const hmacPayload = `${letter.id}|counter|${counterSignedName.trim()}|${now.toISOString()}|${counterDocumentHash}`;
      const fullAuthCode = crypto.createHmac("sha256", signingKey).update(hmacPayload).digest("hex");
      const counterAuthCode = fullAuthCode.substring(0, 24).toUpperCase().match(/.{1,4}/g)?.join("-") || fullAuthCode.substring(0, 24).toUpperCase();

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

  // Start onboarding — creates employee profile
  app.post("/api/hr/tools/offer-letters/:id/start-onboarding", requireAuth, requireRole("super_admin", "admin", "hr"), async (req: Request, res: Response) => {
    try {
      const letter = await storage.getOfferLetter(req.params.id);
      if (!letter) {
        return res.status(404).json({ error: "Offer letter not found" });
      }

      if (letter.status !== "countersigned") {
        return res.status(400).json({ error: `Cannot onboard — offer status is '${letter.status}', must be 'countersigned'` });
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
      });

      await storage.updateOfferLetter(letter.id, {
        status: "onboarded",
        onboardedAt: new Date(),
        hireInEmail: hireInEmail.toLowerCase(),
        resultingUserId: newUser.id,
        onboardedBy: actorId,
      });

      await storage.initializeEmployeeDocuments(newUser.id);

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

      res.json({ success: true, userId: newUser.id, employeeId });
    } catch (error: any) {
      console.error("Start onboarding error:", error);
      res.status(500).json({ error: error.message || "Failed to start onboarding" });
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

  return httpServer;
}
