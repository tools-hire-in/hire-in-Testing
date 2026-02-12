import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertContactSchema, insertApplicationSchema, insertJobSchema, insertAdminUserSchema, insertHolidaySchema, insertLeaveTypeSchema, insertLeaveRequestSchema, insertTicketSchema, type AdminUser } from "@shared/schema";
import { setupSession, requireAuth as requireAuthImported, requireRole as requireRoleAuth } from "./auth";
import { registerAuthRoutes } from "./authRoutes";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { sendInvitationEmail, sendWelcomeEmail } from "./email";
import crypto from "crypto";

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

  // Admin Applications (HR and Operations roles can access)
  app.get("/api/admin/applications", requireRole("hr", "operations"), async (req, res) => {
    try {
      const applications = await storage.getApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applications" });
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

  // Admin Contacts (HR and Operations roles can access - view)
  app.get("/api/admin/contacts", requireRole("hr", "operations"), async (req, res) => {
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
  app.get("/api/admin/users", requireRole("super_admin", "hr"), async (req, res) => {
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
      const { email, role, firstName, lastName, password, joiningDate, designation, departmentId, hierarchyLevel } = req.body;
      
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
      
      const user = await storage.createAdminUser({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName || "",
        lastName: lastName || "",
        role: role || "employee",
        isActive: true,
        joiningDate: joiningDate || null,
        designation: designation || null,
        departmentId: departmentId || null,
        hierarchyLevel: hierarchyLevel || "team_member",
      });

      const baseUrl = process.env.BASE_URL || "https://employee.hire-in.com";
      const loginUrl = `${baseUrl}/admin/login`;

      sendInvitationEmail({
        to: email.toLowerCase(),
        firstName: firstName || email.split("@")[0],
        lastName: lastName || "",
        role: role || "employee",
        temporaryPassword: tempPassword,
        loginUrl,
      }).catch((err) => console.error("Background invitation email error:", err));

      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", requireRole("super_admin"), async (req, res) => {
    try {
      const { password, ...updateData } = req.body;
      
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

  app.post("/api/admin/users/:id/resend-invite", requireRole("super_admin"), async (req, res) => {
    try {
      const userId = req.params.id as string;
      const targetUser = await storage.getAdminUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
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
        res.json({ message: "Invitation resent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send email. Password was not changed." });
      }
    } catch (error) {
      console.error("Resend invite error:", error);
      res.status(500).json({ error: "Failed to resend invitation" });
    }
  });

  const ROLE_RANK: Record<string, number> = {
    super_admin: 6,
    admin: 5,
    hr: 4,
    operations: 3,
    manager: 2,
    employee: 1,
  };

  app.post("/api/admin/users/:id/reset-password", requireAuth, async (req, res) => {
    try {
      const actorRole = req.session.role!;
      const actorRank = ROLE_RANK[actorRole] ?? 0;

      if (actorRank < ROLE_RANK.admin) {
        return res.status(403).json({ error: "Only supervisors can reset passwords" });
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

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
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

  app.patch("/api/admin/users/:id/hierarchy", requireRole("hr"), async (req, res) => {
    try {
      const { managerId, departmentId, designation, hierarchyLevel } = req.body;
      const updated = await storage.updateAdminUser(req.params.id as string, {
        managerId, departmentId, designation, hierarchyLevel,
      });
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user hierarchy" });
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
        leaveBalances: balances,
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
      res.status(201).json(holiday);
    } catch (error) {
      res.status(500).json({ error: "Failed to create holiday" });
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
      await storage.deleteHoliday(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete holiday" });
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
  app.get("/api/hr/attendance/my-team", requireRole("hr", "manager"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role;
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];

      let teamMembers: AdminUser[];
      if (["super_admin", "admin", "hr"].includes(userRole!)) {
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

  app.get("/api/hr/attendance/my-team/range", requireRole("hr", "manager"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      let teamMembers: AdminUser[];
      if (["super_admin", "admin", "hr"].includes(userRole!)) {
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

  return httpServer;
}
