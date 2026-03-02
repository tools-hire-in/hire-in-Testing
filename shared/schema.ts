import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, pgEnum, date, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// User roles enum
export const userRoleEnum = pgEnum("user_role", ["super_admin", "admin", "hr", "operations", "manager", "employee"]);

// Hierarchy level enum
export const hierarchyLevelEnum = pgEnum("hierarchy_level", ["ceo", "vp", "director", "manager", "team_lead", "delivery_manager", "team_member"]);

// Departments table
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  headId: varchar("head_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin users table (custom auth with email/password)
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  role: userRoleEnum("role").notNull().default("employee"),
  isActive: boolean("is_active").notNull().default(true),
  managerId: varchar("manager_id"),
  departmentId: varchar("department_id").references(() => departments.id),
  designation: varchar("designation"),
  salary: numeric("salary"),
  hierarchyLevel: hierarchyLevelEnum("hierarchy_level").default("team_member"),
  employeeId: varchar("employee_id").unique(),
  joiningDate: date("joining_date"),
  totpSecret: varchar("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Jobs table - stores all job postings from CSV uploads and Ceipal sync
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id"),
  title: varchar("title").notNull(),
  specialty: varchar("specialty"),
  department: varchar("department"),
  facility: varchar("facility"),
  city: varchar("city"),
  state: varchar("state"),
  jobType: varchar("job_type"),
  shift: varchar("shift"),
  duration: varchar("duration"),
  payRate: varchar("pay_rate"),
  billRate: varchar("bill_rate"),
  startDate: varchar("start_date"),
  description: text("description"),
  requirements: text("requirements"),
  isActive: boolean("is_active").notNull().default(true),
  isHot: boolean("is_hot").notNull().default(false),
  rawData: jsonb("raw_data"),
  source: varchar("source").notNull().default("manual"),
  ceipalJobCode: varchar("ceipal_job_code"),
  ceipalJobId: varchar("ceipal_job_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Job applications table
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id),
  candidateName: varchar("candidate_name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone").notNull(),
  resumePath: varchar("resume_path"),
  coverLetter: text("cover_letter"),
  linkedinUrl: varchar("linkedin_url"),
  yearsExperience: integer("years_experience"),
  currentEmployer: varchar("current_employer"),
  status: varchar("status").notNull().default("new"),
  ceipalSyncStatus: varchar("ceipal_sync_status").default("pending"),
  ceipalApplicantId: varchar("ceipal_applicant_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact inquiries table
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inquiryType: varchar("inquiry_type").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone").notNull(),
  company: varchar("company"),
  message: text("message").notNull(),
  subject: varchar("subject"),
  status: varchar("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==========================================
// HR PORTAL TABLES
// ==========================================

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "half_day", "late", "on_leave", "holiday", "weekend"]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected", "cancelled"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_review", "resolved", "rejected"]);

export const holidays = pgTable("holidays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  date: varchar("date").notNull(),
  type: varchar("type").notNull().default("public"),
  isOptional: boolean("is_optional").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  date: varchar("date").notNull(),
  punchIn: timestamp("punch_in"),
  punchOut: timestamp("punch_out"),
  totalHours: numeric("total_hours"),
  status: attendanceStatusEnum("status").notNull().default("present"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leaveTypes = pgTable("leave_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  defaultDays: integer("default_days").notNull().default(0),
  monthlyAccrual: numeric("monthly_accrual").notNull().default("0"),
  minHoursForAccrual: numeric("min_hours_for_accrual").notNull().default("128"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leaveBalances = pgTable("leave_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  leaveTypeId: varchar("leave_type_id").notNull().references(() => leaveTypes.id),
  totalDays: numeric("total_days").notNull().default("0"),
  usedDays: numeric("used_days").notNull().default("0"),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  leaveTypeId: varchar("leave_type_id").notNull().references(() => leaveTypes.id),
  startDate: varchar("start_date").notNull(),
  endDate: varchar("end_date").notNull(),
  totalDays: numeric("total_days").notNull(),
  reason: text("reason"),
  status: leaveStatusEnum("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewComment: text("review_comment"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leaveAccruals = pgTable("leave_accruals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  leaveTypeId: varchar("leave_type_id").notNull().references(() => leaveTypes.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  accruedDays: numeric("accrued_days").notNull().default("0"),
  hoursWorked: numeric("hours_worked").notNull().default("0"),
  qualified: boolean("qualified").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const regionalHolidaySelections = pgTable("regional_holiday_selections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  holidayId: varchar("holiday_id").notNull().references(() => holidays.id),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_regional_selection_user_holiday_year").on(table.userId, table.holidayId, table.year),
]);

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  type: varchar("type").notNull().default("regularization"),
  attendanceId: varchar("attendance_id").references(() => attendance.id),
  date: varchar("date").notNull(),
  requestedPunchIn: timestamp("requested_punch_in"),
  requestedPunchOut: timestamp("requested_punch_out"),
  reason: text("reason").notNull(),
  status: ticketStatusEnum("status").notNull().default("open"),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewComment: text("review_comment"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Salary slips table
export const salarySlips = pgTable("salary_slips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  basicSalary: numeric("basic_salary").notNull().default("0"),
  grossSalary: numeric("gross_salary").notNull().default("0"),
  deductions: numeric("deductions").notNull().default("0"),
  netPayable: numeric("net_payable").notNull().default("0"),
  totalWorkingDays: integer("total_working_days").notNull().default(0),
  daysPresent: integer("days_present").notNull().default(0),
  daysAbsent: integer("days_absent").notNull().default(0),
  approvedLeaves: numeric("approved_leaves").notNull().default("0"),
  totalHours: numeric("total_hours").notNull().default("0"),
  attendancePercentage: numeric("attendance_percentage").notNull().default("0"),
  generatedAt: timestamp("generated_at").defaultNow(),
  generatedBy: varchar("generated_by").references(() => adminUsers.id),
});

// Leave balance adjustments table
export const leaveAdjustments = pgTable("leave_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  leaveTypeId: varchar("leave_type_id").notNull().references(() => leaveTypes.id),
  adjustmentDays: numeric("adjustment_days").notNull(),
  reason: text("reason").notNull(),
  year: integer("year").notNull(),
  adjustedBy: varchar("adjusted_by").notNull().references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull().references(() => adminUsers.id),
  targetId: varchar("target_id").references(() => adminUsers.id),
  action: varchar("action").notNull(),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Employee documents table - post-onboarding document checklist
export const employeeDocuments = pgTable("employee_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  category: varchar("category").notNull(),
  documentType: varchar("document_type").notNull(),
  fileName: varchar("file_name"),
  fileUrl: varchar("file_url"),
  fileSize: integer("file_size"),
  status: varchar("status").notNull().default("pending"),
  isRequired: boolean("is_required").notNull().default(true),
  remarks: text("remarks"),
  uploadedAt: timestamp("uploaded_at"),
  verifiedBy: varchar("verified_by").references(() => adminUsers.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employee bank details table
export const employeeBankDetails = pgTable("employee_bank_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id).unique(),
  accountNumber: varchar("account_number"),
  ifscCode: varchar("ifsc_code"),
  bankName: varchar("bank_name"),
  branchName: varchar("branch_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employee emergency contacts table
export const employeeEmergencyContacts = pgTable("employee_emergency_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  name: varchar("name").notNull(),
  relationship: varchar("relationship").notNull(),
  phone: varchar("phone").notNull(),
  email: varchar("email"),
  address: text("address"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==========================================
// RELATIONS
// ==========================================

export const jobsRelations = relations(jobs, ({ many }) => ({
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  job: one(jobs, {
    fields: [applications.jobId],
    references: [jobs.id],
  }),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  employees: many(adminUsers),
}));

export const adminUsersRelations = relations(adminUsers, ({ one, many }) => ({
  department: one(departments, {
    fields: [adminUsers.departmentId],
    references: [departments.id],
  }),
  manager: one(adminUsers, {
    fields: [adminUsers.managerId],
    references: [adminUsers.id],
    relationName: "managerRelation",
  }),
  directReports: many(adminUsers, { relationName: "managerRelation" }),
  attendanceRecords: many(attendance),
  leaveBalances: many(leaveBalances),
  leaveRequests: many(leaveRequests),
  tickets: many(tickets),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(adminUsers, {
    fields: [attendance.userId],
    references: [adminUsers.id],
  }),
}));

export const leaveBalancesRelations = relations(leaveBalances, ({ one }) => ({
  user: one(adminUsers, {
    fields: [leaveBalances.userId],
    references: [adminUsers.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveBalances.leaveTypeId],
    references: [leaveTypes.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  user: one(adminUsers, {
    fields: [leaveRequests.userId],
    references: [adminUsers.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveRequests.leaveTypeId],
    references: [leaveTypes.id],
  }),
  reviewer: one(adminUsers, {
    fields: [leaveRequests.reviewedBy],
    references: [adminUsers.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  user: one(adminUsers, {
    fields: [tickets.userId],
    references: [adminUsers.id],
  }),
  attendanceRecord: one(attendance, {
    fields: [tickets.attendanceId],
    references: [attendance.id],
  }),
  reviewer: one(adminUsers, {
    fields: [tickets.reviewedBy],
    references: [adminUsers.id],
  }),
}));

export const salarySlipsRelations = relations(salarySlips, ({ one }) => ({
  user: one(adminUsers, {
    fields: [salarySlips.userId],
    references: [adminUsers.id],
  }),
  generator: one(adminUsers, {
    fields: [salarySlips.generatedBy],
    references: [adminUsers.id],
    relationName: "slipGenerator",
  }),
}));

export const leaveAdjustmentsRelations = relations(leaveAdjustments, ({ one }) => ({
  user: one(adminUsers, {
    fields: [leaveAdjustments.userId],
    references: [adminUsers.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveAdjustments.leaveTypeId],
    references: [leaveTypes.id],
  }),
  adjuster: one(adminUsers, {
    fields: [leaveAdjustments.adjustedBy],
    references: [adminUsers.id],
    relationName: "leaveAdjuster",
  }),
}));

export const employeeDocumentsRelations = relations(employeeDocuments, ({ one }) => ({
  user: one(adminUsers, {
    fields: [employeeDocuments.userId],
    references: [adminUsers.id],
  }),
  verifier: one(adminUsers, {
    fields: [employeeDocuments.verifiedBy],
    references: [adminUsers.id],
    relationName: "docVerifier",
  }),
}));

export const employeeBankDetailsRelations = relations(employeeBankDetails, ({ one }) => ({
  user: one(adminUsers, {
    fields: [employeeBankDetails.userId],
    references: [adminUsers.id],
  }),
}));

export const employeeEmergencyContactsRelations = relations(employeeEmergencyContacts, ({ one }) => ({
  user: one(adminUsers, {
    fields: [employeeEmergencyContacts.userId],
    references: [adminUsers.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(adminUsers, {
    fields: [auditLogs.actorId],
    references: [adminUsers.id],
    relationName: "auditActor",
  }),
  target: one(adminUsers, {
    fields: [auditLogs.targetId],
    references: [adminUsers.id],
    relationName: "auditTarget",
  }),
}));

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerAdminSchema = z.object({
  email: z.string().email("Invalid email address").refine(
    (email) => email.endsWith("@hire-in.com"),
    "Only @hire-in.com email addresses are allowed"
  ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["super_admin", "admin", "hr", "operations", "manager", "employee"]).default("employee"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeaveTypeSchema = createInsertSchema(leaveTypes).omit({
  id: true,
  createdAt: true,
});

export const insertLeaveBalanceSchema = createInsertSchema(leaveBalances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  reviewedBy: true,
  reviewComment: true,
  reviewedAt: true,
});

export const insertLeaveAccrualSchema = createInsertSchema(leaveAccruals).omit({
  id: true,
  createdAt: true,
});

export const insertSalarySlipSchema = createInsertSchema(salarySlips).omit({
  id: true,
  generatedAt: true,
});

export const insertLeaveAdjustmentSchema = createInsertSchema(leaveAdjustments).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeBankDetailsSchema = createInsertSchema(employeeBankDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeEmergencyContactSchema = createInsertSchema(employeeEmergencyContacts).omit({
  id: true,
  createdAt: true,
});

export const insertRegionalHolidaySelectionSchema = createInsertSchema(regionalHolidaySelections).omit({
  id: true,
  createdAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  reviewedBy: true,
  reviewComment: true,
  reviewedAt: true,
});

// Offer letters table (for tracking sent offers and onboarding)
export const offerLetters = pgTable("offer_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique(),
  status: varchar("status").notNull().default("sent"),
  candidateTitle: varchar("candidate_title"),
  candidateName: varchar("candidate_name").notNull(),
  candidatePersonalEmail: varchar("candidate_personal_email").notNull(),
  candidateAddress: varchar("candidate_address"),
  designation: varchar("designation").notNull(),
  subjectDesignation: varchar("subject_designation"),
  reportingToUserId: varchar("reporting_to_user_id"),
  departmentId: varchar("department_id"),
  employmentType: varchar("employment_type"),
  proposedStartDate: varchar("proposed_start_date"),
  salary: varchar("salary"),
  salaryInWords: varchar("salary_in_words"),
  location: varchar("location"),
  jurisdiction: varchar("jurisdiction"),
  hrManagerName: varchar("hr_manager_name"),
  offerDate: varchar("offer_date"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  acceptedName: varchar("accepted_name"),
  acceptedIp: varchar("accepted_ip"),
  acceptedUserAgent: text("accepted_user_agent"),
  onboardedAt: timestamp("onboarded_at"),
  hireInEmail: varchar("hire_in_email"),
  resultingUserId: varchar("resulting_user_id"),
  onboardedBy: varchar("onboarded_by"),
});

export const insertOfferLetterSchema = createInsertSchema(offerLetters).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
  acceptedName: true,
  acceptedIp: true,
  acceptedUserAgent: true,
  onboardedAt: true,
  resultingUserId: true,
  onboardedBy: true,
});

// System settings table (key-value config store)
export const systemSettings = pgTable("system_settings", {
  key: varchar("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings);

// ==========================================
// TYPES
// ==========================================

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type InsertLeaveType = z.infer<typeof insertLeaveTypeSchema>;
export type LeaveBalance = typeof leaveBalances.$inferSelect;
export type InsertLeaveBalance = z.infer<typeof insertLeaveBalanceSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveAccrual = typeof leaveAccruals.$inferSelect;
export type InsertLeaveAccrual = z.infer<typeof insertLeaveAccrualSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type SalarySlip = typeof salarySlips.$inferSelect;
export type InsertSalarySlip = z.infer<typeof insertSalarySlipSchema>;
export type LeaveAdjustment = typeof leaveAdjustments.$inferSelect;
export type InsertLeaveAdjustment = z.infer<typeof insertLeaveAdjustmentSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type RegionalHolidaySelection = typeof regionalHolidaySelections.$inferSelect;
export type InsertRegionalHolidaySelection = z.infer<typeof insertRegionalHolidaySelectionSchema>;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type InsertEmployeeDocument = z.infer<typeof insertEmployeeDocumentSchema>;
export type EmployeeBankDetails = typeof employeeBankDetails.$inferSelect;
export type InsertEmployeeBankDetails = z.infer<typeof insertEmployeeBankDetailsSchema>;
export type EmployeeEmergencyContact = typeof employeeEmergencyContacts.$inferSelect;
export type InsertEmployeeEmergencyContact = z.infer<typeof insertEmployeeEmergencyContactSchema>;
export type OfferLetter = typeof offerLetters.$inferSelect;
export type InsertOfferLetter = z.infer<typeof insertOfferLetterSchema>;
