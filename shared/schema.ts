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

// Employment status enum
export const employmentStatusEnum = pgEnum("employment_status", ["active", "relieved", "left_company"]);

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
  employmentStatus: employmentStatusEnum("employment_status").default("active"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  deletedAt: timestamp("deleted_at"),
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
  deletedAt: true,
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
  acceptanceDate: varchar("acceptance_date"),
  authCode: varchar("auth_code"),
  documentHash: varchar("document_hash"),
  counterSignedBy: varchar("counter_signed_by").references(() => adminUsers.id),
  counterSignedAt: timestamp("counter_signed_at"),
  counterSignedName: varchar("counter_signed_name"),
  counterSignedDate: varchar("counter_signed_date"),
  counterAuthCode: varchar("counter_auth_code"),
  counterDocumentHash: varchar("counter_document_hash"),
  approvedBy: varchar("approved_by").references(() => adminUsers.id),
  approvedAt: timestamp("approved_at"),
  approvalRejectionReason: text("approval_rejection_reason"),
  ccEmails: text("cc_emails"),
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

// ==========================================
// HR LETTERS (Experience, Internship, Certificate, Relieving)
// ==========================================

export const hrLetterTemplateTypeEnum = pgEnum("hr_letter_template_type", [
  "experience",
  "internship_completion",
  "internship_certificate",
  "relieving",
]);

export const hrLetterStatusEnum = pgEnum("hr_letter_status", [
  "draft",
  "pending_approval",
  "approved",
  "issued",
  "reissued",
  "revoked",
]);

export const hrLetterPerformanceBandEnum = pgEnum("hr_letter_performance_band", [
  "factual_only",
  "standard",
  "good",
  "very_good",
  "excellent",
]);

export const hrLetterConductBandEnum = pgEnum("hr_letter_conduct_band", [
  "standard",
  "good",
  "very_good",
]);

export const hrLetterCompletionBandEnum = pgEnum("hr_letter_completion_band", [
  "successfully_completed",
  "completed",
  "served_during_period",
]);

export const hrLetters = pgTable("hr_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateType: hrLetterTemplateTypeEnum("template_type").notNull(),
  status: hrLetterStatusEnum("status").notNull().default("draft"),

  employeeId: varchar("employee_id").references(() => adminUsers.id),
  employeeName: varchar("employee_name").notNull(),
  employeeCode: varchar("employee_code"),
  designation: varchar("designation").notNull(),
  department: varchar("department"),
  employmentType: varchar("employment_type"),
  location: varchar("location"),
  reportingManager: varchar("reporting_manager"),
  startDate: varchar("start_date").notNull(),
  endDate: varchar("end_date"),
  lastWorkingDay: varchar("last_working_day"),

  performanceBand: hrLetterPerformanceBandEnum("performance_band"),
  conductBand: hrLetterConductBandEnum("conduct_band"),
  completionBand: hrLetterCompletionBandEnum("completion_band"),
  closingLine: varchar("closing_line"),

  includeResponsibilities: boolean("include_responsibilities").default(false),
  responsibilitiesSummary: text("responsibilities_summary"),
  includeProject: boolean("include_project").default(false),
  projectName: varchar("project_name"),
  includeSeal: boolean("include_seal").default(false),

  signatoryId: varchar("signatory_id").references(() => adminUsers.id),
  signatoryName: varchar("signatory_name"),
  signatoryDesignation: varchar("signatory_designation"),
  issueDate: varchar("issue_date"),

  referenceNumber: varchar("reference_number").unique(),
  authCode: varchar("auth_code"),
  documentHash: varchar("document_hash"),

  customOverrideText: text("custom_override_text"),
  customOverrideBy: varchar("custom_override_by").references(() => adminUsers.id),
  customOverrideAt: timestamp("custom_override_at"),

  reissuedFromLetterId: varchar("reissued_from_letter_id"),
  reissueReason: text("reissue_reason"),
  pdfPath: varchar("pdf_path"),

  createdBy: varchar("created_by").notNull().references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  approvedBy: varchar("approved_by").references(() => adminUsers.id),
  approvedAt: timestamp("approved_at"),
  issuedBy: varchar("issued_by").references(() => adminUsers.id),
  issuedAt: timestamp("issued_at"),
  revokedBy: varchar("revoked_by").references(() => adminUsers.id),
  revokedAt: timestamp("revoked_at"),
  revokeReason: text("revoke_reason"),
  ccEmails: text("cc_emails"),
});

