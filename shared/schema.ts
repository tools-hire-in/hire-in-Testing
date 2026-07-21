import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, pgEnum, date, numeric, uniqueIndex, unique, index, real, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// User roles enum
// NOTE: 'director' was added to the DB enum via scripts/apply-wave-scheduling-schema.ts
// (ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'director') — not via db:push, because
// additive enum values stall drizzle-kit's interactive prompt. Keep this list in sync
// with any future ALTER TYPE additions.
export const userRoleEnum = pgEnum("user_role", ["super_admin", "admin", "hr", "finance", "operations", "manager", "recruiter", "employee", "executive", "director"]);

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
  // Self-service profile extras collected during guided onboarding.
  linkedinUrl: varchar("linkedin_url"),
  photoUrl: varchar("photo_url"),
  // Per-user UI preferences (e.g. { newLook: true } for the app redesign opt-in).
  preferences: jsonb("preferences"),
  // Studio add-on: grants Content Studio access without changing base role.
  // Values: 'marketing_manager' | 'content_creator' | 'influencer' | null.
  studioAddOn: text("studio_add_on"),
  // Salary structure assignment for India payroll auto-computation.
  salaryStructureId: varchar("salary_structure_id").references(() => salaryStructures.id, { onDelete: "set null" }),
  // PF exemption: HR/executive can mark an employee as exempt from EPF (e.g. new
  // hires with Basic > ₹15,000 who were never previously PF members).
  pfExempt: boolean("pf_exempt").notNull().default(false),
  ptState: varchar("pt_state"),
  workCity: varchar("work_city"),
  // ESI disability flag: raises the ESI gross threshold from ₹21,000 to ₹25,000
  // as per the ESI Act for persons with disabilities.
  esiDisability: boolean("esi_disability").notNull().default(false),
  esiApplicable: boolean("esi_applicable").notNull().default(true),
  esiCoveredUntil: date("esi_covered_until"),
  esiDailyWageExempt: boolean("esi_daily_wage_exempt").notNull().default(false),
  // Statutory filing identifiers — used in PF ECR and ESI monthly return files.
  // UAN: Universal Account Number (EPFO). Null if not yet assigned.
  uan: varchar("uan"),
  // ESIC IP Number: Insurance Person Number (ESIC). Null if not ESI covered.
  esicIpNumber: varchar("esic_ip_number"),
  // Ceipal end-of-day compliance checkpoint. When true (default), recruiter-role
  // users see the punch-out modal asking if they updated Ceipal today.
  // HR/admin/super_admin can disable this for specific users (e.g., on leave).
  ceipalUpdatePromptEnabled: boolean("ceipal_update_prompt_enabled").notNull().default(true),
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
  // AI-generated social captions stored per-job so they can be reused without regenerating.
  // Shape: { linkedin: string, instagram: string, facebook: string, generatedAt: string }
  socialCaptions: jsonb("social_captions"),
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
  // Task #1115 — Recruiter ownership & submission stage pipeline
  recruiterId: varchar("recruiter_id"),
  stage: varchar("stage").notNull().default("submitted"),
  stageUpdatedAt: timestamp("stage_updated_at"),
  stageUpdatedBy: varchar("stage_updated_by"),
  placementDate: date("placement_date"),
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

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "half_day", "short_day", "late", "on_leave", "holiday", "weekend"]);
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
  halfDay: boolean("half_day").notNull().default(false),
  halfDayPart: varchar("half_day_part"),
  exceptionStatus: varchar("exception_status"),
  exceptionStandardHours: numeric("exception_standard_hours", { precision: 5, scale: 2 }),
  exceptionComment: text("exception_comment"),
  exceptionResolvedBy: varchar("exception_resolved_by").references(() => adminUsers.id),
  exceptionResolvedAt: timestamp("exception_resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_att_exception_status").on(table.exceptionStatus).where(sql`${table.exceptionStatus} IS NOT NULL`),
]);

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
  // If true, this is a NON-ACCRUING block entitlement (e.g. Maternity/Paternity).
  // The monthly accrual engine and year-end batch never touch it. The leave is granted
  // on application/approval up to default_days (the fixed entitlement cap).
  blockEntitlement: boolean("block_entitlement").notNull().default(false),
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
  version: integer("version").notNull().default(1),
  salaryRunId: varchar("salary_run_id").references(() => salaryReportRuns.id),
  basicSalary: numeric("basic_salary").notNull().default("0"),
  grossSalary: numeric("gross_salary").notNull().default("0"),
  deductions: numeric("deductions").notNull().default("0"),
  netPayable: numeric("net_payable").notNull().default("0"),
  totalWorkingDays: integer("total_working_days").notNull().default(0),
  daysPresent: integer("days_present").notNull().default(0),
  daysAbsent: integer("days_absent").notNull().default(0),
  approvedLeaves: numeric("approved_leaves").notNull().default("0"),
  lopLeaves: numeric("lop_leaves").default("0"),
  salaryAdvanceRecovery: numeric("salary_advance_recovery").notNull().default("0"),
  totalHours: numeric("total_hours").notNull().default("0"),
  attendancePercentage: numeric("attendance_percentage").notNull().default("0"),
  // Structured earnings/statutory breakdown — populated when employee has a salary
  // structure assigned. JSONB so it evolves without schema migrations.
  components: jsonb("components"),
  generatedAt: timestamp("generated_at").defaultNow(),
  generatedBy: varchar("generated_by").references(() => adminUsers.id),
  computationSnapshot: jsonb("computation_snapshot"),
  jurisdiction: varchar("jurisdiction").notNull().default("IN"),
}, (table) => [
  uniqueIndex("idx_salary_slips_user_period_version").on(table.userId, table.year, table.month, table.version),
  uniqueIndex("salary_slips_user_year_month_run_unique").on(table.userId, table.year, table.month, table.salaryRunId),
]);

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
  annexureInitials: jsonb("annexure_initials"),
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
  // Phase 2: explicitly attach a plan template (probation/growth/pip) to this
  // offer. When set, the activation engine instantiates this plan type using the
  // resolved department/role/level key (overridable from the auto-resolved default).
  attachedPlanType: varchar("attached_plan_type"),
  attachedPlanDepartment: varchar("attached_plan_department"),
  attachedPlanRole: varchar("attached_plan_role"),
  attachedPlanLevel: varchar("attached_plan_level"),
  reminderSentAt: timestamp("reminder_sent_at"),
  // Verify-page canonical ref + HMAC auth code (OL/{YEAR}/{SEQ4} format).
  // Nullable — backfilled for existing rows by ensureOfferLetterReferenceNumbers().
  referenceNumber: varchar("reference_number").unique(),
  verifyAuthCode: varchar("verify_auth_code"),
  // Set to true when the offer letter was explicitly linked to an existing
  // employee at creation time (re-engagement / role-change scenario).
  // Distinct from resultingUserId being set post-onboarding for a new hire.
  isReengagement: boolean("is_reengagement").notNull().default(false),
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

  referenceNumber: varchar("reference_number"),
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
}, (table) => [
  uniqueIndex("hr_letters_reference_number_idx").on(table.referenceNumber),
]);

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
  // Optional link to a SOP (Task #664) — ties this goal to a SOP's KPI so
  // compliance rolls up into role scorecards. FK to the version-specific
  // sop_documents row selected at link time; lookups resolve by sopMasterId.
  linkedSopId: varchar("linked_sop_id").references((): any => sopDocuments.id, { onDelete: "set null" }),
  notes: text("notes"),
  // Overdue-goal dedup columns (sweep engine uses these to avoid re-sending
  // nudges/escalations every day). employeeNudgedAt = when the employee was last
  // directly reminded; lastEscalatedAt = when the most recent manager/skip-level
  // escalation email was sent. Both are NULLable — NULL means never triggered.
  employeeNudgedAt: timestamp("employee_nudged_at"),
  lastEscalatedAt: timestamp("last_escalated_at"),
  skipEscalatedAt: timestamp("skip_escalated_at"),
  // Set ONLY when the progress field changes (not on title/description/etc edits).
  // Used by the hard gate to distinguish "touched goal" from "logged real progress".
  lastProgressUpdatedAt: timestamp("last_progress_updated_at"),
  // Auto-progress source: null or "manual" = hand-entered; any other value
  // (e.g. "recruiter_metric:call_volume:200") means the goal is KPI-linked
  // and progress is computed automatically by the goal auto-progress engine.
  trackingType: varchar("tracking_type"),
  // Display order within a plan; lower = shown first. Null sorts last.
  sortOrder: integer("sort_order").notNull().default(0),
  // ── Goal Auto-Progress Engine (Task #1101) ────────────────────────────────
  // goalMetricType: nullable; one of the 5 auto-trackable types or 'manual'.
  // Null means unclassified (treated as manual by the sync engine).
  goalMetricType: varchar("goal_metric_type"),
  // goalMetricConfig: JSONB parameters for auto-calculation (e.g. { weeklyTarget: 5 }).
  goalMetricConfig: jsonb("goal_metric_config"),
  // goalProgressSource: 'auto' when last set by the sync engine, 'manual' when
  // a manager/employee set it directly. Default 'manual'.
  goalProgressSource: varchar("goal_progress_source").default("manual"),
  // goalProgressUpdatedAt: timestamp of the last progress write (auto or manual).
  goalProgressUpdatedAt: timestamp("goal_progress_updated_at"),
  // escalationFlag: set by sync engine when progress regresses > 15 points.
  escalationFlag: boolean("escalation_flag").default(false),
  // ── Goodhart Guard (Task #1107) ────────────────────────────────────────────
  // The auto-progress engine PROPOSES a new value here instead of writing
  // directly to `progress`. A manager must confirm or adjust within 96h,
  // after which the auto-commit cron commits the suggestion. Anomaly-flagged
  // goals (unusual spikes) require manual review and are never auto-committed.
  suggestedProgress: integer("suggested_progress"),
  progressPendingReview: boolean("progress_pending_review").notNull().default(false),
  progressAnomalyFlagged: boolean("progress_anomaly_flagged").notNull().default(false),
  suggestedProgressAt: timestamp("suggested_progress_at"),
  progressConfirmedAt: timestamp("progress_confirmed_at"),
  progressConfirmedBy: varchar("progress_confirmed_by").references((): any => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_performance_goals_escalation_flag").on(table.escalationFlag).where(sql`escalation_flag = true`),
]);

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
}, (table) => [
  index("goal_milestones_goal_id_idx").on(table.goalId),
]);

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
  notifiedAt: timestamp("notified_at"),
  managerNotifiedAt: timestamp("manager_notified_at"),
  // Probation accountability (Task #633): per-day dedupe marker for the daily
  // manager overdue reminder, and a once-only marker for milestone (Day
  // 30/60/90) HR/Ops escalation when a formal review is 3+ days overdue.
  overdueRemindedOn: varchar("overdue_reminded_on"),
  milestoneEscalatedAt: timestamp("milestone_escalated_at"),
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
  // Nullable: a pending plan is seeded at offer acceptance with NULL employee_id
  // and the real employee_id is backfilled at onboarding/activation.
  employeeId: varchar("employee_id").references(() => adminUsers.id),
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
  // Typed full-name evidence captured at digital acknowledgement (PIP plans).
  acknowledgedName: varchar("acknowledged_name"),
  // Links a plan back to the offer letter that spawned it (growth-clause flow).
  offerLetterId: varchar("offer_letter_id"),
  // Probation accountability (Task #633): once-only marker that the owning
  // manager has been briefed on this plan, and a once-only marker that a
  // 3-strike (repeated overdue check-ins) escalation has fired to HR/skip-level.
  managerBriefedAt: timestamp("manager_briefed_at"),
  strikeEscalatedAt: timestamp("strike_escalated_at"),
  // Records when the overdue-goal sweep last escalated to the plan manager
  // so that the "Action required" accountability banner can be surfaced on
  // the manager's Team Goals view when no coaching action has been taken.
  managerGoalEscalatedAt: timestamp("manager_goal_escalated_at"),
  createdBy: varchar("created_by").notNull().references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Data-hygiene guard: a plan may only have a NULL employee_id while it is still
  // 'pending' (seeded at offer acceptance, backfilled at onboarding/activation).
  // Any non-pending plan (active/completed/extended/closed) MUST have an employee.
  // This keeps the pending workflow legal while preventing an activated plan from
  // ever pointing at no one.
  check(
    "ck_employee_plans_nonpending_has_employee",
    sql`${table.status} = 'pending' OR ${table.employeeId} IS NOT NULL`,
  ),
  index("idx_employee_plans_employee").on(table.employeeId),
]);

export const planGoalTemplates = pgTable("plan_goal_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planType: employeePlanTypeEnum("plan_type").notNull(),
  roleSlug: varchar("role_slug").notNull(),
  departmentScope: employeePlanDeptScopeEnum("department_scope").notNull().default("healthcare"),
  // Department/role/level keying for the cross-department probation framework.
  // Nullable for back-compat with existing healthcare templates (which key off
  // departmentScope + roleSlug). NULL department = applies to all departments.
  department: varchar("department"),
  role: varchar("role"),
  level: varchar("level"),
  // Goal weight (% contribution to the probation score) — used by universal goals.
  weight: integer("weight"),
  // Milestone tag for role-specific targets: "day_30" | "day_60" | "day_90".
  milestone: varchar("milestone"),
  // Universal goals apply to every probation plan regardless of role/level.
  isUniversal: boolean("is_universal").notNull().default(false),
  goalTitle: varchar("goal_title").notNull(),
  goalCategory: varchar("goal_category").notNull().default("individual"),
  goalDescription: text("goal_description"),
  targetMetric: varchar("target_metric"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_plan_goal_templates_type_role").on(table.planType, table.roleSlug),
  uniqueIndex("idx_plan_goal_templates_unique").on(table.planType, table.roleSlug, table.goalTitle),
]);

