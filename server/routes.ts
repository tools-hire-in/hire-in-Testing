import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertContactSchema, insertApplicationSchema, insertJobSchema, insertAdminUserSchema } from "@shared/schema";
import { setupSession, requireAuth, requireRole as requireRoleAuth } from "./auth";
import { registerAuthRoutes } from "./authRoutes";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const upload = multer({ storage: multer.memoryStorage() });
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup session-based authentication (must be before other routes)
  setupSession(app);
  registerAuthRoutes(app);
  
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
      // Handle resumeUrl -> resumePath conversion
      const body = { ...req.body };
      if (body.resumeUrl) {
        body.resumePath = objectStorageService.normalizeObjectEntityPath(body.resumeUrl);
        delete body.resumeUrl;
      }
      
      const result = insertApplicationSchema.safeParse(body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid application data", details: result.error.issues });
      }
      
      const application = await storage.createApplication(result.data);
      res.status(201).json(application);
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

  // Admin Applications (HR role can access)
  app.get("/api/admin/applications", requireRole("hr"), async (req, res) => {
    try {
      const applications = await storage.getApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  app.patch("/api/admin/applications/:id", requireRole("hr"), async (req, res) => {
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

  // Admin Contacts (HR role can access)
  app.get("/api/admin/contacts", requireRole("hr"), async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.patch("/api/admin/contacts/:id", requireRole("hr"), async (req, res) => {
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
  app.get("/api/admin/users", requireRole("super_admin"), async (req, res) => {
    try {
      const users = await storage.getAdminUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // User management routes are now handled via auth routes (register, etc.)
  // These routes now use session-based role checking
  app.post("/api/admin/users", requireRole("super_admin"), async (req, res) => {
    try {
      const { email, role, firstName, lastName, password } = req.body;
      
      if (!email?.endsWith("@hire-in.com")) {
        return res.status(400).json({ error: "Only @hire-in.com emails are allowed" });
      }
      
      const existing = await storage.getAdminUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "User already exists" });
      }
      
      // Import hash function
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(password || "changeme123", 12);
      
      const user = await storage.createAdminUser({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName || "",
        lastName: lastName || "",
        role: role || "employee",
        isActive: true,
      });
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", requireRole("super_admin"), async (req, res) => {
    try {
      const { password, ...updateData } = req.body;
      
      // If password is being updated, hash it
      if (password) {
        const bcrypt = await import("bcryptjs");
        updateData.password = await bcrypt.hash(password, 12);
      }
      
      const userId = req.params.id as string;
      const user = await storage.updateAdminUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireRole("super_admin"), async (req, res) => {
    try {
      const userId = req.params.id as string;
      await storage.deleteAdminUser(userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  return httpServer;
}