export const insertHrLetterSchema = createInsertSchema(hrLetters).omit({
  id: true,
  createdAt: true,
  approvedBy: true,
  approvedAt: true,
  issuedBy: true,
  issuedAt: true,
  revokedBy: true,
  revokedAt: true,
  referenceNumber: true,
  authCode: true,
  documentHash: true,
});

// ==========================================
// PERFORMANCE MANAGEMENT SYSTEM
// ==========================================

export const performanceGoalStatusEnum = pgEnum("performance_goal_status", ["not_started", "in_progress", "completed", "cancelled"]);
export const performanceGoalCategoryEnum = pgEnum("performance_goal_category", ["individual", "team", "company", "development"]);
export const checkInStatusEnum = pgEnum("check_in_status", ["scheduled", "completed", "cancelled"]);
export const reviewCycleTypeEnum = pgEnum("review_cycle_type", ["annual", "semi_annual", "quarterly"]);
export const reviewCycleStatusEnum = pgEnum("review_cycle_status", ["draft", "active", "in_review", "closed"]);
export const reviewTypeEnum = pgEnum("review_type", ["self", "manager"]);
export const reviewStatusEnum = pgEnum("review_status", ["pending", "submitted"]);
export const feedbackTypeEnum = pgEnum("feedback_type", ["praise", "constructive", "general"]);