// Probation scoring bands (Section 7 of the framework doc) — structured data the
// milestone-scorecard feature consumes to map a numeric score to an outcome.
export const probationScoringBands = pgTable("probation_scoring_bands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  minScore: integer("min_score").notNull(),
  maxScore: integer("max_score").notNull(),
  label: varchar("label").notNull(),
  meaning: text("meaning"),
  recommendedOutcome: text("recommended_outcome"),
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

// Day-90 final weights (Section 12) — one row per assessment area. Stored as a
// table (not system_settings JSON) so the framework's structured reference data
// is uniform with probation_scoring_bands and editable per-row.
export const probationFinalWeights = pgTable("probation_final_weights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  area: varchar("area").notNull(),
  weight: integer("weight").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Probation pass rule (Section 7) — the confirmation criteria statement. A table
// (single active row) keeps it in the same structured-DB style as bands/weights.
export const probationPassRule = pgTable("probation_pass_rule", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rule: text("rule").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProbationScoringBandSchema = createInsertSchema(probationScoringBands).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProbationFinalWeightSchema = createInsertSchema(probationFinalWeights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProbationPassRuleSchema = createInsertSchema(probationPassRule).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Coaching log — free-text coaching notes a manager/HR records against an
// employee's plan (probation/growth/pip). Distinct from check-ins: these are
// ad-hoc coaching observations, not scheduled milestone reviews.
export const coachingLogEntries = pgTable("coaching_log_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull(),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  authorId: varchar("author_id").notNull().references(() => adminUsers.id),
  note: text("note").notNull(),
  entryDate: varchar("entry_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCoachingLogEntrySchema = createInsertSchema(coachingLogEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmployeePlan = typeof employeePlans.$inferSelect;
export type InsertEmployeePlan = z.infer<typeof insertEmployeePlanSchema>;
export type PlanGoalTemplate = typeof planGoalTemplates.$inferSelect;
export type InsertPlanGoalTemplate = z.infer<typeof insertPlanGoalTemplateSchema>;
export type ProbationScoringBand = typeof probationScoringBands.$inferSelect;
export type InsertProbationScoringBand = z.infer<typeof insertProbationScoringBandSchema>;
export type ProbationFinalWeight = typeof probationFinalWeights.$inferSelect;
export type InsertProbationFinalWeight = z.infer<typeof insertProbationFinalWeightSchema>;
export type ProbationPassRule = typeof probationPassRule.$inferSelect;
export type InsertProbationPassRule = z.infer<typeof insertProbationPassRuleSchema>;
export type CoachingLogEntry = typeof coachingLogEntries.$inferSelect;
export type InsertCoachingLogEntry = z.infer<typeof insertCoachingLogEntrySchema>;

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
  // Annexure key this policy track corresponds to (e.g. "leave_policy",
  // "attendance_policy"). Used to bridge offer-acceptance annexure signatures
  // into policy-track completions so employees never re-sign. Null = no annexure.
  policyKey: varchar("policy_key"),
  versionNumber: integer("version_number").notNull().default(1),
  publishedAt: timestamp("published_at"),
  createdBy: varchar("created_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // SOP training catalog metadata (nullable — no migration risk to existing rows)
  launchWave: varchar("launch_wave"),       // e.g. "Wave 0", "Wave 1"
  sopCategory: varchar("sop_category"),     // e.g. "Foundation", "Staffing / TA Delivery"
  trainingId: varchar("training_id"),       // external ID e.g. HIS-TRN-TA-001
  audience: varchar("audience"),            // free-text audience description from seed
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

// Quiz questions per section (multiple questions supported per section)
export const sectionQuizQuestions = pgTable("section_quiz_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull().references(() => trackSections.id, { onDelete: "cascade" }),
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
  signedVersion: integer("signed_version"),
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

// SOP ↔ training track link table (many-to-many via sopCode)
export const trainingSopLinks = pgTable("training_sop_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trackId: varchar("track_id").notNull().references(() => learningTracks.id, { onDelete: "cascade" }),
  sopCode: text("sop_code").notNull(),
  isGlobal: boolean("is_global").notNull().default(false), // true when sopCode = "ALL"
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_training_sop_link_track_code").on(table.trackId, table.sopCode),
]);

// Role → training track mandate rules
export const roleTrainingRules = pgTable("role_training_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleSlug: varchar("role_slug").notNull(),
  department: varchar("department"),
  trackId: varchar("track_id").notNull().references(() => learningTracks.id, { onDelete: "cascade" }),
  isMandatory: boolean("is_mandatory").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTrainingSopLinkSchema = createInsertSchema(trainingSopLinks).omit({ id: true, createdAt: true });
export const insertRoleTrainingRuleSchema = createInsertSchema(roleTrainingRules).omit({ id: true, createdAt: true });
export type TrainingSopLink = typeof trainingSopLinks.$inferSelect;
export type RoleTrainingRule = typeof roleTrainingRules.$inferSelect;

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
  "expired",
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

  // Phase 2: explicitly attach a plan template (probation/growth/pip) to this
  // addendum. On accept/countersign the activation engine instantiates this plan
  // type using the resolved department/role/level key. Falls back to growth when
  // only the legacy growth-plan clause is present.
  attachedPlanType: varchar("attached_plan_type"),
  attachedPlanDepartment: varchar("attached_plan_department"),
  attachedPlanRole: varchar("attached_plan_role"),
  attachedPlanLevel: varchar("attached_plan_level"),

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

  expiresAt: timestamp("expires_at"),
  reminderSentAt: timestamp("reminder_sent_at"),

  createdAt: timestamp("created_at").defaultNow(),
  // Verify-page canonical ref + HMAC auth code (AM/{PREFIX}/{YEAR}/{SEQ4} format).
  // Nullable — backfilled for existing rows by ensureOfferLetterReferenceNumbers().
  referenceNumber: varchar("reference_number").unique(),
  verifyAuthCode: varchar("verify_auth_code"),
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

// Per-user per-type notification channel preferences (Studio T3, Task #908).
// No row = both channels enabled (COALESCE-default-on in the gateway).
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  notificationType: varchar("notification_type").notNull(),
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userTypeUnique: unique("notification_preferences_user_type_unique").on(
    table.userId,
    table.notificationType,
  ),
}));

export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
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
  ein: varchar("ein"),
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
  // CEO rate intelligence fields (Task #1118)
  specialty: varchar("specialty"), // Healthcare | IT | Engineering | Professional Services | Other
  billRate: numeric("bill_rate"), // $/hr bill rate
  payRate: numeric("pay_rate"),   // $/hr pay rate (optional)
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

// CEO rate targets — CEO sets quarterly/annual bill-rate benchmarks per specialty
export const rateTargets = pgTable("rate_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  specialty: varchar("specialty").notNull(), // Healthcare | IT | Engineering | Professional Services | Other
  targetBillRateUsd: numeric("target_bill_rate_usd").notNull(),
  periodType: varchar("period_type").notNull(), // quarterly | annual
  periodLabel: varchar("period_label").notNull(), // e.g. "Q3 2026" | "2026"
  setBy: varchar("set_by").references(() => adminUsers.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRateTargetSchema = createInsertSchema(rateTargets).omit({
  id: true,
  createdAt: true,
});
export type RateTarget = typeof rateTargets.$inferSelect;
export type InsertRateTarget = z.infer<typeof insertRateTargetSchema>;

// ==========================================
// SHIFT SYSTEM
// ==========================================

export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  displayLabel: varchar("display_label").notNull(),
  usCoverage: varchar("us_coverage").notNull(),
  usCoverageDst: varchar("us_coverage_dst"),
  usCoverageStd: varchar("us_coverage_std"),
  istStartDst: varchar("ist_start_dst").notNull(),
  istEndDst: varchar("ist_end_dst").notNull(),
  istStartStd: varchar("ist_start_std").notNull(),
  istEndStd: varchar("ist_end_std").notNull(),
  scheduledHours: integer("scheduled_hours").notNull().default(9),
  gracePeriodMinutes: integer("grace_period_minutes").default(15),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
}, (table) => [
  index("break_records_user_date_idx").on(table.userId, table.date),
  index("break_records_attendance_idx").on(table.attendanceId),
]);

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
  "returned",
]);

export const attendanceRegularizations = pgTable("attendance_regularizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  attendanceDate: varchar("attendance_date").notNull(),
  requestedPunchIn: timestamp("requested_punch_in"),
  requestedPunchOut: timestamp("requested_punch_out"),
  requestType: varchar("request_type").notNull(),
  reason: text("reason").notNull(),
  // status values: "pending" | "approved" | "rejected" | "returned"
  status: varchar("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewerComment: text("reviewer_comment"),
  reviewedAt: timestamp("reviewed_at"),
  // Manager-adjusted punch times: set when a reviewer edits the requested times before approving.
  managerAdjustedPunchIn: timestamp("manager_adjusted_punch_in"),
  managerAdjustedPunchOut: timestamp("manager_adjusted_punch_out"),
  // Separate from reviewerComment — used only for the return-for-clarification note.
  returnComment: text("return_comment"),
  // Optional employee evidence file (object storage path).
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_att_reg_employee_id").on(table.employeeId),
  index("idx_att_reg_status").on(table.status),
  index("idx_att_reg_date").on(table.attendanceDate),
]);

export const policyAcknowledgements = pgTable("policy_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  policyType: varchar("policy_type").notNull(),
  policyVersion: varchar("policy_version").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow(),
}, (table) => [
  index("idx_policy_ack_user_type").on(table.userId, table.policyType),
]);

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
  managerAdjustedPunchIn: true,
  managerAdjustedPunchOut: true,
  returnComment: true,
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

export const salaryReportStatusEnum = pgEnum("salary_report_status", ["pending_approval", "approved", "sent", "executed"]);

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
  dispatchedTo: jsonb("dispatched_to"),
  dispatchedAt: timestamp("dispatched_at"),
  executedAt: timestamp("executed_at"),
  executedBy: varchar("executed_by"),
  executionNote: text("execution_note"),
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
// SALARY RUN PAYMENTS (per-employee disbursement tracking)
// ==========================================
// Tracks the offline bank-transfer confirmation per employee row of an approved
// salary run. Rows are keyed by (runId, email) because run reportData rows are
// email-keyed. status: "pending" | "deposited". Marking deposited unlocks the
// employee's payslip for that month; when every row is deposited the run
// auto-transitions to "executed".
export const salaryRunPayments = pgTable("salary_run_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => salaryReportRuns.id),
  email: varchar("email").notNull(),
  userId: varchar("user_id").references(() => adminUsers.id),
  status: varchar("status").notNull().default("pending"),
  note: text("note"),
  markedBy: varchar("marked_by").references(() => adminUsers.id),
  markedAt: timestamp("marked_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("salary_run_payments_run_email_unique").on(table.runId, table.email),
]);

export const insertSalaryRunPaymentSchema = createInsertSchema(salaryRunPayments).omit({
  id: true,
  createdAt: true,
});

export type SalaryRunPayment = typeof salaryRunPayments.$inferSelect;
export type InsertSalaryRunPayment = z.infer<typeof insertSalaryRunPaymentSchema>;

// ==========================================
// PENDING CHANGES (Automated-job guardrail)
// ==========================================
// Automated/scheduled jobs that would otherwise overwrite user-entered values
// (attendance, leave, salary) instead PROPOSE their changes into this store.
// A Super Admin reviews each proposal and approves (apply transactionally + audit)
// or rejects (discard). Nothing is auto-applied.
export const pendingChangeStatusEnum = pgEnum("pending_change_status", ["pending", "approved", "rejected"]);

export const pendingChanges = pgTable("pending_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Which automated job produced this proposal (e.g. "absent_sweep")
  sourceJob: varchar("source_job").notNull(),
  // The calendar date the change pertains to, used to group the daily report (YYYY-MM-DD)
  runDate: varchar("run_date").notNull(),
  // Employee the change affects
  targetUserId: varchar("target_user_id").references(() => adminUsers.id),
  // Table + record the change targets ("attendance"; targetRecordId NULL for inserts)
  targetTable: varchar("target_table").notNull(),
  targetRecordId: varchar("target_record_id"),
  // "insert" | "update"
  changeType: varchar("change_type").notNull(),
  // The field being changed (e.g. "status")
  field: varchar("field"),
  // Human-readable before/after for the review UI
  currentValue: text("current_value"),
  proposedValue: text("proposed_value"),
  // Why the job proposed this (e.g. "No punch-in recorded")
  reason: text("reason"),
  // Full machine payload the approve handler applies (e.g. { status, date, notes })
  payload: jsonb("payload"),
  status: pendingChangeStatusEnum("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // One proposal per job/user/table/date/field — re-running a sweep is idempotent
  // (ON CONFLICT DO NOTHING) and never resurrects an already-reviewed proposal.
  uniqueIndex("uq_pending_change_dedupe").on(
    table.sourceJob,
    table.targetUserId,
    table.targetTable,
    table.runDate,
    table.field,
  ),
  index("idx_pending_change_status_date").on(table.status, table.runDate),
]);

export const insertPendingChangeSchema = createInsertSchema(pendingChanges).omit({
  id: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
});
export type PendingChange = typeof pendingChanges.$inferSelect;
export type InsertPendingChange = z.infer<typeof insertPendingChangeSchema>;

// ==========================================
// COMMUNICATIONS LOG (Control Tower — Communications Control Center)
// ==========================================
// Every automated/system-generated email routes through the central send gateway,
// which writes a row here. Per-type policy (auto-send vs hold-for-approval) lives in
// system_settings under "communications_policy". Held rows can be approved (sent now)
// or rejected (discarded) by a Super Admin from the Communications Control Center.
export const communicationsLog = pgTable("communications_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Communication type key (see shared/communications.ts COMMUNICATION_TYPES)
  type: varchar("type").notNull(),
  // Which automated job/trigger produced this email (e.g. "scheduler:salary_report_reminder")
  sourceJob: varchar("source_job"),
  // Rendered email content so a held email can be sent later as-is
  recipients: text("recipients").array().notNull().default(sql`ARRAY[]::text[]`),
  cc: text("cc").array().notNull().default(sql`ARRAY[]::text[]`),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html"),
  bodyText: text("body_text"),
  // "sent" | "held" | "approved" | "rejected" | "failed"
  status: varchar("status").notNull().default("sent"),
  error: text("error"),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_communications_log_status").on(table.status, table.createdAt),
  index("idx_communications_log_type").on(table.type, table.createdAt),
]);

export const insertCommunicationLogSchema = createInsertSchema(communicationsLog).omit({
  id: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
});
export type CommunicationLog = typeof communicationsLog.$inferSelect;
export type InsertCommunicationLog = z.infer<typeof insertCommunicationLogSchema>;

// ==========================================
// COMMUNICATION CONFIG (Super Admin per-type overrides)
// ==========================================
// Stores per-type enabled flag, extra CC addresses, and custom type definitions.
// System types (is_custom = false) are upserted by key; custom types have is_custom = true.
export const communicationConfig = pgTable("communication_config", {
  typeKey: varchar("type_key").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  extraTo: text("extra_to").array().notNull().default(sql`ARRAY[]::text[]`),
  cc: text("cc").array().notNull().default(sql`ARRAY[]::text[]`),
  isCustom: boolean("is_custom").notNull().default(false),
  scheduleLabel: text("schedule_label"),
  recipientRule: text("recipient_rule"),
  label: text("label"),
  description: text("description"),
  category: text("category"),
  createdBy: varchar("created_by").references(() => adminUsers.id),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
  deletedAt: timestamp("deleted_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommunicationConfigSchema = createInsertSchema(communicationConfig).omit({
  createdAt: true,
  updatedAt: true,
});
export type CommunicationConfig = typeof communicationConfig.$inferSelect;
export type InsertCommunicationConfig = z.infer<typeof insertCommunicationConfigSchema>;

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
  // Versioning: multiple rows per (month,year); exactly one is_active=true = current version.
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  regenerationComment: text("regeneration_comment"),
  regeneratedBy: varchar("regenerated_by").references(() => adminUsers.id),
  // Auto-sync tracking for the open (non-approved) month.
  lastSyncedAt: timestamp("last_synced_at"),
  autoAddedTotal: integer("auto_added_total").notNull().default(0),
  // Set when the run has actually been sent to managers for approval. NULL = draft
  // (generated but not yet emailed). Manual runs stay NULL until HR clicks "Send for
  // Approval"; the automated month-end job sends immediately so this is set on create.
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_att_report_runs_month_year_active").on(table.year, table.month, table.isActive),
]);

export const insertAttendanceReportRunSchema = createInsertSchema(attendanceReportRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AttendanceReportRunStatus = "pending" | "in_review" | "edits_pending_hr" | "approved" | "overridden" | "deadline_expired" | "cancelled";
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
}, (table) => [
  index("idx_att_report_entries_run").on(table.runId),
  index("idx_att_report_entries_manager").on(table.managerId),
]);

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
}, (table) => [
  index("idx_att_report_edits_run").on(table.runId),
  index("idx_att_report_edits_status").on(table.status),
]);

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
}, (table) => [
  index("idx_att_report_mgr_approvals_run").on(table.runId),
]);

export const insertAttendanceReportManagerApprovalSchema = createInsertSchema(attendanceReportManagerApprovals).omit({ id: true, createdAt: true });
export type AttendanceReportManagerApproval = typeof attendanceReportManagerApprovals.$inferSelect;
export type InsertAttendanceReportManagerApproval = z.infer<typeof insertAttendanceReportManagerApprovalSchema>;

// ─── Plan Acknowledgements ─────────────────────────────────────────────────
// Durable evidence records for PIP (and optionally other plan types) where the
// employee types their full name to digitally confirm they have read the plan.
// Mirrors the pattern used by section_acknowledgements for training tracks.
export const planAcknowledgements = pgTable("plan_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull(),          // references employee_plans.id (raw varchar to avoid circular FK)
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  planType: varchar("plan_type").notNull(),       // pip | probation | growth — snapshot at time of ack
  typedName: varchar("typed_name").notNull(),     // full name as typed by the employee
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
  ipAddress: varchar("ip_address"),              // optional — request IP for audit trail
}, (table) => [
  index("idx_plan_acks_plan_id").on(table.planId),
  index("idx_plan_acks_user_id").on(table.userId),
]);

export const insertPlanAcknowledgementSchema = createInsertSchema(planAcknowledgements).omit({ id: true, acknowledgedAt: true });
export type PlanAcknowledgement = typeof planAcknowledgements.$inferSelect;
export type InsertPlanAcknowledgement = z.infer<typeof insertPlanAcknowledgementSchema>;

// ── Unified signature ledger ───────────────────────────────────────────────────
// Polymorphic, append-only record of every formal acceptance/signature across the
// platform (offer letters, addendums, HR letters, contracts, policies, ...). This is
// ADDITIVE: existing per-entity columns (authCode/documentHash/etc.) remain the source
// of truth for back-compat hashing; the ledger is a consolidated audit/lookup surface.
// signerUserId is intentionally NOT a hard FK — candidates and clients are not admin users.
export const signatureRecords = pgTable("signature_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentType: varchar("document_type").notNull(), // offer_letter | offer_letter_counter | addendum | addendum_counter | hr_letter | contract | policy
  documentId: varchar("document_id").notNull(),     // id of the underlying entity (or signature row for policy)
  referenceNumber: varchar("reference_number"),     // user-facing reference used by /verify (may equal documentId)
  signerName: varchar("signer_name").notNull(),
  signerRole: varchar("signer_role"),               // candidate | client | employee | hr | admin
  signerUserId: varchar("signer_user_id"),          // admin_users.id when the signer is an internal user; null for candidates/clients
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  contentHash: varchar("content_hash"),             // documentHash captured at signing time
  authCode: varchar("auth_code"),                   // formatted verification code captured at signing time
  sectionInitials: jsonb("section_initials"),       // annexure / per-page initials when applicable
  certificatePath: varchar("certificate_path"),     // object-storage path to a generated certificate/PDF when applicable
  metadata: jsonb("metadata"),                      // any document-type-specific extras
  consentAcceptedAt: timestamp("consent_accepted_at"), // timestamp when e-sign T&C consent was accepted (DocuSign flow)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signature_records_doc").on(table.documentType, table.documentId),
  index("idx_signature_records_ref").on(table.referenceNumber),
]);

export const insertSignatureRecordSchema = createInsertSchema(signatureRecords).omit({ id: true, createdAt: true });
export type SignatureRecord = typeof signatureRecords.$inferSelect;
export type InsertSignatureRecord = z.infer<typeof insertSignatureRecordSchema>;

// ==========================================
// CONTENT & MARKETING STUDIO MODULE
// ==========================================

// Article lifecycle pipeline.
export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "in_review",
  "approved",
  "scheduled",
  "published",
  "ready_to_export",
  "pending_marketing",
  "pending_final_approval",
  "archived",
  "pending_cm_review",
  "pending_author",
  "author_approved",
  "planning_review",
  "rejected",
]);

