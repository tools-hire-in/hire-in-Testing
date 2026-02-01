import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertContactSchema, insertApplicationSchema, insertJobSchema, insertAdminUserSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const upload = multer({ storage: multer.memoryStorage() });
const objectStorageService = new ObjectStorageService();

// Helper to get user email from request
function getUserEmail(req: Request): string | undefined {
  const user = req.user as any;
  return user?.claims?.email || user?.email;
}

// Helper to get user role (returns role or defaults based on email)
async function getUserRole(email: string): Promise<string> {
  if (email === "simranjeet@hire-in.com") return "super_admin";
  const adminUser = await storage.getAdminUserByEmail(email);
  return adminUser?.role || "employee";
}

// Middleware to check if user has admin access (@hire-in.com domain)
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const email = getUserEmail(req);
  if (!email?.endsWith("@hire-in.com")) {
    return res.status(403).json({ error: "Access denied. Only @hire-in.com users can access admin portal." });
  }
  
  next();
}

// Role-based middleware factory
function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const email = getUserEmail(req);
    if (!email?.endsWith("@hire-in.com")) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const role = await getUserRole(email);
    if (allowedRoles.includes(role) || role === "super_admin" || role === "admin") {
      next();
    } else {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication (must be before other routes)
  await setupAuth(app);
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

  // Get admin stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
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
      const job = await storage.updateJob(req.params.id, result.data);
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
      await storage.deleteJob(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
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
      const application = await storage.updateApplication(req.params.id, req.body);
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
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  // Admin Users
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAdminUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      // Check if super admin (only super admin can create users)
      const currentUserEmail = getUserEmail(req);
      if (currentUserEmail !== "simranjeet@hire-in.com") {
        return res.status(403).json({ error: "Only Super Admin can manage users" });
      }
      
      const { email, role } = req.body;
      
      if (!email?.endsWith("@hire-in.com")) {
        return res.status(400).json({ error: "Only @hire-in.com emails are allowed" });
      }
      
      const result = insertAdminUserSchema.safeParse({
        userId: "",
        email,
        role: role || "employee",
      });
      
      if (!result.success) {
        return res.status(400).json({ error: "Invalid user data", details: result.error.issues });
      }
      
      const existing = await storage.getAdminUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "User already exists" });
      }
      
      const user = await storage.createAdminUser(result.data);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const currentUserEmail = getUserEmail(req);
      if (currentUserEmail !== "simranjeet@hire-in.com") {
        return res.status(403).json({ error: "Only Super Admin can manage users" });
      }
      
      const result = insertAdminUserSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid user data", details: result.error.issues });
      }
      
      const user = await storage.updateAdminUser(req.params.id, result.data);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const currentUserEmail = (req.user as any).email;
      if (currentUserEmail !== "simranjeet@hire-in.com") {
        return res.status(403).json({ error: "Only Super Admin can manage users" });
      }
      
      await storage.deleteAdminUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  return httpServer;
}
