import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, pgEnum, date, numeric, uniqueIndex, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// User roles enum
export const userRoleEnum = pgEnum("user_role", ["super_admin", "admin", "hr", "finance", "operations", "manager", "recruiter", "employee"]);

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
  gender: varchar("gender"),
  totpSecret: varchar("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  employmentStatus: employmentStatusEnum("employment_status").default("active"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  deletedAt: timestamp("deleted_at"),
  shiftId: varchar("shift_id"),
  attendanceExempt: boolean("attendance_exempt").notNull().default(false),
  trainingExempt: boolean("training_exempt").notNull().default(false),
  maternityLeaveEligible: boolean("maternity_leave_eligible").notNull().default(false),
  employmentType: varchar("employment_type"),
  employeeCategory: varchar("employee_category").default("experienced"),
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
  isCorrect: boolean("is_corrected").notNull().default(false),
  correctionSource: varchar("correction_source"),
  correctedById: varchar("corrected_by_id").references(() => adminUsers.id),
  correctionNote: text("correction_note"),
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
  // If true, accrual is conditional on min_hours_for_accrual threshold (EL).
  // If false, accrual is unconditional — only 30-day employment check applies (SL).
  // LEGAL NOTE: Delhi S&E Act requires minimum 12 combined casual/sick days per year.
  // Client has instructed 8 Sick Leave days following UP/Haryana policy.
  // Flag for legal review before production deployment.
  isConditional: boolean("is_conditional").notNull().default(true),
  carryForwardCap: integer("carry_forward_cap").default(0),
  // If true, balance tracks occurrences (count-based) rather than days — used for Emergency Leave (EML).
  // totalDays field holds max occurrences, usedDays holds occurrences consumed.
  occurrenceBased: boolean("occurrence_based").notNull().default(false),
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
  halfDay: boolean("half_day").notNull().default(false),
  halfDayPart: varchar("half_day_part"), // 'first' | 'second'
  splitPaidDays: numeric("split_paid_days"), // paid portion when request is split with LWP
  splitLwpDays: numeric("split_lwp_days"),   // LWP portion; null = no split
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
  accrualType: varchar("accrual_type").notNull().default("monthly"), // 'monthly' | 'monthly+bonus' | 'year_end_carry_forward' | 'year_end_lapse'
  skipReason: text("skip_reason"),
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
  lopLeaves: numeric("lop_leaves").default("0"),
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
  role: z.enum(["super_admin", "admin", "hr", "finance", "operations", "manager", "recruiter", "employee"]).default("employee"),
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
  annexureData: jsonb("annexure_data"),
  candidateTitle: varchar("candidate_title"),
  candidateName: varchar("candidate_name").notNull(),
  candidatePersonalEmail: varchar("candidate_personal_email").notNull(),
  candidateAddress: varchar("candidate_address"),
  designation: varchar("designation").notNull(),
  subjectDesignation: varchar("subject_designation"),
  reportingToUserId: varchar("reporting_to_user_id"),
  departmentId: varchar("department_id"),
  gender: varchar("gender"),
  employmentType: varchar("employment_type"),
  attendanceExempt: boolean("attendance_exempt").notNull().default(false),
  trainingExempt: boolean("training_exempt").notNull().default(false),
  maternityLeaveEligible: boolean("maternity_leave_eligible").notNull().default(false),
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
  probationSalary: numeric("probation_salary"),
  probationSalaryInWords: varchar("probation_salary_in_words"),
  postProbationSalary: numeric("post_probation_salary"),
  postProbationSalaryInWords: varchar("post_probation_salary_in_words"),
  probationPeriodMonths: integer("probation_period_months").default(3),
  extendedProbationMonths: integer("extended_probation_months"),
  performanceProbationReview: boolean("performance_probation_review").notNull().default(false),
  maxRevisionSalary: numeric("max_revision_salary"),
  maxRevisionSalaryInWords: varchar("max_revision_salary_in_words"),
  performanceClauseText: text("performance_clause_text"),
  policyAnnexures: text("policy_annexures").array(),
  seedProbationPlan: boolean("seed_probation_plan").notNull().default(false),
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
  "salary_revision",
  "role_change",
  "combined",
  "device_allocation",
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
  metadata: jsonb("metadata"),
  manualEmployeeEmail: varchar("manual_employee_email"),
  annexureData: jsonb("annexure_data"),
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
  autoProgressFromMilestones: boolean("auto_progress_from_milestones").notNull().default(false),
  rayoAcademyTrackId: varchar("rayo_academy_track_id"),
  sourceRef: varchar("source_ref"),
  planId: varchar("plan_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const goalMilestones = pgTable("goal_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").notNull().references(() => performanceGoals.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  targetDate: varchar("target_date"),
  done: boolean("done").notNull().default(false),
  completedAt: timestamp("completed_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const checkInTypeEnum = pgEnum("check_in_type", ["milestone", "weekly", "pip_review", "weekly_update"]);

export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  managerId: varchar("manager_id").references(() => adminUsers.id),
  goalId: varchar("goal_id").references(() => performanceGoals.id, { onDelete: "set null" }),
  planId: varchar("plan_id"),
  checkInType: checkInTypeEnum("check_in_type").default("milestone"),
  scheduledDate: varchar("scheduled_date").notNull(),
  status: checkInStatusEnum("status").notNull().default("scheduled"),
  employeeNotes: text("employee_notes"),
  managerNotes: text("manager_notes"),
  actionItems: text("action_items"),
  rating: integer("rating"),
  reviewScores: jsonb("review_scores"),
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

// ==========================================
// HEALTHCARE PLANS (Probation / Growth / PIP)
// ==========================================

export const employeePlanTypeEnum = pgEnum("employee_plan_type", ["probation", "growth", "pip"]);
export const employeePlanDeptScopeEnum = pgEnum("employee_plan_dept_scope", ["healthcare"]);
export const employeePlanStatusEnum = pgEnum("employee_plan_status", ["pending", "active", "completed", "extended", "closed"]);
export const employeePlanOutcomeEnum = pgEnum("employee_plan_outcome", ["confirmed", "extended", "released", "passed", "terminated", "rolled_over"]);

export const employeePlans = pgTable("employee_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  managerId: varchar("manager_id").references(() => adminUsers.id),
  planType: employeePlanTypeEnum("plan_type").notNull(),
  departmentScope: employeePlanDeptScopeEnum("department_scope").notNull().default("healthcare"),
  status: employeePlanStatusEnum("status").notNull().default("pending"),
  outcome: employeePlanOutcomeEnum("outcome"),
  startDate: varchar("start_date").notNull(),
  endDate: varchar("end_date").notNull(),
  durationDays: integer("duration_days").notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by").references(() => adminUsers.id),
  createdBy: varchar("created_by").notNull().references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const planGoalTemplates = pgTable("plan_goal_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planType: employeePlanTypeEnum("plan_type").notNull(),
  roleSlug: varchar("role_slug").notNull(),
  departmentScope: employeePlanDeptScopeEnum("department_scope").notNull().default("healthcare"),
  goalTitle: varchar("goal_title").notNull(),
  goalCategory: varchar("goal_category").notNull().default("individual"),
  goalDescription: text("goal_description"),
  targetMetric: varchar("target_metric"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmployeePlanSchema = createInsertSchema(employeePlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acknowledgedAt: true,
  acknowledgedBy: true,
});

export const insertPlanGoalTemplateSchema = createInsertSchema(planGoalTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmployeePlan = typeof employeePlans.$inferSelect;
export type InsertEmployeePlan = z.infer<typeof insertEmployeePlanSchema>;
export type PlanGoalTemplate = typeof planGoalTemplates.$inferSelect;
export type InsertPlanGoalTemplate = z.infer<typeof insertPlanGoalTemplateSchema>;

export const employeePlansRelations = relations(employeePlans, ({ one }) => ({
  employee: one(adminUsers, { fields: [employeePlans.employeeId], references: [adminUsers.id], relationName: "planEmployee" }),
  manager: one(adminUsers, { fields: [employeePlans.managerId], references: [adminUsers.id], relationName: "planManager" }),
  acknowledger: one(adminUsers, { fields: [employeePlans.acknowledgedBy], references: [adminUsers.id], relationName: "planAcknowledger" }),
  creator: one(adminUsers, { fields: [employeePlans.createdBy], references: [adminUsers.id], relationName: "planCreator" }),
}));

export const performanceGoalsRelations = relations(performanceGoals, ({ one, many }) => ({
  employee: one(adminUsers, { fields: [performanceGoals.employeeId], references: [adminUsers.id], relationName: "goalEmployee" }),
  manager: one(adminUsers, { fields: [performanceGoals.managerId], references: [adminUsers.id], relationName: "goalManager" }),
  milestones: many(goalMilestones),
  checkIns: many(checkIns),
}));

export const goalMilestonesRelations = relations(goalMilestones, ({ one }) => ({
  goal: one(performanceGoals, { fields: [goalMilestones.goalId], references: [performanceGoals.id] }),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
  employee: one(adminUsers, { fields: [checkIns.employeeId], references: [adminUsers.id], relationName: "checkInEmployee" }),
  manager: one(adminUsers, { fields: [checkIns.managerId], references: [adminUsers.id], relationName: "checkInManager" }),
  goal: one(performanceGoals, { fields: [checkIns.goalId], references: [performanceGoals.id] }),
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
export const insertGoalMilestoneSchema = createInsertSchema(goalMilestones).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
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
  isPolicyTrack: boolean("is_policy_track").notNull().default(false),
  isUniversal: boolean("is_universal").notNull().default(false),
  versionNumber: integer("version_number").notNull().default(1),
  publishedAt: timestamp("published_at"),
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
  status: varchar("status").notNull().default("not_started"), // not_started | in_progress | completed | excepted
  completedAt: timestamp("completed_at"),
  exceptionGrantedById: varchar("exception_granted_by_id").references(() => adminUsers.id),
  exceptionGrantedAt: timestamp("exception_granted_at"),
  exceptionReason: text("exception_reason"),
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
  signedVersion: integer("signed_version"), // track versionNumber at time of signing (policy tracks)
});

// Track completion receipts
export const trackCompletions = pgTable("track_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => trackAssignments.id).unique(),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  completedAt: timestamp("completed_at").defaultNow(),
  receiptHash: varchar("receipt_hash"), // sha256 of all ack hashes concatenated
  receiptData: jsonb("receipt_data"), // snapshot of all acknowledgements
  signedVersion: integer("signed_version"), // track versionNumber at time of completion (policy tracks)
});

// Night Shift Consent records (Female employees, 12-month expiry)
export const nightShiftConsents = pgTable("night_shift_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  typedName: varchar("typed_name").notNull(),
  ipAddress: varchar("ip_address"),
  isActive: boolean("is_active").notNull().default(true),
  documentHash: varchar("document_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  // Lifecycle status: active | expired | withdrawn
  status: varchar("status").notNull().default("active"),
  withdrawnAt: timestamp("withdrawn_at"),
  version: integer("version").notNull().default(1),
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
  requestType: varchar("request_type").notNull().default("extension"), // extension | exception
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
export const insertNightShiftConsentSchema = createInsertSchema(nightShiftConsents).omit({ id: true, createdAt: true, signedAt: true });

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
  offerLetterId: varchar("offer_letter_id").references(() => offerLetters.id),
  isStandalone: boolean("is_standalone").notNull().default(false),
  manualEmployeeData: jsonb("manual_employee_data"),
  forEmployeeId: varchar("for_employee_id").references(() => adminUsers.id),
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
  annexures: jsonb("annexures"),
  ccEmails: text("cc_emails"),

  includeGrowthPlanClause: boolean("include_growth_plan_clause").notNull().default(false),
  growthPlanCurrentSalary: varchar("growth_plan_current_salary"),
  growthPlanMaxRevisionSalary: varchar("growth_plan_max_revision_salary"),
  growthPlanClauseText: text("growth_plan_clause_text"),

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
export type NightShiftConsent = typeof nightShiftConsents.$inferSelect;
export type InsertNightShiftConsent = z.infer<typeof insertNightShiftConsentSchema>;
export type PerformanceGoal = typeof performanceGoals.$inferSelect;
export type InsertPerformanceGoal = z.infer<typeof insertPerformanceGoalSchema>;
export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type InsertGoalMilestone = z.infer<typeof insertGoalMilestoneSchema>;
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
// CLIENT CONTRACT GENERATION MODULE
// ==========================================

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "pending_dispatch_approval",
  "sent",
  "client_signed",
  "countersigned",
  "cancelled",
]);

export const contractSourceEnum = pgEnum("contract_source", [
  "generated",
  "imported",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "scheduled",
  "sent",
  "paid",
  "overdue",
  "cancelled",
]);

export const contractClients = pgTable("contract_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  address: text("address"),
  signatoryName: varchar("signatory_name"),
  signatoryTitle: varchar("signatory_title"),
  email: varchar("email"),
  phone: varchar("phone"),
  website: varchar("website"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contractTemplates = pgTable("contract_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  filePath: varchar("file_path").notNull(),
  placeholderList: jsonb("placeholder_list").notNull().default(sql`'[]'::jsonb`),
  // Optional: link this template to a specific client. NULL = generic (available for any client).
  clientId: varchar("client_id").references(() => contractClients.id),
  uploadedBy: varchar("uploaded_by").references(() => adminUsers.id),
  usageCount: integer("usage_count").notNull().default(0),
  // Marks this as the default template for its associated client
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: contractSourceEnum("source").notNull().default("generated"),
  templateId: varchar("template_id").references(() => contractTemplates.id),
  clientId: varchar("client_id").references(() => contractClients.id),
  templateName: varchar("template_name"),
  clientName: varchar("client_name").notNull(),
  candidateName: varchar("candidate_name"),
  candidateRole: varchar("candidate_role"),
  // Multi-candidate support: array of {name, role, startDate, location, engagementType}
  candidates: jsonb("candidates").default(sql`'[]'::jsonb`),
  variableValues: jsonb("variable_values").notNull().default(sql`'{}'::jsonb`),
  docxPath: varchar("docx_path"),
  // For imported contracts: store the uploaded file path
  uploadedDocPath: varchar("uploaded_doc_path"),
  // Contract dates & commercial terms
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  agreementDate: varchar("agreement_date"), // formatted as "04 May 2026"
  marginPerHour: varchar("margin_per_hour"),
  paymentTermsDays: integer("payment_terms_days"), // e.g. 30 for Net 30
  billingFrequency: varchar("billing_frequency"), // weekly | bi_weekly | monthly | milestone
  notes: text("notes"),
  status: contractStatusEnum("status").notNull().default("draft"),
  signingToken: varchar("signing_token").unique(),
  referenceNumber: varchar("reference_number").unique(),
  signedAt: timestamp("signed_at"),
  documentHash: varchar("document_hash"),
  authCode: varchar("auth_code"),
  clientSignedAt: timestamp("client_signed_at"),
  clientSignedIp: varchar("client_signed_ip"),
  countersignedBy: varchar("countersigned_by").references(() => adminUsers.id),
  countersignedAt: timestamp("countersigned_at"),
  sentAt: timestamp("sent_at"),
  // Dispatch workflow fields
  ccRecipients: jsonb("cc_recipients").default(sql`'[]'::jsonb`),
  rejectionReason: text("rejection_reason"),
  dispatchMethod: varchar("dispatch_method"), // esign_link | presigned_pdf | both
  dispatchRecipientEmail: varchar("dispatch_recipient_email"), // stored at request-for-approval time
  createdBy: varchar("created_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice tracking — one record per scheduled/sent invoice per contract
export const contractInvoices = pgTable("contract_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  invoiceNumber: varchar("invoice_number"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  dueDate: date("due_date"),
  amount: numeric("amount"),
  currency: varchar("currency").notNull().default("USD"),
  status: invoiceStatusEnum("status").notNull().default("scheduled"),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContractClientSchema = createInsertSchema(contractClients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  signingToken: true,
  referenceNumber: true,
  signedAt: true,
  documentHash: true,
  authCode: true,
  clientSignedAt: true,
  clientSignedIp: true,
  countersignedBy: true,
  countersignedAt: true,
  sentAt: true,
});

export const insertContractInvoiceSchema = createInsertSchema(contractInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  paidAt: true,
  reminderSentAt: true,
});

export type ContractClient = typeof contractClients.$inferSelect;
export type InsertContractClient = z.infer<typeof insertContractClientSchema>;
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type ContractInvoice = typeof contractInvoices.$inferSelect;
export type InsertContractInvoice = z.infer<typeof insertContractInvoiceSchema>;

// ==========================================
// SHIFT SYSTEM
// ==========================================

export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  displayLabel: varchar("display_label").notNull(),
  usCoverage: varchar("us_coverage").notNull(),
  istStartDst: varchar("ist_start_dst").notNull(),
  istEndDst: varchar("ist_end_dst").notNull(),
  istStartStd: varchar("ist_start_std").notNull(),
  istEndStd: varchar("ist_end_std").notNull(),
  scheduledHours: integer("scheduled_hours").notNull().default(9),
  gracePeriodMinutes: integer("grace_period_minutes").default(15),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dstConfig = pgTable("dst_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull().unique(),
  springForwardDate: varchar("spring_forward_date").notNull(),
  fallBackDate: varchar("fall_back_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shiftAssignmentLog = pgTable("shift_assignment_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  changedById: varchar("changed_by_id").notNull().references(() => adminUsers.id),
  oldShiftId: varchar("old_shift_id").references(() => shifts.id),
  newShiftId: varchar("new_shift_id").references(() => shifts.id),
  reason: text("reason").notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
});

export const shiftsRelations = relations(shifts, ({ many }) => ({
  assignmentLogs: many(shiftAssignmentLog),
}));

export const dstConfigRelations = relations(dstConfig, ({ }) => ({}));

export const shiftAssignmentLogRelations = relations(shiftAssignmentLog, ({ one }) => ({
  user: one(adminUsers, {
    fields: [shiftAssignmentLog.userId],
    references: [adminUsers.id],
    relationName: "shiftLogUser",
  }),
  changedBy: one(adminUsers, {
    fields: [shiftAssignmentLog.changedById],
    references: [adminUsers.id],
    relationName: "shiftLogChanger",
  }),
  oldShift: one(shifts, {
    fields: [shiftAssignmentLog.oldShiftId],
    references: [shifts.id],
    relationName: "shiftLogOld",
  }),
  newShift: one(shifts, {
    fields: [shiftAssignmentLog.newShiftId],
    references: [shifts.id],
    relationName: "shiftLogNew",
  }),
}));

export const insertShiftAssignmentLogSchema = createInsertSchema(shiftAssignmentLog).omit({
  id: true,
  changedAt: true,
});
export type Shift = typeof shifts.$inferSelect;
export type DstConfig = typeof dstConfig.$inferSelect;
export type ShiftAssignmentLog = typeof shiftAssignmentLog.$inferSelect;
export type InsertShiftAssignmentLog = z.infer<typeof insertShiftAssignmentLogSchema>;

// ==========================================
// BREAK RECORDS (for punch/break system)
// ==========================================

export const breakTypeEnum = pgEnum("break_type", ["lunch", "tea"]);

export const breakRecords = pgTable("break_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attendanceId: varchar("attendance_id").references(() => attendance.id),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  date: varchar("date").notNull(),
  breakType: breakTypeEnum("break_type").notNull(),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  durationMinutes: numeric("duration_minutes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const breakRecordsRelations = relations(breakRecords, ({ one }) => ({
  attendance: one(attendance, {
    fields: [breakRecords.attendanceId],
    references: [attendance.id],
  }),
  user: one(adminUsers, {
    fields: [breakRecords.userId],
    references: [adminUsers.id],
  }),
}));

export const insertBreakRecordSchema = createInsertSchema(breakRecords).omit({
  id: true,
  createdAt: true,
});

export type InsertBreakRecord = z.infer<typeof insertBreakRecordSchema>;
export type BreakRecord = typeof breakRecords.$inferSelect;

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
// ATTENDANCE REGULARIZATION SYSTEM
// ==========================================

export const regularizationRequestTypeEnum = pgEnum("regularization_request_type", [
  "missed_punch_in",
  "missed_punch_out",
  "wrong_absent",
  "correction",
]);

export const regularizationStatusEnum = pgEnum("regularization_status", [
  "pending",
  "approved",
  "rejected",
]);

export const attendanceRegularizations = pgTable("attendance_regularizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  attendanceDate: varchar("attendance_date").notNull(),
  requestedPunchIn: timestamp("requested_punch_in"),
  requestedPunchOut: timestamp("requested_punch_out"),
  requestType: varchar("request_type").notNull(),
  reason: text("reason").notNull(),
  status: varchar("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewerComment: text("reviewer_comment"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const policyAcknowledgements = pgTable("policy_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  policyType: varchar("policy_type").notNull(),
  policyVersion: varchar("policy_version").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow(),
});

export const attendanceRegularizationsRelations = relations(attendanceRegularizations, ({ one }) => ({
  employee: one(adminUsers, {
    fields: [attendanceRegularizations.employeeId],
    references: [adminUsers.id],
    relationName: "regularizationEmployee",
  }),
  reviewer: one(adminUsers, {
    fields: [attendanceRegularizations.reviewedBy],
    references: [adminUsers.id],
    relationName: "regularizationReviewer",
  }),
}));

export const policyAcknowledgementsRelations = relations(policyAcknowledgements, ({ one }) => ({
  user: one(adminUsers, {
    fields: [policyAcknowledgements.userId],
    references: [adminUsers.id],
  }),
}));

export const insertAttendanceRegularizationSchema = createInsertSchema(attendanceRegularizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  reviewedBy: true,
  reviewerComment: true,
  reviewedAt: true,
});

export const insertPolicyAcknowledgementSchema = createInsertSchema(policyAcknowledgements).omit({
  id: true,
  acceptedAt: true,
});

export type AttendanceRegularization = typeof attendanceRegularizations.$inferSelect;
export type InsertAttendanceRegularization = z.infer<typeof insertAttendanceRegularizationSchema>;
export type PolicyAcknowledgement = typeof policyAcknowledgements.$inferSelect;
export type InsertPolicyAcknowledgement = z.infer<typeof insertPolicyAcknowledgementSchema>;

// ==========================================
// PRAISE BOARD SYSTEM
// ==========================================

export const praiseBadgeTypes = pgTable("praise_badge_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  emoji: varchar("emoji").notNull(),
  color: varchar("color").notNull(), // hex color
  description: varchar("description"),
});

export const praisePosts = pgTable("praise_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  giverId: varchar("giver_id").notNull().references(() => adminUsers.id),
  recipientId: varchar("recipient_id").notNull().references(() => adminUsers.id),
  badgeTypeId: varchar("badge_type_id").notNull().references(() => praiseBadgeTypes.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const praiseReactions = pgTable("praise_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => praisePosts.id, { onDelete: "cascade" }),
  reactorId: varchar("reactor_id").notNull().references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_praise_reaction_post_reactor").on(table.postId, table.reactorId),
]);

export const praiseComments = pgTable("praise_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => praisePosts.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => adminUsers.id),
  message: text("message").notNull(),
  parentCommentId: varchar("parent_comment_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pinnedPraisePosts = pgTable("pinned_praise_posts", {
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  postId: varchar("post_id").notNull().references(() => praisePosts.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("uq_pinned_praise_user_post").on(table.userId, table.postId),
]);

export const praiseBadgeTypesRelations = relations(praiseBadgeTypes, ({ many }) => ({
  posts: many(praisePosts),
}));

export const praisePostsRelations = relations(praisePosts, ({ one, many }) => ({
  giver: one(adminUsers, { fields: [praisePosts.giverId], references: [adminUsers.id], relationName: "praiseGiver" }),
  recipient: one(adminUsers, { fields: [praisePosts.recipientId], references: [adminUsers.id], relationName: "praiseRecipient" }),
  badgeType: one(praiseBadgeTypes, { fields: [praisePosts.badgeTypeId], references: [praiseBadgeTypes.id] }),
  reactions: many(praiseReactions),
  comments: many(praiseComments),
}));

export const praiseReactionsRelations = relations(praiseReactions, ({ one }) => ({
  post: one(praisePosts, { fields: [praiseReactions.postId], references: [praisePosts.id] }),
  reactor: one(adminUsers, { fields: [praiseReactions.reactorId], references: [adminUsers.id], relationName: "praiseReactor" }),
}));

export const praiseCommentsRelations = relations(praiseComments, ({ one }) => ({
  post: one(praisePosts, { fields: [praiseComments.postId], references: [praisePosts.id] }),
  author: one(adminUsers, { fields: [praiseComments.authorId], references: [adminUsers.id], relationName: "praiseCommentAuthor" }),
}));

export const pinnedPraisePostsRelations = relations(pinnedPraisePosts, ({ one }) => ({
  user: one(adminUsers, { fields: [pinnedPraisePosts.userId], references: [adminUsers.id], relationName: "pinnedUser" }),
  post: one(praisePosts, { fields: [pinnedPraisePosts.postId], references: [praisePosts.id] }),
}));

export const insertPraiseBadgeTypeSchema = createInsertSchema(praiseBadgeTypes).omit({ id: true });
export const insertPraisePostSchema = createInsertSchema(praisePosts).omit({ id: true, createdAt: true });
export const insertPraiseReactionSchema = createInsertSchema(praiseReactions).omit({ id: true, createdAt: true });
export const insertPraiseCommentSchema = createInsertSchema(praiseComments).omit({ id: true, createdAt: true });

export type PraiseBadgeType = typeof praiseBadgeTypes.$inferSelect;
export type InsertPraiseBadgeType = z.infer<typeof insertPraiseBadgeTypeSchema>;
export type PraisePost = typeof praisePosts.$inferSelect;
export type InsertPraisePost = z.infer<typeof insertPraisePostSchema>;
export type PraiseReaction = typeof praiseReactions.$inferSelect;
export type PraiseComment = typeof praiseComments.$inferSelect;

// ==========================================
// ROLE SUMMARY TEMPLATES (configurable role library)
// ==========================================

// ==========================================
// SALARY REPORT RUNS (approval gate)
// ==========================================

export const salaryReportStatusEnum = pgEnum("salary_report_status", ["pending_approval", "approved", "sent"]);

export const salaryReportRuns = pgTable("salary_report_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  status: salaryReportStatusEnum("status").notNull().default("pending_approval"),
  generatedAt: timestamp("generated_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => adminUsers.id),
  reportData: jsonb("report_data").notNull().default(sql`'[]'::jsonb`),
  adjustments: jsonb("adjustments").notNull().default(sql`'{}'::jsonb`),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSalaryReportRunSchema = createInsertSchema(salaryReportRuns).omit({
  id: true,
  createdAt: true,
  generatedAt: true,
});

export type SalaryReportRun = typeof salaryReportRuns.$inferSelect;
export type InsertSalaryReportRun = z.infer<typeof insertSalaryReportRunSchema>;

export const salaryReportRunsRelations = relations(salaryReportRuns, ({ one }) => ({
  approver: one(adminUsers, {
    fields: [salaryReportRuns.approvedBy],
    references: [adminUsers.id],
    relationName: "reportApprover",
  }),
}));

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

// ==========================================
// POLICY SIGNING SYSTEM
// ==========================================

export const policyDocuments = pgTable("policy_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  content: jsonb("content").notNull(), // array of {page: number, body: string}
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const policySigningRequests = pgTable("policy_signing_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyDocumentId: varchar("policy_document_id").notNull().references(() => policyDocuments.id),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  sentAt: timestamp("sent_at").defaultNow(),
  sentByUserId: varchar("sent_by_user_id").references(() => adminUsers.id),
  status: varchar("status").notNull().default("pending"), // pending | signed | cancelled
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const policySignatures = pgTable("policy_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signingRequestId: varchar("signing_request_id").notNull().references(() => policySigningRequests.id),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  signedAt: timestamp("signed_at").defaultNow(),
  ipAddress: varchar("ip_address"),
  pageInitials: jsonb("page_initials").notNull(), // array of {page: number, initial: string}
  finalSignature: varchar("final_signature").notNull(),
  pdfPath: varchar("pdf_path"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const policyDocumentsRelations = relations(policyDocuments, ({ many }) => ({
  signingRequests: many(policySigningRequests),
}));

export const policySigningRequestsRelations = relations(policySigningRequests, ({ one }) => ({
  policyDocument: one(policyDocuments, {
    fields: [policySigningRequests.policyDocumentId],
    references: [policyDocuments.id],
  }),
  employee: one(adminUsers, {
    fields: [policySigningRequests.employeeId],
    references: [adminUsers.id],
    relationName: "signingEmployee",
  }),
  sentBy: one(adminUsers, {
    fields: [policySigningRequests.sentByUserId],
    references: [adminUsers.id],
    relationName: "signingRequestSender",
  }),
  signature: one(policySignatures, {
    fields: [policySigningRequests.id],
    references: [policySignatures.signingRequestId],
  }),
}));

export const policySignaturesRelations = relations(policySignatures, ({ one }) => ({
  signingRequest: one(policySigningRequests, {
    fields: [policySignatures.signingRequestId],
    references: [policySigningRequests.id],
  }),
  employee: one(adminUsers, {
    fields: [policySignatures.employeeId],
    references: [adminUsers.id],
  }),
}));

export const insertPolicyDocumentSchema = createInsertSchema(policyDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPolicySigningRequestSchema = createInsertSchema(policySigningRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
});
export const insertPolicySignatureSchema = createInsertSchema(policySignatures).omit({
  id: true,
  createdAt: true,
  signedAt: true,
});

export type PolicyDocument = typeof policyDocuments.$inferSelect;
export type InsertPolicyDocument = z.infer<typeof insertPolicyDocumentSchema>;
export type PolicySigningRequest = typeof policySigningRequests.$inferSelect;
export type InsertPolicySigningRequest = z.infer<typeof insertPolicySigningRequestSchema>;
export type PolicySignature = typeof policySignatures.$inferSelect;
export type InsertPolicySignature = z.infer<typeof insertPolicySignatureSchema>;

// ==========================================
// Attendance Report Approval System
// ==========================================

export const attendanceReportRuns = pgTable("attendance_report_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  status: varchar("status").notNull().default("pending"),
  deadlineAt: timestamp("deadline_at"),
  createdBy: varchar("created_by").references(() => adminUsers.id),
  overrideBy: varchar("override_by").references(() => adminUsers.id),
  overrideNote: text("override_note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAttendanceReportRunSchema = createInsertSchema(attendanceReportRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AttendanceReportRunStatus = "pending" | "in_review" | "edits_pending_hr" | "approved" | "overridden" | "deadline_expired";
export type AttendanceReportRun = typeof attendanceReportRuns.$inferSelect;
export type InsertAttendanceReportRun = z.infer<typeof insertAttendanceReportRunSchema>;

export const attendanceReportEntries = pgTable("attendance_report_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => attendanceReportRuns.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  managerId: varchar("manager_id").references(() => adminUsers.id),
  origPresentDays: integer("orig_present_days").notNull().default(0),
  origAbsentDays: integer("orig_absent_days").notNull().default(0),
  origLopDays: integer("orig_lop_days").notNull().default(0),
  origLeaveDays: integer("orig_leave_days").notNull().default(0),
  origHolidayDays: integer("orig_holiday_days").notNull().default(0),
  origTotalHours: real("orig_total_hours").notNull().default(0),
  curPresentDays: integer("cur_present_days").notNull().default(0),
  curAbsentDays: integer("cur_absent_days").notNull().default(0),
  curLopDays: integer("cur_lop_days").notNull().default(0),
  curLeaveDays: integer("cur_leave_days").notNull().default(0),
  curHolidayDays: integer("cur_holiday_days").notNull().default(0),
  curTotalHours: real("cur_total_hours").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAttendanceReportEntrySchema = createInsertSchema(attendanceReportEntries).omit({ id: true, createdAt: true });
export type AttendanceReportEntry = typeof attendanceReportEntries.$inferSelect;
export type InsertAttendanceReportEntry = z.infer<typeof insertAttendanceReportEntrySchema>;

export const attendanceReportEdits = pgTable("attendance_report_edits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => attendanceReportRuns.id, { onDelete: "cascade" }),
  entryId: varchar("entry_id").notNull().references(() => attendanceReportEntries.id, { onDelete: "cascade" }),
  managerId: varchar("manager_id").notNull().references(() => adminUsers.id),
  field: varchar("field").notNull(),
  originalValue: varchar("original_value"),
  proposedValue: varchar("proposed_value"),
  reason: text("reason"),
  status: varchar("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionNote: text("rejection_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAttendanceReportEditSchema = createInsertSchema(attendanceReportEdits).omit({ id: true, createdAt: true });
export type AttendanceReportEdit = typeof attendanceReportEdits.$inferSelect;
export type InsertAttendanceReportEdit = z.infer<typeof insertAttendanceReportEditSchema>;

export const attendanceReportManagerApprovals = pgTable("attendance_report_manager_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => attendanceReportRuns.id, { onDelete: "cascade" }),
  managerId: varchar("manager_id").notNull().references(() => adminUsers.id),
  status: varchar("status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  overriddenAt: timestamp("overridden_at"),
  overrideBy: varchar("override_by").references(() => adminUsers.id),
  overrideNote: text("override_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAttendanceReportManagerApprovalSchema = createInsertSchema(attendanceReportManagerApprovals).omit({ id: true, createdAt: true });
export type AttendanceReportManagerApproval = typeof attendanceReportManagerApprovals.$inferSelect;
export type InsertAttendanceReportManagerApproval = z.infer<typeof insertAttendanceReportManagerApprovalSchema>;