// Projects / brands the studio publishes for.
export const studioProjects = pgTable("studio_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  description: text("description"),
  brandColor: varchar("brand_color"),
  logoUrl: varchar("logo_url"),
  // Optional brand web-font stylesheet URL + canonical footer URL injected into
  // social cards. active_template_family selects which card template set new
  // generations use (defaults to the global "hirein-v1" family).
  fontUrl: varchar("font_url"),
  footerUrl: varchar("footer_url"),
  activeTemplateFamily: varchar("active_template_family").default("hirein-v1").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  publishesToInsights: boolean("publishes_to_insights").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // Category -> reviewer pool routing config used by the smart-routing engine.
  // Shape: { strategy?: "least_recently_assigned" | "round_robin",
  //          defaultReviewerUserIds?: string[],
  //          rules: { category: string; reviewerUserIds: string[] }[] }
  routingRules: jsonb("routing_rules"),
  // Occasion-aware calendar opt-in (Studio T4). Shape: StudioOccasionPreferences
  // { regions: ["us","india"], categories: ["festival","industry_awareness"] }.
  // NULL = show no occasions for this project.
  occasionPreferences: jsonb("occasion_preferences"),
  // Brand Voice Hub (Studio T2, Task #907). Shape:
  // { default: { tone[], guardrails[], bannedPhrases[], signaturePhrases[],
  //   icpOneLiner, brandPromise, ctaStyle, complianceNotes, defaultFramework },
  //   platforms: { linkedin|instagram|facebook|x|story: { tone[], signaturePhrases[] } } }
  // NULL = fall back to system DEFAULT_BRAND.
  brandVoiceConfig: jsonb("brand_voice_config"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Author bylines (decoupled from admin users so external/guest authors work).
export const studioAuthorProfiles = pgTable("studio_author_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  projectId: varchar("project_id").references(() => studioProjects.id),
  displayName: varchar("display_name").notNull(),
  title: varchar("title"),
  bio: text("bio"),
  photoUrl: varchar("photo_url"),
  linkedinUrl: varchar("linkedin_url"),
  consentedAt: timestamp("consented_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  linkedEmployeeId: varchar("linked_employee_id"),
  linkedUserId: varchar("linked_user_id"),
  authorType: varchar("author_type").default("external").notNull(),
  publicTitle: varchar("public_title"),
  specialties: text("specialties").array(),
  profileComplete: boolean("profile_complete").default(false).notNull(),
  slug: varchar("slug"),
});

// Core article record.
export const studioArticles = pgTable("studio_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => studioProjects.id),
  status: articleStatusEnum("status").default("draft").notNull(),
  contentType: varchar("content_type").default("article").notNull(),
  category: varchar("category"),
  title: varchar("title").notNull(),
  slug: varchar("slug"),
  excerpt: text("excerpt"),
  bodyMarkdown: text("body_markdown"),
  bodyJson: jsonb("body_json"),
  coverImageUrl: varchar("cover_image_url"),
  seoTitle: varchar("seo_title"),
  seoDescription: text("seo_description"),
  ogImageUrl: varchar("og_image_url"),
  tags: text("tags").array(),
  readTimeMinutes: integer("read_time_minutes"),
  authorProfileId: varchar("author_profile_id").references(() => studioAuthorProfiles.id),
  reviewerUserId: varchar("reviewer_user_id"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  // Canonical normalized Social Kit (captions, quote/checklist, hashtags,
  // suggested visual template, quality notes). Populated by AI generation.
  socialKitJsonb: jsonb("social_kit_jsonb"),
  // Social-card engine (Task #432): per-article card layout override
  // (standard | checklist | quote); null = auto-map from content type.
  cardLayout: varchar("card_layout"),
  // Map of "{layout}-{platform}" -> { url, width, height, label } for the
  // generated PNG social cards. Populated by the card generation service.
  socialCardsJsonb: jsonb("social_cards_jsonb"),
  // Compliance posture for AI generation + publish gating
  // (normal | healthcare_safe | public_sector_safe | no_claims | source_required).
  complianceMode: varchar("compliance_mode").default("normal").notNull(),
  // Outstanding AI risk flags / source-verification items that hard-block
  // publish for healthcare/government/credentialing content until acknowledged.
  riskFlags: jsonb("risk_flags"),
  riskFlagsResolvedAt: timestamp("risk_flags_resolved_at"),
  riskFlagsResolvedBy: varchar("risk_flags_resolved_by"),
  // Set once when the per-publish new-content notification email has been sent
  // to newsletter subscribers. Guards against re-sending on re-publish/edit.
  notifiedAt: timestamp("notified_at"),
  // Launch seeding metadata (Task #473 — Hire'in Insights pilot). seedBatchId
  // tags articles loaded by a batch seed (idempotent re-run guard). The
  // requires* flags mark articles that must pass author + marketing approval
  // before they can be published. suggestedAuthorRole / audience are byline +
  // targeting metadata carried from the seed document.
  seedBatchId: varchar("seed_batch_id"),
  requiresAuthorApproval: boolean("requires_author_approval").default(false).notNull(),
  requiresMarketingApproval: boolean("requires_marketing_approval").default(false).notNull(),
  suggestedAuthorRole: varchar("suggested_author_role"),
  audience: text("audience").array(),
  // Structured AI context handed over when an idea is promoted to an article
  // (topic, brief, refs, discussion summary). Never the article body itself.
  generationBrief: text("generation_brief"),
  // Tone/voice instruction for AI generation (AUTHORITATIVE | CONVERSATIONAL | EDUCATIONAL | INSPIRATIONAL | PRACTICAL | AUTO)
  toneVoice: varchar("tone_voice"),
  // Content goal for AI generation (THOUGHT_LEADERSHIP | EDUCATIONAL | LEAD_GEN | ENGAGEMENT | SEO_TRAFFIC | BRAND_AWARENESS).
  // Persisted at creation so the editor/generate dialog pre-selects the intended goal without relying on derivation from contentType alone.
  contentGoal: varchar("content_goal"),
  // CMO Copilot v2.1 — resolved brief metadata (populated by resolve-brief endpoint)
  audienceQuestion: text("audience_question"),      // real decision/tension the audience faces
  audienceResolved: varchar("audience_resolved"),   // canonical v2.1 audience slug
  domainResolved: varchar("domain_resolved"),       // GENERAL_STAFFING | IT_STAFFING | HEALTHCARE_STAFFING
  marketContextResolved: varchar("market_context_resolved"), // COMMERCIAL | STATE_GOVERNMENT | FEDERAL_GOVERNMENT
  sourceType: varchar("source_type"),              // USER_PROVIDED | GENERAL_EDUCATIONAL_CONTEXT | NONE | etc.
  readerAction: text("reader_action"),             // desired reader action after reading
  businessObjective: text("business_objective"),
  singleTakeaway: text("single_takeaway"),
  hookOptionsJsonb: jsonb("hook_options_jsonb"),   // [{text, archetype, rationale, contentStructure}]
  selectedHookText: text("selected_hook_text"),
  selectedHookArchetype: varchar("selected_hook_archetype"),
  selectedContentStructure: varchar("selected_content_structure"),
  // Psychological brief fields (Task #1060) — persisted after generation so the
  // full brief is recoverable and the article is re-generatable from same inputs.
  desiredEmotion: text("desired_emotion"),    // curiosity | validated | challenged | warned | surprised | inspired
  hookPattern: text("hook_pattern"),           // curiosity_gap | loss_aversion | insider_contrast | ... (8 archetypes)
  contentStructure: text("content_structure"), // rule_of_three | pas | the_reveal | contrast | the_framework | listicle
  engagementGoal: text("engagement_goal"),     // save_it | share_it | comment | follow | dm | apply
  // Source tracking — USER if explicitly chosen, AI if auto-resolved (not shown in UI; used for future analytics)
  emotionSource: varchar("emotion_source"),            // USER | AI
  hookPatternSource: varchar("hook_pattern_source"),   // USER | AI
  structureSource: varchar("structure_source"),        // USER | AI
  engagementGoalSource: varchar("engagement_goal_source"), // USER | AI
  safetyReviewResult: varchar("safety_review_result"), // PASS | REVISE | BLOCK
  safetyFailuresJsonb: jsonb("safety_failures_jsonb"),  // [{code, sentence, reason, missingSource, recommendedCorrection, autoCorrectSafe}]
  generationV1Markdown: text("generation_v1_markdown"), // initial accepted version for editing-effort tracking
  // Back-link to the content idea that was promoted to create this article.
  // NULL for articles created directly (not via promotion).
  linkedIdeaId: varchar("linked_idea_id"),
  // Structured snapshot of key idea context preserved at promotion time:
  // { pillar, bdIntelMetadata, captionCopy, channels }.
  // Lets the ArticleEditor surface full planner context without re-querying the idea.
  ideaContext: jsonb("idea_context"),
  // Insights Editorial Phase 1 — JSONB blob written by Call 1 (generateInsightsBrief).
  // Shape: InsightsPlanningOutput (brief, stakeholderScan, researchQuestions,
  // outlineRecommendation, decision). NULL until Call 1 completes.
  insightsPlanning: jsonb("insights_planning"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("studio_articles_project_idx").on(table.projectId),
  index("studio_articles_status_idx").on(table.status),
]);

// ── Studio T1: content planning pipeline ────────────────────────────────────
// One planning object rendered through three lenses (Calendar / Board / Table).
export const studioContentIdeas = pgTable("studio_content_ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => studioProjects.id),
  campaignId: varchar("campaign_id"), // reserved for T2
  groupId: varchar("group_id"), // links post + story split from one import row
  parentIdeaId: varchar("parent_idea_id"),
  importBatchId: varchar("import_batch_id"),
  origin: varchar("origin").default("manual").notNull(), // manual | import | ai | repurposed
  contentType: varchar("content_type").default("social_post").notNull(), // article | social_post | story
  channels: jsonb("channels"), // ["linkedin","instagram","facebook","x","website"]
  pillar: varchar("pillar"),
  topic: varchar("topic").notNull(),
  brief: text("brief"),
  generationBrief: text("generation_brief"),
  referenceLink: varchar("reference_link"),
  captionCopy: text("caption_copy"),
  requirement: text("requirement"),
  creativeLink: varchar("creative_link"),
  storyContent: text("story_content"),
  storyReference: varchar("story_reference"),
  storyCreativeLink: varchar("story_creative_link"),
  creativeDone: boolean("creative_done").notNull().default(false),
  storyCreativeDone: boolean("story_creative_done").notNull().default(false),
  storyPublishDate: date("story_publish_date"),
  scheduledDate: date("scheduled_date"), // NULL = backlog
  dueDate: date("due_date"),
  assignedToUserId: varchar("assigned_to_user_id"),
  status: varchar("status").default("idea").notNull(), // pipeline state machine
  linkedArticleId: varchar("linked_article_id"),
  archivedAt: timestamp("archived_at"), // soft-archive (import rollback)
  // T4: generated branded social cards for this idea — same contract shape as
  // studio_articles.social_cards_jsonb ({family, layout, generatedAt, cards:[...]}).
  socialCardsJsonb: jsonb("social_cards_jsonb"),
  createdByUserId: varchar("created_by_user_id"),
  // Commercial Intelligence Bridge: structured metadata when origin = 'bd_agent'.
  // Stores { sourceConversationId, domain, buyerStage, painPointTheme, icpHint }
  // from the BD conversation that generated this brief.
  bdIntelMetadata: jsonb("bd_intel_metadata"),
  // Set to true when the idea was flagged by the import quality audit (slop phrases,
  // missing pillar, vague brief, platform mismatch). Advisory only — never blocks import.
  // Cleared by a human editing/approving the idea.
  needsAttention: boolean("needs_attention").notNull().default(false),
  // Post format — describes the creative delivery format (Carousel, Reel, Static, Video, etc.)
  // Distinct from contentType (article/social_post/story). Nullable; older rows unaffected.
  postFormat: varchar("post_format"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("studio_content_ideas_project_idx").on(table.projectId),
  index("studio_content_ideas_batch_idx").on(table.importBatchId),
  index("studio_content_ideas_scheduled_idx").on(table.scheduledDate),
  index("studio_content_ideas_status_idx").on(table.status),
]);

// ── Studio T2: campaigns — the unit of marketing intent (Task #907) ─────────
export const studioCampaigns = pgTable("studio_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => studioProjects.id),
  name: varchar("name").notNull(),
  brief: text("brief"), // strategic paragraph handed to the AI planner
  icp: varchar("icp"), // ideal customer profile one-liner
  goal: varchar("goal"),
  funnelStage: varchar("funnel_stage"), // awareness | consideration | decision
  primaryCta: varchar("primary_cta"),
  channels: jsonb("channels"), // subset of STUDIO_CHANNELS
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: varchar("status").default("draft").notNull(), // draft | active | paused | completed
  // Contributor admin-user ids notified on campaign events.
  contributorUserIds: jsonb("contributor_user_ids"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Studio T2: copy-only outreach sequences (never sent by the system) ──────
export const studioOutreachSequences = pgTable("studio_outreach_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => studioProjects.id),
  campaignId: varchar("campaign_id"),
  name: varchar("name").notNull(),
  sequenceType: varchar("sequence_type").default("linkedin").notNull(), // linkedin | email
  audienceType: varchar("audience_type"),
  // [{ order, subjectOrHook, body, notes }]
  stepsJsonb: jsonb("steps_jsonb"),
  status: varchar("status").default("draft").notNull(), // draft | approved | archived
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const studioIdeaComments = pgTable("studio_idea_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").notNull().references(() => studioContentIdeas.id),
  userId: varchar("user_id").notNull(),
  message: text("message").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("studio_idea_comments_idea_idx").on(table.ideaId),
]);

export const studioIdeaWatchers = pgTable("studio_idea_watchers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").notNull().references(() => studioContentIdeas.id),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_studio_idea_watcher_idea_user").on(table.ideaId, table.userId),
]);

export const studioImportBatches = pgTable("studio_import_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => studioProjects.id),
  fileName: varchar("file_name"),
  rowCountValid: integer("row_count_valid").default(0).notNull(),
  rowCountInvalid: integer("row_count_invalid").default(0).notNull(),
  createdByUserId: varchar("created_by_user_id"),
  rolledBackAt: timestamp("rolled_back_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Immutable snapshots of article body for version history.
export const studioArticleVersions = pgTable("studio_article_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => studioArticles.id),
  versionNo: integer("version_no").notNull(),
  title: varchar("title"),
  bodyMarkdown: text("body_markdown"),
  bodyJson: jsonb("body_json"),
  createdBy: varchar("created_by"),
  // Set to true on publish of an upgraded version — soft-archives prior published
  // snapshots so they are hidden from UI but never hard-deleted.
  superseded: boolean("superseded").notNull().default(false),
  // Mode used to produce this version: 'full' | 'rework' | null (manual snapshot)
  regenMode: varchar("regen_mode"),
  // Feedback note stored when mode = 'rework'
  feedbackNote: text("feedback_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("studio_article_versions_article_idx").on(table.articleId),
]);

// Governed regeneration requests — non-super-admins must request an unlock
// that super admin approves before they can fire a (costly) AI regeneration.
export const studioRegenRequests = pgTable("studio_regen_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => studioArticles.id),
  requestedByUserId: varchar("requested_by_user_id").notNull().references(() => adminUsers.id),
  reason: text("reason").notNull(),
  feedbackNote: text("feedback_note"),
  // 'full' | 'rework'
  mode: varchar("mode").notNull().default("full"),
  // 'pending' | 'approved' | 'rejected'
  status: varchar("status").notNull().default("pending"),
  approvedByUserId: varchar("approved_by_user_id").references(() => adminUsers.id),
  approvalNote: text("approval_note"),
  // 24h window after approval during which the requester may fire regeneration
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("studio_regen_requests_article_idx").on(table.articleId),
  index("studio_regen_requests_status_idx").on(table.status),
  index("studio_regen_requests_user_idx").on(table.requestedByUserId),
]);

// Review workflow assignments.
export const studioReviewAssignments = pgTable("studio_review_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => studioArticles.id),
  reviewerUserId: varchar("reviewer_user_id").notNull(),
  status: varchar("status").default("pending").notNull(),
  dueAt: timestamp("due_at"),
  decisionAt: timestamp("decision_at"),
  comment: text("comment"),
  assignedBy: varchar("assigned_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("studio_review_assignments_article_idx").on(table.articleId),
]);

// Public reactions on published articles.
export const studioArticleReactions = pgTable("studio_article_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => studioArticles.id),
  reactionType: varchar("reaction_type").notNull(),
  sessionHash: varchar("session_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Newsletter opt-ins captured from public surfaces.
export const studioNewsletterSubscribers = pgTable("studio_newsletter_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  projectId: varchar("project_id").references(() => studioProjects.id),
  confirmedAt: timestamp("confirmed_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  // Deliverability suppression (driven by the SendGrid event webhook).
  // suppressedAt set => excluded from all future sends. bounceCount tracks
  // consecutive soft-bounce/drop failures; reset to 0 on successful delivery.
  suppressedAt: timestamp("suppressed_at"),
  bounceCount: integer("bounce_count").default(0).notNull(),
  lastBounceAt: timestamp("last_bounce_at"),
  preferences: jsonb("preferences"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Append-only audit trail for studio actions.
export const studioAuditEvents = pgTable("studio_audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id"),
  actorUserId: varchar("actor_user_id"),
  eventType: varchar("event_type").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Analytics dashboard reads aggregate audit events by type over a time
  // window (views, cta clicks, reactions, marketing decisions).
  eventTypeCreatedAtIdx: index("studio_audit_events_event_type_created_at_idx").on(
    table.eventType,
    table.createdAt,
  ),
}));

// Studio T3 (Task #908): first-class engagement events for the redirect-based
// CTA click tracker + render-time view attribution. Separate from the audit
// trail so analytics reads never contend with workflow audit writes.
export const studioEngagementEvents = pgTable("studio_engagement_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => studioArticles.id),
  campaignId: varchar("campaign_id"),
  contentIdeaId: varchar("content_idea_id"),
  eventName: varchar("event_name").notNull(), // article_view | cta_click
  ctaLabel: varchar("cta_label"),
  sourceChannel: varchar("source_channel"),
  referrer: varchar("referrer"),
  // SHA-256 of IP+UA — anonymous, no PII stored.
  sessionHash: varchar("session_hash"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  articleEventIdx: index("studio_engagement_events_article_event_idx").on(
    table.articleId,
    table.eventName,
    table.createdAt,
  ),
  campaignIdx: index("studio_engagement_events_campaign_idx").on(
    table.campaignId,
    table.createdAt,
  ),
}));

export const insertStudioEngagementEventSchema = createInsertSchema(studioEngagementEvents).omit({
  id: true,
  createdAt: true,
});
export type StudioEngagementEvent = typeof studioEngagementEvents.$inferSelect;
export type InsertStudioEngagementEvent = z.infer<typeof insertStudioEngagementEventSchema>;

// Branded social-card template matrix (family × layout × platform). project_id
// NULL = global default templates shared by every project.
export const cardTemplates = pgTable("card_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => studioProjects.id),
  family: varchar("family").notNull(),
  layout: varchar("layout").notNull(),
  platform: varchar("platform").notNull(),
  label: varchar("label"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  maxTips: integer("max_tips"),
  html: text("html").notNull(),
  // Optional cached preview thumbnail (GCS URL). null = live-render preview.
  thumbnailUrl: varchar("thumbnail_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("card_templates_default_idx").on(table.family, table.layout, table.platform).where(sql`${table.projectId} IS NULL`),
]);

// Singleton brand reference for Content Studio (palette + typography).
export const studioBrandSettings = pgTable("studio_brand_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandName: varchar("brand_name").notNull().default("Hire'in Solutions"),
  tagline: varchar("tagline"),
  navy: varchar("navy").notNull().default("#1F3A6E"),
  orangePrimary: varchar("orange_primary").notNull().default("#F47C20"),
  orangeAccent: varchar("orange_accent").notNull().default("#F96D3E"),
  white: varchar("white").notNull().default("#FFFFFF"),
  softGray: varchar("soft_gray").notNull().default("#F2F4F7"),
  headingFont: varchar("heading_font").notNull().default("Playfair Display"),
  bodyFont: varchar("body_font").notNull().default("Inter"),
  logoUrl: varchar("logo_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Seeded, versioned prompt library. Editable without code changes; every edit
// bumps the version (a new row keyed by project + content_type + version).
export const studioPromptTemplates = pgTable("studio_prompt_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // null projectId = global template available to every project.
  projectId: varchar("project_id").references(() => studioProjects.id),
  // Library key: article_generator, shape_my_draft, master_social_kit,
  // linkedin_thought_leadership, recruiter_playbook, candidate_tips,
  // employer_guide, healthcare_staffing, it_staffing, quote_card,
  // checklist_card, quality_reviewer, etc.
  contentType: varchar("content_type").notNull(),
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  systemPrompt: text("system_prompt").notNull(),
  userPromptTemplate: text("user_prompt_template").notNull(),
  modelName: varchar("model_name").notNull(),
  // economy | standard — drives the model selection in aiDraftService.
  modelTier: varchar("model_tier").default("standard").notNull(),
  maxTokens: integer("max_tokens").default(4000).notNull(),
  // Which canonical output schema this template's raw output maps into
  // (article_draft | social_kit | quality_review).
  outputSchemaRef: varchar("output_schema_ref").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("studio_prompt_templates_global_key").on(table.contentType, table.version).where(sql`${table.projectId} IS NULL`),
]);

// Versioned record of every AI generation, for audit + reproducibility.
export const studioGenerations = pgTable("studio_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  articleId: varchar("article_id"),
  promptTemplateId: varchar("prompt_template_id"),
  promptVersion: integer("prompt_version"),
  // article_draft | social_kit | quality_review
  kind: varchar("kind").notNull(),
  contentType: varchar("content_type"),
  modelName: varchar("model_name"),
  inputJson: jsonb("input_json"),
  outputJson: jsonb("output_json"),
  // Attached gated quality-reviewer result (risk_flags/required_edits/scores).
  qualityReviewJson: jsonb("quality_review_json"),
  tokenEstimate: integer("token_estimate"),
  // Computed cost in USD from tokens × per-model price at generation time.
  costUsd: numeric("cost_usd"),
  generatedByUserId: varchar("generated_by_user_id"),
  // draft | reviewed | approved | rejected | archived
  status: varchar("status").default("draft").notNull(),
  reviewedByUserId: varchar("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  approvalNotes: text("approval_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("studio_generations_article_idx").on(table.articleId),
  index("studio_generations_user_idx").on(table.generatedByUserId),
  index("studio_generations_cost_idx").on(table.createdAt, table.costUsd),
]);

// Release Notes — AI-generated deployment changelog broadcaster
export const releaseNotes = pgTable("release_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  version: varchar("version"),
  title: varchar("title"),
  body: text("body"),
  changelogInput: text("changelog_input"),
  // draft | pending_approval | approved | rejected | sent
  status: varchar("status").default("draft").notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => adminUsers.id),
  submittedByUserId: varchar("submitted_by_user_id").references(() => adminUsers.id),
  submittedAt: timestamp("submitted_at"),
  approvedByUserId: varchar("approved_by_user_id").references(() => adminUsers.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  sentChannels: text("sent_channels").array().default(sql`'{}'`),
  sentAt: timestamp("sent_at"),
  sentByUserId: varchar("sent_by_user_id").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReleaseNoteSchema = createInsertSchema(releaseNotes).omit({ id: true, createdAt: true });
export type ReleaseNote = typeof releaseNotes.$inferSelect;
export type InsertReleaseNote = z.infer<typeof insertReleaseNoteSchema>;

export const insertStudioProjectSchema = createInsertSchema(studioProjects).omit({ id: true, createdAt: true });
export const insertStudioAuthorProfileSchema = createInsertSchema(studioAuthorProfiles).omit({ id: true, createdAt: true });
export const insertStudioArticleSchema = createInsertSchema(studioArticles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStudioArticleVersionSchema = createInsertSchema(studioArticleVersions).omit({ id: true, createdAt: true });
export const insertStudioRegenRequestSchema = createInsertSchema(studioRegenRequests).omit({ id: true, createdAt: true });
export const insertStudioReviewAssignmentSchema = createInsertSchema(studioReviewAssignments).omit({ id: true, createdAt: true });
export const insertStudioArticleReactionSchema = createInsertSchema(studioArticleReactions).omit({ id: true, createdAt: true });
export const insertStudioNewsletterSubscriberSchema = createInsertSchema(studioNewsletterSubscribers).omit({ id: true, createdAt: true });
export const insertStudioAuditEventSchema = createInsertSchema(studioAuditEvents).omit({ id: true, createdAt: true });
export const insertStudioPromptTemplateSchema = createInsertSchema(studioPromptTemplates).omit({ id: true, createdAt: true });
export const insertStudioGenerationSchema = createInsertSchema(studioGenerations).omit({ id: true, createdAt: true });
export const insertStudioContentIdeaSchema = createInsertSchema(studioContentIdeas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStudioIdeaCommentSchema = createInsertSchema(studioIdeaComments).omit({ id: true, createdAt: true });
export const insertStudioIdeaWatcherSchema = createInsertSchema(studioIdeaWatchers).omit({ id: true, createdAt: true });
export const insertStudioImportBatchSchema = createInsertSchema(studioImportBatches).omit({ id: true, createdAt: true });
export const insertStudioCampaignSchema = createInsertSchema(studioCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStudioOutreachSequenceSchema = createInsertSchema(studioOutreachSequences).omit({ id: true, createdAt: true, updatedAt: true });
export type StudioCampaign = typeof studioCampaigns.$inferSelect;
export type InsertStudioCampaign = z.infer<typeof insertStudioCampaignSchema>;
export type StudioOutreachSequence = typeof studioOutreachSequences.$inferSelect;
export type InsertStudioOutreachSequence = z.infer<typeof insertStudioOutreachSequenceSchema>;
export type StudioContentIdea = typeof studioContentIdeas.$inferSelect;
export type InsertStudioContentIdea = z.infer<typeof insertStudioContentIdeaSchema>;
export type StudioIdeaComment = typeof studioIdeaComments.$inferSelect;
export type InsertStudioIdeaComment = z.infer<typeof insertStudioIdeaCommentSchema>;
export type StudioIdeaWatcher = typeof studioIdeaWatchers.$inferSelect;
export type InsertStudioIdeaWatcher = z.infer<typeof insertStudioIdeaWatcherSchema>;
export type StudioImportBatch = typeof studioImportBatches.$inferSelect;
export type InsertStudioImportBatch = z.infer<typeof insertStudioImportBatchSchema>;

export type StudioProject = typeof studioProjects.$inferSelect;
export type InsertStudioProject = z.infer<typeof insertStudioProjectSchema>;
export type StudioAuthorProfile = typeof studioAuthorProfiles.$inferSelect;
export type InsertStudioAuthorProfile = z.infer<typeof insertStudioAuthorProfileSchema>;
export type StudioArticle = typeof studioArticles.$inferSelect;
export type InsertStudioArticle = z.infer<typeof insertStudioArticleSchema>;
export type StudioArticleVersion = typeof studioArticleVersions.$inferSelect;
export type InsertStudioArticleVersion = z.infer<typeof insertStudioArticleVersionSchema>;
export type StudioRegenRequest = typeof studioRegenRequests.$inferSelect;
export type InsertStudioRegenRequest = z.infer<typeof insertStudioRegenRequestSchema>;
export type StudioReviewAssignment = typeof studioReviewAssignments.$inferSelect;
export type InsertStudioReviewAssignment = z.infer<typeof insertStudioReviewAssignmentSchema>;
export type StudioArticleReaction = typeof studioArticleReactions.$inferSelect;
export type InsertStudioArticleReaction = z.infer<typeof insertStudioArticleReactionSchema>;
export type StudioNewsletterSubscriber = typeof studioNewsletterSubscribers.$inferSelect;
export type InsertStudioNewsletterSubscriber = z.infer<typeof insertStudioNewsletterSubscriberSchema>;
export type StudioAuditEvent = typeof studioAuditEvents.$inferSelect;
export type InsertStudioAuditEvent = z.infer<typeof insertStudioAuditEventSchema>;

export const insertCardTemplateSchema = createInsertSchema(cardTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type CardTemplate = typeof cardTemplates.$inferSelect;
export type InsertCardTemplate = z.infer<typeof insertCardTemplateSchema>;
export type StudioBrandSettings = typeof studioBrandSettings.$inferSelect;
export type StudioPromptTemplate = typeof studioPromptTemplates.$inferSelect;
export type InsertStudioPromptTemplate = z.infer<typeof insertStudioPromptTemplateSchema>;
export type StudioGeneration = typeof studioGenerations.$inferSelect;
export type InsertStudioGeneration = z.infer<typeof insertStudioGenerationSchema>;

// Smart-routing config shapes (stored in studioProjects.routingRules jsonb).
export interface StudioRoutingRule {
  category: string;
  reviewerUserIds: string[];
}
export interface StudioRoutingRules {
  strategy?: "least_recently_assigned" | "round_robin";
  defaultReviewerUserIds?: string[];
  rules: StudioRoutingRule[];
}

// ==========================================
// STUDIO T4 — OCCASION-AWARE CALENDAR + CONTENT IDEAS
// ==========================================

// Curated occasions dataset (US holidays, Indian festivals, industry awareness
// days) + per-project custom occasions. project_id NULL = global curated row.
export const studioOccasions = pgTable("studio_occasions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  // Resolved calendar date; movable festivals stored explicitly per year.
  date: date("date").notNull(),
  // "us" | "india" | "global"
  region: varchar("region").notNull(),
  // "national_holiday" | "festival" | "industry_awareness" | "fun_observance" | "custom"
  category: varchar("category").notNull(),
  // One-sentence strategic content angle (never "wish them a happy day").
  contentAngle: text("content_angle"),
  projectId: varchar("project_id").references(() => studioProjects.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Natural key for the idempotent curated seed (global rows only).
  globalNameDateIdx: uniqueIndex("studio_occasions_global_name_date_idx")
    .on(table.name, table.date)
    .where(sql`project_id IS NULL`),
}));

// Shape of studio_projects.occasion_preferences jsonb. NULL = occasions off
// for the project (opt-in).
export interface StudioOccasionPreferences {
  regions: string[];    // subset of ["us","india","global"]
  categories: string[]; // subset of occasion categories
}

export const insertStudioOccasionSchema = createInsertSchema(studioOccasions).omit({ id: true, createdAt: true });
export type StudioOccasion = typeof studioOccasions.$inferSelect;
export type InsertStudioOccasion = z.infer<typeof insertStudioOccasionSchema>;

// ==========================================
// INTERNAL HELP DESK (HIRD)
// ==========================================

export const internalRequestStatusEnum = pgEnum("internal_request_status", [
  "pending_approval",
  "assigned",
  "in_progress",
  "needs_info",
  "resolved",
  "closed",
  "rejected",
]);

export const internalRequestTypeEnum = pgEnum("internal_request_type", [
  "access",
  "hr",
  "ops",
  "general",
  "salary_advance",
]);

export const internalRequestPriorityEnum = pgEnum("internal_request_priority", [
  "p1",
  "p2",
  "p3",
  "p4",
]);

export const internalRequests = pgTable("internal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestNumber: varchar("request_number").notNull().unique(),
  requesterId: varchar("requester_id").notNull().references(() => adminUsers.id),
  requestedForId: varchar("requested_for_id").references(() => adminUsers.id),
  type: internalRequestTypeEnum("type").notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  priority: internalRequestPriorityEnum("priority").notNull().default("p3"),
  status: internalRequestStatusEnum("status").notNull().default("pending_approval"),
  managerId: varchar("manager_id").references(() => adminUsers.id),
  assignedToId: varchar("assigned_to_id").references(() => adminUsers.id),
  departmentId: varchar("department_id").references(() => departments.id),
  neededByDate: date("needed_by_date"),
  templateData: jsonb("template_data"),
  attachmentUrl: text("attachment_url"),
  // Optional tag linking a request (e.g. an "access" request) to a governing SOP
  // such as OPS-001, so it is traceable in that SOP's evidence trail (Task #665).
  linkedSopId: varchar("linked_sop_id").references((): any => sopDocuments.id, { onDelete: "set null" }),
  // Hardware items for equipment/hardware requests. Shape: { description: string; qty: number }[]
  hardwareItems: jsonb("hardware_items"),
  // Arbitrary metadata — used to store e.g. linked_addendum_id after an addendum is generated.
  metadata: jsonb("metadata"),
  // When type=salary_advance, the linked salary_advance_requests row for the full approval chain.
  linkedAdvanceId: varchar("linked_advance_id").references((): any => salaryAdvanceRequests.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const internalRequestComments = pgTable("internal_request_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => internalRequests.id),
  authorId: varchar("author_id").notNull().references(() => adminUsers.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const internalRequestApprovals = pgTable("internal_request_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => internalRequests.id),
  approverId: varchar("approver_id").notNull().references(() => adminUsers.id),
  decision: varchar("decision").notNull(),
  reason: text("reason"),
  decidedAt: timestamp("decided_at").defaultNow(),
});

export const internalRequestAuditLog = pgTable("internal_request_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => internalRequests.id),
  actorId: varchar("actor_id").notNull().references(() => adminUsers.id),
  action: varchar("action").notNull(),
  oldStatus: varchar("old_status"),
  newStatus: varchar("new_status"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const internalRequestsRelations = relations(internalRequests, ({ one, many }) => ({
  requester: one(adminUsers, { fields: [internalRequests.requesterId], references: [adminUsers.id], relationName: "hirdRequester" }),
  manager: one(adminUsers, { fields: [internalRequests.managerId], references: [adminUsers.id], relationName: "hirdManager" }),
  assignedTo: one(adminUsers, { fields: [internalRequests.assignedToId], references: [adminUsers.id], relationName: "hirdAssignee" }),
  department: one(departments, { fields: [internalRequests.departmentId], references: [departments.id] }),
  comments: many(internalRequestComments),
  approvals: many(internalRequestApprovals),
  auditLog: many(internalRequestAuditLog),
}));

export const internalRequestCommentsRelations = relations(internalRequestComments, ({ one }) => ({
  request: one(internalRequests, { fields: [internalRequestComments.requestId], references: [internalRequests.id] }),
  author: one(adminUsers, { fields: [internalRequestComments.authorId], references: [adminUsers.id], relationName: "hirdCommentAuthor" }),
}));

export const internalRequestApprovalsRelations = relations(internalRequestApprovals, ({ one }) => ({
  request: one(internalRequests, { fields: [internalRequestApprovals.requestId], references: [internalRequests.id] }),
  approver: one(adminUsers, { fields: [internalRequestApprovals.approverId], references: [adminUsers.id], relationName: "hirdApprover" }),
}));

export const internalRequestAuditLogRelations = relations(internalRequestAuditLog, ({ one }) => ({
  request: one(internalRequests, { fields: [internalRequestAuditLog.requestId], references: [internalRequests.id] }),
  actor: one(adminUsers, { fields: [internalRequestAuditLog.actorId], references: [adminUsers.id], relationName: "hirdAuditActor" }),
}));

export const insertInternalRequestSchema = createInsertSchema(internalRequests).omit({
  id: true,
  requestNumber: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  assignedToId: true,
});

export const insertInternalRequestCommentSchema = createInsertSchema(internalRequestComments).omit({
  id: true,
  createdAt: true,
});

export const insertInternalRequestApprovalSchema = createInsertSchema(internalRequestApprovals).omit({
  id: true,
  decidedAt: true,
});

export const insertInternalRequestAuditLogSchema = createInsertSchema(internalRequestAuditLog).omit({
  id: true,
  createdAt: true,
});

export type InternalRequest = typeof internalRequests.$inferSelect;
export type InsertInternalRequest = z.infer<typeof insertInternalRequestSchema>;
export type InternalRequestComment = typeof internalRequestComments.$inferSelect;
export type InsertInternalRequestComment = z.infer<typeof insertInternalRequestCommentSchema>;
export type InternalRequestApproval = typeof internalRequestApprovals.$inferSelect;
export type InsertInternalRequestApproval = z.infer<typeof insertInternalRequestApprovalSchema>;
export type InternalRequestAuditLog = typeof internalRequestAuditLog.$inferSelect;
export type InsertInternalRequestAuditLog = z.infer<typeof insertInternalRequestAuditLogSchema>;

// ==========================================
// SALARY ADVANCE REQUEST TABLES
// ==========================================

// Lifecycle: pending_manager -> pending_final (manager approved) -> approved
// (final approved, schedule generated) -> disbursed -> repaying -> closed.
// Side states: rejected, cancelled (by employee while pending), returned
// (sent back to employee for clarification).
export const salaryAdvanceStatusEnum = pgEnum("salary_advance_status", [
  "pending_manager",
  "pending_final",
  "pending_ceo",
  "pending_review",
  "approved",
  "disbursed",
  "repaying",
  "applied",
  "closed",
  "rejected",
  "cancelled",
  "returned",
]);

export const salaryAdvanceRepaymentStatusEnum = pgEnum("salary_advance_repayment_status", [
  "scheduled",
  "deducted",
  "waived",
]);

export const salaryAdvanceKindEnum = pgEnum("salary_advance_kind", [
  "advance",
  "overpayment",
  "salary_credit",
]);

export const salaryAdvanceRequests = pgTable("salary_advance_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestNumber: varchar("request_number").notNull().unique(),
  requesterId: varchar("requester_id").notNull().references(() => adminUsers.id),
  managerId: varchar("manager_id").references(() => adminUsers.id),
  requestedAmount: numeric("requested_amount").notNull(),
  reason: text("reason").notNull(),
  status: salaryAdvanceStatusEnum("status").notNull().default("pending_manager"),
  // Distinguishes a normal salary advance from a recorded overpayment recovery.
  kind: salaryAdvanceKindEnum("kind").notNull().default("advance"),
  // True when the record was manually recorded by HR/admin (backfill), bypassing
  // the self-service request/approval chain.
  backfilled: boolean("backfilled").notNull().default(false),
  // Approval / repayment plan
  approvedAmount: numeric("approved_amount"),
  repaymentMonths: integer("repayment_months"),
  monthlyDeduction: numeric("monthly_deduction"),
  repaymentStartYear: integer("repayment_start_year"),
  repaymentStartMonth: integer("repayment_start_month"),
  // Exception handling (advance beyond default cap)
  isException: boolean("is_exception").notNull().default(false),
  exceptionReason: text("exception_reason"),
  // Manager stage
  managerApprovedBy: varchar("manager_approved_by").references(() => adminUsers.id),
  managerApprovedAt: timestamp("manager_approved_at"),
  managerNote: text("manager_note"),
  // Final (super admin) stage
  finalApprovedBy: varchar("final_approved_by").references(() => adminUsers.id),
  finalApprovedAt: timestamp("final_approved_at"),
  finalNote: text("final_note"),
  // Disbursement (accounts)
  disbursedBy: varchar("disbursed_by").references(() => adminUsers.id),
  disbursedAt: timestamp("disbursed_at"),
  // Rejection / return
  rejectedBy: varchar("rejected_by").references(() => adminUsers.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  returnNote: text("return_note"),
  // Repayment tracking
  totalRepaid: numeric("total_repaid").notNull().default("0"),
  outstandingBalance: numeric("outstanding_balance").notNull().default("0"),
  closedAt: timestamp("closed_at"),
  // Exit handling — flagged when an employee with an outstanding advance exits
  exitRecoveryFlag: boolean("exit_recovery_flag").notNull().default(false),
  // Urgent immediate payout — only valid once a department head approves it.
  // The regular flow recovers via the next salary run; urgent allows an
  // off-cycle immediate disbursement.
  urgentProcessing: boolean("urgent_processing").notNull().default(false),
  urgentApprovedBy: varchar("urgent_approved_by").references(() => adminUsers.id),
  urgentApprovedAt: timestamp("urgent_approved_at"),
  // Snapshot of the policy at the time of the request (for audit)
  policySnapshot: jsonb("policy_snapshot"),
  // Salary Credit: the specific payroll month this credit should be applied to.
  targetMonth: integer("target_month"),
  targetYear: integer("target_year"),
  // HR-recorded adjustments: who submitted the record (differs from requesterId = target employee).
  recordedById: varchar("recorded_by_id").references(() => adminUsers.id),
  // Super admin review comment when returning or rejecting an HR-recorded adjustment.
  reviewerComment: text("reviewer_comment"),
  // Set true when the requested amount exceeds 50% of the employee's monthly salary —
  // triggers CEO escalation after HR approval instead of going straight to disbursed.
  exceedsSalaryCap: boolean("exceeds_salary_cap").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const salaryAdvanceRepayments = pgTable("salary_advance_repayments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  advanceId: varchar("advance_id").notNull().references(() => salaryAdvanceRequests.id),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  installmentNo: integer("installment_no").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  scheduledAmount: numeric("scheduled_amount").notNull(),
  status: salaryAdvanceRepaymentStatusEnum("status").notNull().default("scheduled"),
  deductedAmount: numeric("deducted_amount"),
  deductedAt: timestamp("deducted_at"),
  salaryRunId: varchar("salary_run_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_advance_repayment_period").on(table.advanceId, table.year, table.month),
]);

export const salaryAdvanceAuditLog = pgTable("salary_advance_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  advanceId: varchar("advance_id").notNull().references(() => salaryAdvanceRequests.id),
  actorId: varchar("actor_id").notNull().references(() => adminUsers.id),
  action: varchar("action").notNull(),
  oldStatus: varchar("old_status"),
  newStatus: varchar("new_status"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const salaryAdvanceAttachments = pgTable("salary_advance_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  advanceId: varchar("advance_id").notNull().references(() => salaryAdvanceRequests.id),
  uploadedById: varchar("uploaded_by_id").notNull().references(() => adminUsers.id),
  fileName: varchar("file_name").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: varchar("content_type"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const salaryAdvanceAttachmentsRelations = relations(salaryAdvanceAttachments, ({ one }) => ({
  advance: one(salaryAdvanceRequests, { fields: [salaryAdvanceAttachments.advanceId], references: [salaryAdvanceRequests.id] }),
  uploadedBy: one(adminUsers, { fields: [salaryAdvanceAttachments.uploadedById], references: [adminUsers.id], relationName: "advanceAttachmentUploader" }),
}));

export const salaryAdvanceRequestsRelations = relations(salaryAdvanceRequests, ({ one, many }) => ({
  requester: one(adminUsers, { fields: [salaryAdvanceRequests.requesterId], references: [adminUsers.id], relationName: "advanceRequester" }),
  manager: one(adminUsers, { fields: [salaryAdvanceRequests.managerId], references: [adminUsers.id], relationName: "advanceManager" }),
  repayments: many(salaryAdvanceRepayments),
  auditLog: many(salaryAdvanceAuditLog),
  attachments: many(salaryAdvanceAttachments),
}));

export const salaryAdvanceRepaymentsRelations = relations(salaryAdvanceRepayments, ({ one }) => ({
  advance: one(salaryAdvanceRequests, { fields: [salaryAdvanceRepayments.advanceId], references: [salaryAdvanceRequests.id] }),
  user: one(adminUsers, { fields: [salaryAdvanceRepayments.userId], references: [adminUsers.id], relationName: "advanceRepaymentUser" }),
}));

export const salaryAdvanceAuditLogRelations = relations(salaryAdvanceAuditLog, ({ one }) => ({
  advance: one(salaryAdvanceRequests, { fields: [salaryAdvanceAuditLog.advanceId], references: [salaryAdvanceRequests.id] }),
  actor: one(adminUsers, { fields: [salaryAdvanceAuditLog.actorId], references: [adminUsers.id], relationName: "advanceAuditActor" }),
}));

export const insertSalaryAdvanceRequestSchema = createInsertSchema(salaryAdvanceRequests).omit({
  id: true,
  requestNumber: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalaryAdvanceRepaymentSchema = createInsertSchema(salaryAdvanceRepayments).omit({
  id: true,
  createdAt: true,
});

export const insertSalaryAdvanceAuditLogSchema = createInsertSchema(salaryAdvanceAuditLog).omit({
  id: true,
  createdAt: true,
});

export const insertSalaryAdvanceAttachmentSchema = createInsertSchema(salaryAdvanceAttachments).omit({
  id: true,
  createdAt: true,
});

export type SalaryAdvanceRequest = typeof salaryAdvanceRequests.$inferSelect;
export type InsertSalaryAdvanceRequest = z.infer<typeof insertSalaryAdvanceRequestSchema>;
export type SalaryAdvanceRepayment = typeof salaryAdvanceRepayments.$inferSelect;
export type InsertSalaryAdvanceRepayment = z.infer<typeof insertSalaryAdvanceRepaymentSchema>;
export type SalaryAdvanceAuditLog = typeof salaryAdvanceAuditLog.$inferSelect;
export type InsertSalaryAdvanceAuditLog = z.infer<typeof insertSalaryAdvanceAuditLogSchema>;
export type SalaryAdvanceAttachment = typeof salaryAdvanceAttachments.$inferSelect;
export type InsertSalaryAdvanceAttachment = z.infer<typeof insertSalaryAdvanceAttachmentSchema>;

// ── Centralized salary-change ledger ─────────────────────────────────────────
// Single source of truth for the history of every employee compensation change.
// `admin_users.salary` always reflects the latest APPLIED entry. Sources:
//   offer_letter — written back when a new hire is onboarded from an offer
//   addendum     — written back when a salary-revision/combined addendum is accepted
//   manual       — an HR/manager edit (maker-checker: super-admin must approve)
//   advance      — informational entry so advances appear in the unified history
// sourceType/status are plain varchar (not pg enums) to keep db:push additive and
// avoid interactive enum prompts.
export const salaryChanges = pgTable("salary_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  sourceType: varchar("source_type").notNull(), // offer_letter | addendum | manual | advance
  sourceDocumentType: varchar("source_document_type"), // e.g. offer_letter | addendum
  sourceDocumentId: varchar("source_document_id"),
  oldSalary: numeric("old_salary"),
  newSalary: numeric("new_salary"),
  amount: numeric("amount"), // for advance entries (informational)
  effectiveDate: date("effective_date"),
  reason: text("reason"),
  status: varchar("status").notNull().default("applied"), // pending_approval | applied | rejected
  initiatedBy: varchar("initiated_by").references(() => adminUsers.id),
  approvedBy: varchar("approved_by").references(() => adminUsers.id),
  rejectionReason: text("rejection_reason"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSalaryChangeSchema = createInsertSchema(salaryChanges).omit({
  id: true,
  createdAt: true,
});

export type SalaryChange = typeof salaryChanges.$inferSelect;
export type InsertSalaryChange = z.infer<typeof insertSalaryChangeSchema>;

// Attendance escalation dedup log — created by a startup ensure-block in server/index.ts.
// Declared here so db:push recognizes it as an existing table (not an orphan/rename).
// One row per (employee, month, tier).
export const attendanceEscalationLog = pgTable("attendance_escalation_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  month: varchar("month", { length: 7 }).notNull(),
  tier: integer("tier").notNull(),
  countAtTrigger: integer("count_at_trigger").notNull(),
  notifiedAt: timestamp("notified_at").notNull().defaultNow(),
}, (table) => ({
  uqTier: uniqueIndex("uq_att_escalation_tier").on(table.employeeId, table.month, table.tier),
}));

export const insertAttendanceEscalationLogSchema = createInsertSchema(attendanceEscalationLog).omit({
  id: true,
  notifiedAt: true,
});

export type AttendanceEscalationLog = typeof attendanceEscalationLog.$inferSelect;
export type InsertAttendanceEscalationLog = z.infer<typeof insertAttendanceEscalationLogSchema>;

// Policy stored in system_settings under key `salary_advance_policy`.
export interface SalaryAdvancePolicy {
  enabled: boolean;
  maxAdvancePctOfNet: number;
  exceptionCeilingPct: number;
  defaultMaxMonths: number;
  managerMaxMonths: number;
  ceoMaxMonths: number;
  requireProbationComplete: boolean;
  minTenureMonths: number;
  oneActiveAdvanceOnly: boolean;
}

export const DEFAULT_SALARY_ADVANCE_POLICY: SalaryAdvancePolicy = {
  enabled: true,
  maxAdvancePctOfNet: 50,
  exceptionCeilingPct: 80,
  defaultMaxMonths: 6,
  managerMaxMonths: 8,
  ceoMaxMonths: 12,
  requireProbationComplete: true,
  minTenureMonths: 0,
  oneActiveAdvanceOnly: true,
};

export const SALARY_ADVANCE_POLICY_KEY = "salary_advance_policy";

// ==========================================
// TRAVEL PAY CALCULATOR TABLES
// ==========================================

export const gsaRateSnapshots = pgTable("gsa_rate_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  zip: varchar("zip").notNull(),
  county: varchar("county"),
  state: varchar("state"),
  city: varchar("city"),
  fiscalYear: integer("fiscal_year").notNull(),
  month: integer("month").notNull(),
  lodgingRate: numeric("lodging_rate").notNull(),
  mieRate: numeric("mie_rate").notNull(),
  firstLastDayMie: numeric("first_last_day_mie").notNull(),
  snapshotDate: timestamp("snapshot_date").defaultNow(),
  sourceVersion: varchar("source_version"),
  isCached: boolean("is_cached").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_gsa_snapshot_zip_fy_month").on(table.zip, table.fiscalYear, table.month),
]);

export const travelMarginFloors = pgTable("travel_margin_floors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleType: varchar("role_type").notNull().unique(),
  redThresholdPct: numeric("red_threshold_pct").notNull(),
  yellowThresholdPct: numeric("yellow_threshold_pct").notNull(),
  payrollBurdenPct: numeric("payroll_burden_pct").notNull().default("18.8"),
  defaultOtMultiplier: numeric("default_ot_multiplier").notNull().default("1.5"),
  defaultCallbackRate: numeric("default_callback_rate").notNull().default("0"),
  defaultHolidayRate: numeric("default_holiday_rate").notNull().default("0"),
  defaultOnCallRate: numeric("default_on_call_rate").notNull().default("0"),
  defaultVmsFeePct: numeric("default_vms_fee_pct").notNull().default("3"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
});

export const travelQuoteStatusEnum = pgEnum("travel_quote_status", ["draft", "submitted", "approved", "rejected"]);
export const travelComplianceStatusEnum = pgEnum("travel_compliance_status", ["compliant", "over_cap", "override_pending", "override_approved"]);

export const travelQuotes = pgTable("travel_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recruiterId: varchar("recruiter_id").notNull().references(() => adminUsers.id),
  candidateName: varchar("candidate_name").notNull(),
  facilityClientName: varchar("facility_client_name").notNull(),
  label: varchar("label"),
  assignmentZip: varchar("assignment_zip").notNull(),
  state: varchar("state"),
  county: varchar("county"),
  city: varchar("city"),
  roleType: varchar("role_type").notNull().default("healthcare_travel"),
  weeksInAssignment: integer("weeks_in_assignment").notNull().default(13),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  awayDays: integer("away_days").notNull().default(5),
  scheduledHours: numeric("scheduled_hours").notNull().default("36"),
  w2Hourly: numeric("w2_hourly").notNull(),
  otMultiplier: numeric("ot_multiplier").notNull().default("1.5"),
  totalHours: numeric("total_hours").notNull().default("36"),
  masterBillRate: numeric("master_bill_rate").notNull(),
  otBillRate: numeric("ot_bill_rate"),
  clientOtMultiplier: numeric("client_ot_multiplier").notNull().default("1.5"),
  vmsFeePct: numeric("vms_fee_pct").notNull().default("3"),
  orientationHoursTotal: numeric("orientation_hours_total").notNull().default("0"),
  orientationHoursBillable: numeric("orientation_hours_billable").notNull().default("0"),
  orientationHoursFree: numeric("orientation_hours_free").notNull().default("0"),
  orientationPayRate: numeric("orientation_pay_rate"),
  orientationOtMultiplier: numeric("orientation_ot_multiplier").notNull().default("1"),
  completionBonus: numeric("completion_bonus").notNull().default("0"),
  dailyMie: numeric("daily_mie"),
  dailyLodging: numeric("daily_lodging"),
  decreasedStipendOverride: numeric("decreased_stipend_override"),
  payrollBurdenPct: numeric("payroll_burden_pct").notNull().default("18.8"),
  onCallRate: numeric("on_call_rate").notNull().default("0"),
  callbackRate: numeric("callback_rate").notNull().default("0"),
  holidayRate: numeric("holiday_rate").notNull().default("0"),
  status: travelQuoteStatusEnum("status").notNull().default("draft"),
  gsaSnapshotId: varchar("gsa_snapshot_id").references(() => gsaRateSnapshots.id),
  complianceOverrideBy: varchar("compliance_override_by").references(() => adminUsers.id),
  complianceOverrideReason: text("compliance_override_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_travel_quotes_recruiter").on(table.recruiterId),
  index("idx_travel_quotes_status").on(table.status),
]);

export const travelQuoteOutputs = pgTable("travel_quote_outputs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => travelQuotes.id).unique(),
  weeklyTaxable: numeric("weekly_taxable"),
  weeklyNonTaxable: numeric("weekly_non_taxable"),
  weeklyGross: numeric("weekly_gross"),
  hourlyTaxable: numeric("hourly_taxable"),
  hourlyBlended: numeric("hourly_blended"),
  otRate: numeric("ot_rate"),
  wagePayableWeekly: numeric("wage_payable_weekly"),
  payrollTaxesWeekly: numeric("payroll_taxes_weekly"),
  nonTaxableWeekly: numeric("non_taxable_weekly"),
  orientationRevenue: numeric("orientation_revenue"),
  orientationCandidateCost: numeric("orientation_candidate_cost"),
  orientationNet: numeric("orientation_net"),
  totalBillingWeekly: numeric("total_billing_weekly"),
  totalBillingContract: numeric("total_billing_contract"),
  totalExpenseWeekly: numeric("total_expense_weekly"),
  totalExpenseContract: numeric("total_expense_contract"),
  grossProfitWeekly: numeric("gross_profit_weekly"),
  netMarginPerHour: numeric("net_margin_per_hour"),
  netMarginPerWeek: numeric("net_margin_per_week"),
  netMarginPerContract: numeric("net_margin_per_contract"),
  netMarginPct: numeric("net_margin_pct"),
  stipendComplianceStatus: travelComplianceStatusEnum("stipend_compliance_status"),
  marginStatus: varchar("margin_status"),
  calculatedAt: timestamp("calculated_at").defaultNow(),
});

export const travelQuotesRelations = relations(travelQuotes, ({ one }) => ({
  recruiter: one(adminUsers, { fields: [travelQuotes.recruiterId], references: [adminUsers.id], relationName: "travelQuoteRecruiter" }),
  gsaSnapshot: one(gsaRateSnapshots, { fields: [travelQuotes.gsaSnapshotId], references: [gsaRateSnapshots.id] }),
  outputs: one(travelQuoteOutputs, { fields: [travelQuotes.id], references: [travelQuoteOutputs.quoteId] }),
}));

export const travelQuoteOutputsRelations = relations(travelQuoteOutputs, ({ one }) => ({
  quote: one(travelQuotes, { fields: [travelQuoteOutputs.quoteId], references: [travelQuotes.id] }),
}));

export const insertTravelQuoteSchema = createInsertSchema(travelQuotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  recruiterId: true,
});

export type GsaRateSnapshot = typeof gsaRateSnapshots.$inferSelect;
export type InsertGsaRateSnapshot = typeof gsaRateSnapshots.$inferInsert;
export type TravelMarginFloor = typeof travelMarginFloors.$inferSelect;
export type InsertTravelMarginFloor = typeof travelMarginFloors.$inferInsert;
export type TravelQuote = typeof travelQuotes.$inferSelect;
export type InsertTravelQuote = z.infer<typeof insertTravelQuoteSchema>;
export type TravelQuoteOutput = typeof travelQuoteOutputs.$inferSelect;

// ==========================================
// PROCESS GOVERNANCE CENTER — SOP FOUNDATION (Task #660)
// ==========================================
// Stable SOP identity: every SOP has an immutable `sopMasterId` (we store the
// SOP `code`, e.g. "OPS-001", in it — the natural stable key that never changes
// across versions). Version rows are children of that identity. ALL child tables
// (role assignments, employee progress, audit records, findings) link by
// `sopMasterId`, NOT by a per-version row id, so cloning a new version never
// orphans progress/audits/findings. Acknowledgments capture the specific version
// they bound to via `sopVersion`.

export const sopLifecycleStatusEnum = pgEnum("sop_lifecycle_status", [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "training_assigned",
  "acknowledged",
  "active",
  "under_revision",
  "retired",
]);

export const sopFindingStatusEnum = pgEnum("sop_finding_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const sopDocuments = pgTable("sop_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Stable identity shared by every version of this SOP (holds the SOP code).
  sopMasterId: varchar("sop_master_id").notNull(),
  code: varchar("code").notNull(),
  title: varchar("title").notNull(),
  category: varchar("category").notNull(),
  owner: varchar("owner").notNull(),
  approver: varchar("approver"),
  audienceRoles: text("audience_roles").array(),
  launchWave: integer("launch_wave").default(0).notNull(),
  lifecycleStatus: sopLifecycleStatusEnum("lifecycle_status").default("draft").notNull(),
  version: integer("version").default(1).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  effectiveDate: date("effective_date"),
  reviewCycle: varchar("review_cycle"),
  confidentiality: varchar("confidentiality"),
  kpiDescription: text("kpi_description"),
  auditOwnerRole: varchar("audit_owner_role"),
  frequency: varchar("frequency"),
  evidenceDescription: text("evidence_description"),
  target: varchar("target"),
  aiAssistAllowed: boolean("ai_assist_allowed").default(false).notNull(),
  humanSignoffRequired: boolean("human_signoff_required").default(true).notNull(),
  summary: text("summary"),
  // Optional link to a learning track. When a SOP is published, training is
  // auto-assigned to impacted roles via this track (Task #661).
  learningTrackId: varchar("learning_track_id").references(() => learningTracks.id, { onDelete: "set null" }),
  supersededByVersionId: varchar("superseded_by_version_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  masterVersionUnique: uniqueIndex("sop_documents_master_version_unique").on(table.sopMasterId, table.version),
  masterIdx: index("sop_documents_master_idx").on(table.sopMasterId),
  currentIdx: index("sop_documents_current_idx").on(table.isCurrent),
}));

export const sopRoleAssignments = pgTable("sop_role_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sopMasterId: varchar("sop_master_id").notNull(),
  role: varchar("role").notNull(),
  trainingType: varchar("training_type"),
  quizRequired: boolean("quiz_required").default(false).notNull(),
  kpiDescription: text("kpi_description"),
  auditOwnerRole: varchar("audit_owner_role"),
  frequency: varchar("frequency"),
  evidenceDescription: text("evidence_description"),
  target: varchar("target"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  masterRoleUnique: uniqueIndex("sop_role_assignments_master_role_unique").on(table.sopMasterId, table.role),
  masterIdx: index("sop_role_assignments_master_idx").on(table.sopMasterId),
}));

export const sopEmployeeProgress = pgTable("sop_employee_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sopMasterId: varchar("sop_master_id").notNull(),
  sopVersion: integer("sop_version").notNull(),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  trainingCompletedAt: timestamp("training_completed_at"),
  quizPassedAt: timestamp("quiz_passed_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgmentHash: varchar("acknowledgment_hash"),
  evidenceText: text("evidence_text"),
  evidenceFileUrl: varchar("evidence_file_url"),
  // Dedup guard for the daily overdue-SOP nudge: set to the date the last
  // overdue nudge was dispatched. The sweep checks this is not today before
  // sending a new notification, ensuring exactly one nudge per user per day.
  overdueNudgeSentDate: date("overdue_nudge_sent_date"),
  // Optional per-employee SOP deadline (override of wave operational_at + grace days).
  // Used by governanceService syncGovernanceObligations to compute due dates.
  deadlineAt: timestamp("deadline_at"),
  // ── SOP Wave Timer Ceiling (Task #1107) ─────────────────────────────────────
  // timer_started_at: when the employee's acknowledgement clock started; NULL
  //   means the SOP is queued (waiting for a slot in the concurrency ceiling).
  // sop_timer_queue: JSONB log of queuing events for audit; entries are appended
  //   when a SOP is deferred past the MAX_CONCURRENT_TIMERS cap or wave gate.
  timerStartedAt: timestamp("timer_started_at"),
  sopTimerQueue: jsonb("sop_timer_queue"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  masterUserUnique: uniqueIndex("sop_employee_progress_master_user_idx").on(table.sopMasterId, table.userId),
  userIdx: index("sop_employee_progress_user_idx").on(table.userId),
}));

// ── SOP Wave Approvals (Task #1107) ─────────────────────────────────────────
// Waves ≥ 3 require an explicit approval record before SOP timers may start.
// One row per wave (UNIQUE on wave_number). Schema mirrors the table created by
// scripts/governance-trust-safety-schema.ts to prevent drizzle drift alerts.
export const sopWaveApprovals = pgTable("sop_wave_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  waveNumber: integer("wave_number").notNull().unique(),
  approvedBy: varchar("approved_by").notNull().references(() => adminUsers.id),
  approvedAt: timestamp("approved_at").defaultNow().notNull(),
  riskSnapshotJson: jsonb("risk_snapshot_json"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  waveNumberIdx: index("sop_wave_approvals_wave_idx").on(table.waveNumber),
}));

export const insertSopWaveApprovalSchema = createInsertSchema(sopWaveApprovals).omit({ id: true, approvedAt: true, createdAt: true });
export type SopWaveApproval = typeof sopWaveApprovals.$inferSelect;

export const sopAuditRecords = pgTable("sop_audit_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sopMasterId: varchar("sop_master_id").notNull(),
  auditorId: varchar("auditor_id").references(() => adminUsers.id),
  weekDate: date("week_date"),
  evidenceCollected: boolean("evidence_collected").default(false).notNull(),
  missesCount: integer("misses_count").default(0).notNull(),
  auditScore: integer("audit_score"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  masterIdx: index("sop_audit_records_master_idx").on(table.sopMasterId),
}));

export const sopAuditFindings = pgTable("sop_audit_findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sopMasterId: varchar("sop_master_id").notNull(),
  raisedBy: varchar("raised_by").references(() => adminUsers.id),
  // The person accountable for the corrective action (may differ from raisedBy).
  ownerId: varchar("owner_id").references(() => adminUsers.id),
  description: text("description").notNull(),
  correctiveAction: text("corrective_action"),
  dueDate: date("due_date"),
  status: sopFindingStatusEnum("status").default("open").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  masterIdx: index("sop_audit_findings_master_idx").on(table.sopMasterId),
}));

// SOP review-assignment workflow — mirrors studioReviewAssignments shape but
// keyed by the stable sopMasterId + the specific version under review (Task #661).
export const sopReviewAssignments = pgTable("sop_review_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sopMasterId: varchar("sop_master_id").notNull(),
  sopVersion: integer("sop_version").notNull(),
  // Review round within a version. Each submit/resubmit (after changes_requested)
  // opens a new round; the approval gate only evaluates the latest round so prior
  // blocking decisions never permanently block a resubmitted version.
  round: integer("round").default(1).notNull(),
  reviewerId: varchar("reviewer_id").notNull(),
  status: varchar("status").default("pending").notNull(), // pending | reviewed | approved | approved_with_comments | changes_requested | rejected
  dueAt: timestamp("due_at"),
  decisionAt: timestamp("decision_at"),
  comment: text("comment"),
  assignedBy: varchar("assigned_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  masterVersionIdx: index("sop_review_assignments_master_version_idx").on(table.sopMasterId, table.sopVersion),
  reviewerIdx: index("sop_review_assignments_reviewer_idx").on(table.reviewerId),
}));

// SOP discussion thread — append-only comment side-table (like internalRequestComments).
export const sopComments = pgTable("sop_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sopMasterId: varchar("sop_master_id").notNull(),
  authorId: varchar("author_id").notNull().references(() => adminUsers.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  masterIdx: index("sop_comments_master_idx").on(table.sopMasterId),
}));

export const insertSopDocumentSchema = createInsertSchema(sopDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSopReviewAssignmentSchema = createInsertSchema(sopReviewAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertSopCommentSchema = createInsertSchema(sopComments).omit({
  id: true,
  createdAt: true,
});

export const insertSopRoleAssignmentSchema = createInsertSchema(sopRoleAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertSopEmployeeProgressSchema = createInsertSchema(sopEmployeeProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSopAuditRecordSchema = createInsertSchema(sopAuditRecords).omit({
  id: true,
  createdAt: true,
});

export const insertSopAuditFindingSchema = createInsertSchema(sopAuditFindings).omit({
  id: true,
  createdAt: true,
});

export type SopDocument = typeof sopDocuments.$inferSelect;
export type InsertSopDocument = z.infer<typeof insertSopDocumentSchema>;
export type SopReviewAssignment = typeof sopReviewAssignments.$inferSelect;
export type InsertSopReviewAssignment = z.infer<typeof insertSopReviewAssignmentSchema>;
export type SopComment = typeof sopComments.$inferSelect;
export type InsertSopComment = z.infer<typeof insertSopCommentSchema>;
export type SopRoleAssignment = typeof sopRoleAssignments.$inferSelect;
export type InsertSopRoleAssignment = z.infer<typeof insertSopRoleAssignmentSchema>;
export type SopEmployeeProgress = typeof sopEmployeeProgress.$inferSelect;
export type InsertSopEmployeeProgress = z.infer<typeof insertSopEmployeeProgressSchema>;
export type SopAuditRecord = typeof sopAuditRecords.$inferSelect;
export type InsertSopAuditRecord = z.infer<typeof insertSopAuditRecordSchema>;
export type SopAuditFinding = typeof sopAuditFindings.$inferSelect;
export type InsertSopAuditFinding = z.infer<typeof insertSopAuditFindingSchema>;

// ==========================================
// SOP KNOWLEDGE CHECK TABLES (Task #1420)
// ==========================================
// One question bank per SOP (keyed by sopMasterId). Questions are soft-archived
// rather than hard-deleted so employee response history is preserved.
// Applied via scripts/apply-sop-quiz-schema.ts (raw SQL, avoids drizzle TTY).

export const sopKnowledgeChecks = pgTable("sop_knowledge_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sopMasterId: varchar("sop_master_id").notNull(),
  questionText: text("question_text").notNull(),
  // 0-based index into the ordered options for this question.
  correctOptionIndex: integer("correct_option_index").notNull(),
  explanation: text("explanation"),
  position: integer("position").notNull().default(0),
  // Soft-delete: set when a question is removed so historical responses are kept.
  archivedAt: timestamp("archived_at"),
  createdBy: varchar("created_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  masterIdx: index("sop_knowledge_checks_master_idx").on(table.sopMasterId),
}));

export const sopKnowledgeCheckOptions = pgTable("sop_knowledge_check_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull().references(() => sopKnowledgeChecks.id, { onDelete: "cascade" }),
  optionText: text("option_text").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  questionIdx: index("sop_knowledge_check_options_question_idx").on(table.questionId),
}));

export const insertSopKnowledgeCheckSchema = createInsertSchema(sopKnowledgeChecks).omit({
  id: true, archivedAt: true, createdAt: true, updatedAt: true,
});
export type SopKnowledgeCheck = typeof sopKnowledgeChecks.$inferSelect;
export type InsertSopKnowledgeCheck = z.infer<typeof insertSopKnowledgeCheckSchema>;

export const insertSopKnowledgeCheckOptionSchema = createInsertSchema(sopKnowledgeCheckOptions).omit({
  id: true, createdAt: true,
});
export type SopKnowledgeCheckOption = typeof sopKnowledgeCheckOptions.$inferSelect;
export type InsertSopKnowledgeCheckOption = z.infer<typeof insertSopKnowledgeCheckOptionSchema>;

// ==========================================
// SOP WAVE ROLLOUT & ENFORCEMENT (Task #662)
// ==========================================
// Successive wave rollout (Wave 0-5) of the SOP launch playbook. Each wave is a
// phase; member SOPs (linked by sopMasterId/code) become "operational" one or
// two at a time to honor the "max 2 operational SOPs per week" cadence guardrail.
// Enforcement escalates per wave: 'soft' shows a coaching banner; 'hard' folds
// overdue, un-acknowledged operational SOPs into the existing training
// compliance lock (gated by useSopAccess so non-pilot users are never locked).

export const rolloutWaves = pgTable("rollout_waves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  waveNumber: integer("wave_number").notNull(),
  name: varchar("name").notNull(),
  // planned → active → completed. A wave must be active before its SOPs can be
  // made operational.
  status: varchar("status").default("planned").notNull(),
  // soft = coaching banner only; measured = coaching + audit (no lock);
  // full = compliance lock on overdue acks (Wave 5 milestone).
  enforcement: varchar("enforcement").default("soft").notNull(),
  // Who the wave targets (e.g. "All employees", "Recruitment & Operations").
  audience: varchar("audience"),
  description: text("description"),
  activatedAt: timestamp("activated_at"),
  activatedBy: varchar("activated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  waveNumberUnique: uniqueIndex("rollout_waves_wave_number_unique").on(table.waveNumber),
}));

export const waveSops = pgTable("wave_sops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  waveNumber: integer("wave_number").notNull(),
  // Stable SOP identity (the SOP code, e.g. "OPS-001").
  sopMasterId: varchar("sop_master_id").notNull(),
  // When set, this SOP is "operational" for its wave — training/enforcement has
  // begun. Null = queued behind the cadence guardrail.
  operationalAt: timestamp("operational_at"),
  operationalBy: varchar("operational_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  waveSopUnique: uniqueIndex("wave_sops_wave_sop_unique").on(table.waveNumber, table.sopMasterId),
  sopIdx: index("wave_sops_sop_idx").on(table.sopMasterId),
}));

export const insertRolloutWaveSchema = createInsertSchema(rolloutWaves).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWaveSopSchema = createInsertSchema(waveSops).omit({
  id: true,
  createdAt: true,
});

export type RolloutWave = typeof rolloutWaves.$inferSelect;
export type InsertRolloutWave = z.infer<typeof insertRolloutWaveSchema>;
export type WaveSop = typeof waveSops.$inferSelect;
export type InsertWaveSop = z.infer<typeof insertWaveSopSchema>;

// ==========================================
// SYSTEMS VAULT (Task #875)
// ==========================================
// Internal password manager for shared company credentials.
// Sensitivity tiers control reveal scrutiny and audit log retention:
//   low      – personal/own creds; click-to-reveal; 3-month retention
//   medium   – shared team tools; reason required; 6-month retention
//   high     – enterprise SaaS (Ceipal, VMS); reason + TOTP; 12-month retention
//   critical – financial / HR systems; reason + TOTP + 30s auto-hide; indefinite

export const vaults = pgTable("vaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 80 }),
  createdBy: varchar("created_by").notNull().references(() => adminUsers.id),
  isPersonal: boolean("is_personal").notNull().default(false),
  ownerId: varchar("owner_id").references(() => adminUsers.id),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  nameIdx: index("vaults_name_idx").on(t.name),
}));

export const vaultShares = pgTable("vault_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  role: varchar("role", { length: 20 }).notNull().default("viewer"),
  grantedBy: varchar("granted_by").notNull().references(() => adminUsers.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by").references(() => adminUsers.id),
}, (t) => ({
  vaultIdx: index("vault_shares_vault_idx").on(t.vaultId),
  userIdx: index("vault_shares_user_idx").on(t.userId),
}));

export const vaultSecrets = pgTable("vault_secrets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  systemName: varchar("system_name", { length: 120 }).notNull(),
  loginUrl: varchar("login_url", { length: 512 }),
  usernameEnc: text("username_enc"),
  passwordEnc: text("password_enc"),
  notesEnc: text("notes_enc"),
  sensitivity: varchar("sensitivity", { length: 20 }).default("medium").notNull(),
  rotationDueAt: timestamp("rotation_due_at"),
  rotationRequired: boolean("rotation_required").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
  createdBy: varchar("created_by").notNull().references(() => adminUsers.id),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  vaultIdx: index("vault_secrets_vault_idx").on(t.vaultId),
  sensitivityIdx: index("vault_secrets_sensitivity_idx").on(t.sensitivity),
  rotationIdx: index("vault_secrets_rotation_idx").on(t.rotationRequired),
}));

export const vaultSecretGrants = pgTable("vault_secret_grants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  secretId: varchar("secret_id").notNull().references(() => vaultSecrets.id),
  userId: varchar("user_id").references(() => adminUsers.id),
  roleName: varchar("role_name", { length: 60 }),
  canCopyPassword: boolean("can_copy_password").default(true).notNull(),
  canRevealPassword: boolean("can_reveal_password").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  grantedBy: varchar("granted_by").notNull().references(() => adminUsers.id),
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  secretIdx: index("vault_grants_secret_idx").on(t.secretId),
  userIdx: index("vault_grants_user_idx").on(t.userId),
  roleIdx: index("vault_grants_role_idx").on(t.roleName),
}));

export const vaultAuditLogs = pgTable("vault_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull(),
  secretId: varchar("secret_id"),
  vaultId: varchar("vault_id"),
  action: varchar("action", { length: 60 }).notNull(),
  ipHash: varchar("ip_hash", { length: 64 }),
  uaHash: varchar("ua_hash", { length: 64 }),
  reason: text("reason"),
  meta: text("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  actorIdx: index("vault_audit_actor_idx").on(t.actorId),
  secretIdx: index("vault_audit_secret_idx").on(t.secretId),
  actionIdx: index("vault_audit_action_idx").on(t.action),
  createdAtIdx: index("vault_audit_created_at_idx").on(t.createdAt),
}));

export const vaultAccessRequests = pgTable("vault_access_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => adminUsers.id),
  secretId: varchar("secret_id").notNull().references(() => vaultSecrets.id),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  requesterIdx: index("vault_access_requests_requester_idx").on(t.requesterId),
  secretIdx: index("vault_access_requests_secret_idx").on(t.secretId),
  statusIdx: index("vault_access_requests_status_idx").on(t.status),
}));

export const insertVaultSchema = createInsertSchema(vaults).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVaultSecretSchema = createInsertSchema(vaultSecrets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVaultSecretGrantSchema = createInsertSchema(vaultSecretGrants).omit({ id: true, createdAt: true });
export const insertVaultAuditLogSchema = createInsertSchema(vaultAuditLogs).omit({ id: true, createdAt: true });

export type Vault = typeof vaults.$inferSelect;
export type InsertVault = z.infer<typeof insertVaultSchema>;
export type VaultSecret = typeof vaultSecrets.$inferSelect;
export type InsertVaultSecret = z.infer<typeof insertVaultSecretSchema>;
export type VaultSecretGrant = typeof vaultSecretGrants.$inferSelect;
export type InsertVaultSecretGrant = z.infer<typeof insertVaultSecretGrantSchema>;
export type VaultAuditLog = typeof vaultAuditLogs.$inferSelect;
export type VaultAccessRequest = typeof vaultAccessRequests.$inferSelect;

// ==========================================
// PAYROLL ENGINE — India Statutory Computation (#854-A)
// ==========================================

// Salary component breakdown rule types
export const ruleTypeEnum = pgEnum("rule_type", ["percent_of_gross", "percent_of_component", "fixed", "residual"]);
// LOP deduction mode per component
export const lopModeEnum = pgEnum("lop_mode", ["proportional", "fixed"]);
// PF computation mode
export const pfModeEnum = pgEnum("pf_mode", ["restricted", "unrestricted"]);
// Establishment coverage status
export const coverageStatusEnum = pgEnum("coverage_status", ["not_applicable", "voluntary", "mandatory"]);
// Rounding mode for statutory rates
export const roundingModeEnum = pgEnum("rounding_mode", ["nearest", "up"]);

// Salary component structure (e.g. "Standard", custom)
export const salaryStructures = pgTable("salary_structures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  effectiveDate: date("effective_date").notNull().default(sql`CURRENT_DATE`),
  isActive: boolean("is_active").notNull().default(true),
  pfMode: pfModeEnum("pf_mode").notNull().default("restricted"),
  jurisdiction: varchar("jurisdiction", { length: 10 }).notNull().default("IN"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual component rules within a structure
export const salaryStructureRules = pgTable("salary_structure_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  structureId: varchar("structure_id").notNull().references(() => salaryStructures.id, { onDelete: "cascade" }),
  componentName: varchar("component_name", { length: 80 }).notNull(),
  ruleType: ruleTypeEnum("rule_type").notNull(),
  // For percent_of_gross / percent_of_component: percentage × 100 stored as integer
  // e.g. 50% → 5000; 8.33% → 833
  valuePct: integer("value_pct"),
  // For fixed: amount in paise (integer)
  valueFixed: integer("value_fixed"),
  // For percent_of_component: the component name to use as the base
  referenceComponent: varchar("reference_component", { length: 80 }),
  lopMode: lopModeEnum("lop_mode").notNull().default("proportional"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// State-level deductions (PT, PSDT, LWF)
export const stateDeductions = pgTable("state_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  state: varchar("state", { length: 50 }).notNull(),
  levyType: varchar("levy_type", { length: 20 }).notNull(),
  // Slab condition type: "gross_gte" | "gross_between" | "flat"
  conditionType: varchar("condition_type", { length: 40 }),
  // Gross threshold for slab (in paise)
  thresholdPaise: integer("threshold_paise"),
  // Monthly deduction amount (in paise)
  amountPaise: integer("amount_paise").notNull().default(0),
  // February-specific amount (in paise, if different)
  febAmountPaise: integer("feb_amount_paise"),
  // Flat levy: never prorated by LOP
  isFlat: boolean("is_flat").notNull().default(true),
  // monthly | half_yearly | annually
  cadence: varchar("cadence", { length: 20 }).notNull().default("monthly"),
  // JSON array of 1-based month numbers when deduction applies (null = all)
  deductionMonths: jsonb("deduction_months"),
  // Whether the company is registered for this levy
  isRegistered: boolean("is_registered").notNull().default(false),
  registrationNumber: varchar("registration_number"),
  // Basis for PSDT: "gross" | "basic"
  basis: varchar("basis", { length: 20 }).default("gross"),
  // Annual gross threshold for PSDT applicability (in paise)
  psdtAnnualThresholdPaise: integer("psdt_annual_threshold_paise"),
  jurisdiction: varchar("jurisdiction", { length: 10 }).notNull().default("IN"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("state_deductions_state_levy_idx").on(t.state, t.levyType),
  uniqueIndex("state_deductions_state_levy_jurisdiction_unique").on(t.state, t.levyType, t.jurisdiction),
]);

// Establishment-level coverage tracking for EPF & ESI
export const establishmentCoverage = pgTable("establishment_coverage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheme: varchar("scheme", { length: 10 }).notNull(),
  status: coverageStatusEnum("status").notNull().default("not_applicable"),
  // Headcount threshold that triggers mandatory coverage
  threshold: integer("threshold").notNull(),
  // Date from which mandatory coverage applies (if triggered)
  applicableFrom: date("applicable_from"),
  // Once mandatory, always mandatory (ratchet rule)
  isLatched: boolean("is_latched").notNull().default(false),
  triggerReason: text("trigger_reason"),
  registrationNumber: varchar("registration_number"),
  effectiveFrom: date("effective_from"),
  jurisdiction: varchar("jurisdiction", { length: 10 }).notNull().default("IN"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  uniqueIndex("establishment_coverage_scheme_jur_idx").on(t.scheme, t.jurisdiction),
]);

// Monthly headcount snapshots (for coverage threshold tracking)
export const headcountHistory = pgTable("headcount_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // First day of the month this record covers (YYYY-MM-01)
  period: date("period").notNull().unique(),
  totalCount: integer("total_count").notNull(),
  // JSONB breakdown e.g. { permanent: 12, contractor: 3, partTime: 1 }
  breakdown: jsonb("breakdown"),
  recordedAt: timestamp("recorded_at").defaultNow(),
  recordedBy: varchar("recorded_by"),
});

// Statutory rate schedule (EPF, ESI, etc.) — never hard-coded
export const statutoryRates = pgTable("statutory_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jurisdiction: varchar("jurisdiction", { length: 10 }).notNull().default("IN"),
  // Scheme: EPF | ESI | EDLI | EPS | EPF_ADMIN
  levy: varchar("levy", { length: 30 }).notNull(),
  // Key within levy: employee | employer | admin_fee | ...
  key: varchar("key", { length: 40 }).notNull(),
  // Rate as integer basis points (100 = 1%)
  valueBps: integer("value_bps").notNull(),
  // Minimum amount in paise (e.g. EPF admin fee min ₹500)
  minimumPaise: integer("minimum_paise"),
  // Maximum amount in paise (e.g. EPS cap ₹1,250/month)
  maximumPaise: integer("maximum_paise"),
  rounding: roundingModeEnum("rounding").notNull().default("nearest"),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("statutory_rates_levy_key_idx").on(t.jurisdiction, t.levy, t.key),
  uniqueIndex("statutory_rates_jurisdiction_levy_key_effective_from_unique").on(t.jurisdiction, t.levy, t.key, t.effectiveFrom),
]);

// Immutable revision history for salary slips (stores prior version on regenerate)
export const salarySlipRevisions = pgTable("salary_slip_revisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalSlipId: varchar("original_slip_id").notNull().references(() => salarySlips.id),
  snapshot: jsonb("snapshot").notNull(),
  replacedAt: timestamp("replaced_at").defaultNow(),
  replacedBy: varchar("replaced_by").references(() => adminUsers.id),
});

export const insertStateDeductionSchema = createInsertSchema(stateDeductions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEstablishmentCoverageSchema = createInsertSchema(establishmentCoverage).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStatutoryRateSchema = createInsertSchema(statutoryRates).omit({ id: true, createdAt: true });
export const insertSalarySlipRevisionSchema = createInsertSchema(salarySlipRevisions).omit({ id: true, replacedAt: true });
export const insertHeadcountHistorySchema = createInsertSchema(headcountHistory).omit({ id: true, recordedAt: true });

export type StateDeduction = typeof stateDeductions.$inferSelect;
export type InsertStateDeduction = z.infer<typeof insertStateDeductionSchema>;
export type EstablishmentCoverage = typeof establishmentCoverage.$inferSelect;
export type InsertEstablishmentCoverage = z.infer<typeof insertEstablishmentCoverageSchema>;
export type StatutoryRate = typeof statutoryRates.$inferSelect;
export type InsertStatutoryRate = z.infer<typeof insertStatutoryRateSchema>;
export type SalarySlipRevision = typeof salarySlipRevisions.$inferSelect;
export type InsertSalarySlipRevision = z.infer<typeof insertSalarySlipRevisionSchema>;
export type HeadcountHistory = typeof headcountHistory.$inferSelect;
export type InsertHeadcountHistory = z.infer<typeof insertHeadcountHistorySchema>;

// ---------------------------------------------------------------------------
// Payroll Settings — typed configuration for the India statutory payroll engine
// ---------------------------------------------------------------------------
export const payrollSettings = pgTable("payroll_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  /** Jurisdiction this row applies to (ISO 3166-1 alpha-2, e.g. "IN"). */
  jurisdiction: varchar("jurisdiction", { length: 10 }).notNull().default("IN"),
  /**
   * "actual_working_days" — LOP/actual_working_days × gross  (spec default)
   * "calendar"            — LOP/calendar_days × gross
   */
  lopBasis: varchar("lop_basis", { length: 30 }).notNull().default("actual_working_days"),
  /** Whether to print employer EPF/ESI contribution on the employee-visible PDF. */
  showEmployerContributionOnSlip: boolean("show_employer_contribution_on_slip").notNull().default(true),
  /** Default jurisdiction for new employees when pt_state is not set. */
  defaultJurisdiction: varchar("default_jurisdiction", { length: 10 }).notNull().default("IN"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
}, (table) => [
  uniqueIndex("payroll_settings_jurisdiction_unique").on(table.jurisdiction),
]);

export const insertPayrollSettingsSchema = createInsertSchema(payrollSettings).omit({ id: true, updatedAt: true });
export type PayrollSettings = typeof payrollSettings.$inferSelect;
export type InsertPayrollSettings = z.infer<typeof insertPayrollSettingsSchema>;

// ---------------------------------------------------------------------------
// Salary Structure History — tracks which salary structure was assigned to
// each employee and when, enabling period-start structure resolution.
// A baseline row is seeded at platform startup for all existing employees.
// ---------------------------------------------------------------------------
export const salaryStructureHistory = pgTable("salary_structure_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  structureId: varchar("structure_id").references(() => salaryStructures.id, { onDelete: "set null" }),
  /** Inclusive date from which this structure assignment applies. */
  effectiveFrom: date("effective_from").notNull(),
  assignedBy: varchar("assigned_by"),
  assignedAt: timestamp("assigned_at").defaultNow(),
}, (t) => [
  index("salary_structure_history_user_idx").on(t.userId),
  index("salary_structure_history_user_date_idx").on(t.userId, t.effectiveFrom),
]);

export const insertSalaryStructureHistorySchema = createInsertSchema(salaryStructureHistory).omit({ id: true, assignedAt: true });
export type SalaryStructureHistory = typeof salaryStructureHistory.$inferSelect;
export type InsertSalaryStructureHistory = z.infer<typeof insertSalaryStructureHistorySchema>;

// ---------------------------------------------------------------------------
// Studio BD Agent — persisted conversation + message store (Task #942)
// Gated to super_admin / admin / hr. Tables applied via direct SQL script.
// ---------------------------------------------------------------------------

export const bdConversations = pgTable("bd_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  title: varchar("title", { length: 200 }).notNull().default("New conversation"),
  domain: varchar("domain", { length: 50 }).default("general"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("bd_conversations_user_idx").on(t.userId),
  index("bd_conversations_created_at_idx").on(t.createdAt),
]);

export const bdMessages = pgTable("bd_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => bdConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("bd_messages_conversation_idx").on(t.conversationId),
  index("bd_messages_created_at_idx").on(t.createdAt),
]);

export const insertBdConversationSchema = createInsertSchema(bdConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBdMessageSchema = createInsertSchema(bdMessages).omit({ id: true, createdAt: true });

export type BdConversation = typeof bdConversations.$inferSelect;
export type InsertBdConversation = z.infer<typeof insertBdConversationSchema>;
export type BdMessage = typeof bdMessages.$inferSelect;
export type InsertBdMessage = z.infer<typeof insertBdMessageSchema>;

// ---------------------------------------------------------------------------
// BD Pitch Deck Library
// Versioned pitch decks (master templates + client-specific clones).
// Applied via direct SQL script: scripts/apply-bd-decks-tables.ts
// ---------------------------------------------------------------------------

export const bdDecks = pgTable("bd_decks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 300 }).notNull(),
  domain: varchar("domain", { length: 50 }).notNull().default("healthcare"),
  deckType: varchar("deck_type", { length: 20 }).notNull().default("master"),
  parentId: varchar("parent_id"),
  version: varchar("version", { length: 20 }).notNull().default("v1"),
  clientName: varchar("client_name", { length: 200 }),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  description: text("description"),
  changesSummary: text("changes_summary"),
  slides: jsonb("slides").notNull().default([]),
  isLocked: boolean("is_locked").notNull().default(false),
  lockedAt: timestamp("locked_at"),
  createdBy: varchar("created_by"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("bd_decks_domain_idx").on(t.domain),
  index("bd_decks_deck_type_idx").on(t.deckType),
  index("bd_decks_status_idx").on(t.status),
  index("bd_decks_parent_id_idx").on(t.parentId),
]);

export const insertBdDeckSchema = createInsertSchema(bdDecks).omit({ id: true, createdAt: true, updatedAt: true });
export type BdDeck = typeof bdDecks.$inferSelect;
export type InsertBdDeck = z.infer<typeof insertBdDeckSchema>;

// BD Deck Audit Log — every significant action on a deck is recorded here
export const bdDeckAuditLog = pgTable("bd_deck_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deckId: varchar("deck_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  actorId: varchar("actor_id"),
  actorEmail: varchar("actor_email", { length: 200 }),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("bd_deck_audit_deck_idx").on(t.deckId, t.createdAt),
]);

export type BdDeckAuditLog = typeof bdDeckAuditLog.$inferSelect;

// ---------------------------------------------------------------------------
// Governance Controls
// Shared obligation tracking table — every governed action (goal review,
// check-in, training deadline, SOP ack, probation milestone, PIP checkpoint)
// lands here so HR/CEO can see every obligation and its resolution status.
// Applied via server/index.ts ensure block (no drizzle-kit push interaction).
// ---------------------------------------------------------------------------

export const governanceControlTypeEnum = pgEnum("governance_control_type", [
  "goal", "check_in", "training", "sop", "probation", "pip",
  "manager_checkin_obligation", "manager_coaching_obligation",
]);

export const governanceControlStatusEnum = pgEnum("governance_control_status", [
  "pending", "in_progress", "completed", "overdue", "escalated", "closed", "disputed",
]);

export const governanceControls = pgTable("governance_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  controlType: governanceControlTypeEnum("control_type").notNull(),
  referenceId: varchar("reference_id"),
  ownerId: varchar("owner_id").notNull().references(() => adminUsers.id),
  managerId: varchar("manager_id").references(() => adminUsers.id),
  dueDate: date("due_date").notNull(),
  requiredAction: text("required_action").notNull(),
  evidenceRequired: boolean("evidence_required").notNull().default(false),
  status: governanceControlStatusEnum("status").notNull().default("pending"),
  evidenceRecord: text("evidence_record"),
  exceptionReason: text("exception_reason"),
  escalationLevel: integer("escalation_level").notNull().default(0),
  resolution: text("resolution"),
  closureDate: date("closure_date"),
  closedById: varchar("closed_by_id").references(() => adminUsers.id),
  disputeNote: text("dispute_note"),
  disputedAt: timestamp("disputed_at"),
  flaggedForHrReview: boolean("flagged_for_hr_review").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_gc_due_date").on(table.dueDate),
  index("idx_gc_manager_status").on(table.managerId, table.status),
  index("idx_gc_owner_status").on(table.ownerId, table.status),
  index("idx_gc_ref_identity").on(table.referenceId),
]);

export const insertGovernanceControlSchema = createInsertSchema(governanceControls).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type GovernanceControl = typeof governanceControls.$inferSelect;
export type InsertGovernanceControl = z.infer<typeof insertGovernanceControlSchema>;

// ── Agent Feedback Events ─────────────────────────────────────────────────────
// Shared feedback table for BD Agent and Content Copilot signals.
// Applied via scripts/apply-agent-feedback-table.ts (not drizzle-kit push).
// Declared here so db:push does NOT treat the live table as a drift orphan.
export const agentFeedbackEvents = pgTable("agent_feedback_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentType: varchar("agent_type", { length: 50 }).notNull(),
  sourceRecordType: varchar("source_record_type", { length: 50 }).notNull(),
  sourceRecordId: varchar("source_record_id", { length: 100 }).notNull(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  reasonCode: varchar("reason_code", { length: 50 }),
  generationId: varchar("generation_id", { length: 100 }),
  conversationId: varchar("conversation_id", { length: 100 }),
  domain: varchar("domain", { length: 50 }),
  audience: varchar("audience", { length: 50 }),
  contentGoal: varchar("content_goal", { length: 100 }),
  bdMode: varchar("bd_mode", { length: 100 }),
  icpId: varchar("icp_id", { length: 100 }),
  buyerStage: varchar("buyer_stage", { length: 50 }),
  painPointTheme: varchar("pain_point_theme", { length: 100 }),
  promptVersion: integer("prompt_version"),
  modelVersion: varchar("model_version", { length: 50 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("afe_user_source_idx").on(t.userId, t.sourceRecordType, t.sourceRecordId),
  index("afe_agent_type_idx").on(t.agentType, t.eventType, t.createdAt),
  index("afe_event_type_idx").on(t.eventType, t.createdAt),
  index("afe_domain_idx").on(t.domain, t.createdAt),
]);

export const insertAgentFeedbackEventSchema = createInsertSchema(agentFeedbackEvents).omit({ id: true, createdAt: true, updatedAt: true });
export type AgentFeedbackEvent = typeof agentFeedbackEvents.$inferSelect;
export type InsertAgentFeedbackEvent = z.infer<typeof insertAgentFeedbackEventSchema>;

// ── Governance Events ─────────────────────────────────────────────────────────
export const governanceEventSourceEnum = pgEnum("governance_event_source", [
  "user", "sync", "scheduler", "api",
]);

export const governanceEventTypeEnum = pgEnum("governance_event_type", [
  "created", "assigned", "reassigned", "status_changed", "evidence_submitted",
  "disputed", "escalated", "closed", "reopened", "exception_recorded", "sync_updated",
  "notification_sent",
]);

export const governanceEvents = pgTable("governance_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  controlId: varchar("control_id").notNull().references(() => governanceControls.id),
  eventType: governanceEventTypeEnum("event_type").notNull(),
  actorId: varchar("actor_id"),
  actorRef: varchar("actor_ref"),
  source: governanceEventSourceEnum("source").notNull().default("user"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ge_control_id").on(table.controlId),
  index("idx_ge_actor").on(table.actorId),
]);

export type GovernanceEvent = typeof governanceEvents.$inferSelect;

// ── Studio Post Performance ───────────────────────────────────────────────────
// Manual analytics log: content team records LinkedIn/Instagram metrics after
// each post so the AI regeneration system can learn what resonated.
// Applied via scripts/apply-studio-post-performance.ts (not drizzle-kit push).
// Declared here so db:push does NOT treat the live table as a drift orphan.
export const studioPostPlatformEnum = pgEnum("studio_post_platform", [
  "linkedin", "instagram", "facebook", "x", "website", "twitter", "other",
]);

export const studioPostPerformance = pgTable("studio_post_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").notNull().references(() => studioContentIdeas.id, { onDelete: "cascade" }),
  articleId: varchar("article_id"),
  platform: studioPostPlatformEnum("platform").notNull(),
  measuredAt: date("measured_at").notNull(),
  impressions: integer("impressions"),
  reactions: integer("reactions"),
  comments: integer("comments"),
  shares: integer("shares"),
  clicks: integer("clicks"),
  reach: integer("reach"),
  whatWorked: text("what_worked"),
  loggedByUserId: varchar("logged_by_user_id").notNull().references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudioPostPerformanceSchema = createInsertSchema(studioPostPerformance).omit({
  id: true,
  createdAt: true,
});
export type StudioPostPerformance = typeof studioPostPerformance.$inferSelect;
export type InsertStudioPostPerformance = z.infer<typeof insertStudioPostPerformanceSchema>;

// ── Integration Settings ───────────────────────────────────────────────────────
// Stores connection health metadata for external integrations (Ceipal, Zoom).
// Secrets are never stored here — only non-secret metadata like last sync counts,
// scopes, and token expiry. Credentials live in env vars or system_settings.
// Applied via scripts/apply-integration-settings.ts (not drizzle-kit push).
export const integrationStatusEnum = pgEnum("integration_status", [
  "connected", "error", "unconfigured",
]);

export const integrationSettings = pgTable("integration_settings", {
  key: varchar("key").primaryKey(),
  status: integrationStatusEnum("status").notNull().default("unconfigured"),
  lastCheckedAt: timestamp("last_checked_at"),
  lastError: text("last_error"),
  meta: jsonb("meta"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type IntegrationSetting = typeof integrationSettings.$inferSelect;

// ── Recruiter Activity & Conversion Tracker ──────────────────────────────────
// Task #1115 — daily call log, submission stage pipeline, team funnel view

export const recruiterActivityLogs = pgTable("recruiter_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recruiterId: varchar("recruiter_id").notNull().references(() => adminUsers.id),
  logDate: date("log_date").notNull(),
  callsMade: integer("calls_made").notNull().default(0),
  screensConducted: integer("screens_conducted").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("uq_recruiter_activity_date").on(table.recruiterId, table.logDate),
  index("idx_recruiter_activity_recruiter").on(table.recruiterId),
  index("idx_recruiter_activity_date").on(table.logDate),
]);

export const insertRecruiterActivityLogSchema = createInsertSchema(recruiterActivityLogs).omit({ id: true, createdAt: true, updatedAt: true });
export type RecruiterActivityLog = typeof recruiterActivityLogs.$inferSelect;
export type InsertRecruiterActivityLog = z.infer<typeof insertRecruiterActivityLogSchema>;

export const applicationStageHistory = pgTable("application_stage_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  fromStage: varchar("from_stage"),
  toStage: varchar("to_stage").notNull(),
  changedBy: varchar("changed_by").references(() => adminUsers.id),
  changedAt: timestamp("changed_at").defaultNow(),
  notes: text("notes"),
}, (table) => [
  index("idx_stage_history_application").on(table.applicationId),
  index("idx_stage_history_changed_at").on(table.changedAt),
]);

export const insertApplicationStageHistorySchema = createInsertSchema(applicationStageHistory).omit({ id: true, changedAt: true });
export type ApplicationStageHistory = typeof applicationStageHistory.$inferSelect;
export type InsertApplicationStageHistory = z.infer<typeof insertApplicationStageHistorySchema>;

// ── Ceipal Update Compliance Logs ───────────────────────────────────────────
// One record per recruiter per day, capturing their Ceipal update commitment.
// Status values:
//   confirmed           — recruiter said yes; background verification found evidence
//   confirmed_unverified — recruiter said yes; API unavailable (not penalised)
//   confirmed_no_evidence — recruiter said yes; API found 0 submissions (flag only)
//   deferred            — recruiter said "not yet" with a commitment
//   skipped             — recruiter dismissed the modal without answering
export const ceipalUpdateLogs = pgTable("ceipal_update_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  logDate: date("log_date").notNull(),
  status: varchar("status").notNull(), // confirmed | confirmed_unverified | confirmed_no_evidence | deferred | skipped
  deferredReason: varchar("deferred_reason"),
  commitmentTime: timestamp("commitment_time"),
  verifiedCount: integer("verified_count"),   // submissions found (null if unverified)
  jobsCount: integer("jobs_count"),           // job activity found (null if unverified)
  verifiedAt: timestamp("verified_at"),
  managerFlaggedAt: timestamp("manager_flagged_at"),
  managerAcknowledgedAt: timestamp("manager_acknowledged_at"),
  managerAcknowledgedBy: varchar("manager_acknowledged_by").references(() => adminUsers.id),
  exemptionReason: text("exemption_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("uq_ceipal_update_log_user_date").on(table.userId, table.logDate),
  index("idx_ceipal_update_logs_user").on(table.userId),
  index("idx_ceipal_update_logs_date").on(table.logDate),
]);

export const insertCeipalUpdateLogSchema = createInsertSchema(ceipalUpdateLogs).omit({ id: true, createdAt: true });
export type CeipalUpdateLog = typeof ceipalUpdateLogs.$inferSelect;
export type InsertCeipalUpdateLog = z.infer<typeof insertCeipalUpdateLogSchema>;

// ── Goal Copilot tables ───────────────────────────────────────────────────────

export const copilotConversations = pgTable("copilot_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  role: varchar("role").notNull(),
  content: text("content").notNull(),
  intentDetected: varchar("intent_detected"),
  contextSnapshotJson: jsonb("context_snapshot_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_copilot_conversations_user_id").on(table.userId),
]);

export const companyFinancialTargets = pgTable("company_financial_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => performanceGoals.id, { onDelete: "set null" }),
  label: varchar("label").notNull(),
  quarter: varchar("quarter"),
  year: integer("year"),
  targetAmount: numeric("target_amount", { precision: 14, scale: 2 }),
  actualAmount: numeric("actual_amount", { precision: 14, scale: 2 }),
  currency: varchar("currency").notNull().default("INR"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companyGoalActions = pgTable("company_goal_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => performanceGoals.id, { onDelete: "set null" }),
  title: varchar("title").notNull(),
  description: text("description"),
  assignedTo: varchar("assigned_to"),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Attendance Deficit Pool ────────────────────────────────────────────────────
// Per-employee monthly accumulator for short-day shortfalls.
// Feeds the two-tier classification engine: small daily deficits (short_day)
// silently accumulate here; month-end settlement converts excess to LWP when
// the total crosses the configurable threshold (default 120 min).
// Half Day and Absent days do NOT feed this pool — they are fully consumed by the daily tier.
export const attendanceDeficitPool = pgTable("attendance_deficit_pool", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => adminUsers.id),
  month: varchar("month", { length: 7 }).notNull(), // 'YYYY-MM'
  deficitMinutes: integer("deficit_minutes").notNull().default(0),
  dailyContributions: jsonb("daily_contributions").notNull().default({}), // { 'YYYY-MM-DD': shortfallMinutes }
  settledAt: timestamp("settled_at"),
  settledLwpDays: numeric("settled_lwp_days"),
  settledLeaveType: varchar("settled_leave_type"), // 'EL' | 'SL' | 'LWP' | 'mixed' | 'forgiven'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_deficit_pool_employee_month").on(table.employeeId, table.month),
]);

export const insertAttendanceDeficitPoolSchema = createInsertSchema(attendanceDeficitPool).omit({ id: true, createdAt: true, updatedAt: true });
export type AttendanceDeficitPool = typeof attendanceDeficitPool.$inferSelect;
export type InsertAttendanceDeficitPool = typeof insertAttendanceDeficitPoolSchema._type;

// ── Email Blast Review Queue ──────────────────────────────────────────────────
// Automated cron jobs that send emails to many recipients at once route through
// this queue for Super Admin / Admin review before delivery.
// queueBlast() inserts here when recipients.length >= blast_threshold setting.

export const pendingEmailBlastStatusEnum = pgEnum("pending_email_blast_status", [
  "pending", "approved", "delivering", "sent", "partially_failed", "failed", "cancelled",
]);

export const blastDeliveryStatusEnum = pgEnum("blast_delivery_status", [
  "pending", "sent", "failed", "skipped",
]);

export const pendingEmailBlasts = pgTable("pending_email_blasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  triggerSource: varchar("trigger_source").notNull(),
  status: pendingEmailBlastStatusEnum("status").notNull().default("pending"),
  subject: varchar("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  originalSubject: varchar("original_subject"),
  originalBodyHtml: text("original_body_html"),
  recipients: jsonb("recipients").notNull().$type<{ userId: string; name: string; email: string }[]>(),
  recipientCount: integer("recipient_count").notNull().default(0),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewedAt: timestamp("reviewed_at"),
  editedBy: varchar("edited_by").references(() => adminUsers.id),
  editedAt: timestamp("edited_at"),
  cancelReason: text("cancel_reason"),
  deliveryStartedAt: timestamp("delivery_started_at"),
  deliveryFinishedAt: timestamp("delivery_finished_at"),
  alertSent: boolean("alert_sent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_pending_email_blasts_status").on(table.status, table.createdAt),
]);

export const blastDeliveryRecords = pgTable("blast_delivery_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blastId: varchar("blast_id").notNull().references(() => pendingEmailBlasts.id, { onDelete: "cascade" }),
  userId: varchar("user_id"),
  email: varchar("email").notNull(),
  status: blastDeliveryStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
}, (table) => [
  index("idx_blast_delivery_blast_id").on(table.blastId),
]);

export const insertPendingEmailBlastSchema = createInsertSchema(pendingEmailBlasts).omit({ id: true, createdAt: true });
export type PendingEmailBlast = typeof pendingEmailBlasts.$inferSelect;
export type InsertPendingEmailBlast = z.infer<typeof insertPendingEmailBlastSchema>;

export const insertBlastDeliveryRecordSchema = createInsertSchema(blastDeliveryRecords).omit({ id: true });
export type BlastDeliveryRecord = typeof blastDeliveryRecords.$inferSelect;

// ---------------------------------------------------------------------------
// SOP Wave Scheduled Launches — delegated scheduling for wave go-lives
// Applied via direct SQL script: scripts/apply-wave-scheduling-schema.ts
// ---------------------------------------------------------------------------

export const waveScheduledLaunchStatusEnum = pgEnum("wave_scheduled_launch_status", [
  "pending_approval",
  "approved",
  "active",
  "cancelled",
]);

export const waveScheduledLaunches = pgTable("wave_scheduled_launches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  waveNumber: integer("wave_number").notNull(),
  scheduledByUserId: varchar("scheduled_by_user_id").notNull().references(() => adminUsers.id),
  goLiveDate: date("go_live_date").notNull(),
  graceDays: integer("grace_days").notNull().default(0),
  status: waveScheduledLaunchStatusEnum("status").notNull().default("pending_approval"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  approvedBy: varchar("approved_by").references(() => adminUsers.id),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
}, (t) => [
  index("idx_wave_scheduled_launches_wave").on(t.waveNumber),
  index("idx_wave_scheduled_launches_status").on(t.status),
  index("idx_wave_scheduled_launches_go_live").on(t.goLiveDate),
]);

export const insertWaveScheduledLaunchSchema = createInsertSchema(waveScheduledLaunches).omit({
  id: true,
  submittedAt: true,
  approvedBy: true,
  approvedAt: true,
});
export type WaveScheduledLaunch = typeof waveScheduledLaunches.$inferSelect;
export type InsertWaveScheduledLaunch = z.infer<typeof insertWaveScheduledLaunchSchema>;

// ---------------------------------------------------------------------------
// SOP Wave Readiness Signals — manager signals that their team is ready
// ---------------------------------------------------------------------------

export const waveReadinessSignals = pgTable("wave_readiness_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  waveNumber: integer("wave_number").notNull(),
  managerId: varchar("manager_id").notNull().references(() => adminUsers.id),
  signalledAt: timestamp("signalled_at").defaultNow().notNull(),
}, (t) => [
  index("idx_wave_readiness_signals_wave").on(t.waveNumber),
  uniqueIndex("idx_wave_readiness_unique_wave_manager").on(t.waveNumber, t.managerId),
]);

export const insertWaveReadinessSignalSchema = createInsertSchema(waveReadinessSignals).omit({
  id: true,
  signalledAt: true,
});
export type WaveReadinessSignal = typeof waveReadinessSignals.$inferSelect;
export type InsertWaveReadinessSignal = z.infer<typeof insertWaveReadinessSignalSchema>;

// ==========================================
// OBSERVATION TOWER — COMPANY GOAL TEMPLATES
// ==========================================
// Read-only library of org-level goal templates managers/admins can use
// when firing a signal-action "create_goal" from the Observation Tower.
// Applied via raw SQL (scripts/add-company-goal-templates.ts); declared
// here so drizzle schema stays as the single source of truth.

export const companyGoalTemplates = pgTable("company_goal_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateCode: varchar("template_code", { length: 60 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  suggestedMilestones: jsonb("suggested_milestones").notNull().default(sql`'[]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_company_goal_templates_active").on(table.isActive),
]);

export const insertCompanyGoalTemplateSchema = createInsertSchema(companyGoalTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CompanyGoalTemplate = typeof companyGoalTemplates.$inferSelect;
export type InsertCompanyGoalTemplate = z.infer<typeof insertCompanyGoalTemplateSchema>;