export const performanceGoals = pgTable("performance_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  managerId: varchar("manager_id").references(() => adminUsers.id),
  title: varchar("title").notNull(),
  description: text("description"),
  category: performanceGoalCategoryEnum("category").notNull().default("individual"),
  startDate: varchar("start_date"),
  targetDate: varchar("target_date"),
  weight: integer("weight").default(0),
  status: performanceGoalStatusEnum("status").notNull().default("not_started"),
  progress: integer("progress").notNull().default(0),
  rayoAcademyTrackId: varchar("rayo_academy_track_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  managerId: varchar("manager_id").references(() => adminUsers.id),
  scheduledDate: varchar("scheduled_date").notNull(),
  status: checkInStatusEnum("status").notNull().default("scheduled"),
  employeeNotes: text("employee_notes"),
  managerNotes: text("manager_notes"),
  actionItems: text("action_items"),
  rating: integer("rating"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reviewCycles = pgTable("review_cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  startDate: varchar("start_date").notNull(),
  endDate: varchar("end_date").notNull(),
  type: reviewCycleTypeEnum("type").notNull().default("annual"),
  status: reviewCycleStatusEnum("status").notNull().default("draft"),
  createdBy: varchar("created_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull().references(() => reviewCycles.id),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  reviewerId: varchar("reviewer_id").notNull().references(() => adminUsers.id),
  type: reviewTypeEnum("type").notNull().default("self"),
  goalsReflection: text("goals_reflection"),
  strengths: text("strengths"),
  improvements: text("improvements"),
  developmentNeeds: text("development_needs"),
  rating: integer("rating"),
  comments: text("comments"),
  status: reviewStatusEnum("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const performanceFeedback = pgTable("performance_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEmployeeId: varchar("from_employee_id").notNull().references(() => adminUsers.id),
  toEmployeeId: varchar("to_employee_id").notNull().references(() => adminUsers.id),
  type: feedbackTypeEnum("type").notNull().default("general"),
  message: text("message").notNull(),
  goalId: varchar("goal_id").references(() => performanceGoals.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const performanceGoalsRelations = relations(performanceGoals, ({ one }) => ({
  employee: one(adminUsers, { fields: [performanceGoals.employeeId], references: [adminUsers.id], relationName: "goalEmployee" }),
  manager: one(adminUsers, { fields: [performanceGoals.managerId], references: [adminUsers.id], relationName: "goalManager" }),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
  employee: one(adminUsers, { fields: [checkIns.employeeId], references: [adminUsers.id], relationName: "checkInEmployee" }),
  manager: one(adminUsers, { fields: [checkIns.managerId], references: [adminUsers.id], relationName: "checkInManager" }),
}));

export const reviewCyclesRelations = relations(reviewCycles, ({ one, many }) => ({
  creator: one(adminUsers, { fields: [reviewCycles.createdBy], references: [adminUsers.id], relationName: "cycleCreator" }),
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  cycle: one(reviewCycles, { fields: [reviews.cycleId], references: [reviewCycles.id] }),
  employee: one(adminUsers, { fields: [reviews.employeeId], references: [adminUsers.id], relationName: "reviewEmployee" }),
  reviewer: one(adminUsers, { fields: [reviews.reviewerId], references: [adminUsers.id], relationName: "reviewReviewer" }),
}));

export const performanceFeedbackRelations = relations(performanceFeedback, ({ one }) => ({
  fromEmployee: one(adminUsers, { fields: [performanceFeedback.fromEmployeeId], references: [adminUsers.id], relationName: "feedbackFrom" }),
  toEmployee: one(adminUsers, { fields: [performanceFeedback.toEmployeeId], references: [adminUsers.id], relationName: "feedbackTo" }),
  goal: one(performanceGoals, { fields: [performanceFeedback.goalId], references: [performanceGoals.id] }),
}));

export const insertPerformanceGoalSchema = createInsertSchema(performanceGoals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCheckInSchema = createInsertSchema(checkIns).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertReviewCycleSchema = createInsertSchema(reviewCycles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true, submittedAt: true });
export const insertPerformanceFeedbackSchema = createInsertSchema(performanceFeedback).omit({ id: true, createdAt: true });

// ==========================================
// ONBOARDING TRAINING SYSTEM
// ==========================================

// Learning tracks (e.g. "Common Onboarding", "Healthcare SOP")
export const learningTracks = pgTable("learning_tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  targetRole: varchar("target_role"), // null = all roles
  targetDepartmentId: varchar("target_department_id").references(() => departments.id),
  version: varchar("version").notNull().default("1.0"),
  status: varchar("status").notNull().default("draft"), // draft | published | archived
  createdBy: varchar("created_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Ordered sections inside a learning track
export const trackSections = pgTable("track_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trackId: varchar("track_id").notNull().references(() => learningTracks.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  body: text("body").notNull().default(""), // markdown / rich text
  orderIndex: integer("order_index").notNull().default(0),
  minDwellSeconds: integer("min_dwell_seconds").notNull().default(30),
  estimatedMinutes: integer("estimated_minutes").notNull().default(5),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inline quiz question per section (one per section)
export const sectionQuizQuestions = pgTable("section_quiz_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull().references(() => trackSections.id, { onDelete: "cascade" }).unique(),
  questionText: text("question_text").notNull(),
  explanation: text("explanation"), // shown after answering
  createdAt: timestamp("created_at").defaultNow(),
});

// Answer options for quiz questions
export const sectionQuizOptions = pgTable("section_quiz_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull().references(() => sectionQuizQuestions.id, { onDelete: "cascade" }),
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  orderIndex: integer("order_index").notNull().default(0),
});

// Track assigned to an employee
export const trackAssignments = pgTable("track_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trackId: varchar("track_id").notNull().references(() => learningTracks.id),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  assignedBy: varchar("assigned_by").references(() => adminUsers.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  dueDate: timestamp("due_date"),
  status: varchar("status").notNull().default("not_started"), // not_started | in_progress | completed
  completedAt: timestamp("completed_at"),
});

// Per-section progress for an assignment
export const sectionProgress = pgTable("section_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => trackAssignments.id, { onDelete: "cascade" }),
  sectionId: varchar("section_id").notNull().references(() => trackSections.id),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  status: varchar("status").notNull().default("not_started"), // not_started | in_progress | completed
  dwellSeconds: integer("dwell_seconds").notNull().default(0),
  quizPassed: boolean("quiz_passed"),
  quizAttempts: integer("quiz_attempts").notNull().default(0),
  completedAt: timestamp("completed_at"),
  lastViewedAt: timestamp("last_viewed_at"),
});

// Immutable section acknowledgements (digital sign-off)
export const sectionAcknowledgements = pgTable("section_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => trackAssignments.id),
  sectionId: varchar("section_id").notNull().references(() => trackSections.id),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  typedName: varchar("typed_name").notNull(),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
  ipAddress: varchar("ip_address"),
  documentHash: varchar("document_hash"), // sha256 of section body at time of ack
});

// Track completion receipts
export const trackCompletions = pgTable("track_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => trackAssignments.id).unique(),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  completedAt: timestamp("completed_at").defaultNow(),
  receiptHash: varchar("receipt_hash"), // sha256 of all ack hashes concatenated
  receiptData: jsonb("receipt_data"), // snapshot of all acknowledgements
});

// Immutable audit event stream
export const onboardingAuditEvents = pgTable("onboarding_audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => adminUsers.id),
  trackId: varchar("track_id"),
  sectionId: varchar("section_id"),
  assignmentId: varchar("assignment_id"),
  eventType: varchar("event_type").notNull(), // section_viewed | quiz_answered | section_acknowledged | track_completed | track_assigned | track_published
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Training extension requests (due date extension for overdue assignments)
export const trainingExtensionRequests = pgTable("training_extension_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => trackAssignments.id),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  requestedById: varchar("requested_by_id").notNull().references(() => adminUsers.id),
  reason: text("reason").notNull(),
  newDueDate: timestamp("new_due_date").notNull(),
  status: varchar("status").notNull().default("pending"), // pending | endorsed | approved | rejected
  endorsedById: varchar("endorsed_by_id").references(() => adminUsers.id),
  endorsedAt: timestamp("endorsed_at"),
  endorserComment: text("endorser_comment"),
  resolvedById: varchar("resolved_by_id").references(() => adminUsers.id),
  resolvedAt: timestamp("resolved_at"),
  resolverComment: text("resolver_comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertTrainingExtensionRequestSchema = createInsertSchema(trainingExtensionRequests).omit({ id: true, endorsedById: true, endorsedAt: true, endorserComment: true, resolvedById: true, resolvedAt: true, resolverComment: true, createdAt: true });
export const insertLearningTrackSchema = createInsertSchema(learningTracks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTrackSectionSchema = createInsertSchema(trackSections).omit({ id: true, createdAt: true });
export const insertSectionQuizQuestionSchema = createInsertSchema(sectionQuizQuestions).omit({ id: true, createdAt: true });
export const insertSectionQuizOptionSchema = createInsertSchema(sectionQuizOptions).omit({ id: true });
export const insertTrackAssignmentSchema = createInsertSchema(trackAssignments).omit({ id: true, assignedAt: true, completedAt: true });
export const insertSectionProgressSchema = createInsertSchema(sectionProgress).omit({ id: true, completedAt: true, lastViewedAt: true });
export const insertSectionAcknowledgementSchema = createInsertSchema(sectionAcknowledgements).omit({ id: true, acknowledgedAt: true });
export const insertTrackCompletionSchema = createInsertSchema(trackCompletions).omit({ id: true, completedAt: true });
export const insertOnboardingAuditEventSchema = createInsertSchema(onboardingAuditEvents).omit({ id: true, createdAt: true });

// ==========================================
// OFFER LETTER ADDENDUMS
// ==========================================

export const offerLetterAddendumTypeEnum = pgEnum("offer_letter_addendum_type", [
  "salary_revision",
  "role_change",
  "probation_extension",
  "combined",
  "custom",
  "device_allocation",
]);

export const offerLetterAddendumStatusEnum = pgEnum("offer_letter_addendum_status", [
  "draft",
  "sent",
  "accepted",
  "countersigned",
  "cancelled",
]);

export const offerLetterAddendums = pgTable("offer_letter_addendums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  offerLetterId: varchar("offer_letter_id").notNull().references(() => offerLetters.id),
  token: varchar("token").notNull().unique(),
  addendumType: offerLetterAddendumTypeEnum("addendum_type").notNull(),
  status: offerLetterAddendumStatusEnum("status").notNull().default("draft"),

  oldDesignation: varchar("old_designation"),
  newDesignation: varchar("new_designation"),
  oldDepartment: varchar("old_department"),
  newDepartment: varchar("new_department"),
  oldSalary: varchar("old_salary"),
  newSalary: varchar("new_salary"),
  oldSalaryInWords: varchar("old_salary_in_words"),
  newSalaryInWords: varchar("new_salary_in_words"),
  oldConfirmationDate: varchar("old_confirmation_date"),
  newConfirmationDate: varchar("new_confirmation_date"),
  customClauseTitle: varchar("custom_clause_title"),
  customClauseText: text("custom_clause_text"),
  deviceItems: jsonb("device_items"),
  ccEmails: text("cc_emails"),

  effectiveDate: varchar("effective_date"),
  reason: text("reason"),

  hrManagerName: varchar("hr_manager_name"),
  issuedBy: varchar("issued_by").references(() => adminUsers.id),
  issuedAt: timestamp("issued_at"),
  candidateName: varchar("candidate_name").notNull(),

  acceptedAt: timestamp("accepted_at"),
  acceptedIp: varchar("accepted_ip"),
  acceptedName: varchar("accepted_name"),
  authCode: varchar("auth_code"),
  documentHash: varchar("document_hash"),

  counterSignedBy: varchar("counter_signed_by").references(() => adminUsers.id),
  counterSignedAt: timestamp("counter_signed_at"),
  counterAuthCode: varchar("counter_auth_code"),
  counterDocumentHash: varchar("counter_document_hash"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOfferLetterAddendumSchema = createInsertSchema(offerLetterAddendums).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
  acceptedIp: true,
  acceptedName: true,
  authCode: true,
  documentHash: true,
  counterSignedBy: true,
  counterSignedAt: true,
  counterAuthCode: true,
  counterDocumentHash: true,
  issuedAt: true,
});

export type OfferLetterAddendum = typeof offerLetterAddendums.$inferSelect;
export type InsertOfferLetterAddendum = z.infer<typeof insertOfferLetterAddendumSchema>;

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

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: varchar("type").notNull(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export interface AdminUsersResponse {
  users: AdminUser[];
  counts: { active: number; disabled: number; relieved: number; left_company: number; deleted: number };
}
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
export type LearningTrack = typeof learningTracks.$inferSelect;
export type InsertLearningTrack = z.infer<typeof insertLearningTrackSchema>;
export type TrackSection = typeof trackSections.$inferSelect;
export type InsertTrackSection = z.infer<typeof insertTrackSectionSchema>;
export type SectionQuizQuestion = typeof sectionQuizQuestions.$inferSelect;
export type InsertSectionQuizQuestion = z.infer<typeof insertSectionQuizQuestionSchema>;
export type SectionQuizOption = typeof sectionQuizOptions.$inferSelect;
export type InsertSectionQuizOption = z.infer<typeof insertSectionQuizOptionSchema>;
export type TrackAssignment = typeof trackAssignments.$inferSelect;
export type InsertTrackAssignment = z.infer<typeof insertTrackAssignmentSchema>;
export type SectionProgress = typeof sectionProgress.$inferSelect;
export type InsertSectionProgress = z.infer<typeof insertSectionProgressSchema>;
export type SectionAcknowledgement = typeof sectionAcknowledgements.$inferSelect;
export type InsertSectionAcknowledgement = z.infer<typeof insertSectionAcknowledgementSchema>;
export type TrackCompletion = typeof trackCompletions.$inferSelect;
export type InsertTrackCompletion = z.infer<typeof insertTrackCompletionSchema>;
export type OnboardingAuditEvent = typeof onboardingAuditEvents.$inferSelect;
export type InsertOnboardingAuditEvent = z.infer<typeof insertOnboardingAuditEventSchema>;
export type TrainingExtensionRequest = typeof trainingExtensionRequests.$inferSelect;
export type InsertTrainingExtensionRequest = z.infer<typeof insertTrainingExtensionRequestSchema>;
export type PerformanceGoal = typeof performanceGoals.$inferSelect;
export type InsertPerformanceGoal = z.infer<typeof insertPerformanceGoalSchema>;
export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type ReviewCycle = typeof reviewCycles.$inferSelect;
export type InsertReviewCycle = z.infer<typeof insertReviewCycleSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type PerformanceFeedback = typeof performanceFeedback.$inferSelect;
export type InsertPerformanceFeedback = z.infer<typeof insertPerformanceFeedbackSchema>;
export type HrLetter = typeof hrLetters.$inferSelect;
export type InsertHrLetter = z.infer<typeof insertHrLetterSchema>;

// ==========================================
// LETTER TEMPLATE SENTENCES (configurable via admin)
// ==========================================

export const letterTemplateSentences = pgTable("letter_template_sentences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull(),
  category: varchar("category").notNull(),
  label: varchar("label").notNull(),
  sentence: text("sentence").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  uniqueIndex("uq_letter_template_key_category").on(t.key, t.category),
]);

export const insertLetterTemplateSentenceSchema = createInsertSchema(letterTemplateSentences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type LetterTemplateSentence = typeof letterTemplateSentences.$inferSelect;
export type InsertLetterTemplateSentence = z.infer<typeof insertLetterTemplateSentenceSchema>;

// ==========================================
// ROLE SUMMARY TEMPLATES (configurable role library)
// ==========================================

export const roleSummaryTemplates = pgTable("role_summary_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleKey: varchar("role_key").notNull().unique(),
  roleFamily: varchar("role_family").notNull(),
  vertical: varchar("vertical").notNull(),
  level: varchar("level").notNull(),
  roleLabel: varchar("role_label").notNull(),
  defaultSummary: text("default_summary").notNull(),
  alternateSummary: text("alternate_summary").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRoleSummaryTemplateSchema = createInsertSchema(roleSummaryTemplates).omit({
  id: true,
  createdAt: true,
});
export type RoleSummaryTemplate = typeof roleSummaryTemplates.$inferSelect;
export type InsertRoleSummaryTemplate = z.infer<typeof insertRoleSummaryTemplateSchema>;
